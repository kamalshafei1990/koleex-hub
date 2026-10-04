/* ---------------------------------------------------------------------------
   marketing/capture — CEO Brand's quick capture, as the server and the
   screens share it (owner, 30/09/2026): the CEO speaks for up to two minutes
   (or types a few words) and adds pictures; Koleex AI drafts the post in his
   own voice for each of his platforms, in the language he spoke; the draft
   waits for his assistant, who is told, and the recording stays with it.
   --------------------------------------------------------------------------- */

/** A recording's longest length. */
export const CAPTURE_SECONDS_MAX = 120;
/** A recording's largest size (the private bucket's own limit). */
export const CAPTURE_AUDIO_BYTES_MAX = 10 * 1024 * 1024;
/** What may be typed instead of (or with) the recording. */
export const CAPTURE_TYPED_MAX = 2000;
/** The recording types a browser makes, and the few others the bucket takes. */
export const CAPTURE_AUDIO_MIMES = ["audio/webm", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/mpeg", "audio/ogg", "audio/wav"] as const;

/** marketing_posts.capture. */
export interface CaptureRecord {
  /** What was said, as Koleex AI read it ("" when it could not). */
  transcript: string;
  /** The language it was said in (ISO 639-1), when known. */
  lang: string | null;
  /** What was typed with it, if anything. */
  typed: string | null;
  /** The recording in the private bucket (never a public link). */
  audio_path: string | null;
  audio_mime: string | null;
  seconds: number | null;
  /** Koleex AI drafted the words (false: the draft holds what was said as is). */
  drafted: boolean;
  captured_by: string;
  captured_at: string;
}

/** The bare type of a recording ("audio/webm;codecs=opus" → "audio/webm"),
 *  or null when the bucket does not take it. */
export function captureMime(raw: string | null | undefined): (typeof CAPTURE_AUDIO_MIMES)[number] | null {
  const t = (raw ?? "").split(";")[0].trim().toLowerCase();
  return (CAPTURE_AUDIO_MIMES as readonly string[]).includes(t) ? (t as (typeof CAPTURE_AUDIO_MIMES)[number]) : null;
}
