/**
 * SouqView – Dual-Brain API (Faheem overview, financials, technicals, chat).
 * Every function accepts mode: 'beginner' | 'advanced' and sends it in the JSON body.
 * All Faheem endpoints: POST, Content-Type: application/json, timeout ≥ 20s (backend can take ~18s).
 */

import axios from 'axios';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

const FAHEEM_TIMEOUT_MS = 25000;

const aiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: FAHEEM_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

if (__DEV__) {
  console.log('[aiService] Resolved API base:', API_BASE_URL);
}

function getRequestUrl(path: string): string {
  const base = (aiClient.defaults.baseURL ?? '').replace(/\/+$/, '');
  const p = path.replace(/^\/+/, '');
  return base ? `${base}/${p}` : p;
}

async function postAi<T = unknown>(path: string, body?: object): Promise<T> {
  const fullUrl = getRequestUrl(path);
  try {
    const { data } = await aiClient.post<T>(path, body);
    return data as T;
  } catch (error: unknown) {
    if (__DEV__) {
      const err = error as { code?: string; message?: string; response?: { status?: number } };
      console.error('[aiService] Request failed:', {
        url: fullUrl,
        code: err?.code ?? 'unknown',
        message: err?.message ?? (error instanceof Error ? error.message : String(error)),
        status: err?.response?.status ?? 'no response',
      });
    }
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

    const base = aiClient.defaults.baseURL ?? '';
    const fullUrl = base.endsWith('/') ? `${base}faheem/chart` : `${base}/faheem/chart`;
    console.log(`🔗 CONNECTING TO: ${fullUrl}`);

    const data = await postAi<{ analysis?: string }>('/faheem/chart', {
      symbol,
      timeframe,
      chartData: recentData.map((d) => ({
        close: Number((d as Record<string, unknown>).close ?? (d as Record<string, unknown>).value ?? 0),
      })),
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
 * Body: { symbol, mode }. Success (200): { analysis: string } — use response.data.analysis.
 */
export async function getFaheemOverview(
  symbol: string,
  mode: FaheemMode
): Promise<{ analysis?: string }> {
  const base = aiClient.defaults.baseURL ?? '';
  const path = 'faheem/overview';
  const fullUrl = base.endsWith('/') ? `${base}${path}` : `${base}/${path}`;
  if (__DEV__) console.log(`🔗 Faheem Overview → ${fullUrl}`);
  const data = await postAi<{ analysis?: string }>('/faheem/overview', {
    symbol,
    mode,
  });
  return data ?? {};
}

/**
 * POST /api/faheem/financials
 * Body: { symbol, mode } or { symbol, mode, data }. Success: { health_score, red_flags, summary }.
 */
export async function getFaheemFinancials(
  symbol: string,
  data: unknown,
  mode: FaheemMode
): Promise<{ health_score?: string; red_flags?: string; summary?: string }> {
  const body: Record<string, unknown> = { symbol, mode };
  if (data != null && typeof data === 'object') body.data = data;
  const res = await postAi<{ health_score?: string; red_flags?: string; summary?: string }>('/faheem/financials', body);
  return res ?? {};
}

/**
 * POST /api/faheem/technicals
 * Body: { symbol, mode } or { symbol, mode, data }. Success: { trend_strength, key_levels }.
 */
export async function getFaheemTechnicals(
  symbol: string,
  data: unknown,
  mode: FaheemMode
): Promise<{ trend_strength?: string; key_levels?: string }> {
  const body: Record<string, unknown> = { symbol, mode };
  if (data != null && typeof data === 'object') body.data = data;
  const res = await postAi<{ trend_strength?: string; key_levels?: string }>('/faheem/technicals', body);
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
 * Success: { range_low, range_high, the_why, timeframe }.
 */
export async function getFaheemForecast(
  symbol: string,
  mode: FaheemMode,
  timeframe: '1D' | '1W' | '1M' | '1Y'
): Promise<{ range_low?: string | number; range_high?: string | number; the_why?: string; timeframe?: string }> {
  const data = await postAi<{ range_low?: string | number; range_high?: string | number; the_why?: string; timeframe?: string }>('/faheem/forecast', {
    symbol,
    mode,
    timeframe,
  });
  return data ?? {};
}

/**
 * POST /api/faheem/insiders
 * Body: { symbol, mode } or { symbol, mode, data }. Success: { sentiment, suspicious_activity }.
 */
export async function getFaheemInsiders(
  symbol: string,
  transactions: unknown[],
  mode: FaheemMode
): Promise<{ sentiment?: string; suspicious_activity?: string }> {
  try {
    const body: Record<string, unknown> = { symbol, mode };
    if (Array.isArray(transactions) && transactions.length > 0) body.data = transactions;
    const data = await postAi<{ sentiment?: string; suspicious_activity?: string }>('/faheem/insiders', body);
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
