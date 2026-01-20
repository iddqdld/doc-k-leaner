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
}

export interface ApiError {
  detail: string;
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
