/**
 * SouqView – Global expertise level for Faheem persona (Beginner 🎓 | Pro 🚀).
 * Persisted to AsyncStorage + Supabase profiles so the next chat uses the new persona.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { loadExpertiseLevel, saveExpertiseLevel, type ExpertiseLevel } from '../services/profileService';

interface ExpertiseContextValue {
  expertiseLevel: ExpertiseLevel;
  setExpertiseLevel: (level: ExpertiseLevel) => Promise<void>;
  isLoading: boolean;
}

const ExpertiseContext = createContext<ExpertiseContextValue | null>(null);

export function ExpertiseProvider({ children }: { children: React.ReactNode }) {
  const [expertiseLevel, setLevelState] = useState<ExpertiseLevel>('beginner');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadExpertiseLevel().then((level) => {
      if (!cancelled) setLevelState(level);
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const setExpertiseLevel = useCallback(async (level: ExpertiseLevel) => {
    setLevelState(level);
    await saveExpertiseLevel(level);
  }, []);

  const value: ExpertiseContextValue = {
    expertiseLevel,
    setExpertiseLevel,
    isLoading,
  };

  return (
    <ExpertiseContext.Provider value={value}>
      {children}
    </ExpertiseContext.Provider>
  );
}

export function useExpertise() {
  const ctx = useContext(ExpertiseContext);
  if (!ctx) throw new Error('useExpertise must be used within ExpertiseProvider');
  return ctx;
}
