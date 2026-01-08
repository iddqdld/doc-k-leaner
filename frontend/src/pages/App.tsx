
import React, { useState } from 'react';
import Layout from '../components/Layout';
import Scanner from '../components/Scanner';
import Dashboard from '../components/Dashboard';
import Infrastructure from '../components/Infrastructure';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('scanner');

  const renderContent = () => {
    switch (activeTab) {
      case 'scanner':
        return <Scanner />;
      case 'sandbox':
      case 'dashboard':
        return <Dashboard />;
      case 'infrastructure':
        return <Infrastructure />;
      default:
        // Render Scanner for other placeholder tabs per design
        return <Scanner />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
};

export default App;