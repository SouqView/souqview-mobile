import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  getStockDetail,
  getHistoricalData,
  getStockNews,
  getFinancialsData,
  getTechnicalsData,
  getInsiderTransactions,
  getCommunityMock,
  getOverviewInsight,
} from '../services/api';
import type { CommunityPost, OverviewInsight } from '../services/api';

type Detail = Awaited<ReturnType<typeof getStockDetail>>['data'] | null;
type Historical = Awaited<ReturnType<typeof getHistoricalData>> | null;
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

  useEffect(() => {
    let cancelled = false;
    setLoadingDetail(true);
    Promise.all([getStockDetail(symbol), getHistoricalData(symbol, '1day')])
      .then(([resDetail, resHist]) => {
        if (!cancelled) {
          setDetail(resDetail?.data ?? null);
          setHistorical(resHist ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetail(null);
          setHistorical(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => { cancelled = true; };
  }, [symbol]);

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
