/**
 * Apple-style typewriter effect for Faheem output.
 * Reveals text character-by-character (~20ms) with optional haptic "thinking" feel.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Text, type TextProps, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const CHAR_DELAY_MS = 20;
const HAPTIC_EVERY_N_CHARS = 12;

export interface TypewriterTextProps extends Omit<TextProps, 'children'> {
  text: string;
  /** Delay between characters in ms. Default 20. */
  charDelay?: number;
  /** Enable light haptic every N characters (iOS). Default true, set false to disable. */
  haptics?: boolean;
  /** Callback when typewriter has finished. */
  onComplete?: () => void;
}

export function TypewriterText({
  text,
  charDelay = CHAR_DELAY_MS,
  haptics = true,
  onComplete,
  style,
  ...rest
}: TypewriterTextProps) {
  const [visibleLength, setVisibleLength] = useState(0);
  const prevTextRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (text !== prevTextRef.current) {
      prevTextRef.current = text;
      setVisibleLength(0);
    }
  }, [text]);

  useEffect(() => {
    if (visibleLength >= text.length) {
      onComplete?.();
      return;
    }
    timerRef.current = setTimeout(() => {
      const next = visibleLength + 1;
      setVisibleLength(next);
      if (haptics && Platform.OS === 'ios' && next % HAPTIC_EVERY_N_CHARS === 0) {
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {
          // ignore if haptics unavailable
        }
      }
    }, charDelay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visibleLength, text.length, charDelay, haptics, onComplete]);

  const visibleText = text.slice(0, visibleLength);

  return (
    <Text style={style} {...rest}>
      {visibleText}
    </Text>
  );
}

export default TypewriterText;
