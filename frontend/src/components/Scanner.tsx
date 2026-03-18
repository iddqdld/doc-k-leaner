import React, {
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  uploadFile,
  uploadFromUrl,
  scanImage,
  type FileUploadResponse,
  type ImageScanResponse,
  getLatestCommits,
  type CommitInfo,
} from '../services/fileApi';

type ScanDetail = {
  ID?: string;
  RuleID?: string;
  VulnerabilityID?: string;
  Title?: string;
  Severity?: string;
  Status?: string;
  StartLine?: number;
  PkgName?: string;
  CauseMetadata?: {
    StartLine?: number;
  };
};

type ScanResult = {
  Misconfigurations?: ScanDetail[];
  Secrets?: ScanDetail[];
  Vulnerabilities?: ScanDetail[];
};

type ScanReport = {
  Results?: ScanResult[];
};

type ScanRow = {
  kind: 'misconfig' | 'secret' | 'vuln';
  id: string;
  title: string;
  severity?: string;
  status: string;
  location: string;
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getSeverityClass = (severity?: string): string => {
  switch ((severity || '').toUpperCase()) {
    case 'CRITICAL':
      return 'text-red-600';
    case 'HIGH':
      return 'text-orange-500';
    case 'MEDIUM':
      return 'text-amber-500';
    case 'LOW':
      return 'text-emerald-500';
    default:
      return 'text-gray-500';
  }
};

const Scanner: React.FC = () => {
  const [url, setUrl] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'file' | 'search'>('file');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<FileUploadResponse | null>(null);
  const [scanReport, setScanReport] = useState<ScanReport | null>(null);
  const [scanReportError, setScanReportError] = useState<string | null>(null);
  const [imageRef, setImageRef] = useState('');
  const [imageScanResult, setImageScanResult] = useState<ImageScanResponse | null>(null);
  const [activeAction, setActiveAction] = useState<'upload' | 'image' | null>(null);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [commitError, setCommitError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadCommits = async () => {
      setCommitError(null);
      try {
        const data = await getLatestCommits(3);
        if (!isCancelled) {
          setCommits(data);
        }
      } catch (err) {
        if (!isCancelled) {
          setCommitError(err instanceof Error ? err.message : 'Failed to load updates');
        }
      }
    };

    void loadCommits();

    return () => {
      isCancelled = true;
    };
  }, []);

  const resetScanState = useCallback(() => {
    setError(null);
    setUploadedFile(null);
    setScanReport(null);
    setScanReportError(null);
    setImageScanResult(null);
  }, []);

  const loadScanReport = useCallback(async (reportUrl?: string | null) => {
    if (!reportUrl) {
      return;
    }

    try {
      const response = await fetch(reportUrl);
      if (!response.ok) {
        throw new Error(`Failed to load scan report: ${response.status}`);
      }
      const data = (await response.json()) as ScanReport;
      setScanReport(data);
    } catch (err) {
      setScanReportError(err instanceof Error ? err.message : 'Failed to load scan report');
    }
  }, []);

  const runAction = useCallback(
    async (action: 'upload' | 'image', task: () => Promise<void>) => {
      if (isUploading) {
        return;
      }

      setIsUploading(true);
      setActiveAction(action);
      resetScanState();

      try {
        await task();
      } finally {
        setIsUploading(false);
        setActiveAction(null);
      }
    },
    [isUploading, resetScanState]
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      await runAction('upload', async () => {
        try {
          const result = await uploadFile(file);
          setUploadedFile(result);
          await loadScanReport(result.scan_report_url);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Upload failed');
        }
      });
    },
    [loadScanReport, runAction]
  );

  const handleUrlSubmit = useCallback(async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError('Please enter a URL');
      return;
    }

    await runAction('upload', async () => {
      try {
        const result = await uploadFromUrl(trimmedUrl);
        setUploadedFile(result);
        await loadScanReport(result.scan_report_url);
        setUrl('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch URL');
      }
    });
  }, [loadScanReport, runAction, url]);

  const handleImageScan = useCallback(async () => {
    const trimmedImage = imageRef.trim();
    if (!trimmedImage) {
      setError('Please enter an image reference');
      return;
    }

    await runAction('image', async () => {
      try {
        const result = await scanImage(trimmedImage);
        setImageScanResult(result);
        await loadScanReport(result.scan_report_url);
        setImageRef('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Image scan failed');
      }
    });
  }, [imageRef, loadScanReport, runAction]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  }, [isDragging]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        await handleFileUpload(files[0]);
      }
    },
    [handleFileUpload]
  );

  const handleDropZoneClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        await handleFileUpload(files[0]);
      }
      e.target.value = '';
    },
    [handleFileUpload]
  );

  const handleUrlKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        void handleUrlSubmit();
      }
    },
    [handleUrlSubmit]
  );

  const scanRows = useMemo(() => {
    if (!Array.isArray(scanReport?.Results)) {
      return [] as ScanRow[];
    }

    return scanReport.Results.flatMap((result): ScanRow[] => {
      const misconfigs = (result.Misconfigurations || []).map((item) => ({
        kind: 'misconfig' as const,
        id: item.ID || 'MISCONFIG',
        title: item.Title || 'Misconfiguration',
        severity: item.Severity,
        status: item.Status || 'FAIL',
        location: item?.CauseMetadata?.StartLine ? `Line ${item.CauseMetadata.StartLine}` : '—',
      }));

      const secrets = (result.Secrets || []).map((item) => ({
        kind: 'secret' as const,
        id: item.RuleID || item.ID || 'SECRET',
        title: item.Title || item.RuleID || 'Secret detected',
        severity: item.Severity,
        status: item?.Status || 'FAIL',
        location: item?.StartLine ? `Line ${item.StartLine}` : '—',
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
  }, [scanReport]);

  const formatCommitDate = useCallback((value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  }, []);

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-700">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black text-orange-500 tracking-tight">Doc(k)leaner</h1>
      </div>

      <div className="flex flex-col lg:flex-row items-start justify-center gap-8 max-w-7xl mx-auto">
        <div className="w-full lg:flex-1 space-y-0">
          <div className="flex items-center gap-4 px-4 mb-2">
            <button
              onClick={() => setActiveSubTab('file')}
              className={`flex items-center gap-2 text-xs font-bold transition-colors ${
                activeSubTab === 'file' ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <span className="text-sm">FL</span> File/URL
            </button>
            <button
              onClick={() => setActiveSubTab('search')}
              className={`flex items-center gap-2 text-xs font-bold transition-colors ${
                activeSubTab === 'search' ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <span className="text-sm text-orange-500">RP</span> Recherche de Rapports
            </button>
          </div>

          <div className="bg-[#3a165d] rounded-md shadow-xl overflow-hidden dark:ring-1 dark:ring-white/5">
            <div className="p-8 space-y-6 flex flex-col items-center text-center">
              <p className="text-indigo-200 text-xs max-w-md leading-relaxed">
                Il s'agit d'un service gratuit d'analyse des logiciels malveillants pour la communauté qui détecte et analyse les menaces inconnues.
              </p>

              {error && (
                <div className="w-full bg-red-500/20 border border-red-400/50 rounded px-4 py-2 text-red-200 text-sm">
                  {error}
                </div>
              )}

              {uploadedFile && (
                <div className="w-full bg-green-500/20 border border-green-400/50 rounded px-4 py-3 text-green-200 text-sm text-left">
                  <p className="font-bold mb-1">File uploaded successfully.</p>
                  <p>
                    <span className="text-green-300">Filename:</span> {uploadedFile.filename}
                  </p>
                  <p>
                    <span className="text-green-300">Size:</span> {formatFileSize(uploadedFile.size)}
                  </p>
                  <p>
                    <span className="text-green-300">ID:</span>{' '}
                    <code className="bg-black/20 px-1 rounded">{uploadedFile.file_id}</code>
                  </p>
                  {uploadedFile.scan_summary && (
                    <div className="mt-2 text-xs text-green-100">
                      <div className="font-semibold text-green-200">Scan summary</div>
                      <div>Total: {uploadedFile.scan_summary.total}</div>
                      <div>
                        Critical: {uploadedFile.scan_summary.critical} · High: {uploadedFile.scan_summary.high} · Medium:{' '}
                        {uploadedFile.scan_summary.medium} · Low: {uploadedFile.scan_summary.low} · Unknown:{' '}
                        {uploadedFile.scan_summary.unknown}
                      </div>
                      {uploadedFile.scan_summary.error && (
                        <div className="text-red-200">Scan error: {uploadedFile.scan_summary.error}</div>
                      )}
                    </div>
                  )}
                  {uploadedFile.scan_report_url && (
                    <div className="mt-2">
                      <a
                        href={uploadedFile.scan_report_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-green-200 underline text-xs"
                      >
                        View full scan JSON
                      </a>
                    </div>
                  )}
                </div>
              )}

              {imageScanResult && (
                <div className="w-full bg-green-500/20 border border-green-400/50 rounded px-4 py-3 text-green-200 text-sm text-left">
                  <p className="font-bold mb-1">Image scan completed.</p>
                  <p>
                    <span className="text-green-300">Image:</span> {imageScanResult.image}
                  </p>
                  {imageScanResult.scan_summary && (
                    <div className="mt-2 text-xs text-green-100">
                      <div className="font-semibold text-green-200">Scan summary</div>
                      <div>Total: {imageScanResult.scan_summary.total}</div>
                      <div>
                        Critical: {imageScanResult.scan_summary.critical} · High: {imageScanResult.scan_summary.high} · Medium:{' '}
                        {imageScanResult.scan_summary.medium} · Low: {imageScanResult.scan_summary.low} · Unknown:{' '}
                        {imageScanResult.scan_summary.unknown}
                      </div>
                      {imageScanResult.scan_summary.error && (
                        <div className="text-red-200">Scan error: {imageScanResult.scan_summary.error}</div>
                      )}
                    </div>
                  )}
                  {imageScanResult.scan_report_url && (
                    <div className="mt-2">
                      <a
                        href={imageScanResult.scan_report_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-green-200 underline text-xs"
                      >
                        View full scan JSON
                      </a>
                    </div>
                  )}
                </div>
              )}

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
                  ${isUploading ? 'pointer-events-none opacity-50' : ''}
                `}
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin text-4xl mb-2">◌</div>
                    <p className="text-white/80 text-sm font-medium">
                      {activeAction === 'image' ? 'Scanning...' : 'Uploading...'}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1 mb-2 text-white/60 group-hover:scale-110 transition-transform">
                      <span className="text-4xl">CL</span>
                    </div>
                    <p className="text-white/80 text-sm font-medium">
                      {isDragging ? 'Drop your file here.' : 'Drag and drop pour une analyse instantanee'}
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
                accept=".yml,.yaml,.json,.toml,.ini,.conf,.cfg,.env,.properties,.tf,.hcl,.sh,.bash,.txt,.md"
              />

              <div className="w-full flex items-center gap-2 text-white/50 text-xs py-2">
                <div className="flex-1 h-px bg-white/20"></div>
                <span>or</span>
                <div className="flex-1 h-px bg-white/20"></div>
              </div>

              <div className="w-full flex items-stretch">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={handleUrlKeyDown}
                    placeholder="https://raw.githubusercontent.com/user/repo/main/docker-compose.yml"
                    className="w-full h-11 px-4 py-2 text-sm bg-white dark:bg-gray-800 rounded-l-sm outline-none text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-50"
                    disabled={isUploading}
                  />
                </div>
                <button
                  onClick={() => void handleUrlSubmit()}
                  disabled={isUploading}
                  className="bg-orange-500 text-white px-6 font-bold text-xs rounded-r-sm hover:bg-[#e68a1f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Loading...' : 'Analyser'}
                </button>
              </div>

              <div className="w-full flex items-stretch mt-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={imageRef}
                    onChange={(e) => setImageRef(e.target.value)}
                    placeholder="nginx:latest or ghcr.io/org/app:tag"
                    className="w-full h-11 px-4 py-2 text-sm bg-white dark:bg-gray-800 rounded-l-sm outline-none text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-50"
                    disabled={isUploading}
                  />
                </div>
                <button
                  onClick={() => void handleImageScan()}
                  disabled={isUploading}
                  className="bg-orange-500 text-white px-6 font-bold text-xs rounded-r-sm hover:bg-[#e68a1f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Loading...' : 'Scan Image'}
                </button>
              </div>
            </div>

            <div className="bg-white/5 py-4 px-6 border-t border-white/10 text-center">
              <p className="text-[10px] text-white/40 uppercase tracking-widest">Maximum upload size is 20 MB.</p>
              <div className="text-[10px] text-white/60 mt-1">
                Allowed: .yml, .yaml, .json, .toml, .conf, .env, .tf, .sh, Dockerfile
              </div>
            </div>
          </div>

          {scanReportError && (
            <div className="mt-6 w-full bg-red-500/10 dark:bg-red-900/30 border border-red-400/40 rounded px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {scanReportError}
            </div>
          )}

          {scanRows.length > 0 && (
            <div className="mt-6 w-full rounded-xl border border-[#5d2e8e]/20 dark:border-[#5d2e8e]/30 bg-[#5d2e8e]/5 dark:bg-[#5d2e8e]/10 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-[#5d2e8e]/20 flex items-center justify-between bg-[#5d2e8e] text-white">
                <h3 className="font-semibold">Scan Results</h3>
                <span className="text-xs text-white/80">{scanRows.length} findings</span>
              </div>
              <div className="overflow-x-auto bg-white dark:bg-gray-900">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-[#5d2e8e] dark:text-violet-300 font-semibold border-b border-gray-100 dark:border-gray-700">
                    <tr>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3">Severity</th>
                      <th className="px-5 py-3">ID</th>
                      <th className="px-5 py-3">Title</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {scanRows.map((item, index) => (
                      <tr key={`${item.id}-${index}`} className="hover:bg-[#3a165d]/5 dark:hover:bg-[#3a165d]/20 transition-colors">
                        <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{item.kind}</td>
                        <td className={`px-5 py-3 font-semibold ${getSeverityClass(item.severity)}`}>
                          {item.severity || 'UNKNOWN'}
                        </td>
                        <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{item.id}</td>
                        <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{item.title}</td>
                        <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{item.status}</td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{item.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="w-full lg:w-72 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 shadow-sm rounded-sm p-6 space-y-6">
          <h3 className="text-gray-600 dark:text-gray-300 font-medium border-b border-gray-50 dark:border-gray-700 pb-3">Versions et Mises a Jour</h3>

          <div className="space-y-4">
            {commitError && <div className="text-xs text-red-500">{commitError}</div>}

            {!commitError && commits.length === 0 && <div className="text-xs text-gray-500 dark:text-gray-400">No updates yet.</div>}

            {commits.map((commit) => (
              <div key={commit.sha} className="space-y-1">
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{commit.message}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  {formatCommitDate(commit.date)} · {commit.short_sha}
                </p>
              </div>
            ))}

            <div className="pt-2 text-center">
              <a href="https://github.com/iddqdld/doc-k-leaner" target="_blank" rel="noopener noreferrer" className="text-orange-500 text-xs font-bold hover:underline">Voir plus</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Scanner;
