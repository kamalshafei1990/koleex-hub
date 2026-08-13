# Authorization-input audit — 2026-08-13

Follow-up to `3c606154`, which closed a privilege-escalation hole in
`dashboard_role`. **The question this audit answers: is there a second place
where an authorization decision reads a value the user themselves can write?**

**Answer: no.** Nothing was found and nothing was changed except the two new
gates in section J of `validate-budgets`. What follows is the evidence, because
"I looked and found nothing" is only worth as much as the looking.

## Scope

541 API routes · 42 AI agent tools · every writer of `accounts.preferences` ·
every writer of `koleex_employees.department` (the new role source).

## The fix landed on the right side — proven by a second writer

`accounts.preferences` has **two** writers:

| route | guard |
|---|---|
| `PATCH /api/me/preferences` | removed in `3c606154` |
| `PATCH /api/accounts/[id]/preferences` | `editingSelf \|\| is_super_admin` — legitimate, merges Settings slices |

The second one still accepts arbitrary top-level keys, including
`dashboard_role`, by design — it is how each Settings tab persists its own
slice. **Had the fix closed the PATCH handler instead of the read, the hole
would still be open through this route.** Closing `getUserExperience`'s read is
what actually made the stored value inert. That is now gate **J1**.

## The new role source is not user-writable

`dashboard_role` now derives from `koleex_employees.department`. Every route
that writes that column requires an Employees module action:

```
employees            requireModuleAction(auth, "Employees", "create")
employees/full       requireModuleAction(auth, "Employees", "create")
employees/[id]       requireModuleAccess(auth, "Employees")
management/*         is_super_admin
```

`/api/hr/data` — the service-role gateway that can write 18 `hr_*` tables —
**cannot reach `koleex_employees` at all**: it is not in the gateway's table
allowlist, and the two org tables it does expose (`koleex_departments`,
`koleex_positions`) are declared `write: false`. So an employee cannot move
themselves into a department that unlocks cost data.

## Routes without an authorization check: 30 of 541, all accounted for

**No authentication (3) — public by design:** `auth/signout`,
`support/membership-request`, `support/sign-in-help`. The Hub is private; the
support routes exist precisely for people who cannot sign in.

**Authenticated, no module check (27).** Every one operates on a resource the
caller owns or on infrastructure: the caller's own AI conversations and
projects, their own push subscription, their own device test notification,
their own activity heartbeat, their own perf sample. `push/*` returns 401 via
`getServerAuth()`.

> **Three of my own scans were wrong before this list settled.** The first
> flagged `products/[id]` and `taxonomy/[kind]` as unguarded — they use
> `requireProductDataAction`, a guard name my pattern did not know. The second
> flagged all four `push/*` routes — they use `getServerAuth()` + 401, not
> `requireAuth`. **A guard that a scan does not recognise reads exactly like a
> guard that is missing.** Every entry above was opened and read.

## AI agent tools: 42, all gated but one — deliberately

`tool-registry` calls `checkModule()` **only when the tool declares
`requiredModule`**, so a tool without one runs ungated. 41 of 42 declare one.
The exception is `getUserPermissions`, which returns the *caller's own*
permission grid and documents the omission in its header.

Field-level access is separate and stricter: `ai-agent/permissions.ts` holds an
explicit `SENSITIVE_FIELDS` allowlist gated behind `can_view_private` /
super-admin, so module access alone never yields cost prices or salaries.

## `notes/[id]/shares` — a delegation, not an escalation

It takes `permission` straight from the request body, which is why the scan
flagged it. But the caller must be the note's **owner** (403 otherwise), the
value is clamped to `"view" | "edit"`, and the target must be an active account
in the same tenant. Granting access to a resource you own is the feature.

## Two gates added (validate-budgets section J)

| | rule | why |
|---|---|---|
| **J1** | `getUserExperience` must not read `preferences` | the exact hole; two writers mean the read is the only safe place to close it |
| **J2** | every AI tool declares `requiredModule` | `tool-registry` silently skips `checkModule()` without it |

**Both were verified by breaking them on purpose.** Re-introducing the
preference read failed J1; deleting one `requiredModule` line failed J2 and
named the tool (`todos.ts: listMyTodos`). Both restored, 57/57.

> My first attempt at that verification "passed" — because the edit that was
> supposed to break the gate silently did nothing (wrong indentation in the
> patch). **A gate you have not seen fail is not a gate you have tested.**

## Filed, not fixed

`hr_*` tables carry no `tenant_id` column at all, so the gateway needs no tenant
scoping today. If the Hub ever runs a second tenant, HR data is shared across
them. That is a schema question, not an authorization bug, and schema changes
are ask-first.
