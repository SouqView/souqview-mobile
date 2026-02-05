/**
 * SouqView – Global Light/Dark theme. Persisted to AsyncStorage.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, LIGHT_COLORS, type ThemeColors } from '../constants/theme';

const THEME_STORAGE_KEY = '@souqview_theme';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  isDark: boolean;
  mode: ThemeMode;
  setTheme: (mode: ThemeMode) => Promise<void>;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (!cancelled && (stored === 'light' || stored === 'dark')) {
        setModeState(stored);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const setTheme = useCallback(async (newMode: ThemeMode) => {
    setModeState(newMode);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
  }, []);

  const colors = mode === 'dark' ? COLORS : LIGHT_COLORS;
  const value: ThemeContextValue = {
    isDark: mode === 'dark',
    mode,
    setTheme,
    colors,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
