import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { COLORS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function PortfolioScreen() {
  const { cashBalance, holdings, history, xp, level, resetDemo } = usePortfolio();

  const formatUsd = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Demo Portfolio</Text>
      <Text style={styles.subtitle}>Paper trading • US market • No real money</Text>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available balance</Text>
        <Text style={styles.balanceValue}>{formatUsd(cashBalance)}</Text>
      </View>

      <View style={styles.xpCard}>
        <Ionicons name="trophy" size={24} color={COLORS.neonMint} />
        <View style={styles.xpText}>
          <Text style={styles.xpValue}>{xp} XP</Text>
          <Text style={styles.xpLabel}>Level {level} • +50 XP per trade</Text>
        </View>
      </View>

      {holdings.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Positions</Text>
          {holdings.map((p) => (
            <View key={p.symbol} style={styles.positionRow}>
              <Text style={styles.posSymbol}>{p.symbol}</Text>
              <Text style={styles.posQty}>{p.quantity} @ {p.avgPrice.toFixed(2)}</Text>
              <Text style={styles.posValue}>
                {formatUsd(p.quantity * p.avgPrice)}
              </Text>
            </View>
          ))}
        </>
      )}

      {history.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recent trades</Text>
          {history.slice(0, 10).map((t, i) => (
            <View key={`${t.date}-${t.symbol}-${i}`} style={styles.txRow}>
              <View style={styles.txLeft}>
                <Text style={styles.txSymbol}>{t.symbol}</Text>
                <Text style={styles.txTime}>
                  {new Date(t.date).toLocaleDateString()} • +{50} XP
                </Text>
              </View>
              <Text style={[styles.txSide, t.type === 'BUY' ? styles.buy : styles.sell]}>
                {t.type}
              </Text>
              <Text style={styles.txQty}>{t.quantity} @ {t.price.toFixed(2)}</Text>
            </View>
          ))}
        </>
      )}

      <TouchableOpacity style={styles.resetBtn} onPress={resetDemo}>
        <Text style={styles.resetBtnText}>Reset demo account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, marginBottom: 24 },
  balanceCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  balanceLabel: { fontSize: 13, color: COLORS.textSecondary },
  balanceValue: { fontSize: 24, fontWeight: '700', color: COLORS.neonMint, marginTop: 4 },
  xpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  xpText: { marginLeft: 12 },
  xpValue: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  xpLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: COLORS.text, marginBottom: 12 },
  positionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  posSymbol: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  posQty: { fontSize: 13, color: COLORS.textSecondary },
  posValue: { fontSize: 14, color: COLORS.neonMint, fontWeight: '600' },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 4,
  },
  txLeft: { flex: 1 },
  txSymbol: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  txTime: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2 },
  txSide: { fontSize: 12, fontWeight: '700', marginRight: 12 },
  buy: { color: COLORS.positive },
  sell: { color: COLORS.negative },
  txQty: { fontSize: 13, color: COLORS.textSecondary },
  resetBtn: {
    marginTop: 32,
    padding: 16,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.negative,
  },
  resetBtnText: { color: COLORS.negative, fontWeight: '600' },
});
