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

  const [{ data: categories, error: catErr }, { data: skills, error: skErr }, usageRes] = await Promise.all([
    supabaseServer
      .from("skill_categories")
      .select("id, name, name_zh, name_ar, sort_order")
      .eq("tenant_id", auth.tenant_id)
      .eq("is_active", true)
      .order("sort_order"),
    supabaseServer
      .from("skills")
      .select("id, category_id, name, name_zh, name_ar, sort_order")
      .eq("tenant_id", auth.tenant_id)
      .eq("is_active", true)
      .order("sort_order"),
    /* Company-wide usage per skill — powers the picker's "Popular in your
       company" section. One projected read; counted in JS (PostgREST can't
       GROUP BY without an RPC and this is a few hundred rows). */
    supabaseServer
      .from("employee_skill_assessments")
      .select("skill_id")
      .eq("tenant_id", auth.tenant_id)
      .limit(20_000),
  ]);
  if (catErr || skErr) {
    return NextResponse.json({ error: catErr?.message || skErr?.message }, { status: 500 });
  }
  const usage = new Map<string, number>();
  for (const r of ((usageRes.data ?? []) as Array<{ skill_id: string }>)) {
    usage.set(r.skill_id, (usage.get(r.skill_id) ?? 0) + 1);
  }
  const skillsOut = (skills ?? []).map((s) => ({
    ...(s as Record<string, unknown>),
    usage_count: usage.get((s as { id: string }).id) ?? 0,
  }));

  return NextResponse.json(
    { categories: categories ?? [], skills: skillsOut },
    /* Library changes rarely; the form fetches it on every open. */
    { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=3600" } },
  );
}
