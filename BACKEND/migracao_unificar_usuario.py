"""Migração: consolida o RBAC e o perfil de usuário na tabela `usuario`.

Adiciona PERFIL, ESCOLA_ID e os campos de aluno (NICKNAME, XP_TOTAL,
MOEDAS_TOTAL, NIVEL_ATUAL, ID_TURMA) à tabela `usuario`, faz o backfill a
partir das tabelas legadas (coordenador/professor/aluno) e reponta a FK de
progresso_licao para `usuario`.

A tabela `usuario` passa a ser a fonte única de autenticação e RBAC. As
tabelas legadas permanecem no banco apenas para compatibilidade/segurança,
mas não são mais utilizadas pela aplicação.

Uso:
    venv/Scripts/python migracao_unificar_usuario.py
"""

from sqlalchemy import create_engine, text

from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL)


def colunas(conn, tabela: str) -> set[str]:
    return {
        r[0] for r in conn.execute(text(f"SHOW COLUMNS FROM `{tabela}`"))
    }


def fks(conn, tabela: str) -> dict[str, str]:
    """Retorna {constraint_name: referenced_table} das FKs de uma tabela."""
    resultado = {}
    for r in conn.execute(text(f"SHOW CREATE TABLE `{tabela}`")):
        sql = r[1]
    for linha in sql.splitlines():
        if "CONSTRAINT" in linha and "FOREIGN KEY" in linha:
            nome = linha.split("`")[1]
            resultado[nome] = linha
    return resultado


def main():
    with engine.begin() as conn:
        cols = colunas(conn, "usuario")

        # 1) Novas colunas de RBAC e perfil do aluno
        if "PERFIL" not in cols:
            conn.execute(text(
                "ALTER TABLE usuario ADD COLUMN PERFIL VARCHAR(30) "
                "NOT NULL DEFAULT 'VISUALIZADOR_ESCOLA' AFTER TIPO_PERFIL"
            ))
            print("+ coluna usuario.PERFIL")
        if "ESCOLA_ID" not in cols:
            conn.execute(text(
                "ALTER TABLE usuario ADD COLUMN ESCOLA_ID INT NULL AFTER PERFIL"
            ))
            print("+ coluna usuario.ESCOLA_ID")
        for nome, ddl in {
            "NICKNAME": "VARCHAR(50) NULL",
            "XP_TOTAL": "INT NOT NULL DEFAULT 0",
            "MOEDAS_TOTAL": "INT NOT NULL DEFAULT 0",
            "NIVEL_ATUAL": "INT NOT NULL DEFAULT 1",
            "ID_TURMA": "INT NULL",
        }.items():
            if nome not in cols:
                conn.execute(text(f"ALTER TABLE usuario ADD COLUMN {nome} {ddl}"))
                print(f"+ coluna usuario.{nome}")

        # 2) Backfill a partir das tabelas legadas
        conn.execute(text(
            "UPDATE usuario u JOIN aluno a ON a.ID_USUARIO = u.ID_USUARIO "
            "JOIN turma t ON t.ID_TURMA = a.ID_TURMA "
            "SET u.PERFIL = 'ALUNO', u.NICKNAME = a.NICKNAME, "
            "u.XP_TOTAL = a.XP_TOTAL, u.MOEDAS_TOTAL = a.MOEDAS_TOTAL, "
            "u.NIVEL_ATUAL = a.NIVEL_ATUAL, u.ID_TURMA = a.ID_TURMA, "
            "u.ESCOLA_ID = t.ID_ESCOLA "
            "WHERE u.TIPO_PERFIL = 'ALUNO'"
        ))
        conn.execute(text(
            "UPDATE usuario u JOIN coordenador c ON c.ID_USUARIO = u.ID_USUARIO "
            "SET u.PERFIL = 'ADMIN_ESCOLA', u.ESCOLA_ID = c.ID_ESCOLA "
            "WHERE u.TIPO_PERFIL = 'COORDENADOR'"
        ))
        conn.execute(text(
            "UPDATE usuario u JOIN professor p ON p.ID_USUARIO = u.ID_USUARIO "
            "SET u.PERFIL = 'VISUALIZADOR_ESCOLA', u.ESCOLA_ID = p.ID_ESCOLA "
            "WHERE u.TIPO_PERFIL = 'PROFESSOR'"
        ))
        conn.execute(text(
            "UPDATE usuario SET PERFIL = 'GESTOR_PLATAFORMA', ESCOLA_ID = NULL "
            "WHERE TIPO_PERFIL = 'ADMIN'"
        ))
        print("+ backfill de PERFIL/ESCOLA_ID/campos de aluno concluído")

        # 3) FKs
        fks_usuario = fks(conn, "usuario")
        if "fk_usuario_escola" not in fks_usuario:
            conn.execute(text(
                "ALTER TABLE usuario ADD CONSTRAINT fk_usuario_escola "
                "FOREIGN KEY (ESCOLA_ID) REFERENCES escola(ID_ESCOLA) "
                "ON DELETE SET NULL"
            ))
            print("+ FK fk_usuario_escola")
        if "fk_usuario_turma" not in fks_usuario:
            conn.execute(text(
                "ALTER TABLE usuario ADD CONSTRAINT fk_usuario_turma "
                "FOREIGN KEY (ID_TURMA) REFERENCES turma(ID_TURMA) "
                "ON DELETE SET NULL"
            ))
            print("+ FK fk_usuario_turma")

        # 4) Repontar progresso_licao.ID_ALUNO -> usuario.ID_USUARIO
        fks_prog = fks(conn, "progresso_licao")
        if "progresso_licao_ibfk_1" in fks_prog:
            conn.execute(text(
                "ALTER TABLE progresso_licao DROP FOREIGN KEY progresso_licao_ibfk_1"
            ))
            print("- FK antiga progresso_licao_ibfk_1 (apontava para aluno)")
        conn.execute(text(
            "ALTER TABLE progresso_licao ADD CONSTRAINT progresso_licao_ibfk_1 "
            "FOREIGN KEY (ID_ALUNO) REFERENCES usuario(ID_USUARIO) "
            "ON DELETE CASCADE"
        ))
        print("+ FK progresso_licao_ibfk_1 -> usuario.ID_USUARIO")

    # 4) Conferência final
    with engine.connect() as conn:
        print("\n--- estado final ---")
        print("colunas usuario:", sorted(colunas(conn, "usuario")))
        for r in conn.execute(text(
            "SELECT ID_USUARIO, EMAIL, TIPO_PERFIL, PERFIL, ESCOLA_ID, NICKNAME, "
            "XP_TOTAL, MOEDAS_TOTAL, NIVEL_ATUAL, ID_TURMA FROM usuario ORDER BY ID_USUARIO"
        )):
            print(" ", r)


if __name__ == "__main__":
    main()
