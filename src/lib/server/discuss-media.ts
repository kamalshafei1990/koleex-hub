import "server-only";

/* ---------------------------------------------------------------------------
   discuss-media — THE canonical server-side media model for Discuss.
   (Discuss Stabilization, Unit 2 — attachment authorization)

   Two jobs, deliberately in ONE module so the resolver and the read
   sanitizers can never disagree:
     1. INDEX   — turn a message's metadata into an ordered, index-stable list.
     2. LOCATE  — turn each item into a (bucket, path) pair the server can
                  fetch, tolerating every shape we have ever persisted.

   ── 1. THE INDEX MODEL — one ordered list, append-only ────────────────────
   `discuss_messages.metadata` carries media in two independent shapes:
       · metadata.attachments[]  — images / documents
       · metadata.voice{}        — a single voice note
   The first-party route addresses media as /api/files/discuss/<msgId>/<index>,
   so "index" needs ONE deterministic meaning across every shape — including a
   message holding both. Special-casing voice as "index 0 when there are no
   attachments" happens to work for today's rows but makes voice UNREACHABLE
   the moment a message has both, and lets index 0 mean two different objects
   depending on shape. That ambiguity is how a wrong object becomes reachable.

       index 0 .. n-1  → metadata.attachments[0 .. n-1]  (stored order)
       index n         → metadata.voice, if present
   Deterministic in all cases:
       · attachments-only : 0..n-1                        (unchanged)
       · voice-only       : attachments = [] ⇒ voice = 0  (unchanged)
       · BOTH             : voice sits AFTER attachments  (unambiguous)
       · future shapes    : appended at the end           (stable)
   Verified against production at rollout: 0 messages hold both shapes, max 1
   attachment/message, 5 voice-only, 1 attachments-only — so this model
   resolves every existing row to the SAME object as before. No data migration.

   ── 2. THE LOCATION MODEL — three persisted shapes, all server-only ───────
   Field names differ per kind, and BOTH differ across eras. Verified against
   production rather than assumed:
     · attachment (legacy + current): { url: <public media URL>, file_path }
     · voice      (legacy, 5 rows)  : { url: <public media URL>, duration_ms }
                                       …no path, no bucket — predates the
                                       private bucket existing.
     · voice      (current uploader): { url: "", bucket, path, duration_ms }
                                       …url is deliberately EMPTY; location
                                       lives in bucket+path.
   A model reading only `file_path`/`url` therefore resolves current-era voice
   to nothing (broken playback) — which is exactly why this is centralized.

   LEGACY URL TOLERANCE (server-only, deliberate): a public/signed Supabase URL
   is parsed back to (bucket, path) ONLY here. Foreign hosts and traversal are
   rejected. This is why the browser never needs — and never receives — a
   direct URL: the server can always recover the object itself. This module is
   the ONLY place allowed to read those raw location fields.
   --------------------------------------------------------------------------- */

/* Read lazily, NOT at module load: a top-level capture binds whatever the env
   held the first time this module was imported, which depends on import order
   and leaves legacy URL parsing silently failing closed if the env was not yet
   populated. Cheap to read per call. */
function supabaseHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

/** Buckets Discuss media may EVER live in — both private.
 *
 *  The public `media` bucket used to be listed here as a read-only tolerance
 *  for six pre-Unit-2 objects. Run C migrated those six to the private buckets
 *  and deleted the public originals (measured: 6694 → 6688 objects, exactly six
 *  removed), so the tolerance has no rows left to serve and is gone (Unit 3).
 *
 *  This constant is the single gate. Because fromStorageUrl() checks it too, a
 *  legacy `url` pointing into `media` is now rejected rather than fetched —
 *  Discuss cannot serve a byte from a public bucket by any path.
 *
 *  `media` itself is untouched and still public: Products, Catalogs, Visual
 *  Library, Notes, Suppliers, Employees and Quotations all live there. Unit 3
 *  removes Discuss's claim on it, not the bucket. */
export const DISCUSS_BUCKETS = ["discuss-media", "discuss-voice"] as const;
export type DiscussBucket = (typeof DISCUSS_BUCKETS)[number];

function isDiscussBucket(b: string): b is DiscussBucket {
  return (DISCUSS_BUCKETS as readonly string[]).includes(b);
}

/** Reject traversal / injection shapes even though paths come from our own DB.
 *  Defence-in-depth: a bad path must never reach the storage fetch. */
function unsafePath(p: string): boolean {
  if (!p || p.length > 1024) return true;
  const lowered = p.toLowerCase();
  return (
    p.startsWith("/") ||
    p.includes("..") ||
    p.includes("\\") ||
    p.includes("//") ||
    lowered.includes("%2e") ||
    lowered.includes("%2f") ||
    lowered.includes("%5c")
  );
}

/** Parse one of OUR OWN storage URLs (public or signed) back to bucket+path.
 *  Anything else — foreign host, unknown shape, non-Discuss bucket — is
 *  rejected. Server-only; the browser is never given such a URL to begin with. */
function fromStorageUrl(raw: string): { bucket: DiscussBucket; path: string } | null {
  try {
    const u = new URL(raw);
    const host = supabaseHost();
    // Fail closed when the host is unknown: better a 404 than fetching a URL
    // we cannot prove is ours.
    if (!host || u.hostname !== host) return null;
    // /storage/v1/object/public/<bucket>/<path>  (legacy public delivery)
    // /storage/v1/object/sign/<bucket>/<path>?token=…  (legacy signed delivery)
    const m = /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/.exec(u.pathname);
    if (!m) return null;
    const bucket = decodeURIComponent(m[1]);
    const path = decodeURIComponent(m[2]);
    if (!isDiscussBucket(bucket) || unsafePath(path)) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}

/** Resolve a persisted location (any era, any kind) to a fetchable pair.
 *  Order matters: an explicit bucket+path is authoritative and is preferred
 *  over `url`, because the current voice uploader writes BOTH (url:"" + path)
 *  and a legacy row writes only `url`. */
function locate(
  bucket: unknown,
  path: unknown,
  url: unknown,
  fallbackBucket: DiscussBucket,
): { bucket: DiscussBucket; path: string } | null {
  if (typeof path === "string" && path.trim()) {
    let p = path.trim();
    const b = typeof bucket === "string" && isDiscussBucket(bucket) ? bucket : fallbackBucket;
    // Tolerate a bucket-prefixed path ("media/foo.png") from older writers.
    if (p.startsWith(`${b}/`)) p = p.slice(b.length + 1);
    if (!unsafePath(p)) return { bucket: b, path: p };
  }
  if (typeof url === "string" && url.trim()) return fromStorageUrl(url.trim());
  return null;
}

/** One resolvable media item. `bucket`/`path` are SERVER-ONLY and must never
 *  be serialized to a client — use sanitizeDiscussMedia() for that. */
export interface DiscussMediaItem {
  name: string;
  type: string;
  size: number;
  /** "voice" for the voice note, else a normal attachment. */
  kind: "attachment" | "voice";
  /** @internal server-only — resolved storage bucket. */
  bucket: DiscussBucket;
  /** @internal server-only — bucket-relative object path. */
  path: string;
  /** Voice duration in milliseconds, when known. */
  duration_ms?: number;
  /** Voice waveform bars. Display-only: derived from the audio at record time,
   *  carries no storage location, so it is safe to hand the browser. */
  waveform?: number[];
}

type RawAttachment = { name?: unknown; url?: unknown; file_path?: unknown; size?: unknown; type?: unknown };
type RawVoice = {
  url?: unknown; bucket?: unknown; path?: unknown;
  duration_ms?: unknown; size?: unknown; type?: unknown; waveform?: unknown;
};

/**
 * Flatten a message's metadata into THE canonical, index-stable media list.
 * Order is the contract: attachments first (stored order), voice last.
 *
 * An item whose location cannot be resolved is SKIPPED — but skipping would
 * shift every later index, so unresolvable attachments are kept as a
 * placeholder with an empty path. The resolver treats an empty path as a
 * miss (uniform 404) while the index of every OTHER item stays stable.
 * Malformed metadata yields an empty list — never a throw, never a wrong item.
 */
export function discussMediaList(metadata: unknown): DiscussMediaItem[] {
  const meta = (metadata ?? {}) as { attachments?: unknown; voice?: unknown };
  const out: DiscussMediaItem[] = [];

  if (Array.isArray(meta.attachments)) {
    for (const raw of meta.attachments as RawAttachment[]) {
      if (!raw || typeof raw !== "object") continue;
      // Attachments historically live in public `media`; new ones in
      // private `discuss-media`. The persisted value decides — never a guess.
      const loc = locate(undefined, raw.file_path, raw.url, "discuss-media");
      out.push({
        name: typeof raw.name === "string" && raw.name ? raw.name : "attachment",
        type: typeof raw.type === "string" ? raw.type : "application/octet-stream",
        size: typeof raw.size === "number" ? raw.size : 0,
        kind: "attachment",
        bucket: loc?.bucket ?? "discuss-media",
        path: loc?.path ?? "",
      });
    }
  }

  const v = meta.voice;
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const raw = v as RawVoice;
    const loc = locate(raw.bucket, raw.path, raw.url, "discuss-voice");
    out.push({
      name: "voice-note",
      type: typeof raw.type === "string" ? raw.type : "audio/webm",
      size: typeof raw.size === "number" ? raw.size : 0,
      kind: "voice",
      bucket: loc?.bucket ?? "discuss-voice",
      path: loc?.path ?? "",
      duration_ms: typeof raw.duration_ms === "number" ? raw.duration_ms : undefined,
      waveform: Array.isArray(raw.waveform)
        ? (raw.waveform as unknown[]).filter((n): n is number => typeof n === "number")
        : undefined,
    });
  }

  return out;
}

/** The client-safe shape of one media item: display metadata + the canonical
 *  index ONLY. */
export interface DiscussMediaPublic {
  /** Canonical index — the ONLY handle the browser gets. Combined with the
   *  message id it addresses the object via the authorized first-party route. */
  index: number;
  name: string;
  type: string;
  size: number;
  kind: "attachment" | "voice";
  duration_ms?: number;
  /** Display-only waveform bars for the voice bubble. */
  waveform?: number[];
}

/**
 * The client-safe projection of the media list. Strips bucket / path / url /
 * host / token so a read API can never hand the browser a directly-fetchable
 * reference. The browser turns (messageId, index) into a URL via
 * discussAttachmentUrl(). Every message-returning path MUST use this.
 */
export function sanitizeDiscussMedia(metadata: unknown): DiscussMediaPublic[] {
  return discussMediaList(metadata).map((m, index) => ({
    index,
    name: m.name,
    type: m.type,
    size: m.size,
    kind: m.kind,
    ...(m.duration_ms !== undefined ? { duration_ms: m.duration_ms } : {}),
    ...(m.waveform !== undefined ? { waveform: m.waveform } : {}),
  }));
}
