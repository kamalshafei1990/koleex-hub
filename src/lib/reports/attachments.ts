/* ---------------------------------------------------------------------------
   Reports — photos and files on a report (Phase 2C, owner's pick 25 Sep 2026).

   ONE definition of what a report accepts, imported by the composer (for the
   picker's `accept` and a clear message before anything is sent) and by the
   upload route (to ENFORCE). The private `report-attachments` bucket carries
   the same MIME list (migration 20260925_reports_attachments.sql) —
   validate:reports compares the two, so the picker, the route and the store
   can never disagree ("upload failed" with no reason is how that drift shows).

   WHY THESE LIMITS
   · 4 MB a file: the TRANSPORT ceiling. Uploads travel through our own route
     (the platform caps a request body at 4.5 MB), the one path production
     proved reliable from mainland China — the browser's direct write to
     storage is the hop that fails there. Photos are made smaller on the
     phone first (a 12 MP photo becomes a few hundred KB), so the ceiling
     only ever meets a large document, and it meets it BEFORE the wait.
   · No SVG, HTML or scripts: served from our origin they could run code.
   · 20 per report: a visit report with a photo per machine, not an archive.

   Files are always delivered by /api/files/report/<id>[/thumb], which
   re-checks the report's read rule on every request (no public or signed
   link is ever handed out). Build those URLs ONLY with reportFileUrl().
   --------------------------------------------------------------------------- */

export const REPORT_ATTACHMENT_BUCKET = "report-attachments";

export const REPORT_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const REPORT_DOC_MIME = [
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
/** Everything the bucket accepts — keep in step with the migration. */
export const REPORT_ATTACHMENT_MIME: readonly string[] = [...REPORT_IMAGE_MIME, ...REPORT_DOC_MIME];

export const REPORT_ATTACHMENT_LIMITS = {
  /** A file, as it travels (after a photo is made smaller). */
  bytes: 4 * 1024 * 1024,
  /** The small preview uploaded beside a photo. */
  thumbBytes: 300 * 1024,
  perReport: 20,
  caption: 300,
  name: 180,
} as const;

/** The photo as uploaded: long edge and JPEG quality. Readable on a screen
 *  and on paper, a few hundred KB on the wire. */
export const PHOTO_MAX_EDGE = 2000;
export const PHOTO_QUALITY = 0.82;
export const THUMB_MAX_EDGE = 480;
export const THUMB_QUALITY = 0.72;

/** The picker's `accept` — UX only, the route decides. */
export const REPORT_PHOTO_ACCEPT = "image/*";
export const REPORT_FILE_ACCEPT = REPORT_ATTACHMENT_MIME.join(",");

/** A browser may report "" or "type; charset=…"; compare the bare type. */
export function normalizeMime(type: string | null | undefined): string {
  return (type ?? "").split(";")[0].trim().toLowerCase();
}

export const isImageMime = (mime: string) => (REPORT_IMAGE_MIME as readonly string[]).includes(normalizeMime(mime));

export type AttachmentVerdict =
  | { ok: true }
  | { ok: false; reason: "type"; mime: string }
  | { ok: false; reason: "size"; max: number; actual: number }
  | { ok: false; reason: "empty" };

/** The one verdict the composer and the route both reach. */
export function checkReportAttachment(file: { size: number; type?: string | null }): AttachmentVerdict {
  const mime = normalizeMime(file.type);
  if (!REPORT_ATTACHMENT_MIME.includes(mime)) return { ok: false, reason: "type", mime };
  if (!file.size) return { ok: false, reason: "empty" };
  if (file.size > REPORT_ATTACHMENT_LIMITS.bytes) return { ok: false, reason: "size", max: REPORT_ATTACHMENT_LIMITS.bytes, actual: file.size };
  return { ok: true };
}

/** Do the first bytes match the declared type? The bucket trusts the
 *  declared type, so the route checks the bytes before storing anything. */
export function sniffMatches(head: Uint8Array, mime: string): boolean {
  const m = normalizeMime(mime);
  const at = (i: number, ...b: number[]) => b.every((v, k) => head[i + k] === v);
  const ascii = (i: number, s: string) => at(i, ...Array.from(s, (c) => c.charCodeAt(0)));
  const zip = at(0, 0x50, 0x4b, 0x03, 0x04);
  const ole = at(0, 0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
  switch (m) {
    case "image/jpeg": return at(0, 0xff, 0xd8, 0xff);
    case "image/png": return at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/gif": return ascii(0, "GIF87a") || ascii(0, "GIF89a");
    case "image/webp": return ascii(0, "RIFF") && ascii(8, "WEBP");
    case "application/pdf": return ascii(0, "%PDF-");
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      return zip;
    case "application/msword":
    case "application/vnd.ms-excel":
    case "application/vnd.ms-powerpoint":
      return ole;
    case "text/plain":
    case "text/csv": {
      /* Text has no signature; a NUL byte means it is not text. */
      for (let i = 0; i < head.length; i++) if (head[i] === 0) return false;
      return true;
    }
    default: return false;
  }
}

/** The stored object's extension comes from the checked type, never from
 *  the name the author's device gave the file. */
export function extensionFor(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "application/pdf": "pdf", "text/plain": "txt", "text/csv": "csv",
    "application/msword": "doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-powerpoint": "ppt", "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  };
  return map[normalizeMime(mime)] ?? "bin";
}

/** The name as shown: no folders, no control characters, capped. */
export function cleanFileName(raw: string | null | undefined): string {
  const base = String(raw ?? "").split(/[\\/]/).pop() ?? "";
  const clean = Array.from(base).filter((ch) => { const cp = ch.codePointAt(0) ?? 0; return cp >= 0x20 && cp !== 0x7f; }).join("").trim();
  return (clean || "file").slice(0, REPORT_ATTACHMENT_LIMITS.name);
}

/** An attachment as the browser sees it. */
export interface ReportAttachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  caption: string;
  image: boolean;
  hasThumb: boolean;
}

/** The ONLY way to build an attachment's address. */
export function reportFileUrl(id: string, variant: "full" | "thumb" | "download" = "full"): string {
  const base = `/api/files/report/${encodeURIComponent(id)}`;
  if (variant === "thumb") return `${base}/thumb`;
  if (variant === "download") return `${base}?download=1`;
  return base;
}

/** "1.2 MB", "340 KB". */
export function sizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
