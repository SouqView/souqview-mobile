import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  getStockNews,
  getFinancialsData,
  getTechnicalsData,
  getInsiderTransactions,
  getCommunityMock,
  getOverviewInsight,
} from '../services/api';
import type { CommunityPost, OverviewInsight } from '../services/api';
import { useStockData } from '../src/hooks/useStockData';
import type { StockProfile } from '../src/services/marketData';

type Detail = {
  quote?: Record<string, unknown>;
  profile?: StockProfile | Record<string, unknown>;
  statistics?: { currentPrice?: number; percent_change?: number; [k: string]: unknown };
  [k: string]: unknown;
} | null;
type Historical = import('../src/hooks/useStockData').StockHistorical;
type News = unknown;
type Financials = Awaited<ReturnType<typeof getFinancialsData>> | null;
type Technicals = Awaited<ReturnType<typeof getTechnicalsData>> | null;
type Insiders = Awaited<ReturnType<typeof getInsiderTransactions>> | null;

interface StockDetailState {
  symbol: string;
  detail: Detail;
  historical: Historical;
  news: News;
  financials: Financials;
  technicals: Technicals;
  insiders: Insiders;
  community: CommunityPost[];
  overviewInsight: OverviewInsight | null;
  loadingDetail: boolean;
  loadingNews: boolean;
  loadingFinancials: boolean;
  loadingTechnicals: boolean;
  loadingInsiders: boolean;
  loadingOverviewInsight: boolean;
  /** Symbol stable 600ms — use to gate AI (Faheem) calls so fast symbol switches cancel. */
  symbolForAi: string | null;
  /** Warm handoff from Watchlist – optimistic UI, zero loading for price. */
  initialName?: string;
  initialPrice?: string;
  initialChange?: string;
  initialLastClose?: string;
  /** True when chart API failed but quote/profile (Key Statistics) are available. */
  chartUnavailable: boolean;
  /** Set when backend returned 429; show "Live updates paused" without clearing price. */
  rateLimitError: 'RATE_LIMIT' | null;
  /** True for first 5s when initialPrice present – suppress error view to avoid flicker. */
  suppressErrorView: boolean;
}

interface StockDetailContextValue extends StockDetailState {
  loadDetail: () => Promise<void>;
  loadNews: () => Promise<void>;
  loadFinancials: (type?: 'annual' | 'quarterly') => Promise<void>;
  loadTechnicals: (timeframe?: string) => Promise<void>;
  loadInsiders: () => Promise<void>;
  loadOverviewInsight: () => Promise<void>;
}

const StockDetailContext = createContext<StockDetailContextValue | null>(null);

export function StockDetailProvider({
  symbol,
  children,
  initialName,
  initialPrice,
  initialChange,
  initialLastClose,
}: {
  symbol: string;
  children: React.ReactNode;
  initialName?: string;
  initialPrice?: string;
  initialChange?: string;
  initialLastClose?: string;
}) {
  const { detail, historical, loadingDetail, error: detailError, reload: loadDetail, symbolForAi, chartUnavailable } = useStockData(symbol);
  const [suppressErrorView, setSuppressErrorView] = useState(Boolean(initialPrice));
  useEffect(() => {
    if (!initialPrice) return;
    const t = setTimeout(() => setSuppressErrorView(false), 5000);
    return () => clearTimeout(t);
  }, [initialPrice]);
  const [news, setNews] = useState<News>(null);
  const [financials, setFinancials] = useState<Financials>(null);
  const [technicals, setTechnicals] = useState<Technicals>(null);
  const [insiders, setInsiders] = useState<Insiders>(null);
  const [overviewInsight, setOverviewInsight] = useState<OverviewInsight | null>(null);
  const [loadingNews, setLoadingNews] = useState(false);
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [loadingTechnicals, setLoadingTechnicals] = useState(false);
  const [loadingInsiders, setLoadingInsiders] = useState(false);
  const [loadingOverviewInsight, setLoadingOverviewInsight] = useState(false);

  const loadOverviewInsight = useCallback(async () => {
    setLoadingOverviewInsight(true);
    try {
      const insight = await getOverviewInsight(symbol);
      setOverviewInsight(insight);
    } catch {
      setOverviewInsight(null);
    } finally {
      setLoadingOverviewInsight(false);
    }
  }, [symbol]);

  useEffect(() => {
    if (!symbolForAi || symbolForAi !== symbol) return;
    loadOverviewInsight();
  }, [symbolForAi, symbol, loadOverviewInsight]);

  const loadNews = useCallback(async () => {
    setLoadingNews(true);
    try {
      const res = await getStockNews(symbol);
      setNews(res ?? null);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setNews([]);
      } else {
        setNews(null);
      }
    } finally {
      setLoadingNews(false);
    }
  }, [symbol]);

  const loadFinancials = useCallback(async (type: 'annual' | 'quarterly' = 'annual') => {
    setLoadingFinancials(true);
    try {
      const res = await getFinancialsData(symbol, type);
      setFinancials(res ?? null);
    } catch {
      setFinancials(null);
    } finally {
      setLoadingFinancials(false);
    }
  }, [symbol]);

  const loadTechnicals = useCallback(async (timeframe: string = '1day') => {
    setLoadingTechnicals(true);
    try {
      const res = await getTechnicalsData(symbol, timeframe);
      setTechnicals(res ?? null);
    } catch {
      setTechnicals(null);
    } finally {
      setLoadingTechnicals(false);
    }
  }, [symbol]);

  const loadInsiders = useCallback(async () => {
    setLoadingInsiders(true);
    try {
      const res = await getInsiderTransactions(symbol);
      setInsiders(res ?? null);
    } catch {
      setInsiders(null);
    } finally {
      setLoadingInsiders(false);
    }
  }, [symbol]);

  const community = getCommunityMock(symbol);

  const value: StockDetailContextValue = {
    symbol,
    detail,
    historical,
    news,
    financials,
    technicals,
    insiders,
    community,
    overviewInsight,
    loadingDetail,
    loadingNews,
    loadingFinancials,
    loadingTechnicals,
    loadingInsiders,
    loadingOverviewInsight,
    symbolForAi,
    initialName,
    initialPrice,
    initialChange,
    initialLastClose,
    chartUnavailable,
    rateLimitError: detailError,
    suppressErrorView,
    loadDetail,
    loadNews,
    loadFinancials,
    loadTechnicals,
    loadInsiders,
    loadOverviewInsight,
  };

  return (
    <StockDetailContext.Provider value={value}>
      {children}
    </StockDetailContext.Provider>
  );
}

export function useStockDetail() {
  const ctx = useContext(StockDetailContext);
  if (!ctx) throw new Error('useStockDetail must be used within StockDetailProvider');
  return ctx;
}
