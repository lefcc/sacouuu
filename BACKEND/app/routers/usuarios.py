"""Gestão de usuários (criação, edição e arquivamento) — usada pelo Desktop.

Endpoints:
- `POST  /usuarios`       → cria coordenador (ADMIN_ESCOLA) ou professor
                            (VISUALIZADOR_ESCOLA) vinculado a uma escola.
- `PUT   /usuarios/{id}`  → edita nome/e-mail/senha de um coordenador.
- `PATCH /usuarios/{id}`  → arquiva (soft-delete, `arquivado=True`) ou reativa.

RBAC:
- Criar/editar: apenas DEV e GESTOR_PLATAFORMA.
- Arquivar: DEV, GESTOR_PLATAFORMA, ADMIN_ESCOLA e VISUALIZADOR_ESCOLA,
  com hierarquia — um Professor (VISUALIZADOR_ESCOLA) só pode arquivar ALUNO.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import require_role
from ..schemas import CoordenadorOut, perfil_legado
from ..security import hash_senha

router = APIRouter(prefix="/usuarios", tags=["Usuários"])

plataforma = require_role("DEV", "GESTOR_PLATAFORMA")
# Quem pode arquivar/reativar usuários (hierarquia é validada no endpoint).
gestor_escola = require_role("DEV", "GESTOR_PLATAFORMA", "ADMIN_ESCOLA", "VISUALIZADOR_ESCOLA")
# Quem pode editar nome/e-mail/perfil: plataforma ou coordenador da própria escola.
gestor_edicao = require_role("DEV", "GESTOR_PLATAFORMA", "ADMIN_ESCOLA")

PERFIS_CRIAVEIS = ("ADMIN_ESCOLA", "VISUALIZADOR_ESCOLA")


class UsuarioCriar(BaseModel):
    nome_completo: str
    email: EmailStr
    senha: str
    perfil: str  # 'ADMIN_ESCOLA' (coordenador) ou 'VISUALIZADOR_ESCOLA' (professor)
    escola_id: int


class UsuarioUpdate(BaseModel):
    nome_completo: str | None = None
    email: EmailStr | None = None
    perfil: str | None = None
    senha: str | None = None  # opcional: vazio mantém a senha atual


class UsuarioArquivar(BaseModel):
    arquivado: bool = True


def _serializar(u: models.Usuario) -> CoordenadorOut:
    return CoordenadorOut(
        id_usuario=u.id_usuario,
        nome_completo=u.nome_completo,
        email=u.email,
        perfil=u.perfil,
        tipo_perfil=perfil_legado(u.perfil),
        status_ativo=bool(u.status_ativo),
        arquivado=bool(u.arquivado),
    )


@router.post("", response_model=CoordenadorOut, status_code=status.HTTP_201_CREATED)
def criar_usuario(
    dados: UsuarioCriar,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(plataforma),
):
    """Cria um coordenador (ADMIN_ESCOLA) ou professor (VISUALIZADOR_ESCOLA)."""
    if dados.perfil not in PERFIS_CRIAVEIS:
        raise HTTPException(
            status_code=400,
            detail="Perfil inválido. Use 'ADMIN_ESCOLA' ou 'VISUALIZADOR_ESCOLA'.",
        )

    escola = db.get(models.Escola, dados.escola_id)
    if not escola:
        raise HTTPException(status_code=404, detail="Escola não encontrada.")

    if db.query(models.Usuario).filter(models.Usuario.email == dados.email).first():
        raise HTTPException(status_code=409, detail="E-mail já cadastrado.")

    if len(dados.senha) < 6:
        raise HTTPException(
            status_code=400, detail="A senha deve ter no mínimo 6 caracteres."
        )

    usuario = models.Usuario(
        nome_completo=dados.nome_completo,
        email=dados.email,
        senha=hash_senha(dados.senha),
        perfil=dados.perfil,
        tipo_perfil=perfil_legado(dados.perfil),
        escola_id=dados.escola_id,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return _serializar(usuario)


@router.put("/{usuario_id}", response_model=CoordenadorOut)
def editar_usuario(
    usuario_id: int,
    dados: UsuarioUpdate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(gestor_edicao),
):
    alvo = db.get(models.Usuario, usuario_id)
    if not alvo:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    # Isolamento horizontal: coordenador só edita usuários da própria escola.
    if usuario.perfil == "ADMIN_ESCOLA":
        if alvo.escola_id != usuario.escola_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado: outra escola.",
            )

    # ── Blindagem de hierarquia ─────────────────────────────────────────────
    eh_admin   = usuario.perfil == "ADMIN_ESCOLA"
    eh_par     = eh_admin and alvo.perfil == "ADMIN_ESCOLA" and alvo.id_usuario != usuario.id_usuario
    eh_self    = alvo.id_usuario == usuario.id_usuario
    # Par coordenador: NUNCA altera perfil/tipo_perfil/senha do outro (só nome/e-mail).
    if eh_par and (dados.perfil or dados.senha):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não pode alterar o perfil ou a senha de outro coordenador.",
        )
    # Auto-demotion: ninguém rebaixa o próprio perfil.
    if eh_self and dados.perfil:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não pode alterar o seu próprio perfil.",
        )

    if dados.nome_completo:
        alvo.nome_completo = dados.nome_completo

    if dados.email and dados.email != alvo.email:
        if db.query(models.Usuario).filter(models.Usuario.email == dados.email).first():
            raise HTTPException(status_code=409, detail="E-mail já cadastrado.")
        alvo.email = dados.email

    if dados.perfil:
        if dados.perfil not in PERFIS_CRIAVEIS:
            raise HTTPException(
                status_code=400,
                detail="Perfil inválido. Use 'ADMIN_ESCOLA' ou 'VISUALIZADOR_ESCOLA'.",
            )
        alvo.perfil = dados.perfil
        alvo.tipo_perfil = perfil_legado(dados.perfil)

    if dados.senha:
        if len(dados.senha) < 6:
            raise HTTPException(
                status_code=400, detail="A senha deve ter no mínimo 6 caracteres."
            )
        alvo.senha = hash_senha(dados.senha)

    db.commit()
    db.refresh(alvo)
    return _serializar(alvo)


@router.patch("/{usuario_id}", response_model=CoordenadorOut)
def arquivar_usuario(
    usuario_id: int,
    dados: UsuarioArquivar,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(gestor_escola),
):
    alvo = db.get(models.Usuario, usuario_id)
    if not alvo:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    # RBAC de hierarquia no arquivamento:
    # - Professor (VISUALIZADOR_ESCOLA) só pode arquivar/reativar ALUNO.
    if usuario.perfil == "VISUALIZADOR_ESCOLA":
        if alvo.perfil != "ALUNO":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado: professores só podem arquivar alunos.",
            )
        if alvo.escola_id != usuario.escola_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado: outra escola.",
            )
    elif usuario.perfil == "ADMIN_ESCOLA":
        if alvo.escola_id != usuario.escola_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado: outra escola.",
            )

    # ── Blindagem contra lockout (apenas ao ARQUIVAR; reativar é sempre livre) ──
    if dados.arquivado:
        # Regra A — Auto-preservação
        if alvo.id_usuario == usuario.id_usuario:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não pode arquivar/desativar a sua própria conta.",
            )
        # Regra B — Proteção de pares
        if usuario.perfil == "ADMIN_ESCOLA" and alvo.perfil == "ADMIN_ESCOLA":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não pode arquivar outro coordenador.",
            )
        # Regra C — Prevenção de lockout (último coordenador ativo da escola)
        if alvo.perfil == "ADMIN_ESCOLA":
            ativos = db.query(models.Usuario).filter(
                models.Usuario.escola_id == alvo.escola_id,
                models.Usuario.perfil == "ADMIN_ESCOLA",
                models.Usuario.status_ativo == True,
            ).count()
            if ativos <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Não é possível arquivar o último coordenador ativo da escola.",
                )

    alvo.arquivado = dados.arquivado
    alvo.status_ativo = not dados.arquivado
    db.commit()
    db.refresh(alvo)

    # Defesa: garante que a mudança REALMENTE persistiu no banco. Se o UPDATE
    # não efetivou (ex.: trigger/FK/anomalia), retorna erro explícito em vez de
    # deixar o cliente exibir "sucesso" com estado antigo.
    if bool(alvo.status_ativo) != (not dados.arquivado):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao persistir o arquivamento no banco.",
        )

    return _serializar(alvo)
