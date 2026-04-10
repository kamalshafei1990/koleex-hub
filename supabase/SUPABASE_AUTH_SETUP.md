# Supabase Auth Setup Notes

This document describes the dashboard steps required to replace the current
`AdminAuth` client-side gate with real Supabase Authentication. The database
side of things (Security tab tables, audit log, API keys) is already live in
`create_security_infrastructure.sql` — this file only covers the wiring.

Until you run through these steps, the app keeps working as a single-user
admin console: you authenticate via the existing password gate, and the
Security tab's API keys + audit log + device table are all functional via
the untyped admin client.

---

## 1. Enable Email / Password in the Supabase dashboard

1. Open the Supabase project → **Authentication → Providers**.
2. Confirm **Email** is enabled.
3. Under **Email → Confirm email**, disable "Confirm email" for now so admins
   can create accounts without a confirmation round-trip. You can re-enable
   it later once the invite-email flow is in place.
4. Optionally enable **Phone** if you want SMS-based 2FA.

## 2. Enable MFA (TOTP / Passkey)

1. **Authentication → Policies → Multi-Factor Authentication**.
2. Enable **TOTP** for authenticator apps (Google Authenticator, 1Password,
   etc.). TOTP is the baseline factor the Security tab's 2FA section is
   designed around.
3. If you want passkeys, enable **WebAuthn** (still in preview at the time
   of writing). The Security tab already has a Passkeys placeholder section
   that flips to active once the types from `@supabase/supabase-js` expose
   the `mfa.enroll({ factorType: "webauthn" })` call.

## 3. Add Row Level Security to the security tables

The migration currently relies on the untyped admin client (anon key). Once
real auth is wired, tighten the three tables with RLS:

```sql
-- account_api_keys
ALTER TABLE account_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account can read own api keys"
  ON account_api_keys FOR SELECT
  USING (account_id = auth.uid());

CREATE POLICY "account can manage own api keys"
  ON account_api_keys FOR ALL
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());

-- account_sessions
ALTER TABLE account_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account can read own sessions"
  ON account_sessions FOR SELECT
  USING (account_id = auth.uid());

CREATE POLICY "account can revoke own sessions"
  ON account_sessions FOR UPDATE
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());

-- account_login_history (read-only to the account holder; server writes
-- happen with the service role)
ALTER TABLE account_login_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account can read own history"
  ON account_login_history FOR SELECT
  USING (account_id = auth.uid());
```

Admins should access everything via the **service role key** on the server,
not the anon key. That means the Security tab will need to move its
`fetchApiKeys` / `fetchSessions` / `fetchLoginHistory` calls behind a thin
`/api/security/*` route handler that runs with the server-side client.

## 4. Link `accounts.id` to `auth.users.id`

The `accounts` table currently has its own `id` + `password_hash`. When you
flip the switch:

1. For every active account, create a matching `auth.users` row (via
   `supabaseAdmin.auth.admin.createUser({ email, password })`).
2. Set `accounts.id` to equal the new `auth.users.id` so the RLS policies
   above work without a second join.
3. Drop `accounts.password_hash` — Supabase Auth owns it now.

A one-shot migration script lives in the product backlog under
`scripts/migrate-accounts-to-supabase-auth.ts` (not yet written).

## 5. Replace `AdminAuth` with a real session check

The current `AdminAuth` component (see `src/components/AdminAuth.tsx`) is a
client-side password gate. Once Supabase Auth is enabled:

1. Wrap the admin routes with `supabase.auth.getSession()` in a server
   component, redirecting to `/login` when no session exists.
2. Use `supabase.auth.onAuthStateChange` client-side to keep the UI in sync.
3. The existing `logEvent(accountId, "login_success", …)` calls in the
   auth flow hook into Supabase's `SIGNED_IN` event.

## 6. Session tracking

`account_sessions` lives alongside Supabase's internal `auth.sessions` table
on purpose. It captures _device-level_ metadata that we surface in the
Security tab (device name, OS, browser, IP, last active). The wiring looks
like:

```ts
// On login (server-side)
await createSession(accountId, session.access_token, {
  user_agent: req.headers["user-agent"],
  ip_address: req.headers["x-forwarded-for"] ?? req.socket.remoteAddress,
  expires_at: new Date(session.expires_at * 1000).toISOString(),
});

// On every authenticated request (or a heartbeat route)
await touchSession(sessionRowId);

// On sign out / session revoke
await revokeSession(sessionRowId);
```

## 7. Audit log

`logEvent(accountId, eventType, metadata)` is already wired into:

- `resetAccountPassword` → `password_reset`
- `setForcePasswordChange` → `force_reset_enabled` / `force_reset_cleared`
- `setAccountStatus` → `logout` (with a `status_change` reason)
- `createApiKey` → `api_key_created`
- `revokeApiKey` → `api_key_revoked`
- `revokeSession` → `session_revoked`

When real auth lands, also call `logEvent` from the sign-in / sign-out / MFA
flows:

- `login_success`, `login_failed`, `logout`
- `two_factor_enabled`, `two_factor_disabled`
- `passkey_enrolled`, `passkey_revoked`

All thirteen event types already exist in the CHECK constraint on
`account_login_history.event_type`, so no further migration is needed.

## 8. Deprecate `hashTempPassword`

`src/lib/accounts-admin.ts#hashTempPassword` writes a base64 placeholder
into `accounts.password_hash`. It's explicitly not a cryptographic hash —
just a round-trip tag for the pre-auth world. Delete it (and the column)
as part of step 4 above.

---

## Summary

| Piece                          | Status               |
| ------------------------------ | -------------------- |
| DB tables (keys/sessions/log)  | ✅ Shipped            |
| CRUD in `account-security.ts`  | ✅ Shipped            |
| Security tab UI                | ✅ Shipped            |
| Audit log wiring (admin ops)   | ✅ Shipped            |
| Supabase Auth provider enabled | ⏳ Dashboard step    |
| RLS policies on 3 tables       | ⏳ Run SQL above     |
| `accounts.id ↔ auth.users.id`  | ⏳ Migration script  |
| `AdminAuth` → real session     | ⏳ Code change       |
| Session heartbeat / MFA / PW   | ⏳ Follow-up PR      |

Everything in the ⏳ rows is intentionally out of scope for Project C
Phase 1 — that phase only covers the infrastructure the Security tab needs
to display data. Phase 2 flips the actual auth switch.
