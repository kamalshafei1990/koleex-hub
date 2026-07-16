# CRM Performance — Results (Phase 4 Wave 2B.2)

Evidence-based, smallest-safe optimization. No schema change, no service-role
bypass, no permission change, no broadening of customer/contact data in the
browser. All changes are additive + reversible.

## Shipped

1. **Contact picker → bounded server search** (`ContactComboboxField`,
   `OpportunityModal`, new `GET /api/crm/contacts/search`, `searchCrmContacts`).
   The deal modal previously downloaded the **entire tenant contact directory**
   (`fetchContacts()`, 259 contacts / 6 tenants) into the browser on every open
   and filtered it client-side. It now issues a **debounced (250 ms), abortable,
   stale-guarded** search that returns **≤ 20 slim rows** (min 2 chars, server
   enforced). IME (Chinese) composition is respected; the currently-selected
   contact stays visible with **no broad fetch**. This is both the largest
   current-weight win **and** a field-exposure reduction — the endpoint returns
   only the 6 display fields the combobox needs (id, name, company, email,
   entity/contact type, photo), never notes / credit terms / addresses / tax ids.
2. **`/finance`-style non-blank mutations** — `reload()` gained a `soft` mode.
   Save / quick-add / stage fold-delete / generate-leads now reload **without**
   flipping `loading=true`, so the board stays on screen (filters + scroll
   preserved) instead of blanking to a spinner.
3. **Drag rollback + reconcile** — the optimistic stage move now **rolls back**
   to the pre-drag stage if the server rejects the move (previously the card was
   left stranded in the wrong column). No full-board refetch on a move (was
   already the case; preserved).
4. **Board slim projection** — `GET /api/crm/opportunities?view=board` returns an
   explicit column list **excluding the free-text `description`**; the edit modal
   hydrates the full row on open via the new `GET /api/crm/opportunities/[id]`
   (instant paint from the in-memory row + async description merge, guarded so a
   typing operator is never overwritten). `lost_reason` is retained on the board
   to avoid nulling it on save.
5. **Memoised kanban card** — `OpportunityCard` is now `memo`-wrapped with a
   reference comparator, so a drag-over (which flips top-level `hoverStageId`)
   or an unrelated single-card update no longer re-renders every card.
6. **Privacy-safe instrumentation** (via the existing perf client):
   `crm.board.{total_ms,first_column_ms,full_ready_ms,request_count,rerender_count}`,
   `crm.modal.open_ms`, `crm.picker.{search_ms,cancelled}`, `crm.filter.settled_ms`,
   `crm.drag.{drop_ack_ms,reconcile_ms,rollback}`, `crm.mutation.error`. Only
   durations / counts leave the browser — **never** deal titles, customer names,
   emails, phones, values, notes, search text, or record ids (asserted by
   `validate:crm-perf`).

## Before / after

| Metric | Before | After | Change | Samples |
|---|---|---|---|---|
| Initial CRM requests | 2 (stages + opportunities) + 4 shell | 2 + 4 | 0 (already parallel, no waterfall) | code-derived |
| Board rows returned | 2 | 2 | 0 | real production |
| Board payload bytes | negligible (2 rows, empty descriptions) | negligible (now description-free) | structural cap on growth | real production |
| First visible column / full board usable | after both fetches settle | same, plus timing now emitted | instrumented | code-derived |
| Modal open | instant (in-memory) + **whole-directory download** | instant (in-memory), directory download **removed** | picker no longer blocks/streams the book | code-derived |
| Picker payload | entire tenant directory, every open | ≤ 20 slim rows, only while typing ≥ 2 chars | large reduction (scales with contacts: 259/6 tenants) | code-derived |
| Picker search settled | n/a (client filter over full book) | `crm.picker.search_ms` emitted | new | code-derived |
| Card renders on one move | all cards (no memo) | only the moved card(s) | memoised | code-derived |
| Drag acknowledgement | optimistic, **no rollback** | optimistic + rollback on failure | correctness fix | code-derived |
| Full-board refetches / move | 0 | 0 | unchanged (already optimistic) | code-derived |
| Full-board blank / other mutation | 1 (spinner) | 0 (soft reload) | eliminated | code-derived |
| Long tasks / P50–P99 / DOM nodes / commit ms | — | — | **unavailable** (authenticated-profiler / Vercel-SI only) — **not fabricated** | — |

Real percentiles, bytes on the wire, DOM node counts, and React commit
durations are Vercel-log / Speed-Insights / authenticated-profiler only (not
reachable from the build env). The `crm.*` metrics now feed them; an operator
pulls per-interaction P50/P75/P95 from a traffic window. **No values invented.**

## What was deliberately NOT done (evidence-based)

- **No pagination / virtualization / per-column pagination.** Production has **2
  deals**; the task forbids introducing them without measured need. Documented,
  not applied. Revisit if deal volume grows materially.
- **No `PipelineColumn` memo.** With ~5 columns and memoised cards, the residual
  column re-render (header + progress bar) on hover is cheap; column memo needs
  an `isHoverTarget`-style prop change and adds risk for no current gain.
- **No owner/product/quotation picker changes** — CRM has none (owner defaults to
  the current account; no product/quotation dropdowns).

## Filters & refresh

Board filters (search / my-only / stage / priority) are **client-side over the
already-bounded board** (no per-keystroke network) — correct for 2–500 deals.
`crm.filter.settled_ms` records the change→frame time. Filters + scroll survive
opening and returning from a deal (soft reload). The picker search cancels stale
requests and stale-guards out-of-order responses.

## Permission & tenant validation

No change to any query result set, permission, or tenant scope. Every CRM
endpoint (opportunities list + `[id]` + move + stages + activities + the new
contacts/search) remains `requireAuth` + `requireModuleAccess("CRM")` (or
`requireModuleAction`) + server-derived `auth.tenant_id` (asserted in
`validate:crm-perf`). The picker change **removes** contact fields from the
browser — a net security improvement. Koleex AI receives no new CRM context.

## Tests & build

`validate:crm-perf` **51/51** (picker server-search, endpoint gating + slim
fields + min-query, board slim projection + modal hydrate, drag rollback +
metrics, soft reload, memoised card, privacy-safe metrics, all 6 endpoints
auth+CRM+tenant-gated). Regressions green: `finance-perf` 42, `app-launch` 51,
`suppliers-security` 45, `customers-gate` 10, `server-list` 28. `tsc` clean;
`next build` green.

## Rollback

Additive + reversible: revert the merge, or per-file (remove the picker search
foundation, restore `fetchContacts`, drop `?view=board`, remove the memo /
soft-reload / rollback / instrumentation). No schema / RLS / auth / permission
change to undo.

## Remaining CRM bottlenecks (→ future, out of scope)

- `visual`-heavy alt views (Pivot / Graph / Map) recompute over `filteredOpps`
  each render — negligible at 2 deals; memoise if volume grows.
- `PipelineColumn` memo + `isHoverTarget` prop split — deferred (tiny column
  count).
- If deal volume grows past a few hundred, revisit per-column pagination /
  virtualization (explicitly measured-gated).
