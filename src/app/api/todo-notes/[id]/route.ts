import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth , requireModuleAction} from "@/lib/server/auth";
import { pingTodosChanged } from "@/lib/server/todo-notify";

/* DELETE /api/todo-notes/[id] — delete a note.
   Allowed for: Super Admin, or the note's author — within the caller's
   tenant (the note is looked up through its task). */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "To-do", "delete");
  if (deny) return deny;

  const { data: note } = await supabaseServer
    .from("koleex_todo_notes")
    .select("id, author_account_id, todo_id, todo:koleex_todos!inner ( tenant_id )")
    .eq("id", id)
    .maybeSingle();
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const n = note as unknown as {
    id: string;
    author_account_id: string;
    todo_id: string;
    todo: { tenant_id: string | null } | Array<{ tenant_id: string | null }> | null;
  };
  const todo = Array.isArray(n.todo) ? n.todo[0] ?? null : n.todo;
  if (auth.tenant_id && todo?.tenant_id && todo.tenant_id !== auth.tenant_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
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
  await pingTodosChanged(auth.tenant_id);
  return NextResponse.json({ ok: true });
}
