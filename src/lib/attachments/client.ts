/* ===========================================================================
   Phase 2.1  —  Attachment client helpers.

   Browser-only utilities used by the upload UI: SHA-256 hashing for
   duplicate detection, image down-scaling for previews, and a thin
   upload orchestrator that talks to /api/finance/attachments.

   Pure functions where possible; the upload helper just wraps fetch.
   ========================================================================== */

import type {
  AttachmentCategory,
  AttachmentEntityType,
  FinanceAttachment,
} from "@/lib/finance/types";

export const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

export const ATTACHMENT_ALLOWED_MIME: ReadonlySet<string> = new Set([
  "application/pdf",
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "image/heic", "image/heif",
]);

export interface UploadRequest {
  file: File;
  entity_type: AttachmentEntityType;
  entity_id: string;
  category?: AttachmentCategory;
  notes?: string;
  is_primary?: boolean;
  tags?: string[];
}

export interface UploadResult {
  attachment: FinanceAttachment;
  duplicate: { id: string; file_name: string; uploaded_at: string } | null;
}

/* ---------------------------------------------------------------------------
   SHA-256 hex digest of a File. Uses subtle.crypto in the browser; for
   non-secure contexts we fall back to length+name so duplicate detection
   still trips on identical reuploads even without crypto.
   --------------------------------------------------------------------------- */

export async function hashFile(file: File): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return `nohash-${file.size}-${file.name.toLowerCase()}`;
  }
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

/* ---------------------------------------------------------------------------
   Validate a file *before* hitting the network.
   --------------------------------------------------------------------------- */

export interface ValidationError { code: string; message: string }

export function validateFile(file: File): ValidationError | null {
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return { code: "TOO_LARGE", message: `File exceeds ${Math.round(ATTACHMENT_MAX_BYTES / (1024 * 1024))} MB limit.` };
  }
  if (!ATTACHMENT_ALLOWED_MIME.has(file.type)) {
    return { code: "BAD_TYPE", message: `Type ${file.type || "unknown"} not supported. PDFs and image files only.` };
  }
  return null;
}

/* ---------------------------------------------------------------------------
   Upload orchestration:
     1. POST /api/finance/attachments — receive signed upload URL + row
     2. PUT  the file bytes directly to Storage
     3. resolve with the new attachment + duplicate signal (if any)

   On any network/Storage failure we surface a clean Error — the caller
   shows a toast or row-level message; this layer never throws silently.
   --------------------------------------------------------------------------- */

export async function uploadAttachment(req: UploadRequest): Promise<UploadResult> {
  const err = validateFile(req.file);
  if (err) throw new Error(err.message);

  const fileHash = await hashFile(req.file);

  /* Step 1 — create row + obtain signed upload URL. */
  const createRes = await fetch("/api/finance/attachments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entity_type: req.entity_type,
      entity_id: req.entity_id,
      file_name: req.file.name,
      file_type: req.file.type,
      file_size: req.file.size,
      file_hash: fileHash,
      category: req.category,
      notes: req.notes,
      is_primary: req.is_primary,
      tags: req.tags,
    }),
  });
  if (!createRes.ok) {
    const j = (await createRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "Failed to create attachment record");
  }
  const created = (await createRes.json()) as {
    attachment: FinanceAttachment;
    upload: { signed_url: string };
    duplicate: UploadResult["duplicate"];
  };

  /* Step 2 — PUT file bytes to signed URL. */
  const putRes = await fetch(created.upload.signed_url, {
    method: "PUT",
    headers: { "Content-Type": req.file.type, "x-upsert": "true" },
    body: req.file,
  });
  if (!putRes.ok) {
    /* Best-effort: mark the row deleted so we don't leave orphans. */
    void fetch(`/api/finance/attachments/${created.attachment.id}`, { method: "DELETE" });
    throw new Error(`Upload failed (${putRes.status})`);
  }

  return { attachment: created.attachment, duplicate: created.duplicate };
}

/* ---------------------------------------------------------------------------
   Compact byte/size formatter. Matches the "1.2 MB" feel of native OS
   file managers; avoids the "1,234,567 bytes" ERP look.
   --------------------------------------------------------------------------- */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageMime(mime: string | null | undefined): boolean {
  if (!mime) return false;
  return mime.startsWith("image/");
}

export function isPdfMime(mime: string | null | undefined): boolean {
  return mime === "application/pdf";
}
