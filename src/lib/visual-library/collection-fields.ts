import "server-only";

/* ---------------------------------------------------------------------------
   Collection field governance — whitelist + validate controlled vocab
   (collection_type, approval_status, role). Shared by create/edit routes.
   --------------------------------------------------------------------------- */

import { COLLECTION_TYPES, COLLECTION_STATES, COLLECTION_ROLES } from "./types";

export const COLLECTION_TYPE_SET = new Set<string>(COLLECTION_TYPES);
export const COLLECTION_STATE_SET = new Set<string>(COLLECTION_STATES);
export const COLLECTION_ROLE_SET = new Set<string>(COLLECTION_ROLES);

const TEXT_FIELDS = new Set<string>(["code", "name", "description", "category", "style_type", "visibility", "slug"]);

export function slugify(s: string): string {
  return (s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "collection";
}

/** Build a whitelisted, type-coerced patch for a collection. */
export function buildCollectionPatch(body: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (TEXT_FIELDS.has(k)) {
      const t = typeof v === "string" ? v.trim() : "";
      row[k] = t || null;
    } else if (k === "collection_type") {
      if (typeof v === "string" && v) row[k] = v;
    } else if (k === "approval_status") {
      if (typeof v === "string" && v) row[k] = v;
    } else if (k === "icon_asset_id" || k === "cover_asset_id") {
      row[k] = typeof v === "string" && v ? v : null;
    } else if (k === "usage_context") {
      row[k] = v && typeof v === "object" ? v : {};
    }
  }
  return row;
}

export function validateCollectionPatch(row: Record<string, unknown>): string | null {
  if (row.collection_type != null && !COLLECTION_TYPE_SET.has(String(row.collection_type))) return "Invalid collection_type";
  if (row.approval_status != null && !COLLECTION_STATE_SET.has(String(row.approval_status))) return "Invalid approval_status";
  if (row.name != null && String(row.name).length > 160) return "name too long";
  return null;
}

export function validRole(v: unknown): boolean {
  return typeof v === "string" && COLLECTION_ROLE_SET.has(v);
}
