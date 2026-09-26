import "server-only";

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { canViewTodo } from "@/lib/server/todo-access";
import { pingTodosChanged } from "@/lib/server/todo-notify";
import { TODO_NOTE_MAX } from "@/lib/server/todo-input";

/* POST /api/todos/[id]/notes — add a note to a todo.
   Anyone who can SEE the todo (the list's own visibility rule) can add a
   note. The author is enforced server-side as auth.account_id.

   The old check was tenant-only: any account with To-do create could note
   on any task in the tenant, including private ones it could not list. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: todoId } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "To-do", "create");
  if (deny) return deny;

  let text = "";
  try {
    const parsed = (await req.json()) as { body?: unknown } | null;
    text = typeof parsed?.body === "string" ? parsed.body.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "Empty note" }, { status: 400 });
  if (text.length > TODO_NOTE_MAX) return NextResponse.json({ error: "Note is too long" }, { status: 400 });

  const visible = await canViewTodo(todoId, {
    accountId: auth.account_id,
    tenantId: auth.tenant_id,
    department: auth.department,
    isSuperAdmin: auth.is_super_admin,
    canViewPrivate: auth.can_view_private,
  });
  if (!visible) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabaseServer
    .from("koleex_todo_notes")
    .insert({
      todo_id: todoId,
      author_account_id: auth.account_id,
      body: text,
    })
    .select("id, todo_id, author_account_id, body, created_at, updated_at")
    .single();

  if (error) {
    console.error("[api/todos/[id]/notes POST]", error.message);
    return NextResponse.json({ error: "Failed to add note" }, { status: 500 });
  }
  after(() => pingTodosChanged(auth.tenant_id));
  return NextResponse.json({ note: data });
}
