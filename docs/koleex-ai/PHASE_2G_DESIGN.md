# Phase 2G — design for review

**Status: PROPOSAL. No code written, no schema created, nothing deployed.**

This document exists because of a standing rule: *before any new schema, explain
the reason, schema, index, RLS, migration, rollback and expected load; never
create unnecessary tables.* Writing that explanation is the first step of 2G, so
it is done here before anything else.

2G is the last open sub-stage of Phase 2. Everything else in Phase 2 has shipped.

---

## 1. The headline: the evolution plan's own 2G proposal is wrong

`KOLEEX_AI_EVOLUTION_PLAN.md` §F, Phase 2 says:

> **DB changes** — `ai_sessions` (device registry: device id, platform,
> refresh-token hash, last seen, revoked_at) — additive.

**That table should not be created.** Reading the repository rather than the
plan turns up an existing, deliberately-staged session programme that already
owns every column it proposed:

| Already exists | Where | Holds |
|---|---|---|
| `account_sessions` | `supabase/migrations/create_security_infrastructure.sql` | `session_token_hash` (sha256, unique), `device_name`, `device_type`, `os`, `browser`, `ip_address`, `last_active_at`, `expires_at`, `created_at`, `revoked_at` |
| `account_api_keys` | same migration | `key_prefix`, `key_hash` (sha256, unique), `scopes[]`, `expires_at`, `last_used_at`, `revoked_at` |
| `account_login_history` | same migration | login audit |
| `app_sessions` | `super_admin_activity_monitoring.sql` | live presence per device, `status` incl. `'revoked'`, `revoked_at`, `revoked_by`, `UNIQUE (account_id, device_id)` |
| `accounts.sessions_valid_after` | referenced by `session-validate-shadow.ts` | the global "invalidate everything before T" primitive |

And a staged rollout is already **in flight**, documented in
`docs/settings-active-sessions-plan.md`:

1. **S1** — shadow write on login (`session-shadow.ts`, flag `SESSION_STATEFUL_SHADOW`)
2. **S2** — dual-read validate (`session-validate-shadow.ts`, flag `SESSION_STATEFUL_VALIDATE_SHADOW`) — live, shadow-only, account-scoped
3. **v3** — per-token cookies, so a request can identify a *specific* session row (`session-codec.ts` already dual-reads v1/v2; v2 is not minted yet)
4. **Enforce** — with a grandfather rule for untracked legacy cookies and a kill switch

Creating `ai_sessions` on top of this would build **a second session system beside
one already being built**. That is not duplication — it is a security defect:
revocation would be split across two tables, and "sign out everywhere" would
miss the AI's sessions. It also directly violates *never create unnecessary
tables* and *do not rewrite the whole project*.

**Recommendation: strike `ai_sessions` from the plan.** Bearer auth rides the
existing programme or it waits for it.

---

## 2. What 2G was supposed to deliver, re-scoped

The plan bundles three findings into 2G. They are separable, and only one is
actually blocked.

| Finding | What it is | New schema? | Status |
|---|---|---|---|
| **N1** — cookie-only auth | no bearer, no per-device revocation; `SESSION_SECRET` rotation kills every session at once | **No** — see §1 | **BLOCKED** on the stateful-session rollout (steps 1–4 above) |
| **N2** — no API version namespace | response shapes coupled to today's components | **No** | **Ready** — independent of auth |
| **N3** — `requireInternalUser` 403s every AI route | correct today; incompatible with a general user who has no Hub account | **No** | **Needs your decision** — it is a permission change |

---

## 3. N1 — bearer auth. Recommendation: **defer, do not build**

The blocker is not technical difficulty. It is that steps 1–4 of the session
rollout are a **team decision about production traffic** (turn the shadow flags
on, watch parity, then mint v3 cookies, then enforce with a kill switch). That
sequencing exists to be lock-out-safe. Accelerating it for the AI's benefit
would step over it, and `docs/settings-active-sessions-plan.md` says so
explicitly about a different feature that was already held back for the same
reason.

**When the rollout reaches v3, bearer auth for a native client is small:**

- A native client presents an opaque token; the server hashes it and matches
  `account_sessions.session_token_hash` — the same row a web session uses.
- Per-device revocation is `revoked_at` on that row. It already exists.
- "Sign out everywhere" is `accounts.sessions_valid_after`. It already exists.
- Long-lived machine access, if ever wanted, is `account_api_keys` with
  `scopes[]` — also already there, and currently unused by any code path.

**Nothing about that needs a new table.** It needs the v3 cookie/token format,
which is already the next step of someone else's staged plan.

**What I would do instead, if you want progress on N1 now:** nothing in the
database. The useful, zero-risk preparation is to make the AI routes read
identity through one function so that swapping cookie-only for
cookie-or-bearer later is a change in one place. That is §4.

---

## 4. N2 — `/api/v1/ai/*`. Recommendation: **do it, no schema**

Today the AI routes are `/api/ai/*` and their response shapes are whatever the
current Hub components happen to need. A second client — the standalone web
app, then desktop, then native — pins those shapes permanently the day it
ships. A version namespace is the cheap moment to draw that line, and it is
cheap *only before* a second client exists.

**Shape:**

- `src/app/api/v1/ai/*` — thin transports over the same core, which after
  Phases 2A–2F is a set of modules, not a monolith.
- Legacy `/api/ai/*` stays live and unchanged, delegating to the same core, for
  one release. The Hub UI is not touched at all.
- Auth on `/api/v1/*` accepts **cookie today**, and is written so that adding
  bearer later is one function, not a rewrite (§3).

**Risk:** low. Additive routes; nothing existing changes. The existing suites
plus a new one asserting that both namespaces resolve to the same core.

**Rollback:** delete the `v1` directory. Nothing depends on it until a client
does.

---

## 5. N3 — replacing `requireInternalUser`. **This is the part I need you to decide**

`requireInternalUser` is a hard door on all 12 AI endpoints: `user_type !==
"internal"` → 403. Its comment records it as an owner directive (2026-08-03),
with the reasoning stated plainly: *"the tools would deny anyway" is not an
acceptable exposure — block at the door.*

The standalone product vision conflicts with that door: a general-purpose
Koleex AI user who has **no Hub account at all** cannot get past it.

Three options, with what each costs:

**Option A — keep `requireInternalUser` exactly as is.**
Standalone Mode B never ships for non-Hub users. The AI stays an internal
assistant with more clients (web/desktop/mobile for *internal staff*). Zero
security change. This is the smallest honest scope, and it may well be the
right one — "standalone" was defined in Amendment 1 as independent of the Hub
**UI**, not necessarily open to non-Hub people.

**Option B — entitlements alongside the door, not instead of it.**
`requireInternalUser` stays for every existing route. A **new** capability check
gates the `v1` namespace only: general capabilities (chat, translate, general
knowledge) for any authenticated account; Hub capabilities gated by
`koleexHub.isConnected(ctx)` — which Phase 2H already built and which is derived
server-side from the session, never from a client claim. No existing route
loosens. No new table (entitlements live in `accounts.preferences`, per the
plan's own "no new column if avoidable").

**Option C — replace the door with entitlements everywhere.**
What the plan proposed. It removes a defence-in-depth layer that exists because
of a specific owner directive. **I do not recommend this**, and would want the
directive revisited by you explicitly before touching it.

**My recommendation: A now, B when a non-Hub user actually exists.** Neither
requires schema. C should not happen without you reversing the 2026-08-03
directive in writing.

---

## 6. If you approve, what 2G actually becomes

| Piece | Schema | Risk | Gate |
|---|---|---|---|
| `/api/v1/ai/*` namespace, cookie auth, one identity function | none | low | new suite: both namespaces hit the same core; permissions identical on both |
| Identity read centralised so bearer is a later one-line addition | none | low | asserted: AI routes resolve identity through one function |
| `requireInternalUser` | **unchanged** (Option A) or **additive only** (Option B) | none / low | asserted: no existing route's gate is weakened |
| `ai_sessions` | **not created** | — | — |
| Bearer tokens, per-device revocation | **deferred to the v3 session rollout** | — | — |

**Every one of your standing rules is satisfied by this scope:** no weakened
permissions, no client-decided permissions, no privileged credential on any
client, no unnecessary table, no new schema at all, and no claim that bearer
auth is "done" when it is not reachable.

---

## 7. What I need from you

1. **Do you accept striking `ai_sessions` from the plan?** (I believe the
   evidence is conclusive; I would like it confirmed rather than assumed.)
2. **N3: Option A, B, or C?**
3. **Should I build the `/api/v1/ai/*` namespace now**, or hold it until a
   second client is actually being written?

Until you answer, 2G stays unstarted. Phase 3 (provider abstraction) is ready
and needs none of these decisions — 2D isolated the vendor surface into one
file specifically to make it a contained change, and finding **N8** (the agent
route's parallel provider call) belongs to it.
