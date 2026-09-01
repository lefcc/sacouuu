import React, { useState, useEffect, useCallback } from 'react';
import { useSchool } from '../context/SchoolContext';
import { api } from '../api/api';
import { formatBRL } from '../utils/formatCurrency';

const DashboardPage = () => {
  const { escolaAtual } = useSchool();
  const idEscola = escolaAtual?.id_escola;

  // ── Filtros reais (disparam nova requisição ao backend) ────────────────────
  const [turmas, setTurmas] = useState([]);
  const [turmaId, setTurmaId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const [stats, setStats] = useState([
    { label: 'Alunos Cadastrados', value: '—' },
    { label: 'Turmas', value: '—' },
  ]);
  const [ranking, setRanking] = useState([]);
  const [desempenho, setDesempenho] = useState({ acertos: 0, erros: 0 });
  const [trilhas, setTrilhas] = useState([]);
  const [financeiro, setFinanceiro] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  // Carrega as turmas da escola para popular o filtro de turma.
  useEffect(() => {
    if (!idEscola) return;
    api.escola.turmas
      .listar(idEscola)
      .then(({ data }) => setTurmas(data))
      .catch(() => setTurmas([]));
  }, [idEscola]);

  // Busca os dados do dashboard no backend com os filtros aplicados.
  const buscarDados = useCallback(async () => {
    if (!idEscola) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro('');
    const params = {};
    if (turmaId) params.turma_id = turmaId;
    if (dataInicio) params.data_inicio = dataInicio;
    if (dataFim) params.data_fim = dataFim;

    try {
      const { data } = await api.escola.dashboard(idEscola, params);
      setStats([
        { label: 'Alunos Cadastrados', value: String(data.qtd_alunos) },
        { label: 'Turmas', value: String(data.qtd_turmas) },
      ]);
      setRanking(data.ranking || []);
      setDesempenho({
        acertos: data.desempenho_acertos || 0,
        erros: data.desempenho_erros || 0,
      });
      setTrilhas(data.trilhas || []);
      setFinanceiro(data.financeiro || null);
    } catch {
      setErro('Não foi possível carregar os dados do dashboard.');
    } finally {
      setCarregando(false);
    }
  }, [idEscola, turmaId, dataInicio, dataFim]);

  // Ao alterar qualquer filtro, dispara uma NOVA requisição com os query params.
  useEffect(() => {
    buscarDados();
  }, [buscarDados]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-3xl font-title font-bold text-brand-dark dark:text-white">
          Dashboard - {escolaAtual?.nome_instituicao || 'Escola'}
        </h1>
      </div>

      {/* Filtros reais (Turma + Período) */}
      <div className="bg-white dark:bg-brand-dark-surface p-5 rounded-2xl shadow-sm border border-brand-border dark:border-brand-dark-border flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1">Turma</label>
          <select
            value={turmaId}
            onChange={(e) => setTurmaId(e.target.value)}
            className="p-3 rounded-xl border-2 border-brand-border dark:bg-brand-dark-input dark:text-white outline-none focus:border-brand-purple font-body min-w-44"
          >
            <option value="">Todas as Turmas</option>
            {turmas.map((t) => (
              <option key={t.id_turma} value={t.id_turma}>
                {t.identificador || `${t.nome_serie} ${t.nome_turma}`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">De</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="p-3 rounded-xl border-2 border-brand-border dark:bg-brand-dark-input dark:text-white outline-none focus:border-brand-purple font-body"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Até</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="p-3 rounded-xl border-2 border-brand-border dark:bg-brand-dark-input dark:text-white outline-none focus:border-brand-purple font-body"
          />
        </div>
        <span className="text-xs text-brand-muted font-body">
          Os gráficos e números atualizam com os dados reais do backend.
        </span>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm font-body font-semibold rounded-xl p-4">
          {erro}
        </div>
      )}

      {/* Estado de carregamento */}
      {carregando ? (
        <div className="bg-white dark:bg-brand-dark-surface p-10 rounded-2xl shadow-sm border border-brand-border dark:border-brand-dark-border text-center text-brand-muted font-body">
          Carregando dados do dashboard...
        </div>
      ) : (
        <>
          {/* Visão Geral — Cards de Métricas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white dark:bg-brand-dark-surface p-6 rounded-2xl shadow-sm border border-brand-border dark:border-brand-dark-border">
                <h3 className="text-brand-muted dark:text-brand-muted-dark font-body text-sm font-semibold">{stat.label}</h3>
                <p className="text-4xl font-title font-bold text-brand-purple mt-2">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Desempenho Médio + Conclusão das Trilhas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Desempenho Médio (Quiz) */}
            <div className="bg-white dark:bg-brand-dark-surface p-8 rounded-2xl shadow-sm border border-brand-border dark:border-brand-dark-border">
              <h2 className="text-xl font-title font-bold text-brand-dark dark:text-white mb-6">Desempenho Médio (Quiz)</h2>
              {desempenho.acertos === 0 && desempenho.erros === 0 ? (
                <p className="text-brand-muted font-body">Sem dados de desempenho no período selecionado.</p>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <div className="w-full h-8 flex rounded-full overflow-hidden mb-6 shadow-inner">
                    <div
                      style={{ width: `${desempenho.acertos}%` }}
                      className="bg-brand-green flex items-center justify-center text-white text-xs font-bold transition-all duration-1000"
                    >
                      {desempenho.acertos}%
                    </div>
                    <div
                      style={{ width: `${desempenho.erros}%` }}
                      className="bg-red-400 flex items-center justify-center text-white text-xs font-bold transition-all duration-1000"
                    >
                      {desempenho.erros}%
                    </div>
                  </div>
                  <div className="flex gap-8 mt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-brand-green"></div>
                      <span className="font-body text-sm dark:text-brand-muted-dark">Acertos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-red-400"></div>
                      <span className="font-body text-sm dark:text-brand-muted-dark">Erros</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Conclusão das Trilhas */}
            <div className="bg-white dark:bg-brand-dark-surface p-8 rounded-2xl shadow-sm border border-brand-border dark:border-brand-dark-border">
              <h2 className="text-xl font-title font-bold text-brand-dark dark:text-white mb-6">Conclusão das Trilhas</h2>
              {trilhas.length === 0 ? (
                <p className="text-brand-muted font-body">Sem dados de conclusão no período selecionado.</p>
              ) : (
                <div className="space-y-6">
                  {trilhas.map((trilha) => (
                    <div key={trilha.id_trilha}>
                      <div className="flex justify-between mb-2">
                        <span className="font-body font-semibold text-brand-dark dark:text-white">{trilha.nome}</span>
                        <span className="font-body text-sm text-brand-muted dark:text-brand-muted-dark">
                          {trilha.sem_conteudo ? 'Sem conteúdo disponível' : `${trilha.progresso}%`}
                        </span>
                      </div>
                      {trilha.sem_conteudo ? (
                        <div className="w-full bg-brand-border dark:bg-brand-dark-border rounded-full h-3 opacity-50"></div>
                      ) : (
                        <div className="w-full bg-brand-border dark:bg-brand-dark-border rounded-full h-3">
                          <div
                            className="bg-brand-purple h-3 rounded-full transition-all duration-1000"
                            style={{ width: `${trilha.progresso}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Evolução Financeira */}
          {financeiro && (
            <div className="bg-white dark:bg-brand-dark-surface p-6 rounded-2xl shadow-sm border border-brand-border dark:border-brand-dark-border">
              <h2 className="text-xl font-title font-bold text-brand-dark dark:text-white mb-4">Evolução Financeira</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <h4 className="text-brand-muted dark:text-brand-muted-dark font-body text-sm font-semibold">Total Faturado</h4>
                  <p className="text-2xl font-title font-bold text-brand-purple">{formatBRL(financeiro.total_faturado)}</p>
                </div>
                <div>
                  <h4 className="text-brand-muted dark:text-brand-muted-dark font-body text-sm font-semibold">Faturas Pagas</h4>
                  <p className="text-2xl font-title font-bold text-brand-green">{financeiro.faturas_pagas}</p>
                </div>
                <div>
                  <h4 className="text-brand-muted dark:text-brand-muted-dark font-body text-sm font-semibold">Em Aberto</h4>
                  <p className="text-2xl font-title font-bold text-brand-amber">{financeiro.faturas_em_aberto}</p>
                </div>
                <div>
                  <h4 className="text-brand-muted dark:text-brand-muted-dark font-body text-sm font-semibold">Total em Aberto</h4>
                  <p className="text-2xl font-title font-bold text-brand-red/80">{formatBRL(financeiro.total_em_aberto)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Ranking Top 10 */}
          <div className="bg-white dark:bg-brand-dark-surface p-6 rounded-2xl shadow-sm border border-brand-border dark:border-brand-dark-border">
            <h3 className="text-brand-dark dark:text-white font-title text-xl font-bold mb-4">Ranking Top 10 - Maior Saldo de Moedas</h3>
            {ranking.length === 0 ? (
              <p className="text-brand-muted font-body">Nenhum aluno com moedas registradas no período.</p>
            ) : (
              <div className="space-y-3">
                {ranking.map((aluno, index) => (
                  <div key={aluno.id_usuario} className="flex justify-between items-center p-3 bg-brand-beige dark:bg-brand-dark-surface/80 rounded-xl">
                    <span className="font-body font-semibold text-brand-dark dark:text-white">
                      #{index + 1} {aluno.nickname || `Aluno ${aluno.id_usuario}`}
                    </span>
                    <span className="font-title font-bold text-brand-green">🪙 {aluno.moedas_total} Moedas</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardPage;
