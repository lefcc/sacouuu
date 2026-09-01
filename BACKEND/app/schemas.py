from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr


# ── Autenticação ──────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: EmailStr
    senha: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    nova_senha: str


# Mapeia o perfil canônico para o valor legado usado pelo frontend web/mobile.
# DEV e GESTOR_PLATAFORMA aparecem como ADMIN para o web atual.
_PERFIL_LEGADO = {
    "DEV": "ADMIN",
    "GESTOR_PLATAFORMA": "ADMIN",
    "ADMIN_ESCOLA": "COORDENADOR",
    "VISUALIZADOR_ESCOLA": "PROFESSOR",
    "ALUNO": "ALUNO",
}


def perfil_legado(perfil: str) -> str:
    return _PERFIL_LEGADO.get(perfil, perfil)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: "UsuarioResponse"


class UsuarioResponse(BaseModel):
    id_usuario: int
    nome_completo: str
    email: EmailStr
    perfil: str
    tipo_perfil: str
    nickname: Optional[str] = None
    # Moedas/nível existem APENAS para ALUNO. Para outros perfis devem ser
    # None (nunca 0/1 fictícios) — preenchidos em auth._montar_usuario.
    moedas_total: Optional[int] = None
    nivel_atual: Optional[int] = None
    id_escola: Optional[int] = None
    id_turma: Optional[int] = None


# ── Conteúdo (leitura - mobile) ───────────────────────────────────────────────
class AlternativaOut(BaseModel):
    id_alternativa: int
    texto: str
    eh_correta: bool


class PerguntaOut(BaseModel):
    id_pergunta: int
    enunciado: str
    explicacao_feedback: Optional[str] = None
    alternativas: list[AlternativaOut] = []


class LicaoOut(BaseModel):
    id_licao: int
    id_trilha: int
    titulo: str
    conteudo: list[str] = []
    audio_url: Optional[str] = None
    url_imagem: Optional[str] = None
    ordem: int
    perguntas: list[PerguntaOut] = []


class TrilhaOut(BaseModel):
    id_trilha: int
    nome_trilha: str
    licoes: list[LicaoOut] = []


# ── CRUD (escrita - desktop) ──────────────────────────────────────────────────
class AlternativaIn(BaseModel):
    texto: str
    eh_correta: bool = False


class PerguntaIn(BaseModel):
    enunciado: str
    explicacao_feedback: Optional[str] = None
    alternativas: list[AlternativaIn] = []


class LicaoCreate(BaseModel):
    id_trilha: int
    titulo: str
    conteudo_video: str = ""
    conteudo_audio: Optional[str] = None
    url_imagem: Optional[str] = None
    recompensa_moedas_max: int = 30
    ordem: int
    perguntas: list[PerguntaIn] = []


class LicaoUpdate(BaseModel):
    titulo: Optional[str] = None
    conteudo_video: Optional[str] = None
    conteudo_audio: Optional[str] = None
    url_imagem: Optional[str] = None
    recompensa_moedas_max: Optional[int] = None
    ordem: Optional[int] = None


class PerguntaCreate(BaseModel):
    id_licao: int
    enunciado: str
    explicacao_feedback: Optional[str] = None
    alternativas: list[AlternativaIn] = []


class PerguntaUpdate(BaseModel):
    enunciado: Optional[str] = None
    explicacao_feedback: Optional[str] = None
    alternativas: Optional[list[AlternativaIn]] = None


# ── Progresso (mobile) ────────────────────────────────────────────────────────
class ProgressoCreate(BaseModel):
    # O cliente envia APENAS os índices das alternativas selecionadas. A correção
    # (qtd_acertos), a aprovação e a recompensa são calculadas no SERVIDOR com o
    # gabarito do banco — nunca há confiança em acertos vindos do cliente.
    id_licao: int
    respostas_selecionadas: list[int] = []


class ProgressoOut(BaseModel):
    id_licao: int
    qtd_acertos: int
    status_aprovacao: bool
    data_conclusao: Optional[str] = None


class AlunoProgressoOut(BaseModel):
    id_aluno: int
    nickname: Optional[str] = None
    moedas_total: int
    nivel_atual: int
    licoes_concluidas: list[int] = []
    status_aprovacao: Optional[bool] = None


# ── Escolas / Turmas (web) ────────────────────────────────────────────────────
class EscolaCreate(BaseModel):
    cnpj: Optional[str] = None
    # Novo fluxo Desktop: nome da escola + credenciais do coordenador.
    nome_escola: Optional[str] = None
    nome_instituicao: Optional[str] = None  # alias legado (Web atual)
    coordenador_nome: Optional[str] = None
    coordenador_email: Optional[EmailStr] = None
    coordenador_senha: Optional[str] = None


class EscolaUpdate(BaseModel):
    cnpj: Optional[str] = None
    nome_instituicao: Optional[str] = None


class EscolaOut(BaseModel):
    id_escola: int
    codigo: Optional[str] = None
    cnpj: Optional[str] = None
    nome_instituicao: str
    status_ativo: bool
    arquivada: bool = False
    total_coordenadores: int = 0
    total_professores: int = 0


class CoordenadorOut(BaseModel):
    id_usuario: int
    nome_completo: str
    email: EmailStr
    perfil: str
    tipo_perfil: str
    status_ativo: bool
    arquivado: bool = False


class UsuarioEscolaOut(BaseModel):
    id_usuario: int
    nome_completo: str
    email: EmailStr
    perfil: str
    tipo_perfil: str
    status_ativo: bool
    arquivado: bool = False
    id_turma: Optional[int] = None
    nome_turma: Optional[str] = None


class RankingItem(BaseModel):
    id_usuario: int
    nickname: Optional[str] = None
    moedas_total: int


class TrilhaProgressoOut(BaseModel):
    id_trilha: int
    nome: str
    progresso: int  # 0-100 (percentual de conclusão)
    sem_conteudo: bool = False  # True se a trilha não possui aulas com conteúdo real


class FinanceiroResumoOut(BaseModel):
    model_config = ConfigDict(json_encoders={Decimal: str})
    total_faturado: Decimal
    faturas_pagas: int
    faturas_em_aberto: int
    total_em_aberto: Decimal


class DashboardOut(BaseModel):
    qtd_alunos: int
    qtd_professores: int
    qtd_turmas: int
    ranking: list[RankingItem] = []
    desempenho_acertos: int = 0
    desempenho_erros: int = 0
    trilhas: list[TrilhaProgressoOut] = []
    financeiro: Optional[FinanceiroResumoOut] = None


class TurmaCreate(BaseModel):
    id_escola: int
    nome_serie: str
    ano_letivo: int
    nome_turma: str
    identificador: Optional[str] = None


class TurmaOut(BaseModel):
    id_turma: int
    id_escola: int
    nome_serie: str
    ano_letivo: int
    nome_turma: str
    identificador: Optional[str] = None
    email_contato: Optional[str] = None
    arquivado: bool = False


# ── Turmas e Alunos (Bloco 1 — RBAC) ──────────────────────────────────────────
class NovaTurma(BaseModel):
    # Cadastro simplificado: apenas Série (identificador) + Ano Letivo.
    # O escola_id vem do token do coordenador logado (ou é informado por um
    # GESTOR_PLATAFORMA/DEV).
    serie: str  # ex.: "3º Ano - 2024"
    ano_letivo: int
    escola_id: Optional[int] = None  # apenas GESTOR_PLATAFORMA


class TurmaUpdate(BaseModel):
    serie: Optional[str] = None
    identificador: Optional[str] = None
    nome_serie: Optional[str] = None
    nome_turma: Optional[str] = None
    ano_letivo: Optional[int] = None
    email_contato: Optional[str] = None


class AlunosTurmaIn(BaseModel):
    aluno_ids: list[int]


class ArquivarTurma(BaseModel):
    arquivado: bool


class AlunoCreate(BaseModel):
    nome_completo: str
    email: EmailStr
    senha: str
    turma_id: int
    escola_id: Optional[int] = None  # apenas GESTOR_PLATAFORMA


class AlunoOut(BaseModel):
    id_usuario: int
    nome_completo: str
    email: EmailStr
    id_turma: Optional[int] = None
    escola_id: Optional[int] = None
    arquivado: bool = False
    status_ativo: bool = True


class ArquivarAluno(BaseModel):
    arquivado: Optional[bool] = None
    nome_completo: Optional[str] = None


# ── Avatares e Perfil ─────────────────────────────────────────────────────────

class AvatarOut(BaseModel):
    id_avatar: int
    nome: str
    descricao: Optional[str] = None
    url_imagem: str
    ordem: int = 0
    ativo: bool = True

    class Config:
        from_attributes = True


class AvatarCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None
    url_imagem: str
    ordem: int = 0


class AvatarUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    url_imagem: Optional[str] = None
    ordem: Optional[int] = None
    ativo: Optional[bool] = None


class PerfilOut(BaseModel):
    id_usuario: int
    id_avatar: Optional[int] = None
    avatar_configurado: bool = False

    class Config:
        from_attributes = True


class AvatarSelect(BaseModel):
    id_avatar: int


# ── Loja ──────────────────────────────────────────────────────────────────────

class ItemLojaOut(BaseModel):
    id_item: int
    nome: str
    descricao: Optional[str] = None
    url_imagem: str
    preco: int
    categoria: Optional[str] = None
    id_trilha_requerida: Optional[int] = None
    ativo: bool = True

    class Config:
        from_attributes = True


class ItemLojaCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None
    url_imagem: str
    preco: int
    id_trilha_requerida: Optional[int] = None


class ItemLojaUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    url_imagem: Optional[str] = None
    preco: Optional[int] = None
    id_trilha_requerida: Optional[int] = None
    ativo: Optional[bool] = None


class ItemCompradoOut(BaseModel):
    id_item: int
    equipado: bool

    class Config:
        from_attributes = True


class ComprarItem(BaseModel):
    id_item: int


class EquiparItem(BaseModel):
    equipado: bool


# ── Trilhas (CRUD admin) ─────────────────────────────────────────────────────

class TrilhaCreate(BaseModel):
    nome_trilha: str


class TrilhaUpdate(BaseModel):
    nome_trilha: Optional[str] = None


# ── Gestão Financeira SaaS (Desktop) ──────────────────────────────────────────
# Valores monetários SEMPRE como Decimal (precisão exata, nunca float/arredondamento
# IEEE 754). No JSON, serializam como string.

class ContratoIn(BaseModel):
    escola_id: int
    valor_setup: Decimal = Decimal("0")
    valor_por_aluno: Decimal = Decimal("0")
    ativo: bool = True


class ContratoUpdate(BaseModel):
    valor_setup: Decimal = Decimal("0")
    valor_por_aluno: Decimal = Decimal("0")
    ativo: bool = True


class ContratoOut(BaseModel):
    model_config = ConfigDict(json_encoders={Decimal: str})
    id_contrato: int
    escola_id: int
    escola_nome: Optional[str] = None
    valor_setup: Decimal
    valor_por_aluno: Decimal
    ativo: bool


class FaturaGerar(BaseModel):
    escola_id: int
    mes_referencia: str  # ex.: "2026-08"


class FaturaStatusUpdate(BaseModel):
    status: str  # 'PAGO' | 'EM_ABERTO'


class FaturaOut(BaseModel):
    model_config = ConfigDict(json_encoders={Decimal: str})
    id_fatura: int
    escola_id: int
    escola_nome: Optional[str] = None
    mes_referencia: str
    valor_total: Decimal
    status: str
    data_vencimento: Optional[str] = None
    qtd_alunos: int = 0


class ArquivoContratoOut(BaseModel):
    id_arquivo: int
    escola_id: int
    nome_original: str
    caminho_arquivo: str
    data_upload: Optional[str] = None


# ── Personalização (Admin Desktop) ────────────────────────────────────────────

class PersonalizacaoAvatarOut(BaseModel):
    id: int
    nome: str
    descricao: Optional[str] = None
    imagem_path: str
    ordem: int = 0
    ativo: bool = True


class PersonalizacaoAvatarIn(BaseModel):
    nome: str
    descricao: Optional[str] = None
    imagem_path: str
    ordem: int = 0
    ativo: bool = True


class PersonalizacaoItemOut(BaseModel):
    id: int
    nome: str
    descricao: Optional[str] = None
    imagem_path: str
    preco: int
    trilha: Optional[int] = None
    ativo: bool = True


class PersonalizacaoItemIn(BaseModel):
    nome: str
    descricao: Optional[str] = None
    imagem_path: str
    preco: int = 0
    trilha: Optional[int] = None
    ativo: bool = True
