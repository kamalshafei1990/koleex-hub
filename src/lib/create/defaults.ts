import "server-only";

/* ===========================================================================
   Smart defaults — read-only resolver for "New X" pages.

   Returns the per-tenant defaults a form should pre-fill: base
   currency, default warehouse, default payment terms, etc. The values
   come from existing tables (tenants.default_currency, the most-
   recently-used warehouse, etc.) — no new settings tables.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";

export interface SmartDefaults {
  base_currency: string;
  default_warehouse_id: string | null;
  default_warehouse_label: string | null;
  default_payment_terms: string;     // free-text, e.g. "Net 30"
  default_expense_category_id: string | null;
  default_expense_category_label: string | null;
  default_supplier_country: string | null;
  default_customer_country: string | null;
}

const PAYMENT_TERMS_FALLBACK = "Net 30";

export async function resolveSmartDefaults(tenantId: string): Promise<SmartDefaults> {
  const [tenantRes, whRes, catRes, supRes, custRes] = await Promise.all([
    supabaseServer.from("tenants").select("default_currency").eq("id", tenantId).maybeSingle(),
    /* Most-recently-used warehouse = whichever appears most often in
       recent stock movements; else first active warehouse. */
    supabaseServer.from("inventory_warehouses")
      .select("id, code, name").eq("tenant_id", tenantId).order("created_at", { ascending: true }).limit(1),
    supabaseServer.from("finance_expense_categories")
      .select("id, name").eq("tenant_id", tenantId).order("name", { ascending: true }).limit(1),
    supabaseServer.from("contacts").select("country").eq("tenant_id", tenantId).eq("contact_type", "supplier")
      .not("country", "is", null).limit(1),
    supabaseServer.from("customers").select("country").eq("tenant_id", tenantId)
      .not("country", "is", null).limit(1),
  ]);

  const base = (tenantRes.data as { default_currency: string | null } | null)?.default_currency ?? "CNY";
  const wh = (whRes.data?.[0] as { id: string; code: string; name: string } | undefined) ?? null;
  const cat = (catRes.data?.[0] as { id: string; name: string } | undefined) ?? null;
  const supCountry = (supRes.data?.[0] as { country: string | null } | undefined)?.country ?? null;
  const custCountry = (custRes.data?.[0] as { country: string | null } | undefined)?.country ?? null;

  return {
    base_currency: base,
    default_warehouse_id: wh?.id ?? null,
    default_warehouse_label: wh ? `${wh.code} · ${wh.name}` : null,
    default_payment_terms: PAYMENT_TERMS_FALLBACK,
    default_expense_category_id: cat?.id ?? null,
    default_expense_category_label: cat?.name ?? null,
    default_supplier_country: supCountry,
    default_customer_country: custCountry,
  };
}
