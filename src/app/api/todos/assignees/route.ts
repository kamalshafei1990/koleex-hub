import "server-only";

/* GET /api/todos/assignees — the people a task can be assigned to.

   The accounts/people/koleex_employees tables are service-role-only (P0
   security lockdown), so the browser anon client can no longer read them
   directly — which left the To-do "ASSIGN TO" picker empty ("No employees
   found"). This route resolves the assignable list server-side (service
   role), scoped to the caller's tenant, gated by To-do module access.

   Returns: { assignees: TodoAssigneeInfo[], departments: string[] }. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "To-do");
  if (deny) return deny;

  // Internal, active accounts in the caller's tenant = the assignable users.
  let q = supabaseServer
    .from("accounts")
    .select("id, username, avatar_url, person_id")
    .eq("user_type", "internal")
    .eq("status", "active");
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data: accounts, error } = await q;

  if (error) {
    console.error("[api/todos/assignees]", error.message);
    return NextResponse.json({ error: "Failed to load assignees" }, { status: 500 });
  }
  const rows = (accounts ?? []) as Array<{
    id: string;
    username: string;
    avatar_url: string | null;
    person_id: string | null;
  }>;
  if (rows.length === 0) {
    return NextResponse.json({ assignees: [], departments: [] });
  }

  const ids = rows.map((a) => a.id);
  const personIds = rows.map((a) => a.person_id).filter(Boolean) as string[];

  const [peopleRes, empRes] = await Promise.all([
    personIds.length > 0
      ? supabaseServer.from("people").select("id, full_name, name_alt").in("id", personIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; name_alt: string | null }> }),
    supabaseServer
      .from("koleex_employees")
      .select("account_id, department, position")
      .in("account_id", ids),
  ]);

  const personMap = new Map(
    ((peopleRes.data ?? []) as Array<{ id: string; full_name: string | null; name_alt: string | null }>).map(
      (p) => [p.id, p],
    ),
  );
  const empMap = new Map(
    ((empRes.data ?? []) as Array<{
      account_id: string;
      department: string | null;
      position: string | null;
    }>).map((e) => [e.account_id, e]),
  );

  const assignees = rows
    .map((a) => {
      const person = a.person_id ? personMap.get(a.person_id) : null;
      const emp = empMap.get(a.id);
      return {
        account_id: a.id,
        username: a.username,
        full_name: person?.full_name ?? null,
        name_alt: person?.name_alt ?? null,
        avatar_url: a.avatar_url,
        department: emp?.department ?? null,
        position: emp?.position ?? null,
      };
    })
    .sort((x, y) =>
      (x.full_name || x.username || "").localeCompare(y.full_name || y.username || ""),
    );

  const departments = Array.from(
    new Set(assignees.map((a) => a.department).filter(Boolean) as string[]),
  ).sort();

  return NextResponse.json(
    { assignees, departments },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" } },
  );
}
