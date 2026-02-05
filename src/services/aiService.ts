/**
 * SouqView – Dual-Brain API (Faheem overview, financials, technicals, chat).
 * Every function accepts mode: 'beginner' | 'advanced' and sends it in the JSON body.
 */

import { post } from '../api/backend';

export type FaheemMode = 'beginner' | 'advanced';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** Map UI expertise (pro) to API mode (advanced). */
export function toFaheemMode(level: 'beginner' | 'pro'): FaheemMode {
  return level === 'pro' ? 'advanced' : 'beginner';
}

/**
 * POST /api/faheem/overview
 * Returns { rationale: string, verdict: string }. Optional quote/statistics for context.
 */
export async function getFaheemOverview(
  symbol: string,
  mode: FaheemMode,
  quote?: Record<string, unknown>
): Promise<{ rationale?: string; verdict?: string }> {
  const data = await post<{ rationale?: string; verdict?: string }>('/faheem/overview', {
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
  const res = await post<{ rationale?: string; verdict?: string; [k: string]: unknown }>('/faheem/financials', {
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
  const res = await post<{ rationale?: string; verdict?: string; [k: string]: unknown }>('/faheem/technicals', {
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
  const data = await post<{ reply?: string }>('/chat/message', {
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
  const data = await post<{ prediction?: string; rationale?: string }>('/faheem/forecast', {
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
    const data = await post<{ summary?: string; rationale?: string }>('/faheem/insiders', {
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
