/**
 * SouqView Mobile – API client for backend services (US market only)
 * Base URL: set via EXPO_PUBLIC_API_URL or default to localhost
 * All stock data is restricted to US exchanges (NASDAQ, NYSE).
 * Uses api/client.ts for request logging (sanitized URL in console).
 */

import client from '../api/client';
import { getSanitizedUrl } from '../api/client';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

/** US-only: use NASDAQ for watchlist/trending. Do not use ADX, DFM, or crypto. */
export const US_EXCHANGE = 'NASDAQ';

/** Default watchlist symbols – major US indices and stocks only. */
export const DEFAULT_US_WATCHLIST_SYMBOLS = [
  'AAPL', 'TSLA', 'NVDA', 'SPY', 'MSFT', 'GOOGL', 'AMZN', 'META', 'AMD', 'JPM',
];

// client imported from api/client.ts (logs sanitized URLs in __DEV__)

/** Legacy helpers for components that call getRequest/postRequest (US backend only). */
export async function getRequest<T = unknown>(url: string): Promise<T> {
  const { data } = await client.get(url.startsWith('http') ? url : url.replace(/^\/api/, ''));
  return data as T;
}
export async function postRequest<T = unknown>(url: string, body?: object): Promise<T> {
  const path = url.startsWith('http') ? url : url.replace(/^\/api/, '');
  const { data } = await client.post(path, body);
  return data as T;
}

/**
 * Filter search/list results to US stocks only. Exclude ADX, DFM, and crypto.
 * When implementing search, pass results through this before displaying.
 */
export function filterUSStocksOnly<T extends { symbol: string }>(items: T[]): T[] {
  const excludeExchanges = ['ADX', 'DFM', 'XDFM'];
  const cryptoOrNonUS = /^(BTC|ETH|DOGE|XRP|ADA|SOL|USDT|USDC|\.XDFM|:XDFM|:ADX)/i;
  return items.filter((item) => {
    const s = (item.symbol || '').toUpperCase();
    if (cryptoOrNonUS.test(s)) return false;
    if (excludeExchanges.some((ex) => s.includes(ex))) return false;
    return true;
  });
}

// ─── Twelve Data mapping (backend proxies these) ─────────────────────────────
/** Twelve Data /profile: description, sector, industry, executives */
export type StockProfile = {
  description?: string;
  sector?: string;
  industry?: string;
  name?: string;
  executives?: Array<{ name?: string; title?: string }>;
};

/** Fetch profile from Twelve Data /profile endpoint (description, sector, industry, executives). */
export async function getStockProfile(symbol: string): Promise<StockProfile | null> {
  try {
    const { data } = await client.get<StockProfile | { data?: StockProfile }>('/stock/profile', { params: { symbol } });
    if (data && typeof data === 'object' && 'data' in data) return (data as { data?: StockProfile }).data ?? null;
    return (data as StockProfile) ?? null;
  } catch {
    return null;
  }
}

// Profile + Quote → stock-detail (Overview tab)
export async function getStockProfileAndQuote(symbol: string) {
  const { data } = await client.get('/stock/stock-detail', { params: { symbol } });
  return data;
}

/** Fetches stock-detail and merges Twelve Data /profile (description, sector, industry, executives). */
export async function getStockDetail(symbol: string): Promise<{ data?: { profile?: StockProfile; statistics?: unknown; [k: string]: unknown } }> {
  const [detailRes, profileRes] = await Promise.all([
    getStockProfileAndQuote(symbol),
    getStockProfile(symbol),
  ]);
  const raw = detailRes && typeof detailRes === 'object' && 'data' in detailRes
    ? (detailRes as { data?: unknown }).data
    : detailRes;
  const data = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const existingProfile = (data.profile && typeof data.profile === 'object') ? data.profile as Record<string, unknown> : {};
  const merged = { ...data, profile: { ...existingProfile, ...(profileRes || {}) } };
  return { data: merged };
}

// News → /news/stock/:ticker (Latest News tab)
export async function getStockNewsList(ticker: string) {
  const { data } = await client.get(`/news/stock/${encodeURIComponent(ticker)}`);
  return data;
}

export async function getHistoricalData(symbol: string, interval = '1day', outputsize?: string) {
  const { data } = await client.get('/stock/historical', {
    params: { symbol, interval, outputsize },
  });
  return data;
}

// Income statement + Balance sheet → /stock/financials (Financials tab)
export async function getFinancialsData(symbol: string, type: 'quarterly' | 'annual' = 'quarterly', fiscal_date?: string) {
  const { data } = await client.get('/stock/financials', {
    params: { symbol, type, fiscal_date },
  });
  return data;
}

// Insider transactions → /stock/insider-transactions/:symbol (Insiders tab)
export async function getInsiderTransactions(symbol: string) {
  const { data } = await client.get(`/stock/insider-transactions/${encodeURIComponent(symbol)}`);
  return data;
}

// RSI, MACD, Moving averages (MA50, MA200) → /stock/technicals (Technicals tab)
export async function getTechnicalsData(symbol: string, timeframe = '5min') {
  const { data } = await client.get('/stock/technicals', {
    params: { symbol, timeframe },
  });
  return data;
}

// News (per-ticker)
export async function getStockNews(ticker: string) {
  const { data } = await client.get(`/news/stock/${encodeURIComponent(ticker)}`);
  return data;
}

// Sentiment (for Forecast & Community)
export async function getSentiment(symbol: string) {
  const { data } = await client.get(`/sentiment/${encodeURIComponent(symbol)}`);
  return data;
}

/**
 * Overview tab insight from DeepSeek-R1 (not Llama 3).
 * Backend should use /quote and /news (or equivalent) to generate:
 * - What is happening? (e.g. AAPL is down 2%)
 * - Why is it moving? (e.g. Reaction to Fed rate news)
 * - What's next? (e.g. Testing support at $210)
 */
export type OverviewInsight = {
  whatIsHappening?: string;
  whyMoving?: string;
  whatsNext?: string;
};

export async function getOverviewInsight(
  symbol: string,
  options?: { quote?: unknown; news?: unknown }
): Promise<OverviewInsight> {
  const body = options?.quote != null || options?.news != null
    ? { symbol, quote: options.quote, news: options.news }
    : { symbol };
  const { data } = await client.post<OverviewInsight>('/ai/overview-insight', body);
  return data ?? {};
}

// Market snapshot – US only: use NASDAQ (or NYSE). Do not use ADX/DFM.
export async function getMarketSnapshot(exchange: string) {
  const { data } = await client.get(`/stock/market-snapshot/${exchange}`);
  return data;
}

export type USSnapshotItem = {
  symbol: string;
  name: string;
  image?: string;
  lastPrice: string;
  percentChange: string;
  summary?: { en: string; ar: string };
};

/** US-only watchlist/trending: fetches NASDAQ snapshot and filters to default US symbols. */
export async function getUSMarketSnapshot(): Promise<{ marketSnapshot: USSnapshotItem[] }> {
  const fallback = (): { marketSnapshot: USSnapshotItem[] } => ({
    marketSnapshot: DEFAULT_US_WATCHLIST_SYMBOLS.slice(0, 10).map((symbol): USSnapshotItem => ({
      symbol,
      name: symbol,
      lastPrice: '—',
      percentChange: '0.00',
    })),
  });
  try {
    const sanitized = getSanitizedUrl(`/stock/market-snapshot/${US_EXCHANGE}`);
    if (__DEV__) console.log('[SouqView Watchlist] GET', sanitized);
    const data = await getMarketSnapshot(US_EXCHANGE);
    const snapshot: USSnapshotItem[] = data?.marketSnapshot || [];
    const allowed = new Set(DEFAULT_US_WATCHLIST_SYMBOLS);
    const filtered = filterUSStocksOnly(snapshot).filter((item) => allowed.has(item.symbol));
    if (filtered.length === 0) return fallback();
    return { marketSnapshot: filtered };
  } catch (e) {
    if (__DEV__) {
      console.warn('[SouqView Watchlist] Request failed. Ensure backend is running and EXPO_PUBLIC_API_URL is set.', e);
      console.log('[SouqView Watchlist] Expected URL format:', getSanitizedUrl(`/stock/market-snapshot/${US_EXCHANGE}`));
    }
    return fallback();
  }
}

// Community: internal app data (mock for now)
export interface CommunityPost {
  id: string;
  author: string;
  body: string;
  timestamp: string;
  sentiment?: 'bullish' | 'bearish';
}
export function getCommunityMock(_symbol: string): CommunityPost[] {
  return [
    { id: '1', author: 'TraderJoe', body: 'Strong support at current levels. Holding long.', timestamp: new Date().toISOString(), sentiment: 'bullish' },
    { id: '2', author: 'MarketWatcher', body: 'Earnings next week could move this 10%.', timestamp: new Date().toISOString() },
    { id: '3', author: 'SwingTrade', body: 'Taking profits here. Will re-enter on pullback.', timestamp: new Date().toISOString(), sentiment: 'bearish' },
  ];
}

export default client;
