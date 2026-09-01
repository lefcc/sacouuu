"""Migração: cria a tabela `arquivo_contrato` (uploads de contrato por escola).

Idempotente — usa `CREATE TABLE IF NOT EXISTS`, pode rodar várias vezes.

Uso:
    venv/Scripts/python migracao_arquivo_contrato.py
"""

from sqlalchemy import create_engine, text

from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL)

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS `arquivo_contrato` (
  `ID_ARQUIVO` int NOT NULL AUTO_INCREMENT,
  `ID_ESCOLA` int NOT NULL,
  `NOME_ORIGINAL` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `CAMINHO_ARQUIVO` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `DATA_UPLOAD` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `CREATED_AT` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ID_ARQUIVO`),
  KEY `ID_ESCOLA` (`ID_ESCOLA`),
  CONSTRAINT `arquivo_contrato_ibfk_1` FOREIGN KEY (`ID_ESCOLA`)
    REFERENCES `escola` (`ID_ESCOLA`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
"""


def main():
    with engine.begin() as conn:
        conn.execute(text(CREATE_TABLE_SQL))
        print("+ tabela arquivo_contrato garantida (idempotente).")

    with engine.connect() as conn:
        colunas = [r[0] for r in conn.execute(text("SHOW COLUMNS FROM arquivo_contrato"))]
        print("Colunas:", ", ".join(colunas))


if __name__ == "__main__":
    main()
