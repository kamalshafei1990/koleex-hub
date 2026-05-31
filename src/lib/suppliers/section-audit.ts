import "server-only";

/* ---------------------------------------------------------------------------
   Supplier section-level attribution.

   A supplier record is filled by many departments (Procurement, Finance,
   Legal, Logistics, Quality, Commercial). We record WHO last edited each
   department's slice of the record and WHEN, so every section can show
   "Updated by <name> · <date>".

   Attribution is keyed by department (dept_key) — the same keys used by the
   supplier form's owner badges and department filter. A single supplier save
   may touch several departments at once; each gets stamped.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";

export type DeptKey =
  | "procurement" | "finance" | "legal" | "logistics" | "quality" | "commercial" | "general";

/* Map a `contacts` column → the department that owns it. Columns not listed
   are simply not attributed (no row written). Intel tables (factory, risk,
   negotiation) are stamped directly by their own routes. */
const FIELD_DEPT: Record<string, DeptKey> = {
  /* ── Procurement: identity, profile, contact + messaging channels ── */
  company_name_en: "procurement", company_name_cn: "procurement", company: "procurement",
  trading_name: "procurement", supplier_website: "procurement", industry: "procurement",
  source: "procurement", photo_url: "procurement", division: "procurement", category: "procurement",
  supplier_address: "procurement", country: "procurement", city: "procurement", state: "procurement",
  tel: "procurement", mobile: "procurement", email: "procurement", phone: "procurement",
  wechat_id: "procurement", whatsapp: "procurement", telegram: "procurement",
  qq_id: "procurement", dingtalk_id: "procurement", messenger: "procurement",

  /* ── Legal & Compliance: registration, trade/tax IDs, documents ── */
  business_registration_number: "legal", registration_country: "legal", company_type: "legal",
  year_established: "legal", employee_count_range: "legal", business_license_image: "legal",
  gst_number: "legal", cr_number: "legal", duns_number: "legal", eori_number: "legal",
  importer_exporter_code: "legal", customs_code: "legal", certifications: "legal",

  /* ── Finance: payment terms, currency, banks, mobile pay ── */
  payment_terms: "finance", currency: "finance", payment_info: "finance",
  bank_accounts: "finance", wechat_pay_id: "finance", wechat_pay_qr: "finance",
  alipay_id: "finance", alipay_qr: "finance",

  /* ── Logistics: shipping terms ── */
  incoterms: "logistics", lead_time: "logistics", moq: "logistics",
  container_preference: "logistics", port_of_entry: "logistics",
  customs_broker: "logistics", freight_forwarder: "logistics",

  /* ── Commercial: strategic relationship ── */
  strategic_status: "commercial", strategic_status_reason: "commercial", rating: "commercial",

  /* ── General ── */
  notes: "general", brand_names: "general", social_profiles: "general",
};

/** Distinct departments touched by a set of changed `contacts` column names. */
export function deptsFromFields(keys: string[]): DeptKey[] {
  const set = new Set<DeptKey>();
  for (const k of keys) {
    const d = FIELD_DEPT[k];
    if (d) set.add(d);
  }
  return [...set];
}

/** Upsert "edited by / at" for one or more departments of a supplier.
    Best-effort: never throws, so it can't break the underlying save. */
export async function recordSectionEdits(opts: {
  tenantId: string;
  supplierId: string;
  depts: DeptKey[];
  accountId: string | null;
  accountName: string;
  at?: string;
}): Promise<void> {
  const { tenantId, supplierId, depts, accountId, accountName, at } = opts;
  if (!depts.length) return;
  const edited_at = at ?? new Date().toISOString();
  const rows = depts.map((dept_key) => ({
    tenant_id: tenantId,
    supplier_id: supplierId,
    dept_key,
    edited_by_account_id: accountId,
    edited_by_name: accountName || "System",
    edited_at,
  }));
  try {
    await supabaseServer
      .from("supplier_section_audit")
      .upsert(rows, { onConflict: "tenant_id,supplier_id,dept_key" });
  } catch {
    /* attribution is best-effort; the data save already succeeded */
  }
}
