# Platform Speed Max-Out — Baseline

**Phase 4 — Platform Speed Max-Out.** Measure-before-changing baseline for the
shared-platform speed workstream (Home hydration, serverless cold start, cache
safety, preload, background activity, progressive rendering, interaction,
budgets). Follows the closed Cold-Start subphase (commit `c97b6edb`).

> Scope: shared platform speed only. Excludes Products/Product Data, Wave 2C,
> Contacts migration, Discuss feature expansion, Storage migration, AI.

## Method

Static + code-derived analysis of the c97b6edb tree (three read-only audits:
serverless module-graph, cache/query-key safety, background-activity inventory)
plus the existing privacy-safe field instrumentation (`home.*`, `app_launch.*`,
`nav.*`, Server-Timing, Vercel Speed Insights). Real percentiles come from Vercel
Speed Insights / runtime logs (owner-side, authenticated) and are **not**
fabricated here — this doc records structural findings and where each metric
lives.

## Headline findings (ranked, evidence-backed)

| # | Area | Finding | Class | Shipped this phase |
|---|---|---|---|---|
| 1 | **Cache safety (WS3)** | Supabase-mode sign-out did a SOFT nav — the long-lived QueryClient + all `kx_*`/`kx:*`/me-bootstrap warm-starts survived into the next session in the same tab (cross-user/tenant paint risk). Legacy path hard-reloads but localStorage survives that too. | HIGH (security + cache) | ✅ logout cache-clear |
| 2 | **Serverless cold start (WS2)** | `web-push` imported at MODULE scope in `web-push.ts` → dragged into Discuss `mutate`, the activity heartbeat, signin, and 7 audit-instrumented mutation routes for a rarely-taken notify path. | MED–HIGH | ✅ lazy import |
| 3 | **Serverless cold start (WS2)** | `@node-rs/argon2` (native) loaded at module scope of `/api/accounts` even though GET (list) never hashes. | LOW–MED | ✅ argon2-on-GET defer |
| 4 | **Home hydration (WS1)** | ~120 long localized quote strings (`DAILY_QUOTES`) sat in the Home critical bundle for a decorative widget; two unread-badge effects fired a fetch + realtime subscription on mount, competing with app-grid interactivity. | MED | ✅ lazy quotes + deferred badges |
| 5 | **Background activity (WS7)** | 3 `super-admin/activity` timers (8s monitor, 15s feed, 1s graph) had NO hidden-tab guard — the only pollers in the app that ignored the pattern everywhere else. | LOW–MED | ✅ visibility-guarded |
| 6 | Cache scope (WS3) | supplier coverage/taxonomy sessionStorage keys lack a tenant discriminator; contacts warm-start not view-as scoped. | MED | Documented → follow-up (gated) |

## Confirmed already-healthy (no change — do not re-fix)

- **Supabase service-role client** is a lazy singleton (`supabase-server.ts` Proxy) — not per-route, not eager. The universal `auth.ts` helper pulls only light deps.
- **PDF/Excel/OCR/browser libs** are already dynamic-imported in the only routes that use them (quotations/reports PDF, excel-export, catalog OCR). `country-state-city`/`qrcode`/`jsbarcode` never reach a server route.
- **Service worker** caches only `/_next/static/` (never `/api`, never HTML) — the correct, tenant-safe design (verified in the Cold-Start subphase).
- **`useServerList`** query keys are properly tenant+account isolated; almost every client poller is already realtime-first + visible-guarded.
- **Region** pinned to `hnd1` (Tokyo). Browser-side chunk delay is not a DB/region issue. No VPS, no provider change.

## Metric homes (WS10)

| Metric family | Where |
|---|---|
| `home.interactive_ms`, `home.first_input_delay_ms`, `home.visible_to_interactive_ms` | `src/lib/perf/client.ts` → ingest → Vercel logs |
| `app_launch.cold.*` / warm | `AppLaunchLink` → `markAppLaunch` |
| Core Web Vitals (LCP/INP/CLS) P75 per route | Vercel Speed Insights (owner dashboard) |
| Server-Timing (browser vs DB split) | `src/lib/server/perf.ts` `stageTimer` |

See `PLATFORM_SPEED_MAXOUT_RESULTS.md` for before/after, `PLATFORM_CACHE_STRATEGY.md`,
`SERVERLESS_COLD_START_AUDIT.md`, `BACKGROUND_ACTIVITY_AUDIT.md`, `PERFORMANCE_BUDGETS.md`,
`PERSONALIZED_PRELOAD_STRATEGY.md`.
