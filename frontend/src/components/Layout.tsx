
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
  { id: 'demande', label: "Demande d'informations" },
  { id: 'infrastructure', label: 'Infrastructure' },
];

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  return (
    <div className="min-h-screen flex flex-col bg-[radial-gradient(circle_at_top,_#f8f4ff_0,_#fdfdfd_48%,_#f4f8ff_100%)]">
      {/* Top Navbar */}
      <nav className="bg-[#3a165d] text-white px-4 h-14 flex items-center shadow-md z-50 border-b border-white/10">
        <div className="flex items-center space-x-6 overflow-x-auto no-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`text-xs tracking-wide font-semibold whitespace-nowrap transition-colors ${
                activeTab === item.id
                  ? 'text-amber-300'
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
