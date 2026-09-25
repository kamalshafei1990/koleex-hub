"use client";

/* ---------------------------------------------------------------------------
   discuss-outbox — failed sends that survive a reload.

   A send that failed for a reason a retry can fix (network, timeout, 5xx)
   keeps its "Not sent · Retry · Delete" bubble. Before this file that bubble
   lived only in React state, so a reload silently lost the message. Now the
   wire payload is also written here, per account, and DiscussApp / ThreadPane
   put the bubbles back when the conversation (or thread) is opened again.

   Rules:
     · Key `kx:discuss:outbox:<accountId>` — the kx: prefix is wiped on
       sign-out by session-caches.ts, so one account's unsent text never
       survives into another account's session.
     · Every storage access is wrapped: private mode, a full quota or blocked
       site data just means the outbox is not durable, never a crash.
     · Only UPLOADED attachments go into the entry's wire metadata (they
       carry a file_path the server can resolve). A file that never finished
       uploading is listed in `pendingFiles` (display fields only) and its
       BYTES are kept in IndexedDB by discuss-outbox-files.ts; the restored
       bubble rebuilds its blob preview from there and Retry uploads it
       before sending. If the bytes cannot be kept (no IndexedDB, over a cap)
       the file is dropped and the entry says so (`attachmentsDropped`), so
       the bubble asks the user to add it again. No blob / object URL is ever
       stored in localStorage.
     · A restored bubble previews its already-uploaded media through
       /api/discuss/pending-media (outboxMediaUrlsFor) — the blob: URL of the
       page that failed is gone after a reload, and the canonical
       /api/files/discuss/<id>/<i> route needs a message row that does not
       exist yet. The URL is derived from the stored file_path on read and
       lives only in memory; it is never written into the entry.
     · The bubble also carries the entry's mentions / products (safe display
       fields the server returns too), so @mentions highlight exactly like a
       sent message's.
     · An entry leaves the outbox when the server has its client_msg_id (the
       refresh replacement in mergeServerPage / reconcile), when the user
       deletes it, when the server refuses it for good, or after 7 days —
       and its IndexedDB bytes go with it.
   --------------------------------------------------------------------------- */

import { deleteDiscussOutboxFiles } from "@/lib/discuss-outbox-files";
import type {
  DiscussMessageKind,
  DiscussMessageMetadata,
  DiscussMessageWithAuthor,
} from "@/types/supabase";

const PREFIX = "kx:discuss:outbox:";
/** Unsent messages older than this are dropped on read. */
export const DISCUSS_OUTBOX_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Hard cap per account so a long offline stretch cannot fill the quota. */
const MAX_ENTRIES = 100;

/** A file of a failed send that never finished uploading. Its bytes live in
 *  IndexedDB (discuss-outbox-files.ts) under the same clientMsgId + index. */
export type DiscussOutboxPendingFile = {
  /** Canonical media index (attachments 0..n-1, voice n). */
  index: number;
  kind: "attachment" | "voice";
  name: string;
  type: string;
  size: number;
  /** Voice only. */
  durationMs?: number;
  waveform?: number[];
};

export type DiscussOutboxEntry = {
  /** Idempotency key of the send — also the entry's identity. */
  clientMsgId: string;
  channelId: string;
  body: string;
  kind: DiscussMessageKind;
  /** WIRE metadata (mentions, products, uploaded attachments / voice). */
  metadata: DiscussMessageMetadata;
  replyToMessageId: string | null;
  /** Set when the send was made from a thread pane: the bubble belongs to
   *  that parent's thread, not to the main conversation. */
  threadParentId?: string | null;
  /** The bubble as it was drawn (client-safe `metadata.media` only). */
  display: DiscussMessageWithAuthor;
  /** Files not uploaded yet whose bytes are kept in IndexedDB. */
  pendingFiles?: DiscussOutboxPendingFile[];
  /** An attachment could not be kept (never uploaded) — it must be re-added. */
  attachmentsDropped?: boolean;
  /** ms epoch the send was first attempted. */
  savedAt: number;
};

function keyFor(accountId: string): string {
  return `${PREFIX}${accountId}`;
}

function readRaw(accountId: string): DiscussOutboxEntry[] {
  try {
    const raw = window.localStorage.getItem(keyFor(accountId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as DiscussOutboxEntry[]) : [];
  } catch {
    return [];
  }
}

function writeRaw(accountId: string, entries: DiscussOutboxEntry[]): void {
  try {
    if (entries.length === 0) window.localStorage.removeItem(keyFor(accountId));
    else window.localStorage.setItem(keyFor(accountId), JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    /* Not durable this time (quota / private mode) — the bubble still works
       for this session. */
  }
}

function isLive(e: DiscussOutboxEntry, now: number): boolean {
  return (
    !!e &&
    typeof e.clientMsgId === "string" &&
    typeof e.channelId === "string" &&
    !!e.display &&
    typeof e.savedAt === "number" &&
    now - e.savedAt < DISCUSS_OUTBOX_TTL_MS
  );
}

/** Every live entry for the account (expired ones are pruned on the way). */
export function readDiscussOutbox(accountId: string): DiscussOutboxEntry[] {
  if (typeof window === "undefined" || !accountId) return [];
  const all = readRaw(accountId);
  const now = Date.now();
  const live = all.filter((e) => isLive(e, now));
  if (live.length !== all.length) {
    writeRaw(accountId, live);
    const gone = all.filter((e) => e && !live.includes(e) && typeof e.clientMsgId === "string");
    if (gone.length > 0) void deleteDiscussOutboxFiles(accountId, gone.map((e) => e.clientMsgId));
  }
  return live;
}

/** Keep only attachments the server can resolve; strip client-only fields. */
function durableMetadata(metadata: DiscussMessageMetadata): {
  metadata: DiscussMessageMetadata;
  dropped: boolean;
} {
  const next: DiscussMessageMetadata = { ...metadata };
  let dropped = false;
  if (Array.isArray(metadata.attachments)) {
    const kept = metadata.attachments
      .filter((a) => a && typeof a.file_path === "string" && a.file_path.length > 0)
      .map((a) => ({ name: a.name, file_path: a.file_path, size: a.size, type: a.type }));
    dropped = kept.length !== metadata.attachments.length;
    if (kept.length > 0) next.attachments = kept;
    else delete next.attachments;
  }
  if (metadata.voice && !metadata.voice.path) {
    delete next.voice;
    dropped = true;
  }
  delete next.media;
  return { metadata: next, dropped };
}

/**
 * Record (or refresh) a failed send. Returns the stored entry.
 *
 * `pendingFiles` (files that never finished uploading) are kept on the entry
 * only when `filesKept` says their bytes are in IndexedDB; otherwise they are
 * dropped and the bubble asks for them again after a reload.
 */
export function putDiscussOutbox(
  accountId: string,
  entry: Omit<DiscussOutboxEntry, "savedAt" | "attachmentsDropped"> & { savedAt?: number },
  opts: { filesKept?: boolean } = {},
): DiscussOutboxEntry | null {
  if (typeof window === "undefined" || !accountId) return null;
  const durable = durableMetadata(entry.metadata);
  const { metadata } = durable;
  const pending = Array.isArray(entry.pendingFiles) ? entry.pendingFiles : [];
  const keepPending = pending.length > 0 && opts.filesKept === true;
  const dropped = durable.dropped || (pending.length > 0 && !keepPending);
  const media = Array.isArray(entry.display.metadata?.media) ? entry.display.metadata.media : [];
  const stored: DiscussOutboxEntry = {
    ...entry,
    metadata,
    pendingFiles: keepPending && !durable.dropped ? pending : undefined,
    attachmentsDropped: dropped || undefined,
    /* A dropped attachment is no longer part of the message: draw it
       without, and say so on the bubble. */
    display: {
      ...entry.display,
      metadata: { ...entry.display.metadata, media: dropped ? [] : media },
    },
    savedAt: entry.savedAt ?? Date.now(),
  };
  const rest = readDiscussOutbox(accountId).filter((e) => e.clientMsgId !== entry.clientMsgId);
  writeRaw(accountId, [...rest, stored]);
  if (!stored.pendingFiles) void deleteDiscussOutboxFiles(accountId, [entry.clientMsgId]);
  return stored;
}

/** The stored entry of one send, if it is still in the outbox. */
export function getDiscussOutboxEntry(accountId: string, clientMsgId: string): DiscussOutboxEntry | null {
  if (typeof window === "undefined" || !accountId) return null;
  return readDiscussOutbox(accountId).find((e) => e.clientMsgId === clientMsgId) ?? null;
}

/**
 * The pending files of an entry finished uploading (Retry): store the new
 * wire metadata, clear `pendingFiles` and forget the IndexedDB bytes. No-op
 * when the entry is gone (sent / deleted meanwhile).
 */
export function markDiscussOutboxUploaded(
  accountId: string,
  clientMsgId: string,
  metadata: DiscussMessageMetadata,
): void {
  const cur = getDiscussOutboxEntry(accountId, clientMsgId);
  if (!cur) {
    void deleteDiscussOutboxFiles(accountId, [clientMsgId]);
    return;
  }
  putDiscussOutbox(accountId, { ...cur, metadata, pendingFiles: undefined });
}

/** Forget the IndexedDB bytes of a send unless its entry still lists pending
 *  files (it was sent, deleted or uploaded while the bytes were written). */
export function deleteOutboxFilesIfSettled(accountId: string, clientMsgId: string): void {
  const cur = getDiscussOutboxEntry(accountId, clientMsgId);
  if (!cur || !cur.pendingFiles?.length) void deleteDiscussOutboxFiles(accountId, [clientMsgId]);
}

/**
 * The bytes of an entry's pending files could not be kept / found: drop them
 * (the bubble then asks for the file again). No-op when the entry is gone.
 */
export function dropDiscussOutboxFiles(accountId: string, clientMsgId: string): DiscussOutboxEntry | null {
  const cur = getDiscussOutboxEntry(accountId, clientMsgId);
  if (!cur) {
    void deleteDiscussOutboxFiles(accountId, [clientMsgId]);
    return null;
  }
  if (!cur.pendingFiles?.length) return cur;
  return putDiscussOutbox(accountId, cur, { filesKept: false });
}

/* ── Pending-media previews ─────────────────────────────────────────────
   clientMsgId → canonical media index → /api/discuss/pending-media URL.
   Indexes mirror discussMediaList(): attachments 0..n-1, voice at n. */
const pendingMedia = new Map<string, Record<number, string>>();

/** First-party preview URL of an uploaded-but-unsent Discuss object. */
export function discussPendingMediaUrl(channelId: string, kind: "attachment" | "voice", path: string): string {
  const q = new URLSearchParams({ c: channelId, b: kind === "voice" ? "v" : "m", p: path });
  return `/api/discuss/pending-media?${q.toString()}`;
}

function mediaUrlsOf(entry: Pick<DiscussOutboxEntry, "channelId" | "metadata">): Record<number, string> {
  const out: Record<number, string> = {};
  const atts = Array.isArray(entry.metadata.attachments) ? entry.metadata.attachments : [];
  atts.forEach((a, i) => {
    if (a && typeof a.file_path === "string" && a.file_path) {
      out[i] = discussPendingMediaUrl(entry.channelId, "attachment", a.file_path);
    }
  });
  const voicePath = entry.metadata.voice?.path;
  if (typeof voicePath === "string" && voicePath) {
    out[atts.length] = discussPendingMediaUrl(entry.channelId, "voice", voicePath);
  }
  return out;
}

/** Preview URLs (by canonical media index) of an outbox bubble's uploaded
 *  media. Empty for anything that is not an unsent outbox message. */
export function outboxMediaUrlsFor(clientMsgId: string | null | undefined): Record<number, string> {
  if (!clientMsgId) return {};
  return pendingMedia.get(clientMsgId) ?? {};
}

/** Forget entries by client_msg_id (sent, refused or deleted). */
export function removeDiscussOutbox(accountId: string, clientMsgIds: Iterable<string>): void {
  if (typeof window === "undefined" || !accountId) return;
  const drop = new Set(clientMsgIds);
  if (drop.size === 0) return;
  for (const id of drop) pendingMedia.delete(id);
  void deleteDiscussOutboxFiles(accountId, drop);
  const all = readDiscussOutbox(accountId);
  const next = all.filter((e) => !drop.has(e.clientMsgId));
  if (next.length !== all.length) writeRaw(accountId, next);
}

/** Forget every pending-media preview (sign-out / account switch). */
export function clearOutboxMediaUrls(): void {
  pendingMedia.clear();
}

/** The optimistic bubble to put back on screen for an entry. */
export function outboxBubble(entry: DiscussOutboxEntry): DiscussMessageWithAuthor {
  if (!entry.attachmentsDropped) {
    const urls = mediaUrlsOf(entry);
    if (Object.keys(urls).length > 0) pendingMedia.set(entry.clientMsgId, urls);
  }
  const shown = entry.display.metadata ?? {};
  const metadata: DiscussMessageMetadata = { ...shown };
  /* Entries saved before the bubble carried these still render them. */
  if (!Array.isArray(shown.mentions) && Array.isArray(entry.metadata.mentions)) {
    metadata.mentions = entry.metadata.mentions;
  }
  if (!Array.isArray(shown.products) && Array.isArray(entry.metadata.products)) {
    metadata.products = entry.metadata.products;
  }
  return {
    ...entry.display,
    metadata,
    id: `temp_${entry.clientMsgId}`,
    channel_id: entry.channelId,
    client_msg_id: entry.clientMsgId,
    reactions: [],
  };
}
