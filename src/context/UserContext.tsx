/**
 * SouqView – Global user state (Supabase Auth).
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import * as auth from '../services/authService';

export type User = auth.AuthUser;

type UserContextValue = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function useUser() {
  const ctx = useContext(UserContext);
  if (ctx === undefined) throw new Error('useUser must be used within UserProvider');
  return ctx;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const session = await auth.getSession();
    setUser(session?.user ?? null);
  }, []);

  useEffect(() => {
    let sub: { data?: { subscription?: { unsubscribe: () => void } } } | null = null;
    (async () => {
      const session = await auth.getSession();
      setUser(session?.user ?? null);
      sub = auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ? auth.mapSupabaseUser(session.user) : null);
      });
    })();
    setIsLoading(false);
    return () => sub?.data?.subscription?.unsubscribe?.();
  }, []);

  const signInWithApple = useCallback(async () => {
    const { user: u } = await auth.signInWithApple();
    setUser(u);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { user: u } = await auth.signInWithGoogle();
    setUser(u);
  }, []);

  const signOut = useCallback(async () => {
    await auth.signOut();
    setUser(null);
  }, []);

  const value: UserContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user,
    signInWithApple,
    signInWithGoogle,
    signOut,
    refresh,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
