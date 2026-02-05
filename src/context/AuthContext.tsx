/**
 * SouqView – Auth context using Supabase (session, Sign in with Apple, sign out).
 * Session is persisted via AsyncStorage in the Supabase client.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as auth from '../services/authService';

export interface User {
  id: string;
  name?: string;
  email?: string;
  plan?: { name: string };
}

function mapToUser(u: auth.AuthUser | null): User | null {
  if (!u) return null;
  return {
    id: u.id,
    name: u.displayName ?? u.email ?? u.id,
    email: u.email,
    plan: { name: 'Free' },
  };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    const session = await auth.getSession();
    setUser(mapToUser(session?.user ?? null));
  }, []);

  useEffect(() => {
    let sub: { data?: { subscription?: { unsubscribe: () => void } } } | null = null;
    (async () => {
      const session = await auth.getSession();
      setUser(mapToUser(session?.user ?? null));
      sub = auth.onAuthStateChange((_event, session) => {
        setUser(mapToUser(session?.user ? auth.mapSupabaseUser(session.user) : null));
      });
    })();
    setIsLoading(false);
    return () => sub?.data?.subscription?.unsubscribe?.();
  }, []);

  const signInWithApple = useCallback(async () => {
    const { user: u } = await auth.signInWithApple();
    setUser(mapToUser(u));
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { user: u } = await auth.signInWithGoogle();
    setUser(mapToUser(u));
  }, []);

  const logout = useCallback(async () => {
    await auth.signOut();
    setUser(null);
  }, []);

  const login = useCallback(async (_identifier: string, _password: string) => {
    throw new Error('Use Sign in with Apple or Google, or add Supabase signInWithPassword in authService.');
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    signInWithApple,
    signInWithGoogle,
    logout,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
