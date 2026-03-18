import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { AuditStats, getAuditStats } from '../services/fileApi';

ChartJS.register(ArcElement, Tooltip, Legend);

const SEVERITY_COLORS = {
  critical: '#dc2626',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#10b981',
};

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

  const severityTotal = useMemo(
    () => (stats ? stats.critical + stats.high + stats.medium + stats.low : 0),
    [stats]
  );

  const donutData = useMemo(() => ({
    labels: ['Critical', 'High', 'Medium', 'Low'],
    datasets: [
      {
        data: stats ? [stats.critical, stats.high, stats.medium, stats.low] : [],
        backgroundColor: [SEVERITY_COLORS.critical, SEVERITY_COLORS.high, SEVERITY_COLORS.medium, SEVERITY_COLORS.low],
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverBorderWidth: 0,
        hoverOffset: 6,
      },
    ],
  }), [stats]);

  const donutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#3a165d',
        titleFont: { size: 13, weight: 'bold' as const },
        bodyFont: { size: 12 },
        padding: 10,
        cornerRadius: 6,
        callbacks: {
          label: (ctx: { parsed: number }) => {
            const pct = severityTotal > 0 ? ((ctx.parsed / severityTotal) * 100).toFixed(1) : '0';
            return ` ${ctx.parsed} findings (${pct}%)`;
          },
        },
      },
    },
  }), [severityTotal]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 w-full max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">Vue d'ensemble de la sécurité</p>
        </div>
        <button
          className="bg-[#3a165d] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#5d2e8e] transition-colors disabled:opacity-60"
          onClick={loadStats}
          disabled={isLoading}
        >
          {isLoading ? 'Chargement...' : 'Rafraîchir'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-orange-500 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {isLoading && !stats && <div className="text-sm text-gray-500">Chargement des statistiques...</div>}

      {stats && severityTotal > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-[#3a165d]">
              <h3 className="font-semibold text-white text-sm">Répartition par sévérité</h3>
            </div>
            <div className="p-6 flex items-center justify-center">
              <div className="relative w-56 h-56">
                <Doughnut data={donutData} options={donutOptions} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold text-gray-900">{severityTotal}</span>
                  <span className="text-xs text-gray-400">findings</span>
                </div>
              </div>
            </div>
            <div className="px-6 pb-5 flex flex-wrap justify-center gap-4">
              {[
                { label: 'Critical', color: SEVERITY_COLORS.critical, value: stats.critical },
                { label: 'High', color: SEVERITY_COLORS.high, value: stats.high },
                { label: 'Medium', color: SEVERITY_COLORS.medium, value: stats.medium },
                { label: 'Low', color: SEVERITY_COLORS.low, value: stats.low },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.label}: <span className="font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditDashboard;
