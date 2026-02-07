import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { useTheme } from '../../contexts/ThemeContext';
import { COLORS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function PortfolioScreen() {
  const { colors } = useTheme();
  const { cashBalance, holdings, history, xp, level, resetDemo } = usePortfolio();

  const formatUsd = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Demo Portfolio</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Paper trading • US market • No real money</Text>

      <View style={[styles.balanceCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>Available balance</Text>
        <Text style={[styles.balanceValue, { color: colors.neonMint }]}>{formatUsd(cashBalance)}</Text>
      </View>

      <View style={[styles.xpCard, { backgroundColor: colors.card }]}>
        <Ionicons name="trophy" size={24} color={colors.neonMint} />
        <View style={styles.xpText}>
          <Text style={[styles.xpValue, { color: colors.text }]}>{xp} XP</Text>
          <Text style={[styles.xpLabel, { color: colors.textSecondary }]}>Level {level} • +50 XP per trade</Text>
        </View>
      </View>

      {holdings.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Positions</Text>
          {holdings.map((p) => (
            <View key={p.symbol} style={[styles.positionRow, { backgroundColor: colors.card }]}>
              <Text style={[styles.posSymbol, { color: colors.text }]}>{p.symbol}</Text>
              <Text style={[styles.posQty, { color: colors.textSecondary }]}>{p.quantity} @ {p.avgPrice.toFixed(2)}</Text>
              <Text style={[styles.posValue, { color: colors.neonMint }]}>
                {formatUsd(p.quantity * p.avgPrice)}
              </Text>
            </View>
          ))}
        </>
      )}

      {history.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent trades</Text>
          {history.slice(0, 10).map((t, i) => (
            <View key={`${t.date}-${t.symbol}-${i}`} style={styles.txRow}>
              <View style={styles.txLeft}>
                <Text style={[styles.txSymbol, { color: colors.text }]}>{t.symbol}</Text>
                <Text style={[styles.txTime, { color: colors.textTertiary }]}>
                  {new Date(t.date).toLocaleDateString()} • +{50} XP
                </Text>
              </View>
              <Text style={[styles.txSide, t.type === 'BUY' ? styles.buy : styles.sell]}>
                {t.type}
              </Text>
              <Text style={[styles.txQty, { color: colors.textSecondary }]}>{t.quantity} @ {t.price.toFixed(2)}</Text>
            </View>
          ))}
        </>
      )}

      <TouchableOpacity style={[styles.resetBtn, { borderColor: colors.negative }]} onPress={resetDemo}>
        <Text style={[styles.resetBtnText, { color: colors.negative }]}>Reset demo account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 4, marginBottom: 24 },
  balanceCard: {
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
  balanceLabel: { fontSize: 13 },
  balanceValue: { fontSize: 24, fontWeight: '700', marginTop: 4 },
  xpCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
  xpValue: { fontSize: 18, fontWeight: '700' },
  xpLabel: { fontSize: 12, marginTop: 2 },
  sectionTitle: { fontSize: 17, fontWeight: '600', marginBottom: 12 },
  positionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  posSymbol: { fontSize: 16, fontWeight: '600' },
  posQty: { fontSize: 13 },
  posValue: { fontSize: 14, fontWeight: '600' },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 4,
  },
  txLeft: { flex: 1 },
  txSymbol: { fontSize: 15, fontWeight: '600' },
  txTime: { fontSize: 12, marginTop: 2 },
  txSide: { fontSize: 12, fontWeight: '700', marginRight: 12 },
  buy: { color: COLORS.positive },
  sell: { color: COLORS.negative },
  txQty: { fontSize: 13 },
  resetBtn: {
    marginTop: 32,
    padding: 16,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  resetBtnText: { fontWeight: '600' },
});
