import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { StockLogo } from '../src/components';
import { useOptionalStockPriceStore } from '../src/store/StockPriceStore';
import type { USSnapshotItem } from '../services/api';

export interface StockRowProps {
  item: USSnapshotItem;
}

const GLOW_DURATION_MS = 600;

function StockRowComponent({ item }: StockRowProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const store = useOptionalStockPriceStore();

  const lastPriceRaw = item.lastPrice != null && item.lastPrice !== '' ? String(item.lastPrice) : '—';
  const lastPrice = lastPriceRaw === '—' || lastPriceRaw === '' || lastPriceRaw == null ? 'Loading...' : lastPriceRaw;
  const percentChange = item.percentChange != null && item.percentChange !== '' ? String(item.percentChange) : '0.00';
  const change = parseFloat(percentChange);
  const isPositive = change >= 0;
  const name = item.name != null && item.name !== '' ? String(item.name) : item.symbol;

  const storeEntry = store?.get(item.symbol);
  const lastClose = storeEntry?.lastClose;
  const lastCloseStr = lastClose != null && Number.isFinite(lastClose) ? String(lastClose) : undefined;

  const glowAnim = useRef(new Animated.Value(0)).current;
  const prevPriceRef = useRef(lastPriceRaw);
  const prevChangeRef = useRef(percentChange);

  useEffect(() => {
    const priceChanged = prevPriceRef.current !== lastPriceRaw;
    const changeChanged = prevChangeRef.current !== percentChange;
    prevPriceRef.current = lastPriceRaw;
    prevChangeRef.current = percentChange;
    if (!priceChanged && !changeChanged) return;
    glowAnim.setValue(0);
    Animated.timing(glowAnim, {
      toValue: 1,
      duration: GLOW_DURATION_MS,
      useNativeDriver: true,
    }).start(() => glowAnim.setValue(0));
  }, [lastPriceRaw, percentChange, glowAnim]);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.12, 0],
  });

  const handlePress = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const lastPriceStr = lastPrice === 'Loading...' ? '—' : lastPrice;
    const params: Record<string, string> = {
      symbol: item.symbol,
      name: name || item.symbol,
      initialPrice: lastPriceStr,
      initialChange: percentChange,
    };
    if (lastCloseStr) params.lastClose = lastCloseStr;
    router.push({ pathname: '/stock/[symbol]', params });
  };

  return (
    <View style={styles.cardWrap}>
      <Animated.View
        style={[
          styles.glowLayer,
          {
            backgroundColor: isPositive ? colors.neonMint : colors.negative,
            opacity: glowOpacity,
          },
        ]}
        pointerEvents="none"
      />
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card }]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <View style={styles.row}>
          <StockLogo symbol={item.symbol} size={40} style={styles.logo} />
          <View style={styles.symbolRow}>
            <Text style={[styles.symbol, { color: colors.text }]}>{item.symbol}</Text>
            <Text style={[styles.name, { color: colors.textSecondary }]} numberOfLines={1}>{name}</Text>
          </View>
          <View style={styles.priceCol}>
            <Text style={[styles.price, { color: colors.text }]}>{lastPrice}</Text>
            <View style={[styles.chip, isPositive ? { backgroundColor: colors.neonMintDim } : { backgroundColor: colors.negativeDim }]}>
              <Text style={[styles.change, isPositive ? styles.positive : styles.negative]}>
                {isPositive ? '+' : ''}{percentChange}%
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default React.memo(StockRowComponent, (prev, next) => {
  return (
    prev.item.symbol === next.item.symbol &&
    prev.item.lastPrice === next.item.lastPrice &&
    prev.item.percentChange === next.item.percentChange
  );
});

const styles = StyleSheet.create({
  cardWrap: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  glowLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  logo: { marginRight: 12 },
  symbolRow: { flex: 1 },
  symbol: { fontSize: 17, fontWeight: '600' },
  name: { fontSize: 13, marginTop: 2 },
  priceCol: { alignItems: 'flex-end', marginRight: 8 },
  price: { fontSize: 16, fontWeight: '600' },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 4 },
  change: { fontSize: 13, fontWeight: '600' },
  positive: { color: COLORS.positive },
  negative: { color: COLORS.negative },
});
