"""Rotas de Turma com RBAC e isolamento por escola (Bloco 1).

- GET    /turmas                   → lista turmas da escola do token (?arquivado=false).
- POST   /turmas                   → cria turma exigindo APENAS `serie` + `ano_letivo`
                                      (escola_id vem do token do coordenador logado).
- PUT    /turmas/{id}              → edita identificador/série, ano letivo e e-mail de contato.
- PATCH  /turmas/{id}              → arquiva/desarquiva (nunca exclui fisicamente).
- POST   /turmas/{id}/alunos       → vincula alunos (ALUNO da mesma escola) à turma.
- DELETE /turmas/{id}/alunos       → desvincula alunos da turma (id_turma = NULL).

Sem DELETE físico de turmas: elas são apenas arquivadas via `arquivado`.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import require_role, escola_alvo_para_escrita, garantir_acesso_turma
from ..schemas import (
    AlunosTurmaIn,
    AlunoOut,
    ArquivarTurma,
    NovaTurma,
    TurmaOut,
    TurmaUpdate,
)

router = APIRouter(prefix="/turmas", tags=["Turmas (RBAC)"])

turmas_role = require_role("GESTOR_PLATAFORMA", "ADMIN_ESCOLA", "VISUALIZADOR_ESCOLA")


def _serializar(t: models.Turma) -> TurmaOut:
    return TurmaOut(
        id_turma=t.id_turma,
        id_escola=t.id_escola,
        nome_serie=t.nome_serie,
        ano_letivo=t.ano_letivo,
        nome_turma=t.nome_turma,
        identificador=t.identificador or f"{t.nome_serie} {t.nome_turma}".strip(),
        email_contato=t.email_contato,
        arquivado=bool(t.arquivado),
    )


def _serializar_aluno(a: models.Usuario) -> AlunoOut:
    return AlunoOut(
        id_usuario=a.id_usuario,
        nome_completo=a.nome_completo,
        email=a.email,
        id_turma=a.id_turma,
        escola_id=a.escola_id,
        arquivado=bool(a.arquivado),
        status_ativo=bool(a.status_ativo),
    )


def _alunos_da_turma(db: Session, turma_id: int, escola_id: int) -> list[AlunoOut]:
    alunos = (
        db.query(models.Usuario)
        .filter(
            models.Usuario.perfil == "ALUNO",
            models.Usuario.id_turma == turma_id,
            models.Usuario.escola_id == escola_id,
            models.Usuario.data_exclusao.is_(None),
        )
        .order_by(models.Usuario.arquivado.asc(), models.Usuario.nome_completo.asc())
        .all()
    )
    return [_serializar_aluno(a) for a in alunos]


@router.get("", response_model=list[TurmaOut])
def listar_turmas(
    arquivado: bool = False,
    escola_id: int | None = None,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(turmas_role),
):
    # Escopo de escola: perfis de escola SEMPRE filtram pela própria escola.
    if usuario.perfil in ("ADMIN_ESCOLA", "VISUALIZADOR_ESCOLA"):
        if usuario.escola_id is None:
            return []
        filtro_escola = models.Turma.id_escola == usuario.escola_id
    else:  # GESTOR_PLATAFORMA
        filtro_escola = (
            models.Turma.id_escola == escola_id if escola_id else None
        )

    stmt = select(models.Turma)
    if filtro_escola is not None:
        stmt = stmt.where(filtro_escola)
    stmt = stmt.where(models.Turma.arquivado == arquivado)
    stmt = stmt.order_by(models.Turma.identificador, models.Turma.id_turma)

    turmas = db.execute(stmt).scalars().all()
    return [_serializar(t) for t in turmas]


@router.post("", response_model=TurmaOut, status_code=status.HTTP_201_CREATED)
def criar_turma(
    dados: NovaTurma,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(turmas_role),
):
    # O escola_id vem do token do coordenador logado (ou é informado por um GESTOR).
    escola_id = escola_alvo_para_escrita(usuario, dados.escola_id)

    escola = db.get(models.Escola, escola_id)
    if not escola:
        raise HTTPException(status_code=404, detail="Escola não encontrada.")

    serie = dados.serie.strip()
    if not serie:
        raise HTTPException(status_code=400, detail="Série é obrigatória.")
    if not dados.ano_letivo:
        raise HTTPException(status_code=400, detail="Ano letivo é obrigatório.")

    # Série vira o identificador principal; os campos legados derivam dela.
    turma = models.Turma(
        id_escola=escola_id,
        nome_serie=serie[:20],
        nome_turma=serie[:50],
        identificador=serie,
        ano_letivo=dados.ano_letivo,
    )
    db.add(turma)
    db.commit()
    db.refresh(turma)
    return _serializar(turma)


@router.put("/{turma_id}", response_model=TurmaOut)
def atualizar_turma(
    turma_id: int,
    dados: TurmaUpdate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(turmas_role),
):
    """Edita a turma: identificador/série, ano letivo e e-mail de contato."""
    turma = db.get(models.Turma, turma_id)
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada.")

    if usuario.perfil in ("ADMIN_ESCOLA", "VISUALIZADOR_ESCOLA") and usuario.escola_id != turma.id_escola:
        raise HTTPException(status_code=403, detail="Acesso negado: outra escola.")

    serie = dados.serie or dados.identificador
    if serie:
        turma.identificador = serie.strip()
        turma.nome_serie = serie.strip()[:20]
        turma.nome_turma = serie.strip()[:50]
    if dados.nome_serie:
        turma.nome_serie = dados.nome_serie[:20]
    if dados.nome_turma:
        turma.nome_turma = dados.nome_turma[:50]
    if dados.ano_letivo is not None:
        turma.ano_letivo = dados.ano_letivo
    if dados.email_contato is not None:
        turma.email_contato = dados.email_contato.strip() or None

    db.commit()
    db.refresh(turma)
    return _serializar(turma)


@router.patch("/{turma_id}", response_model=TurmaOut)
def arquivar_turma(
    turma_id: int,
    dados: ArquivarTurma,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(turmas_role),
):
    turma = db.get(models.Turma, turma_id)
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada.")

    # Isolamento horizontal: perfis de escola só alteram turmas da própria escola.
    if usuario.perfil in ("ADMIN_ESCOLA", "VISUALIZADOR_ESCOLA") and usuario.escola_id != turma.id_escola:
        raise HTTPException(status_code=403, detail="Acesso negado: outra escola.")

    turma.arquivado = dados.arquivado
    db.commit()
    db.refresh(turma)
    return _serializar(turma)


@router.post("/{turma_id}/alunos", response_model=list[AlunoOut])
def adicionar_alunos(
    turma_id: int,
    dados: AlunosTurmaIn,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(turmas_role),
):
    """Vincula alunos (perfil ALUNO da mesma escola) à turma."""
    turma = db.get(models.Turma, turma_id)
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada.")

    escola_id = garantir_acesso_turma(usuario, turma)

    for aluno_id in dados.aluno_ids:
        aluno = db.get(models.Usuario, aluno_id)
        if not aluno or aluno.perfil != "ALUNO" or aluno.escola_id != escola_id:
            continue  # ignora ids inválidos ou de outra escola
        if aluno.id_turma == turma_id:
            continue  # já está na turma
        aluno.id_turma = turma_id

    db.commit()
    return _alunos_da_turma(db, turma_id, escola_id)


@router.delete("/{turma_id}/alunos", response_model=list[AlunoOut])
def remover_alunos(
    turma_id: int,
    dados: AlunosTurmaIn,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(turmas_role),
):
    """Desvincula alunos da turma (id_turma = NULL)."""
    turma = db.get(models.Turma, turma_id)
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada.")

    escola_id = garantir_acesso_turma(usuario, turma)

    for aluno_id in dados.aluno_ids:
        aluno = db.get(models.Usuario, aluno_id)
        if not aluno or aluno.perfil != "ALUNO" or aluno.escola_id != escola_id:
            continue
        if aluno.id_turma == turma_id:
            aluno.id_turma = None

    db.commit()
    return _alunos_da_turma(db, turma_id, escola_id)
