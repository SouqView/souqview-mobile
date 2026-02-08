/**
 * Active Store: Single Source of Truth (SSoT) for stock price data.
 * - Subscribes to Backend SSE stream when available; also accepts updates from
 *   Watchlist snapshot and Stock Detail fetch.
 * - Sanity check: when a 0.00% change is received, compare to previous state
 *   and keep previous percentChange if it was non-zero (avoids overwriting real data).
 */

import React, { createContext, useCallback, useContext, useRef, useState, useEffect } from 'react';

export const STALE_THRESHOLD_MS = 60 * 1000;

export interface StockPriceEntry {
  lastPrice: string;
  percentChange: string;
  updatedAt: number;
  /** Optional: when market is closed, prefer last close for display */
  lastClose?: number;
}

type PriceMap = Map<string, StockPriceEntry>;

const ZERO_PCT = '0.00';

/**
 * Sanity check: don't show 0.00% when we can do better.
 * - If incoming % is 0.00 and we have existing non-zero %, retain it.
 * - Else if incoming % is 0.00 and we have lastPrice and lastClose, compute % from (price - prevClose) / prevClose.
 */
function applySanityCheck(
  existing: StockPriceEntry | undefined,
  incoming: Omit<StockPriceEntry, 'updatedAt'>
): Omit<StockPriceEntry, 'updatedAt'> {
  if (incoming.percentChange !== ZERO_PCT) return incoming;

  const prevClose = incoming.lastClose ?? existing?.lastClose;
  const priceNum = incoming.lastPrice !== '—' ? Number(incoming.lastPrice) : NaN;
  if (Number.isFinite(priceNum) && prevClose != null && Number.isFinite(prevClose) && prevClose !== 0) {
    const computed = ((priceNum - prevClose) / prevClose) * 100;
    if (Number.isFinite(computed)) {
      return { ...incoming, percentChange: computed.toFixed(2) };
    }
  }

  if (!existing || existing.percentChange === ZERO_PCT) return incoming;
  return { ...incoming, percentChange: existing.percentChange };
}

export type StreamConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface StockPriceStoreValue {
  get(symbol: string): StockPriceEntry | undefined;
  set(symbol: string, entry: Omit<StockPriceEntry, 'updatedAt'>): void;
  isStale(symbol: string): boolean;
  pulse(symbol: string): void;
  pulseAll(symbols: string[]): void;
  subscribe(listener: () => void): () => void;
  /** SSE stream status; show "Connecting…" when 'connecting', without clearing existing data. */
  connectionStatus: StreamConnectionStatus;
}

const StockPriceContext = createContext<StockPriceStoreValue | null>(null);

function getStreamUrl(): string {
  const base = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
  return process.env.EXPO_PUBLIC_SSE_URL || `${base}/stock/stream`;
}

/** Parse a single quote object (from SSE event or snapshot) into store entry shape. */
function parseOneQuote(raw: Record<string, unknown>): { symbol: string; lastPrice: string; percentChange: string; lastClose?: number } | null {
  const symbol = raw.symbol ?? raw.ticker;
  if (!symbol || typeof symbol !== 'string') return null;
  const sym = String(symbol).toUpperCase();
  const price = raw.lastPrice ?? raw.close ?? raw.price ?? raw.current_price;
  const lastPrice =
    price != null && Number.isFinite(Number(price))
      ? (Number(price) >= 1 ? Number(price).toFixed(2) : Number(price).toFixed(4))
      : '—';
  const pct = raw.percentChange ?? raw.percent_change ?? raw.change_pct ?? raw.changesPercentage ?? 0;
  const percentChange = Number.isFinite(Number(pct)) ? Number(pct).toFixed(2) : '0.00';
  const lastClose =
    typeof raw.lastClose === 'number' && Number.isFinite(raw.lastClose) ? raw.lastClose : undefined;
  return { symbol: sym, lastPrice, percentChange, lastClose };
}

/**
 * Parse SSE payload. Backend sends { tick, quotes: [...] }; return array of parsed quotes.
 * If payload is a single quote object (legacy), return single-element array.
 */
function parseSSEPayload(data: string): { symbol: string; lastPrice: string; percentChange: string; lastClose?: number }[] {
  try {
    const raw = JSON.parse(data) as Record<string, unknown>;
    if (raw.error != null) return [];
    const quotes = raw.quotes;
    if (Array.isArray(quotes)) {
      const out: { symbol: string; lastPrice: string; percentChange: string; lastClose?: number }[] = [];
      for (const q of quotes) {
        const parsed = parseOneQuote((q as Record<string, unknown>) ?? {});
        if (parsed) out.push(parsed);
      }
      return out;
    }
    const one = parseOneQuote(raw);
    return one ? [one] : [];
  } catch {
    return [];
  }
}

const SSE_BACKOFF_INITIAL_MS = 1000;
const SSE_BACKOFF_MAX_MS = 30000;

function subscribeToSSE(
  streamUrl: string,
  onUpdate: (symbol: string, entry: Omit<StockPriceEntry, 'updatedAt'>) => void,
  setStatus: (status: StreamConnectionStatus) => void
): () => void {
  let closed = false;
  let eventSource: EventSource | null = null;
  let backoffMs = SSE_BACKOFF_INITIAL_MS;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const hasEventSource = typeof globalThis !== 'undefined' && 'EventSource' in globalThis;
  if (!hasEventSource) {
    setStatus('disconnected');
    if (__DEV__) console.log('[StockPriceStore] EventSource not available (e.g. RN); SSE disabled.');
    return () => {};
  }

  function connect() {
    if (closed) return;
    setStatus('connecting');
    try {
      eventSource = new (globalThis as unknown as { EventSource: typeof EventSource }).EventSource(streamUrl);
      eventSource.onopen = () => {
        if (closed || !eventSource) return;
        backoffMs = SSE_BACKOFF_INITIAL_MS;
        setStatus('connected');
      };
      eventSource.onmessage = (event: MessageEvent) => {
        if (closed) return;
        const list = parseSSEPayload(event.data);
        for (const parsed of list) {
          onUpdate(parsed.symbol, {
            lastPrice: parsed.lastPrice,
            percentChange: parsed.percentChange,
            lastClose: parsed.lastClose,
          });
        }
      };
      eventSource.onerror = () => {
        if (closed) return;
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        setStatus('error');
        timeoutId = setTimeout(() => {
          timeoutId = null;
          if (!closed) connect();
          backoffMs = Math.min(backoffMs * 2, SSE_BACKOFF_MAX_MS);
        }, backoffMs);
      };
    } catch (e) {
      if (__DEV__) console.warn('[StockPriceStore] SSE EventSource failed:', e);
      setStatus('error');
      timeoutId = setTimeout(() => {
        timeoutId = null;
        if (!closed) connect();
        backoffMs = Math.min(backoffMs * 2, SSE_BACKOFF_MAX_MS);
      }, backoffMs);
    }
  }

  connect();

  return () => {
    closed = true;
    setStatus('disconnected');
    if (timeoutId != null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
}

function useStoreRef() {
  const mapRef = useRef<PriceMap>(new Map());
  const listenersRef = useRef<Set<() => void>>(new Set());

  const notify = useCallback(() => {
    listenersRef.current.forEach((l) => l());
  }, []);

  const set = useCallback(
    (symbol: string, entry: Omit<StockPriceEntry, 'updatedAt'>) => {
      const key = symbol.toUpperCase();
      const existing = mapRef.current.get(key);
      const applied = applySanityCheck(existing, entry);
      mapRef.current.set(key, { ...applied, updatedAt: Date.now() });
      notify();
    },
    [notify]
  );

  const get = useCallback((symbol: string) => {
    return mapRef.current.get(symbol.toUpperCase());
  }, []);

  const isStale = useCallback((symbol: string) => {
    const e = mapRef.current.get(symbol.toUpperCase());
    if (!e) return true;
    return Date.now() - e.updatedAt > STALE_THRESHOLD_MS;
  }, []);

  return { mapRef, listenersRef, notify, set, get, isStale };
}

export function StockPriceProvider({ children }: { children: React.ReactNode }) {
  const { set, get, listenersRef, notify, isStale } = useStoreRef();
  const [connectionStatus, setConnectionStatus] = useState<StreamConnectionStatus>('disconnected');

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const pulse = useCallback(
    (symbol: string) => {
      if (!isStale(symbol)) return;
      notify();
    },
    [isStale, notify]
  );

  const pulseAll = useCallback(
    (symbols: string[]) => {
      const anyStale = symbols.some((s) => isStale(s));
      if (anyStale) notify();
    },
    [isStale, notify]
  );

  useEffect(() => {
    const url = getStreamUrl();
    const unsub = subscribeToSSE(url, set, setConnectionStatus);
    return unsub;
  }, [set]);

  const value: StockPriceStoreValue = {
    get,
    set,
    isStale,
    pulse,
    pulseAll,
    subscribe,
    connectionStatus,
  };

  return (
    <StockPriceContext.Provider value={value}>
      {children}
    </StockPriceContext.Provider>
  );
}

export function useStockPriceStore(): StockPriceStoreValue {
  const ctx = useContext(StockPriceContext);
  if (!ctx) throw new Error('useStockPriceStore must be used within StockPriceProvider');
  return ctx;
}

export function useOptionalStockPriceStore(): StockPriceStoreValue | null {
  return useContext(StockPriceContext);
}

export function useStockPriceEntry(symbol: string): StockPriceEntry | undefined {
  const store = useStockPriceStore();
  const [, setTick] = useState(0);
  React.useEffect(() => {
    return store.subscribe(() => setTick((t) => t + 1));
  }, [store]);
  return store.get(symbol);
}
