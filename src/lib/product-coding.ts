/* ---------------------------------------------------------------------------
   product-coding — shared helpers for the 3-layer KOLEEX product identity
   (Product / Primary Model / SKU). Used by the Product Data form to
   auto-suggest a KOLEEX Primary Model from the supplier model and the
   selected subcategory's prefix.

   These helpers are pure — no React, no Supabase — so they can be tested
   in isolation and reused by background jobs later.
   --------------------------------------------------------------------------- */

export type CodingStatus = "auto_suggested" | "edited" | "approved" | "locked";

/* Brand-prefix patterns we strip when extracting a model number from a
   supplier code. The leading group must be letters; everything after the
   first separator (space, dash, slash, underscore, dot) is kept. */
const STRIP_LEADING_TOKEN = /^[A-Z]+[\s\-_/.]+(.+)$/;

/* ── normalizeKoleexCode ─────────────────────────────────────────────
   Uppercases, trims, collapses any internal whitespace, and removes any
   trailing dash. Never throws. Returns "" for falsy / empty inputs.   */
export function normalizeKoleexCode(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toString()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ── suggestPrimaryModel ─────────────────────────────────────────────
   prefix     — subcategory KOLEEX prefix (e.g. "XCS"). Already uppercase.
   supplier   — supplier's own code (e.g. "JK-7800", "JUKI DDL-8700H").

   Strategy (hybrid C from design discussion):
     1. If the supplier code starts with an alpha token followed by a
        separator AND the rest contains digits, strip that token.
        ex: "JK-7800"          → "7800"
            "ABC-1903/MQ"      → "1903/MQ"
            "JUKI DDL-8700H"   → "DDL-8700H"
     2. Else if there are digits anywhere, keep everything from the
        first digit onward.
        ex: "DDL8700"          → "8700"
     3. Else fall back to the whole supplier code.

   Returns a normalized "<PREFIX>-<EXTRACTED>" string, or "" when either
   argument is missing.                                                   */
export function suggestPrimaryModel(
  prefix: string | null | undefined,
  supplier: string | null | undefined,
): string {
  const p = (prefix ?? "").trim().toUpperCase();
  const s = (supplier ?? "").trim().toUpperCase();
  if (!p || !s) return "";

  let extracted: string | null = null;

  const strip = s.match(STRIP_LEADING_TOKEN);
  if (strip && /\d/.test(strip[1])) {
    extracted = strip[1];
  } else {
    const firstDigit = s.search(/\d/);
    extracted = firstDigit >= 0 ? s.slice(firstDigit) : s;
  }

  return normalizeKoleexCode(`${p}-${extracted}`);
}

/* ── validatePrimaryModel ────────────────────────────────────────────
   Returns { ok: true } when the code passes static rules, or
   { ok: false, reason } otherwise. Uniqueness is enforced server-side
   via the partial unique index — this just covers format + prefix.    */
export type ValidationResult =
  | { ok: true; warning?: string }
  | { ok: false; reason: string };

export function validatePrimaryModel(
  code: string | null | undefined,
  expectedPrefix?: string | null,
): ValidationResult {
  const c = (code ?? "").trim();
  if (!c) return { ok: false, reason: "Primary Model is empty." };
  if (/\s/.test(c))
    return { ok: false, reason: "Primary Model cannot contain spaces." };
  if (/^-|-$/.test(c))
    return { ok: false, reason: "Primary Model cannot start or end with a dash." };
  if (/--/.test(c))
    return { ok: false, reason: "Primary Model cannot contain double dashes." };
  if (!/^[A-Z0-9\-_/.]+$/i.test(c))
    return {
      ok: false,
      reason: "Primary Model can only use letters, digits, and - _ / .",
    };

  if (expectedPrefix) {
    const expected = expectedPrefix.trim().toUpperCase();
    const upper = c.toUpperCase();
    if (!upper.startsWith(`${expected}-`) && upper !== expected) {
      return {
        ok: true,
        warning: `This code does not match the selected subcategory prefix (${expected}).`,
      };
    }
  }
  return { ok: true };
}

/* ── nextCodingStatus ────────────────────────────────────────────────
   Drives the workflow state machine the form persists alongside the
   code. Called whenever the user edits the suggestion, hits Reset, or
   approves the value.                                                  */
export function nextCodingStatus(
  current: CodingStatus | null | undefined,
  action: "suggest" | "edit" | "reset" | "approve" | "lock",
): CodingStatus {
  if (current === "locked") return "locked"; // sticky once locked
  switch (action) {
    case "suggest":
      return current === "approved" ? "approved" : "auto_suggested";
    case "edit":
      return "edited";
    case "reset":
      return "auto_suggested";
    case "approve":
      return "approved";
    case "lock":
      return "locked";
  }
}
