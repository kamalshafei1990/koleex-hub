# Platform Speed Max-Out — Results

**Phase 4 — Platform Speed Max-Out.** What shipped, per workstream, with the
before/after and the honesty clause (values the toolchain can't emit are marked,
not fabricated).

## Shipped changes

| WS | Change | Files | Reversible by |
|---|---|---|---|
| 1 | `DAILY_QUOTES` (~120 localized strings) code-split into a lazy module + dynamic-imported by AIGreeter | `src/lib/home/daily-quotes.ts` (new), `src/app/page.tsx` | re-inline |
| 1 | Two unread-badge effects (fetch + realtime sub) deferred behind first idle | `src/lib/perf/use-after-interactive.ts` (new), `src/app/page.tsx` | remove the gate |
| 2 | `web-push` lazy-imported inside the send path; `isPushConfigured` = pure env check | `src/lib/server/web-push.ts` | restore static import |
| 2 | argon2 (`hashForWrite`) dynamic-imported on the `/api/accounts` POST path only | `src/app/api/accounts/route.ts` | restore static import |
| 3 | Sign-out clears the QueryClient + all tenant/account-scoped storage | `src/lib/session-caches.ts` (new), `src/components/layout/UserMenu.tsx` | delete helper + call sites |
| 7 | 3 super-admin/activity pollers guard hidden-tab ticks + resync on visibility | `src/app/super-admin/activity/page.tsx` | remove guards |
| 9 | `validate:platform-speed` guard (16 assertions) | `scripts/validate-platform-speed.mts` (new), `package.json` | — |

## Before / after (platform-wide)

| Metric | Before | After | How measured |
|---|---|---|---|
| Home visible→interactive | decorative quotes + 2 badge fetches + 2 realtime subs ran during the hydration-critical window | those deferred to first idle; app grid interactive first | `home.interactive_ms` / `home.first_input_delay_ms` (field) |
| Home initial JS | ~120 long quote strings in the Home critical bundle | quotes in a separate lazy chunk | structural (dynamic-import boundary); byte delta **not emitted by build** |
| Cold serverless (Discuss write / heartbeat / signin / 7 audit routes) | `web-push` tree in module load | `web-push` off the cold-start graph (lazy) | structural; runtime delta in Vercel logs (owner-side) |
| Cold serverless (`GET /api/accounts`) | native argon2 addon loaded | argon2 loaded only on POST | structural |
| Cross-user paint after sign-out (same tab) | QueryClient + warm-starts survived → prior user's data could paint | all tenant/account caches cleared on sign-out | `validate:platform-speed` WS3 + manual sign-out check |
| Background requests (hidden super-admin monitor tab) | 8s + 15s DB reads + 1s SVG re-render, forever | quiet while hidden; snap on return | `BACKGROUND_ACTIVITY_AUDIT.md` |

> **Honesty clause (task Step: do not fabricate).** No P50/P75/P95/P99 or byte
> reduction is invented here. Real percentiles live in Vercel Speed Insights /
> runtime logs (authenticated, owner-side); this table records the structural
> before/after and where each metric is read. Turbopack build output in this
> environment omits per-route First-Load-JS byte columns.

## Per-app impact

| App | Impact |
|---|---|
| **Home** | decorative work off the critical path; app grid interactive sooner; idle preload no longer contended |
| **Customers / Suppliers / CRM** | cold-entry de-bundle + chunk warming already shipped (Cold-Start subphase); this phase adds a real logout cache-clear so their warm-start data can't leak across sessions |
| **Discuss** | write path no longer pays the `web-push` cold-start tax |
| **Finance / Quotations** | unchanged this phase (already have skeleton / localStorage-first); regressions guarded |
| **Accounts / super-admin** | GET list no longer loads argon2; activity monitor stops polling while hidden |

## Verification

| Gate | Result |
|---|---|
| `validate:platform-speed` (16) | ✅ 16/16 |
| `validate:cold-start` (24) | ✅ |
| app-launch / crm-perf / finance-perf / quotations-perf / quotations-pricing | ✅ |
| suppliers-security / customers-gate / server-list | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| `next build` | ✅ exit 0 |

## Security validation

No permission check moved to the client; no auth context cached globally; no
broad private dataset warmed; no unauthorized route preloaded; tenant isolation
preserved; the sign-out change **strengthens** isolation (clears cross-session
leak). RLS / field-level restrictions / session revocation untouched.

## Deployment

Preview-first (`wave-platform-speed-preview`) for the Home hydration, cache, and
super-admin timer changes; promoted to `main` after Preview verified green.

## What is NOT done (documented for a future, gated pass)

- WS3 tenant-scoping of `kx:sup:*` sessionStorage keys + view-as scoping of the
  contacts warm-start (transient same-tab tenant/view-as switch paint).
- WS6 progressive rendering beyond what Finance already has (larger, per-app).
- Contacts 20s full-directory delta endpoint (needs a new API).
- These are recommendations, not regressions; the shipped set is the
  high-confidence, shared-platform, reversible subset.
