import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* PATCH /api/todos/[id] — update fields + optionally re-sync assignees.
   DELETE /api/todos/[id] — remove the todo + assignees/notes (cascade).

   Auth rules (Type C / To-do):
     - Super Admin: anything in tenant
     - Creator (created_by_account_id = me): anything on own todo
     - Assigner (assigned_by_account_id = me): can edit own-assigned
     - Everyone else: can only toggle completion on their own line
       (handled in /toggle, not here — this route refuses non-owners)
*/

interface TodoOwnership {
  id: string;
  tenant_id: string | null;
  created_by_account_id: string | null;
  assigned_by_account_id: string | null;
}

async function loadTodo(
  id: string,
  tenantId: string | null,
): Promise<TodoOwnership | null> {
  let query = supabaseServer
    .from("koleex_todos")
    .select("id, tenant_id, created_by_account_id, assigned_by_account_id")
    .eq("id", id);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data } = await query.maybeSingle();
  return (data as TodoOwnership | null) ?? null;
}

function canModify(t: TodoOwnership, accountId: string, isSA: boolean): boolean {
  if (isSA) return true;
  return (
    t.created_by_account_id === accountId ||
    t.assigned_by_account_id === accountId
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "To-do");
  if (deny) return deny;

  const existing = await loadTodo(id, auth.tenant_id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canModify(existing, auth.account_id, auth.is_super_admin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    updates: Record<string, unknown>;
    newAssigneeIds?: string[];
  };
  const updates = { ...body.updates };
  delete updates.tenant_id;
  delete updates.id;
  delete updates.created_by_account_id;
  delete updates.created_at;
  updates.updated_at = new Date().toISOString();

  const { error } = await supabaseServer
    .from("koleex_todos")
    .update(updates)
    .eq("id", id);
  if (error) {
    console.error("[api/todos/[id] PATCH]", error.message);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  if (body.newAssigneeIds !== undefined) {
    await supabaseServer
      .from("koleex_todo_assignees")
      .delete()
      .eq("todo_id", id);
    if (body.newAssigneeIds.length > 0) {
      await supabaseServer.from("koleex_todo_assignees").insert(
        body.newAssigneeIds.map((accountId) => ({
          todo_id: id,
          account_id: accountId,
        })),
      );
    }
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
  const deny = await requireModuleAccess(auth, "To-do");
  if (deny) return deny;

  const existing = await loadTodo(id, auth.tenant_id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canModify(existing, auth.account_id, auth.is_super_admin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabaseServer
    .from("koleex_todos")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[api/todos/[id] DELETE]", error.message);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
