import React, { useCallback, useEffect, useState } from 'react';
import { AdminFileRecord, getAdminFiles } from '../services/fileApi';

const Dashboard: React.FC = () => {
  const [files, setFiles] = useState<AdminFileRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadFiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAdminFiles(50);
      setFiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  const formatDate = useCallback((value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }, []);

  const formatScanSummary = useCallback((file: AdminFileRecord): string => {
    if (!file.scan_summary) return '—';
    return `C:${file.scan_summary.critical} H:${file.scan_summary.high} M:${file.scan_summary.medium} L:${file.scan_summary.low} U:${file.scan_summary.unknown}`;
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Admin: Stored Files</h2>
          <p className="text-gray-500 text-sm">Latest uploads from Postgres</p>
        </div>
        <button
          className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-60"
          onClick={loadFiles}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h3 className="font-semibold text-gray-900">Recent Uploads</h3>
          <span className="text-xs text-gray-400">{files.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-xs uppercase text-gray-400 font-semibold border-b border-gray-100">
              <tr>
                <th className="px-6 py-3">Filename</th>
                <th className="px-6 py-3">Source</th>
                <th className="px-6 py-3">Size</th>
                <th className="px-6 py-3">Content Type</th>
                <th className="px-6 py-3">Scan Status</th>
                <th className="px-6 py-3">Scan Summary</th>
                <th className="px-6 py-3">Report</th>
                <th className="px-6 py-3">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {files.map((file) => (
                <tr key={file.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-800">{file.filename}</div>
                    {file.original_url && (
                      <div className="text-xs text-gray-400 truncate max-w-[420px]">
                        {file.original_url}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-medium">
                      {file.source}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{formatFileSize(file.size)}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{file.content_type}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{file.scan_status || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{formatScanSummary(file)}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {file.scan_report_url ? (
                      <a
                        href={file.scan_report_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline"
                      >
                        JSON
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(file.created_at)}</td>
                </tr>
              ))}
              {!isLoading && files.length === 0 && (
                <tr>
                  <td className="px-6 py-6 text-sm text-gray-500" colSpan={8}>
                    No files stored yet.
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td className="px-6 py-6 text-sm text-gray-500" colSpan={8}>
                    Loading files...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
