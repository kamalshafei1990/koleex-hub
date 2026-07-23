import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET /api/behavior — the tenant's Behavior Library: active categories with
   their active indicators. Reference data, gated by the Employees module (the
   form reads it) — the tables are RLS deny-all, so the module gate is the
   real access control. */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Employees");
  if (deny) return deny;

  const [{ data: categories, error: catErr }, { data: indicators, error: indErr }] = await Promise.all([
    supabaseServer
      .from("behavior_categories")
      .select("id, name, sort_order")
      .eq("tenant_id", auth.tenant_id)
      .eq("is_active", true)
      .order("sort_order"),
    supabaseServer
      .from("behavior_indicators")
      .select("id, category_id, name, description, assessor_guidance, is_critical_default, sort_order")
      .eq("tenant_id", auth.tenant_id)
      .eq("is_active", true)
      .order("sort_order"),
  ]);
  if (catErr || indErr) {
    return NextResponse.json({ error: catErr?.message || indErr?.message }, { status: 500 });
  }
  return NextResponse.json(
    { categories: categories ?? [], indicators: indicators ?? [] },
    { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=3600" } },
  );
}
