const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const TOKEN_KEY = 'dockcleaner_token';

// token helpers 
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// types

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: string;
  provider: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserResponse;
}

export interface ScanHistoryItem {
  id: string;
  filename: string;
  size: number;
  scan_type: string;
  created_at: string;
}

// api calls

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail || `Request failed: ${response.status}`);
  }
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function register(email: string, password: string, name: string): Promise<TokenResponse> {
  const res = await authRequest<TokenResponse>('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  setToken(res.access_token);
  return res;
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const res = await authRequest<TokenResponse>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  setToken(res.access_token);
  return res;
}

export async function googleLogin(credential: string): Promise<TokenResponse> {
  const res = await authRequest<TokenResponse>('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });
  setToken(res.access_token);
  return res;
}

export async function getMe(): Promise<UserResponse> {
  return authRequest<UserResponse>('/api/auth/me', {
    headers: authHeaders(),
  });
}

export async function getMyHistory(): Promise<ScanHistoryItem[]> {
  return authRequest<ScanHistoryItem[]>('/api/auth/me/history', {
    headers: authHeaders(),
  });
}
