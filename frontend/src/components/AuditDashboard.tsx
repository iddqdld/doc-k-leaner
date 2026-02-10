import React, { useEffect, useState } from 'react';
import { AuditStats, getAuditStats } from '../services/fileApi';

const AuditDashboard: React.FC = () => {
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadStats = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getAuditStats();
        if (isMounted) {
          setStats(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load stats');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadStats();
    return () => {
      isMounted = false;
    };
  }, []);

  const cards = stats
    ? [
        { label: 'Total Files', value: stats.total_files, color: 'bg-indigo-500', icon: '📄' },
        { label: 'Total Scans', value: stats.total_scans, color: 'bg-blue-500', icon: '📡' },
        { label: 'Critical', value: stats.critical, color: 'bg-red-500', icon: '⚠️' },
        { label: 'High', value: stats.high, color: 'bg-orange-500', icon: '🔥' },
        { label: 'Medium', value: stats.medium, color: 'bg-amber-500', icon: '🟡' },
        { label: 'Low', value: stats.low, color: 'bg-emerald-500', icon: '🟢' },
      ]
    : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="text-sm text-gray-500">Loading stats...</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">{stat.label}</p>
              <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
            </div>
            <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center text-white text-xl`}>
              {stat.icon}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuditDashboard;
