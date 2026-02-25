
import React, { Suspense, lazy, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import Scanner from '../components/Scanner';
import Dashboard from '../components/Dashboard';
import AuditDashboard from '../components/AuditDashboard';
import Infrastructure from '../components/Infrastructure';
import Sandbox from '../components/Sandbox';

const Scanner = lazy(() => import('../components/Scanner'));
const Dashboard = lazy(() => import('../components/Dashboard'));
const AuditDashboard = lazy(() => import('../components/AuditDashboard'));
const Infrastructure = lazy(() => import('../components/Infrastructure'));

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('scanner');

  const content = useMemo(() => {
    switch (activeTab) {
      case 'scanner':
        return <Scanner />;
      case 'sandbox':
        return <AuditDashboard />;
      case 'collections':
        return <Sandbox />;
      case 'ressources':
        return <Dashboard />;
      case 'infrastructure':
        return <Infrastructure />;
      default:
        // Render Scanner for other placeholder tabs per design
        return <Scanner />;
    }
  }, [activeTab]);

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <Suspense fallback={<div className="w-full text-center text-sm text-gray-500 py-10">Chargement...</div>}>
        {content}
      </Suspense>
    </Layout>
  );
};

export default App;
