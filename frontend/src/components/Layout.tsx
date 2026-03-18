import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const baseNavItems = [
  { id: 'sandbox', label: 'Dashboard' },
  { id: 'scanner', label: 'Analyse Fichiers' },
  { id: 'solidity', label: 'Solidity Scanner' },
  { id: 'collections', label: 'Sandbox' },
  { id: 'infrastructure', label: 'Infrastructure' },
];

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const { user, logout } = useAuth();

  const handleNav = useCallback(
    (id: string) => {
      setActiveTab(id);
      setSidebarOpen(false);
    },
    [setActiveTab],
  );

  const navItems = [
    ...baseNavItems.slice(0, 4),
    ...(user?.role === 'admin' ? [{ id: 'ressources', label: 'Ressources' }] : []),
    baseNavItems[4],
  ];

  useEffect(() => {
    if (activeTab === 'ressources' && (!user || user.role !== 'admin')) {
      setActiveTab('scanner');
    }
  }, [activeTab, user, setActiveTab]);

  const allNavItems = user
    ? [...navItems, { id: 'history', label: 'Mon historique' }]
    : navItems;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8f4ff_0,_#fdfdfd_48%,_#f4f8ff_100%)]">
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-[#3a165d] flex items-center px-4 z-40 lg:hidden border-b border-white/10">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-white hover:text-orange-500 transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <a
          href="https://github.com/iddqdld/doc-k-leaner"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-4 text-xl font-black text-orange-500 tracking-tight hover:text-orange-400 transition-colors"
        >
          Doc(k)leaner
        </a>
      </div>

      {/* Backdrop overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-screen w-60 bg-[#3a165d] z-50 flex flex-col
          border-r border-white/10 shadow-xl
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        {/* Brand */}
        <div className="px-6 py-6 border-b border-white/10">
          <a
            href="https://github.com/iddqdld/doc-k-leaner"
            target="_blank"
            rel="noopener noreferrer"
            className="text-2xl font-black text-orange-500 tracking-tight hover:text-orange-400 transition-colors"
          >
            Doc(k)leaner
          </a>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {allNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`
                w-full text-left px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide
                transition-all duration-150
                ${
                  activeTab === item.id
                    ? 'text-orange-500 bg-white/10 border-l-2 border-orange-500'
                    : 'text-violet-100/80 hover:text-white hover:bg-white/5'
                }
              `}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Bottom: Auth + GitHub */}
        <div className="px-4 py-4 border-t border-white/10 space-y-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#5d2e8e] flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white font-semibold truncate">{user.name}</div>
                <div className="text-[10px] text-violet-200/50 truncate">{user.email}</div>
              </div>
              <button
                onClick={() => { logout(); setActiveTab('scanner'); }}
                className="text-violet-200/40 hover:text-white transition-colors shrink-0"
                title="Se déconnecter"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold tracking-wide text-orange-500 hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Se connecter
            </button>
          )}
          <a
            href="https://github.com/iddqdld/doc-k-leaner"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-violet-200/60 hover:text-white transition-colors text-xs px-1"
          >
            <svg height="16" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Voir sur GitHub
          </a>
        </div>
      </aside>

      {/* Main content area */}
      <main className="min-h-screen pt-14 lg:pt-0 lg:ml-60">
        <div className="w-full max-w-7xl mx-auto px-4 py-12 flex flex-col items-center">
          {children}
        </div>
      </main>

      {/* Auth modal */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
};

export default Layout;
