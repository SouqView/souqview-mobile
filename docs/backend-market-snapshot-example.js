// --- Constants (at top of file or before routes) ---
const MARKET_SNAPSHOT_KEY_DEFAULT = 'market_snapshot_default';
const MARKET_SNAPSHOT_KEY_NYSE = 'market_snapshot_nyse';
const DEFAULT_SNAPSHOT_SYMBOLS = 'AAPL,TSLA,NVDA,SPY,MSFT,GOOGL,AMZN,META,AMD';
const NYSE_SNAPSHOT_SYMBOLS = 'AAPL,MSFT,JPM,V,JNJ,WMT';

// Optional: use only in dev if you want a fallback instead of 502 (set USE_MOCK_SNAPSHOT_FALLBACK=1)
const USE_MOCK_SNAPSHOT_FALLBACK = process.env.USE_MOCK_SNAPSHOT_FALLBACK === '1';
const MOCK_SNAPSHOT = {
  marketSnapshot: [
    { symbol: 'AAPL', name: 'Apple Inc.', price: 225.91, percent_change: 0.42, close: 225.91, lastPrice: '225.91', percentChange: '0.42' },
    { symbol: 'TSLA', name: 'Tesla Inc.', price: 242.84, percent_change: -1.02, close: 242.84, lastPrice: '242.84', percentChange: '-1.02' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 495.22, percent_change: 1.15, close: 495.22, lastPrice: '495.22', percentChange: '1.15' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', price: 378.50, percent_change: 0.28, close: 378.50, lastPrice: '378.50', percentChange: '0.28' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 172.30, percent_change: -0.15, close: 172.30, lastPrice: '172.30', percentChange: '-0.15' },
  ],
};

// --- Routes (register after express.json()) ---
app.get('/api/stock/market-snapshot', async (req, res) => {
  try {
    const out = await getMarketSnapshot(req);
    res.json(out);
  } catch (err) {
    const message = err?.message || 'Market snapshot fetch failed';
    console.error('Market snapshot fetch failed:', message);
    res.status(502).json({ marketSnapshot: [], error: message });
  }
});

app.get('/api/stock/market-snapshot/:symbols', async (req, res) => {
  try {
    const out = await getMarketSnapshot(req);
    res.json(out);
  } catch (err) {
    const message = err?.message || 'Market snapshot fetch failed';
    console.error('Market snapshot fetch failed:', message);
    res.status(502).json({ marketSnapshot: [], error: message });
  }
});

// --- Helpers ---
function normalizeQuoteToSnapshotItem(q) {
  if (!q || typeof q !== 'object') return null;
  const ticker = (q.symbol ?? q.Symbol ?? q.ticker ?? q.Ticker ?? q.code ?? q.instrument ?? q.name ?? '').toString().trim();
  const name = (q.name ?? q.shortName ?? q.longName ?? q.symbol ?? q.ticker ?? ticker).toString().trim();
  const num = (v) => (v != null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : null);
  const close = num(q.close ?? q.price ?? q.lastPrice ?? q.current_price);
  const previous_close = num(q.previous_close ?? q.regularMarketPreviousClose ?? q.open);
  let changePct = num(q.percent_change ?? q.change_percent ?? q.percentChange ?? q.changesPercentage);
  if ((changePct == null || changePct === 0) && close != null && previous_close != null && previous_close !== 0) {
    const derived = ((close - previous_close) / previous_close) * 100;
    if (Number.isFinite(derived)) changePct = derived;
  }
  const pctNum = changePct != null && !Number.isNaN(changePct) ? changePct : 0;
  const symbol = ticker ? ticker.toUpperCase() : (name ? name.toUpperCase() : '');
  if (!symbol) return null;
  return {
    symbol,
    name: name || symbol,
    price: close ?? null,
    close: close ?? null,
    percent_change: pctNum,
    lastClose: previous_close ?? undefined,
    lastPrice: close != null ? close.toFixed(2) : '—',
    percentChange: typeof pctNum === 'number' ? pctNum.toFixed(2) : '0.00',
  };
}

function snapshotListFromRaw(data) {
  if (!data || data.error) return [];
  let list;
  if (Array.isArray(data.data)) list = data.data;
  else if (data.symbol && typeof data.symbol === 'string') list = [data];
  else if (Array.isArray(data)) list = data;
  else if (data && typeof data === 'object' && !Array.isArray(data)) {
    const values = Object.values(data);
    list = values.every((v) => v && typeof v === 'object') ? values : [data];
  } else list = [data];
  return list.map(normalizeQuoteToSnapshotItem).filter(Boolean);
}

function resolveSnapshotRequest(req) {
  const querySymbols = req.query?.symbols;
  if (querySymbols && String(querySymbols).trim()) {
    const list = String(querySymbols).split(',').map((s) => s.trim()).filter(Boolean);
    if (list.length) return { symbols: list.join(','), cacheKey: `market_snapshot_${list.join(',')}` };
  }
  const param = (req.params?.symbols || '').toUpperCase();
  if (param === 'NYSE') return { symbols: NYSE_SNAPSHOT_SYMBOLS, cacheKey: MARKET_SNAPSHOT_KEY_NYSE };
  return { symbols: DEFAULT_SNAPSHOT_SYMBOLS, cacheKey: MARKET_SNAPSHOT_KEY_DEFAULT };
}

async function getMarketSnapshot(req) {
  const { symbols, cacheKey } = resolveSnapshotRequest(req);
  const cached = cache.get(cacheKey);
  if (cached && Array.isArray(cached.marketSnapshot) && cached.marketSnapshot.length > 0) {
    return cached;
  }
  let data;
  try {
    data = await fetchTwelveDataRaw('quote', { symbol: symbols });
  } catch (err) {
    const msg = err?.message || 'unknown';
    console.warn('Market snapshot fetch failed:', msg);
    if (USE_MOCK_SNAPSHOT_FALLBACK) return MOCK_SNAPSHOT;
    throw new Error(`Market snapshot fetch failed: ${msg}`);
  }
  if (data?.error) {
    console.warn('Market snapshot fetch failed:', data.error);
    if (USE_MOCK_SNAPSHOT_FALLBACK) return MOCK_SNAPSHOT;
    throw new Error(`Market snapshot fetch failed: ${data.error}`);
  }
  let marketSnapshot = snapshotListFromRaw(data);
  const symbolList = symbols.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  marketSnapshot = marketSnapshot
    .map((item, i) => {
      const assigned = (symbolList[i] || item.symbol || '').toString().toUpperCase().trim();
      const looksLikeTicker = assigned && assigned.length <= 6 && !assigned.includes(' ');
      const sym = looksLikeTicker ? assigned : (item.symbol && item.symbol.length <= 6 && !item.symbol.includes(' ') ? item.symbol : assigned);
      return { ...item, symbol: sym || item.symbol };
    })
    .filter((item) => item.symbol);
  if (marketSnapshot.length === 0) {
    console.warn('Market snapshot empty after normalize');
    if (USE_MOCK_SNAPSHOT_FALLBACK) return MOCK_SNAPSHOT;
    throw new Error('Market snapshot empty after normalize');
  }
  const out = {
    marketSnapshot: marketSnapshot.map((item) => ({
      symbol: item.symbol,
      name: item.name || item.symbol,
      price: item.price ?? item.close,
      percent_change: item.percent_change ?? 0,
      close: item.close,
      lastPrice: item.lastPrice,
      percentChange: item.percentChange,
      ...(item.lastClose != null ? { lastClose: item.lastClose } : {}),
    })),
  };
  cache.set(cacheKey, out, TTL_LIVE);
  return out;
}
