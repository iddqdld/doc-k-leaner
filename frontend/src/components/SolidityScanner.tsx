import React, {
  type DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  uploadSolidityFiles,
  getSolidityScanStatus,
  getSolidityScanReport,
  getSolidityScanPdfUrl,
  listSolidityScans,
  type SolidityUploadResponse,
  type SolidityScanStatus,
  type SolidityScanReport,
  type SolidityScanRecord,
  type SolidityFinding,
} from '../services/solidityApi';

const POLL_INTERVAL_MS = 2000;

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const severityColor = (severity: string): string => {
  switch (severity.toUpperCase()) {
    case 'CRITICAL': return 'text-red-600';
    case 'HIGH': return 'text-orange-500';
    case 'MEDIUM': return 'text-amber-500';
    case 'LOW': return 'text-emerald-500';
    case 'INFORMATIONAL': return 'text-blue-400';
    default: return 'text-gray-500';
  }
};

const severityBadge = (severity: string): string => {
  switch (severity.toUpperCase()) {
    case 'CRITICAL': return 'bg-red-100 text-red-700 border-red-200';
    case 'HIGH': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'MEDIUM': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'LOW': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'INFORMATIONAL': return 'bg-blue-100 text-blue-700 border-blue-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

const SolidityScanner: React.FC = () => {
  const [mode, setMode] = useState<'quick' | 'standard'>('standard');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploadResult, setUploadResult] = useState<SolidityUploadResponse | null>(null);
  const [scanStatus, setScanStatus] = useState<SolidityScanStatus | null>(null);
  const [report, setReport] = useState<SolidityScanReport | null>(null);
  const [recentScans, setRecentScans] = useState<SolidityScanRecord[]>([]);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    listSolidityScans(10).then(setRecentScans).catch(() => {});
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startPolling = useCallback((scanId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const status = await getSolidityScanStatus(scanId);
        setScanStatus(status);

        if (status.status === 'complete' || status.status === 'failed') {
          stopPolling();
          if (status.status === 'complete') {
            try {
              const r = await getSolidityScanReport(scanId);
              setReport(r);
            } catch { /* report fetch can fail gracefully */ }
          }
          listSolidityScans(10).then(setRecentScans).catch(() => {});
        }
      } catch {
        stopPolling();
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  const resetState = useCallback(() => {
    setError(null);
    setUploadResult(null);
    setScanStatus(null);
    setReport(null);
    setExpandedFinding(null);
    stopPolling();
  }, [stopPolling]);

  const handleUpload = useCallback(async (files: FileList | File[]) => {
    if (isUploading) return;
    setIsUploading(true);
    resetState();

    const fileArray = Array.from(files);
    try {
      const result = await uploadSolidityFiles(fileArray, mode);
      setUploadResult(result);
      startPolling(result.scan_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [isUploading, mode, resetState, startPolling]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }, [isDragging]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      await handleUpload(e.dataTransfer.files);
    }
  }, [handleUpload]);

  const handleDropZoneClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleUpload(files);
    }
    e.target.value = '';
  }, [handleUpload]);

  const isScanning = scanStatus && (scanStatus.status === 'pending' || scanStatus.status === 'running');
  const isComplete = scanStatus?.status === 'complete';
  const isFailed = scanStatus?.status === 'failed';
  const findings = report?.findings ?? [];

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-700">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black text-orange-500 tracking-tight">Solidity Scanner</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Analyse de smart contracts Solidity/EVM</p>
      </div>

      <div className="flex flex-col lg:flex-row items-start justify-center gap-8 max-w-7xl mx-auto">
        <div className="w-full lg:flex-1 space-y-0">
          {/* Mode selector */}
          <div className="flex items-center gap-4 px-4 mb-2">
            <button
              onClick={() => setMode('quick')}
              className={`flex items-center gap-2 text-xs font-bold transition-colors ${
                mode === 'quick' ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              Quick Scan
            </button>
            <button
              onClick={() => setMode('standard')}
              className={`flex items-center gap-2 text-xs font-bold transition-colors ${
                mode === 'standard' ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              Standard Scan
            </button>
          </div>

          {/* Upload card */}
          <div className="bg-[#5d2e8e] rounded-md shadow-xl overflow-hidden dark:ring-1 dark:ring-white/5">
            <div className="p-8 space-y-6 flex flex-col items-center text-center">
              <p className="text-indigo-200 text-xs max-w-md leading-relaxed">
                {mode === 'quick'
                  ? 'Pattern-only scan — fast detection of 104 vulnerability patterns.'
                  : 'Pattern + Slither analysis — deeper static analysis of your contracts.'}
              </p>

              {error && (
                <div className="w-full bg-red-500/20 border border-red-400/50 rounded px-4 py-2 text-red-200 text-sm">
                  {error}
                </div>
              )}

              {/* Upload result */}
              {uploadResult && !isComplete && !isFailed && (
                <div className="w-full bg-blue-500/20 border border-blue-400/50 rounded px-4 py-3 text-blue-200 text-sm text-left">
                  <p className="font-bold mb-1">Scan started</p>
                  <p><span className="text-blue-300">File:</span> {uploadResult.filename}</p>
                  <p><span className="text-blue-300">Size:</span> {formatFileSize(uploadResult.size)}</p>
                  <p><span className="text-blue-300">Mode:</span> {uploadResult.mode}</p>
                </div>
              )}

              {/* Progress bar */}
              {isScanning && scanStatus && (
                <div className="w-full space-y-2">
                  <div className="flex justify-between text-xs text-white/80">
                    <span>{scanStatus.phase_name || 'Scanning...'}</span>
                    <span>{Math.round(scanStatus.progress * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#ff9d24] rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(scanStatus.progress * 100, 2)}%` }}
                    />
                  </div>
                  <p className="text-white/50 text-xs">
                    Phase {scanStatus.phase}/{scanStatus.total_phases}
                  </p>
                </div>
              )}

              {/* Complete summary */}
              {isComplete && scanStatus && (
                <div className="w-full bg-green-500/20 border border-green-400/50 rounded px-4 py-3 text-green-200 text-sm text-left">
                  <p className="font-bold mb-2">Scan complete</p>
                  {scanStatus.score !== null && (
                    <p className="mb-2">
                      <span className="text-green-300">Score:</span>{' '}
                      <span className="text-2xl font-black">{scanStatus.score}</span>
                      <span className="text-green-300/60">/100</span>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span className="text-red-300">Critical: {scanStatus.severity_counts.critical}</span>
                    <span className="text-orange-300">High: {scanStatus.severity_counts.high}</span>
                    <span className="text-amber-300">Medium: {scanStatus.severity_counts.medium}</span>
                    <span className="text-emerald-300">Low: {scanStatus.severity_counts.low}</span>
                    <span className="text-blue-300">Info: {scanStatus.severity_counts.informational}</span>
                  </div>
                  {report && (
                    <div className="mt-3">
                      <a
                        href={getSolidityScanPdfUrl(report.scan_id)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-green-200 underline text-xs hover:text-white"
                      >
                        Download PDF Report
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Failed */}
              {isFailed && (
                <div className="w-full bg-red-500/20 border border-red-400/50 rounded px-4 py-3 text-red-200 text-sm">
                  Scan failed. Please try again or check that SolidityGuard is running.
                </div>
              )}

              {/* Drop zone */}
              <div
                onClick={handleDropZoneClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  w-full h-40 border-2 border-dashed rounded-sm
                  flex flex-col items-center justify-center cursor-pointer
                  transition-all duration-200 group
                  ${isDragging ? 'border-white bg-white/20 scale-[1.02]' : 'border-white/40 bg-white/5 hover:bg-white/10'}
                  ${isUploading || isScanning ? 'pointer-events-none opacity-50' : ''}
                `}
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin text-4xl mb-2">&#x25CC;</div>
                    <p className="text-white/80 text-sm font-medium">Uploading...</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1 mb-2 text-white/60 group-hover:scale-110 transition-transform">
                      <span className="text-4xl">&#x2B21;</span>
                    </div>
                    <p className="text-white/80 text-sm font-medium">
                      {isDragging ? 'Drop your .sol file(s) here.' : 'Drag & drop .sol files for analysis'}
                    </p>
                    <p className="text-white/50 text-xs mt-1">or click to browse</p>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileInputChange}
                className="hidden"
                accept=".sol"
                multiple
              />
            </div>

            <div className="bg-white/5 py-4 px-6 border-t border-white/10 text-center space-y-1">
              <p className="text-[10px] text-white/40 uppercase tracking-widest">
                Solidity files only (.sol) — Max 5 MB
              </p>
              <p className="text-[10px] text-white/50">
                Powered by{' '}
                <a
                  href="https://github.com/alt-research/SolidityGuard"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#ff9d24] hover:text-white underline"
                >
                  SolidityGuard
                </a>
                {' '}— 104 vulnerability patterns, Slither static analysis
              </p>
            </div>
          </div>

          {/* Findings table */}
          {findings.length > 0 && (
            <div className="mt-6 w-full rounded-xl border border-[#5d2e8e]/20 dark:border-[#5d2e8e]/30 bg-[#5d2e8e]/5 dark:bg-[#5d2e8e]/10 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-[#5d2e8e]/20 flex items-center justify-between bg-[#5d2e8e] text-white">
                <h3 className="font-semibold">Findings</h3>
                <span className="text-xs text-white/80">{findings.length} vulnerabilities</span>
              </div>
              <div className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-700">
                {findings.map((f: SolidityFinding) => (
                  <div key={f.id} className="hover:bg-[#5d2e8e]/5 dark:hover:bg-[#5d2e8e]/15 transition-colors">
                    <div
                      className="px-5 py-3 flex items-center gap-4 cursor-pointer"
                      onClick={() => setExpandedFinding(expandedFinding === f.id ? null : f.id)}
                    >
                      <span className={`text-xs font-bold px-2 py-0.5 rounded border ${severityBadge(f.severity)}`}>
                        {f.severity}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{f.id}</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{f.title}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{f.file}:{f.line}</span>
                      <span className="text-gray-400 dark:text-gray-500 text-xs">{expandedFinding === f.id ? '▲' : '▼'}</span>
                    </div>
                    {expandedFinding === f.id && (
                      <div className="px-5 pb-4 space-y-3 border-t border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                        <div className="grid grid-cols-2 gap-4 text-xs pt-3">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Category:</span>{' '}
                            <span className="text-gray-700 dark:text-gray-300 font-medium">{f.category}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Confidence:</span>{' '}
                            <span className="text-gray-700 dark:text-gray-300 font-medium">{(f.confidence * 100).toFixed(0)}%</span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Tool:</span>{' '}
                            <span className="text-gray-700 dark:text-gray-300 font-medium">{f.tool}</span>
                          </div>
                          {f.swc && (
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">SWC:</span>{' '}
                              <span className="text-gray-700 dark:text-gray-300 font-medium">{f.swc}</span>
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Description</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{f.description}</p>
                        </div>
                        {f.code_snippet && (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Code</p>
                            <pre className="text-xs bg-gray-900 text-green-300 rounded p-3 overflow-x-auto">{f.code_snippet}</pre>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Remediation</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{f.remediation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar — recent scans */}
        <div className="w-full lg:w-72 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 shadow-sm rounded-sm p-6 space-y-6">
          <h3 className="text-gray-600 dark:text-gray-300 font-medium border-b border-gray-50 dark:border-gray-700 pb-3">Recent Scans</h3>
          <div className="space-y-4">
            {recentScans.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">No scans yet.</p>
            )}
            {recentScans.map((scan) => (
              <div key={scan.scan_id} className="space-y-1">
                <p className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate">{scan.filename}</p>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className={`font-bold ${
                    scan.status === 'complete' ? 'text-emerald-600' :
                    scan.status === 'failed' ? 'text-red-500' :
                    'text-amber-500'
                  }`}>
                    {scan.status}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500">·</span>
                  <span className="text-gray-400 dark:text-gray-500">{scan.mode}</span>
                  {scan.score !== null && (
                    <>
                      <span className="text-gray-400 dark:text-gray-500">·</span>
                      <span className="text-gray-600 dark:text-gray-400 font-bold">{scan.score}/100</span>
                    </>
                  )}
                </div>
                {scan.severity_counts.total > 0 && (
                  <div className="flex gap-2 text-[10px]">
                    {scan.severity_counts.critical > 0 && <span className="text-red-500">C:{scan.severity_counts.critical}</span>}
                    {scan.severity_counts.high > 0 && <span className="text-orange-500">H:{scan.severity_counts.high}</span>}
                    {scan.severity_counts.medium > 0 && <span className="text-amber-500">M:{scan.severity_counts.medium}</span>}
                    {scan.severity_counts.low > 0 && <span className="text-emerald-500">L:{scan.severity_counts.low}</span>}
                  </div>
                )}
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  {new Date(scan.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SolidityScanner;
