import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import RecuperarSenhaPage from './pages/RecuperarSenhaPage';
import RedefinirSenhaPage from './pages/RedefinirSenhaPage';
import DashboardPage from './pages/DashboardPage';
import TurmasPage from './pages/TurmasPage';
import UsuariosPage from './pages/UsuariosPage';
import FinanceiroPage from './pages/FinanceiroPage';
import Layout from './components/Layout/Layout';
import { useSchool } from './context/SchoolContext';
import { api, getUser } from './api/api';

const ROTAS_PUBLICAS = ['/', '/login', '/recuperar-senha', '/redefinir-senha'];

function AppRoutes() {
  const { definirSessao, sair } = useSchool();
  const [autenticado, setAutenticado] = useState(false);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Rotas públicas renderizam imediatamente; o me() roda em background e,
  // se houver cookie válido, atualiza autenticado (redirect da Landing p/ painel).
  const ehRotaPublica = ROTAS_PUBLICAS.includes(location.pathname);

  // Restaura a sessão a partir do cookie HttpOnly (sacou_token) via GET /auth/me.
  // O JWT nunca está no localStorage — apenas o cookie, invisível ao JS.
  // Em rota pública SEM usuário cacheado (visitante), NADA é chamado — a Landing
  // não dispara um 401 desnecessário.
  useEffect(() => {
    if (ehRotaPublica && !getUser()) {
      setCarregandoSessao(false);
      return;
    }
    let ativo = true;
    api.auth
      .me()
      .then(({ data }) => {
        if (ativo) {
          definirSessao(data);
          setAutenticado(true);
        }
      })
      .catch(() => {
        if (ativo) setAutenticado(false);
      })
      .finally(() => {
        if (ativo) setCarregandoSessao(false);
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (usuario) => {
    await definirSessao(usuario);
    setAutenticado(true);
    navigate('/dashboard', { replace: true });
  };

  const handleLogout = () => {
    sair(); // limpa o cookie (api.logout) + estado local
    setAutenticado(false);
    navigate('/login', { replace: true });
  };

  // O "Carregando..." global bloqueia APENAS rotas protegidas — a Landing e o
  // Login renderizam na hora, sem spinner nem espera pelo /auth/me.
  if (carregandoSessao && !ehRotaPublica) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-beige dark:bg-brand-dark-deeper">
        <span className="text-brand-muted font-body">Carregando...</span>
      </div>
    );
  }

  return (
    <Routes>
      {/* Landing page pública; usuário logado é redirecionado para o painel. */}
      <Route path="/" element={<LandingPage autenticado={autenticado} />} />
      <Route
        path="/login"
        element={
          autenticado ? <Navigate to="/dashboard" replace /> : <LoginPage onLogin={handleLogin} />
        }
      />
      {/* Recuperação de senha (público) */}
      <Route path="/recuperar-senha" element={<RecuperarSenhaPage />} />
      <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />

      {/* Painel (protegido) */}
      <Route path="/dashboard" element={<Protected autenticado={autenticado} onLogout={handleLogout}><DashboardPage /></Protected>} />
      <Route path="/turmas" element={<Protected autenticado={autenticado} onLogout={handleLogout}><TurmasPage /></Protected>} />
      <Route path="/usuarios" element={<Protected autenticado={autenticado} onLogout={handleLogout}><UsuariosPage /></Protected>} />
      <Route path="/financeiro" element={<Protected autenticado={autenticado} onLogout={handleLogout}><FinanceiroPage /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Rota protegida: sem token, volta para o login.
function Protected({ autenticado, onLogout, children }) {
  return autenticado ? (
    <Layout onLogout={onLogout}>{children}</Layout>
  ) : (
    <Navigate to="/login" replace />
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
