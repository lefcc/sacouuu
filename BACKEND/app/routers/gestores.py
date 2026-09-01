"""Cadastro de Gestores Master (GESTOR_PLATAFORMA).

Endpoints:
- `GET /gestores`    → lista gestores da plataforma (RBAC: DEV/GESTOR_PLATAFORMA)
- `POST /gestores`   → cria um novo gestor com senha hasheada em bcrypt

Segurança obrigatória:
- A senha NUNCA é gravada em texto puro (LGPD): passa por bcrypt antes do INSERT.
- Força mínima de senha: 6+ caracteres e pelo menos 1 número.
- Email duplicado → 409 Conflict.
- Inputs sanitizados pelo ORM SQLAlchemy (sem concatenação de string SQL).
"""

import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import require_role
from ..schemas import perfil_legado
from ..security import hash_senha

router = APIRouter(prefix="/gestores", tags=["Gestores Master"])

# Apenas DEV e GESTOR_PLATAFORMA podem criar/listar gestores.
plataforma = require_role("DEV", "GESTOR_PLATAFORMA")


class GestorCreate(BaseModel):
    nome: str
    email: EmailStr
    senha: str


class GestorOut(BaseModel):
    id_usuario: int
    nome_completo: str
    email: EmailStr
    perfil: str
    status_ativo: bool
    data_criacao: str | None = None


def _validar_senha(senha: str) -> None:
    """Valida a força da senha: mínimo 6 caracteres e pelo menos 1 número."""
    if len(senha) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha deve ter no mínimo 6 caracteres.",
        )
    if not re.search(r"\d", senha):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha deve conter pelo menos 1 número.",
        )


@router.get("", response_model=list[GestorOut])
def listar_gestores(
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(plataforma),
):
    gestores = db.execute(
        select(models.Usuario).where(
            models.Usuario.perfil == "GESTOR_PLATAFORMA",
            models.Usuario.data_exclusao.is_(None),
        ).order_by(models.Usuario.nome_completo)
    ).scalars().all()
    return [
        GestorOut(
            id_usuario=g.id_usuario,
            nome_completo=g.nome_completo,
            email=g.email,
            perfil=g.perfil,
            status_ativo=bool(g.status_ativo),
            data_criacao=(
                g.data_criacao.isoformat() if g.data_criacao else None
            ),
        )
        for g in gestores
    ]


@router.post("", response_model=GestorOut, status_code=status.HTTP_201_CREATED)
def criar_gestor(
    dados: GestorCreate,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(plataforma),
):
    nome = dados.nome.strip()
    if not nome:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O nome é obrigatório.",
        )

    # Força da senha antes de qualquer gravação.
    _validar_senha(dados.senha)

    # Email duplicado → 409 Conflict (consulta via ORM, sem SQL injetável).
    existe = db.execute(
        select(models.Usuario.id_usuario).where(
            models.Usuario.email == dados.email
        )
    ).first()
    if existe:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="E-mail já cadastrado.",
        )

    # Hash bcrypt ANTES de salvar — senha nunca vai em texto puro ao banco.
    gestor = models.Usuario(
        nome_completo=nome,
        email=dados.email,
        senha=hash_senha(dados.senha),
        perfil="GESTOR_PLATAFORMA",
        tipo_perfil=perfil_legado("GESTOR_PLATAFORMA"),
        escola_id=None,
    )
    db.add(gestor)
    db.commit()
    db.refresh(gestor)

    return GestorOut(
        id_usuario=gestor.id_usuario,
        nome_completo=gestor.nome_completo,
        email=gestor.email,
        perfil=gestor.perfil,
        status_ativo=bool(gestor.status_ativo),
        data_criacao=(
            gestor.data_criacao.isoformat() if gestor.data_criacao else None
        ),
    )
