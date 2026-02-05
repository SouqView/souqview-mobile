import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { getUSMarketSnapshot } from '../../services/api';
import { COLORS } from '../../constants/theme';

type SnapshotItem = {
  symbol: string;
  name: string;
  image?: string;
  lastPrice: string;
  percentChange: string;
  summary?: { en: string; ar: string };
};

export default function WatchlistScreen() {
  const router = useRouter();
  const [items, setItems] = useState<SnapshotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUSMarketSnapshot()
      .then((res: { marketSnapshot?: SnapshotItem[] }) => {
        if (!cancelled && res?.marketSnapshot) setItems(res.marketSnapshot);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || 'Failed to load');
        setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const renderItem = ({ item }: { item: SnapshotItem }) => {
    const change = parseFloat(item.percentChange);
    const isPositive = change >= 0;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({ pathname: '/stock/[symbol]', params: { symbol: item.symbol } })}
        activeOpacity={0.8}
      >
        <View style={styles.row}>
          <View style={styles.symbolRow}>
            <Text style={styles.symbol}>{item.symbol}</Text>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          </View>
          <View style={styles.priceCol}>
            <Text style={styles.price}>{item.lastPrice}</Text>
            <Text style={[styles.change, isPositive ? styles.positive : styles.negative]}>
              {isPositive ? '+' : ''}{item.percentChange}%
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.electricBlue} />
        <Text style={styles.sub}>Loading watchlist…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="cloud-offline" size={48} color={COLORS.textTertiary} />
        <Text style={styles.sub}>{error}</Text>
        <Text style={styles.hint}>Ensure backend is running and EXPO_PUBLIC_API_URL is set.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Watchlist</Text>
      <Text style={styles.subtitle}>Tap a stock for the full dashboard</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.symbol}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No symbols in watchlist.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: { fontSize: 34, fontWeight: '700', color: COLORS.text, paddingHorizontal: 20, paddingTop: 16, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, paddingHorizontal: 20, paddingBottom: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  symbolRow: { flex: 1 },
  symbol: { fontSize: 17, fontWeight: '600', color: COLORS.text },
  name: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  priceCol: { alignItems: 'flex-end', marginRight: 8 },
  price: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  change: { fontSize: 13, marginTop: 2 },
  positive: { color: COLORS.positive },
  negative: { color: COLORS.negative },
  sub: { color: COLORS.textSecondary, marginTop: 12, textAlign: 'center' },
  hint: { color: COLORS.textTertiary, marginTop: 8, fontSize: 12, textAlign: 'center' },
  empty: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 24 },
});
