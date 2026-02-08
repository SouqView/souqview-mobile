import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { StockLogo, MarketStatusBadge, StockHeaderAura, SkeletonLoader } from '../../src/components';
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

/** Extract quote timestamp (sec or ms) for stale-data check. */
function getQuoteTimestamp(detail: unknown): number | string | undefined {
  if (detail == null || typeof detail !== 'object') return undefined;
  const d = detail as Record<string, unknown>;
  const q = d.quote as Record<string, unknown> | undefined;
  if (q?.timestamp != null) return q.timestamp as number;
  if (q?.t != null) return q.t as number;
  if (q?.datetime != null) return q.datetime as string;
  if (d.timestamp != null) return d.timestamp as number;
  return undefined;
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
  const [loadingHistorical, setLoadingHistorical] = useState(true);
  const [loadingNews, setLoadingNews] = useState(false);
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [loadingTechnicals, setLoadingTechnicals] = useState(false);
  const [loadingInsiders, setLoadingInsiders] = useState(false);

  /** Progressive load: show price as soon as quote returns; chart when historical returns. */
  const loadDetail = useCallback(async () => {
    setLoadingDetail(true);
    setLoadingHistorical(true);
    try {
      const resDetail = await getStockDetail(symbol);
      setDetail(resDetail?.data ?? null);
      setLoadingDetail(false);
    } catch (_) {
      setDetail(null);
      setLoadingDetail(false);
    }
    try {
      const resHist = await getHistoricalData(symbol, '1day');
      setHistorical(resHist ?? null);
    } catch (_) {
      setHistorical(null);
    } finally {
      setLoadingHistorical(false);
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

  const { colors } = useTheme();
  const profile = (detail as { profile?: { name?: string; sector?: string } })?.profile;
  const stats = (detail as { statistics?: { currentPrice?: number; percent_change?: number } })?.statistics;
  const companyName = profile?.name ?? symbol;
  const sector = profile?.sector ?? symbol;
  const price = stats?.currentPrice;
  const percentChange = stats?.percent_change ?? 0;
  const isPositive = percentChange >= 0;
  const auraHeight = Math.max(200, Dimensions.get('window').height * 0.25);
  const sentimentScore = 50 + Math.max(-50, Math.min(50, Number(percentChange) * 5));
  const hasAura = true;
  const headerTextColor = hasAura ? '#FFFFFF' : colors.text;
  const headerSubtextColor = hasAura ? '#FFFFFF' : colors.textTertiary;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.headerWrapper, { minHeight: auraHeight }]}>
        <StockHeaderAura score={sentimentScore} />
        <View style={styles.headerContent} pointerEvents="box-none">
      <View style={[styles.headerRow, { backgroundColor: 'transparent' }]}>
        <StockLogo symbol={symbol} size={50} />
        <View style={styles.headerTextWrap}>
          <Text style={[styles.companyName, { color: headerTextColor }]} numberOfLines={1}>{companyName}</Text>
          <Text style={[styles.ticker, { color: headerSubtextColor }]} numberOfLines={1}>{sector}</Text>
        </View>
      </View>
      <View style={[styles.priceRow, { borderBottomColor: colors.separator }]}>
        <Text style={[styles.price, { color: headerTextColor }]}>
          {price != null ? Number(price).toFixed(2) : '—'}
        </Text>
        <View style={[styles.pill, isPositive ? { backgroundColor: colors.neonMintDim } : { backgroundColor: colors.negativeDim }]}>
          <Text style={[styles.pillText, isPositive ? styles.positive : styles.negative, hasAura && { color: '#FFFFFF' }]}>
            {price != null ? `${isPositive ? '+' : ''}${Number(percentChange).toFixed(2)}%` : '—'}
          </Text>
        </View>
      </View>
      <View style={styles.statusWrap}>
        <MarketStatusBadge quoteTimestamp={getQuoteTimestamp(detail)} forceWhiteText={hasAura} />
      </View>
        </View>
      </View>
      <SegmentedBar selected={segment} onSelect={setSegment} />

      {segment === 'overview' && (
        <OverviewTab
          symbol={symbol}
          detail={detail as OverviewTabProps['detail']}
          historical={historical as OverviewTabProps['historical']}
          loading={loadingDetail || loadingHistorical}
        />
      )}
      {segment === 'news' && (
        loadingNews ? (
          <View style={styles.skeletonSection}>
            <SkeletonLoader width="100%" height={120} style={styles.skeletonBlock} />
            <SkeletonLoader width="90%" height={80} style={styles.skeletonBlock} />
            <SkeletonLoader width="95%" height={80} style={styles.skeletonBlock} />
          </View>
        ) : (
          <NewsTab
            symbol={symbol}
            news={Array.isArray(news) ? news : (news as { data?: unknown[] })?.data ?? null}
            loading={false}
          />
        )
      )}
      {segment === 'financials' && (
        loadingFinancials ? (
          <View style={styles.skeletonSection}>
            <SkeletonLoader width="100%" height={100} style={styles.skeletonBlock} />
            <SkeletonLoader width="100%" height={200} style={styles.skeletonBlock} />
          </View>
        ) : (
          <FinancialsTab
            symbol={symbol}
            financials={financials as FinancialsTabProps['financials']}
            loading={false}
          />
        )
      )}
      {segment === 'forecast' && (
        loadingTechnicals ? (
          <View style={styles.skeletonSection}>
            <SkeletonLoader width="100%" height={140} style={styles.skeletonBlock} />
            <SkeletonLoader width="90%" height={100} style={styles.skeletonBlock} />
          </View>
        ) : (
          <ForecastTechnicalsTab
            symbol={symbol}
            sentiment={sentiment as ForecastTechnicalsTabProps['sentiment']}
            technicals={technicals as ForecastTechnicalsTabProps['technicals']}
            loading={false}
          />
        )
      )}
      {segment === 'insiders' && (
        loadingInsiders ? (
          <View style={styles.skeletonSection}>
            <SkeletonLoader width="100%" height={100} style={styles.skeletonBlock} />
            <SkeletonLoader width="100%" height={120} style={styles.skeletonBlock} />
          </View>
        ) : (
          <InsidersCommunityTab
            symbol={symbol}
            insiders={insiders as InsidersCommunityTabProps['insiders']}
            loading={false}
          />
        )
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
  skeletonSection: { padding: 20, gap: 12 },
  skeletonBlock: { borderRadius: 8, marginBottom: 12 },
  headerWrapper: { position: 'relative', overflow: 'hidden' },
  headerContent: { zIndex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerTextWrap: { marginLeft: 10, flex: 1 },
  companyName: { fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  ticker: { fontSize: 12, marginTop: 1 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  statusWrap: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  price: { fontSize: 26, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  pillText: { fontSize: 15, fontWeight: '600' },
  positive: { color: '#22c55e' },
  negative: { color: '#ef4444' },
});
