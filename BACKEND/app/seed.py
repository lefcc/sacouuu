"""Script de seed: cria tabelas, dados de demonstração e o conteúdo das 12 aulas.

Uso:
    python -m app.seed

Precisa do MySQL rodando e do banco db_sacou criado (importe o schema_sacou.sql
ou deixe o script criar as tabelas sozinho).
"""

from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from .database import Base, SessionLocal, engine
from .models import (
    Alternativa,
    Escola,
    Licao,
    Pergunta,
    Trilha,
    Turma,
    Usuario,
)
from .schemas import perfil_legado
from .security import hash_senha

# ── Conteúdo das aulas (mesmo das aulas.dart do app mobile) ──────────────────
CONTEUDO_AULAS = [
    {
        "titulo": "AULA 1: Por que juntar dinheiro é o básico?",
        "trilha": 1,
        "audio": "audioAula1.mp3",
        "tela": [
            "Liberdade > Escravidão: Dinheiro guardado = Poder de escolha.",
            "❌ Sem grana: Parcela em 12x e vira refém do banco.",
            "✅ Com grana: Desconto à vista e paz mental.",
            "O Aliado (Juro Composto): Seu dinheiro trabalhando enquanto você dorme.",
            "A Regra 50-30-20:\n50% Essencial (Sobrevivência)\n30% Desejos (O rolê)\n20% Futuro (Investimentos - O Foco!)",
        ],
        "perguntas": [
            {"enunciado": "Qual é a principal vantagem de ter dinheiro guardado ao enfrentar um imprevisto?", "opcoes": ["Poder comprar o que quiser sem se preocupar com o amanhã.", "Ter o poder de escolha para não aceitar condições abusivas ou juros."], "correta": 1},
            {"enunciado": "Na regra 50-30-20, quando você deve separar os 20% do investimento?", "opcoes": ["Logo que o dinheiro cai na conta, antes de começar a gastar.", "No último dia do mês, usando apenas o que sobrou das outras contas."], "correta": 0},
            {"enunciado": "Como o Juro Composto age no seu patrimônio ao longo dos anos?", "opcoes": ["Ele mantém o valor do seu dinheiro parado contra a inflação.", "Ele gera o efeito 'bola de neve', onde o lucro rende sobre o lucro anterior."], "correta": 1},
        ],
    },
    {
        "titulo": "AULA 2: Reserva de Emergência",
        "trilha": 1,
        "audio": "audioAula2.mp3",
        "tela": [
            "Reserva de Emergência (RE): O 'pneu estepe'. Só use em crises reais!",
            "A Meta (Quanto guardar?):\nMora com os pais: 3 a 6 meses do seu custo básico.\nMora sozinho/Autônomo: 6 a 12 meses.",
            "As 2 Regras Inegociáveis:\n1. Liquidez Diária: Tem que dar para sacar na hora.\n2. Risco Zero: Apenas contas a 100% do CDI ou Tesouro Selic.",
        ],
        "perguntas": [
            {"enunciado": "Qual o critério para definir o valor total da sua Reserva de Emergência?", "opcoes": ["Somar todos os seus bens (celular, PC, roupas) e dobrar o valor.", "Multiplicar seu custo de vida básico pelo número de meses de segurança."], "correta": 1},
            {"enunciado": "Quais são as duas características obrigatórias onde você guarda a Reserva?", "opcoes": ["Liquidez Diária (resgate rápido) e Risco Zero (segurança total).", "Rendimento máximo acima da bolsa e carência de longo prazo."], "correta": 0},
            {"enunciado": "Onde é um lugar seguro e correto para colocar sua Reserva de Emergência?", "opcoes": ["Em uma conta que renda 100% do CDI ou no Tesouro Selic.", "Em ações de empresas famosas que pagam muitos dividendos."], "correta": 0},
        ],
    },
    {
        "titulo": "AULA 3: Metas de Curto Prazo",
        "trilha": 1,
        "audio": "audioAula3.mp3",
        "tela": [
            "A Jornada SMART: Sonho não tem data, meta tem.\nEspecífica / Mensurável / Alcançável / Relevante / Temporal",
            "Organize por 'Potes': Separe o dinheiro no app (Ex: Pote 'Viagem', Pote 'PC'). Não misture as contas!",
            "A Matemática: Valor Total ÷ Número de Meses = O que você guarda hoje.",
            "Onde Guardar (até 2 anos): Segurança e acesso rápido (100% CDI ou Tesouro Selic).",
        ],
        "perguntas": [
            {"enunciado": "O que diferencia um 'Sonho' de uma 'Meta SMART' no planejamento?", "opcoes": ["O sonho é o que você quer, a meta é o que o banco te deixa fazer.", "A meta tem um valor exato, uma data limite e um plano de ação."], "correta": 1},
            {"enunciado": "Qual a vantagem de usar 'Potes' ou 'Caixinhas' digitais para suas metas?", "opcoes": ["Visualizar o progresso individual e não gastar o dinheiro de uma meta em outra.", "Ganhar juros maiores do que se o dinheiro estivesse em um pote só."], "correta": 0},
            {"enunciado": "Qual o foco principal ao investir para uma meta de até 2 anos?", "opcoes": ["Segurança e liquidez, para garantir que o dinheiro esteja lá na data da meta.", "Arriscar em cripto para tentar bater a meta na metade do tempo previsto."], "correta": 0},
        ],
    },
    {
        "titulo": "AULA 4: Metas de Longo Prazo - Aposentadoria",
        "trilha": 1,
        "audio": "audioAula4.mp3",
        "tela": [
            "O Fator Tempo: Seu maior ativo hoje. O juro composto faz o trabalho pesado.",
            "Começar aos 20 é infinitamente mais fácil que começar aos 30.",
            "A Ilusão do INSS: Depender do governo é falência garantida. Crie seu próprio patrimônio.",
            "O Objetivo Real (Renda Passiva): Viver apenas dos rendimentos do seu dinheiro, sem trabalhar.",
            "Ação Imediata: Crie o 'Pote Aposentadoria' e invista parte dos seus 20% todo mês.",
        ],
        "perguntas": [
            {"enunciado": "Por que começar a investir aos 20 anos é melhor do que começar aos 30?", "opcoes": ["Porque o tempo é o maior multiplicador na fórmula dos juros compostos.", "Porque aos 20 anos você entende mais de tecnologia e aplicativos."], "correta": 0},
            {"enunciado": "Qual é o conceito real de 'Aposentadoria' para quem investe?", "opcoes": ["Receber o benefício mensal do governo (INSS) após trabalhar 40 anos.", "Ter um patrimônio que gera renda passiva suficiente para pagar sua vida."], "correta": 1},
            {"enunciado": "Qual a recomendação para o 'Pote da Aposentadoria' em relação ao risco?", "opcoes": ["Usar apenas a poupança para garantir que o valor nunca mude.", "Alocar uma parte em renda variável, pois o tempo longo dilui os riscos."], "correta": 1},
        ],
    },
    {"titulo": "AULA 5: A Regra do Jogo e o Inimigo Invisível", "trilha": 2, "audio": None, "tela": [], "perguntas": []},
    {"titulo": "AULA 6: A Ilusão da Poupança e o Poder do CDB", "trilha": 2, "audio": None, "tela": [], "perguntas": []},
    {"titulo": "AULA 7: O Hack do Imposto (LCI/LCA)", "trilha": 2, "audio": None, "tela": [], "perguntas": []},
    {"titulo": "AULA 8: O Cofre do País (Tesouro Direto)", "trilha": 2, "audio": None, "tela": [], "perguntas": []},
    {"titulo": "AULA 9: O Jogo dos Grandes e o Campo de Batalha", "trilha": 3, "audio": None, "tela": [], "perguntas": []},
    {"titulo": "AULA 10: Virando Dono e Recebendo Aluguel", "trilha": 3, "audio": None, "tela": [], "perguntas": []},
    {"titulo": "AULA 11: O Hack Definitivo contra a Ruína", "trilha": 3, "audio": None, "tela": [], "perguntas": []},
    {"titulo": "AULA 12: A Fronteira Selvagem do Cripto", "trilha": 3, "audio": None, "tela": [], "perguntas": []},
]

TRILHAS = [
    "TRILHA 1: INICIANDO MENTALIDADE MILIONÁRIA",
    "TRILHA 2: RENDA FIXA",
    "TRILHA 3: RENDA VARIÁVEL",
]


def _garantir_coluna_url_imagem():
    """Adiciona a coluna URL_IMAGEM em licao se ainda não existir."""
    inspetor = inspect(engine)
    colunas = {c["name"] for c in inspetor.get_columns("licao")}
    if "URL_IMAGEM" not in colunas:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE licao ADD COLUMN URL_IMAGEM VARCHAR(500) NULL"))


def seed_conteudo(db):
    # Trilhas
    for nome in TRILHAS:
        if not db.query(Trilha).filter(Trilha.nome_trilha == nome).first():
            db.add(Trilha(nome_trilha=nome))
    db.commit()

    trilhas = {t.nome_trilha: t for t in db.query(Trilha).all()}

    for idx, aula in enumerate(CONTEUDO_AULAS):
        if db.query(Licao).filter(Licao.titulo == aula["titulo"]).first():
            continue

        trilha = trilhas[TRILHAS[aula["trilha"] - 1]]
        licao = Licao(
            id_trilha=trilha.id_trilha,
            titulo=aula["titulo"],
            conteudo_video="\n".join(aula["tela"]),
            conteudo_audio=aula["audio"],
            recompensa_moedas_max=30,
            ordem=idx + 1,
        )
        db.add(licao)
        db.flush()

        for pergunta_data in aula["perguntas"]:
            pergunta = Pergunta(id_licao=licao.id_licao, enunciado=pergunta_data["enunciado"])
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


def seed_usuarios(db):
    escola = db.query(Escola).filter(Escola.nome_instituicao.contains("COTIL")).first()
    if not escola:
        escola = Escola(
            cnpj="10.555.432/0001-99",
            nome_instituicao="COTIL - Colégio Técnico de Limeira",
        )
        db.add(escola)
        db.flush()

    turma = db.query(Turma).filter(Turma.nome_turma == "Turma A").first()
    if not turma:
        turma = Turma(
            id_escola=escola.id_escola,
            nome_serie="1º Ano EM",
            ano_letivo=2026,
            nome_turma="Turma A",
        )
        db.add(turma)
        db.flush()
    turma.identificador = "1º Ano A"
    turma.ano_letivo = turma.ano_letivo or 2026

    def _criar_usuario(nome, email, senha, perfil, **extra):
        if db.query(Usuario).filter(Usuario.email == email).first():
            return None
        usuario = Usuario(
            nome_completo=nome,
            email=email,
            senha=hash_senha(senha),
            perfil=perfil,
            tipo_perfil=perfil_legado(perfil),
            **extra,
        )
        db.add(usuario)
        db.flush()
        return usuario

    gestor = _criar_usuario(
        "Gestor da Plataforma Sacou", "admin@sacou.com", "admin123", "GESTOR_PLATAFORMA"
    )
    if gestor:
        escola.id_criador_admin = gestor.id_usuario

    _criar_usuario(
        "Aluno Demonstração", "aluno@sacou.com", "123456", "ALUNO",
        escola_id=escola.id_escola,
        id_turma=turma.id_turma,
        nickname="admin",
    )

    # Alunos extras da turma "1º Ano A": um ativo e um arquivado (para testes do frontend).
    _criar_usuario(
        "Aluno Ativo Extra", "aluno2@sacou.com", "123456", "ALUNO",
        escola_id=escola.id_escola,
        id_turma=turma.id_turma,
        nickname="ativo_extra",
    )
    _criar_usuario(
        "Aluno Arquivado", "aluno_arquivado@sacou.com", "123456", "ALUNO",
        escola_id=escola.id_escola,
        id_turma=turma.id_turma,
        nickname="arquivado",
        arquivado=True,
    )

    _criar_usuario(
        "Professor Demonstração", "professor@sacou.com", "professor123",
        "VISUALIZADOR_ESCOLA", escola_id=escola.id_escola,
    )

    _criar_usuario(
        "Coordenador Demonstração", "coordenador@sacou.com", "coord123",
        "ADMIN_ESCOLA", escola_id=escola.id_escola,
    )

    _criar_usuario(
        "Desenvolvedor Sacou", "dev@sacou.com", "dev123", "DEV"
    )
    db.commit()


def seed_avatares_e_loja(db):
    from .models import Avatar, ItemLoja

    if db.query(Avatar).count() > 0:
        return

    avatares = [
        Avatar(nome="Mentor", descricao="O estrategista financeiro", url_imagem="/static/avatars/avatar_mentor.svg", ordem=1),
        Avatar(nome="Estrategista", descricao="O guardião do patrimônio", url_imagem="/static/avatars/avatar_estrategista.svg", ordem=2),
        Avatar(nome="Explorador", descricao="O aventureiro das finanças", url_imagem="/static/avatars/avatar_explorador.svg", ordem=3),
    ]
    db.add_all(avatares)
    db.flush()

    itens = [
        ItemLoja(nome="Boné Anjo", descricao="Um boné com asas de anjo", url_imagem="/static/loja/bone_anjo.svg", preco=60, id_trilha_requerida=1),
        ItemLoja(nome="Boné Orelha Coelho", descricao="Boné com orelhas de coelho", url_imagem="/static/loja/bone_coelho.svg", preco=90, id_trilha_requerida=1),
        ItemLoja(nome="Touca Colorida", descricao="Uma touca vibrante", url_imagem="/static/loja/touca.svg", preco=180, id_trilha_requerida=2),
        ItemLoja(nome="Óculos de Nerd", descricao="Óculos inteligentes", url_imagem="/static/loja/oculos_nerd.svg", preco=150, id_trilha_requerida=2),
        ItemLoja(nome="Chapéu Lampião", descricao="Estilo nortista", url_imagem="/static/loja/chapeu_lampiao.svg", preco=200, id_trilha_requerida=2),
        ItemLoja(nome="Óculos Matrix", descricao="Óculos escuros lendários", url_imagem="/static/loja/oculos_matrix.svg", preco=300, id_trilha_requerida=3),
        ItemLoja(nome="Coroa de Luz", descricao="A Aura Suprema — item lendário", url_imagem="/static/loja/coroa_luz.svg", preco=480, id_trilha_requerida=3),
    ]
    db.add_all(itens)
    db.commit()


def main():
    Base.metadata.create_all(bind=engine)
    _garantir_coluna_url_imagem()

    db = SessionLocal()
    try:
        seed_conteudo(db)
        seed_usuarios(db)
        seed_avatares_e_loja(db)
        print("Seed concluído com sucesso!")
        print()
        print("Usuários de demonstração (senhas hasheadas com bcrypt):")
        print("  Gestor Plataforma: admin@sacou.com / admin123")
        print("  Aluno (app):       aluno@sacou.com / 123456")
        print("  Visualizador:      professor@sacou.com / professor123")
        print("  Admin Escola:      coordenador@sacou.com / coord123")
        print("  Dev:               dev@sacou.com / dev123")
    except IntegrityError as exc:
        print(f"Erro de integridade (dados já existem?): {exc}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
