# Koleex Hub — Observability Architecture (Phase 2)

**Shipped:** 2026-07-15 · commits `624f1684` (Speed Insights) · `103e3f96` (perf core) · `311e356e` (Discuss instrumentation)

Phase 2 adds *measurement only*. No user-visible behavior, authorization rule, payload shape, or data flow changed. Everything here is reversible by removing the instrumentation call sites.

---

## 1. The three collection layers

```
┌─ Browser ──────────────────────────────────────────────────────────────┐
│ @vercel/speed-insights  → Core Web Vitals (LCP/INP/CLS/TTFB/FCP)       │
│                           → Vercel dashboard, P75 per route            │
│ src/lib/perf/client.ts  → kx-perf: lifecycle + nav + realtime metrics  │
│   batches (≤50, ≥20s apart) → sendBeacon → /api/perf/ingest            │
└────────────────────────────────────────────────────────────────────────┘
┌─ Server (Vercel functions) ────────────────────────────────────────────┐
│ /api/perf/ingest          → re-validates + logs  [kx-metric] {json}    │
│ src/lib/server/perf.ts    → stage timers  →  [kx-server-timing] {json} │
│                             + standard Server-Timing response headers  │
└────────────────────────────────────────────────────────────────────────┘
┌─ Storage / analysis ───────────────────────────────────────────────────┐
│ Vercel Logs (filter "[kx-metric]" / "[kx-server-timing]")              │
│ Vercel Speed Insights dashboard (percentiles built-in)                 │
│ No database tables, no third-party vendor, no schema migration.        │
└────────────────────────────────────────────────────────────────────────┘
```

Design choice: **structured log lines instead of a metrics database.** At Koleex's traffic volume this gives percentile-capable raw data with zero new infrastructure, zero migrations (respecting the DB-change gate), and zero vendor lock-in. If volume ever outgrows log analysis, the emit points are already centralized in two files and can be redirected.

## 2. Files

| File | Role |
|---|---|
| `src/lib/perf/client.ts` | Shared client utility: `record/event/count/time/subscribe`; route normalization; cold-load + warm-nav timing; long tasks; online/offline; batched shipping. Never throws; ~1 KB gzipped. |
| `src/components/perf/PerfVitals.tsx` | Invisible RootShell bootstrap (init + link-click → pathname-change warm-nav timing). |
| `src/app/api/perf/ingest/route.ts` | Auth-gated sink; independently re-validates every field against strict whitelists; one `[kx-metric]` log line per batch; 204. |
| `src/lib/server/perf.ts` | `stageTimer(op)` — per-stage ms, one `[kx-server-timing]` line, `Server-Timing` header for browser DevTools. |
| `src/lib/discuss.ts` | Realtime health hooks inside the shared `subscribeBroadcast` (join ms, reconnects, status drops, channel gauge) + receiver fetch timing + ping-arrival correlation map. |
| `src/components/discuss/DiscussApp.tsx` | Sender lifecycle marks (press → optimistic paint → ack → reconcile, failures), receiver ping→visible mark, fallback-poll tick counter. |
| `src/app/api/discuss/{mutate,read}/route.ts` | Stage-timed `sendMessage`, `myChannels`, `channelMessages`. |
| `src/components/perf/PerfPanel(.Gate).tsx` | Dev-only floating panel over the same ring buffer; `NODE_ENV` gate → zero production bytes. |
| `src/app/layout.tsx` | `<SpeedInsights />` mount. |

## 3. Privacy model (enforced twice)

1. **At the source** — `client.ts` only accepts dictionary-pattern names (`/^[a-z0-9._-]{1,48}$/`), numeric values, and ≤8 short pattern-checked tags; routes are normalized (`/customers/8f3a…` → `/customers/:id`); message bodies, URLs with params, search text, and record data have no code path in.
2. **At the sink** — `/api/perf/ingest` re-validates independently, so even a compromised/browser-modified client cannot smuggle free text into logs. Sessions are identified by an anonymous 8-char `sid`, never the account id.

Server logs contain: operation names, stage durations, counts, region/env labels. Never: message bodies, attachment URLs, emails, phones, tokens, cookies, headers, or row data. Realtime metrics report the topic *family* (`discuss:channel`) — never the channel/account id.

**Log level note:** metric lines are emitted via `console.warn` because `next.config.ts` `removeConsole` strips `console.log/info` from production builds (only error/warn survive). This is deliberate and documented, not an error condition.

## 4. Correlation model (message lifecycle)

- **Sender-side** stages share one closure (`kxT0`/`kxReq` in `handleSend`) — no id needed; values ship as separate metrics from the same session (`sid`).
- **Server-side** the `[kx-server-timing]` line for `discuss.mutate {action:sendMessage}` covers auth→parse→membership→db_insert→member_lookup→rt_dispatch→push_dispatch, and the same breakdown returns to the sender's browser as a `Server-Timing` header (visible in DevTools → Network → the mutate request → Timing).
- **Receiver-side** `lastPingAt` (in-memory map, ids never shipped) correlates broadcast-ping arrival with the fetch (`discuss.recv.fetch_ms`) and the paint (`discuss.recv.visible_ms`).
- Clock-skew safety: every duration is computed on ONE clock (browser `performance.now()` or server `performance.now()`), never across machines. True cross-machine sender→receiver latency is therefore reported as the sum of measured single-clock segments; Phase 12's two-client test will measure it end-to-end directly.

## 5. Overhead budget (measured design limits)

- Client: in-memory array push per metric; one `sendBeacon` ≤ every 20 s (≤ ~6 KB); rAF only on Discuss send/receive events; long-task observer is passive. No extra realtime subscriptions were created — instrumentation rides inside the existing shared `subscribeBroadcast`.
- Server: 2–8 `performance.now()` calls + one `JSON.stringify` per instrumented request (< 0.1 ms).
- Bundle: perf core + vitals ≈ 3 KB min+gz on the shared chunk; SpeedInsights script is loaded async by Vercel; PerfPanel = 0 bytes in production.

## 6. How to inspect

| What | Where |
|---|---|
| Core Web Vitals percentiles | Vercel → koleex-hub → **Speed Insights** tab (owner must click **Enable** once) |
| kx client metrics | Vercel → koleex-hub → **Logs**, filter text `[kx-metric]` |
| Server stage timings | Vercel → koleex-hub → **Logs**, filter text `[kx-server-timing]` |
| Per-request breakdown in the browser | DevTools → Network → request → **Timing** tab (Server-Timing) |
| Live dev view | run dev server → floating **perf** pill bottom-left (dev builds only) |

Percentiles from logs: export/filter the JSON lines, take the `v` (client) or `total_ms`/`stages.*` (server) fields, compute P50/75/95/99 — each line is a raw sample, never pre-averaged.

## 7. Rollback

Each layer is independent: remove `<SpeedInsights/>` (+ dependency) · remove `<PerfVitals/>`/`<PerfPanelGate/>` mounts · revert the Discuss instrumentation commit (`311e356e`) · delete `/api/perf/ingest`. No data model or behavior depends on any of them.

## 8. Super-Admin Performance Center (spec only — not built)

Feasible safely: a `/super-admin/performance` page reading the last N `[kx-metric]` lines via a Vercel Logs API integration or a future gated `perf_events` table (would need the DB gate). Deferred until Phase 2 data shows it's worth a dashboard beyond Vercel's own. Requirements if built: super-admin module permission, read-only, no message content (inherently absent from the stream), pagination, and percentile summaries computed server-side.
