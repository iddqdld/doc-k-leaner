import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AuditStats, getAuditStats } from '../services/fileApi';

const AuditDashboard: React.FC = () => {
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAuditStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
    const refreshId = window.setInterval(() => {
      void loadStats();
    }, 30000);

    return () => {
      window.clearInterval(refreshId);
    };
  }, [loadStats]);

  const cards = useMemo(
    () =>
      stats
        ? [
            { label: 'Total Files', value: stats.total_files, color: 'bg-indigo-500', icon: 'FI', description:'Cet indicateur montre le nombre de fichier que vous avez insérer dans notre scanner' },
            { label: 'Total Scans', value: stats.total_scans, color: 'bg-blue-500', icon: 'SC', description:'Cet indicateur montre le nombre de fichier que vous avez scanné (ce nombre devrait être égale à celui du nombre de fichier que vous avez rentré sinon ça veut dire que vous oublié de scanner au moins un fichier)' },
            { label: 'Critical', value: stats.critical, color: 'bg-red-500', icon: 'CR', description: 'Cet indicateur vous donne le nombre de fichier en état critique' },
            { label: 'High', value: stats.high, color: 'bg-orange-500', icon: 'HI', description:'Cet indicateur vous donne le nombre de fichier en état haut risque' },
            { label: 'Medium', value: stats.medium, color: 'bg-amber-500', icon: 'ME', description:'Cet indicateur vous donne le nombre de fichier en état moyen risque' },
            { label: 'Low', value: stats.low, color: 'bg-emerald-500', icon: 'LO', description:'Cet indicateur vous donne le nombre de fichier en état faible risque' },
          ]
        : [],
    [stats]
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Audit Overview</h2>
        <button
          className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-60"
          onClick={loadStats}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-orange-500 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {isLoading && <div className="text-sm text-gray-500">Loading stats...</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((stat) => (
          <div
            key={stat.label}
            className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between"
          >
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">{stat.label}</p>
              <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
              <div className="text-sm text-gray-500 mt-2">{stat.description}</div>
            </div>
            <div
              className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center text-white text-xs font-semibold tracking-wide`}
            >
              {stat.icon}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuditDashboard;
