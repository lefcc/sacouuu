import axios from 'axios';

// Base da API: vem do WEB/.env (VITE_API_URL). Fallback para o backend local.
// O rstrip garante que a URL nunca termine com "/" (evita rotas duplicadas).
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

// Sessão via cookie HttpOnly (sacou_token) — o JWT NUNCA é gravado em
// localStorage. Só o objeto de exibição do usuário (nome/perfil) é cacheado.
const USER_KEY = 'sacou_user';

export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
};
export const setUser = (usuario) => {
  if (usuario) localStorage.setItem(USER_KEY, JSON.stringify(usuario));
  else localStorage.removeItem(USER_KEY);
};

// Rotas públicas: um 401/403 nelas NÃO deve redirecionar para o login
// (ex.: a landing page e o /auth/me usado para restaurar a sessão).
const ROTAS_PUBLICAS = [
  '/auth/login',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/me',
  '/trilhas/public',
];

const http = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  // Envia o cookie HttpOnly da sessão em todas as requisições (same-site/cross-origin).
  withCredentials: true,
});

// Sem header Authorization manual: o token viaja apenas no cookie HttpOnly.

// Interceptor de resposta: 401/403 limpa a sessão local e redireciona para /login
// (exceto em rotas públicas, onde o erro é tratado pelo chamador).
http.interceptors.response.use(
  (resposta) => resposta,
  (erro) => {
    const status = erro?.response?.status;
    const url = erro?.config?.url || '';
    if ((status === 401 || status === 403) && !ROTAS_PUBLICAS.some((r) => url.includes(r))) {
      setUser(null);
      // Evita loop/recarregar na própria tela de login.
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(erro);
  },
);

// Encerra a sessão: remove o cookie no backend (best-effort) e limpa o cache local.
export const logout = async () => {
  try {
    await http.post('/auth/logout');
  } catch {
    // Sem conexão: ignora — o cookie expira naturalmente.
  }
  setUser(null);
};

export const api = {
  login: async (email, senha) => {
    const { data } = await http.post('/auth/login', { email, senha });
    // NUNCA lê data.access_token: a sessão do Web é o cookie HttpOnly.
    const { usuario } = data;
    setUser(usuario);
    return usuario;
  },

  auth: {
    me: () => http.get('/auth/me'),
    esqueciSenha: (email) => http.post('/auth/forgot-password', { email }),
    redefinirSenha: (token, novaSenha) =>
      http.post('/auth/reset-password', { token, nova_senha: novaSenha }),
  },

  escola: {
    obter: (id) => http.get(`/escolas/${id}`),
    listar: () => http.get('/escolas', { params: { arquivado: false } }),
    criar: (dados) => http.post('/escolas', dados),
    atualizar: (id, dados) => http.put(`/escolas/${id}`, dados),
    dashboard: (id, params) => http.get(`/escolas/${id}/dashboard`, { params }),
    getDesempenhoAlunos: (id) => http.get(`/escolas/${id}/desempenho-alunos`),
    turmas: {
      listar: (id) => http.get(`/escolas/${id}/turmas`),
      criar: (id, dados) => http.post(`/escolas/${id}/turmas`, dados),
    },
    usuarios: {
      listar: (id) => http.get(`/escolas/${id}/usuarios`),
      criar: (id, dados) => http.post(`/escolas/${id}/usuarios`, dados),
      alternarStatus: (id, usuarioId) => http.put(`/escolas/${id}/usuarios/${usuarioId}`),
      editar: (usuarioId, dados) => http.put(`/usuarios/${usuarioId}`, dados),
      arquivar: (usuarioId, arquivado) =>
        http.patch(`/usuarios/${usuarioId}`, { arquivado }),
    },
  },

  // Rotas de Turmas e Alunos (Bloco 3 — RBAC).
  turma: {
    listar: () => http.get('/turmas', { params: { arquivado: false } }),
    listarArquivadas: () => http.get('/turmas', { params: { arquivado: true } }),
    criar: (dados) => http.post('/turmas', dados),
    atualizar: (id, dados) => http.put(`/turmas/${id}`, dados),
    arquivar: (id, arquivado) => http.patch(`/turmas/${id}`, { arquivado }),
    adicionarAlunos: (id, dados) => http.post(`/turmas/${id}/alunos`, dados),
    removerAlunos: (id, dados) => http.delete(`/turmas/${id}/alunos`, { data: dados }),
  },
  aluno: {
    listarPorTurma: (turmaId) => http.get(`/turmas/${turmaId}/alunos`),
    criar: (dados) => http.post('/alunos', dados),
    arquivar: (id, arquivado) => http.patch(`/alunos/${id}`, { arquivado }),
    atualizar: (id, dados) => http.patch(`/alunos/${id}`, dados),
  },

  financeiro: {
    faturas: {
      listar: (escolaId) =>
        http.get('/financeiro/faturas', { params: { escola_id: escolaId } }),
    },
    resumo: (escolaId) =>
      http.get('/financeiro/resumo', {
        params: escolaId ? { escola_id: escolaId } : {},
      }),
    contratos: {
      listar: (escolaId) =>
        http.get('/financeiro/contratos', { params: { escola_id: escolaId } }),
      arquivos: {
        listar: (escolaId) => http.get(`/financeiro/contratos/${escolaId}/arquivos`),
        baixar: (arquivoId) =>
          http.get(`/financeiro/contratos/arquivos/${arquivoId}/download`, {
            responseType: 'blob',
          }),
      },
    },
  },

  // Trilhas públicas (landing page) — sem autenticação.
  trilhas: {
    publicas: () => http.get('/trilhas/public'),
  },
};

export default api;
