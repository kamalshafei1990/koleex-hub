# Koleex Hub — PWA & iPhone Push Notifications

Wix-style mobile push for the Super Admin: alerts on the iPhone lock screen,
Notification Center, and badge — even when the app is closed.

> **Super-Admin only.** Every push route is gated by `getServerAuth()` +
> `is_super_admin`, and only Super Admins can subscribe — normal users never
> register and never receive push.

---

## What was built

**PWA shell**
- `src/app/manifest.ts` → `/manifest.webmanifest` (standalone, icons, colors).
- `layout.tsx` metadata: `manifest`, `applicationName`, `appleWebApp` (iOS standalone).
- `public/sw.js` — push service worker (`push` + `notificationclick`; **no fetch
  handler**, so it can't affect caching or break the app).
- `ServiceWorkerRegistrar` mounted in `RootShell` registers the SW.

**Backend**
- `push_subscriptions` (extended: `device_name, browser, os, is_active, updated_at`).
- `notification_logs` (delivery audit: kind, title, body, channel, status, error).
- `notification_preferences` (per-kind in-app/push toggles; default on).
- `lib/server/web-push.ts` — `sendPushToAccounts()` (VAPID, retry-tolerant,
  prunes dead 404/410 endpoints, logs every attempt).
- `notifySuperAdmins()` now sends **both** the in-app inbox alert **and** Web Push.

**API routes** (SA-only): `POST /api/push/subscribe`, `GET|DELETE /api/push/devices`,
`POST /api/push/test`, `GET /api/push/history`.

**UI**: `Settings → Notifications` (`/settings/notifications`) — enable button,
permission status, device list + remove, send test, alert preferences, recent
history. Reachable from the profile menu → **Mobile Notifications** (SA only).

---

## Required environment variables

Generated VAPID keypair is in `.env.local` for local/preview. **You must add the
same three to Vercel** (Project → Settings → Environment Variables → Production
+ Preview), then redeploy:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>     # safe to expose (client needs it)
VAPID_PRIVATE_KEY=<private key>               # SECRET — server only, never commit
VAPID_SUBJECT=mailto:kamal.koleex@gmail.com   # a mailto: or https: contact
```

The exact values are in your local `.env.local` (git-ignored). Regenerate any
time with `npx web-push generate-vapid-keys` — but if you rotate keys, existing
subscriptions stop working and every device must re-enable.

If the keys are absent, push is a **safe no-op** (in-app notifications still work).

## Deployment / Vercel

- `web-push` runs in the Node.js runtime — all push routes are standard Node
  serverless functions (no Edge runtime needed). Compatible with Vercel as-is.
- After adding the env vars, **redeploy** so the server picks them up.
- HTTPS is required for service workers + push — Vercel provides this.

---

## iPhone setup (iOS / iPadOS 16.4+)

iOS only delivers Web Push to an **installed** PWA. One-time setup:

1. Open **hub.koleexgroup.com** in **Safari** (must be Safari, not Chrome/in-app).
2. Tap the **Share** icon → **Add to Home Screen** → Add.
3. **Open the app from the new Home-Screen icon** (not from Safari).
4. Go to **profile menu → Mobile Notifications** (or Settings → Notifications).
5. Tap **Enable Mobile Notifications** → **Allow** when iOS asks.
6. Tap **Send Test Notification** → it should appear on your lock screen.

After that you'll get alerts (login, new device, deletes, price/permission
changes, failed-login warnings, etc.) even with the app closed.

### iPhone limitations (Apple platform rules, not bugs)
- Must be added to the Home Screen + opened from that icon; Safari tabs can't push.
- Permission can only be requested from a real tap inside the installed app.
- No push on iOS < 16.4. App badges are limited compared to native apps.
- If you delete + re-add the app, you must re-enable notifications.

---

## Testing checklist

- [ ] `/manifest.webmanifest` returns 200 (`application/manifest+json`).
- [ ] `/sw.js` returns 200 and registers (DevTools → Application → Service Workers).
- [ ] Desktop Chrome: Settings → Notifications → Enable → Allow → a device row appears.
- [ ] Send Test → notification shows; `notification_logs` gets a `sent` row.
- [ ] iPhone (installed PWA): Enable → Allow → Test shows on lock screen.
- [ ] Trigger a real event (delete a product as another admin) → push arrives + history row.
- [ ] Remove a device → it disappears and stops receiving push.
- [ ] Non-Super-Admin: `/settings/notifications` shows "Super Admin only"; APIs 403.
- [ ] No VAPID env → app still works; test route returns a clear "not configured".

## Security & performance

- All push tables service-role-only (RLS on, no anon policies); access only via
  SA-gated server routes. Normal users cannot read others' subscriptions.
- Endpoint is unique → re-subscribing upserts (no duplicate devices).
- Dead endpoints auto-deactivated on 404/410 → no wasted sends, no dup spam.
- `userVisibleOnly: true` (required) — every push shows a visible notification.
- Every delivery logged to `notification_logs` (sent/failed/skipped + error).
