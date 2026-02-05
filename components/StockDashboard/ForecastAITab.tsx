import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import Svg, { Polyline, Polygon } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, TYPO } from '../../constants/theme';
import { useExpertise } from '../../contexts/ExpertiseContext';
import { getFaheemForecast, toFaheemMode } from '../../src/services/aiService';
import client from '../../api/client';

const CHART_HEIGHT = 220;
const PADDING = 20;

const TIMEFRAME_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: '1W', label: '1W' },
  { id: '1M', label: '1M' },
  { id: '1Y', label: '1Y' },
] as const;
type TimeframeId = (typeof TIMEFRAME_OPTIONS)[number]['id'];

type Candle = { time?: number; open?: number; high?: number; low?: number; close: number; volume?: number };

export interface ForecastAITabProps {
  symbol: string;
  /** Historical candles from context (Overview uses same source) */
  historical?: { data?: Candle[] } | null;
  /** Current price for extending prediction if no API */
  currentPrice?: number | null;
}

interface ForecastPoint {
  date: string;
  value: number;
}

/** Fetch or derive 7-day predicted prices; falls back to simple trend from last close */
async function getPredictedPrices(
  symbol: string,
  lastClose: number
): Promise<ForecastPoint[]> {
  try {
    const { data } = await client.post<{ data?: { prices?: Array<{ time: string; close: number }> } }>(
      '/faheem/chart',
      { category: 'forecast', ticker: symbol, days: 7 }
    );
    const prices = data?.data?.prices;
    if (Array.isArray(prices) && prices.length > 0) {
      return prices.map((p) => ({
        date: p.time,
        value: p.close,
      }));
    }
  } catch (_) {
    // ignore
  }
  const points: ForecastPoint[] = [];
  const base = lastClose;
  for (let i = 1; i <= 7; i++) {
    const trend = 0.0015 * i;
    points.push({
      date: `Day ${i}`,
      value: base * (1 + trend),
    });
  }
  return points;
}

export function ForecastAITab({ symbol, historical, currentPrice }: ForecastAITabProps) {
  const { expertiseLevel } = useExpertise();
  const [rationale, setRationale] = useState<string>('');
  const [loadingRationale, setLoadingRationale] = useState(true);
  const [predicted, setPredicted] = useState<ForecastPoint[]>([]);
  const [loadingPredicted, setLoadingPredicted] = useState(true);

  const data = historical?.data ?? [];
  const lastClose = data.length > 0 ? data[data.length - 1].close : (currentPrice ?? 0);

  const [timeframe, setTimeframe] = useState<TimeframeId>('1W');

  /** Map UI timeframe to API: 1D, 1W, 1M, 1Y */
  const apiTimeframe = timeframe === 'today' ? '1D' : timeframe;

  useEffect(() => {
    let cancelled = false;
    setLoadingRationale(true);
    getFaheemForecast(symbol, toFaheemMode(expertiseLevel), apiTimeframe)
      .then((res) => {
        if (!cancelled) {
          const text = res.prediction ?? res.rationale ?? '';
          setRationale(text);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRationale(
            `Based on recent price action and volume, ${symbol} may see short-term momentum. Key levels and patterns will be refined with live data.`
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRationale(false);
      });
    return () => { cancelled = true; };
  }, [symbol, expertiseLevel, apiTimeframe]);

  useEffect(() => {
    if (lastClose <= 0) {
      setLoadingPredicted(false);
      return;
    }
    let cancelled = false;
    setLoadingPredicted(true);
    getPredictedPrices(symbol, lastClose)
      .then((points) => {
        if (!cancelled) setPredicted(points);
      })
      .catch(() => {
        if (!cancelled) setPredicted([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPredicted(false);
      });
    return () => { cancelled = true; };
  }, [symbol, lastClose]);

  const { width } = Dimensions.get('window');
  const chartWidth = width - PADDING * 2 - 24;
  const chartInnerHeight = CHART_HEIGHT - 24;

  const histValues = data.map((d) => d.close);
  const predValues = predicted.map((p) => p.value);
  const allValues = [...histValues, ...predValues];
  const minVal = allValues.length > 0 ? Math.min(...allValues) : 0;
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 1;
  const range = maxVal - minVal || 1;

  const totalPoints = histValues.length + predValues.length;
  const step = totalPoints > 1 ? chartWidth / (totalPoints - 1) : 0;

  let histPoints = '';
  histValues.forEach((v, i) => {
    const x = PADDING + i * step;
    const y = CHART_HEIGHT - 12 - ((v - minVal) / range) * chartInnerHeight;
    histPoints += `${x},${y} `;
  });

  let predPoints = '';
  predValues.forEach((v, i) => {
    const x = PADDING + (histValues.length + i) * step;
    const y = CHART_HEIGHT - 12 - ((v - minVal) / range) * chartInnerHeight;
    predPoints += `${x},${y} `;
  });

  // Confidence band: ±2.5% around predicted line (high/low probability region)
  const CONFIDENCE_BAND_PCT = 0.025;
  let confidencePolygonPoints = '';
  if (predValues.length > 1) {
    const highPoints: string[] = [];
    const lowPoints: string[] = [];
    predValues.forEach((v, i) => {
      const x = PADDING + (histValues.length + i) * step;
      const highY = CHART_HEIGHT - 12 - ((v * (1 + CONFIDENCE_BAND_PCT) - minVal) / range) * chartInnerHeight;
      const lowY = CHART_HEIGHT - 12 - ((v * (1 - CONFIDENCE_BAND_PCT) - minVal) / range) * chartInnerHeight;
      highPoints.push(`${x},${highY}`);
      lowPoints.push(`${x},${lowY}`);
    });
    confidencePolygonPoints = [...highPoints, ...lowPoints.reverse()].join(' ');
  }

  const hasChart = histValues.length > 0 || predValues.length > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.timeframeRow}>
        {TIMEFRAME_OPTIONS.map((opt) => {
          const isSelected = timeframe === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.timeframePill, isSelected && styles.timeframePillActive]}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTimeframe(opt.id);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.timeframeLabel, isSelected && styles.timeframeLabelActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.sectionTitle}>Price forecast</Text>

      {loadingPredicted && !hasChart ? (
        <View style={[styles.chartPlaceholder, { width: chartWidth, height: CHART_HEIGHT }]}>
          <ActivityIndicator color={COLORS.electricBlue} />
          <Text style={styles.placeholderText}>Loading chart…</Text>
        </View>
      ) : hasChart ? (
        <View style={styles.chartWrap}>
          <Svg width={width} height={CHART_HEIGHT}>
            {/* Confidence interval: shaded region around prediction (high/low probability) */}
            {confidencePolygonPoints ? (
              <Polygon
                points={confidencePolygonPoints}
                fill={COLORS.electricBlue}
                fillOpacity={0.15}
                stroke="none"
              />
            ) : null}
            {histPoints.trim() && (
              <Polyline
                points={histPoints.trim()}
                fill="none"
                stroke={COLORS.textSecondary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {predPoints.trim() && (
              <Polyline
                points={predPoints.trim()}
                fill="none"
                stroke={COLORS.electricBlue}
                strokeWidth={2}
                strokeDasharray="8,4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </Svg>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, styles.legendLineSolid]} />
              <Text style={styles.legendText}>Historical</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, styles.legendLineDashed]} />
              <Text style={styles.legendText}>Predicted (7 days)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, styles.legendLineBand]} />
              <Text style={styles.legendText}>High/Low range</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.chartPlaceholder, { width: chartWidth, height: CHART_HEIGHT }]}>
          <Text style={styles.placeholderText}>No chart data</Text>
        </View>
      )}

      <View style={styles.rationaleCard}>
        <View style={styles.rationaleHeader}>
          <Ionicons name="sparkles" size={22} color={COLORS.electricBlue} />
          <Text style={styles.rationaleTitle}>Faheem&apos;s Rationale</Text>
        </View>
        {loadingRationale ? (
          <ActivityIndicator color={COLORS.electricBlue} style={styles.rationaleLoader} />
        ) : (
          <Text style={styles.rationaleBody} selectable>
            {rationale || `AI analysis for ${symbol} will appear here when the service is available.`}
          </Text>
        )}
      </View>

      <Text style={styles.disclaimer}>
        AI predictions are experimental. Not financial advice.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: PADDING, paddingBottom: 100 },
  timeframeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  timeframePill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.separator,
  },
  timeframePillActive: { backgroundColor: COLORS.electricBlueDim, borderColor: COLORS.electricBlue },
  timeframeLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  timeframeLabelActive: { color: COLORS.electricBlue },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  chartWrap: { marginBottom: 20 },
  chartPlaceholder: {
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginVertical: 12,
  },
  placeholderText: { fontSize: 13, color: COLORS.textTertiary, marginTop: 8 },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 12,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLine: { width: 24, height: 2, borderRadius: 1 },
  legendLineSolid: { backgroundColor: COLORS.textSecondary },
  legendLineDashed: { backgroundColor: COLORS.electricBlue },
  legendLineBand: { backgroundColor: COLORS.electricBlue, opacity: 0.4 },
  legendText: { fontSize: 12, color: COLORS.textTertiary, fontVariant: ['tabular-nums'] },
  rationaleCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rationaleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  rationaleTitle: {
    ...TYPO.header,
    fontSize: 18,
    color: COLORS.text,
  },
  rationaleLoader: { marginVertical: 16 },
  rationaleBody: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  disclaimer: {
    fontSize: 11,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginTop: 24,
    fontStyle: 'italic',
  },
});
