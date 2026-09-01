"""Migração: remove XP da gamificação (padroniza apenas MOEDAS).

Remove as colunas:
- `usuario.XP_TOTAL`            (XP acumulado do aluno)
- `licao.RECOMPENSA_XP_MAX`     (recompensa de XP por aula)
- `trilha.PONTUACAO_MIN/MAX`    (faixa de "pontos/XP" da trilha)

Idempotente — só remove se a coluna existir. A API deixa de ler/escrever XP.

Uso:
    venv/Scripts/python migracao_remover_xp.py
"""

from sqlalchemy import create_engine, text

from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL)


def _colunas(conn, tabela: str) -> set[str]:
    return {r[0] for r in conn.execute(text(f"SHOW COLUMNS FROM `{tabela}`"))}


def _drop(conn, tabela: str, coluna: str, nome: str):
    if coluna in _colunas(conn, tabela):
        conn.execute(text(f"ALTER TABLE `{tabela}` DROP COLUMN `{coluna}`"))
        print(f"- coluna {tabela}.{coluna} removida.")
    else:
        print(f"= {tabela}.{coluna} não existia (ignorado).")


def main():
    with engine.begin() as conn:
        _drop(conn, "usuario", "XP_TOTAL", "XP do aluno")
        _drop(conn, "licao", "RECOMPENSA_XP_MAX", "recompensa XP por aula")
        _drop(conn, "trilha", "PONTUACAO_MIN", "faixa mínima de pontos")
        _drop(conn, "trilha", "PONTUACAO_MAX", "faixa máxima de pontos")


if __name__ == "__main__":
    main()
