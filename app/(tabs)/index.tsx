import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useIsFocused } from '@react-navigation/native';
import Animated, { Layout } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { getUSMarketSnapshot, type USSnapshotItem } from '../../services/api';
import { COLORS } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import StockRow from '../../components/StockRow';
import { SkeletonLoader } from '../../src/components';
import { useOptionalStockPriceStore } from '../../src/store/StockPriceStore';

const WATCHLIST_POLL_INTERVAL_MS = 10000;
const WATCHLIST_FIRST_LOAD_RETRY_MS = 2500;
/** Pulse: when data is older than this, trigger background refresh without blocking UI. */
const STALE_THRESHOLD_MS = 60 * 1000;
/** Do not refetch snapshot if we got data within this window (respect backend 120s cache / rate limits). */
const SNAPSHOT_REFETCH_THROTTLE_MS = 120 * 1000;

/** Merge snapshot item with SSoT store when store has fresh data for this symbol. */
function mergeWithStore(
  item: USSnapshotItem,
  storeEntry: { lastPrice: string; percentChange: string; updatedAt: number } | undefined
): USSnapshotItem {
  if (!storeEntry) return item;
  const now = Date.now();
  if (now - storeEntry.updatedAt > STALE_THRESHOLD_MS) return item;
  return {
    ...item,
    lastPrice: storeEntry.lastPrice,
    percentChange: storeEntry.percentChange,
  };
}

export default function WatchlistScreen() {
  const { colors } = useTheme();
  const isFocused = useIsFocused();
  const store = useOptionalStockPriceStore();
  const [items, setItems] = useState<USSnapshotItem[]>([]);
  const [isPlaceholderData, setIsPlaceholderData] = useState(false);
  const [error502DataSource, setError502DataSource] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasDataRef = useRef(false);
  const initialLoadRetryRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  const [fromStaleCache, setFromStaleCache] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!store) return;
    const unsub = store.subscribe(() => tick((n) => n + 1));
    return () => unsub();
  }, [store]);

  const loadSnapshot = useCallback((silent = false) => {
    if (silent && hasDataRef.current && Date.now() - lastFetchTimeRef.current < SNAPSHOT_REFETCH_THROTTLE_MS) {
      return;
    }
    if (!silent) setError(null);
    if (!silent && !hasDataRef.current) setIsInitialLoading(true);

    getUSMarketSnapshot()
      .then((res) => {
        const list = res.marketSnapshot ?? [];
        const is502WithExistingData = res.error502 && hasDataRef.current;

        if (is502WithExistingData) {
          setError502DataSource(true);
          return;
        }

        if (list.length > 0) {
          hasDataRef.current = true;
          lastFetchTimeRef.current = Date.now();
          if (store) {
            list.forEach((item) => {
              store.set(item.symbol, {
                lastPrice: item.lastPrice ?? '—',
                percentChange: item.percentChange ?? '0.00',
                ...(item.lastClose != null ? { lastClose: item.lastClose } : {}),
              });
            });
          }
        }
        setItems(list);
        setIsPlaceholderData(Boolean(res.fromFallback));
        setError502DataSource(Boolean(res.fromFallback && res.error502));
        setFromStaleCache(Boolean(res.fromStaleCache));
      })
      .catch((e) => {
        const msg = e?.response?.status === 429
          ? 'Too many requests. Try again in a moment.'
          : e?.response?.status >= 500
            ? 'Server error. Try again.'
            : e?.message || 'Failed to load';
        setError(msg);
        if (e?.response?.status !== 502 || !hasDataRef.current) setItems([]);
      })
      .finally(() => {
        setIsInitialLoading(false);
      });
  }, [store]);

  useEffect(() => {
    loadSnapshot(false);
  }, [loadSnapshot]);

  // First-load retry: when first load finished with no data, retry once after a short delay
  useEffect(() => {
    if (isInitialLoading || hasDataRef.current || initialLoadRetryRef.current) return;
    const t = setTimeout(() => {
      if (hasDataRef.current) return;
      initialLoadRetryRef.current = true;
      loadSnapshot(false);
    }, WATCHLIST_FIRST_LOAD_RETRY_MS);
    return () => clearTimeout(t);
  }, [isInitialLoading, loadSnapshot]);

  useEffect(() => {
    if (!isFocused) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    loadSnapshot(true);
    pollRef.current = setInterval(() => loadSnapshot(true), WATCHLIST_POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isFocused, loadSnapshot]);

  /** Pulse: if any visible symbol has stale store data (>60s), trigger background refresh. */
  useEffect(() => {
    if (!isFocused || !store || items.length === 0) return;
    const anyStale = items.some((item) => store.isStale(item.symbol));
    if (!anyStale) return;
    const t = setTimeout(() => loadSnapshot(true), 2000);
    return () => clearTimeout(t);
  }, [isFocused, store, items, loadSnapshot]);

  const displayItems = store
    ? items.map((item) => mergeWithStore(item, store.get(item.symbol)))
    : items;

  const renderItem = useCallback(({ item }: { item: USSnapshotItem }) => (
    <Animated.View layout={Layout.springify()}>
      <StockRow item={item} />
    </Animated.View>
  ), []);

  const skeletonRow = () => (
    <View style={[styles.card, styles.skeletonCard, { backgroundColor: colors.card }]}>
      <View style={styles.row}>
        <View style={styles.symbolRow}>
          <SkeletonLoader width={64} height={18} style={[styles.skeletonSymbol, { backgroundColor: colors.separator }]} />
          <SkeletonLoader width={120} height={14} style={[styles.skeletonName, { backgroundColor: colors.separator }]} />
        </View>
        <View style={styles.priceCol}>
          <SkeletonLoader width={56} height={16} style={[styles.skeletonPrice, { backgroundColor: colors.separator, marginBottom: 6 }]} />
          <SkeletonLoader width={52} height={14} style={[styles.skeletonChip, { backgroundColor: colors.separator }]} />
        </View>
      </View>
    </View>
  );

  if (error && !isInitialLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="cloud-offline" size={48} color={colors.textTertiary} />
        <Text style={[styles.sub, { color: colors.textSecondary }]}>Market Data Unavailable</Text>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => loadSnapshot()} activeOpacity={0.8}>
          <Text style={[styles.retryText, { color: colors.text }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const streamConnecting = store?.connectionStatus === 'connecting';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Watchlist</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Tap a stock for the full dashboard</Text>
      {streamConnecting && (
        <View style={[styles.placeholderBanner, { backgroundColor: colors.card, borderColor: colors.separator }]}>
          <Ionicons name="sync-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.placeholderBannerText, { color: colors.textSecondary }]}>Connecting…</Text>
        </View>
      )}
      {fromStaleCache && !streamConnecting && (
        <View style={[styles.staleBanner, { backgroundColor: colors.card, borderColor: colors.separator }]}>
          <Ionicons name="time-outline" size={16} color={colors.textTertiary} />
          <Text style={[styles.staleBannerText, { color: colors.textTertiary }]}>Data may be slightly delayed</Text>
        </View>
      )}
      {error502DataSource && !isInitialLoading && items.length > 0 && !streamConnecting && (
        <View style={[styles.placeholderBanner, { backgroundColor: colors.card, borderColor: colors.separator }]}>
          <Ionicons name="warning-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.placeholderBannerText, { color: colors.textSecondary }]}>
            Data source temporarily unavailable (502). Your list is unchanged. Try again in a moment.
          </Text>
        </View>
      )}
      {isPlaceholderData && !isInitialLoading && items.length > 0 && !streamConnecting && !error502DataSource && (
        <View style={[styles.placeholderBanner, { backgroundColor: colors.card, borderColor: colors.separator }]}>
          <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.placeholderBannerText, { color: colors.textSecondary }]}>
            Backend returned no symbols. Ensure GET /api/stock/market-snapshot?symbols=AAPL,TSLA,... returns a non-empty marketSnapshot. If the backend is not running, set EXPO_PUBLIC_API_URL.
          </Text>
        </View>
      )}
      {isInitialLoading ? (
        <View style={styles.list}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i}>{skeletonRow()}</View>
          ))}
        </View>
      ) : (
        <FlatList
          data={displayItems}
          keyExtractor={(item) => item.symbol}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textSecondary }]}>No symbols in watchlist.</Text>
          }
        />
      )}
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  skeletonCard: { opacity: 0.7 },
  skeletonLine: { backgroundColor: COLORS.separator, borderRadius: 4 },
  skeletonSymbol: { width: 64, height: 18, marginBottom: 8 },
  skeletonName: { width: 120, height: 14 },
  skeletonPrice: { width: 56, height: 16, marginBottom: 6 },
  skeletonChip: { width: 52, height: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
  symbolRow: { flex: 1 },
  symbol: { fontSize: 17, fontWeight: '600', color: COLORS.text },
  name: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  priceCol: { alignItems: 'flex-end', marginRight: 8 },
  price: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 4 },
  chipGreen: { backgroundColor: COLORS.neonMintDim },
  chipRed: { backgroundColor: COLORS.negativeDim },
  change: { fontSize: 13, fontWeight: '600' },
  positive: { color: COLORS.positive },
  negative: { color: COLORS.negative },
  sub: { color: COLORS.textSecondary, marginTop: 12, textAlign: 'center' },
  hint: { color: COLORS.textTertiary, marginTop: 8, fontSize: 12, textAlign: 'center' },
  retryBtn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: COLORS.electricBlue, borderRadius: 10 },
  retryText: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  empty: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 24 },
  placeholderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  placeholderBannerText: { flex: 1, fontSize: 12 },
  staleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  staleBannerText: { fontSize: 12 },
});
