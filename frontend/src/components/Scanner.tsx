import React, { useState, useRef, DragEvent } from 'react';
import { uploadFile, uploadFromUrl, FileUploadResponse } from '../services/fileApi';

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

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-700">
      {/* Header Title */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black text-[#5d2e8e] tracking-tight">Doc(k)leaner</h1>
      </div>

      <div className="flex flex-col lg:flex-row items-start justify-center gap-8 max-w-6xl mx-auto">
        
        {/* Main Analysis Panel */}
        <div className="w-full lg:w-[650px] space-y-0">
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
        <div className="w-full lg:w-72 bg-white border border-gray-100 shadow-sm rounded-sm p-6 space-y-6">
          <h3 className="text-gray-600 font-medium border-b border-gray-50 pb-3">Versions et Mises à Jour</h3>
          
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs text-gray-700 leading-relaxed">
                Il y aura des mises à jour et des nouvelles ici
              </p>
              <p className="text-[10px] text-gray-400">Mars 31, 2025</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-gray-700 leading-relaxed">
                L'application termine la phase de test bêta!
              </p>
              <p className="text-[10px] text-gray-400">October 24, 2024</p>
            </div>

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
