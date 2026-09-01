// ─────────────────────────────────────────────────────────────────────────────
// views/visao-geral.js  —  Tela do Dashboard (Visão Geral)
//
// É a primeira tela que o usuário vê após o login.
// Mostra 4 cartões de métricas, 2 gráficos e um ranking de escolas.
//
// Como funciona:
//   1. Busca as métricas do main process via IPC (getDashboardMetrics)
//   2. Renderiza os cartões de métricas no HTML
//   3. Pede para o módulo Graficos criar os gráficos
//   4. Renderiza a lista de ranking de escolas
// ─────────────────────────────────────────────────────────────────────────────

const VisaoGeralView = (() => {

  // Última métrica buscada na API — reutilizada na troca de tema para
  // redesenhar o gráfico com o valor REAL (nunca um número fixo).
  let ultimasMetricas = null;

  /**
   * Carrega as métricas da Visão Geral, com filtro opcional por escola.
   * Chamada no init (todas) e ao mudar o seletor de escola da página.
   * @param {number|null} escolaId - ID da escola ou null para todas
   * @param {Array} escolas - Lista de escolas para ranking/gráficos
   */
  const carregar = async (escolaId, escolas) => {
    // Busca as métricas calculadas na API (passa escola_id quando filtrado)
    const metricas = await window.electronAPI.getDashboardMetrics(escolaId || null);
    ultimasMetricas = metricas; // cache para reuso (ex.: toggle de tema)

    // Lista usada nos gráficos/ranking: só a escola selecionada, ou todas
    const lista = escolaId
      ? escolas.filter(e => Number(e.id) === Number(escolaId))
      : escolas;

    renderizarMetricas(metricas);  // monta os 4 cartões de número
    renderizarRanking(lista);      // monta a lista de ranking abaixo dos gráficos
    Graficos.atualizar(lista, metricas.avgQuizScore); // cria os dois gráficos
  };

  /**
   * Retorna a última métrica real buscada (null se ainda não carregou).
   */
  const getMetricas = () => ultimasMetricas;

  /**
   * Inicializa a tela. Chamada pelo app.js na inicialização.
   * @param {Array} escolas - Lista de escolas já carregada pelo EscolasView
   */
  const init = async (escolas) => {
    await carregar(null, escolas);
  };

  /**
   * Recarrega a Visão Geral filtrada por uma escola (usada pelo seletor).
   * @param {number|null} escolaId - ID da escola ou null para todas
   * @param {Array} escolas - Lista de escolas
   */
  const carregarComFiltro = (escolaId, escolas) => carregar(escolaId, escolas);

  /**
   * Monta os 4 cartões de métricas no topo da tela.
   * Cada cartão tem: ícone, rótulo, número em destaque e variação.
   * @param {Object} m - Objeto com as métricas (vem do main.js)
   */
  const renderizarMetricas = (m) => {
    const grade = document.getElementById('metrics-grid');
    if (!grade) return;

    // Calcula a porcentagem de alunos ativos nos últimos 15 dias
    const pctAtivos = m.totalStudents > 0
      ? Math.round(m.activeStudents15d / m.totalStudents * 100)
      : 0;

    // Escreve o HTML dos 4 cartões diretamente no elemento
    grade.innerHTML = `
      <div class="metric-card purple">
        <div class="metric-icon purple">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
            <path d="M9 21V12h6v9"/>
          </svg>
        </div>
        <div class="metric-label">Escolas Cadastradas</div>
        <div class="metric-value">${m.totalSchools}</div>
        <div class="metric-delta up">↑ ${m.schoolsGrowth}</div>
      </div>

      <div class="metric-card green">
        <div class="metric-icon green">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </div>
        <div class="metric-label">Total de Alunos</div>
        <div class="metric-value">${m.totalStudents}</div>
        <div class="metric-delta up">↑ ${m.studentsGrowth}</div>
      </div>

      <div class="metric-card amber">
        <div class="metric-icon amber">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 7v5l3 3"/>
          </svg>
        </div>
        <div class="metric-label">Ativos (últimos 15 dias)</div>
        <div class="metric-value">${m.activeStudents15d}</div>
        <div class="metric-sub">${pctAtivos}% do total de alunos</div>
      </div>

      <div class="metric-card teal">
        <div class="metric-icon teal">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
        </div>
        <div class="metric-label">Média de Acertos nos Quizzes</div>
        <div class="metric-value">${m.avgQuizScore}%</div>
      </div>
    `;
  };

  /**
   * Monta a lista de ranking de escolas por número de alunos.
   * Mostra as 5 primeiras com barras de progresso proporcionais.
   * @param {Array} escolas - Lista completa de escolas
   */
  const renderizarRanking = (escolas) => {
    const lista = document.getElementById('ranking-list');
    if (!lista) return;

    // Ordena do maior para o menor número de alunos e pega só as 5 primeiras
    const top5 = [...escolas]
      .sort((a, b) => b.students - a.students)
      .slice(0, 5);

    // Pega o maior valor para calcular as proporções das barras (100% = maior escola)
    const maximo = top5[0]?.students || 1;

    // Classes CSS para as medalhas: ouro, prata, bronze, e "outros" para 4º e 5º
    const classeMedalha = ['gold', 'silver', 'bronze', 'other', 'other'];

    lista.innerHTML = top5.map((escola, i) => `
      <div class="ranking-row">
        <div class="rank-num ${classeMedalha[i]}">${i + 1}</div>
        <div class="rank-name">${escapeHTML(escola.name)}</div>
        <div class="rank-bar-wrap">
          <!-- largura proporcional ao número de alunos da escola líder -->
          <div class="rank-bar" style="width:${Math.round(escola.students / maximo * 100)}%"></div>
        </div>
        <div class="rank-val">${escola.students}</div>
      </div>
    `).join('');
  };

  // Expõe os métodos que o app.js precisa chamar
  return { init, carregarComFiltro, renderizarRanking, getMetricas };

})();

// Alias para compatibilidade com código antigo que usa "OverviewView"
const OverviewView = {
  init:          VisaoGeralView.init,
  loadWithFilter: VisaoGeralView.carregarComFiltro,
  renderRanking: VisaoGeralView.renderizarRanking,
};
