import "server-only";

/* ---------------------------------------------------------------------------
   Supplier contact-person field governance — shared by the create (POST) and
   edit (PATCH) routes. Whitelists editable columns, coerces types, and
   validates the controlled vocabularies (role_category, preferred_channel,
   visibility_tier). Unknown keys are ignored. Pure-ish (server-only because
   it sits next to route handlers, no DB access here).
   --------------------------------------------------------------------------- */

const TEXT_FIELDS = new Set<string>([
  "full_name", "name_cn", "role", "department", "position",
  "email", "mobile", "whatsapp", "telegram", "wechat_id", "wecom_id",
  "line_id", "skype_id", "preferred_language", "timezone",
  "response_speed", "notes",
]);
const BOOL_FIELDS = new Set<string>(["is_primary", "is_decision_maker"]);
const NUM_FIELDS = new Set<string>(["reliability_score", "avg_response_hours"]);

// Mirror the DB CHECK constraints exactly.
const ROLE_CATEGORIES = new Set([
  "sales", "boss", "owner", "support", "finance",
  "logistics", "qc", "engineering", "management", "other",
]);
const RELIABILITY = new Set(["high", "medium", "low", "unknown"]);
const CHANNELS = new Set([
  "wechat", "wecom", "whatsapp", "telegram", "email", "mobile", "line", "skype",
]);
const VISIBILITY_TIERS = new Set([
  "public", "internal", "procurement", "finance", "management",
]);

/** Build a whitelisted, type-coerced patch from an arbitrary request body. */
export function buildContactPatch(body: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (TEXT_FIELDS.has(k)) {
      const t = typeof v === "string" ? v.trim() : "";
      row[k] = t || null;
    } else if (BOOL_FIELDS.has(k)) {
      row[k] = v === true;
    } else if (NUM_FIELDS.has(k)) {
      if (v === "" || v === null || v === undefined) { row[k] = null; continue; }
      const n = Number(v);
      row[k] = Number.isFinite(n) ? n : null;
    } else if (k === "role_category") {
      row[k] = typeof v === "string" && v ? v : null;
    } else if (k === "reliability") {
      row[k] = typeof v === "string" && v ? v : null;
    } else if (k === "preferred_channel") {
      row[k] = typeof v === "string" && v ? v : null;
    } else if (k === "visibility_tier") {
      if (typeof v === "string" && v) row[k] = v;
    } else if (k === "available_hours") {
      // free-form jsonb (e.g. {"text":"after 18:00 CST"} or structured)
      row[k] = v ?? null;
    }
  }
  return row;
}

/** Validate controlled vocabularies. Returns an error string, or null if OK. */
export function validateContactPatch(row: Record<string, unknown>): string | null {
  if (row.role_category != null && !ROLE_CATEGORIES.has(String(row.role_category))) {
    return "Invalid role_category";
  }
  if (row.reliability != null && !RELIABILITY.has(String(row.reliability))) {
    return "Invalid reliability";
  }
  if (row.preferred_channel != null && !CHANNELS.has(String(row.preferred_channel))) {
    return "Invalid preferred_channel";
  }
  if (row.visibility_tier != null && !VISIBILITY_TIERS.has(String(row.visibility_tier))) {
    return "Invalid visibility_tier";
  }
  if (row.reliability_score != null) {
    const n = Number(row.reliability_score);
    if (!Number.isFinite(n) || n < 0 || n > 100) return "reliability_score must be 0–100";
  }
  if (row.avg_response_hours != null) {
    const n = Number(row.avg_response_hours);
    if (!Number.isFinite(n) || n < 0) return "avg_response_hours must be ≥ 0";
  }
  return null;
}
