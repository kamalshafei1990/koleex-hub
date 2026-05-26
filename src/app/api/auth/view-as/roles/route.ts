import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

/* ---------------------------------------------------------------------------
   GET /api/auth/view-as/roles

   Returns the list of roles a Super Admin can preview via "view as
   role". Roles are global (no tenant_id), so the response is the full
   roles list — minus the SA's own current role and any role marked
   is_super_admin (which would render the preview meaningless).

   Module count is included so the picker can show "12 modules" next
   to each role and the SA can pick a sensible one without opening it.
   --------------------------------------------------------------------------- */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  if (!auth.is_super_admin) {
    return NextResponse.json(
      { error: "Only super admins can list view-as-role candidates." },
      { status: 403 },
    );
  }

  const [rolesRes, permsRes] = await Promise.all([
    supabaseServer
      .from("roles")
      .select("id, name, description, is_super_admin, can_view_private, display_order")
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true }),
    supabaseServer
      .from("koleex_permissions")
      .select("role_id, can_view"),
  ]);

  if (rolesRes.error) {
    return NextResponse.json({ error: rolesRes.error.message }, { status: 500 });
  }

  /* Count grants per role for the "12 modules" pill. */
  const counts = new Map<string, number>();
  for (const p of (permsRes.data ?? []) as Array<{ role_id: string; can_view: boolean }>) {
    if (!p.can_view) continue;
    counts.set(p.role_id, (counts.get(p.role_id) ?? 0) + 1);
  }

  const roles = ((rolesRes.data ?? []) as Array<{
    id: string;
    name: string;
    description: string | null;
    is_super_admin: boolean | null;
    can_view_private: boolean | null;
    display_order: number | null;
  }>)
    .filter((r) => !r.is_super_admin && r.id !== auth.role_id)
    .map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      can_view_private: !!r.can_view_private,
      module_count: counts.get(r.id) ?? 0,
    }));

  return NextResponse.json({ roles });
}
