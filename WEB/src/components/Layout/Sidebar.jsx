import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSchool } from '../../context/SchoolContext'; // <-- Importação do contexto

const Sidebar = ({ isCollapsed, isMobileOpen, onToggle, onCloseMobile, onLogout }) => {
  const { escolaAtual, usuario } = useSchool(); // <-- Chamada dos dados da escola logada
  const navigate = useNavigate();
  const location = useLocation();

  const nomePerfil = usuario?.nome_completo || 'Coordenador';
  const perfilTraduzido = {
    ADMIN: 'Administrador',
    COORDENADOR: 'Coordenador',
    PROFESSOR: 'Professor',
    ALUNO: 'Aluno',
  }[usuario?.tipo_perfil] || 'Coordenador';

  // RBAC de navegação: Professor (VISUALIZADOR_ESCOLA) não vê Financeiro.
  // (A página "Gerenciar Escola" foi removida do Web — é exclusiva do Desktop.)
  const ehProfessor = usuario?.perfil === 'VISUALIZADOR_ESCOLA' || usuario?.tipo_perfil === 'PROFESSOR';

  const menuItems = [
    {
      label: 'Dashboard',
      route: '/dashboard',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
    },
    {
      label: 'Turmas',
      route: '/turmas',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
    },
    {
      label: 'Usuários',
      route: '/usuarios',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
    },
    {
      label: 'Financeiro',
      route: '/financeiro',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17  5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
    },
  ].filter((item) => !(ehProfessor && item.route === '/financeiro'));

  const irPara = (route) => {
    navigate(route);
    if (onCloseMobile) onCloseMobile(); // fecha o drawer no mobile após navegar
  };

  return (
    <aside
      className={`
        h-screen bg-brand-purple dark:bg-brand-dark-deeper text-white flex flex-col
        fixed inset-y-0 left-0 z-50
        transition-all duration-300 ease-in-out
        w-64 ${isCollapsed ? 'md:w-20' : 'md:w-64'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}
    >
      {/* Topo: logo (ícone/wordmark) + botão de toggle */}
      <div className="px-4 pt-5 pb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Ícone do mascote — sempre visível e centralizado */}
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-xl bg-white/10">
            <img
              src="/images/Mascote.png"
              alt=""
              className="w-7 h-7 object-contain"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </span>
          {/* Wordmark "Sacou" — some quando colapsado */}
          <span className={`overflow-hidden transition-all duration-200 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
            <img
              src="/images/LogoPadrao.png"
              alt="Sacou"
              className="h-7 w-auto"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </span>
        </div>
        {/* Botão de colapsar (desktop) / fechar (mobile) */}
        <button
          onClick={onToggle}
          className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Alternar menu"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isCollapsed ? (
              <>
                <path d="M13 5l7 7-7 7"></path>
                <path d="M5 5l7 7-7 7"></path>
              </>
            ) : (
              <>
                <path d="M11 5l-7 7 7 7"></path>
                <path d="M19 5l-7 7 7 7"></path>
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Escola + perfil logado */}
      <div className={`px-4 pb-4 overflow-hidden transition-opacity duration-200 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
        <span className="text-sm font-bold text-white block font-body truncate" title={escolaAtual?.nome_instituicao || escolaAtual?.nome}>
          {escolaAtual?.nome_instituicao || escolaAtual?.nome}
        </span>
        <span className="text-xs opacity-70 font-body block truncate" title={nomePerfil}>
          {nomePerfil} · {perfilTraduzido}
        </span>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const ativo = location.pathname === item.route;
          return (
            <button
              key={item.route}
              onClick={() => irPara(item.route)}
              title={isCollapsed ? item.label : undefined}
              className={`
                w-full flex items-center gap-4 px-3 py-3 rounded-xl transition-colors font-body text-sm font-medium
                ${ativo ? 'bg-white/15 text-brand-lightGreen' : 'hover:bg-white/10'}
                ${isCollapsed ? 'justify-center' : 'justify-start text-left'}
              `}
            >
              <span className="shrink-0 flex items-center justify-center">{item.icon}</span>
              {!isCollapsed && (
                <span className="transition-opacity duration-200 opacity-100 whitespace-nowrap">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Botão Sair */}
      <div className="px-3 pb-6 pt-4 mt-auto border-t border-white/10">
        <button
          onClick={onLogout}
          className={`
            w-full flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-brand-red/20 transition-colors font-body text-sm font-medium text-brand-red
            ${isCollapsed ? 'justify-center' : 'justify-start text-left'}
          `}
          title={isCollapsed ? 'Sair' : undefined}
        >
          <span className="shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </span>
          {!isCollapsed && <span className="transition-opacity duration-200 opacity-100 whitespace-nowrap">Sair</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
