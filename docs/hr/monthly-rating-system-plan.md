# Monthly Employee Rating System — Implementation Plan

**KOLEEX Hub · 2026-10-07 · Principal architect plan, verified against the codebase the same day**

Scope rule for this document: every structure named here was checked against the repo on
2026-10-07. Where the repo and the brief disagreed, the finding is written down in §I
(Phase 0) — two of the brief's "exists" claims need repair before anything else ships.

---

## A. Product design — the lifecycle

### A.1 The cycle

One cycle per tenant per calendar month. State machine:

```
draft → scoring → review → finalized → published
                    ↑________│  (reopen, only CEO/HR, audited)
```

- **draft** — created automatically by cron on the 25th of the month (configurable) so
  scoring can start before month-end; items are pre-composed from each employee's position
  at that moment (see C.4 for mid-month changes).
- **scoring** — scorers fill items; everything editable; nothing visible to employees.
- **review** — HR locks scoring and reads the calibration view (§E.3): distribution,
  outliers, missing evidence. Disputed or implausible scores bounce back to `scoring`
  with a note. Employees still see nothing.
- **finalized** — immutable. Deltas vs the previous cycle are computed and stored here
  (B.4), reports are generated (F), notifications queued.
- **published** — reports delivered to employees; the employee view unlocks. Splitting
  "finalized" from "published" gives the CEO a review window before anyone reads their
  score — the one moment a wrong score does real damage.

### A.2 Who scores whom (the matrix)

| Ratee | Primary scorer | Secondary (input, not binding) | Approver |
|---|---|---|---|
| Regular employee | HR manager *(owner, 2026-10-07: CEO + HR score for now; direct managers join in a later phase)* | CEO | CEO |
| Manager | HR manager | CEO | CEO |
| HR manager | CEO | — | CEO |
| CEO | — (no rating, or board/self only) | — | — |

**Where I disagree with the brief:** "scored by HR or the CEO" puts the person furthest
from the work in charge of judging it — that is the classic way rating systems lose
credibility in month two. The direct manager observes the work daily; HR calibrates
across departments (they see the whole distribution, managers see only their team).
HR's power in this design is the review step, not the pencil.

Fallbacks: no direct manager → HR manager scores. Employee with no position → general
items only (B.2), flagged on the cycle dashboard until assigned.

### A.3 Edge cases

- **New hire mid-month:** cycle items are composed at cycle open; a hire after that joins
  with `partial: true` and only general items, scored on observed days. First month is
  always marked `partial` so a low score reads as "new", not "bad".
- **Transfer mid-month:** items reflect the position at cycle open; a `position_note` on
  the summary records the change ("rated as QC Inspector; moved to Logistics 12 Oct").
  Next cycle uses the new position.
- **Unfinalized previous cycle:** opening a new cycle while an old one sits in
  scoring/review raises a banner on the HR dashboard and blocks nothing — debt is
  visible, never silent. Two cycles never sit in `finalized` for the same month.
- **Disputed score:** employee can flag their published report "request review" with a
  comment; this creates a task for HR and re-opens nothing automatically — a human
  decides. Every dispute and its resolution is stored (audit trail, §J).
- **Employee leaves mid-cycle:** cycle keeps them with `partial: true`; the report is
  generated (their record matters for exit analysis) but not published.

---

## B. Data model

**Decision first:** do NOT reuse `employee_skill_history` as the rating store. It is an
append-only event stream that answers "how did this skill move" — a monthly rating is a
different thing: a cycle-scoped, composed, finalize-locked document. Sampling into new
tables keeps both honest. The history stream stays the skills module's; the rating tables
reference it, never write to it.

### B.1 `rating_cycles`

```sql
id            uuid pk default gen_random_uuid(),
tenant_id     uuid not null,
month         date not null,                -- always the 1st: 2026-10-01
status        text not null default 'draft'
              check (status in ('draft','scoring','review','finalized','published')),
opened_by     uuid not null references accounts(id),
opened_at     timestamptz not null default now(),
finalized_at  timestamptz,
published_at  timestamptz,
config        jsonb not null default '{}',  -- weights snapshot (C.1) at open
unique (tenant_id, month)
```

RLS: on, no public policies — service-role only, the platform's lockdown pattern.

### B.2 `rating_items` — one row per employee per assessable thing

```sql
id             uuid pk,
cycle_id       uuid not null references rating_cycles(id) on delete cascade,
employee_id    uuid not null,               -- koleex_employees
item_kind      text not null check (item_kind in ('skill','behavior')),
ref_id         uuid not null,               -- skills.id or behavior_indicators.id
scope          text not null check (scope in ('general','position')),
required_score smallint,                    -- from position_skill_requirements when position
weight         numeric not null default 1,  -- copied at open (config lives on the item)
is_mandatory   boolean not null default false,
score          smallint check (score between 0 and 100),  -- NULL = unassessed (never 0)
comment        text,                        -- scorer's note
evidence       text,                        -- required by policy for score < 30 or > 90 (C.3)
scored_by      uuid references accounts(id),
scored_at      timestamptz,
self_score     smallint check (self_score between 0 and 100),  -- K.1, optional dimension
unique (cycle_id, employee_id, item_kind, ref_id)
```

Indexes: `(cycle_id, employee_id)`, `(cycle_id, item_kind)`, `(employee_id, ref_id)` for
trend reads.

### B.3 `rating_summaries` — the computed document, written at finalize

```sql
cycle_id        uuid references rating_cycles(id),
employee_id     uuid,
skills_avg      numeric(5,2),               -- normalized weighted avg of assessed items
behavior_avg    numeric(5,2),
overall         numeric(5,2),               -- config.weights applied
band            text,                       -- from the band config at finalize time
mandatory_gaps  smallint not null default 0,
partial         boolean not null default false,
position_note   text,
delta_overall   numeric(5,2),               -- vs previous finalized cycle, stored (B.4)
delta_skills    numeric(5,2),
delta_behavior  numeric(5,2),
primary key (cycle_id, employee_id)
```

### B.4 Deltas: stored AND derivable

Derived-at-read would be cheaper to write and wrong to trust: a report that says "+6 vs
last month" must keep saying that after next month's edits. Deltas are computed once at
finalize (from the previous finalized cycle) and stored on `rating_summaries`. Per-item
deltas stay derived at read (items are immutable after finalize, so derived == stored
there anyway).

### B.5 `rating_band_config` — bands are data, not code

```sql
tenant_id  uuid,
band       text,          -- internal key: critical|needs_improvement|solid|strong|exceptional
min_score  smallint,      -- inclusive lower bound
label     jsonb,          -- { en, zh, ar }
color      text,          -- token name, never a hex in a table
sort       smallint,
primary key (tenant_id, band)
```

Seeded per tenant at first use; editable in HR settings. The skills module's existing
`levelForScore()` thresholds are the seed values (D) so the two vocabularies start
identical.

---

## C. Scoring model

### C.1 Composition

`overall = skills_avg × w_skills + behavior_avg × w_behavior`

Default weights: **skills 60 / behavior 40**, stored on the cycle at open (`config`),
editable per cycle by HR before scoring starts. Both averages are computed with the
existing normalized-weighted-average semantics from `src/lib/skills/scoring.ts`
(NULL excluded, weights sanitized) — the same pure functions, imported, never
re-implemented.

**Attendance and goals: not in the score.** Recommendations below argue both sides, but
mixing them in punishes twice (attendance already costs salary via payroll; goals already
live in appraisals) and makes the number unreadable ("why is my score low?" should have
one answer). They DO appear on the report as context strips (F.2), not in the math.

### C.2 Mandatory vs optional

Mandatory items (from `position_skill_requirements.is_mandatory` and the behavior
template's critical indicators) must be scored before finalize. A cycle with unscored
mandatory items cannot finalize — the finalize API returns the exact list of what's
missing, per employee.

### C.3 Unassessed optional items

NULL score, excluded from averages (the existing invariant). The report lists them under
"Not assessed this month" — visible absence, not silent zero. Scores below 30 or above 90
require an `evidence` note; the form enforces it and the review step lists every extreme
score with no evidence.

### C.4 Position changes mid-history

Items carry `scope` and a snapshot of the requirement (`required_score`, `weight`) at
cycle open. History therefore reads "what was asked of them then", not "what their
position asks today" — the difference between a fair trend and a rewritten past.

---

## D. Status bands

Five bands, seeded from the existing skills levels so the company speaks one language:

| Band | Range | en | zh | ar |
|---|---|---|---|---|
| Critical | 0–29 | Critical | 危急 | حرج |
| Needs Improvement | 30–54 | Needs Improvement | 待提升 | محتاج تحسين |
| Solid | 55–69 | Solid | 合格 | جيد |
| Strong | 70–84 | Strong | 优秀 | قوي |
| Exceptional | 85–100 | Exceptional | 卓越 | استثنائي |

Configurable per tenant via `rating_band_config` (bounds, labels, color). The brief's
example (20 = bad, 60 = average) is honored by making thresholds data: change two numbers
in HR settings and every report follows.

---

## E. UX flows

### E.1 Scoring workspace (HR / managers) — `/hr/ratings/[cycle]`

- **Grid view (default):** employees × items pivot for the scorer's scope. Row per
  employee, grouped cells per item; click a cell → score popover (0–100 stepper + comment
  + evidence field when the score is extreme). Keyboard: arrows move, digits type, Enter
  commits — a manager scores a team of 10 in minutes, not an afternoon.
- **Per-employee view:** full item list with position requirements, last month's score
  beside each cell (read-only ghost), mini trend sparkline from `rating_summaries`
  history, self-assessment column when K.1 is on.
- Progress header: "38/42 items scored · 2 missing mandatory" — the finalize blocker is
  always visible.
- Reuses: kds `FormModal`, `PopoverPanel`, full-width row lists, `PageHeader` +
  `AppHomeMenu`, colored outline buttons with the `data-kx-keep-hover` hatch. No new
  component primitives without a validator-proof reason.

### E.2 Employee view — their own report

Reads the generated report (F): overall + band, skills/behavior breakdown, per-item
scores with deltas, "not assessed" section, AI suggestions (G), and the "request review"
action. Nothing else — no weights, no others' scores, no comparison data (H.3).

### E.3 CEO / HR dashboard — `/hr/ratings` (cycle list) + cycle overview

- Cycle strip: status, progress, blockers.
- Calibration view (review state): distribution histogram, per-manager scatter (who
  scores harsh, who scores soft), extremes without evidence, mandatory gaps.
- Movers: biggest increases / decreases vs last cycle, per department.
- Company heatmap: department × band counts.

### E.4 Notifications

Typed registry entries: `rating_cycle_opened` (scorers), `rating_scores_due` (48h before
deadline, cron), `rating_published` (employee), `rating_review_requested` (HR),
`rating_needs_ceo` (HR manager's report waiting on the CEO).

---

## F. Reports integration

### F.1 Template

`hr_monthly_rating` in `src/lib/reports/catalog.ts`, group `performance`, confidential.
Data sections: `summary` (overall + band + deltas), `skills` (items, scores, deltas),
`behavior` (same), `context` (attendance summary + goals status, display-only), and
`coaching` (the AI suggestions, G). Follows the existing `hr_skills`/`hr_behavior`
template shape exactly.

### F.2 Generation and readers

On `finalize`: one report per employee, generated by the server, written per template.
Reader rules, enforced server-side like every report today: the employee reads their own
(after `published`), HR reads all, the CEO reads all, and the CEO additionally receives
the HR manager's report as a named reader. Per-reader visibility, never URL secrecy.

### F.3 Calendar + reminders

Report obligations already mirror to the calendar and cron reminders
(`src/lib/server/reports/`) — the rating cycle registers the same way: scoring deadline
on the 28th, finalize by the 3rd, publish by the 5th. Reminders ride the existing
`report-reminders` cron; no new scheduler.

---

## G. AI coaching

### G.1 The tool

`get_employee_rating` in `src/lib/server/ai-agent/tools/`, registered in the catalog as
`domain: "hr"`, `risk: "read_only"`, and the orb map (`reading`). Reads:
- own latest published summary + items — any employee;
- others' summaries — only with module permission `ratings.view` AND the HR/CEO scope
  rule (the AI permission intersection: user ∩ tenant ∩ module ∩ tool, never wider).

### G.2 The suggestion engine

Server-side, at finalize (not at read — suggestions are part of the immutable report):
input = the employee's three weakest items vs required score, their 3-cycle trend, and
their position's mandatory gaps; output = 2–3 concrete suggestions per weak item, stored
on the report's `coaching` section.

Prompt shape (server prompt, never user-editable): role = supportive coach; rules =
name the skill not the person's worth, one action per suggestion, reference Koleex
Training catalog entries when they exist, no comparison to colleagues, no numeric
prediction promises, match the report's language (en/zh/ar). Guardrail validator pins:
suggestions are generated only from items below required score, never mention another
employee, and are absent entirely when the employee has no weak items (a clean month
says "keep going", not manufactured advice).

### G.3 Where suggestions surface

On the report (stored), and live in the AI chat when an employee asks "how do I improve?"
— the tool reads the same stored suggestions first, so the two never disagree.

---

## H. Permissions & security

- **New module key:** `ratings` — "Monthly ratings", in the HR group of
  `koleex_permissions`, with the standard can_view/create/edit/delete. Grants: HR role
  gets full; CEO role gets view + edit; managers get view + edit (scoped server-side to
  their reports); every account gets self-read via a dedicated rule, not a permission.
- **Server checks:** every route under `/api/hr/ratings/*` resolves module permission +
  tenant + scope (manager → direct reports only). Scoring endpoints check
  `cycle.status = 'scoring'`; finalize/publish check the approver role from A.2.
- **Tables:** RLS on, zero public policies, service-role only — the lockdown pattern.
- **The employee never sees:** other employees' anything, item weights, required-score
  internals beyond their own row, calibration data, and the scorer's identity per item
  (the report says "your manager", not a name — depersonalizing the score lowers dispute
  heat, §J).
- **Audit:** every score write logs old→new with actor and timestamp (same append-only
  habit as `employee_skill_history`); finalize/reopen/publish are logged cycle events.

---

## I. Phased implementation

**Phase 0 — Governance repair first (the brief's ⚠️ is real, verified today):**
the skills/behavior/appraisal tables exist in production but their migration files are
missing from the repo, and the generated `src/types/supabase.ts` (42 tables) knows none
of them. Restore the migrations from production (dump schema, diff, write files), run
`generate_typescript_types`, and add a CI check that fails when a table exists in
production with no migration file. Then the Management app audit the brief asks for
(reports_to integrity, circular-hierarchy check, transfer history) — the rating system
reads positions on day one, so its bugs become our bugs. *Effort: S-M. Blocks everything.*

**Phase 1 — Data model + cycle API:** tables B.1–B.5, cycle open/compose logic (item
composition from positions + general pool), state machine endpoints, validators.
*Effort: M. Shippable: cycles open via API, verified by validator + staging.*

**Phase 2 — Scoring workspace:** grid + per-employee views, evidence rules, progress
tracking, self-assessment field. *Effort: L. Shippable: a full cycle scored on staging.*

**Phase 3 — Finalize + reports + notifications:** summaries, stored deltas, template
`hr_monthly_rating`, reader rules, calendar mirrors, notifications, publish flow.
*Effort: M. Shippable: end-to-end cycle closes and every employee gets their report.*

**Phase 4 — Dashboards + trends:** calibration view, movers, heatmap, dispute flow.
*Effort: M. Shippable: second consecutive cycle shows real deltas.*

**Phase 5 — AI coaching:** tool, suggestion engine, guardrail validators, chat surface.
*Effort: S-M. Shippable: report carries coaching; the assistant quotes it verbatim.*

Every phase: tsc + eslint + build + its own validator suite + a staging live test, in
the platform's established rhythm.

---

## J. Risks & open questions

- **Score anxiety** (the cultural killer): mitigated by bands over raw numbers in the
  employee view (the number is there, the band leads), "not assessed" framed as neutral,
  and `partial` for new hires. Open question for the CEO: do employees see their exact
  number, or band-only? My recommendation: show both — hiding numbers breeds suspicion.
- **Manager bias / halo effect:** calibration scatter in review state makes one harsh or
  soft manager visible in one glance; evidence-required extremes make big claims cost a
  sentence.
- **Gaming:** weights snapshotted at cycle open; mid-cycle position edits can't rewrite
  the current month; the audit log makes every edit attributable.
- **Cycle debt:** a month nobody finalizes blocks deltas for everyone after it — the
  dashboard banner and the "two finalized per month" constraint keep it visible, but the
  operational rule (who is responsible for closing) is the CEO's to assign, not the
  software's.
- **Decided by the owner, 2026-10-07:** weights skills 60 / behavior 40 ✓; deadlines
  28th / 3rd / 5th ✓; self-assessment ships in Phase 2 (owner's call: "as you see") ✓;
  scorers for now = CEO + HR manager only — direct-manager scoring arrives in a later
  phase (the matrix in A.2's "primary scorer" column reads HR manager until then) ✓;
  employees see BOTH the number and the band (my call, owner delegated) ✓.

---

## K. My additions — the three the brief didn't ask for

**K.1 Self-assessment as a first-class dimension.** `self_score` already sits on
`rating_items`. The manager sees the employee's self-score only AFTER entering their own
(blind both ways — no anchoring). The gap between the two is the most honest signal in
the system: a large, persistent gap is a conversation that needs to happen, and the
calibration view flags it. Costs one column; buys honesty.

**K.2 Training ROI loop.** Training completions already exist. When a coaching
suggestion names a skill and the employee completes a mapped training, the next cycle's
delta on that skill answers "did the training work?" — per person and per course. Over
six months this tells Koleex which training spend returns and which is theatre. No new
UI: one comparison query on the cycle overview.

**K.3 Succession & retention signals.** Three finalized cycles of "Strong/Exceptional +
rising" on a non-manager = a succession candidate list for Management; two cycles of
"declining from Strong" = a retention risk flag for HR before the resignation letter.
Computed server-side from `rating_summaries` trends, shown only to HR/CEO, labelled as
signals not verdicts — the system suggests, a human decides.

*(Rejected on purpose: peer scoring — 15–30 people is too small for anonymity, and
anonymous-between-three-friends is worse than no peers at all. Revisit at 100+ employees.)*

---

## L. The master catalog (every skill & behavior) + occasion ratings

*(Added 2026-10-07, owner request: "put any possible thing", plus a separate rating
for events and travel beside the monthly one.)*

### L.1 How the catalog is organized

Four layers, so the same item never duplicates and every employee's sheet composes
itself:

```
GENERAL      → every employee, every cycle
FUNCTION     → everyone in a function (e.g. all engineers, all sales)
POSITION     → one position exactly (e.g. QC Inspector vs QC Manager differ)
OCCASION     → event/travel items (L.5), never in the monthly cycle
```

Skills = what you can DO (measurable craft). Behaviors = how you DO it (conduct). The
catalog rows are data in the existing `skills` / `behavior_indicators` libraries with a
new `scope` column (`general|function|position|occasion`) and `function_key` for the
middle layer — the cycle composer reads them in that order.

### L.2 GENERAL skills — every employee, every month

Communication clarity · Written documentation · Time management & planning · Digital
tool fluency (Hub, email, spreadsheets) · Problem solving · Data accuracy · Quality
mindset · Workplace safety & 5S · English working proficiency · Chinese working
proficiency (international staff) · Learning speed · Task follow-through ·
Confidentiality handling · Cost awareness · Meeting discipline

### L.3 GENERAL behaviors — every employee, every month

Reliability (does what was said, when it was said) · Accountability · Teamwork ·
Integrity & honesty · Respect in disagreement · Initiative · Adaptability · Punctuality
& attendance discipline · Response speed to requests · Ownership of mistakes ·
Professional appearance & conduct · Company representation outside · Compliance with
process

### L.4 FUNCTION / POSITION skills — the craft layers (seed lists)

**Engineering & R&D:** technical drawing reading · machine diagnostics · mechanical
design · electrical systems · CAD proficiency · testing & validation · root cause
analysis · product documentation · innovation output · supplier technical evaluation
**Production & Assembly:** machine assembly skill · tolerances & measurement · process
adherence · output rate vs plan · rework rate · machine maintenance basics · material
usage discipline
**Quality Control:** inspection method mastery · defect classification accuracy ·
measurement instrument skill · reporting precision · standard knowledge (ISO) · escape
prevention
**Sales & International Trade:** product knowledge depth · quotation speed & accuracy ·
negotiation · pipeline discipline (CRM hygiene) · customer follow-up · market
intelligence · trade terms mastery (Incoterms) · closing rate
**Marketing & Content:** content quality · brand compliance · campaign execution ·
analytics reading · platform proficiency
**Logistics & Shipping:** documentation accuracy (BL, invoices, packing lists) · customs
knowledge · carrier coordination · on-time shipment rate · cost negotiation
**Finance & Accounting:** bookkeeping accuracy · closing speed · reporting quality ·
compliance · cash-flow discipline
**HR & Admin:** recruitment quality · process execution · employee support response ·
records accuracy
**Software & IT:** code quality · delivery reliability · system uptime ownership ·
security discipline · documentation
**Procurement & Warehouse:** supplier evaluation · price negotiation · stock accuracy ·
receiving discipline · inventory turns
**Customer Service & After-sales:** response time · resolution rate · technical guidance
quality · spare parts accuracy · customer satisfaction
**Managers (any function):** planning quality · delegation · team development · decision
speed & quality · cross-department cooperation · hiring judgment

### L.5 Occasion ratings — events & travel, organized

**The design decision:** do NOT create a parallel system. The same `rating_cycles` /
`rating_items` / `rating_summaries` tables carry it with `kind`:

```sql
-- rating_cycles gains:
kind          text not null default 'monthly' check (kind in ('monthly','occasion')),
title         text,                -- occasion name: "CISMA 2025", "Germany client visit"
occasion_date date,
-- monthly cycles keep unique(tenant_id, month); occasions get unique(tenant_id, kind, title, occasion_date)
```

- **Cadence:** an occasion cycle opens when the event/travel is created (from the
  Calendar app), scores once after it ends, finalizes, publishes. No monthly deltas —
  instead the employee profile shows an **occasion history strip** (CISMA 92 · Canton
  Fair 88 · Germany visit 95) separate from the monthly trend.
- **Participants:** the cycle lists attendees (from the calendar event); each gets items.
- **Item pool (scope = `occasion`):** punctuality & schedule discipline · preparation
  quality · representation & appearance · communication with visitors/clients ·
  negotiation & outcome quality · language use · documentation & follow-up speed ·
  expense discipline · teamwork during the occasion · leads/knowledge captured
- **Who scores:** the occasion lead (the senior person on the trip/booth) scores
  participants; HR approves. The CEO scores the lead.
- **Why reuse the tables:** reports, finalize semantics, notifications, the employee
  view, and the audit trail all come free — an occasion rating is just a cycle with a
  different item pool and no next-month delta.

### L.6 Seeding

Phase 1 ships a seed file (`supabase/migrations/…_rating_catalog_seed.sql`) inserting
L.2–L.5 as inactive-by-default library rows; HR activates per row, edits labels in
en/zh/ar, and assigns position requirements — the catalog is a starting shelf, not a
mandate.
