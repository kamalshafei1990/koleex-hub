import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* POST /api/todos/[id]/toggle
   Flip the completed flag. Allowed for: Super Admin, creator, assigner,
   or anyone listed in koleex_todo_assignees (that's the whole point —
   assigned users need to mark their work done). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "To-do");
  if (deny) return deny;

  // Load the todo + check assignee membership in parallel.
  const [{ data: todo }, { data: assignee }] = await Promise.all([
    supabaseServer
      .from("koleex_todos")
      .select(
        "id, completed, tenant_id, created_by_account_id, assigned_by_account_id",
      )
      .eq("id", id)
      .maybeSingle(),
    supabaseServer
      .from("koleex_todo_assignees")
      .select("todo_id")
      .eq("todo_id", id)
      .eq("account_id", auth.account_id)
      .maybeSingle(),
  ]);

  if (!todo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (auth.tenant_id && (todo as { tenant_id: string | null }).tenant_id !== auth.tenant_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const t = todo as {
    completed: boolean;
    created_by_account_id: string | null;
    assigned_by_account_id: string | null;
  };

  const canToggle =
    auth.is_super_admin ||
    t.created_by_account_id === auth.account_id ||
    t.assigned_by_account_id === auth.account_id ||
    !!assignee;

  if (!canToggle) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const { error } = await supabaseServer
    .from("koleex_todos")
    .update({
      completed: !t.completed,
      completed_at: !t.completed ? now : null,
      updated_at: now,
    })
    .eq("id", id);

  if (error) {
    console.error("[api/todos/[id]/toggle]", error.message);
    return NextResponse.json({ error: "Failed to toggle" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
