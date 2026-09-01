import math
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from .. import models
from ..database import get_db
from ..deps import get_current_user, require_role
from ..schemas import AlunoProgressoOut, ProgressoCreate, ProgressoOut

router = APIRouter(prefix="/progresso", tags=["Progresso (Mobile)"])


def _serializar_progresso(p: models.ProgressoLicao) -> ProgressoOut:
    return ProgressoOut(
        id_licao=p.id_licao,
        qtd_acertos=p.qtd_acertos,
        status_aprovacao=bool(p.status_aprovacao),
        data_conclusao=p.data_conclusao.isoformat() if p.data_conclusao else None,
    )


def _serializar_aluno(aluno: models.Usuario, status_aprovacao: bool | None = None) -> AlunoProgressoOut:
    return AlunoProgressoOut(
        id_aluno=aluno.id_usuario,
        nickname=aluno.nickname,
        moedas_total=aluno.moedas_total or 0,
        nivel_atual=aluno.nivel_atual or 1,
        licoes_concluidas=[
            p.id_licao for p in aluno.progressos if p.status_aprovacao
        ],
        status_aprovacao=status_aprovacao,
    )


@router.get("/alunos/{aluno_id}", response_model=AlunoProgressoOut)
def obter_progresso_aluno(
    aluno_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(get_current_user),
):
    aluno = db.get(models.Usuario, aluno_id)
    if not aluno or aluno.perfil != "ALUNO" or aluno.data_exclusao:
        raise HTTPException(status_code=404, detail="Aluno não encontrado.")

    if usuario.perfil == "ALUNO":
        if usuario.id_usuario != aluno_id:
            raise HTTPException(status_code=403, detail="Acesso ao progresso de outro aluno negado.")
    elif usuario.perfil in ("ADMIN_ESCOLA", "VISUALIZADOR_ESCOLA"):
        if usuario.escola_id != aluno.escola_id:
            raise HTTPException(status_code=403, detail="Acesso negado: dados de outra escola.")
    elif usuario.perfil not in ("DEV", "GESTOR_PLATAFORMA"):
        raise HTTPException(status_code=403, detail="Acesso negado para o seu perfil.")

    return _serializar_aluno(aluno)


@router.post("/alunos/{aluno_id}/licoes/{licao_id}", response_model=AlunoProgressoOut)
def registrar_progresso(
    aluno_id: int,
    licao_id: int,
    dados: ProgressoCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(require_role("ALUNO")),
):
    if usuario.id_usuario != aluno_id:
        raise HTTPException(status_code=403, detail="Acesso negado.")

    aluno = db.get(models.Usuario, aluno_id)
    if not aluno or aluno.perfil != "ALUNO":
        raise HTTPException(status_code=404, detail="Aluno não encontrado.")

    licao = db.get(models.Licao, licao_id)
    if not licao:
        raise HTTPException(status_code=404, detail="Aula não encontrada.")

    # ── AVALIAÇÃO SERVER-AUTHORITATIVE ────────────────────────────────────────
    # O cliente envia apenas os índices das alternativas selecionadas. O total
    # de perguntas e o gabarito (eh_correta) vêm do banco — nunca do cliente.
    perguntas = (
        db.query(models.Pergunta)
        .options(selectinload(models.Pergunta.alternativas))
        .filter(models.Pergunta.id_licao == licao.id_licao)
        .order_by(models.Pergunta.id_pergunta)
        .all()
    )
    real_total_perguntas = len(perguntas)
    if real_total_perguntas == 0:
        raise HTTPException(
            status_code=400,
            detail="Lição sem perguntas configuradas.",
        )

    selecionadas = list(dados.respostas_selecionadas or [])
    qtd_acertos_validos = 0
    for i, pergunta in enumerate(perguntas):
        if i >= len(selecionadas):
            break  # resposta ausente = errada
        indice = selecionadas[i]
        alternativas = pergunta.alternativas
        if 0 <= indice < len(alternativas) and alternativas[indice].eh_correta:
            qtd_acertos_validos += 1

    aprovado = qtd_acertos_validos >= math.ceil(real_total_perguntas * 0.66)

    progresso = (
        db.query(models.ProgressoLicao)
        .filter(
            models.ProgressoLicao.id_aluno == aluno_id,
            models.ProgressoLicao.id_licao == licao_id,
        )
        .first()
    )

    foi_aprovada_antes = progresso is not None and bool(progresso.status_aprovacao)

    if progresso is None:
        progresso = models.ProgressoLicao(id_aluno=aluno_id, id_licao=licao_id)
        db.add(progresso)

    progresso.qtd_acertos = qtd_acertos_validos
    progresso.status_aprovacao = aprovado
    progresso.data_conclusao = datetime.now(timezone.utc).replace(tzinfo=None)

    # Regras de recompensa (apenas MOEDAS), sempre com base no banco:
    # - 1ª aprovação com 100%: moedas cheias (licao.recompensa_moedas_max).
    # - 1ª aprovação com 66-99%: metade das moedas.
    # - Refazer depois de já aprovado: 0 moedas.
    # - Reprovação (<66%): 0 moedas.
    if aprovado and not foi_aprovada_antes:
        if qtd_acertos_validos >= real_total_perguntas:
            # 100% — recompensa cheia
            aluno.moedas_total = (aluno.moedas_total or 0) + licao.recompensa_moedas_max
        else:
            # 66-99% — metade da recompensa
            aluno.moedas_total = (aluno.moedas_total or 0) + licao.recompensa_moedas_max // 2

    db.commit()
    db.refresh(aluno)
    return _serializar_aluno(aluno, status_aprovacao=aprovado)
