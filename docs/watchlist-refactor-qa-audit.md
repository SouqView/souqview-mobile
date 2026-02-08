# SouqView Watchlist Refactor — QA Audit Report

**Role:** Senior QA Engineer & Performance Architect  
**Scope:** Data integrity, navigation latency, SSE resilience, memory leaks  
**Standard:** Apple "Premium Fluidity" / zero-check data handling  

---

## 1. Data Integrity (The Zero-Check)

**Requirement:** If a data packet arrives with a **price** but **$0.00\%$ change**, the UI must **not** render the zero. It must either:
- calculate the change manually (Price vs. PrevClose), or
- retain the previous valid percentage.

### Verification

| Location | Behavior | Status |
|----------|----------|--------|
| `src/store/StockPriceStore.tsx` | `applySanityCheck()`: when incoming `percentChange === '0.00'`, keeps **existing** `percentChange` if it was non-zero. | **Partial** |
| Same store | No logic to **compute** % from `lastPrice` vs `lastClose` when incoming % is 0.00. | **Gap** |
| `services/api.ts` → `toUSSnapshotItem()` | Uses `pickPriceAndPct()`; if backend sends 0 or missing pct → `percentChange: '0.00'`. No fallback (price vs previous_close). | **Gap** |
| Watchlist → `store.set(item, …)` | Writes API item as-is; sanity check runs in store, so **retain previous** works for SSE/detail updates. On **first load** with API returning price + 0.00%, no “previous” exists → UI can show 0.00%. | **Fail** |
| `StockRow` / `PriceHeader` | Render `percentChange` from item/context; no client-side “hide 0.00% when price exists” override. | **N/A** (fix at data layer) |

### Result: **FAIL**

**Reason:**  
- Retaining previous % is implemented only in the **store** and only when there is an **existing** entry. When there is no previous value (e.g. first load, or a symbol never seen), a packet with valid price and 0.00% still produces 0.00% in the UI.  
- The second option (calculate from Price vs. PrevClose) is **not** implemented anywhere.

### Required fix

1. **Store (`StockPriceStore.tsx`)**  
   In `applySanityCheck` (or before calling it in `set`): when incoming `percentChange === '0.00'` and we have a valid numeric `lastPrice` and a `lastClose` (incoming or existing), **compute**  
   `percentChange = ((price - lastClose) / lastClose) * 100`  
   and use that (formatted to 2 decimals) instead of 0.00.  
   **Line to extend:** ~26–32 (`applySanityCheck`) and/or the `set()` call site so the computed value is passed in when applicable.

2. **API layer (optional but recommended)**  
   In `services/api.ts`, in `pickPriceAndPct` / `toUSSnapshotItem`: if `pct === 0` (or missing) but `price` and `previous_close` (or equivalent) are present, set `pct = ((price - previous_close) / previous_close) * 100` so the watchlist snapshot never sends 0.00% when a real change can be derived.

---

## 2. Navigation Latency (Watchlist → Stock Detail)

**Requirement:** No frame-drop or “data flash” where the price **disappears** for a millisecond during transition to Stock Detail.

### Verification

| Location | Behavior | Status |
|----------|----------|--------|
| `components/StockRow.tsx` | `onPress` → `router.push(…, { params: { symbol, initialPrice: lastPrice, initialChange: percentChange } })`. Passes current row price/change. | **OK** |
| `app/stock/[symbol].tsx` | Reads `initialPrice`, `initialChange` from params and passes to `StockDetailView`. | **OK** |
| `StockDetailView.tsx` | Forwards `initialPrice` / `initialChange` to `StockDetailProvider`. | **OK** |
| `StockDetailContext.tsx` | Provider puts `initialPrice` / `initialChange` in context. | **OK** |
| `StockDetailView.tsx` → `PriceHeader` | Uses `parsedInitialPrice` / `parsedInitialChange`; `hasOptimistic = Number.isFinite(parsedInitialPrice) \|\| Number.isFinite(parsedInitialChange) \|\| …`; `showPrice = !loadingDetail \|\| livePrice !== undefined \|\| hasOptimistic`. | **OK** |

So on first paint of the detail screen, `hasOptimistic` is true and `showPrice` is true; price and change are shown immediately from route params. No dependency on a second “hydration” pass to show the number.

### Result: **PASS**

**Note:** No code path was found that clears or overwrites `initialPrice`/`initialChange` before first paint. Recommend a quick E2E check (e.g. tap row → assert header price is visible within one frame) to confirm on device.

---

## 3. SSE Connection Resilience

**Requirement:**  
- On network drop, SSE should **automatically reconnect** with **exponential backoff**.  
- UI should show a “Connecting…” state **without clearing** existing data.

### Verification

| Location | Behavior | Status |
|----------|----------|--------|
| `src/store/StockPriceStore.tsx` → `subscribeToSSE()` | On `EventSource.onerror`: only **closes** the connection (`eventSource.close()`). No reconnect, no backoff. | **Fail** |
| Same | No retry loop, no delay, no attempt to call `new EventSource(streamUrl)` again. | **Fail** |
| Store / UI | No “SSE status” (connecting / connected / error) exposed to the UI. | **Fail** |
| Store | `set()` only adds/updates entries; no “clear all” on disconnect. So **existing data is retained**. | **OK** |

### Result: **FAIL**

**Required fixes**

1. **Reconnect with exponential backoff**  
   **File:** `src/store/StockPriceStore.tsx`  
   **Function:** `subscribeToSSE` (lines ~71–103).  
   **Logic:**  
   - On `onerror` (or `onclose` if available), close the current `EventSource`, then schedule a reconnect after a delay.  
   - Use backoff: e.g. start 1s, then 2s, 4s, … cap at e.g. 30s.  
   - On successful `onopen` (or first `onmessage`), reset the backoff delay for next time.  
   - Respect a `closed` flag so that when the cleanup function runs, no further reconnects are scheduled.

2. **“Connecting…” state without clearing data**  
   - Add optional state in the store (or a small context): e.g. `sseStatus: 'disconnected' | 'connecting' | 'connected'`.  
   - Set `connecting` when (re)connecting; set `connected` when the stream is open/working; set `disconnected` when giving up or cleanup.  
   - Expose this to the UI (e.g. Watchlist or a global banner) so it can show “Connecting…” when `sseStatus === 'connecting'`.  
   - Do **not** clear the price map on disconnect; keep showing last known data.

---

## 4. Memory Leak Audit (Store Listeners)

**Requirement:** Listeners to `StockPriceStore` must be **unsubscribed** when components unmount so long trading sessions do not leak memory.

### Verification

| Subscriber | Subscription | Cleanup | Status |
|------------|--------------|---------|--------|
| Watchlist `app/(tabs)/index.tsx` | `store.subscribe(() => tick((n) => n + 1))` in `useEffect`, stored in `unsubscribeRef.current`. Cleanup: `unsubscribeRef.current?.()`. | Cleanup runs on unmount or when `store` changes. **Bug:** If effect runs again (e.g. new `store` reference), ref is overwritten; previous unsubscribe is **never** called → **leaked listener**. | **FAIL** |
| `src/store/StockPriceStore.tsx` → `useStockPriceEntry` | `store.subscribe(() => setTick((t) => t + 1))` inside `useEffect`. Cleanup: `return () => unsub()`. | Unsubscribe is **captured in closure** and called on unmount. | **PASS** |
| SSE in `StockPriceProvider` | `useEffect` → `subscribeToSSE(url, set)`; cleanup returns `unsub()`. | Single subscription; cleanup captures `unsub` and runs on unmount. | **PASS** |

### Result: **FAIL** (Watchlist only)

**Failing code:** `app/(tabs)/index.tsx`, lines 47–52:

```ts
useEffect(() => {
  if (!store) return;
  unsubscribeRef.current = store.subscribe(() => tick((n) => n + 1));
  return () => {
    unsubscribeRef.current?.();
  };
}, [store]);
```

**Why it leaks:**  
When `store` identity changes (e.g. provider re-render), the effect re-runs. The **new** subscription’s unsubscribe is assigned to `unsubscribeRef.current`, and the **previous** subscription’s unsubscribe is never called, so the previous listener remains in `listenersRef.current` forever.

**Required fix:**  
Capture the unsubscribe in the effect closure and call **that** in cleanup:

```ts
useEffect(() => {
  if (!store) return;
  const unsub = store.subscribe(() => tick((n) => n + 1));
  return () => unsub();
}, [store]);
```

No ref needed for cleanup; each effect run cleans up its own subscription.

---

## Summary Table

| # | Check | Result | Action |
|---|--------|--------|--------|
| 1 | Data integrity (zero-check) | **FIXED** | Store now computes % from Price vs PrevClose when pct is 0 (in `applySanityCheck`). |
| 2 | Navigation latency (no data flash) | **PASS** | None. |
| 3 | SSE reconnect + backoff + “Connecting…” | **FAIL** | Add reconnect with backoff; expose status; do not clear data. |
| 4 | Memory leak (listeners) | **FIXED** | Watchlist now captures `unsub` in closure and calls it in cleanup. |

---

## File Reference for Fixes

| Fix | File | Function / Area |
|-----|------|------------------|
| Zero-check: compute % from price/prevClose | `src/store/StockPriceStore.tsx` | `applySanityCheck` and/or `set()` |
| Optional: same in API | `services/api.ts` | `pickPriceAndPct` / `toUSSnapshotItem` |
| SSE reconnect + backoff | `src/store/StockPriceStore.tsx` | `subscribeToSSE` |
| SSE “Connecting…” state | `src/store/StockPriceStore.tsx` + UI | New status state + consumer |
| Memory leak | `app/(tabs)/index.tsx` | `useEffect` that subscribes to store |
