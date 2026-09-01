import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api/api';

const LandingPage = ({ autenticado }) => {
  // Trilhas reais do banco (endpoint público /trilhas/public).
  const [trilhasReais, setTrilhasReais] = useState([]);
  const [carregandoTrilhas, setCarregandoTrilhas] = useState(true);

  useEffect(() => {
    let ativo = true;
    api.trilhas
      .publicas()
      .then(({ data }) => {
        if (ativo) setTrilhasReais(data || []);
      })
      .catch(() => {
        if (ativo) setTrilhasReais([]);
      })
      .finally(() => {
        if (ativo) setCarregandoTrilhas(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  // Já logado? Vai direto para o painel (não fica na landing page).
  if (autenticado) {
    return <Navigate to="/dashboard" replace />;
  }

  const devs = [
    { nome: 'João Allegre', papel: 'Desenvolvedor', foto: '/fotos/joao.png' },
    { nome: 'Letícia Campos', papel: 'Desenvolvedora', foto: '/fotos/leticia.png' },
    { nome: 'Maria Avelino', papel: 'Desenvolvedora', foto: '/fotos/maria.jpeg' },
  ];

  return (
    <div className="min-h-screen bg-brand-beige dark:bg-brand-dark-deeper font-body text-brand-dark dark:text-white">

      {/* Barra de navegação */}
      <header className="sticky top-0 z-20 bg-brand-purple dark:bg-brand-dark text-white shadow-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img
              src="/images/LogoPadrao.png"
              alt="Sacou"
              className="h-10 w-auto"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </Link>
          <Link
            to="/login"
            className="bg-brand-green hover:bg-brand-green-dark transition-colors font-title font-bold px-5 py-2 rounded-xl"
          >
            Acessar Painel
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-brand-purple dark:bg-brand-dark-deeper text-white">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <img
            src="/images/Mascote.png"
            alt="Mascote Sacou"
            className="w-40 md:w-56 h-auto mx-auto mb-8 drop-shadow-xl"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <h1 className="font-title text-5xl md:text-6xl font-bold tracking-tight text-brand-lightGreen">
            Educação financeira para Jovens
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-brand-beige/90 text-lg">
            Painel completo para gestão de trilhas de ensino, aulas, perguntas,
            avatares, relatórios e muito mais.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              to="/login"
              className="bg-brand-green hover:bg-brand-green-dark transition-colors font-title font-bold px-8 py-3 rounded-xl"
            >
              Entrar no Painel Escolar
            </Link>
            <a
              href="#sobre"
              className="bg-white/10 hover:bg-white/20 transition-colors font-title font-bold px-8 py-3 rounded-xl"
            >
              Conhecer o projeto
            </a>
          </div>
        </div>
      </section>

      {/* Sobre o Projeto */}
      <section id="sobre" className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-title text-4xl font-bold text-brand-purple dark:text-brand-lightGreen text-center">
            Sobre o Projeto
          </h2>
          <p className="mt-6 max-w-3xl mx-auto text-center text-brand-muted dark:text-brand-muted-dark text-lg leading-relaxed">
            O <strong className="text-brand-dark dark:text-white">Sacou</strong> é um ecossistema educacional
            criado no Projeto Integrador do COTIL. Ele une um aplicativo mobile para
            os alunos, um painel web para gestores escolares e um painel administrativo
            desktop — tudo em torno de um objetivo: ensinar acúmulo de capital e
            prevenção de endividamento de forma leve, divertida e gamificada.
          </p>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { t: 'Para os Alunos', d: 'Aulas narradas, quiz gamificado e moedas por desempenho no app mobile.' },
              { t: 'Para a Escola', d: 'Dashboard com ranking, turmas e gestão de alunos no painel web.' },
              { t: 'Para a Gestão', d: 'Conteúdo, loja, avatares e relatórios no painel administrativo.' },
            ].map((c) => (
              <div key={c.t} className="bg-white dark:bg-brand-dark-surface rounded-2xl shadow-sm border border-brand-border dark:border-brand-dark-border p-6">
                <h3 className="font-title text-xl font-bold text-brand-purple dark:text-brand-lightGreen mb-2">{c.t}</h3>
                <p className="text-brand-muted dark:text-brand-muted-dark text-sm leading-relaxed">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trilha de Ensino */}
      <section className="py-20 bg-white dark:bg-brand-dark-surface">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-title text-4xl font-bold text-brand-purple dark:text-brand-lightGreen text-center">
            Trilha de Ensino
          </h2>
          <p className="mt-4 max-w-3xl mx-auto text-center text-brand-muted dark:text-brand-muted-dark text-lg">
            O aprendizado é dividido em trilhas progressivas. Cada aula concluída
            desbloqueia a próxima e rende moedas para personalizar o avatar.
          </p>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {carregandoTrilhas ? (
              // Skeleton enquanto carrega
              [0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-brand-beige dark:bg-brand-dark rounded-2xl border border-brand-border dark:border-brand-dark-border p-6 animate-pulse"
                >
                  <div className="h-9 w-12 rounded-lg bg-brand-border/60 dark:bg-brand-dark-border/60"></div>
                  <div className="mt-3 h-6 w-3/4 rounded bg-brand-border/60 dark:bg-brand-dark-border/60"></div>
                  <div className="mt-3 h-4 w-full rounded bg-brand-border/40 dark:bg-brand-dark-border/40"></div>
                </div>
              ))
            ) : trilhasReais.length === 0 ? (
              <div className="md:col-span-3 text-center text-brand-muted dark:text-brand-muted-dark">
                Novas trilhas em breve
              </div>
            ) : (
              trilhasReais.map((trilha, index) => (
                <div
                  key={trilha.id_trilha}
                  className="bg-brand-beige dark:bg-brand-dark rounded-2xl border border-brand-border dark:border-brand-dark-border p-6"
                >
                  <span className="font-title text-3xl font-bold text-brand-lightGreen">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-2 font-title text-xl font-bold text-brand-dark dark:text-white">
                    {trilha.nome_trilha}
                  </h3>
                  <p className="mt-2 text-brand-muted dark:text-brand-muted-dark text-sm leading-relaxed">
                    {trilha.qtd_licoes > 0
                      ? `${trilha.qtd_licoes} ${trilha.qtd_licoes === 1 ? 'aula' : 'aulas'} nesta trilha.`
                      : 'Conteúdo em preparação.'}
                  </p>
                </div>
              ))
            )}
          </div>
          <p className="mt-8 text-center text-sm text-brand-muted dark:text-brand-muted-dark">
            Quiz com recompensas, reserva de emergência, juros compostos e mais — tudo na palma da mão.
          </p>
        </div>
      </section>

      {/* Desenvolvedores */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-title text-4xl font-bold text-brand-purple dark:text-brand-lightGreen text-center">
            Desenvolvedores
          </h2>
          <p className="mt-4 text-center text-brand-muted dark:text-brand-muted-dark">
            Equipe responsável pela idealização e desenvolvimento
          </p>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {devs.map((d) => (
              <div key={d.nome} className="bg-white dark:bg-brand-dark-surface rounded-2xl shadow-sm border border-brand-border dark:border-brand-dark-border p-6 text-center">
                {/* Foto do Desenvolvedor */}
                <div className="mx-auto w-20 h-20 rounded-full overflow-hidden border-2 border-brand-purple dark:border-brand-purple-dark">
                  <img
                    src={d.foto}
                    alt={`Foto de ${d.nome}`}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }} // Esconde se a foto não carregar
                  />
                </div>

                <h3 className="mt-4 font-title text-lg font-bold text-brand-dark dark:text-white">{d.nome}</h3>
                <p className="mt-1 text-sm text-brand-muted dark:text-brand-muted-dark">{d.papel}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Entre em Contato */}
      <section className="py-20 bg-brand-purple dark:bg-brand-dark-deeper text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-title text-4xl font-bold text-brand-lightGreen">Entre em Contato</h2>
          <p className="mt-4 text-brand-beige/90 text-lg">
            Quer levar o Sacou para a sua escola? Fale com a gente!
          </p>
          <a
            href="mailto:sacoueducacao@gmail.com"
            className="inline-block mt-8 bg-brand-green hover:bg-brand-green-dark transition-colors font-title font-bold px-8 py-3 rounded-xl"
          >
            ✉️ sacoueducacao@gmail.com
          </a>
        </div>
      </section>

      {/* Rodapé */}
      <footer className="py-8 bg-brand-dark text-brand-muted-dark">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm">
          <span className="font-title text-lg text-brand-lightGreen">Sacou</span> · Educação Financeira para o Ensino Médio
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
