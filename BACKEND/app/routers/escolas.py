from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import (
    require_role,
    garantir_acesso_escola,
    PERFIS_PLATAFORMA,
)
from ..schemas import (
    CoordenadorOut,
    DashboardOut,
    EscolaCreate,
    EscolaOut,
    EscolaUpdate,
    FinanceiroResumoOut,
    RankingItem,
    TrilhaProgressoOut,
    TurmaCreate,
    TurmaOut,
    UsuarioEscolaOut,
    perfil_legado,
)
from ..security import hash_senha

router = APIRouter(prefix="/escolas", tags=["Escolas e Turmas (Web)"])

gestor = require_role("GESTOR_PLATAFORMA", "DEV", "ADMIN_ESCOLA", "VISUALIZADOR_ESCOLA")
criador_plataforma = require_role("GESTOR_PLATAFORMA", "DEV")


class UsuarioEscolaCreate(BaseModel):
    nome_completo: str
    email: EmailStr
    senha: str
    # Perfil canônico (novo): DEV, GESTOR_PLATAFORMA, ADMIN_ESCOLA,
    # VISUALIZADOR_ESCOLA, ALUNO.
    perfil: str | None = None
    # Valor legado aceito pelo web atual: ADMIN, COORDENADOR, PROFESSOR, ALUNO.
    tipo_perfil: str | None = None
    id_escola: int
    id_turma: int | None = None


_TIPO_LEGADO_PARA_PERFIL = {
    "ADMIN": "GESTOR_PLATAFORMA",
    "COORDENADOR": "ADMIN_ESCOLA",
    "PROFESSOR": "VISUALIZADOR_ESCOLA",
    "ALUNO": "ALUNO",
}


def _normalizar_perfil(dados: UsuarioEscolaCreate) -> str:
    if dados.perfil:
        return dados.perfil
    if dados.tipo_perfil:
        return _TIPO_LEGADO_PARA_PERFIL.get(dados.tipo_perfil, dados.tipo_perfil)
    raise HTTPException(status_code=400, detail="Informe o perfil do usuário.")


def _gerar_codigo_escola(db: Session) -> str:
    """Gera o próximo código sequencial da escola (ex.: ESC0001, ESC0002...)."""
    ultimo = db.execute(
        select(models.Escola.codigo)
        .where(models.Escola.codigo.is_not(None))
        .order_by(models.Escola.codigo.desc())
        .limit(1)
    ).scalar()
    if not ultimo:
        return "ESC0001"
    try:
        numero = int(str(ultimo).replace("ESC", "")) + 1
    except ValueError:
        numero = 1
    return f"ESC{numero:04d}"


@router.get("", response_model=list[EscolaOut])
def listar_escolas(
    arquivado: bool = False,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(gestor),
):
    stmt = select(models.Escola)
    if arquivado:
        stmt = stmt.where(models.Escola.data_exclusao.is_not(None))
    else:
        stmt = stmt.where(models.Escola.data_exclusao.is_(None))
    # Isolamento horizontal: perfis de escola só veem a própria escola.
    if usuario.perfil not in PERFIS_PLATAFORMA:
        if usuario.escola_id is None:
            return []
        stmt = stmt.where(models.Escola.id_escola == usuario.escola_id)
    # Ordenação estritamente alfabética pelo nome da escola.
    stmt = stmt.order_by(models.Escola.nome_instituicao.asc())
    escolas = db.execute(stmt).scalars().all()

    # Contagem de coordenadores ativos (ADMIN_ESCOLA, não arquivado) por escola.
    coord_rows = db.execute(
        select(
            models.Usuario.escola_id,
            func.count(models.Usuario.id_usuario),
        )
        .where(
            models.Usuario.perfil == "ADMIN_ESCOLA",
            models.Usuario.arquivado.is_(False),
            models.Usuario.escola_id.is_not(None),
        )
        .group_by(models.Usuario.escola_id)
    ).all()
    coord_por_escola = dict(coord_rows)

    # Contagem de professores ativos (VISUALIZADOR_ESCOLA, não arquivado) por escola.
    prof_rows = db.execute(
        select(
            models.Usuario.escola_id,
            func.count(models.Usuario.id_usuario),
        )
        .where(
            models.Usuario.perfil == "VISUALIZADOR_ESCOLA",
            models.Usuario.arquivado.is_(False),
            models.Usuario.escola_id.is_not(None),
        )
        .group_by(models.Usuario.escola_id)
    ).all()
    prof_por_escola = dict(prof_rows)

    return [
        EscolaOut(
            id_escola=e.id_escola,
            codigo=e.codigo,
            cnpj=e.cnpj,
            nome_instituicao=e.nome_instituicao,
            status_ativo=bool(e.status_ativo),
            arquivada=e.data_exclusao is not None,
            total_coordenadores=coord_por_escola.get(e.id_escola, 0),
            total_professores=prof_por_escola.get(e.id_escola, 0),
        )
        for e in escolas
    ]


@router.post("", response_model=EscolaOut, status_code=status.HTTP_201_CREATED)
def criar_escola(
    dados: EscolaCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(criador_plataforma),
):
    """Cria a escola JUNTO com o coordenador (OBRIGATÓRIO).

    Fluxo Desktop (Super Admin): `nome_escola`, `cnpj`, `coordenador_nome`,
    `coordenador_email`, `coordenador_senha`. A criação é atômica — se qualquer
    passo falhar, faz rollback (nenhuma escola órfã nem usuário solto).
    """
    nome = (dados.nome_escola or dados.nome_instituicao or "").strip()
    if not nome:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Informe o nome da escola.",
        )

    # Coordenador é OBRIGATÓRIO no cadastro da escola.
    if not (dados.coordenador_nome and dados.coordenador_email and dados.coordenador_senha):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O coordenador é obrigatório: informe nome, e-mail e senha.",
        )
    if len(dados.coordenador_senha) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha do coordenador deve ter no mínimo 6 caracteres.",
        )
    if db.query(models.Usuario).filter(models.Usuario.email == dados.coordenador_email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="E-mail do coordenador já cadastrado.",
        )

    try:
        escola = models.Escola(
            cnpj=dados.cnpj,
            nome_instituicao=nome,
            codigo=_gerar_codigo_escola(db),  # código sequencial automático
            id_criador_admin=usuario.id_usuario,
        )
        db.add(escola)
        db.flush()  # gera o id_escola para vincular o coordenador

        coordenador = models.Usuario(
            nome_completo=dados.coordenador_nome,
            email=dados.coordenador_email,
            senha=hash_senha(dados.coordenador_senha),
            perfil="ADMIN_ESCOLA",
            tipo_perfil=perfil_legado("ADMIN_ESCOLA"),
            escola_id=escola.id_escola,
        )
        db.add(coordenador)

        db.commit()  # commit único: escola + coordenador são gravados juntos
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="CNPJ já cadastrado para outra escola.",
        )
    except Exception:
        db.rollback()
        raise

    db.refresh(escola)
    return EscolaOut(
        id_escola=escola.id_escola,
        codigo=escola.codigo,
        cnpj=escola.cnpj,
        nome_instituicao=escola.nome_instituicao,
        status_ativo=bool(escola.status_ativo),
    )


@router.get("/{escola_id}", response_model=EscolaOut)
def obter_escola(
    escola_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(gestor),
):
    garantir_acesso_escola(usuario, escola_id)
    escola = db.get(models.Escola, escola_id)
    if not escola or escola.data_exclusao:
        raise HTTPException(status_code=404, detail="Escola não encontrada.")
    return EscolaOut(
        id_escola=escola.id_escola,
        codigo=escola.codigo,
        cnpj=escola.cnpj,
        nome_instituicao=escola.nome_instituicao,
        status_ativo=bool(escola.status_ativo),
    )


@router.put("/{escola_id}", response_model=EscolaOut)
def atualizar_escola(
    escola_id: int,
    dados: EscolaUpdate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(gestor),
):
    garantir_acesso_escola(usuario, escola_id)
    escola = db.get(models.Escola, escola_id)
    if not escola or escola.data_exclusao:
        raise HTTPException(status_code=404, detail="Escola não encontrada.")
    if dados.nome_instituicao:
        escola.nome_instituicao = dados.nome_instituicao
    if dados.cnpj is not None:
        escola.cnpj = dados.cnpj
    db.commit()
    db.refresh(escola)
    return EscolaOut(
        id_escola=escola.id_escola,
        codigo=escola.codigo,
        cnpj=escola.cnpj,
        nome_instituicao=escola.nome_instituicao,
        status_ativo=bool(escola.status_ativo),
    )


@router.put("/{escola_id}/arquivar")
def arquivar_escola(
    escola_id: int,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(criador_plataforma),
):
    escola = db.get(models.Escola, escola_id)
    if not escola:
        raise HTTPException(status_code=404, detail="Escola não encontrada.")
    if escola.data_exclusao:
        escola.data_exclusao = None
        escola.status_ativo = True
    else:
        from datetime import datetime
        escola.data_exclusao = datetime.utcnow()
        escola.status_ativo = False
    db.commit()
    return {"success": True, "arquivada": escola.data_exclusao is not None}


@router.get("/dashboard/visao-geral")
def visao_geral(
    escola_id: int | None = None,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(gestor),
):
    """Métricas da Visão Geral com filtro opcional por escola.

    - `?escola_id=X` → métricas apenas da escola X.
    - Sem `escola_id` → consolidadas de todas as escolas ativas.
    """
    if escola_id:
        garantir_acesso_escola(usuario, escola_id)
        escola = db.get(models.Escola, escola_id)
        if not escola or escola.data_exclusao:
            raise HTTPException(status_code=404, detail="Escola não encontrada.")
        escolas = [escola]
    else:
        escolas = db.query(models.Escola).filter(models.Escola.data_exclusao.is_(None)).all()
        if usuario.perfil not in PERFIS_PLATAFORMA:
            if usuario.escola_id is None:
                escolas = []
            else:
                escolas = [e for e in escolas if e.id_escola == usuario.escola_id]

    # ── DEBUG (diagnóstico de sincronia) ─────────────────────────────────────
    # Uma escola é considerada "ativa" quando NÃO foi arquivada. No schema,
    # arquivada = DATA_EXCLUSAO preenchido (a coluna ARQUIVADO é o espelho novo,
    # mas a referência de arquivamento é DATA_EXCLUSAO).
    total_geral = db.query(models.Escola).count()
    arquivadas = db.query(models.Escola).filter(
        models.Escola.data_exclusao.is_not(None)
    ).count()
    ativas = total_geral - arquivadas
    print(f"[DASHBOARD] Total de escolas no banco: {total_geral}")
    print(f"[DASHBOARD] Escolas ativas (arquivado=False): {ativas}")
    print(f"[DASHBOARD] Escolas arquivadas: {arquivadas}")
    print(f"[DASHBOARD] Escolas retornadas para a Visão Geral: {len(escolas)}")

    escola_ids = [e.id_escola for e in escolas]

    turma_ids = (
        db.execute(
            select(models.Turma.id_turma).where(models.Turma.id_escola.in_(escola_ids))
        ).scalars().all()
    ) if escola_ids else []

    aluno_rows = (
        db.query(models.Usuario)
        .filter(
            models.Usuario.perfil == "ALUNO",
            models.Usuario.id_turma.in_(turma_ids),
            models.Usuario.data_exclusao.is_(None),
        )
        .with_entities(models.Usuario.id_usuario)
        .all()
    ) if turma_ids else []
    aluno_ids = [r[0] for r in aluno_rows]
    qtd_alunos = len(aluno_ids)

    # Alunos ATIVOS nos últimos 15 dias: DISTINCT de aluno com lição concluída
    # (progresso_licao.data_conclusao) no período, restrito às turmas da escola
    # em escopo. Filtrar por turma/escola primeiro aproveita índices de FK.
    corte_ativos_15d = datetime.utcnow() - timedelta(days=15)
    activeStudents15d = (
        db.query(func.count(func.distinct(models.ProgressoLicao.id_aluno)))
        .join(models.Usuario, models.Usuario.id_usuario == models.ProgressoLicao.id_aluno)
        .filter(
            models.Usuario.id_turma.in_(turma_ids),
            models.Usuario.perfil == "ALUNO",
            models.Usuario.data_exclusao.is_(None),
            models.ProgressoLicao.data_conclusao >= corte_ativos_15d,
        )
        .scalar()
        or 0
    ) if turma_ids else 0

    ranking_rows = (
        db.execute(
            select(models.Usuario.id_usuario, models.Usuario.nickname, models.Usuario.moedas_total)
            .where(
                models.Usuario.perfil == "ALUNO",
                models.Usuario.id_turma.in_(turma_ids),
                models.Usuario.data_exclusao.is_(None),
            )
            .order_by(models.Usuario.moedas_total.desc())
            .limit(10)
        ).all()
    ) if turma_ids else []

    ranking = [
        RankingItem(id_usuario=r.id_usuario, nickname=r.nickname, moedas_total=r.moedas_total or 0)
        for r in ranking_rows
    ]

    # Média real de acertos nos quizzes: soma de acertos / total de questões
    # respondidas, calculada dos alunos da(s) escola(s) em escopo. 0 sem dados.
    avg_quiz_score = 0.0
    if aluno_ids:
        progressos = db.query(models.ProgressoLicao).filter(
            models.ProgressoLicao.id_aluno.in_(aluno_ids)
        ).all()
        if progressos:
            totais_perguntas = dict(
                db.execute(
                    select(models.Pergunta.id_licao, func.count(models.Pergunta.id_pergunta))
                    .group_by(models.Pergunta.id_licao)
                ).all()
            )
            acertos_total = sum(p.qtd_acertos or 0 for p in progressos)
            possivel_total = sum(totais_perguntas.get(p.id_licao) or 3 for p in progressos)
            if possivel_total:
                avg_quiz_score = min(100, round(acertos_total * 100 / possivel_total, 1))

    ativas = sum(1 for e in escolas if e.status_ativo)
    top = ranking[0] if ranking else None

    return {
        "totalSchools": len(escolas),
        "totalStudents": qtd_alunos,
        "activeStudents15d": activeStudents15d,
        "avgQuizScore": avg_quiz_score,
        "schoolsGrowth": f"{ativas} ativa{'s' if ativas != 1 else ''}",
        "studentsGrowth": f"Top: {top.nickname or '—'}" if top else "—",
        "ranking": [
            {"id_usuario": r.id_usuario, "nickname": r.nickname, "moedas_total": r.moedas_total}
            for r in ranking
        ],
    }


@router.get("/{escola_id}/dashboard", response_model=DashboardOut)
def dashboard_escola(
    escola_id: int,
    turma_id: int | None = None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(gestor),
):
    """Dashboard consolidado com filtros REAIS aplicados no backend.

    Query params:
    - `turma_id=X`       → restringe alunos/progresso/ranking à turma.
    - `data_inicio=YYYY-MM-DD` e `data_fim=YYYY-MM-DD` → filtra por período.
    - (o `escola_id` vem do path; GESTOR_PLATAFORMA usa o path também)
    Sem filtros, retorna o consolidado geral da escola.
    """
    garantir_acesso_escola(usuario, escola_id)

    # ── Escopo de turmas ───────────────────────────────────────────────────────
    if turma_id:
        turma = db.get(models.Turma, turma_id)
        if not turma or turma.id_escola != escola_id:
            raise HTTPException(status_code=404, detail="Turma não encontrada.")
        turma_ids = [turma_id]
    else:
        turma_ids = db.execute(
            select(models.Turma.id_turma).where(models.Turma.id_escola == escola_id)
        ).scalars().all()

    def _ini() -> datetime:
        return datetime.combine(data_inicio, datetime.min.time()) if data_inicio else None

    def _fim() -> datetime:
        return datetime.combine(data_fim, datetime.max.time()) if data_fim else None

    # ── Contagens ──────────────────────────────────────────────────────────────
    qtd_turmas = db.query(models.Turma).filter(
        models.Turma.id_escola == escola_id,
        models.Turma.data_exclusao.is_(None),
    ).count()

    qtd_professores = (
        db.query(models.Usuario)
        .filter(
            models.Usuario.perfil == "VISUALIZADOR_ESCOLA",
            models.Usuario.escola_id == escola_id,
        )
        .count()
    )

    qtd_alunos = 0
    aluno_ids = []
    if turma_ids:
        aluno_q = db.query(models.Usuario).filter(
            models.Usuario.perfil == "ALUNO",
            models.Usuario.id_turma.in_(turma_ids),
            models.Usuario.data_exclusao.is_(None),
        )
        if _ini():
            aluno_q = aluno_q.filter(models.Usuario.data_criacao >= _ini())
        if _fim():
            aluno_q = aluno_q.filter(models.Usuario.data_criacao <= _fim())
        qtd_alunos = aluno_q.count()
        aluno_ids = [r[0] for r in aluno_q.with_entities(models.Usuario.id_usuario).all()]

    # ── Ranking (por moedas) ───────────────────────────────────────────────────
    ranking_rows = (
        db.execute(
            select(models.Usuario.id_usuario, models.Usuario.nickname, models.Usuario.moedas_total)
            .where(
                models.Usuario.perfil == "ALUNO",
                models.Usuario.id_turma.in_(turma_ids),
                models.Usuario.data_exclusao.is_(None),
            )
            .order_by(models.Usuario.moedas_total.desc())
            .limit(10)
        ).all()
    ) if turma_ids else []

    # ── Desempenho (quizzes) e progresso por trilha ────────────────────────────
    desempenho_acertos = 0
    desempenho_erros = 0
    trilhas: list[TrilhaProgressoOut] = []

    progressos: list[models.ProgressoLicao] = []

    if aluno_ids:
        prog_q = db.query(models.ProgressoLicao).filter(
            models.ProgressoLicao.id_aluno.in_(aluno_ids)
        )
        if _ini():
            prog_q = prog_q.filter(models.ProgressoLicao.data_conclusao >= _ini())
        if _fim():
            prog_q = prog_q.filter(models.ProgressoLicao.data_conclusao <= _fim())
        progressos = prog_q.all()

    # Progresso médio por trilha — calculado APENAS com aulas que possuem
    # conteúdo real (não-vazias), evitando que aulas de teste/distratores
    # exibam progresso inventado no Dashboard.
    licoes_por_trilha = db.execute(
        select(models.Licao.id_licao, models.Licao.id_trilha).where(
            models.Licao.conteudo_video.isnot(None),
            func.trim(models.Licao.conteudo_video) != "",
        )
    ).all()
    licoes_reais_ids = {lid for lid, _ in licoes_por_trilha}
    licoes_trilha: dict[int, list[int]] = defaultdict(list)
    for lid, tid in licoes_por_trilha:
        licoes_trilha[tid].append(lid)

    progressos_reais = [p for p in progressos if p.id_licao in licoes_reais_ids]

    if progressos_reais:
        totais_perguntas = dict(
            db.execute(
                select(models.Pergunta.id_licao, func.count(models.Pergunta.id_pergunta))
                .group_by(models.Pergunta.id_licao)
            ).all()
        )
        acertos_total = sum(p.qtd_acertos or 0 for p in progressos_reais)
        possivel_total = sum(totais_perguntas.get(p.id_licao) or 3 for p in progressos_reais)
        if possivel_total:
            pct = round(acertos_total * 100 / possivel_total)
            desempenho_acertos = min(100, pct)
            desempenho_erros = 100 - desempenho_acertos

    concluidas_por_licao: dict[int, int] = defaultdict(int)
    for p in progressos_reais:
        if p.status_aprovacao:
            concluidas_por_licao[p.id_licao] += 1

    total_alunos = len(aluno_ids)
    trilhas_db = db.query(models.Trilha).order_by(models.Trilha.id_trilha).all()
    for trilha in trilhas_db:
        licoes = licoes_trilha.get(trilha.id_trilha, [])
        if not licoes:
            trilhas.append(
                TrilhaProgressoOut(
                    id_trilha=trilha.id_trilha,
                    nome=trilha.nome_trilha,
                    progresso=0,
                    sem_conteudo=True,
                )
            )
            continue
        potencial = total_alunos * len(licoes)
        concluidas = sum(concluidas_por_licao.get(lid, 0) for lid in licoes)
        progresso = round(concluidas * 100 / potencial) if potencial else 0
        trilhas.append(
            TrilhaProgressoOut(
                id_trilha=trilha.id_trilha,
                nome=trilha.nome_trilha,
                progresso=min(100, progresso),
                sem_conteudo=False,
            )
        )
    trilhas.sort(key=lambda t: t.nome)

    # ── Financeiro (resumo da escola; período filtra pelas faturas) ────────────
    fat_q = db.query(models.Fatura).filter(models.Fatura.id_escola == escola_id)
    if _ini():
        fat_q = fat_q.filter(models.Fatura.created_at >= _ini())
    if _fim():
        fat_q = fat_q.filter(models.Fatura.created_at <= _fim())
    faturas = fat_q.all()
    financeiro = None
    if faturas:
        # f.valor_total é Decimal (coluna Numeric) — soma exata, sem float.
        financeiro = FinanceiroResumoOut(
            total_faturado=sum((f.valor_total or Decimal("0")) for f in faturas),
            faturas_pagas=sum(1 for f in faturas if f.status == "PAGO"),
            faturas_em_aberto=sum(1 for f in faturas if f.status == "EM_ABERTO"),
            total_em_aberto=sum((f.valor_total or Decimal("0")) for f in faturas if f.status == "EM_ABERTO"),
        )

    return DashboardOut(
        qtd_alunos=qtd_alunos,
        qtd_professores=qtd_professores,
        qtd_turmas=qtd_turmas,
        ranking=[
            RankingItem(id_usuario=r.id_usuario, nickname=r.nickname, moedas_total=r.moedas_total or 0)
            for r in ranking_rows
        ],
        desempenho_acertos=desempenho_acertos,
        desempenho_erros=desempenho_erros,
        trilhas=trilhas,
        financeiro=financeiro,
    )


@router.get("/{escola_id}/usuarios", response_model=list[UsuarioEscolaOut])
def listar_usuarios_escola(
    escola_id: int,
    perfil: str | None = None,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(gestor),
):
    """Lista os usuários da escola, com filtro opcional por perfil.

    - Sem `?perfil=` → retorna todos (coordenadores + professores + alunos).
    - `?perfil=ADMIN_ESCOLA` → apenas coordenadores.
    - `?perfil=VISUALIZADOR_ESCOLA` → apenas professores.
    """
    garantir_acesso_escola(usuario, escola_id)
    resultado: list[UsuarioEscolaOut] = []

    filtro = (
        models.Usuario.escola_id == escola_id,
        models.Usuario.data_exclusao.is_(None),
    )
    if perfil:
        filtro = (*filtro, models.Usuario.perfil == perfil)

    usuarios = (
        db.query(models.Usuario)
        .filter(*filtro)
        .order_by(models.Usuario.nome_completo)
        .all()
    )
    # Mapa único {id_turma: nome} — evita N+1 (db.get por usuário) no loop.
    nomes_turmas = {
        t.id_turma: f"{t.nome_serie} - {t.nome_turma}"
        for t in db.query(models.Turma).filter(models.Turma.id_escola == escola_id).all()
    }
    for u in usuarios:
        nome_turma = nomes_turmas.get(u.id_turma) if u.id_turma else None
        resultado.append(
            UsuarioEscolaOut(
                id_usuario=u.id_usuario,
                nome_completo=u.nome_completo,
                email=u.email,
                perfil=u.perfil,
                tipo_perfil=perfil_legado(u.perfil),
                status_ativo=bool(u.status_ativo),
                arquivado=bool(u.arquivado),
                id_turma=u.id_turma if u.perfil == "ALUNO" else None,
                nome_turma=nome_turma if u.perfil == "ALUNO" else None,
            )
        )

    return resultado


@router.put("/{escola_id}/usuarios/{usuario_id}", response_model=UsuarioEscolaOut)
def alternar_status_usuario(
    escola_id: int,
    usuario_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(gestor),
):
    garantir_acesso_escola(usuario, escola_id)
    alvo = db.get(models.Usuario, usuario_id)
    if not alvo:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    # Isolamento horizontal: o alvo precisa pertencer à mesma escola.
    if alvo.escola_id != escola_id:
        raise HTTPException(status_code=403, detail="Usuário não pertence à escola.")

    # RBAC de hierarquia: Professor (VISUALIZADOR_ESCOLA) só pode desativar/reativar ALUNO.
    if usuario.perfil == "VISUALIZADOR_ESCOLA" and alvo.perfil != "ALUNO":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado: professores só podem desativar alunos.",
        )

    # Blindagem contra lockout (apenas ao DESATIVAR — quando o alvo está ativo).
    if alvo.status_ativo:
        # Regra A — Auto-preservação
        if alvo.id_usuario == usuario.id_usuario:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não pode arquivar/desativar a sua própria conta.",
            )
        # Regra B — Proteção de pares
        if usuario.perfil == "ADMIN_ESCOLA" and alvo.perfil == "ADMIN_ESCOLA":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não pode arquivar outro coordenador.",
            )
        # Regra C — Prevenção de lockout (último coordenador ativo da escola)
        if alvo.perfil == "ADMIN_ESCOLA":
            ativos = db.query(models.Usuario).filter(
                models.Usuario.escola_id == alvo.escola_id,
                models.Usuario.perfil == "ADMIN_ESCOLA",
                models.Usuario.status_ativo == True,
            ).count()
            if ativos <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Não é possível desativar o último coordenador ativo da escola.",
                )

    alvo.status_ativo = not alvo.status_ativo
    db.commit()
    db.refresh(alvo)

    turma = db.get(models.Turma, alvo.id_turma) if alvo.id_turma else None
    return UsuarioEscolaOut(
        id_usuario=alvo.id_usuario,
        nome_completo=alvo.nome_completo,
        email=alvo.email,
        perfil=alvo.perfil,
        tipo_perfil=perfil_legado(alvo.perfil),
        status_ativo=bool(alvo.status_ativo),
        id_turma=alvo.id_turma if alvo.perfil == "ALUNO" else None,
        nome_turma=(
            f"{turma.nome_serie} - {turma.nome_turma}"
            if turma and alvo.perfil == "ALUNO"
            else None
        ),
    )


@router.get("/{escola_id}/coordenadores", response_model=list[CoordenadorOut])
def listar_coordenadores(
    escola_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(gestor),
):
    """Lista os coordenadores (ADMIN_ESCOLA) da escola, ativos e arquivados."""
    garantir_acesso_escola(usuario, escola_id)
    coordenadores = (
        db.query(models.Usuario)
        .filter(
            models.Usuario.escola_id == escola_id,
            models.Usuario.perfil == "ADMIN_ESCOLA",
        )
        .order_by(models.Usuario.nome_completo)
        .all()
    )
    return [
        CoordenadorOut(
            id_usuario=c.id_usuario,
            nome_completo=c.nome_completo,
            email=c.email,
            perfil=c.perfil,
            tipo_perfil=perfil_legado(c.perfil),
            status_ativo=bool(c.status_ativo),
            arquivado=bool(c.arquivado),
        )
        for c in coordenadores
    ]


@router.get("/{escola_id}/turmas", response_model=list[TurmaOut])
def listar_turmas(
    escola_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(gestor),
):
    garantir_acesso_escola(usuario, escola_id)
    turmas = db.execute(
        select(models.Turma)
        .where(models.Turma.id_escola == escola_id)
        .order_by(models.Turma.nome_serie, models.Turma.nome_turma)
    ).scalars().all()
    return [
        TurmaOut(
            id_turma=t.id_turma,
            id_escola=t.id_escola,
            nome_serie=t.nome_serie,
            ano_letivo=t.ano_letivo,
            nome_turma=t.nome_turma,
            identificador=t.identificador,
            arquivado=bool(t.arquivado),
        )
        for t in turmas
    ]


@router.post("/{escola_id}/turmas", response_model=TurmaOut, status_code=status.HTTP_201_CREATED)
def criar_turma(
    escola_id: int,
    dados: TurmaCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(gestor),
):
    garantir_acesso_escola(usuario, escola_id)
    escola = db.get(models.Escola, escola_id)
    if not escola:
        raise HTTPException(status_code=404, detail="Escola não encontrada.")
    turma = models.Turma(
        id_escola=escola_id,
        nome_serie=dados.nome_serie,
        ano_letivo=dados.ano_letivo,
        nome_turma=dados.nome_turma,
        identificador=dados.identificador or f"{dados.nome_serie} {dados.nome_turma}".strip(),
    )
    db.add(turma)
    db.commit()
    db.refresh(turma)
    return TurmaOut(
        id_turma=turma.id_turma,
        id_escola=turma.id_escola,
        nome_serie=turma.nome_serie,
        ano_letivo=turma.ano_letivo,
        nome_turma=turma.nome_turma,
        identificador=turma.identificador,
        arquivado=bool(turma.arquivado),
    )


@router.post("/{escola_id}/usuarios", status_code=status.HTTP_201_CREATED)
def criar_usuario_escola(
    escola_id: int,
    dados: UsuarioEscolaCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(gestor),
):
    garantir_acesso_escola(usuario, escola_id)
    perfil_alvo = _normalizar_perfil(dados)

    # Validação de hierarquia:
    # - GESTOR_PLATAFORMA/DEV criam ADMIN_ESCOLA, VISUALIZADOR_ESCOLA e ALUNO.
    # - ADMIN_ESCOLA cria apenas VISUALIZADOR_ESCOLA ou ALUNO, na própria escola.
    if usuario.perfil in PERFIS_PLATAFORMA:
        if perfil_alvo not in ("ADMIN_ESCOLA", "VISUALIZADOR_ESCOLA", "ALUNO"):
            raise HTTPException(
                status_code=400,
                detail="Perfil inválido: DEV e GESTOR_PLATAFORMA não são criados aqui.",
            )
    elif usuario.perfil == "ADMIN_ESCOLA":
        if perfil_alvo not in ("VISUALIZADOR_ESCOLA", "ALUNO"):
            raise HTTPException(
                status_code=403,
                detail="ADMIN_ESCOLA só pode criar VISUALIZADOR_ESCOLA ou ALUNO.",
            )
        if usuario.escola_id != escola_id:
            raise HTTPException(
                status_code=403,
                detail="ADMIN_ESCOLA só cria usuários na própria escola.",
            )
    else:
        raise HTTPException(status_code=403, detail="Acesso negado para o seu perfil.")

    if db.query(models.Usuario).filter(models.Usuario.email == dados.email).first():
        raise HTTPException(status_code=409, detail="E-mail já cadastrado.")

    if perfil_alvo == "ALUNO":
        # id_turma é OPCIONAL: se enviado, valida e vincula; se ausente (None),
        # o aluno é criado sem turma e pode ser vinculado depois na página de Turmas.
        if dados.id_turma is not None:
            turma = db.get(models.Turma, dados.id_turma)
            if not turma or turma.id_escola != escola_id:
                raise HTTPException(status_code=400, detail="Turma inválida para esta escola.")

    usuario_novo = models.Usuario(
        nome_completo=dados.nome_completo,
        email=dados.email,
        senha=hash_senha(dados.senha),
        perfil=perfil_alvo,
        tipo_perfil=perfil_legado(perfil_alvo),
        escola_id=escola_id,
        id_turma=dados.id_turma if perfil_alvo == "ALUNO" else None,
    )
    db.add(usuario_novo)
    db.commit()
    return {"id_usuario": usuario_novo.id_usuario, "email": usuario_novo.email}
