// =============================================================================
// main.js — PROCESSO PRINCIPAL (Main Process) do Electron
// =============================================================================
//
// CONCEITO FUNDAMENTAL: O Electron tem dois "mundos" separados:
//
//  ┌──────────────────────────────────────────────────────────────┐
//  │  MAIN PROCESS (este arquivo)                                 │
//  │  • Roda em Node.js — acessa arquivos, dialogs, tray...       │
//  │  • É como o "backend" da aplicação                           │
//  └───────────────────────┬──────────────────────────────────────┘
//                          │  IPC (mensagens entre processos)
//  ┌───────────────────────▼──────────────────────────────────────┐
//  │  RENDERER PROCESS (src/index.html + os arquivos .js delas)   │
//  │  • Roda no Chromium (como um browser) — exibe a interface    │
//  │  • NÃO acessa arquivos diretamente — pede ao main via IPC    │
//  └──────────────────────────────────────────────────────────────┘
//
// Para comunicação, o renderer chama window.electronAPI.algumMetodo()
// → preload.js traduz isso para ipcRenderer.invoke('algum-canal')
// → main.js responde aqui via ipcMain.handle('algum-canal', handler)
// =============================================================================

const {
  app,           // ciclo de vida do app (iniciar, fechar, etc.)
  BrowserWindow, // cria e gerencia janelas
  ipcMain,       // recebe mensagens do renderer
  Menu,          // cria menus nativos do SO
  Tray,          // ícone na bandeja do sistema
  dialog,        // caixas de diálogo nativas
  shell,         // abre arquivos/URLs no SO
  nativeImage,   // manipula imagens para ícones
} = require('electron');

const path = require('path'); // caminhos de arquivo (funciona no Windows, Mac e Linux)
const fs   = require('fs');   // leitura e escrita de arquivos no disco

// Verifica se o app foi iniciado com --dev para mostrar DevTools
const isDev = process.argv.includes('--dev');

// ── MONITORAMENTO GLOBAL DE CRASHES ───────────────────────────────────────────
// Exceções e rejeições não tratadas no Main Process deixam o app fechando
// silenciosamente. Registramos aqui para logar no terminal e permitir
// diagnóstico — o app não morre sem rastro.
process.on('uncaughtException', (error) => {
  console.error('[CRASH] Exceção não tratada no Main Process:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRASH] Promise rejeitada sem catch no Main Process:', reason);
});


// =============================================================================
// SEÇÃO 1: HELPERS DE PERSISTÊNCIA (leitura e gravação de JSON)
// =============================================================================
// Guardamos todos os dados em arquivos .json na pasta src/data/.
// É simples e eficiente para uma app desktop de pequeno/médio porte.
// =============================================================================

const DATA_DIR       = path.join(__dirname, 'src', 'data');

/**
 * Lê um arquivo JSON e retorna o conteúdo.
 * Retorna [] se o arquivo não existir ou estiver corrompido — nunca joga erro.
 */
const lerJSON = (nome) => {
  const caminho = path.join(DATA_DIR, `${nome}.json`);
  if (!fs.existsSync(caminho)) return [];
  try {
    return JSON.parse(fs.readFileSync(caminho, 'utf-8'));
  } catch {
    return [];
  }
};

/**
 * Salva um objeto/array no arquivo JSON correspondente.
 * Cria a pasta data/ se ela não existir ainda.
 */
const gravarJSON = (nome, dados) => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(DATA_DIR, `${nome}.json`),
    JSON.stringify(dados, null, 2), // null = sem filtro; 2 = 2 espaços de indentação
    'utf-8'
  );
};

// Aliases para compatibilidade com código que usa os nomes antigos
const readJSON  = lerJSON;
const writeJSON = gravarJSON;


// =============================================================================
// SEÇÃO 1.5: INTEGRAÇÃO COM A API (FastAPI + MySQL)
// =============================================================================
// O conteúdo (questões das aulas) agora vive no banco via API. Os dados locais
// (escolas, contratos, faturas, mascote) continuam em JSON por enquanto.
// Configure a URL e as credenciais via variáveis de ambiente se necessário.
// =============================================================================

const API_BASE_URL =
  process.env.SACOU_API_URL || 'http://localhost:8000';

// Token JWT da sessão REAL do usuário logado (enviado pelo renderer via IPC
// após o login). NUNCA há credencial padrão/fallback hardcoded no código.
let apiToken = null;

/**
 * Retorna o token da sessão do usuário logado.
 * Sem sessão ativa, falha EXPLÍCITO (401) no console — nunca usa credencial padrão.
 */
const garantirToken = async () => {
  if (apiToken) return apiToken;

  console.error(
    '[Sacou] 401 - Sem token de sessão. As requisições internas exigem o login do usuário.'
  );
  throw new Error('Não autenticado (401): faça login no painel para carregar os dados.');
};

/**
 * Chama a API (GET/POST/PUT/DELETE) já autenticado e devolve o JSON.
 */
const apiRequest = async (metodo, rota, corpo) => {
  const token = await garantirToken();
  const resposta = await fetch(`${API_BASE_URL}${rota}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });

  if (resposta.status === 204) return { success: true };
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados.detail || `Erro ${resposta.status} na API.`);
  }
  return dados;
};


// =============================================================================
// SEÇÃO 2: JANELAS (BrowserWindow)
// =============================================================================
// Cada janela do Electron é uma instância de BrowserWindow.
// Guardamos as referências em variáveis globais para evitar que o JS
// descarte as janelas da memória antes da hora (garbage collection).
// =============================================================================

let mainWindow      = null; // janela principal (o painel)
let aboutWindow     = null; // janela "Sobre o app"
let relatorioWindow = null; // janela de relatório
let tray            = null; // ícone na bandeja do sistema

/** Cria e configura a janela principal. Chamada uma vez ao iniciar. */
const criarJanelaPrincipal = () => {
  mainWindow = new BrowserWindow({
    width:     1280,
    height:    800,
    minWidth:  1024,
    minHeight: 640,
    title:     'Sacou — Painel Administrativo',
    backgroundColor: '#f0edf8', // cor enquanto a página carrega (evita flash branco)
    webPreferences: {
      // preload.js cria a ponte segura entre main e renderer
      preload: path.join(__dirname, 'preload.js'),
      // contextIsolation: true → separa o contexto do preload do da página (segurança)
      contextIsolation: true,
      // nodeIntegration: false → o renderer NÃO tem Node.js diretamente (segurança)
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('src/index.html');
  // DevTools desabilitado no modo dev: a janela deve abrir limpa na apresentação.
  // if (isDev) mainWindow.webContents.openDevTools();

  // Clicar em minimizar → manda para o tray em vez de minimizar normalmente
  mainWindow.on('minimize', () => mainWindow.hide());
  mainWindow.on('closed', () => { mainWindow = null; });
};

/** Abre a janela "Sobre". Se já estiver aberta, apenas traz para o foco. */
const criarJanelaAbout = () => {
  if (aboutWindow) { aboutWindow.focus(); return; }
  aboutWindow = new BrowserWindow({
    width: 480, height: 400, resizable: false,
    parent: mainWindow, modal: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  aboutWindow.loadFile('src/about.html');
  aboutWindow.setMenu(null);
  aboutWindow.on('closed', () => { aboutWindow = null; });
};

/** Abre a janela de Relatório. */
const criarJanelaRelatorio = () => {
  if (relatorioWindow) { relatorioWindow.focus(); return; }
  relatorioWindow = new BrowserWindow({
    width: 960, height: 720,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  relatorioWindow.loadFile('src/relatorio.html');
  relatorioWindow.setMenu(null);
  relatorioWindow.on('closed', () => { relatorioWindow = null; });
};


// =============================================================================
// SEÇÃO 3: MENU DE APLICAÇÃO
// =============================================================================
// Aparece na barra de título (Windows/Linux) ou barra global (macOS).
// Cada item pode: chamar função local, enviar mensagem ao renderer, ou ambos.
// =============================================================================

const construirMenu = () => {
  const template = [
    {
      label: 'Arquivo',
      submenu: [
        {
          label: '+ Nova Escola',
          accelerator: 'CmdOrCtrl+N', // atalho de teclado (Ctrl no Win/Linux, Cmd no Mac)
          // webContents.send() "empurra" uma mensagem do main para o renderer
          click: () => mainWindow?.webContents.send('menu:action', 'nova-escola'),
        },
        { type: 'separator' },
        { label: 'Exportar Dados...', accelerator: 'CmdOrCtrl+E', click: exportarDados },
        { label: 'Importar Dados...', click: importarDados },
        { type: 'separator' },
        { label: 'Sair', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'Visualizar',
      submenu: [
        { label: 'Visão Geral',        accelerator: 'CmdOrCtrl+1', click: () => mainWindow?.webContents.send('menu:action', 'view-overview') },
        { label: 'Gestão de Escolas',  accelerator: 'CmdOrCtrl+2', click: () => mainWindow?.webContents.send('menu:action', 'view-schools') },
        { label: 'Gestores do Sistema',accelerator: 'CmdOrCtrl+3', click: () => mainWindow?.webContents.send('menu:action', 'view-gestores') },
        { label: 'Gestão de Conteúdo', accelerator: 'CmdOrCtrl+4', click: () => mainWindow?.webContents.send('menu:action', 'view-content') },
        { label: 'Gestão Financeira',  accelerator: 'CmdOrCtrl+5', click: () => mainWindow?.webContents.send('menu:action', 'view-financeiro') },
        { label: 'Personalização',     accelerator: 'CmdOrCtrl+6', click: () => mainWindow?.webContents.send('menu:action', 'view-personalizacao') },
        { type: 'separator' },
        { label: 'Recarregar', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.reload() },
        // só mostra o item de DevTools no modo de desenvolvimento
        ...(isDev ? [{ label: 'DevTools', accelerator: 'CmdOrCtrl+Shift+I', click: () => mainWindow?.webContents.toggleDevTools() }] : []),
      ],
    },
    {
      label: 'Janelas',
      submenu: [
        { label: 'Painel Principal', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
        { label: 'Relatório',        click: criarJanelaRelatorio },
        { type: 'separator' },
        { label: 'Sobre o Sacou',   click: criarJanelaAbout },
      ],
    },
    { label: 'Ajuda', submenu: [{ label: 'Sobre o Sacou', click: criarJanelaAbout }] },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};


// =============================================================================
// SEÇÃO 4: TRAY (ícone na bandeja do sistema)
// =============================================================================
// O tray permite que o app continue rodando mesmo com a janela minimizada/fechada.
// O usuário pode clicar no ícone para reabrir o painel.
// =============================================================================

const criarTray = () => {
  const iconPath = path.join(__dirname, 'src', 'assets', 'img', 'logo.svg');

  // Se o SVG não existir, tenta o PNG do mascote como fallback
  const caminhoFinal = fs.existsSync(iconPath)
    ? iconPath
    : path.join(__dirname, 'src', 'assets', 'img', 'Piscando-removebg.png');

  const icone = nativeImage.createFromPath(caminhoFinal).resize({ width: 16, height: 16 });
  tray = new Tray(icone);
  tray.setToolTip('Sacou — Painel Administrativo');

  const menuTray = Menu.buildFromTemplate([
    { label: '📊 Abrir Painel',        click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { label: '📄 Relatório',           click: criarJanelaRelatorio },
    { label: 'ℹ️  Sobre',              click: criarJanelaAbout },
    { type: 'separator' },
    { label: '❌ Fechar Aplicativo',   click: () => { tray.destroy(); app.quit(); } },
  ]);

  tray.setContextMenu(menuTray);
  tray.on('click', () => { mainWindow?.show(); mainWindow?.focus(); });
};


// =============================================================================
// SEÇÃO 5: DIÁLOGOS NATIVOS (via IPC)
// =============================================================================
// ipcMain.handle(canal, fn) → responde ao ipcRenderer.invoke(canal) do renderer.
// O valor retornado pela fn chega ao renderer como resultado da Promise.
// =============================================================================

// Diálogo para selecionar um arquivo de contrato (PDF ou imagem) no SO.
ipcMain.handle('dialog:select-contrato-arquivo', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title: 'Selecionar arquivo de contrato',
    properties: ['openFile'],
    filters: [
      { name: 'Contratos (PDF ou imagem)', extensions: ['pdf', 'png', 'jpg', 'jpeg'] },
      { name: 'Todos os arquivos', extensions: ['*'] },
    ],
  });
  if (canceled || !filePaths.length) return { canceled: true };
  const caminho = filePaths[0];
  aprovarCaminhoUpload(caminho); // registra como aprovado p/ leitura nesta sessão
  return { canceled: false, caminho, nome: path.basename(caminho) };
});

// ── SEGURANÇA DE UPLOAD: caminhos aprovados pelo usuário ────────────────────
// Só arquivos escolhidos pelo USUÁRIO via dialog.showOpenDialog nesta sessão
// podem ser lidos com fs.readFileSync. Um XSS no renderer não consegue forjar
// uma seleção de diálogo — logo, não consegue ler/exfiltrar arquivos arbitrários.
const caminhosAprovadosUpload = new Set();

function aprovarCaminhoUpload(caminho) {
  if (caminho) caminhosAprovadosUpload.add(path.resolve(caminho));
}

const EXT_UPLOAD_CONTRATO = ['.pdf', '.png', '.jpg', '.jpeg'];
const EXT_UPLOAD_IMAGEM   = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
const EXT_UPLOAD_MIDIA    = ['.mp3', '.wav', '.ogg', '.m4a', '.mp4', '.webm', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

// Valida (aprovado + extensão) e lê um caminho escolhido pelo usuário.
function lerArquivoAprovado(caminhoOrigem, extensoes) {
  if (typeof caminhoOrigem !== 'string' || !caminhoOrigem.trim()) {
    return { erro: '403: caminho não autorizado.' };
  }
  const resolvido = path.resolve(caminhoOrigem);
  if (!caminhosAprovadosUpload.has(resolvido)) {
    return { erro: '403: caminho não autorizado.' };
  }
  const ext = path.extname(resolvido).toLowerCase();
  if (extensoes && !extensoes.includes(ext)) {
    return { erro: '403: extensão não permitida.' };
  }
  if (!fs.existsSync(resolvido)) {
    return { erro: 'Arquivo não encontrado.' };
  }
  return { conteudo: fs.readFileSync(resolvido) };
}

// Diálogo genérico de seleção de arquivo (uploads de mídia/avatar/loja/etc).
// Aprova o caminho escolhido para leitura no upload.
ipcMain.handle('dialog:selecionar-arquivo', async (event, { titulo, filtros } = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title: titulo || 'Selecionar arquivo',
    properties: ['openFile'],
    filters: filtros || [
      { name: 'Arquivos', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp3', 'wav', 'ogg', 'm4a', 'mp4', 'webm', 'pdf'] },
    ],
  });
  if (canceled || !filePaths.length) return { canceled: true };
  const caminho = filePaths[0];
  aprovarCaminhoUpload(caminho);
  return { canceled: false, caminho, nome: path.basename(caminho) };
});

// Diálogo de confirmação: retorna true se o usuário clicou em "Confirmar"
ipcMain.handle('dialog:confirm', async (event, { title, message, detail = '' }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning', buttons: ['Cancelar', 'Confirmar'],
    defaultId: 0, cancelId: 0,
    title, message, detail,
  });
  return response === 1; // 0 = Cancelar, 1 = Confirmar
});

ipcMain.handle('dialog:info',  async (event, { title, message }) => {
  await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), { type: 'info',  buttons: ['OK'], title, message });
});

ipcMain.handle('dialog:error', async (event, { title, message }) => {
  await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), { type: 'error', buttons: ['OK'], title, message });
});

// Janelas secundárias
ipcMain.handle('window:about',    () => criarJanelaAbout());
ipcMain.handle('window:relatorio',() => criarJanelaRelatorio());
ipcMain.handle('window:close',    (event) => BrowserWindow.fromWebContents(event.sender)?.close());

// Abre um arquivo no aplicativo padrão do SO, com validação rígida de
// diretório seguro e extensão (previne RCE via shell.openPath com caminho
// arbitrário enviado pelo Renderer).
const EXTENSOES_ABRIR_ARQUIVO = ['.pdf', '.jpg', '.jpeg', '.png', '.mp4', '.csv'];

ipcMain.handle('abrir-arquivo', async (_e, caminho) => {
  if (typeof caminho !== 'string' || !caminho.trim()) {
    return { sucesso: false, erro: 'Caminho ou tipo de arquivo não permitido.' };
  }

  // Diretórios considerados seguros: download de contratos (temp do app),
  // pasta de Downloads e userData. Tudo fora disso é rejeitado.
  const dirsSeguros = [
    path.join(app.getPath('temp'), 'sacou-contratos'),
    app.getPath('downloads'),
    app.getPath('userData'),
  ].map((d) => path.resolve(d));

  const resolvido = path.resolve(caminho);
  const dentroDeSeguro = dirsSeguros.some(
    (dir) => resolvido === dir || resolvido.startsWith(dir + path.sep)
  );
  if (!dentroDeSeguro) {
    return { sucesso: false, erro: 'Caminho ou tipo de arquivo não permitido.' };
  }

  const ext = path.extname(resolvido).toLowerCase();
  if (!EXTENSOES_ABRIR_ARQUIVO.includes(ext)) {
    return { sucesso: false, erro: 'Caminho ou tipo de arquivo não permitido.' };
  }

  if (!fs.existsSync(resolvido)) {
    return { sucesso: false, erro: 'Arquivo não encontrado.' };
  }

  const resultadoOpen = await shell.openPath(resolvido);
  if (resultadoOpen) {
    return { sucesso: false, erro: resultadoOpen };
  }
  return { sucesso: true };
});


// =============================================================================
// SEÇÃO 6: HANDLERS IPC — CRUD (criar, ler, atualizar, excluir)
// =============================================================================

// Expõe a base URL da API para o renderer resolver imagens /static/... corretamente
ipcMain.handle('get-api-base-url', () => ({ baseUrl: API_BASE_URL }));

// ── Dashboard ─────────────────────────────────────────────────────────────────
ipcMain.handle('get-dashboard-metrics', async (_e, escolaId = null) => {
  try {
    // GET /escolas/dashboard/visao-geral?escola_id=X (opcional) — métricas da Visão Geral
    const query = escolaId ? `?escola_id=${escolaId}` : '';
    const dados = await apiRequest('GET', `/escolas/dashboard/visao-geral${query}`);
    return {
      totalSchools:      dados.totalSchools || 0,
      totalStudents:     dados.totalStudents || 0,
      activeStudents15d: dados.activeStudents15d || 0,
      avgQuizScore:      dados.avgQuizScore || 0,
      schoolsGrowth:     dados.schoolsGrowth || '0',
      studentsGrowth:    dados.studentsGrowth || '—',
      ranking:           dados.ranking || [],
    };
  } catch (erro) {
    return { totalSchools: 0, totalStudents: 0, activeStudents15d: 0, avgQuizScore: 0, schoolsGrowth: '0', studentsGrowth: '—', ranking: [] };
  }
});

// ── Escolas (integradas com a API) ───────────────────────────────────────────

/**
 * Mapeia uma escola da API pro formato que o escolas.js espera.
 */
function mapearEscola(api, dashboard) {
  return {
    id:          api.id_escola,
    name:        api.nome_instituicao,
    code:        api.codigo || `ESC${String(api.id_escola).padStart(4, '0')}`,
    cnpj:        api.cnpj || '—',
    totalCoordenadores: api.total_coordenadores || 0,
    totalProfessores:   api.total_professores || 0,
    students:    dashboard?.qtd_alunos || 0,
    status:      api.status_ativo ? 'active' : 'inactive',
    arquivada:   api.arquivada || false,
  };
}

ipcMain.handle('get-schools', async (_e, arquivado = false) => {
  try {
    const lista = await apiRequest('GET', `/escolas?arquivado=${arquivado ? 'true' : 'false'}`);
    const resultado = [];
    for (const e of lista) {
      let dash = null;
      try { dash = await apiRequest('GET', `/escolas/${e.id_escola}/dashboard`); } catch { /* ignora */ }
      resultado.push(mapearEscola(e, dash));
    }
    return resultado;
  } catch (erro) {
    return [];
  }
});

ipcMain.handle('create-school', async (_e, dados) => {
  try {
    const resultado = await apiRequest('POST', '/escolas', {
      nome_escola:       dados.nome_escola,
      cnpj:              dados.cnpj,
      coordenador_nome:  dados.coordenador_nome,
      coordenador_email: dados.coordenador_email,
      coordenador_senha: dados.coordenador_senha,
    });
    return { success: true, id: resultado.id_escola, codigo: resultado.codigo || null };
  } catch (erro) {
    return { success: false, erro: erro.message };
  }
});

ipcMain.handle('update-school', async (_e, dados) => {
  try {
    await apiRequest('PUT', `/escolas/${dados.id}`, {
      nome_instituicao: dados.name,
      cnpj: dados.cnpj !== '—' ? dados.cnpj : null,
    });
    return { success: true };
  } catch (erro) {
    return { success: false, erro: erro.message };
  }
});

// ── Usuários por escola (Web e Desktop leem a MESMA tabela via a MESMA API) ──
ipcMain.handle('get-usuarios-escola', async (_e, { escolaId, perfil } = {}) => {
  try {
    // GET /escolas/{id}/usuarios?perfil=X (opcional) → usuários da escola
    // filtrados por perfil (ADMIN_ESCOLA = coordenadores, VISUALIZADOR_ESCOLA = professores).
    const query = perfil ? `?perfil=${encodeURIComponent(perfil)}` : '';
    const lista = await apiRequest('GET', `/escolas/${escolaId}/usuarios${query}`);
    return { success: true, lista };
  } catch (erro) {
    return { success: false, erro: erro.message, lista: [] };
  }
});

// Cria um coordenador (ADMIN_ESCOLA) ou professor (VISUALIZADOR_ESCOLA) na escola.
ipcMain.handle('create-usuario', async (_e, dados) => {
  try {
    const usuario = await apiRequest('POST', '/usuarios', {
      nome_completo: dados.nome_completo,
      email:         dados.email,
      senha:         dados.senha,
      perfil:        dados.perfil,
      escola_id:     dados.escola_id,
    });
    return { success: true, usuario };
  } catch (erro) {
    return { success: false, erro: erro.message };
  }
});

// ── Coordenadores por escola (contagem, lista, editar, arquivar) ─────────────

ipcMain.handle('get-coordenadores-escola', async (_e, escolaId) => {
  try {
    const lista = await apiRequest('GET', `/escolas/${escolaId}/coordenadores`);
    return { success: true, lista };
  } catch (erro) {
    return { success: false, erro: erro.message, lista: [] };
  }
});

ipcMain.handle('update-coordenador', async (_e, dados) => {
  try {
    const coordenador = await apiRequest('PUT', `/usuarios/${dados.id}`, {
      nome_completo: dados.nome_completo,
      email:         dados.email,
      senha:         dados.senha || undefined,
    });
    return { success: true, coordenador };
  } catch (erro) {
    return { success: false, erro: erro.message };
  }
});

ipcMain.handle('arquivar-coordenador', async (_e, { id, arquivado }) => {
  try {
    const coordenador = await apiRequest('PATCH', `/usuarios/${id}`, { arquivado });
    return { success: true, coordenador };
  } catch (erro) {
    return { success: false, erro: erro.message };
  }
});

ipcMain.handle('delete-school', async (_e, id) => {
  try {
    await apiRequest('PUT', `/escolas/${id}/arquivar`);
    return { success: true };
  } catch (erro) {
    return { success: false, erro: erro.message };
  }
});

// ── Gestores Master (integrados com a API/banco) ─────────────────────────────

ipcMain.handle('get-gestores', async () => {
  try {
    const lista = await apiRequest('GET', '/gestores');
    return { success: true, lista };
  } catch (erro) {
    return { success: false, erro: erro.message };
  }
});

ipcMain.handle('create-gestor', async (_e, dados) => {
  try {
    const resultado = await apiRequest('POST', '/gestores', {
      nome:  dados.nome,
      email: dados.email,
      senha: dados.senha,
    });
    return { success: true, gestor: resultado };
  } catch (erro) {
    return { success: false, erro: erro.message };
  }
});

// Arquiva/reativa um gestor (DEV ou GESTOR_PLATAFORMA) via PATCH /usuarios/{id}.
// Retorna o gestor ATUALIZADO do servidor — o front usa essa resposta real
// (HTTP 200) para atualizar o estado local, nunca um flip cego.
ipcMain.handle('arquivar-gestor', async (_e, { id, arquivado }) => {
  try {
    const gestor = await apiRequest('PATCH', `/usuarios/${id}`, { arquivado });
    return { success: true, gestor };
  } catch (erro) {
    return { success: false, erro: erro.message };
  }
});

// ── Gestão Financeira SaaS (Contrato + Faturas por escola) ───────────────────

ipcMain.handle('get-contrato-escola', async (_e, escolaId) => {
  try {
    // GET /financeiro/contratos/{escola_id} → contrato da escola ou null
    const contrato = await apiRequest('GET', `/financeiro/contratos/${escolaId}`);
    return { success: true, contrato };
  } catch (erro) {
    return { success: false, erro: erro.message };
  }
});

ipcMain.handle('get-financeiro-resumo', async (_e, escolaId = null) => {
  try {
    // GET /financeiro/resumo?escola_id=X (opcional) → contratos + faturas
    const query = escolaId ? `?escola_id=${escolaId}` : '';
    const dados = await apiRequest('GET', `/financeiro/resumo${query}`);
    return { success: true, contratos: dados.contratos || [], faturas: dados.faturas || [] };
  } catch (erro) {
    return { success: false, erro: erro.message, contratos: [], faturas: [] };
  }
});

ipcMain.handle('save-contrato-escola', async (_e, dados) => {
  try {
    const contrato = await apiRequest('POST', '/financeiro/contratos', {
      escola_id:       dados.escola_id,
      valor_setup:     dados.valor_setup,
      valor_por_aluno: dados.valor_por_aluno,
      ativo:           dados.ativo !== undefined ? dados.ativo : true,
    });
    return { success: true, contrato };
  } catch (erro) {
    return { success: false, erro: erro.message };
  }
});

ipcMain.handle('update-contrato-escola', async (_e, dados) => {
  try {
    // PUT /financeiro/contratos/{escola_id} → atualiza o contrato existente
    const contrato = await apiRequest('PUT', `/financeiro/contratos/${dados.escola_id}`, {
      valor_setup:     dados.valor_setup,
      valor_por_aluno: dados.valor_por_aluno,
      ativo:           dados.ativo !== undefined ? dados.ativo : true,
    });
    return { success: true, contrato };
  } catch (erro) {
    return { success: false, erro: erro.message };
  }
});

ipcMain.handle('get-faturas-escola', async (_e, escolaId) => {
  try {
    const lista = await apiRequest('GET', `/financeiro/faturas?escola_id=${escolaId}`);
    return { success: true, lista };
  } catch (erro) {
    return { success: false, erro: erro.message };
  }
});

ipcMain.handle('preview-fatura', async (_e, dados) => {
  try {
    // GET /financeiro/faturas/preview?escola_id=X&mes_referencia=YYYY-MM
    const preview = await apiRequest(
      'GET',
      `/financeiro/faturas/preview?escola_id=${dados.escola_id}&mes_referencia=${dados.mes_referencia}`
    );
    return { success: true, preview };
  } catch (erro) {
    return { success: false, erro: erro.message };
  }
});

ipcMain.handle('gerar-fatura', async (_e, dados) => {
  try {
    const fatura = await apiRequest('POST', '/financeiro/faturas/gerar', {
      escola_id:      dados.escola_id,
      mes_referencia: dados.mes_referencia,
    });
    return { success: true, fatura };
  } catch (erro) {
    return { success: false, erro: erro.message };
  }
});

ipcMain.handle('update-fatura-status', async (_e, { id, status }) => {
  try {
    const fatura = await apiRequest('PATCH', `/financeiro/faturas/${id}`, { status });
    return { success: true, fatura };
  } catch (erro) {
    return { success: false, erro: erro.message };
  }
});

// ── Arquivos de contrato (Documentos do Contrato) ─────────────────────────────

ipcMain.handle('contrato-arquivos', async (_e, escolaId) => {
  try {
    const lista = await apiRequest('GET', `/financeiro/contratos/${escolaId}/arquivos`);
    return { success: true, lista };
  } catch (erro) {
    return { success: false, erro: erro.message, lista: [] };
  }
});

ipcMain.handle('contrato-upload', async (_e, { escolaId, caminhoOrigem, nomeArquivo }) => {
  try {
    const token = await garantirToken();
    const leitura = lerArquivoAprovado(caminhoOrigem, EXT_UPLOAD_CONTRATO);
    if (leitura.erro) return { success: false, erro: leitura.erro };
    const conteudo = leitura.conteudo;
    const formData = new FormData();
    formData.append('arquivo', new Blob([conteudo]), nomeArquivo);
    const resposta = await fetch(`${API_BASE_URL}/financeiro/contratos/${escolaId}/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.detail || 'Falha no upload do arquivo.');
    return { success: true, arquivo: dados };
  } catch (erro) {
    return { success: false, erro: erro.message };
  }
});

ipcMain.handle('contrato-download', async (_e, { arquivoId, nomeArquivo }) => {
  try {
    const token = await garantirToken();
    const resposta = await fetch(`${API_BASE_URL}/financeiro/contratos/arquivos/${arquivoId}/download`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!resposta.ok) throw new Error('Falha ao baixar o arquivo.');
    const conteudo = Buffer.from(await resposta.arrayBuffer());
    const pastaTemp = path.join(app.getPath('temp'), 'sacou-contratos');
    fs.mkdirSync(pastaTemp, { recursive: true });
    const destino = path.join(pastaTemp, nomeArquivo || `contrato_${arquivoId}`);
    fs.writeFileSync(destino, conteudo);
    return { success: true, caminho: destino };
  } catch (erro) {
    return { success: false, erro: erro.message };
  }
});

ipcMain.handle('contrato-delete', async (_e, arquivoId) => {
  try {
    await apiRequest('DELETE', `/financeiro/contratos/arquivos/${arquivoId}`);
    return { success: true };
  } catch (erro) {
    return { success: false, erro: erro.message };
  }
});

// ── Questões (integradas com a API/banco) ─────────────────────────────────────
ipcMain.handle('get-questions', async () => {
  try {
    const dados = await apiRequest('GET', '/conteudo/perguntas');
    return { success: true, lista: dados };
  } catch (erro) {
    return { success: false, erro: erro.message };
  }
});

ipcMain.handle('get-licoes', async () => {
  try { return { success: true, lista: await apiRequest('GET', '/licoes') }; }
  catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('get-trilhas', async () => {
  try { return { success: true, lista: await apiRequest('GET', '/trilhas') }; }
  catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('get-trilhas-admin', async () => {
  try { return { success: true, lista: await apiRequest('GET', '/conteudo/trilhas-admin') }; }
  catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('create-trilha', async (_e, dados) => {
  try {
    const resultado = await apiRequest('POST', '/conteudo/trilhas', dados);
    return { success: true, id: resultado.id_trilha };
  } catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('update-trilha', async (_e, dados) => {
  try {
    await apiRequest('PUT', `/conteudo/trilhas/${dados.id}`, { nome_trilha: dados.nome_trilha });
    return { success: true };
  } catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('delete-trilha', async (_e, id) => {
  try { await apiRequest('DELETE', `/conteudo/trilhas/${id}`); return { success: true }; }
  catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('create-lesson', async (_e, dados) => {
  try {
    const resultado = await apiRequest('POST', '/conteudo/licoes', dados);
    return { success: true, id: resultado.id_licao };
  } catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('update-lesson', async (_e, dados) => {
  try {
    await apiRequest('PUT', `/conteudo/licoes/${dados.id}`, {
      titulo: dados.titulo, conteudo_video: dados.conteudo_video,
      conteudo_audio: dados.conteudo_audio, url_imagem: dados.url_imagem,
      recompensa_xp_max: dados.recompensa_xp_max, recompensa_moedas_max: dados.recompensa_moedas_max,
      ordem: dados.ordem,
    });
    return { success: true };
  } catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('delete-lesson', async (_e, id) => {
  try { await apiRequest('DELETE', `/conteudo/licoes/${id}`); return { success: true }; }
  catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('upload-media', async (_e, { caminhoOrigem, nomeArquivo, tipo }) => {
  try {
    const token = await garantirToken();
    const leitura = lerArquivoAprovado(caminhoOrigem, EXT_UPLOAD_MIDIA);
    if (leitura.erro) return { success: false, erro: leitura.erro };
    const conteudo = leitura.conteudo;
    const formData = new FormData();
    formData.append('arquivo', new Blob([conteudo]), nomeArquivo);
    const rota = tipo === 'audio' ? '/conteudo/upload-audio' : tipo === 'video' ? '/conteudo/upload-video' : '/conteudo/upload-image';
    const resposta = await fetch(`${API_BASE_URL}${rota}`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData,
    });
    if (!resposta.ok) throw new Error('Falha no upload');
    return { success: true, ...(await resposta.json()) };
  } catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('create-question', async (_e, dados) => {
  try {
    const resultado = await apiRequest('POST', '/conteudo/perguntas', {
      id_licao:       dados.id_licao,
      enunciado:      dados.enunciado,
      explicacao_feedback: dados.explicacao_feedback || null,
      alternativas:   dados.alternativas || [],
    });
    return { success: true, id: resultado.id_pergunta };
  } catch (erro) {
    return { success: false, erro: erro.message };
  }
});

ipcMain.handle('update-question', async (_e, dados) => {
  try {
    const resultado = await apiRequest('PUT', `/conteudo/perguntas/${dados.id}`, {
      enunciado:    dados.enunciado,
      alternativas: dados.alternativas,
    });
    return { success: true, id: resultado.id_pergunta };
  } catch (erro) {
    return { success: false, erro: erro.message };
  }
});

ipcMain.handle('delete-question', async (_e, id) => {
  try {
    await apiRequest('DELETE', `/conteudo/perguntas/${id}`);
    return { success: true };
  } catch (erro) {
    return { success: false, erro: erro.message };
  }
});

// ── Login na API (substitui o login simulado do app.js) ───────────────────────
ipcMain.handle('login', async (_e, credenciais) => {
  try {
    const resposta = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credenciais),
    });
    if (!resposta.ok) return { success: false, erro: 'Usuário ou senha incorretos.' };
    const dados = await resposta.json();
    apiToken = dados.access_token;
    return { success: true, usuario: dados.usuario, token: dados.access_token };
  } catch (erro) {
    return { success: false, erro: 'Não foi possível conectar à API.' };
  }
});

// Recebe o token JWT real do usuário logado (enviado pelo renderer após o login
// ou ao restaurar a sessão) e o mantém em memória para as requisições internas.
ipcMain.handle('set-auth-token', (_e, token) => {
  if (!token || typeof token !== 'string' || token.length < 20) {
    apiToken = null;
    return { success: false };
  }
  apiToken = token;
  return { success: true };
});

ipcMain.handle('logout', () => { apiToken = null; return { success: true }; });

// ── Mascote ───────────────────────────────────────────────────────────────────
ipcMain.handle('get-mascot-texts', () => lerJSON('mascot'));
ipcMain.handle('save-mascot-text', (_e, d) => {
  const l = lerJSON('mascot');
  const ex = l.find(m => m.context === d.context);
  if (ex) Object.assign(ex, d); else l.push({ id: Date.now(), ...d });
  gravarJSON('mascot', l);
  return { success: true };
});

// ── Personalização: Avatares e Loja (integrados com a API) ───────────────────

ipcMain.handle('get-avatars', async () => {
  try { return { success: true, lista: await apiRequest('GET', '/perfil/avatares/todos') }; }
  catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('create-avatar', async (_e, dados) => {
  try {
    const resultado = await apiRequest('POST', '/perfil/avatares', dados);
    return { success: true, id: resultado.id_avatar };
  } catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('update-avatar', async (_e, dados) => {
  try {
    await apiRequest('PUT', `/perfil/avatares/${dados.id}`, {
      nome: dados.nome, descricao: dados.descricao, url_imagem: dados.url_imagem,
      ordem: dados.ordem, ativo: dados.ativo,
    });
    return { success: true };
  } catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('delete-avatar', async (_e, id) => {
  try { await apiRequest('DELETE', `/perfil/avatares/${id}`); return { success: true }; }
  catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('upload-avatar-image', async (_e, { caminhoOrigem, nomeArquivo }) => {
  try {
    const token = await garantirToken();
    const leitura = lerArquivoAprovado(caminhoOrigem, EXT_UPLOAD_IMAGEM);
    if (leitura.erro) return { success: false, erro: leitura.erro };
    const conteudo = leitura.conteudo;
    const formData = new FormData();
    formData.append('arquivo', new Blob([conteudo]), nomeArquivo);
    const resposta = await fetch(`${API_BASE_URL}/perfil/upload-avatar`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData,
    });
    if (!resposta.ok) throw new Error('Falha no upload');
    return { success: true, ...(await resposta.json()) };
  } catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('get-store-items', async () => {
  try { return { success: true, lista: await apiRequest('GET', '/loja/admin/todos') }; }
  catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('create-store-item', async (_e, dados) => {
  try {
    const resultado = await apiRequest('POST', '/loja/admin', dados);
    return { success: true, id: resultado.id_item };
  } catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('update-store-item', async (_e, dados) => {
  try {
    await apiRequest('PUT', `/loja/admin/${dados.id}`, {
      nome: dados.nome, descricao: dados.descricao, url_imagem: dados.url_imagem,
      preco: dados.preco, id_trilha_requerida: dados.id_trilha_requerida, ativo: dados.ativo,
    });
    return { success: true };
  } catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('delete-store-item', async (_e, id) => {
  try { await apiRequest('DELETE', `/loja/admin/${id}`); return { success: true }; }
  catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('upload-store-image', async (_e, { caminhoOrigem, nomeArquivo }) => {
  try {
    const token = await garantirToken();
    const leitura = lerArquivoAprovado(caminhoOrigem, EXT_UPLOAD_IMAGEM);
    if (leitura.erro) return { success: false, erro: leitura.erro };
    const conteudo = leitura.conteudo;
    const formData = new FormData();
    formData.append('arquivo', new Blob([conteudo]), nomeArquivo);
    const resposta = await fetch(`${API_BASE_URL}/loja/upload-item`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData,
    });
    if (!resposta.ok) throw new Error('Falha no upload');
    return { success: true, ...(await resposta.json()) };
  } catch (erro) { return { success: false, erro: erro.message }; }
});

// ── Personalização unificada (avatares + itens via /personalizacao/*) ────────

ipcMain.handle('personalizacao-avatares', async () => {
  try { return { success: true, lista: await apiRequest('GET', '/personalizacao/avatares') }; }
  catch (erro) { return { success: false, erro: erro.message, lista: [] }; }
});

ipcMain.handle('personalizacao-avatar-create', async (_e, dados) => {
  try {
    const resultado = await apiRequest('POST', '/personalizacao/avatares', dados);
    return { success: true, id: resultado.id };
  } catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('personalizacao-avatar-update', async (_e, dados) => {
  try {
    await apiRequest('PUT', `/personalizacao/avatares/${dados.id}`, dados);
    return { success: true };
  } catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('personalizacao-avatar-delete', async (_e, id) => {
  try { await apiRequest('DELETE', `/personalizacao/avatares/${id}`); return { success: true }; }
  catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('personalizacao-itens', async () => {
  try { return { success: true, lista: await apiRequest('GET', '/personalizacao/itens-loja') }; }
  catch (erro) { return { success: false, erro: erro.message, lista: [] }; }
});

ipcMain.handle('personalizacao-item-create', async (_e, dados) => {
  try {
    const resultado = await apiRequest('POST', '/personalizacao/itens', dados);
    return { success: true, id: resultado.id };
  } catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('personalizacao-item-update', async (_e, dados) => {
  try {
    await apiRequest('PUT', `/personalizacao/itens/${dados.id}`, dados);
    return { success: true };
  } catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('personalizacao-item-delete', async (_e, id) => {
  try { await apiRequest('DELETE', `/personalizacao/itens/${id}`); return { success: true }; }
  catch (erro) { return { success: false, erro: erro.message }; }
});

ipcMain.handle('personalizacao-upload', async (_e, { caminhoOrigem, nomeArquivo }) => {
  try {
    const token = await garantirToken();
    const leitura = lerArquivoAprovado(caminhoOrigem, EXT_UPLOAD_IMAGEM);
    if (leitura.erro) return { success: false, erro: leitura.erro };
    const conteudo = leitura.conteudo;
    const formData = new FormData();
    formData.append('arquivo', new Blob([conteudo]), nomeArquivo);
    const resposta = await fetch(`${API_BASE_URL}/personalizacao/upload`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData,
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.detail || 'Falha no upload.');
    return { success: true, ...dados };
  } catch (erro) { return { success: false, erro: erro.message }; }
});


// =============================================================================
// SEÇÃO 7: EXPORTAR / IMPORTAR DADOS (ações do menu)
// =============================================================================

const exportarDados = async () => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title:       'Exportar Dados — Sacou',
    defaultPath: `sacou-dados-${new Date().toISOString().slice(0, 10)}.json`,
    filters:     [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return;

  try {
    // Busca os dados REAIS do banco via API (nunca arquivos locais estáticos).
    const [escolas, perguntas, trilhas] = await Promise.all([
      apiRequest('GET', '/escolas?arquivado=false'),
      apiRequest('GET', '/conteudo/perguntas'),
      apiRequest('GET', '/trilhas'),
    ]);

    const payload = {
      exportadoEm: new Date().toISOString(),
      escolas:   escolas || [],
      perguntas: perguntas || [],
      trilhas:   trilhas || [],
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    await dialog.showMessageBox(mainWindow, {
      type: 'info', buttons: ['OK'], title: 'Exportação concluída',
      message: `Dados exportados com sucesso! (${(escolas || []).length} escolas, ${(perguntas || []).length} perguntas, ${(trilhas || []).length} trilhas)`,
      detail: filePath,
    });
  } catch (err) {
    await dialog.showMessageBox(mainWindow, { type: 'error', buttons: ['OK'], title: 'Erro na exportação', message: err.message });
  }
};

const importarDados = async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: 'Importar Dados — Sacou',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return;

  try {
    const dados = JSON.parse(fs.readFileSync(filePaths[0], 'utf-8'));

    // Aceita os nomes de chave novos (perguntas) e antigos (questoes).
    const escolas   = Array.isArray(dados.escolas)   ? dados.escolas   : [];
    const perguntas = Array.isArray(dados.perguntas) ? dados.perguntas : (Array.isArray(dados.questoes) ? dados.questoes : []);
    const trilhas   = Array.isArray(dados.trilhas)   ? dados.trilhas   : [];

    let importados = 0;
    let ignorados  = 0;
    const avisos = [];

    // ── Trilhas → POST /conteudo/trilhas ──────────────────────────────────
    for (const t of trilhas) {
      const nome = t.nome_trilha || t.nome || '';
      if (!nome) { ignorados++; continue; }
      try {
        await apiRequest('POST', '/conteudo/trilhas', { nome_trilha: nome });
        importados++;
      } catch (e) {
        ignorados++;
        if (!/já/i.test(e.message)) avisos.push(`Trilha "${nome}": ${e.message}`);
      }
    }

    // ── Perguntas → POST /conteudo/perguntas ──────────────────────────────
    for (const q of perguntas) {
      const enunciado = q.text || q.enunciado || q.pergunta || '';
      if (!enunciado || !q.id_licao) { ignorados++; continue; }
      try {
        await apiRequest('POST', '/conteudo/perguntas', {
          id_licao: q.id_licao,
          enunciado,
          explicacao_feedback: q.explicacao_feedback || null,
          alternativas: Array.isArray(q.alternativas) ? q.alternativas : [],
        });
        importados++;
      } catch (e) {
        ignorados++;
        if (!/já/i.test(e.message)) avisos.push(`Pergunta "${enunciado.slice(0, 40)}": ${e.message}`);
      }
    }

    // ── Escolas → POST /escolas ───────────────────────────────────────────
    // A exportação NÃO inclui credenciais de coordenador (senha). Sem elas a
    // API exige o cadastro manual — registramos como ignorada com aviso.
    for (const s of escolas) {
      const nome = s.nome_instituicao || s.name || s.nome_escola || '';
      if (!nome) { ignorados++; continue; }
      if (!s.coordenador_email || !s.coordenador_nome || !s.coordenador_senha) {
        ignorados++;
        avisos.push(`Escola "${nome}": sem credenciais de coordenador — cadastre manualmente.`);
        continue;
      }
      try {
        await apiRequest('POST', '/escolas', {
          nome_escola: nome,
          cnpj: s.cnpj || null,
          coordenador_nome: s.coordenador_nome,
          coordenador_email: s.coordenador_email,
          coordenador_senha: s.coordenador_senha,
        });
        importados++;
      } catch (e) {
        ignorados++;
        if (!/já/i.test(e.message)) avisos.push(`Escola "${nome}": ${e.message}`);
      }
    }

    const resumo =
      `• ${importados} item(ns) importado(s)\n` +
      `• ${ignorados} ignorado(s) (duplicados ou faltando dados)` +
      (avisos.length ? `\n\nAvisos (${avisos.length}):\n${avisos.slice(0, 10).join('\n')}` : '');

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info', buttons: ['Recarregar agora', 'Depois'], defaultId: 0,
      title: 'Importação concluída', message: resumo,
    });
    if (response === 0) mainWindow?.reload();
  } catch (err) {
    await dialog.showMessageBox(mainWindow, { type: 'error', buttons: ['OK'], title: 'Erro na importação', message: err.message });
  }
};


// =============================================================================
// SEÇÃO 8: CICLO DE VIDA DO APP
// =============================================================================

app.whenReady().then(() => {
  criarJanelaPrincipal();
  construirMenu();
  criarTray();

  // macOS: recria a janela ao clicar no ícone do Dock quando não há janelas abertas
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanelaPrincipal();
  });
});

// Windows/Linux: encerra o app quando todas as janelas são fechadas
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    tray?.destroy();
    app.quit();
  }
});
