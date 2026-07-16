# CRM Performance — Baseline (Phase 4 Wave 2B.2)

**Confirmed the actual implementation before changing anything.** No reliance on
prior scorecard assumptions — every claim below is code-derived or measured against
production data (labelled inline).

## Architecture map (code-derived)

| Concern | Location |
|---|---|
| Route + loading boundary | `src/app/crm/page.tsx` (`dynamic(ssr:false)` → `AppLoadingSkeleton`), `src/app/crm/loading.tsx` |
| Board / all views | `src/components/crm/CRM.tsx` (single 4095-line client component) |
| Board (kanban) | `PipelineView` (l.758) → `PipelineColumn` (l.909) → `OpportunityCard` (l.1183) |
| Alt views | `ListView`, `CalendarView`, `PivotView`, `GraphView`, `MapView`, `ActivityView` |
| Create / edit deal | `OpportunityModal` (l.1707) |
| Customer/contact picker | `ContactComboboxField` (l.1465) — fed the **entire** contact book as a prop |
| Owner/user picker | none — owner is assigned to the current account; no directory dropdown |
| Product/quotation pickers | none in CRM |
| Drag-and-drop | **native HTML5** (`draggable` + `onDragStart/Over/Drop`), no library |
| Data access | `src/lib/crm.ts` (`fetchOpportunities`, `fetchStages`, `moveOpportunityToStage`, …) + `fetchContacts` from `src/lib/contacts-admin.ts` |
| Board API | `GET /api/crm/opportunities` |
| Mutations | `POST /api/crm/opportunities`, `…/[id]`, `…/[id]/move`, `…/[id]/archive`, `…/[id]/lost`, stages, activities |
| Polling / realtime | **none** (no interval, no Supabase channel) |
| Permissions | every route: `requireAuth()` + `requireModuleAccess(auth,"CRM")` (+ `requireModuleAction(…, "create"/"edit")` on mutations); client fetches gated by `useScopeContext()` |
| Tenant scope | server-derived `auth.tenant_id` on every query; client also passes `ctx.tenant_id` on the legacy fallback |

## Request dependency graphs (code-derived)

1. **Initial board load** — `reload()` fires `fetchStages(ctx)` + `fetchOpportunities({ctx})` in **parallel** (`Promise.all`), then `setStages`/`setOpps`. `GET /api/crm/opportunities` internally does 1 main query (`crm_opportunities`, `limit 500`, tenant-scoped, `archived_at is null`) + a **parallel** enrichment batch (`crm_stages`, `contacts` slim, `accounts`+`people`, `crm_activities`). No client waterfall. Plus the usual 4 global-shell requests (`me/bootstrap`, `activity/heartbeat`, `version`, `qa/assignees`).
2. **Opening a deal** — no network for the row itself; the modal is seeded from the **in-memory** board row (`opps.find`). On mount it fires **`fetchContacts()` (whole directory)** + `fetchActivities(id)` (existing deals only).
3. **Creating a deal** — `createOpportunity` → `POST` → **`reload()`** (full board refetch + `loading=true` blank).
4. **Editing a deal** — `updateOpportunity` → `PATCH` → **`reload()`** (full board refetch + blank).
5. **Searching for a customer/contact** — **zero network per keystroke today**: the whole book is already in memory; `ContactComboboxField` filters it client-side (`matches` useMemo, `slice(0,6)`). The cost was paid up-front as one full-directory download on modal open.
6. **Moving a deal between stages** — `handleDrop` does an **optimistic** local `setOpps` then `moveOpportunityToStage` (`POST …/move`). **No board refetch.** (Good — but the mutation result is ignored: no rollback on failure, no reconcile.)
7. **Filtering the board** — pure client-side: `filteredOpps` (useMemo over `opps`) + `oppsByStage` (useMemo). No network. Correct for the already-bounded board.

## Baseline measurements

| Metric | Value | Source |
|---|---|---|
| Deals in production | **2** (both active, 1 tenant, **0 bytes** of `description`) | real production (SQL) |
| Contacts in production | **259** across **6 tenants** (120 customers) | real production (SQL) |
| Board initial requests | 2 CRM (`stages`, `opportunities`) + 4 global shell | code-derived |
| Board row projection | `SELECT *` on `crm_opportunities` (incl. free-text `description`, `lost_reason`) | code-derived |
| Board payload bytes | negligible **today** (2 rows, empty descriptions) | real production |
| Picker payload | **entire tenant contact directory** via `GET /api/contacts` (all sanitized columns), on **every** modal open | code-derived |
| Card renders on one move | **all cards** re-render on `draggingId`/`hoverStageId` change (no `memo`, fresh per-card closures) | code-derived |
| Full-board refetches / move | **0** (drag is optimistic) | code-derived |
| Full-board refetches / other mutation | **1 + blank** (`reload()` sets `loading=true`) | code-derived |
| DOM nodes / React commit duration / long tasks / P50–P99 | — | **unavailable** (authenticated-profiler / Vercel-Speed-Insights only; not reachable from build env) — **not fabricated** |

## Root causes (evidence-ranked)

1. **Picker downloads the whole contact directory** (`OpportunityModal` → `fetchContacts()`), then filters client-side. Scales with contacts (259/6 tenants today), not deals. This is the largest current payload liability **and** a field-exposure surface (the picker needs 6 fields; the full endpoint returns every sanitized column). *(Step 4)*
2. **Every non-drag mutation blanks the board.** `reload()` unconditionally sets `loading=true`; the body renders a spinner until both refetches settle. Save / quick-add / stage fold-delete / generate-leads all blank a usable board. *(Steps 6, 11)*
3. **No `memo` on cards/columns + fresh per-card closures** (`onDragStart={() => onDragStart(o.id)}`, `onClick={() => onCardClick(o.id)}`). Any top-level state change — including **every drag-over** (`hoverStageId`) — re-renders all cards. Negligible at 2 deals; structural at scale. *(Steps 7, 8)*
4. **Drag ignores the mutation result** — `moveOpportunityToStage` is awaited but its success/failure is discarded: no rollback if the server rejects, no reconcile with canonical values. *(Step 8)*
5. **Board row carries free-text `description` + `lost_reason`** that only the modal needs. Zero bytes today, but uncapped as deals grow. *(Step 6)*

## Security & business posture (unchanged, verified)

Every CRM endpoint enforces `requireAuth()` + `requireModuleAccess(auth,"CRM")` + tenant scope via server-derived `auth.tenant_id` (never client-supplied); mutations additionally gate `requireModuleAction(…, "create"/"edit")`. No branch/owner-level row scoping exists today (tenant-only) — pre-existing, unchanged. No service-role bypass. The picker change **removes** contact fields from the browser (net security improvement); it must never widen tenant scope or expose sensitive fields. Koleex AI receives no new CRM context from this wave.

## Scope decisions driven by the measurements

- **No pagination / virtualization / per-column pagination** — deal volume is **2**; the task forbids introducing them without measured need. Documented, not applied.
- **Board slim projection** — implemented as an explicit, `description`/`lost_reason`-free board projection (`?view=board`) with the modal hydrating full detail on open. Payload win is ~0 **today** (empty descriptions) — the value is **structural** (caps growth), and it is safe because `description` is currently empty on all rows.
- **Picker server-search** — the real current win; replaces the full-directory download with a bounded, debounced, cancellable CRM-gated search endpoint.

## Measurement note

Real P50/P75/P95/P99, bytes on the wire, DOM node counts, and React commit
durations are Vercel-log / Speed-Insights / authenticated-profiler only (not
reachable from the build environment). The new `crm.*` metrics are emitted so an
operator can pull them from a traffic window. **No percentiles fabricated.**
