/**
 * SouqView – Global market state (watchlist, selected symbol, cache).
 */

import React, { createContext, useContext, useCallback, useState, ReactNode } from 'react';
import { fetchQuote, fetchNews, Quote, NewsItem } from '../services/marketData';

const DEFAULT_SYMBOLS = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL'];

type MarketContextValue = {
  symbols: string[];
  addSymbol: (symbol: string) => void;
  removeSymbol: (symbol: string) => void;
  getQuote: (symbol: string) => Promise<Quote>;
  getNews: (symbol: string) => Promise<NewsItem[]>;
};

const MarketContext = createContext<MarketContextValue | undefined>(undefined);

export function useMarket() {
  const ctx = useContext(MarketContext);
  if (ctx === undefined) throw new Error('useMarket must be used within MarketProvider');
  return ctx;
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS);

  const addSymbol = useCallback((symbol: string) => {
    const s = symbol.toUpperCase().trim();
    if (!s) return;
    setSymbols((prev) => (prev.includes(s) ? prev : [...prev, s]));
  }, []);

  const removeSymbol = useCallback((symbol: string) => {
    setSymbols((prev) => prev.filter((x) => x !== symbol.toUpperCase()));
  }, []);

  const getQuote = useCallback((symbol: string) => fetchQuote(symbol), []);
  const getNews = useCallback((symbol: string) => fetchNews(symbol), []);

  const value: MarketContextValue = {
    symbols,
    addSymbol,
    removeSymbol,
    getQuote,
    getNews,
  };

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}
