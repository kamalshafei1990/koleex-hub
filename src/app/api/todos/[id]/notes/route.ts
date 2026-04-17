import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* POST /api/todos/[id]/notes — add a note to a todo.
   Anyone with Todo access who can view this todo can add a note. The
   author is enforced server-side as auth.account_id. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: todoId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "To-do");
  if (deny) return deny;

  const body = (await req.json()) as { body: string };
  if (!body.body?.trim()) {
    return NextResponse.json({ error: "Empty note" }, { status: 400 });
  }

  // Tenant check — note author must be in same tenant as todo.
  if (auth.tenant_id) {
    const { data: todo } = await supabaseServer
      .from("koleex_todos")
      .select("tenant_id")
      .eq("id", todoId)
      .maybeSingle();
    if (!todo) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ((todo as { tenant_id: string | null }).tenant_id !== auth.tenant_id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

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
  return NextResponse.json({ note: data });
}
