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
    .select("id, company_name_en, company_name_cn, display_name, photo_url, logo_url")
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
    .map((r) => ({
      id: r.id,
      name: (r.company_name_en || r.display_name || "").trim(),
      name_cn: (r.company_name_cn || "").trim() || null,
      /* Supplier (company) logos live in logo_url for ~all rows; only a couple
         use photo_url. Prefer photo_url, fall back to logo_url — matching the
         supplier directory avatar logic — so the picker shows real logos. */
      logo: r.photo_url || r.logo_url || null,
    }))
    .filter((r) => r.name);

  return NextResponse.json(
    { suppliers },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" } },
  );
}
