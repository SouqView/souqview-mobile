/**
 * SouqView – Auth via Supabase (Apple, Google, signOut).
 * Session is persisted with AsyncStorage in the Supabase client.
 */

import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, getRedirectUrl, handleOAuthRedirect } from './supabase';

export type AuthUser = {
  id: string;
  email?: string;
  displayName?: string;
};

export function mapSupabaseUser(u: SupabaseUser | null): AuthUser | null {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email ?? undefined,
    displayName: u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email ?? undefined,
  };
}

/**
 * Get current session (from Supabase, already persisted).
 */
export async function getSession(): Promise<{ user: AuthUser; session: Session } | null> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.warn('getSession error:', error);
    return null;
  }
  if (!session?.user) return null;
  return { user: mapSupabaseUser(session.user)!, session };
}

/**
 * Sign in with Apple (OAuth).
 * Requires Apple provider enabled in Supabase Dashboard and native config for iOS.
 */
export async function signInWithApple(): Promise<{ user: AuthUser }> {
  const redirectTo = getRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { skipBrowserRedirect: true, redirectTo },
  });
  if (error) throw new Error(error.message);
  if (data.url) {
    const { openAuthSessionAsync } = await import('expo-web-browser');
    const result = await openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') throw new Error('Apple sign-in was cancelled or failed.');
    if (result.url) await handleOAuthRedirect(result.url);
  }
  const session = await getSession();
  if (!session) throw new Error('Sign-in completed but no session found.');
  return { user: session.user };
}

/**
 * Sign in with Google (OAuth).
 * Requires Google provider enabled in Supabase Dashboard.
 */
export async function signInWithGoogle(): Promise<{ user: AuthUser }> {
  const redirectTo = getRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { skipBrowserRedirect: true, redirectTo },
  });
  if (error) throw new Error(error.message);
  if (data.url) {
    const { openAuthSessionAsync } = await import('expo-web-browser');
    const result = await openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') throw new Error('Google sign-in was cancelled or failed.');
    if (result.url) await handleOAuthRedirect(result.url);
  }
  const session = await getSession();
  if (!session) throw new Error('Sign-in completed but no session found.');
  return { user: session.user };
}

/**
 * Sign out (Supabase + local).
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Listen to auth state changes (e.g. for context).
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange((event, payload) => {
    callback(event, payload?.session ?? null);
  });
}
