# Super Admin Activity Monitoring, Audit Log & Notifications

Enterprise activity monitoring for Koleex Hub: live presence, page tracking,
business-action audit logs, session/device tracking, a Super-Admin live panel,
and security/business alerts.

> **Security first.** No passwords, tokens, secrets, or auth material are ever
> logged. No keylogging, no screenshots, no session replay. Super Admin sees
> activity + metadata only.

---

## 1. Architecture at a glance

Koleex Hub authenticates with a **custom signed cookie** (`koleex_session`),
**not** Supabase Auth. The browser is always the `anon` role with no JWT, so
`auth.uid()` is unavailable to RLS. Consequences that shaped this design:

- **All monitoring tables are service-role-only.** RLS is enabled with **zero
  anon/authenticated policies**, so the browser is denied direct access. Every
  read/write flows through server API routes that authenticate via
  `getServerAuth()` and use the service-role client (which bypasses RLS).
- **The Super-Admin panel reads via short polling** on SA-gated server routes
  (8 s monitor / 15 s feed). No `anon` realtime subscription touches activity
  data, so it can never leak to a non-admin client.
- **Alerts reuse the existing `inbox_messages` + NotificationBell + realtime**
  (category `alert`) — no parallel notification system.

```
Browser (anon)                         Server (service role)              DB (RLS: service-role-only)
─────────────                          ─────────────────────              ───────────────────────────
ActivityTracker  ── POST /api/activity/heartbeat ─▶ heartbeat()  ─────────▶ app_sessions, user_devices
(30s heartbeat,  ── POST /api/activity/track ─────▶ logActivity() ────────▶ activity_events
 page tracking)
module routes    ── (mutation) ──▶ logAudit() ─────────────────────────────▶ audit_logs  ─▶ notifySuperAdmins()
                                                                                              └▶ inbox_messages (category 'alert')
SA panel (poll)  ── GET /api/super-admin/{monitor,feed,user/[id]} ─────────▶ super-admin.ts queries
                 ── POST /api/super-admin/session/revoke ───────────────────▶ app_sessions.status='revoked'
```

---

## 2. Database (migration `super_admin_activity_monitoring`)

All additive. Indexed on the hot columns. RLS enabled, **no policies** (deny
anon/authenticated; service role bypasses).

| Table | Purpose |
|---|---|
| `app_sessions` | Live presence — one row per (account, device). status active/idle/offline/revoked/expired, current_route/module, last_action, ip/country/city, browser/os, last_seen_at, revoked_at/by. |
| `activity_events` | Page views + general activity feed. event_type, route, module, severity, ip/geo/UA, metadata. |
| `audit_logs` | Business-action audit (append-only). action_type, entity_type/id/label, old/new/changed_fields (masked), severity, module, route, ip. |
| `user_devices` | Per-account device registry. device_id, browser/os/type, user_agent_hash, first/last seen, last_ip/country, is_trusted, is_blocked. |
| `notification_preferences` | Per-account alert channel toggles (`prefs` jsonb, default on). |
| `push_subscriptions` | Web-Push endpoints (table ready; sender not yet wired — see §8). |

Pre-existing tables reused (not duplicated): `account_login_history`,
`login_attempts`, `koleex_security_audit`, `inbox_messages`, `accounts`,
`people`, `roles`.

---

## 3. Server utilities

- `src/lib/server/activity.ts` — `requestMeta(req)` (ip/geo/parsed UA),
  `logActivity()`, `touchDevice()` (new-device detection), `heartbeat()`
  (presence upsert + revoke check), `endPresence()`. All best-effort.
- `src/lib/server/audit.ts` — `logAudit()` (masked, append-only),
  `maskValues()` (recursively redacts password/token/secret/key/auth…),
  `changedFields()`, `severityForAction()`. Auto-fans a Super-Admin alert for
  any non-`info` action.
- `src/lib/server/sa-notify.ts` — `notifySuperAdmins()` + `superAdminAccountIds()`.
- `src/lib/server/super-admin.ts` — `onlineUsers()`, `activityFeed()`, `kpis()`,
  `userDetail()`, `revokeSession()`, `accountDirectory()`.
- `src/lib/activity/modules.ts` — shared `routeToModule()`.

## 4. Client

- `src/lib/activity/device-id.ts` — stable, non-PII device id (localStorage +
  cookie mirror).
- `src/components/activity/ActivityTracker.tsx` — headless; mounted once in
  `RootShell`. 30 s heartbeat, idle detection (60 s), page-view tracking on
  route change, `sendBeacon` session_end on unload, and **forced sign-out when
  the server reports the session was revoked**.
- `src/app/super-admin/activity/page.tsx` + `UserActivityDrawer` +
  `AlertPreferencesModal`. Entry point: Super-Admin-only item in the user menu.

## 5. API routes (all SA-gated except the two tracker endpoints, which are
cookie-authed for the current user)

| Route | Method | Purpose |
|---|---|---|
| `/api/activity/heartbeat` | POST | presence ping → `{ revoked }` |
| `/api/activity/track` | POST | page_view / session events |
| `/api/super-admin/monitor` | GET | kpis + online users |
| `/api/super-admin/feed` | GET | filtered activity feed |
| `/api/super-admin/user/[id]` | GET | per-user detail |
| `/api/super-admin/session/revoke` | POST | force-logout (mark revoked) |
| `/api/super-admin/notification-preferences` | GET/PUT | SA alert prefs |

## 6. Alert kinds (→ `inbox_messages`, category `alert`, `metadata.kind`)

`login`, `new_device`, `new_ip`, `failed_login_threshold`, `data_delete`,
`price_cost_change`, `admin_role_change`, `settings_change`, `sensitive_export`,
`file_change`, `suspicious`. Each respects per-recipient preferences and
excludes the actor.

## 7. Force-logout / session revocation

Because auth is a custom cookie (not Supabase Auth), there is no server-side
token to invalidate instantly. The feasible, honest mechanism:

1. Super Admin clicks **Force logout** → `POST /api/super-admin/session/revoke`
   sets `app_sessions.status = 'revoked'`.
2. The target's `ActivityTracker` heartbeat (≤ 30 s) receives `{ revoked: true }`
   and redirects the client to `/login?revoked=1`.

> Limitation: a tab with no JS running (closed/asleep) won't be force-killed
> until it next heartbeats. For hard, immediate kill we'd need to rotate the
> account's session-signing secret / add a `sessions_revoked_after` timestamp
> checked inside `getServerAuth()` — documented as a future hardening step.

---

## 8. Browser / mobile push — integration spec (NOT yet wired)

**Status:** the `push_subscriptions` table exists and DB + in-app realtime
alerts are fully live. Web Push delivery is **not** wired because the project
has no service worker, no VAPID keys, and no `web-push` dependency — shipping a
half-built SW risked breaking the app. To complete it safely:

1. **Add deps & keys.** `npm i web-push`; generate VAPID keys
   (`npx web-push generate-vapid-keys`); set `VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (Vercel env).
2. **Service worker.** Add `public/sw.js` handling `push` + `notificationclick`;
   register it from a client effect **only after** the SA opts in (don't
   auto-register globally — it changes app caching behavior).
3. **Subscribe UI.** In `AlertPreferencesModal`, add "Enable push on this
   device": `Notification.requestPermission()` →
   `registration.pushManager.subscribe({ applicationServerKey })` →
   `POST /api/super-admin/push/subscribe` storing endpoint/p256dh/auth in
   `push_subscriptions`.
4. **Server send.** In `notifySuperAdmins()`, after the inbox insert, look up
   each recipient's active `push_subscriptions` and `webpush.sendNotification`
   (best-effort; prune 410/404 endpoints).
5. **Mobile.** The above is an installable PWA push on Android/desktop. For
   native iOS push, wrap the PWA (or add a native shell) and swap the SW send
   for APNs/FCM — the `push_subscriptions` shape already accommodates this.

## 9. Session replay — future spec (NOT implemented; requires policy + consent)

Do **not** add replay without an internal policy + employee consent. When
approved, prefer a privacy-safe third party with input masking on by default:
**Microsoft Clarity**, **PostHog Session Replay**, or **OpenReplay** (self-host
for full data control). Mask all inputs, redact `[data-private]`, exclude
`/login`, `/auth`, payment and PII screens. Gate behind an env flag + a tenant
setting; never record passwords or card fields.

---

## 10. Testing checklist

- [ ] Log in → `activity_events` gets a `login`; other Super Admins get a
      `login` alert in the bell (actor excluded).
- [ ] Navigate between modules → `app_sessions.current_route/module` update;
      `activity_events` page_view rows appear.
- [ ] Open `/super-admin/activity` as SA → KPIs, live users, feed populate and
      refresh; non-SA gets the "Super Admin only" screen and the API 403s.
- [ ] First load on a new browser → `user_devices` row created; `new_device`
      alert fans to other SAs.
- [ ] 5 failed logins in 15 min → `failed_login_threshold` critical alert.
- [ ] Delete a role/product/quotation → `audit_logs` critical row + alert;
      change a price/permission/policy → warning row + alert.
- [ ] Edit a product with a secret-named field → value is `‹redacted›` in
      `audit_logs`.
- [ ] Force-logout a session → target client redirects to `/login?revoked=1`
      within ~30 s.
- [ ] Toggle an alert kind off in preferences → that alert stops arriving.
- [ ] Mobile (375 px): panel + drawer + modal fit, no horizontal overflow.

## 11. Security checklist

- [x] Monitoring tables are service-role-only (RLS on, no anon policies).
- [x] Browser never reads activity/audit/session/device data directly.
- [x] SA endpoints gated by `getServerAuth()` + `is_super_admin`.
- [x] Audit values masked (passwords/tokens/secrets/keys redacted recursively).
- [x] `audit_logs` append-only (only service role writes; no update/delete path).
- [x] No passwords/secrets/replay/keylogging captured.
- [x] Existing RLS untouched; all migrations additive.
- [x] Heartbeat throttled (30 s) + page tracking debounced → no write storms.
- [x] Device id is a random correlation handle, not a fingerprint.

## 12. Notes / not-yet-done

- Web Push send path (spec in §8) — table ready, sender pending deps/keys.
- Hard immediate force-kill (vs ≤30 s heartbeat-based) — see §7.
- Audit logging is wired into the highest-value routes (Roles, Quotations,
  Product Data, Commercial Policy). Extending to every module reuses the same
  `logAudit()` call — no new infrastructure required.
