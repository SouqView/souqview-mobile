import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { SegmentedBar, SegmentId } from './SegmentedBar';
import { OverviewTab } from './OverviewTab';
import { NewsTab } from './NewsTab';
import { FinancialsTab } from './FinancialsTab';
import { ForecastTechnicalsTab } from './ForecastTechnicalsTab';
import { InsidersCommunityTab } from './InsidersCommunityTab';
import {
  getStockDetail,
  getHistoricalData,
  getStockNews,
  getFinancialsData,
  getSentiment,
  getTechnicalsData,
  getInsiderTransactions,
} from '../../services/api';
import type { OverviewTabProps } from './OverviewTab';
import type { FinancialsTabProps } from './FinancialsTab';
import type { ForecastTechnicalsTabProps } from './ForecastTechnicalsTab';
import type { InsidersCommunityTabProps } from './InsidersCommunityTab';
import { TradeButton } from '../TradeButton';

interface StockDashboardProps {
  symbol: string;
}

export function StockDashboard({ symbol }: StockDashboardProps) {
  const [segment, setSegment] = useState<SegmentId>('overview');
  const [detail, setDetail] = useState<unknown>(null);
  const [historical, setHistorical] = useState<unknown>(null);
  const [news, setNews] = useState<unknown>(null);
  const [financials, setFinancials] = useState<unknown>(null);
  const [sentiment, setSentiment] = useState<unknown>(null);
  const [technicals, setTechnicals] = useState<unknown>(null);
  const [insiders, setInsiders] = useState<unknown>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [loadingNews, setLoadingNews] = useState(false);
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [loadingTechnicals, setLoadingTechnicals] = useState(false);
  const [loadingInsiders, setLoadingInsiders] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoadingDetail(true);
    try {
      const [resDetail, resHist] = await Promise.all([
        getStockDetail(symbol),
        getHistoricalData(symbol, '1day'),
      ]);
      setDetail(resDetail?.data ?? null);
      setHistorical(resHist ?? null);
    } catch (_) {
      setDetail(null);
      setHistorical(null);
    } finally {
      setLoadingDetail(false);
    }
  }, [symbol]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (segment !== 'news') return;
    setLoadingNews(true);
    getStockNews(symbol)
      .then((res: { data?: unknown[] }) => {
        setNews(Array.isArray(res?.data) ? res.data : res);
      })
      .catch(() => setNews(null))
      .finally(() => setLoadingNews(false));
  }, [symbol, segment]);

  useEffect(() => {
    if (segment !== 'financials') return;
    setLoadingFinancials(true);
    getFinancialsData(symbol)
      .then((res) => setFinancials(res ?? null))
      .catch(() => setFinancials(null))
      .finally(() => setLoadingFinancials(false));
  }, [symbol, segment]);

  useEffect(() => {
    if (segment !== 'forecast') return;
    setLoadingTechnicals(true);
    Promise.all([getSentiment(symbol), getTechnicalsData(symbol)])
      .then(([sentRes, techRes]) => {
        setSentiment(sentRes ?? null);
        setTechnicals(techRes ?? null);
      })
      .catch(() => {
        setSentiment(null);
        setTechnicals(null);
      })
      .finally(() => setLoadingTechnicals(false));
  }, [symbol, segment]);

  useEffect(() => {
    if (segment !== 'insiders') return;
    setLoadingInsiders(true);
    getInsiderTransactions(symbol)
      .then((res) => setInsiders(res ?? null))
      .catch(() => setInsiders(null))
      .finally(() => setLoadingInsiders(false));
  }, [symbol, segment]);

  return (
    <View style={styles.container}>
      <SegmentedBar selected={segment} onSelect={setSegment} />

      {segment === 'overview' && (
        <OverviewTab
          symbol={symbol}
          detail={detail as OverviewTabProps['detail']}
          historical={historical as OverviewTabProps['historical']}
          loading={loadingDetail}
        />
      )}
      {segment === 'news' && (
        <NewsTab
          symbol={symbol}
          news={Array.isArray(news) ? news : (news as { data?: unknown[] })?.data ?? null}
          loading={loadingNews}
        />
      )}
      {segment === 'financials' && (
        <FinancialsTab
          symbol={symbol}
          financials={financials as FinancialsTabProps['financials']}
          loading={loadingFinancials}
        />
      )}
      {segment === 'forecast' && (
        <ForecastTechnicalsTab
          symbol={symbol}
          sentiment={sentiment as ForecastTechnicalsTabProps['sentiment']}
          technicals={technicals as ForecastTechnicalsTabProps['technicals']}
          loading={loadingTechnicals}
        />
      )}
      {segment === 'insiders' && (
        <InsidersCommunityTab
          symbol={symbol}
          insiders={insiders as InsidersCommunityTabProps['insiders']}
          loading={loadingInsiders}
        />
      )}

      <TradeButton
        symbol={symbol}
        currentPrice={(detail as { statistics?: { currentPrice?: number | null } })?.statistics?.currentPrice ?? null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
