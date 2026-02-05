import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS } from '../../constants/theme';

type Indicator = { name?: string; value?: string; status?: string };

export interface TechnicalsTabProps {
  symbol: string;
  technicals: { data?: Indicator[]; indicators?: Indicator[] } | null;
  loading: boolean;
}

export function TechnicalsTab({ symbol, technicals, loading }: TechnicalsTabProps) {
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.electricBlue} />
        <Text style={styles.sub}>Loading RSI, MACD, MAs…</Text>
      </View>
    );
  }

  const indicators = technicals?.data ?? technicals?.indicators ?? [];
  const rsi = indicators.find((i) => /rsi/i.test(i.name ?? ''));
  const macd = indicators.find((i) => /macd/i.test(i.name ?? ''));
  const ma50 = indicators.find((i) => /ma.*50|50.*ma/i.test(i.name ?? ''));
  const ma200 = indicators.find((i) => /ma.*200|200.*ma/i.test(i.name ?? ''));

  const rsiVal = rsi?.value ? parseFloat(rsi.value) : null;
  const signal =
    rsiVal == null ? '—' : rsiVal < 30 ? 'Buy (oversold)' : rsiVal > 70 ? 'Sell (overbought)' : 'Neutral';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Signal</Text>
        <Text style={[styles.signalText, rsiVal != null && rsiVal < 30 && styles.buy, rsiVal != null && rsiVal > 70 && styles.sell]}>
          {signal}
        </Text>
        <Text style={styles.hint}>Based on RSI and technical indicators</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Indicators</Text>
        {[
          { label: 'RSI', ind: rsi },
          { label: 'MACD', ind: macd },
          { label: 'MA 50', ind: ma50 },
          { label: 'MA 200', ind: ma200 },
        ].map(({ label, ind }) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={[styles.value, ind?.status === 'bullish' && styles.bullish, ind?.status === 'bearish' && styles.bearish]}>
              {ind?.value ?? '—'}
            </Text>
          </View>
        ))}
      </View>

      {indicators.length > 4 && (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>All technicals</Text>
          {indicators.slice(0, 12).map((ind, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.label}>{ind.name ?? '—'}</Text>
              <Text style={[styles.value, ind.status === 'bullish' && styles.bullish, ind.status === 'bearish' && styles.bearish]}>
                {ind.value ?? '—'}
              </Text>
            </View>
          ))}
        </View>
      )}
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
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  blockTitle: { fontSize: 17, fontWeight: '600', color: COLORS.text, marginBottom: 12 },
  signalText: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  buy: { color: COLORS.positive },
  sell: { color: COLORS.negative },
  hint: { fontSize: 12, color: COLORS.textTertiary, marginTop: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  label: { fontSize: 14, color: COLORS.textSecondary },
  value: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  bullish: { color: COLORS.positive },
  bearish: { color: COLORS.negative },
});
