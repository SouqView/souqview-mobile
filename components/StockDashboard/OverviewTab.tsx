import { View, Text, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { COLORS } from '../../constants/theme';

type Candle = { time: number; open: number; high: number; low: number; close: number; volume?: number };

export interface OverviewTabProps {
  symbol: string;
  detail: {
    statistics?: {
      currentPrice?: number | null;
      percent_change?: number | null;
      fiftyTwoWeekHigh?: number | null;
      fiftyTwoWeekLow?: number | null;
      volume?: string | null;
    };
    profile?: { name?: string };
  } | null;
  historical: { data?: Candle[] } | null;
  loading: boolean;
}

const CHART_HEIGHT = 180;
const PADDING = 16;

export function OverviewTab({ symbol, detail, historical, loading }: OverviewTabProps) {
  const stats = detail?.statistics;
  const price = stats?.currentPrice ?? 0;
  const change = stats?.percent_change ?? 0;
  const high = stats?.fiftyTwoWeekHigh ?? 0;
  const low = stats?.fiftyTwoWeekLow ?? 0;
  const vol = stats?.volume ?? '—';
  const data = historical?.data ?? [];
  const isPositive = change >= 0;

  const { width } = Dimensions.get('window');
  const chartWidth = width - PADDING * 2 - 32;
  const chartInnerHeight = CHART_HEIGHT - 20;

  let points = '';
  let minVal = Infinity;
  let maxVal = -Infinity;
  if (data.length > 1) {
    data.forEach((d) => {
      minVal = Math.min(minVal, d.low);
      maxVal = Math.max(maxVal, d.high);
    });
    if (maxVal <= minVal) maxVal = minVal + 1;
    const range = maxVal - minVal || 1;
    const step = chartWidth / Math.max(data.length - 1, 1);
    data.forEach((d, i) => {
      const x = PADDING + i * step;
      const y = CHART_HEIGHT - 10 - ((d.close - minVal) / range) * chartInnerHeight;
      points += `${x},${y} `;
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.priceRow}>
        <Text style={styles.symbol}>{symbol}</Text>
        <View style={styles.priceCol}>
          <Text style={styles.price}>{price ? price.toFixed(2) : '—'}</Text>
          <Text style={[styles.change, isPositive ? styles.positive : styles.negative]}>
            {price ? `${isPositive ? '+' : ''}${change.toFixed(2)}%` : '—'}
          </Text>
        </View>
      </View>

      {loading && !data.length ? (
        <View style={[styles.chartPlaceholder, { width: chartWidth, height: CHART_HEIGHT }]}>
          <ActivityIndicator color={COLORS.electricBlue} />
        </View>
      ) : data.length > 1 ? (
        <View style={styles.chartWrap}>
          <Svg width={width} height={CHART_HEIGHT}>
            <Polyline
              points={points.trim()}
              fill="none"
              stroke={isPositive ? COLORS.neonMint : COLORS.negative}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      ) : (
        <View style={[styles.chartPlaceholder, { width: chartWidth, height: CHART_HEIGHT }]}>
          <Text style={styles.placeholderText}>No chart data</Text>
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Open</Text>
          <Text style={styles.statValue}>{data.length ? data[0].open.toFixed(2) : '—'}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>High</Text>
          <Text style={styles.statValue}>{high ? high.toFixed(2) : '—'}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Low</Text>
          <Text style={styles.statValue}>{low ? low.toFixed(2) : '—'}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Vol</Text>
          <Text style={styles.statValue}>{vol}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 24 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  symbol: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  priceCol: { alignItems: 'flex-end' },
  price: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  change: { fontSize: 14, marginTop: 2 },
  positive: { color: COLORS.positive },
  negative: { color: COLORS.negative },
  chartWrap: { marginVertical: 8, alignItems: 'center' },
  chartPlaceholder: {
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginVertical: 8,
  },
  placeholderText: { color: COLORS.textTertiary, fontSize: 13 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 12, color: COLORS.textTertiary },
  statValue: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginTop: 4 },
});
