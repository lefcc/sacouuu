"""Migração: corrige a tabela `avatar` para os 3 avatares REAIS.

Remove os avatares fake (Mentor, Estrategista, Explorador) que apontavam para
SVGs placeholder, e garante apenas os 3 reais do banco, com imagens servidas
pelo backend via /uploads/personalizacao/:

    Elefante -> /uploads/personalizacao/elefante.png
    Pinguim  -> /uploads/personalizacao/pinguim.png
    Polvo    -> /uploads/personalizacao/polvo.png

Idempotente — pode rodar várias vezes.

Uso:
    venv/Scripts/python migracao_avatares_reais.py
"""

from sqlalchemy import create_engine, text

from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL)

AVATARES_FAKE = ("Mentor", "Estrategista", "Explorador")

AVATARES_REAIS = [
    ("Elefante", "/uploads/personalizacao/elefante.png", 0),
    ("Pinguim", "/uploads/personalizacao/pinguim.png", 1),
    ("Polvo", "/uploads/personalizacao/polvo.png", 2),
]


def main():
    with engine.begin() as conn:
        # 1) Remove os avatares fake (que não existem mais).
        for nome in AVATARES_FAKE:
            r = conn.execute(text("DELETE FROM avatar WHERE NOME = :nome"), {"nome": nome})
            print(f"- avatar fake '{nome}' removido ({r.rowcount})")

        # 2) Garante os 3 avatares reais (insere ou atualiza a imagem).
        for nome, imagem, ordem in AVATARES_REAIS:
            ex = conn.execute(
                text("SELECT ID_AVATAR FROM avatar WHERE NOME = :nome"), {"nome": nome}
            ).fetchone()
            if ex:
                conn.execute(
                    text(
                        "UPDATE avatar SET URL_IMAGEM = :img, ORDEM = :ordem, ATIVO = 1 "
                        "WHERE ID_AVATAR = :id"
                    ),
                    {"img": imagem, "ordem": ordem, "id": ex[0]},
                )
                print(f"= avatar '{nome}' atualizado -> {imagem}")
            else:
                conn.execute(
                    text(
                        "INSERT INTO avatar (NOME, DESCRICAO, URL_IMAGEM, ORDEM, ATIVO) "
                        "VALUES (:nome, NULL, :img, :ordem, 1)"
                    ),
                    {"nome": nome, "img": imagem, "ordem": ordem},
                )
                print(f"+ avatar '{nome}' criado -> {imagem}")

    with engine.connect() as conn:
        print("\n--- estado final da tabela avatar ---")
        for r in conn.execute(text("SELECT ID_AVATAR, NOME, URL_IMAGEM, ORDEM, ATIVO FROM avatar ORDER BY ORDEM")):
            print(" ", tuple(r))


if __name__ == "__main__":
    main()
