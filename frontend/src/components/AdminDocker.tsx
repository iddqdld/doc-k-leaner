import React, { useCallback, useEffect, useState } from 'react';
import {
  getAdminDockerContainers,
  getAdminDockerLogs,
  type DockerContainerRow,
} from '../services/authApi';

const REFRESH_MS = 15000;

const AdminDocker: React.FC = () => {
  const [containers, setContainers] = useState<DockerContainerRow[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [tail, setTail] = useState(300);

  const refreshContainers = useCallback(async () => {
    try {
      const res = await getAdminDockerContainers();
      setContainers(res.containers);
      setHint(res.hint ?? null);
      setLoadError(null);
      const services = [...new Set(res.containers.map((c) => c.service))].filter(Boolean);
      setSelectedService((prev) => {
        if (prev && services.includes(prev)) return prev;
        return services[0] ?? null;
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load containers');
    }
  }, []);

  useEffect(() => {
    void refreshContainers();
    const t = setInterval(() => void refreshContainers(), REFRESH_MS);
    return () => clearInterval(t);
  }, [refreshContainers]);

  const loadLogs = useCallback(async () => {
    if (!selectedService) return;
    setLogsLoading(true);
    setLogsError(null);
    try {
      const res = await getAdminDockerLogs(selectedService, tail);
      setLogs(res.logs);
    } catch (e) {
      setLogsError(e instanceof Error ? e.message : 'Failed to load logs');
      setLogs('');
    } finally {
      setLogsLoading(false);
    }
  }, [selectedService, tail]);

  useEffect(() => {
    if (selectedService) void loadLogs();
  }, [selectedService, loadLogs]);

  const serviceNames = [...new Set(containers.map((c) => c.service))].filter(Boolean).sort();

  return (
    <div className="w-full max-w-5xl space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Docker stack</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Admin only — live container status and logs from the host Docker socket (compose project{' '}
            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">docker</code> by default).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshContainers()}
          className="shrink-0 bg-[#3a165d] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#5d2e8e] transition-colors"
        >
          Refresh status
        </button>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm text-red-800 dark:text-red-300">{loadError}</div>
      )}

      {hint && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-300">{hint}</div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">Containers</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">One row per container instance (including stopped)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
              <tr>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Image</th>
                <th className="px-4 py-3">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {containers.length === 0 && !loadError && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
                    No containers matched. Check backend env{' '}
                    <code className="text-xs">DOCKCLEANER_DOCKER_COMPOSE_PROJECT</code>.
                  </td>
                </tr>
              )}
              {containers.map((c) => (
                <tr key={`${c.container_id}-${c.name}`} className="hover:bg-violet-50/40 dark:hover:bg-violet-900/20">
                  <td className="px-4 py-2.5 font-mono text-xs text-[#5d2e8e] dark:text-violet-400 font-semibold">{c.service}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-gray-300">{c.name}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        c.state === 'running'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400'
                          : c.state === 'exited'
                            ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400'
                      }`}
                    >
                      {c.state || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400 max-w-[200px] truncate" title={c.status}>
                    {c.status}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 max-w-[180px] truncate" title={c.image}>
                    {c.image}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-400 dark:text-gray-500">{c.container_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-3 bg-gray-50/80 dark:bg-gray-800/50">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">Logs</h3>
          <select
            value={selectedService ?? ''}
            onChange={(e) => setSelectedService(e.target.value || null)}
            className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:text-gray-200 min-w-[160px]"
            disabled={serviceNames.length === 0}
          >
            {serviceNames.length === 0 ? (
              <option value="">No services</option>
            ) : (
              serviceNames.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))
            )}
          </select>
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            Tail
            <input
              type="number"
              min={50}
              max={2000}
              value={tail}
              onChange={(e) => setTail(Number(e.target.value) || 300)}
              className="w-20 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 dark:text-gray-200"
            />
          </label>
          <button
            type="button"
            onClick={() => void loadLogs()}
            disabled={!selectedService || logsLoading}
            className="text-xs font-bold text-orange-600 hover:text-orange-500 disabled:opacity-40"
          >
            {logsLoading ? 'Loading…' : 'Reload logs'}
          </button>
        </div>
        {logsError && (
          <div className="mx-5 mt-3 rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-3 py-2 text-xs text-red-800 dark:text-red-300">
            {logsError}
          </div>
        )}
        <pre className="m-0 p-5 bg-slate-950 text-slate-200 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[min(70vh,520px)] overflow-y-auto whitespace-pre-wrap break-all">
          {logs || (logsLoading ? '…' : 'Select a service and load logs.')}
        </pre>
      </div>
    </div>
  );
};

export default AdminDocker;
