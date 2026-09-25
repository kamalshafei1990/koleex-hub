"use client";

/* ---------------------------------------------------------------------------
   discuss — data layer for the Discuss (chat) app.

   Plain async functions, not hooks; React state stays with the caller.
     - Every read goes through the gated server routes (/api/discuss/read,
       /api/discuss/state) and every write through /api/discuss/mutate —
       identity and tenant come from the session, never from arguments.
     - The browser Supabase client is used ONLY for Realtime broadcast
       pings and presence/typing; it never touches discuss_* tables.
     - Live delivery: the first-party SSE stream (connectDiscussStream) is
       primary; broadcast pings are a supplement where the websocket works.
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";
import { cachedGet, invalidateCachedGet } from "./client-cache";
import { uploadToStorage } from "./storage-client";
import { checkDiscussUpload, DISCUSS_TRANSPORT_MAX_BYTES } from "./discuss-upload-policy";
import { isTransientFetch } from "./util/transient-fetch";
import type {
  DiscussAttachment,
  DiscussAuthor,
  DiscussChannelKind,
  DiscussChannelRow,
  DiscussChannelWithState,
  DiscussDraftPublic,
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

/* Table names live server-side only: every discuss_* read goes through
   /api/discuss/read|state and every write through /api/discuss/mutate. */
/* No storage-bucket constant here by design (Unit 2): Discuss uploads name
   their PRIVATE bucket at the call site — `discuss-media` for images and
   documents, `discuss-voice` for audio. The old shared public `media` bucket
   is no longer written to by Discuss at all; it survives only as a read
   source for six pre-Unit-2 objects, and only inside the server resolver. */

/* Broadcast ping topics — MUST match src/lib/server/realtime-broadcast.ts. */
const rtChannelTopic = (channelId: string) => `discuss:channel:${channelId}`;
const rtAccountTopic = (accountId: string) => `discuss:account:${accountId}`;


/** Route a write through the authenticated server endpoint. Every Discuss
 *  mutation goes through /api/discuss/mutate, so the browser's anon key can
 *  no longer write to the discuss_* tables directly. The signed-in identity
 *  is derived from the koleex_session cookie server-side; account/author ids
 *  passed by callers are used only for channel/message targeting, never for
 *  authorship. */
async function discussMutate<T = unknown>(
  action: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; data?: T; error?: string; status?: number }> {
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
      return { ok: false, error: json.error ?? `HTTP ${res.status}`, status: res.status };
    }
/* Any state change (read, pin, mute, hide, send…) may alter the
       myChannels projection — drop the coalesced copy so the very next
       recount reads fresh. */
    invalidateCachedGet("/api/discuss/read?resource=myChannels");
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

/** Fetch every channel the account is a member of, enriched with:
 *   - unread_count (messages since last_read_at by OTHER people)
 *   - last_message preview
 *   - for DMs, the OTHER member's info so the sidebar shows "Sarah" not "DM #abc"
 *
 *  Sorted by `last_message_at DESC` so the most-recently-active thread
 *  sits at the top, Slack-style. */
/* Module-scoped: the shell snapshot may seed the FIRST read of the page and
   nothing after it. See the note inside fetchMyChannels. */
let shellChannelsUsed = false;

/** Fields the sidebar read adds on top of DiscussChannelWithState:
 *   · muted_unread_count — unread messages of a MUTED conversation. For a
 *     muted row `unread_count` is 0 so every badge that sums unread_count
 *     (bell, home tile, floating panel) leaves it out, WeChat-style; Discuss
 *     still shows this count on the row.
 *   · linked_project_id — set when the conversation belongs to a Project
 *     (column added by the Projects migration; absent until it is applied). */
export type DiscussChannelExtras = {
  muted_unread_count?: number;
  linked_project_id?: string | null;
};
export type DiscussChannelListRow = DiscussChannelWithState & DiscussChannelExtras;

export async function fetchMyChannels(
  accountId: string,
): Promise<DiscussChannelListRow[]> {
  void accountId; // identity comes from the session server-side

  /* THE FIRST READ OF THE PAGE RIDES THE SHELL BATCH, which already carries
     this exact shape (`channels`) — that removes the last guaranteed round
     trip from a screen open.

     ONCE, and only once. Every discuss mutate calls
     invalidateCachedGet("/api/discuss/read?resource=myChannels") so that
     mark-read / pin / mute never read their own stale snapshot — and that
     invalidation cannot reach inside the shell's cache. So after this first
     read the function goes back to the endpoint permanently, and the
     freshness contract above is untouched. */
  if (!shellChannelsUsed) {
    shellChannelsUsed = true;
    try {
      const { getShell } = await import("./client-cache");
      const shell = await getShell();
      const seeded = (shell?.channels as { data?: DiscussChannelListRow[] } | null)?.data;
      if (Array.isArray(seeded)) return seeded;
    } catch { /* fall through to the endpoint */ }
  }

  /* Coalesced: myChannels is the most expensive Discuss read and FIVE
     consumers request it on one Home load (bell recount, floating panel,
     home tile badge, realtime resubscribe, focus resync) — measured 5
     identical calls at 3.5-3.9s each while the burst throttled everything
     else. Short TTL: realtime pings land more than 8s apart in practice,
     and every discuss mutate invalidates this key so mark-read / pin /
     mute never read their own stale snapshot. */
  try {
    const json = await cachedGet<{ ok?: boolean; data?: DiscussChannelListRow[] }>(
      "/api/discuss/read?resource=myChannels", 8_000,
    );
    return json?.data ?? [];
  } catch {
    return [];
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Members
   ═══════════════════════════════════════════════════════════════════════ */

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

/** Mark EVERY conversation I am in as read (sidebar menu). */
export async function markAllChannelsRead(): Promise<boolean> {
  return (await discussMutate("markAllRead", {})).ok;
}

/* ── Channel administration (details pane) ─────────────────────────────
   The server re-checks everything: add → any active member (accounts must
   be in my tenant); rename / archive / remove / role → channel admin. A
   failure carries the server's message so the pane can say why. */
type AdminResult = { ok: boolean; error?: string };
const adminResult = (r: { ok: boolean; error?: string }): AdminResult => ({ ok: r.ok, error: r.error });

export async function addChannelMembers(channelId: string, accountIds: string[]): Promise<AdminResult> {
  return adminResult(await discussMutate("addMembers", { channelId, accountIds }));
}
export async function removeChannelMember(channelId: string, accountId: string): Promise<AdminResult> {
  return adminResult(await discussMutate("removeMember", { channelId, accountId }));
}
export async function setChannelMemberRole(
  channelId: string,
  accountId: string,
  role: "admin" | "member",
): Promise<AdminResult> {
  return adminResult(await discussMutate("setMemberRole", { channelId, accountId, role }));
}
export async function renameChannel(channelId: string, name: string): Promise<AdminResult> {
  return adminResult(await discussMutate("updateChannel", { channelId, patch: { name } }));
}
export async function leaveChannel(channelId: string): Promise<AdminResult> {
  return adminResult(await discussMutate("leaveChannel", { channelId }));
}
export async function archiveChannel(channelId: string): Promise<AdminResult> {
  return adminResult(await discussMutate("archiveChannel", { channelId }));
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
  /** Idempotency key for ONE logical send. Reuse the identical value for every
      retry of the same pending message; use a fresh UUID for a new message.
      The server upserts on (channel_id, client_msg_id), so a retry after a
      committed-but-timed-out send returns the original row instead of
      duplicating it. Omitted → legacy (non-idempotent) behavior. */
  clientMsgId?: string;
}): Promise<DiscussMessageRow | null> {
  const res = await discussMutate<DiscussMessageRow>("sendMessage", {
    channelId: input.channelId,
    body: input.body,
    kind: input.kind ?? "text",
    replyToMessageId: input.replyToMessageId ?? null,
    metadata: input.metadata ?? {},
    clientMsgId: input.clientMsgId ?? null,
  });
  return res.ok ? (res.data ?? null) : null;
}

/** Same as sendDiscussMessage, but says WHY a send failed so the composer can
 *  keep a "Not sent — Retry" bubble for failures a retry can fix (network,
 *  timeout, 5xx, rate limit) and drop the bubble for ones it cannot (not a
 *  member, too long, invalid). Retrying MUST reuse the same clientMsgId: the
 *  server dedupes on (channel_id, client_msg_id), so a send that committed
 *  but whose answer was lost comes back as the original row. */
export async function sendDiscussMessageResult(
  input: Parameters<typeof sendDiscussMessage>[0],
): Promise<{ row: DiscussMessageRow | null; retryable: boolean; error?: string }> {
  const res = await discussMutate<DiscussMessageRow>("sendMessage", {
    channelId: input.channelId,
    body: input.body,
    kind: input.kind ?? "text",
    replyToMessageId: input.replyToMessageId ?? null,
    metadata: input.metadata ?? {},
    clientMsgId: input.clientMsgId ?? null,
  });
  if (res.ok && res.data) return { row: res.data, retryable: false };
  const st = res.status;
  const retryable = st === undefined || st >= 500 || st === 408 || st === 429;
  return { row: null, retryable, error: res.error };
}

/** Edit the BODY of your own message. Sets `edited_at` so the UI can show
 *  "(edited)". Metadata (attachments, voice, mentions, products) is never
 *  sent on edit — the server refuses to touch it. */
export async function editDiscussMessage(id: string, body: string): Promise<boolean> {
  return (await discussMutate("editMessage", { id, body })).ok;
}

/** Soft-delete. The UI will render a "message deleted" placeholder. */
export async function deleteDiscussMessage(id: string): Promise<boolean> {
  return (await discussMutate("deleteMessage", { id })).ok;
}

/* ═══════════════════════════════════════════════════════════════════════
   Reactions
   ═══════════════════════════════════════════════════════════════════════ */

/** Toggle an emoji reaction on a message by the current user. Returns the
 *  new reacted state (true = now reacted), or `null` when the write failed
 *  so the caller can roll its optimistic flip back. */
export async function toggleReaction(
  messageId: string,
  accountId: string,
  emoji: string,
): Promise<boolean | null> {
  void accountId; // identity comes from the session server-side
  const res = await discussMutate<boolean>("toggleReaction", { messageId, emoji });
  return res.ok ? (res.data ?? false) : null;
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

/** Toggle "save for later". Returns the new starred state, or `null` when
 *  the write failed (the UI must not claim success). */
export async function toggleStar(
  accountId: string,
  messageId: string,
): Promise<boolean | null> {
  void accountId; // identity comes from the session server-side
  const res = await discussMutate<boolean>("toggleStar", { messageId });
  return res.ok ? (res.data ?? false) : null;
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
): Promise<DiscussDraftPublic | null> {
  void accountId; // identity comes from the session server-side
  /* DiscussDraftPublic, not the DB row: the response carries no `metadata`,
     so no storage path can reach this client. */
  const { data } = await discussState<DiscussDraftPublic | null>("draft", { channelId });
  return (data as DiscussDraftPublic) ?? null;
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

/** Upload a Discuss image/document to the PRIVATE `discuss-media` bucket.
 *
 *  Unit 2: this used to write to the shared PUBLIC `media` bucket and persist
 *  `publicUrl` into message metadata — a world-readable, permanent URL that
 *  survived losing channel access. Now only the object PATH is persisted; the
 *  browser reads via /api/files/discuss/<messageId>/<index>, which re-checks
 *  authorization on every request. Nothing here returns a fetchable URL.
 *
 *  The object name is randomized rather than derived from the user's filename:
 *  a private bucket makes the path unguessable-by-default, and the display
 *  name is carried in metadata where it belongs. Returns a typed rejection so
 *  the composer can show WHY (localized) instead of a bare failure. */
/* Chat-grade image compression (the WeChat approach). A Retina screenshot or
   phone photo is 4–15MB of pixels nobody needs at chat size; on a slow uplink
   that is minutes of "Uploading…" — and past the 4.5MB Vercel body cap it then
   DIES after the wait. Downscale to ≤2000px and re-encode JPEG q0.82 before
   the bytes ever leave the machine. GIFs are exempt (re-encoding kills the
   animation); small images pass through untouched; any decode/encode failure
   falls back to the original file — compression must never LOSE a photo. */
const IMAGE_COMPRESS_THRESHOLD = 900 * 1024;
const IMAGE_MAX_DIM = 2000;

async function compressImageForChat(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  if (file.size <= IMAGE_COMPRESS_THRESHOLD) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, IMAGE_MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    if (!blob || blob.size === 0 || blob.size >= file.size) return file;
    const name = file.name.replace(/\.(png|webp|jpeg|jpg)$/i, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export async function uploadDiscussAttachment(
  file: File,
): Promise<
  | { ok: true; attachment: DiscussAttachment }
  | { ok: false; reason: "type" | "size" | "transport" | "failed" }
> {
  /* Client-side preflight: UX only — /api/storage/upload enforces the same
     policy authoritatively, and the bucket refuses violations a third time. */
  const verdict = checkDiscussUpload("discuss-media", file);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };

  /* Shrink images BEFORE the transport check — a 10MB screenshot becomes a
     few hundred KB and sails through. */
  const payload = await compressImageForChat(file);

  /* Refuse over-transport files NOW, not after minutes of doomed uploading:
     the platform kills request bodies past ~4.5MB, so waiting can only end
     in the silent failure users reported. */
  if (payload.size > DISCUSS_TRANSPORT_MAX_BYTES) {
    return { ok: false, reason: "transport" };
  }

  const ext = (payload.name.match(/\.([a-zA-Z0-9]{1,8})$/)?.[1] ?? "bin").toLowerCase();
  const filePath = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const result = await uploadToStorage("discuss-media", filePath, payload, {
    cacheControl: "3600",
    contentType: payload.type || "application/octet-stream",
  });
  if (!result.ok) {
    // Never log the filename or path — this is conversation-linkable.
    console.error("[Discuss] Attachment upload failed");
    return { ok: false, reason: "failed" };
  }
  return {
    ok: true,
    attachment: {
      name: payload.name,
      file_path: result.data.path,
      size: payload.size,
      type: payload.type || "application/octet-stream",
    },
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

/** A subscription that held this long is a recovery; shorter is a flap. */
export const REJOIN_STABLE_MS = 30_000;
/* A RECOVERY STEPS THE BACKOFF DOWN; IT DOES NOT ZERO IT (owner's session,
   2026-09-18 17:29-17:31 UTC, `discuss:account`). The flap rule below was
   already doing its job — the ramp climbed cleanly — and then one
   subscription held for 34.1s, one tick over REJOIN_STABLE_MS, and the whole
   session's history was thrown away:

     hold 34.1s  →  retry = 0  →  +0.9s +0.9s +2.1s +4.2s +8.3s +13.9s +36.3s
     hold 34.1s  →  retry = 0  →  +0.9s +0.9s +2.1s +4.2s +8.3s +13.9s …

   Fourteen socket opens in ten minutes on a link that has never once held a
   subscription for a full minute. On this owner's link — mainland China, no
   VPN, the case the whole product is built for — a 34-second subscription is
   not a healthy channel, it is a slightly longer flap, and treating it as
   proof of a good link puts the storm straight back.

   Halving keeps both truths: a channel that recovers IS rewarded, and gets
   back to a short retry after a couple of genuine recoveries; a channel that
   flaps at 34s forever settles near the 60s cap instead of sprinting back to
   0.9s. Pure, so the ladder is pinned by the suite without a browser. */
export function retryAfterRecovery(retry: number): number {
  return retry > 1 ? Math.floor(retry / 2) : 0;
}
/* The least time between two honoured nudges on one topic. `online` and
   `visibilitychange` arrive in bursts on a phone changing network, and each
   nudge is a teardown plus a fresh socket. */
export const KICK_FLOOR_MS = 3_000;
/** Capped exponential backoff with jitter: 1 s, 2 s, 4 s … 60 s. Pure
 *  apart from the jitter, which the suite pins by range. */
export function rejoinDelayMs(retry: number, random: () => number = Math.random): number {
  return Math.min(60_000, 1_000 * 2 ** Math.min(retry, 6)) * (0.8 + random() * 0.4);
}

function subscribeBroadcast(topic: string, onPing: (p: PingPayload) => void): () => void {
  let entry = broadcastSubs.get(topic);
  if (!entry) {
    const created = {
      channel: null as unknown as ReturnType<typeof supabase.channel>,
      listeners: new Set<(p: PingPayload) => void>(),
      t0: performance.now(),
      joins: 0,
      status: "PENDING",
      /* Self-healing state. Production telemetry showed a channel that hit
         CHANNEL_ERROR / TIMED_OUT / CLOSED simply STAYED dead — nothing ever
         re-subscribed, so isChannelStreamHealthy() reported unhealthy for the
         rest of the session and Discuss limped along on the slow fallback
         poll ("messages not received immediately"). Every terminal status now
         schedules a rejoin with capped exponential backoff; `online` +
         tab-visible events (below) trigger an immediate retry. */
      retry: 0,
      rejoinTimer: null as number | null,
      /* When the current channel reached SUBSCRIBED, for the flap rule
         below. A join that dies within seconds is not a recovery. */
      subscribedAt: 0,
      /* When the last online/visible nudge was honoured (see kick). */
      lastKickAt: 0,
      /* What opened the CURRENT channel, reported on rt.reconnect. A ramp
         read from metrics alone cannot tell a scheduled rejoin from a nudge,
         and the difference is the whole diagnosis: the same 250ms gap is
         normal for a nudge and impossible for a timer (the floor is 800ms).
         One tag turns the next round of this into a reading. */
      via: "init" as "init" | "timer" | "kick",
    };

    const scope = topic.split(":").slice(0, 2).join(":");

    const join = (via: "init" | "timer" | "kick") => {
      created.via = via;
      const channel = supabase.channel(topic);
      created.channel = channel;
      channel
        .on("broadcast", { event: "changed" }, (msg) => {
          const payload = (msg?.payload ?? undefined) as PingPayload;
          for (const l of created.listeners) {
            try { l(payload); } catch { /* one bad listener must not break the rest */ }
          }
        })
        .subscribe((status) => {
          /* A rejoin replaces created.channel; the OLD channel's teardown
             fires a final CLOSED that must not clobber the fresh channel's
             state or schedule spurious extra rejoins. */
          if (created.channel !== channel) return;
          created.status = status;
          try {
            if (status === "SUBSCRIBED") {
              created.joins += 1;
              created.subscribedAt = performance.now();
              /* THE FLAP. A channel that subscribes and is closed within a
                 second, over and over, reset its backoff on every SUBSCRIBED
                 and rejoined ~once a second for hours (production, 2026-09-07:
                 the same page reported CLOSED → reconnect every 0.8 s from
                 15:00 to 17:33, then died mid-call). A subscription counts as
                 recovered — and the backoff resets — only once it has held
                 for STABLE_MS; a shorter life keeps climbing the backoff. */
              if (created.retry > 0 && created.joins > 1) {
                /* reset deferred: see the CLOSED branch */
              } else {
                created.retry = 0;
              }
              if (created.joins === 1) perfRecord("rt.join_ms", performance.now() - created.t0, { scope });
              else perfEvent("rt.reconnect", { scope, via: created.via, r: created.retry });
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              /* How long this subscription lived, to the second. Without it a
                 drop is a bare event and the flap rule below cannot be
                 checked against what actually happened on the link. */
              const heldMs = created.subscribedAt > 0 ? performance.now() - created.subscribedAt : 0;
              perfEvent("rt.status", { s: status, scope, held: Math.round(heldMs / 1000) });
              /* Held long enough to count as a real recovery? Then the wait
                 steps back down. Otherwise it flapped, and the next wait is
                 longer than the last. Either way the link's history survives:
                 see retryAfterRecovery. */
              if (heldMs >= REJOIN_STABLE_MS) created.retry = retryAfterRecovery(created.retry);
              created.subscribedAt = 0;
            }
          } catch { /* metrics never break realtime */ }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            scheduleRejoin();
          }
        });
    };

    const scheduleRejoin = () => {
      if (created.listeners.size === 0) return; // real teardown, not a drop
      if (created.rejoinTimer != null) return;  // one pending rejoin at a time
      /* NOT WHILE HIDDEN. A background page that rejoins on a timer keeps a
         socket storm going for hours; the visible/online nudge (kickAll)
         retries the moment the page is back. */
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      /* NOT UNDER A LIVE CALL EITHER (2026-09-08). The metrics of a call
         that died with the phone's network show this channel closing and
         rejoining every second or two for the whole call — a socket storm
         on the same flaky link the call's own socket was fighting for. A
         call is the one thing on the page that matters while it is up; the
         channel rejoins the moment it ends (the kx-call-ended nudge). */
      if (typeof document !== "undefined" && document.querySelector("[data-kx-call-active='1']")) return;
      const delay = rejoinDelayMs(created.retry);
      created.retry += 1;
      created.rejoinTimer = window.setTimeout(() => {
        created.rejoinTimer = null;
        if (created.listeners.size === 0) return;
        try { supabase.removeChannel(created.channel); } catch { /* ignore */ }
        join("timer");
      }, delay);
    };

    /* Expose an immediate-retry hook for the global online/visible nudges.

       IT DOES NOT RESET THE BACKOFF, and that line is the whole point
       (owner, 2026-09-18, from his own session's metrics). The flap rule
       above — a join counts as recovered only once it has held for
       REJOIN_STABLE_MS — was written for the 2026-09-07 storm and it works;
       this hook was quietly undoing it. `created.retry = 0` sat here, and
       `kick` fires on `online`, on `kx-call-ended`, and on every return to
       the tab. On a phone that is changing networks and switching apps —
       which is the whole of this owner's usage — the ramp never got to
       climb. His metrics, one session, reconnects on `discuss:account`:

         +0.8s  +1.8s  +4.4s  +7.1s  +15.9s   … then back to +0.8s
         +1.1s  +1.7s  +4.2s  +7.0s  +13.3s  +27.5s  … and again

       That is the backoff working correctly and being zeroed, over and
       over, for the length of the session — a socket storm on the same
       flaky link his voice call is fighting for, which is exactly what the
       call guard in scheduleRejoin already exists to prevent.

       A nudge means "do not sit out the wait", not "forget what this link
       has been doing". It still rejoins AT ONCE; what the next failure
       waits is still owned by the one rule that has evidence behind it —
       a subscription that held. */
    (created as unknown as { kick: () => void }).kick = () => {
      if (created.status === "SUBSCRIBED" || created.listeners.size === 0) return;
      /* AND NOT TEN TIMES IN A SECOND. `online` and `visibilitychange` both
         fire in bursts when a phone changes network; each nudge tears the
         channel down and opens a new one, so a burst of events was itself a
         burst of sockets. One nudge per KICK_FLOOR_MS; the rest fall through
         to the scheduled rejoin, which is still pending. */
      const now = Date.now();
      if (now - created.lastKickAt < KICK_FLOOR_MS) return;
      created.lastKickAt = now;
      if (created.rejoinTimer != null) { window.clearTimeout(created.rejoinTimer); created.rejoinTimer = null; }
      try { supabase.removeChannel(created.channel); } catch { /* ignore */ }
      join("kick");
    };

    join("init");
    broadcastSubs.set(topic, created);
    /* The gauge belongs where the SET actually changes — here and in the
       teardown below. It used to fire inside the status callback as well,
       once per status change, where the size cannot have moved: on this
       owner's link that was half of every perf beacon spent re-sending a
       constant, on the one link in the product that cannot spare it. */
    perfRecord("rt.channels", broadcastSubs.size);
    entry = created;
  }
  entry.listeners.add(onPing);
  return () => {
    const e = broadcastSubs.get(topic);
    if (!e) return;
    e.listeners.delete(onPing);
    if (e.listeners.size === 0) {
      const timer = (e as unknown as { rejoinTimer?: number | null }).rejoinTimer;
      if (timer != null) window.clearTimeout(timer);
      try { supabase.removeChannel(e.channel); } catch { /* ignore */ }
      broadcastSubs.delete(topic);
      perfRecord("rt.channels", broadcastSubs.size);
    }
  };
}

/* Network back / tab woken up → any non-SUBSCRIBED topic retries immediately
   instead of waiting out its backoff. Registered once per session. */
if (typeof window !== "undefined") {
  const kickAll = () => {
    for (const e of broadcastSubs.values()) {
      try { (e as unknown as { kick?: () => void }).kick?.(); } catch { /* ignore */ }
    }
  };
  window.addEventListener("online", kickAll);
  window.addEventListener("kx-call-ended", kickAll);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") kickAll();
  });
}

/** The signed-in account id, resolved once from the session bootstrap and
 *  cached — needed to pick the caller's `discuss:account:<id>` ping topic.
 *  Reads through the SHARED me-bootstrap store (warm-start + coalesced):
 *  this used to be its own raw /api/me/bootstrap fetch, which meant every
 *  screen paid a duplicate bootstrap round-trip just for Discuss's ping
 *  topic (SYS-2, measured ×2-4 per screen). */
let cachedAccountId: string | null = null;
let accountIdPromise: Promise<string | null> | null = null;
async function getMyAccountId(): Promise<string | null> {
  if (cachedAccountId) return cachedAccountId;
  if (!accountIdPromise) {
    accountIdPromise = import("@/lib/me-bootstrap")
      .then((m) => m.getMeBootstrap())
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

/* ── First-party SSE delivery stream ────────────────────────────────────────
   Production telemetry showed the Supabase Realtime websocket NEVER connects
   for our users (mainland-China blocking of *.supabase.co) — zero SUBSCRIBED
   events, all delivery via the slow fallback poll. This stream replaces that
   dependency: an authenticated EventSource on OUR origin
   (/api/discuss/stream) that carries FULL message rows, so the receiver
   renders instantly with no refetch. The broadcast path above remains a
   supplement where it works; consumers dedupe by message id. */
let sseSource: EventSource | null = null;
let sseHealthy = false;
let sseRefs = 0;
const sseListeners = new Set<(m: DiscussMessageWithAuthor) => void>();
/** `meta` = a sidebar-level change (rename, archive, membership) rather than
 *  an edit / reaction / pin inside the conversation. */
export type DiscussStreamChange = { meta?: boolean };
const sseChangeListeners = new Set<(channelId: string, info: DiscussStreamChange) => void>();
/* Newest created_at seen on the stream — sent as ?since= on reconnect so a
   dropped connection (routine on the China link) replays the gap instead of
   losing it. The server bounds the replay; frames are deduped below. */
let sseLastSeenAt: string | null = null;
/* Ids already dispatched. The server re-reads a small overlap window and a
   reconnect replays from `since`, so the same row can legitimately arrive
   twice — every listener sees it once. Bounded FIFO. */
const sseSeen = new Set<string>();
const SSE_SEEN_MAX = 2000;
/* Consecutive failed connects → backoff (2s, 4s … 60s). Reset on `hello`. */
let sseErrors = 0;

export function isDiscussStreamHealthy(): boolean {
  return sseHealthy;
}

function sseOpen() {
  if (sseSource || typeof window === "undefined") return;
  const url = sseLastSeenAt
    ? `/api/discuss/stream?since=${encodeURIComponent(sseLastSeenAt)}`
    : "/api/discuss/stream";
  const src = new EventSource(url);
  sseSource = src;
  src.addEventListener("hello", () => {
    sseHealthy = true;
    sseErrors = 0;
    try { perfEvent("sse.open"); } catch { /* metrics never break delivery */ }
  });
  src.addEventListener("msg", (ev) => {
    try {
      const m = JSON.parse((ev as MessageEvent).data) as DiscussMessageWithAuthor;
      if (!m?.id) return;
      if (m.created_at && (!sseLastSeenAt || m.created_at > sseLastSeenAt)) sseLastSeenAt = m.created_at;
      if (sseSeen.has(m.id)) return;
      sseSeen.add(m.id);
      if (sseSeen.size > SSE_SEEN_MAX) {
        const first = sseSeen.values().next().value;
        if (first) sseSeen.delete(first);
      }
      if (m.channel_id) lastPingAt.set(m.channel_id, performance.now());
      for (const l of sseListeners) {
        try { l(m); } catch { /* one bad listener must not break the rest */ }
      }
      try { perfRecord("sse.msg", 1); } catch { /* ignore */ }
    } catch { /* malformed frame — ignore */ }
  });
  src.addEventListener("chg", (ev) => {
    /* An edit / delete / reaction / pin touched this channel. Marks it
       dirty for the reconcile loop and tells listeners to refresh. */
    try {
      const { channelId, meta } = JSON.parse((ev as MessageEvent).data) as { channelId?: string; meta?: boolean };
      if (!channelId) return;
      lastPingAt.set(channelId, performance.now());
      const info: DiscussStreamChange = { meta: meta === true };
      for (const l of sseChangeListeners) {
        try { l(channelId, info); } catch { /* isolate listeners */ }
      }
    } catch { /* malformed frame — ignore */ }
  });
  src.addEventListener("bye", () => {
    /* Server rotated the stream before maxDuration — reconnect immediately
       instead of waiting for the error/retry cycle. */
    sseClose();
    if (sseRefs > 0 && document.visibilityState !== "hidden") sseOpen();
  });
  src.onerror = () => {
    /* Reopen ourselves (not EventSource's built-in retry) so the new
       connection carries the CURRENT ?since= cursor. Mark unhealthy so the
       fallback poll bridges the gap. */
    sseHealthy = false;
    try { perfEvent("sse.err"); } catch { /* ignore */ }
    sseClose();
    sseErrors += 1;
    const delay = Math.min(60_000, 2000 * 2 ** Math.min(sseErrors - 1, 5));
    window.setTimeout(() => {
      if (sseRefs > 0 && !sseSource && document.visibilityState !== "hidden") sseOpen();
    }, delay);
  };
}

function sseClose() {
  sseHealthy = false;
  try { sseSource?.close(); } catch { /* ignore */ }
  sseSource = null;
}

/* Cost + battery: hold the stream only while a Discuss surface is mounted AND
   the tab is visible. Hidden tabs are covered by web-push; on return the
   stream reopens with ?since= and replays what was missed. */
if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (sseRefs === 0) return;
    if (document.visibilityState === "hidden") sseClose();
    else if (!sseSource) sseOpen();
  });
}

function sseRetain(): () => void {
  sseRefs += 1;
  if (typeof document === "undefined" || document.visibilityState !== "hidden") sseOpen();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    sseRefs = Math.max(0, sseRefs - 1);
    if (sseRefs === 0) sseClose();
  };
}

/** Connect to the first-party message stream. Returns an unsubscribe fn.
 *  Ref-counted: many consumers share ONE EventSource. `onChange` (optional)
 *  fires with a channel id when an edit / delete / reaction / pin touched
 *  that channel — no row data, the consumer refetches what it shows. */
export function connectDiscussStream(
  onMessage: (m: DiscussMessageWithAuthor) => void,
  onChange?: (channelId: string, info: DiscussStreamChange) => void,
): () => void {
  sseListeners.add(onMessage);
  if (onChange) sseChangeListeners.add(onChange);
  const release = sseRetain();
  return () => {
    sseListeners.delete(onMessage);
    if (onChange) sseChangeListeners.delete(onChange);
    release();
  };
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
  let again = false; // a ping landed while a refresh was in flight
  let primed = false;
  let latest = "1970-01-01T00:00:00+00:00"; // max created_at seen — incremental cursor
  const seen = new Set<string>();

  const refresh = async () => {
    if (closed) return;
    if (refreshing) {
      /* CRITICAL: never swallow a ping. A second message arriving while the
         first one's fetch is in flight used to be dropped here, so the
         receiver didn't see it until the slow reconcile poll. Queue exactly
         one trailing re-run instead. */
      again = true;
      return;
    }
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
      if (again && !closed) {
        again = false;
        void refresh();
      }
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

/** Messages the current user has starred, most-recent first — optionally
 *  only those in one channel (the details pane's "Starred" list). */
export async function fetchStarredMessages(
  accountId: string,
  channelId?: string,
): Promise<DiscussMessageWithAuthor[]> {
  void accountId; // identity comes from the session server-side
  const { data } = await discussState<DiscussMessageWithAuthor[]>(
    "starred",
    channelId ? { channelId } : {},
  );
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

/* ─── WeChat-style per-user conversation state (sidebar right-click menu) ─── */

/** Pin ("Sticky on top") or unpin a conversation for the current user.
 *  Pinned chats float to the top of their group in the sidebar. */
export async function setChannelPinned(
  channelId: string,
  pinned: boolean,
): Promise<boolean> {
  return (await discussMutate("setChannelPinned", { channelId, pinned })).ok;
}

/** Hide ("remove from list") a conversation for the current user. It stays
 *  hidden until a newer message arrives, then re-surfaces — like WeChat. */
export async function hideChannel(channelId: string): Promise<boolean> {
  return (await discussMutate("setChannelHidden", { channelId })).ok;
}

/** Manually mark a conversation as unread (shows a dot even with no new
 *  messages). Cleared automatically the next time the user opens it. */
export async function markChannelUnread(channelId: string): Promise<boolean> {
  return (await discussMutate("markChannelUnread", { channelId })).ok;
}

/** Delete a conversation from the current user's list only. History is
 *  preserved server-side; the chat re-surfaces if they re-open the DM. */
export async function deleteConversation(channelId: string): Promise<boolean> {
  return (await discussMutate("deleteConversation", { channelId })).ok;
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
  /* Voice notes go to the PRIVATE 'discuss-voice' bucket.
     Unit 2: playback no longer requests a signed URL. A signed URL is better
     than a public one but still bakes authorization into a bearer string that
     stays valid until it expires — a user removed from the channel keeps
     access for the lifetime of the token, and the URL is copyable. Playback
     now goes through /api/files/discuss/<messageId>/<index>, which re-checks
     membership on every request (and every Range request). Nothing fetchable
     is persisted: no url, no bucket-qualified link, no token. */
  const mime =
    input.blob.type && input.blob.type.length > 0 ? input.blob.type : "audio/webm";
  const verdict = checkDiscussUpload("discuss-voice", { size: input.blob.size, type: mime });
  if (!verdict.ok) {
    console.error("[Discuss] Voice rejected by policy:", verdict.reason);
    return null;
  }
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
    /* No `url` at all — not even empty-string. The resolver locates the object
       from bucket+path; the player addresses it by (messageId, index). */
    bucket: "discuss-voice",
    path: result.data.path,
    type: mime,
    size: input.blob.size,
    duration_ms: input.durationMs,
    waveform: input.waveform,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   Phase E — Customer chat
   ═══════════════════════════════════════════════════════════════════════ */

/** Find-or-create the customer-chat channel bound to a CRM contact.
 *  Server-side (POST /api/discuss/mutate → createCustomerChannel): the
 *  creator is the session account, the channel is stamped with the caller's
 *  tenant, and the contact must belong to that tenant. Returns the channel
 *  id, or null on failure. */
export async function findOrCreateCustomerChannel(input: {
  contactId: string;
  additionalMemberIds?: string[];
}): Promise<string | null> {
  const res = await discussMutate<string>("createCustomerChannel", {
    contactId: input.contactId,
    memberIds: input.additionalMemberIds ?? [],
  });
  return res.ok ? (res.data ?? null) : null;
}

/** Customer contacts for the "Start customer chat" picker, via the
 *  tenant-scoped /api/contacts/search-customers endpoint (contacts are not
 *  readable with the browser's anon key). Empty query → the first customers
 *  alphabetically so the picker has something to show. */
export async function searchContactsForChat(
  query: string,
  limit = 12,
): Promise<DiscussLinkedContact[]> {
  const qs = new URLSearchParams({ q: query.trim(), limit: String(limit) });
  try {
    const res = await fetch(`/api/contacts/search-customers?${qs.toString()}`, {
      credentials: "same-origin",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      rows?: Array<{ id: string; displayName: string; companyName: string; email: string; phone: string }>;
    };
    return (json.rows ?? []).map((r) => ({
      id: r.id,
      display_name: r.displayName || r.companyName || r.email || "—",
      full_name: null,
      company: r.companyName || null,
      email: r.email || null,
      phone: r.phone || null,
      avatar_url: null,
      contact_type: "customer",
    }));
  } catch {
    return [];
  }
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
    name_alt: string | null;
    avatar_url: string | null;
    role_name: string | null;
  }>
> {
  /* accounts/people/roles are service-role-only (P0 lockdown); the server
     route resolves the tenant-scoped list. There is no anon fallback — it
     could only ever return nothing (or, if RLS regressed, too much). */
  try {
    const res = await fetch("/api/discuss/recipients", { credentials: "include" });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      recipients?: Array<{
        id: string;
        username: string;
        full_name: string | null;
        name_alt: string | null;
        avatar_url: string | null;
        role_name: string | null;
      }>;
    };
    return Array.isArray(json.recipients) ? json.recipients : [];
  } catch {
    return [];
  }
}
