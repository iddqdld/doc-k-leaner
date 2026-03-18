
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const navItems = [
  { id: 'sandbox', label: 'Audit' },
  { id: 'scanner', label: 'Analyse Fichiers' },
  { id: 'solidity', label: 'Solidity Scanner' },
  { id: 'collections', label: 'Sandbox' },
  { id: 'ressources', label: 'Ressources' },
 // { id: 'demande', label: "Demande d'informations" },
  { id: 'infrastructure', label: 'Infrastructure' },
];

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  return (
    <div className="min-h-screen flex flex-col bg-[radial-gradient(circle_at_top,_#f8f4ff_0,_#fdfdfd_48%,_#f4f8ff_100%)]">
      {/* Top Navbar */}
      <nav className="bg-[#3a165d] text-white px-4 h-14 flex items-center shadow-md z-50 border-b border-white/10">
        <div className="flex items-center space-x-6 overflow-x-auto no-scrollbar">
        <div className="flex items-center mr-8 border-r border-white/20 pr-6">
            <a 
              href="https://github.com/iddqdld/doc-k-leaner"
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-orange-500 transition-colors flex items-center gap-2"
              title="Voir sur GitHub"
            >
              <svg 
                height="28" 
                viewBox="0 0 16 16" 
                fill="currentColor" 
                className="w-7 h-7"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
              </svg>
              <span className="hidden sm:inline font-bold text-sm tracking-tight">GitHub</span>
            </a>
          </div>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`text-xs tracking-wide font-semibold whitespace-nowrap transition-colors ${
                activeTab === item.id
                  ? 'text-orange-500'
                  : 'text-violet-100/80 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-12 flex flex-col items-center">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#3a165d] h-16 w-full mt-auto border-t border-white/10"></footer>
    </div>
  );
};

export default Layout;
