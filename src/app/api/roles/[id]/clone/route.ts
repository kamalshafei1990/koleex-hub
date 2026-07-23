import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";

/* POST /api/roles/[id]/clone
   Clone an existing role and copy its permissions rows. Returns the
   new role. Super Admin only. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sourceRoleId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: src, error: fetchErr } = await supabaseServer
    .from("koleex_roles")
    .select("*")
    .eq("id", sourceRoleId)
    .maybeSingle();
  if (fetchErr || !src) {
    return NextResponse.json(
      { error: fetchErr?.message ?? "Role not found" },
      { status: 404 },
    );
  }

  /* Deliberately NOT copied: is_super_admin and can_view_private. Cloning is
     a one-click action; silently duplicating a break-glass or SA role would
     widen access to private records without anyone consciously granting it.
     The admin re-enables those flags explicitly on the copy if intended. */
  const s = src as { name: string; description: string | null };
  const { data: newRole, error: createErr } = await supabaseServer
    .from("koleex_roles")
    .insert({
      name: `${s.name} (Copy)`,
      description: s.description,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (createErr || !newRole) {
    return NextResponse.json(
      { error: createErr?.message ?? "Failed to create role" },
      { status: 500 },
    );
  }

  // Copy permissions
  const { data: perms } = await supabaseServer
    .from("koleex_permissions")
    .select(
      "module_name, can_view, can_create, can_edit, can_delete, data_scope",
    )
    .eq("role_id", sourceRoleId);

  if (perms && perms.length > 0) {
    await supabaseServer.from("koleex_permissions").insert(
      (perms as Array<Record<string, unknown>>).map((p) => ({
        ...p,
        role_id: (newRole as { id: string }).id,
      })),
    );
  }

  /* Mirror into the base `roles` table — same reason as POST /api/roles:
     accounts.role_id is an FK to roles.id, so without the mirror the clone
     appears in every picker but explodes with an FK violation the first
     time an account is saved onto it. Carry the source's scope across. */
  const created = newRole as { id: string; name: string; description: string | null };
  const { data: srcBase } = await supabaseServer
    .from("roles")
    .select("scope")
    .eq("id", sourceRoleId)
    .maybeSingle();
  const slug = created.name
    .trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48)
    || `role_${created.id.slice(0, 8)}`;
  const { error: mirrorErr } = await supabaseServer.from("roles").upsert({
    id: created.id,
    slug,
    name: created.name,
    description: created.description,
    scope: (srcBase as { scope?: string } | null)?.scope ?? "internal",
    is_super_admin: false,
    can_view_private: false,
  }, { onConflict: "id" });
  if (mirrorErr) {
    console.error("[api/roles/clone] roles-mirror failed:", mirrorErr.message);
  }

  /* Creating a role with a full permission grid is exactly as consequential
     as POST /api/roles — audit it the same way. */
  await logAudit({
    auth,
    action_type: "create",
    entity_type: "role",
    entity_id: created.id,
    entity_label: created.name,
    new_values: { cloned_from: sourceRoleId, permissions_copied: perms?.length ?? 0 },
    severity: "warning",
    module: "Roles & Permissions",
    route: "/roles",
    req,
  });

  return NextResponse.json({ role: newRole });
}
