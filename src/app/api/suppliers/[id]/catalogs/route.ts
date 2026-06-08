import "server-only";

/* Catalogs belonging to a supplier. The Catalogs app links each catalog to a
   contact via catalogs.contact_id; a supplier row references that same contact
   via suppliers.contact_id. So a supplier's catalogs = catalogs where
   contact_id == supplier.contact_id. Tenant-scoped, read-only. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  const { data: sup, error: sErr } = await supabaseServer
    .from("suppliers")
    .select("id, contact_id, company_name, company_name_en, name")
    .eq("tenant_id", auth.tenant_id)
    .eq("id", id)
    .maybeSingle();
  if (sErr) {
    console.error("[api/suppliers/[id]/catalogs supplier]", sErr.message);
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }
  if (!sup) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const cols = "id, title, title_cn, description, cover_url, file_url, file_path, file_type, year, valid_until, page_count, category_name, category_names, created_at";
  let rows: unknown[] = [];

  if (sup.contact_id) {
    const { data, error } = await supabaseServer
      .from("catalogs")
      .select(cols)
      .eq("tenant_id", auth.tenant_id)
      .eq("contact_id", sup.contact_id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[api/suppliers/[id]/catalogs by-contact]", error.message);
      return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
    }
    rows = data ?? [];
  } else {
    // Fallback: no linked contact — match by company name (best-effort).
    const nm = (sup.company_name_en || sup.company_name || sup.name || "").trim();
    if (nm) {
      const { data } = await supabaseServer
        .from("catalogs")
        .select(cols)
        .eq("tenant_id", auth.tenant_id)
        .or(`company_name_en.ilike.%${nm}%,company_name_cn.ilike.%${nm}%`)
        .order("created_at", { ascending: false });
      rows = data ?? [];
    }
  }

  return NextResponse.json({ catalogs: rows });
}
