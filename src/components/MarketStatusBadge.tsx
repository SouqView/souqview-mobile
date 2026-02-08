/**
 * Market Status Badge – small metadata row: dot + label (Pre-Market, Market Open, etc.).
 * Optional opacity pulse on the dot when status is "Market Open".
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../contexts/ThemeContext';
import { getMarketStatusWithQuote, type MarketStatusResult } from '../utils/marketHours';

const DOT_SIZE = 6;
const PULSE_DURATION_MS = 1800;
const MIN_OPACITY = 0.6;
const MAX_OPACITY = 1;

export interface MarketStatusBadgeProps {
  /** If set and > 24h old, shows "Data Delayed". Unix sec/ms or ISO string. */
  quoteTimestamp?: number | string | null;
  /** Override status (e.g. from API). If set, quoteTimestamp is still used for "Data Delayed". */
  statusOverride?: MarketStatusResult | null;
  /** When true (e.g. inside header over Aura), use white text for contrast. */
  forceWhiteText?: boolean;
}

function usePulse(isOpen: boolean) {
  const opacity = useSharedValue(MAX_OPACITY);
  React.useEffect(() => {
    if (!isOpen) {
      opacity.value = MAX_OPACITY;
      return;
    }
    opacity.value = withRepeat(
      withTiming(MIN_OPACITY, { duration: PULSE_DURATION_MS / 2 }),
      -1,
      true
    );
  }, [isOpen, opacity]);
  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

export function MarketStatusBadge({ quoteTimestamp, statusOverride, forceWhiteText }: MarketStatusBadgeProps) {
  const { colors } = useTheme();
  const result = useMemo(() => {
    if (statusOverride) return statusOverride;
    return getMarketStatusWithQuote(quoteTimestamp);
  }, [quoteTimestamp, statusOverride]);

  const isOpen = result.status === 'Market Open';
  const animatedDotStyle = usePulse(isOpen);

  const textColor = forceWhiteText ? '#FFFFFF' : colors.textSecondary;

  return (
    <View style={styles.row}>
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: result.dotColor },
          animatedDotStyle,
        ]}
      />
      <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
        {result.status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
});

export default MarketStatusBadge;
