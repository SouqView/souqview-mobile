/**
 * SouqView – Supabase client (Auth, Database, Realtime).
 * Requires EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env
 * Auth uses AsyncStorage so the user stays logged in when they close the app.
 * On web SSR (Node), a no-op storage is used to avoid "window is not defined".
 */

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeRedirectUri } from 'expo-auth-session';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase: Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Add them to .env'
  );
}

/** No-op storage for SSR/Node where window is not defined (Expo web server render). */
const noopStorage = {
  getItem: async (_key: string): Promise<string | null> => null,
  setItem: async (_key: string, _value: string): Promise<void> => {},
  removeItem: async (_key: string): Promise<void> => {},
};

const isServer = typeof window === 'undefined';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isServer ? noopStorage : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * OAuth redirect URL for bringing the user back to the app after Google/Apple login.
 * Uses app scheme "souqview" so the redirect opens this app (e.g. souqview:// or souqview://auth/callback).
 * Add this exact URL to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.
 */
export function getRedirectUrl(): string {
  const url = makeRedirectUri({
    scheme: 'souqview',
    path: 'auth/callback',
    preferLocalhost: false,
  });
  return url || 'souqview://auth/callback';
}

/**
 * Handle the OAuth redirect when the app opens from the login popup.
 * Call this when you receive a URL (e.g. from Linking.addEventListener('url', ...)).
 * Parses access_token/refresh_token from the URL and sets the Supabase session.
 */
export async function handleOAuthRedirect(url: string): Promise<boolean> {
  try {
    const fragment = url.includes('#') ? url.split('#')[1] : '';
    const params = new URLSearchParams(fragment);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (accessToken && refreshToken) {
      await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      return true;
    }
    const error = params.get('error_description') || params.get('error');
    if (error) console.warn('OAuth redirect error:', error);
  } catch (e) {
    console.warn('handleOAuthRedirect failed:', e);
  }
  return false;
}
