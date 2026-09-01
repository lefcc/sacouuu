import React, { useState } from 'react';
import Sidebar from './Sidebar';

const Layout = ({ children, onLogout }) => {
  // Estado de visibilidade da sidebar:
  // - isCollapsed: desktop (encolhe para apenas ícones).
  // - isMobileOpen: mobile (< md) — a sidebar vira um drawer sobreposto.
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const ehMobile = () =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

  // Em telas pequenas abre/fecha o drawer; em médias/grandes encolhe/expande.
  const toggleSidebar = () => {
    if (ehMobile()) {
      setIsMobileOpen((prev) => !prev);
    } else {
      setIsCollapsed((prev) => !prev);
    }
  };

  return (
    <div className="min-h-screen bg-brand-beige dark:bg-brand-dark-deeper">
      {/* Backdrop (fundo escuro) — apenas no mobile, fecha o drawer ao clicar */}
      <div
        onClick={() => setIsMobileOpen(false)}
        className={`
          fixed inset-0 z-40 bg-black/50 md:hidden transition-opacity duration-300
          ${isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
      />

      <Sidebar
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        onToggle={toggleSidebar}
        onCloseMobile={() => setIsMobileOpen(false)}
        onLogout={onLogout}
      />

      {/* Área principal: margem acompanha a sidebar no desktop; no mobile ocupa 100% */}
      <main
        className={`
          flex-1 min-w-0 min-h-screen p-8 transition-all duration-300 ease-in-out
          ml-0 ${isCollapsed ? 'md:ml-20' : 'md:ml-64'}
        `}
      >
        {/* Botão de menu (hambúrguer) — visível apenas no mobile para abrir o drawer */}
        <div className="mb-6 md:hidden">
          <button
            onClick={toggleSidebar}
            aria-label="Abrir menu"
            className="inline-flex items-center justify-center p-2.5 rounded-xl border-2 border-brand-border dark:border-brand-dark-border text-brand-muted hover:text-brand-purple hover:border-brand-purple transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
