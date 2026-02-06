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
  /** Toggle between light and dark. */
  toggleTheme: () => Promise<void>;
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

  const toggleTheme = useCallback(async () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    setModeState(next);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, next);
  }, [mode]);

  const colors = mode === 'dark' ? COLORS : LIGHT_COLORS;
  const value: ThemeContextValue = {
    isDark: mode === 'dark',
    mode,
    setTheme,
    toggleTheme,
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
