import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import RedefinirSenhaForm from '../components/RedefinirSenhaForm';

const RedefinirSenhaPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-beige p-6">
        <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-8 text-center">
          <h2 className="text-xl font-title font-bold text-brand-dark mb-2">Link inválido</h2>
          <p className="text-brand-muted font-body text-sm mb-6">
            O link de redefinição está incompleto ou expirou. Solicite um novo link.
          </p>
          <Link
            to="/recuperar-senha"
            className="inline-block bg-brand-green text-white font-title font-bold p-3 rounded-xl shadow-md hover:bg-opacity-90"
          >
            Solicitar novo link
          </Link>
        </div>
      </div>
    );
  }

  return <RedefinirSenhaForm token={token} />;
};

export default RedefinirSenhaPage;
