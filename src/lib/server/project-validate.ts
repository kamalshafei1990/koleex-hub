import "server-only";

/* project-validate — shape checks for project create/update bodies:
   enums, dates, non-negative numbers, and a manager that belongs to the
   caller's tenant. Only keys present in the body (and allowed) are
   checked and returned. */

import { supabaseServer } from "@/lib/server/supabase-server";
import { UUID_RE } from "@/lib/server/project-access";

const PROJECT_STATUSES = ["active", "on_hold", "completed", "archived"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function validateProjectFields(
  tenantId: string,
  body: Record<string, unknown>,
  allowed: readonly string[],
): Promise<{ patch: Record<string, unknown> } | { error: string }> {
  const patch: Record<string, unknown> = {};
  const has = (k: string) => allowed.includes(k) && k in body;
  if (has("name")) {
    const v = typeof body.name === "string" ? body.name.trim() : "";
    if (!v) return { error: "name required" };
    patch.name = v.slice(0, 200);
  }
  for (const k of ["code", "description", "icon"]) {
    if (!has(k)) continue;
    const v = body[k];
    if (v !== null && typeof v !== "string") return { error: `Invalid ${k}` };
    patch[k] = typeof v === "string" && v.trim() ? v.trim().slice(0, k === "description" ? 20000 : 80) : null;
  }
  if (has("color")) {
    const v = body.color;
    if (v !== null && !(typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v))) return { error: "Invalid color" };
    patch.color = v;
  }
  if (has("status")) {
    if (!PROJECT_STATUSES.includes(String(body.status))) return { error: "Invalid status" };
    patch.status = body.status;
  }
  for (const k of ["is_billable", "is_template", "is_favorite"]) {
    if (has(k)) patch[k] = body[k] === true;
  }
  for (const k of ["planned_start", "planned_end"]) {
    if (!has(k)) continue;
    const v = body[k];
    if (v === null || v === "") patch[k] = null;
    else if (typeof v === "string" && DATE_RE.test(v)) patch[k] = v;
    else return { error: `Invalid ${k}` };
  }
  for (const k of ["budget_hours", "budget_amount", "billing_rate"]) {
    if (!has(k)) continue;
    const v = body[k];
    if (v === null || v === "") { patch[k] = null; continue; }
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return { error: `Invalid ${k}` };
    patch[k] = n;
  }
  if (has("currency")) {
    const v = body.currency;
    if (v === null || v === "") patch.currency = null;
    else if (typeof v === "string" && /^[A-Za-z]{3}$/.test(v.trim())) patch.currency = v.trim().toUpperCase();
    else return { error: "Invalid currency" };
  }
  if (has("progress_pct")) {
    const n = Number(body.progress_pct);
    if (!Number.isFinite(n) || n < 0 || n > 100) return { error: "Invalid progress_pct" };
    patch.progress_pct = Math.round(n);
  }
  if (has("sort_order")) {
    const n = Number(body.sort_order);
    if (!Number.isInteger(n)) return { error: "Invalid sort_order" };
    patch.sort_order = n;
  }
  if (has("customer_id")) {
    const v = body.customer_id;
    if (v === null || v === "") patch.customer_id = null;
    else if (typeof v === "string" && UUID_RE.test(v)) patch.customer_id = v;
    else return { error: "Invalid customer" };
  }
  if (has("manager_account_id")) {
    const v = body.manager_account_id;
    if (v === null || v === "") patch.manager_account_id = null;
    else if (typeof v === "string" && UUID_RE.test(v)) {
      const { data } = await supabaseServer.from("accounts").select("id").eq("id", v).eq("tenant_id", tenantId).maybeSingle();
      if (!data) return { error: "Manager is not in this workspace" };
      patch.manager_account_id = v;
    } else return { error: "Invalid manager" };
  }
  return { patch };
}

/** Columns added by 20260926_projects_additions.sql. Until it is applied a
 *  write carrying them fails with "column not found" — strip and retry. */
export const PENDING_PROJECT_COLUMNS = ["archived_at", "currency"] as const;

/** True for Postgres/PostgREST "no such column" errors. */
export function isMissingColumn(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return (
    err.code === "42703" ||
    err.code === "PGRST204" ||
    /column .* does not exist|Could not find the .* column/i.test(err.message ?? "")
  );
}

/** Copy of `patch` without the pending (maybe-unmigrated) columns. */
export function withoutPendingColumns(patch: Record<string, unknown>): Record<string, unknown> {
  const out = { ...patch };
  for (const k of PENDING_PROJECT_COLUMNS) delete out[k];
  return out;
}
