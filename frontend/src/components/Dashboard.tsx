import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  adminDeleteUser,
  getAdminOverview,
  getAdminUsers,
  type AdminOverview as AdminOverviewType,
  type AdminUserRow,
} from '../services/authApi';
import { AdminFileRecord, getAdminFiles } from '../services/fileApi';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [overview, setOverview] = useState<AdminOverviewType | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [files, setFiles] = useState<AdminFileRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (user?.role !== 'admin') return;
    setLoading(true);
    setError(null);
    setUsersError(null);
    try {
      const [ov, u, f] = await Promise.all([
        getAdminOverview(),
        getAdminUsers(),
        getAdminFiles(50),
      ]);
      setOverview(ov);
      setAdminUsers(u);
      setFiles(f);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec du chargement');
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleDeleteUser = useCallback(
    async (row: AdminUserRow) => {
      if (row.id === user?.id) return;
      if (!window.confirm(`Supprimer l'utilisateur ${row.email} ? Ses fichiers resteront (anonymisés).`)) return;
      setDeletingId(row.id);
      setUsersError(null);
      try {
        await adminDeleteUser(row.id);
        setAdminUsers((prev) => prev.filter((u) => u.id !== row.id));
        const ov = await getAdminOverview();
        setOverview(ov);
      } catch (err) {
        setUsersError(err instanceof Error ? err.message : 'Suppression impossible');
      } finally {
        setDeletingId(null);
      }
    },
    [user?.id],
  );

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  const formatDate = useCallback((value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('fr-FR');
  }, []);

  const formatScanSummary = useCallback((file: AdminFileRecord): string => {
    if (!file.scan_summary) return '—';
    return `C:${file.scan_summary.critical} H:${file.scan_summary.high} M:${file.scan_summary.medium} L:${file.scan_summary.low}`;
  }, []);

  if (user?.role !== 'admin') {
    return (
      <div className="max-w-lg mx-auto text-center py-16 px-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Accès réservé aux administrateurs</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Cette page n'est visible qu'avec un compte admin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500 w-full max-w-6xl">
      <div>
        <h2 className="text-3xl font-black text-orange-500 tracking-tight">Administration</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Métriques, utilisateurs et fichiers stockés</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Metrics */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-[#3a165d] rounded-xl px-5 py-4 text-center">
            <div className="text-2xl font-bold text-white">{overview.total_users}</div>
            <div className="text-[10px] text-white/50 uppercase tracking-wide mt-1">Utilisateurs</div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-[#5d2e8e] dark:text-violet-400">{overview.registrations_last_7_days}</div>
            <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mt-1">Inscrits 7 j.</div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-[#5d2e8e] dark:text-violet-400">{overview.registrations_last_30_days}</div>
            <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mt-1">Inscrits 30 j.</div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-orange-500">{overview.avg_scans_per_user}</div>
            <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mt-1">Moy. scans / user actif</div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">{overview.users_with_owned_scans}</div>
            <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mt-1">Users avec scans</div>
          </div>
        </div>
      )}

      {/* Users */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Gestion utilisateurs</h3>
          <button
            type="button"
            className="text-xs text-orange-500 font-semibold hover:underline"
            onClick={() => void loadAll()}
            disabled={loading}
          >
            Rafraîchir
          </button>
        </div>
        {usersError && (
          <div className="mx-5 mt-3 text-sm text-red-600">{usersError}</div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-gray-400 dark:text-gray-500 font-semibold border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Nom</th>
                <th className="px-5 py-3">Rôle</th>
                <th className="px-5 py-3">Provider</th>
                <th className="px-5 py-3">Scans</th>
                <th className="px-5 py-3">Inscription</th>
                <th className="px-5 py-3 w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {adminUsers.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                  <td className="px-5 py-3 text-gray-800 dark:text-gray-200">{u.email}</td>
                  <td className="px-5 py-3 dark:text-gray-300">{u.name}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        u.role === 'admin' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{u.provider}</td>
                  <td className="px-5 py-3 dark:text-gray-300">{u.owned_items}</td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs">{formatDate(u.created_at)}</td>
                  <td className="px-5 py-3">
                    {u.id === user?.id ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : (
                      <button
                        type="button"
                        disabled={deletingId === u.id}
                        onClick={() => void handleDeleteUser(u)}
                        className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                      >
                        {deletingId === u.id ? '...' : 'Supprimer'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && adminUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                    Aucun utilisateur
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Files */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Fichiers stockés</h3>
            <p className="text-gray-500 dark:text-gray-400 text-xs">Derniers uploads Postgres</p>
          </div>
          <button
            className="bg-[#3a165d] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#5d2e8e] transition-colors disabled:opacity-60"
            onClick={() => void loadAll()}
            disabled={loading}
          >
            {loading ? 'Chargement...' : 'Rafraîchir'}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs uppercase text-gray-400 dark:text-gray-500 font-semibold border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3">Fichier</th>
                  <th className="px-6 py-3">Source</th>
                  <th className="px-6 py-3">Taille</th>
                  <th className="px-6 py-3">Scan</th>
                  <th className="px-6 py-3">Rapport</th>
                  <th className="px-6 py-3">Créé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-800 dark:text-gray-200">{file.filename}</div>
                    </td>
                    <td className="px-6 py-4 text-xs dark:text-gray-300">{file.source}</td>
                    <td className="px-6 py-4 text-sm dark:text-gray-300">{formatFileSize(file.size)}</td>
                    <td className="px-6 py-4 text-sm dark:text-gray-300">{formatScanSummary(file)}</td>
                    <td className="px-6 py-4 text-sm">
                      {file.scan_report_url ? (
                        <a href={file.scan_report_url} target="_blank" rel="noreferrer" className="text-orange-500 hover:underline">
                          JSON
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{formatDate(file.created_at)}</td>
                  </tr>
                ))}
                {!loading && files.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-6 text-sm text-gray-500 text-center">
                      Aucun fichier
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
