"""Limpeza de aulas de teste/distratoras do banco.

Remove aulas SEM conteúdo real (CONTEUDO_VIDEO vazio) e aulas criadas para
teste (título contendo 'teste'/'escala'), juntamente com perguntas,
alternativas e registros de progresso vinculados. Preserva apenas as trilhas
com conteúdo válido (ex.: Trilha 1).

Uso:
    venv/Scripts/python limpar_aulas_teste.py             # dry-run (apenas lista)
    venv/Scripts/python limpar_aulas_teste.py --executar  # apaga de verdade

A execução é idempotente: rodar duas vezes não quebra nada.
"""

import re
import sys

from sqlalchemy import text

from app.database import SessionLocal

EXECUTAR = "--executar" in sys.argv

# Aulas marcadas como teste pelo título (case-insensitive).
PADRAO_TESTE = re.compile(r"(teste|escala)", re.IGNORECASE)


def _eh_teste(conteudo: str | None, titulo: str) -> bool:
    if not (conteudo or "").strip():
        return True  # sem conteúdo real
    return bool(PADRAO_TESTE.search(titulo or ""))


def main():
    db = SessionLocal()
    try:
        linhas = db.execute(
            text(
                "SELECT l.ID_LICAO, l.ID_TRILHA, l.TITULO, l.CONTEUDO_VIDEO, "
                "t.NOME_TRILHA "
                "FROM licao l JOIN trilha t ON t.ID_TRILHA = l.ID_TRILHA "
                "ORDER BY l.ID_TRILHA, l.ID_LICAO"
            )
        ).all()

        a_remover = []
        for lid, tid, titulo, conteudo, nome_trilha in linhas:
            if _eh_teste(conteudo, titulo):
                a_remover.append(
                    {
                        "id_licao": lid,
                        "id_trilha": tid,
                        "titulo": titulo,
                        "trilha": nome_trilha,
                    }
                )

        if not a_remover:
            print("Nenhuma aula de teste encontrada. Nada a fazer.")
            return

        print(f"{'='*70}")
        print(f"DRY-RUN" if not EXECUTAR else "EXECUTANDO")
        print(f"{'='*70}")
        for item in a_remover:
            print(
                f"  - ID_LICAO {item['id_licao']:>3} | Trilha {item['id_trilha']} "
                f"({item['trilha']}) | {item['titulo']}"
            )
        print(f"Total de aulas a remover: {len(a_remover)}")

        if not EXECUTAR:
            print("\nNada foi alterado. Rode com `--executar` para aplicar.")
            return

        ids = [int(item["id_licao"]) for item in a_remover]
        # IDs vêm do banco (ints); inlining é seguro aqui.
        ids_sql = ",".join(str(i) for i in ids)

        # Ordem segura de FK: progresso -> alternativas -> perguntas -> aulas.
        db.execute(text(f"DELETE FROM progresso_licao WHERE ID_LICAO IN ({ids_sql})"))
        db.execute(
            text(
                f"DELETE FROM alternativa WHERE ID_PERGUNTA IN "
                f"(SELECT ID_PERGUNTA FROM pergunta WHERE ID_LICAO IN ({ids_sql}))"
            )
        )
        db.execute(text(f"DELETE FROM pergunta WHERE ID_LICAO IN ({ids_sql})"))
        db.execute(text(f"DELETE FROM licao WHERE ID_LICAO IN ({ids_sql})"))

        db.commit()

        # Verificação pós-limpeza.
        trilhas_com_conteudo = db.execute(
            text(
                "SELECT COUNT(DISTINCT ID_TRILHA) FROM licao "
                "WHERE TRIM(CONTEUDO_VIDEO) <> ''"
            )
        ).scalar()
        progresso_restante = db.execute(text("SELECT COUNT(*) FROM progresso_licao")).scalar()
        print(f"\nLimpeza concluída.")
        print(f"Trilhas com conteúdo real (esperado 1): {trilhas_com_conteudo}")
        print(f"Registros de progresso restantes: {progresso_restante}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
