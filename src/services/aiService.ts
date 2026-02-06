/**
 * SouqView – Dual-Brain API (Faheem overview, financials, technicals, chat).
 * Every function accepts mode: 'beginner' | 'advanced' and sends it in the JSON body.
 * Uses a dedicated client with 45s timeout for AI (DeepSeek/Groq can take 10–25s).
 */

import axios from 'axios';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

const aiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

async function postAi<T = unknown>(path: string, body?: object): Promise<T> {
  try {
    const { data } = await aiClient.post<T>(path, body);
    return data as T;
  } catch (error) {
    if (__DEV__) console.error('AI Service Timeout/Error:', error);
    throw error;
  }
}

export type FaheemMode = 'beginner' | 'advanced';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** Map UI expertise (pro) to API mode (advanced). */
export function toFaheemMode(level: 'beginner' | 'pro'): FaheemMode {
  return level === 'pro' ? 'advanced' : 'beginner';
}

/** Sweet spot: 60 candles — enough for S/R, still small (<5kb). 10 was too short; 1000 caused timeouts. */
const FAHEEM_CHART_CANDLES = 60;

/**
 * POST /faheem/chart — send last 60 candles for trend/support/resistance analysis.
 * Returns analysis text; on error returns a fallback string (no throw).
 */
export async function getFaheemChartAnalysis(
  symbol: string,
  timeframe: string,
  chartData: unknown[]
): Promise<string> {
  try {
    const recentData =
      chartData && chartData.length > FAHEEM_CHART_CANDLES
        ? chartData.slice(-FAHEEM_CHART_CANDLES)
        : chartData ?? [];

    if (__DEV__) console.log(`📤 Faheem Payload: ${symbol} (${recentData.length} candles)`);

    const data = await postAi<{ analysis?: string }>('/faheem/chart', {
      symbol,
      timeframe,
      chartData: recentData,
    });
    return data?.analysis ?? 'Analysis momentarily unavailable.';
  } catch (error) {
    if (__DEV__) console.error('AI Service Error:', error);
    return 'Analysis momentarily unavailable.';
  }
}

/** Alias for getFaheemChartAnalysis (same 60-candle sweet-spot payload). */
export const getFaheemAnalysis = getFaheemChartAnalysis;

/**
 * POST /api/faheem/overview
 * Returns { rationale: string, verdict: string }. Optional quote/statistics for context.
 */
export async function getFaheemOverview(
  symbol: string,
  mode: FaheemMode,
  quote?: Record<string, unknown>
): Promise<{ rationale?: string; verdict?: string }> {
  const data = await postAi<{ rationale?: string; verdict?: string }>('/faheem/overview', {
    symbol,
    mode,
    ...(quote != null && Object.keys(quote).length > 0 ? { quote } : {}),
  });
  return data ?? {};
}

/**
 * POST /api/faheem/financials
 */
export async function getFaheemFinancials(
  symbol: string,
  data: unknown,
  mode: FaheemMode
): Promise<{ rationale?: string; verdict?: string; [k: string]: unknown }> {
  const res = await postAi<{ rationale?: string; verdict?: string; [k: string]: unknown }>('/faheem/financials', {
    symbol,
    data,
    mode,
  });
  return res ?? {};
}

/**
 * POST /api/faheem/technicals
 */
export async function getFaheemTechnicals(
  symbol: string,
  data: unknown,
  mode: FaheemMode
): Promise<{ rationale?: string; verdict?: string; [k: string]: unknown }> {
  const res = await postAi<{ rationale?: string; verdict?: string; [k: string]: unknown }>('/faheem/technicals', {
    symbol,
    data,
    mode,
  });
  return res ?? {};
}

/**
 * POST /api/chat/message
 * Body: { message, history, context?, mode }
 * Response: { reply: string }
 */
export async function sendChatMessage(
  message: string,
  history: ChatMessage[],
  context: Record<string, unknown> | undefined,
  mode: FaheemMode
): Promise<string> {
  const data = await postAi<{ reply?: string }>('/chat/message', {
    message,
    history,
    context: context ?? {},
    mode,
  });
  return data?.reply ?? '';
}

/**
 * POST /api/faheem/forecast
 * Body: { symbol, mode, timeframe }. Timeframe: '1D' | '1W' | '1M' | '1Y'.
 * Returns { prediction?: string; rationale?: string } for that period.
 */
export async function getFaheemForecast(
  symbol: string,
  mode: FaheemMode,
  timeframe: '1D' | '1W' | '1M' | '1Y'
): Promise<{ prediction?: string; rationale?: string }> {
  const data = await postAi<{ prediction?: string; rationale?: string }>('/faheem/forecast', {
    symbol,
    mode,
    timeframe,
  });
  return data ?? {};
}

/**
 * POST /api/faheem/insiders (or equivalent)
 * Sends filtered recent transactions for AI sentiment. Returns { summary?: string } or rationale.
 */
export async function getFaheemInsiders(
  symbol: string,
  transactions: unknown[],
  mode: FaheemMode
): Promise<{ summary?: string; rationale?: string }> {
  try {
    const data = await postAi<{ summary?: string; rationale?: string }>('/faheem/insiders', {
      symbol,
      transactions,
      mode,
    });
    return data ?? {};
  } catch {
    return {};
  }
}

/**
 * Legacy helper for one-off analysis (e.g. Forecast tab).
 * Uses the chat endpoint with a single prompt and returns the reply text.
 */
export async function requestAnalysis(
  symbol: string,
  prompt: string,
  expertiseLevel: 'beginner' | 'pro'
): Promise<string> {
  const mode = toFaheemMode(expertiseLevel);
  return sendChatMessage(prompt, [], { symbol }, mode);
}
