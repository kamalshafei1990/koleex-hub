import "server-only";

/* GET /api/brand-center/people — who a fill-in template (business card,
   badge, signature …) can be filled for, with only the fields a template
   prints: name, other-script name, position (with its Chinese and Arabic
   titles), department, work email, mobile, the profile photo (the portrait
   cards and the ID badge) and the staff number (the ID badge).
     · Brand Center "create" right → every active employee of the tenant;
     · anyone else who can open Brand Center → only themselves, so each
       employee can make their own card without seeing anyone else's data.
   No ids beyond the row key, nothing about pay or status. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { brandCenterGate } from "@/lib/server/brand-center/access";

export const dynamic = "force-dynamic";

type Person = { id: string; full_name: string | null; name_alt: string | null; email: string | null; phone: string | null; mobile: string | null; avatar_url: string | null };
type Position = { id: string; title: string | null; title_zh: string | null; title_ar: string | null };

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const view = await brandCenterGate(auth, "view");
  if (view) return view;
  const all = !(await brandCenterGate(auth, "create"));

  let personFilter: string | null = null;
  if (!all) {
    const { data: acc } = await supabaseServer.from("accounts").select("person_id").eq("id", auth.account_id).maybeSingle();
    personFilter = (acc?.person_id as string | null) ?? null;
    if (!personFilter) return NextResponse.json({ scope: "self", people: [] });
  }

  let q = supabaseServer.from("koleex_employees")
    .select("id, person_id, work_email, work_phone, employee_number")
    .eq("tenant_id", auth.tenant_id).eq("employment_status", "active");
  if (personFilter) q = q.eq("person_id", personFilter);
  const { data: emps, error } = await q;
  if (error) {
    console.error("[api/brand-center/people]", error.message);
    return NextResponse.json({ error: "Could not load people." }, { status: 500 });
  }
  const personIds = (emps ?? []).map((e) => e.person_id).filter(Boolean) as string[];
  if (!personIds.length) return NextResponse.json({ scope: all ? "all" : "self", people: [] });

  const [people, assigns, positions, departments] = await Promise.all([
    supabaseServer.from("people").select("id, full_name, name_alt, email, phone, mobile, avatar_url").in("id", personIds),
    supabaseServer.from("koleex_assignments").select("person_id, position_id, department_id").in("person_id", personIds).eq("is_active", true),
    supabaseServer.from("koleex_positions").select("id, title, title_zh, title_ar"),
    supabaseServer.from("koleex_departments").select("id, name"),
  ]);
  const err = people.error ?? assigns.error ?? positions.error ?? departments.error;
  if (err) {
    console.error("[api/brand-center/people join]", err.message);
    return NextResponse.json({ error: "Could not load people." }, { status: 500 });
  }
  const personById = new Map(((people.data ?? []) as Person[]).map((p) => [p.id, p]));
  const assignByPerson = new Map((assigns.data ?? []).map((a) => [a.person_id as string, a]));
  const positionById = new Map(((positions.data ?? []) as Position[]).map((p) => [p.id, p]));
  const deptById = new Map((departments.data ?? []).map((d) => [d.id as string, d.name as string]));

  const rows = (emps ?? []).flatMap((e) => {
    const p = e.person_id ? personById.get(e.person_id) : undefined;
    if (!p?.full_name) return [];
    const a = assignByPerson.get(p.id);
    const pos = a?.position_id ? positionById.get(a.position_id) : undefined;
    return [{
      id: e.id as string,
      name: p.full_name,
      nameAlt: p.name_alt ?? null,
      title: pos?.title?.trim() || null,
      titleZh: pos?.title_zh || null,
      titleAr: pos?.title_ar || null,
      photo: p.avatar_url || null,
      /* The staff number — the ID badge prints it (ch. HR documents). */
      staffNo: (e.employee_number as string | null) || null,
      department: (a?.department_id && deptById.get(a.department_id)) || null,
      email: (e.work_email as string | null) || p.email || null,
      mobile: p.mobile || (e.work_phone as string | null) || p.phone || null,
    }];
  }).sort((x, y) => x.name.localeCompare(y.name));

  return NextResponse.json({ scope: all ? "all" : "self", people: rows });
}
