import "server-only";

/* ---------------------------------------------------------------------------
   Supplier media/document field governance — shared by the register (POST)
   and edit (PATCH) routes. Whitelists editable columns, coerces types, and
   validates the controlled vocabularies (media_class, category, visibility,
   lifecycle_status, cert_type). Unknown keys are ignored. QR codes are owned
   by the /qr routes and are NOT creatable here.
   --------------------------------------------------------------------------- */

// Document/evidence categories (QR categories handled by the /qr routes).
export const MEDIA_CATEGORIES = new Set<string>([
  "certification",
  "product_catalog", "quotation", "price_list", "brochure", "presentation",
  "factory_photo", "factory_video", "production_line", "qc_photo",
  "warehouse_photo", "showroom_photo", "production_video",
  "nda", "contract", "license", "business_license", "registration", "compliance_doc",
  "sample_report", "audit_report", "inspection_report", "packing_standard",
  "product_photo", "product_video", "team_photo", "company_logo", "business_card", "other",
]);
export const MEDIA_CLASSES = new Set(["document", "image", "video", "other"]);
export const VISIBILITY_TIERS = new Set(["public", "internal", "procurement", "finance", "management"]);
export const LIFECYCLE_STATUSES = new Set([
  "active", "expired", "superseded", "revoked", "archived", "pending_review",
]);
export const CERT_TYPES = new Set(["iso", "ce", "rohs", "bsci", "sedex", "fda", "gots", "reach", "other"]);

const TEXT_FIELDS = new Set<string>([
  "title", "description", "language", "doc_number", "issuer", "cert_type",
]);
const DATE_FIELDS = new Set<string>(["issued_date", "expiry_date"]);
const BOOL_FIELDS = new Set<string>(["is_downloadable", "is_primary"]);
const ARRAY_FIELDS = new Set<string>(["markets_covered", "tags"]);

/** Build a whitelisted, type-coerced metadata patch from a request body.
 *  (Storage fields — bucket/path/url/mime/size — are set by the register
 *  route itself, not via this whitelist.) */
export function buildMediaPatch(body: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (TEXT_FIELDS.has(k)) {
      const t = typeof v === "string" ? v.trim() : "";
      row[k] = t || null;
    } else if (DATE_FIELDS.has(k)) {
      row[k] = typeof v === "string" && v.trim() ? v.trim() : null;
    } else if (BOOL_FIELDS.has(k)) {
      row[k] = v === true;
    } else if (ARRAY_FIELDS.has(k)) {
      row[k] = Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
    } else if (k === "category") {
      if (typeof v === "string" && v) row[k] = v;
    } else if (k === "media_class") {
      if (typeof v === "string" && v) row[k] = v;
    } else if (k === "visibility") {
      if (typeof v === "string" && v) row[k] = v;
    } else if (k === "lifecycle_status") {
      if (typeof v === "string" && v) row[k] = v;
    }
  }
  return row;
}

/** Validate controlled vocabularies. Returns an error string, or null if OK. */
export function validateMediaPatch(row: Record<string, unknown>): string | null {
  if (row.category != null && !MEDIA_CATEGORIES.has(String(row.category))) return "Invalid category";
  if (row.media_class != null && !MEDIA_CLASSES.has(String(row.media_class))) return "Invalid media_class";
  if (row.visibility != null && !VISIBILITY_TIERS.has(String(row.visibility))) return "Invalid visibility";
  if (row.lifecycle_status != null && !LIFECYCLE_STATUSES.has(String(row.lifecycle_status))) return "Invalid lifecycle_status";
  if (row.cert_type != null && !CERT_TYPES.has(String(row.cert_type))) return "Invalid cert_type";
  if (
    row.issued_date != null && row.expiry_date != null &&
    String(row.expiry_date) < String(row.issued_date)
  ) {
    return "expiry_date cannot be before issued_date";
  }
  return null;
}
