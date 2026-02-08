/**
 * Premium "Aura" background for the stock header only (top ~25% of screen).
 * Three overlapping radial-gradient orbs with slow drift (Reanimated).
 * Bullish: Emerald, Mint, Deep Blue. Bearish: theme-aware soft glow (light) or deep ember (dark).
 * Smooth transition when sentiment score changes. Soft overlay + noise for legibility.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Dimensions, View, useColorScheme } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

const DRIFT_DURATION_MS = 9000;
const COLOR_TRANSITION_MS = 800;
const BREATH_DURATION_MS = 5200;
const HEADER_HEIGHT_RATIO = 0.2125; // 25% reduced by 15%
const BLUR_OVERLAY_OPACITY = 0.2;
const NOISE_OPACITY = 0.03;

const BULLISH = ['#34C759', '#00C7BE', '#0A1628'] as const;

/** Light: vibrant red – pure red core, coral glow, soft edge. */
const BEARISH_LIGHT: [string, string, string] = [
  'rgba(255, 0, 0, 0.5)',      // Core – Pure Red at 50% opacity
  'rgba(255, 69, 58, 0.3)',     // Glow – Vibrant Coral Red
  'rgba(255, 100, 100, 0.1)',   // Edge
];

/** Dark: strong vibrant red – ember glow, deep crimson, dark edge. */
const BEARISH_DARK: [string, string, string] = [
  'rgba(255, 30, 30, 0.6)',     // Core – Strong Vibrant Red
  'rgba(215, 0, 21, 0.4)',      // Glow – Deep Crimson
  'rgba(150, 0, 0, 0.2)',       // Edge
];

export interface StockHeaderAuraProps {
  /** Sentiment 0–100. >50 bullish, <50 bearish. Transitions smoothly. */
  score: number;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** ~20% tighter gradient/radius for bearish so red doesn’t thin out – concentrated ember. */
const BEARISH_GLOW_RADIUS = 0.8;

function OrbLayer({
  colors,
  WIDTH,
  AURA_HEIGHT,
  phase,
  idPrefix,
  softGlow,
  concentratedGlow,
}: {
  colors: [string, string, string];
  WIDTH: number;
  AURA_HEIGHT: number;
  phase: Animated.SharedValue<number>;
  idPrefix: string;
  /** Softer, more diffuse gradient (bearish theme-aware glow). */
  softGlow?: boolean;
  /** Tighter radius (e.g. bearish) so glow doesn’t thin into background. */
  concentratedGlow?: boolean;
}) {
  const [c1, c2, c3] = colors;
  const radiusScale = concentratedGlow ? BEARISH_GLOW_RADIUS : 1;
  const gradR = concentratedGlow ? '52%' : '65%';
  const r1 = WIDTH * 0.5 * radiusScale;
  const r2 = WIDTH * 0.48 * radiusScale;
  const r3 = WIDTH * 0.42 * radiusScale;

  const orb1Props = useAnimatedProps(() => {
    const p = phase.value;
    return {
      cx: (0.2 + 0.15 * Math.sin(p * Math.PI * 2)) * WIDTH,
      cy: (0.3 + 0.2 * Math.cos(p * Math.PI * 2 + 0.5)) * AURA_HEIGHT,
    };
  });
  const orb2Props = useAnimatedProps(() => {
    const p = phase.value;
    return {
      cx: (0.6 + 0.2 * Math.cos(p * Math.PI * 2 + 1)) * WIDTH,
      cy: (0.25 + 0.15 * Math.sin(p * Math.PI * 2 + 0.3)) * AURA_HEIGHT,
    };
  });
  const orb3Props = useAnimatedProps(() => {
    const p = phase.value;
    return {
      cx: (0.5 + 0.25 * Math.sin(p * Math.PI * 2 + 2)) * WIDTH,
      cy: (0.6 + 0.15 * Math.cos(p * Math.PI * 2)) * AURA_HEIGHT,
    };
  });

  if (softGlow) {
    return (
      <Svg width={WIDTH} height={AURA_HEIGHT} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`${idPrefix}-1`} cx="50%" cy="50%" r={gradR} fx="50%" fy="50%">
            <Stop offset="0%" stopColor={c1} stopOpacity="1" />
            <Stop offset="35%" stopColor={c1} stopOpacity="0.85" />
            <Stop offset="70%" stopColor={c1} stopOpacity="0.2" />
            <Stop offset="100%" stopColor={c1} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`${idPrefix}-2`} cx="50%" cy="50%" r={gradR} fx="50%" fy="50%">
            <Stop offset="0%" stopColor={c2} stopOpacity="1" />
            <Stop offset="35%" stopColor={c2} stopOpacity="0.8" />
            <Stop offset="70%" stopColor={c2} stopOpacity="0.15" />
            <Stop offset="100%" stopColor={c2} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`${idPrefix}-3`} cx="50%" cy="50%" r={gradR} fx="50%" fy="50%">
            <Stop offset="0%" stopColor={c3} stopOpacity="1" />
            <Stop offset="40%" stopColor={c3} stopOpacity="0.5" />
            <Stop offset="100%" stopColor={c3} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <AnimatedCircle r={r1} fill={`url(#${idPrefix}-1)`} animatedProps={orb1Props} />
        <AnimatedCircle r={r2} fill={`url(#${idPrefix}-2)`} animatedProps={orb2Props} />
        <AnimatedCircle r={r3} fill={`url(#${idPrefix}-3)`} animatedProps={orb3Props} />
      </Svg>
    );
  }

  return (
    <Svg width={WIDTH} height={AURA_HEIGHT} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={`${idPrefix}-1`} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <Stop offset="0%" stopColor={c1} stopOpacity="0.85" />
          <Stop offset="70%" stopColor={c1} stopOpacity="0.25" />
          <Stop offset="100%" stopColor={c1} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={`${idPrefix}-2`} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <Stop offset="0%" stopColor={c2} stopOpacity="0.8" />
          <Stop offset="70%" stopColor={c2} stopOpacity="0.2" />
          <Stop offset="100%" stopColor={c2} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={`${idPrefix}-3`} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <Stop offset="0%" stopColor={c3} stopOpacity="0.75" />
          <Stop offset="70%" stopColor={c3} stopOpacity="0.15" />
          <Stop offset="100%" stopColor={c3} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <AnimatedCircle r={WIDTH * 0.5} fill={`url(#${idPrefix}-1)`} animatedProps={orb1Props} />
      <AnimatedCircle r={WIDTH * 0.45} fill={`url(#${idPrefix}-2)`} animatedProps={orb2Props} />
      <AnimatedCircle r={WIDTH * 0.4} fill={`url(#${idPrefix}-3)`} animatedProps={orb3Props} />
    </Svg>
  );
}

export function StockHeaderAura({ score }: StockHeaderAuraProps) {
  const colorScheme = useColorScheme();
  const { width: WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
  const AURA_HEIGHT = Math.max(200, SCREEN_HEIGHT * HEADER_HEIGHT_RATIO);

  const phase = useSharedValue(0);
  const mix = useSharedValue(Math.max(0, Math.min(1, score / 100)));
  const breath = useSharedValue(0);

  useEffect(() => {
    phase.value = withRepeat(
      withTiming(1, { duration: DRIFT_DURATION_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, [phase]);

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, {
        duration: BREATH_DURATION_MS / 2,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, [breath]);

  useEffect(() => {
    mix.value = withTiming(Math.max(0, Math.min(1, score / 100)), {
      duration: COLOR_TRANSITION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [score, mix]);

  const bullishLayerStyle = useAnimatedStyle(() => ({ opacity: mix.value }));
  const bearishLayerStyle = useAnimatedStyle(() => {
    const visibility = 1 - mix.value;
    const breathOpacity = interpolate(breath.value, [0, 1], [0.88, 1]);
    return { opacity: visibility * breathOpacity };
  });

  const bullishColors: [string, string, string] = [BULLISH[0], BULLISH[1], BULLISH[2]];
  const bearishColors: [string, string, string] =
    colorScheme === 'dark' ? BEARISH_DARK : BEARISH_LIGHT;
  const auraBlendMode = colorScheme === 'dark' ? 'screen' : 'multiply';

  return (
    <View style={[styles.container, { width: WIDTH, height: AURA_HEIGHT }]} pointerEvents="none">
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            bearishLayerStyle,
            { mixBlendMode: auraBlendMode as 'screen' | 'multiply' },
          ]}
        >
          <OrbLayer
            colors={bearishColors}
            WIDTH={WIDTH}
            AURA_HEIGHT={AURA_HEIGHT}
            phase={phase}
            idPrefix="bear"
            softGlow
            concentratedGlow
          />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, bullishLayerStyle]}>
          <OrbLayer colors={bullishColors} WIDTH={WIDTH} AURA_HEIGHT={AURA_HEIGHT} phase={phase} idPrefix="bull" />
        </Animated.View>
      </View>
      <View style={[StyleSheet.absoluteFill, styles.blurOverlay]} />
      <View style={[StyleSheet.absoluteFill, styles.noise]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
    overflow: 'hidden',
  },
  blurOverlay: {
    backgroundColor: '#000',
    opacity: BLUR_OVERLAY_OPACITY,
  },
  noise: {
    backgroundColor: '#fff',
    opacity: NOISE_OPACITY,
    pointerEvents: 'none',
  },
});
