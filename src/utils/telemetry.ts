/**
 * Silent telemetry for diagnostics. Captures symbol + endpoint on chart/API failures
 * without exposing technical errors to the user. No PII, no network.
 */

const LOG_PREFIX = '[SouqView Telemetry]';

export interface ChartUnavailablePayload {
  symbol: string;
  endpoint: string;
  /** Optional: 'no_data' | 'network' | 'rate_limit' */
  reason?: string;
}

/**
 * Log when "Chart Unavailable" is shown. Use for debugging and stability metrics.
 * Does not throw; does not send over network unless you add a reporter.
 */
export function logChartUnavailable(payload: ChartUnavailablePayload): void {
  try {
    if (__DEV__) {
      console.warn(
        `${LOG_PREFIX} Chart Unavailable`,
        JSON.stringify({ ...payload, ts: Date.now() })
      );
    }
    // Optional: enqueue for future analytics (e.g. AsyncStorage batch, or backend ping)
    // enqueueTelemetry('chart_unavailable', payload);
  } catch {
    // Silent: never break app for logging
  }
}
