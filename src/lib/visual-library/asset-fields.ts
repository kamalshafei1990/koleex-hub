import "server-only";

/* ---------------------------------------------------------------------------
   Visual-asset field governance — shared by the create (POST) and edit
   (PATCH) routes. Whitelists editable columns, coerces types, and validates
   the controlled vocabularies (asset_type, style, status, approval_status).
   Unknown keys are ignored. Storage fields (bucket/path/url) are set by the
   register route, not via this whitelist.
   --------------------------------------------------------------------------- */

import { ASSET_TYPES, ASSET_STYLES, APPROVAL_STATUSES, ASSET_STATUSES } from "./types";

export const ASSET_TYPE_SET = new Set<string>(ASSET_TYPES);
export const ASSET_STYLE_SET = new Set<string>(ASSET_STYLES);
export const APPROVAL_STATUS_SET = new Set<string>(APPROVAL_STATUSES);
export const ASSET_STATUS_SET = new Set<string>(ASSET_STATUSES);

const TEXT_FIELDS = new Set<string>([
  "title", "title_cn", "title_ar", "description",
  "category", "subcategory", "source", "notes", "source_name",
]);
const ARRAY_FIELDS = new Set<string>(["tags", "usage"]);
const BOOL_FIELDS = new Set<string>(["is_active"]);

/** Build a whitelisted, type-coerced metadata patch from a request body. */
export function buildAssetPatch(body: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (TEXT_FIELDS.has(k)) {
      const t = typeof v === "string" ? v.trim() : "";
      row[k] = t || null;
    } else if (ARRAY_FIELDS.has(k)) {
      row[k] = Array.isArray(v)
        ? Array.from(new Set(v.map((x) => String(x).trim().toLowerCase()).filter(Boolean)))
        : [];
    } else if (BOOL_FIELDS.has(k)) {
      row[k] = v === true;
    } else if (k === "asset_type") {
      if (typeof v === "string" && v) row[k] = v;
    } else if (k === "style") {
      row[k] = typeof v === "string" && v ? v : null;
    } else if (k === "status") {
      if (typeof v === "string" && v) row[k] = v;
    } else if (k === "approval_status") {
      if (typeof v === "string" && v) row[k] = v;
    }
  }
  return row;
}

/** Validate controlled vocabularies. Returns an error string, or null if OK. */
export function validateAssetPatch(row: Record<string, unknown>): string | null {
  if (row.asset_type != null && !ASSET_TYPE_SET.has(String(row.asset_type))) return "Invalid asset_type";
  if (row.style != null && !ASSET_STYLE_SET.has(String(row.style))) return "Invalid style";
  if (row.status != null && !ASSET_STATUS_SET.has(String(row.status))) return "Invalid status";
  if (row.approval_status != null && !APPROVAL_STATUS_SET.has(String(row.approval_status))) return "Invalid approval_status";
  if (row.title != null && String(row.title).length > 200) return "title too long";
  if (Array.isArray(row.tags) && row.tags.length > 50) return "too many tags";
  return null;
}

/** Slugify a label into an asset-code NAME token (UPPERCASE, alnum, ≤20). */
export function codeNameToken(s: string): string {
  return (s || "asset")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase()
    .slice(0, 20) || "ASSET";
}

/** Map a KOLEEX category to its short asset-code segment. */
export const CATEGORY_CODE: Record<string, string> = {
  "Navigation": "NAV",
  "Products": "PROD",
  "ERP": "ERP",
  "Status": "STAT",
  "Logistics": "LOG",
  "AI & Analytics": "AI",
  "Brand": "BRD",
  "General": "GEN",
};
