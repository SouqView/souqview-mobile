# Watchlist ↔ Stock Detail: Full Deep Study

This document describes **every part** of the watchlist logic and how it connects to the stock detail screen when the user taps a stock. Use it to debug, refactor, or improve the flow.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Root: ErrorBoundary → AuthProvider → ThemeProvider → … → StockPriceProvider │
│        (app/_layout.tsx)                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ├── (tabs)/index.tsx  ───────────  WatchlistScreen
         │        │
         │        ├── getUSMarketSnapshot()  →  services/api.ts (client: api/client.ts)
         │        ├── useOptionalStockPriceStore()
         │        ├── displayItems = mergeWithStore(items, store)
         │        └── FlatList → StockRow(item)  [tap → router.push]
         │
         └── stock/[symbol].tsx  ───────────  StockScreen
                  │
                  └── StockDetailView(symbol, initialPrice, initialChange)
                            │
                            └── StockDetailProvider(symbol, initialPrice, initialChange)
                                      │
                                      ├── useStockData(symbol)  →  getStockDetails  →  StockPriceStore.set()
                                      ├── useLivePrice(symbol, 5000)  →  fetchQuoteUncached (detail only)
                                      └── PriceHeader uses: livePrice → detail quote → initialPrice/initialChange
```

- **Single Source of Truth for price:** `StockPriceStore` (context in `StockPriceStore.tsx`). Both the **Watchlist** and the **Stock Detail** write into it; the Watchlist also **reads** from it to show the latest price/change per row.
- **Optimistic UI:** When the user taps a row, the app navigates with `initialPrice` and `initialChange` in the route params so the detail screen can show that price **immediately** while the full detail loads.

---

## 2. Watchlist Screen (`app/(tabs)/index.tsx`)

### 2.1 State and refs

| State/Ref | Type | Purpose |
|-----------|------|---------|
| `items` | `USSnapshotItem[]` | List from API (or placeholder). |
| `isPlaceholderData` | `boolean` | True when `getUSMarketSnapshot()` returned `fromFallback: true` (no real backend data). |
| `isInitialLoading` | `boolean` | True until first load finishes. |
| `error` | `string \| null` | User-facing error (e.g. 429, 5xx). |
| `pollRef` | `setInterval` ref | Polling timer; cleared when tab not focused. |
| `hasDataRef` | `boolean` ref | True once we ever got a non-empty list (used for retry logic). |
| `initialLoadRetryRef` | `boolean` ref | Ensures we only retry once after first load if we had no data. |

### 2.2 Store subscription

- **`useOptionalStockPriceStore()`** – returns the store if inside `StockPriceProvider`, else `null`.
- **`store.subscribe(() => tick(n => n + 1))`** – on any store update, the Watchlist re-renders so `displayItems` (merge with store) is up to date.

### 2.3 Load flow: `loadSnapshot(silent?)`

1. If not `silent`: clear `error`, set `isInitialLoading` true (unless we already have data).
2. **`getUSMarketSnapshot()`** (see §4) → returns `{ marketSnapshot: USSnapshotItem[], fromFallback?: boolean }`.
3. On success:
   - `hasDataRef.current = true` if list non-empty.
   - `setIsPlaceholderData(Boolean(res.fromFallback))`.
   - For each item, **`store.set(item.symbol, { lastPrice, percentChange })`** (with `updatedAt` set inside the store).
   - `setItems(list)`.
4. On catch: set `error` from status/message, `setItems([])`.
5. In `finally`: `setIsInitialLoading(false)`.

So: **every successful watchlist load writes into `StockPriceStore`** for each symbol in the snapshot.

### 2.4 When load runs

- **On mount / when `loadSnapshot` identity changes:** `useEffect(() => loadSnapshot(false), [loadSnapshot])`.
- **First-load retry:** If first load finished with no data (`!hasDataRef.current`) and not loading, retry once after `WATCHLIST_FIRST_LOAD_RETRY_MS` (2.5s).
- **When tab focused:** On focus, run `loadSnapshot(true)` once, then **poll every `WATCHLIST_POLL_INTERVAL_MS` (10s)**. On blur, clear the interval.
- **Stale “pulse”:** If any visible symbol has store data older than 60s (`store.isStale(item.symbol)`), schedule a silent refresh after 2s.

### 2.5 Display list and merge with store

- **`displayItems`** = if store exists: `items.map(item => mergeWithStore(item, store.get(item.symbol)))`, else `items`.
- **`mergeWithStore`:** If the store has an entry for that symbol and it’s **not stale** (< 60s), the row uses the store’s `lastPrice` and `percentChange`; otherwise it uses the snapshot item’s values. So **detail-screen updates (from useStockData or useLivePrice writing to the store) show up on the Watchlist** when the user goes back.

### 2.6 UI branches

- **Error + not loading:** Full-screen “Market Data Unavailable” + message + Retry.
- **Placeholder data + not loading + items length > 0:** Banner: “Price data unavailable. Check that the backend is running and EXPO_PUBLIC_API_URL…”
- **Initial loading:** 6 skeleton rows.
- **Else:** `FlatList` with `data={displayItems}`, `renderItem` → `StockRow(item)`.

Constants: `WATCHLIST_POLL_INTERVAL_MS = 10000`, `WATCHLIST_FIRST_LOAD_RETRY_MS = 2500`, `STALE_THRESHOLD_MS = 60 * 1000`.

---

## 3. StockRow (`components/StockRow.tsx`)

- **Props:** `item: USSnapshotItem` (symbol, name, lastPrice, percentChange, optional image/summary).
- **Renders:** Logo (`StockLogo`), symbol, name, lastPrice, percent-change chip, chevron.
- **onPress:**
  - Haptic (non-web).
  - **`router.push({ pathname: '/stock/[symbol]', params: { symbol: item.symbol, initialPrice: lastPrice, initialChange: percentChange } })`**

So the **only** data passed from Watchlist to Detail at tap time are **symbol**, **initialPrice** (string), and **initialChange** (string). The detail screen uses these for optimistic header price until its own data loads.

- **Memo:** Re-renders only when `item.symbol`, `item.lastPrice`, or `item.percentChange` change.

---

## 4. API Layer: Watchlist Data

### 4.1 HTTP client (`api/client.ts`)

- **Base URL:** `process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api'`.
- **Axios:** `baseURL`, 15s timeout, JSON, `withCredentials: !isWeb`.
- **Interceptors:** Log request URL in __DEV__; on error log failed URL.

So watchlist calls are: `GET {BASE_URL}/stock/market-snapshot/NASDAQ` or `GET {BASE_URL}/stock/market-snapshot?symbols=AAPL,TSLA,...`.

### 4.2 `getMarketSnapshot(exchange)` (`services/api.ts`)

- `const { data } = await client.get(\`/stock/market-snapshot/${exchange}\`)`
- Returns **response body** `data` (whatever the backend returns).

### 4.3 `getUSMarketSnapshot()` – full flow

- **Return type:** `Promise<USMarketSnapshotResult>` where `USMarketSnapshotResult = { marketSnapshot: USSnapshotItem[]; fromFallback?: boolean }`.
- **Fallback:** If anything fails or we end up with 0 items after filtering, return a **placeholder** list: first 10 of `DEFAULT_US_WATCHLIST_SYMBOLS` with `lastPrice: '—'`, `percentChange: '0.00'`, and **`fromFallback: true`**.

Steps:

1. **Try primary:** `data = await getMarketSnapshot(US_EXCHANGE)` with `US_EXCHANGE = 'NASDAQ'`.
2. **Normalize:** `snapshot = normalizeMarketSnapshotResponse(data)` (see below).
3. **Filter:** `filterUSStocksOnly(snapshot)` then keep only items whose `symbol` is in `DEFAULT_US_WATCHLIST_SYMBOLS`.
4. If **filtered.length > 0** → return `{ marketSnapshot: filtered }` (no `fromFallback`).
5. **Try symbols endpoint:** `GET /stock/market-snapshot?symbols=AAPL,TSLA,...` (first 10), same normalize + filter. If any items → return them.
6. **Else** (empty or wrong shape): return **fallback()** with `fromFallback: true`.
7. **Catch:** If base URL is not localhost/127.0.0.1, **retry** with `http://localhost:5000/api/stock/market-snapshot/NASDAQ`. If that returns items, return them; otherwise return fallback().

So the Watchlist can show “real” data only when the backend returns a non-empty list that survives normalization and symbol filter.

### 4.4 Normalization: `normalizeMarketSnapshotResponse(data)`

- **Input:** Backend response body (array or object).
- **Output:** `USSnapshotItem[]`.

Logic:

- If `data` is an **array** → use it as the list.
- Else if object:
  - **rawList** = `obj.marketSnapshot ?? obj.quotes ?? obj.result ??` or from `obj.data` (array or `obj.data.marketSnapshot`).
  - If **rawList** is an object (not array), try to unwrap: `inner.marketSnapshot ?? inner.data ?? inner.results ?? inner.quotes ?? inner.list`; if that’s an array, use it.
  - If **rawList** is array → list = rawList.
  - Else if rawList is object → **objectKeyedBySymbolToArray(rawList)** (each key = symbol, value = item; output array of `{ ...item, symbol }`).
  - Else if `obj.data` is object → same symbol-keyed conversion.
- Then: filter to non-null objects, **map each with `toUSSnapshotItem(item)`**.

### 4.5 `toUSSnapshotItem(raw)`

- **Symbol:** `raw.symbol ?? raw.ticker ?? raw.Symbol ?? raw.Ticker ?? ''` then `raw.name` as fallback; uppercase, trim; if still empty → `'—'`.
- **Name:** from `raw.name` or symbol.
- **Price / percent:** `pickPriceAndPct(raw)`:
  - Looks at `raw.quote`, `raw.data`, or `raw` for: `lastPrice`, `price`, `close`, `current_price`, etc., and `percentChange`, `percent_change`, `changesPercentage`, etc. (including nested under `quote`/`data`).
- **lastPrice:** number → string (2 or 4 decimals), or `'—'` if not finite.
- **percentChange:** number → 2 decimals or `'0.00'`.

So if the backend sends one item with empty `symbol` or missing price keys, you can get one normalized item with `symbol: '—'` and `lastPrice: '—'`. That item is then **dropped** by the filter (allowed set is only AAPL, TSLA, …), hence “normalized: 1, after filter: 0”.

### 4.6 Allowed symbols

- **`DEFAULT_US_WATCHLIST_SYMBOLS`** = `['AAPL','TSLA','NVDA','SPY','MSFT','GOOGL','AMZN','META','AMD','JPM']`.
- Only items with `allowed.has(item.symbol)` are returned. So the backend must return items whose **normalized** symbol is one of these.

---

## 5. Stock Detail Route and View

### 5.1 Route: `app/stock/[symbol].tsx`

- **Params:** `useLocalSearchParams<{ symbol: string; initialPrice?: string; initialChange?: string }>()`.
- Renders: `<StockDetailView symbol={ticker} initialPrice={initialPrice} initialChange={initialChange} />`.

So **symbol**, **initialPrice**, and **initialChange** come from the Watchlist’s `router.push` params.

### 5.2 `StockDetailView` (`components/StockDashboard/StockDetailView.tsx`)

- **Props:** `symbol`, `initialPrice?`, `initialChange?` (from route).
- Wraps everything in **`StockDetailProvider`** with those three props, then renders:
  - **PriceHeader** (price + change + aura)
  - Material top tabs (Overview, News, Financials, Technicals, Forecast AI, Insiders, Community)
  - **TradeButtonWrapper**

So the **only** place the watchlist “connection” is visible is: (1) route params, (2) **StockDetailProvider** and **PriceHeader** using `initialPrice` / `initialChange`.

---

## 6. StockDetailContext (`contexts/StockDetailContext.tsx`)

- **StockDetailProvider** receives `symbol`, `initialPrice`, `initialChange` and puts them in context value as-is.
- **Data:** Uses **`useStockData(symbol)`** for `detail`, `historical`, `loadingDetail`, `error`, `reload`, `symbolForAi`, `chartUnavailable`. Other tabs load news, financials, technicals, insiders, overview insight via separate API calls.
- **Context value** includes `initialPrice` and `initialChange` so **PriceHeader** can read them for optimistic display.

So **detail/quote/historical** all come from **useStockData**, not from the watchlist; the watchlist only supplies **initial** price/change strings for the header until detail loads.

---

## 7. useStockData (`src/hooks/useStockData.ts`)

- **Role:** Load **detail** (quote + profile + statistics) and **historical** for the current symbol. **Writes to StockPriceStore** when detail loads so Watchlist and Detail stay in sync.
- **Cache:** In-memory `cache` (Map) per symbol: `{ detail, historical, updatedAt }`. Entries used only when `updatedAt` within last 60s.
- **Abort:** When `symbol` changes, previous request is aborted (AbortController).
- **Flow:**
  1. If cached and fresh → set detail/historical from cache, clear loading.
  2. Else call **`getStockDetails(symbol, { signal })`** (from `marketData.ts`, which uses **dataFetcher.fetchStockDetail**).
  3. On success: **mapResultToDetail(result)** → set detail/historical, update cache, and **if store exists** → **stockPriceStore.set(symbol, { lastPrice, percentChange, lastClose? })** (from quote/statistics).
  4. On RATE_LIMIT → set error state.
  5. On catch (non-abort) → clear detail/historical.

So **opening a stock detail triggers a full stock-detail fetch**; when that completes, the **store is updated** for that symbol. When the user goes back to the Watchlist, **mergeWithStore** will show that updated price/change.

---

## 8. Stock Detail: PriceHeader and price priority

**PriceHeader** (inside StockDetailView) decides what price and percent change to show:

- **livePrice / livePercentChange** from **useLivePrice(symbol, 5000)** – only when detail screen is focused; polls every 5s via **fetchQuoteUncached**.
- **detail.quote / detail.statistics** – from useStockData (quote.close, statistics.currentPrice, statistics.percent_change).
- **initialPriceStr / initialChangeStr** – from route params (Watchlist tap). Parsed to numbers only when not `'—'` or empty.

**Priority:**

1. **Price:** `livePrice` ?? `effectivePrice` (from quote/statistics, or last close when market closed) ?? `parsedInitialPrice` ?? fallback.
2. **Change:** `livePercentChange` ?? from detail ?? `parsedInitialChange` ?? 0.

So: **Live poll > Detail fetch > Watchlist initial params.** The Watchlist’s `initialPrice`/`initialChange` are used only until the detail (or live) data is available.

---

## 9. useLivePrice (`src/hooks/useLivePrice.ts`)

- **When:** Only while **screen is focused** (`useIsFocused()`).
- **Calls:** **fetchQuoteUncached(symbol)** every `intervalMs` (default 5000).
- **fetchQuoteUncached** (marketData.ts): `get('/stock/stock-detail', { symbol })` then returns `data?.quote ?? data` (no write to StockPriceStore here).
- **Returns:** `currentPrice`, `previousPrice`, `percentChange`, `loading`. Used only by **PriceHeader** for display and flash animation. So **live price on the detail screen does not update the Watchlist** until the user navigates back and either (1) the Watchlist poll runs and overwrites with snapshot, or (2) useStockData had already written that symbol to the store when detail loaded (later live polls don’t write to store).

---

## 10. StockPriceStore (`src/store/StockPriceStore.tsx`)

- **Provider:** Wraps the app in `_layout.tsx` (under Theme, Portfolio, etc.).
- **Storage:** In-memory `Map<string, StockPriceEntry>` keyed by **uppercase symbol**. Entry: `{ lastPrice, percentChange, updatedAt, lastClose? }`.
- **Methods:**
  - **get(symbol)** – return entry or undefined.
  - **set(symbol, { lastPrice, percentChange, lastClose? })** – set entry with `updatedAt = Date.now()`, then **notify** all subscribers.
  - **isStale(symbol)** – true if no entry or `Date.now() - updatedAt > 60_000`.
  - **pulse(symbol)** / **pulseAll(symbols)** – notify (consumers can use this to trigger refresh; store itself doesn’t fetch).
  - **subscribe(listener)** – returns unsubscribe.

**Who writes:**

1. **Watchlist:** On every successful **getUSMarketSnapshot()** result, for each item: `store.set(item.symbol, { lastPrice, percentChange })`.
2. **Stock Detail (useStockData):** After **getStockDetails** succeeds, `stockPriceStore.set(symbol, { lastPrice, percentChange, lastClose? })`.

**Who reads:**

1. **Watchlist:** `store.get(item.symbol)` inside **mergeWithStore** to build **displayItems**. So rows show the latest from store when not stale; otherwise snapshot.
2. **useStockPriceEntry(symbol)** – hook for a single symbol (optional use elsewhere).

So the Watchlist and the Detail screen **share** the same price SSoT for each symbol; the Watchlist also **drives** the initial load and polling, and the Detail **updates** the store when its own fetch completes.

---

## 11. End-to-End Data Flow (Summary)

**User opens app (Watchlist tab):**

1. Watchlist mounts → `loadSnapshot(false)` → `getUSMarketSnapshot()`.
2. API: `GET .../stock/market-snapshot/NASDAQ` (or fallback symbols URL / localhost retry).
3. Response normalized → filtered to allowed symbols → `setItems(list)` and `store.set()` for each.
4. FlatList shows **displayItems** = items merged with store. Each row is **StockRow(item)**.

**User taps a row (e.g. AAPL):**

1. **StockRow** calls `router.push('/stock/[symbol]', { params: { symbol, initialPrice, initialChange } })`.
2. **StockScreen** renders **StockDetailView(symbol, initialPrice, initialChange)**.
3. **StockDetailProvider** runs **useStockData(symbol)** (and passes initialPrice/initialChange in context).
4. **PriceHeader** shows **initialPrice** / **initialChange** immediately (optimistic).
5. **useStockData** runs: cache check → **getStockDetails(symbol)** (quote + profile + historical). On success → **store.set(symbol, …)** and set detail/historical.
6. **useLivePrice(symbol, 5000)** starts polling **fetchQuoteUncached** every 5s; PriceHeader prefers live price when available.
7. When user goes **back**, Watchlist’s **displayItems** use **mergeWithStore**; if store was updated by useStockData (or a later watchlist poll), the row shows the latest price/change.

**Backend / normalization issues:**

- If backend returns **empty** or **one malformed item** (e.g. symbol `""` → normalized `"—"`), filtered list is empty → **fallback** list with `fromFallback: true` → placeholder banner and rows with "—" / "0.00%".
- If backend returns **array of items** with correct `symbol` and price fields, normalization and filter keep them and the Watchlist shows real data.

---

## 12. Improvement Ideas

1. **Watchlist → Detail**
   - Pass a **full snapshot item** (or at least `name`) in params so the detail header can show company name before profile loads (e.g. via a small “initialName” in context).
   - Optionally pass **lastClose** in params if the backend provides it, for “market closed” display.

2. **Detail → Watchlist**
   - **useLivePrice** could write to **StockPriceStore** on each poll so that when the user goes back to the Watchlist, the row already shows the latest live price without waiting for the next watchlist poll.
   - Alternatively, keep current behavior (detail only reads live for its own header) and rely on store updates from useStockData + watchlist poll.

3. **Single source of truth**
   - Today: Watchlist poll and Detail fetch both write to the store; live price on detail does not. You could make “last updated” source explicit (e.g. `source: 'watchlist' | 'detail'`) and optionally prefer detail when both exist (e.g. when returning from detail).

4. **Backend contract**
   - Ensure backend returns **one object per symbol** with **symbol**, **close** (or lastPrice), **percent_change** (or percentChange). Avoid returning a single summary object with empty symbol so normalization doesn’t produce `symbol: '—'` and get filtered out.
   - Optionally support **symbol-keyed** response `{ marketSnapshot: { AAPL: {...}, TSLA: {...} } }`; the app already normalizes it via **objectKeyedBySymbolToArray**.

5. **Loading and errors**
   - On Detail, if **initialPrice**/**initialChange** are missing (e.g. user opened from deep link), PriceHeader already falls back to detail/live; you could show a short “Loading…” in the price area when `!showPrice` and `loadingDetail`.

6. **Polling and staleness**
   - Watchlist: 10s poll when focused; store entries older than 60s trigger a silent refresh after 2s. You could add **pulse(symbol)** when returning to Watchlist for the visible symbols so the next poll runs sooner.
   - Detail: useLivePrice 5s; no store write. Unify “refresh” strategy (who writes, when) if you want the Watchlist to always reflect the last seen price on detail.

7. **Performance**
   - **StockRow** is memoized by symbol/lastPrice/percentChange; **displayItems** change when store or items change. If the list is large, consider **FlatList** optimization (getItemLayout, maxToRenderPerBatch, windowSize).
   - Watchlist **loadSnapshot** is in **useCallback([store])**; effects depend on it. Stable identity avoids unnecessary double loads when store is null then set.

8. **Debugging**
   - __DEV__ logs: Watchlist (GET URL, response keys, normalized/filtered counts, first item), API (request URL, failure URL). Keep these to trace “array(1) | after filter: 0” and similar.
   - Optional: dev-only “last updated” timestamp per symbol in the store and show it on the row or in the detail header.

---

## 13. File Reference

| Concern | File(s) |
|--------|---------|
| Watchlist screen | `app/(tabs)/index.tsx` |
| Stock row (tap, params) | `components/StockRow.tsx` |
| Stock route | `app/stock/[symbol].tsx` |
| Detail view + header | `components/StockDashboard/StockDetailView.tsx` |
| Detail context | `contexts/StockDetailContext.tsx` |
| Detail data + store write | `src/hooks/useStockData.ts` |
| Live price (detail) | `src/hooks/useLivePrice.ts` |
| Price store | `src/store/StockPriceStore.tsx` |
| Watchlist API | `services/api.ts` (getUSMarketSnapshot, getMarketSnapshot, normalize, toUSSnapshotItem, pickPriceAndPct) |
| HTTP client | `api/client.ts` |
| Detail fetch | `src/services/marketData.ts` (getStockDetails), `src/services/dataFetcher.ts` (fetchStockDetail) |
| Backend GET | `src/api/backend.ts` (used by marketData/dataFetcher) |
| Root layout + providers | `app/_layout.tsx` |

This is the full picture of the watchlist logic and its connection to the stock detail screen.
