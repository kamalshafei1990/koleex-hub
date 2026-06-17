import "server-only";

/* ---------------------------------------------------------------------------
   /api/suppliers

   GET — minimal supplier list {id, name, logo} for the admin product
         builder's Supplier dropdown. Suppliers are stored as rows in
         `contacts` with contact_type='supplier'; the contacts table
         is locked down at the RLS layer (service_role only), so a
         browser-side anon query returns an empty list. This route
         fetches via the service-role server client so admins
         actually see their saved suppliers.

   Access:
     · requireAuth — must be signed in
     · Either "Product Data" (admin who builds products and needs
       to pick suppliers) OR "Suppliers" (admin whose whole job is
       the supplier directory) is sufficient. Both cover the
       legitimate callers without leaking the directory to e.g. a
       customer-scoped account.

   Response:
     { suppliers: Array<{ id, name, logo }> }
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { hasProductDataAccess } from "@/lib/server/product-access";

interface ContactSupplierRow {
  id: string;
  company_name_en: string | null;
  company_name_cn: string | null;
  display_name: string | null;
  photo_url: string | null;
  logo_url: string | null;
  /* Supplier-level defaults — the source of truth for any field shared
     with the product↔supplier link (shown read-only in Product Data). */
  supplier_type: string | null;
  payment_terms: string | null;
  currency: string | null;
  moq: string | null;
  lead_time: string | null;
  /* Contact info (read-only quick-look; full record in the Suppliers app). */
  supplier_email: string | null;
  email: string | null;
  phone: string | null;
  supplier_website: string | null;
  website: string | null;
  wechat_id: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  supplier_address: string | null;
  contact_persons: Array<{ full_name?: string; name_cn?: string; role?: string; email?: string; mobile?: string; is_primary?: boolean }> | null;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  /* Pass if the caller has Product Data access (covers product
     admins). Otherwise fall back to the Suppliers-module gate
     (covers supplier-directory admins who don't touch Product
     Data). Either one is sufficient. */
  const hasProductData = await hasProductDataAccess(auth);
  if (!hasProductData) {
    const deny = await requireModuleAccess(auth, "Suppliers");
    if (deny) return deny;
  }

  const { data, error } = await supabaseServer
    .from("contacts")
    .select("id, company_name_en, company_name_cn, display_name, photo_url, logo_url, supplier_type, payment_terms, currency, moq, lead_time, supplier_email, email, phone, supplier_website, website, wechat_id, city, province, country, supplier_address, contact_persons")
    .eq("contact_type", "supplier")
    .eq("tenant_id", auth.tenant_id)
    .order("company_name_en", { ascending: true });

  if (error) {
    console.error("[api/suppliers GET]", error.message);
    return NextResponse.json({ error: "Failed to load suppliers" }, { status: 500 });
  }

  /* The product builder only needs three fields. Prefer
     company_name_en (canonical company name); fall back to
     display_name when a supplier was entered without the English
     name. Rows with no usable name are filtered out so the
     dropdown doesn't show blank entries. */
  const suppliers = ((data ?? []) as ContactSupplierRow[])
    .map((r) => {
      /* Pick the primary contact person (or the first listed) for the
         quick-look popup; the full list stays in the Suppliers app. */
      const persons = Array.isArray(r.contact_persons) ? r.contact_persons : [];
      const cp = persons.find((p) => p?.is_primary) || persons[0] || null;
      const primary_contact = cp
        ? {
            name: (cp.full_name || cp.name_cn || "").trim() || null,
            role: (cp.role || "").trim() || null,
            email: (cp.email || "").trim() || null,
            mobile: (cp.mobile || "").trim() || null,
          }
        : null;
      const location = [r.city, r.province, r.country].map((s) => (s || "").trim()).filter(Boolean).join(", ")
        || (r.supplier_address || "").trim() || null;
      return {
        id: r.id,
        name: (r.company_name_en || r.display_name || "").trim(),
        name_cn: (r.company_name_cn || "").trim() || null,
        /* Supplier-level defaults (source of truth for shared fields). */
        supply_type: r.supplier_type || null,
        payment_terms: r.payment_terms || null,
        currency: r.currency || null,
        moq: r.moq || null,
        lead_time: r.lead_time || null,
        /* Contact info (read-only quick-look). */
        email: (r.supplier_email || r.email || "").trim() || null,
        phone: (r.phone || "").trim() || null,
        website: (r.supplier_website || r.website || "").trim() || null,
        wechat: (r.wechat_id || "").trim() || null,
        location,
        primary_contact,
        /* Supplier (company) logos live in logo_url for ~all rows; only a couple
           use photo_url. Prefer photo_url, fall back to logo_url — matching the
           supplier directory avatar logic — so the picker shows real logos. */
        logo: r.photo_url || r.logo_url || null,
      };
    })
    .filter((r) => r.name);

  return NextResponse.json(
    { suppliers },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" } },
  );
}
