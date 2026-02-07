/**
 * Reusable skeleton placeholder with opacity pulse (Animated.loop).
 * Use instead of ActivityIndicator for layout-matched loading states.
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';

const PULSE_DURATION_MS = 1000;
const MIN_OPACITY = 0.35;
const MAX_OPACITY = 0.75;

export interface SkeletonLoaderProps {
  width?: number | string;
  height?: number | string;
  style?: StyleProp<ViewStyle>;
  /** Border radius. Default 6. */
  borderRadius?: number;
}

export function SkeletonLoader({
  width = '100%',
  height = 20,
  style,
  borderRadius = 6,
}: SkeletonLoaderProps) {
  const opacity = useRef(new Animated.Value(MIN_OPACITY)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: MAX_OPACITY,
          duration: PULSE_DURATION_MS,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: MIN_OPACITY,
          duration: PULSE_DURATION_MS,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: 'currentColor',
  },
});

export default SkeletonLoader;
