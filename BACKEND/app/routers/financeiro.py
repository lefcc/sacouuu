"""Gestão Financeira SaaS (Desktop).

Cobrança por Setup + Alunos Ativos, sem integração bancária — o status da
fatura é atualizado manualmente.

Endpoints:
- `POST  /financeiro/contratos`              → cria/atualiza o contrato da escola
- `GET   /financeiro/contratos`              → lista contratos (filtro por escola)
- `POST  /financeiro/contratos/{id}/upload`  → anexa PDF/imagem do contrato
- `GET   /financeiro/contratos/{id}/arquivos`→ lista arquivos anexados
- `GET   /financeiro/contratos/arquivos/{id}/download` → baixa o arquivo
- `DELETE /financeiro/contratos/arquivos/{id}` → remove registro + arquivo físico
- `POST  /financeiro/faturas/gerar`          → calcula e gera a fatura do mês
- `GET   /financeiro/faturas`                → lista faturas (filtro por escola)
- `PATCH /financeiro/faturas/{id}`           → altera o status (PAGO/EM_ABERTO)

Regra de cálculo (SaaS):
`Total = Contrato.valor_setup (se primeira fatura da escola) + (qtd_alunos_ativos * Contrato.valor_por_aluno)`
"""

import os
import re
from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import PERFIS_ESCOLA, require_role
from ..schemas import (
    ArquivoContratoOut,
    ContratoIn,
    ContratoOut,
    ContratoUpdate,
    FaturaGerar,
    FaturaOut,
    FaturaStatusUpdate,
)

router = APIRouter(prefix="/financeiro", tags=["Gestão Financeira SaaS"])

# Apenas DEV e GESTOR_PLATAFORMA gerenciam contratos/faturas.
plataforma = require_role("DEV", "GESTOR_PLATAFORMA")

# Leitura de faturas: plataforma (todas) ou gestor/visualizador (apenas a própria escola).
financeiro_leitura = require_role("DEV", "GESTOR_PLATAFORMA", "ADMIN_ESCOLA", "VISUALIZADOR_ESCOLA")

STATUS_FATURA_VALIDOS = ("PAGO", "EM_ABERTO")

_MES_REFERENCIA = re.compile(r"^\d{4}-\d{2}$")

# Arquivos de contrato aceitos: PDF ou imagens (PNG/JPG).
EXTENSOES_CONTRATO = {".pdf", ".png", ".jpg", ".jpeg"}
# Pasta raiz dos uploads de contrato: BACKEND/uploads/contratos/
UPLOADS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "contratos"
)


def _validar_mes_referencia(mes: str) -> datetime:
    """Valida o formato 'YYYY-MM' e devolve o primeiro dia do mês."""
    if not _MES_REFERENCIA.match(mes):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="mes_referencia deve estar no formato YYYY-MM (ex.: 2026-08).",
        )
    try:
        return datetime.strptime(mes, "%Y-%m")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mês de referência inválido.",
        )


def _calcular_vencimento(mes_referencia: str) -> datetime:
    """Vencimento: dia 10 do mês seguinte ao de referência (ex.: 2026-08 → 2026-09-10)."""
    primeiro_dia = _validar_mes_referencia(mes_referencia)
    mes_seguinte = primeiro_dia + timedelta(days=32)
    return mes_seguinte.replace(day=10)


def _contar_alunos_ativos(db: Session, escola_id: int) -> int:
    """Conta alunos ativos da escola: perfil ALUNO, da escola e não arquivado."""
    return (
        db.query(models.Usuario)
        .filter(
            models.Usuario.escola_id == escola_id,
            models.Usuario.perfil == "ALUNO",
            models.Usuario.arquivado == False,  # noqa: E712  # arquivado = 0
        )
        .count()
    )


def _serializar_contrato(c: models.Contrato) -> ContratoOut:
    # Colunas Numeric já vêm como Decimal — passa direto (sem float).
    return ContratoOut(
        id_contrato=c.id_contrato,
        escola_id=c.id_escola,
        valor_setup=c.valor_setup,
        valor_por_aluno=c.valor_por_aluno,
        ativo=bool(c.ativo),
    )


def _serializar_fatura(f: models.Fatura, qtd_alunos: int = 0) -> FaturaOut:
    return FaturaOut(
        id_fatura=f.id_fatura,
        escola_id=f.id_escola,
        mes_referencia=f.mes_referencia,
        valor_total=f.valor_total,
        status=f.status,
        data_vencimento=f.data_vencimento.isoformat() if f.data_vencimento else None,
        qtd_alunos=qtd_alunos,
    )


def _serializar_arquivo(a: models.ArquivoContrato) -> ArquivoContratoOut:
    return ArquivoContratoOut(
        id_arquivo=a.id_arquivo,
        escola_id=a.id_escola,
        nome_original=a.nome_original,
        caminho_arquivo=a.caminho_arquivo,
        data_upload=a.data_upload.isoformat() if a.data_upload else None,
    )


def _magic_valido(conteudo: bytes, ext: str) -> bool:
    """Valida o 'magic number' do arquivo contra a extensão informada."""
    if ext == ".pdf":
        return conteudo[:4] == b"%PDF"
    if ext == ".png":
        return conteudo[:4] == b"\x89PNG"
    if ext in (".jpg", ".jpeg"):
        return conteudo[:3] == b"\xff\xd8\xff"
    return False


def _sanitizar_nome(nome: str) -> str:
    """Remove caracteres inseguros do nome do arquivo e limita o tamanho."""
    base = os.path.splitext(nome or "arquivo")[0]
    base = re.sub(r"[^A-Za-z0-9_.\- ]", "_", base).strip(" _")
    return (base[:60] or "arquivo").replace(" ", "_")


def _nome_escola(db: Session, escola_id: int) -> str | None:
    escola = db.get(models.Escola, escola_id)
    return escola.nome_instituicao if escola else None


@router.get("/resumo")
def resumo_financeiro(
    escola_id: int | None = None,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(plataforma),
):
    """Resumo financeiro (contratos + faturas), com filtro opcional por escola.

    - `?escola_id=X` → apenas contratos/faturas da escola X.
    - Sem `escola_id` (ou 'todas') → todos os contratos e faturas.
    """
    contratos_q = db.query(models.Contrato)
    faturas_q = db.query(models.Fatura)
    if escola_id:
        contratos_q = contratos_q.filter(models.Contrato.id_escola == escola_id)
        faturas_q = faturas_q.filter(models.Fatura.id_escola == escola_id)

    contratos = contratos_q.order_by(models.Contrato.id_escola).all()
    faturas = faturas_q.order_by(models.Fatura.mes_referencia.desc()).all()

    contratos_out = []
    for c in contratos:
        item = _serializar_contrato(c).model_dump()
        item["escola_nome"] = _nome_escola(db, c.id_escola)
        contratos_out.append(item)

    faturas_out = []
    for f in faturas:
        item = _serializar_fatura(f).model_dump()
        item["escola_nome"] = _nome_escola(db, f.id_escola)
        faturas_out.append(item)

    return {"contratos": contratos_out, "faturas": faturas_out}


@router.post("/contratos", response_model=ContratoOut)
def salvar_contrato(
    dados: ContratoIn,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(plataforma),
):
    """Cria ou atualiza o contrato da escola (um por escola)."""
    if not db.get(models.Escola, dados.escola_id):
        raise HTTPException(status_code=404, detail="Escola não encontrada.")

    contrato = (
        db.query(models.Contrato)
        .filter(models.Contrato.id_escola == dados.escola_id)
        .first()
    )

    if contrato:
        contrato.valor_setup = dados.valor_setup
        contrato.valor_por_aluno = dados.valor_por_aluno
        contrato.ativo = dados.ativo
    else:
        contrato = models.Contrato(
            id_escola=dados.escola_id,
            valor_setup=dados.valor_setup,
            valor_por_aluno=dados.valor_por_aluno,
            ativo=dados.ativo,
        )
        db.add(contrato)

    db.commit()
    db.refresh(contrato)
    return _serializar_contrato(contrato)


@router.put("/contratos/{escola_id}", response_model=ContratoOut)
def atualizar_contrato(
    escola_id: int,
    dados: ContratoUpdate,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(plataforma),
):
    """Atualiza os valores do contrato da escola (PUT /financeiro/contratos/{escola_id})."""
    if not db.get(models.Escola, escola_id):
        raise HTTPException(status_code=404, detail="Escola não encontrada.")

    contrato = (
        db.query(models.Contrato)
        .filter(models.Contrato.id_escola == escola_id)
        .first()
    )
    if not contrato:
        raise HTTPException(
            status_code=404,
            detail="Contrato não encontrado. Crie o contrato antes de atualizá-lo.",
        )

    contrato.valor_setup = dados.valor_setup
    contrato.valor_por_aluno = dados.valor_por_aluno
    contrato.ativo = dados.ativo
    db.commit()
    db.refresh(contrato)
    return _serializar_contrato(contrato)


@router.get("/contratos", response_model=list[ContratoOut])
def listar_contratos(
    escola_id: int | None = None,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(financeiro_leitura),
):
    if usuario.perfil in PERFIS_ESCOLA:
        escola_id = usuario.escola_id
        if escola_id is None:
            return []
    stmt = select(models.Contrato)
    if escola_id:
        stmt = stmt.where(models.Contrato.id_escola == escola_id)
    stmt = stmt.order_by(models.Contrato.id_escola)
    contratos = db.execute(stmt).scalars().all()
    return [_serializar_contrato(c) for c in contratos]


@router.get("/contratos/{escola_id}", response_model=ContratoOut | None)
def obter_contrato(
    escola_id: int,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(plataforma),
):
    """Retorna o contrato da escola (valor_setup, valor_por_aluno, ativo).

    Se a escola ainda não tiver contrato, retorna `null` (200) para o front
    abrir um cadastro limpo.
    """
    contrato = (
        db.query(models.Contrato)
        .filter(models.Contrato.id_escola == escola_id)
        .first()
    )
    if not contrato:
        return None
    return _serializar_contrato(contrato)


@router.get("/faturas/preview")
def preview_fatura(
    escola_id: int,
    mes_referencia: str,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(plataforma),
):
    """Calcula a fatura do mês SEM gravar nada (preview antes de confirmar).

    Usa a mesma regra do POST /faturas/gerar: Setup só entra na 1ª fatura,
    depois apenas `alunos_ativos * valor_por_aluno`.
    """
    escola = db.get(models.Escola, escola_id)
    if not escola:
        raise HTTPException(status_code=404, detail="Escola não encontrada.")

    _validar_mes_referencia(mes_referencia)

    contrato = (
        db.query(models.Contrato)
        .filter(models.Contrato.id_escola == escola_id)
        .first()
    )
    if not contrato or not contrato.ativo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Escola sem contrato ativo. Defina o contrato primeiro.",
        )

    qtd_alunos = _contar_alunos_ativos(db, escola_id)

    ja_tem_fatura = (
        db.query(models.Fatura)
        .filter(models.Fatura.id_escola == escola_id)
        .count()
    ) > 0
    # Cálculo com Decimal puro (sem float): colunas Numeric já retornam Decimal.
    valor_setup = Decimal("0") if ja_tem_fatura else contrato.valor_setup
    valor_por_aluno = contrato.valor_por_aluno
    valor_total = valor_setup + (Decimal(qtd_alunos) * valor_por_aluno)

    return {
        "escola_id": escola_id,
        "escola_nome": escola.nome_instituicao,
        "mes_referencia": mes_referencia,
        "qtd_alunos": qtd_alunos,
        "valor_setup": valor_setup,
        "valor_por_aluno": valor_por_aluno,
        "inclui_setup": bool(valor_setup),
        "valor_total": valor_total,
        "ja_existe": bool(
            db.query(models.Fatura)
            .filter(
                models.Fatura.id_escola == escola_id,
                models.Fatura.mes_referencia == mes_referencia,
            )
            .first()
        ),
    }


@router.post("/faturas/gerar", response_model=FaturaOut, status_code=status.HTTP_201_CREATED)
def gerar_fatura(
    dados: FaturaGerar,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(plataforma),
):
    """Calcula e gera a fatura do mês para a escola (status EM_ABERTO)."""
    escola = db.get(models.Escola, dados.escola_id)
    if not escola:
        raise HTTPException(status_code=404, detail="Escola não encontrada.")

    _validar_mes_referencia(dados.mes_referencia)

    contrato = (
        db.query(models.Contrato)
        .filter(models.Contrato.id_escola == dados.escola_id)
        .first()
    )
    if not contrato or not contrato.ativo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Escola sem contrato ativo. Defina o contrato primeiro.",
        )

    ja_existe = (
        db.query(models.Fatura)
        .filter(
            models.Fatura.id_escola == dados.escola_id,
            models.Fatura.mes_referencia == dados.mes_referencia,
        )
        .first()
    )
    if ja_existe:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Já existe fatura para {dados.mes_referencia}.",
        )

    qtd_alunos = _contar_alunos_ativos(db, dados.escola_id)

    # Setup entra apenas na primeira fatura da escola (primeiro mês).
    ja_tem_fatura = (
        db.query(models.Fatura)
        .filter(models.Fatura.id_escola == dados.escola_id)
        .count()
    ) > 0
    valor_setup = Decimal("0") if ja_tem_fatura else contrato.valor_setup
    valor_por_aluno = contrato.valor_por_aluno

    valor_total = valor_setup + (Decimal(qtd_alunos) * valor_por_aluno)

    # Auditoria no console do backend (demonstração).
    print(
        f"[FINANCEIRO] Escola: {dados.escola_id} | Alunos Ativos: {qtd_alunos} "
        f"| Setup: {valor_setup} | Por Aluno: {valor_por_aluno} | Total: {valor_total}"
    )

    fatura = models.Fatura(
        id_escola=dados.escola_id,
        mes_referencia=dados.mes_referencia,
        valor_total=valor_total,
        status="EM_ABERTO",
        data_vencimento=_calcular_vencimento(dados.mes_referencia),
    )
    db.add(fatura)
    db.commit()
    db.refresh(fatura)

    return _serializar_fatura(fatura, qtd_alunos=qtd_alunos)


@router.get("/faturas", response_model=list[FaturaOut])
def listar_faturas(
    escola_id: int | None = None,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(financeiro_leitura),
):
    if usuario.perfil in PERFIS_ESCOLA:
        escola_id = usuario.escola_id
        if escola_id is None:
            return []
    stmt = select(models.Fatura)
    if escola_id:
        stmt = stmt.where(models.Fatura.id_escola == escola_id)
    stmt = stmt.order_by(models.Fatura.mes_referencia.desc())
    faturas = db.execute(stmt).scalars().all()
    return [_serializar_fatura(f) for f in faturas]


@router.patch("/faturas/{fatura_id}", response_model=FaturaOut)
def atualizar_status_fatura(
    fatura_id: int,
    dados: FaturaStatusUpdate,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(plataforma),
):
    """Altera manualmente o status da fatura (sem integração bancária)."""
    if dados.status not in STATUS_FATURA_VALIDOS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status inválido. Use 'PAGO' ou 'EM_ABERTO'.",
        )

    fatura = db.get(models.Fatura, fatura_id)
    if not fatura:
        raise HTTPException(status_code=404, detail="Fatura não encontrada.")

    fatura.status = dados.status
    db.commit()
    db.refresh(fatura)
    return _serializar_fatura(fatura)


# ── ARQUIVOS DE CONTRATO (Documentos do Contrato) ─────────────────────────────

@router.post("/contratos/{escola_id}/upload", response_model=ArquivoContratoOut, status_code=status.HTTP_201_CREATED)
async def upload_arquivo_contrato(
    escola_id: int,
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(plataforma),
):
    """Anexa um PDF/imagem do contrato físico da escola.

    Valida extensão + conteúdo, salva em `uploads/contratos/{escola_id}/`
    e registra na tabela `arquivo_contrato`.
    """
    if not db.get(models.Escola, escola_id):
        raise HTTPException(status_code=404, detail="Escola não encontrada.")

    nome_original = arquivo.filename or "arquivo.pdf"
    ext = os.path.splitext(nome_original)[1].lower()
    if ext not in EXTENSOES_CONTRATO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato inválido. Envie um PDF, PNG ou JPG.",
        )

    conteudo = await arquivo.read()
    if not _magic_valido(conteudo, ext):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O conteúdo do arquivo não corresponde a um PDF ou imagem válida.",
        )

    pasta = os.path.join(UPLOADS_DIR, str(escola_id))
    os.makedirs(pasta, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nome_fisico = f"{_sanitizar_nome(nome_original)}_{timestamp}{ext}"
    caminho = os.path.join(pasta, nome_fisico)

    with open(caminho, "wb") as f:
        f.write(conteudo)

    registro = models.ArquivoContrato(
        id_escola=escola_id,
        nome_original=nome_original,
        caminho_arquivo=caminho,
    )
    db.add(registro)
    db.commit()
    db.refresh(registro)
    return _serializar_arquivo(registro)


@router.get("/contratos/{escola_id}/arquivos", response_model=list[ArquivoContratoOut])
def listar_arquivos_contrato(
    escola_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(financeiro_leitura),
):
    """Lista os arquivos de contrato anexados à escola (mais recentes primeiro)."""
    if usuario.perfil in PERFIS_ESCOLA:
        escola_id = usuario.escola_id
        if escola_id is None:
            return []
    if not db.get(models.Escola, escola_id):
        raise HTTPException(status_code=404, detail="Escola não encontrada.")

    registros = (
        db.query(models.ArquivoContrato)
        .filter(models.ArquivoContrato.id_escola == escola_id)
        .order_by(models.ArquivoContrato.data_upload.desc())
        .all()
    )
    return [_serializar_arquivo(a) for a in registros]


@router.get("/contratos/arquivos/{arquivo_id}/download")
def baixar_arquivo_contrato(
    arquivo_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(financeiro_leitura),
):
    """Serve o arquivo físico com o nome original para o frontend baixar/abrir."""
    registro = db.get(models.ArquivoContrato, arquivo_id)
    if not registro:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")
    if usuario.perfil in PERFIS_ESCOLA and registro.id_escola != usuario.escola_id:
        raise HTTPException(
            status_code=403, detail="Acesso negado: dados de outra escola."
        )
    if not os.path.exists(registro.caminho_arquivo):
        raise HTTPException(
            status_code=404, detail="Arquivo físico não encontrado no servidor."
        )
    return FileResponse(
        registro.caminho_arquivo,
        filename=registro.nome_original,
        media_type="application/pdf",
    )


@router.delete("/contratos/arquivos/{arquivo_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_arquivo_contrato(
    arquivo_id: int,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(plataforma),
):
    """Remove o registro do banco e apaga o arquivo físico da pasta de uploads."""
    registro = db.get(models.ArquivoContrato, arquivo_id)
    if not registro:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")

    caminho = registro.caminho_arquivo
    db.delete(registro)
    db.commit()

    if caminho and os.path.exists(caminho):
        try:
            os.remove(caminho)
            # Remove a pasta da escola se ficou vazia (mantém a árvore limpa).
            pasta = os.path.dirname(caminho)
            if os.path.isdir(pasta) and not os.listdir(pasta):
                os.rmdir(pasta)
        except OSError:
            pass
