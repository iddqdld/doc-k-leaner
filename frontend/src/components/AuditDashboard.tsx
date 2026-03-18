import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
} from 'chart.js';
import { Doughnut, Line, Bar } from 'react-chartjs-2';
import {
  type AuditStats,
  type DailyScans,
  type DailySeverity,
  type FileTypeCount,
  type SourceCount,
  getAuditStats,
  getScansOverTime,
  getSeverityOverTime,
  getFileTypeStats,
  getSourceStats,
} from '../services/fileApi';

ChartJS.register(
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler,
);

const SEVERITY_COLORS = {
  critical: '#dc2626',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#10b981',
};

const PURPLE_DARK = '#3a165d';
const PURPLE_MED = '#5d2e8e';

const chartTooltip = {
  backgroundColor: PURPLE_DARK,
  titleFont: { size: 13, weight: 'bold' as const },
  bodyFont: { size: 12 },
  padding: 10,
  cornerRadius: 6,
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

const AuditDashboard: React.FC = () => {
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [scansTimeline, setScansTimeline] = useState<DailyScans[]>([]);
  const [severityTimeline, setSeverityTimeline] = useState<DailySeverity[]>([]);
  const [fileTypes, setFileTypes] = useState<FileTypeCount[]>([]);
  const [sources, setSources] = useState<SourceCount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsData, scansData, sevData, ftData, srcData] = await Promise.all([
        getAuditStats(),
        getScansOverTime(30),
        getSeverityOverTime(30),
        getFileTypeStats(),
        getSourceStats(),
      ]);
      setStats(statsData);
      setScansTimeline(scansData);
      setSeverityTimeline(sevData);
      setFileTypes(ftData);
      setSources(srcData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
    const refreshId = window.setInterval(() => void loadAll(), 60000);
    return () => window.clearInterval(refreshId);
  }, [loadAll]);

  const severityTotal = useMemo(
    () => (stats ? stats.critical + stats.high + stats.medium + stats.low : 0),
    [stats]
  );

  // --- Donut: severity distribution ---
  const donutData = useMemo(() => ({
    labels: ['Critical', 'High', 'Medium', 'Low'],
    datasets: [{
      data: stats ? [stats.critical, stats.high, stats.medium, stats.low] : [],
      backgroundColor: [SEVERITY_COLORS.critical, SEVERITY_COLORS.high, SEVERITY_COLORS.medium, SEVERITY_COLORS.low],
      borderColor: '#ffffff',
      borderWidth: 2,
      hoverBorderWidth: 0,
      hoverOffset: 6,
    }],
  }), [stats]);

  const donutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: { display: false },
      tooltip: {
        ...chartTooltip,
        callbacks: {
          label: (ctx: { parsed: number }) => {
            const pct = severityTotal > 0 ? ((ctx.parsed / severityTotal) * 100).toFixed(1) : '0';
            return ` ${ctx.parsed} findings (${pct}%)`;
          },
        },
      },
    },
  }), [severityTotal]);

  // --- Line: scans over time ---
  const scansLineData = useMemo(() => ({
    labels: scansTimeline.map((d) => formatDate(d.date)),
    datasets: [{
      label: 'Scans',
      data: scansTimeline.map((d) => d.count),
      borderColor: PURPLE_MED,
      backgroundColor: `${PURPLE_MED}20`,
      fill: true,
      tension: 0.35,
      pointRadius: 2,
      pointHoverRadius: 5,
      pointBackgroundColor: PURPLE_MED,
    }],
  }), [scansTimeline]);

  const lineOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: chartTooltip,
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#9ca3af', font: { size: 10 }, maxTicksLimit: 10 },
      },
      y: {
        beginAtZero: true,
        grid: { color: '#f3f4f6' },
        ticks: { color: '#9ca3af', font: { size: 10 }, precision: 0 },
      },
    },
  }), []);

  // --- Stacked area: severity over time ---
  const severityAreaData = useMemo(() => ({
    labels: severityTimeline.map((d) => formatDate(d.date)),
    datasets: [
      {
        label: 'Critical',
        data: severityTimeline.map((d) => d.critical),
        borderColor: SEVERITY_COLORS.critical,
        backgroundColor: `${SEVERITY_COLORS.critical}30`,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
      },
      {
        label: 'High',
        data: severityTimeline.map((d) => d.high),
        borderColor: SEVERITY_COLORS.high,
        backgroundColor: `${SEVERITY_COLORS.high}30`,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
      },
      {
        label: 'Medium',
        data: severityTimeline.map((d) => d.medium),
        borderColor: SEVERITY_COLORS.medium,
        backgroundColor: `${SEVERITY_COLORS.medium}30`,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
      },
      {
        label: 'Low',
        data: severityTimeline.map((d) => d.low),
        borderColor: SEVERITY_COLORS.low,
        backgroundColor: `${SEVERITY_COLORS.low}30`,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
      },
    ],
  }), [severityTimeline]);

  const stackedOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { boxWidth: 10, font: { size: 11 }, color: '#6b7280', padding: 16 },
      },
      tooltip: chartTooltip,
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#9ca3af', font: { size: 10 }, maxTicksLimit: 10 },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: '#f3f4f6' },
        ticks: { color: '#9ca3af', font: { size: 10 }, precision: 0 },
      },
    },
  }), []);

  // --- Bar: file types ---
  const fileTypeBarData = useMemo(() => ({
    labels: fileTypes.map((f) => `.${f.file_type}`),
    datasets: [{
      label: 'Files',
      data: fileTypes.map((f) => f.count),
      backgroundColor: PURPLE_MED,
      borderRadius: 4,
      maxBarThickness: 36,
    }],
  }), [fileTypes]);

  const barOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      legend: { display: false },
      tooltip: chartTooltip,
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: '#f3f4f6' },
        ticks: { color: '#9ca3af', font: { size: 10 }, precision: 0 },
      },
      y: {
        grid: { display: false },
        ticks: { color: '#6b7280', font: { size: 11 } },
      },
    },
  }), []);

  // --- Donut: upload sources ---
  const sourceDonutData = useMemo(() => ({
    labels: sources.map((s) => s.source),
    datasets: [{
      data: sources.map((s) => s.count),
      backgroundColor: [PURPLE_DARK, '#f97316', PURPLE_MED, '#10b981'],
      borderColor: '#ffffff',
      borderWidth: 2,
    }],
  }), [sources]);

  const sourceDonutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { boxWidth: 10, font: { size: 11 }, color: '#6b7280', padding: 16 },
      },
      tooltip: chartTooltip,
    },
  }), []);

  const hasData = stats && (severityTotal > 0 || scansTimeline.length > 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 w-full max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">Vue d'ensemble de la sécurité</p>
        </div>
        <button
          className="bg-[#3a165d] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#5d2e8e] transition-colors disabled:opacity-60"
          onClick={loadAll}
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

      {hasData && (
        <>
          {/* Row 1: Severity donut + Scans over time */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {severityTotal > 0 && (
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
                    { label: 'Critical', color: SEVERITY_COLORS.critical, value: stats!.critical },
                    { label: 'High', color: SEVERITY_COLORS.high, value: stats!.high },
                    { label: 'Medium', color: SEVERITY_COLORS.medium, value: stats!.medium },
                    { label: 'Low', color: SEVERITY_COLORS.low, value: stats!.low },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.label}: <span className="font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {scansTimeline.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-[#3a165d]">
                  <h3 className="font-semibold text-white text-sm">Scans par jour (30j)</h3>
                </div>
                <div className="p-6" style={{ height: 300 }}>
                  <Line data={scansLineData} options={lineOptions} />
                </div>
              </div>
            )}
          </div>

          {/* Row 2: Severity trends over time */}
          {severityTimeline.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-[#3a165d]">
                <h3 className="font-semibold text-white text-sm">Évolution des sévérités (30j)</h3>
              </div>
              <div className="p-6" style={{ height: 320 }}>
                <Line data={severityAreaData} options={stackedOptions} />
              </div>
            </div>
          )}

          {/* Row 3: File types + Source breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {fileTypes.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-[#3a165d]">
                  <h3 className="font-semibold text-white text-sm">Types de fichiers analysés</h3>
                </div>
                <div className="p-6" style={{ height: Math.max(200, fileTypes.length * 36 + 40) }}>
                  <Bar data={fileTypeBarData} options={barOptions} />
                </div>
              </div>
            )}

            {sources.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-[#3a165d]">
                  <h3 className="font-semibold text-white text-sm">Sources d'upload</h3>
                </div>
                <div className="p-6 flex items-center justify-center">
                  <div className="w-56 h-56">
                    <Doughnut data={sourceDonutData} options={sourceDonutOptions} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AuditDashboard;
