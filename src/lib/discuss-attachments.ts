/* ---------------------------------------------------------------------------
   discuss-attachments — the ONLY way Discuss builds an attachment URL.
   (Discuss Stabilization, Unit 2 — P0 attachment authorization)

   Before: attachments were rendered straight from `attachment.url`, a PUBLIC
   Supabase Storage URL (bucket `media` is public). Anyone who ever saw or
   copied that URL could fetch the file forever, unauthenticated, and a user
   removed from the channel kept access. There was no request-time check.

   After: every attachment is delivered by the first-party route
       /api/files/discuss/<messageId>/<index>
   which re-checks, ON EVERY REQUEST: authentication, that the message exists
   and is not deleted, and ACTIVE channel membership (`left_at IS NULL`).
   Authorization is therefore evaluated at read time, not baked into a URL.

   The URL carries ONLY the canonical message id + a numeric index. No bucket,
   no storage path, no signed token, nothing client-supplied is trusted: the
   server resolves the object itself from the message row. Losing access
   (removed from channel, message deleted, signed out) makes an old URL stop
   working immediately.

   Do NOT construct attachment URLs anywhere else, and do NOT fall back to
   `attachment.url` — that fallback is exactly the hole this closes. Guarded by
   scripts/validate-discuss-attachments.mts.
   --------------------------------------------------------------------------- */

/** True when `id` is a canonical server message id (a real UUID), i.e. NOT an
    optimistic `temp_…` id. A pending message has no server row yet, so the
    protected route cannot resolve it. */
export function isCanonicalMessageId(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * The canonical index of a message's VOICE note.
 *
 * MUST mirror discussMediaList() in src/lib/server/discuss-media.ts, which is
 * the authority: attachments occupy 0..n-1 in stored order, and voice is
 * appended at index n. So the voice index is exactly the attachment count —
 * NOT a hardcoded 0. Hardcoding 0 is correct only while a message has no
 * attachments; on a message carrying both it would silently address the first
 * attachment instead of the audio.
 *
 * If the two ever disagree the resolver returns the wrong object or a 404, so
 * validate:discuss-attachments asserts both sides derive it the same way.
 */
export function discussVoiceIndex(metadata: unknown): number {
  const a = (metadata as { attachments?: unknown } | null | undefined)?.attachments;
  return Array.isArray(a) ? a.length : 0;
}

/**
 * Build the first-party URL for one attachment of one message.
 *
 * Returns `null` — never a public Supabase URL — when the message has no
 * canonical id yet (optimistic/pending) or the index is not a valid slot.
 * Callers must handle `null` by showing a local preview (sender-only) or a
 * non-interactive placeholder; they must NOT substitute `attachment.url`.
 *
 * @param messageId canonical server message id (UUID)
 * @param index     0-based index into `metadata.attachments`
 * @param opts.download force a download response instead of inline rendering
 */
export function discussAttachmentUrl(
  messageId: string | null | undefined,
  index: number,
  opts?: { download?: boolean },
): string | null {
  if (!isCanonicalMessageId(messageId)) return null;
  if (!Number.isInteger(index) || index < 0 || index > 50) return null;
  const base = `/api/files/discuss/${messageId}/${index}`;
  return opts?.download ? `${base}?download=1` : base;
}
