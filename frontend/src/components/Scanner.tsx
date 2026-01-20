
import React, { useState, useRef } from 'react';
import { analyzeSecurityConfig } from '../services/geminiService';
import { AuditType } from '../types';

const API_BASE = (import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:8000';

const Scanner: React.FC = () => {
  const [url, setUrl] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'file' | 'search'>('file');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const allowedEndings = [
    '.dockerfile',
    '.dockerignore',
    '.yml',
    '.yaml',
    '.json',
    '.toml',
    '.conf',
    '.cfg',
    '.env',
    '.properties',
    '.k8s',
    '.nginx',
    '.txt',
    '.md',
  ];

  const acceptAttr = allowedEndings.join(',');

  const isAllowedFile = (name?: string) => {
    if (!name) return false;
    const n = name.toLowerCase();
    if (n === 'dockerfile') return true;
    return allowedEndings.some((e) => n.endsWith(e));
  };

  const uploadFileToBackend = async (file: File) => {
    setIsScanning(true);
    setScanResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      const res = await fetch(`${API_BASE}/api/scan`, { method: 'POST', body: fd });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`${res.status} ${txt}`);
      }
      const json = await res.json();
      setScanResult(json);
    } catch (err: any) {
      setScanResult({ status: 'Error', details: String(err) });
    } finally {
      setIsScanning(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) {
      if (!isAllowedFile(f.name)) {
        setScanResult({ status: 'Rejected', details: `File type not allowed: ${f.name}` });
        return;
      }
      uploadFileToBackend(f);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    if (f) {
      if (!isAllowedFile(f.name)) {
        setScanResult({ status: 'Rejected', details: `File type not allowed: ${f.name}` });
        return;
      }
      uploadFileToBackend(f);
    }
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

              {/* Drag & Drop Area */}
              <div onDrop={handleDrop} onDragOver={handleDragOver} onClick={handleChooseFile} className="w-full h-40 border-2 border-dashed border-white/40 rounded-sm bg-white/5 flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-colors group">
                <div className="flex items-center gap-1 mb-2 text-white/60 group-hover:scale-110 transition-transform">
                  <span className="text-4xl">⚙️⚙️</span>
                </div>
                <p className="text-white/80 text-sm font-medium">Drag & Drop Pour Une Analyse Instantanée</p>
                <input ref={fileInputRef} type="file" accept={acceptAttr} onChange={onFileInput} className="hidden" />
              </div>

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
                    placeholder="http://www.example.com/suspicious.zip"
                    className="w-full h-11 px-4 py-2 text-sm bg-white rounded-l-sm outline-none text-gray-800 placeholder:text-gray-400"
                  />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    📎
                  </button>
                </div>
                <button 
                  className="bg-[#ff9d24] text-white px-6 font-bold text-xs rounded-r-sm hover:bg-[#e68a1f] transition-colors"
                >
                  Analyser
                </button>
              </div>
            </div>

            {/* Bottom info bar */}
            <div className="bg-white/5 py-4 px-6 border-t border-white/10 text-center">
              <p className="text-[10px] text-white/40 uppercase tracking-widest">
                Maximum upload size is XXX MB.
              </p>
              <div className="text-[10px] text-white/60 mt-1">
                Powered by <span className="text-orange-400 font-bold">À préciser plus tard</span> .
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
