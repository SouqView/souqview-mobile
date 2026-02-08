/**
 * Robust DataFetcher: ticker sanitization, exponential backoff for 429,
 * parallel quote/profile + historical so Key Statistics still render when chart fails.
 * Returns raw API responses so marketData can reuse its mapping.
 */

import { sanitizeTicker } from '../utils/tickerSanitizer';
import { logChartUnavailable } from '../utils/telemetry';
import type { HistoricalCandle } from './marketData';
import { get } from '../api/backend';

const HISTORICAL_ENDPOINT = '/stock/historical';
const STOCK_DETAIL_ENDPOINT = '/stock/stock-detail';
const PROFILE_ENDPOINT = '/stock/profile';

const RATE_LIMIT_BACKOFF_MS = [2000, 4000, 8000];
const MAX_RETRIES = 3;

export interface FetchStockDetailResult {
  /** Raw stock-detail response for marketData mapping. */
  detailRes: unknown;
  /** Raw profile response for marketData mapping. */
  profileRes: unknown;
  historical: { data?: HistoricalCandle[] } | null;
  /** True when historical failed or empty so UI can show skeleton instead of "Chart Unavailable" text. */
  chartUnavailable: boolean;
}

async function getWithRetry<T>(
  fn: () => Promise<T>,
  symbol: string
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 429 && attempt < MAX_RETRIES) {
        const delay = RATE_LIMIT_BACKOFF_MS[attempt];
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/**
 * Fetch stock detail with sanitized ticker. Runs quote/profile and historical in parallel.
 * If historical (chart) fails, detailRes/profileRes are still returned so Key Statistics render.
 * marketData.getStockDetails uses this and then runs its mapping on detailRes/profileRes.
 */
export async function fetchStockDetail(
  symbol: string,
  options?: { signal?: AbortSignal }
): Promise<FetchStockDetailResult> {
  const sym = sanitizeTicker(symbol);
  const { signal } = options ?? {};

  const fetchQuoteAndProfile = () =>
    Promise.all([
      get<unknown>(STOCK_DETAIL_ENDPOINT, { symbol: sym }, { signal, symbol: sym }),
      get<unknown>(PROFILE_ENDPOINT, { symbol: sym }, { signal, symbol: sym }).catch(() => null),
    ]);

  const fetchHistorical = () =>
    get<{ data?: HistoricalCandle[] }>(HISTORICAL_ENDPOINT, { symbol: sym, interval: '1day' }, { signal, symbol: sym });

  let detailRes: unknown = null;
  let profileRes: unknown = null;
  let historical: { data?: HistoricalCandle[] } | null = null;
  let chartUnavailable = false;

  try {
    const [detail, profile] = await getWithRetry(() => fetchQuoteAndProfile(), sym);
    detailRes = detail;
    profileRes = profile;
  } catch (_) {
    // Leave detailRes/profileRes null; caller may return rate limit or empty
  }

  try {
    const histRes = await getWithRetry(() => fetchHistorical(), sym);
    historical = histRes && Array.isArray(histRes?.data) ? { data: histRes.data } : null;
    if (!historical?.data?.length) {
      chartUnavailable = true;
      logChartUnavailable({ symbol: sym, endpoint: HISTORICAL_ENDPOINT, reason: 'no_data' });
    }
  } catch (e) {
    chartUnavailable = true;
    logChartUnavailable({
      symbol: sym,
      endpoint: HISTORICAL_ENDPOINT,
      reason: (e as { response?: { status?: number } })?.response?.status === 429 ? 'rate_limit' : 'network',
    });
  }

  return { detailRes, profileRes, historical, chartUnavailable };
}
