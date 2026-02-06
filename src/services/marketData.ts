/**
 * SouqView – Market data (Twelve Data via backend) with caching.
 * Strict types for StockQuote, StockProfile, HistoricalCandle.
 * On 429/500: fail gracefully; show "Market Data Unavailable" + Retry (do not crash).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { get } from '../api/backend';

const CACHE_PREFIX = '@souqview_market_';
const QUOTE_TTL_MS = 60 * 1000;       // 1 min
const NEWS_TTL_MS = 5 * 60 * 1000;    // 5 min

// --- Strict types (align with backend / Twelve Data) ---

export interface StockQuote {
  symbol: string;
  name?: string;
  price?: number;
  close?: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  change?: number;
  percent_change?: number;
  change_percent?: number;
  fifty_two_week_high?: number;
  fifty_two_week_low?: number;
  market_cap?: string | number;
  average_volume?: number;
}

export interface StockProfile {
  symbol?: string;
  name?: string;
  description?: string;
  longBusinessSummary?: string;
  sector?: string;
  industry?: string;
  employees?: string | number;
  market_cap?: string | number;
  pe?: string | number;
  fifty_two_week_high?: number;
  fifty_two_week_low?: number;
  fifty_two_week?: { high?: number; low?: number };
  dividendYield?: number;
  executives?: Array<{ name?: string; title?: string }>;
  officers?: Array<{ name?: string; title?: string }>;
}

export interface HistoricalCandle {
  datetime?: string;
  time?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/** Legacy alias */
export interface Quote extends StockQuote {
  [key: string]: unknown;
}

export interface NewsItem {
  id?: string;
  title: string;
  url?: string;
  source?: string;
  published_at?: string;
  [key: string]: unknown;
}

/** 429 Rate Limit or 5xx server error – show "Market Data Unavailable" + Retry, do not crash. */
export function isMarketDataError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 429 || (status != null && status >= 500);
}

export function getMarketDataErrorMessage(err: unknown): string {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === 429) return 'Too many requests. Try again in a moment.';
  if (status != null && status >= 500) return 'Server error. Try again.';
  return (err as Error)?.message ?? 'Market Data Unavailable';
}

/**
 * Safe fetch: on 429/500 returns null and does not throw, so UI can show fallback + Retry.
 * Other errors still throw so callers can handle.
 */
export async function safeMarketFetch<T>(
  fn: () => Promise<T>,
  onFallback?: (message: string) => void
): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    if (isMarketDataError(e)) {
      const msg = getMarketDataErrorMessage(e);
      onFallback?.(msg);
      return null;
    }
    throw e;
  }
}

// --- Cache helpers ---
async function getCached<T>(key: string): Promise<{ data: T; expired: boolean } | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, ts, ttl } = JSON.parse(raw);
    const expired = Date.now() - ts > ttl;
    return { data: data as T, expired };
  } catch {
    return null;
  }
}

async function setCached(key: string, data: unknown, ttlMs: number): Promise<void> {
  try {
    await AsyncStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, ts: Date.now(), ttl: ttlMs })
    );
  } catch (e) {
    console.warn('marketData cache set failed:', e);
  }
}

// --- API (backend proxies Twelve Data) ---

/**
 * Fetch quote for a symbol. Cached 1 min.
 */
export async function fetchQuote(symbol: string): Promise<StockQuote> {
  const cacheKey = `quote_${symbol.toUpperCase()}`;
  const cached = await getCached<StockQuote>(cacheKey);
  if (cached && !cached.expired) return cached.data;

  const quote = await fetchQuoteUncached(symbol);
  await setCached(cacheKey, quote, QUOTE_TTL_MS);
  return quote;
}

/**
 * Fetch quote without cache. Use for live polling so each tick gets fresh data.
 */
export async function fetchQuoteUncached(symbol: string): Promise<StockQuote> {
  const data = await get<Record<string, unknown>>('/stock/stock-detail', { symbol });
  const raw = data?.quote ?? data;
  const quote: StockQuote = (raw && typeof raw === 'object' ? raw : { symbol }) as StockQuote;
  return { ...quote, symbol: symbol };
}

/** Normalize profile: description from description or longBusinessSummary; executives as array. */
function normalizeMarketProfile(p: StockProfile | Record<string, unknown> | null | undefined): StockProfile | null {
  if (!p || typeof p !== 'object') return null;
  const pr = p as Record<string, unknown>;
  const desc = (pr.description && typeof pr.description === 'string')
    ? pr.description
    : (pr.longBusinessSummary && typeof pr.longBusinessSummary === 'string')
      ? pr.longBusinessSummary
      : (pr.description && typeof pr.description === 'object' && (pr.description as { en?: string }).en)
        ? (pr.description as { en?: string }).en
        : '';
  const execRaw = pr.executives ?? pr.officers ?? pr.key_executives ?? pr.management;
  const executives = Array.isArray(execRaw) ? execRaw : (execRaw != null && typeof execRaw === 'object' ? Object.values(execRaw) : []);
  return { ...(p as StockProfile), description: desc || (p as StockProfile).description, executives };
}

/**
 * Full stock context for Detail/Overview: quote, profile, historical (1day).
 * Force-maps every field (multiple key names) so About, Executives, and Stats always show.
 * Logs raw API responses in __DEV__ for debugging.
 * On 429 rate limit returns { error: 'RATE_LIMIT', symbol } so UI can show "System Busy".
 */
export async function getStockDetails(symbol: string): Promise<
  | { quote: StockQuote | null; profile: StockProfile | null; historical: { data?: HistoricalCandle[] } | null }
  | { error: 'RATE_LIMIT'; symbol: string }
> {
  try {
    console.log(`[marketData] Fetching details for ${symbol}...`);

    const [detailRes, profileRes, histRes] = await Promise.all([
      get<unknown>('/stock/stock-detail', { symbol }),
      get<unknown>('/stock/profile', { symbol }).catch(() => null),
      get<{ data?: HistoricalCandle[] }>('/stock/historical', { symbol, interval: '1day' }),
    ]);

    // Check for API Rate Limit
    const codeDetail = (detailRes as { code?: number; data?: { code?: number } })?.code ?? (detailRes as { data?: { code?: number } })?.data?.code;
    const codeProfile = (profileRes as { code?: number; data?: { code?: number } })?.code ?? (profileRes as { data?: { code?: number } })?.data?.code;
    if (codeDetail === 429 || codeProfile === 429) {
      console.warn('⚠️ API RATE LIMIT REACHED');
      return { error: 'RATE_LIMIT', symbol };
    }

    // 🛑 DEBUG LOG – exactly what the backend sends
    console.log('[marketData] RAW STOCK-DETAIL RESPONSE:', JSON.stringify(detailRes, null, 2));
    console.log('[marketData] RAW PROFILE RESPONSE:', JSON.stringify(profileRes, null, 2));

    // Handle array vs object and hybrid backend shape (profile.profile, profile.stats, quote.data)
    const detailPayload =
      detailRes != null && typeof detailRes === 'object' && 'data' in (detailRes as object)
        ? (detailRes as { data?: unknown }).data
        : detailRes;
    const detailData = Array.isArray(detailPayload) ? detailPayload[0] : detailPayload;
    const data = (detailData && typeof detailData === 'object' ? detailData : {}) as Record<string, unknown>;

    const profileResPayload =
      profileRes != null && typeof profileRes === 'object' && 'data' in (profileRes as object)
        ? (profileRes as { data?: unknown }).data
        : profileRes;
    const profileResData = (profileResPayload && typeof profileResPayload === 'object' ? profileResPayload : {}) as Record<string, unknown>;

    // Hybrid backend: quote may be in data.quote or data; profile/stats may be in data.profile.profile, data.profile.stats, or data
    const quoteData = (data?.quote ?? data) as Record<string, unknown>;
    const quoteDataNormalized = (Array.isArray(quoteData) ? quoteData[0] : quoteData) as Record<string, unknown> | undefined;
    const rawQuote = quoteDataNormalized ?? (data as Record<string, unknown>);

    const innerProfile = (data?.profile ?? profileResData?.profile ?? profileResData) as Record<string, unknown> | undefined;
    const innerStats = (data?.stats ?? profileResData?.stats ?? innerProfile?.stats) as Record<string, unknown> | undefined;
    const innerProfileObj = (innerProfile?.profile ?? innerProfile) as Record<string, unknown> | undefined;

    const profileData = {
      profile: innerProfileObj ?? innerProfile ?? {},
      stats: innerStats ?? {},
    } as { profile: Record<string, unknown>; stats: Record<string, unknown> };

    // 🔍 DEBUG: Log the exact structure we are trying to map (Yahoo / hybrid backend)
    console.log('👉 MAPPING DEBUG - Profile:', JSON.stringify(profileData.profile, null, 2));
    console.log('👉 MAPPING DEBUG - Stats:', JSON.stringify(profileData.stats, null, 2));

    const pp = profileData.profile;
    const st = profileData.stats;

    // 1. Map Description (Yahoo / profile.profile first)
    const description =
      (typeof pp?.description === 'string' && pp.description)
        ? pp.description
        : (typeof pp?.longBusinessSummary === 'string' && pp.longBusinessSummary)
          ? pp.longBusinessSummary
          : (typeof pp?.summary === 'string' && pp.summary)
            ? pp.summary
            : 'No description available.';

    // 2. Map Sector / Industry / Employees (Yahoo first)
    const sector =
      (typeof pp?.sector === 'string' ? pp.sector : (pp?.sector as { en?: string })?.en) ?? 'N/A';
    const industry =
      (typeof pp?.industry === 'string' ? pp.industry : (pp?.industry as { en?: string })?.en) ?? 'N/A';

    // 3. Map Executives (backend sends in profile.executives)
    const execRaw = pp?.executives ?? pp?.officers ?? pp?.key_executives ?? pp?.management;
    const executives = Array.isArray(execRaw)
      ? execRaw.map((e: { name?: string; title?: string }) => ({ name: e?.name ?? '—', title: e?.title ?? '—' }))
      : execRaw != null && typeof execRaw === 'object'
        ? Object.values(execRaw).map((e: { name?: string; title?: string }) => ({ name: e?.name ?? '—', title: e?.title ?? '—' }))
        : [];

    // 4. Map Stats (backend sends in profile.stats – Yahoo-style: marketCap, peRatio, high52, low52, dividendYield)
    const marketCap =
      st?.marketCap ?? st?.market_cap ?? st?.mktCap ?? rawQuote?.marketCap ?? rawQuote?.market_cap ?? rawQuote?.mktCap ?? pp?.market_cap ?? pp?.mktCap;
    const volume = (rawQuote?.volume ?? rawQuote?.average_volume ?? st?.volume) as number | undefined;
    const peRatio = st?.peRatio ?? st?.pe ?? st?.pe_ratio ?? rawQuote?.pe ?? rawQuote?.peRatio ?? rawQuote?.pe_ratio ?? pp?.pe ?? pp?.pe_ratio;
    const high52 =
      (st?.high52 ?? st?.yearHigh ?? st?.fiftyTwoWeekHigh ?? st?.fifty_two_week_high ?? rawQuote?.yearHigh ?? rawQuote?.fifty_two_week_high ?? pp?.fifty_two_week_high) as number | undefined;
    const low52 =
      (st?.low52 ?? st?.yearLow ?? st?.fiftyTwoWeekLow ?? st?.fifty_two_week_low ?? rawQuote?.yearLow ?? rawQuote?.fifty_two_week_low ?? pp?.fifty_two_week_low) as number | undefined;

    const dividendYieldNum = (st?.dividendYield ?? st?.dividend_yield) as number | undefined;
    const employees = pp?.employees ?? pp?.fullTimeEmployees ?? 'N/A';

    const profile: StockProfile = {
      symbol,
      name: (typeof pp?.name === 'string' ? pp.name : (pp?.name as { en?: string })?.en) ?? symbol,
      description,
      sector,
      industry,
      employees: typeof employees === 'string' || typeof employees === 'number' ? employees : 'N/A',
      executives: executives.length > 0 ? executives : [],
      market_cap: marketCap as string | number | undefined,
      pe: peRatio as string | number | undefined,
      fifty_two_week_high: high52,
      fifty_two_week_low: low52,
      dividendYield: dividendYieldNum != null && Number.isFinite(dividendYieldNum) ? dividendYieldNum : undefined,
    };

    const quote: StockQuote = {
      symbol,
      name: profile.name,
      price: (rawQuote?.price ?? rawQuote?.close ?? rawQuote?.current_price) as number | undefined,
      close: (rawQuote?.close ?? rawQuote?.price ?? rawQuote?.current_price) as number | undefined,
      percent_change: (rawQuote?.percent_change ?? rawQuote?.changesPercentage ?? rawQuote?.change_pct) as number | undefined,
      volume: (volume as number) || undefined,
      market_cap: (marketCap as string | number) || undefined,
      fifty_two_week_high: high52,
      fifty_two_week_low: low52,
    };

    const historical = histRes ?? null;

    console.log('[marketData] MAPPED OUTPUT:', {
      description: profile.description?.slice(0, 60) + (profile.description && profile.description.length > 60 ? '…' : ''),
      sector: profile.sector,
      industry: profile.industry,
      executivesCount: profile.executives?.length ?? 0,
      price: quote.price ?? quote.close,
      changePercent: quote.percent_change,
      marketCap: profile.market_cap,
      peRatio: profile.pe,
      high52: profile.fifty_two_week_high,
      low52: profile.fifty_two_week_low,
    });

    return { quote, profile, historical };
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 429) {
      console.warn('⚠️ API RATE LIMIT REACHED (HTTP 429)');
      return { error: 'RATE_LIMIT', symbol };
    }
    console.error('[marketData] DETAILS ERROR:', error);
    return { quote: null, profile: null, historical: null };
  }
}

/**
 * Fetch news for a symbol. Cached 5 min.
 */
export async function fetchNews(symbol: string): Promise<NewsItem[]> {
  const cacheKey = `news_${symbol.toUpperCase()}`;
  const cached = await getCached<NewsItem[]>(cacheKey);
  if (cached && !cached.expired) return cached.data;

  const data = await get<NewsItem[] | { news?: NewsItem[] }>(`/news/stock/${encodeURIComponent(symbol)}`);
  const list = Array.isArray(data) ? data : (data && typeof data === 'object' && data !== null && 'news' in data ? (data as { news: NewsItem[] }).news : []);
  const items = Array.isArray(list) ? list : [];
  await setCached(cacheKey, items, NEWS_TTL_MS);
  return items;
}
