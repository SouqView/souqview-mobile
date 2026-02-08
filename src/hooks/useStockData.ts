/**
 * SouqView – Stock data hook with cache-then-network and symbol switching.
 * - Single Source of Truth: writes price to StockPriceStore so Watchlist and Detail stay in sync.
 * - Instant UI: show cached data immediately when switching symbols.
 * - Background refresh: fetch fresh data; only update UI if different.
 * - AbortController: previous request is cancelled when symbol changes.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { getStockDetails } from '../services/marketData';
import type { StockProfile } from '../services/marketData';
import { logSuccess } from '../api/apiClient';
import { getMarketStatus } from '../utils/marketHours';
import { useOptionalStockPriceStore } from '../store/StockPriceStore';

export type StockDetail = {
  quote?: Record<string, unknown>;
  profile?: StockProfile | Record<string, unknown>;
  statistics?: { currentPrice?: number; percent_change?: number; [k: string]: unknown };
  chartUnavailable?: boolean;
  [k: string]: unknown;
} | null;

export type StockHistorical = { data?: unknown[] } | null;

/** Delay before exposing symbolForAi so heavy AI (Faheem) fetches only run for the stock the user is actually viewing. */
const AI_DELAY_MS = 1500;

export interface UseStockDataResult {
  detail: StockDetail;
  historical: StockHistorical;
  loadingDetail: boolean;
  error: 'RATE_LIMIT' | null;
  reload: () => Promise<void>;
  /** Set after AI_DELAY_MS; cleared if user switches symbol before then. Use this to trigger AI (Faheem). */
  symbolForAi: string | null;
  /** True when chart API failed but quote/profile (Key Statistics) are available. */
  chartUnavailable: boolean;
}

const emptyDetail: StockDetail = null;
const emptyHistorical: StockHistorical = null;

function mapResultToDetail(
  result: Awaited<ReturnType<typeof getStockDetails>>
): StockDetail | null {
  if (!result || 'error' in result) return null;
  const { quote, profile, chartUnavailable } = result;
  const q = quote && typeof quote === 'object' ? (quote as unknown as Record<string, unknown>) : null;
  const p = profile && typeof profile === 'object' ? (profile as unknown as Record<string, unknown>) : null;
  return {
    quote: q ?? undefined,
    profile: p ?? undefined,
    chartUnavailable: Boolean(chartUnavailable),
    statistics: {
      currentPrice: (q?.close ?? q?.price ?? q?.current_price) as number | undefined,
      percent_change: (q?.percent_change ?? q?.change_pct ?? q?.changesPercentage) as number | undefined,
      market_cap: (q?.market_cap ?? q?.marketCap ?? p?.market_cap ?? p?.mktCap) as string | number | undefined,
      marketCap: (q?.marketCap ?? q?.market_cap ?? p?.market_cap ?? p?.mktCap) as string | number | undefined,
      pe: (q?.pe ?? q?.pe_ratio ?? p?.pe ?? p?.pe_ratio) as string | number | undefined,
      peRatio: (q?.peRatio ?? q?.pe ?? q?.pe_ratio ?? p?.pe ?? p?.pe_ratio) as number | string | undefined,
      volume: (q?.volume ?? q?.average_volume ?? p?.volume) as number | undefined,
      fiftyTwoWeekHigh: (q?.fifty_two_week_high ?? q?.yearHigh ?? p?.fifty_two_week_high) as number | undefined,
      fiftyTwoWeekLow: (q?.fifty_two_week_low ?? q?.yearLow ?? p?.fifty_two_week_low) as number | undefined,
      dividendYield: (p?.dividendYield ?? q?.dividendYield ?? q?.dividend_yield) as number | undefined,
    },
  };
}

/** In-memory cache: only store successful (HTTP 200) responses. Include timestamp for Pulse (>60s = stale). */
const cache = new Map<
  string,
  { detail: StockDetail; historical: StockHistorical; updatedAt: number }
>();

function shallowEqualDetail(a: StockDetail, b: StockDetail): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  const ak = JSON.stringify(a);
  const bk = JSON.stringify(b);
  return ak === bk;
}

function shallowEqualHistorical(a: StockHistorical, b: StockHistorical): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Manages stock detail + historical with cache-then-network and abort on symbol change.
 * If StockPriceStore has fresh data (<15s), show it immediately and skip blocking the UI.
 */
const STALE_THRESHOLD_MS = 60 * 1000;
/** If store was updated within this window, use it for instant UI and avoid blocking initial fetch. */
const FRESH_STORE_MS = 15 * 1000;

/** Build minimal detail from store entry so header can show price without waiting for getStockDetails. */
function detailFromStore(symbol: string, entry: { lastPrice: string; percentChange: string; lastClose?: number }): StockDetail {
  const price = entry.lastPrice !== '—' ? Number(entry.lastPrice) : undefined;
  const pct = Number(entry.percentChange);
  return {
    quote: { symbol, close: price, price, percent_change: pct },
    statistics: {
      currentPrice: price,
      percent_change: Number.isFinite(pct) ? pct : 0,
    },
  };
}

export function useStockData(symbol: string): UseStockDataResult {
  const [detail, setDetail] = useState<StockDetail>(emptyDetail);
  const [historical, setHistorical] = useState<StockHistorical>(emptyHistorical);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [error, setError] = useState<'RATE_LIMIT' | null>(null);
  const [symbolForAi, setSymbolForAi] = useState<string | null>(null);
  const [chartUnavailable, setChartUnavailable] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const aiDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stockPriceStore = useOptionalStockPriceStore();

  const reload = useCallback(async () => {
    if (!symbol) {
      setDetail(emptyDetail);
      setHistorical(emptyHistorical);
      setLoadingDetail(false);
      setError(null);
      setSymbolForAi(null);
      if (aiDelayTimerRef.current) {
        clearTimeout(aiDelayTimerRef.current);
        aiDelayTimerRef.current = null;
      }
      return;
    }

    if (aiDelayTimerRef.current) {
      clearTimeout(aiDelayTimerRef.current);
      aiDelayTimerRef.current = null;
    }
    setSymbolForAi(null);
    if (__DEV__) {
      console.log(`⏳ [AI delay] Heavy AI fetch for ${symbol} in ${AI_DELAY_MS}ms (cancel if you switch).`);
    }
    aiDelayTimerRef.current = setTimeout(() => {
      aiDelayTimerRef.current = null;
      setSymbolForAi((prev) => (prev === symbol ? prev : symbol));
    }, AI_DELAY_MS);

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    if (__DEV__) {
      console.log(`🚀 [Priority] Immediate fetch (Quote + Historical) for ${symbol}.`);
    }

    const cacheKey = symbol.toUpperCase();
    const cached = cache.get(cacheKey);
    const now = Date.now();
    const cacheFresh = cached && (cached.updatedAt == null || now - cached.updatedAt <= STALE_THRESHOLD_MS);
    const storeEntry = stockPriceStore?.get(symbol);
    const storeFresh = storeEntry && (now - storeEntry.updatedAt <= FRESH_STORE_MS);

    if (cached && cacheFresh) {
      setDetail(cached.detail);
      setHistorical(cached.historical);
      setChartUnavailable(Boolean((cached.detail as { chartUnavailable?: boolean })?.chartUnavailable));
      logSuccess(symbol, 'cache');
      setLoadingDetail(false);
    } else if (storeFresh && storeEntry) {
      setDetail(detailFromStore(symbol, storeEntry));
      setHistorical(emptyHistorical);
      setLoadingDetail(false);
    } else {
      setLoadingDetail(true);
    }
    setError(null);

    try {
      const result = await getStockDetails(symbol, { signal });

      if (!mountedRef.current || signal.aborted) return;

      if ('error' in result && result.error === 'RATE_LIMIT') {
        setError('RATE_LIMIT');
        return;
      }

      const nextDetail = mapResultToDetail(result);
      const nextHist = result && !('error' in result) ? (result.historical ?? null) : null;
      const chartUnavail = result && !('error' in result) ? Boolean((result as { chartUnavailable?: boolean }).chartUnavailable) : false;
      setChartUnavailable(chartUnavail);

      if (nextDetail != null && nextHist !== undefined) {
        if (
          !shallowEqualDetail(detail, nextDetail) ||
          !shallowEqualHistorical(historical, nextHist)
        ) {
          setDetail(nextDetail);
          setHistorical(nextHist);
        }
        const updatedAt = Date.now();
        cache.set(cacheKey, { detail: nextDetail, historical: nextHist, updatedAt });

        if (stockPriceStore) {
          const stats = nextDetail?.statistics as { currentPrice?: number; percent_change?: number } | undefined;
          const quote = nextDetail?.quote as { close?: number; price?: number } | undefined;
          const price = stats?.currentPrice ?? quote?.close ?? quote?.price;
          const pct = stats?.percent_change ?? 0;
          const marketStatus = getMarketStatus();
          const lastClose = marketStatus.status === 'Market Closed' && typeof quote?.close === 'number'
            ? quote.close
            : undefined;
          const lastPrice = price != null && Number.isFinite(price)
            ? (price >= 1 ? price.toFixed(2) : price.toFixed(4))
            : '—';
          stockPriceStore.set(symbol, {
            lastPrice,
            percentChange: Number.isFinite(pct) ? pct.toFixed(2) : '0.00',
            lastClose,
          });
        }
      }
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError' || signal.aborted) return;
      setDetail(emptyDetail);
      setHistorical(emptyHistorical);
      setError(null);
    } finally {
      if (mountedRef.current && !signal.aborted) {
        setLoadingDetail(false);
      }
      if (controller === abortControllerRef.current) {
        abortControllerRef.current = null;
      }
    }
  }, [symbol, stockPriceStore]);

  useEffect(() => {
    mountedRef.current = true;
    reload();
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      if (aiDelayTimerRef.current) {
        clearTimeout(aiDelayTimerRef.current);
        aiDelayTimerRef.current = null;
      }
    };
  }, [reload]);

  return {
    detail,
    historical,
    loadingDetail,
    error,
    reload,
    symbolForAi,
    chartUnavailable,
  };
}
