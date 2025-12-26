import { API_BASE_URL, TOKEN_STORAGE_KEY } from './config';

// Helper to get the stored JWT token from localStorage.
function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

// Helper to build default headers for requests.
function buildHeaders(additional?: Record<string, string>): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return { ...headers, ...(additional || {}) };
}

export async function apiAskQuestion(question: string, context: Record<string, unknown> | null = null): Promise<Response> {
  const body = JSON.stringify({ question, context });
  return fetch(`${API_BASE_URL}/api/v1/ask`, {
    method: 'POST',
    headers: buildHeaders(),
    body
  });
}

export async function apiUploadTraining(item: { question: string; sql: string; metadata?: Record<string, unknown> }): Promise<Response> {
  const body = JSON.stringify(item);
  return fetch(`${API_BASE_URL}/api/v1/training`, {
    method: 'POST',
    headers: buildHeaders(),
    body
  });
}

export async function apiHealth(): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/v1/health`);
}

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}