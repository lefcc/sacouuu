"""Migração Bloco 0.5: Soft Delete, Identificador de Turma e Auditoria (LGPD).

Adiciona, de forma idempotente (ignora se já existir):
- `ARQUIVADO` (BOOLEAN DEFAULT FALSE) em usuario, turma e escola.
- `IDENTIFICADOR` (VARCHAR(50) NOT NULL) em turma, com backfill das linhas atuais.
- `CREATED_AT` / `UPDATED_AT` (TIMESTAMP com CURRENT_TIMESTAMP) em usuario,
  turma e escola.

A FK de turma para escola (turma.ID_ESCOLA -> escola.ID_ESCOLA) já existe no
banco; a migração apenas confirma e reporta.

Uso:
    venv/Scripts/python migracao_auditoria_softdelete.py
"""

from sqlalchemy import create_engine, text

from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL)

TABELAS = ("usuario", "turma", "escola")


def colunas(conn, tabela: str) -> set[str]:
    return {r[0] for r in conn.execute(text(f"SHOW COLUMNS FROM `{tabela}`"))}


def main():
    with engine.begin() as conn:
        # 1) SOFT DELETE (ARQUIVADO)
        for tabela in TABELAS:
            cols = colunas(conn, tabela)
            if "ARQUIVADO" not in cols:
                conn.execute(text(
                    f"ALTER TABLE `{tabela}` ADD COLUMN ARQUIVADO BOOLEAN NOT NULL DEFAULT FALSE"
                ))
                print(f"+ coluna {tabela}.ARQUIVADO")
            else:
                print(f"= coluna {tabela}.ARQUIVADO já existia (ignorado)")

        # 2) IDENTIFICADOR de turma (com backfill antes de tornar NOT NULL)
        cols_turma = colunas(conn, "turma")
        if "IDENTIFICADOR" not in cols_turma:
            conn.execute(text(
                "ALTER TABLE turma ADD COLUMN IDENTIFICADOR VARCHAR(50) NULL"
            ))
            conn.execute(text(
                "UPDATE turma SET IDENTIFICADOR = "
                "TRIM(CONCAT(COALESCE(NOME_SERIE, ''), ' ', COALESCE(NOME_TURMA, ''))) "
                "WHERE IDENTIFICADOR IS NULL OR IDENTIFICADOR = ''"
            ))
            conn.execute(text(
                "ALTER TABLE turma MODIFY IDENTIFICADOR VARCHAR(50) NOT NULL"
            ))
            print("+ coluna turma.IDENTIFICADOR (NOT NULL) com backfill")
        else:
            print("= coluna turma.IDENTIFICADOR já existia (ignorado)")

        # 3) AUDITORIA (LGPD): CREATED_AT / UPDATED_AT
        for tabela in TABELAS:
            cols = colunas(conn, tabela)
            if "CREATED_AT" not in cols:
                conn.execute(text(
                    f"ALTER TABLE `{tabela}` ADD COLUMN CREATED_AT TIMESTAMP "
                    "NOT NULL DEFAULT CURRENT_TIMESTAMP"
                ))
                print(f"+ coluna {tabela}.CREATED_AT")
            else:
                print(f"= coluna {tabela}.CREATED_AT já existia (ignorado)")
            if "UPDATED_AT" not in cols:
                conn.execute(text(
                    f"ALTER TABLE `{tabela}` ADD COLUMN UPDATED_AT TIMESTAMP "
                    "NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
                ))
                print(f"+ coluna {tabela}.UPDATED_AT")
            else:
                print(f"= coluna {tabela}.UPDATED_AT já existia (ignorado)")

    # 4) Conferência das FKs de turma -> escola
    with engine.connect() as conn:
        print("\n--- FKs de turma ---")
        for r in conn.execute(text("""
            SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME,
                   REFERENCED_COLUMN_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = 'db_sacou' AND TABLE_NAME = 'turma'
              AND REFERENCED_TABLE_NAME IS NOT NULL
        """)):
            print(" ", tuple(r))


if __name__ == "__main__":
    main()
