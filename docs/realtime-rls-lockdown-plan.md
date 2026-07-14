# Realtime RLS Lockdown — Plan (GATED, needs sign-off)

**Status:** design only — no production changes proposed here.
**Author:** access-architecture workstream, 2026-07-14.
**Prereq context:** [[project_rls_public_policy_gap]] — 78 → 8 anon-open tables done.

---

## 1. The problem, precisely

Eight tables still allow the **browser anon key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`,
shipped in every bundle) to read them cross-tenant, because their RLS grants
`... TO public USING(true)`:

| Table | Policy | In realtime publication? | Exposure |
|---|---|---|---|
| `discuss_messages` | SELECT `true` | ✅ | anyone with the anon key can read **every chat message, all tenants** |
| `discuss_channels` | SELECT `true` | ✅ | channel names / metadata |
| `discuss_members` | SELECT `true` | ✅ | who is in which channel |
| `discuss_reactions` | SELECT `true` | ✅ | reactions |
| `inbox_messages` | **ALL** `true` | ✅ | read AND **write** all notifications, all tenants (forge / delete / read others') |
| `discuss_drafts` | SELECT `true` | ❌ | unsent draft text |
| `discuss_pinned` | SELECT `true` | ❌ | pinned message ids |
| `discuss_starred` | SELECT `true` | ❌ | starred message ids |

`inbox_messages` is the worst — it's `FOR ALL`, so the anon key can also
insert fake notifications or delete/mark-read anyone's.

## 2. Root cause

The app authenticates with a **custom signed session cookie** (`setSessionCookie(accountId)` /
`getSessionAccountId()` in `src/lib/server/session.ts`) and does all trusted DB
work with the **service-role** key server-side. It does **NOT** use Supabase
Auth — so the browser's realtime connection carries the anon key with **no
`auth.uid()` / `auth.jwt()`**. RLS therefore has no per-user identity to scope a
policy like `USING (recipient_account_id = auth.uid())`. To let the client's
`postgres_changes` subscriptions receive events at all, the tables were opened to
`public`.

## 3. The precedent already in the codebase (key finding)

`koleex_todos`, `koleex_todo_assignees`, `koleex_todo_notes`, `qa_issue_reports`,
`qa_fix_evidence` are **in the `supabase_realtime` publication AND already
locked to `service_role` only.** Their anon `postgres_changes` subscriptions
therefore receive **nothing** — and the app copes: after a server write, the UI
refetches and/or a same-tab `window` CustomEvent (`inbox:force-recount`,
etc.) nudges a recount. In other words, **the app already runs a "locked table +
refetch-driven UI" pattern for todos and QA.** This is the cheapest lever.

## 4. Options

### Option A — Authenticated Supabase realtime (true live push, cleanest)
Mint a short-lived Supabase JWT (via `auth.admin` / a signed JWT with the
project's secret) carrying the account id as a claim, hand it to the browser,
and call `supabase.realtime.setAuth(jwt)`. Then RLS policies scope by that claim,
e.g. `discuss_members` visible where the caller is a member; `inbox_messages`
where `recipient_account_id = (auth.jwt() ->> 'account_id')`. Keeps every existing
`postgres_changes` subscription working, now filtered by identity.
- **Pros:** real live push preserved everywhere; smallest client-code change
  (subscriptions stay); genuinely correct model.
- **Cons:** new JWT-minting + refresh infra; must keep the Supabase JWT in sync
  with the custom session lifecycle (login / logout / view-as); RLS policies
  rewritten per table with membership sub-selects; realtime respects the JWT only
  on the socket, so token expiry/refresh needs care.
- **Effort:** M–L. **Risk:** medium (auth surface).

### Option B — Server-pushed broadcast (max lockdown, biggest rewrite)
Drop `postgres_changes` entirely. The server (service role) is the only thing
that touches these tables; on each write it emits a **Supabase Broadcast** (or a
lightweight SSE/WebSocket) to a per-recipient channel that the client subscribes
to with a signed topic token. Tables become `service_role`-only.
- **Pros:** strongest posture (no anon DB access at all); server decides exactly
  who receives what.
- **Cons:** rewrite every subscribe site (discuss.ts ~30 fns, inbox.ts,
  projects.ts, quotation-collab.ts, note-collab.ts, qa/realtime.ts,
  todo-admin.ts) + an emit layer on every write path.
- **Effort:** L–XL. **Risk:** high (touches all realtime).

### Option C — Lock + refetch (pragmatic, matches existing precedent)
Do exactly what todos/QA already do: lock discuss_*/inbox to `service_role`,
route their reads+writes through gated API routes, and drive UI freshness with
**refetch-on-focus + a server "ping" event** instead of anon `postgres_changes`.
Chat loses *instant* push but gains it back with a cheap poll/focus refresh
(e.g. 5–10 s while a channel is open) — acceptable for an internal tool, and
already the de-facto behaviour for todos.
- **Pros:** no new auth infra; consistent with what's shipped; each table can be
  locked in a small, independently-verifiable slice (the proven purchase/RLS
  pattern).
- **Cons:** chat is near-real-time, not instant-real-time (typing indicators /
  sub-second delivery degrade to a few seconds).
- **Effort:** M. **Risk:** low–medium (per-slice, reversible).

## 5. Recommendation

**Split by need:**

1. **Now-ish, cheap, low-risk (Option C mini-slices):** the 3 non-realtime
   tables + the inbox write path do **not** need any realtime work:
   - `discuss_drafts / pinned / starred` — not in the publication; rewire their
     reads/writes in `discuss.ts` to a gated route, then lock. (Closes 3 of 8.)
   - `inbox_messages` **writes** — route `inbox.ts` + `todo-admin.ts` inserts/
     updates/deletes through a gated `/api/inbox/*`, then downgrade its policy
     from `ALL true` to `SELECT true`. (Kills the forge/delete-others hole; read
     stays open only for the bell's realtime, pending step 2.)
   This alone takes the real risk from "read+write all notifications + all chat"
   down to "read-only chat + read-only inbox", with **zero realtime rework**.

2. **The genuine decision (steps that need your call):** for the 5 truly
   realtime-backed tables, pick **A** (keep instant push, build the JWT bridge)
   or **C** (accept few-second refresh, no new auth infra). Given this is an
   internal tool and todos/QA already run the refetch model, **C is the lower-risk
   default**; choose **A** only if instant chat delivery is a hard requirement.

## 6. Phased execution (once an option is chosen)

Each phase = its own PR, independently shippable + reversible (`ALTER POLICY … TO
public`), verified with a new `validate:realtime-access` probe (anon read → `[]`,
authed client still receives its own events).

- **P1 (Option C mini):** `/api/discuss/state` (drafts/pinned/starred read+write)
  → rewire `discuss.ts` → lock the 3 tables. *(No realtime touched.)*
- **P2 (Option C mini):** `/api/inbox/mutate` (mark-read / archive / notify) →
  rewire `inbox.ts` + `todo-admin.ts` → policy `ALL`→`SELECT`. *(Write hole closed.)*
- **P3:** the chosen realtime option for discuss_channels/members/messages/
  reactions + inbox_messages SELECT:
  - **If A:** JWT-mint endpoint + `setAuth` on the client + per-table scoped RLS +
    token refresh on the session lifecycle. Lock the 5 tables' public SELECT.
  - **If C:** `/api/discuss/feed` + `/api/inbox/feed` refetch endpoints, focus/
    interval refresh in `DiscussApp` + `NotificationBell`, drop the anon
    subscriptions, lock the 5 tables.
- **P4:** extend `validate:access` with realtime assertions; re-scan `pg_policies`
  to confirm **0** anon-open tables; update memory.

## 7. What NOT to do
- Don't lock discuss_*/inbox before rewiring — chat + the notification bell break.
- Don't attempt this piecemeal without the probe suite green after each slice.
- Don't mix Option A and C for the same table.
- Don't change the todo/QA realtime tables — they're already locked and working.

## 8. Effort / risk summary

| Phase | Effort | Risk | Closes |
|---|---|---|---|
| P1 | S | Low | 3 tables (drafts/pinned/starred) |
| P2 | S–M | Low | inbox write hole |
| P3-C | M | Med | 5 realtime tables (near-real-time UI) |
| P3-A | M–L | Med–High | 5 realtime tables (instant push) |
| P4 | S | Low | verification + docs |

**Bottom line:** P1+P2 remove the sharpest edges (all-tenant *writes* + 3
draft/pin/star reads) cheaply and safely and can proceed as soon as you say go.
P3 is the one real fork — **A for instant chat, C for cheaper near-real-time** —
and needs your pick before I build it.
