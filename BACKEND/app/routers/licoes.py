from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import models
from ..config import API_BASE_URL
from ..database import get_db
from ..deps import get_current_user
from ..schemas import LicaoOut, TrilhaOut

router = APIRouter(tags=["Conteúdo (Mobile)"])


class TrilhaPublicaOut(BaseModel):
    id_trilha: int
    nome_trilha: str
    qtd_licoes: int


@router.get("/trilhas/public", response_model=list[TrilhaPublicaOut])
def listar_trilhas_publicas(db: Session = Depends(get_db)):
    """Endpoint PÚBLICO (landing page) com apenas dados de marketing.

    NÃO expõe as lições/perguntas/alternativas (gabaritos) — só o nome e a
    contagem de aulas, para a página de vendas se manter sincronizada com o banco.
    """
    trilhas = db.execute(
        select(models.Trilha).order_by(models.Trilha.id_trilha)
    ).scalars().all()
    return [
        TrilhaPublicaOut(
            id_trilha=t.id_trilha,
            nome_trilha=t.nome_trilha,
            qtd_licoes=len(t.licoes),
        )
        for t in trilhas
    ]


def _audio_url(nome: str | None) -> str | None:
    if not nome:
        return None
    if nome.startswith("http"):
        return nome
    return f"{API_BASE_URL}/static/audios/{nome}"


def _serializar_licao(licao: models.Licao) -> LicaoOut:
    conteudo = [linha for linha in (licao.conteudo_video or "").splitlines() if linha.strip()]

    perguntas = []
    for p in licao.perguntas:
        perguntas.append(
            {
                "id_pergunta": p.id_pergunta,
                "enunciado": p.enunciado,
                "explicacao_feedback": p.explicacao_feedback,
                "alternativas": [
                    {
                        "id_alternativa": a.id_alternativa,
                        "texto": a.texto,
                        "eh_correta": bool(a.eh_correta),
                    }
                    for a in p.alternativas
                ],
            }
        )

    return LicaoOut(
        id_licao=licao.id_licao,
        id_trilha=licao.id_trilha,
        titulo=licao.titulo,
        conteudo=conteudo,
        audio_url=_audio_url(licao.conteudo_audio),
        url_imagem=licao.url_imagem,
        ordem=licao.ordem,
        perguntas=perguntas,
    )


@router.get("/licoes", response_model=list[LicaoOut])
def listar_licoes(db: Session = Depends(get_db), _=Depends(get_current_user)):
    licoes = db.execute(
        select(models.Licao)
        .options(
            selectinload(models.Licao.perguntas).selectinload(models.Pergunta.alternativas)
        )
        .order_by(models.Licao.ordem)
    ).scalars().all()
    return [_serializar_licao(l) for l in licoes]


@router.get("/licoes/{licao_id}", response_model=LicaoOut)
def detalhe_licao(licao_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    licao = db.get(models.Licao, licao_id)
    if not licao:
        raise HTTPException(status_code=404, detail="Aula não encontrada.")
    return _serializar_licao(licao)


@router.get("/trilhas", response_model=list[TrilhaOut])
def listar_trilhas(db: Session = Depends(get_db), _=Depends(get_current_user)):
    trilhas = db.execute(
        select(models.Trilha)
        .options(
            selectinload(models.Trilha.licoes)
            .selectinload(models.Licao.perguntas)
            .selectinload(models.Pergunta.alternativas)
        )
        .order_by(models.Trilha.id_trilha)
    ).scalars().all()
    return [
        TrilhaOut(
            id_trilha=t.id_trilha,
            nome_trilha=t.nome_trilha,
            licoes=[_serializar_licao(l) for l in t.licoes],
        )
        for t in trilhas
    ]


@router.get("/trilhas/{trilha_id}/aulas", response_model=list[LicaoOut])
def listar_aulas_da_trilha(
    trilha_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    trilha = db.get(models.Trilha, trilha_id)
    if not trilha:
        raise HTTPException(status_code=404, detail="Trilha não encontrada.")
    licoes = db.execute(
        select(models.Licao)
        .options(
            selectinload(models.Licao.perguntas).selectinload(models.Pergunta.alternativas)
        )
        .where(models.Licao.id_trilha == trilha_id)
        .order_by(models.Licao.ordem)
    ).scalars().all()
    return [_serializar_licao(l) for l in licoes]
