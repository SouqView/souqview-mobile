# Backend: Watchlist API (market-snapshot)

**Empty watchlist?** See **[backend-market-snapshot-checklist.md](./backend-market-snapshot-checklist.md)** for: return **502** when the data source fails (don’t return 200 with empty `marketSnapshot`), and log **"Market snapshot fetch failed"** / **"Market snapshot empty after normalize"** in backend logs.

## Backend implementation (current)

The backend now implements **cache + fetch** for both market-snapshot routes:

- **Both routes** use `getMarketSnapshot(req)`: try cache first (by resolved `cacheKey`); if cache is empty or missing, call Twelve Data quote for the resolved symbols, build `marketSnapshot`, cache it, and return it. So the Watchlist gets real data whenever the API responds, and still benefits from cache when warm.
- **Symbol resolution:** `resolveSnapshotRequest(req)` sets symbols and cache key from path or query:
  - **Path:** `GET /api/stock/market-snapshot/NASDAQ` → default list (AAPL, TSLA, NVDA, SPY, MSFT, GOOGL, AMZN, META, AMD); `NYSE` → AAPL, MSFT, JPM, V, JNJ, WMT.
  - **Query:** `?symbols=AAPL,TSLA,...` → use that list and cache under a key for that list.
- **Response shape:** Option A–friendly: each item has `symbol`, `name`, `close`, `lastPrice` (string), `percent_change` (number), `percentChange` (string). Raw fields from Twelve Data are normalized so the app can rely on `close` and `percent_change` (or string variants).
- **CORS:** `http://localhost:8081` and `http://localhost:19006` are in `CORS_ORIGINS`; middleware allows those origins. No change needed for web Watchlist.
- **Errors:** If Twelve Data fails, the route responds with **502** and `{ marketSnapshot: [], error: "<message>" }` so the client can distinguish server/API errors from “no symbols”.

---

## What the app calls

1. **Primary:** `GET /api/stock/market-snapshot/NASDAQ`  
   Used on Watchlist load. The app expects the response body to contain a **non-empty** `marketSnapshot`.

2. **Fallback (if primary is empty):** `GET /api/stock/market-snapshot?symbols=AAPL,TSLA,NVDA,SPY,MSFT,GOOGL,AMZN,...`  
   Same requirement: response must include a non-empty `marketSnapshot`.

## Required response shape

The response body must be JSON with a `marketSnapshot` field. `marketSnapshot` can be either:

### Option A – Array of quote objects (recommended)

```json
{
  "marketSnapshot": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "close": 225.91,
      "percent_change": 0.42
    },
    {
      "symbol": "TSLA",
      "name": "Tesla Inc.",
      "close": 242.84,
      "percent_change": -1.02
    }
  ]
}
```

**Per-item fields the app can use:**

- **Identifier:** `symbol` or `ticker` (required).
- **Name:** `name` (optional; falls back to symbol).
- **Price (one of):** `close`, `price`, `lastPrice`, `current_price`, `previous_close`, `last`; or nested under `quote` or `data` (e.g. `quote.close`).
- **Percent change (one of):** `percent_change`, `change`, `percentChange`, `changesPercentage`, `change_pct`, `change_percent`, `pct_change`; or nested under `quote` or `data`.

So you can match whatever your data source (e.g. Twelve Data) returns, as long as each item has something the app can map to symbol, price, and percent change.

### Option B – Object keyed by symbol

```json
{
  "marketSnapshot": {
    "AAPL": { "symbol": "AAPL", "name": "Apple Inc.", "close": 225.91, "percent_change": 0.42 },
    "TSLA": { "symbol": "TSLA", "name": "Tesla Inc.", "close": 242.84, "percent_change": -1.02 }
  }
}
```

The app normalizes both shapes; the critical part is that **`marketSnapshot` is not empty**.

## What to fix in the backend

1. **`GET /stock/market-snapshot/:exchange` (e.g. `/stock/market-snapshot/NASDAQ`)**  
   - When the exchange is NASDAQ (or NYSE), resolve a list of symbols (e.g. AAPL, TSLA, NVDA, SPY, MSFT, GOOGL, AMZN, META, AMD, JPM).  
   - Call your quote provider (e.g. Twelve Data “quote” or “batch quote”) for those symbols.  
   - Put the results into `marketSnapshot` as either an **array** (Option A) or **object keyed by symbol** (Option B).  
   - Return `{ "marketSnapshot": [ ... ] }` or `{ "marketSnapshot": { "AAPL": {...}, ... } }` with at least one item.  
   - Do **not** return `{ "marketSnapshot": [] }` when you have quote data.

2. **`GET /stock/market-snapshot?symbols=AAPL,TSLA,...`** (if you support it)  
   - Same idea: fetch quotes for the given symbols and return them in `marketSnapshot` (array or object keyed by symbol).  
   - The app uses this as a fallback when the exchange endpoint returns empty.

3. **CORS (for web)**  
   - If the app runs in the browser (e.g. Expo web at `http://localhost:8081`), the backend must send CORS headers so the browser allows the response.  
   - For example: `Access-Control-Allow-Origin: http://localhost:8081` (or the exact origin of the app).  
   - Without this, the web Watchlist will still get no data even if the backend returns a non-empty `marketSnapshot`.

## Summary

- **Backend (implemented):** Both routes use cache-then-fetch; NASDAQ and `?symbols=` return non-empty `marketSnapshot` (array) when Twelve Data succeeds; on failure, 502 with `marketSnapshot: []` and `error` message.
- **App contract:** Expects non-empty `marketSnapshot` (array or symbol-keyed object) with symbol, price (e.g. `close`), and percent change (e.g. `percent_change`) per item; CORS allowed for app origin on web.
