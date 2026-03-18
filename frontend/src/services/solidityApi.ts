const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  informational: number;
  total: number;
}

export interface SolidityUploadResponse {
  contract_id: string;
  scan_id: string;
  guard_audit_id: string;
  filename: string;
  size: number;
  mode: 'quick' | 'standard';
  status: string;
}

export interface SolidityScanStatus {
  scan_id: string;
  contract_id: string;
  guard_audit_id: string;
  mode: string;
  status: string;
  phase: number;
  total_phases: number;
  phase_name: string;
  progress: number;
  score: number | null;
  severity_counts: SeverityCounts;
  created_at: string;
  completed_at: string | null;
}

export interface SolidityFinding {
  id: string;
  title: string;
  severity: string;
  confidence: number;
  file: string;
  line: number;
  code_snippet: string;
  description: string;
  remediation: string;
  category: string;
  swc: string | null;
  tool: string;
}

export interface SolidityScanReport {
  scan_id: string;
  contract_id: string;
  filename: string;
  mode: string;
  status: string;
  score: number | null;
  severity_counts: SeverityCounts;
  findings: SolidityFinding[];
  report_markdown: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface SolidityScanRecord {
  scan_id: string;
  contract_id: string;
  filename: string;
  mode: string;
  status: string;
  score: number | null;
  severity_counts: SeverityCounts;
  created_at: string;
}

export interface PatternInfo {
  id: string;
  title: string;
  severity: string;
  category: string;
  swc: string | null;
  description: string;
}

export interface SolidityHealth {
  solidityguard: 'up' | 'down';
  url: string;
}

async function parseError(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    if (payload.detail) return payload.detail;
  } catch {
    // non-JSON response
  }
  return `Request failed: ${response.status}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) throw new Error(await parseError(response));
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function uploadSolidityFiles(
  files: File[],
  mode: 'quick' | 'standard' = 'standard',
): Promise<SolidityUploadResponse> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  formData.append('mode', mode);

  return requestJson<SolidityUploadResponse>('/api/solidity/upload', {
    method: 'POST',
    body: formData,
  });
}

export async function getSolidityScanStatus(scanId: string): Promise<SolidityScanStatus> {
  return requestJson<SolidityScanStatus>(`/api/solidity/scans/${scanId}`);
}

export async function getSolidityScanReport(scanId: string): Promise<SolidityScanReport> {
  return requestJson<SolidityScanReport>(`/api/solidity/scans/${scanId}/report`);
}

export function getSolidityScanPdfUrl(scanId: string): string {
  return `${API_BASE_URL}/api/solidity/scans/${scanId}/pdf`;
}

export async function listSolidityScans(limit = 50): Promise<SolidityScanRecord[]> {
  return requestJson<SolidityScanRecord[]>(`/api/solidity/scans?limit=${limit}`);
}

export async function listPatterns(
  category?: string,
  severity?: string,
): Promise<PatternInfo[]> {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (severity) params.set('severity', severity);
  const qs = params.toString();
  return requestJson<PatternInfo[]>(`/api/solidity/patterns${qs ? `?${qs}` : ''}`);
}

export async function getSolidityHealth(): Promise<SolidityHealth> {
  return requestJson<SolidityHealth>('/api/solidity/health');
}
