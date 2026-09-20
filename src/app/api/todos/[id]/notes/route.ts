import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { canViewTodo } from "@/lib/server/todo-access";
import { pingTodosChanged } from "@/lib/server/todo-notify";

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
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "To-do", "create");
  if (deny) return deny;

  const body = (await req.json()) as { body: string };
  if (!body.body?.trim()) {
    return NextResponse.json({ error: "Empty note" }, { status: 400 });
  }

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
      body: body.body,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[api/todos/[id]/notes POST]", error.message);
    return NextResponse.json({ error: "Failed to add note" }, { status: 500 });
  }
  await pingTodosChanged(auth.tenant_id);
  return NextResponse.json({ note: data });
}
