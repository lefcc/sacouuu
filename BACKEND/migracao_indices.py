"""Migração: cria índices de performance ausentes no MySQL (idempotente).

Índices para filtros frequentes que o `Base.metadata.create_all` não adiciona
em tabelas já existentes:
  - usuario.PERFIL (filtro por perfil em todas as listagens)
  - usuario.STATUS_ATIVO (filtro ativo/inativo)
  - usuario.(ESCOLA_ID, PERFIL) — composto para listagens por escola
  - progresso_licao.DATA_CONCLUSAO — métrica de atividade (últimos 15 dias)

Uso:
    venv/Scripts/python migracao_indices.py
"""

from sqlalchemy import text

from app.database import engine

INDICES = [
    ("usuario", "ix_usuario_perfil", "PERFIL"),
    ("usuario", "ix_usuario_status", "STATUS_ATIVO"),
    ("usuario", "ix_usuario_escola_perfil", "ESCOLA_ID, PERFIL"),
    ("progresso_licao", "ix_progresso_conclusao", "DATA_CONCLUSAO"),
]


def main():
    with engine.begin() as conn:
        for tabela, nome, colunas in INDICES:
            existe = conn.execute(
                text(f"SHOW INDEX FROM `{tabela}` WHERE Key_name = :nome"),
                {"nome": nome},
            ).fetchone()
            if existe:
                print(f"= índice {nome} já existe em {tabela}")
            else:
                conn.execute(text(f"CREATE INDEX `{nome}` ON `{tabela}` ({colunas})"))
                print(f"+ índice {nome} criado em {tabela}")


if __name__ == "__main__":
    main()
