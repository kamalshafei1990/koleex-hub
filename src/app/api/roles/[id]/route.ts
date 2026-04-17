import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

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
  patch.updated_at = new Date().toISOString();

  const { error } = await supabaseServer
    .from("koleex_roles")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.error("[api/roles/[id] PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Unlink any positions first, then delete the role.
  await supabaseServer
    .from("koleex_positions")
    .update({ role_id: null, updated_at: new Date().toISOString() })
    .eq("role_id", id);

  const { error } = await supabaseServer
    .from("koleex_roles")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[api/roles/[id] DELETE]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
