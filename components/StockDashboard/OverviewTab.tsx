import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  NativeSyntheticEvent,
  NativeTouchEvent,
  TouchableOpacity,
} from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { COLORS, TYPO } from '../../constants/theme';
import { getFaheemOverview } from '../../src/services/aiService';
import type { FaheemMode } from '../../src/services/aiService';

type Candle = { time: number; open: number; high: number; low: number; close: number; volume?: number };

export type StockProfileOverview = {
  name?: string;
  description?: string;
  sector?: string;
  industry?: string;
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
  pe?: string | number | null;
  yield?: string | number | null;
};

export interface OverviewTabProps {
  symbol: string;
  detail: {
    statistics?: StatsShape;
    quote?: Record<string, unknown>;
    profile?: StockProfileOverview;
  } | null;
  historical: { data?: Candle[] } | null;
  loading: boolean;
  faheemMode?: FaheemMode;
}

const CHART_HEIGHT = 200;
const PADDING = 20;

/** Map backend quote (snake_case) to statistics shape for display and Faheem. */
function quoteToStats(quote: Record<string, unknown> | undefined): StatsShape | undefined {
  if (!quote || typeof quote !== 'object') return undefined;
  const q = quote as Record<string, unknown>;
  return {
    currentPrice: (q.current_price ?? q.close ?? q.price) as number | undefined,
    percent_change: (q.percent_change ?? q.change_pct ?? q.change) as number | undefined,
    fiftyTwoWeekHigh: (q.fifty_two_week_high ?? q.high_52_week) as number | undefined,
    fiftyTwoWeekLow: (q.fifty_two_week_low ?? q.low_52_week) as number | undefined,
    volume: (q.volume ?? q.average_volume) as string | number | undefined,
    market_cap: (q.market_cap ?? q.market_capitalization) as string | number | undefined,
    pe: (q.pe ?? q.pe_ratio) as string | number | undefined,
    yield: (q.dividend_yield ?? q.yield) as string | number | undefined,
  };
}

export function OverviewTab({ symbol, detail, historical, loading, faheemMode = 'beginner' }: OverviewTabProps) {
  const { colors } = useTheme();
  const statsFromApi = detail?.statistics;
  const statsFromQuote = quoteToStats(detail?.quote as Record<string, unknown> | undefined);
  const stats = statsFromApi && (statsFromApi.currentPrice != null || statsFromApi.volume != null)
    ? statsFromApi
    : statsFromQuote ?? statsFromApi;
  const price = stats?.currentPrice ?? 0;
  const change = stats?.percent_change ?? 0;
  const high = stats?.fiftyTwoWeekHigh ?? 0;
  const low = stats?.fiftyTwoWeekLow ?? 0;
  const vol = stats?.volume ?? '—';
  const data = historical?.data ?? [];
  const isPositive = change >= 0;

  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [faheemRationale, setFaheemRationale] = useState<string | null>(null);
  const [faheemVerdict, setFaheemVerdict] = useState<string | null>(null);
  const [faheemLoading, setFaheemLoading] = useState(false);
  const { width } = Dimensions.get('window');
  const profile = detail?.profile;
  const companyName = (typeof profile?.name === 'string' ? profile.name : (profile?.name as { en?: string })?.en) ?? symbol;
  const description = (typeof profile?.description === 'string' ? profile.description : (profile?.description as { en?: string })?.en) ?? '';
  const executivesList = profile?.executives ?? profile?.officers ?? [];
  const executives = Array.isArray(executivesList) ? executivesList.slice(0, 5).map((e: { name?: string; title?: string }) => ({ name: e?.name ?? '—', title: e?.title ?? '—' })) : [];
  const chartWidth = width - PADDING * 2 - 24;
  const chartInnerHeight = CHART_HEIGHT - 24;

  const quoteForFaheem = stats ? { ...stats, symbol } : undefined;

  useEffect(() => {
    let cancelled = false;
    setFaheemLoading(true);
    getFaheemOverview(symbol, faheemMode, quoteForFaheem)
      .then((res) => {
        if (!cancelled) {
          setFaheemRationale(res.rationale ?? null);
          setFaheemVerdict(res.verdict ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFaheemRationale(null);
          setFaheemVerdict(null);
        }
      })
      .finally(() => {
        if (!cancelled) setFaheemLoading(false);
      });
    return () => { cancelled = true; };
  }, [symbol, faheemMode]);

  let points = '';
  let minVal = Infinity;
  let maxVal = -Infinity;
  if (data.length > 1) {
    data.forEach((d) => {
      minVal = Math.min(minVal, d.low);
      maxVal = Math.max(maxVal, d.high);
    });
    if (maxVal <= minVal) maxVal = minVal + 1;
  }
  const range = maxVal - minVal || 1;
  const step = data.length > 1 ? chartWidth / Math.max(data.length - 1, 1) : 0;
  data.forEach((d, i) => {
    const x = PADDING + i * step;
    const y = CHART_HEIGHT - 12 - ((d.close - minVal) / range) * chartInnerHeight;
    points += `${x},${y} `;
  });

  const scrubbedPoint = scrubIndex != null && data[scrubIndex] != null
    ? data[scrubIndex]
    : null;
  const scrubX = scrubIndex != null && data.length > 1
    ? PADDING + scrubIndex * step
    : null;
  const scrubY = scrubbedPoint != null
    ? CHART_HEIGHT - 12 - ((scrubbedPoint.close - minVal) / range) * chartInnerHeight
    : null;

  const onChartTouch = (evt: NativeSyntheticEvent<NativeTouchEvent>) => {
    const touch = evt.nativeEvent.touches[0];
    if (!touch || data.length < 2) return;
    const x = touch.pageX - PADDING;
    const i = Math.round((x / chartWidth) * (data.length - 1));
    const clamped = Math.max(0, Math.min(i, data.length - 1));
    setScrubIndex(clamped);
  };

  const formatStat = (v: string | number | null | undefined) => {
    if (v == null) return '—';
    if (typeof v === 'number') return v.toLocaleString();
    return String(v);
  };

  const themedStyles = makeStyles(colors);
  return (
    <ScrollView
      style={themedStyles.container}
      contentContainerStyle={themedStyles.content}
      showsVerticalScrollIndicator={false}
      onTouchEnd={() => setScrubIndex(null)}
      onTouchCancel={() => setScrubIndex(null)}
    >
      {loading && !data.length ? (
        <View style={[themedStyles.chartPlaceholder, { width: chartWidth, height: CHART_HEIGHT }]}>
          <ActivityIndicator color={colors.electricBlue} />
        </View>
      ) : data.length > 1 ? (
        <View
          style={themedStyles.chartWrap}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={onChartTouch}
          onResponderMove={onChartTouch}
        >
          {scrubbedPoint != null && (
            <View style={themedStyles.scrubLabel}>
              <Text style={themedStyles.scrubPrice} numberOfLines={1}>
                {scrubbedPoint.close.toFixed(2)}
              </Text>
            </View>
          )}
          <Svg width={width} height={CHART_HEIGHT}>
            <Polyline
              points={points.trim()}
              fill="none"
              stroke={isPositive ? colors.positive : colors.negative}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {scrubX != null && scrubY != null && (
              <Circle cx={scrubX} cy={scrubY} r={6} fill={colors.text} opacity={0.9} />
            )}
          </Svg>
        </View>
      ) : (
        <View style={[themedStyles.chartPlaceholder, { width: chartWidth, height: CHART_HEIGHT }]}>
          <Text style={themedStyles.placeholderText}>No chart data</Text>
        </View>
      )}

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
            <ActivityIndicator size="small" color={colors.electricBlue} />
            <Text style={themedStyles.faheemSkeletonText}>Faheem is thinking...</Text>
          </View>
        ) : faheemRationale ? (
          <Text style={themedStyles.faheemSummary}>{faheemRationale}</Text>
        ) : (
          <Text style={themedStyles.faheemSummary}>
            Open a stock to see Faheem&apos;s analysis. Ensure the backend /api/faheem/overview endpoint is enabled.
          </Text>
        )}
      </View>

      <Text style={themedStyles.sectionHeader}>Key Statistics</Text>
      <View style={themedStyles.statsGrid}>
        <View style={themedStyles.statCell}>
          <Text style={themedStyles.statLabel}>Market Cap</Text>
          <Text style={themedStyles.statValue}>{formatStat(stats?.market_cap)}</Text>
        </View>
        <View style={themedStyles.statCell}>
          <Text style={themedStyles.statLabel}>P/E Ratio</Text>
          <Text style={themedStyles.statValue}>{formatStat(stats?.pe)}</Text>
        </View>
        <View style={themedStyles.statCell}>
          <Text style={themedStyles.statLabel}>Yield</Text>
          <Text style={themedStyles.statValue}>{formatStat(stats?.yield)}</Text>
        </View>
        <View style={themedStyles.statCell}>
          <Text style={themedStyles.statLabel}>Volume</Text>
          <Text style={themedStyles.statValue}>{formatStat(vol)}</Text>
        </View>
        <View style={themedStyles.statCell}>
          <Text style={themedStyles.statLabel}>52W High</Text>
          <Text style={themedStyles.statValue}>{high ? high.toFixed(2) : '—'}</Text>
        </View>
        <View style={themedStyles.statCell}>
          <Text style={themedStyles.statLabel}>52W Low</Text>
          <Text style={themedStyles.statValue}>{low ? low.toFixed(2) : '—'}</Text>
        </View>
        <View style={themedStyles.statCell}>
          <Text style={themedStyles.statLabel}>Open</Text>
          <Text style={themedStyles.statValue}>{data[0] ? data[0].open.toFixed(2) : '—'}</Text>
        </View>
        <View style={themedStyles.statCell}>
          <Text style={themedStyles.statLabel}>Close</Text>
          <Text style={themedStyles.statValue}>{data.length ? data[data.length - 1].close.toFixed(2) : '—'}</Text>
        </View>
      </View>

      <Text style={[themedStyles.sectionHeader, themedStyles.aboutSectionHeader]}>About {companyName}</Text>
      <View style={themedStyles.aboutCard}>
        <Text style={themedStyles.aboutBody} numberOfLines={aboutExpanded ? undefined : 4}>
          {description || 'No description available.'}
        </Text>
        {description.length > 120 && (
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
        {executives.length > 0 ? (
          executives.map((exec, index) => (
            <View key={index} style={[themedStyles.executiveRow, index === executives.length - 1 && themedStyles.executiveRowLast]}>
              <Text style={themedStyles.executiveName}>{exec.name}</Text>
              <Text style={themedStyles.executiveTitle}>{exec.title}</Text>
            </View>
          ))
        ) : (
          <Text style={themedStyles.executivePlaceholder}>No executive data available.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: typeof COLORS) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: PADDING, paddingBottom: 100 },
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
    verdictBullish: { backgroundColor: 'rgba(52, 199, 89, 0.25)' },
    verdictBearish: { backgroundColor: 'rgba(255, 59, 48, 0.25)' },
    verdictText: { fontSize: 13, fontWeight: '600', color: colors.text },
    faheemSkeleton: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    faheemSkeletonText: { fontSize: 14, color: colors.textTertiary },
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
    executiveRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    executiveRowLast: { borderBottomWidth: 0 },
    executiveName: { fontSize: 16, fontWeight: 'bold', color: colors.text },
    executiveTitle: { fontSize: 13, color: colors.textTertiary },
    executivePlaceholder: { fontSize: 14, color: colors.textTertiary, paddingVertical: 12 },
  });
}
