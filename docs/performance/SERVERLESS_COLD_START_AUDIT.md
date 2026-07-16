# Serverless Cold-Start Audit

**Phase 4 — Platform Speed Max-Out, Workstream 2.** Module-scope import cost in
the highest-volume / first-request API routes, and the fixes shipped.

## Method

Static trace of the module import graph of the hot routes (`me/bootstrap`,
`customers`/`contacts`, `suppliers`, `crm/*`, `finance/*`, `quotations/*`,
`products`, `notifications`, `discuss/*`) and the shared helpers they pull
(`auth`, `permissions`, supabase client). Looking for heavy libraries loaded at
MODULE scope for code paths that may never execute on a given request.

## The codebase is already largely cold-start-clean

- **Service-role Supabase client** — a lazy singleton behind a `Proxy`
  (`supabase-server.ts`); `createClient` only fires on first property access. No
  per-route construction, no eager connection. Shared by every route.
- **Universal `auth.ts`** (imported by ~every route) pulls only `react` cache,
  `next/server`, the lazy supabase proxy, perf, session — negligible.
- **PDF/Excel/OCR/browser deps** are already dynamic-imported in the only routes
  that use them: `quotations/[id]/pdf`, `reports/export/pdf` (puppeteer +
  chromium), `excel-export` (exceljs), `catalog-client` (unpdf, tesseract).
- `country-state-city`, `qrcode`, `jsbarcode`, `simple-icons` never reach a
  server route (client components only).

## Fixes shipped

### 1. `web-push` lazy-loaded (highest fan-out)
`src/lib/server/web-push.ts` imported `web-push` (+ https/crypto/asn1 tree) at
module scope. This file is transitively imported — for a rarely-taken notify
branch — by the Discuss `mutate` route, the activity **heartbeat** (high
frequency), `auth/signin`, and via `audit.ts` by **7 audit-instrumented
mutation routes** (products/[id], roles, quotations/[id], documents/[id],
me/password, commercial-policy/[section], roles/[id]).

**Change:** `web-push` is now `await import("web-push")` inside the send path
only; `isPushConfigured()` is a pure `process.env` check that never loads the
package. One change removes `web-push` from the cold-start graph of all of those
routes simultaneously. Behavior identical (VAPID configured once, on first send).

### 2. argon2-on-GET defer
`/api/accounts` statically imported `hashForWrite` → the native
`@node-rs/argon2` addon loaded on the cold start of GET (list), which never
hashes. `hashForWrite` is now `await import(...)`-ed inside the POST write path.
`employees/full` was checked and left as-is (POST-only, always hashes → no GET to
protect). Signin / me/password legitimately need argon2 on their primary path.

## Constraints honored

- Region stays `hnd1`. No VPS. No runtime-type change. No provider change.
- Both fixes are pure lazy-loading — no logic, permission, or output change.
- Locked by `validate:platform-speed` (WS2 assertions).

## Measurement note

Cold-vs-warm serverless invocation durations are observable in Vercel runtime
logs (owner-side). Exact millisecond deltas are not fabricated here; the change
is that the `web-push`/argon2 module trees are no longer in the affected routes'
first-invocation load, which is verifiable structurally.
