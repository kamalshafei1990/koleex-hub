import "server-only";

/* ---------------------------------------------------------------------------
   /api/hr/attendance/employees — how each employee's attendance is taken
   (Phase 1, owner-approved 23 Sep 2026).

   GET   — active employees with punch method, works-outside flag, work
           country and hire date.
   PATCH — { employee_id, punch_method?: "app" | "device", works_remote?,
           work_country?: ISO alpha-2 | null }. Only these three columns can
           change here; the rest of the employee record belongs to the
           Employees app.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { COUNTRIES } from "@/lib/commercial-policy/countries";

const COLS = "id, punch_method, works_remote, work_country, hire_date, employment_status, people(full_name)";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "HR", "view");
  if (deny) return deny;
  /* tenant OR null — most employee rows carry no tenant_id (see the import route). */
  const { data, error } = await supabaseServer.from("koleex_employees").select(COLS)
    .or(auth.tenant_id ? `tenant_id.eq.${auth.tenant_id},tenant_id.is.null` : "tenant_id.is.null")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: "Could not load employees." }, { status: 500 });
  const employees = ((data ?? []) as Array<{ id: string; punch_method: string | null; works_remote: boolean | null; work_country: string | null; hire_date: string | null; employment_status: string | null; people?: { full_name?: string | null } | { full_name?: string | null }[] | null }>)
    .filter((e) => (e.employment_status ?? "active") === "active")
    .map((e) => {
      const p = Array.isArray(e.people) ? e.people[0] : e.people;
      return { id: e.id, name: p?.full_name?.trim() || "Employee", punch_method: e.punch_method === "device" ? "device" : "app", works_remote: !!e.works_remote, work_country: e.work_country, hire_date: e.hire_date };
    });
  return NextResponse.json({ employees }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "HR", "edit");
  if (deny) return deny;
  const body = (await req.json().catch(() => null)) as { employee_id?: unknown; punch_method?: unknown; works_remote?: unknown; work_country?: unknown } | null;
  const id = typeof body?.employee_id === "string" && /^[0-9a-f-]{36}$/i.test(body.employee_id) ? body.employee_id : "";
  if (!id) return NextResponse.json({ error: "employee_id required" }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (body?.punch_method !== undefined) {
    if (body.punch_method !== "app" && body.punch_method !== "device") return NextResponse.json({ error: "punch_method must be app|device" }, { status: 400 });
    patch.punch_method = body.punch_method;
  }
  if (body?.works_remote !== undefined) patch.works_remote = body.works_remote === true;
  if (body?.work_country !== undefined) {
    const code = body.work_country === null || body.work_country === "" ? null : String(body.work_country).toUpperCase();
    if (code && !COUNTRIES.some((c) => c.code === code)) return NextResponse.json({ error: "unknown country" }, { status: 400 });
    patch.work_country = code;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "nothing to change" }, { status: 400 });
  const { data, error } = await supabaseServer.from("koleex_employees").update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id).or(auth.tenant_id ? `tenant_id.eq.${auth.tenant_id},tenant_id.is.null` : "tenant_id.is.null")
    .select("id, punch_method, works_remote, work_country").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ employee: data });
}
