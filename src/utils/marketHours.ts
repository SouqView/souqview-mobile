/**
 * US market hours (NYSE/NASDAQ) in America/New_York.
 * Pre-Market 04:00–09:30, Regular 09:30–16:00, After Hours 16:00–20:00.
 */

const TIMEZONE = 'America/New_York';
const MS_PER_HOUR = 60 * 60 * 1000;
const STALE_QUOTE_HOURS = 24;

export type MarketStatusResult = {
  status: string;
  color: string;
  dotColor: string;
};

/** Green – market open */
const OPEN_COLOR = '#34C759';
const OPEN_DOT = OPEN_COLOR;

/** Orange – pre-market / after hours */
const EXTENDED_COLOR = '#FF9500';
const EXTENDED_DOT = EXTENDED_COLOR;

/** Grey – closed */
const CLOSED_COLOR = '#8E8E93';
const CLOSED_DOT = CLOSED_COLOR;

/** Stale data override */
const DELAYED_COLOR = '#8E8E93';
const DELAYED_DOT = '#FF9500';

/**
 * Get current time in America/New_York and return hour (0–23) and minute (0–59).
 */
function getNYTime(now: Date): { hour: number; minute: number; weekday: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short',
  });
  const parts = formatter.formatToParts(now);
  let hour = 0;
  let minute = 0;
  let weekday = 1;
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  for (const p of parts) {
    if (p.type === 'hour') hour = parseInt(p.value, 10);
    if (p.type === 'minute') minute = parseInt(p.value, 10);
    if (p.type === 'weekday') weekday = weekdays[p.value] ?? 1;
  }
  return { hour, minute, weekday };
}

/**
 * Market status from current time (America/New_York).
 * Saturday/Sunday = Market Closed. Weekdays: Pre-Market 04:00–09:30, Open 09:30–16:00, After Hours 16:00–20:00, else Closed.
 */
export function getMarketStatus(now: Date = new Date()): MarketStatusResult {
  const { hour, minute, weekday } = getNYTime(now);
  const isWeekend = weekday === 0 || weekday === 6; // 0 = Sunday, 6 = Saturday
  const minutesSinceMidnight = hour * 60 + minute;

  if (isWeekend) {
    return { status: 'Market Closed', color: CLOSED_COLOR, dotColor: CLOSED_DOT };
  }

  const preMarketStart = 4 * 60;      // 04:00
  const marketOpen = 9 * 60 + 30;    // 09:30
  const marketClose = 16 * 60;        // 16:00
  const afterHoursEnd = 20 * 60;      // 20:00

  if (minutesSinceMidnight >= preMarketStart && minutesSinceMidnight < marketOpen) {
    return { status: 'Pre-Market', color: EXTENDED_COLOR, dotColor: EXTENDED_DOT };
  }
  if (minutesSinceMidnight >= marketOpen && minutesSinceMidnight < marketClose) {
    return { status: 'Market Open', color: OPEN_COLOR, dotColor: OPEN_DOT };
  }
  if (minutesSinceMidnight >= marketClose && minutesSinceMidnight < afterHoursEnd) {
    return { status: 'After Hours', color: EXTENDED_COLOR, dotColor: EXTENDED_DOT };
  }

  return { status: 'Market Closed', color: CLOSED_COLOR, dotColor: CLOSED_DOT };
}

/**
 * If quote timestamp is older than 24 hours, return a "Data Delayed" status;
 * otherwise return the normal market status.
 * quoteTimestamp: optional; Unix seconds or milliseconds, or ISO string.
 */
export function getMarketStatusWithQuote(
  quoteTimestamp?: number | string | null,
  now: Date = new Date()
): MarketStatusResult {
  if (quoteTimestamp != null) {
    const ms = typeof quoteTimestamp === 'string'
      ? new Date(quoteTimestamp).getTime()
      : quoteTimestamp < 1e12
        ? quoteTimestamp * 1000
        : quoteTimestamp;
    if (Number.isFinite(ms)) {
      const ageHours = (now.getTime() - ms) / MS_PER_HOUR;
      if (ageHours > STALE_QUOTE_HOURS) {
        return { status: 'Data Delayed', color: DELAYED_COLOR, dotColor: DELAYED_DOT };
      }
    }
  }
  return getMarketStatus(now);
}
