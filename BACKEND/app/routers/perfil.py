import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import get_current_user, require_role
from ..schemas import AvatarCreate, AvatarOut, AvatarSelect, AvatarUpdate, PerfilOut

router = APIRouter(prefix="/perfil", tags=["Perfil do Aluno"])

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "avatars")


@router.get("/avatares", response_model=list[AvatarOut])
def listar_avatares(db: Session = Depends(get_db)):
    avatares = (
        db.query(models.Avatar)
        .filter(models.Avatar.ativo == True)
        .order_by(models.Avatar.ordem)
        .all()
    )
    return avatares


@router.get("/avatares/todos", response_model=list[AvatarOut])
def listar_todos_avatares(
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(require_role("GESTOR_PLATAFORMA", "DEV")),
):
    return db.query(models.Avatar).order_by(models.Avatar.ordem).all()


@router.post("/avatares", response_model=AvatarOut)
def criar_avatar(
    dados: AvatarCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(require_role("GESTOR_PLATAFORMA", "DEV")),
):
    avatar = models.Avatar(
        nome=dados.nome,
        descricao=dados.descricao,
        url_imagem=dados.url_imagem,
        ordem=dados.ordem,
        ativo=True,
    )
    db.add(avatar)
    db.commit()
    db.refresh(avatar)
    return avatar


@router.put("/avatares/{avatar_id}", response_model=AvatarOut)
def atualizar_avatar(
    avatar_id: int,
    dados: AvatarUpdate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(require_role("GESTOR_PLATAFORMA", "DEV")),
):
    avatar = db.get(models.Avatar, avatar_id)
    if not avatar:
        raise HTTPException(status_code=404, detail="Avatar não encontrado.")
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(avatar, campo, valor)
    db.commit()
    db.refresh(avatar)
    return avatar


@router.delete("/avatares/{avatar_id}")
def deletar_avatar(
    avatar_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(require_role("GESTOR_PLATAFORMA", "DEV")),
):
    avatar = db.get(models.Avatar, avatar_id)
    if not avatar:
        raise HTTPException(status_code=404, detail="Avatar não encontrado.")
    avatar.ativo = False
    db.commit()
    return {"success": True}


@router.post("/upload-avatar")
async def upload_avatar(
    arquivo: UploadFile = File(...),
    usuario: models.Usuario = Depends(require_role("GESTOR_PLATAFORMA", "DEV")),
):
    os.makedirs(STATIC_DIR, exist_ok=True)
    ext = os.path.splitext(arquivo.filename or "upload.png")[1] or ".png"
    nome = f"avatar_{uuid.uuid4().hex[:8]}{ext}"
    caminho = os.path.join(STATIC_DIR, nome)
    conteudo = await arquivo.read()
    with open(caminho, "wb") as f:
        f.write(conteudo)
    return {"url_imagem": f"/static/avatars/{nome}"}


@router.get("/me", response_model=PerfilOut)
def obter_perfil(
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(get_current_user),
):
    perfil = db.query(models.PerfilAluno).filter(
        models.PerfilAluno.id_usuario == usuario.id_usuario
    ).first()
    if not perfil:
        return PerfilOut(
            id_usuario=usuario.id_usuario,
            id_avatar=None,
            avatar_configurado=False,
        )
    return perfil


@router.post("/selecionar-avatar", response_model=PerfilOut)
def selecionar_avatar(
    dados: AvatarSelect,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(require_role("ALUNO")),
):
    avatar = db.get(models.Avatar, dados.id_avatar)
    if not avatar or not avatar.ativo:
        raise HTTPException(status_code=404, detail="Avatar não encontrado.")

    perfil = db.query(models.PerfilAluno).filter(
        models.PerfilAluno.id_usuario == usuario.id_usuario
    ).first()

    if perfil:
        perfil.id_avatar = dados.id_avatar
        perfil.avatar_configurado = True
    else:
        perfil = models.PerfilAluno(
            id_usuario=usuario.id_usuario,
            id_avatar=dados.id_avatar,
            avatar_configurado=True,
        )
        db.add(perfil)

    db.commit()
    db.refresh(perfil)
    return perfil
