/**
 * Ticker sanitization for API requests. Ensures consistent format (e.g. AAPL vs NASDAQ:AAPL)
 * so backend/Twelve Data receive expected symbols and chart/quote requests succeed.
 */

/** Exchanges we support; backend may expect plain symbol for US. */
const US_EXCHANGES = ['NASDAQ', 'NYSE'] as const;

export type NormalizedTicker = {
  /** Plain symbol for API (e.g. AAPL). */
  symbol: string;
  /** Exchange prefix if needed by provider (e.g. NASDAQ:AAPL); otherwise same as symbol. */
  apiSymbol: string;
};

/**
 * Normalize user or list symbol to a consistent form. Strips exchange prefix for storage;
 * can produce provider-specific format (e.g. NASDAQ:AAPL) if backend requires it.
 * Default: return plain symbol for US stocks (backend handles exchange).
 */
export function normalizeTicker(
  input: string,
  options?: { withExchangePrefix?: boolean; exchange?: string }
): NormalizedTicker {
  const raw = (input ?? '').trim().toUpperCase();
  if (!raw) return { symbol: '', apiSymbol: '' };

  let symbol = raw;
  let exchange: string | undefined;

  const colon = raw.indexOf(':');
  if (colon > 0) {
    const prefix = raw.slice(0, colon);
    symbol = raw.slice(colon + 1).trim();
    if (US_EXCHANGES.includes(prefix as (typeof US_EXCHANGES)[number])) {
      exchange = prefix;
    }
  }

  const apiSymbol =
    options?.withExchangePrefix && (exchange || options?.exchange)
      ? `${exchange || options.exchange}:${symbol}`
      : symbol;

  return { symbol, apiSymbol };
}

/**
 * Sanitize a single symbol for request. Returns plain symbol (e.g. AAPL).
 */
export function sanitizeTicker(input: string): string {
  return normalizeTicker(input).symbol || input.trim().toUpperCase();
}
