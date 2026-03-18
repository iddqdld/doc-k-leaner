import { authHeaders } from './authApi';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface FileUploadResponse {
  file_id: string;
  filename: string;
  size: number;
  content_type: string;
  source: 'upload' | 'url';
  uploaded_at: string;
  scan_summary?: {
    status: string;
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    unknown: number;
    error?: string | null;
  } | null;
  scan_report_url?: string | null;
}

export interface AdminFileRecord {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  source: 'upload' | 'url';
  original_url?: string | null;
  storage_path: string;
  created_at: string;
  scan_status?: string | null;
  scan_summary?: {
    status: string;
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    unknown: number;
    error?: string | null;
  } | null;
  scan_report_url?: string | null;
}

export interface ApiError {
  detail: string;
}

export interface CommitInfo {
  sha: string;
  short_sha: string;
  message: string;
  date: string;
}

export interface ImageScanResponse {
  image: string;
  scan_summary?: {
    status: string;
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    unknown: number;
    error?: string | null;
  } | null;
  scan_report_url?: string | null;
}

export interface AuditStats {
  total_files: number;
  total_scans: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface DailyScans {
  date: string;
  count: number;
}

export interface DailySeverity {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface FileTypeCount {
  file_type: string;
  count: number;
}

export interface SourceCount {
  source: string;
  count: number;
}

export interface SolidityOverview {
  total_contracts: number;
  total_scans: number;
  completed_scans: number;
  avg_score: number | null;
  critical: number;
  high: number;
  medium: number;
  low: number;
  informational: number;
}

export interface SolidityDailyScans {
  date: string;
  count: number;
}

export interface GlobalOverview {
  total_files: number;
  total_size_bytes: number;
  sandbox_lines: number;
}

export interface SandboxValidationResponse {
  sanitized_text: string;
  input_length: number;
  model: string;
  request_id?: string | null;
  processed_at: string;
}
// api functions 

async function parseApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as Partial<ApiError>;
    if (payload.detail) {
      return payload.detail;
    }
  } catch {
    // Ignore non-JSON responses.
  }
  return `Request failed: ${response.status}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = { ...authHeaders(), ...(init?.headers as Record<string, string>) };
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export async function uploadFile(file: File): Promise<FileUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  return requestJson<FileUploadResponse>('/api/files/upload', {
    method: 'POST',
    body: formData,
  });
}

export async function uploadFromUrl(url: string): Promise<FileUploadResponse> {
  return requestJson<FileUploadResponse>('/api/files/from-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });
}

export async function getFileMetadata(fileId: string): Promise<FileUploadResponse> {
  return requestJson<FileUploadResponse>(`/api/files/${fileId}`);
}

export async function deleteFile(fileId: string): Promise<void> {
  await requestJson(`/api/files/${fileId}`, {
    method: 'DELETE',
  });
}

export async function getAdminFiles(limit = 50): Promise<AdminFileRecord[]> {
  return requestJson<AdminFileRecord[]>(`/api/files/admin/files?limit=${limit}`);
}

export async function getLatestCommits(limit = 3): Promise<CommitInfo[]> {
  return requestJson<CommitInfo[]>(`/api/news/commits?limit=${limit}`);
}

export async function scanImage(image: string): Promise<ImageScanResponse> {
  return requestJson<ImageScanResponse>('/api/files/scan-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image }),
  });
}

export async function getGlobalOverview(): Promise<GlobalOverview> {
  return requestJson<GlobalOverview>('/api/stats/global');
}

export async function getAuditStats(): Promise<AuditStats> {
  return requestJson<AuditStats>('/api/stats/overview');
}

export async function getScansOverTime(days = 30, offset = 0): Promise<DailyScans[]> {
  return requestJson<DailyScans[]>(`/api/stats/scans-over-time?days=${days}&offset=${offset}`);
}

export async function getSeverityOverTime(days = 30, offset = 0): Promise<DailySeverity[]> {
  return requestJson<DailySeverity[]>(`/api/stats/severity-over-time?days=${days}&offset=${offset}`);
}

export async function getFileTypeStats(): Promise<FileTypeCount[]> {
  return requestJson<FileTypeCount[]>('/api/stats/by-file-type');
}

export async function getSourceStats(): Promise<SourceCount[]> {
  return requestJson<SourceCount[]>('/api/stats/by-source');
}

export async function getSolidityOverview(): Promise<SolidityOverview> {
  return requestJson<SolidityOverview>('/api/stats/solidity/overview');
}

export async function getSolidityScansOverTime(days = 30): Promise<SolidityDailyScans[]> {
  return requestJson<SolidityDailyScans[]>(`/api/stats/solidity/scans-over-time?days=${days}`);
}

export async function validateSandboxInput(
  inputText: string
): Promise<SandboxValidationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/sandbox/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ input_text: inputText }),
  });

  const data = await response.json();

  if (!response.ok) {
    const detail: string =
      (data && (data.detail as string)) ||
      `Sandbox validation failed: ${response.status}`;
    throw new Error(detail);
  }

  return data as SandboxValidationResponse;
}
