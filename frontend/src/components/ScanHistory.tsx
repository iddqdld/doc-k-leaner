import React, { useCallback, useEffect, useState } from 'react';
import { getMyHistory, type ScanHistoryItem } from '../services/authApi';
import { getFileScanReport } from '../services/fileApi';
import { getSolidityScanReport, type SolidityFinding } from '../services/solidityApi';

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

type TrivyRow = {
  kind: 'misconfig' | 'secret' | 'vuln';
  id: string;
  title: string;
  severity?: string;
  status: string;
  location: string;
};

const getSeverityClass = (severity?: string): string => {
  switch ((severity || '').toUpperCase()) {
    case 'CRITICAL': return 'text-red-600 dark:text-red-400';
    case 'HIGH': return 'text-orange-500 dark:text-orange-400';
    case 'MEDIUM': return 'text-amber-500 dark:text-amber-400';
    case 'LOW': return 'text-emerald-500 dark:text-emerald-400';
    default: return 'text-gray-500 dark:text-gray-400';
  }
};

const severityBadge = (severity: string): string => {
  switch (severity.toUpperCase()) {
    case 'CRITICAL': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200 dark:border-red-800';
    case 'HIGH': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 border-orange-200 dark:border-orange-800';
    case 'MEDIUM': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800';
    case 'LOW': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
    case 'INFORMATIONAL': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border-blue-200 dark:border-blue-800';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600';
  }
};

function parseTrivyReport(data: unknown): TrivyRow[] {
  const report = data as { Results?: Array<{
    Misconfigurations?: Array<{ ID?: string; RuleID?: string; Title?: string; Severity?: string; Status?: string; CauseMetadata?: { StartLine?: number } }>;
    Secrets?: Array<{ RuleID?: string; ID?: string; Title?: string; Severity?: string; Status?: string; StartLine?: number }>;
    Vulnerabilities?: Array<{ VulnerabilityID?: string; ID?: string; Title?: string; PkgName?: string; Severity?: string; Status?: string }>;
  }> };
  if (!Array.isArray(report?.Results)) return [];
  return report.Results.flatMap((result): TrivyRow[] => {
    const misconfigs = (result.Misconfigurations || []).map((item) => ({
      kind: 'misconfig' as const,
      id: item.ID || 'MISCONFIG',
      title: item.Title || 'Misconfiguration',
      severity: item.Severity,
      status: item.Status || 'FAIL',
      location: item?.CauseMetadata?.StartLine != null ? `Line ${item.CauseMetadata.StartLine}` : '—',
    }));
    const secrets = (result.Secrets || []).map((item) => ({
      kind: 'secret' as const,
      id: item.RuleID || item.ID || 'SECRET',
      title: item.Title || item.RuleID || 'Secret detected',
      severity: item.Severity,
      status: item?.Status || 'FAIL',
      location: item?.StartLine != null ? `Line ${item.StartLine}` : '—',
    }));
    const vulns = (result.Vulnerabilities || []).map((item) => ({
      kind: 'vuln' as const,
      id: item.VulnerabilityID || item.ID || 'VULN',
      title: item.Title || item.PkgName || 'Vulnerability',
      severity: item.Severity,
      status: item.Status || 'FAIL',
      location: item.PkgName ? `Pkg ${item.PkgName}` : '—',
    }));
    return [...misconfigs, ...secrets, ...vulns];
  });
}

const ScanHistory: React.FC = () => {
  const [items, setItems] = useState<ScanHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedItem, setSelectedItem] = useState<ScanHistoryItem | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [trivyRows, setTrivyRows] = useState<TrivyRow[]>([]);
  const [solidityFindings, setSolidityFindings] = useState<SolidityFinding[]>([]);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);

  useEffect(() => {
    getMyHistory()
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleRowClick = useCallback(async (item: ScanHistoryItem) => {
    if (!item.report_id) return;
    setSelectedItem(item);
    setReportLoading(true);
    setReportError(null);
    setTrivyRows([]);
    setSolidityFindings([]);
    setExpandedFinding(null);
    try {
      if (item.scan_type === 'trivy') {
        const raw = await getFileScanReport(item.report_id);
        setTrivyRows(parseTrivyReport(raw));
      } else {
        const report = await getSolidityScanReport(item.report_id);
        setSolidityFindings(report.findings ?? []);
      }
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setReportLoading(false);
    }
  }, []);

  return (
    <div className="w-full max-w-3xl">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black text-orange-500 tracking-tight">Mon historique</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Vos scans et fichiers analysés</p>
      </div>

      {loading && <p className="text-center text-sm text-gray-400 dark:text-gray-500">Chargement...</p>}
      {error && <p className="text-center text-sm text-red-500">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-center text-sm text-gray-400 dark:text-gray-500">Aucun scan trouvé.</p>
      )}

      {items.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="px-4 py-3">Fichier</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Taille</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => item.report_id && handleRowClick(item)}
                  className={`${item.report_id ? 'cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/50' : ''}`}
                >
                  <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                    {item.filename}
                    {item.report_id && (
                      <span className="ml-1 text-gray-400 dark:text-gray-500 text-xs" title="Cliquez pour voir les résultats">
                        →
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      item.scan_type === 'solidity'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400'
                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
                    }`}>
                      {item.scan_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatSize(item.size)}</td>
                  <td className="px-4 py-3 text-gray-400 dark:text-gray-500">{new Date(item.created_at).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Results modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedItem(null)} />
          <div
            className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">
                Résultats — {selectedItem.filename}
              </h3>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {reportLoading && (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">Chargement des résultats...</p>
              )}
              {reportError && (
                <p className="text-center text-sm text-red-500 py-4">{reportError}</p>
              )}
              {!reportLoading && !reportError && selectedItem.scan_type === 'trivy' && (
                <>
                  {trivyRows.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Aucun finding.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs uppercase text-[#5d2e8e] font-semibold border-b border-gray-200 dark:border-gray-600">
                            <th className="px-4 py-2 text-left">Type</th>
                            <th className="px-4 py-2 text-left">Severity</th>
                            <th className="px-4 py-2 text-left">ID</th>
                            <th className="px-4 py-2 text-left">Title</th>
                            <th className="px-4 py-2 text-left">Status</th>
                            <th className="px-4 py-2 text-left">Location</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {trivyRows.map((row, i) => (
                            <tr key={`${row.id}-${i}`} className="hover:bg-[#5d2e8e]/5 dark:hover:bg-[#5d2e8e]/10">
                              <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{row.kind}</td>
                              <td className={`px-4 py-2 font-semibold ${getSeverityClass(row.severity)}`}>
                                {row.severity || 'UNKNOWN'}
                              </td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400 font-mono text-xs">{row.id}</td>
                              <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{row.title}</td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{row.status}</td>
                              <td className="px-4 py-2 text-gray-500 dark:text-gray-500">{row.location}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
              {!reportLoading && !reportError && selectedItem.scan_type === 'solidity' && (
                <>
                  {solidityFindings.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Aucun finding.</p>
                  ) : (
                    <div className="space-y-0 border border-[#5d2e8e]/20 dark:border-[#5d2e8e]/30 rounded-lg overflow-hidden">
                      {solidityFindings.map((f) => (
                        <div key={f.id} className="hover:bg-[#5d2e8e]/5 dark:hover:bg-[#5d2e8e]/10">
                          <div
                            className="px-4 py-3 flex items-center gap-3 cursor-pointer"
                            onClick={() => setExpandedFinding(expandedFinding === f.id ? null : f.id)}
                          >
                            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${severityBadge(f.severity)}`}>
                              {f.severity}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{f.id}</span>
                            <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{f.title}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{f.file}:{f.line}</span>
                            <span className="text-gray-400 dark:text-gray-500 text-xs">{expandedFinding === f.id ? '▲' : '▼'}</span>
                          </div>
                          {expandedFinding === f.id && (
                            <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 space-y-2 text-xs">
                              <div className="grid grid-cols-2 gap-3">
                                <div><span className="text-gray-500 dark:text-gray-400">Category:</span> <span className="text-gray-700 dark:text-gray-300">{f.category}</span></div>
                                <div><span className="text-gray-500 dark:text-gray-400">Confidence:</span> <span className="text-gray-700 dark:text-gray-300">{(f.confidence * 100).toFixed(0)}%</span></div>
                              </div>
                              <p className="text-gray-700 dark:text-gray-300"><span className="text-gray-500 dark:text-gray-400">Description:</span> {f.description}</p>
                              {f.remediation && <p className="text-gray-700 dark:text-gray-300"><span className="text-gray-500 dark:text-gray-400">Remediation:</span> {f.remediation}</p>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanHistory;
