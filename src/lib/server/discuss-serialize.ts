import "server-only";

import { sanitizeDiscussMedia, type DiscussMediaPublic } from "./discuss-media";

/* ---------------------------------------------------------------------------
   discuss-serialize — THE only way a Discuss message row reaches the browser.
   (Discuss Stabilization, Unit 2 — Run A completion)

   THE PROBLEM
   Seven server paths returned message rows selected with `*`, so
   `metadata.attachments[].url` / `.file_path` and `metadata.voice.url` were
   shipped to every client. The UI stopped RENDERING them in Run A, but the
   payload still CONTAINED them — a public, permanent URL sitting in a JSON
   response is a leak whether or not a component reads it. Anyone with devtools,
   a proxy log, or a cached response had the object.

   THE RULE
   Media is replaced, never merely hidden. `metadata.attachments` and
   `metadata.voice` are DELETED from the client payload and re-expressed as
   `metadata.media` — display fields plus a canonical index, and nothing that
   locates an object. The browser turns (message id, index) into a URL via
   discussAttachmentUrl(); the server resolves the object.

   WHY REPLACE RATHER THAN OMIT KEYS
   A denylist ("delete .url, delete .file_path") breaks the moment someone adds
   a new storage field to the metadata shape — it fails open. This builds the
   media array from an ALLOWLIST of display fields instead, so an unknown field
   is dropped by construction. Same reason non-media metadata is copied by an
   explicit spread-then-delete of the two known media keys: everything else
   Discuss relies on (mentions, products, link_preview, and any future
   non-media key) passes through untouched, because stripping a field the UI
   needs is just as much a bug as leaking one it doesn't.
   --------------------------------------------------------------------------- */

/** The client-visible metadata: everything non-media, verbatim, plus `media`. */
export type DiscussMetadataPublic = Record<string, unknown> & {
  media: DiscussMediaPublic[];
};

/** Any DB row shape carrying `metadata`. Rows also carry joins (author,
 *  reactions, reply_preview, thread) which we must not disturb. */
type RowWithMetadata = Record<string, unknown> & { metadata?: unknown };

/**
 * Serialize ONE Discuss message row for the browser.
 *
 * - preserves every non-media field of the row (id, body, kind, author,
 *   reply_to_message_id, edited_at, deleted_at, created_at, client_msg_id,
 *   reactions, reply_preview, thread, …) exactly as given;
 * - preserves every non-media metadata key (mentions, products, link_preview…);
 * - removes `metadata.attachments` and `metadata.voice` entirely;
 * - adds `metadata.media` — the canonical, index-stable, display-only list.
 *
 * Ordering, authorship, reply state, edit state and message-kind semantics are
 * untouched by design: this function only rewrites the media projection.
 */
export function serializeDiscussMessageForClient<T extends RowWithMetadata>(
  row: T,
): Omit<T, "metadata"> & { metadata: DiscussMetadataPublic } {
  const rawMeta = row.metadata;
  const meta: Record<string, unknown> =
    rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)
      ? { ...(rawMeta as Record<string, unknown>) }
      : {};

  /* The canonical media list is derived from the RAW metadata (which still has
     the storage fields) BEFORE we strip them — same function the resolver uses,
     so indexes always agree. */
  const media = sanitizeDiscussMedia(rawMeta);

  /* Delete the raw media keys. These are the only two shapes that ever carried
     a storage location; everything else in metadata is display data. */
  delete meta.attachments;
  delete meta.voice;

  return { ...row, metadata: { ...meta, media } };
}

/** Serialize a list of rows. Order is preserved exactly. */
export function serializeDiscussMessagesForClient<T extends RowWithMetadata>(
  rows: T[],
): Array<Omit<T, "metadata"> & { metadata: DiscussMetadataPublic }> {
  return rows.map(serializeDiscussMessageForClient);
}

/* ═══════════════════════════════════════════════════════════════════════════
   DRAFTS
   ═══════════════════════════════════════════════════════════════════════════

   AUDITED STATE (verified, not assumed):
     · storage      : discuss_drafts (id, account_id, channel_id, body,
                      metadata jsonb, updated_at), UNIQUE(account_id, channel_id)
     · identity     : (account_id, channel_id) — the id is never used by any caller
     · attachments  : NONE. saveDraft() is called with body only; metadata
                      defaults to {}. Restore explicitly clears attachments
                      ("drafts currently store text only").
     · production   : 0 draft rows; 0 rows with any metadata key at all.
     · ownership    : every read/write is .eq("account_id", me); tenant follows
                      from the channel FK; ON DELETE CASCADE handles cleanup.
     · uploads      : happen at composer time and are attached to the MESSAGE,
                      never to a draft. There is no abandoned-draft object.

   THEREFORE: there is no draft media to authorize, no draft→message media
   handoff, and no draft object to garbage-collect. `state/draft` and
   `allDrafts` were returning `metadata` only because they select `*`.

   The fix is to make a draft STRUCTURALLY incapable of carrying a storage
   reference, in both directions:
     · READ  — serializeDiscussDraftForClient() emits an allowlist; metadata
               never crosses the wire.
     · WRITE — sanitizeDraftMetadataForStorage() strips media keys before
               upsert, so a crafted client cannot seed a path into a draft and
               read it back later.
   That closes the contract without inventing an opaque-reference system for a
   feature that does not exist. If draft attachments are ever built, THAT is
   when a server-owned reference + /api/files/discuss-draft/<id>/<index> is
   required — and the write guard below is where it must be relaxed.  */

/** Keys that may ever carry a storage location. Stripped from drafts on write
 *  and never emitted on read. */
const DRAFT_MEDIA_KEYS = ["attachments", "voice", "media"] as const;

/**
 * The client-safe projection of a draft. Allowlist, not denylist: a new column
 * on discuss_drafts is NOT shipped until someone adds it here deliberately.
 *
 * `media` is always emitted (empty today) so the composer has a stable shape
 * to render if draft attachments are added later.
 */
export function serializeDiscussDraftForClient<T extends RowWithMetadata & {
  channel_id?: unknown; body?: unknown; updated_at?: unknown; channel?: unknown;
}>(row: T): {
  channel_id: unknown;
  body: string;
  updated_at: unknown;
  media: DiscussMediaPublic[];
  channel?: unknown;
} {
  return {
    channel_id: row.channel_id,
    body: typeof row.body === "string" ? row.body : "",
    updated_at: row.updated_at,
    /* Derived through the SAME canonical model as messages, so if a legacy row
       somehow held media it would still be reduced to display fields — never a
       path. Empty for every row that exists today. */
    media: sanitizeDiscussMedia(row.metadata),
    /* allDrafts joins the channel for its sidebar list; pass it through. It is
       channel metadata, not storage. */
    ...(row.channel !== undefined ? { channel: row.channel } : {}),
  };
}

export function serializeDiscussDraftsForClient<T extends RowWithMetadata & {
  channel_id?: unknown; body?: unknown; updated_at?: unknown; channel?: unknown;
}>(rows: T[]) {
  return rows.map(serializeDiscussDraftForClient);
}

/**
 * Strip media keys from client-supplied draft metadata BEFORE it is persisted.
 *
 * Defence-in-depth against the read serializer: if a crafted request could
 * write `metadata.attachments[].file_path` into a draft, that path would sit
 * in our DB attributable to a user, and any future code that echoed draft
 * metadata would leak it. Refusing at the write means the data never exists.
 * Non-media draft state (a future `mentions`, say) passes through.
 */
export function sanitizeDraftMetadataForStorage(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const out = { ...(metadata as Record<string, unknown>) };
  for (const k of DRAFT_MEDIA_KEYS) delete out[k];
  return out;
}
