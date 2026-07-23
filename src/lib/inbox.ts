"use client";

/* ---------------------------------------------------------------------------
   inbox — CRUD helpers for `inbox_messages` + `membership_requests`.

   This module is the seam between the UI (NotificationBell, /inbox) and
   the Supabase tables created in
   supabase/migrations/create_inbox_and_membership_requests.sql.

   All calls are resilient: if the table hasn't been migrated yet (or the
   network trips), the functions return empty arrays / a stub success so
   the UI stays usable. That's important because we ship the code before
   the DB migration; the user applies the migration separately in
   Supabase Studio.
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";
import { cachedGet, invalidateCachedGet } from "./client-cache";
import { uploadToStorage } from "./storage-client";
import { isTransientFetch, warnOnce } from "./util/transient-fetch";
import type {
  AccountRow,
  InboxMessageRow,
  InboxMessageWithSender,
  MembershipRequestInsert,
  MembershipRequestRow,
} from "@/types/supabase";

const INBOX = "inbox_messages";
const MEMBERSHIP_REQUESTS = "membership_requests";

/* RLS realtime-lockdown P2: every WRITE to inbox_messages goes through the
   gated /api/inbox/mutate route (service-role, session-scoped) so the table's
   public policy can be downgraded to SELECT-only. Reads still use the anon
   client (recipient-filtered) until P3. */
async function inboxMutate(payload: Record<string, unknown>): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const res = await fetch("/api/inbox/mutate", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) {
      /* markRead / markAllRead / archive / send all change the unread count —
         drop the coalesced copy so the next recount is fresh. */
      invalidateCachedGet("/api/inbox/feed"); // unread + unreadTasks + messages
      return { ok: true, data: j };
    }
    return { ok: false, error: (j.error as string) || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

/* RLS realtime-lockdown P3-D: READS also go through a gated route now
   (/api/inbox/feed, service-role + session recipient scope) so inbox_messages'
   last public policy (SELECT) can be dropped. Freshness via Broadcast pings. */
async function inboxFeed<T>(resource: string, params: Record<string, string> = {}): Promise<T | undefined> {
  try {
    const qs = new URLSearchParams({ resource, ...params }).toString();
    const res = await fetch(`/api/inbox/feed?${qs}`, { method: "GET", credentials: "include" });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: T; error?: string };
    if (!res.ok || !j.ok) {
      const msg = j.error ?? `HTTP ${res.status}`;
      // Logged-out / bootstrapping windows are expected on the always-mounted
      // bell — stay silent, like the old anon reads did.
      const authNoise = /not signed in|unauthor|forbidden|\b401\b|\b403\b/i.test(msg);
      if (!isMissingTable(msg) && !isTransientFetch(msg) && !authNoise) warnOnce("inbox-feed-error", `[Inbox] feed unavailable (silenced): ${msg}`);
      return undefined;
    }
    return j.data;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isTransientFetch(msg)) warnOnce("inbox-feed-transient", `[Inbox] feed network error (silenced): ${msg}`);
    return undefined;
  }
}

/** True if the error shape looks like "relation does not exist" — we use
 *  this to silently fall back when the migration hasn't been applied. */
function isMissingTable(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("not found") ||
    m.includes("schema cache") ||
    m.includes("404")
  );
}

/* ── Membership requests ─────────────────────────────────────────────── */

/** Extra fields the "Be a Koleex Member" form collects. Stored inside
 *  `membership_requests.metadata` (JSONB) so we don't need a column
 *  migration every time we add a question. The trigger merges this
 *  metadata into the Super Admin inbox notification so reviewers see
 *  every field in the detail pane. */
export interface MembershipRequestExtras {
  phone?: string | null;
  relationship?: string | null; // "new_prospect" | "existing_customer" | ...
  job_title?: string | null;
  country?: string | null;       // country code e.g. "EG"
  country_name?: string | null;  // human-readable, so admin doesn't decode codes
  city?: string | null;
  heard_from?: string | null;    // "linkedin" | "referral" | ...
}

export async function createMembershipRequest(
  input: MembershipRequestInsert & { extras?: MembershipRequestExtras },
): Promise<{ ok: true; request: MembershipRequestRow } | { ok: false; error: string }> {
  /* Strip empty strings / undefined so the JSONB blob stays tidy. */
  const extras = input.extras ?? {};
  const cleanMetadata: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(extras)) {
    if (v !== undefined && v !== null && v !== "") cleanMetadata[k] = v;
  }

  const payload = {
    full_name: input.full_name,
    email: input.email,
    company: input.company ?? null,
    message: input.message ?? null,
    source: input.source ?? "login_gate",
    metadata: cleanMetadata,
  };
  const { data, error } = await supabase
    .from(MEMBERSHIP_REQUESTS)
    .insert(payload)
    .select("*")
    .single();
  if (error) {
    console.error("[Inbox] Create membership request:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, request: data as MembershipRequestRow };
}

export async function fetchMembershipRequests(
  status?: "pending" | "approved" | "rejected" | "archived",
): Promise<MembershipRequestRow[]> {
  let q = supabase
    .from(MEMBERSHIP_REQUESTS)
    .select("*")
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) {
    if (!isMissingTable(error.message)) {
      console.error("[Inbox] Fetch membership requests:", error.message);
    }
    return [];
  }
  return (data as MembershipRequestRow[]) ?? [];
}

export async function updateMembershipRequestStatus(
  id: string,
  status: "approved" | "rejected" | "archived",
  reviewedBy: string,
): Promise<boolean> {
  const { error } = await supabase
    .from(MEMBERSHIP_REQUESTS)
    .update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    console.error("[Inbox] Update membership request:", error.message);
    return false;
  }
  return true;
}

/* ── Inbox messages ──────────────────────────────────────────────────── */

/** List everything in a user's inbox that isn't archived, newest first. */
export async function fetchInboxMessages(
  accountId: string,
  options: { includeArchived?: boolean; limit?: number; slim?: boolean } = {},
): Promise<InboxMessageWithSender[]> {
  const { includeArchived = false, limit = 100, slim = false } = options;
  void accountId; // recipient scope comes from the session server-side
  const params: Record<string, string> = { limit: String(limit) };
  if (includeArchived) params.archived = "1";
  /* slim: badge/bell projection — no sender avatar (base64 data-URIs blow the
     payload ~12×), metadata trimmed to { type }. Use for any surface that does
     not render the avatar or attachments. */
  if (slim) params.slim = "1";
  const data = await inboxFeed<InboxMessageWithSender[]>("messages", params);
  return data ?? [];
}

/* ── Realtime ────────────────────────────────────────────────────────
   Live INSERT subscription on `inbox_messages` filtered to a single
   recipient. Mirrors `subscribeToMyChannels()` in src/lib/discuss.ts:
   each subscriber gets its own topic so React strict-mode double-mounts
   and multiple consumers (NotificationBell + the /inbox page) don't
   collide on the same channel. Requires `inbox_messages` to be in the
   `supabase_realtime` publication — see the
   `add_inbox_messages_to_realtime` migration. */
/* Ref-counted shared Broadcast channel per inbox topic — NotificationBell and
   the /inbox page both subscribe to inbox:account:<me>; one unmount must not
   tear down the other. Mirrors the discuss.ts broadcast manager. */
const inboxBroadcastSubs = new Map<
  string,
  { channel: ReturnType<typeof supabase.channel>; listeners: Set<() => void> }
>();
function subscribeInboxBroadcast(accountId: string, onPing: () => void): () => void {
  const topic = `inbox:account:${accountId}`;
  let entry = inboxBroadcastSubs.get(topic);
  if (!entry) {
    const channel = supabase.channel(topic);
    const created = { channel, listeners: new Set<() => void>() };
    channel.on("broadcast", { event: "changed" }, () => {
      /* One invalidation per PING (not per listener): the listeners then
         race into cachedGet together and share a single fresh request —
         without this, a ping landing inside the coalesce TTL would re-read
         the pre-ping snapshot and delay the new message until the next poll. */
      invalidateCachedGet("/api/inbox/feed");
      for (const l of created.listeners) { try { l(); } catch { /* isolate */ } }
    }).subscribe();
    inboxBroadcastSubs.set(topic, created);
    entry = created;
  }
  entry.listeners.add(onPing);
  return () => {
    const e = inboxBroadcastSubs.get(topic);
    if (!e) return;
    e.listeners.delete(onPing);
    if (e.listeners.size === 0) {
      try { supabase.removeChannel(e.channel); } catch { /* ignore */ }
      inboxBroadcastSubs.delete(topic);
    }
  };
}

/** Subscribe to the caller's inbox. Server Broadcast ping on
 *  inbox:account:<id> (see /api/inbox/mutate) -> refetch the recent inbox via
 *  the gated feed, diff against a seen-set, and fire onInsert for new rows.
 *  No anon table access; content comes only from the authorized feed. */
export function subscribeToInboxMessages(
  accountId: string,
  onInsert: (msg: InboxMessageRow) => void,
): () => void {
  let closed = false;
  let primed = false;
  const seen = new Set<string>();
  const refresh = async () => {
    if (closed) return;
    /* Slim projection: this refetch runs on EVERY broadcast ping for EVERY
       subscriber (bell + home task badge). The full shape measured 137 KB per
       call because of base64 sender avatars; the diff only needs ids and the
       callback only reads subject/body/category/metadata.type. */
    /* Coalesced with a tiny TTL: the bell and the home task badge are BOTH
       subscribers, and a broadcast ping reaches them in the same tick — two
       identical refetches per ping (three on mount, with the primes). 2s is
       long enough to merge the simultaneous callers and far too short to
       delay a real update. */
    const msgs = await (async () => {
      try {
        const j = await cachedGet<{ ok?: boolean; data?: InboxMessageWithSender[] }>(
          "/api/inbox/feed?resource=messages&limit=30&slim=1", 2_000,
        );
        return j?.data;
      } catch { return undefined; }
    })();
    if (closed || !msgs) return;
    for (const m of [...msgs].reverse()) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      if (primed) onInsert(m as unknown as InboxMessageRow);
    }
    primed = true;
  };
  void refresh(); // prime the seen-set (no callbacks fired)
  const unsub = subscribeInboxBroadcast(accountId, () => { void refresh(); });
  return () => { closed = true; unsub(); };
}

export async function fetchUnreadCount(accountId: string): Promise<number> {
  void accountId; // recipient scope comes from the session server-side
  /* Coalesced: four consumers ask for this count on one Home load (bell
     poll seed, bell realtime verify, home to-do badge, focus resync). The
     endpoint already serves Cache-Control max-age=15, so a 5s client
     coalesce adds no staleness — and every inbox mutate invalidates it so
     mark-read updates the badge immediately. */
  try {
    const json = await cachedGet<{ ok?: boolean; data?: number }>(
      "/api/inbox/feed?resource=unread", 5_000,
    );
    return json?.data ?? 0;
  } catch {
    return 0;
  }
}

/** Count unread (not archived) TO-DO assignment notifications for one account.
    Feeds the To-do app-tile notification badge on the home page.

    Note: category `task` is shared — the QA system also writes task-category
    inbox rows (qa_issue_assigned / qa_status_changed). To-do assignments are
    the ones the todo fan-out tags with metadata.type = 'todo_assignment', so
    we filter on that to keep the badge strictly to-do related. */
export async function fetchUnreadTaskCount(accountId: string): Promise<number> {
  void accountId; // recipient scope comes from the session server-side
  try {
    const json = await cachedGet<{ ok?: boolean; data?: number }>(
      "/api/inbox/feed?resource=unreadTasks", 5_000,
    );
    return json?.data ?? 0;
  } catch {
    return 0;
  }
}

export async function markMessageRead(id: string): Promise<boolean> {
  const r = await inboxMutate({ action: "markRead", id });
  if (!r.ok) console.error("[Inbox] Mark read:", r.error);
  return r.ok;
}

/** Clear `read_at` so the message shows up as unread again. Used by the
 *  list row's "mark unread" hover action. */
export async function markMessageUnread(id: string): Promise<boolean> {
  const r = await inboxMutate({ action: "markUnread", id });
  if (!r.ok) console.error("[Inbox] Mark unread:", r.error);
  return r.ok;
}

export async function markAllRead(accountId: string): Promise<boolean> {
  void accountId; // identity comes from the session server-side
  const r = await inboxMutate({ action: "markAllRead" });
  if (!r.ok) console.error("[Inbox] Mark all read:", r.error);
  return r.ok;
}

export async function archiveMessage(id: string): Promise<boolean> {
  const r = await inboxMutate({ action: "archive", id });
  if (!r.ok) console.error("[Inbox] Archive:", r.error);
  return r.ok;
}

/** Structured attachment record stored in `inbox_messages.metadata.attachments`.
 *  Uses the Supabase public URL so recipients can download without an auth
 *  round-trip. `file_path` is kept so we can later offer deletion cleanup. */
export interface InboxAttachment {
  name: string;
  url: string;
  file_path: string;
  size: number;
  type: string;
}

/** Structured product reference stored in `inbox_messages.metadata.products`.
 *  Denormalized on purpose — keeping a snapshot of the product name + image
 *  means the message still renders correctly if the product is later renamed
 *  or deleted. `id` + `slug` let us deep-link back to the product page. */
export interface InboxProductRef {
  id: string;
  name: string;
  slug: string;
  image: string | null;
}

/** Upload a file to the shared `media` storage bucket under an
 *  `inbox-attachments/` prefix. Returns the structured record ready to
 *  be embedded in `inbox_messages.metadata.attachments`. */
export async function uploadInboxAttachment(
  file: File,
): Promise<InboxAttachment | null> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `inbox-attachments/${Date.now()}_${safeName}`;
  const result = await uploadToStorage("media", filePath, file, {
    cacheControl: "3600",
  });
  if (!result.ok) {
    console.error("[Inbox] Attachment upload:", result.error);
    return null;
  }
  return {
    name: file.name,
    url: result.data.publicUrl,
    file_path: result.data.path,
    size: file.size,
    type: file.type || "application/octet-stream",
  };
}

/** Send a direct message from one account to another. Accepts optional
 *  `metadata` for attachments, product references, or any future structured
 *  payload — the column is JSONB so we can evolve the shape without
 *  migrations. */
export async function sendMessage(input: {
  senderId: string;
  recipientId: string;
  subject: string;
  body: string;
  link?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: true; message: InboxMessageRow } | { ok: false; error: string }> {
  void input.senderId; // sender comes from the session server-side
  const r = await inboxMutate({
    action: "send",
    recipientId: input.recipientId,
    subject: input.subject,
    body: input.body,
    link: input.link ?? null,
    metadata: input.metadata ?? {},
  });
  if (!r.ok) {
    console.error("[Inbox] Send message:", r.error);
    return { ok: false, error: r.error ?? "Send failed" };
  }
  return { ok: true, message: (r.data as { message: InboxMessageRow }).message };
}

/** Fan out one message to every active account matching a role name
 *  (e.g. "Sales" to reach everyone in sales). Returns the count actually
 *  inserted. Accepts the same optional `metadata` payload as sendMessage. */
export async function broadcastToRole(input: {
  senderId: string;
  roleName: string;
  subject: string;
  body: string;
  link?: string | null;
  excludeSelf?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<number> {
  void input.senderId; // sender + recipient resolution happen server-side
  const r = await inboxMutate({
    action: "broadcastToRole",
    roleName: input.roleName,
    subject: input.subject,
    body: input.body,
    link: input.link ?? null,
    excludeSelf: input.excludeSelf ?? false,
    metadata: input.metadata ?? {},
  });
  if (!r.ok) {
    console.error("[Inbox] Broadcast:", r.error);
    return 0;
  }
  return ((r.data as { count?: number }).count) ?? 0;
}

/** Accounts that can receive messages — used by the compose picker.
 *  Only internal users (not customers / suppliers). */
export async function fetchMessageableAccounts(): Promise<
  Array<{
    id: string;
    username: string;
    full_name: string | null;
    name_alt: string | null;
    avatar_url: string | null;
    role_name: string | null;
  }>
> {
  const { data, error } = await supabase
    .from("accounts")
    .select(
      `
      id,
      username,
      avatar_url,
      person:people ( full_name, name_alt, avatar_url ),
      role:roles ( name )
      `,
    )
    .eq("user_type", "internal")
    .eq("status", "active")
    .order("username");
  if (error) {
    console.error("[Inbox] Fetch recipients:", error.message);
    return [];
  }
  type Row = AccountRow & {
    person: { full_name: string; name_alt: string | null; avatar_url: string | null } | Array<{ full_name: string; name_alt: string | null; avatar_url: string | null }> | null;
    role: { name: string } | Array<{ name: string }> | null;
  };
  return (data as unknown as Row[]).map((row) => {
    const person = Array.isArray(row.person) ? row.person[0] ?? null : row.person;
    const role = Array.isArray(row.role) ? row.role[0] ?? null : row.role;
    return {
      id: row.id,
      username: row.username,
      full_name: person?.full_name ?? null,
      name_alt: person?.name_alt ?? null,
      avatar_url: row.avatar_url ?? person?.avatar_url ?? null,
      role_name: role?.name ?? null,
    };
  });
}
