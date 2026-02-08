/**
 * Sentiment Engine – avoids visual contradictions (e.g. green price, red sentiment).
 * - Base: 50 + (Price Change % × 10). +3.5% day = +35 points.
 * - Trend filter (EMA20): Price > EMA20 → bearish capped at 40% unless RSI > 85.
 *   Price < EMA20 → bullish capped at 40% unless RSI < 15.
 * - MFM: secondary weight only (15% impact, ±15 points).
 * - Price-First override (sanity check): |dailyChangePercent| > 2% forces bar to match price (≥70% bull or ≥70% bear).
 */

export type QuoteData = {
  high: number;
  low: number;
  close: number;
  changePercent?: number;
};

export type SentimentResult = {
  score: number;
  label: 'Bullish' | 'Bearish' | 'Neutral';
  color: string;
};

export type SentimentOptions = {
  symbol?: string;
  /** Close prices, oldest first (for EMA20 trend filter). */
  closes?: number[];
};

const BULLISH_COLOR = '#34C759';
const BEARISH_COLOR = '#FF3B30';
const NEUTRAL_COLOR = '#8E8E93';

const MFM_IMPACT = 15; // 15% impact: shift in [-15, +15]
const PRICE_WEIGHT = 10; // changePercent * PRICE_WEIGHT = price-weight points
const PRICE_FIRST_THRESHOLD = 2.0; // |change%| > this forces min 70% bull or 70% bear

/** EMA(period). Alpha = 2/(N+1). */
function ema(closes: number[], period: number): number[] {
  if (!closes?.length || period < 1) return [];
  const alpha = 2 / (period + 1);
  const out: number[] = [];
  let prev = closes[0];
  for (let i = 0; i < closes.length; i++) {
    prev = i === 0 ? closes[0] : alpha * closes[i] + (1 - alpha) * prev;
    out.push(prev);
  }
  return out;
}

/** Get last EMA20 value if we have enough data. */
function getEma20(closes: number[]): number | null {
  const arr = ema(closes, 20);
  if (arr.length < 20) return null;
  const v = arr[arr.length - 1];
  return Number.isFinite(v) ? v : null;
}

/**
 * Money Flow Multiplier: ((Close - Low) - (High - Close)) / (High - Low).
 * Used as secondary weight only (15% impact).
 */
function getMfmShift(quote: QuoteData): { mfm: number; shift: number } {
  const { high, low, close } = quote;
  const range = high - low;
  if (!Number.isFinite(range) || range <= 0) return { mfm: 0, shift: 0 };
  const mfm = ((close - low) - (high - close)) / range;
  const clamped = Math.max(-1, Math.min(1, mfm));
  return { mfm, shift: clamped * MFM_IMPACT };
}

type TrendStatus = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
type ResultWinner = 'BULLS WIN' | 'BEARS WIN' | 'NEUTRAL';

/**
 * Trend filter (EMA20):
 * - Price > EMA20 → bearish score hard-capped at 40% (score ≥ 40) unless RSI > 85.
 * - Price < EMA20 → bullish score hard-capped at 40% (score ≤ 40) unless RSI < 15.
 */
function applyTrendFilter(
  score: number,
  price: number,
  ema20: number | null,
  rsi: number | null
): number {
  if (ema20 == null || !Number.isFinite(price)) return score;

  if (price > ema20) {
    const rsiOverride = rsi != null && Number.isFinite(rsi) && rsi > 85;
    if (!rsiOverride && score < 40) return 40;
    return score;
  }

  if (price < ema20) {
    const rsiOverride = rsi != null && Number.isFinite(rsi) && rsi < 15;
    if (!rsiOverride && score > 40) return 40;
    return score;
  }

  return score;
}

export function calculateSmartSentiment(
  quote: QuoteData,
  rsi: number | null,
  aiAnalysis: string | null,
  options?: SentimentOptions
): SentimentResult {
  const symbol = options?.symbol ?? '';
  const closes = options?.closes ?? [];
  const price = quote.close;
  const changePercent = quote.changePercent ?? 0;

  // Base: 50 + (Price Change % × 10). +3.5% = +35 points.
  const priceWeight = Number.isFinite(changePercent) ? changePercent * PRICE_WEIGHT : 0;
  let score = 50 + priceWeight;

  // MFM: secondary weight only (15% impact).
  const { mfm, shift: mfmShift } = getMfmShift(quote);
  score += mfmShift;

  score = Math.round(Math.max(0, Math.min(100, score)));

  const ema20 = getEma20(closes);
  score = applyTrendFilter(score, price, ema20, rsi);

  // Price-First override: strong move must show in bar regardless of RSI/MFM.
  let overrideActive = false;
  if (Number.isFinite(changePercent)) {
    if (changePercent > PRICE_FIRST_THRESHOLD) {
      if (score < 70) {
        score = 70;
        overrideActive = true;
      }
    } else if (changePercent < -PRICE_FIRST_THRESHOLD) {
      if (score > 30) {
        score = 30;
        overrideActive = true;
      }
    }
  }

  let label: SentimentResult['label'] = 'Neutral';
  let color = NEUTRAL_COLOR;
  if (score > 55) {
    label = 'Bullish';
    color = BULLISH_COLOR;
  } else if (score < 45) {
    label = 'Bearish';
    color = BEARISH_COLOR;
  }

  const trendStatus: TrendStatus =
    ema20 != null
      ? price > ema20
        ? 'BULLISH'
        : price < ema20
          ? 'BEARISH'
          : 'NEUTRAL'
      : 'NEUTRAL';

  const result: ResultWinner =
    score > 50 ? 'BULLS WIN' : score < 50 ? 'BEARS WIN' : 'NEUTRAL';

  if (__DEV__ && symbol) {
    if (overrideActive) {
      console.log(
        `LOGIC AUDIT: [${symbol}] | OVERRIDE ACTIVE: Price momentum dominant.`
      );
    } else {
      const priceStr = priceWeight >= 0 ? `+${priceWeight}` : `${priceWeight}`;
      console.log(
        `LOGIC AUDIT: [${symbol}] | Price-Weight: ${priceStr} | Trend-Status: ${trendStatus} | Result: ${result}`
      );
    }
  }

  return { score, label, color };
}
