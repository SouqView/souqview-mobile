# Backend: Market snapshot – fix empty watchlist (502 + logging)

When the app shows **“Backend returned no symbols”**, the backend is returning **200** with **`marketSnapshot: []`** (or the symbols fallback returns empty). The app cannot tell “no data yet” from “data source failed”. Fix this on the backend as below.

---

## 1. Return 502 when the data source fails

**Do not** return **200** with `{ "marketSnapshot": [] }` when:

- The quote/snapshot provider (e.g. Twelve Data) request failed (network, 4xx/5xx, timeout).
- The provider returned no quotes or an error payload.
- After normalizing the provider response, you have **zero** valid items (e.g. all symbols missing or invalid).

In those cases, respond with:

- **Status:** `502 Bad Gateway`
- **Body (JSON):** `{ "marketSnapshot": [], "error": "<short message>" }`

Example:

```json
{ "marketSnapshot": [], "error": "Market snapshot fetch failed: Twelve Data rate limit" }
```

or

```json
{ "marketSnapshot": [], "error": "Market snapshot empty after normalize" }
```

This lets the app treat 502 as “data source problem” (and optionally show a different message than “backend returned no symbols”).

---

## 2. Log these messages in backend logs

So you can confirm behavior in **backend** logs (not the app):

| Situation | Log message (example) |
|-----------|------------------------|
| Quote/snapshot API call failed (network, 4xx/5xx, timeout) | `Market snapshot fetch failed: <reason>` |
| Provider returned empty or error payload | `Market snapshot fetch failed: empty or error response` |
| You have raw data but after normalizing there are no valid items | `Market snapshot empty after normalize` |
| Cache hit with non-empty data | e.g. `Market snapshot cache hit (NASDAQ)` (optional) |
| Cache miss, fetch succeeded | e.g. `Market snapshot cache warmed (NASDAQ)` (optional) |

Use the **exact** phrases **“Market snapshot fetch failed”** and **“Market snapshot empty after normalize”** so you can search backend logs when the watchlist shows no data.

---

## 3. When to return 200 with non-empty data

Return **200** with a **non-empty** `marketSnapshot` when:

- You have at least one valid quote/snapshot item (after normalizing) for the requested exchange or symbol list.

Response shape (array form):

```json
{
  "marketSnapshot": [
    { "symbol": "AAPL", "name": "Apple Inc.", "close": 278.12, "percent_change": 0.8 },
    { "symbol": "TSLA", "name": "Tesla Inc.", "close": 242.84, "percent_change": -1.02 }
  ]
}
```

Per-item: include **symbol** (or **ticker**) and at least one of **close** / **price** / **lastPrice** and **percent_change** (or **percentChange**). The app normalizes these.

---

## 4. Routes to implement correctly

1. **`GET /api/stock/market-snapshot/NASDAQ`** (and NYSE if used)  
   - Resolve symbols for the exchange (e.g. AAPL, TSLA, NVDA, SPY, MSFT, GOOGL, AMZN, META, AMD, JPM for NASDAQ).  
   - Try cache; on cache miss, call quote/snapshot API.  
   - If fetch fails or normalize yields no items → **502** + `error` message and log as in §2.  
   - If you have ≥1 item → **200** + non-empty `marketSnapshot`.

2. **`GET /api/stock/market-snapshot?symbols=AAPL,TSLA,...`**  
   - Same logic: fetch (or cache) for the given symbols; on failure or empty-after-normalize → **502**; otherwise **200** with non-empty `marketSnapshot`.

---

## 5. Secondary check (app / env)

If the **backend is not running** or the app cannot reach it:

- Set **EXPO_PUBLIC_API_URL** in the app to your backend base URL, e.g.  
  `http://localhost:5000/api` or `http://192.168.0.214:5000/api` (LAN).

The “Backend returned no symbols” banner is shown when the app gets **200** with empty `marketSnapshot` (or no items after normalize/filter). So if you see that banner, the app **did** reach the backend; the fix is on the backend to return **non-empty data** or **502** as above.

---

## Summary

| Backend situation | Response | Backend log |
|------------------|----------|-------------|
| Quote/snapshot API failed | **502** + `{ marketSnapshot: [], error: "..." }` | `Market snapshot fetch failed: ...` |
| Raw data normalized to zero items | **502** + `{ marketSnapshot: [], error: "..." }` | `Market snapshot empty after normalize` |
| At least one valid item | **200** + `{ marketSnapshot: [ ... ] }` | (optional) cache hit/warmed |

After implementing this, the watchlist will either get real snapshot data (200 + non-empty array) or the app can treat 502 as “data source failed” and show an appropriate message.

---

## Example backend code

See **[backend-market-snapshot-example.js](./backend-market-snapshot-example.js)** in this repo for a drop-in example: it throws (so the route sends 502) when the fetch fails or the list is empty after normalize, and logs the exact phrases above. Optional: set `USE_MOCK_SNAPSHOT_FALLBACK=1` in dev if you want to return mock data instead of 502 for easier testing.
