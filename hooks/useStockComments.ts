/**
 * Hook: fetch + Realtime subscription for stock comments (Supabase).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  fetchComments,
  insertComment,
  upvoteComment,
  downvoteComment,
  reportComment,
  subscribeComments,
  getSupabaseUserId,
  type CommentRow,
  type CommentSentiment,
  type CommentWithReplies,
} from '../services/commentsService';

export function useStockComments(stockSymbol: string) {
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (!stockSymbol) {
      setComments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchComments(stockSymbol, { includeReplies: true, limit: 100 });
      setComments(list);
    } catch (e) {
      if (__DEV__) console.warn('[useStockComments] load', e);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [stockSymbol]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!stockSymbol) return;
    const unsub = subscribeComments(
      stockSymbol,
      (payload) => {
        const newRow = payload.new as CommentRow;
        if (newRow.parent_id) {
          setComments((prev) =>
            prev.map((c) =>
              c.id === newRow.parent_id
                ? { ...c, replies: [...(c.replies ?? []), newRow] }
                : c
            )
          );
        } else {
          setComments((prev) => [{ ...newRow, replies: [] }, ...prev.filter((c) => c.id !== newRow.id)]);
        }
      },
      (payload) => {
        const updated = (payload as { new: CommentRow }).new;
        setComments((prev) =>
          prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
        );
      }
    );
    return unsub;
  }, [stockSymbol]);

  const addComment = useCallback(
    async (text: string, sentiment: CommentSentiment, parentId?: string | null) => {
      setPosting(true);
      try {
        const userId = await getSupabaseUserId();
        const created = await insertComment({
          stock_symbol: stockSymbol,
          user_id: userId,
          text,
          sentiment,
          parent_id: parentId ?? null,
        });
        if (created) {
          if (!created.parent_id) {
            setComments((prev) => [{ ...created, replies: [] }, ...prev.filter((c) => c.id !== created.id)]);
          }
          return created;
        }
      } finally {
        setPosting(false);
      }
      return null;
    },
    [stockSymbol]
  );

  const upvote = useCallback(async (commentId: string) => {
    const ok = await upvoteComment(commentId);
    if (ok) {
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, upvotes: (c.upvotes ?? 0) + 1 } : c))
      );
    }
  }, []);

  const downvote = useCallback(async (commentId: string) => {
    const ok = await downvoteComment(commentId);
    if (ok) {
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, downvotes: (c.downvotes ?? 0) + 1 } : c))
      );
    }
  }, []);

  const report = useCallback(async (commentId: string) => {
    const userId = await getSupabaseUserId();
    return reportComment(commentId, userId);
  }, []);

  return { comments, loading, posting, addComment, upvote, downvote, report, refresh: load };
}
