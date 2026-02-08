# Errors from logs – reference

From your terminal output, these are the errors and what they mean.

---

## 1. **“Price data unavailable. Check that the backend is running and EXPO_PUBLIC_API_URL is set…”**

**What you see:** Banner on the Watchlist with that text.

**What’s actually happening:**  
The backend **is** running and **is** reachable. The app gets a **200** response with:

- `Response top-level keys: ["marketSnapshot"]`
- `marketSnapshot type: array(0) | normalized: 0 | after filter: 0`

So the problem is **not** connectivity or `EXPO_PUBLIC_API_URL`. The backend is returning:

```json
{ "marketSnapshot": [] }
```

i.e. an **empty** `marketSnapshot` array. The app then uses its **fallback** list (10 placeholder symbols with “Loading…” prices) and sets `fromFallback: true`, which triggers the “Price data unavailable” banner.

**Why the backend might return `[]`:**

- Cache is empty and the quote/snapshot fetch (e.g. Twelve Data) failed or returned nothing.
- Backend route for `/api/stock/market-snapshot/NASDAQ` (or `?symbols=...`) is returning `marketSnapshot: []` on error instead of 502 + error body.
- Rate limit or error from the data provider so the backend builds an empty list and still returns 200.

**What to do:**

- On the **backend**: Ensure that when quote/snapshot data is available, you respond with a **non-empty** `marketSnapshot` array (e.g. `[{ "symbol": "AAPL", "close": 278.12, "percent_change": 0.8 }, ...]`). On failure, either return **502** with an error message or document that 200 + empty array means “no data”.
- On the **frontend**: The app will show a clearer message when the backend returns 200 but empty (see below).

---

## 2. **HTTP 429 – “Request failed with status code 429”**

**Where:** `[aiService] Request failed` for:

- `http://192.168.0.214:5000/api/faheem/forecast`
- `http://192.168.0.214:5000/api/faheem/overview`
- `http://192.168.0.214:5000/api/faheem/financials`
- `http://192.168.0.214:5000/api/faheem/technicals` (appears twice)

**Why:** **Rate limiting (429 Too Many Requests).** The server (or an upstream service the backend calls) is refusing further requests for a while. Common causes:

- Too many Faheem/AI requests in a short time (e.g. opening a stock and triggering forecast, overview, financials, technicals at once).
- Backend or upstream (e.g. Groq/DeepSeek) has a low rate limit and it’s exceeded.

**What to do:**  
Throttle or queue Faheem/AI calls (e.g. one after another, or delay after opening a stock), or increase backend/upstream rate limits. The app can catch 429 and show “Too many requests; try again later” instead of throwing.

---

## 3. **Failed request: `/api/stock/insider-transactions/AAPL`**

**What you see:**  
`[SouqView API] Failed request URL: http://192.168.0.214:5000/api/stock/insider-transactions/AAPL`

**Why:**  
The request to that URL failed. The log doesn’t show the status code; typical cases:

- **404** – Backend has no route or no data for that symbol.
- **429** – Rate limit (same idea as above).
- **500** – Backend or upstream error.

**What to do:**  
Confirm the backend implements `GET /api/stock/insider-transactions/:symbol` and returns 200 when data exists, or a proper error (e.g. 404/429) so the app can handle it.

---

## 4. **Watchlist: “No items after normalize/filter – using placeholder”**

**What you see:**  
`WARN [SouqView Watchlist] No items after normalize/filter – using placeholder. Backend should return non-empty marketSnapshot...`

**Why:**  
After calling:

1. `GET .../stock/market-snapshot/NASDAQ`  
2. Then `GET .../stock/market-snapshot?symbols=AAPL,TSLA,...`

the app got **no usable items** (normalized list is empty or everything is filtered out). So it uses the **placeholder** list and the “Price data unavailable” banner. In your logs, the backend returns **array(0)**, so the normalized list is empty. So this warning is the **same root cause** as §1: backend returned empty `marketSnapshot`.

---

## Summary table

| Log / UI | Cause |
|----------|--------|
| “Price data unavailable” banner | Backend returns `marketSnapshot: []`; app uses fallback and shows banner. Backend is reachable; data is empty. |
| `marketSnapshot type: array(0) \| normalized: 0 \| after filter: 0` | Backend responded with empty array. |
| `[aiService] Request failed ... 429` (faheem/forecast, overview, financials, technicals) | Rate limit (429) on those API calls. |
| `[SouqView API] Failed request URL: .../insider-transactions/AAPL` | Request to insider-transactions failed (404/429/500 or network). |
| “No items after normalize/filter – using placeholder” | Same as first row: no items from backend, so placeholder is used. |

---

## Takeaway

- **EXPO_PUBLIC_API_URL** and backend reachability are **fine** (you get 200 and `marketSnapshot` key).
- **Price data unavailable** is shown because the **backend returns an empty list** for the watchlist snapshot. Fix the backend so it returns a non-empty `marketSnapshot` when data exists, or return 502 when the data source fails.
- **429s** are from rate limiting on Faheem/AI endpoints; reduce request rate or increase limits.
- **Insider-transactions** failure is a separate backend/route/rate-limit issue; fix that route or handling.
