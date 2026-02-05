import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS } from '../../constants/theme';

type CardItem = { title?: { en?: string }; value?: string | number };

export interface FinancialsTabProps {
  symbol: string;
  financials: {
    incomeStatement?: { cards?: CardItem[] };
    balanceSheet?: { cards?: CardItem[] };
    cashFlow?: { cards?: CardItem[] };
  } | null;
  loading: boolean;
}

function CardBlock({ title, cards }: { title: string; cards: CardItem[] }) {
  if (!cards?.length) return null;
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      {cards.slice(0, 8).map((c, i) => (
        <View key={i} style={styles.cardRow}>
          <Text style={styles.cardLabel}>{c.title?.en ?? '—'}</Text>
          <Text style={styles.cardValue}>{c.value ?? '—'}</Text>
        </View>
      ))}
    </View>
  );
}

export function FinancialsTab({ symbol, financials, loading }: FinancialsTabProps) {
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.electricBlue} />
        <Text style={styles.sub}>Loading financials…</Text>
      </View>
    );
  }

  const inc = financials?.incomeStatement?.cards ?? [];
  const bal = financials?.balanceSheet?.cards ?? [];
  const cash = financials?.cashFlow?.cards ?? [];

  if (!inc.length && !bal.length && !cash.length) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>No financial data for {symbol}.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <CardBlock title="Income Statement" cards={inc} />
      <CardBlock title="Balance Sheet" cards={bal} />
      <CardBlock title="Cash Flow" cards={cash} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 100 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  sub: { color: COLORS.textSecondary, marginTop: 12 },
  empty: { color: COLORS.textSecondary, textAlign: 'center' },
  block: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  blockTitle: { fontSize: 17, fontWeight: '600', color: COLORS.electricBlue, marginBottom: 12 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  cardLabel: { fontSize: 14, color: COLORS.textSecondary, flex: 1 },
  cardValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
});
