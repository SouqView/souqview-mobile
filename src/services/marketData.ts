/**
 * SouqView – Market data (Twelve Data via backend) with caching.
 * Uses React Query when used in components; also exports cache helpers for AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { get } from '../api/backend';

const CACHE_PREFIX = '@souqview_market_';
const QUOTE_TTL_MS = 60 * 1000;       // 1 min
const NEWS_TTL_MS = 5 * 60 * 1000;    // 5 min

// --- Types (align with your backend / Twelve Data) ---
export interface Quote {
  symbol: string;
  name?: string;
  price?: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  change?: number;
  percent_change?: number;
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
export async function fetchQuote(symbol: string): Promise<Quote> {
  const cacheKey = `quote_${symbol.toUpperCase()}`;
  const cached = await getCached<Quote>(cacheKey);
  if (cached && !cached.expired) return cached.data;

  const data = await get<Record<string, unknown>>('/stock/stock-detail', { symbol });
  const quote: Quote = data?.quote ?? data ? { symbol, ...(data as object) } : { symbol };
  await setCached(cacheKey, quote, QUOTE_TTL_MS);
  return quote;
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
