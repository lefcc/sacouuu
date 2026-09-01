import re
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .. import models
from ..config import COOKIE_SECURE, TOKEN_EXPIRA_MINUTOS
from ..database import get_db
from ..deps import get_current_user
from ..schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    ResetPasswordRequest,
    TokenResponse,
    UsuarioResponse,
    perfil_legado,
)
from ..security import criar_token, hash_senha, verificar_senha

router = APIRouter(prefix="/auth", tags=["Autenticação"])

# Validade do token de recuperação (1 hora).
TOKEN_VALIDADE_HORAS = 1


def _validar_forca_senha(senha: str) -> None:
    """Mínimo 6 caracteres e pelo menos 1 número (mesma regra do cadastro)."""
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


def _montar_usuario(usuario: models.Usuario) -> UsuarioResponse:
    dados = UsuarioResponse(
        id_usuario=usuario.id_usuario,
        nome_completo=usuario.nome_completo,
        email=usuario.email,
        perfil=usuario.perfil,
        tipo_perfil=perfil_legado(usuario.perfil),
        id_escola=usuario.escola_id,
        id_turma=usuario.id_turma,
    )
    if usuario.perfil == "ALUNO":
        dados.nickname = usuario.nickname
        dados.moedas_total = usuario.moedas_total or 0
        dados.nivel_atual = usuario.nivel_atual or 1
    return dados


@router.post("/login", response_model=TokenResponse)
def login(dados: LoginRequest, db: Session = Depends(get_db), response: Response = None):
    usuario = db.query(models.Usuario).filter(models.Usuario.email == dados.email).first()
    if not usuario or not verificar_senha(dados.senha, usuario.senha):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos.",
        )
    if not usuario.status_ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo.",
        )
    token = criar_token(str(usuario.id_usuario))

    # Sessão via cookie HttpOnly: o token NÃO fica acessível ao JavaScript.
    # O Secure só é ativado em HTTPS (produção) — em dev HTTP fica False.
    response.set_cookie(
        key="sacou_token",
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=TOKEN_EXPIRA_MINUTOS * 60,
        path="/",
    )

    return TokenResponse(
        access_token=token,
        usuario=_montar_usuario(usuario),
    )


@router.post("/logout")
def logout(response: Response):
    """Encerra a sessão removendo o cookie HttpOnly do navegador."""
    response.delete_cookie("sacou_token", path="/")
    return {"detail": "Sessão encerrada."}


@router.post("/forgot-password")
def forgot_password(dados: ForgotPasswordRequest, db: Session = Depends(get_db)):
    # TODO: MODO DEMO. Em produção, integrar com provedor SMTP real.
    """Solicita recuperação de senha (modo DEMONSTRAÇÃO LOCAL, sem SMTP).

    Gera um token aleatório, grava com validade de 1 hora e imprime o link de
    recuperação no console do servidor (Uvicorn) — em ambiente local os e-mails
    são fictícios, então o link vai direto para o terminal para a apresentação.
    Sempre retorna 200 (mesmo se o e-mail não existir) para não revelar quais
    contas estão cadastradas (anti-enumeração).
    """
    usuario = (
        db.query(models.Usuario)
        .filter(models.Usuario.email == dados.email)
        .first()
    )

    if usuario is not None:
        token = secrets.token_urlsafe(32)
        db.add(
            models.TokenRecuperacao(
                id_usuario=usuario.id_usuario,
                token_hash=token,
                data_expiracao=datetime.now() + timedelta(hours=TOKEN_VALIDADE_HORAS),
                utilizado=False,
            )
        )
        db.commit()

        # DEMO LOCAL: sem envio real de e-mail (smtplib). O link é impresso no
        # console do servidor para fins de apresentação.
        print(f"\n[DEMO] LINK DE RECUPERAÇÃO PARA {dados.email}: http://localhost:5173/redefinir-senha?token={token}\n")

    return {"detail": "Se o e-mail existir, você receberá um link de recuperação."}


@router.post("/reset-password")
def reset_password(dados: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Redefine a senha usando o token recebido por e-mail."""
    _validar_forca_senha(dados.nova_senha)

    registro = (
        db.query(models.TokenRecuperacao)
        .filter(
            models.TokenRecuperacao.token_hash == dados.token,
            models.TokenRecuperacao.utilizado.is_(False),
            models.TokenRecuperacao.data_expiracao > datetime.now(),
        )
        .first()
    )
    if not registro:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido, expirado ou já utilizado.",
        )

    usuario = db.get(models.Usuario, registro.id_usuario)
    if usuario is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuário associado ao token não encontrado.",
        )

    usuario.senha = hash_senha(dados.nova_senha)
    registro.utilizado = True
    db.commit()

    return {"detail": "Senha redefinida com sucesso."}


@router.get("/me", response_model=UsuarioResponse)
def me(usuario: models.Usuario = Depends(get_current_user)):
    return _montar_usuario(usuario)
