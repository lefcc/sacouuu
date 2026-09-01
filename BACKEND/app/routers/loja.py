import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import get_current_user, require_role
from ..schemas import (
    ComprarItem,
    EquiparItem,
    ItemCompradoOut,
    ItemLojaCreate,
    ItemLojaOut,
    ItemLojaUpdate,
)

router = APIRouter(prefix="/loja", tags=["Loja de Personalização"])

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "loja")


@router.get("/itens", response_model=list[ItemLojaOut])
def listar_itens(db: Session = Depends(get_db)):
    itens = db.query(models.ItemLoja).filter(models.ItemLoja.ativo == True).all()
    return itens


@router.get("/meus-itens", response_model=list[ItemCompradoOut])
def listar_meus_itens(
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(require_role("ALUNO")),
):
    itens = (
        db.query(models.ItemComprado)
        .filter(models.ItemComprado.id_usuario == usuario.id_usuario)
        .all()
    )
    return [ItemCompradoOut(id_item=i.id_item, equipado=i.equipado) for i in itens]


@router.post("/comprar", response_model=ItemCompradoOut)
def comprar_item(
    dados: ComprarItem,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(require_role("ALUNO")),
):
    item = db.get(models.ItemLoja, dados.id_item)
    if not item or not item.ativo:
        raise HTTPException(status_code=404, detail="Item não encontrado.")

    # BLOQUEIO PESSIMISTA DE LINHA: trava a linha do usuário (SELECT ... FOR
    # UPDATE). Requisições concorrentes ficam bloqueadas até o commit/rollback
    # desta transação, lendo o saldo ATUALIZADO — previne saldo negativo e
    # compra duplicada por corrida.
    usuario = (
        db.query(models.Usuario)
        .filter(models.Usuario.id_usuario == usuario.id_usuario)
        .with_for_update()
        .first()
    )
    if not usuario:
        raise HTTPException(status_code=404, detail="Aluno não encontrado.")

    # Verificar se já comprou (após adquirir o lock — estado atualizado)
    ja_comprou = (
        db.query(models.ItemComprado)
        .filter(
            models.ItemComprado.id_usuario == usuario.id_usuario,
            models.ItemComprado.id_item == dados.id_item,
        )
        .first()
    )
    if ja_comprou:
        raise HTTPException(status_code=400, detail="Você já possui este item.")

    # Verificar trilha requerida
    if item.id_trilha_requerida:
        trilha_id = item.id_trilha_requerida
        licoes_trilha = (
            db.query(models.Licao)
            .filter(models.Licao.id_trilha == trilha_id)
            .all()
        )
        ids_licoes = [l.id_licao for l in licoes_trilha]
        aprovadas = (
            db.query(models.ProgressoLicao)
            .filter(
                models.ProgressoLicao.id_aluno == usuario.id_usuario,
                models.ProgressoLicao.id_licao.in_(ids_licoes),
                models.ProgressoLicao.status_aprovacao == True,
            )
            .count()
        )
        if aprovadas < 2:
            raise HTTPException(
                status_code=403,
                detail=f"Complete pelo menos 2 aulas da trilha para desbloquear este item.",
            )

    # Verificar saldo (defesa em profundidade)
    if (usuario.moedas_total or 0) < item.preco:
        raise HTTPException(status_code=400, detail="Saldo insuficiente.")

    # Debitar moedas
    usuario.moedas_total = (usuario.moedas_total or 0) - item.preco

    # Registrar compra
    compra = models.ItemComprado(
        id_usuario=usuario.id_usuario,
        id_item=dados.id_item,
        equipado=False,
        data_compra=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    db.add(compra)

    # Transação atômica: qualquer falha desfaz o débito e libera o lock.
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Item já comprado.")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Falha ao processar compra. Tente novamente.")

    return ItemCompradoOut(id_item=compra.id_item, equipado=compra.equipado)


@router.put("/equipar/{item_id}")
def equipar_item(
    item_id: int,
    dados: EquiparItem,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(require_role("ALUNO")),
):
    compra = (
        db.query(models.ItemComprado)
        .filter(
            models.ItemComprado.id_usuario == usuario.id_usuario,
            models.ItemComprado.id_item == item_id,
        )
        .first()
    )
    if not compra:
        raise HTTPException(status_code=404, detail="Você não possui este item.")

    if dados.equipado:
        # Apenas UM item por tipo (CABECA / ROSTO / CORPO): ao equipar um item,
        # os demais itens do mesmo tipo que o aluno possui são desequipados.
        item = db.get(models.ItemLoja, item_id)
        if item and item.categoria:
            outros_mesmo_tipo = (
                db.query(models.ItemComprado)
                .join(models.ItemLoja, models.ItemComprado.id_item == models.ItemLoja.id_item)
                .filter(
                    models.ItemComprado.id_usuario == usuario.id_usuario,
                    models.ItemComprado.equipado == True,
                    models.ItemComprado.id_item != item_id,
                    models.ItemLoja.categoria == item.categoria,
                )
                .all()
            )
            for outro in outros_mesmo_tipo:
                outro.equipado = False

    compra.equipado = dados.equipado
    db.commit()
    return {"success": True}


# ── Admin CRUD ────────────────────────────────────────────────────────────────

@router.get("/admin/todos", response_model=list[ItemLojaOut])
def admin_listar_itens(
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(require_role("GESTOR_PLATAFORMA", "DEV")),
):
    return db.query(models.ItemLoja).order_by(models.ItemLoja.id_item).all()


@router.post("/admin", response_model=ItemLojaOut)
def admin_criar_item(
    dados: ItemLojaCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(require_role("GESTOR_PLATAFORMA", "DEV")),
):
    item = models.ItemLoja(
        nome=dados.nome,
        descricao=dados.descricao,
        url_imagem=dados.url_imagem,
        preco=dados.preco,
        id_trilha_requerida=dados.id_trilha_requerida,
        ativo=True,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/admin/{item_id}", response_model=ItemLojaOut)
def admin_atualizar_item(
    item_id: int,
    dados: ItemLojaUpdate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(require_role("GESTOR_PLATAFORMA", "DEV")),
):
    item = db.get(models.ItemLoja, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado.")
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(item, campo, valor)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/admin/{item_id}")
def admin_deletar_item(
    item_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(require_role("GESTOR_PLATAFORMA", "DEV")),
):
    item = db.get(models.ItemLoja, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado.")
    item.ativo = False
    db.commit()
    return {"success": True}


@router.post("/upload-item")
async def upload_item_image(
    arquivo: UploadFile = File(...),
    usuario: models.Usuario = Depends(require_role("GESTOR_PLATAFORMA", "DEV")),
):
    os.makedirs(STATIC_DIR, exist_ok=True)
    ext = os.path.splitext(arquivo.filename or "upload.png")[1] or ".png"
    nome = f"item_{uuid.uuid4().hex[:8]}{ext}"
    caminho = os.path.join(STATIC_DIR, nome)
    conteudo = await arquivo.read()
    with open(caminho, "wb") as f:
        f.write(conteudo)
    return {"url_imagem": f"/static/loja/{nome}"}
