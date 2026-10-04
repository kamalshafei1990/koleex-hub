import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET /api/planning/entity-search?type=customer&q=acme
   Unified lookup for the Planning linked-entity picker.

   type ∈ { customer, supplier, contact, product }
   q   = free-text search (name / company / product name)

   Returns { results: [{ id, label, subtitle, kind }] }. `kind` is the
   record's REAL type — for a generic "contact" search it is the contact's
   contact_type, so the modal stores customer/supplier (what the Contacts
   detail page asks the strip for) instead of an unqueryable "contact".

   Each type is gated by the app that owns the records (Customers,
   Suppliers, Contacts, Products) on top of Planning, so the picker never
   shows a name its user could not already see. The typed text is stripped
   of the characters PostgREST's .or() grammar uses (`,()`) plus the LIKE
   wildcards, so it cannot inject extra filter clauses. */

type EntityType = "customer" | "supplier" | "contact" | "product";

const MODULE: Record<EntityType, string> = {
  customer: "Customers",
  supplier: "Suppliers",
  contact: "Contacts",
  product: "Products",
};

const LIMIT = 20;

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;

  const url = new URL(req.url);
  const type = url.searchParams.get("type") as EntityType | null;
  if (!type || !(type in MODULE)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const noStore = { headers: { "Cache-Control": "private, no-store" } };
  if (await requireModuleAccess(auth, MODULE[type])) {
    return NextResponse.json({ results: [], denied: true }, noStore);
  }

  const q = (url.searchParams.get("q") ?? "")
    .replace(/[,()%*_\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  const term = `%${q}%`;

  let results: Array<{ id: string; label: string; subtitle?: string | null; kind: string }> = [];

  if (type === "customer" || type === "supplier" || type === "contact") {
    // contacts are a single table with a contact_type discriminator.
    let query = supabaseServer
      .from("contacts")
      .select("id, display_name, company_name, contact_type")
      .eq("tenant_id", auth.tenant_id);
    if (type !== "contact") query = query.eq("contact_type", type);
    if (q) query = query.or(`display_name.ilike.${term},company_name.ilike.${term}`);
    const { data, error } = await query
      .order("display_name", { ascending: true, nullsFirst: false })
      .limit(LIMIT);
    if (error) {
      console.error("[api/planning/entity-search] contacts:", error.message);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    results = (data ?? []).map((c) => {
      const ct = c.contact_type as string | null;
      return {
        id: c.id as string,
        label: (c.display_name as string) || (c.company_name as string) || "—",
        subtitle: (c.company_name as string | null) ?? null,
        kind: ct === "customer" || ct === "supplier" ? ct : "contact",
      };
    });
  } else {
    let query = supabaseServer
      .from("products")
      .select("id, product_name, brand")
      .eq("tenant_id", auth.tenant_id);
    if (q) query = query.ilike("product_name", term);
    const { data, error } = await query
      .order("product_name", { ascending: true, nullsFirst: false })
      .limit(LIMIT);
    if (error) {
      console.error("[api/planning/entity-search] products:", error.message);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    results = (data ?? []).map((p) => ({
      id: p.id as string,
      label: (p.product_name as string) || "—",
      subtitle: (p.brand as string | null) ?? null,
      kind: "product",
    }));
  }

  return NextResponse.json({ results }, noStore);
}
