/* ---------------------------------------------------------------------------
   discuss-upload-policy — ONE definition of what Discuss accepts.
   (Discuss Stabilization, Unit 2 — attachment authorization)

   Deliberately NOT server-only: the composer imports it for the `accept`
   filter and the human-readable error, the upload route imports it to ENFORCE.
   Same constants both sides, so the browser can never advertise something the
   server would reject (or vice-versa) — that drift is how you get an opaque
   "upload failed" with no explanation.

   THREE layers enforce this, deliberately redundant, in increasing authority:
     1. client `accept` + preflight  → UX only. Trivially bypassed. Never trust.
     2. /api/storage/upload          → authoritative. Runs before any DB write.
     3. Supabase bucket policy       → last resort. Refuses at the object store
                                       even if a bug slips past layer 2.
   Layer 1 exists so users see a clear message instead of a failed request;
   layer 3 exists so a mistake in layer 2 is still not a breach.

   WHY THESE TYPES: the approved image/document set. Executable-in-our-origin
   types (HTML, SVG, JS) and installers are absent by design — an SVG served
   from hub.koleexgroup.com can run script in our origin, so we refuse it at
   upload rather than rely on Content-Disposition at read time.

   NOTE — these limits are NEW. Discuss previously inherited the shared `media`
   bucket's 500MB/any-MIME settings, which was never a deliberate Discuss
   policy. Production evidence at rollout: the only attachment MIME ever sent
   is image/png (largest 464KB), so no real historical upload is excluded.
   --------------------------------------------------------------------------- */

/** Images Discuss accepts. */
export const DISCUSS_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/** Documents Discuss accepts. */
export const DISCUSS_DOC_MIME = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

/** Everything the private `discuss-media` bucket accepts. Mirrors the bucket's
 *  own allowed_mime_types exactly — keep the two in step. */
export const DISCUSS_MEDIA_MIME: readonly string[] = [
  ...DISCUSS_IMAGE_MIME,
  ...DISCUSS_DOC_MIME,
];

/** Audio types the private `discuss-voice` bucket accepts. The recorder picks
 *  the codec (iOS Safari records audio/mp4, Chrome audio/webm), so this must
 *  cover every browser we support or voice notes silently fail on that device. */
export const DISCUSS_VOICE_MIME: readonly string[] = [
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
];

/** 50MB — the `discuss-media` bucket limit. */
export const DISCUSS_MEDIA_MAX_BYTES = 50 * 1024 * 1024;
/** 25MB — the pre-existing `discuss-voice` bucket limit, retained. */
export const DISCUSS_VOICE_MAX_BYTES = 25 * 1024 * 1024;

/** The <input type="file" accept="…"> value for the Discuss composer. UX only. */
export const DISCUSS_ACCEPT_ATTR = DISCUSS_MEDIA_MIME.join(",");

/** A browser may report "" or a bogus type; normalize before comparing. */
function normalizeMime(type: string | null | undefined): string {
  return (type ?? "").split(";")[0].trim().toLowerCase();
}

export type UploadRejection =
  | { ok: true }
  | { ok: false; reason: "type"; mime: string }
  | { ok: false; reason: "size"; max: number; actual: number };

/** Validate one file against a Discuss bucket's policy. Pure + isomorphic, so
 *  the composer and the upload route reach the SAME verdict. */
export function checkDiscussUpload(
  bucket: "discuss-media" | "discuss-voice",
  file: { size: number; type?: string | null },
): UploadRejection {
  const allowed = bucket === "discuss-voice" ? DISCUSS_VOICE_MIME : DISCUSS_MEDIA_MIME;
  const max = bucket === "discuss-voice" ? DISCUSS_VOICE_MAX_BYTES : DISCUSS_MEDIA_MAX_BYTES;
  const mime = normalizeMime(file.type);
  if (!allowed.includes(mime)) return { ok: false, reason: "type", mime };
  if (file.size > max) return { ok: false, reason: "size", max, actual: file.size };
  return { ok: true };
}

/** Human-readable megabytes for a message ("50" not "50.00"). */
export function mb(bytes: number): string {
  return String(Math.round(bytes / (1024 * 1024)));
}
