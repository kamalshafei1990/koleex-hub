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

const CHANNELS = "discuss_channels";
/* discuss_pinned / discuss_starred / discuss_drafts are read via the gated
   /api/discuss/state route and written via /api/discuss/mutate, so their table
   names live server-side only (RLS: service_role). */
const CONTACTS = "contacts";
const BUCKET = "media";

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
      console.error("[Discuss] state", resource, json.error ?? `HTTP ${res.status}`);
      return { ok: false, error: json.error ?? `HTTP ${res.status}` };
    }
    return { ok: true, data: json.data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isTransientFetch(msg)) console.error("[Discuss] state", resource, msg);
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
      if (!isTransientFetch(msg)) console.error("[Discuss] read", resource, msg);
      return undefined;
    }
    return json.data;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isTransientFetch(msg)) console.error("[Discuss] read", resource, msg);
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
  options: { currentAccountId: string; limit?: number; before?: string } = {
    currentAccountId: "",
  },
): Promise<DiscussMessageWithAuthor[]> {
  const { limit, before } = options;
  const data = await discussRead<DiscussMessageWithAuthor[]>("channelMessages", {
    channelId,
    limit,
    before,
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
/** Unique-per-call topic suffix for realtime channels. We can't reuse
 *  topic names across subscribers because supabase-js de-dupes channels
 *  by topic and `.on("postgres_changes", …)` after `.subscribe()`
 *  throws. A short random id keeps each subscription fully isolated. */
function uniqueChannelSuffix(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
  /* We wrap channel creation in a helper so we can tear it down and
     re-create it from scratch on CHANNEL_ERROR / TIMED_OUT without
     losing the caller's handlers. The Supabase JS realtime client
     will re-join on network blips, but it does NOT recreate a channel
     after a server-side error — which Safari triggers surprisingly
     often when the tab comes back from a long sleep.

     IMPORTANT: every connect() invocation must use a UNIQUE topic.
     `supabase.channel(topic)` returns the existing channel if one
     with that topic is still in `client.channels`, and `removeChannel`
     is async — so React strict-mode double-mounts (or two simultaneous
     subscribers) handed back the same already-`subscribe()`-d channel,
     and `.on("postgres_changes", …)` after subscribe throws. Suffixing
     each call with a fresh random id sidesteps the cache entirely. */
  let currentChannel: ReturnType<typeof supabase.channel> | null = null;
  let reconnectTimer: number | null = null;
  let closed = false;

  const connect = () => {
    if (closed) return;
    const topic = `discuss:${channelId}:${uniqueChannelSuffix()}`;
    const ch = supabase.channel(topic, {
      config: { broadcast: { self: false } },
    });
    ch.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "discuss_messages",
        filter: `channel_id=eq.${channelId}`,
      },
      (payload) => {
        handlers.onMessageInsert?.(payload.new as DiscussMessageRow);
      },
    )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "discuss_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          handlers.onMessageUpdate?.(payload.new as DiscussMessageRow);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "discuss_reactions",
        },
        (payload) => {
          handlers.onReactionInsert?.(payload.new as DiscussReactionRow);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "discuss_reactions",
        },
        (payload) => {
          handlers.onReactionDelete?.(payload.old as DiscussReactionRow);
        },
      )
      .subscribe((status) => {
        if (typeof console !== "undefined") {
          if (status === "SUBSCRIBED") {
            console.info(
              `[Discuss] channel ${channelId} realtime SUBSCRIBED ✓`,
            );
          }
        }
        /* Reconnect only on the *abnormal* statuses. CLOSED is the
           normal status emitted during teardown (we called
           removeChannel) and during HMR / strict-mode double-mounts —
           reconnecting on it produces an infinite reconnect loop. */
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (typeof console !== "undefined") {
            console.warn(
              `[Discuss] channel ${channelId} realtime ${status}, reconnecting…`,
            );
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

/** Subscribe to the "my channels" view — the sidebar wants a ping
 *  whenever any channel the user is in gets a new message (so we can
 *  bump `last_message_at`, increment the unread badge, and re-sort
 *  without a full refetch) and whenever a channel row is created or
 *  archived (so a new #channel or new DM appears instantly).
 *
 *  The handlers are intentionally split so callers can patch state
 *  in place for the hot path (`onMessageInsert`) and only trigger a
 *  full `loadChannels()` for the rare case where the channel list
 *  itself changed (`onChannelChange`). This removes the old pattern
 *  of refetching the entire sidebar on every message in the
 *  workspace — which was the main reason Discuss felt "refreshy". */
export function subscribeToMyChannels(
  handlers:
    | (() => void)
    | {
        onMessageInsert?: (msg: DiscussMessageRow) => void;
        onChannelChange?: () => void;
      },
): () => void {
  /* Backwards-compat: an old caller passed a single callback — run it
     for both events so nothing silently breaks. */
  const onMessage =
    typeof handlers === "function"
      ? (_msg: DiscussMessageRow) => (handlers as () => void)()
      : handlers.onMessageInsert;
  const onChannel =
    typeof handlers === "function"
      ? (handlers as () => void)
      : handlers.onChannelChange;

  let currentChannel: ReturnType<typeof supabase.channel> | null = null;
  let reconnectTimer: number | null = null;
  let closed = false;

  const connect = () => {
    if (closed) return;
    /* See the long comment in subscribeToChannel: each subscriber needs
       its own topic so NotificationBell + DiscussApp (which both call this)
       and React strict-mode double-mounts don't collide on the cached
       already-subscribed channel. */
    const topic = `discuss:my-channels:${uniqueChannelSuffix()}`;
    const ch = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "discuss_messages" },
        (payload) => {
          onMessage?.(payload.new as DiscussMessageRow);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "discuss_channels" },
        () => onChannel?.(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "discuss_channels" },
        () => onChannel?.(),
      )
      .subscribe((status) => {
        if (typeof console !== "undefined") {
          if (status === "SUBSCRIBED") {
            console.info("[Discuss] my-channels realtime SUBSCRIBED ✓");
          }
        }
        /* Same caveat as subscribeToChannel: never reconnect on CLOSED,
           that's the normal teardown status and would loop forever. */
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (typeof console !== "undefined") {
            console.warn(
              `[Discuss] my-channels realtime ${status}, reconnecting…`,
            );
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
