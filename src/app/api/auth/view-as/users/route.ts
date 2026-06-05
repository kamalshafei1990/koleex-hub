import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

/* ---------------------------------------------------------------------------
   GET /api/auth/view-as/users

   Returns the list of users the calling Super Admin can view-as: every
   active account in their tenant (except themselves). Service-role
   read because RLS on `accounts` correctly blocks the anon client
   from listing other accounts directly. Filtered + scoped to the SA's
   own tenant — cross-tenant view goes through the TenantPicker.
   --------------------------------------------------------------------------- */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  if (!auth.is_super_admin) {
    return NextResponse.json(
      { error: "Only super admins can list view-as candidates." },
      { status: 403 },
    );
  }

  const { data, error } = await supabaseServer
    .from("accounts")
    .select(`id, username, login_email, user_type, status, role_id, person_id,
             role:roles(name)`)
    .eq("tenant_id", auth.tenant_id)
    .eq("status", "active")
    .neq("id", auth.real_account_id ?? auth.account_id)
    .order("username", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const baseRows = (data ?? []) as Array<Record<string, unknown>>;

  /* GEN-2 — overlay each account's primary org placement so the picker can
     group "By user" as Department → Position (senior → junior) instead of a
     flat alphabetical list. Resolve via:
       account.person_id → koleex_assignments (primary/active)
                         → koleex_positions (title, level, dept)
                         → koleex_departments (name, sort_order)
     Lower position.level = more senior (0 = CEO/Board, 2 = Head, 3+ = teams).
     Accounts with no assignment fall into an "Unassigned" group. */
  const personIds = Array.from(
    new Set(baseRows.map((r) => r.person_id as string | null).filter(Boolean) as string[]),
  );

  type Placement = {
    department_id: string | null;
    department_name: string | null;
    department_sort: number;
    position_id: string | null;
    position_title: string | null;
    position_level: number;
  };
  const placementByPerson = new Map<string, Placement>();

  if (personIds.length) {
    const { data: asgData } = await supabaseServer
      .from("koleex_assignments")
      .select("person_id, position_id, department_id, is_primary, is_active")
      .eq("tenant_id", auth.tenant_id)
      .in("person_id", personIds)
      .neq("is_active", false);
    const assignments = (asgData ?? []) as Array<{
      person_id: string; position_id: string | null; department_id: string | null;
      is_primary: boolean | null; is_active: boolean | null;
    }>;

    const positionIds = Array.from(new Set(assignments.map((a) => a.position_id).filter(Boolean) as string[]));
    const posMap = new Map<string, { title: string; level: number; department_id: string | null }>();
    if (positionIds.length) {
      const { data: posData } = await supabaseServer
        .from("koleex_positions")
        .select("id, title, level, department_id")
        .in("id", positionIds);
      for (const p of (posData ?? []) as Array<{ id: string; title: string; level: number | null; department_id: string | null }>) {
        posMap.set(p.id, { title: p.title, level: p.level ?? 99, department_id: p.department_id });
      }
    }

    const deptIds = Array.from(new Set([
      ...assignments.map((a) => a.department_id),
      ...Array.from(posMap.values()).map((p) => p.department_id),
    ].filter(Boolean) as string[]));
    const deptMap = new Map<string, { name: string; sort: number }>();
    if (deptIds.length) {
      const { data: depData } = await supabaseServer
        .from("koleex_departments")
        .select("id, name, sort_order")
        .in("id", deptIds);
      for (const d of (depData ?? []) as Array<{ id: string; name: string; sort_order: number | null }>) {
        deptMap.set(d.id, { name: d.name, sort: d.sort_order ?? 999 });
      }
    }

    /* Pick the best assignment per person: primary first, then lowest level. */
    for (const pid of personIds) {
      const mine = assignments.filter((a) => a.person_id === pid);
      if (!mine.length) continue;
      mine.sort((a, b) => {
        if (!!b.is_primary !== !!a.is_primary) return b.is_primary ? 1 : -1;
        const la = a.position_id ? posMap.get(a.position_id)?.level ?? 99 : 99;
        const lb = b.position_id ? posMap.get(b.position_id)?.level ?? 99 : 99;
        return la - lb;
      });
      const best = mine[0];
      const pos = best.position_id ? posMap.get(best.position_id) : undefined;
      const deptId = best.department_id ?? pos?.department_id ?? null;
      const dept = deptId ? deptMap.get(deptId) : undefined;
      placementByPerson.set(pid, {
        department_id: deptId,
        department_name: dept?.name ?? null,
        department_sort: dept?.sort ?? 999,
        position_id: best.position_id,
        position_title: pos?.title?.trim() ?? null,
        position_level: pos?.level ?? 99,
      });
    }
  }

  const accounts = baseRows.map((r) => {
    const role = r.role as { name?: string } | { name?: string }[] | null;
    const roleName = Array.isArray(role) ? role[0]?.name ?? null : role?.name ?? null;
    const pid = r.person_id as string | null;
    const placement = pid ? placementByPerson.get(pid) : undefined;
    return {
      id: r.id as string,
      username: r.username as string,
      login_email: r.login_email as string,
      user_type: r.user_type as string,
      status: r.status as string,
      role_id: r.role_id as string | null,
      role_name: roleName,
      department_id: placement?.department_id ?? null,
      department_name: placement?.department_name ?? null,
      department_sort: placement?.department_sort ?? 999,
      position_title: placement?.position_title ?? null,
      position_level: placement?.position_level ?? 99,
    };
  });

  return NextResponse.json(
    { accounts },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
