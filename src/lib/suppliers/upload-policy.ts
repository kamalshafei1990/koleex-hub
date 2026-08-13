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
        `finance-documents` bucket, whose allowed_mime_types was PDF + images.
        A .docx contract — the single most common contract format — was
        refused at the object store with a 415 the screen rendered as
        "save failed". The bucket has since been widened (see below), but the
        ceiling itself remains and must stay mirrored here.
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

/** Exactly the `finance-documents` bucket's allowed_mime_types.
 *
 *  The office formats were added 2026-08-13 (owner-approved) because the
 *  bucket previously took PDF and images only, while the categories routed to
 *  it — contract, NDA, audit report, licence — arrive as .docx or .xlsx more
 *  often than as PDF. Refusing the commonest contract format was not a policy,
 *  it was the default nobody revisited.
 *
 *  ⚠️ HTML, SVG and scripts stay OUT deliberately, and this is not an
 *  oversight to "complete" later: a document served from our own origin can
 *  run script in it. Office files are downloaded, never rendered by us, so
 *  they carry no such power. Verified after widening: .docx and .xlsx upload,
 *  text/html is still refused with 415. */
export const SUPPLIER_PRIVATE_MIME: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
];

/** 20MB — the `finance-documents` bucket's file_size_limit. */
export const SUPPLIER_PRIVATE_MAX_BYTES = 20 * 1024 * 1024;

/** 500MB — the public `media` bucket's file_size_limit.
 *
 *  THE TRANSPORT CEILING IS GONE. A 4MB limit used to sit here because every
 *  upload crossed /api/storage/upload, a serverless function whose request
 *  body the platform hard-caps at 4.5MB. uploadToStorage() now routes anything
 *  near that cap DIRECT to Supabase Storage via a signed URL, so the file
 *  never crosses a function at all. What remains are the buckets' own limits —
 *  real policy, not an accident of the plumbing. Do not reintroduce a
 *  transport-shaped number here. */
export const SUPPLIER_PUBLIC_MAX_BYTES = 500 * 1024 * 1024;

/** `accept` for the file input when the chosen classification is sensitive.
 *  UX only — never the authority. */
export const SUPPLIER_PRIVATE_ACCEPT_ATTR = SUPPLIER_PRIVATE_MIME.join(",");

/** A browser may report "" or append a charset; normalize before comparing. */
function normalizeMime(type: string | null | undefined): string {
  return (type ?? "").split(";")[0].trim().toLowerCase();
}

/* Extension → MIME, used ONLY when the browser reports nothing usable.
   Windows without an Office file association reports "" for .docx, and some
   clients send application/octet-stream — either way a perfectly valid
   contract would be refused for its "type" while the user is looking at a
   file named contract.docx. The extension is the user's own evidence of
   intent; falling back to it is honest, and the object store still has the
   final say. */
const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  heic: "image/heic", heif: "image/heif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain", csv: "text/csv",
};

/**
 * The MIME to both validate and UPLOAD with. Never trust an empty or generic
 * type when the filename says otherwise — and always send this as the upload's
 * contentType, or the store receives octet-stream and refuses the very file
 * the preflight just approved.
 */
export function resolveUploadMime(fileName: string, reported: string | null | undefined): string {
  const mime = normalizeMime(reported);
  if (mime && mime !== "application/octet-stream") return mime;
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  return EXT_MIME[ext] ?? mime;
}

export type SupplierUploadVerdict =
  | { ok: true }
  | { ok: false; reason: "type"; mime: string }
  | { ok: false; reason: "size"; max: number; actual: number };

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
  /* One size ceiling, and it is the DESTINATION BUCKET's — not a single
     number for both, which would either refuse legitimate public media or
     promise more than the private bucket accepts. */
  if (!isPrivate) {
    return file.size > SUPPLIER_PUBLIC_MAX_BYTES
      ? { ok: false, reason: "size", max: SUPPLIER_PUBLIC_MAX_BYTES, actual: file.size }
      : { ok: true };
  }

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
