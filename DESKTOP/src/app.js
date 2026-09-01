// ─────────────────────────────────────────────────────────────────────────────
// app.js — Controlador Principal do Painel (Renderer Process)
//
// Este é o arquivo que "amarra" tudo junto. Ele:
//   1. Controla a tela de login
//   2. Gerencia a navegação entre as seções (abas da sidebar)
//   3. Alterna o tema claro/escuro
//   4. Liga os filtros e a busca global
//   5. Controla o botão de sair
//   6. Inicializa todas as views (telas) do painel
//   7. Escuta as ações do menu de aplicação (menu do SO)
// ─────────────────────────────────────────────────────────────────────────────

(async () => {

  // ── 1. LOGIN ───────────────────────────────────────────────────────────────
  // Login autentica na API (FastAPI + MySQL). O token fica no main process.

  const telLogin     = document.querySelector('#login-screen');
  const btnEntrar    = document.querySelector('#btn-login');
  const inputEmail   = document.querySelector('#login-email');
  const inputSenha   = document.querySelector('#login-senha');
  const erroLogin    = document.querySelector('#login-error');

  // ── NOME DO USUÁRIO LOGADO (sidebar abaixo da logo "Sacou") ────────────────
  // O login retorna o objeto do usuário (com nome_completo). Guardamos em
  // localStorage para exibir na sidebar e restaurar após recarregar o painel.

  const USER_KEY = 'sacou_desktop_user';
  const TOKEN_KEY = 'sacou_desktop_token';

  const setarNomeUsuario = (usuario) => {
    const el = document.querySelector('#sidebar-user-name');
    if (el) el.textContent = usuario?.nome_completo || 'Visitante';
    if (usuario) localStorage.setItem(USER_KEY, JSON.stringify(usuario));
    else localStorage.removeItem(USER_KEY);
  };

  // Restaura o nome salvo (caso o painel seja recarregado sem sair)
  try {
    const salvo = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    if (salvo?.nome_completo) setarNomeUsuario(salvo);
  } catch { /* ignora JSON inválido */ }

  // Restaura a sessão real no main process: se houver token salvo, envia via
  // IPC para que as requisições internas usem o JWT do usuário (nunca credencial padrão).
  const tokenSalvo = localStorage.getItem(TOKEN_KEY);
  if (tokenSalvo) window.electronAPI.setAuthToken(tokenSalvo);

  /**
   * Valida as credenciais na API e, se correto, exibe o painel.
   * Chamada ao clicar "Entrar" ou pressionar Enter nos campos.
   */
  const fazerLogin = async () => {
    const email = inputEmail.value.trim();
    const senha = inputSenha.value;

    // Campos não podem estar vazios
    if (!email || !senha) {
      erroLogin.textContent = 'Preencha usuário e senha.';
      return;
    }

    // Autentica na API
    const resultado = await window.electronAPI.login({ email, senha });
    if (!resultado.success) {
      erroLogin.textContent = resultado.erro || 'Usuário ou senha incorretos.';
      inputSenha.value = '';
      inputSenha.focus();
      return;
    }

    // Exibe o nome do usuário logado na sidebar
    setarNomeUsuario(resultado.usuario);

    // Envia o token JWT REAL do usuário logado para o main process (via IPC),
    // para que todas as requisições internas usem a sessão autêntica.
    if (resultado.token) {
      localStorage.setItem(TOKEN_KEY, resultado.token);
      window.electronAPI.setAuthToken(resultado.token);
    }

    // Login correto: anima a saída da tela de login
    erroLogin.textContent = '';
    telLogin.classList.add('hidden'); // CSS faz o fade-out

    // Após a animação terminar, esconde completamente e libera o painel
    setTimeout(() => {
      telLogin.style.display = 'none';
      document.body.classList.remove('login-active');
      document.dispatchEvent(new CustomEvent('sacou:login-ok'));
    }, 300);
  };

  // Liga o botão e o Enter nos campos ao login
  btnEntrar.addEventListener('click', fazerLogin);
  [inputEmail, inputSenha].forEach(campo =>
    campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') fazerLogin(); })
  );

  // ── 2. NAVEGAÇÃO ENTRE SEÇÕES ──────────────────────────────────────────────
  // O painel tem uma sidebar com botões (nav-item).
  // Cada botão tem data-view="nome" que identifica qual seção mostrar.

  // Títulos exibidos no header ao navegar (vinculados ao data-view)
  const titulosDasSecoes = {
    overview:        'Visão Geral',
    schools:         'Gestão de Escolas',
    gestores:        'Gestores do Sistema',
    content:         'Gestão de Conteúdo',
    financeiro:      'Gestão Financeira',
    personalizacao:  'Personalização',
  };

  /**
   * Troca a seção visível no painel.
   * Atualiza o item ativo na sidebar, a seção visível e o título do header.
   * @param {string} secaoId - 'overview', 'schools', 'content' ou 'financeiro'
   */
  const trocarSecao = (secaoId) => {
    // Remove destaque de todos os itens da sidebar
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // Destaca o item da seção atual
    document.querySelector(`[data-view="${secaoId}"]`)?.classList.add('active');

    // Esconde todas as seções e mostra só a que foi pedida
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelector(`#view-${secaoId}`)?.classList.add('active');

    // Atualiza o título no header
    document.querySelector('#header-title').textContent = titulosDasSecoes[secaoId] || '';

    // SINCRONIA: ao abrir a Gestão de Escolas, busca os dados MAIS RECENTES do
    // banco (via API) — não usa dados em cache da sessão anterior. Assim,
    // alterações feitas no Web (alunos, professores, escolas) aparecem aqui.
    if (secaoId === 'schools' && typeof EscolasView.refresh === 'function') {
      EscolasView.refresh();
    }

    // SINCRONIA (Visão Geral): re-busca as métricas/contagens da API a cada
    // navegação — evita mostrar contagem desatualizada (ex.: escolas criadas
    // no Web enquanto o Desktop estava aberto).
    if (secaoId === 'overview' && typeof VisaoGeralView.carregarComFiltro === 'function') {
      const escolas = typeof EscolasView !== 'undefined' ? EscolasView.getDados() : [];
      VisaoGeralView.carregarComFiltro(null, escolas);
    }
  };

  // ── 2.1 GESTÃO FINANCEIRA POR ESCOLA ───────────────────────────────────────
  // A Gestão Financeira é uma página única vinculada à escola (botão "Financeiro"
  // na tabela). Ela recebe o escola_id via state (window.SacouFinanceiro) e o
  // botão "← Voltar" retorna para a Gestão de Escolas.

  /**
   * Abre a Gestão Financeira unificada de uma escola específica.
   * Preenche o título da página e dispara o carregamento dos dados.
   * @param {number} escolaId - ID da escola
   * @param {string} escolaNome - Nome da escola (para exibição)
   */
  const abrirFinanceiroPorEscola = (escolaId, escolaNome) => {
    if (typeof FinanceiroView !== 'undefined' && FinanceiroView.abrirFinanceiroPorEscola) {
      FinanceiroView.abrirFinanceiroPorEscola(escolaId, escolaNome);
    }
    trocarSecao('financeiro');
  };

  // Expõe para as views (ex.: botão "Financeiro" em escolas.js).
  window.SacouFinanceiro = { abrirFinanceiroPorEscola };

  // Botão "← Voltar" da página financeira → retorna para Gestão de Escolas.
  document.addEventListener('sacou:voltar-escolas', () => trocarSecao('schools'));

  // ── 2.2 FILTRO POR ESCOLA (Visão Geral) ───────────────────────────────────
  // O seletor de escolas existe apenas no topo da Visão Geral. Selecionar uma
  // escola dispara a requisição dos dados da página passando o escola_id.

  const popularSelectoresEscola = () => {
    const escolas = typeof EscolasView !== 'undefined' ? EscolasView.getDados() : [];
    const sel = document.querySelector('#filter-escola-overview');
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    escolas.forEach(escola => {
      const opt = document.createElement('option');
      opt.value = String(escola.id);
      opt.textContent = escola.name;
      sel.appendChild(opt);
    });
  };

  // Exposto para as views recarregarem os seletores após criar/editar escolas.
  window.popularSelectoresEscola = popularSelectoresEscola;

  document.querySelector('#filter-escola-overview')?.addEventListener('change', (e) => {
    const escolaId = e.target.value ? Number(e.target.value) : null;
    if (typeof VisaoGeralView !== 'undefined' && VisaoGeralView.carregarComFiltro) {
      VisaoGeralView.carregarComFiltro(escolaId, EscolasView.getDados());
    }
  });

  // Liga cada botão da sidebar à função de navegação
  document.querySelectorAll('.nav-item').forEach(item =>
    item.addEventListener('click', () => {
      if (item.dataset.view) trocarSecao(item.dataset.view);
    })
  );

  // ── 3. TEMA CLARO / ESCURO ─────────────────────────────────────────────────
  // O tema é salvo no localStorage para ser lembrado entre as sessões.
  // localStorage é como uma "memória" do browser que não some ao fechar.

  const btnTema  = document.querySelector('#btn-dark');
  const iconeLua = document.querySelector('#icon-moon'); // ícone do modo claro
  const iconeSol = document.querySelector('#icon-sun');  // ícone do modo escuro
  let modoEscuro = localStorage.getItem('sacou-tema') === 'dark';

  /**
   * Aplica o tema atual à página e salva a preferência.
   */
  const aplicarTema = () => {
    // data-theme="dark" no <html> ativa as variáveis CSS do tema escuro
    document.documentElement.setAttribute('data-theme', modoEscuro ? 'dark' : '');

    // Troca o ícone da lua/sol conforme o tema
    iconeLua.style.display = modoEscuro ? 'none'  : 'block';
    iconeSol.style.display = modoEscuro ? 'block' : 'none';

    // Salva o tema escolhido para a próxima abertura do app
    localStorage.setItem('sacou-tema', modoEscuro ? 'dark' : 'light');

    // Recria os gráficos com as cores do novo tema (timeout para o CSS atualizar primeiro).
    // Usa a MÉTRICA REAL da API (cache da Visão Geral), nunca um número fixo.
    const metricasReais = (typeof VisaoGeralView !== 'undefined' && VisaoGeralView.getMetricas)
      ? VisaoGeralView.getMetricas()
      : null;
    const mediaAcertosReal = metricasReais?.avgQuizScore ?? 0;
    setTimeout(() => Graficos.atualizar(EscolasView.getDados(), mediaAcertosReal), 50);
  };

  btnTema?.addEventListener('click', () => { modoEscuro = !modoEscuro; aplicarTema(); });
  aplicarTema(); // aplica o tema salvo ao iniciar

  // ── 5. BOTÃO SAIR ──────────────────────────────────────────────────────────
  // Volta para a tela de login sem fechar o programa.

  document.querySelector('#btn-exit')?.addEventListener('click', () => {
    Modal.abrir({
      titulo:     'Sair do Painel',
      labelBotao: 'Sair',
      conteudo: `<p style="color:var(--text-secondary);font-size:13.5px;line-height:1.6">
        Deseja sair do painel e voltar à tela de login?
      </p>`,
      aoSalvar: () => {
        Modal.fechar();

        // Encerra a sessão na API (limpa o token)
        window.electronAPI.logout();
        localStorage.removeItem(TOKEN_KEY);
        setarNomeUsuario(null); // volta para "Visitante" na sidebar

        // Limpa os campos do login para a próxima sessão
        inputEmail.value     = '';
        inputSenha.value     = '';
        erroLogin.textContent = '';

        // Mostra novamente a tela de login com animação
        telLogin.style.display = 'flex';
        document.body.classList.add('login-active');
        setTimeout(() => telLogin.classList.remove('hidden'), 10);
      },
    });
  });

  // ── 6. INICIALIZAÇÃO DAS VIEWS (TELAS) ─────────────────────────────────────
  // A inicialização acontece DEPOIS do login (evento sacou:login-ok).
  // Antes, rodava no carregamento da página — mas sem token válido, a API
  // retornava lista vazia, fazendo escolas criadas sumirem no próximo restart.

  const inicializarPainel = async () => {
    if (window._painelInicializado) return;
    window._painelInicializado = true;
    try {
      await EscolasView.init();
      popularSelectoresEscola(); // popula os seletores de escola das páginas
      await GestoresView.init();
      await VisaoGeralView.init(EscolasView.getDados());
      await ConteudoView.init();
      await FinanceiroView.init();
      await PersonalizacaoView.init();

      console.log('[Sacou Admin] Painel carregado com sucesso!');
    } catch (erro) {
      console.error('[Sacou Admin] Erro ao inicializar:', erro);
      Notificacao.erro('Erro ao carregar os dados. Verifique o console.');
    }
  };

  document.addEventListener('sacou:login-ok', inicializarPainel);

  // ── 7. AÇÕES DO MENU DE APLICAÇÃO ─────────────────────────────────────────
  // O menu de aplicação fica no main.js.
  // Quando o usuário clica em um item do menu, o main.js envia 'menu:action'
  // com o nome da ação. O renderer ouve aqui e reage.

  const limparListener = window.electronAPI.onMenuAction((acao) => {
    switch (acao) {
      case 'nova-escola':
        trocarSecao('schools');
        EscolasView.abrirModalCadastro(); // abre o modal direto
        break;
      case 'view-overview':   trocarSecao('overview');   break;
      case 'view-schools':    trocarSecao('schools');    break;
      case 'view-gestores':   trocarSecao('gestores');   break;
      case 'view-content':    trocarSecao('content');    break;
      case 'view-financeiro':
        // Sem escola definida → abre a página (mostra o estado vazio
        // pedindo para escolher uma escola na Gestão de Escolas).
        trocarSecao('financeiro');
        break;
      case 'view-personalizacao': trocarSecao('personalizacao'); break;
    }
  });

  // Limpa o listener quando a janela for fechada (evita "memory leak")
  window.addEventListener('beforeunload', limparListener);

})();
