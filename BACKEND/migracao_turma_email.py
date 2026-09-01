"""Migração: adiciona a coluna `EMAIL_CONTATO` na tabela `turma`.

Idempotente — só adiciona se ainda não existir.

Uso:
    venv/Scripts/python migracao_turma_email.py
"""

from sqlalchemy import create_engine, text

from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL)


def main():
    with engine.begin() as conn:
        colunas = {r[0] for r in conn.execute(text("SHOW COLUMNS FROM turma"))}
        if "EMAIL_CONTATO" not in colunas:
            conn.execute(text(
                "ALTER TABLE turma ADD COLUMN EMAIL_CONTATO VARCHAR(100) NULL"
            ))
            print("+ coluna turma.EMAIL_CONTATO adicionada.")
        else:
            print("= coluna turma.EMAIL_CONTATO já existia (ignorado).")


if __name__ == "__main__":
    main()
