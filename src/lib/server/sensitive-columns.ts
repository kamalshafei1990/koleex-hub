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
