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
  const url = `${getApiBaseUrl()}/api/v1/training/manual`;
  const body = JSON.stringify(item);

  return fetch(url, {
    method: 'POST',
    headers: buildHeaders(),
    body
  });
}

export async function apiUploadDDL(ddl: string): Promise<Response> {
  const url = `${getApiBaseUrl()}/api/v1/training/ddl`;
  const body = JSON.stringify({ ddl });
  return fetch(url, {
    method: 'POST',
    headers: buildHeaders(),
    body
  });
}

export async function apiListPendingTraining(): Promise<Response> {
  const url = `${getApiBaseUrl()}/api/v1/training/pending`;
  return fetch(url, { method: 'GET', headers: buildHeaders() });
}

export async function apiApproveTraining(id: number): Promise<Response> {
  const url = `${getApiBaseUrl()}/api/v1/training/approve/${id}`;
  return fetch(url, { method: 'PATCH', headers: buildHeaders() });
}

export async function apiSubmitFeedback(payload: {
  audit_id: number;
  is_valid: boolean;
  comment?: string;
  proposed_question?: string | null;
  proposed_sql?: string | null;
}): Promise<Response> {
  const url = `${getApiBaseUrl()}/api/v1/feedback`;
  return fetch(url, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload)
  });
}

export async function apiHealth(): Promise<Response> {
  const url = `${getApiBaseUrl()}/api/v1/health`;
  return fetch(url, {
    method: 'GET'
  });
}

export async function apiListFeatureToggles(): Promise<Response> {
  const url = `${getApiBaseUrl()}/api/v1/admin/settings/feature-toggles`;
  return fetch(url, { method: 'GET', headers: buildHeaders() });
}

export async function apiUpdateFeatureToggle(payload: {
  feature: string;
  value: boolean;
  reason: string;
}): Promise<Response> {
  const url = `${getApiBaseUrl()}/api/v1/admin/settings/feature-toggle`;
  return fetch(url, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload)
  });
}

export async function apiGetSentryIssues(): Promise<Response> {
  const url = `${getApiBaseUrl()}/api/v1/admin/settings/sentry-issues`;
  return fetch(url, { method: 'GET', headers: buildHeaders() });
}
