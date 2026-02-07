import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { StockLogo } from '../src/components';
import type { USSnapshotItem } from '../services/api';

export interface StockRowProps {
  item: USSnapshotItem;
}

function StockRowComponent({ item }: StockRowProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const change = parseFloat(item.percentChange);
  const isPositive = change >= 0;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({
          pathname: '/stock/[symbol]',
          params: { symbol: item.symbol, initialPrice: item.lastPrice, initialChange: item.percentChange },
        });
      }}
      activeOpacity={0.8}
    >
      <View style={styles.row}>
        <StockLogo symbol={item.symbol} size={40} style={styles.logo} />
        <View style={styles.symbolRow}>
          <Text style={[styles.symbol, { color: colors.text }]}>{item.symbol}</Text>
          <Text style={[styles.name, { color: colors.textSecondary }]} numberOfLines={1}>{item.name}</Text>
        </View>
        <View style={styles.priceCol}>
          <Text style={[styles.price, { color: colors.text }]}>{item.lastPrice}</Text>
          <View style={[styles.chip, isPositive ? { backgroundColor: colors.neonMintDim } : { backgroundColor: colors.negativeDim }]}>
            <Text style={[styles.change, isPositive ? styles.positive : styles.negative]}>
              {isPositive ? '+' : ''}{item.percentChange}%
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      </View>
    </TouchableOpacity>
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
  card: {
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
