/**
 * Demo Trading (Paper Trading) – US Market, fake money ($10,000 USD)
 * Persists to AsyncStorage. Tracks cashBalance, holdings, and transaction history.
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { INITIAL_DEMO_BALANCE_USD, XP_PER_TRADE } from '../constants/theme';

const STORAGE_KEY = '@souqview_demo_portfolio_us';

export type OrderSide = 'buy' | 'sell';

export interface Holding {
  symbol: string;
  quantity: number;
  avgPrice: number;
}

export interface HistoryEntry {
  type: 'BUY' | 'SELL';
  symbol: string;
  price: number;
  quantity: number;
  date: string;
}

export interface PortfolioState {
  cashBalance: number;
  holdings: Holding[];
  history: HistoryEntry[];
  xp: number;
  level: number;
}

const initialState: PortfolioState = {
  cashBalance: INITIAL_DEMO_BALANCE_USD,
  holdings: [],
  history: [],
  xp: 0,
  level: 1,
};

function xpToLevel(xp: number): number {
  let level = 1;
  let required = 0;
  while (required <= xp) {
    level++;
    required += 100 * level;
  }
  return level - 1;
}

type Action =
  | { type: 'RESTORE'; payload: PortfolioState }
  | { type: 'BUY'; payload: { symbol: string; quantity: number; price: number } }
  | { type: 'SELL'; payload: { symbol: string; quantity: number; price: number } }
  | { type: 'RESET_DEMO' };

function reducer(state: PortfolioState, action: Action): PortfolioState {
  switch (action.type) {
    case 'RESTORE':
      return action.payload;
    case 'RESET_DEMO':
      return initialState;
    case 'BUY': {
      const { symbol, quantity, price } = action.payload;
      const total = price * quantity;
      if (state.cashBalance < total) return state;
      const newBalance = state.cashBalance - total;
      const existing = state.holdings.find((h) => h.symbol === symbol);
      const date = new Date().toISOString();
      let newHoldings: Holding[];
      if (existing) {
        const newQty = existing.quantity + quantity;
        const newAvg = (existing.avgPrice * existing.quantity + total) / newQty;
        newHoldings = state.holdings.map((h) =>
          h.symbol === symbol ? { ...h, quantity: newQty, avgPrice: newAvg } : h
        );
      } else {
        newHoldings = [...state.holdings, { symbol, quantity, avgPrice: price }];
      }
      const newXp = state.xp + XP_PER_TRADE;
      return {
        ...state,
        cashBalance: newBalance,
        holdings: newHoldings,
        history: [
          { type: 'BUY', symbol, price, quantity, date },
          ...state.history,
        ],
        xp: newXp,
        level: xpToLevel(newXp),
      };
    }
    case 'SELL': {
      const { symbol, quantity, price } = action.payload;
      const pos = state.holdings.find((h) => h.symbol === symbol);
      if (!pos || pos.quantity < quantity) return state;
      const total = price * quantity;
      const newBalance = state.cashBalance + total;
      const newQty = pos.quantity - quantity;
      const date = new Date().toISOString();
      const newHoldings =
        newQty <= 0
          ? state.holdings.filter((h) => h.symbol !== symbol)
          : state.holdings.map((h) =>
              h.symbol === symbol ? { ...h, quantity: newQty } : h
            );
      const newXp = state.xp + XP_PER_TRADE;
      return {
        ...state,
        cashBalance: newBalance,
        holdings: newHoldings,
        history: [
          { type: 'SELL', symbol, price, quantity, date },
          ...state.history,
        ],
        xp: newXp,
        level: xpToLevel(newXp),
      };
    }
    default:
      return state;
  }
}

export type BuyResult = { success: true } | { error: string };
export type SellResult = { success: true } | { error: string };

interface PortfolioContextValue extends PortfolioState {
  buyStock: (symbol: string, currentPrice: number, quantity: number) => BuyResult;
  sellStock: (symbol: string, currentPrice: number, quantity: number) => SellResult;
  resetDemo: () => void;
  getPosition: (symbol: string) => Holding | undefined;
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw) as PortfolioState;
          dispatch({ type: 'RESTORE', payload: saved });
        } catch (_) {}
      }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const buyStock = useCallback(
    (symbol: string, currentPrice: number, quantity: number): BuyResult => {
      const total = currentPrice * quantity;
      if (state.cashBalance < total) {
        return { error: 'Insufficient Funds' };
      }
      if (quantity <= 0 || currentPrice <= 0) {
        return { error: 'Invalid quantity or price' };
      }
      dispatch({ type: 'BUY', payload: { symbol, quantity, price: currentPrice } });
      return { success: true };
    },
    [state.cashBalance]
  );

  const sellStock = useCallback(
    (symbol: string, currentPrice: number, quantity: number): SellResult => {
      const pos = state.holdings.find((h) => h.symbol === symbol);
      if (!pos) return { error: 'No position in this stock' };
      if (pos.quantity < quantity) return { error: 'Insufficient shares' };
      if (quantity <= 0 || currentPrice <= 0) return { error: 'Invalid quantity or price' };
      dispatch({ type: 'SELL', payload: { symbol, quantity, price: currentPrice } });
      return { success: true };
    },
    [state.holdings]
  );

  const resetDemo = useCallback(() => {
    dispatch({ type: 'RESET_DEMO' });
  }, []);

  const getPosition = useCallback(
    (symbol: string) => state.holdings.find((h) => h.symbol === symbol),
    [state.holdings]
  );

  const value: PortfolioContextValue = {
    ...state,
    buyStock,
    sellStock,
    resetDemo,
    getPosition,
  };

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolio must be used within PortfolioProvider');
  return ctx;
}
