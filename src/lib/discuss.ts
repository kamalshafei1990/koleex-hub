"use client";

/* ---------------------------------------------------------------------------
   discuss — data layer for the Discuss (chat) app.

   Mirrors the pattern established in src/lib/inbox.ts:
     - Plain async functions, not hooks
     - supabaseAdmin client (anon key, dev-mode permissive RLS)
     - Resilient: returns empty arrays / stub success if a table hasn't
       been migrated yet, so the UI never crashes on a fresh DB
     - Leaves all React state management to the caller — this module
       only speaks to Supabase

   Real-time lives in a dedicated helper (`subscribeToChannel`) because
   that's the one place where a caller needs the raw Supabase channel
   object back so they can unsubscribe on unmount.
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";
import { uploadToStorage } from "./storage-client";
import { isTransientFetch } from "./util/transient-fetch";
import type {
  DiscussAttachment,
  DiscussAuthor,
  DiscussChannelKind,
  DiscussChannelRow,
  DiscussChannelWithState,
  DiscussDraftRow,
  DiscussLinkedContact,
  DiscussMemberRow,
  DiscussMessageKind,
  DiscussMessageMetadata,
  DiscussMessageRow,
  DiscussMessageWithAuthor,
  DiscussNotificationPref,
  DiscussReactionRow,
  DiscussSearchResult,
  DiscussVoiceMeta,
} from "@/types/supabase";
import { record as perfRecord, event as perfEvent } from "@/lib/perf/client";

const CHANNELS = "discuss_channels";
/* discuss_pinned / discuss_starred / discuss_drafts are read via the gated
   /api/discuss/state route and written via /api/discuss/mutate, so their table
   names live server-side only (RLS: service_role). */
const CONTACTS = "contacts";
const BUCKET = "media";

/* Broadcast ping topics — MUST match src/lib/server/realtime-broadcast.ts. */
const rtChannelTopic = (channelId: string) => `discuss:channel:${channelId}`;
const rtAccountTopic = (accountId: string) => `discuss:account:${accountId}`;

/** Silent fallback when a table hasn't been migrated yet. Matches the
 *  detection logic in inbox.ts so behavior is consistent. */
function isMissingTable(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("not found") ||
    m.includes("schema cache") ||
    m.includes("404")
  );
}

/** Route a write through the authenticated server endpoint. Every Discuss
 *  mutation goes through /api/discuss/mutate, so the browser's anon key can
 *  no longer write to the discuss_* tables directly. The signed-in identity
 *  is derived from the koleex_session cookie server-side; account/author ids
 *  passed by callers are used only for channel/message targeting, never for
 *  authorship. */
async function discussMutate<T = unknown>(
  action: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch("/api/discuss/mutate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action, payload }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      data?: T;
      error?: string;
    };
    if (!res.ok || !json.ok) {
      console.error("[Discuss] mutate", action, json.error ?? `HTTP ${res.status}`);
      return { ok: false, error: json.error ?? `HTTP ${res.status}` };
    }
    return { ok: true, data: json.data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isTransientFetch(msg)) console.error("[Discuss] mutate", action, msg);
    return { ok: false, error: msg };
  }
}

/** A read failure that isn't a bug and must NOT be console.error'd — the
 *  always-mounted bell/panel poll these gated reads, so a transient network
 *  blip or an unauthenticated window (logged out / session still bootstrapping)
 *  should degrade to "no data" silently, exactly as the old anon reads did.
 *  Logging them spams the console and trips Next.js's dev issues overlay. */
function isBenignReadError(msg: string): boolean {
  return isTransientFetch(msg) || /not signed in|unauthor|forbidden|\b401\b|\b403\b/i.test(msg);
}

/** GET companion to discussMutate for the gated read path (drafts / pinned /
 *  starred). Identity comes from the session cookie server-side; the caller
 *  never supplies an account id. Returns `data` (null/[] on any failure so
 *  callers degrade gracefully, matching the old anon-read behaviour). */
async function discussState<T = unknown>(
  resource: string,
  params: Record<string, string> = {},
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const qs = new URLSearchParams({ resource, ...params }).toString();
    const res = await fetch(`/api/discuss/state?${qs}`, {
      method: "GET",
      credentials: "same-origin",
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      data?: T;
      error?: string;
    };
    if (!res.ok || !json.ok) {
      const m = json.error ?? `HTTP ${res.status}`;
      if (!isBenignReadError(m)) console.error("[Discuss] state", resource, m);
      return { ok: false, error: m };
    }
    return { ok: true, data: json.data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isBenignReadError(msg)) console.error("[Discuss] state", resource, msg);
    return { ok: false, error: msg };
  }
}

/** GET companion for the gated realtime-table reads (channels / messages /
 *  thread / members / search). Same contract as discussState: identity comes
 *  from the session cookie server-side; returns `data` (falls back to a safe
 *  empty value on any failure so callers degrade to "no data", matching the
 *  old anon-read behaviour). */
async function discussRead<T = unknown>(
  resource: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T | undefined> {
  try {
    const qs = new URLSearchParams({ resource });
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    }
    const res = await fetch(`/api/discuss/read?${qs.toString()}`, {
      method: "GET",
      credentials: "same-origin",
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: T; error?: string };
    if (!res.ok || !json.ok) {
      const msg = json.error ?? `HTTP ${res.status}`;
      if (!isBenignReadError(msg)) console.error("[Discuss] read", resource, msg);
      return undefined;
    }
    return json.data;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isBenignReadError(msg)) console.error("[Discuss] read", resource, msg);
    return undefined;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Channels
   ═══════════════════════════════════════════════════════════════════════ */

/** Atomically find or create the DM channel between two accounts. Uses
 *  the `find_or_create_direct_channel` SQL function which guarantees
 *  only one DM row exists per pair even under concurrent clicks. */
export async function findOrCreateDirectChannel(
  accountA: string,
  accountB: string,
): Promise<string | null> {
  void accountA; // identity comes from the session server-side
  const res = await discussMutate<string>("directChannel", { otherId: accountB });
  return res.ok ? (res.data ?? null) : null;
}

/** Create a new group or channel. The creator is auto-added as admin.
 *  Pass `memberIds` to invite additional members in the same insert
 *  batch — we use a single `insert` call so Supabase generates all
 *  rows in one round-trip. */
export async function createChannel(input: {
  kind: Exclude<DiscussChannelKind, "direct">;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  createdBy: string;
  memberIds?: string[];
}): Promise<DiscussChannelRow | null> {
  const res = await discussMutate<DiscussChannelRow>("createChannel", {
    kind: input.kind,
    name: input.name,
    description: input.description ?? null,
    icon: input.icon ?? null,
    color: input.color ?? null,
    memberIds: input.memberIds ?? [],
  });
  return res.ok ? (res.data ?? null) : null;
}

/** Update a channel's editable metadata (name, description, icon, color).
 *  Used by the channel settings modal. */
export async function updateChannel(
  channelId: string,
  patch: Partial<Pick<DiscussChannelRow, "name" | "description" | "icon" | "color">>,
): Promise<boolean> {
  return (await discussMutate("updateChannel", { channelId, patch })).ok;
}

/** Soft-archive a channel. We never hard-delete so message history
 *  stays intact for audit. */
export async function archiveChannel(channelId: string): Promise<boolean> {
  return (await discussMutate("archiveChannel", { channelId })).ok;
}

/** Fetch every channel the account is a member of, enriched with:
 *   - unread_count (messages since last_read_at by OTHER people)
 *   - last_message preview
 *   - for DMs, the OTHER member's info so the sidebar shows "Sarah" not "DM #abc"
 *
 *  Sorted by `last_message_at DESC` so the most-recently-active thread
 *  sits at the top, Slack-style. */
export async function fetchMyChannels(
  accountId: string,
): Promise<DiscussChannelWithState[]> {
  void accountId; // identity comes from the session server-side
  const data = await discussRead<DiscussChannelWithState[]>("myChannels");
  return data ?? [];
}

/* ═══════════════════════════════════════════════════════════════════════
   Members
   ═══════════════════════════════════════════════════════════════════════ */

/** Add one or more members to a channel. No-op on duplicates — the
 *  table's UNIQUE(channel_id, account_id) constraint absorbs them and
 *  we swallow the error. */
export async function addMembers(
  channelId: string,
  accountIds: string[],
): Promise<number> {
  if (accountIds.length === 0) return 0;
  const res = await discussMutate<number>("addMembers", { channelId, accountIds });
  return res.ok ? (res.data ?? accountIds.length) : 0;
}

/** Soft-leave: sets `left_at` so the user stops seeing the channel in
 *  their sidebar but historical messages still reference the member
 *  for author display. */
export async function leaveChannel(
  channelId: string,
  accountId: string,
): Promise<boolean> {
  void accountId; // identity comes from the session server-side
  return (await discussMutate("leaveChannel", { channelId })).ok;
}

/** Fetch active members of a channel with their account + person info.
 *  Used by the channel details pane and the mention autocomplete. */
export async function fetchChannelMembers(
  channelId: string,
): Promise<Array<DiscussMemberRow & { author: DiscussAuthor }>> {
  const data = await discussRead<Array<DiscussMemberRow & { author: DiscussAuthor }>>(
    "members",
    { channelId },
  );
  return data ?? [];
}

/** Update the read cursor for a (channel, member) pair. Called from
 *  the UI when the user scrolls the message list to the bottom, or
 *  when they switch away from a channel. Idempotent. */
export async function markChannelRead(
  channelId: string,
  accountId: string,
): Promise<boolean> {
  void accountId; // identity comes from the session server-side
  return (await discussMutate("markRead", { channelId })).ok;
}

/* ═══════════════════════════════════════════════════════════════════════
   Messages
   ═══════════════════════════════════════════════════════════════════════ */

/** Fetch the last N messages of a channel with author info + reactions
 *  already aggregated. Sorted ASCENDING so the list renders oldest→newest
 *  from top of viewport, then the UI scrolls to the bottom. */
export async function fetchChannelMessages(
  channelId: string,
  options: {
    currentAccountId: string;
    limit?: number;
    before?: string;
    /** ISO timestamp — return ONLY messages newer than this (lightweight
     *  incremental fetch used by the realtime refresh). */
    after?: string;
  } = {
    currentAccountId: "",
  },
): Promise<DiscussMessageWithAuthor[]> {
  const { limit, before, after } = options;
  const data = await discussRead<DiscussMessageWithAuthor[]>("channelMessages", {
    channelId,
    limit,
    before,
    after,
  });
  return data ?? [];
}

/** Send a new message in a channel. Accepts the full metadata payload
 *  (attachments / products / mentions / voice / link preview) so the
 *  caller just builds it once and hands it over. */
export async function sendDiscussMessage(input: {
  channelId: string;
  authorId: string;
  body: string;
  kind?: DiscussMessageKind;
  replyToMessageId?: string | null;
  metadata?: DiscussMessageMetadata;
}): Promise<DiscussMessageRow | null> {
  const res = await discussMutate<DiscussMessageRow>("sendMessage", {
    channelId: input.channelId,
    body: input.body,
    kind: input.kind ?? "text",
    replyToMessageId: input.replyToMessageId ?? null,
    metadata: input.metadata ?? {},
  });
  return res.ok ? (res.data ?? null) : null;
}

/** Edit the body of an existing message. Sets `edited_at` so the UI
 *  can show "(edited)". */
export async function editDiscussMessage(
  id: string,
  body: string,
  metadata?: DiscussMessageMetadata,
): Promise<boolean> {
  return (await discussMutate("editMessage", { id, body, metadata: metadata ?? {} })).ok;
}

/** Soft-delete. The UI will render a "message deleted" placeholder. */
export async function deleteDiscussMessage(id: string): Promise<boolean> {
  return (await discussMutate("deleteMessage", { id })).ok;
}

/* ═══════════════════════════════════════════════════════════════════════
   Reactions
   ═══════════════════════════════════════════════════════════════════════ */

/** Toggle an emoji reaction on a message by the current user. If the
 *  row already exists it's deleted; otherwise inserted. Returns the
 *  new reacted state (true = now reacted). */
export async function toggleReaction(
  messageId: string,
  accountId: string,
  emoji: string,
): Promise<boolean> {
  void accountId; // identity comes from the session server-side
  const res = await discussMutate<boolean>("toggleReaction", { messageId, emoji });
  return res.ok ? (res.data ?? false) : false;
}

/* ═══════════════════════════════════════════════════════════════════════
   Pinned + Starred
   ═══════════════════════════════════════════════════════════════════════ */

export async function pinMessage(
  channelId: string,
  messageId: string,
  pinnedBy: string,
): Promise<boolean> {
  void pinnedBy; // identity comes from the session server-side
  return (await discussMutate("pinMessage", { channelId, messageId })).ok;
}

export async function unpinMessage(
  channelId: string,
  messageId: string,
): Promise<boolean> {
  return (await discussMutate("unpinMessage", { channelId, messageId })).ok;
}

export async function toggleStar(
  accountId: string,
  messageId: string,
): Promise<boolean> {
  void accountId; // identity comes from the session server-side
  const res = await discussMutate<boolean>("toggleStar", { messageId });
  return res.ok ? (res.data ?? false) : false;
}

/* ═══════════════════════════════════════════════════════════════════════
   Drafts
   ═══════════════════════════════════════════════════════════════════════ */

/** Upsert a draft. Called from a debounced effect in the composer so
 *  every keystroke doesn't round-trip the DB. */
export async function saveDraft(input: {
  accountId: string;
  channelId: string;
  body: string;
  metadata?: DiscussMessageMetadata;
}): Promise<boolean> {
  return (
    await discussMutate("saveDraft", {
      channelId: input.channelId,
      body: input.body,
      metadata: input.metadata ?? {},
    })
  ).ok;
}

export async function fetchDraft(
  accountId: string,
  channelId: string,
): Promise<DiscussDraftRow | null> {
  void accountId; // identity comes from the session server-side
  const { data } = await discussState<DiscussDraftRow | null>("draft", { channelId });
  return (data as DiscussDraftRow) ?? null;
}

export async function clearDraft(
  accountId: string,
  channelId: string,
): Promise<boolean> {
  void accountId; // identity comes from the session server-side
  return (await discussMutate("clearDraft", { channelId })).ok;
}

/* ═══════════════════════════════════════════════════════════════════════
   Attachments
   ═══════════════════════════════════════════════════════════════════════ */

/** Upload a file to the shared `media` bucket under the
 *  `discuss-attachments/` prefix. Returns the structured record ready
 *  to embed in `discuss_messages.metadata.attachments`. Same shape and
 *  file-path pattern as the inbox uploader so storage can be shared. */
export async function uploadDiscussAttachment(
  file: File,
): Promise<DiscussAttachment | null> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `discuss-attachments/${Date.now()}_${safeName}`;
  const result = await uploadToStorage(BUCKET, filePath, file, {
    cacheControl: "3600",
  });
  if (!result.ok) {
    console.error("[Discuss] Attachment upload:", result.error);
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

/* ═══════════════════════════════════════════════════════════════════════
   Realtime
   ═══════════════════════════════════════════════════════════════════════ */

/** Subscribe to live inserts + updates on a channel's messages and
 *  reactions. The caller owns the returned unsubscribe function and
 *  should call it from their `useEffect` cleanup.
 *
 *  We return a composite unsubscriber rather than the raw channel
 *  object because most callers only need "stop listening" — they
 *  never care about the underlying Supabase channel handle. */
/* ── Broadcast subscription manager (RLS realtime-lockdown P3) ──────────
   The Discuss realtime tables are locked to service_role, so clients no longer
   use anon postgres_changes. Instead the server emits a Broadcast "changed"
   ping per channel/account topic after each write (see /api/discuss/mutate +
   realtime-broadcast.ts). Broadcast needs no table access — same mechanism as
   the typing/presence indicators. On a ping the client refetches through the
   gated read endpoints, so message content only ever comes from an authorized
   read.

   supabase-js de-dupes channels by topic, and several components subscribe to
   the SAME channel topic at once (DiscussApp + ThreadPane on the open channel;
   DiscussApp + NotificationBell + FloatingPanel on the account topic). We keep
   ONE shared realtime channel per topic and ref-count listeners so one
   component unmounting never tears down another's subscription. */
type PingPayload = { channelId?: string; authorId?: string | null } | undefined;
const broadcastSubs = new Map<
  string,
  {
    channel: ReturnType<typeof supabase.channel>;
    listeners: Set<(p: PingPayload) => void>;
    /* kx-perf: subscription lifecycle bookkeeping (join time / reconnects). */
    t0: number;
    joins: number;
    /* Last status reported by supabase-js — "SUBSCRIBED" = healthy stream.
       Consumers use the health helpers below to decide whether fallback
       polling is needed at all (Phase 3C connection-aware reconciliation). */
    status: string;
  }
>();

function subscribeBroadcast(topic: string, onPing: (p: PingPayload) => void): () => void {
  let entry = broadcastSubs.get(topic);
  if (!entry) {
    const channel = supabase.channel(topic);
    const created = { channel, listeners: new Set<(p: PingPayload) => void>(), t0: performance.now(), joins: 0, status: "PENDING" };
    channel
      .on("broadcast", { event: "changed" }, (msg) => {
        const payload = (msg?.payload ?? undefined) as PingPayload;
        for (const l of created.listeners) {
          try { l(payload); } catch { /* one bad listener must not break the rest */ }
        }
      })
      .subscribe((status) => {
        created.status = status;
        /* kx-perf: realtime connection health. `scope` is the topic FAMILY
           (e.g. "discuss:channel") — never an id. First SUBSCRIBED = join
           time; later ones = automatic reconnects after a drop. */
        try {
          const scope = topic.split(":").slice(0, 2).join(":");
          if (status === "SUBSCRIBED") {
            created.joins += 1;
            if (created.joins === 1) perfRecord("rt.join_ms", performance.now() - created.t0, { scope });
            else perfEvent("rt.reconnect", { scope });
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            perfEvent("rt.status", { s: status, scope });
          }
          perfRecord("rt.channels", broadcastSubs.size);
        } catch { /* metrics never break realtime */ }
      });
    broadcastSubs.set(topic, created);
    entry = created;
  }
  entry.listeners.add(onPing);
  return () => {
    const e = broadcastSubs.get(topic);
    if (!e) return;
    e.listeners.delete(onPing);
    if (e.listeners.size === 0) {
      try { supabase.removeChannel(e.channel); } catch { /* ignore */ }
      broadcastSubs.delete(topic);
      perfRecord("rt.channels", broadcastSubs.size);
    }
  };
}

/** The signed-in account id, resolved once from the session bootstrap and
 *  cached — needed to pick the caller's `discuss:account:<id>` ping topic. */
let cachedAccountId: string | null = null;
let accountIdPromise: Promise<string | null> | null = null;
async function getMyAccountId(): Promise<string | null> {
  if (cachedAccountId) return cachedAccountId;
  if (!accountIdPromise) {
    accountIdPromise = fetch("/api/me/bootstrap", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        cachedAccountId = j?.auth?.account_id ?? null;
        return cachedAccountId;
      })
      .catch(() => null);
  }
  return accountIdPromise;
}

/** Subscribe to a channel's live message stream. Broadcast ping → refetch the
 *  channel and diff against a snapshot, firing onMessageInsert for genuinely
 *  new messages and onMessageUpdate for edited/deleted ones. Reactions are
 *  reconciled by the caller's existing focus / interval refetch (a few seconds),
 *  so their granular callbacks are no longer driven from here. */
/* kx-perf: receiver-pipeline correlation — when the last broadcast ping for a
   channel arrived (performance.now() clock). DiscussApp reads this to measure
   ping -> message-visible latency. In-memory only; ids are never shipped. */
const lastPingAt = new Map<string, number>();
export function getLastPingAt(channelId: string): number | null {
  return lastPingAt.get(channelId) ?? null;
}

/** Is the live broadcast stream for this channel currently SUBSCRIBED?
 *  Used by DiscussApp to skip fallback polling entirely while realtime is
 *  healthy (Phase 3C). Unknown topics report unhealthy, which safely biases
 *  toward reconciliation. */
export function isChannelStreamHealthy(channelId: string): boolean {
  return broadcastSubs.get(rtChannelTopic(channelId))?.status === "SUBSCRIBED";
}

/** Same, for the caller's account-level ping stream (sidebar / bell). */
export function isAccountStreamHealthy(accountId: string): boolean {
  return broadcastSubs.get(rtAccountTopic(accountId))?.status === "SUBSCRIBED";
}

export function subscribeToChannel(
  channelId: string,
  handlers: {
    onMessageInsert?: (msg: DiscussMessageRow) => void;
    onMessageUpdate?: (msg: DiscussMessageRow) => void;
    onReactionInsert?: (rx: DiscussReactionRow) => void;
    onReactionDelete?: (rx: DiscussReactionRow) => void;
  },
): () => void {
  void handlers.onReactionInsert;
  void handlers.onReactionDelete;
  let closed = false;
  let refreshing = false;
  let primed = false;
  let latest = "1970-01-01T00:00:00+00:00"; // max created_at seen — incremental cursor
  const seen = new Set<string>();

  const refresh = async () => {
    if (closed || refreshing) return;
    refreshing = true;
    try {
      /* Prime once with a full fetch (no callbacks — don't replay history),
         then every ping does a lightweight incremental fetch of ONLY messages
         newer than the cursor, so a new message reaches the receiver in one
         small query instead of re-pulling + diffing the whole channel. Edits /
         reactions are reconciled by the parent's 5s full poll. */
      const kxT0 = performance.now();
      const msgs = primed
        ? await fetchChannelMessages(channelId, { currentAccountId: "", after: latest })
        : await fetchChannelMessages(channelId, { currentAccountId: "" });
      /* kx-perf: ping -> rows-in-hand (the network+db half of delivery). */
      if (primed) perfRecord("discuss.recv.fetch_ms", performance.now() - kxT0);
      if (closed) return;
      for (const m of msgs) {
        if (m.created_at && m.created_at > latest) latest = m.created_at;
        if (!seen.has(m.id)) {
          seen.add(m.id);
          if (primed) handlers.onMessageInsert?.(m as unknown as DiscussMessageRow);
        }
      }
      primed = true;
    } finally {
      refreshing = false;
    }
  };

  // Prime the snapshot (no callbacks fired) so we don't replay existing messages.
  void refresh();

  const unsub = subscribeBroadcast(rtChannelTopic(channelId), () => {
    lastPingAt.set(channelId, performance.now());
    void refresh();
  });

  return () => {
    closed = true;
    unsub();
  };
}

/** Subscribe to the caller's "my channels" activity — a ping whenever any
 *  channel they're in changes (new message, channel created / archived, member
 *  added). On a ping we always trigger onChannelChange (a debounced sidebar
 *  refetch that recomputes unread / previews / order correctly) and, when the
 *  ping names a different author, also fire onMessageInsert with a minimal
 *  synthetic row so the notification bell can chime / bump before the refetch
 *  lands. The payload carries ids only — never message content. */
export function subscribeToMyChannels(
  handlers:
    | (() => void)
    | {
        onMessageInsert?: (msg: DiscussMessageRow) => void;
        onChannelChange?: () => void;
      },
): () => void {
  const onMessage =
    typeof handlers === "function"
      ? (_msg: DiscussMessageRow) => (handlers as () => void)()
      : handlers.onMessageInsert;
  const onChannel =
    typeof handlers === "function" ? (handlers as () => void) : handlers.onChannelChange;

  let closed = false;
  let unsub: (() => void) | null = null;

  void getMyAccountId().then((accountId) => {
    if (closed || !accountId) return;
    unsub = subscribeBroadcast(rtAccountTopic(accountId), (payload) => {
      const authorId = payload?.authorId ?? null;
      if (onMessage && authorId && authorId !== accountId) {
        onMessage({
          id: "",
          channel_id: payload?.channelId ?? "",
          author_account_id: authorId,
          reply_to_message_id: null,
          kind: "text",
          body: null,
          body_html: null,
          metadata: {},
          edited_at: null,
          deleted_at: null,
          created_at: new Date().toISOString(),
        } as unknown as DiscussMessageRow);
      }
      onChannel?.();
    });
  });

  return () => {
    closed = true;
    if (unsub) unsub();
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   Presence / typing (ephemeral — uses Supabase Realtime broadcast)
   ═══════════════════════════════════════════════════════════════════════ */

/** Open a presence channel for a given conversation. Tracks the
 *  current user online while the channel is open, and relays a list
 *  of everyone else currently looking at the same conversation.
 *
 *  Typing indicators travel on the same channel via Realtime Broadcast
 *  (no DB write) — extremely cheap, no retention. */
export function openPresenceChannel(input: {
  channelId: string;
  accountId: string;
  username: string;
  onPresenceSync?: (online: string[]) => void;
  onTyping?: (accountId: string, username: string) => void;
}): {
  sendTyping: () => void;
  close: () => void;
} {
  const rt = supabase.channel(`discuss-presence:${input.channelId}`, {
    config: { presence: { key: input.accountId } },
  });

  rt.on("presence", { event: "sync" }, () => {
    const state = rt.presenceState<{ username: string }>();
    const ids = Object.keys(state);
    input.onPresenceSync?.(ids);
  });

  rt.on("broadcast", { event: "typing" }, (payload) => {
    const p = payload.payload as { account_id: string; username: string };
    if (p.account_id === input.accountId) return;
    input.onTyping?.(p.account_id, p.username);
  });

  rt.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      void rt.track({ username: input.username, at: Date.now() });
    }
  });

  return {
    sendTyping: () => {
      void rt.send({
        type: "broadcast",
        event: "typing",
        payload: {
          account_id: input.accountId,
          username: input.username,
        },
      });
    },
    close: () => {
      void rt.untrack();
      supabase.removeChannel(rt);
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   Phase B — Threads
   ═══════════════════════════════════════════════════════════════════════ */

/** Fetch every reply to a given parent message, oldest first, plus the
 *  parent itself at index 0. Used by the thread pane so the UI can
 *  render the full conversation. Author + reactions are resolved the
 *  same way fetchChannelMessages does. */
export async function fetchThreadMessages(
  parentMessageId: string,
  currentAccountId: string,
): Promise<DiscussMessageWithAuthor[]> {
  void currentAccountId; // reacted_by_me is resolved server-side from the session
  const data = await discussRead<DiscussMessageWithAuthor[]>("thread", {
    parentId: parentMessageId,
  });
  return data ?? [];
}

/* ═══════════════════════════════════════════════════════════════════════
   Phase C — Full-text search
   ═══════════════════════════════════════════════════════════════════════ */

/** Full-text search over `discuss_messages.body` using the GIN index
 *  created in Phase A. Returns a ranked, highlighted snippet per hit.
 *
 *  The underlying search is a plain ILIKE fallback when the
 *  `discuss_messages_fts_idx` hasn't been created yet (fresh dev DB).
 *  In production we rely on the `to_tsvector('simple', body)` index
 *  for speed, and use `ts_headline` for the highlighted snippet. */
export async function searchDiscussMessages(input: {
  accountId: string;
  query: string;
  channelId?: string;
  limit?: number;
}): Promise<DiscussSearchResult[]> {
  const q = input.query.trim();
  if (q.length < 2) return [];
  type Row = {
    id: string;
    channel_id: string;
    body: string | null;
    created_at: string;
    author:
      | { username: string; avatar_url: string | null; person: { full_name: string } | Array<{ full_name: string }> | null }
      | Array<{ username: string; avatar_url: string | null; person: { full_name: string } | Array<{ full_name: string }> | null }>
      | null;
    channel:
      | { id: string; name: string | null; kind: DiscussChannelKind }
      | Array<{ id: string; name: string | null; kind: DiscussChannelKind }>
      | null;
  };
  const rows = (await discussRead<Row[]>("search", {
    q,
    channelId: input.channelId,
    limit: input.limit,
  })) ?? [];

  const results: DiscussSearchResult[] = [];
  for (const row of rows) {
    const acc = Array.isArray(row.author) ? row.author[0] ?? null : row.author;
    const person = acc && (Array.isArray(acc.person) ? acc.person[0] ?? null : acc.person);
    const ch = Array.isArray(row.channel) ? row.channel[0] ?? null : row.channel;
    const body = row.body ?? "";
    const idx = body.toLowerCase().indexOf(q.toLowerCase());
    let snippet = body;
    if (idx >= 0 && body.length > 100) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(body.length, idx + q.length + 40);
      snippet =
        (start > 0 ? "…" : "") + body.slice(start, end) + (end < body.length ? "…" : "");
    }
    try {
      const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      snippet = snippet.replace(re, "<mark>$1</mark>");
    } catch {
      /* fall back to plain snippet */
    }
    results.push({
      message_id: row.id,
      channel_id: row.channel_id,
      channel_name: ch?.name ?? null,
      channel_kind: ch?.kind ?? "channel",
      author_username: acc?.username ?? null,
      author_full_name: person?.full_name ?? null,
      author_avatar_url: acc?.avatar_url ?? null,
      body,
      snippet,
      created_at: row.created_at,
      rank: 1,
    });
  }
  return results;
}

/* ═══════════════════════════════════════════════════════════════════════
   Phase C — Drafts / Pinned / Starred list views
   ═══════════════════════════════════════════════════════════════════════ */

/** Fetch every draft the current user has saved across all channels —
 *  used by the Drafts sidebar section. Joined with the channel so the
 *  UI can render a pill per draft without a second fetch. */
export async function fetchAllDrafts(
  accountId: string,
): Promise<Array<DiscussDraftRow & { channel: DiscussChannelRow | null }>> {
  void accountId; // identity comes from the session server-side
  const { data } = await discussState<
    Array<DiscussDraftRow & { channel: DiscussChannelRow | null }>
  >("allDrafts");
  return data ?? [];
}

/** Fetch the pinned panel for a channel. Pinned → messages join so
 *  the caller gets the full MessageWithAuthor shape it already knows
 *  how to render. */
export async function fetchPinnedMessages(
  channelId: string,
  currentAccountId: string,
): Promise<DiscussMessageWithAuthor[]> {
  void currentAccountId; // reacted_by_me is resolved server-side from the session
  const { data } = await discussState<DiscussMessageWithAuthor[]>("pinned", { channelId });
  return data ?? [];
}

/** Fetch every message the current user has starred, most-recent first.
 *  Used by the Starred sidebar view — a global bookmarks list. */
export async function fetchStarredMessages(
  accountId: string,
): Promise<DiscussMessageWithAuthor[]> {
  void accountId; // identity comes from the session server-side
  const { data } = await discussState<DiscussMessageWithAuthor[]>("starred");
  return data ?? [];
}

/* ═══════════════════════════════════════════════════════════════════════
   Phase D — Notification prefs + mute
   ═══════════════════════════════════════════════════════════════════════ */

/** Set the per-channel notification pref for the current user.
 *  `all` → every message notifies, `mentions` → only @mentions,
 *  `none` → silent (works like mute but preserves unread badges). */
export async function setNotificationPref(
  channelId: string,
  accountId: string,
  pref: DiscussNotificationPref,
): Promise<boolean> {
  void accountId; // identity comes from the session server-side
  return (await discussMutate("setNotificationPref", { channelId, pref })).ok;
}

/** Toggle the mute flag for a (channel, member) pair. Muted channels
 *  still count unreads but never play a sound or raise a desktop
 *  notification. */
export async function setChannelMuted(
  channelId: string,
  accountId: string,
  muted: boolean,
): Promise<boolean> {
  void accountId; // identity comes from the session server-side
  return (await discussMutate("setChannelMuted", { channelId, muted })).ok;
}

/* ═══════════════════════════════════════════════════════════════════════
   Phase D — Voice notes
   ═══════════════════════════════════════════════════════════════════════ */

/** Map a recorder's `Blob.type` to a file extension. MediaRecorder
 *  hands us different containers depending on the browser:
 *    · Chrome/Firefox/Edge → audio/webm (sometimes with ";codecs=opus")
 *    · Safari desktop & iOS → audio/mp4 (sometimes with ";codecs=mp4a")
 *    · Older Safari → audio/aac
 *  We force the extension to match the real container so getPublicUrl
 *  plays back correctly (some CDNs/browsers key their audio decoder on
 *  the URL extension instead of the Content-Type header). */
function pickVoiceExtension(mime: string | undefined): string {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mp4") || m.includes("aac") || m.includes("x-m4a"))
    return "m4a";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  return "webm";
}

/** Upload a recorded voice blob to Storage and return the structured
 *  metadata ready to embed in `discuss_messages.metadata.voice`.
 *  Waveform is computed client-side in the recorder (see
 *  VoiceRecorder.tsx) and passed through verbatim.
 *
 *  We pass the blob's real MIME type through to Storage and pick an
 *  extension that matches — iOS Safari records audio/mp4 but the old
 *  hard-coded "audio/webm + .webm" pair meant the receiver got a file
 *  that wouldn't decode (Chrome would refuse a .webm that's actually
 *  MP4). Now the URL suffix and the stored Content-Type always agree. */
export async function uploadDiscussVoice(input: {
  blob: Blob;
  durationMs: number;
  waveform: number[];
}): Promise<DiscussVoiceMeta | null> {
  // Voice notes go to the PRIVATE 'discuss-voice' bucket. Playback in
  // the UI requests a short-lived signed URL via /api/storage/signed-url,
  // so leaked message payloads don't expose the audio indefinitely.
  const mime =
    input.blob.type && input.blob.type.length > 0 ? input.blob.type : "audio/webm";
  const ext = pickVoiceExtension(mime);
  const filePath = `${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}.${ext}`;
  const result = await uploadToStorage("discuss-voice", filePath, input.blob, {
    cacheControl: "3600",
    contentType: mime,
  });
  if (!result.ok) {
    console.error("[Discuss] Voice upload:", result.error, {
      mime,
      size: input.blob.size,
    });
    return null;
  }
  return {
    // Leave url empty — the playback component fetches a signed URL
    // on demand using path + bucket.
    url: "",
    bucket: "discuss-voice",
    path: result.data.path,
    duration_ms: input.durationMs,
    waveform: input.waveform,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   Phase E — Customer chat
   ═══════════════════════════════════════════════════════════════════════ */

/** Atomically find-or-create a customer-chat channel bound to a CRM
 *  contact. Wraps the `find_or_create_customer_channel` RPC created
 *  in extend_discuss_phase_bcde.sql. */
export async function findOrCreateCustomerChannel(input: {
  contactId: string;
  createdBy: string;
  displayName: string;
  additionalMemberIds?: string[];
}): Promise<string | null> {
  const { data, error } = await supabase.rpc("find_or_create_customer_channel", {
    p_contact_id: input.contactId,
    p_created_by: input.createdBy,
    p_display_name: input.displayName,
  });
  if (error) {
    console.error("[Discuss] Find/create customer channel:", error.message);
    return null;
  }
  const channelId = (data as string) ?? null;
  if (!channelId) return null;

  /* Optionally add additional team members beyond the creator. The RPC
     only auto-adds the creator so the channel is immediately visible
     in their sidebar; everyone else joins via this call. */
  if (input.additionalMemberIds && input.additionalMemberIds.length > 0) {
    const extra = input.additionalMemberIds.filter((id) => id !== input.createdBy);
    if (extra.length > 0) await addMembers(channelId, extra);
  }
  return channelId;
}

/** Fetch the CRM contact linked to a customer-chat channel. Returns
 *  null for internal channels. Used by the details pane to render the
 *  customer contact card. */
export async function fetchLinkedContact(
  channelId: string,
): Promise<DiscussLinkedContact | null> {
  const { data: ch, error: chErr } = await supabase
    .from(CHANNELS)
    .select("linked_contact_id")
    .eq("id", channelId)
    .maybeSingle();
  if (chErr || !ch) return null;
  const contactId = (ch as { linked_contact_id: string | null }).linked_contact_id;
  if (!contactId) return null;

  const { data: contact } = await supabase
    .from(CONTACTS)
    .select(
      "id, display_name, full_name, first_name, last_name, company, email, phone, photo_url, contact_type",
    )
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return null;

  const row = contact as {
    id: string;
    display_name: string | null;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
    email: string | null;
    phone: string | null;
    photo_url: string | null;
    contact_type: string | null;
  };
  const displayName =
    row.display_name ??
    row.full_name ??
    [row.first_name, row.last_name].filter(Boolean).join(" ") ??
    "Unnamed contact";
  return {
    id: row.id,
    display_name: displayName || "Unnamed contact",
    full_name: row.full_name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    avatar_url: row.photo_url,
    contact_type: row.contact_type,
  };
}

/** Lightweight contact search for the "Start customer chat" picker.
 *  Searches display_name + company + email with an ILIKE prefix. */
export async function searchContactsForChat(
  query: string,
  limit = 12,
): Promise<DiscussLinkedContact[]> {
  const q = query.trim();
  if (q.length < 1) {
    /* Empty query → return the most recent customers so the picker
       has something to show on first open. */
    const { data } = await supabase
      .from(CONTACTS)
      .select(
        "id, display_name, full_name, first_name, last_name, company, email, phone, photo_url, contact_type",
      )
      .eq("contact_type", "customer")
      .order("updated_at", { ascending: false })
      .limit(limit);
    return toLinkedContacts(data);
  }
  const escaped = q.replace(/[%_]/g, (c) => `\\${c}`);
  const { data } = await supabase
    .from(CONTACTS)
    .select(
      "id, display_name, full_name, first_name, last_name, company, email, phone, photo_url, contact_type",
    )
    .or(
      `display_name.ilike.%${escaped}%,full_name.ilike.%${escaped}%,company.ilike.%${escaped}%,email.ilike.%${escaped}%`,
    )
    .limit(limit);
  return toLinkedContacts(data);
}

/** Accounts that can receive messages — used by the DM + @mention picker.
 *  Returns only internal users (not customers / suppliers). Lives in
 *  `@/lib/discuss` so Discuss has no dependency on any parked mail
 *  modules. */
export async function fetchMessageableAccounts(): Promise<
  Array<{
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    role_name: string | null;
  }>
> {
  /* API-first: accounts/people/roles are service-role-only (P0 lockdown), so the
     anon query below returns nothing for normal users. The server route resolves
     the tenant-scoped list with the service role. Fall back to the anon query
     only if the endpoint is unavailable. */
  try {
    const res = await fetch("/api/discuss/recipients", { credentials: "include" });
    if (res.ok) {
      const json = (await res.json()) as {
        recipients?: Array<{
          id: string;
          username: string;
          full_name: string | null;
          avatar_url: string | null;
          role_name: string | null;
        }>;
      };
      if (Array.isArray(json.recipients)) return json.recipients;
    }
  } catch {
    /* network error → fall through to anon query */
  }

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
    console.error("[Discuss] Fetch recipients:", error.message);
    return [];
  }
  type Row = {
    id: string;
    username: string;
    avatar_url: string | null;
    person:
      | { full_name: string; avatar_url: string | null }
      | Array<{ full_name: string; avatar_url: string | null }>
      | null;
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

function toLinkedContacts(data: unknown): DiscussLinkedContact[] {
  return ((data ?? []) as Array<{
    id: string;
    display_name: string | null;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
    email: string | null;
    phone: string | null;
    photo_url: string | null;
    contact_type: string | null;
  }>).map((row) => {
    const name =
      row.display_name ??
      row.full_name ??
      [row.first_name, row.last_name].filter(Boolean).join(" ") ??
      "Unnamed contact";
    return {
      id: row.id,
      display_name: name || "Unnamed contact",
      full_name: row.full_name,
      company: row.company,
      email: row.email,
      phone: row.phone,
      avatar_url: row.photo_url,
      contact_type: row.contact_type,
    };
  });
}
