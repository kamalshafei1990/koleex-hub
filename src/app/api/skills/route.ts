import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET /api/skills — the tenant's Skill Library: active categories with their
   active skills, ready for the pickers. Reads via service_role because the
   tables are RLS deny-all (hr_* convention); the module gate is the actual
   access control. Anyone allowed into Employees may READ the library — it is
   reference data, not personal data. */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Employees");
  if (deny) return deny;

  const [{ data: categories, error: catErr }, { data: skills, error: skErr }] = await Promise.all([
    supabaseServer
      .from("skill_categories")
      .select("id, name, sort_order")
      .eq("tenant_id", auth.tenant_id)
      .eq("is_active", true)
      .order("sort_order"),
    supabaseServer
      .from("skills")
      .select("id, category_id, name, sort_order")
      .eq("tenant_id", auth.tenant_id)
      .eq("is_active", true)
      .order("sort_order"),
  ]);
  if (catErr || skErr) {
    return NextResponse.json({ error: catErr?.message || skErr?.message }, { status: 500 });
  }
  return NextResponse.json(
    { categories: categories ?? [], skills: skills ?? [] },
    /* Library changes rarely; the form fetches it on every open. */
    { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=3600" } },
  );
}
