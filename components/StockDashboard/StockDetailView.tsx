import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { COLORS, TYPO } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { StockDetailProvider, useStockDetail } from '../../contexts/StockDetailContext';
import { useExpertise } from '../../contexts/ExpertiseContext';
import { toFaheemMode } from '../../src/services/aiService';
import { useLivePrice } from '../../src/hooks/useLivePrice';
import { StockLogo, MarketStatusBadge, StockHeaderAura } from '../../src/components';
import { getMarketStatus } from '../../src/utils/marketHours';
import { OverviewTab } from './OverviewTab';
import type { OverviewTabProps } from './OverviewTab';

/** Chart point shape required by react-native-wagmi-charts (timestamp in ms). */
export type ChartDataPoint = { timestamp: number; value: number };

/**
 * Map API historical response to chart format { timestamp, value }.
 * Handles: time (sec or ms), datetime (string), close/value. Crash-proof.
 */
export function formatHistoricalToChartData(historical: OverviewTabProps['historical']): ChartDataPoint[] {
  const data = historical?.data;
  if (!Array.isArray(data) || data.length === 0) return [];
  const out: ChartDataPoint[] = [];
  for (const d of data) {
    if (d == null || typeof d !== 'object') continue;
    const rawTime = (d as { time?: number; timestamp?: number }).time ?? (d as { time?: number; timestamp?: number }).timestamp;
    const rawDt = (d as { datetime?: string; date?: string }).datetime ?? (d as { datetime?: string; date?: string }).date;
    let timestamp = 0;
    if (typeof rawTime === 'number' && Number.isFinite(rawTime)) {
      timestamp = rawTime < 1e12 ? rawTime * 1000 : rawTime;
    } else if (typeof rawDt === 'string' && rawDt) {
      const ms = Date.parse(rawDt);
      timestamp = Number.isFinite(ms) ? ms : 0;
    }
    const close = (d as { close?: number; c?: number; value?: number }).close ?? (d as { close?: number; c?: number; value?: number }).c ?? (d as { close?: number; value?: number }).value;
    const value = typeof close === 'number' && Number.isFinite(close) ? close : Number(close);
    if (timestamp > 0 && Number.isFinite(value)) out.push({ timestamp, value });
  }
  return out;
}
import { NewsTab } from './NewsTab';
import { FinancialsTab } from './FinancialsTab';
import type { FinancialsTabProps } from './FinancialsTab';
import { TechnicalsTab } from './TechnicalsTab';
import { ForecastAITab } from './ForecastAITab';
import { InsidersTab } from './InsidersTab';
import { CommunityTab } from './CommunityTab';
import { TradeButton } from '../TradeButton';

const Tab = createMaterialTopTabNavigator();

const FLASH_DURATION_MS = 400;

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

function PriceHeader() {
  const { colors } = useTheme();
  const {
    detail,
    loadingDetail,
    symbol,
    initialName: initialNameStr,
    initialPrice: initialPriceStr,
    initialChange: initialChangeStr,
    initialLastClose: initialLastCloseStr,
    rateLimitError,
  } = useStockDetail();
  const { currentPrice: livePrice, previousPrice, percentChange: livePercentChange, rateLimited } = useLivePrice(symbol, 5000);
  const showPausedIndicator = rateLimitError === 'RATE_LIMIT' || rateLimited;

  const stats = detail?.statistics;
  const quote = detail?.quote as { close?: number; price?: number } | undefined;
  const marketStatus = getMarketStatus();
  const isMarketClosed = marketStatus.status === 'Market Closed';
  const quoteLastClose = quote?.close ?? quote?.price;
  const parsedInitialLastClose =
    initialLastCloseStr != null && initialLastCloseStr !== '' && initialLastCloseStr !== '—'
      ? Number(initialLastCloseStr)
      : null;
  const lastClose = quoteLastClose ?? (Number.isFinite(parsedInitialLastClose) ? parsedInitialLastClose : null);
  const fallbackPrice = Number(stats?.currentPrice);
  const effectivePrice =
    isMarketClosed && lastClose != null && Number.isFinite(lastClose)
      ? lastClose
      : (Number.isFinite(fallbackPrice) ? fallbackPrice : 0);
  const fallbackChange = Number(stats?.percent_change) ?? 0;
  const parsedInitialPrice =
    initialPriceStr != null && initialPriceStr !== '' && initialPriceStr !== '—' ? Number(initialPriceStr) : null;
  const parsedInitialChange =
    initialChangeStr != null && initialChangeStr !== '' && initialChangeStr !== '—' ? Number(initialChangeStr) : null;

  const hasInitialData = (initialPriceStr != null && initialPriceStr !== '—') || (initialNameStr != null && initialNameStr !== '');
  const useInitialAsPrimary = loadingDetail && hasInitialData;

  const priceNum = useInitialAsPrimary
    ? (Number.isFinite(parsedInitialPrice) ? parsedInitialPrice : isMarketClosed && Number.isFinite(parsedInitialLastClose) ? parsedInitialLastClose : null)
    : (livePrice !== undefined
        ? livePrice
        : effectivePrice ||
          (Number.isFinite(parsedInitialPrice) ? parsedInitialPrice : isMarketClosed && lastClose != null ? lastClose : null));
  const changeNum = useInitialAsPrimary
    ? (Number.isFinite(parsedInitialChange) ? parsedInitialChange : 0)
    : (livePercentChange !== undefined
        ? livePercentChange
        : Number.isFinite(fallbackChange)
          ? fallbackChange
          : Number.isFinite(parsedInitialChange)
            ? parsedInitialChange
            : 0);
  const isPositive = (changeNum ?? 0) >= 0;

  const profile = detail?.profile as { name?: string | { en?: string }; sector?: string | { en?: string }; description?: string | { en?: string } } | undefined;
  const nameStr = typeof profile?.name === 'string' ? profile.name : profile?.name?.en;
  const sectorStr = typeof profile?.sector === 'string' ? profile.sector : profile?.sector?.en;
  const displayName = useInitialAsPrimary ? (initialNameStr || symbol) : (nameStr || initialNameStr || symbol);

  const flashAnim = useRef(new Animated.Value(0)).current;
  const prevLiveRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (livePrice === undefined || previousPrice === undefined || livePrice === previousPrice) return;
    if (prevLiveRef.current === livePrice) return;
    prevLiveRef.current = livePrice;
    flashAnim.setValue(0);
    Animated.timing(flashAnim, {
      toValue: 1,
      duration: FLASH_DURATION_MS,
      useNativeDriver: false,
    }).start(() => {
      flashAnim.setValue(0);
    });
  }, [livePrice, previousPrice, flashAnim]);

  const hasAura = true;
  const baseTextColor = hasAura ? '#FFFFFF' : colors.text;
  const priceColor = flashAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [
      baseTextColor,
      previousPrice !== undefined && livePrice !== undefined
        ? livePrice > previousPrice
          ? colors.positive
          : colors.negative
        : baseTextColor,
      baseTextColor,
    ],
  });

  const changeStr = (priceNum != null && priceNum !== 0) || Number.isFinite(changeNum)
    ? `${isPositive ? '+' : ''}${Number(changeNum).toFixed(2)}%`
    : '—';
  const hasOptimistic =
    Number.isFinite(parsedInitialPrice) || Number.isFinite(parsedInitialChange) || Number.isFinite(parsedInitialLastClose);
  const showPrice = useInitialAsPrimary || !loadingDetail || livePrice !== undefined || hasOptimistic;

  const auraHeight = Math.max(200, Dimensions.get('window').height * 0.25);
  const sentimentScore = 50 + Math.max(-50, Math.min(50, Number(changeNum) * 5));
  const headerTextColor = hasAura ? '#FFFFFF' : colors.text;
  const headerSubtextColor = hasAura ? '#FFFFFF' : colors.textTertiary;

  return (
    <View style={[styles.headerWrapper, { minHeight: auraHeight }]}>
      <StockHeaderAura score={sentimentScore} />
      <View style={[styles.header, { backgroundColor: 'transparent' }]} pointerEvents="box-none">
      <View style={styles.headerRow}>
        <StockLogo symbol={symbol} size={50} />
        <View style={styles.headerTextWrap}>
          <Text style={[styles.companyName, { color: headerTextColor }]} numberOfLines={1}>{displayName}</Text>
          <Text style={[styles.ticker, { color: headerSubtextColor }]} numberOfLines={1}>{sectorStr || symbol}</Text>
        </View>
      </View>
      <View style={styles.priceRow}>
        {!showPrice ? (
          <Text style={[styles.price, { color: headerTextColor }]}>—</Text>
        ) : (
          <>
            <Animated.Text style={[styles.price, { color: priceColor }]} numberOfLines={1}>
              {(priceNum != null && Number.isFinite(priceNum)) ? Number(priceNum).toFixed(2) : (initialPriceStr && initialPriceStr !== '—' ? initialPriceStr : '—')}
            </Animated.Text>
            <View style={[styles.pill, isPositive ? { backgroundColor: colors.neonMintDim } : { backgroundColor: colors.negativeDim }]}>
              <Text style={[styles.pillText, isPositive ? styles.positive : styles.negative, hasAura && { color: '#FFFFFF' }]}>
                {changeStr}
              </Text>
            </View>
          </>
        )}
      </View>
      <View style={styles.statusWrap}>
        <MarketStatusBadge quoteTimestamp={getQuoteTimestamp(detail)} forceWhiteText={hasAura} />
        {showPausedIndicator && (
          <Text style={[styles.livePausedLabel, { color: hasAura ? 'rgba(255,255,255,0.85)' : colors.textTertiary }]}>
            Live updates paused
          </Text>
        )}
      </View>
      </View>
    </View>
  );
}

function OverviewScreen() {
  const { expertiseLevel } = useExpertise();
  const { symbol, detail, historical, loadingDetail, loadDetail, symbolForAi, chartUnavailable, rateLimitError, suppressErrorView } = useStockDetail();
  const mode = toFaheemMode(expertiseLevel);
  const chartData = useMemo(() => formatHistoricalToChartData(historical as OverviewTabProps['historical']), [historical]);
  return (
    <OverviewTab
      symbol={symbol}
      detail={detail as OverviewTabProps['detail']}
      historical={historical as OverviewTabProps['historical']}
      chartData={chartData}
      loading={loadingDetail}
      faheemMode={mode}
      onRefresh={loadDetail}
      symbolForAi={symbolForAi}
      chartUnavailable={chartUnavailable}
      rateLimitError={rateLimitError === 'RATE_LIMIT'}
      suppressErrorView={suppressErrorView}
    />
  );
}

function NewsScreen() {
  const { symbol, news, loadingNews, loadNews } = useStockDetail();
  useEffect(() => { loadNews(); }, [loadNews]);
  return <NewsTab symbol={symbol} news={news} loading={loadingNews} />;
}

function FinancialsScreen() {
  const { symbol, financials, loadingFinancials, loadFinancials } = useStockDetail();
  useEffect(() => { loadFinancials(); }, [loadFinancials]);
  return <FinancialsTab symbol={symbol} financials={financials as FinancialsTabProps['financials']} loading={loadingFinancials} />;
}

function TechnicalsScreen() {
  const { symbol, technicals, loadingTechnicals, loadTechnicals, historical } = useStockDetail();
  useEffect(() => { loadTechnicals(); }, [loadTechnicals]);
  return <TechnicalsTab symbol={symbol} technicals={technicals} loading={loadingTechnicals} historical={historical} />;
}

function ForecastAIScreen() {
  const { symbol, historical, detail } = useStockDetail();
  const currentPrice = (detail?.statistics as { currentPrice?: number | null } | undefined)?.currentPrice ?? null;
  return (
    <ForecastAITab
      symbol={symbol}
      historical={historical}
      currentPrice={currentPrice}
    />
  );
}

function InsidersScreen() {
  const { symbol, insiders, loadingInsiders, loadInsiders } = useStockDetail();
  useEffect(() => { loadInsiders(); }, [loadInsiders]);
  return <InsidersTab symbol={symbol} insiders={insiders} loading={loadingInsiders} />;
}

function CommunityScreen() {
  const { symbol } = useStockDetail();
  return <CommunityTab symbol={symbol} />;
}

export interface StockDetailViewProps {
  symbol: string;
  /** Warm handoff from Watchlist – show immediately, zero loading for price. */
  initialName?: string;
  initialPrice?: string;
  initialChange?: string;
  initialLastClose?: string;
}

function TradeButtonWrapper() {
  const { symbol, detail } = useStockDetail();
  const currentPrice = (detail?.statistics as { currentPrice?: number | null } | undefined)?.currentPrice ?? null;
  return <TradeButton symbol={symbol} currentPrice={currentPrice} />;
}

export function StockDetailView({ symbol, initialName, initialPrice, initialChange, initialLastClose }: StockDetailViewProps) {
  const { colors } = useTheme();

  return (
    <StockDetailProvider
      symbol={symbol}
      initialName={initialName}
      initialPrice={initialPrice}
      initialChange={initialChange}
      initialLastClose={initialLastClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <PriceHeader />
        <Tab.Navigator
          screenOptions={{
            tabBarScrollEnabled: true,
            tabBarStyle: { backgroundColor: colors.background },
            tabBarContentContainerStyle: { paddingHorizontal: 16, paddingRight: 20 },
            tabBarIndicatorStyle: { backgroundColor: colors.electricBlue },
            tabBarLabelStyle: { fontSize: 14, fontWeight: '600', color: colors.textTertiary },
            tabBarItemStyle: { minWidth: 72, paddingHorizontal: 12 },
          }}
        >
          <Tab.Screen name="Overview" component={OverviewScreen} />
          <Tab.Screen name="News" component={NewsScreen} />
          <Tab.Screen name="Financials" component={FinancialsScreen} />
          <Tab.Screen name="Technicals" component={TechnicalsScreen} />
          <Tab.Screen name="Forecast AI" component={ForecastAIScreen} />
          <Tab.Screen name="Insiders" component={InsidersScreen} />
          <Tab.Screen name="Community" component={CommunityScreen} />
        </Tab.Navigator>
        <TradeButtonWrapper />
      </View>
    </StockDetailProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrapper: {
    position: 'relative',
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    zIndex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextWrap: { marginLeft: 10, flex: 1 },
  companyName: {
    ...TYPO.header,
    color: COLORS.text,
    letterSpacing: -0.5,
    fontSize: 20,
  },
  ticker: { fontSize: 12, marginTop: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  statusWrap: { paddingTop: 4, paddingBottom: 2, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  livePausedLabel: { fontSize: 11, fontStyle: 'italic' },
  price: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  pillText: { fontSize: 15, fontWeight: '600' },
  positive: { color: COLORS.positive },
  negative: { color: COLORS.negative },
});
