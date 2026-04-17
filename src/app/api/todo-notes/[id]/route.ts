import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* DELETE /api/todo-notes/[id] — delete a note.
   Allowed for: Super Admin, or the note's author. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "To-do");
  if (deny) return deny;

  const { data: note } = await supabaseServer
    .from("koleex_todo_notes")
    .select("id, author_account_id, todo_id")
    .eq("id", id)
    .maybeSingle();
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const n = note as { id: string; author_account_id: string; todo_id: string };

  if (!auth.is_super_admin && n.author_account_id !== auth.account_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabaseServer
    .from("koleex_todo_notes")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[api/todo-notes/[id] DELETE]", error.message);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
