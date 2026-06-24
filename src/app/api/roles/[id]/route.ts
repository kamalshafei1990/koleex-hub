import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";

/* PATCH  /api/roles/[id]  — update a role (Super Admin only)
   DELETE /api/roles/[id]  — delete a role (Super Admin only)
   Positions that referenced the role get role_id=null. */

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const patch = (await req.json()) as Record<string, unknown>;
  delete patch.id;
  delete patch.tenant_id;

  /* The two role tables don't share a schema: `scope` and `slug` live ONLY on
     the base `roles` table, never on koleex_roles. Passing them straight to a
     koleex_roles UPDATE throws "Could not find the 'scope' column" (a 500 that
     silently killed any role edit carrying a scope). Split the payload by which
     table actually owns each column. */
  const ROLES_ONLY = new Set(["scope", "slug"]);
  const koleexPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(patch)) {
    if (!ROLES_ONLY.has(k)) koleexPatch[k] = v;
  }

  const { error } = await supabaseServer
    .from("koleex_roles")
    .update(koleexPatch)
    .eq("id", id);
  if (error) {
    console.error("[api/roles/[id] PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  /* Mirror the edit into the base `roles` table. getServerAuth() reads a
     role's is_super_admin / can_view_private from `roles` (joined off
     accounts.role_id), and account pickers read name / description / scope
     from there too. The is_super_admin/can_view_private flags are ALSO kept in
     sync by DB triggers, but mirroring the full set here is the belt-and-
     suspenders path and is what carries scope/slug/name across. UPDATE (not
     upsert) so a missing mirror row can't trip the NOT NULL slug constraint.
     Best-effort + logged. */
  const MIRROR_KEYS = ["name", "description", "scope", "is_super_admin", "can_view_private", "slug"] as const;
  const mirror: Record<string, unknown> = {};
  for (const k of MIRROR_KEYS) {
    if (k in patch) mirror[k] = patch[k];
  }
  if (Object.keys(mirror).length > 0) {
    const { error: mirrorErr } = await supabaseServer
      .from("roles")
      .update(mirror)
      .eq("id", id);
    if (mirrorErr) {
      console.error("[api/roles/[id] PATCH] roles-mirror failed:", mirrorErr.message);
    }
  }

  await logAudit({
    auth,
    action_type: "change_permissions",
    entity_type: "role",
    entity_id: id,
    entity_label: typeof patch.name === "string" ? patch.name : undefined,
    new_values: patch,
    severity: "warning",
    module: "Roles & Permissions",
    route: "/roles",
    req,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  /* Guard: never silently strip a role that real users still have — that
     would drop them to "No role assigned" and lock them out of every gated
     module. Make the admin reassign those accounts first. */
  const { count: accountsUsing } = await supabaseServer
    .from("accounts")
    .select("id", { count: "exact", head: true })
    .eq("role_id", id);
  if ((accountsUsing ?? 0) > 0) {
    return NextResponse.json(
      {
        error: `${accountsUsing} user account${accountsUsing === 1 ? "" : "s"} still use this role. Reassign them to another role before deleting it.`,
      },
      { status: 409 },
    );
  }

  /* Full cleanup so nothing is orphaned (the old handler deleted only
     koleex_roles, leaving the `roles` mirror + koleex_permissions behind —
     the permission rows would then silently apply to the next role that
     reused the id). Order respects FKs: detach positions, drop the role's
     permission grid, then both role tables. */
  await supabaseServer
    .from("koleex_positions")
    .update({ role_id: null, updated_at: new Date().toISOString() })
    .eq("role_id", id);

  await supabaseServer.from("koleex_permissions").delete().eq("role_id", id);
  await supabaseServer.from("roles").delete().eq("id", id);

  const { error } = await supabaseServer
    .from("koleex_roles")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[api/roles/[id] DELETE]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit({
    auth,
    action_type: "delete",
    entity_type: "role",
    entity_id: id,
    severity: "critical",
    module: "Roles & Permissions",
    route: "/roles",
    req,
  });

  return NextResponse.json({ ok: true });
}
