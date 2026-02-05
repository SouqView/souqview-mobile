/**
 * SouqView – Community comments via Supabase (Realtime, CRUD).
 * Table: comments (stock_symbol, user_id, text, sentiment, upvotes, parent_id, reported_at).
 */

import { supabase } from '../src/services/supabase';

export type CommentSentiment = 'bullish' | 'bearish';

export interface CommentRow {
  id: string;
  stock_symbol: string;
  user_id: string | null;
  text: string;
  sentiment: CommentSentiment;
  upvotes: number;
  downvotes?: number;
  parent_id: string | null;
  reported_at: string | null;
  reported_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommentWithAuthor extends CommentRow {
  author_name?: string;
}

export interface CommentWithReplies extends CommentRow {
  replies?: CommentRow[];
}

/** Fetch top-level comments for a symbol, newest first (with optional replies) */
export async function fetchComments(
  stockSymbol: string,
  options?: { includeReplies?: boolean; limit?: number }
): Promise<CommentWithReplies[]> {
  const limit = options?.limit ?? 100;
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('stock_symbol', stockSymbol.toUpperCase())
    .is('parent_id', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (__DEV__) console.warn('[commentsService] fetchComments', error);
    return [];
  }

  const list = (data ?? []) as CommentRow[];
  if (options?.includeReplies && list.length > 0) {
    const ids = list.map((c) => c.id);
    const { data: replies } = await supabase
      .from('comments')
      .select('*')
      .in('parent_id', ids)
      .order('created_at', { ascending: true });
    const byParent = (replies as CommentRow[] ?? []).reduce<Record<string, CommentRow[]>>((acc, r) => {
      if (r.parent_id) {
        if (!acc[r.parent_id]) acc[r.parent_id] = [];
        acc[r.parent_id].push(r);
      }
      return acc;
    }, {});
    return list.map((c) => ({
      ...c,
      replies: byParent[c.id] ?? [],
    })) as CommentWithReplies[];
  }
  return list as CommentWithReplies[];
}

/** Fetch replies for a single comment */
export async function fetchReplies(parentId: string): Promise<CommentRow[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: true });

  if (error) {
    if (__DEV__) console.warn('[commentsService] fetchReplies', error);
    return [];
  }
  return (data ?? []) as CommentRow[];
}

/** Insert a new comment */
export async function insertComment(params: {
  stock_symbol: string;
  user_id: string | null;
  text: string;
  sentiment: CommentSentiment;
  parent_id?: string | null;
}): Promise<CommentRow | null> {
  const { data, error } = await supabase
    .from('comments')
    .insert({
      stock_symbol: params.stock_symbol.toUpperCase(),
      user_id: params.user_id ?? null,
      text: params.text.trim(),
      sentiment: params.sentiment,
      parent_id: params.parent_id ?? null,
      upvotes: 0,
      downvotes: 0,
    })
    .select()
    .single();

  if (error) {
    if (__DEV__) console.warn('[commentsService] insertComment', error);
    return null;
  }
  return data as CommentRow;
}

/** Increment upvotes for a comment */
export async function upvoteComment(commentId: string): Promise<boolean> {
  const { data: row } = await supabase.from('comments').select('upvotes').eq('id', commentId).single();
  const current = (row as { upvotes?: number } | null)?.upvotes ?? 0;
  const { error } = await supabase.from('comments').update({ upvotes: current + 1 }).eq('id', commentId);
  if (error) {
    if (__DEV__) console.warn('[commentsService] upvoteComment', error);
    return false;
  }
  return true;
}

/** Increment downvotes for a comment */
export async function downvoteComment(commentId: string): Promise<boolean> {
  const { data: row } = await supabase.from('comments').select('downvotes').eq('id', commentId).single();
  const current = (row as { downvotes?: number } | null)?.downvotes ?? 0;
  const { error } = await supabase.from('comments').update({ downvotes: current + 1 }).eq('id', commentId);
  if (error) {
    if (__DEV__) console.warn('[commentsService] downvoteComment', error);
    return false;
  }
  return true;
}

/** Report a comment (set reported_at and reported_by) */
export async function reportComment(commentId: string, userId: string | null): Promise<boolean> {
  const { error } = await supabase
    .from('comments')
    .update({ reported_at: new Date().toISOString(), reported_by: userId })
    .eq('id', commentId);

  if (error) {
    if (__DEV__) console.warn('[commentsService] reportComment', error);
    return false;
  }
  return true;
}

/** Subscribe to Realtime inserts/updates for a symbol's comments */
export function subscribeComments(
  stockSymbol: string,
  onInsert: (payload: { new: CommentRow }) => void,
  onUpdate: (payload: { new: CommentRow } | { old: CommentRow; new: CommentRow }) => void
) {
  const channel = supabase
    .channel(`comments:${stockSymbol}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'comments',
        filter: `stock_symbol=eq.${stockSymbol.toUpperCase()}`,
      },
      (payload) => onInsert(payload as { new: CommentRow })
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'comments',
        filter: `stock_symbol=eq.${stockSymbol.toUpperCase()}`,
      },
      (payload) => onUpdate(payload as { old: CommentRow; new: CommentRow })
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/** Get current Supabase user id (if using Supabase Auth) */
export async function getSupabaseUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}
