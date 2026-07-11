# Identity & Contact Data — Architecture and Consolidation Plan

**Status:** PLAN ONLY — no schema or data changes made. Nothing runs until explicitly approved.
**Author:** Claude (Opus 4.8) · **Date:** 2026-07-12
**Companion docs:** `docs/settings-active-sessions-plan.md` (same "plan-first, gated migration" style)

---

## 0. Why this doc exists

A person's name / phone / email / address can currently be entered from several apps —
**Settings → Profile**, the **Accounts** app, the **Employees** app, and the **Customers /
Suppliers** app. It *feels* like four disconnected places for the same data, and it isn't
obvious what is synced with what.

This document establishes the ground truth: which table backs each surface, what is
already shared, what is genuinely duplicated, and a safe, staged path to a single
source of truth per field — **without** a risky big-bang migration.

---

## 1. Current state (verified against the codebase)

The 2024 identity refactor
(`supabase/migrations/refactor_accounts_to_identity_system.sql`) split "a person" into an
**identity layer**. A separate **legacy `contacts` table** still powers the customer /
supplier directory. So today there are effectively **two parallel person universes**.

### 1a. The identity layer (shared spine)

| Table | Holds | Edited by |
|---|---|---|
| `people` | name, `display_name`, `name_alt`, `job_title`, **personal** `phone`/`mobile`/`email`, **`address_line1/2`, `city`, `state`, `country`, `postal_code`**, `language`, `notes` | Settings → Profile · Accounts app · Employees app (name + personal contact) |
| `koleex_employees` | `work_email`, `work_phone`, **`private_address_line1/2`, `private_city`, …**, emergency contacts, salary, visa, bank, education (HR-only) | Employees app |
| `accounts` | login identity (`username`, `login_email`, password), `role_id`, `status`, `preferences` (incl. the new `profile` slice: pronouns + links), `person_id` → `people` | Accounts app · Settings (self prefs) |

**Key fact:** `accounts.person_id` links to the **same `people` row** that Settings and
the Employees app read. Editing your phone in Settings already appears in Accounts and in
the employee's name/contact. **This part is already synced** — it just isn't visible in the UI.

### 1b. The business directory (separate island)

| Table | Holds | Edited by |
|---|---|---|
| `contacts` (legacy) | own name fields (`first/last/full/display_name`), `email`, `phone`, `country`/`province`/`city`, `company`, `position`, plus business data: revenue, payment terms, credit, shipping addresses, tags, social profiles, family members, custom fields | Customers app · Suppliers app · Contacts app |

`contacts` has **no `person_id`** and no link to `people`. A human who is both an employee
and a customer contact exists as **two unrelated rows**.

---

## 2. The three real problems

1. **`contacts` is unlinked from `people`.** The biggest fragmentation. Same person =
   two records, no cross-reference, no sync. (Everything else already shares `people`.)
2. **An employee has two addresses.** `people.address_*` (identity/profile address) **and**
   `koleex_employees.private_address_*` (HR's own copy). One concept, two column sets →
   the "why did I type this twice?" feeling.
3. **No visible source-of-truth in the UI.** The DB mostly has one spine, but no screen
   says *"name & contact are the person record, edited in X."* So every app reads like a
   fresh blank form for data that already exists.

Note what is **NOT** actually broken: Settings ↔ Accounts ↔ Employees(name/personal contact)
are the same `people` row. We are not fixing chaos — we are (a) linking the one real island,
(b) removing one duplicate field set, and (c) making the existing spine visible.

---

## 3. Target model

**Principle:** `people` is the single source of truth for a human's *identity*
(who they are + how to reach them). Every other table *references* it and owns only its
context-specific fields.

```
                         ┌──────────────────────────┐
                         │        people            │  ← identity SoT
                         │  name · contact · address │
                         └──────────────────────────┘
                            ▲          ▲          ▲
             person_id ─────┘   person_id ────┐   └──── person_id
                            │                  │
                 ┌──────────┴───────┐  ┌───────┴────────┐  ┌───────────────┐
                 │ koleex_employees │  │    accounts    │  │   contacts    │
                 │ HR-only fields   │  │ login + prefs  │  │ business/CRM  │
                 │ (salary, visa,   │  │                │  │ fields only   │
                 │  emergency, …)   │  │                │  │ (+ person_id) │
                 └──────────────────┘  └────────────────┘  └───────────────┘
```

### Field ownership matrix (target)

| Field group | Lives on | Everyone else |
|---|---|---|
| Legal/preferred/native name, job title | `people` | reference |
| Personal phone / mobile / email | `people` | reference |
| Address (single set) | `people` | reference |
| Language, pronouns, links, avatar | `people` / `accounts.preferences` | reference |
| Work email / work phone | `koleex_employees` | (work identity) |
| Salary, visa, bank, emergency contacts, education | `koleex_employees` | HR-only |
| Login, role, status, preferences | `accounts` | — |
| Revenue, payment terms, credit, shipping addr, tags, CRM activity | `contacts` | business-only |

---

## 4. Staged migration plan (each phase gated + reversible)

Ordering is deliberately **additive-first**: add links and backfill *before* changing any
read/write path, and never drop a column until its replacement has been live and verified.

### Phase 0 — Documentation & UI signposting (NO DB change — safe now)
- This doc.
- Add a one-line note on each identity surface: *"Name & contact are the shared person
  record."* Makes the existing spine visible; removes 80% of the confusion at zero risk.

### Phase 1 — Collapse the duplicate employee address (low risk)
- Decide: `people.address_*` is the person's address; `koleex_employees.private_address_*`
  is retired.
- **Migration (gated):** backfill any `private_address_*` that's non-empty into
  `people.address_*` where `people.address_*` is blank; log conflicts, don't overwrite.
- Rewire the Employees form's address section to read/write `people.address_*`.
- Keep `private_address_*` columns in place (unused) for one release, then drop in a later
  cleanup migration once verified.

### Phase 2 — Bridge `contacts` → `people` (additive, no behavior change)
- **Migration (gated):** add nullable `contacts.person_id uuid references people(id)`.
- Backfill by confident match (email + name) where a `people` row clearly corresponds;
  leave ambiguous rows unlinked (report count). No dedupe yet — just the link.

### Phase 3 — Make `contacts` read identity through `people` (opt-in)
- When `contacts.person_id` is set, the Customers/Suppliers UI shows name/contact from
  `people` (read-through) and writes identity edits to `people`; business fields stay on
  `contacts`.
- Unlinked contacts behave exactly as today (full backward compat).

### Phase 4 — Dedupe & cleanup (highest care — separate sign-off)
- Merge tool for "this contact and this person are the same human."
- After dedupe is stable: drop the retired `koleex_employees.private_address_*` columns.
- Optional: a unified **People / Directory** view that shows a person with their roles
  (employee, customer contact, account) in one place.

---

## 5. Risks & safeguards

- **Data loss on backfill** → never overwrite a non-empty target; log every conflict; run
  in a Supabase branch first; keep old columns until verified.
- **Cross-tenant leakage** → all matching/backfill scoped by `tenant_id`; respect existing
  `contacts` RLS (see `project_rls_public_policy_gap` — `contacts` policies must be verified
  before touching, per `project_contacts_rls_verify_pending`).
- **Wrong auto-merge** → Phase 2 only *links* on high-confidence match; Phase 4 dedupe is
  human-confirmed, never automatic.
- **RLS/read regressions** → `contacts` is service-role-only for the browser client
  (`project_contacts_rls_client_read`); identity read-through must go through server APIs,
  not the anon client.

---

## 6. What's gated (needs your explicit "go" per phase)

Everything touching the database: the Phase 1/2/3/4 migrations, any column drop, any
backfill, and any RLS change. Phase 0 (this doc + UI signpost text) is the only part that
can ship immediately.

## 7. Recommended path

- **Now (safe):** Phase 0 — ship the doc + the "shared person record" signpost line on
  Settings / Accounts / Employees. Kills most of the confusion with zero DB risk.
- **Next (low risk, high clarity):** Phase 1 — one address per person.
- **Then (the real win, careful):** Phases 2–3 — link `contacts` to `people` so an
  employee-who-is-also-a-contact is one human.
- **Later (only if needed):** Phase 4 — dedupe + unified directory.

Each phase is independently valuable and independently reversible. We stop and confirm
before any migration runs.
