import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session, selectinload

from .. import models
from ..database import get_db
from ..deps import require_role
from ..schemas import (
    LicaoCreate,
    LicaoUpdate,
    PerguntaCreate,
    PerguntaUpdate,
    TrilhaCreate,
    TrilhaUpdate,
)

router = APIRouter(prefix="/conteudo", tags=["Gestão de Conteúdo (Desktop)"])

editor = require_role("GESTOR_PLATAFORMA", "DEV", "ADMIN_ESCOLA", "VISUALIZADOR_ESCOLA")

STATIC_AUDIOS = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "audios")
STATIC_VIDEOS = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "videos")


# ── Trilhas ──────────────────────────────────────────────────────────────────

@router.get("/trilhas-admin")
def admin_listar_trilhas(db: Session = Depends(get_db), _=Depends(editor)):
    trilhas = (
        db.query(models.Trilha)
        .options(selectinload(models.Trilha.licoes))
        .order_by(models.Trilha.id_trilha)
        .all()
    )
    return [
        {
            "id_trilha": t.id_trilha,
            "nome_trilha": t.nome_trilha,
            "qtd_licoes": len(t.licoes),
        }
        for t in trilhas
    ]


@router.post("/trilhas", status_code=201)
def criar_trilha(dados: TrilhaCreate, db: Session = Depends(get_db), _=Depends(editor)):
    trilha = models.Trilha(
        nome_trilha=dados.nome_trilha,
    )
    db.add(trilha)
    db.commit()
    db.refresh(trilha)
    return {"id_trilha": trilha.id_trilha, "nome_trilha": trilha.nome_trilha}


@router.put("/trilhas/{trilha_id}")
def atualizar_trilha(
    trilha_id: int, dados: TrilhaUpdate, db: Session = Depends(get_db), _=Depends(editor),
):
    trilha = db.get(models.Trilha, trilha_id)
    if not trilha:
        raise HTTPException(status_code=404, detail="Trilha não encontrada.")
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(trilha, campo, valor)
    db.commit()
    db.refresh(trilha)
    return {"id_trilha": trilha.id_trilha, "nome_trilha": trilha.nome_trilha}


@router.delete("/trilhas/{trilha_id}", status_code=204)
def deletar_trilha(trilha_id: int, db: Session = Depends(get_db), _=Depends(editor)):
    trilha = db.get(models.Trilha, trilha_id)
    if not trilha:
        raise HTTPException(status_code=404, detail="Trilha não encontrada.")
    if trilha.licoes:
        raise HTTPException(status_code=400, detail="Remova todas as aulas antes de excluir a trilha.")
    db.delete(trilha)
    db.commit()


def _substituir_perguntas(db: Session, licao: models.Licao, perguntas: list[PerguntaCreate]):
    for p in perguntas:
        nova = models.Pergunta(
            id_licao=licao.id_licao,
            enunciado=p.enunciado,
            explicacao_feedback=p.explicacao_feedback,
        )
        nova.alternativas = [
            models.Alternativa(texto=a.texto, eh_correta=a.eh_correta)
            for a in p.alternativas
        ]
        db.add(nova)


# ── Lições ────────────────────────────────────────────────────────────────────
@router.post("/licoes", status_code=201)
def criar_licao(dados: LicaoCreate, db: Session = Depends(get_db), _=Depends(editor)):
    trilha = db.get(models.Trilha, dados.id_trilha)
    if not trilha:
        raise HTTPException(status_code=404, detail="Trilha não encontrada.")

    licao = models.Licao(
        id_trilha=dados.id_trilha,
        titulo=dados.titulo,
        conteudo_video=dados.conteudo_video,
        conteudo_audio=dados.conteudo_audio,
        url_imagem=dados.url_imagem,
        recompensa_moedas_max=dados.recompensa_moedas_max,
        ordem=dados.ordem,
    )
    db.add(licao)
    db.flush()
    _substituir_perguntas(db, licao, dados.perguntas)
    db.commit()
    db.refresh(licao)
    return {"id_licao": licao.id_licao, "titulo": licao.titulo}


@router.put("/licoes/{licao_id}")
def atualizar_licao(
    licao_id: int,
    dados: LicaoUpdate,
    db: Session = Depends(get_db),
    _=Depends(editor),
):
    licao = db.get(models.Licao, licao_id)
    if not licao:
        raise HTTPException(status_code=404, detail="Aula não encontrada.")

    atualizacoes = dados.model_dump(exclude_unset=True)
    for campo, valor in atualizacoes.items():
        setattr(licao, campo, valor)

    db.commit()
    db.refresh(licao)
    return {"id_licao": licao.id_licao, "titulo": licao.titulo}


@router.delete("/licoes/{licao_id}", status_code=204)
def deletar_licao(licao_id: int, db: Session = Depends(get_db), _=Depends(editor)):
    licao = db.get(models.Licao, licao_id)
    if not licao:
        raise HTTPException(status_code=404, detail="Aula não encontrada.")
    db.delete(licao)
    db.commit()


# ── Perguntas ─────────────────────────────────────────────────────────────────
@router.get("/perguntas")
def listar_perguntas(db: Session = Depends(get_db), _=Depends(editor)):
    perguntas = (
        db.query(models.Pergunta)
        .options(selectinload(models.Pergunta.alternativas))
        .order_by(models.Pergunta.id_licao, models.Pergunta.id_pergunta)
        .all()
    )
    # Uma única query para o mapa {id_licao: titulo} — evita N+1 no loop.
    titulos_licoes = dict(
        db.query(models.Licao.id_licao, models.Licao.titulo).all()
    )
    resultado = []
    for p in perguntas:
        resultado.append(
            {
                "id": p.id_pergunta,
                "id_licao": p.id_licao,
                "licao_titulo": titulos_licoes.get(p.id_licao),
                "text": p.enunciado,
                "explicacao_feedback": p.explicacao_feedback,
                "alternativas": [
                    {"texto": a.texto, "eh_correta": bool(a.eh_correta)}
                    for a in p.alternativas
                ],
            }
        )
    return resultado


@router.post("/perguntas", status_code=201)
def criar_pergunta(
    dados: PerguntaCreate,
    db: Session = Depends(get_db),
    _=Depends(editor),
):
    licao = db.get(models.Licao, dados.id_licao)
    if not licao:
        raise HTTPException(status_code=404, detail="Aula não encontrada.")

    pergunta = models.Pergunta(
        id_licao=dados.id_licao,
        enunciado=dados.enunciado,
        explicacao_feedback=dados.explicacao_feedback,
    )
    pergunta.alternativas = [
        models.Alternativa(texto=a.texto, eh_correta=a.eh_correta)
        for a in dados.alternativas
    ]
    db.add(pergunta)
    db.commit()
    db.refresh(pergunta)
    return {"id_pergunta": pergunta.id_pergunta}


@router.put("/perguntas/{pergunta_id}")
def atualizar_pergunta(
    pergunta_id: int,
    dados: PerguntaUpdate,
    db: Session = Depends(get_db),
    _=Depends(editor),
):
    pergunta = db.get(models.Pergunta, pergunta_id)
    if not pergunta:
        raise HTTPException(status_code=404, detail="Pergunta não encontrada.")

    if dados.enunciado is not None:
        pergunta.enunciado = dados.enunciado
    if dados.explicacao_feedback is not None:
        pergunta.explicacao_feedback = dados.explicacao_feedback
    if dados.alternativas is not None:
        pergunta.alternativas = [
            models.Alternativa(texto=a.texto, eh_correta=a.eh_correta)
            for a in dados.alternativas
        ]

    db.commit()
    return {"id_pergunta": pergunta.id_pergunta}


@router.delete("/perguntas/{pergunta_id}", status_code=204)
def deletar_pergunta(
    pergunta_id: int,
    db: Session = Depends(get_db),
    _=Depends(editor),
):
    pergunta = db.get(models.Pergunta, pergunta_id)
    if not pergunta:
        raise HTTPException(status_code=404, detail="Pergunta não encontrada.")
    db.delete(pergunta)
    db.commit()


# ── Upload de mídia ──────────────────────────────────────────────────────────

@router.post("/upload-audio")
async def upload_audio(
    arquivo: UploadFile = File(...),
    _=Depends(editor),
):
    os.makedirs(STATIC_AUDIOS, exist_ok=True)
    ext = os.path.splitext(arquivo.filename or "audio.mp3")[1] or ".mp3"
    nome = f"audio_{uuid.uuid4().hex[:8]}{ext}"
    caminho = os.path.join(STATIC_AUDIOS, nome)
    conteudo = await arquivo.read()
    with open(caminho, "wb") as f:
        f.write(conteudo)
    return {"url": f"/static/audios/{nome}"}


@router.post("/upload-video")
async def upload_video(
    arquivo: UploadFile = File(...),
    _=Depends(editor),
):
    os.makedirs(STATIC_VIDEOS, exist_ok=True)
    ext = os.path.splitext(arquivo.filename or "video.mp4")[1] or ".mp4"
    nome = f"video_{uuid.uuid4().hex[:8]}{ext}"
    caminho = os.path.join(STATIC_VIDEOS, nome)
    conteudo = await arquivo.read()
    with open(caminho, "wb") as f:
        f.write(conteudo)
    return {"url": f"/static/videos/{nome}"}


@router.post("/upload-image")
async def upload_image(
    arquivo: UploadFile = File(...),
    _=Depends(editor),
):
    static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "images")
    os.makedirs(static_dir, exist_ok=True)
    ext = os.path.splitext(arquivo.filename or "image.png")[1] or ".png"
    nome = f"img_{uuid.uuid4().hex[:8]}{ext}"
    caminho = os.path.join(static_dir, nome)
    conteudo = await arquivo.read()
    with open(caminho, "wb") as f:
        f.write(conteudo)
    return {"url": f"/static/images/{nome}"}
