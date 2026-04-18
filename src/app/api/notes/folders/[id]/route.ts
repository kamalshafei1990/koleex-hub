import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* PATCH  /api/notes/folders/[id] — rename / move / reorder
   DELETE /api/notes/folders/[id] — delete folder (notes inside get folder_id=null
                                     via the DB FK's ON DELETE SET NULL) */

async function ownsFolder(id: string, accountId: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from("notes_folders")
    .select("id")
    .eq("id", id)
    .eq("account_id", accountId)
    .maybeSingle();
  return data !== null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;

  if (!(await ownsFolder(id, auth.account_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const patch = (await req.json()) as Record<string, unknown>;
  delete patch.id;
  delete patch.account_id;
  delete patch.tenant_id;
  delete patch.created_at;

  const { error } = await supabaseServer
    .from("notes_folders")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.error("[api/notes/folders/[id] PATCH]", error.message);
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
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;

  if (!(await ownsFolder(id, auth.account_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await supabaseServer
    .from("notes_folders")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[api/notes/folders/[id] DELETE]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
