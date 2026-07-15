# Shared Architecture Performance Audit (Phase 4)

## Layers (from the repo)
- **Root layout** (`src/app/layout.tsx`): server component; mounts `<Providers>` (client) → `<RootShell>` + global `<DialogHost>`, `<SmartCreateDrawer>`, `<SpeedInsights>`. Inter font self-hosted via `next/font`. Minimal.
- **Providers** (`src/app/providers.tsx`): **only** TanStack `QueryClientProvider` (one client per browser session via `useState`). No sprawling provider stack at the app root. ✅
- **RootShell** (`src/components/layout/RootShell.tsx`): client; wraps `QAInspectorProvider` + `SidebarProvider`; consumes `useMeBootstrap`; mounts `ServiceWorkerRegistrar`, `UpdateWatcher`, `PerfVitals`, `PerfPanelGate`. This is the persistent shell.
- **Shared bootstrap** (`src/lib/me-bootstrap.ts` + `/api/me/bootstrap`): **single composed call** returning account + person + permissions + view-as in ONE `Promise.all`; deduped ("safe to call many times"), localStorage warm-start (`koleex.me-bootstrap.v1`), HTTP `Cache-Control`. 15 consumers. ✅ well-designed.
- **Server auth** (`src/lib/server/auth.ts`): runs on every API request. `getServerAuth` = `getSessionAccountId()` → `getViewAsAccountId()` → `getViewAsRoleId()` (three **sequential** awaits) then `Promise.all([accounts, koleex_employees, realAccount, targetRole])`. Post-Tokyo each hop is ~2 ms, but every request pays the 3 serial hops. `requireModuleAccess` = `Promise.all(koleex_permissions + overrides)`. Already parallel where it counts.
- **Middleware**: none (`no middleware.ts`) — all gating is in route handlers.
- **Supabase clients**: browser anon client (mostly unused post-P0 lockdown); `supabaseServer` service-role (server-only). Region colocated hnd1↔Tokyo.

## Repeated fetch / recompute during navigation?
- **Session/account/person/permissions**: fetched once via bootstrap, cached + deduped. Navigation does **not** refetch them. ✅
- **Per-request auth** (server): re-runs on every API call (accounts + employees + permissions). Individually sub-ms; the cost is *volume* (31k+ calls) not latency. Candidate: fold the 3 serial session/view-as hops into fewer round trips.
- **Reference data** (divisions/categories/taxonomy logos): loaded per-app; some deferred to forms already (Contacts perf work).

## Provider-wide re-render risk?
Low at the root: only QueryClient + Sidebar + QAInspector. The re-render risk is **inside** giant leaf components (Contacts 764 KB, ProductForm 303 KB), not from a global provider storm. This is the opposite of the usual "one context updates everything" problem — good.

## Tenant isolation
Preserved everywhere: bootstrap + auth are per-account; service-role queries filter by `auth.tenant_id`; the R3 catalog cross-org fix (`50d32741`) closed the one gap found. No shared cross-user cache exists (bootstrap cache is per-browser localStorage, cleared on logout).

## Recommendations (shared, highest-leverage)
1. **App-wide server-timing wrapper** (SW-1): a thin `withTiming(handler)` or a shared helper so every route emits `[kx-server-timing]` — turns the scorecard from partial to complete. Zero behavior change.
2. **Flatten auth serial hops** (SW-3): resolve session + view-as in one query/round-trip where possible.
3. **Poller consolidation** (SW-2): heartbeat + inbox → idle-gate + widen, or event-driven via the existing broadcast topics.
Keep the bootstrap design as-is (it's the model to copy elsewhere).
