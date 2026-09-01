from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import os

from .config import CORS_ORIGINS

from .routers import (
    alunos,
    auth,
    conteudo,
    escolas,
    financeiro,
    gestores,
    licoes,
    loja,
    perfil,
    personalizacao,
    progresso,
    turmas,
    usuarios,
)

app = FastAPI(
    title="Sacou API",
    description="API do ecossistema de educação financeira Sacou (mobile, web e desktop)",
    version="1.0.0",
)

# CORS liberado para as 3 interfaces durante o desenvolvimento.
# allow_credentials=True é obrigatório para cookies HttpOnly (sacou_token);
# por isso as origins são explícitas (nunca "*" com credenciais).
# A lista vem de CORS_ORIGINS no .env (config.py) — edite lá, não aqui.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Arquivos estáticos (áudios e imagens das aulas).
app.mount("/static", StaticFiles(directory="static"), name="static")

# Uploads (imagens de personalização, arquivos de contrato etc.) servidos
# diretamente pelo backend para o frontend carregar nas <img>.
UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

app.include_router(auth.router)
app.include_router(licoes.router)
app.include_router(conteudo.router)
app.include_router(progresso.router)
app.include_router(escolas.router)
app.include_router(perfil.router)
app.include_router(loja.router)
app.include_router(personalizacao.router)
app.include_router(turmas.router)
app.include_router(alunos.router)
app.include_router(gestores.router)
app.include_router(financeiro.router)
app.include_router(usuarios.router)


@app.get("/health", tags=["Status"])
def health():
    return {"status": "ok", "app": "sacou-api", "version": "1.0.0"}
