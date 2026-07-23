import "server-only";

/* ---------------------------------------------------------------------------
   sensitive-columns — ONE registry of column-level secrets, shared by the
   REST APIs and the AI agent so both enforce the exact same field policy.

   Access model (mirrors src/lib/server/ai-agent/permissions.ts):
     · Super Admin              → sees everything.
     · Role with can_view_private → sees "private" columns (costs, margins,
       credit, HR compensation). This is the Roles & Permissions lever for
       "Finance Manager sees cost price, Sales doesn't".
     · Everyone else            → private columns are STRIPPED server-side
       before the response is serialised. UI hiding is cosmetic; this is
       the real gate.
     · A few columns are super-admin-only regardless of can_view_private
       (login/account secrets are never sent to anyone).

   Keep lists exhaustive and conservative: when unsure, add the column.
   --------------------------------------------------------------------------- */

import type { ServerAuthContext } from "./auth";

/** Cheap, no-DB check — ServerAuthContext already carries the role's flag. */
export function canViewPrivate(auth: ServerAuthContext): boolean {
  return auth.is_super_admin || auth.can_view_private === true;
}

/* ── koleex_employees — compensation / banking / legal identity ──
   Visible only to can_view_private (HR / management) or SA. */
export const EMPLOYEE_PRIVATE_COLUMNS: readonly string[] = [
  "initial_salary",
  "salary_currency",
  "bank_name",
  "bank_account_holder",
  "bank_account_number",
  "bank_iban",
  "bank_swift",
  "bank_currency",
  "insurance_provider",
  "insurance_policy_number",
  "insurance_class",
  "insurance_expiry_date",
  "social_security_number",
  "tax_id",
  "identification_id",
  "passport_number",
  "visa_number",
  "visa_expiry_date",
  /* Scans of the same documents. The number is private, so the image of the
     document carrying it cannot be less so. */
  "national_id_doc_url",
  "passport_doc_url",
  "visa_doc_url",
];

/* ── contacts (customers / suppliers) — commercial & credit terms ──
   Anyone with the Customers/Suppliers module can browse the directory;
   the credit/pricing relationship with Koleex stays private. */
export const CONTACT_PRIVATE_COLUMNS: readonly string[] = [
  "payment_terms",
  "credit_limit",
  "outstanding_balance",
  "overdue_balance",
  "total_revenue",
  "days_sales_outstanding",
  "credit_rating_internal",
  "credit_rating_external",
  "credit_limit_approved_by",
  "credit_limit_approved_date",
  "credit_insurance_covered",
  "credit_insurance_provider",
  "credit_insurance_coverage",
  "max_discount_allowed",
  "commission_rate",
  "special_pricing_agreement",
  "contract_pricing_expiry",
];

/* ── accounts — NEVER serialised to any caller, any level. The account
   row is joined into employee/customer profiles for display; these
   columns must not leave the server even for the Super Admin (the UI
   has no use for them and responses get logged/cached). ── */
export const ACCOUNT_SECRET_COLUMNS: readonly string[] = [
  "password_hash",
  "password_algo",
  "password_rehash_required",
  "internal_notes",
];

/** Remove `cols` from a row. Null-safe, non-mutating. */
export function stripColumns<T extends Record<string, unknown>>(
  row: T | null | undefined,
  cols: readonly string[],
): T | null {
  if (!row) return row ?? null;
  const clone = { ...row } as Record<string, unknown>;
  for (const c of cols) delete clone[c];
  return clone as T;
}

/** Remove `cols` from every row in a list. */
export function stripColumnsFromList<T extends Record<string, unknown>>(
  rows: readonly T[] | null | undefined,
  cols: readonly string[],
): T[] {
  if (!rows) return [];
  return rows.map((r) => stripColumns(r, cols) as T);
}

/** Strip employee-private columns unless the caller may view private data. */
export function sanitizeEmployeeRow<T extends Record<string, unknown>>(
  auth: ServerAuthContext,
  row: T | null | undefined,
): T | null {
  return canViewPrivate(auth) ? (row ?? null) : stripColumns(row, EMPLOYEE_PRIVATE_COLUMNS);
}

/** Strip contact commercial/credit columns unless can_view_private. */
export function sanitizeContactRow<T extends Record<string, unknown>>(
  auth: ServerAuthContext,
  row: T | null | undefined,
): T | null {
  return canViewPrivate(auth) ? (row ?? null) : stripColumns(row, CONTACT_PRIVATE_COLUMNS);
}

export function sanitizeContactRows<T extends Record<string, unknown>>(
  auth: ServerAuthContext,
  rows: readonly T[] | null | undefined,
): T[] {
  if (!rows) return [];
  return canViewPrivate(auth) ? [...rows] : stripColumnsFromList(rows, CONTACT_PRIVATE_COLUMNS);
}

/** Account rows: secrets are stripped for EVERYONE, including SA. */
export function sanitizeAccountRow<T extends Record<string, unknown>>(
  row: T | null | undefined,
): T | null {
  return stripColumns(row, ACCOUNT_SECRET_COLUMNS);
}

/* ── quotations.doc (jsonb) — the editor embeds supplier costs + pricing
   automation inside the document payload. Doc-level and per-line keys are
   editor-gutter-only ("never printed") but the API used to ship them to any
   Quotations viewer. Strip on read; on write by a non-private editor, merge
   the EXISTING row's cost keys back in so their save can't wipe cost data
   they never saw. ── */

export const QUOTATION_DOC_PRIVATE_KEYS: readonly string[] = [
  "standTablePrice",       // shared stand & table supplier cost
  "fxRate",                // RMB→quote-currency rate used by cost math
  "defaultPricingMethod",  // margin/fixed automation default
  "defaultPricingValue",
];

export const QUOTATION_ITEM_PRIVATE_KEYS: readonly string[] = [
  "costHead",   // supplier cost of the machine head
  "costMode",
  "sellMethod", // margin-% / fixed markup automation per line
  "sellValue",
];

type QuotationDocLike = Record<string, unknown> & { items?: unknown };

/** Remove cost/pricing-automation keys from a quotation doc unless the
 *  caller may view private data. Non-mutating; null-safe. */
export function sanitizeQuotationDoc<T extends QuotationDocLike>(
  auth: ServerAuthContext,
  doc: T | null | undefined,
): T | null {
  if (!doc || typeof doc !== "object") return doc ?? null;
  if (canViewPrivate(auth)) return doc;
  const out = { ...doc } as QuotationDocLike;
  for (const k of QUOTATION_DOC_PRIVATE_KEYS) delete out[k];
  if (Array.isArray(out.items)) {
    out.items = (out.items as Record<string, unknown>[]).map((it) => {
      if (!it || typeof it !== "object") return it;
      const clean = { ...it };
      for (const k of QUOTATION_ITEM_PRIVATE_KEYS) delete clean[k];
      return clean;
    });
  }
  return out as T;
}

/** For SAVES by a non-private editor: re-attach cost keys from the existing
 *  doc so a stripped payload can't erase them. Doc-level keys copy straight
 *  across; line keys match by (model, description) — falling back to the
 *  same index when the model matches — so ordinary edits keep every line's
 *  cost. (A non-private editor who fully rewrites a line loses its cost,
 *  which is correct: they never saw it and can't vouch for it.) */
export function preserveQuotationDocCosts<T extends QuotationDocLike>(
  auth: ServerAuthContext,
  incoming: T,
  existing: QuotationDocLike | null | undefined,
): T {
  if (canViewPrivate(auth)) return incoming;
  if (!incoming || typeof incoming !== "object") return incoming;

  const out = { ...incoming } as QuotationDocLike;

  // Never trust incoming cost keys from a caller who can't see them.
  for (const k of QUOTATION_DOC_PRIVATE_KEYS) delete out[k];

  if (existing && typeof existing === "object") {
    for (const k of QUOTATION_DOC_PRIVATE_KEYS) {
      if (existing[k] !== undefined) out[k] = existing[k];
    }
  }

  const exItems: Record<string, unknown>[] = Array.isArray(existing?.items)
    ? (existing!.items as Record<string, unknown>[])
    : [];
  if (Array.isArray(out.items)) {
    // Queue existing lines by identity so duplicates pair off in order.
    const pool = new Map<string, Record<string, unknown>[]>();
    for (const it of exItems) {
      if (!it || typeof it !== "object") continue;
      const key = `${String(it.model ?? "")}|${String(it.description ?? "")}`;
      const q = pool.get(key) ?? [];
      q.push(it);
      pool.set(key, q);
    }
    out.items = (out.items as Record<string, unknown>[]).map((it, i) => {
      if (!it || typeof it !== "object") return it;
      const clean = { ...it };
      for (const k of QUOTATION_ITEM_PRIVATE_KEYS) delete clean[k];
      const key = `${String(it.model ?? "")}|${String(it.description ?? "")}`;
      const q = pool.get(key);
      let src: Record<string, unknown> | undefined = q?.shift();
      if (!src) {
        const sameIndex = exItems[i];
        if (sameIndex && String(sameIndex.model ?? "") === String(it.model ?? "")) src = sameIndex;
      }
      if (src) {
        for (const k of QUOTATION_ITEM_PRIVATE_KEYS) {
          if (src[k] !== undefined) clean[k] = src[k];
        }
      }
      return clean;
    });
  }
  return out as T;
}
