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
  type SolidityOverview,
  type SolidityDailyScans,
  type GlobalOverview,
  getGlobalOverview,
  getAuditStats,
  getScansOverTime,
  getSeverityOverTime,
  getFileTypeStats,
  getSourceStats,
  getSolidityOverview,
  getSolidityScansOverTime,
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
  informational: '#60a5fa',
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

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/* ── Section divider component ── */
const SectionDivider: React.FC<{ label: string; sublabel?: string }> = ({ label, sublabel }) => (
  <div className="flex items-center gap-4 pt-4">
    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#5d2e8e]/30 to-transparent" />
    <div className="text-center">
      <span className="text-sm font-bold text-[#5d2e8e] tracking-wide uppercase">{label}</span>
      {sublabel && <p className="text-[10px] text-gray-400 mt-0.5">{sublabel}</p>}
    </div>
    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#5d2e8e]/30 to-transparent" />
  </div>
);

/* ── Stat pill for Solidity overview ── */
const StatPill: React.FC<{ label: string; value: string | number; accent?: string }> = ({ label, value, accent }) => (
  <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-5 py-4 text-center">
    <div className="text-2xl font-bold" style={accent ? { color: accent } : undefined}>{value}</div>
    <div className="text-[10px] text-gray-400 uppercase tracking-wide mt-1">{label}</div>
  </div>
);

const AuditDashboard: React.FC = () => {
  const [globalStats, setGlobalStats] = useState<GlobalOverview | null>(null);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [scansTimeline, setScansTimeline] = useState<DailyScans[]>([]);
  const [severityTimeline, setSeverityTimeline] = useState<DailySeverity[]>([]);
  const [fileTypes, setFileTypes] = useState<FileTypeCount[]>([]);
  const [sources, setSources] = useState<SourceCount[]>([]);
  const [solOverview, setSolOverview] = useState<SolidityOverview | null>(null);
  const [solTimeline, setSolTimeline] = useState<SolidityDailyScans[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [trivyPage, setTrivyPage] = useState(0);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);

  const loadTimeline = useCallback(async (page: number) => {
    setIsLoadingTimeline(true);
    try {
      const offset = page * 30;
      const [scansData, sevData] = await Promise.all([
        getScansOverTime(30, offset),
        getSeverityOverTime(30, offset),
      ]);
      setScansTimeline(scansData);
      setSeverityTimeline(sevData);
    } catch {
      // keep existing data on error
    } finally {
      setIsLoadingTimeline(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const offset = trivyPage * 30;
      const [globalData, statsData, scansData, sevData, ftData, srcData, solData, solTlData] = await Promise.all([
        getGlobalOverview(),
        getAuditStats(),
        getScansOverTime(30, offset),
        getSeverityOverTime(30, offset),
        getFileTypeStats(),
        getSourceStats(),
        getSolidityOverview(),
        getSolidityScansOverTime(30),
      ]);
      setGlobalStats(globalData);
      setStats(statsData);
      setScansTimeline(scansData);
      setSeverityTimeline(sevData);
      setFileTypes(ftData);
      setSources(srcData);
      setSolOverview(solData);
      setSolTimeline(solTlData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  }, [trivyPage]);

  useEffect(() => {
    void loadAll();
    const refreshId = window.setInterval(() => void loadAll(), 60000);
    return () => window.clearInterval(refreshId);
  }, [loadAll]);

  const goTrivyPrev = useCallback(() => {
    const next = trivyPage + 1;
    setTrivyPage(next);
    void loadTimeline(next);
  }, [trivyPage, loadTimeline]);

  const goTrivyNext = useCallback(() => {
    if (trivyPage <= 0) return;
    const next = trivyPage - 1;
    setTrivyPage(next);
    void loadTimeline(next);
  }, [trivyPage, loadTimeline]);

  const trivyRangeLabel = useMemo(() => {
    const end = new Date();
    end.setDate(end.getDate() - trivyPage * 30);
    const start = new Date(end);
    start.setDate(start.getDate() - 29);
    const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    return `${fmt(start)} — ${fmt(end)}`;
  }, [trivyPage]);

  /* ─── Trivy chart data ─── */

  const severityTotal = useMemo(
    () => (stats ? stats.critical + stats.high + stats.medium + stats.low : 0),
    [stats]
  );

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
      x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 10 }, maxTicksLimit: 10 } },
      y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { color: '#9ca3af', font: { size: 10 }, precision: 0 } },
    },
  }), []);

  const severityAreaData = useMemo(() => ({
    labels: severityTimeline.map((d) => formatDate(d.date)),
    datasets: (['critical', 'high', 'medium', 'low'] as const).map((key) => ({
      label: key.charAt(0).toUpperCase() + key.slice(1),
      data: severityTimeline.map((d) => d[key]),
      borderColor: SEVERITY_COLORS[key],
      backgroundColor: `${SEVERITY_COLORS[key]}30`,
      fill: true,
      tension: 0.35,
      pointRadius: 0,
    })),
  }), [severityTimeline]);

  const stackedOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { boxWidth: 10, font: { size: 11 }, color: '#6b7280', padding: 16 } },
      tooltip: chartTooltip,
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 10 }, maxTicksLimit: 10 } },
      y: { stacked: true, beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { color: '#9ca3af', font: { size: 10 }, precision: 0 } },
    },
  }), []);

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
    plugins: { legend: { display: false }, tooltip: chartTooltip },
    scales: {
      x: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { color: '#9ca3af', font: { size: 10 }, precision: 0 } },
      y: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 11 } } },
    },
  }), []);

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
      legend: { position: 'bottom' as const, labels: { boxWidth: 10, font: { size: 11 }, color: '#6b7280', padding: 16 } },
      tooltip: chartTooltip,
    },
  }), []);

  /* ─── Solidity chart data ─── */

  const solSeverityTotal = useMemo(
    () => solOverview ? solOverview.critical + solOverview.high + solOverview.medium + solOverview.low + solOverview.informational : 0,
    [solOverview]
  );

  const solDonutData = useMemo(() => ({
    labels: ['Critical', 'High', 'Medium', 'Low', 'Info'],
    datasets: [{
      data: solOverview
        ? [solOverview.critical, solOverview.high, solOverview.medium, solOverview.low, solOverview.informational]
        : [],
      backgroundColor: [
        SEVERITY_COLORS.critical, SEVERITY_COLORS.high, SEVERITY_COLORS.medium,
        SEVERITY_COLORS.low, SEVERITY_COLORS.informational,
      ],
      borderColor: '#ffffff',
      borderWidth: 2,
      hoverBorderWidth: 0,
      hoverOffset: 6,
    }],
  }), [solOverview]);

  const solDonutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: { display: false },
      tooltip: {
        ...chartTooltip,
        callbacks: {
          label: (ctx: { parsed: number }) => {
            const pct = solSeverityTotal > 0 ? ((ctx.parsed / solSeverityTotal) * 100).toFixed(1) : '0';
            return ` ${ctx.parsed} findings (${pct}%)`;
          },
        },
      },
    },
  }), [solSeverityTotal]);

  const solLineData = useMemo(() => ({
    labels: solTimeline.map((d) => formatDate(d.date)),
    datasets: [{
      label: 'Scans',
      data: solTimeline.map((d) => d.count),
      borderColor: '#f97316',
      backgroundColor: '#f9731620',
      fill: true,
      tension: 0.35,
      pointRadius: 2,
      pointHoverRadius: 5,
      pointBackgroundColor: '#f97316',
    }],
  }), [solTimeline]);

  /* ─── Render flags ─── */
  const hasTrivyData = stats && (severityTotal > 0 || scansTimeline.length > 0);
  const hasSolData = solOverview && (solOverview.total_scans > 0);

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
        <div className="bg-red-50 border border-red-200 text-orange-500 px-4 py-3 rounded">{error}</div>
      )}

      {isLoading && !stats && <div className="text-sm text-gray-500">Chargement des statistiques...</div>}

      {/* ════════════════════ GLOBAL OVERVIEW ════════════════════ */}
      {globalStats && (globalStats.total_files > 0 || globalStats.sandbox_lines > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#3a165d] rounded-xl px-6 py-5 text-center">
            <div className="text-3xl font-bold text-white">{globalStats.total_files.toLocaleString()}</div>
            <div className="text-[10px] text-white/50 uppercase tracking-wide mt-1">Fichiers analysés</div>
          </div>
          <div className="bg-[#3a165d] rounded-xl px-6 py-5 text-center">
            <div className="text-3xl font-bold text-orange-400">{formatSize(globalStats.total_size_bytes)}</div>
            <div className="text-[10px] text-white/50 uppercase tracking-wide mt-1">Volume total analysé</div>
          </div>
          <div className="bg-[#3a165d] rounded-xl px-6 py-5 text-center">
            <div className="text-3xl font-bold text-white">{globalStats.sandbox_lines.toLocaleString()}</div>
            <div className="text-[10px] text-white/50 uppercase tracking-wide mt-1">Lignes traitées (sandbox)</div>
          </div>
        </div>
      )}

      {/* ════════════════════ TRIVY SECTION ════════════════════ */}
      {hasTrivyData && (
        <>
          <SectionDivider label="Trivy — Fichiers & Images" sublabel="Misconfigurations, secrets, vulnérabilités" />

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
                  {([
                    { label: 'Critical', color: SEVERITY_COLORS.critical, value: stats!.critical },
                    { label: 'High', color: SEVERITY_COLORS.high, value: stats!.high },
                    { label: 'Medium', color: SEVERITY_COLORS.medium, value: stats!.medium },
                    { label: 'Low', color: SEVERITY_COLORS.low, value: stats!.low },
                  ]).map((item) => (
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
                <div className="px-6 py-4 border-b border-gray-100 bg-[#3a165d] flex items-center justify-between">
                  <h3 className="font-semibold text-white text-sm">Scans par jour</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-white/60 text-[10px]">{trivyRangeLabel}</span>
                    <button
                      onClick={goTrivyPrev}
                      disabled={isLoadingTimeline}
                      className="text-white/70 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors disabled:opacity-40"
                      title="30 jours avant"
                    >
                      ◀
                    </button>
                    <button
                      onClick={goTrivyNext}
                      disabled={isLoadingTimeline || trivyPage === 0}
                      className="text-white/70 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors disabled:opacity-40"
                      title="30 jours après"
                    >
                      ▶
                    </button>
                  </div>
                </div>
                <div className="p-6 relative" style={{ height: 300 }}>
                  {isLoadingTimeline && (
                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
                      <span className="text-sm text-gray-400">Chargement...</span>
                    </div>
                  )}
                  <Line data={scansLineData} options={lineOptions} />
                </div>
              </div>
            )}
          </div>

          {severityTimeline.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-[#3a165d] flex items-center justify-between">
                <h3 className="font-semibold text-white text-sm">Évolution des sévérités</h3>
                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-[10px]">{trivyRangeLabel}</span>
                  <button
                    onClick={goTrivyPrev}
                    disabled={isLoadingTimeline}
                    className="text-white/70 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors disabled:opacity-40"
                    title="30 jours avant"
                  >
                    ◀
                  </button>
                  <button
                    onClick={goTrivyNext}
                    disabled={isLoadingTimeline || trivyPage === 0}
                    className="text-white/70 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors disabled:opacity-40"
                    title="30 jours après"
                  >
                    ▶
                  </button>
                </div>
              </div>
              <div className="p-6 relative" style={{ height: 320 }}>
                {isLoadingTimeline && (
                  <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
                    <span className="text-sm text-gray-400">Chargement...</span>
                  </div>
                )}
                <Line data={severityAreaData} options={stackedOptions} />
              </div>
            </div>
          )}

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

      {/* ════════════════════ SOLIDITY SECTION ════════════════════ */}
      {hasSolData && solOverview && (
        <>
          <SectionDivider label="Solidity — Smart Contracts" sublabel="Analyse statique & patterns de vulnérabilités" />

          {/* Stat pills row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatPill label="Contrats" value={solOverview.total_contracts} accent={PURPLE_MED} />
            <StatPill label="Scans" value={solOverview.completed_scans} accent={PURPLE_DARK} />
            <StatPill
              label="Score moyen"
              value={solOverview.avg_score !== null ? `${solOverview.avg_score}/100` : '—'}
              accent={
                solOverview.avg_score !== null
                  ? solOverview.avg_score >= 70 ? '#10b981' : solOverview.avg_score >= 40 ? '#f59e0b' : '#dc2626'
                  : undefined
              }
            />
            <StatPill label="Findings" value={solSeverityTotal} accent="#f97316" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Solidity severity donut */}
            {solSeverityTotal > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-[#5d2e8e]">
                  <h3 className="font-semibold text-white text-sm">Sévérités Solidity</h3>
                </div>
                <div className="p-6 flex items-center justify-center">
                  <div className="relative w-56 h-56">
                    <Doughnut data={solDonutData} options={solDonutOptions} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-bold text-gray-900">{solSeverityTotal}</span>
                      <span className="text-xs text-gray-400">findings</span>
                    </div>
                  </div>
                </div>
                <div className="px-6 pb-5 flex flex-wrap justify-center gap-4">
                  {([
                    { label: 'Critical', color: SEVERITY_COLORS.critical, value: solOverview.critical },
                    { label: 'High', color: SEVERITY_COLORS.high, value: solOverview.high },
                    { label: 'Medium', color: SEVERITY_COLORS.medium, value: solOverview.medium },
                    { label: 'Low', color: SEVERITY_COLORS.low, value: solOverview.low },
                    { label: 'Info', color: SEVERITY_COLORS.informational, value: solOverview.informational },
                  ]).map((item) => (
                    <div key={item.label} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.label}: <span className="font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Solidity scans over time */}
            {solTimeline.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-[#5d2e8e]">
                  <h3 className="font-semibold text-white text-sm">Scans Solidity par jour (30j)</h3>
                </div>
                <div className="p-6" style={{ height: 300 }}>
                  <Line data={solLineData} options={lineOptions} />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {!hasTrivyData && !hasSolData && !isLoading && (
        <div className="text-center py-16 text-gray-400 text-sm">
          Aucune donnée de scan disponible. Lancez une analyse pour voir les statistiques.
        </div>
      )}
    </div>
  );
};

export default AuditDashboard;
