
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'sandbox', label: 'Sandbox', icon: '📦' },
    { id: 'scanner', label: 'Analyses Rapides', icon: '📄' },
    { id: 'collections', label: 'Collections de Fichiers', icon: '📁' },
    { id: 'ressources', label: 'Ressources', icon: '📁' },
    { id: 'demande', label: "Demande D'Informations", icon: '❓' },
    { id: 'plus', label: 'Plus...', icon: '' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfdfd]">
      {/* Top Navbar */}
      <nav className="bg-[#5d2e8e] text-white px-4 h-12 flex items-center shadow-md z-50">
        <div className="flex items-center space-x-6 overflow-x-auto no-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 text-xs font-medium whitespace-nowrap hover:text-orange-400 transition-colors ${
                activeTab === item.id ? 'text-orange-400' : 'text-gray-200'
              }`}
            >
              <span>{item.icon}</span>
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
      <footer className="bg-[#5d2e8e] h-24 w-full mt-auto"></footer>
    </div>
  );
};

export default Layout;
