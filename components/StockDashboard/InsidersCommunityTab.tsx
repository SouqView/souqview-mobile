import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS } from '../../constants/theme';

type InsiderTx = {
  name?: string;
  insiderName?: string;
  position?: string;
  role?: string;
  action?: string;
  shares?: number;
  value?: string;
  date?: string;
};

export interface InsidersCommunityTabProps {
  symbol: string;
  insiders: { insiderTransactions?: InsiderTx[] } | null;
  loading: boolean;
}

export function InsidersCommunityTab({ symbol, insiders, loading }: InsidersCommunityTabProps) {
  const list = insiders?.insiderTransactions ?? [];

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.electricBlue} />
        <Text style={styles.sub}>Loading insiders…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Insider transactions</Text>
        {list.length === 0 ? (
          <Text style={styles.empty}>No recent insider data for {symbol}.</Text>
        ) : (
          list.slice(0, 15).map((tx, i) => (
            <View key={i} style={styles.txRow}>
              <View style={styles.txLeft}>
                <Text style={styles.txName}>{tx.name ?? tx.insiderName ?? '—'}</Text>
                <Text style={styles.txMeta}>{tx.position ?? tx.role ?? ''} • {tx.date ?? ''}</Text>
              </View>
              <View style={styles.txRight}>
                <Text style={[styles.txAction, tx.action === 'Buy' ? styles.buy : styles.sell]}>
                  {tx.action ?? '—'}
                </Text>
                <Text style={styles.txShares}>{tx.shares ?? '—'} shares</Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Community</Text>
        <Text style={styles.placeholder}>
          User sentiment and comments will appear here. Connect to your community API when ready.
        </Text>
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
  empty: { color: COLORS.textSecondary, fontSize: 14 },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  txLeft: { flex: 1 },
  txName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  txMeta: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2 },
  txRight: { alignItems: 'flex-end' },
  txAction: { fontSize: 14, fontWeight: '700' },
  buy: { color: COLORS.positive },
  sell: { color: COLORS.negative },
  txShares: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  placeholder: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
});
