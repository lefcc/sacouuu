import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/api';
import RedefinirSenhaForm from '../components/RedefinirSenhaForm';

const RecuperarSenhaPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // Se veio com ?token= na URL (link do e-mail), mostra direto a redefinição.
  if (token) {
    return <RedefinirSenhaForm token={token} />;
  }

  return <FormularioEmail />;
};

const FormularioEmail = () => {
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setEnviado(false);

    if (!email.trim()) {
      setErro('Informe seu e-mail.');
      return;
    }

    setCarregando(true);
    try {
      await api.auth.esqueciSenha(email.trim());
      setEnviado(true);
      setEmail('');
    } catch (err) {
      setErro(err?.response?.data?.detail || 'Não foi possível processar a solicitação.');
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
          <p className="font-body text-brand-beige/90 text-sm">Recuperação de senha</p>
        </div>

        <div className="p-8">
          <h2 className="text-xl font-title font-bold text-brand-dark mb-2">Esqueceu sua senha?</h2>
          <p className="text-brand-muted font-body text-sm mb-6">
            Digite o e-mail cadastrado e enviaremos um link para redefinir a sua senha.
          </p>

          {enviado ? (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm font-body font-semibold rounded-xl p-4 text-center">
              Se o e-mail existir, você receberá um link de recuperação.
              <p className="mt-3">
                <Link to="/login" className="text-brand-purple hover:underline font-semibold">
                  ← Voltar ao login
                </Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-brand-dark mb-1">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="coordenacao@escola.com"
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
                {carregando ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>

              <p className="text-center text-xs font-body">
                <Link to="/login" className="text-brand-purple hover:underline font-semibold">
                  ← Voltar ao login
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecuperarSenhaPage;
