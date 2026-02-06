/**
 * Smart Polling: refresh price every few seconds ONLY when the screen is focused.
 * Stops immediately when the user leaves the screen.
 */

import { useState, useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { fetchQuoteUncached } from '../services/marketData';

export interface LivePriceResult {
  /** Current price from latest poll (undefined until first fetch). */
  currentPrice: number | undefined;
  /** Previous price before last update (for green/red flash animation). */
  previousPrice: number | undefined;
  /** Percent change from quote (e.g. +1.25). */
  percentChange: number | undefined;
  /** True while a poll request is in flight. */
  loading: boolean;
}

/**
 * Poll quote for a symbol at the given interval while the screen is focused.
 * Returns currentPrice, previousPrice (for animation), and percentChange.
 */
export function useLivePrice(
  symbol: string,
  intervalMs: number = 5000
): LivePriceResult {
  const isFocused = useIsFocused();
  const [currentPrice, setCurrentPrice] = useState<number | undefined>(undefined);
  const [previousPrice, setPreviousPrice] = useState<number | undefined>(undefined);
  const [percentChange, setPercentChange] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPriceRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!symbol || !isFocused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const fetchPrice = async () => {
      setLoading(true);
      try {
        const quote = await fetchQuoteUncached(symbol);
        const price =
          typeof quote.price === 'number' && Number.isFinite(quote.price)
            ? quote.price
            : typeof quote.close === 'number' && Number.isFinite(quote.close)
              ? quote.close
              : undefined;
        const change =
          typeof quote.percent_change === 'number' && Number.isFinite(quote.percent_change)
            ? quote.percent_change
            : typeof quote.change_percent === 'number' && Number.isFinite(quote.change_percent)
              ? quote.change_percent
              : undefined;

        if (price !== undefined) {
          setPreviousPrice(lastPriceRef.current);
          lastPriceRef.current = price;
          setCurrentPrice(price);
        }
        if (change !== undefined) setPercentChange(change);
      } catch (_) {
        // Keep previous values on error
      } finally {
        setLoading(false);
      }
    };

    // First fetch immediately
    fetchPrice();

    intervalRef.current = setInterval(fetchPrice, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [symbol, intervalMs, isFocused]);

  return { currentPrice, previousPrice, percentChange, loading };
}
