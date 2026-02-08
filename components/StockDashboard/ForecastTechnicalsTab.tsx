import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS } from '../../constants/theme';

type Indicator = { name?: string; value?: string; status?: string; color?: string };

export interface ForecastTechnicalsTabProps {
  symbol: string;
  sentiment: { bullish?: number; bearish?: number; total?: number } | null;
  technicals: { indicators?: Indicator[] } | null;
  loading: boolean;
}

export function ForecastTechnicalsTab({ symbol, sentiment, technicals, loading }: ForecastTechnicalsTabProps) {
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.electricBlue} />
        <Text style={styles.sub}>Loading forecast & technicals…</Text>
      </View>
    );
  }

  const data = (sentiment as { data?: { bullishPercent?: number; bearishPercent?: number; totalVotes?: number } })?.data;
  const bull = data?.bullishPercent ?? sentiment?.bullish ?? 0;
  const bear = data?.bearishPercent ?? sentiment?.bearish ?? 0;
  const total = (data?.totalVotes ?? sentiment?.total ?? bull + bear) || 1;
  const buyPct = total > 0 ? Math.round((bull / total) * 100) : 50;
  const indicators = (technicals as { data?: Indicator[] })?.data ?? technicals?.indicators ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Buy / Sell sentiment</Text>
        <View style={styles.gaugeRow}>
          <View style={styles.gaugeWrap}>
            <View style={[styles.gaugeBar, styles.gaugeBg]}>
              <View style={[styles.gaugeFill, styles.buyFill, { width: `${buyPct}%` }]} />
            </View>
            <View style={styles.gaugeLabels}>
              <Text style={[styles.gaugeLabel, styles.buyText]}>Buy {buyPct}%</Text>
              <Text style={[styles.gaugeLabel, styles.sellText]}>Sell {100 - buyPct}%</Text>
            </View>
          </View>
        </View>
        <Text style={styles.hint}>Community sentiment (placeholder for analyst targets)</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Technical indicators</Text>
        {indicators.length === 0 ? (
          <Text style={styles.empty}>No technical data for {symbol}.</Text>
        ) : (
          indicators.slice(0, 12).map((ind, i) => (
            <View key={i} style={styles.indRow}>
              <Text style={styles.indName}>{ind.name ?? '—'}</Text>
              <Text style={[styles.indValue, ind.status === 'bullish' && styles.bullish, ind.status === 'bearish' && styles.bearish]}>
                {ind.value ?? '—'}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 100 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  sub: { color: COLORS.textSecondary, marginTop: 12 },
  block: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  blockTitle: { fontSize: 17, fontWeight: '600', color: COLORS.electricBlue, marginBottom: 12 },
  gaugeRow: { marginBottom: 8 },
  gaugeWrap: { height: 24, justifyContent: 'center' },
  gaugeBar: { height: 10, borderRadius: 5, overflow: 'hidden', flexDirection: 'row' },
  gaugeBg: { backgroundColor: COLORS.negative + '40' },
  gaugeFill: { height: '100%', borderRadius: 5, backgroundColor: COLORS.positive },
  gaugeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  gaugeLabel: { fontSize: 12 },
  buyText: { color: COLORS.positive },
  sellText: { color: COLORS.negative },
  hint: { fontSize: 11, color: COLORS.textTertiary, marginTop: 8 },
  empty: { color: COLORS.textSecondary, fontSize: 14 },
  indRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  indName: { fontSize: 14, color: COLORS.textSecondary },
  indValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  bullish: { color: COLORS.positive },
  bearish: { color: COLORS.negative },
});
