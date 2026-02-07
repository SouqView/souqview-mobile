/**
 * Bearish vs Bullish Pressure bar: Bulls % (green) and Bears % (red) with animated widths.
 * Uses Money Flow Multiplier + RSI–derived score as bullish %; bearish = 100 - bullish.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../contexts/ThemeContext';

const BAR_HEIGHT = 10;
const BAR_BORDER_RADIUS = 5;
const ANIM_DURATION = 400;

export interface SentimentBarProps {
  /** Bullish pressure 0–100; bearish = 100 - score */
  score: number;
}

export function SentimentBar({ score }: SentimentBarProps) {
  const { colors } = useTheme();
  const bullishPercent = Math.max(0, Math.min(100, Number(score) || 50));
  const bearishPercent = 100 - bullishPercent;

  const bullishWidth = useSharedValue(bullishPercent);

  useEffect(() => {
    bullishWidth.value = withTiming(bullishPercent, {
      duration: ANIM_DURATION,
      easing: Easing.out(Easing.ease),
    });
  }, [bullishPercent, bullishWidth]);

  const animatedBullishStyle = useAnimatedStyle(() => ({
    width: `${bullishWidth.value}%`,
  }));

  const animatedBearishStyle = useAnimatedStyle(() => ({
    width: `${100 - bullishWidth.value}%`,
  }));

  return (
    <View style={styles.wrap}>
      {/* Top layer: labels */}
      <View style={styles.labelsRow}>
        <Text style={[styles.bullsLabel, { color: colors.positive }]}>
          🐂 Bulls {Math.round(bullishPercent)}%
        </Text>
        <Text style={[styles.bearsLabel, { color: colors.negative }]}>
          🐻 Bears {Math.round(bearishPercent)}%
        </Text>
      </View>
      {/* Middle layer: dual-colored progress bar */}
      <View style={[styles.track, { backgroundColor: colors.separator }]}>
        <Animated.View
          style={[
            styles.segment,
            styles.segmentLeft,
            { backgroundColor: colors.positive },
            animatedBullishStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.segment,
            styles.segmentRight,
            { backgroundColor: colors.negative },
            animatedBearishStyle,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginVertical: 14,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  bullsLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  bearsLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  track: {
    height: BAR_HEIGHT,
    borderRadius: BAR_BORDER_RADIUS,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  segment: {
    height: BAR_HEIGHT,
    borderRadius: 0,
  },
  segmentLeft: {
    borderTopLeftRadius: BAR_BORDER_RADIUS,
    borderBottomLeftRadius: BAR_BORDER_RADIUS,
  },
  segmentRight: {
    borderTopRightRadius: BAR_BORDER_RADIUS,
    borderBottomRightRadius: BAR_BORDER_RADIUS,
  },
});
