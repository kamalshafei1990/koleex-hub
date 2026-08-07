# KOLEEX HUB — Full System Revision Plan (v1.0)

Owner directive (2026-08-08): revise the WHOLE system, app by app. Backend: find
bugs, issues, dead code, anything slowing performance; clean the code until every
app is extremely fast — near-zero perceived loading, photos included. Verify each
app is genuinely synced/connected/effective with the apps it must link to.
Frontend: scan every screen's UI/UX for bugs, rough edges, and simplification
opportunities; polish until simple, clean, beautiful; mobile version must fully
match desktop and stay easy and clear.

**Prime target:** easy · clear · beautiful · extremely fast · no lag · no loading
· no bugs · no issues.

**Prime constraint (hard):** never delete or break any data entered manually by
the owner. This program is CODE-ONLY. No DB rows touched, no schema/RLS/auth
changes (those always need an explicit owner ASK per standing policy).

---

## 1. Ground truths this plan builds on (don't re-discover)

- **The system is network-bound, not compute-bound.** ~1s round-trip per request
  from the owner's location to any host. Speed therefore comes from FEWER
  requests, caching/warm-start, optimistic UI, prefetch, smaller payloads — not
  from backend micro-tuning. (memory: perf-network-bound, speed-sweep)
- **Top known liability:** screens that full-download a table then filter
  client-side. The paged/server-list pattern (`useServerList`, `?paged=1`)
  already exists and is opt-in. This program migrates the remaining offenders
  app by app.
- **Already done — verify, don't redo:** RLS lockdown (closed), API action
  gating (closed), KDS unification (kit live), slim list projections
  (products/visual-library/contacts), Phase-4 waves (Finance/CRM/Quotations
  skeletons+pickers), icon registry, density layer, mobile safe-area.
- **Design law:** KOLEEX brand (monochrome + Hub Blue accent, Helvetica, 2D
  only, custom icons only, popup blur, toggles green / sliders blue) outranks
  any skill's aesthetic advice. Approved designs (e.g. Discuss WeChat bubbles)
  are settled — polish, don't re-litigate.

## 2. Method — six lenses per app (with the installed skills)

Every app passes through the same six-lens review. Skills named are loaded for
that lens.

| # | Lens | What we check | Skills |
|---|------|---------------|--------|
| B1 | **Code health** | bugs, dead code, duplicated logic, error handling, type safety, oversized files | code-review (Pocock), code-simplification, debugging-and-error-recovery |
| B2 | **Data & API efficiency** | column-slim selects, pagination, N+1, indexes used, payload sizes, request count per screen, coalescing/caching | supabase-postgres-best-practices, vercel-react-best-practices |
| B3 | **Frontend performance** | route JS size, lazy chunks, image loading (sizes/lazy/placeholders — "no loading even in photos"), waterfalls, skeleton/optimistic UI, CWV | core-web-vitals, performance, vercel-optimize, nextjs-app-router-patterns |
| B4 | **Integration truth** | the app's links to other apps actually work end-to-end: cross-app navigation, activity emitters, notifications, roles gating, semantic icons, shared data flows | (manual trace + audit tables) |
| F1 | **UI/UX scan** | visual bugs, inconsistencies vs KDS, clutter, unclear flows, copy quality, empty/error states, simplification & polish | web-design-guidelines, design-critique, frontend-ui-engineering, tailwind-design-system, accessibility |
| F2 | **Mobile parity** | 360px test, density layer used (not sm:* fights), safe-area, feature parity with desktop, touch targets, header rules | (KOLEEX standing rules + accessibility) |

**Per-app definition of done:**
- 0 known bugs, 0 console errors on happy paths
- Screen opens with ≤ N requests (N recorded before/after; target = fewer)
- Route-level JS chunk measured before/after; images lazy + sized + placeholder
- Every list screen paginated or provably small
- Integrations checklist for that app all green
- Desktop + 360px mobile both clean; parity confirmed
- tsc + prod build pass; live smoke on prod; scoreboard row updated

## 3. Phases & waves

**Phase 0 — Foundations (one session):**
- Build `docs/revision/scoreboard.md`: one row per app × six lenses.
- Baseline measurements: route sizes from `next build` output, request counts on
  opening each core screen, photo loading behavior on the heaviest screens.
- Fix list template + severity scale (P0 broken / P1 slow / P2 polish).

**Waves (apps grouped by daily impact — order within wave by owner priority):**
- **W1 Daily core:** Home/Dashboard, Discuss, To-do, Calendar, Notes, Inbox/Mail
- **W2 Commercial core:** Customers, Quotations, Products, Product Data, CRM, Invoices
- **W3 Supply chain:** Suppliers, Contacts, Inventory, Purchases, Landed Cost, Catalogs
- **W4 People:** Employees, HR, Planning, Projects
- **W5 Money:** Finance, Expenses, Price Calculator, Commercial Policy
- **W6 Content:** Knowledge, Documents, Database, Website, Marketing, Marketing Cards, Events, Markets, Translator, Sales
- **W7 Platform:** AI, Accounts, Roles & Permissions, Settings, Activity Monitor, Issue Reports, Download Center, Management, Software Center + labs/QA utilities

Each app = review → fix → verify → deploy → report (with before/after numbers).
Small apps batch 2-3 per session; big apps (Products, Discuss, HR) get their own.

**Phase Final — System pass:**
- Cross-app consistency sweep (icons, headers, empty states, toasts, dialogs)
- Global perf re-measure vs Phase-0 baseline; publish the wins scoreboard
- Leftovers triage → follow-up backlog

## 4. Safety rails (non-negotiable)

1. **Owner data is sacred:** no deletes, no updates, no "cleanup" of DB rows.
   Any data anomaly found → REPORT ONLY, owner decides.
2. Schema / RLS / auth / infra / billing changes: ASK first, always.
3. Behavior-preserving refactors only; user-visible behavior changes get called
   out in the app's report before deploy when they alter a flow the owner uses.
4. Every deploy: tsc + prod build + live smoke (desktop + 360px) before moving on.
5. Settled owner decisions (memory files) override any skill recommendation.

## 5. Reporting

Per app: one DONE report — what was found (bugs/dead code/slow paths), what was
fixed, before/after numbers, integration checklist result, screenshots where
useful, and the scoreboard row. Program-level: scoreboard doc always current.
