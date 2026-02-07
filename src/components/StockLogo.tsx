/**
 * StockLogo – Circular stock logo with fallback monogram (Apple style).
 * Uses Financial Modeling Prep CDN; white container so logos stay visible in Dark Mode.
 */

import React, { useState, useCallback } from 'react';
import { View, Image, Text, StyleSheet, type ViewStyle } from 'react-native';
import { COLORS } from '../../constants/theme';

const LOGO_BASE_URL = 'https://financialmodelingprep.com/image-stock';
const PADDING = 4;

/** Hash symbol string to a consistent index for pastel colors */
function hashSymbol(symbol: string): number {
  let h = 0;
  const s = symbol.toUpperCase();
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Pastel backgrounds for fallback monogram (iOS-friendly) */
const PASTELS = [
  '#E8B4BC', '#B4C5E4', '#B8E4B4', '#E4D4B4', '#D4B4E4',
  '#B4E4E0', '#E4C4B4', '#C4B4E4', '#8E8E93', '#A8C8E8',
];

function getFallbackBackground(symbol: string): string {
  if (!symbol || !symbol.trim()) return COLORS.textTertiary;
  const index = hashSymbol(symbol) % PASTELS.length;
  return PASTELS[index];
}

/** First 1–2 characters of symbol for monogram */
function getMonogram(symbol: string): string {
  if (!symbol || !symbol.trim()) return '?';
  const s = symbol.toUpperCase().replace(/\s/g, '');
  return s.slice(0, 2);
}

export interface StockLogoProps {
  /** Ticker symbol (e.g. AAPL, MSFT) */
  symbol: string;
  /** Diameter in px. Default 40 */
  size?: number;
  /** Optional container style */
  style?: ViewStyle;
}

export function StockLogo({ symbol, size = 40, style }: StockLogoProps) {
  const [imageError, setImageError] = useState(false);

  const onError = useCallback(() => {
    setImageError(true);
  }, []);

  const normalizedSymbol = (symbol ?? '').trim();
  const uri = normalizedSymbol
    ? `${LOGO_BASE_URL}/${encodeURIComponent(normalizedSymbol)}.png`
    : null;

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 1,
    borderColor: COLORS.separator,
  };

  if (imageError || !uri) {
    const bg = getFallbackBackground(normalizedSymbol || '?');
    return (
      <View style={[styles.fallback, containerStyle, { backgroundColor: bg }, style]}>
        <Text
          style={[
            styles.monogram,
            {
              fontSize: size * 0.4,
            },
          ]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {getMonogram(normalizedSymbol || '?')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle, { padding: PADDING }, style]}>
      <Image
        source={{ uri }}
        style={styles.image}
        resizeMode="contain"
        onError={onError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    flex: 1,
    width: '100%',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  monogram: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
