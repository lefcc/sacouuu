// ─────────────────────────────────────────────────────────────────────────────
// componentes/graficos.js  —  Cuida de todos os gráficos do painel
//
// Usa a biblioteca Chart.js (que já vem carregada no index.html via CDN).
//
// Dois gráficos existem no painel:
//   1. Gráfico de BARRAS → mostra quantos alunos cada escola tem
//   2. Gráfico de ROSCA (donut) → mostra a % média de acertos nos quizzes
//
// A função atualizar() é chamada sempre que o tema (claro/escuro) muda,
// pra recriar os gráficos com as cores certas do novo tema.
// ─────────────────────────────────────────────────────────────────────────────

const Graficos = (() => {

  // Cores fixas para cada escola no gráfico de barras
  // Cada índice corresponde a uma escola diferente — máximo 8 cores
  const CORES_DAS_BARRAS = [
    '#6fb755', '#5f4c9a', '#f5a623', '#4ecdc4',
    '#e05a6a', '#c084fc', '#f97316', '#0ea5e9',
  ];

  // Guarda as instâncias dos gráficos para poder destruí-las antes de recriar
  // (O Chart.js reclama se você tentar usar o mesmo <canvas> duas vezes)
  let instanciaBarra  = null;
  let instanciaRosca  = null;

  /**
   * Lê as cores do tema atual (claro ou escuro) do CSS.
   * Isso garante que os gráficos sempre combinem com o tema da interface.
   */
  const lerCoresDoTema = () => {
    const temaEscuro = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      grade: temaEscuro ? 'rgba(200,180,255,0.08)' : 'rgba(95,76,154,0.08)', // linhas de fundo
      texto: temaEscuro ? '#a090c8'                : '#6b5a8e',               // texto dos eixos
    };
  };

  /**
   * Cria (ou recria) o gráfico de barras com os dados das escolas.
   * @param {Array} escolas - Lista de escolas do JSON
   */
  const criarGraficoBarra = (escolas) => {
    const { grade, texto } = lerCoresDoTema();
    const canvas = document.querySelector('#barChart');
    if (!canvas) return; // se o elemento não existir na tela atual, ignora

    // Destrói o gráfico anterior antes de criar um novo
    // Sem isso, o Chart.js lança um erro de "canvas já está em uso"
    if (instanciaBarra) instanciaBarra.destroy();

    // Pega só o nome curto de cada escola para o eixo X (sem "Escola" no começo)
    const rotulos = escolas.map(s => s.name.replace('Escola ', ''));

    // Cria um dataset separado por escola — truque pra cada barra ter cor diferente
    // Cada dataset só tem valor na posição da própria escola, zero nas outras
    const dados = escolas.map((escola, i) => ({
      label: escola.name,
      data: escolas.map((_, j) => j === i ? escola.students : 0),
      backgroundColor: CORES_DAS_BARRAS[i % CORES_DAS_BARRAS.length],
      borderRadius: 6,
      borderSkipped: false,
    }));

    instanciaBarra = new Chart(canvas, {
      type: 'bar',
      data: { labels: rotulos, datasets: dados },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }, // legenda fica manual abaixo do gráfico
        },
        scales: {
          x: {
            stacked: true, // empilha os datasets (mas só 1 tem valor, então vira barra simples)
            grid: { display: false },
            ticks: { color: texto, font: { family: 'Baloo Tamma 2', size: 11 } },
          },
          y: {
            stacked: true,
            grid: { color: grade },
            ticks: { color: texto, font: { family: 'Baloo Tamma 2', size: 11 } },
            beginAtZero: true,
          },
        },
      },
    });

    // Monta a legenda manual com as cores de cada escola
    const legendaEl = document.querySelector('#bar-legend');
    if (!legendaEl) return;

    // Mostra no máximo 4 escolas na legenda visual
    const primeiras4 = escolas.slice(0, 4).map((escola, i) =>
      `<div class="legend-item">
         <div class="legend-dot" style="background:${CORES_DAS_BARRAS[i]}"></div>
         ${escapeHTML(escola.name)}
       </div>`
    );

    // Se tiver mais de 4, mostra "+N mais..."
    const restante = escolas.length > 4
      ? [`<div class="legend-item" style="font-size:11px">+${escolas.length - 4} mais...</div>`]
      : [];

    legendaEl.innerHTML = [...primeiras4, ...restante].join('');
  };

  /**
   * Cria (ou recria) o gráfico de rosca com a porcentagem de acertos.
   * @param {number} porcentagem - Número de 0 a 100 (ex: 72 = 72% de acertos)
   */
  const criarGraficoRosca = (porcentagem) => {
    const canvas = document.querySelector('#donutChart');
    if (!canvas) return;

    if (instanciaRosca) instanciaRosca.destroy();

    instanciaRosca = new Chart(canvas, {
      type: 'doughnut',
      data: {
        datasets: [{
          // O gráfico tem dois segmentos: acertos (verde) e erros (vermelho)
          data: [porcentagem, 100 - porcentagem],
          backgroundColor: ['#6fb755', '#e05a6a'],
          borderWidth: 0,
          hoverOffset: 4,
        }],
      },
      options: {
        responsive: false,
        cutout: '72%', // quanto maior o número, mais fino fica o anel
        plugins: {
          legend:  { display: false },
          tooltip: { enabled: true },
        },
      },
    });

    // Atualiza o número que fica no centro do anel
    const centroPct = document.querySelector('#donut-pct');
    if (centroPct) centroPct.textContent = porcentagem + '%';
  };

  /**
   * Método principal: reconstrói os dois gráficos.
   * Chamado ao carregar a página e ao trocar o tema (claro/escuro).
   * @param {Array} escolas - Lista de escolas
   * @param {number} mediaAcertos - % média de acertos
   */
  const atualizar = (escolas, mediaAcertos) => {
    criarGraficoBarra(escolas);
    criarGraficoRosca(mediaAcertos);
  };

  // Expõe os métodos para o resto do app usar
  return { atualizar, criarGraficoBarra, criarGraficoRosca };

})();

// Alias para não quebrar código que ainda usa "Charts"
const Charts = {
  refresh: (escolas, nota) => Graficos.atualizar(escolas, nota),
  renderBar: Graficos.criarGraficoBarra,
  renderDonut: Graficos.criarGraficoRosca,
};
