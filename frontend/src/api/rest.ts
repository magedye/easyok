function getApiBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL is not set');
  }
  return String(baseUrl).replace(/\/$/, '');
}

function buildHeaders(additional?: Record<string, string>): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };

  // AUTH is currently disabled in the MVP.
  // Do not attach Authorization headers.

  return { ...headers, ...(additional || {}) };
}

export async function apiUploadTraining(item: {
  question: string;
  sql: string;
  metadata?: Record<string, unknown>;
}): Promise<Response> {
  const url = `${getApiBaseUrl()}/api/v1/training`;
  const body = JSON.stringify(item);

  return fetch(url, {
    method: 'POST',
    headers: buildHeaders(),
    body
  });
}

export async function apiHealth(): Promise<Response> {
  const url = `${getApiBaseUrl()}/api/v1/health`;
  return fetch(url, {
    method: 'GET'
  });
}
