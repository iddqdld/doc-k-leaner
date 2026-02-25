//file upload api service

// api base url
const API_BASE_URL = 'http://localhost:8000';

// types defenition pour avoir les memes avec back 
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

export interface SandboxValidationResponse {
  sanitized_text: string;
  input_length: number;
  model: string;
  request_id?: string | null;
  processed_at: string;
}
// api functions 

// drag&drop upload
export async function uploadFile(file: File): Promise<FileUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/files/upload`, {
    method: 'POST',
    body: formData,
    // Content-Type header - set by browser par default
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || `Upload failed: ${response.status}`);
  }

  return response.json();
}

/* url upload */
export async function uploadFromUrl(url: string): Promise<FileUploadResponse> {
  const response = await fetch(`${API_BASE_URL}/api/files/from-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || `Upload failed: ${response.status}`);
  }

  return response.json();
}

/* get metadata */ 
export async function getFileMetadata(fileId: string): Promise<FileUploadResponse> {
  const response = await fetch(`${API_BASE_URL}/api/files/${fileId}`);

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || `Failed to get file: ${response.status}`);
  }

  return response.json();
}

/* delete */
export async function deleteFile(fileId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/files/${fileId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || `Failed to delete file: ${response.status}`);
  }
}

export async function getAdminFiles(limit = 50): Promise<AdminFileRecord[]> {
  const response = await fetch(`${API_BASE_URL}/api/files/admin/files?limit=${limit}`);

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || `Failed to list files: ${response.status}`);
  }

  return response.json();
}

export async function getLatestCommits(limit = 3): Promise<CommitInfo[]> {
  const response = await fetch(`${API_BASE_URL}/api/news/commits?limit=${limit}`);

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || `Failed to load commits: ${response.status}`);
  }

  return response.json();
}

export async function scanImage(image: string): Promise<ImageScanResponse> {
  const response = await fetch(`${API_BASE_URL}/api/files/scan-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image }),
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || `Failed to scan image: ${response.status}`);
  }

  return response.json();
}

export async function getAuditStats(): Promise<AuditStats> {
  const response = await fetch(`${API_BASE_URL}/api/stats/overview`);

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || `Failed to load stats: ${response.status}`);
  }

  return response.json();
}

export async function validateSandboxInput(
  inputText: string
): Promise<SandboxValidationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/sandbox/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
