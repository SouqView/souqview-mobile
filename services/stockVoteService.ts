/**
 * SouqView – Stock-level Bullish/Bearish votes for the Community "Tug of War" bar.
 * One vote per user per symbol, stored in Supabase stock_votes.
 */

import { supabase } from '../src/services/supabase';

export type StockVote = 'bullish' | 'bearish';

async function getSupabaseUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export interface StockVoteCounts {
  bulls: number;
  bears: number;
  bullPct: number;
  bearPct: number;
}

/** Get vote counts for a symbol (for the tug-of-war bar) */
export async function fetchStockVoteCounts(stockSymbol: string): Promise<StockVoteCounts> {
  const sym = stockSymbol.toUpperCase();
  const { data: rows, error } = await supabase
    .from('stock_votes')
    .select('vote')
    .eq('stock_symbol', sym);

  if (error) {
    if (__DEV__) console.warn('[stockVoteService] fetchStockVoteCounts', error);
    return { bulls: 0, bears: 0, bullPct: 50, bearPct: 50 };
  }

  const list = (rows ?? []) as { vote: string }[];
  const bulls = list.filter((r) => r.vote === 'bullish').length;
  const bears = list.filter((r) => r.vote === 'bearish').length;
  const total = bulls + bears;
  const bullPct = total > 0 ? Math.round((bulls / total) * 100) : 50;
  const bearPct = total > 0 ? Math.round((bears / total) * 100) : 50;
  return { bulls, bears, bullPct, bearPct };
}

/** Get current user's vote for a symbol (or null) */
export async function fetchMyVote(stockSymbol: string): Promise<StockVote | null> {
  const userId = await getSupabaseUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('stock_votes')
    .select('vote')
    .eq('stock_symbol', stockSymbol.toUpperCase())
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { vote: string }).vote === 'bearish' ? 'bearish' : 'bullish';
}

/** Set or update the current user's vote. Requires Supabase auth. */
export async function setStockVote(stockSymbol: string, vote: StockVote): Promise<boolean> {
  const userId = await getSupabaseUserId();
  if (!userId) {
    if (__DEV__) console.warn('[stockVoteService] setStockVote: no user');
    return false;
  }
  const { error } = await supabase
    .from('stock_votes')
    .upsert(
      { stock_symbol: stockSymbol.toUpperCase(), user_id: userId, vote, updated_at: new Date().toISOString() },
      { onConflict: 'stock_symbol,user_id' }
    );
  if (error) {
    if (__DEV__) console.warn('[stockVoteService] setStockVote', error);
    return false;
  }
  return true;
}
