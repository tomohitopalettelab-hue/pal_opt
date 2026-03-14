const getBaseUrl = (): string => process.env.PAL_DB_BASE_URL?.trim() || 'http://localhost:3100';

export const buildPalDbUrl = (path: string): string => {
  const base = getBaseUrl().replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

type PalDbRequestOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number) => {
  if (init.signal || timeoutMs <= 0) {
    return fetch(url, init);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export const palDbGet = async (path: string, options?: PalDbRequestOptions): Promise<Response> => {
  const timeoutMs = options?.timeoutMs ?? 8000;
  return fetchWithTimeout(
    buildPalDbUrl(path),
    {
      method: 'GET',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      signal: options?.signal,
    },
    timeoutMs,
  );
};

export const palDbPost = async (path: string, body: unknown, options?: PalDbRequestOptions): Promise<Response> => {
  const timeoutMs = options?.timeoutMs ?? 8000;
  return fetchWithTimeout(
    buildPalDbUrl(path),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: options?.signal,
    },
    timeoutMs,
  );
};
