"""Modelos SQLAlchemy espelhando o schema_sacou.sql.

Convenção de nomes de coluna segue o banco (MAIÚSCULAS no schema, aqui em
snake_case por convenção do SQLAlchemy via __tablename__ + mapeamento).
"""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import relationship

from .database import Base


class Usuario(Base):
    __tablename__ = "usuario"
    __table_args__ = (
        # Índices para filtros frequentes (perfil, status, escola+perfil).
        Index("ix_usuario_perfil", "PERFIL"),
        Index("ix_usuario_status", "STATUS_ATIVO"),
        Index("ix_usuario_escola_perfil", "ESCOLA_ID", "PERFIL"),
    )

    id_usuario = Column("ID_USUARIO", Integer, primary_key=True, autoincrement=True)
    nome_completo = Column("NOME_COMPLETO", String(255), nullable=False)
    email = Column("EMAIL", String(100), nullable=False, unique=True)
    senha = Column("SENHA", String(255), nullable=False)

    # Perfil canônico de RBAC (tabela única de usuários):
    # DEV, GESTOR_PLATAFORMA, ADMIN_ESCOLA, VISUALIZADOR_ESCOLA, ALUNO.
    # OBRIGATÓRIO: sem default — o endpoint de criação valida o perfil antes.
    perfil = Column("PERFIL", String(30), nullable=False)
    # Espelho legado (ADMIN/COORDENADOR/PROFESSOR/ALUNO) mantido para compatibilidade
    # com o frontend web e testes existentes.
    tipo_perfil = Column("TIPO_PERFIL", String(20), nullable=False)

    # Escola de vínculo (NULL apenas para DEV e GESTOR_PLATAFORMA).
    escola_id = Column("ESCOLA_ID", Integer, ForeignKey("escola.ID_ESCOLA"), nullable=True)
    # Perfil do aluno (consolidado na própria tabela de usuário).
    id_turma = Column("ID_TURMA", Integer, ForeignKey("turma.ID_TURMA"), nullable=True)
    nickname = Column("NICKNAME", String(50), nullable=True)
    moedas_total = Column("MOEDAS_TOTAL", Integer, default=0)
    nivel_atual = Column("NIVEL_ATUAL", Integer, default=1)

    data_criacao = Column("DATA_CRIACAO", DateTime, default=datetime.utcnow)
    data_exclusao = Column("DATA_EXCLUSAO", DateTime, nullable=True)
    status_ativo = Column("STATUS_ATIVO", Boolean, default=True)

    # Soft delete (arquivar) e auditoria LGPD.
    arquivado = Column("ARQUIVADO", Boolean, nullable=False, default=False, server_default=text("0"))
    created_at = Column("CREATED_AT", DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(
        "UPDATED_AT", DateTime, nullable=False,
        server_default=text("CURRENT_TIMESTAMP"), onupdate=func.current_timestamp(),
    )

    escola = relationship("Escola", back_populates="usuarios", foreign_keys=[escola_id])
    turma = relationship("Turma", back_populates="usuarios")
    progressos = relationship("ProgressoLicao", back_populates="aluno")


class Contrato(Base):
    """Contrato SaaS da escola: Setup + valor mensal por aluno ativo."""

    __tablename__ = "contrato"

    id_contrato = Column("ID_CONTRATO", Integer, primary_key=True, autoincrement=True)
    id_escola = Column(
        "ID_ESCOLA", Integer, ForeignKey("escola.ID_ESCOLA"), nullable=False, unique=True
    )
    valor_setup = Column("VALOR_SETUP", Numeric(10, 2), nullable=False, default=0)
    valor_por_aluno = Column("VALOR_POR_ALUNO", Numeric(10, 2), nullable=False, default=0)
    ativo = Column("ATIVO", Boolean, nullable=False, default=True, server_default=text("1"))
    created_at = Column("CREATED_AT", DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(
        "UPDATED_AT", DateTime, nullable=False,
        server_default=text("CURRENT_TIMESTAMP"), onupdate=func.current_timestamp(),
    )

    escola = relationship("Escola")


class Fatura(Base):
    """Fatura mensal de uma escola (status manual, sem integração bancária)."""

    __tablename__ = "fatura"
    __table_args__ = (UniqueConstraint("ID_ESCOLA", "MES_REFERENCIA", name="UNQ_ESCOLA_MES"),)

    id_fatura = Column("ID_FATURA", Integer, primary_key=True, autoincrement=True)
    id_escola = Column(
        "ID_ESCOLA", Integer, ForeignKey("escola.ID_ESCOLA"), nullable=False
    )
    mes_referencia = Column("MES_REFERENCIA", String(7), nullable=False)
    valor_total = Column("VALOR_TOTAL", Numeric(10, 2), nullable=False, default=0)
    status = Column("STATUS", String(20), nullable=False, default="EM_ABERTO")
    data_vencimento = Column("DATA_VENCIMENTO", DateTime, nullable=True)
    created_at = Column("CREATED_AT", DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(
        "UPDATED_AT", DateTime, nullable=False,
        server_default=text("CURRENT_TIMESTAMP"), onupdate=func.current_timestamp(),
    )

    escola = relationship("Escola")


class ArquivoContrato(Base):
    """Arquivo de contrato anexado a uma escola (PDF/imagem) — histórico auditável.

    O arquivo físico fica em `uploads/contratos/{escola_id}/` e o registro
    aqui guarda o nome original e o caminho para baixar/deletar.
    """

    __tablename__ = "arquivo_contrato"

    id_arquivo = Column("ID_ARQUIVO", Integer, primary_key=True, autoincrement=True)
    id_escola = Column(
        "ID_ESCOLA", Integer, ForeignKey("escola.ID_ESCOLA"), nullable=False
    )
    nome_original = Column("NOME_ORIGINAL", String(255), nullable=False)
    caminho_arquivo = Column("CAMINHO_ARQUIVO", String(500), nullable=False)
    data_upload = Column(
        "DATA_UPLOAD", DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )
    created_at = Column("CREATED_AT", DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP"))

    escola = relationship("Escola")


class TokenRecuperacao(Base):
    __tablename__ = "token_recuperacao"

    id_token = Column("ID_TOKEN", Integer, primary_key=True, autoincrement=True)
    id_usuario = Column(
        "ID_USUARIO",
        Integer,
        ForeignKey("usuario.ID_USUARIO", ondelete="CASCADE"),
        nullable=False,
    )
    token_hash = Column("TOKEN_HASH", String(255), nullable=False)
    data_criacao = Column("DATA_CRIACAO", DateTime, server_default=func.current_timestamp())
    data_expiracao = Column("DATA_EXPIRACAO", DateTime, nullable=False)
    utilizado = Column("UTILIZADO", Boolean, default=False, server_default=text("0"))

    usuario = relationship("Usuario")


class Escola(Base):
    __tablename__ = "escola"

    id_escola = Column("ID_ESCOLA", Integer, primary_key=True, autoincrement=True)
    cnpj = Column("CNPJ", String(18), nullable=True, unique=True)
    # Código sequencial gerado automaticamente (ex.: ESC0001, ESC0002...).
    codigo = Column("CODIGO", String(10), nullable=True, unique=True)
    nome_instituicao = Column("NOME_INSTITUICAO", String(255), nullable=False)
    id_criador_admin = Column(
        "ID_CRIADOR_ADMIN", Integer, ForeignKey("usuario.ID_USUARIO"), nullable=True
    )
    status_ativo = Column("STATUS_ATIVO", Boolean, default=True)
    data_exclusao = Column("DATA_EXCLUSAO", DateTime, nullable=True)

    # Soft delete (arquivar) e auditoria LGPD.
    arquivado = Column("ARQUIVADO", Boolean, nullable=False, default=False, server_default=text("0"))
    created_at = Column("CREATED_AT", DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(
        "UPDATED_AT", DateTime, nullable=False,
        server_default=text("CURRENT_TIMESTAMP"), onupdate=func.current_timestamp(),
    )

    turmas = relationship("Turma", back_populates="escola")
    usuarios = relationship("Usuario", back_populates="escola", foreign_keys="Usuario.escola_id")


class Turma(Base):
    __tablename__ = "turma"

    id_turma = Column("ID_TURMA", Integer, primary_key=True, autoincrement=True)
    id_escola = Column(
        "ID_ESCOLA", Integer, ForeignKey("escola.ID_ESCOLA"), nullable=False
    )
    nome_serie = Column("NOME_SERIE", String(20), nullable=False)
    ano_letivo = Column("ANO_LETIVO", Integer, nullable=False)
    nome_turma = Column("NOME_TURMA", String(50), nullable=False)
    data_exclusao = Column("DATA_EXCLUSAO", DateTime, nullable=True)

    # Identificador legível (ex.: "1º Ano A"), soft delete e auditoria LGPD.
    identificador = Column("IDENTIFICADOR", String(50), nullable=False, default="")
    # E-mail de contato da turma (edição permitida pelo painel web/desktop).
    email_contato = Column("EMAIL_CONTATO", String(100), nullable=True)
    arquivado = Column("ARQUIVADO", Boolean, nullable=False, default=False, server_default=text("0"))
    created_at = Column("CREATED_AT", DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(
        "UPDATED_AT", DateTime, nullable=False,
        server_default=text("CURRENT_TIMESTAMP"), onupdate=func.current_timestamp(),
    )

    escola = relationship("Escola", back_populates="turmas")
    usuarios = relationship("Usuario", back_populates="turma")


class Trilha(Base):
    __tablename__ = "trilha"

    id_trilha = Column("ID_TRILHA", Integer, primary_key=True, autoincrement=True)
    nome_trilha = Column("NOME_TRILHA", String(255), nullable=False)

    licoes = relationship("Licao", back_populates="trilha", order_by="Licao.ordem")


class Licao(Base):
    __tablename__ = "licao"

    id_licao = Column("ID_LICAO", Integer, primary_key=True, autoincrement=True)
    id_trilha = Column(
        "ID_TRILHA", Integer, ForeignKey("trilha.ID_TRILHA"), nullable=False
    )
    titulo = Column("TITULO", String(255), nullable=False)
    # Conteúdo textual da aula (bullet points separados por quebra de linha).
    # Usado pela tela de conteúdo do app (aulas.dart).
    conteudo_video = Column("CONTEUDO_VIDEO", Text, nullable=False)
    # Caminho/nome do arquivo de áudio (ex: audioAula1.mp3).
    conteudo_audio = Column("CONTEUDO_AUDIO", Text, nullable=True)
    recompensa_moedas_max = Column(
        "RECOMPENSA_MOEDAS_MAX", Integer, nullable=False, default=30
    )
    ordem = Column("ORDEM", Integer, nullable=False)
    url_imagem = Column("URL_IMAGEM", String(500), nullable=True)

    trilha = relationship("Trilha", back_populates="licoes")
    perguntas = relationship(
        "Pergunta",
        back_populates="licao",
        cascade="all, delete-orphan",
        order_by="Pergunta.id_pergunta",
    )


class Pergunta(Base):
    __tablename__ = "pergunta"

    id_pergunta = Column("ID_PERGUNTA", Integer, primary_key=True, autoincrement=True)
    id_licao = Column(
        "ID_LICAO", Integer, ForeignKey("licao.ID_LICAO"), nullable=False
    )
    enunciado = Column("ENUNCIADO", Text, nullable=False)
    explicacao_feedback = Column("EXPLICACAO_FEEDBACK", Text, nullable=True)

    licao = relationship("Licao", back_populates="perguntas")
    alternativas = relationship(
        "Alternativa",
        back_populates="pergunta",
        cascade="all, delete-orphan",
        order_by="Alternativa.id_alternativa",
    )


class Alternativa(Base):
    __tablename__ = "alternativa"

    id_alternativa = Column(
        "ID_ALTERNATIVA", Integer, primary_key=True, autoincrement=True
    )
    id_pergunta = Column(
        "ID_PERGUNTA", Integer, ForeignKey("pergunta.ID_PERGUNTA"), nullable=False
    )
    texto = Column("TEXTO", Text, nullable=False)
    eh_correta = Column("EH_CORRETA", Boolean, default=False)

    pergunta = relationship("Pergunta", back_populates="alternativas")


class ProgressoLicao(Base):
    __tablename__ = "progresso_licao"
    __table_args__ = (
        UniqueConstraint("ID_ALUNO", "ID_LICAO", name="UNQ_ALUNO_LICAO"),
        # Índice para a métrica de atividade dos últimos 15 dias e filtros por data.
        Index("ix_progresso_conclusao", "DATA_CONCLUSAO"),
    )

    id_progresso = Column(
        "ID_PROGRESSO", Integer, primary_key=True, autoincrement=True
    )
    id_aluno = Column(
        "ID_ALUNO", Integer, ForeignKey("usuario.ID_USUARIO"), nullable=False
    )
    id_licao = Column(
        "ID_LICAO", Integer, ForeignKey("licao.ID_LICAO"), nullable=False
    )
    qtd_acertos = Column("QTD_ACERTOS", Integer, default=0)
    status_aprovacao = Column("STATUS_APROVACAO", Boolean, default=False)
    data_conclusao = Column("DATA_CONCLUSAO", DateTime, nullable=True)

    aluno = relationship("Usuario", back_populates="progressos")


class Avatar(Base):
    __tablename__ = "avatar"

    id_avatar = Column("ID_AVATAR", Integer, primary_key=True, autoincrement=True)
    nome = Column("NOME", String(100), nullable=False)
    descricao = Column("DESCRICAO", String(255), nullable=True)
    url_imagem = Column("URL_IMAGEM", String(500), nullable=False)
    ordem = Column("ORDEM", Integer, default=0)
    ativo = Column("ATIVO", Boolean, default=True)


class ItemLoja(Base):
    __tablename__ = "item_loja"

    id_item = Column("ID_ITEM", Integer, primary_key=True, autoincrement=True)
    nome = Column("NOME_ITEM", String(100), nullable=False)
    descricao = Column("DESCRICAO", String(255), nullable=True)
    preco = Column("PRECO_SAC_MOEDAS", Integer, nullable=False)
    categoria = Column("CATEGORIA", String(50), nullable=True)
    id_trilha_requerida = Column("REQUISITO_TRILHA", Integer, nullable=True)
    url_imagem = Column("URL_IMAGEM", String(500), nullable=False)
    posicao_z = Column("POSICAO_Z", Integer, nullable=False, default=3)
    ativo = Column("ATIVO", Boolean, default=True)


class ItemComprado(Base):
    __tablename__ = "item_comprado"
    __table_args__ = (UniqueConstraint("ID_USUARIO", "ID_ITEM", name="UNQ_USUARIO_ITEM"),)

    id_compra = Column("ID_COMPRA", Integer, primary_key=True, autoincrement=True)
    id_usuario = Column("ID_USUARIO", Integer, ForeignKey("usuario.ID_USUARIO"), nullable=False)
    id_item = Column("ID_ITEM", Integer, ForeignKey("item_loja.ID_ITEM"), nullable=False)
    equipado = Column("EQUIPADO", Boolean, default=False)
    data_compra = Column("DATA_COMPRA", DateTime, default=datetime.utcnow)


class PerfilAluno(Base):
    __tablename__ = "perfil_aluno"

    id_usuario = Column(
        "ID_USUARIO", Integer, ForeignKey("usuario.ID_USUARIO"), primary_key=True
    )
    id_avatar = Column("ID_AVATAR", Integer, ForeignKey("avatar.ID_AVATAR"), nullable=True)
    avatar_configurado = Column("AVATAR_CONFIGURADO", Boolean, default=False)
