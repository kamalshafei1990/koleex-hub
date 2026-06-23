import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { getNoteRole } from "@/lib/server/note-access";

/* PATCH  /api/notes/[id]/shares/[shareId] — owner changes a permission
                                             body: { permission: 'view'|'edit' }
   DELETE /api/notes/[id]/shares/[shareId] — owner removes a collaborator, OR a
                                             collaborator removes themselves
                                             ("leave shared note"). */

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; shareId: string }> },
) {
  const { id, shareId } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;

  const access = await getNoteRole(id, auth.account_id);
  if (access.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can change sharing." }, { status: 403 });
  }

  const body = (await req.json()) as { permission?: string };
  const permission = body.permission === "view" ? "view" : "edit";

  const { error } = await supabaseServer
    .from("note_shares")
    .update({ permission, updated_at: new Date().toISOString() })
    .eq("id", shareId)
    .eq("note_id", id);
  if (error) {
    console.error("[api/notes/[id]/shares/[shareId] PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, permission });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; shareId: string }> },
) {
  const { id, shareId } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;

  // Fetch the share so we can authorize: owner can remove anyone; a
  // collaborator can remove only their OWN share (leave the note).
  const { data: share } = await supabaseServer
    .from("note_shares")
    .select("id, shared_with_account_id")
    .eq("id", shareId)
    .eq("note_id", id)
    .maybeSingle();
  if (!share) return NextResponse.json({ ok: true });

  const access = await getNoteRole(id, auth.account_id);
  const isOwner = access.role === "owner";
  const isSelf = share.shared_with_account_id === auth.account_id;
  if (!isOwner && !isSelf) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const { error } = await supabaseServer
    .from("note_shares")
    .delete()
    .eq("id", shareId)
    .eq("note_id", id);
  if (error) {
    console.error("[api/notes/[id]/shares/[shareId] DELETE]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
