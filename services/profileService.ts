/**
 * SouqView – User profile (expertise level) in Supabase profiles table.
 * Syncs with AsyncStorage for offline / anonymous use.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../src/services/supabase';

const EXPERTISE_STORAGE_KEY = '@souqview_expertise_level';

export type ExpertiseLevel = 'beginner' | 'pro';

async function getSupabaseUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Load expertise_level from Supabase profile; fallback to AsyncStorage then default */
export async function loadExpertiseLevel(): Promise<ExpertiseLevel> {
  try {
    const userId = await getSupabaseUserId();
    if (userId) {
      const { data, error } = await supabase
        .from('profiles')
        .select('expertise_level')
        .eq('id', userId)
        .single();
      if (!error && data?.expertise_level === 'pro') return 'pro';
      if (!error && data?.expertise_level === 'beginner') return 'beginner';
    }
  } catch (e) {
    if (__DEV__) console.warn('[profileService] loadExpertiseLevel Supabase', e);
  }
  try {
    const stored = await AsyncStorage.getItem(EXPERTISE_STORAGE_KEY);
    if (stored === 'pro' || stored === 'beginner') return stored;
  } catch (_) {}
  return 'beginner';
}

/** Save expertise_level to AsyncStorage and Supabase profile (if logged in) */
export async function saveExpertiseLevel(level: ExpertiseLevel): Promise<void> {
  await AsyncStorage.setItem(EXPERTISE_STORAGE_KEY, level);
  try {
    const userId = await getSupabaseUserId();
    if (userId) {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: userId, expertise_level: level, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      if (error && __DEV__) console.warn('[profileService] saveExpertiseLevel Supabase', error);
    }
  } catch (e) {
    if (__DEV__) console.warn('[profileService] saveExpertiseLevel Supabase', e);
  }
}
