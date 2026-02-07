/**
 * Smart Sentiment Engine – combines price structure (MFM), RSI, and AI keyword analysis
 * into a single 0–100 score with Bullish / Neutral / Bearish label and color.
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

const BULLISH_COLOR = '#34C759';
const BEARISH_COLOR = '#FF3B30';
const NEUTRAL_COLOR = '#8E8E93';

/** Map value in [min, max] to [0, 100] */
function clampMap(value: number, min: number, max: number): number {
  if (max === min) return 50;
  const t = (value - min) / (max - min);
  return Math.max(0, Math.min(100, t * 100));
}

/**
 * PART A: Money Flow Multiplier (Weight 50%)
 * MFM = ((Close - Low) - (High - Close)) / (High - Low)
 * MFM in [-1, 1] -> 0–100 (50 = neutral).
 */
function partAPriceStructure(quote: QuoteData): number {
  const { high, low, close } = quote;
  const range = high - low;
  if (!Number.isFinite(range) || range <= 0) return 50;

  const mfm = ((close - low) - (high - close)) / range;
  const score = clampMap(mfm, -1, 1);
  const bonus = (quote.changePercent ?? 0) > 0 ? 5 : 0;
  return Math.min(100, score + bonus);
}

/**
 * PART B: RSI (Weight 30%)
 * RSI < 30 -> Bullish (oversold) -> 80
 * RSI > 70 -> Bearish (overbought) -> 20
 * RSI 30–70 -> linear (50 = neutral).
 */
function partBRSI(rsi: number | null): number {
  const r = rsi ?? 50;
  if (!Number.isFinite(r)) return 50;
  if (r < 30) return 80;
  if (r > 70) return 20;
  return clampMap(r, 30, 70);
}

const POSITIVE_KEYWORDS = ['bullish', 'growth', 'breakout', 'strong', 'upside', 'buy'];
const NEGATIVE_KEYWORDS = ['bearish', 'weak', 'downside', 'risk', 'sell', 'resistance'];

/**
 * PART C: Faheem's Brain – keyword analysis (Weight 20%)
 * Shift score by +/- 10 based on keyword hits.
 */
function partCKeywordShift(aiAnalysis: string | null): number {
  if (!aiAnalysis || typeof aiAnalysis !== 'string') return 0;
  const lower = aiAnalysis.toLowerCase();
  let positive = 0;
  let negative = 0;
  for (const k of POSITIVE_KEYWORDS) {
    if (lower.includes(k)) positive++;
  }
  for (const k of NEGATIVE_KEYWORDS) {
    if (lower.includes(k)) negative++;
  }
  const net = positive - negative;
  if (net > 0) return Math.min(10, net * 3);
  if (net < 0) return Math.max(-10, net * 3);
  return 0;
}

/**
 * Weighted combination:
 * A: 50%, B: 30%, C: 20% (C is a +/- shift on the 0–100 scale).
 * @param symbolOpt Optional symbol for DEBUG SENTIMENT logging (e.g. "AAPL").
 */
export function calculateSmartSentiment(
  quote: QuoteData,
  rsi: number | null,
  aiAnalysis: string | null,
  symbolOpt?: string
): SentimentResult {
  const a = partAPriceStructure(quote);
  const b = partBRSI(rsi);
  const cShift = partCKeywordShift(aiAnalysis);

  if (__DEV__ && symbolOpt) {
    console.log(
      `DEBUG SENTIMENT: [${symbolOpt}] -> MFM: ${a.toFixed(2)}, RSI: ${rsi ?? 'null'}, AI: ${cShift}`
    );
  }

  const raw = a * 0.5 + b * 0.3 + (50 * 0.2) + cShift;
  const score = Math.round(Math.max(0, Math.min(100, raw)));

  let label: SentimentResult['label'] = 'Neutral';
  let color = NEUTRAL_COLOR;
  if (score > 55) {
    label = 'Bullish';
    color = BULLISH_COLOR;
  } else if (score < 45) {
    label = 'Bearish';
    color = BEARISH_COLOR;
  }

  return { score, label, color };
}
