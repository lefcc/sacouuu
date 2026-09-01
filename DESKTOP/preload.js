// ─────────────────────────────────────────────────────────────────────────────
// preload.js — Ponte segura entre o Renderer e o Main Process
//
// Por que esse arquivo existe?
// O renderer (HTML/JS da tela) não pode acessar o Node.js diretamente —
// seria uma brecha de segurança. Então o preload cria uma "janela" controlada
// chamada contextBridge, que expõe só as funções que o renderer pode usar.
//
// Resultado: window.electronAPI fica disponível em todos os arquivos JS da tela.
//
// FLUXO COMPLETO:
//   renderer chama:  window.electronAPI.getSchools()
//   preload faz:     ipcRenderer.invoke('get-schools')
//   main responde:   ipcMain.handle('get-schools', () => apiRequest('GET', '/escolas'))
//   renderer recebe: a lista de escolas como Promise<Array>
// (Dados sempre vêm da API/banco — não há mais arquivos JSON locais estáticos.)
// ─────────────────────────────────────────────────────────────────────────────

const { contextBridge, ipcRenderer } = require('electron');

// Lista de canais que o renderer PODE ESCUTAR (whitelist de segurança).
// Só canais desta lista passam pelo .on() abaixo — ignora qualquer outro.
const CANAIS_PERMITIDOS = ['menu:action'];

contextBridge.exposeInMainWorld('electronAPI', {

  // ── AUTENTICAÇÃO (API) ──────────────────────────────────────────────────────
  login:  (credenciais) => ipcRenderer.invoke('login', credenciais),
  logout: ()            => ipcRenderer.invoke('logout'),
  // Envia o token JWT real do usuário logado para o main process (sessão).
  setAuthToken: (token) => ipcRenderer.invoke('set-auth-token', token),

  // ── CONFIGURAÇÃO ───────────────────────────────────────────────────────────
  getApiBaseUrl: () => ipcRenderer.invoke('get-api-base-url'),

  // ── DASHBOARD ──────────────────────────────────────────────────────────────
  getDashboardMetrics: () => ipcRenderer.invoke('get-dashboard-metrics'),

  // ── ESCOLAS (CRUD) ─────────────────────────────────────────────────────────
  getSchools:   (arquivado) => ipcRenderer.invoke('get-schools', arquivado),
  createSchool: (data) => ipcRenderer.invoke('create-school', data),
  updateSchool: (data) => ipcRenderer.invoke('update-school', data),
  deleteSchool: (id)   => ipcRenderer.invoke('delete-school', id),

  // ── USUÁRIOS POR ESCOLA ────────────────────────────────────────────────────
  getUsuariosEscola: (escolaId, perfil) => ipcRenderer.invoke('get-usuarios-escola', { escolaId, perfil }),
  createUsuario:     (dados) => ipcRenderer.invoke('create-usuario', dados),

  // ── COORDENADORES POR ESCOLA ───────────────────────────────────────────────
  getCoordenadoresEscola: (escolaId) => ipcRenderer.invoke('get-coordenadores-escola', escolaId),
  updateCoordenador:     (dados)    => ipcRenderer.invoke('update-coordenador', dados),
  arquivarCoordenador:   (id, arquivado) => ipcRenderer.invoke('arquivar-coordenador', { id, arquivado }),

  // ── GESTORES MASTER ────────────────────────────────────────────────────────
  getGestores:   ()    => ipcRenderer.invoke('get-gestores'),
  createGestor:  (data) => ipcRenderer.invoke('create-gestor', data),
  arquivarGestor:(id, arquivado) => ipcRenderer.invoke('arquivar-gestor', { id, arquivado }),

  // ── GESTÃO FINANCEIRA SaaS (Contrato + Faturas por escola) ─────────────────
  getContratoEscola:   (escolaId) => ipcRenderer.invoke('get-contrato-escola', escolaId),
  saveContratoEscola:  (data)     => ipcRenderer.invoke('save-contrato-escola', data),
  updateContratoEscola:(escolaId, data) => ipcRenderer.invoke('update-contrato-escola', { escola_id: escolaId, ...data }),
  getFaturasEscola:    (escolaId) => ipcRenderer.invoke('get-faturas-escola', escolaId),
  previewFatura:       (data)     => ipcRenderer.invoke('preview-fatura', data),
  gerarFatura:         (data)     => ipcRenderer.invoke('gerar-fatura', data),
  updateFaturaStatus:  (id, status) => ipcRenderer.invoke('update-fatura-status', { id, status }),
  getFinanceiroResumo: (escolaId) => ipcRenderer.invoke('get-financeiro-resumo', escolaId),

  // ── FINANCEIRO: ARQUIVOS DE CONTRATO (Documentos do Contrato) ──────────────
  selectContratoArquivo:  ()          => ipcRenderer.invoke('dialog:select-contrato-arquivo'),
  // Diálogo genérico de seleção de arquivo (uploads de mídia/avatar/loja).
  selecionarArquivo:      (opts)      => ipcRenderer.invoke('dialog:selecionar-arquivo', opts),
  getContratoArquivos:    (escolaId)  => ipcRenderer.invoke('contrato-arquivos', escolaId),
  uploadContratoArquivo:  (dados)     => ipcRenderer.invoke('contrato-upload', dados),
  downloadContratoArquivo:(dados)     => ipcRenderer.invoke('contrato-download', dados),
  deleteContratoArquivo:  (arquivoId) => ipcRenderer.invoke('contrato-delete', arquivoId),

  // ── QUESTÕES (integradas com a API) ────────────────────────────────────────
  getQuestions:   ()     => ipcRenderer.invoke('get-questions'),
  getLicoes:      ()     => ipcRenderer.invoke('get-licoes'),
  getTrilhas:     ()     => ipcRenderer.invoke('get-trilhas'),
  getTrilhasAdmin:()     => ipcRenderer.invoke('get-trilhas-admin'),
  createTrilha:   (data) => ipcRenderer.invoke('create-trilha', data),
  updateTrilha:   (data) => ipcRenderer.invoke('update-trilha', data),
  deleteTrilha:   (id)   => ipcRenderer.invoke('delete-trilha', id),
  createQuestion: (data) => ipcRenderer.invoke('create-question', data),
  updateQuestion: (data) => ipcRenderer.invoke('update-question', data),
  deleteQuestion: (id)   => ipcRenderer.invoke('delete-question', id),
  createLesson:   (data) => ipcRenderer.invoke('create-lesson', data),
  updateLesson:   (data) => ipcRenderer.invoke('update-lesson', data),
  deleteLesson:   (id)   => ipcRenderer.invoke('delete-lesson', id),
  uploadMedia:    (data) => ipcRenderer.invoke('upload-media', data),

  // ── MASCOTE ───────────────────────────────────────────────────────────────
  getMascotTexts: ()     => ipcRenderer.invoke('get-mascot-texts'),
  saveMascotText: (data) => ipcRenderer.invoke('save-mascot-text', data),

  // ── FINANCEIRO: ARQUIVOS DE CONTRATO (via API) ─────────────────────────────
  abrirArquivo:    (path) => ipcRenderer.invoke('abrir-arquivo', path),

  // ── PERSONALIZAÇÃO: AVATARES E LOJA ────────────────────────────────────────
  getAvatares:       ()     => ipcRenderer.invoke('get-avatars'),
  createAvatar:      (data) => ipcRenderer.invoke('create-avatar', data),
  updateAvatar:      (data) => ipcRenderer.invoke('update-avatar', data),
  deleteAvatar:      (id)   => ipcRenderer.invoke('delete-avatar', id),
  uploadAvatarImage: (data) => ipcRenderer.invoke('upload-avatar-image', data),
  getStoreItems:     ()     => ipcRenderer.invoke('get-store-items'),
  createStoreItem:   (data) => ipcRenderer.invoke('create-store-item', data),
  updateStoreItem:   (data) => ipcRenderer.invoke('update-store-item', data),
  deleteStoreItem:   (id)   => ipcRenderer.invoke('delete-store-item', id),
  uploadStoreImage:  (data) => ipcRenderer.invoke('upload-store-image', data),

  // ── PERSONALIZAÇÃO UNIFICADA (via /personalizacao/*) ────────────────────────
  getPersonalizacaoAvatares:   ()     => ipcRenderer.invoke('personalizacao-avatares'),
  createPersonalizacaoAvatar:  (data) => ipcRenderer.invoke('personalizacao-avatar-create', data),
  updatePersonalizacaoAvatar:  (data) => ipcRenderer.invoke('personalizacao-avatar-update', data),
  deletePersonalizacaoAvatar:  (id)   => ipcRenderer.invoke('personalizacao-avatar-delete', id),
  getPersonalizacaoItens:      ()     => ipcRenderer.invoke('personalizacao-itens'),
  createPersonalizacaoItem:    (data) => ipcRenderer.invoke('personalizacao-item-create', data),
  updatePersonalizacaoItem:    (data) => ipcRenderer.invoke('personalizacao-item-update', data),
  deletePersonalizacaoItem:    (id)   => ipcRenderer.invoke('personalizacao-item-delete', id),
  uploadPersonalizacaoImagem:  (data) => ipcRenderer.invoke('personalizacao-upload', data),

  // ── DIÁLOGOS NATIVOS DO SO ─────────────────────────────────────────────────
  confirm: (opts) => ipcRenderer.invoke('dialog:confirm', opts),
  info:    (opts) => ipcRenderer.invoke('dialog:info',    opts),
  error:   (opts) => ipcRenderer.invoke('dialog:error',   opts),

  // ── JANELAS ───────────────────────────────────────────────────────────────
  openAbout:     () => ipcRenderer.invoke('window:about'),
  openRelatorio: () => ipcRenderer.invoke('window:relatorio'),
  closeWindow:   () => ipcRenderer.invoke('window:close'),

  // ── ESCUTAR MENSAGENS DO MAIN (push: main → renderer) ─────────────────────
  // Usado pelo menu de aplicação para pedir ao renderer que troque de seção.
  onMenuAction: (callback) => {
    const handler = (_event, acao) => callback(acao);
    ipcRenderer.on('menu:action', handler);
    // Retorna uma função de "limpeza" para remover o listener quando não for mais necessário
    // (previne memory leak — acúmulo de listeners inativos na memória)
    return () => ipcRenderer.removeListener('menu:action', handler);
  },

});
