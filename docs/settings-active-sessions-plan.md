# Settings — Active sessions & "sign out everywhere" (implementation plan)

Status: **PLAN ONLY — not built.** This feature is gated because it depends on
the in-progress, deliberately-staged stateful-session rollout. Building the UI
before enforcement lands would create dead/misleading controls (a "sign out"
button that doesn't actually end sessions) and would step over that staging.
This document maps the feature onto the existing rollout so it can be added
correctly, lock-out-safe, when the time comes.

## What already exists (do not rebuild)

- **`account_sessions`** table — created in `create_security_infrastructure.sql`.
  Columns: `id, account_id, session_token_hash, device_name, device_type, os,
  browser, ip_address, last_active_at, expires_at, created_at, revoked_at`.
- **`accounts.sessions_valid_after`** (timestamptz) — the global "invalidate
  everything before T" primitive; this is what "sign out everywhere" sets.
- **S1 shadow write** — `src/lib/server/session-shadow.ts`
  (`recordSessionShadow`, flag `SESSION_STATEFUL_SHADOW`). On successful login,
  inserts one hash-only `account_sessions` row. Never affects auth.
- **S2 dual-read validate** — `src/lib/server/session-validate-shadow.ts`
  (`runDualReadShadow`, flag `SESSION_STATEFUL_VALIDATE_SHADOW`). On each authed
  request, logs whether the stateful session WOULD validate. Never affects auth.
  Currently account-scoped parity; **per-token matching is v3 (pending).**
- **SA force-logout** — `POST /api/super-admin/session/revoke` (SAM Phase 5).

Today auth is a **stateless signed cookie** (`koleex_session`, HMAC over the
account id, 30-day). A revoked `account_sessions` row does NOT end that cookie —
which is exactly why the Settings UI must wait for enforcement.

## The staged path to enforcement (lock-out-safe)

1. **S1 + S2 on in prod (observe)** — turn the two shadow flags on, watch the
   `[session-shadow]` / `[session-s2]` logs until `would-validate` parity is
   effectively 100% for real traffic. (Team decision — infra/observability.)
2. **v3: per-token cookies** — extend the session cookie to carry the opaque
   token (or its id) so validation can match a SPECIFIC session row, not just
   "account has some active row". Needed for per-device revoke.
3. **Enforce, grandfathered** — in `getServerAuth` (`src/lib/server/auth.ts`),
   after loading the account, additionally check:
   - if the request's session row is `revoked_at != null` → reject (401);
   - if `accounts.sessions_valid_after` is set and the cookie/session predates
     it → reject (401);
   - **if there is NO tracked row (legacy stateless cookie) → ALLOW** (grandfather).
   The grandfather rule is what makes rollout lock-out-safe: existing/untracked
   sessions keep working; only *tracked* sessions can be revoked. Keep a kill
   switch flag (e.g. `AUTH_SESSION_ENFORCE=off|on`) so it can be reverted
   instantly, mirroring the `AUTH_RATELIMIT` pattern.

Only after step 3 is live do the Settings controls become truthful.

## Settings UI + routes (add at the enforce stage)

Under **Settings → Security**, a new "Devices & sessions" section:

- `GET /api/me/sessions` — `requireAuth`; list this account's `account_sessions`
  rows where `revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`,
  ordered by `last_active_at DESC`. Mark the current session (match the request's
  token id). Return `{ id, device, browser, os, ip, last_active_at, current }`.
- `POST /api/me/sessions/revoke` — `requireAuth`, body `{ id }`; set
  `revoked_at = now()` on that row **only if it belongs to the caller**. Block
  revoking the current session id (use sign-out for that). Audit-log it.
- `POST /api/me/sessions/revoke-all` — "Sign out everywhere else": set
  `accounts.sessions_valid_after = now()` for the caller AND `revoked_at = now()`
  on all their rows except the current one. Audit-log (severity: warning).
- Client tab `src/components/settings/tabs/SessionsTab.tsx` — list rows with a
  Revoke button each, plus a "Sign out of all other devices" button. Same
  monochrome iOS grouped style as the other Settings tabs.

Guards: block all writes while `viewing_as` (read-only preview); never accept an
`account_id` from the body — always the session's own.

## Why not now

- Steps 1–3 are the team's security migration, tracked in the shadow modules and
  gated by env flags. Enabling enforcement is a prod-auth change that can lock
  users out if mis-sequenced — it needs the observability sign-off from step 1
  and the v3 cookie change from step 2 first.
- Per the KOLEEX autonomy policy, prod DB / auth / RLS changes require explicit
  approval and must not jump the staged rollout.

When the team is ready to enforce, this plan drops straight in — the tables and
the `sessions_valid_after` primitive are already there.
