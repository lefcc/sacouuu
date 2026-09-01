"""Migração de teste: adiciona uma "Aula 13" em uma trilha existente.

Serve para validar que o estado global do app mobile cresce dinamicamente
(aulasConcluidasGlobal NÃO pode ter tamanho fixo 12). Depois de rodar, o app
deve exibir a Aula 13 na tela de Trilhas e processá-la sem "Index out of range".

Uso:
    venv/Scripts/python migracao_aula_13_teste.py

Idempotente: roda quantas vezes quiser (ignora se a Aula 13 já existir).
"""

from sqlalchemy import func, select

from app.database import SessionLocal
from app.models import Alternativa, Licao, Pergunta

TITULO = "AULA 13: Teste de Escalabilidade (13a Aula)"

CONTEUDO = [
    "Aula de TESTE adicionada via migracao_aula_13_teste.py.",
    "Se esta aula aparecer na tela de Trilhas sem quebrar o app,",
    "o limite fixo de 12 aulas foi removido com sucesso.",
    "Total de aulas no banco agora: 13.",
]

PERGUNTAS = [
    {
        "enunciado": "O progresso do aluno deve ser limitado a 12 aulas?",
        "opcoes": [
            "Não: o estado global deve acompanhar o total real de aulas no banco.",
            "Sim: o app só suporta exatamente 12 aulas.",
        ],
        "correta": 0,
    },
    {
        "enunciado": "O que acontece se o banco tiver 13 aulas?",
        "opcoes": [
            "O app quebra com 'Index out of range'.",
            "O app redimensiona a lista de progresso para 13 aulas automaticamente.",
        ],
        "correta": 1,
    },
]


def main():
    db = SessionLocal()
    try:
        if db.query(Licao).filter(Licao.titulo == TITULO).first():
            print(f"'{TITULO}' já existe — nada a fazer.")
            return

        maior_ordem = db.execute(select(func.max(Licao.ordem))).scalar() or 0
        licao = Licao(
            id_trilha=3,  # Trilha 3: Renda Variável (aula 13ª, depois da AULA 12)
            titulo=TITULO,
            conteudo_video="\n".join(CONTEUDO),
            conteudo_audio=None,
            recompensa_moedas_max=30,
            ordem=maior_ordem + 1,
        )
        db.add(licao)
        db.flush()

        for pergunta_data in PERGUNTAS:
            pergunta = Pergunta(
                id_licao=licao.id_licao,
                enunciado=pergunta_data["enunciado"],
            )
            db.add(pergunta)
            db.flush()
            for i, opcao in enumerate(pergunta_data["opcoes"]):
                db.add(
                    Alternativa(
                        id_pergunta=pergunta.id_pergunta,
                        texto=opcao,
                        eh_correta=(i == pergunta_data["correta"]),
                    )
                )

        db.commit()
        total = db.query(func.count(Licao.id_licao)).scalar()
        print(f"[OK] Aula 13 criada (id_licao={licao.id_licao}, ordem={licao.ordem}).")
        print(f"  Total de aulas no banco agora: {total}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
