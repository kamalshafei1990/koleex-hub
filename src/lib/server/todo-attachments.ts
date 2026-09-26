import "server-only";

/* ---------------------------------------------------------------------------
   todo-attachments — the one definition of a task attachment's storage
   object: bucket, allowed types, size, and the exact path shape. The upload
   route writes it; the attachment route reads it back.
   --------------------------------------------------------------------------- */

export const TODO_ATTACHMENT_BUCKET = "todo-attachments";
export const TODO_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export const TODO_ATTACHMENT_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/csv": "csv",
  "text/plain": "txt",
};

const EXTS = Array.from(new Set(Object.values(TODO_ATTACHMENT_TYPES))).join("|");
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** `${tenant}/${uuid}.${ext}` under THIS tenant, and nothing else. */
export function isTodoAttachmentPath(path: string, tenantId: string): boolean {
  return new RegExp(`^${tenantId.replace(/[^0-9a-f-]/gi, "")}/${UUID}\\.(?:${EXTS})$`, "i").test(path);
}

/** The session-gated link the task stores (see /api/todos/attachment). */
export function todoAttachmentUrl(path: string): string {
  return `/api/todos/attachment?path=${encodeURIComponent(path)}`;
}

/* The declared MIME type is the browser's claim. For the binary formats the
   first bytes must agree, so an HTML or script file cannot be stored as
   "image/png". Text formats (csv, txt) have no signature. */
const SIGNATURES: Record<string, number[][]> = {
  png: [[0x89, 0x50, 0x4e, 0x47]],
  jpg: [[0xff, 0xd8, 0xff]],
  gif: [[0x47, 0x49, 0x46, 0x38]],
  webp: [[0x52, 0x49, 0x46, 0x46]],
  pdf: [[0x25, 0x50, 0x44, 0x46]],
  doc: [[0xd0, 0xcf, 0x11, 0xe0]],
  xls: [[0xd0, 0xcf, 0x11, 0xe0]],
  docx: [[0x50, 0x4b, 0x03, 0x04]],
  xlsx: [[0x50, 0x4b, 0x03, 0x04]],
};

export function contentMatchesType(ext: string, head: Uint8Array): boolean {
  const sigs = SIGNATURES[ext];
  if (!sigs) return true;
  return sigs.some((sig) => sig.every((b, i) => head[i] === b));
}

/** A display name: no path, no control characters, bounded. */
export function cleanAttachmentName(raw: unknown, fallback: string): string {
  const s = typeof raw === "string" ? raw : "";
  const base = s.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200);
  return base || fallback;
}
