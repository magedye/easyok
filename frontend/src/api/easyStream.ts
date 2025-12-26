import type { AskChunk, AskQuestionPayload } from '../types/api';

type AskChunkEnvelope = { type: unknown; payload: unknown };

function getApiBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL is not set');
  }
  return String(baseUrl).replace(/\/$/, '');
}

function isEnvelope(value: unknown): value is AskChunkEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.type === 'string' && 'payload' in v;
}

export async function askQuestion(
  payload: AskQuestionPayload,
  onChunk: (chunk: AskChunk) => void,
  options?: { signal?: AbortSignal }
): Promise<void> {
  const url = `${getApiBaseUrl()}/api/v1/ask`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: options?.signal
  });

  if (!response.ok) {
    let details = '';
    try {
      details = await response.text();
    } catch {
      // ignore
    }
    const suffix = details ? `: ${details}` : '';
    throw new Error(`Request failed (${response.status} ${response.statusText})${suffix}`);
  }

  if (!response.body) {
    throw new Error('Response body is not a readable stream');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
        const rawLine = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        const line = rawLine.trim().replace(/\r$/, '');
        if (!line) continue;

        const parsed: unknown = JSON.parse(line);
        if (!isEnvelope(parsed)) {
          throw new Error('Invalid NDJSON chunk envelope');
        }

        const chunk = parsed as AskChunk;
        onChunk(chunk);

        if (chunk.type === 'error') {
          await reader.cancel();
          return;
        }
      }
    }

    buffer += decoder.decode();
    const tail = buffer.trim();
    if (tail) {
      const parsed: unknown = JSON.parse(tail);
      if (!isEnvelope(parsed)) {
        throw new Error('Invalid NDJSON chunk envelope');
      }

      const chunk = parsed as AskChunk;
      onChunk(chunk);

      if (chunk.type === 'error') {
        await reader.cancel();
        return;
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}
