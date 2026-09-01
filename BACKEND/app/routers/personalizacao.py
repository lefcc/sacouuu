"""Personalização (Admin Desktop) — Avatares e Itens da Loja.

Todos os dados vêm do banco (tabelas `avatar` e `item_loja`) — nada é
hardcodeado. As imagens ficam em `uploads/personalizacao/` e são servidas
via `/uploads/...` (StaticFiles).

Endpoints:
- `GET    /personalizacao/avatares`       → lista TODOS os avatares
- `POST   /personalizacao/avatares`       → cria avatar
- `PUT    /personalizacao/avatares/{id}`  → edita avatar
- `DELETE /personalizacao/avatares/{id}`  → exclui avatar (remove do banco)
- `GET    /personalizacao/itens-loja`     → lista TODOS os itens da loja
- `POST   /personalizacao/itens`          → cria item
- `PUT    /personalizacao/itens/{id}`     → edita item
- `DELETE /personalizacao/itens/{id}`     → exclui item (remove do banco)
- `POST   /personalizacao/upload`         → envia imagem (salva em uploads/personalizacao/)
"""

import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import require_role
from ..schemas import (
    PersonalizacaoAvatarIn,
    PersonalizacaoAvatarOut,
    PersonalizacaoItemIn,
    PersonalizacaoItemOut,
)

router = APIRouter(prefix="/personalizacao", tags=["Personalização (Admin Desktop)"])

# Apenas perfis de plataforma administram a personalização.
admin = require_role("GESTOR_PLATAFORMA", "DEV")

UPLOADS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "personalizacao"
)

EXT_IMAGEM = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}


def _serializar_avatar(a: models.Avatar) -> PersonalizacaoAvatarOut:
    return PersonalizacaoAvatarOut(
        id=a.id_avatar,
        nome=a.nome,
        descricao=a.descricao,
        imagem_path=a.url_imagem,
        ordem=a.ordem,
        ativo=bool(a.ativo),
    )


def _serializar_item(i: models.ItemLoja) -> PersonalizacaoItemOut:
    return PersonalizacaoItemOut(
        id=i.id_item,
        nome=i.nome,
        descricao=i.descricao,
        imagem_path=i.url_imagem,
        preco=i.preco,
        trilha=i.id_trilha_requerida,
        ativo=bool(i.ativo),
    )


# ── AVATARES ──────────────────────────────────────────────────────────────────

@router.get("/avatares", response_model=list[PersonalizacaoAvatarOut])
def listar_avatares(
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(admin),
):
    """Retorna TODOS os avatares cadastrados (indep. de ativo), por ordem."""
    return [
        _serializar_avatar(a)
        for a in db.query(models.Avatar).order_by(models.Avatar.ordem).all()
    ]


@router.post("/avatares", response_model=PersonalizacaoAvatarOut, status_code=status.HTTP_201_CREATED)
def criar_avatar(
    dados: PersonalizacaoAvatarIn,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(admin),
):
    avatar = models.Avatar(
        nome=dados.nome,
        descricao=dados.descricao,
        url_imagem=dados.imagem_path,
        ordem=dados.ordem,
        ativo=dados.ativo,
    )
    db.add(avatar)
    db.commit()
    db.refresh(avatar)
    return _serializar_avatar(avatar)


@router.put("/avatares/{avatar_id}", response_model=PersonalizacaoAvatarOut)
def atualizar_avatar(
    avatar_id: int,
    dados: PersonalizacaoAvatarIn,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(admin),
):
    avatar = db.get(models.Avatar, avatar_id)
    if not avatar:
        raise HTTPException(status_code=404, detail="Avatar não encontrado.")
    avatar.nome = dados.nome
    avatar.descricao = dados.descricao
    avatar.url_imagem = dados.imagem_path
    avatar.ordem = dados.ordem
    avatar.ativo = dados.ativo
    db.commit()
    db.refresh(avatar)
    return _serializar_avatar(avatar)


@router.delete("/avatares/{avatar_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_avatar(
    avatar_id: int,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(admin),
):
    avatar = db.get(models.Avatar, avatar_id)
    if not avatar:
        raise HTTPException(status_code=404, detail="Avatar não encontrado.")
    try:
        db.delete(avatar)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Este avatar está em uso por alunos. Remova o vínculo antes de excluir.",
        )


# ── ITENS DA LOJA ─────────────────────────────────────────────────────────────

@router.get("/itens-loja", response_model=list[PersonalizacaoItemOut])
def listar_itens_loja(
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(admin),
):
    """Retorna TODOS os itens da loja (indep. de ativo)."""
    return [
        _serializar_item(i)
        for i in db.query(models.ItemLoja).order_by(models.ItemLoja.preco).all()
    ]


@router.post("/itens", response_model=PersonalizacaoItemOut, status_code=status.HTTP_201_CREATED)
def criar_item(
    dados: PersonalizacaoItemIn,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(admin),
):
    item = models.ItemLoja(
        nome=dados.nome,
        descricao=dados.descricao,
        url_imagem=dados.imagem_path,
        preco=dados.preco,
        id_trilha_requerida=dados.trilha,
        ativo=dados.ativo,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serializar_item(item)


@router.put("/itens/{item_id}", response_model=PersonalizacaoItemOut)
def atualizar_item(
    item_id: int,
    dados: PersonalizacaoItemIn,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(admin),
):
    item = db.get(models.ItemLoja, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado.")
    item.nome = dados.nome
    item.descricao = dados.descricao
    item.url_imagem = dados.imagem_path
    item.preco = dados.preco
    item.id_trilha_requerida = dados.trilha
    item.ativo = dados.ativo
    db.commit()
    db.refresh(item)
    return _serializar_item(item)


@router.delete("/itens/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_item(
    item_id: int,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(admin),
):
    item = db.get(models.ItemLoja, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado.")
    try:
        db.delete(item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Este item foi comprado por alunos. Remova os vínculos antes de excluir.",
        )


# ── UPLOAD DE IMAGEM ──────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_imagem(
    arquivo: UploadFile = File(...),
    _: models.Usuario = Depends(admin),
):
    """Salva uma imagem de personalização em uploads/personalizacao/."""
    nome_original = arquivo.filename or "imagem.png"
    ext = os.path.splitext(nome_original)[1].lower()
    if ext not in EXT_IMAGEM:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato inválido. Envie PNG, JPG, GIF, WebP ou SVG.",
        )

    os.makedirs(UPLOADS_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nome = f"pers_{timestamp}_{uuid.uuid4().hex[:6]}{ext}"
    caminho = os.path.join(UPLOADS_DIR, nome)

    conteudo = await arquivo.read()
    with open(caminho, "wb") as f:
        f.write(conteudo)

    return {"imagem_path": f"/uploads/personalizacao/{nome}"}
