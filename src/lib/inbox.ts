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
    if (res.ok) return { ok: true, data: j };
    return { ok: false, error: (j.error as string) || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
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
  options: { includeArchived?: boolean; limit?: number } = {},
): Promise<InboxMessageWithSender[]> {
  const { includeArchived = false, limit = 100 } = options;
  let q = supabase
    .from(INBOX)
    .select(
      `
      *,
      sender:accounts!inbox_messages_sender_account_id_fkey (
        id,
        username,
        avatar_url,
        person:people ( full_name )
      )
      `,
    )
    .eq("recipient_account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!includeArchived) q = q.is("archived_at", null);

  const { data, error } = await q;
  if (error) {
    if (!isMissingTable(error.message)) {
      console.error("[Inbox] Fetch messages:", error.message);
    }
    return [];
  }

  /* Normalize the embedded sender into the flat `sender` shape the UI
     expects — Supabase returns `sender` as either an object or array
     depending on schema inference, and `person` is nested inside. */
  const rows = (data as unknown as Array<
    InboxMessageRow & {
      sender:
        | {
            id: string;
            username: string;
            avatar_url: string | null;
            person: { full_name: string } | Array<{ full_name: string }> | null;
          }
        | Array<{
            id: string;
            username: string;
            avatar_url: string | null;
            person: { full_name: string } | Array<{ full_name: string }> | null;
          }>
        | null;
    }
  >) ?? [];

  return rows.map((row) => {
    const raw = Array.isArray(row.sender) ? row.sender[0] ?? null : row.sender;
    let sender: InboxMessageWithSender["sender"] = null;
    if (raw) {
      const person = Array.isArray(raw.person) ? raw.person[0] ?? null : raw.person;
      sender = {
        id: raw.id,
        username: raw.username,
        avatar_url: raw.avatar_url,
        full_name: person?.full_name ?? null,
      };
    }
    const { sender: _s, ...base } = row as InboxMessageRow & { sender: unknown };
    void _s;
    return { ...(base as InboxMessageRow), sender };
  });
}

/* ── Realtime ────────────────────────────────────────────────────────
   Live INSERT subscription on `inbox_messages` filtered to a single
   recipient. Mirrors `subscribeToMyChannels()` in src/lib/discuss.ts:
   each subscriber gets its own topic so React strict-mode double-mounts
   and multiple consumers (NotificationBell + the /inbox page) don't
   collide on the same channel. Requires `inbox_messages` to be in the
   `supabase_realtime` publication — see the
   `add_inbox_messages_to_realtime` migration. */
export function subscribeToInboxMessages(
  accountId: string,
  onInsert: (msg: InboxMessageRow) => void,
): () => void {
  let currentChannel: ReturnType<typeof supabase.channel> | null = null;
  let reconnectTimer: number | null = null;
  let closed = false;

  const connect = () => {
    if (closed) return;
    const suffix = `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const topic = `inbox:${accountId}:${suffix}`;
    const ch = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: INBOX,
          filter: `recipient_account_id=eq.${accountId}`,
        },
        (payload) => {
          onInsert(payload.new as InboxMessageRow);
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (typeof console !== "undefined") {
            console.warn(`[Inbox] realtime ${status}, reconnecting…`);
          }
          if (!closed && reconnectTimer == null) {
            reconnectTimer = window.setTimeout(() => {
              reconnectTimer = null;
              try {
                if (currentChannel) supabase.removeChannel(currentChannel);
              } catch {
                /* ignore */
              }
              connect();
            }, 1500);
          }
        }
      });
    currentChannel = ch;
  };

  connect();

  return () => {
    closed = true;
    if (reconnectTimer != null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (currentChannel) {
      try {
        supabase.removeChannel(currentChannel);
      } catch {
        /* ignore */
      }
      currentChannel = null;
    }
  };
}

export async function fetchUnreadCount(accountId: string): Promise<number> {
  const { count, error } = await supabase
    .from(INBOX)
    .select("*", { count: "exact", head: true })
    .eq("recipient_account_id", accountId)
    .is("read_at", null)
    .is("archived_at", null);
  if (error) {
    /* This runs on a 60 s poller, so a single offline window (or a platform
       incident that returns an unfamiliar / empty error message) would spam the
       console — and Next.js Dev Tools counts every console.error as an "issue".
       An unread-count blip is non-critical, so NEVER escalate to console.error:
       surface the first occurrence via warnOnce (diagnosable) and silence the
       rest. Missing-table stays fully silent. */
    if (!isMissingTable(error.message)) {
      warnOnce("inbox-unread-error", `[Inbox] unread count unavailable (silenced; will retry): ${error.message || "unknown error"}`);
    }
    return 0;
  }
  return count ?? 0;
}

/** Count unread (not archived) TO-DO assignment notifications for one account.
    Feeds the To-do app-tile notification badge on the home page.

    Note: category `task` is shared — the QA system also writes task-category
    inbox rows (qa_issue_assigned / qa_status_changed). To-do assignments are
    the ones the todo fan-out tags with metadata.type = 'todo_assignment', so
    we filter on that to keep the badge strictly to-do related. */
export async function fetchUnreadTaskCount(accountId: string): Promise<number> {
  const { count, error } = await supabase
    .from(INBOX)
    .select("*", { count: "exact", head: true })
    .eq("recipient_account_id", accountId)
    .eq("category", "task")
    .eq("metadata->>type", "todo_assignment")
    .is("read_at", null)
    .is("archived_at", null);
  if (error) {
    if (!isMissingTable(error.message) && !isTransientFetch(error.message)) {
      console.error("[Inbox] Unread task count:", error.message);
    }
    return 0;
  }
  return count ?? 0;
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
      person:people ( full_name, avatar_url ),
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
    person: { full_name: string; avatar_url: string | null } | Array<{ full_name: string; avatar_url: string | null }> | null;
    role: { name: string } | Array<{ name: string }> | null;
  };
  return (data as unknown as Row[]).map((row) => {
    const person = Array.isArray(row.person) ? row.person[0] ?? null : row.person;
    const role = Array.isArray(row.role) ? row.role[0] ?? null : row.role;
    return {
      id: row.id,
      username: row.username,
      full_name: person?.full_name ?? null,
      avatar_url: row.avatar_url ?? person?.avatar_url ?? null,
      role_name: role?.name ?? null,
    };
  });
}
