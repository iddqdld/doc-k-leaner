import React, { useEffect, useState } from 'react';
import { getMyHistory, type ScanHistoryItem } from '../services/authApi';

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const ScanHistory: React.FC = () => {
  const [items, setItems] = useState<ScanHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyHistory()
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-full max-w-3xl">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black text-orange-500 tracking-tight">Mon historique</h1>
        <p className="text-sm text-gray-500 mt-2">Vos scans et fichiers analysés</p>
      </div>

      {loading && <p className="text-center text-sm text-gray-400">Chargement...</p>}
      {error && <p className="text-center text-sm text-red-500">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-center text-sm text-gray-400">Aucun scan trouvé.</p>
      )}

      {items.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Fichier</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Taille</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-700 truncate max-w-[200px]">{item.filename}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      item.scan_type === 'solidity'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {item.scan_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatSize(item.size)}</td>
                  <td className="px-4 py-3 text-gray-400">{new Date(item.created_at).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ScanHistory;
