# Koleex Hub — Performance Baseline (Phase 1 Audit)

**Date:** 2026-07-15 · **Auditor:** Claude (Principal Performance Engineer role) · **Production:** hub.koleexgroup.com (Vercel) · **Database:** Supabase project `yxyizbnfjrwrnmwhkvme`

This document records the measured state of the system BEFORE any Phase 2+ optimization work. Every later change must be compared against these numbers.

---

## 1. Stack & scale

| Item | Value |
|---|---|
| Framework | Next.js **16.2.2** (App Router), React **19.2.4** |
| Data layer | `@supabase/supabase-js` 2.101.x, `@tanstack/react-query` 5.101.x |
| Source files (`src/**/*.ts(x)`) | **1,838** |
| API route handlers (`route.ts`) | **481** |
| `"use client"` files | **630** |
| Runtime model | All app UIs are client components rendered inside a persistent `RootShell`; data flows through `/api/*` route handlers using the **service-role** Supabase client server-side (P0 lockdown pattern). Browser anon key has no access to core tables. |
| Realtime | Supabase Broadcast, **content-free ping model** (`src/lib/server/realtime-broadcast.ts`): server emits `discuss:channel:{id}` / `discuss:account:{id}` / `inbox:account:{id}` pings after writes; clients refetch through membership-gated read endpoints. No `postgres_changes` reliance for gated tables. |
| PWA | App-shell service worker (`public/sw.js`, kx-static-v2): cache-first for `/_next/static/` only + version-upgrade force-reload; `UpdateWatcher` polls `/api/version` and offers one-tap refresh on new deploys. |
| Next config | `reactStrictMode`, `removeConsole` in prod, `productionBrowserSourceMaps:false`, `optimizeCss`, `optimizePackageImports` for tiptap/supabase/markdown. |

### Data volume (queried 2026-07-15)
| Table | Rows | Notes |
|---|---|---|
| discuss_messages | **81** | 7 channels, 6 memberships — Discuss is early-stage |
| contacts | 259 | 22 MB on disk (largest table — legacy base64 media in rows) |
| products | 706 | |
| inbox_messages | 796 | |
| accounts | 10 | app_sessions 23, user_devices 23 |

**Implication:** at today's volumes, *no* query is slow because of data size. Latency lives in network round-trips, serial awaits, and payload weight — that is where the audit focused.

---

## 2. Database measurements (pg_stat_statements)

Top statements by cumulative execution time (window: since last stats reset; includes traffic **before** the fixes shipped earlier on 2026-07-15):

| Query | Calls | Mean | Max | % of total time |
|---|---|---|---|---|
| contacts `SELECT *` (legacy — **already fixed** commit `1a08edbc`, now slim projection ≈79 ms) | 110 | 935 ms | 14.4 s | 71.4% |
| discuss_members join | 8,333 | **0.5 ms** | 113 ms | 3.0% |
| discuss_messages page | 8,332 | **0.5 ms** | 74 ms | 2.8% |
| `set_config` (PostgREST per-request setup) | 123,889 | 0.03 ms | 35 ms | 2.6% |
| UPDATE user_devices (activity heartbeat) | 6,088 | 0.4 ms | 1.36 s | 1.7% |
| UPDATE app_sessions (activity heartbeat) | 6,080 | 0.3 ms | 385 ms | 1.3% |
| accounts select (auth layer) | 20,875 | 0.1 ms | 99 ms | 1.3% |
| inbox_messages select | 5,229 | 0.2 ms | 17 ms | 0.8% |

**Conclusion:** after the contacts fix, the database is healthy. Every hot query runs **sub-millisecond**. Discuss DB cost is negligible. The heartbeat pair (user_devices + app_sessions, ~30 s cadence per session) is measurable but cheap.

### Indexes (Discuss)
All the right indexes already exist: `discuss_messages (channel_id, created_at DESC)`, partial `discuss_members (account_id, channel_id) WHERE left_at IS NULL`, `discuss_channels (last_message_at DESC)`, GIN FTS on message bodies. Advisor "unused index" flags on these are an artifact of tiny tables (the planner seq-scans 81 rows) — they will engage as data grows. **Do not drop them.**

### Supabase advisors (performance) — 991 lints summarized
| Lint | Count | Assessment |
|---|---|---|
| unused_index | 678 (INFO) | Mostly small-table artifacts; revisit after data grows. No action now. |
| unindexed_foreign_keys | 258 (INFO) | Matters for DELETE cascades/joins at scale; not a current hot path. Defer. |
| auth_rls_initplan | 20 (WARN) | 8 tables (`customer_users`, `quotation_items`, `finance_bank_statement_*`, `finance_treasury_*`, …) re-evaluate `auth.*()` per row. Cheap migration fix (`(select auth.uid())`), gated per DB-change policy. |
| multiple_permissive_policies | 20 (WARN) | 4 tables: `customer_price_overrides`, `customer_pricing`, `customer_users`, `quotation_items`. Consolidate policies (gated). |
| duplicate_index | 11 (WARN) | Identical index pairs on `inventory_*` + `purchase_receipt*` tables. Dropping one of each pair is safe + reversible (gated migration). |

---

## 3. Production latency (network measurements)

**Measurement caveat (honest limitation):** these were taken with `curl` from the owner's Mac, whose network to Vercel/Supabase is known to be slow and lossy (one request in the run failed outright with an SSL error). Treat them as **upper bounds from this geography**, not server truth. They still establish the structural point below. Vercel Speed Insights (Phase 2) is required for real P75 field data.

| Endpoint | Try 1 TTFB | Try 2 TTFB | Notes |
|---|---|---|---|
| `/` (HTML shell) | 0.67 s | 0.30 s | edge-cached HTML, small (21 KB) |
| `/login` | 0.56 s | 0.81 s | |
| `/api/version` (trivial, force-dynamic) | 0.86 s | 0.76 s | **≈ pure function+network floor** — no DB work at all |
| `/api/me/bootstrap` (401 path) | 1.04 s | 0.50 s | auth rejection round trip |

**Structural conclusion:** a *trivial* API function costs ~0.5–1.0 s from this network. Any interaction needing N sequential API calls costs N × that. Since the DB is sub-millisecond, the performance program must be about **(a) fewer/parallel round trips, (b) instant optimistic/cached UI, (c) event-driven push instead of polling** — not about database tuning.

### Initial JS/CSS payload (deployed login shell, measured from live chunks)
- **19 files, 1,944 KB uncompressed** (≈450–550 KB over the wire with compression).
- Largest: one 411 KB CSS bundle; two ~222 KB JS chunks; then 184/157/134/131 KB.
- Acceptable for an ERP but must not grow silently → budget in Phase 13.

### Client-side cadences found (poll inventory)
| Site | Cadence | What it does |
|---|---|---|
| `DiscussApp.tsx:834` | **5 s** | Refetches the full open-channel message page (limit 120 + author/reaction joins) — see BOTTLENECKS #2 |
| `NotificationBell.tsx:324` | 10 s | Badge poll (server side now SWR-cached 15 s) |
| `ActivityTracker.tsx` | 30 s | Presence heartbeat → 2 UPDATEs/tick |
| `ProjectsApp.tsx`, `QaReportsApp.tsx` | 20 s | List refresh while visible |
| `super-admin/activity` | 1 s / 8 s / 15 s | Live monitor page (SA-only, intentional) |
| Home `page.tsx` | 1 s ticks ×2 + 2 pollers | Clock + rotating UI + badge polls |

---

## 4. What is already done (do not re-fix)

Shipped in the 2026-07 speed sweep (verified live): contacts slim projection (935→79 ms), TanStack Query caching layer, localStorage warm-start for Contacts/Customers/Suppliers/Products/bootstrap, SWR `Cache-Control` on visual-statements / inventory items / inbox counts, app-shell service worker + auto-update watcher, Catalogs PDF range-loading, parallelized auth layer (`getServerAuth`, `requireModuleAccess` use `Promise.all`).

---

## 5. Measurement gaps (what could NOT be measured, and how to close)

| Gap | Why | Proxy used | Definitive fix |
|---|---|---|---|
| Real-user Core Web Vitals (LCP/INP P75) | No RUM integration yet | curl TTFB + bundle weights | Enable Vercel Speed Insights (Phase 2) |
| Authenticated route timings & waterfalls | Agent must not log in with credentials; probe-account browser login is out of policy for this session | pg_stat + code-path analysis + unauthenticated TTFB | Phase 2 server-timing instrumentation emits per-request timings without credentials |
| Sender→receiver message latency (two clients) | Needs two authenticated realtime clients | Code-path latency budget (see DISCUSS_REALTIME_AUDIT §5) | Phase 2 correlation-ID lifecycle events |
| React render counts / long tasks | Needs authenticated profiling session | Component size + effect analysis | Phase 2 hotspot marks (`performance.mark`) on known heavy components |
| Local production build | Repo folder is TCC-blocked for this agent; builds run on Vercel CI | Vercel build status (green) + deployed chunk inspection | unchanged — CI remains the build oracle |
