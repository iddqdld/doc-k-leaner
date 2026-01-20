import React, { useState, useRef, DragEvent } from 'react';
import { uploadFile, uploadFromUrl, FileUploadResponse, scanFile, TrivyScanResult } from '../services/fileApi';

// Severity color mapping for vulnerability display
const severityColors: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  CRITICAL: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    badge: 'bg-red-500'
  },
  HIGH: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-400',
    badge: 'bg-orange-500'
  },
  MEDIUM: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    badge: 'bg-yellow-500'
  },
  LOW: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    badge: 'bg-blue-500'
  },
  UNKNOWN: {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
    text: 'text-gray-400',
    badge: 'bg-gray-500'
  }
};

const API_BASE = (import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:8000';

const Scanner: React.FC = () => {
  // Form state
  const [url, setUrl] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'file' | 'search'>('file');
  
  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<FileUploadResponse | null>(null);
  
  // Scan state
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<TrivyScanResult | null>(null);
  const [expandedVulns, setExpandedVulns] = useState<Set<string>>(new Set());
  
  // Hidden file input ref (for click to upload)
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
    setScanResult(null);

    try {
      const result = await uploadFile(file);
      setUploadedFile(result);
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
    setScanResult(null);
    setExpandedVulns(new Set());

    try {
      const result = await uploadFromUrl(url);
      setUploadedFile(result);
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

  const toggleVulnExpand = (vulnId: string) => {
    setExpandedVulns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(vulnId)) {
        newSet.delete(vulnId);
      } else {
        newSet.add(vulnId);
      }
      return newSet;
    });
  };

  // Calculate vulnerability statistics
  const getVulnStats = () => {
    if (!scanResult?.Results) return null;
    
    const stats = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0, total: 0 };
    
    scanResult.Results.forEach(result => {
      result.Vulnerabilities?.forEach(vuln => {
        const severity = vuln.Severity?.toUpperCase() || 'UNKNOWN';
        if (severity in stats) {
          stats[severity as keyof typeof stats]++;
        }
        stats.total++;
      });
    });
    
    return stats;
  };

  const vulnStats = scanResult ? getVulnStats() : null;

  // Render scan results with professional design
  const renderScanResults = () => {
    if (!scanResult) return null;

    // Check if it's a simple status result (non-Trivy)
    if (scanResult.status) {
      const isClean = scanResult.status === 'Clean';
      return (
        <div className="mt-6 animate-in slide-in-from-bottom duration-500">
          <div className={`rounded-lg border ${isClean ? 'border-green-500/30 bg-green-500/5' : 'border-yellow-500/30 bg-yellow-500/5'} p-6`}>
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isClean ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
                <span className="text-3xl">{isClean ? '✓' : '⚠'}</span>
              </div>
              <div>
                <h3 className={`text-xl font-bold ${isClean ? 'text-green-400' : 'text-yellow-400'}`}>
                  {scanResult.status}
                </h3>
                <p className="text-white/60 text-sm mt-1">{scanResult.details}</p>
                {scanResult.threat_level && (
                  <p className="text-white/40 text-xs mt-2">Threat Level: {scanResult.threat_level}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Trivy scan results
    if (!scanResult.Results || scanResult.Results.length === 0) {
      return (
        <div className="mt-6 animate-in slide-in-from-bottom duration-500">
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center bg-green-500/20">
                <span className="text-3xl">🛡️</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-green-400">No Vulnerabilities Found</h3>
                <p className="text-white/60 text-sm mt-1">Your file appears to be secure.</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-6 space-y-4 animate-in slide-in-from-bottom duration-500">
        {/* Summary Stats */}
        {vulnStats && vulnStats.total > 0 && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <span className="text-lg">📊</span> Vulnerability Summary
              </h3>
              <span className="text-white/40 text-sm">{vulnStats.total} total issues</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'] as const).map(severity => (
                <div 
                  key={severity}
                  className={`rounded-lg p-3 text-center ${severityColors[severity].bg} border ${severityColors[severity].border}`}
                >
                  <div className={`text-2xl font-bold ${severityColors[severity].text}`}>
                    {vulnStats[severity]}
                  </div>
                  <div className="text-xs text-white/50 mt-1 capitalize">{severity.toLowerCase()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Results */}
        {scanResult.Results.map((result, resultIdx) => (
          <div key={resultIdx} className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
            {/* Target Header */}
            <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">📁</span>
                <div>
                  <h4 className="text-white font-medium text-sm">{result.Target || 'Unknown Target'}</h4>
                  <p className="text-white/40 text-xs">{result.Type || 'Unknown Type'} • {result.Class || 'Unknown Class'}</p>
                </div>
              </div>
              <span className="text-white/40 text-xs">
                {result.Vulnerabilities?.length || 0} vulnerabilities
              </span>
            </div>

            {/* Vulnerabilities List */}
            {result.Vulnerabilities && result.Vulnerabilities.length > 0 && (
              <div className="divide-y divide-white/5">
                {result.Vulnerabilities.map((vuln, vulnIdx) => {
                  const vulnKey = `${resultIdx}-${vulnIdx}-${vuln.VulnerabilityID}`;
                  const isExpanded = expandedVulns.has(vulnKey);
                  const severity = vuln.Severity?.toUpperCase() || 'UNKNOWN';
                  const colors = severityColors[severity] || severityColors.UNKNOWN;

                  return (
                    <div key={vulnKey} className="hover:bg-white/5 transition-colors">
                      {/* Vulnerability Header */}
                      <button
                        onClick={() => toggleVulnExpand(vulnKey)}
                        className="w-full px-4 py-3 flex items-center gap-3 text-left"
                      >
                        <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${colors.badge}`}>
                          {severity}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-mono text-sm">{vuln.VulnerabilityID}</span>
                            <span className="text-white/30">•</span>
                            <span className="text-white/60 text-sm truncate">{vuln.PkgName}</span>
                          </div>
                          {vuln.Title && (
                            <p className="text-white/40 text-xs mt-1 truncate">{vuln.Title}</p>
                          )}
                        </div>
                        <span className={`text-white/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                          ▼
                        </span>
                      </button>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-3 animate-in slide-in-from-top duration-200">
                          {vuln.Description && (
                            <div className="bg-black/20 rounded-lg p-3">
                              <p className="text-white/70 text-xs leading-relaxed">{vuln.Description}</p>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            {vuln.InstalledVersion && (
                              <div className="bg-black/20 rounded-lg p-3">
                                <span className="text-white/40 block mb-1">Installed Version</span>
                                <span className="text-red-400 font-mono">{vuln.InstalledVersion}</span>
                              </div>
                            )}
                            {vuln.FixedVersion && (
                              <div className="bg-black/20 rounded-lg p-3">
                                <span className="text-white/40 block mb-1">Fixed Version</span>
                                <span className="text-green-400 font-mono">{vuln.FixedVersion}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-700">
      {/* Header Title */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black text-[#5d2e8e] tracking-tight">Doc(k)leaner</h1>
      </div>

      <div className="flex flex-col lg:flex-row items-start justify-center gap-8 max-w-6xl mx-auto">
        
        {/* Main Analysis Panel */}
        <div className="w-full lg:w-[700px] space-y-0">
          {/* Sub-Tabs */}
          <div className="flex items-center gap-4 px-4 mb-2">
            <button 
              onClick={() => setActiveSubTab('file')}
              className={`flex items-center gap-2 text-xs font-bold transition-colors ${activeSubTab === 'file' ? 'text-gray-800' : 'text-gray-400'}`}
            >
              <span className="text-sm">📄</span> File/URL
            </button>
            <button 
              onClick={() => setActiveSubTab('search')}
              className={`flex items-center gap-2 text-xs font-bold transition-colors ${activeSubTab === 'search' ? 'text-orange-500' : 'text-gray-400'}`}
            >
              <span className="text-sm text-orange-500">🔍</span> Recherche de Rapports
            </button>
          </div>

          {/* Central Card */}
          <div className="bg-gradient-to-br from-[#5d2e8e] to-[#4a2272] rounded-xl shadow-2xl overflow-hidden">
            <div className="p-8 space-y-6 flex flex-col items-center text-center">
              <p className="text-indigo-200 text-sm max-w-md leading-relaxed">
                Service gratuit d'analyse de sécurité pour détecter les vulnérabilités dans vos fichiers de configuration.
              </p>

              {/* Error Message */}
              {error && (
                <div className="w-full bg-red-500/20 border border-red-400/50 rounded-lg px-4 py-3 text-red-200 text-sm flex items-center gap-3">
                  <span className="text-xl">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Success Message */}
              {uploadedFile && !scanResult && !isScanning && (
                <div className="w-full bg-green-500/20 border border-green-400/50 rounded-lg px-4 py-4 text-green-200 text-sm text-left">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl">✅</span>
                    <span className="font-bold">File uploaded successfully!</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs ml-8">
                    <div><span className="text-green-300/70">Filename:</span> {uploadedFile.filename}</div>
                    <div><span className="text-green-300/70">Size:</span> {formatFileSize(uploadedFile.size)}</div>
                  </div>
                </div>
              )}

              {/* Drag & Drop Area */}
              <div 
                onClick={handleDropZoneClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  w-full h-44 border-2 border-dashed rounded-xl 
                  flex flex-col items-center justify-center cursor-pointer 
                  transition-all duration-300 group relative overflow-hidden
                  ${isDragging 
                    ? 'border-white bg-white/20 scale-[1.02]' 
                    : 'border-white/30 bg-white/5 hover:bg-white/10 hover:border-white/50'}
                  ${isUploading || isScanning ? 'pointer-events-none' : ''}
                `}
              >
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                    backgroundSize: '20px 20px'
                  }}></div>
                </div>

                {isUploading ? (
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mb-3"></div>
                    <p className="text-white/80 text-sm font-medium">Uploading...</p>
                  </div>
                ) : isScanning ? (
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-purple-400/30 rounded-full"></div>
                      <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-purple-400 rounded-full animate-spin"></div>
                      <span className="absolute inset-0 flex items-center justify-center text-2xl">🔍</span>
                    </div>
                    <p className="text-white/80 text-sm font-medium mt-3">Scanning for vulnerabilities...</p>
                    <p className="text-white/50 text-xs mt-1">This may take a moment</p>
                  </div>
                ) : (
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="flex items-center gap-2 mb-3 text-white/60 group-hover:scale-110 transition-transform duration-300">
                      <span className="text-5xl">📤</span>
                    </div>
                    <p className="text-white font-medium">
                      {isDragging ? 'Drop your file here!' : 'Drag & Drop pour analyser'}
                    </p>
                    <p className="text-white/50 text-xs mt-2">ou cliquez pour parcourir</p>
                  </div>
                )}
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileInputChange}
                className="hidden"
                accept=".yml,.yaml,.json,.toml,.ini,.conf,.cfg,.env,.properties,.tf,.hcl,.sh,.bash,.txt,.md,.dockerfile"
              />

              <div className="w-full flex items-center gap-3 text-white/40 text-xs py-2">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                <span className="uppercase tracking-wider">ou</span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
              </div>

              {/* URL Input Area */}
              <div className="w-full flex items-stretch rounded-lg overflow-hidden shadow-lg">
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="https://raw.githubusercontent.com/user/repo/main/docker-compose.yml"
                    className="w-full h-12 px-4 py-2 text-sm bg-white outline-none text-gray-800 placeholder:text-gray-400 disabled:opacity-50"
                    disabled={isUploading || isScanning}
                  />
                </div>
                <button 
                  onClick={handleUrlSubmit}
                  disabled={isUploading || isScanning}
                  className="bg-gradient-to-r from-[#ff9d24] to-[#ff8c00] text-white px-8 font-bold text-sm hover:from-[#e68a1f] hover:to-[#e67d00] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Loading...' : 'Analyser'}
                </button>
              </div>
            </div>

            {/* Bottom info bar */}
            <div className="bg-black/20 py-4 px-6 border-t border-white/10">
              <div className="flex items-center justify-center gap-6 text-xs text-white/50">
                <span className="flex items-center gap-1">
                  <span>📦</span> Max 20 MB
                </span>
                <span className="flex items-center gap-1">
                  <span>📄</span> .yml, .yaml, .json, .toml, .conf, .env, Dockerfile
                </span>
              </div>
            </div>
            {/* Scan result */}
            {isScanning && (
              <div className="p-4 text-sm text-white">Analyse en cours...</div>
            )}

            {scanResult && (
              <div className="p-4 bg-white/5 text-sm text-white mt-4 rounded">
                <div className="font-bold mb-2">Résultat</div>
                <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(scanResult, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Widget */}
        <div className="w-full lg:w-72 space-y-4">
          {/* Stats Card */}
          <div className="bg-white border border-gray-100 shadow-lg rounded-xl p-6">
            <h3 className="text-gray-700 font-semibold flex items-center gap-2 mb-4">
              <span>📈</span> Statistiques
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Fichiers analysés</span>
                <span className="text-[#5d2e8e] font-bold">1,234</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Vulnérabilités détectées</span>
                <span className="text-red-500 font-bold">567</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Fichiers sécurisés</span>
                <span className="text-green-500 font-bold">89%</span>
              </div>
            </div>
          </div>

          {/* Updates Card */}
          <div className="bg-white border border-gray-100 shadow-lg rounded-xl p-6">
            <h3 className="text-gray-700 font-semibold flex items-center gap-2 border-b border-gray-100 pb-3 mb-4">
              <span>📢</span> Mises à Jour
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-gray-700 leading-relaxed">
                  Nouvelle version avec support Trivy amélioré
                </p>
                <p className="text-xs text-gray-400">Janvier 20, 2026</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-gray-700 leading-relaxed">
                  L'application termine la phase de test bêta!
                </p>
                <p className="text-xs text-gray-400">Octobre 24, 2024</p>
              </div>

              <div className="pt-2 text-center">
                <button className="text-[#ff9d24] text-sm font-bold hover:underline transition-all">
                  Voir Plus →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Scanner;
