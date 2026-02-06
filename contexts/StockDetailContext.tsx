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
import { getStockDetails as getStockDetailsFromMarketData } from '../src/services/marketData';
import type { StockProfile } from '../src/services/marketData';

type Detail = {
  quote?: Record<string, unknown>;
  profile?: StockProfile | Record<string, unknown>;
  statistics?: { currentPrice?: number; percent_change?: number; [k: string]: unknown };
  [k: string]: unknown;
} | null;
type Historical = Awaited<ReturnType<typeof getStockDetailsFromMarketData>>['historical'];
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
}: {
  symbol: string;
  children: React.ReactNode;
}) {
  const [detail, setDetail] = useState<Detail>(null);
  const [historical, setHistorical] = useState<Historical>(null);
  const [news, setNews] = useState<News>(null);
  const [financials, setFinancials] = useState<Financials>(null);
  const [technicals, setTechnicals] = useState<Technicals>(null);
  const [insiders, setInsiders] = useState<Insiders>(null);
  const [overviewInsight, setOverviewInsight] = useState<OverviewInsight | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [loadingNews, setLoadingNews] = useState(false);
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [loadingTechnicals, setLoadingTechnicals] = useState(false);
  const [loadingInsiders, setLoadingInsiders] = useState(false);
  const [loadingOverviewInsight, setLoadingOverviewInsight] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoadingDetail(true);
    try {
      const result = await getStockDetailsFromMarketData(symbol);
      if ('error' in result && result.error === 'RATE_LIMIT') {
        setDetail({ error: 'RATE_LIMIT', symbol } as Detail);
        setHistorical(null);
        return;
      }
      const { quote, profile, historical: hist } = result;
      const q = quote && typeof quote === 'object' ? quote as Record<string, unknown> : null;
      const p = profile && typeof profile === 'object' ? profile as Record<string, unknown> : null;
      const detailToSet: Detail = {
        quote: q ?? undefined,
        profile: p ?? undefined,
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
      setDetail(detailToSet);
      setHistorical(hist ?? null);
    } catch {
      setDetail(null);
      setHistorical(null);
    } finally {
      setLoadingDetail(false);
    }
  }, [symbol]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const loadNews = useCallback(async () => {
    setLoadingNews(true);
    try {
      const res = await getStockNews(symbol);
      setNews(res ?? null);
    } catch {
      setNews(null);
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
