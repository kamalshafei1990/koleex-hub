# W3 · Inventory + Purchases — six-lens pass

**Measured** 2026-08-12 on `next start -p 3001` (prod bundles) + owner session + prod DB,
`performance.getEntriesByType('resource')`, counting only `deliveryType !== "cache"`.

## Baselines

| screen | real API calls | distinct endpoints | duplicates |
|---|---|---|---|
| `/inventory` | **9 → 7** | 6 | `/api/me` ×2 → **×1** |
| `/purchase` | **5** | 5 | **none** |

`/purchase` is the second-cleanest screen in the programme after Quotations — five calls,
five endpoints, nothing repeated. No code change was warranted and none was made.

## Two measurement artefacts that are NOT defects

Both would have been "fixed" by a careless pass, and both would have been wrong:

1. **`/api/dev/build-stamp` ×11, every 3s.** `DevReload` is gated to
   `["localhost","127.0.0.1"]` and no-ops in production. It is a *local measuring
   instrument*, and it must be **excluded from the count**, not removed. Raw count on
   `/inventory` was 18; the real number is 9.
2. **`/api/inventory/operator-summary` ×2, 14ms apart — on the DEV server only.** React
   StrictMode runs effects twice in development. The prod run measured ×1. **Verify a
   suspected duplicate against a prod build before touching it.**

Kept as cadence, correctly: `/api/version` and `/api/activity/heartbeat` fire twice
**65 seconds apart** — that is the poll interval, not a double-fire.

## B2 — the one real defect, fixed

`useInventoryViewMode` (InventoryUx.tsx) did a raw `fetch("/api/me", {cache:"no-store"})`
inside its own effect. The hook is mounted **twice on the same screen** — the view
switcher in `InventoryUx` and again in `InventoryDashboard` — so two parallel requests
went out 1ms apart. The SYS-2 signature again: coalescing bypassed by a raw fetch.

Fixed by routing through `cachedGet` (60s TTL — admin status does not change
mid-session), which coalesces the in-flight promise and is globalThis-anchored against
the SYS-4 chunk-duplication trap. **Measured after: ×1.** Commit `2ae0d604`.

## F1 — OPEN, sized, not started

Three inventory components contain **zero** `useTranslation` calls, and a fourth is only
partly done. Against the standing trilingual rule this is a real defect for an Arabic or
Chinese operator, and it is bigger than it looks:

| component | lines | `t()` calls | bare user-visible strings |
|---|---:|---:|---:|
| `InventoryItems.tsx` | 1465 | 21 | **55** |
| `InventoryWarehouses.tsx` | 368 | **0** | 21 |
| `InventoryBalances.tsx` | 363 | **0** | 18 |
| `InventoryMovements.tsx` | 1058 | 39 | 11 |
| `InventoryMovementDetail.tsx` | 273 | **0** | 3 |

**~110 strings across the app.** Eight of them are the table-cell "Loading…" text, where
the key `inv.loading` **already exists with zh/ar** and simply is not used — one file
(`InventorySerials`) does use it, which is how the inconsistency showed up.

Note: table-row and dialog-inline "Loading…" **text** is correct per the standing loading
rule (a logo in a table cell is noise). The defect is that it is untranslated, not that it
is text.

## Status

| lens | Inventory | Purchases |
|---|---|---|
| B1 code health | — not started | — not started |
| B2 data/API | ✅ fixed | ✅ clean |
| B3 frontend perf | ⬜ | ⬜ |
| B4 integration truth | ⬜ | ⬜ |
| F1 UI/UX | ⚠️ **~110 untranslated strings, sized above** | ⬜ |
| F2 mobile parity | ⬜ | ⬜ |

**Blocked on the full close:** the shared working tree currently does not type-check —
`components/contacts/Contacts.tsx` passes `boolean | undefined` to `PopoverPanel`'s `open`,
which another session has just tightened to `boolean`. Both files are that session's
uncommitted work. `npm run build` and therefore `validate:budgets` cannot pass until they
land it, so the remaining lenses cannot be closed with the gate green. The B2 fix above was
verified independently: `tsc` clean on the changed file, and the ×2 → ×1 measured on dev.
