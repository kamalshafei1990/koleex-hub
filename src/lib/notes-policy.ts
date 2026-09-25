/* ---------------------------------------------------------------------------
   notes-policy — ONE definition of what the Notes app accepts.

   Deliberately NOT server-only and NOT "use client": the editor imports it
   for its upload preflight and the API routes import it to ENFORCE. Same
   constants on both sides so the browser never advertises something the
   server would reject (the discuss-upload-policy doctrine).
   --------------------------------------------------------------------------- */

/** Private Supabase Storage bucket for images pasted/uploaded into notes.
 *  Created by supabase/migrations/20260925_notes_audit.sql. Objects live at
 *  `<tenant_id>/<note_id>/<uuid>.<ext>` and are only ever served through
 *  GET /api/notes/[id]/images/[name], which re-checks note access. */
export const NOTES_BUCKET = "notes-media";

/** Images the notes bucket accepts. SVG is absent by design — an SVG served
 *  from our origin can run script. Mirrors the bucket's allowed_mime_types. */
export const NOTES_IMAGE_MIME: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const NOTES_IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function notesImageExt(mime: string): string | null {
  return EXT_BY_MIME[mime] ?? null;
}

/** Stored object names are server-generated: `<uuid>.<ext>`. */
export const NOTES_IMAGE_NAME_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif)$/i;

export type NotesImageVerdict =
  | { ok: true }
  | { ok: false; reason: "type" | "size" };

export function checkNotesImage(file: { size: number; type: string }): NotesImageVerdict {
  if (!NOTES_IMAGE_MIME.includes(file.type)) return { ok: false, reason: "type" };
  if (file.size <= 0 || file.size > NOTES_IMAGE_MAX_BYTES) return { ok: false, reason: "size" };
  return { ok: true };
}

/** Size caps enforced by the API (and pre-applied by the client). */
export const NOTE_LIMITS = {
  title: 500,
  tags: 30,
  tag: 40,
  /** Serialized TipTap JSON. */
  bodyJsonBytes: 1_000_000,
  folderName: 120,
  folderIcon: 64,
  search: 100,
  /** Max rows returned by the list endpoint. */
  list: 200,
  /** body_plain is truncated to this many chars in list rows. */
  preview: 200,
} as const;

/** Stored values of `notes.color`: a hex tint (legacy + palette) or a paper key. */
export const NOTE_COLOR_RE = /^(#[0-9a-f]{3,8}|paper-lined|paper-grid|paper-dots|pad-yellow)$/i;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
