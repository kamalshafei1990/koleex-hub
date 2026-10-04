import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { getNoteAccess, isUuid } from "@/lib/notes-server";

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
  const deny = await requireModuleAction(auth, "Notes", "edit");
  if (deny) return deny;
  if (!isUuid(shareId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await getNoteAccess(id, auth.account_id);
  if (access.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can change sharing." }, { status: 403 });
  }

  let body: { permission?: unknown } = {};
  try { body = ((await req.json()) ?? {}) as typeof body; } catch { /* empty */ }
  const permission = body.permission === "view" ? "view" : "edit";

  const { data, error } = await supabaseServer
    .from("note_shares")
    .update({ permission, updated_at: new Date().toISOString() })
    .eq("id", shareId)
    .eq("note_id", id)
    .select("id");
  if (error) {
    console.error("[api/notes/[id]/shares/[shareId] PATCH]", error.message);
    return NextResponse.json({ error: "Failed to update sharing" }, { status: 500 });
  }
  if (!data || data.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, permission });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; shareId: string }> },
) {
  const { id, shareId } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Notes", "edit");
  if (deny) return deny;
  if (!isUuid(id) || !isUuid(shareId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch the share so we can authorize: owner can remove anyone; a
  // collaborator can remove only their OWN share (leave the note).
  const [{ data: share }, { data: note }] = await Promise.all([
    supabaseServer
      .from("note_shares")
      .select("id, shared_with_account_id")
      .eq("id", shareId)
      .eq("note_id", id)
      .maybeSingle(),
    supabaseServer.from("notes").select("account_id").eq("id", id).maybeSingle(),
  ]);
  if (!share) return NextResponse.json({ ok: true });

  const isOwner = note?.account_id === auth.account_id;
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
    return NextResponse.json({ error: "Failed to remove sharing" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
