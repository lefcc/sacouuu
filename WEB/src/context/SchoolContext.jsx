import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import { getUser, logout as apiLogout, api } from '../api/api';

const SchoolContext = createContext();

const ESCOLA_STORAGE_KEY = 'sacou_escola';

// Estado inicial: usa os dados persistidos (F5) ou, na falta, só o id do usuário.
const escolaInicial = () => {
  try {
    const salva = JSON.parse(localStorage.getItem(ESCOLA_STORAGE_KEY));
    if (salva?.id_escola && salva?.nome_instituicao) return salva;
  } catch {
    // Dados corrompidos no storage: ignora e recupera via API.
  }
  const user = getUser();
  return user?.id_escola
    ? { id_escola: user.id_escola, nome_instituicao: '', cnpj: '' }
    : { id_escola: null, nome_instituicao: '', cnpj: '' };
};

export const SchoolProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(getUser());
  const [escolaAtual, setEscolaAtual] = useState(escolaInicial);

  // Persiste a escola para restaurar instantaneamente após F5.
  useEffect(() => {
    if (escolaAtual?.id_escola) {
      localStorage.setItem(ESCOLA_STORAGE_KEY, JSON.stringify(escolaAtual));
    } else {
      localStorage.removeItem(ESCOLA_STORAGE_KEY);
    }
  }, [escolaAtual]);

  // A escola é carregada APENAS em definirSessao (disparado por App.jsx via
  // api.auth.me() no mount/login). Sem efeito duplicado aqui — evita o 2º
  // GET /escolas/{id} no F5/Login.

  // Após o login, grava o usuário e busca os dados da escola na API
  const definirSessao = useCallback(async (user) => {
    setUsuario(user);
    setEscolaAtual({
      id_escola: user.id_escola || null,
      nome_instituicao: '',
      cnpj: '',
    });

    if (user.id_escola) {
      try {
        const { data } = await api.escola.obter(user.id_escola);
        setEscolaAtual({
          id_escola: data.id_escola,
          nome_instituicao: data.nome_instituicao,
          cnpj: data.cnpj || '',
        });
      } catch {
        // Sem conexão: mantém só o id, o nome é preenchido depois
      }
    }
  }, []);

  const atualizarEscola = useCallback((novosDados) => {
    setEscolaAtual((atual) => ({ ...atual, ...novosDados }));
  }, []);

  const sair = useCallback(() => {
    apiLogout();
    localStorage.removeItem(ESCOLA_STORAGE_KEY);
    setUsuario(null);
    setEscolaAtual({ id_escola: null, nome_instituicao: '', cnpj: '' });
  }, []);

  // Valor memoizado: só muda quando usuario/escolaAtual mudam de fato.
  // Evita re-render de TODA a árvore (Dashboard, Sidebar, páginas) a cada render do provider.
  const value = useMemo(
    () => ({ usuario, escolaAtual, atualizarEscola, definirSessao, sair }),
    [usuario, escolaAtual, atualizarEscola, definirSessao, sair],
  );

  return (
    <SchoolContext.Provider value={value}>
      {children}
    </SchoolContext.Provider>
  );
};

export const useSchool = () => {
  const context = useContext(SchoolContext);
  if (!context) {
    throw new Error('useSchool deve ser usado dentro de um SchoolProvider');
  }
  return context;
};
