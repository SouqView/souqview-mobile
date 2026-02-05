/**
 * Hook: Stock-level Bullish/Bearish vote for the Community "Tug of War" bar.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  fetchStockVoteCounts,
  fetchMyVote,
  setStockVote as setStockVoteService,
  type StockVoteCounts,
  type StockVote,
} from '../services/stockVoteService';

export function useStockVote(stockSymbol: string) {
  const [counts, setCounts] = useState<StockVoteCounts>({ bulls: 0, bears: 0, bullPct: 50, bearPct: 50 });
  const [myVote, setMyVoteState] = useState<StockVote | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!stockSymbol) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [c, v] = await Promise.all([fetchStockVoteCounts(stockSymbol), fetchMyVote(stockSymbol)]);
      setCounts(c);
      setMyVoteState(v);
    } catch (e) {
      if (__DEV__) console.warn('[useStockVote] load', e);
    } finally {
      setLoading(false);
    }
  }, [stockSymbol]);

  useEffect(() => {
    load();
  }, [load]);

  const setVote = useCallback(
    async (vote: StockVote) => {
      const ok = await setStockVoteService(stockSymbol, vote);
      if (ok) {
        setMyVoteState(vote);
        const c = await fetchStockVoteCounts(stockSymbol);
        setCounts(c);
      }
    },
    [stockSymbol]
  );

  return { ...counts, myVote, setVote, loading, refresh: load };
}
