import { filterUSStocksOnly, DEFAULT_US_WATCHLIST_SYMBOLS, US_EXCHANGE } from '../services/api';

describe('api', () => {
  describe('filterUSStocksOnly', () => {
    it('keeps US stock symbols', () => {
      const items = [
        { symbol: 'AAPL', name: 'Apple' },
        { symbol: 'MSFT', name: 'Microsoft' },
      ];
      expect(filterUSStocksOnly(items)).toHaveLength(2);
      expect(filterUSStocksOnly(items).map((i) => i.symbol)).toEqual(['AAPL', 'MSFT']);
    });

    it('filters out crypto symbols', () => {
      const items = [
        { symbol: 'BTC', name: 'Bitcoin' },
        { symbol: 'ETH', name: 'Ethereum' },
        { symbol: 'AAPL', name: 'Apple' },
      ];
      const result = filterUSStocksOnly(items);
      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('AAPL');
    });

    it('filters out ADX/DFM exchange symbols', () => {
      const items = [
        { symbol: 'ADX:XYZ', name: 'ADX Stock' },
        { symbol: 'DFM:ABC', name: 'DFM Stock' },
        { symbol: 'NVDA', name: 'NVIDIA' },
      ];
      const result = filterUSStocksOnly(items);
      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('NVDA');
    });

    it('returns empty array for empty input', () => {
      expect(filterUSStocksOnly([])).toEqual([]);
    });
  });

  describe('constants', () => {
    it('US_EXCHANGE is NASDAQ', () => {
      expect(US_EXCHANGE).toBe('NASDAQ');
    });

    it('DEFAULT_US_WATCHLIST_SYMBOLS includes major US symbols', () => {
      expect(DEFAULT_US_WATCHLIST_SYMBOLS).toContain('AAPL');
      expect(DEFAULT_US_WATCHLIST_SYMBOLS).toContain('TSLA');
      expect(DEFAULT_US_WATCHLIST_SYMBOLS).toContain('SPY');
    });
  });
});
