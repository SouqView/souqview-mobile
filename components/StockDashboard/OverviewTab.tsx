import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  NativeSyntheticEvent,
  NativeTouchEvent,
  Platform,
} from 'react-native';
import Svg, { Polyline, Circle, Line, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { COLORS, TYPO } from '../../constants/theme';
import { TypewriterText, SkeletonLoader, SentimentBar } from '../../src/components';
import { getFaheemOverview } from '../../src/services/aiService';
import { FaheemRationaleErrorBoundary } from '../FaheemRationaleErrorBoundary';
import { calculateSmartSentiment } from '../../src/utils/sentimentEngine';
import type { FaheemMode } from '../../src/services/aiService';
import { getHistoricalData } from '../../services/api';

type Candle = { time: number; open: number; high: number; low: number; close: number; volume?: number };

export type StockProfileOverview = {
  name?: string;
  description?: string;
  sector?: string;
  industry?: string;
  market_cap?: string | number;
  pe?: string | number;
  fifty_two_week_high?: number;
  fifty_two_week_low?: number;
  fifty_two_week?: { high?: number; low?: number };
  executives?: Array<{ name?: string; title?: string }>;
  officers?: Array<{ name?: string; title?: string }>;
};

type StatsShape = {
  currentPrice?: number | null;
  percent_change?: number | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  volume?: string | number | null;
  market_cap?: string | number | null;
  marketCap?: string | number | null;
  pe?: string | number | null;
  peRatio?: number | string | null;
  yield?: string | number | null;
  dividendYield?: number | null;
};

export type ChartDataPoint = { timestamp: number; value: number };

export interface OverviewTabProps {
  symbol: string;
  detail: {
    statistics?: StatsShape;
    quote?: Record<string, unknown>;
    profile?: StockProfileOverview;
    error?: 'RATE_LIMIT';
  } | null;
  historical: { data?: Candle[] } | null;
  /** Pre-formatted chart data from parent (StockDetailView). If set, used for the line chart; else derived from historical. */
  chartData?: ChartDataPoint[];
  loading: boolean;
  faheemMode?: FaheemMode;
  /** When user pulls to refresh, re-fetch Profile/Quote (Overview data). */
  onRefresh?: () => void;
  /** Symbol stable 600ms — only fetch Faheem when this matches symbol (debounced AI). */
  symbolForAi?: string | null;
  /** When true, chart API failed but Key Statistics are available; show skeleton instead of "Chart Unavailable" text. */
  chartUnavailable?: boolean;
  /** When true, backend returned 429; show content but header shows "Live updates paused" (do not full-screen error). */
  rateLimitError?: boolean;
  /** When true (e.g. first 5s with warm handoff), do not show error view – show watchlist data / loading. */
  suppressErrorView?: boolean;
}

const CHART_HEIGHT = 300;
const PADDING = 20;

/** Sanitizes API data and renders an SVG line or candle chart. Shows skeleton when chartUnavailable and no data. */
function StockLineChart({
  data,
  isPositive,
  type = 'line',
  chartUnavailable = false,
}: {
  data: Array<Record<string, unknown>>;
  isPositive: boolean;
  type?: 'line' | 'candle';
  chartUnavailable?: boolean;
}) {
  const { colors } = useTheme();
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const lastScrubRef = useRef<number | null>(null);

  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return null;

    return data
      .map((item) => {
        const rawTs = item.timestamp ?? item.time ?? item.datetime;
        const timestamp =
          typeof rawTs === 'string'
            ? new Date(rawTs).getTime()
            : typeof rawTs === 'number' && Number.isFinite(rawTs)
              ? rawTs < 1e12
                ? rawTs * 1000
                : rawTs
              : 0;
        const value = Number(item.value ?? item.close ?? 0);
        const open = Number(item.open ?? item.close ?? value);
        const high = Number(item.high ?? Math.max(open, value));
        const low = Number(item.low ?? Math.min(open, value));
        const close = Number(item.close ?? item.value ?? value);
        return { timestamp, value, open, high, low, close };
      })
      .filter((item) => !Number.isNaN(item.value) && !Number.isNaN(item.timestamp) && item.timestamp > 0);
  }, [data]);

  if (!chartData || chartData.length === 0) {
    if (chartUnavailable) {
      return (
        <View style={{ height: CHART_HEIGHT, justifyContent: 'center', alignItems: 'center', paddingHorizontal: PADDING }}>
          <SkeletonLoader width={Dimensions.get('window').width - PADDING * 2 - 24} height={CHART_HEIGHT} borderRadius={12} style={{ backgroundColor: colors.separator }} />
        </View>
      );
    }
    const webOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    return (
      <View style={{ height: CHART_HEIGHT, justifyContent: 'center', alignItems: 'center', paddingHorizontal: PADDING }}>
        <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>Chart Unavailable</Text>
        {Platform.OS === 'web' && (
          <>
            <Text style={{ color: colors.textTertiary, fontSize: 12, textAlign: 'center', marginTop: 8, maxWidth: 320 }}>
              Ensure the backend is running and allows CORS. If using an origin allowlist, add:
            </Text>
            {webOrigin ? (
              <Text style={{ color: colors.electricBlue, fontSize: 12, textAlign: 'center', marginTop: 4, fontFamily: 'monospace' }} selectable>
                {webOrigin}
              </Text>
            ) : null}
          </>
        )}
      </View>
    );
  }

  const lineColor = isPositive ? colors.positive : colors.negative;
  const chartWidth = Dimensions.get('window').width - PADDING * 2 - 24;
  const innerHeight = CHART_HEIGHT - 24;

  const candles = type === 'candle' ? chartData : null;
  const minVal =
    type === 'candle' && candles?.length
      ? Math.min(...candles.flatMap((c) => [c.low, c.open, c.close]))
      : Math.min(...chartData.map((d) => d.value));
  const maxVal =
    type === 'candle' && candles?.length
      ? Math.max(...candles.flatMap((c) => [c.high, c.open, c.close]))
      : Math.max(...chartData.map((d) => d.value));
  const range = maxVal - minVal || 1;
  const step = chartData.length > 1 ? chartWidth / (chartData.length - 1) : 0;
  const barWidth = Math.max(2, Math.min(step * 0.6, 12));

  const points =
    type === 'line'
      ? chartData
          .map((d, i) => {
            const x = i * step;
            const y = CHART_HEIGHT - 12 - ((d.value - minVal) / range) * innerHeight;
            return `${x},${y}`;
          })
          .join(' ')
      : '';

  const scrubbedPoint = scrubIndex != null ? chartData[scrubIndex] : undefined;
  const scrubX = scrubIndex != null ? scrubIndex * step + (type === 'candle' ? step / 2 : 0) : null;
  const scrubY =
    scrubbedPoint != null
      ? CHART_HEIGHT - 12 - ((scrubbedPoint.value - minVal) / range) * innerHeight
      : null;

  const onTouch = (evt: NativeSyntheticEvent<NativeTouchEvent>) => {
    const touch = evt.nativeEvent.touches[0];
    if (!touch || chartData.length < 2) return;
    const x = touch.pageX - PADDING;
    const i = Math.round((x / chartWidth) * (chartData.length - 1));
    const clamped = Math.max(0, Math.min(i, chartData.length - 1));
    if (clamped !== lastScrubRef.current && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      lastScrubRef.current = clamped;
    }
    setScrubIndex(clamped);
  };

  const toY = (v: number) => CHART_HEIGHT - 12 - ((v - minVal) / range) * innerHeight;

  return (
    <View
      style={{ height: CHART_HEIGHT, position: 'relative' }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={onTouch}
      onResponderMove={onTouch}
      onResponderRelease={() => {
        lastScrubRef.current = null;
        setScrubIndex(null);
      }}
    >
      {scrubbedPoint != null && (
        <View
          style={{
            position: 'absolute',
            top: 8,
            left: PADDING,
            zIndex: 2,
            backgroundColor: colors.card,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>
            {scrubbedPoint.value.toFixed(2)}
          </Text>
        </View>
      )}
      <Svg width={chartWidth} height={CHART_HEIGHT}>
        {type === 'line' && (
          <Polyline
            points={points}
            fill="none"
            stroke={lineColor}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {type === 'candle' &&
          candles?.map((c, i) => {
            const x = i * step + (step - barWidth) / 2;
            const isUp = c.close >= c.open;
            const bodyTop = toY(Math.max(c.open, c.close));
            const bodyBottom = toY(Math.min(c.open, c.close));
            const bodyHeight = Math.max(1, bodyBottom - bodyTop);
            const wickTop = toY(c.high);
            const wickBottom = toY(c.low);
            const fill = isUp ? colors.positive : colors.negative;
            return (
              <React.Fragment key={i}>
                <Line
                  x1={x + barWidth / 2}
                  y1={wickTop}
                  x2={x + barWidth / 2}
                  y2={wickBottom}
                  stroke={fill}
                  strokeWidth={1.5}
                />
                <Rect
                  x={x}
                  y={bodyTop}
                  width={barWidth}
                  height={bodyHeight}
                  fill={fill}
                  rx={1}
                />
              </React.Fragment>
            );
          })}
        {scrubX != null && scrubY != null && (
          <Circle cx={scrubX} cy={scrubY} r={6} fill={colors.text} opacity={0.9} />
        )}
      </Svg>
    </View>
  );
}

/** Compact format: 2.5T, 150M, 1.2K */
function formatCompact(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.eE+-]/g, '')) : Number(value);
  if (Number.isNaN(num)) return String(value);
  const abs = Math.abs(num);
  if (abs >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(num / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
}

/** Market Cap: show pre-formatted strings (e.g. "2.5T") as-is, otherwise format with T/B/M/K */
function formatMarketCap(value: string | number | null | undefined): string {
  if (value == null || value === '') return 'N/A';
  const s = typeof value === 'string' ? value.trim() : String(value);
  if (/^\d+(\.\d+)?\s*[TBMK]$/i.test(s)) return s;
  const num = typeof value === 'number' ? value : parseFloat(s.replace(/[^0-9.eE+-]/g, ''));
  if (!Number.isFinite(num) || num === 0) return 'N/A';
  return formatCompact(value);
}

/** Map backend quote (snake_case) to statistics shape for display and Faheem. */
function quoteToStats(quote: Record<string, unknown> | undefined): StatsShape | undefined {
  if (!quote || typeof quote !== 'object') return undefined;
  const q = quote as Record<string, unknown>;
  const f52 = q.fifty_two_week && typeof q.fifty_two_week === 'object' ? (q.fifty_two_week as { high?: number; low?: number }) : null;
  return {
    currentPrice: (q.current_price ?? q.close ?? q.price) as number | undefined,
    percent_change: (q.percent_change ?? q.change_pct ?? q.change) as number | undefined,
    fiftyTwoWeekHigh: (q.fifty_two_week_high ?? q.high_52_week ?? f52?.high) as number | undefined,
    fiftyTwoWeekLow: (q.fifty_two_week_low ?? q.low_52_week ?? f52?.low) as number | undefined,
    volume: (q.volume ?? q.average_volume) as string | number | undefined,
    market_cap: (q.market_cap ?? q.market_capitalization) as string | number | undefined,
    pe: (q.pe ?? q.pe_ratio) as string | number | undefined,
    yield: (q.dividend_yield ?? q.yield) as string | number | undefined,
  };
}

/** Get profile from detail (stockProfile, profile, or nested under .data). Force display data. */
function getProfile(detail: OverviewTabProps['detail']): StockProfileOverview | undefined {
  if (!detail || typeof detail !== 'object') return undefined;
  const d = detail as Record<string, unknown>;
  const p = (d.stockProfile ?? d.profile ?? (d.data as Record<string, unknown>)?.profile ?? (d.data as Record<string, unknown>)?.stockProfile) as StockProfileOverview | undefined;
  return p;
}

/** Get quote from detail (may be nested under .data). */
function getQuote(detail: OverviewTabProps['detail']): Record<string, unknown> | undefined {
  if (!detail || typeof detail !== 'object') return undefined;
  const d = detail as Record<string, unknown>;
  return (d.quote ?? (d.data as Record<string, unknown>)?.quote) as Record<string, unknown> | undefined;
}

/** Get statistics from detail (may be nested under .data). */
function getStatistics(detail: OverviewTabProps['detail']): StatsShape | undefined {
  if (!detail || typeof detail !== 'object') return undefined;
  const d = detail as Record<string, unknown>;
  return (d.statistics ?? (d.data as Record<string, unknown>)?.statistics) as StatsShape | undefined;
}

export function OverviewTab({ symbol, detail, historical, loading, faheemMode = 'beginner', onRefresh, symbolForAi: symbolForAiProp, chartUnavailable: chartUnavailableProp = false, rateLimitError = false, suppressErrorView = false }: OverviewTabProps) {
  const { colors } = useTheme();
  const profile = getProfile(detail);
  const quote = getQuote(detail);
  const statsFromApi = getStatistics(detail);
  const statsFromQuote = quoteToStats(quote);
  const stats =
    (statsFromApi && (statsFromApi.currentPrice != null || statsFromApi.volume != null || statsFromApi.market_cap != null))
      ? statsFromApi
      : (statsFromQuote ?? statsFromApi ?? undefined);
  const profile52High = profile?.fifty_two_week_high ?? profile?.fifty_two_week?.high;
  const profile52Low = profile?.fifty_two_week_low ?? profile?.fifty_two_week?.low;
  const q = quote as Record<string, unknown> | undefined;
  const volume = (q?.volume ?? stats?.volume) as string | number | undefined;
  const fiftyTwoHigh = (q?.fifty_two_week && typeof q.fifty_two_week === 'object'
    ? (q.fifty_two_week as { high?: number })?.high
    : (q?.fifty_two_week_high ?? stats?.fiftyTwoWeekHigh ?? profile?.fifty_two_week_high ?? profile?.fifty_two_week?.high)) as number | undefined;
  const fiftyTwoLow = (q?.fifty_two_week && typeof q.fifty_two_week === 'object'
    ? (q.fifty_two_week as { low?: number })?.low
    : (q?.fifty_two_week_low ?? stats?.fiftyTwoWeekLow ?? profile?.fifty_two_week_low ?? profile?.fifty_two_week?.low)) as number | undefined;
  const price = stats?.currentPrice ?? 0;
  const change = stats?.percent_change ?? 0;
  const high = fiftyTwoHigh ?? profile52High ?? 0;
  const low = fiftyTwoLow ?? profile52Low ?? 0;
  const vol = volume ?? stats?.volume ?? '—';
  const marketCap = (stats?.marketCap ?? stats?.market_cap ?? profile?.market_cap ?? (q?.market_cap as string | number | undefined)) as string | number | undefined;
  const peRatio = (stats?.peRatio ?? stats?.pe ?? profile?.pe ?? (q?.pe as string | number | undefined) ?? (q?.pe_ratio as string | number | undefined)) as string | number | undefined;
  const dividendYield = stats?.dividendYield ?? (typeof stats?.yield === 'number' ? stats.yield : null);
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '1Y'>('1D');
  const [chartType, setChartType] = useState<'line' | 'candle'>('line');
  const [chartHistorical, setChartHistorical] = useState<{ data?: Candle[] } | null>(null);
  const [loadingTimeframe, setLoadingTimeframe] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  const data = timeframe === '1D' ? (historical?.data ?? []) : (chartHistorical?.data ?? []);
  const chartLoading = timeframe === '1D' ? loading : loadingTimeframe;
  const isPositive = change >= 0;

  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [faheemRationale, setFaheemRationale] = useState<string | null>(null);
  const [faheemVerdict, setFaheemVerdict] = useState<string | null>(null);
  const [faheemLoading, setFaheemLoading] = useState(false);
  const [faheemError, setFaheemError] = useState(false);
  const [faheemRetryKey, setFaheemRetryKey] = useState(0);
  const { width } = Dimensions.get('window');
  const companyName = (typeof profile?.name === 'string' ? profile.name : (profile?.name as unknown as { en?: string })?.en) ?? symbol;
  const description: string = (typeof profile?.description === 'string' ? profile.description : (profile?.description as unknown as { en?: string })?.en)
    ?? (typeof (profile as Record<string, unknown>)?.longBusinessSummary === 'string' ? String((profile as Record<string, unknown>).longBusinessSummary) : '')
    ?? '';
  const executivesList = profile?.executives ?? profile?.officers ?? (profile as Record<string, unknown>)?.key_executives ?? (profile as Record<string, unknown>)?.management ?? [];
  const executives = Array.isArray(executivesList) ? executivesList.slice(0, 5).map((e: { name?: string; title?: string }) => ({ name: e?.name ?? '—', title: e?.title ?? '—' })) : [];
  const chartWidth = width - PADDING * 2 - 24;

  // Chart data for current timeframe (used for Faheem and display)
  const chartData = data ?? [];

  // Faheem Overview: only when symbolForAi is set (1500ms delay in useStockData) so fast symbol switches cancel.
  useEffect(() => {
    if (symbolForAiProp != null && symbolForAiProp !== symbol) return;

    let isMounted = true;
    let activeRequest = false;

    const fetchStrictAi = async () => {
      if (!chartData || chartData.length < 10) {
        if (isMounted) setFaheemLoading(true);
        return;
      }

      try {
        if (activeRequest) return;
        activeRequest = true;
        if (isMounted) setFaheemLoading(true);

        if (__DEV__) console.log(`🧠 Faheem: Analyzing ${chartData.length} candles for ${symbol}...`);

        const res = await getFaheemOverview(symbol, faheemMode);
        const analysis = res?.analysis ?? null;

        if (isMounted) {
          setFaheemRationale(analysis);
          setFaheemVerdict(null);
          setFaheemError(false);
          if (analysis && analysis.length > 5 && !analysis.includes('Insufficient')) {
            setAiAnalysis(analysis);
          }
        }
      } catch (e) {
        if (__DEV__) console.error('AI Error:', e);
        if (isMounted) {
          setAiAnalysis('Analysis temporarily unavailable.');
          setFaheemError(true);
        }
      } finally {
        if (isMounted) setFaheemLoading(false);
        activeRequest = false;
      }
    };

    const delay = symbolForAiProp === symbol ? 0 : 1500;
    const timer = setTimeout(fetchStrictAi, delay);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [symbol, timeframe, chartData, faheemMode, symbolForAiProp, faheemRetryKey]);

  const timeframeToInterval = (tf: string) => {
    switch (tf) {
      case '1W': return '5day';
      case '1M': return '1month';
      case '1Y': return '12month';
      default: return '1day';
    }
  };

  useEffect(() => {
    if (timeframe === '1D') {
      setChartHistorical(null);
      return;
    }
    let cancelled = false;
    setLoadingTimeframe(true);
    getHistoricalData(symbol, timeframeToInterval(timeframe))
      .then((res) => {
        if (!cancelled) setChartHistorical(res ?? null);
      })
      .catch(() => {
        if (!cancelled) setChartHistorical(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingTimeframe(false);
      });
    return () => { cancelled = true; };
  }, [symbol, timeframe]);

  const formatStat = (v: string | number | null | undefined) => {
    if (v == null || v === '') return 'N/A';
    if (typeof v === 'number' && (v === 0 || !Number.isFinite(v))) return 'N/A';
    if (typeof v === 'number') return v.toLocaleString();
    return String(v);
  };
  const formatStatCompact = (v: string | number | null | undefined) => (v != null && v !== '' && Number(v) !== 0 ? formatCompact(v) : 'N/A');
  const formatLargeNumber = (v: string | number | null | undefined) => (v != null && v !== '' && Number(v) !== 0 ? formatCompact(v) : 'N/A');

  const themedStyles = makeStyles(colors);

  const timeframes: Array<'1D' | '1W' | '1M' | '1Y'> = ['1D', '1W', '1M', '1Y'];

  // Smart Sentiment: quote (MFM) + RSI + Faheem. Computed once per load; cache to avoid jumping.
  const lastCandle = data?.length ? data[data.length - 1] : null;
  const quoteForSentiment = useMemo(() => ({
    high: lastCandle?.high ?? (Number.isFinite(high) ? high : price || 100),
    low: lastCandle?.low ?? (Number.isFinite(low) ? low : price || 0),
    close: price || (lastCandle?.close ?? 50),
    changePercent: change,
  }), [lastCandle, high, low, price, change]);
  const faheemForSentiment = faheemLoading ? null : (faheemRationale ?? aiAnalysis ?? null);
  const closesForSentiment = useMemo(
    () => (data ?? []).map((c) => c.close).filter((c): c is number => Number.isFinite(c)),
    [data]
  );
  const sentiment = useMemo(
    () =>
      calculateSmartSentiment(quoteForSentiment, null, faheemForSentiment, {
        symbol,
        closes: closesForSentiment,
      }),
    [quoteForSentiment, faheemForSentiment, symbol, closesForSentiment]
  );
  const [cachedSentimentScore, setCachedSentimentScore] = useState(50);
  const prevSymbolRef = useRef(symbol);
  useEffect(() => {
    if (symbol !== prevSymbolRef.current) {
      prevSymbolRef.current = symbol;
      setCachedSentimentScore(50);
    }
    const hasQuote = quoteForSentiment.close > 0 && Number.isFinite(quoteForSentiment.close);
    if (hasQuote) setCachedSentimentScore(sentiment.score);
  }, [symbol, quoteForSentiment.close, sentiment.score]);

  if (__DEV__) {
    console.log(
      'RAW PROFILE DATA',
      JSON.stringify(
        {
          detail,
          profile: profile ?? null,
          quote: quote ?? null,
          statistics: (detail && typeof detail === 'object' ? (detail as Record<string, unknown>).statistics : undefined),
        },
        null,
        2
      )
    );
  }

  if (!suppressErrorView && !rateLimitError && (detail as { error?: string } | null)?.error === 'RATE_LIMIT') {
    return (
      <View style={themedStyles.container}>
        <View style={themedStyles.errorContainer}>
          <Text style={themedStyles.errorTitle}>Market Data Paused</Text>
          <Text style={themedStyles.errorText}>We are updating too fast. Please wait 60 seconds.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={themedStyles.container}
      contentContainerStyle={themedStyles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? (
        <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.electricBlue} />
      ) : undefined}
    >
      <View style={themedStyles.chartSection}>
        <View style={themedStyles.chartControlsRow}>
          <View style={themedStyles.timeframeRow}>
            {timeframes.map((tf) => (
              <TouchableOpacity
                key={tf}
                style={[
                  themedStyles.timeframeButton,
                  timeframe === tf && themedStyles.timeframeButtonActive,
                ]}
                onPress={() => setTimeframe(tf)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    themedStyles.timeframeLabel,
                    timeframe === tf && themedStyles.timeframeLabelActive,
                  ]}
                >
                  {tf}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={themedStyles.chartTypeToggle}
            onPress={() => setChartType((t) => (t === 'line' ? 'candle' : 'line'))}
            activeOpacity={0.8}
          >
            <Ionicons
              name={chartType === 'line' ? 'trending-up-outline' : 'bar-chart-outline'}
              size={20}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {chartLoading && !data.length ? (
        <View style={[themedStyles.chartPlaceholder, { width: chartWidth, height: CHART_HEIGHT }]}>
          <SkeletonLoader width={chartWidth} height={CHART_HEIGHT} borderRadius={12} style={{ backgroundColor: colors.separator }} />
        </View>
      ) : (
        <View style={[themedStyles.chartWrap, { height: CHART_HEIGHT + 48 }]} key={`${timeframe}-${chartType}`}>
          <StockLineChart
            data={data as Array<Record<string, unknown>>}
            isPositive={isPositive}
            type={chartType}
            chartUnavailable={chartUnavailableProp}
          />
        </View>
      )}

      <SentimentBar score={cachedSentimentScore} />

      <FaheemRationaleErrorBoundary onRetry={() => { setFaheemError(false); setFaheemRationale(null); setFaheemRetryKey((k) => k + 1); }}>
        <View style={themedStyles.faheemCard}>
          <Ionicons name="sparkles" size={20} color={colors.electricBlue} style={themedStyles.faheemIcon} />
          <View style={themedStyles.faheemTitleRow}>
            <Text style={themedStyles.faheemTitle}>Faheem&apos;s Rationale</Text>
            {faheemVerdict ? (
              <View style={[themedStyles.verdictBadge, /^bullish/i.test(faheemVerdict) ? themedStyles.verdictBullish : themedStyles.verdictBearish]}>
                <Text style={themedStyles.verdictText}>{faheemVerdict}</Text>
              </View>
            ) : null}
          </View>
          {faheemLoading ? (
            <View style={themedStyles.faheemSkeleton}>
              <SkeletonLoader width="100%" height={14} style={{ backgroundColor: colors.separator, marginBottom: 8 }} />
              <SkeletonLoader width="85%" height={14} style={{ backgroundColor: colors.separator, marginBottom: 8 }} />
              <SkeletonLoader width="70%" height={14} style={{ backgroundColor: colors.separator }} />
              <Text style={themedStyles.faheemSkeletonText}>Analyzing chart data...</Text>
            </View>
          ) : faheemError ? (
            <Text style={themedStyles.faheemSummary}>
              Reconnecting…
            </Text>
          ) : (
            <View style={themedStyles.faheemContent}>
              <TypewriterText
                text={faheemRationale ?? aiAnalysis ?? 'Analyzing chart data...'}
                style={themedStyles.faheemSummary}
                haptics={false}
              />
            </View>
          )}
        </View>
      </FaheemRationaleErrorBoundary>

      <Text style={themedStyles.sectionHeader}>Key Statistics</Text>
      <View style={themedStyles.statsGrid}>
        <View style={themedStyles.statCell}>
          <Text style={themedStyles.statLabel}>Market Cap</Text>
          <Text style={themedStyles.statValue}>{formatMarketCap(marketCap)}</Text>
        </View>
        <View style={themedStyles.statCell}>
          <Text style={themedStyles.statLabel}>Volume</Text>
          <Text style={themedStyles.statValue}>{vol != null && vol !== '' ? formatLargeNumber(vol) : 'N/A'}</Text>
        </View>
        <View style={themedStyles.statCell}>
          <Text style={themedStyles.statLabel}>P/E Ratio</Text>
          <Text style={themedStyles.statValue}>{peRatio != null && peRatio !== '' && Number.isFinite(Number(peRatio)) ? Number(peRatio).toFixed(2) : '---'}</Text>
        </View>
        <View style={themedStyles.statCell}>
          <Text style={themedStyles.statLabel}>52W High</Text>
          <Text style={themedStyles.statValue}>{high != null && Number.isFinite(high) && high !== 0 ? Number(high).toFixed(2) : 'N/A'}</Text>
        </View>
        <View style={themedStyles.statCell}>
          <Text style={themedStyles.statLabel}>52W Low</Text>
          <Text style={themedStyles.statValue}>{low != null && Number.isFinite(low) && low !== 0 ? Number(low).toFixed(2) : 'N/A'}</Text>
        </View>
        <View style={themedStyles.statCell}>
          <Text style={themedStyles.statLabel}>Yield</Text>
          <Text style={themedStyles.statValue}>{dividendYield != null && Number.isFinite(Number(dividendYield)) ? (Number(dividendYield) * 100).toFixed(2) + '%' : '---'}</Text>
        </View>
        <View style={themedStyles.statCell}>
          <Text style={themedStyles.statLabel}>Open</Text>
          <Text style={themedStyles.statValue}>{data[0] != null && Number.isFinite(data[0].open) ? Number(data[0].open).toFixed(2) : 'N/A'}</Text>
        </View>
        <View style={themedStyles.statCell}>
          <Text style={themedStyles.statLabel}>Close</Text>
          <Text style={themedStyles.statValue}>{data.length > 0 && data[data.length - 1] != null && Number.isFinite(data[data.length - 1].close) ? Number(data[data.length - 1].close).toFixed(2) : 'N/A'}</Text>
        </View>
      </View>

      <Text style={[themedStyles.sectionHeader, themedStyles.aboutSectionHeader]}>About {companyName}</Text>
      <View style={themedStyles.aboutCard}>
        <Text style={themedStyles.aboutBody} numberOfLines={aboutExpanded ? undefined : 4}>
          {loading ? 'Loading…' : (description || '---')}
        </Text>
        {(typeof description === 'string' && description.length > 120) && (
          <TouchableOpacity onPress={() => setAboutExpanded((e) => !e)} activeOpacity={0.8}>
            <Text style={themedStyles.readMore}>{aboutExpanded ? 'Read Less' : 'Read More'}</Text>
          </TouchableOpacity>
        )}
        <View style={themedStyles.pillRow}>
          {profile?.sector ? (
            <View style={themedStyles.pill}>
              <Text style={themedStyles.pillText}>{typeof profile.sector === 'string' ? profile.sector : (profile.sector as { en?: string })?.en}</Text>
            </View>
          ) : null}
          {profile?.industry ? (
            <View style={themedStyles.pill}>
              <Text style={themedStyles.pillText}>{typeof profile.industry === 'string' ? profile.industry : (profile.industry as { en?: string })?.en}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={[themedStyles.sectionHeader, themedStyles.executivesSectionHeader]}>Key Executives</Text>
      <View style={themedStyles.executivesCard}>
        {executives.length > 0
          ? executives.map((exec, index) => (
              <View key={index} style={[themedStyles.executiveRow, index === executives.length - 1 && themedStyles.executiveRowLast]}>
                <Text style={themedStyles.executiveName}>{exec.name}</Text>
                <Text style={themedStyles.executiveTitle}>{exec.title}</Text>
              </View>
            ))
          : (
              <Text style={[themedStyles.executivePlaceholder, { padding: 20 }]}>No executive data found.</Text>
            )}
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: typeof COLORS) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    errorTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 8 },
    errorText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
    content: { padding: PADDING, paddingBottom: 100 },
    chartSection: { marginBottom: 4 },
    chartControlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    timeframeRow: { flexDirection: 'row', gap: 4 },
    timeframeButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.card,
    },
    timeframeButtonActive: { backgroundColor: colors.electricBlue },
    timeframeLabel: { fontSize: 13, fontWeight: '600', color: colors.textTertiary },
    timeframeLabelActive: { color: colors.text },
    chartTypeToggle: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.card,
    },
    chartWrap: { marginVertical: 12, position: 'relative' },
    scrubLabel: {
      position: 'absolute',
      top: 0,
      left: PADDING,
      zIndex: 2,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    scrubPrice: { ...TYPO.price, fontSize: 18, color: colors.text },
    chartPlaceholder: {
      alignSelf: 'center',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      marginVertical: 12,
    },
    placeholderText: { fontSize: 13, color: colors.textTertiary },
    faheemCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginTop: 20,
    },
    faheemIcon: { marginBottom: 8 },
    faheemTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 8 },
    faheemTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
    verdictBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    verdictBullish: { backgroundColor: colors.neonMintDim },
    verdictBearish: { backgroundColor: colors.negativeDim },
    verdictText: { fontSize: 13, fontWeight: '600', color: colors.text },
    faheemSkeleton: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    faheemSkeletonText: { fontSize: 14, color: colors.textTertiary },
    faheemContent: { marginTop: 0 },
    faheemSummary: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
    sectionHeader: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      paddingBottom: 10,
      marginTop: 24,
    },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1 },
    statCell: {
      width: '49%',
      backgroundColor: colors.card,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 0,
    },
    statLabel: { fontSize: 13, color: colors.textTertiary },
    statValue: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 4, fontVariant: ['tabular-nums'] },
    aboutSectionHeader: { marginTop: 20 },
    aboutCard: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
      marginTop: 4,
    },
    aboutBody: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
    readMore: { fontSize: 15, color: colors.electricBlue, marginTop: 8, fontWeight: '500' },
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    pill: { backgroundColor: colors.separator, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    pillText: { fontSize: 13, color: colors.textTertiary },
    executivesSectionHeader: { marginTop: 24 },
    executivesCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      marginTop: 4,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    executiveRow: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    executiveRowLast: { borderBottomWidth: 0 },
    executiveName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    executiveTitle: {
      marginTop: 2,
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'left',
    },
    executivePlaceholder: { fontSize: 14, color: colors.textTertiary, paddingVertical: 12 },
  });
}