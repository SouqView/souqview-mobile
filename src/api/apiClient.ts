/**
 * SouqView – Centralized resilient fetch layer.
 * - AbortController: cancel previous request when a new one is made.
 * - Exponential backoff on 429 (2s → 4s → 8s).
 * - Error guard: never treat or cache non-200 as success.
 * - Global logging for debugging.
 */

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

/** Backoff delays in ms for 429 (rate limit). */
const RATE_LIMIT_BACKOFF_MS = [2000, 4000, 8000];

const MAX_RETRIES = RATE_LIMIT_BACKOFF_MS.length;

/** Standard routes (quote, historical, etc.): fail fast. */
export const STANDARD_TIMEOUT_MS = 5000;

/** AI routes (Faheem, Groq): allow slow LLM response. */
export const AI_TIMEOUT_MS = 45000;

function isAiRoute(urlOrPath: string): boolean {
  const path = urlOrPath.includes('/api/') ? urlOrPath.split('/api/')[1]?.split('?')[0] ?? urlOrPath : urlOrPath.replace(/^\/+/, '');
  const p = path.toLowerCase();
  return p.startsWith('faheem') || p.startsWith('ai/') || p.startsWith('chat');
}

export type ApiRequestOptions = {
  /** AbortSignal to cancel this request when a newer one is started. */
  signal?: AbortSignal;
  /** Symbol/label for logging (e.g. "AAPL"). */
  symbol?: string;
  /** Request init (headers, method, etc.). */
  init?: RequestInit;
  /** Override timeout in ms. If not set, standard routes use 5s, AI routes 45s. */
  timeoutMs?: number;
};

/**
 * Low-level fetch with retry on 429 only and optional timeout.
 * Logs: Fetching → Success or Rate Limited retrying.
 */
export async function fetchWithRetry(
  url: string,
  options: ApiRequestOptions = {}
): Promise<Response> {
  const { signal, symbol = 'unknown', init = {}, timeoutMs } = options;
  const label = symbol !== 'unknown' ? symbol : url;
  const path = url.split('?')[0];
  const resolvedTimeout = timeoutMs ?? (isAiRoute(path) ? AI_TIMEOUT_MS : STANDARD_TIMEOUT_MS);

  if (__DEV__) {
    console.log(`📡 [API] Fetching ${label}...`);
  }

  let lastResponse: Response | null = null;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const timeoutController = resolvedTimeout > 0 ? new AbortController() : null;
    const compositeController = signal || timeoutController ? new AbortController() : null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (timeoutController && resolvedTimeout > 0) {
      timeoutId = setTimeout(() => timeoutController!.abort(), resolvedTimeout);
    }
    if (compositeController) {
      const onAbort = () => compositeController!.abort();
      if (timeoutController) timeoutController.signal.addEventListener('abort', onAbort);
      if (signal) signal.addEventListener('abort', onAbort);
    }
    const effectiveSignal = compositeController?.signal ?? signal ?? timeoutController?.signal;

    try {
      const res = await fetch(url, {
        ...init,
        signal: effectiveSignal,
        headers: {
          'Content-Type': 'application/json',
          ...(typeof init.headers === 'object' && !Array.isArray(init.headers)
            ? (init.headers as Record<string, string>)
            : {}),
        },
      });
      if (timeoutId != null) clearTimeout(timeoutId);
      lastResponse = res;

      if (res.status === 429 && attempt < MAX_RETRIES) {
        const delayMs = RATE_LIMIT_BACKOFF_MS[attempt];
        if (__DEV__) {
          console.warn(`⚠️ [API] Rate Limited! Retrying in ${delayMs}ms...`);
        }
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      if (__DEV__ && res.ok) {
        console.log(`✅ [API] Success ${label} (from network)`);
      }
      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if ((err as { name?: string })?.name === 'AbortError') {
        throw err;
      }
      break;
    }
  }

  if (lastResponse && !lastResponse.ok) {
    if (__DEV__) {
      console.warn(`❌ [API] Failed ${label} HTTP ${lastResponse.status}`);
    }
    throw new ApiError(lastResponse.status, lastResponse.statusText, label);
  }
  throw lastError ?? new Error('Request failed');
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    statusText: string,
    public readonly label?: string
  ) {
    super(`API Error ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}

/**
 * GET request with retry, abort support, and logging.
 * Error guard: throws on non-2xx; never returns error bodies as success.
 */
export async function apiGet<T = unknown>(
  path: string,
  params?: Record<string, string | number | undefined>,
  options: ApiRequestOptions = {}
): Promise<T> {
  const pathNorm = path.startsWith('/') ? path.slice(1) : path;
  const base = BASE_URL.replace(/\/+$/, '');
  const url = new URL(`${base}/${pathNorm}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    });
  }
  const timeoutMs = options.timeoutMs ?? (isAiRoute(pathNorm) ? AI_TIMEOUT_MS : STANDARD_TIMEOUT_MS);
  const res = await fetchWithRetry(url.toString(), { ...options, timeoutMs });

  if (!res.ok) {
    if (__DEV__) {
      console.warn(`❌ [API] ${options.symbol ?? path} HTTP ${res.status}`);
    }
    throw new ApiError(res.status, res.statusText, options.symbol);
  }

  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return res.json() as Promise<T>;
  }
  return res.text() as unknown as T;
}

/**
 * Response interceptor helper: use when you want to log "from cache" vs "from network".
 * apiClient only logs "from network"; cache-then-network in useStockData logs "from cache" when serving from cache.
 */
export function logSuccess(symbol: string, source: 'cache' | 'network'): void {
  if (__DEV__) {
    console.log(`✅ [API] Success ${symbol} (from ${source})`);
  }
}
