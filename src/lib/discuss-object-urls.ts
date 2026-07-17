/* ---------------------------------------------------------------------------
   discuss-object-urls — the ONE owner of sender-local preview object: URLs.
   (Discuss Stabilization, Unit 2 — Run A completion)

   WHY THIS EXISTS
   While a message is still pending it has no canonical id, so there is nothing
   for /api/files/discuss/<id>/<index> to authorize — the sender's own bytes are
   the only thing that can be shown. An object: URL is the right tool, but it is
   a LEAK and a MEMORY BUG waiting to happen:
     · it points at a Blob held alive until revoked (unbounded tab memory);
     · it is meaningless to anyone else, so shipping it to a recipient renders
       a broken image while implying the file was delivered.

   OWNERSHIP MODEL — one key owns its URLs:
       clientMsgId (or optimistic message id)  →  Set<objectURL>
   Nothing else may call URL.createObjectURL / revokeObjectURL for Discuss.
   Scattering revoke() across components is how you get both halves of the
   classic pair of bugs: a URL revoked while still rendering (broken preview)
   and a URL never revoked at all (leak). Centralizing makes both testable.

   REVOKE POINTS (all funnel through release/releaseAll):
       reconciled onto canonical row · discarded · conversation switch ·
       unmount · logout · account switch
   Deliberately NOT revoked while a pending message is still unresolved —
   a failed send keeps its preview so Unit 3 can offer retry/discard. Releasing
   it early would leave the user staring at a broken bubble they cannot retry.

   Double-revoke is safe: the Set is consulted first and the key deleted before
   revoking, so a second call is a no-op rather than a DOMException.
   --------------------------------------------------------------------------- */

/** key (clientMsgId / optimistic id) → canonical media index → object URL.
 *  Indexed by media index so a bubble can look up the preview for the exact
 *  slot it is rendering, matching the canonical index model. */
const owned = new Map<string, Map<number, string>>();

/**
 * Create a preview URL for a sender-local File/Blob and bind it to `key`.
 * Returns null when the environment has no URL.createObjectURL (SSR), so
 * callers must treat a preview as optional rather than assume a string.
 */
export function createPreviewUrl(key: string, index: number, file: Blob): string | null {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return null;
  const url = URL.createObjectURL(file);
  const slots = owned.get(key) ?? new Map<number, string>();
  /* Replacing an existing slot must revoke the old URL, or re-picking a file
     for the same slot silently leaks the previous Blob. */
  const prev = slots.get(index);
  if (prev) {
    try { URL.revokeObjectURL(prev); } catch { /* already gone */ }
  }
  slots.set(index, url);
  owned.set(key, slots);
  return url;
}

/** The index → object URL map owned by `key`. Empty object when none, so
 *  callers can index it directly without a null check. */
export function previewUrlsFor(key: string | null | undefined): Record<number, string> {
  if (!key) return {};
  const slots = owned.get(key);
  if (!slots) return {};
  const out: Record<number, string> = {};
  for (const [i, url] of slots) out[i] = url;
  return out;
}

/**
 * Release every object URL owned by `key`. Idempotent: the key is removed
 * BEFORE revoking, so a concurrent or repeated call finds nothing to do.
 * Call on reconcile, discard, unmount, conversation switch, logout, account
 * switch — anywhere the pending message stops being displayed.
 */
export function releasePreviewUrls(key: string): void {
  const slots = owned.get(key);
  if (!slots) return;
  owned.delete(key);
  for (const url of slots.values()) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* already revoked / not an object URL — nothing to do. */
    }
  }
}

/**
 * Release EVERY tracked object URL. Use for logout, account switch, and
 * unmount of the Discuss app: on those transitions no pending message may
 * survive, so keeping a Blob alive would leak one user's bytes across a
 * session boundary.
 */
export function releaseAllPreviewUrls(): void {
  for (const key of Array.from(owned.keys())) releasePreviewUrls(key);
}

/**
 * Transfer ownership of every URL from `fromKey` to `toKey` WITHOUT revoking.
 *
 * Previews are created while composing — before a send exists — so they are
 * owned by a composer draft key. At send time the message gains its
 * clientMsgId, which is the key every later lifecycle event (reconcile,
 * discard) uses. Re-keying rather than recreating keeps the exact same URLs
 * alive, so the bubble does not flicker as it transitions from composing to
 * pending. Revoking + recreating here would blank the preview at the worst
 * moment: the instant the user hits send.
 */
export function rekeyPreviewUrls(fromKey: string, toKey: string): void {
  if (fromKey === toKey) return;
  const slots = owned.get(fromKey);
  if (!slots) return;
  owned.delete(fromKey);
  const target = owned.get(toKey);
  if (target) {
    for (const [i, url] of slots) target.set(i, url);
  } else {
    owned.set(toKey, slots);
  }
}

/** How many keys currently own URLs. Test/diagnostic only. */
export function trackedPreviewKeyCount(): number {
  return owned.size;
}

/**
 * True when `value` is a local object URL. Used to assert that such a URL
 * never reaches an API payload — an object: URL in a request body means we
 * are about to persist something meaningless to every other user.
 */
export function isObjectUrl(value: unknown): boolean {
  return typeof value === "string" && value.startsWith("blob:");
}
