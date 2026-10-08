# PROMPT — Monthly Employee Rating System for KOLEEX Hub (professional plan)

You are a principal product architect and staff software engineer. Produce a PROFESSIONAL, DETAILED implementation plan for a "Monthly Employee Rating System" inside KOLEEX Hub — an existing production enterprise platform. Do NOT write code. Produce the plan only. Think hard, challenge my assumptions, and ADD your own better ideas — I want suggestions I haven't thought of.

---

## 1. WHAT KOLEEX HUB IS (production facts — your plan must fit this reality)

A modular enterprise operating platform (ERP + HR + CRM + collaboration + AI), single small company (garment machinery, China HQ, international business), ~15–30 employees.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Supabase Pro (PostgreSQL + RLS + Auth) · Vercel · Electron desktop · Tailwind v4 with a strict design system ("Aurora" skin: glass surfaces, design tokens).

**Hard constraints of the platform:**
- **Security:** every table has RLS; the ONLY access path is service-role server APIs that check module permission + tenant + ownership. Frontend hiding is never security. New tables follow the lockdown pattern (RLS on, no public policies, revoked from anon/authenticated).
- **Permissions:** a module catalog (`koleex_permissions` per role: can_view/create/edit/delete) + per-account overrides. Module keys like `employees`, `appraisals`, `hr` already exist.
- **Performance:** users in Mainland China, no VPN — no N+1, bounded queries, one-request-per-screen, <100ms UI feedback target.
- **i18n:** every user-facing string in en/zh/ar via typed dictionaries.
- **UI:** reuse kds components (Modal, FormModal, Select, SearchCombobox, PopoverPanel, EmptyState…), full-width row lists, `PageHeader` + `AppHomeMenu` conventions, colored outline buttons + glow hover for meaningful colors, `data-kx-keep-hover` escape hatch required for colored hovers under Aurora.
- **NO "Reminders" app — decided by the owner (2026-10-07).** A reminder is a task with a time; a separate app would duplicate the To-do data model and fragment one question into two screens. Reminder capabilities live in: To-do (a `remind_at` time + push notification), Calendar (already has reminder_minutes + cron), Events (event reminders + RSVP nudges), and the AI agent (natural-language "remind me…" creates a To-do or Calendar entry). Do NOT propose a new Reminders app.

## 2. WHAT ALREADY EXISTS (verified in the codebase — REUSE, do not reinvent)

**HR module** (`/hr` app, `src/components/hr/modules/`):
- **Skills system:** `skills` library (categories, i18n names, is_active), `employee_skills` (current score 0–100), `employee_skill_history` (append-only, powers old→new delta views), `position_skill_requirements` (per-position: required_score, weight, is_mandatory). The HR › Skills module already does periodic re-assessment with **week/month/year period views**. Scoring engine: `src/lib/skills/scoring.ts` (weighted normalized averages 0–100, levels: No Experience/Beginner/Intermediate/Advanced/Expert/Master; score NULL = unassessed ≠ 0).
- **Behavior system:** `behavior_indicators` (+ categories), behavior assessments seeded from position templates, scored with comments/evidence, **finalize = immutable**, critical-gap detection regardless of average, tenant-wide reporting strip. `src/lib/behavior/scoring.ts`.
- **Appraisals:** cycles + reviews + employee goals (draft/in_progress/completed).
- **Attendance, Leave, Payroll, Recruitment, Training, Onboarding, Documents, Reports (HR dashboards)** modules all exist.

**Management app** (`/management`): departments tree, positions with `reports_to` hierarchy, employee assignment, roles & permissions grid, position history/audit, org charts, transfers, circular-hierarchy validation. ⚠️ Known issue: the skills/behavior tables exist in production but their migration files are missing from the repo (governance gap to fix).

**Reports app:** typed template catalog (`src/lib/reports/catalog.ts`) — existing HR templates `hr_skills`, `hr_behavior`, `hr_appraisal`, `hr_appraisal_results` (some `confidential: true`); reports are written per template and **sent to named readers** (per-reader visibility enforced server-side); report obligations/deadlines already drive calendar mirrors and reminders (`src/lib/server/reports/`).

**KOLEEX AI:** agent with 23 tools (`src/lib/server/ai-agent/tools/`: calendar, notes, reports, inventory, product-price, knowledge-search…), provider-independent orchestration, **AI permissions = user ∩ tenant ∩ module ∩ tool** (never more than the user). Adding a new tool follows an established registry pattern.

**Notifications:** typed notification registry (in-app push), mute/pause, per-language templates.

## 3. THE CEO'S REQUIREMENTS (verbatim intent)

1. A **monthly rating** for every employee covering **skills AND behavior** (plus anything else you recommend).
2. A **master list of all possible skills and all possible behaviors**: some **common/general** (apply to every employee), some **position-specific** (derived from the employee's position).
3. Each skill/behavior scored **0–100** by HR or the CEO, based on their judgment. Scores map to **status bands** (his example: 20/100 = bad, 60/100 = average — example numbers only; final bands configurable).
4. When a month's rating is finished, it becomes a **report** (from the Reports app) **sent to each employee**; the CEO also receives the report for the HR manager (CEO rates the HR manager too).
5. Next month the scores update and the system shows **increase/decrease vs last month and by how much**, per skill/behavior and overall.
6. **KOLEEX AI gives concrete improvement suggestions** so an employee can raise weak scores.
7. Everything must be **connected to other apps** (Management/positions, Employees, Reports, Training, AI, Calendar).
8. The Management app must be **audited and any issues fixed** as part of this work.

## 4. WHAT I WANT FROM YOU

Produce a professional plan containing:

A. **Product design** — the full lifecycle: cycle open → scoring → finalize → report → next month. Who sees what, who scores whom (matrix: CEO / HR manager / direct manager / employee), edge cases (new hire mid-month, transfer mid-month, unfinalized cycles, disputed scores, employee with no position).

B. **Data model** — exact tables/columns/constraints/indexes. Reuse `employee_skill_history` vs new monthly tables — argue your choice. How bands are stored/configured. How deltas are computed (stored vs derived). Cycle state machine.

C. **Scoring model** — how the overall monthly score is composed from skills + behavior + optional extra factors (attendance? goals? — recommend and weight them). Mandatory vs optional items. What happens when an item is left unassessed. How position changes mid-history are handled.

D. **Status bands** — propose a professional band scheme (with configurable thresholds) and the labels in en/zh/ar.

E. **UX flows** — screen-by-screen for the scoring workspace (bulk scoring across employees? per-employee?), the employee's view of their own report, the CEO/HR dashboard (who improved, who declined, company heatmap), notifications. Keep it consistent with the platform conventions described above.

F. **Reports integration** — new template design (`hr_monthly_rating`), auto-generation on finalize, reader rules (employee sees own only; HR/CEO see all; confidential flags), calendar mirrors, reminder cron.

G. **AI coaching** — the `employee-ratings` tool for the agent (what it may read, permission intersection), the suggestion engine (what data feeds it, prompt shape, where suggestions surface: report + AI chat), and how to keep suggestions constructive/non-judgmental and consistent with HR policy. Guardrails.

H. **Permissions & security** — exact module key(s), role grants, server-side checks, what the employee may NEVER see (others' scores, weights?).

I. **Phased implementation plan** — ordered phases with dependencies (including the Phase 0 Management audit + missing-migrations fix), each phase independently shippable and verified (tsc/eslint/build + live test). Estimate relative effort.

J. **Risks & open questions** — what could make this fail culturally/operationally (score anxiety, gaming, manager bias), and how the design mitigates it. Anything you need decided before implementation.

K. **Your own additions** — at least 3 substantive ideas NOT in the requirements above that would make this system exceptional (e.g., skill-gap analytics, succession signals, training ROI tracking, peer/self-assessment dimensions, score-vs-salary-decision audit trail…).

**Format:** numbered sections A–K, concrete and specific (table names, API route shapes, field names). No fluff, no restating my requirements back at me. Where you disagree with a requirement, say so and propose the better alternative.
