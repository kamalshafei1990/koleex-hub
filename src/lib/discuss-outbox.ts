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
     · Only UPLOADED attachments are kept (they carry a file_path the server
       can resolve). Anything else — a blob that never left the browser — is
       dropped and the entry says so (`attachmentsDropped`), so the bubble can
       ask the user to add it again. No blob / object URL is ever stored.
     · An entry leaves the outbox when the server has its client_msg_id (the
       refresh replacement in mergeServerPage / reconcile), when the user
       deletes it, when the server refuses it for good, or after 7 days.
   --------------------------------------------------------------------------- */

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
  if (live.length !== all.length) writeRaw(accountId, live);
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

/** Record (or refresh) a failed send. Returns the stored entry. */
export function putDiscussOutbox(
  accountId: string,
  entry: Omit<DiscussOutboxEntry, "savedAt" | "attachmentsDropped"> & { savedAt?: number },
): DiscussOutboxEntry | null {
  if (typeof window === "undefined" || !accountId) return null;
  const { metadata, dropped } = durableMetadata(entry.metadata);
  const media = Array.isArray(entry.display.metadata?.media) ? entry.display.metadata.media : [];
  const stored: DiscussOutboxEntry = {
    ...entry,
    metadata,
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
  return stored;
}

/** Forget entries by client_msg_id (sent, refused or deleted). */
export function removeDiscussOutbox(accountId: string, clientMsgIds: Iterable<string>): void {
  if (typeof window === "undefined" || !accountId) return;
  const drop = new Set(clientMsgIds);
  if (drop.size === 0) return;
  const all = readDiscussOutbox(accountId);
  const next = all.filter((e) => !drop.has(e.clientMsgId));
  if (next.length !== all.length) writeRaw(accountId, next);
}

/** The optimistic bubble to put back on screen for an entry. */
export function outboxBubble(entry: DiscussOutboxEntry): DiscussMessageWithAuthor {
  return {
    ...entry.display,
    id: `temp_${entry.clientMsgId}`,
    channel_id: entry.channelId,
    client_msg_id: entry.clientMsgId,
    reactions: [],
  };
}
