"""Rotas de Aluno com RBAC e isolamento por escola (Bloco 1).

- POST /alunos                 → cria aluno na tabela Usuario (perfil='ALUNO').
- GET  /turmas/{id}/alunos     → lista alunos da turma (ordenados: ativos primeiro).
- PATCH /alunos/{id}           → arquiva/desarquiva aluno.

Sem DELETE físico: alunos são apenas arquivados via `arquivado`.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import require_role, escola_alvo_para_escrita, garantir_acesso_turma
from ..schemas import AlunoCreate, AlunoOut, ArquivarAluno
from ..security import hash_senha

router = APIRouter(tags=["Alunos (RBAC)"])

alunos_role = require_role("GESTOR_PLATAFORMA", "ADMIN_ESCOLA", "VISUALIZADOR_ESCOLA")


def _serializar(a: models.Usuario) -> AlunoOut:
    return AlunoOut(
        id_usuario=a.id_usuario,
        nome_completo=a.nome_completo,
        email=a.email,
        id_turma=a.id_turma,
        escola_id=a.escola_id,
        arquivado=bool(a.arquivado),
        status_ativo=bool(a.status_ativo),
    )


@router.post("/alunos", response_model=AlunoOut, status_code=status.HTTP_201_CREATED)
def criar_aluno(
    dados: AlunoCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(alunos_role),
):
    escola_id = escola_alvo_para_escrita(usuario, dados.escola_id)

    turma = db.get(models.Turma, dados.turma_id)
    if not turma or turma.id_escola != escola_id:
        raise HTTPException(status_code=400, detail="Turma inválida para esta escola.")

    if db.query(models.Usuario).filter(models.Usuario.email == dados.email).first():
        raise HTTPException(status_code=409, detail="E-mail já cadastrado.")

    aluno = models.Usuario(
        nome_completo=dados.nome_completo,
        email=dados.email,
        senha=hash_senha(dados.senha),
        perfil="ALUNO",
        tipo_perfil="ALUNO",
        escola_id=escola_id,
        id_turma=dados.turma_id,
    )
    db.add(aluno)
    db.commit()
    db.refresh(aluno)
    return _serializar(aluno)


@router.get("/turmas/{turma_id}/alunos", response_model=list[AlunoOut])
def listar_alunos_da_turma(
    turma_id: int,
    arquivado: bool | None = None,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(alunos_role),
):
    turma = db.get(models.Turma, turma_id)
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada.")

    # Isolamento horizontal: garante que a turma pertence à escola do token.
    escola_id = garantir_acesso_turma(usuario, turma)

    stmt = db.query(models.Usuario).filter(
        models.Usuario.perfil == "ALUNO",
        models.Usuario.id_turma == turma_id,
        models.Usuario.escola_id == escola_id,
        models.Usuario.data_exclusao.is_(None),
    )
    if arquivado is not None:
        stmt = stmt.filter(models.Usuario.arquivado == arquivado)

    # ORDENAÇÃO CRÍTICA: ativos primeiro (arquivado ASC) e depois por nome.
    alunos = stmt.order_by(
        models.Usuario.arquivado.asc(),
        models.Usuario.nome_completo.asc(),
    ).all()
    return [_serializar(a) for a in alunos]


@router.patch("/alunos/{aluno_id}", response_model=AlunoOut)
def arquivar_aluno(
    aluno_id: int,
    dados: ArquivarAluno,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(alunos_role),
):
    aluno = db.get(models.Usuario, aluno_id)
    if not aluno or aluno.perfil != "ALUNO":
        raise HTTPException(status_code=404, detail="Aluno não encontrado.")

    # Isolamento horizontal: só o GESTOR ou alguém da mesma escola do aluno altera.
    if usuario.perfil in ("ADMIN_ESCOLA", "VISUALIZADOR_ESCOLA") and usuario.escola_id != aluno.escola_id:
        raise HTTPException(status_code=403, detail="Acesso negado: outra escola.")

    if dados.arquivado is not None:
        aluno.arquivado = dados.arquivado
    if dados.nome_completo is not None:
        aluno.nome_completo = dados.nome_completo
    db.commit()
    db.refresh(aluno)
    return _serializar(aluno)
