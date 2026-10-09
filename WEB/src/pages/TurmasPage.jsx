import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSchool } from '../context/SchoolContext';
import { api } from '../api/api';

// ── Modal genérico (fora do componente: identidade estável + a11y) ──────────
const FOCUSAVEIS = 'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])';

const ModalShell = ({ titulo, onFechar, children, acao, rotuloBotao, salvandoModal }) => {
  const ref = useRef(null);

  // Foco no primeiro campo do modal ao abrir + FOCUS TRAP: Tab/Shift+Tab
  // ficam presos dentro do diálogo (não escapam para a página de trás).
  useEffect(() => {
    const el = ref.current;
    const foco = el?.querySelector(FOCUSAVEIS);
    foco?.focus();

    const handleTab = (e) => {
      if (e.key !== 'Tab' || !el) return;
      const focaveis = el.querySelectorAll(FOCUSAVEIS);
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === primeiro || document.activeElement === el) {
          e.preventDefault();
          ultimo.focus();
        }
      } else if (document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="bg-white dark:bg-brand-dark-surface rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border dark:border-brand-dark-border">
          <h3 className="font-title text-lg font-bold text-brand-dark dark:text-white">{titulo}</h3>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="text-brand-muted hover:text-brand-dark dark:hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
        {acao && (
          <div className="px-6 py-4 border-t border-brand-border dark:border-brand-dark-border flex justify-end gap-2">
            <button
              onClick={onFechar}
              className="px-4 py-2 rounded-xl border-2 border-brand-border text-brand-muted hover:border-brand-purple hover:text-brand-purple font-semibold"
            >
              Cancelar
            </button>
            <button
              onClick={acao}
              disabled={salvandoModal}
              className="px-5 py-2 rounded-xl bg-brand-purple text-white font-title font-semibold hover:bg-opacity-90 disabled:opacity-60"
            >
              {salvandoModal ? 'Salvando...' : (rotuloBotao || 'Confirmar')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const TurmasPage = () => {
  const { escolaAtual, usuario } = useSchool();
  // REGRA DE OURO DE UI: VISUALIZADOR_ESCOLA não vê ações de CRUD/arquivamento.
  const podeEditar = usuario?.perfil && usuario?.perfil !== 'VISUALIZADOR_ESCOLA';

  const [turmas, setTurmas] = useState([]);
  const [turmasArquivadas, setTurmasArquivadas] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [alunos, setAlunos] = useState({});
  const [carregandoTurmas, setCarregandoTurmas] = useState(true);
  const [carregandoAlunosId, setCarregandoAlunosId] = useState(null);
  const [erro, setErro] = useState('');

  // ── Cadastro simplificado: apenas Série + Ano Letivo ────────────────────────
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [novaSerie, setNovaSerie] = useState('');
  const [novoAno, setNovoAno] = useState(String(new Date().getFullYear()));
  const [salvando, setSalvando] = useState(false);

  // ── Modal de edição da turma (Série, Ano e E-mail) ──────────────────────────
  const [editandoTurma, setEditandoTurma] = useState(null);
  const [editSerie, setEditSerie] = useState('');
  const [editAno, setEditAno] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // ── Modal "Adicionar Alunos" ────────────────────────────────────────────────
  const [addAlunosTurma, setAddAlunosTurma] = useState(null);
  const [disponiveis, setDisponiveis] = useState([]);
  const [selecionadosAdd, setSelecionadosAdd] = useState([]);

  // ── Modal "Excluir Alunos" ──────────────────────────────────────────────────
  const [removerAlunosTurma, setRemoverAlunosTurma] = useState(null);
  const [selecionadosRem, setSelecionadosRem] = useState([]);

  const [salvandoModal, setSalvandoModal] = useState(false);
  const [arquivandoId, setArquivandoId] = useState(null);

  // ── Carregamento ────────────────────────────────────────────────────────────

  const carregarTurmas = useCallback(async () => {
    setCarregandoTurmas(true);
    setErro('');
    try {
      const { data } = await api.turma.listar();
      setTurmas(data);
    } catch {
      setErro('Não foi possível carregar as turmas.');
    } finally {
      setCarregandoTurmas(false);
    }
  }, []);

  const carregarArquivadas = useCallback(async () => {
    try {
      const { data } = await api.turma.listarArquivadas();
      setTurmasArquivadas(data);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => {
    carregarTurmas();
  }, [carregarTurmas]);

  const carregarAlunos = async (turmaId) => {
    setCarregandoAlunosId(turmaId);
    try {
      const { data } = await api.aluno.listarPorTurma(turmaId);
      setAlunos((prev) => ({ ...prev, [turmaId]: data }));
    } finally {
      setCarregandoAlunosId(null);
    }
  };

  // Accordion: clicar na turma expande/recolhe e busca os alunos.
  const toggleTurma = (turmaId) => {
    if (expandedId === turmaId) {
      setExpandedId(null);
    } else {
      setExpandedId(turmaId);
      if (!alunos[turmaId]) carregarAlunos(turmaId);
    }
  };

  // ── Cadastro de turma ───────────────────────────────────────────────────────

  const handleCriarTurma = async (e) => {
    e.preventDefault();
    if (!novaSerie.trim()) {
      setErro('Informe a série da turma (ex: "3º Ano - 2024").');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await api.turma.criar({
        serie: novaSerie.trim(),
        ano_letivo: parseInt(novoAno) || new Date().getFullYear(),
      });
      setMostrarFormulario(false);
      setNovaSerie('');
      await carregarTurmas();
    } catch (err) {
      setErro(err?.response?.data?.detail || 'Erro ao cadastrar a turma.');
    } finally {
      setSalvando(false);
    }
  };

  // ── Edição de turma (email editável) ────────────────────────────────────────

  const abrirEdicao = (turma) => {
    setEditandoTurma(turma);
    setEditSerie(turma.identificador || turma.nome_serie || '');
    setEditAno(String(turma.ano_letivo || ''));
    setEditEmail(turma.email_contato || '');
  };

  const salvarEdicao = async (e) => {
    e.preventDefault();
    if (!editandoTurma) return;
    if (!editSerie.trim()) {
      setErro('Informe a série da turma.');
      return;
    }
    setSalvandoModal(true);
    setErro('');
    try {
      await api.turma.atualizar(editandoTurma.id_turma, {
        serie: editSerie.trim(),
        ano_letivo: parseInt(editAno) || editandoTurma.ano_letivo,
        email_contato: editEmail.trim() || null,
      });
      setEditandoTurma(null);
      await Promise.all([carregarTurmas(), carregarArquivadas()]);
    } catch (err) {
      setErro(err?.response?.data?.detail || 'Erro ao editar a turma.');
    } finally {
      setSalvandoModal(false);
    }
  };

  // ── Arquivar/Desarquivar (com confirmação) ─────────────────────────────────

  const handleArquivarTurma = async (turma) => {
    if (arquivandoId === turma.id_turma) return; // evita duplo clique
    const acao = turma.arquivado ? 'reativar' : 'arquivar';
    const nome = turma.identificador || turma.nome_serie || '';
    if (!window.confirm(`Deseja ${acao} a turma "${nome}"?`)) return;
    setArquivandoId(turma.id_turma);
    try {
      await api.turma.arquivar(turma.id_turma, !turma.arquivado);
      await Promise.all([carregarTurmas(), carregarArquivadas()]);
      setExpandedId(null);
    } catch (err) {
      setErro(err?.response?.data?.detail || 'Erro ao arquivar turma.');
    } finally {
      setArquivandoId(null);
    }
  };

  // ── Adicionar alunos (modal) ────────────────────────────────────────────────

  const abrirModalAddAlunos = async (turma) => {
    setAddAlunosTurma(turma);
    setSelecionadosAdd([]);
    setDisponiveis([]);
    setErro('');
    const escolaId = escolaAtual?.id_escola || usuario?.id_escola;
    if (!escolaId) {
      setErro('Escola não identificada.');
      return;
    }
    try {
      const { data } = await api.escola.usuarios.listar(escolaId);
      const alunosDisponiveis = data.filter(
        (u) => u.perfil === 'ALUNO' && !u.arquivado && u.status_ativo && u.id_turma !== turma.id_turma,
      );
      setDisponiveis(alunosDisponiveis);
    } catch {
      setErro('Não foi possível carregar os alunos da escola.');
    }
  };

  const alternarAdd = (id) => {
    setSelecionadosAdd((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const confirmarAddAlunos = async () => {
    if (!addAlunosTurma || selecionadosAdd.length === 0) return;
    setSalvandoModal(true);
    setErro('');
    const turmaId = addAlunosTurma.id_turma;
    try {
      await api.turma.adicionarAlunos(turmaId, { aluno_ids: selecionadosAdd });
      setAddAlunosTurma(null);
      setSelecionadosAdd([]);
      if (alunos[turmaId]) await carregarAlunos(turmaId);
    } catch (err) {
      setErro(err?.response?.data?.detail || 'Erro ao adicionar alunos.');
    } finally {
      setSalvandoModal(false);
    }
  };

  // ── Excluir alunos (modal) ──────────────────────────────────────────────────

  const abrirModalRemoverAlunos = async (turma) => {
    setRemoverAlunosTurma(turma);
    setSelecionadosRem([]);
    setErro('');
    if (!alunos[turma.id_turma]) await carregarAlunos(turma.id_turma);
  };

  const alternarRem = (id) => {
    setSelecionadosRem((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const confirmarRemoverAlunos = async () => {
    if (!removerAlunosTurma || selecionadosRem.length === 0) return;
    setSalvandoModal(true);
    setErro('');
    const turmaId = removerAlunosTurma.id_turma;
    try {
      await api.turma.removerAlunos(turmaId, { aluno_ids: selecionadosRem });
      setRemoverAlunosTurma(null);
      setSelecionadosRem([]);
      await carregarAlunos(turmaId);
    } catch (err) {
      setErro(err?.response?.data?.detail || 'Erro ao remover alunos.');
    } finally {
      setSalvandoModal(false);
    }
  };

  // ── Edição inline de aluno (dentro da turma) ────────────────────────────────

  const [editandoId, setEditandoId] = useState(null);
  const [editNome, setEditNome] = useState('');

  const iniciarEdicao = (aluno) => {
    setEditandoId(aluno.id_usuario);
    setEditNome(aluno.nome_completo || '');
  };

  const salvarEdicaoAluno = async (aluno) => {
    try {
      await api.aluno.atualizar(aluno.id_usuario, {
        nome_completo: editNome,
      });
      setEditandoId(null);
      await carregarAlunos(aluno.id_turma);
    } catch (err) {
      setErro(err?.response?.data?.detail || 'Erro ao editar aluno.');
    }
  };

  const handleArquivarAluno = async (aluno) => {
    try {
      await api.aluno.arquivar(aluno.id_usuario, !aluno.arquivado);
      await carregarAlunos(aluno.id_turma);
    } catch (err) {
      setErro(err?.response?.data?.detail || 'Erro ao arquivar aluno.');
    }
  };

  // ── Renderização ────────────────────────────────────────────────────────────

  const renderAluno = (aluno) => {
    const arquivado = !!aluno.arquivado;
    const desativado = !aluno.status_ativo;
    const inativo = arquivado || desativado;
    const editando = editandoId === aluno.id_usuario;
    return (
      <div
        key={aluno.id_usuario}
        className={`flex items-center justify-between gap-3 px-4 py-2 rounded-lg ${
          inativo ? 'opacity-50 text-gray-500' : ''
        }`}
      >
        <div className="min-w-0">
          <div className="font-medium truncate">{aluno.nome_completo}</div>
          <div className="text-xs text-gray-400 truncate">
            {aluno.email}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {arquivado && (
            <span className="text-xs font-semibold bg-brand-amber/20 text-brand-amber px-2 py-0.5 rounded-full">
              Arquivado
            </span>
          )}
          {desativado && !arquivado && (
            <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              Inativo
            </span>
          )}

          {podeEditar && editando ? (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <input
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  placeholder="Nome"
                  className="text-sm p-1.5 rounded-lg border-2 border-brand-border dark:bg-brand-dark-input outline-none focus:border-brand-purple"
                />
                <button
                  onClick={() => salvarEdicaoAluno(aluno)}
                  className="text-sm text-brand-green font-semibold hover:underline"
                >
                  Salvar
                </button>
                <button
                  onClick={() => setEditandoId(null)}
                  className="text-sm text-brand-muted hover:underline"
                >
                  Cancelar
                </button>
              </div>
              <span className="text-xs text-brand-muted dark:text-brand-muted-dark">
                Para alterar o e-mail ou o perfil, utilize a página de Usuários.
              </span>
            </div>
          ) : (
            podeEditar && (
              <>
                <button
                  onClick={() => iniciarEdicao(aluno)}
                  className="text-sm text-brand-purple hover:underline font-semibold"
                >
                  Editar
                </button>
                {!desativado && (
                  <button
                    onClick={() => handleArquivarAluno(aluno)}
                    className={`text-sm font-semibold hover:underline ${
                      arquivado ? 'text-brand-green' : 'text-brand-amber'
                    }`}
                  >
                    {arquivado ? 'Desarquivar' : 'Arquivar'}
                  </button>
                )}
              </>
            )
          )}
        </div>
      </div>
    );
  };

  const renderTurma = (turma) => {
    const aberta = expandedId === turma.id_turma;
    const arquivada = !!turma.arquivado;
    const listaAlunos = alunos[turma.id_turma];
    return (
      <div
        key={turma.id_turma}
        className="bg-white dark:bg-brand-dark-surface rounded-2xl shadow-sm border border-brand-border dark:border-brand-dark-border overflow-hidden"
      >
        {/* Cabeçalho clicável (Accordion) + ações */}
        <div
          onClick={() => toggleTurma(turma.id_turma)}
          className="w-full px-5 py-4 hover:bg-brand-beige dark:hover:bg-brand-dark-surface/70 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-title font-bold text-brand-dark dark:text-white flex items-center gap-2 flex-wrap">
                {turma.identificador || `${turma.nome_serie} ${turma.nome_turma}`}
                {arquivada && (
                  <span className="text-xs bg-brand-amber/20 text-brand-amber px-2 py-0.5 rounded-full">
                    Arquivada
                  </span>
                )}
              </div>
              <div className="text-sm text-brand-muted dark:text-brand-muted-dark">
                {turma.nome_serie} · {turma.ano_letivo}
                {turma.email_contato ? ` · ${turma.email_contato}` : ''}
              </div>
            </div>
            <span className={`transition-transform shrink-0 ${aberta ? 'rotate-180' : ''}`}>▾</span>
          </div>

          {/* Ações da turma ativa */}
          {!arquivada && podeEditar && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => abrirEdicao(turma)}
                className="text-sm text-brand-purple hover:underline font-semibold"
              >
                ✏️ Editar
              </button>
              <button
                onClick={() => abrirModalAddAlunos(turma)}
                className="text-sm text-brand-green hover:underline font-semibold"
              >
                + Adicionar Alunos
              </button>
              <button
                onClick={() => abrirModalRemoverAlunos(turma)}
                className="text-sm text-brand-red/80 hover:underline font-semibold"
              >
                − Desvincular da Turma
              </button>
              <button
                onClick={() => handleArquivarTurma(turma)}
                disabled={arquivandoId === turma.id_turma}
                className="text-sm text-brand-amber hover:underline font-semibold disabled:opacity-50"
              >
                {arquivandoId === turma.id_turma ? 'Processando...' : '🗄️ Arquivar Turma'}
              </button>
            </div>
          )}
          {arquivada && podeEditar && (
            <div className="mt-3" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => handleArquivarTurma(turma)}
                disabled={arquivandoId === turma.id_turma}
                className="text-sm text-brand-purple hover:underline font-semibold disabled:opacity-50"
              >
                {arquivandoId === turma.id_turma ? 'Processando...' : '↩️ Desarquivar'}
              </button>
            </div>
          )}
        </div>

        {/* Corpo expandido: alunos */}
        {aberta && (
          <div className="border-t border-brand-border dark:border-brand-dark-border px-4 py-3 space-y-1">
            {carregandoAlunosId === turma.id_turma ? (
              <p className="text-sm text-brand-muted py-2">Carregando alunos...</p>
            ) : !listaAlunos || listaAlunos.length === 0 ? (
              <p className="text-sm text-brand-muted py-2">Nenhum aluno nesta turma.</p>
            ) : (
              listaAlunos.map(renderAluno)
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Modais (componente ModalShell é definido no escopo do módulo, acima) ──

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-3xl font-title font-bold text-brand-dark dark:text-white">
          Gestão de Turmas - {escolaAtual?.nome_instituicao || 'Escola'}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowArchived(!showArchived);
              if (!showArchived) carregarArquivadas();
            }}
            className="bg-brand-amber/20 text-brand-amber px-4 py-2 rounded-xl font-title font-semibold hover:bg-brand-amber/30 transition-all shadow-sm"
          >
            {showArchived ? 'Ocultar Arquivadas' : 'Ver Turmas Arquivadas'}
          </button>
          {podeEditar && (
            <button
              onClick={() => setMostrarFormulario(!mostrarFormulario)}
              className="bg-brand-purple text-white px-6 py-2 rounded-xl font-title hover:bg-opacity-90 transition-all shadow-md"
            >
              {mostrarFormulario ? 'Cancelar' : '+ Nova Turma'}
            </button>
          )}
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm font-body font-semibold rounded-xl p-4">
          {erro}
        </div>
      )}

      {/* Cadastro simplificado: apenas Série + Ano Letivo */}
      {mostrarFormulario && (
        <form onSubmit={handleCriarTurma} className="bg-white dark:bg-brand-dark-surface p-6 rounded-2xl shadow-sm border border-brand-border dark:border-brand-dark-border">
          <h2 className="text-lg font-title font-bold text-brand-purple mb-4">Cadastrar Nova Turma</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Série *</label>
              <input
                type="text"
                value={novaSerie}
                onChange={(e) => setNovaSerie(e.target.value)}
                placeholder="Ex: 3º Ano"
                className="w-full p-3 rounded-xl border-2 border-brand-border dark:bg-brand-dark-input dark:text-white dark:border-brand-dark-border outline-none focus:border-brand-purple"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Ano Letivo *</label>
              <input
                type="number"
                value={novoAno}
                onChange={(e) => setNovoAno(e.target.value)}
                className="w-full p-3 rounded-xl border-2 border-brand-border dark:bg-brand-dark-input dark:text-white dark:border-brand-dark-border outline-none focus:border-brand-purple"
                required
              />
            </div>
          </div>
          <div className="mt-4">
            <button type="submit" disabled={salvando} className="bg-brand-green text-white p-3 rounded-xl font-title font-bold hover:bg-opacity-95 disabled:opacity-60">
              {salvando ? 'Salvando...' : 'Confirmar Cadastro'}
            </button>
          </div>
        </form>
      )}

      {/* Turmas ativas */}
      <div className="space-y-3">
        <h2 className="text-xl font-title font-bold text-brand-dark dark:text-white">Turmas Ativas</h2>
        {carregandoTurmas ? (
          <p className="text-brand-muted font-body">Carregando turmas...</p>
        ) : turmas.length === 0 ? (
          <p className="text-brand-muted font-body">Nenhuma turma cadastrada ainda.</p>
        ) : (
          turmas.map(renderTurma)
        )}
      </div>

      {/* Turmas arquivadas */}
      {showArchived && (
        <div className="space-y-3">
          <h2 className="text-xl font-title font-bold text-brand-dark dark:text-white">Turmas Arquivadas</h2>
          {turmasArquivadas.length === 0 ? (
            <p className="text-brand-muted font-body">Nenhuma turma arquivada.</p>
          ) : (
            turmasArquivadas.map(renderTurma)
          )}
        </div>
      )}

      {/* ── Modal: Editar Turma ── */}
      {editandoTurma && (
        <ModalShell
          titulo="Editar Turma"
          onFechar={() => setEditandoTurma(null)}
          acao={salvarEdicao}
          rotuloBotao="Salvar"
          salvandoModal={salvandoModal}
        >
          <form onSubmit={salvarEdicao} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Série *</label>
              <input
                type="text"
                value={editSerie}
                onChange={(e) => setEditSerie(e.target.value)}
                className="w-full p-3 rounded-xl border-2 border-brand-border dark:bg-brand-dark-input dark:text-white dark:border-brand-dark-border outline-none focus:border-brand-purple"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Ano Letivo</label>
              <input
                type="number"
                value={editAno}
                onChange={(e) => setEditAno(e.target.value)}
                className="w-full p-3 rounded-xl border-2 border-brand-border dark:bg-brand-dark-input dark:text-white dark:border-brand-dark-border outline-none focus:border-brand-purple"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">E-mail de contato</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="contato@turma.com"
                className="w-full p-3 rounded-xl border-2 border-brand-border dark:bg-brand-dark-input dark:text-white dark:border-brand-dark-border outline-none focus:border-brand-purple"
              />
            </div>
          </form>
        </ModalShell>
      )}

      {/* ── Modal: Adicionar Alunos ── */}
      {addAlunosTurma && (
        <ModalShell
          titulo={`Adicionar Alunos — ${addAlunosTurma.identificador || addAlunosTurma.nome_serie}`}
          onFechar={() => setAddAlunosTurma(null)}
          acao={selecionadosAdd.length ? confirmarAddAlunos : null}
          rotuloBotao={`Adicionar (${selecionadosAdd.length})`}
          salvandoModal={salvandoModal}
        >
          {disponiveis.length === 0 ? (
            <p className="text-sm text-brand-muted">Nenhum aluno disponível (todos já estão nesta turma ou não há alunos cadastrados).</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {disponiveis.map((a) => (
                <label key={a.id_usuario} className="flex items-center gap-3 p-2 rounded-lg hover:bg-brand-beige dark:hover:bg-brand-dark-surface/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selecionadosAdd.includes(a.id_usuario)}
                    onChange={() => alternarAdd(a.id_usuario)}
                    className="accent-brand-purple w-4 h-4"
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{a.nome_completo}</div>
                    <div className="text-xs text-gray-400 truncate">{a.email}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </ModalShell>
      )}

      {/* ── Modal: Desvincular Alunos ── */}
      {removerAlunosTurma && (
        <ModalShell
          titulo={`Desvincular da Turma — ${removerAlunosTurma.identificador || removerAlunosTurma.nome_serie}`}
          onFechar={() => setRemoverAlunosTurma(null)}
          acao={selecionadosRem.length ? confirmarRemoverAlunos : null}
          rotuloBotao={`Desvincular (${selecionadosRem.length})`}
          salvandoModal={salvandoModal}
        >
          <p className="text-sm text-brand-muted font-body mb-4">
            Isso removerá o aluno desta turma, mas ele continuará cadastrado no sistema e poderá ser realocado.
          </p>
          {(() => {
            const lista = alunos[removerAlunosTurma.id_turma] || [];
            return lista.length === 0 ? (
              <p className="text-sm text-brand-muted">Esta turma não possui alunos.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {lista.map((a) => (
                  <label key={a.id_usuario} className="flex items-center gap-3 p-2 rounded-lg hover:bg-brand-beige dark:hover:bg-brand-dark-surface/70 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selecionadosRem.includes(a.id_usuario)}
                      onChange={() => alternarRem(a.id_usuario)}
                      className="accent-brand-purple w-4 h-4"
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{a.nome_completo}</div>
                      <div className="text-xs text-gray-400 truncate">{a.email}</div>
                    </div>
                  </label>
                ))}
              </div>
            );
          })()}
        </ModalShell>
      )}
    </div>
  );
};

export default TurmasPage;
