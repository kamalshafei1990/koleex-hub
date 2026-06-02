import "server-only";

/* ---------------------------------------------------------------------------
   /api/suppliers/coverage — Koleex Main Suppliers sourcing-coverage board.

   GET  — all coverage assignments for the tenant, each enriched with a light
          supplier snapshot (logo, name, risk level, evaluation/sourcing score)
          so the board can render cards without N extra round-trips. Read-only.

   POST — assign an EXISTING supplier to a taxonomy node (division → category →
          subcategory) with a sourcing role. Upsert on the (supplier, category,
          subcategory) key, so re-adding just updates the role — never creates a
          duplicate supplier. Suppliers themselves live in `contacts`; this only
          writes the thin assignment join.

   Tenant + Suppliers-module gated; service-role server client (contacts &
   coverage are RLS-locked).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { COVERAGE_ROLES, type CoverageRole, type CoverageRow, type CoverageSupplier } from "@/lib/suppliers/coverage";

interface CoverageDbRow {
  id: string;
  supplier_id: string;
  division_slug: string;
  category_slug: string;
  subcategory_code: string;
  subcategory_label: string | null;
  sourcing_role: string;
  sourcing_priority: number | null;
  is_main_supplier: boolean;
}

async function enrichSuppliers(tid: string, supplierIds: string[]): Promise<Map<string, CoverageSupplier>> {
  const map = new Map<string, CoverageSupplier>();
  if (supplierIds.length === 0) return map;

  const [contactsRes, riskRes, sourcingRes] = await Promise.all([
    supabaseServer.from("contacts")
      .select("id, company_name_en, display_name, photo_url, country, strategic_status, is_active")
      .eq("tenant_id", tid).eq("contact_type", "supplier").in("id", supplierIds),
    supabaseServer.from("supplier_risk_profile")
      .select("supplier_id, risk_level, internal_evaluation_score")
      .eq("tenant_id", tid).in("supplier_id", supplierIds),
    supabaseServer.from("supplier_sourcing_profile")
      .select("supplier_id, sourcing_score_override")
      .eq("tenant_id", tid).in("supplier_id", supplierIds),
  ]);

  const riskBy = new Map<string, { risk_level: string | null; internal_evaluation_score: number | null }>();
  for (const r of (riskRes.data ?? []) as Array<{ supplier_id: string; risk_level: string | null; internal_evaluation_score: number | null }>) {
    riskBy.set(r.supplier_id, { risk_level: r.risk_level, internal_evaluation_score: r.internal_evaluation_score });
  }
  const srcBy = new Map<string, number | null>();
  for (const r of (sourcingRes.data ?? []) as Array<{ supplier_id: string; sourcing_score_override: number | null }>) {
    srcBy.set(r.supplier_id, r.sourcing_score_override);
  }

  for (const c of (contactsRes.data ?? []) as Array<Record<string, unknown>>) {
    const id = c.id as string;
    const risk = riskBy.get(id);
    map.set(id, {
      id,
      name: ((c.company_name_en as string) || (c.display_name as string) || "").trim() || "—",
      logo: (c.photo_url as string) || null,
      country: (c.country as string) || null,
      active: c.is_active !== false,
      strategicStatus: (c.strategic_status as string) || null,
      riskLevel: risk?.risk_level ?? null,
      evaluationScore: typeof risk?.internal_evaluation_score === "number" ? risk.internal_evaluation_score : null,
      sourcingScore: srcBy.get(id) ?? null,
    });
  }
  return map;
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return deny;
  const tid = auth.tenant_id;

  const { data, error } = await supabaseServer
    .from("supplier_coverage")
    .select("id, supplier_id, division_slug, category_slug, subcategory_code, subcategory_label, sourcing_role, sourcing_priority, is_main_supplier")
    .eq("tenant_id", tid)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[api/suppliers/coverage GET]", error.message);
    return NextResponse.json({ error: "Failed to load coverage" }, { status: 500 });
  }

  const rows = (data ?? []) as CoverageDbRow[];
  const supplierMap = await enrichSuppliers(tid, [...new Set(rows.map((r) => r.supplier_id))]);

  const coverage: CoverageRow[] = rows.map((r) => ({
    id: r.id,
    supplier_id: r.supplier_id,
    division_slug: r.division_slug,
    category_slug: r.category_slug,
    subcategory_code: r.subcategory_code,
    subcategory_label: r.subcategory_label,
    sourcing_role: (COVERAGE_ROLES as readonly string[]).includes(r.sourcing_role) ? (r.sourcing_role as CoverageRole) : "approved",
    sourcing_priority: r.sourcing_priority,
    is_main_supplier: r.is_main_supplier,
    supplier: supplierMap.get(r.supplier_id) ?? null,
  }));

  return NextResponse.json({ coverage }, { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=60" } });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return deny;
  const tid = auth.tenant_id;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const supplierId = typeof body.supplier_id === "string" ? body.supplier_id : "";
  const divisionSlug = typeof body.division_slug === "string" ? body.division_slug.trim() : "";
  const categorySlug = typeof body.category_slug === "string" ? body.category_slug.trim() : "";
  const subCode = typeof body.subcategory_code === "string" ? body.subcategory_code.trim() : "";
  const subLabel = typeof body.subcategory_label === "string" ? body.subcategory_label.trim() : null;
  const role: CoverageRole = (COVERAGE_ROLES as readonly string[]).includes(body.sourcing_role as string) ? (body.sourcing_role as CoverageRole) : "approved";
  const isMain = body.is_main_supplier === true;

  if (!supplierId || !divisionSlug || !categorySlug || !subCode) {
    return NextResponse.json({ error: "supplier_id, division_slug, category_slug and subcategory_code are required" }, { status: 400 });
  }

  // Verify the supplier exists, belongs to this tenant, and is actually a supplier.
  const { data: sup, error: supErr } = await supabaseServer
    .from("contacts").select("id").eq("id", supplierId).eq("tenant_id", tid).eq("contact_type", "supplier").maybeSingle();
  if (supErr) { console.error("[api/suppliers/coverage POST supplier-check]", supErr.message); return NextResponse.json({ error: "Lookup failed" }, { status: 500 }); }
  if (!sup) return NextResponse.json({ error: "Supplier not found in this tenant" }, { status: 404 });

  const { data, error } = await supabaseServer
    .from("supplier_coverage")
    .upsert({
      tenant_id: tid,
      supplier_id: supplierId,
      division_slug: divisionSlug,
      category_slug: categorySlug,
      subcategory_code: subCode,
      subcategory_label: subLabel,
      sourcing_role: role,
      is_main_supplier: isMain,
      created_by: auth.account_id ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,supplier_id,category_slug,subcategory_code" })
    .select("id, supplier_id, division_slug, category_slug, subcategory_code, subcategory_label, sourcing_role, sourcing_priority, is_main_supplier")
    .maybeSingle();

  if (error || !data) {
    console.error("[api/suppliers/coverage POST]", error?.message);
    return NextResponse.json({ error: "Failed to assign supplier" }, { status: 500 });
  }

  const r = data as CoverageDbRow;
  const supplierMap = await enrichSuppliers(tid, [r.supplier_id]);
  const row: CoverageRow = {
    id: r.id, supplier_id: r.supplier_id, division_slug: r.division_slug, category_slug: r.category_slug,
    subcategory_code: r.subcategory_code, subcategory_label: r.subcategory_label,
    sourcing_role: (COVERAGE_ROLES as readonly string[]).includes(r.sourcing_role) ? (r.sourcing_role as CoverageRole) : "approved",
    sourcing_priority: r.sourcing_priority, is_main_supplier: r.is_main_supplier,
    supplier: supplierMap.get(r.supplier_id) ?? null,
  };
  return NextResponse.json({ row }, { status: 201 });
}
