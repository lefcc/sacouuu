import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, logout } from '../api/api';

const PERFIS_PAINEL = ['ADMIN_ESCOLA', 'GESTOR_PLATAFORMA', 'VISUALIZADOR_ESCOLA', 'DEV'];

const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');

    if (!email || !senha) {
      setErro('Preencha e-mail e senha.');
      return;
    }

    setCarregando(true);
    try {
      const usuario = await api.login(email, senha);

      // REGRA DE OURO: aluno não entra no painel web (usa o app mobile).
      if (usuario?.perfil === 'ALUNO') {
        logout(); // limpa o token que o login já gravou
        setEmail('');
        setSenha('');
        setErro('Alunos devem acessar o sistema através do aplicativo mobile.');
        return;
      }

      if (!PERFIS_PAINEL.includes(usuario?.perfil)) {
        logout();
        setEmail('');
        setSenha('');
        setErro('Perfil sem acesso ao painel web.');
        return;
      }

      onLogin(usuario);
    } catch (err) {
      const msg = err?.response?.status === 401
        ? 'E-mail ou senha incorretos.'
        : err?.response?.data?.detail || 'Não foi possível conectar ao servidor.';
      setErro(msg);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-beige p-6">
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden max-w-4xl w-full grid grid-cols-1 md:grid-cols-2">

        {/* Lado Esquerdo: Mascote e Boas-vindas */}
        <div className="bg-brand-purple p-12 flex flex-col items-center justify-center text-center text-white space-y-6">
          <img
            src="/images/Mascote.png"
            alt="Mascote Sacou"
            className="w-48 h-auto drop-shadow-lg animate-bounce"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <div className="flex flex-col items-center space-y-2">
            <img
              src="/images/LogoPadrao.png"
              alt="Sacou"
              className="w-48 md:w-64 h-auto mx-auto mb-8"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <p className="font-body text-brand-beige/90 text-sm">
              A plataforma de educação financeira para os jovens do Ensino Médio.
            </p>
          </div>
        </div>

        {/* Lado Direito: Formulário de Login */}
        <div className="p-12 flex flex-col justify-center">
          <h2 className="text-2xl font-title font-bold text-brand-dark mb-2">Bem-vindo, Coordenador!</h2>
          <p className="text-brand-muted font-body text-sm mb-8">Insira suas credenciais para gerenciar sua escola.</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-brand-dark mb-1">E-mail Corporativo</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Digite o email cadastrado"
                className="w-full p-3 rounded-xl border-2 border-brand-border outline-none focus:border-brand-purple font-body"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-brand-dark mb-1">Senha de Acesso</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite sua senha"
                className="w-full p-3 rounded-xl border-2 border-brand-border outline-none focus:border-brand-purple font-body"
                required
              />
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm font-body font-semibold rounded-xl p-3">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={carregando}
              className="w-full bg-brand-green text-white font-title font-bold p-3 rounded-xl shadow-md hover:bg-opacity-90 transition-all text-lg disabled:opacity-60"
            >
              {carregando ? 'Entrando...' : 'Entrar no Painel'}
            </button>

            <p className="text-center text-xs font-body">
              <Link to="/recuperar-senha" className="text-brand-purple hover:underline font-semibold">
                Esqueci minha senha
              </Link>
              <span className="text-brand-muted"> · </span>
              <Link to="/" className="text-brand-purple hover:underline font-semibold">
                ← Voltar ao site
              </Link>
            </p>
          </form>

          {/* Rodapé do cartão: contato por e-mail (mailto direto) */}
          <div className="mt-8 pt-6 border-t border-brand-border text-center">
            <a
              href="mailto:sacoueducacao@gmail.com"
              className="text-brand-purple hover:underline font-semibold font-body text-sm"
            >
              📧 Entre em contato
            </a>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;
