/* ---------------------------------------------------------------------------
   supplier-upload-policy — ONE definition of what a supplier evidence asset
   may be, shared by the uploader and the enforcing route.

   WHY THIS FILE EXISTS. Adding a document to a supplier reported a bare
   "save failed" for every sensitive document, and the reason was invisible
   because THREE independent ceilings sit on that one path, none of which the
   screen knew about:

     1. TRANSPORT — the file travels through /api/storage/upload, a Vercel
        function whose request-body hard cap is 4.5MB. A scanned contract is
        routinely larger; it uploaded for a while and was then killed by the
        platform, with no message that names a size.
     2. BUCKET MIME — sensitive assets are routed to the private
        `finance-documents` bucket, whose allowed_mime_types is PDF + images.
        A .docx contract — the single most common contract format — is
        refused at the object store with a 415 the screen rendered as
        "save failed".
     3. BUCKET SIZE — that bucket caps objects at 20MB.

   The non-sensitive path (public `media` bucket, any type, 500MB) hid this:
   photos and catalogs always worked, so the failure looked random rather
   than exactly correlated with document sensitivity.

   Deliberately NOT server-only, following the Discuss precedent: the modal
   imports it to PREFLIGHT and to build the `accept` filter, the upload route
   imports it to ENFORCE. Same constants both sides, so the browser can never
   advertise something the object store would reject — that drift is precisely
   how an opaque "save failed" is produced.

   ⚠️ MIRROR, DON'T INVENT. SUPPLIER_PRIVATE_MIME and the byte limits mirror
   the live bucket configuration. If the bucket is ever widened, widen it here
   in the same change or the preflight will refuse files the store accepts.
   --------------------------------------------------------------------------- */

/** Exactly the `finance-documents` bucket's allowed_mime_types. */
export const SUPPLIER_PRIVATE_MIME: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

/** 20MB — the `finance-documents` bucket's file_size_limit. */
export const SUPPLIER_PRIVATE_MAX_BYTES = 20 * 1024 * 1024;

/** 4MB — the TRANSPORT ceiling, and it applies to BOTH buckets because both
 *  travel through /api/storage/upload. Vercel's body cap is 4.5MB; refusing at
 *  4MB immediately is far kinder than a minutes-long upload the platform then
 *  kills. This is a property of the route, not of the destination. */
export const SUPPLIER_TRANSPORT_MAX_BYTES = 4 * 1024 * 1024;

/** `accept` for the file input when the chosen classification is sensitive.
 *  UX only — never the authority. */
export const SUPPLIER_PRIVATE_ACCEPT_ATTR = SUPPLIER_PRIVATE_MIME.join(",");

/** A browser may report "" or append a charset; normalize before comparing. */
function normalizeMime(type: string | null | undefined): string {
  return (type ?? "").split(";")[0].trim().toLowerCase();
}

export type SupplierUploadVerdict =
  | { ok: true }
  | { ok: false; reason: "type"; mime: string }
  | { ok: false; reason: "size"; max: number; actual: number }
  | { ok: false; reason: "transport"; max: number; actual: number };

/**
 * Validate one file against the bucket it is actually headed for. Pure and
 * isomorphic, so the modal and the upload route reach the SAME verdict.
 *
 * `isPrivate` comes from isSensitiveAsset(category, visibility) — the same
 * decision that chooses the bucket, so the two can never disagree.
 */
export function checkSupplierUpload(
  isPrivate: boolean,
  file: { size: number; type?: string | null },
): SupplierUploadVerdict {
  /* Transport is checked FIRST: it is the lowest ceiling and the one whose
     failure is least legible, so it should never be reached by accident. */
  if (file.size > SUPPLIER_TRANSPORT_MAX_BYTES) {
    return { ok: false, reason: "transport", max: SUPPLIER_TRANSPORT_MAX_BYTES, actual: file.size };
  }
  if (!isPrivate) return { ok: true };

  const mime = normalizeMime(file.type);
  if (!SUPPLIER_PRIVATE_MIME.includes(mime)) return { ok: false, reason: "type", mime };
  if (file.size > SUPPLIER_PRIVATE_MAX_BYTES) {
    return { ok: false, reason: "size", max: SUPPLIER_PRIVATE_MAX_BYTES, actual: file.size };
  }
  return { ok: true };
}

/** Human-readable megabytes for a message ("20" not "20.00"). */
export function supplierMb(bytes: number): string {
  return String(Math.round(bytes / (1024 * 1024)));
}
