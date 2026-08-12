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

## B1 — code health

Clean. Zero TODO/FIXME/HACK across the app. Largest file is 1434 lines
(`InventoryItems`), which the programme already ruled acceptable for a
big-but-cohesive screen (the /todo precedent — splitting it risks the build OOM).

One dead export removed: `InventoryHeader.INVENTORY_NAV_KEYS`, documented as a
"flat list of every inventory route" for mobile nav and breadcrumbs. **Nothing
has ever imported it**, and it only flattened `OVERFLOW_GROUPS` — so it was not
the complete route list its own comment claimed.

`InventoryUi.COLOR_TONE` looked dead to the same scan but is used three times
inside its own file. It is a token map in the app's UI-primitives file, so the
export is intentional API surface. **Left alone** — "unused elsewhere" is not
the same as dead.

## B3 — frontend perf

| | measured | budget |
|---|---|---|
| `/inventory` route entry | **10 chunks / 626 KB** | 13 / 675 ✅ |
| `/purchase` route entry | **8 chunks / 500 KB** | 11 / 549 ✅ |

**Warm-start mirror added to `/inventory/items`** — the standing W3+ deliverable.
The list now paints from `kx_inv_items_snap_v1` on the first frame instead of a
skeleton. Three rules from the pattern are encoded in the code:

- read it in the `useState` **initialiser**, never an effect (an effect-seeded
  value lays the screen out twice — the "card jumps then jumps back");
- persist **inside** the loader so every successful fetch refreshes it;
- mirror the **default view only** — this list filters *server-side* on
  q/type/status, so snapshotting a filtered response would repaint a search
  result as the whole catalogue on next open.

Verified: writes 33 rows / 57 KB, reads back, `loading` starts false when warm.
**Not verified by timing** — proving the first *frame* paints from the mirror
needs a probe that survives a reload, which I did not build. The claim rests on
the code path, which is the one `/todo` and Quotations already use.

## B4 — integration truth

Every one of the 13 `/api/inventory/*` routes the UI calls exists on disk.

**One broken promise, filed cross-app.** `InventoryItems` offers two menu items:

| menu item | href |
|---|---|
| Open Products | `/products` |
| Create Stock Profile for Existing Product | `/products?stock_profile=open` |

**Nothing anywhere reads `stock_profile` as a query param.** Both entries land on
the identical unfiltered screen, so the second one's label promises a filter it
does not deliver. The honest fix belongs in the Products app — teach `/products`
to filter to products that have no stock profile yet — so it is filed for its own
session rather than half-built here, following the precedent set for the
Documents ↔ QuotationA4Preview item.

`/api/inventory/summary` and `/api/inventory/valuation` are not reached by any UI
code. **Report-only, not deleted** — an endpoint with no UI caller can still be
legitimate API surface, and `lib/inventory/valuation.ts` behind it *is* live
(two routes import it). I misread that as dead on the first pass and corrected it.

## F2 — mobile parity

375×812, four screens — `/inventory`, `/balances`, `/warehouses`, `/movements`:
**none scrolls sideways, and no element escapes the viewport outside its own
`overflow-x` scroller.** The three overflowing nodes on `/items` are inside the
table's scroller, which is intentional.

## Status

| lens | Inventory | Purchases |
|---|---|---|
| B1 code health | ✅ clean · 1 dead export removed | ✅ clean |
| B2 data/API | ✅ `/api/me` ×2 → ×1 | ✅ 5 calls, zero dups |
| B3 frontend perf | ✅ under budget · warm-start added | ✅ under budget |
| B4 integration truth | ⚠️ one dead link, filed cross-app | ✅ |
| F1 UI/UX | ✅ 110 strings, app now trilingual | ⬜ not scanned |
| F2 mobile parity | ✅ 375px clean, 4 screens | ⬜ not scanned |

**Inventory: five of six lenses green**, B4 carrying one filed cross-app item.
**Purchases: B1–B4 green**; F1 and F2 were not scanned this session and are
honestly marked open rather than assumed from its clean API profile.

Build clean, `validate:budgets` 56/56.
