import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET /api/planning/entity-search?type=customer&q=acme
   Unified lookup for the Planning linked-entity picker.

   type ∈ { customer, supplier, contact, product }
   q   = free-text search (matches name / display_name / sku / etc.)

   Returns { results: [{ id, label, subtitle }] } so the picker shows
   a readable second line. All queries are tenant-scoped so teams can't
   pick records from other tenants. */

type EntityType = "customer" | "supplier" | "contact" | "product";

const LIMIT = 20;

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;

  const url = new URL(req.url);
  const type = url.searchParams.get("type") as EntityType | null;
  const q = (url.searchParams.get("q") ?? "").trim();

  if (!type) {
    return NextResponse.json({ error: "type required" }, { status: 400 });
  }

  let results: Array<{ id: string; label: string; subtitle?: string | null }> = [];

  if (type === "customer" || type === "supplier" || type === "contact") {
    // contacts are a single table with contact_type discriminator.
    // "contact" (lead/generic) matches anything not customer/supplier.
    let query = supabaseServer
      .from("contacts")
      .select("id, display_name, company_name, contact_type")
      .eq("tenant_id", auth.tenant_id);
    if (type === "customer") query = query.eq("contact_type", "customer");
    else if (type === "supplier") query = query.eq("contact_type", "supplier");
    if (q) {
      const term = `%${q}%`;
      query = query.or(`display_name.ilike.${term},company_name.ilike.${term}`);
    }
    const { data, error } = await query.limit(LIMIT);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    results = (data ?? []).map((c) => ({
      id: c.id as string,
      label: (c.display_name as string) || (c.company_name as string) || "Untitled",
      subtitle: (c.company_name as string | null) ?? null,
    }));
  } else if (type === "product") {
    let query = supabaseServer
      .from("products")
      .select("id, name, sku")
      .eq("tenant_id", auth.tenant_id);
    if (q) {
      const term = `%${q}%`;
      query = query.or(`name.ilike.${term},sku.ilike.${term}`);
    }
    const { data, error } = await query.limit(LIMIT);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    results = (data ?? []).map((p) => ({
      id: p.id as string,
      label: (p.name as string) || "Untitled",
      subtitle: (p.sku as string | null) ?? null,
    }));
  } else {
    return NextResponse.json({ results: [] });
  }

  return NextResponse.json({ results });
}
