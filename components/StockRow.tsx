import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import type { USSnapshotItem } from '../services/api';

export interface StockRowProps {
  item: USSnapshotItem;
}

function StockRowComponent({ item }: StockRowProps) {
  const router = useRouter();
  const change = parseFloat(item.percentChange);
  const isPositive = change >= 0;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: '/stock/[symbol]', params: { symbol: item.symbol } });
      }}
      activeOpacity={0.8}
    >
      <View style={styles.row}>
        <View style={styles.symbolRow}>
          <Text style={styles.symbol}>{item.symbol}</Text>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        </View>
        <View style={styles.priceCol}>
          <Text style={styles.price}>{item.lastPrice}</Text>
          <View style={[styles.chip, isPositive ? styles.chipGreen : styles.chipRed]}>
            <Text style={[styles.change, isPositive ? styles.positive : styles.negative]}>
              {isPositive ? '+' : ''}{item.percentChange}%
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
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
  row: { flexDirection: 'row', alignItems: 'center' },
  symbolRow: { flex: 1 },
  symbol: { fontSize: 17, fontWeight: '600', color: COLORS.text },
  name: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  priceCol: { alignItems: 'flex-end', marginRight: 8 },
  price: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 4 },
  chipGreen: { backgroundColor: 'rgba(52, 199, 89, 0.2)' },
  chipRed: { backgroundColor: 'rgba(255, 59, 48, 0.2)' },
  change: { fontSize: 13, fontWeight: '600' },
  positive: { color: COLORS.positive },
  negative: { color: COLORS.negative },
});
