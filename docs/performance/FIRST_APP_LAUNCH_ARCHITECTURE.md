# First Application Launch — Architecture

**Phase 4 — Cold Start & First Application Launch.** How a press on a Home app
card becomes a usable application, and where each layer is warmed.

---

## The three warm layers (do not conflate them)

| Layer | Warmed by | When | Covers |
|---|---|---|---|
| **1. Route / RSC shell** | Next `<Link prefetch>` / `router.prefetch()` | viewport-enter (Tier A/B) or hover/focus intent (Tier C) | route segment code + RSC payload |
| **2. Real client app chunk** | `preloadAppChunk(appId)` (`src/lib/app-chunk-preload.ts`) | hover/focus/touch **intent**, and top-2 apps on Home **idle** | the `next/dynamic(() => import("./App"))` client component the route lazy-loads |
| **3. Business data** | the app's own `useQuery` / list fetch | **after navigation only** | tenant/customer/app rows — never preloaded |

> Route prefetch warms the route. Dynamic preload warms the real app. Business
> data stays unfetched until navigation. Layer 2 is the layer that was missing
> and is the reason first launch was slow while warm launch was instant.

```
        ┌─ Layer 1: route/RSC  (Next Link prefetch)        ── cheap, already warm
press ──┤
        └─ Layer 2: client chunk (preloadAppChunk)         ── WAS COLD → now warmed
                     │                                         on intent / idle
                     └─ Layer 3: business data (useQuery)   ── still on-navigation
```

---

## `app-chunk-preload.ts` — the registry

```ts
const CHUNK_PRELOADERS = {
  crm:        () => import("@/components/crm/CRM"),
  customers:  () => import("@/components/contacts/Contacts"),
  suppliers:  () => import("@/components/contacts/Contacts"),
  quotations: () => import("@/components/quotations/Quotations"),
};
```

* Each preloader imports the **same module the route lazy-loads**, so webpack
  dedupes the chunk — warming it means the route's own `dynamic()` resolves
  instantly.
* `preloadAppChunk(id)` is **deduped per session** (`warmed` set) and
  **best-effort** — a failed warm silently allows the chunk to load on click as
  before, and permits a later retry.
* `wasChunkWarmed(id)` classifies a launch **cold vs warm** for telemetry. Apps
  with no preloader are treated as "warm" (no cold chunk to pay for).
* The registry touches **no `/api`** — it warms *code*, never data. It is only
  ever called with **authorized** app ids (the caller already filters by
  permitted modules), so an unauthorized app is never preloaded.

### Why Customers/Suppliers warm the legacy chunk
The registry warms the **production-default legacy** `Contacts` chunk (used by
the vast majority of users). Cohort/server-list users load their smaller adapter
on click via the route's own dynamic loading state — warming the common path is
the correct default; warming both would re-introduce the double-download this
subphase removed.

---

## Where each layer is triggered

### On intent — `AppLaunchLink` (`src/components/layout/AppLaunchLink.tsx`)
`onPointerEnter` / `onFocus` / `onTouchStart` → `doPreload()`:
1. gated by `isPreloadAllowed(readNetworkContext())` (Save-Data / slow-2g /
   offline / hidden → skip);
2. Tier C apps get **no** intent chunk-warm (heavy/rare);
3. `preloadAppChunk(app.id)` warms Layer 2;
4. `onPreload?.(app)` optionally warms the app's list GET.

On activation, `markAppLaunch(app.id, pressMs, !wasChunkWarmed(app.id))` records
the launch and tags it cold/warm.

### On idle — Home (`src/app/page.tsx`)
The first-session preload loop warms, **capped at the top 2** apps only:
```ts
let chunksWarmed = 0;
// … per ranked app id, after route + data prefetch:
if (chunksWarmed < 2 && hasChunkPreloader(id)) { preloadAppChunk(id); chunksWarmed += 1; }
```
Still gated by `isPreloadAllowed(readNetworkContext())`. This respects
"P1: top 1–2 apps after Home interactive" and "Do not preload every
application."

---

## Press feedback is native, not React state

The pressed affordance is pure CSS `:active` (`active:scale-[0.97]`,
reduced-motion-safe) on the `<Link>` — it paints in <100 ms with **no** JS/React
round-trip, so it fires even while a cold chunk is still downloading (directly
answering "pressing an app initially appears unresponsive"). The real `<Link>`
preserves Cmd/Ctrl-click, middle-click, "open in new tab", Enter/Space, and
`aria-*` — none of which `router.push` could provide.

---

## Loading boundaries (Step 11)

Each heavy app route (`/crm`, `/customers`, `/suppliers`, `/quotations`) renders
an `AppLoadingSkeleton` **as the `next/dynamic` `loading:` prop** and via the
route-level `loading.tsx` shell — so the skeleton is compiled into the **route
shell** and paints **before** the dynamic chunk arrives, not inside the lazy
chunk it is meant to mask. Customers/Suppliers additionally show the skeleton
while the rollout gate is still resolving (`mode === null`), so no impl mounts —
and therefore no list request fires — until the trusted bootstrap flag decides.
