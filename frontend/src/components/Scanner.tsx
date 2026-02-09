import React, { useState, useRef, DragEvent, useEffect } from 'react';
import { uploadFile, uploadFromUrl, FileUploadResponse, getLatestCommits, CommitInfo } from '../services/fileApi';

const Scanner: React.FC = () => {
  // Form state
  const [url, setUrl] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'file' | 'search'>('file');
  
  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<FileUploadResponse | null>(null);
  const [scanReport, setScanReport] = useState<any | null>(null);
  const [scanReportError, setScanReportError] = useState<string | null>(null);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [commitError, setCommitError] = useState<string | null>(null);
  
  // Hidden file input ref (for click to upload)
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;
    const loadCommits = async () => {
      setCommitError(null);
      try {
        const data = await getLatestCommits(3);
        if (isMounted) {
          setCommits(data);
        }
      } catch (err) {
        if (isMounted) {
          setCommitError(err instanceof Error ? err.message : 'Failed to load updates');
        }
      }
    };

    loadCommits();
    return () => {
      isMounted = false;
    };
  }, []);
  
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  const handleDropZoneClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileUpload(files[0]);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setError(null);
    setUploadedFile(null);
    setScanReport(null);
    setScanReportError(null);

    try {
      const result = await uploadFile(file);
      setUploadedFile(result);
      if (result.scan_report_url) {
        try {
          const response = await fetch(result.scan_report_url);
          if (!response.ok) {
            throw new Error(`Failed to load scan report: ${response.status}`);
          }
          const data = await response.json();
          setScanReport(data);
        } catch (err) {
          setScanReportError(err instanceof Error ? err.message : 'Failed to load scan report');
        }
      }
      console.log('File uploaded:', result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlSubmit = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadedFile(null);
    setScanReport(null);
    setScanReportError(null);

    try {
      const result = await uploadFromUrl(url);
      setUploadedFile(result);
      if (result.scan_report_url) {
        try {
          const response = await fetch(result.scan_report_url);
          if (!response.ok) {
            throw new Error(`Failed to load scan report: ${response.status}`);
          }
          const data = await response.json();
          setScanReport(data);
        } catch (err) {
          setScanReportError(err instanceof Error ? err.message : 'Failed to load scan report');
        }
      }
      setUrl(''); // Clear input on success
      console.log('File fetched from URL:', result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch URL');
    } finally {
      setIsUploading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleUrlSubmit();
    }
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

  const scanRows = Array.isArray(scanReport?.Results)
    ? scanReport.Results.flatMap((result: any) => result.Misconfigurations || [])
    : [];

  const formatCommitDate = (value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-700">
      {/* Header Title */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black text-[#5d2e8e] tracking-tight">Doc(k)leaner</h1>
      </div>

      <div className="flex flex-col lg:flex-row items-start justify-center gap-8 max-w-7xl mx-auto">
        
        {/* Main Analysis Panel */}
        <div className="w-full lg:flex-1 space-y-0">
          {/* Sub-Tabs */}
          <div className="flex items-center gap-4 px-4 mb-2">
            <button 
              onClick={() => setActiveSubTab('file')}
              className={`flex items-center gap-2 text-xs font-bold transition-colors ${activeSubTab === 'file' ? 'text-gray-800' : 'text-gray-400'}`}
            >
              <span className="text-sm">👤</span> File/URL
            </button>
            <button 
              onClick={() => setActiveSubTab('search')}
              className={`flex items-center gap-2 text-xs font-bold transition-colors ${activeSubTab === 'search' ? 'text-orange-500' : 'text-gray-400'}`}
            >
              <span className="text-sm text-orange-500">🔍</span> Recherche de Rapports
            </button>
          </div>

          {/* Central Card */}
          <div className="bg-[#5d2e8e] rounded-md shadow-xl overflow-hidden">
            <div className="p-8 space-y-6 flex flex-col items-center text-center">
              <p className="text-indigo-200 text-xs max-w-md leading-relaxed">
                Il s'agit d'un service gratuit d'analyse des logiciels malveillants pour la communauté qui détecte et analyse les menaces inconnues.
              </p>

              {/* Error Message */}
              {error && (
                <div className="w-full bg-red-500/20 border border-red-400/50 rounded px-4 py-2 text-red-200 text-sm">
                  {error}
                </div>
              )}

              {/* Success Message */}
              {uploadedFile && (
                <div className="w-full bg-green-500/20 border border-green-400/50 rounded px-4 py-3 text-green-200 text-sm text-left">
                  <p className="font-bold mb-1">✓ File uploaded successfully!</p>
                  <p><span className="text-green-300">Filename:</span> {uploadedFile.filename}</p>
                  <p><span className="text-green-300">Size:</span> {formatFileSize(uploadedFile.size)}</p>
                  <p><span className="text-green-300">ID:</span> <code className="bg-black/20 px-1 rounded">{uploadedFile.file_id}</code></p>
                  {uploadedFile.scan_summary && (
                    <div className="mt-2 text-xs text-green-100">
                      <div className="font-semibold text-green-200">Scan summary</div>
                      <div>Total: {uploadedFile.scan_summary.total}</div>
                      <div>
                        Critical: {uploadedFile.scan_summary.critical} · High: {uploadedFile.scan_summary.high} ·
                        Medium: {uploadedFile.scan_summary.medium} · Low: {uploadedFile.scan_summary.low} ·
                        Unknown: {uploadedFile.scan_summary.unknown}
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

              {/* Drag & Drop Area */}
              <div 
                onClick={handleDropZoneClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  w-full h-40 border-2 border-dashed rounded-sm 
                  flex flex-col items-center justify-center cursor-pointer 
                  transition-all duration-200 group
                  ${isDragging 
                    ? 'border-white bg-white/20 scale-[1.02]' 
                    : 'border-white/40 bg-white/5 hover:bg-white/10'}
                  ${isUploading ? 'pointer-events-none opacity-50' : ''}
                `}
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin text-4xl mb-2">⚙️</div>
                    <p className="text-white/80 text-sm font-medium">Uploading...</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1 mb-2 text-white/60 group-hover:scale-110 transition-transform">
                      <span className="text-4xl">⚙️⚙️</span>
                    </div>
                    <p className="text-white/80 text-sm font-medium">
                      {isDragging ? 'Drop your file here!' : 'Drag & Drop Pour Une Analyse Instantanée'}
                    </p>
                    <p className="text-white/50 text-xs mt-1">or click to browse</p>
                  </>
                )}
              </div>

              {/* Hidden file input */}
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

              {/* URL Input Area */}
              <div className="w-full flex items-stretch">
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="https://raw.githubusercontent.com/user/repo/main/docker-compose.yml"
                    className="w-full h-11 px-4 py-2 text-sm bg-white rounded-l-sm outline-none text-gray-800 placeholder:text-gray-400 disabled:opacity-50"
                    disabled={isUploading}
                  />
                </div>
                <button 
                  onClick={handleUrlSubmit}
                  disabled={isUploading}
                  className="bg-[#ff9d24] text-white px-6 font-bold text-xs rounded-r-sm hover:bg-[#e68a1f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Loading...' : 'Analyser'}
                </button>
              </div>
            </div>

            {/* Bottom info bar */}
            <div className="bg-white/5 py-4 px-6 border-t border-white/10 text-center">
              <p className="text-[10px] text-white/40 uppercase tracking-widest">
                Maximum upload size is 20 MB.
              </p>
              <div className="text-[10px] text-white/60 mt-1">
                Allowed: .yml, .yaml, .json, .toml, .conf, .env, .tf, .sh, Dockerfile
              </div>
            </div>
          </div>

          {scanReportError && (
            <div className="mt-6 w-full bg-red-500/10 border border-red-400/40 rounded px-4 py-3 text-sm text-red-700">
              {scanReportError}
            </div>
          )}

          {scanRows.length > 0 && (
            <div className="mt-6 w-full rounded-xl border border-[#5d2e8e]/20 bg-[#5d2e8e]/5 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-[#5d2e8e]/20 flex items-center justify-between bg-[#5d2e8e] text-white">
                <h3 className="font-semibold">Scan Results</h3>
                <span className="text-xs text-white/80">{scanRows.length} findings</span>
              </div>
              <div className="overflow-x-auto bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-[#5d2e8e] font-semibold border-b border-gray-100">
                    <tr>
                      <th className="px-5 py-3">Severity</th>
                      <th className="px-5 py-3">ID</th>
                      <th className="px-5 py-3">Title</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {scanRows.map((item: any, index: number) => (
                      <tr key={`${item.ID || 'row'}-${index}`} className="hover:bg-[#5d2e8e]/5 transition-colors">
                        <td className={`px-5 py-3 font-semibold ${getSeverityClass(item.Severity)}`}>
                          {item.Severity || 'UNKNOWN'}
                        </td>
                        <td className="px-5 py-3 text-gray-700">{item.ID}</td>
                        <td className="px-5 py-3 text-gray-700">{item.Title}</td>
                        <td className="px-5 py-3 text-gray-700">{item.Status}</td>
                        <td className="px-5 py-3 text-gray-500">
                          {item?.CauseMetadata?.StartLine
                            ? `Line ${item.CauseMetadata.StartLine}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Widget */}
        <div className="w-full lg:w-72 bg-white border border-gray-100 shadow-sm rounded-sm p-6 space-y-6">
          <h3 className="text-gray-600 font-medium border-b border-gray-50 pb-3">Versions et Mises à Jour</h3>
          
          <div className="space-y-4">
            {commitError && (
              <div className="text-xs text-red-500">{commitError}</div>
            )}

            {!commitError && commits.length === 0 && (
              <div className="text-xs text-gray-500">No updates yet.</div>
            )}

            {commits.map((commit) => (
              <div key={commit.sha} className="space-y-1">
                <p className="text-xs text-gray-700 leading-relaxed">
                  {commit.message}
                </p>
                <p className="text-[10px] text-gray-400">
                  {formatCommitDate(commit.date)} · {commit.short_sha}
                </p>
              </div>
            ))}

            <div className="pt-2 text-center">
              <button className="text-[#ff9d24] text-xs font-bold hover:underline">
                Voir Plus!
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Scanner;
