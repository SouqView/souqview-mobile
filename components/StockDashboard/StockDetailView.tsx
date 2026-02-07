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
  const { detail, loadingDetail, symbol, initialPrice: initialPriceStr, initialChange: initialChangeStr } = useStockDetail();
  const { currentPrice: livePrice, previousPrice, percentChange: livePercentChange } = useLivePrice(symbol, 5000);

  const stats = detail?.statistics;
  const fallbackPrice = Number(stats?.currentPrice) || 0;
  const fallbackChange = Number(stats?.percent_change) ?? 0;
  const parsedInitialPrice = initialPriceStr != null && initialPriceStr !== '' && initialPriceStr !== '—'
    ? Number(initialPriceStr)
    : null;
  const parsedInitialChange = initialChangeStr != null && initialChangeStr !== '' && initialChangeStr !== '—'
    ? Number(initialChangeStr)
    : null;
  const priceNum = livePrice !== undefined ? livePrice : (fallbackPrice || (Number.isFinite(parsedInitialPrice) ? parsedInitialPrice : null));
  const changeNum = livePercentChange !== undefined ? livePercentChange : (Number.isFinite(fallbackChange) ? fallbackChange : (Number.isFinite(parsedInitialChange) ? parsedInitialChange : 0));
  const isPositive = changeNum >= 0;

  const profile = detail?.profile as { name?: string | { en?: string }; sector?: string | { en?: string }; description?: string | { en?: string } } | undefined;
  const nameStr = typeof profile?.name === 'string' ? profile.name : profile?.name?.en;
  const sectorStr = typeof profile?.sector === 'string' ? profile.sector : profile?.sector?.en;

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

  const priceColor = flashAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [
      colors.text,
      previousPrice !== undefined && livePrice !== undefined
        ? livePrice > previousPrice
          ? colors.positive
          : colors.negative
        : colors.text,
      colors.text,
    ],
  });

  const changeStr = (priceNum != null && priceNum !== 0) || Number.isFinite(changeNum)
    ? `${isPositive ? '+' : ''}${Number(changeNum).toFixed(2)}%`
    : '—';
  const hasOptimistic = Number.isFinite(parsedInitialPrice) || Number.isFinite(parsedInitialChange);
  const showPrice = !loadingDetail || livePrice !== undefined || hasOptimistic;

  const auraHeight = Math.max(200, Dimensions.get('window').height * 0.25);
  const sentimentScore = 50 + Math.max(-50, Math.min(50, Number(changeNum) * 5));

  return (
    <View style={[styles.headerWrapper, { minHeight: auraHeight }]}>
      <StockHeaderAura score={sentimentScore} />
      <View style={[styles.header, { backgroundColor: 'transparent' }]} pointerEvents="box-none">
      <View style={styles.headerRow}>
        <StockLogo symbol={symbol} size={50} />
        <View style={styles.headerTextWrap}>
          <Text style={[styles.companyName, { color: colors.text }]} numberOfLines={1}>{nameStr || symbol}</Text>
          <Text style={[styles.ticker, { color: colors.textTertiary }]} numberOfLines={1}>{sectorStr || symbol}</Text>
        </View>
      </View>
      <View style={styles.priceRow}>
        {!showPrice ? (
          <Text style={[styles.price, { color: colors.text }]}>—</Text>
        ) : (
          <>
            <Animated.Text style={[styles.price, { color: priceColor }]} numberOfLines={1}>
              {(priceNum != null && Number.isFinite(priceNum)) ? Number(priceNum).toFixed(2) : (initialPriceStr && initialPriceStr !== '—' ? initialPriceStr : '—')}
            </Animated.Text>
            <View style={[styles.pill, isPositive ? { backgroundColor: colors.neonMintDim } : { backgroundColor: colors.negativeDim }]}>
              <Text style={[styles.pillText, isPositive ? styles.positive : styles.negative]}>
                {changeStr}
              </Text>
            </View>
          </>
        )}
      </View>
      <View style={styles.statusWrap}>
        <MarketStatusBadge quoteTimestamp={getQuoteTimestamp(detail)} />
      </View>
      </View>
    </View>
  );
}

function OverviewScreen() {
  const { expertiseLevel } = useExpertise();
  const { symbol, detail, historical, loadingDetail, loadDetail } = useStockDetail();
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
  /** Passed from Watchlist for optimistic UI – show immediately while detail loads. */
  initialPrice?: string;
  initialChange?: string;
}

function TradeButtonWrapper() {
  const { symbol, detail } = useStockDetail();
  const currentPrice = (detail?.statistics as { currentPrice?: number | null } | undefined)?.currentPrice ?? null;
  return <TradeButton symbol={symbol} currentPrice={currentPrice} />;
}

export function StockDetailView({ symbol, initialPrice, initialChange }: StockDetailViewProps) {
  const { colors } = useTheme();

  return (
    <StockDetailProvider symbol={symbol} initialPrice={initialPrice} initialChange={initialChange}>
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
    paddingTop: 12,
    paddingBottom: 20,
    zIndex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextWrap: { marginLeft: 12, flex: 1 },
  companyName: {
    ...TYPO.header,
    color: COLORS.text,
    letterSpacing: -0.5,
    fontSize: 22,
  },
  ticker: { fontSize: 13, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  statusWrap: { paddingTop: 6, paddingBottom: 4 },
  price: {
    ...TYPO.price,
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  pillText: { fontSize: 15, fontWeight: '600' },
  positive: { color: COLORS.positive },
  negative: { color: COLORS.negative },
});
