import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/api';

const RedefinirSenhaForm = ({ token }) => {
  const navigate = useNavigate();
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');

    if (senha.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (!/\d/.test(senha)) {
      setErro('A senha deve conter pelo menos 1 número.');
      return;
    }
    if (senha !== confirmar) {
      setErro('As senhas não coincidem.');
      return;
    }

    setCarregando(true);
    try {
      await api.auth.redefinirSenha(token, senha);
      setSucesso('Senha redefinida com sucesso! Redirecionando para o login...');
      setTimeout(() => navigate('/login', { replace: true }), 1800);
    } catch (err) {
      setErro(err?.response?.data?.detail || 'Não foi possível redefinir a senha. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-beige p-6">
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden max-w-md w-full">
        <div className="bg-brand-purple p-8 text-center text-white">
          <img
            src="/images/LogoPadrao.png"
            alt="Sacou"
            className="w-40 h-auto mx-auto mb-2"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <p className="font-body text-brand-beige/90 text-sm">Redefinição de senha</p>
        </div>

        <div className="p-8">
          <h2 className="text-xl font-title font-bold text-brand-dark mb-2">Criar nova senha</h2>
          <p className="text-brand-muted font-body text-sm mb-6">
            Escolha uma nova senha para a sua conta.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-brand-dark mb-1">Nova Senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres e 1 número"
                className="w-full p-3 rounded-xl border-2 border-brand-border outline-none focus:border-brand-purple font-body"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-brand-dark mb-1">Confirmar Senha</label>
              <input
                type="password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="Repita a nova senha"
                className="w-full p-3 rounded-xl border-2 border-brand-border outline-none focus:border-brand-purple font-body"
                required
              />
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm font-body font-semibold rounded-xl p-3">
                {erro}
              </div>
            )}

            {sucesso && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm font-body font-semibold rounded-xl p-3">
                {sucesso}
              </div>
            )}

            <button
              type="submit"
              disabled={carregando}
              className="w-full bg-brand-green text-white font-title font-bold p-3 rounded-xl shadow-md hover:bg-opacity-90 transition-all text-lg disabled:opacity-60"
            >
              {carregando ? 'Redefinindo...' : 'Redefinir Senha'}
            </button>

            <p className="text-center text-xs font-body">
              <Link to="/login" className="text-brand-purple hover:underline font-semibold">
                ← Voltar ao login
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RedefinirSenhaForm;
