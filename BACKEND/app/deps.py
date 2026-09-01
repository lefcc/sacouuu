"""Dependências de segurança do FastAPI.

Inclui:
- `get_current_user`: autenticação via JWT Bearer.
- `require_role`: RBAC baseado no perfil canônico (`usuario.perfil`).
- `garantir_acesso_escola`: isolamento horizontal de dados por escola.

Regras de isolamento horizontal (data isolation):
- DEV e GESTOR_PLATAFORMA podem acessar qualquer escola.
- ADMIN_ESCOLA e VISUALIZADOR_ESCOLA só podem acessar a própria escola.
- ALUNO nunca acessa endpoints administrativos de escola.
"""

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from . import models
from .database import get_db
from .security import decodificar_token

bearer_scheme = HTTPBearer(auto_error=False)

# Perfis com acesso irrestrito a qualquer escola (plataforma).
PERFIS_PLATAFORMA = ("DEV", "GESTOR_PLATAFORMA")
# Perfis restritos à própria escola.
PERFIS_ESCOLA = ("ADMIN_ESCOLA", "VISUALIZADOR_ESCOLA")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    request: Request = None,
    db: Session = Depends(get_db),
) -> models.Usuario:
    # Aceita o JWT vindo do Bearer (Desktop/Mobile) OU do cookie HttpOnly
    # "sacou_token" (Web). O token nunca fica acessível ao JavaScript.
    token = (
        credentials.credentials
        if credentials
        else (request.cookies.get("sacou_token") if request else None)
    )
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token não informado.",
        )
    sub = decodificar_token(token)
    if sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado.",
        )
    usuario = db.get(models.Usuario, int(sub))
    if usuario is None or not usuario.status_ativo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado ou inativo.",
        )
    return usuario


def require_role(*roles: str):
    """RBAC: permite acesso apenas a usuários com um dos perfis informados."""

    def checador(usuario: models.Usuario = Depends(get_current_user)) -> models.Usuario:
        if usuario.perfil not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado para o seu perfil.",
            )
        return usuario

    return checador


def garantir_acesso_escola(usuario: models.Usuario, escola_id: int) -> None:
    """Isolamento horizontal: impede acesso a dados de outra escola.

    DEV e GESTOR_PLATAFORMA passam. ADMIN_ESCOLA e VISUALIZADOR_ESCOLA só
    acessam a própria escola. Caso contrário, HTTP 403.
    """
    if usuario.perfil in PERFIS_PLATAFORMA:
        return
    if usuario.perfil in PERFIS_ESCOLA:
        if usuario.escola_id != escola_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado: dados de outra escola.",
            )
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Acesso negado para o seu perfil.",
    )


def escola_alvo_para_escrita(usuario: models.Usuario, escola_id_override: int | None = None) -> int:
    """Resolve a escola alvo de uma operação de escrita.

    GESTOR_PLATAFORMA precisa informar `escola_id_override`. ADMIN_ESCOLA e
    VISUALIZADOR_ESCOLA só escrevem na própria escola.
    """
    if usuario.perfil in PERFIS_PLATAFORMA:
        if not escola_id_override:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Perfil de plataforma deve informar escola_id.",
            )
        return escola_id_override
    if usuario.perfil in PERFIS_ESCOLA:
        if usuario.escola_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuário não vinculado a uma escola.",
            )
        if escola_id_override and escola_id_override != usuario.escola_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado: outra escola.",
            )
        return usuario.escola_id
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Acesso negado para o seu perfil.",
    )


def garantir_acesso_turma(usuario: models.Usuario, turma: models.Turma) -> int:
    """Garante acesso à turma e devolve o escopo de escola (id_escola da turma).

    GESTOR_PLATAFORMA/DEV passam; perfis de escola só acessam turmas da própria escola.
    """
    if usuario.perfil in PERFIS_PLATAFORMA:
        return turma.id_escola
    if usuario.perfil in PERFIS_ESCOLA:
        if usuario.escola_id != turma.id_escola:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado: outra escola.",
            )
        return usuario.escola_id
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Acesso negado para o seu perfil.",
    )
