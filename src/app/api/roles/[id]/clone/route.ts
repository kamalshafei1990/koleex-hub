import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* POST /api/roles/[id]/clone
   Clone an existing role and copy its permissions rows. Returns the
   new role. Super Admin only. */
export async function POST(
  _req: Request,
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

  return NextResponse.json({ role: newRole });
}
