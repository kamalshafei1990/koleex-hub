import "server-only";

/* ===========================================================================
   Phase R.1 — Shared report-builder helpers
   Used by every builder: date helpers, tenant/customer/supplier
   resolution, money formatting, and the report-no generator. Keeping
   them here means individual builders stay focused on report-specific
   logic and never duplicate "load tenant name" / "format a date".
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";

/** Right-padded ISO yyyy-mm-dd from any parse-able date. */
export function isoDate(value: string | number | Date): string {
  return new Date(value).toISOString().slice(0, 10);
}

/** Default window if a builder needs one but the caller didn't pass
 *  dates — last 90 days through today. Statements use this so a
 *  blank "Generate Statement" click produces something useful. */
export function defaultPeriod(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 90);
  return { from: isoDate(from), to: isoDate(to) };
}

export interface ResolvedTenant {
  id: string;
  name: string;
  currency: string;
}

/** Resolve the tenant header once at the start of a build. Falls back
 *  to the configured KOLEEX Hub name if the tenant row is missing. */
export async function loadTenant(tenantId: string): Promise<ResolvedTenant> {
  const { data } = await supabaseServer
    .from("tenants")
    .select("id, name, default_currency")
    .eq("id", tenantId)
    .maybeSingle();
  return {
    id: tenantId,
    name: (data as { name?: string } | null)?.name ?? "KOLEEX International Group",
    currency: (data as { default_currency?: string } | null)?.default_currency ?? "USD",
  };
}

/* Customer / supplier name lookups. These trade two extra round-trips
   for not pulling the full party row into the builder — the builders
   only ever need the display name + (optional) account_no. */

export interface PartyHeader {
  id: string;
  name: string;
  contact?: string;
  address?: string;
}

export async function loadCustomerHeader(
  tenantId: string,
  customerId: string,
): Promise<PartyHeader | null> {
  const { data } = await supabaseServer
    .from("customers")
    .select("id, name, company_name, email, phone, address")
    .eq("id", customerId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return null;
  const row = data as { id: string; name: string; company_name?: string | null; email?: string | null; phone?: string | null; address?: string | null };
  return {
    id: row.id,
    name: row.company_name || row.name,
    contact: row.email ?? row.phone ?? undefined,
    address: row.address ?? undefined,
  };
}

export async function loadSupplierHeader(
  tenantId: string,
  supplierId: string,
): Promise<PartyHeader | null> {
  /* suppliers table has no `address` column — leave that blank. */
  const { data } = await supabaseServer
    .from("suppliers")
    .select("id, name, company_name, email, phone")
    .eq("id", supplierId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return null;
  const row = data as { id: string; name: string; company_name?: string | null; email?: string | null; phone?: string | null };
  return {
    id: row.id,
    name: row.company_name || row.name,
    contact: row.email ?? row.phone ?? undefined,
    address: undefined,
  };
}

/** Unique-ish human report reference (e.g. "KX-RPT-20260517-A4F9"). The
 *  hex tail comes from Date.now() so consecutive reports in the same
 *  second still differ. */
export function generateReportNo(prefix = "KX-RPT"): string {
  const today = new Date();
  const ymd = today.toISOString().slice(0, 10).replace(/-/g, "");
  const tail = Date.now().toString(16).slice(-4).toUpperCase();
  return `${prefix}-${ymd}-${tail}`;
}

/** Inclusive-end filter helper. Both ends are date strings. Returns the
 *  pair re-anchored so callers don't have to reason about "is it
 *  inclusive of the end day?". */
export function normalisePeriod(
  from: string | undefined,
  to: string | undefined,
): { from: string; to: string } {
  if (from && to) return { from, to };
  const def = defaultPeriod();
  return { from: from ?? def.from, to: to ?? def.to };
}

/** Sums a money column safely (Postgres returns string for numeric).
 *  Accepts any row shape so builders can pass typed result arrays. */
export function sumNumeric<T>(rows: ReadonlyArray<T>, key: keyof T & string): number {
  let s = 0;
  for (const r of rows) {
    const v = (r as Record<string, unknown>)[key];
    const n = typeof v === "number" ? v : Number(v ?? 0);
    if (Number.isFinite(n)) s += n;
  }
  return s;
}
