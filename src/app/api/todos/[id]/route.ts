import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";

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
  const deny = await requireModuleAction(auth, "To-do", "edit");
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

  /* Mention-notify: if this edit sets metadata.mentions, capture the prior set
     first so we only ping people newly added (not on every save). */
  const nextMentions = (updates.metadata as { mentions?: Array<{ account_id?: string }> } | undefined)?.mentions;
  let priorMentionIds: string[] = [];
  if (Array.isArray(nextMentions)) {
    const { data: prev } = await supabaseServer
      .from("koleex_todos")
      .select("metadata")
      .eq("id", id)
      .maybeSingle();
    const pm = (prev as { metadata?: { mentions?: Array<{ account_id?: string }> } } | null)?.metadata?.mentions;
    priorMentionIds = Array.isArray(pm)
      ? (pm.map((m) => m.account_id).filter(Boolean) as string[])
      : [];
  }

  const { error } = await supabaseServer
    .from("koleex_todos")
    .update(updates)
    .eq("id", id);
  if (error) {
    console.error("[api/todos/[id] PATCH]", error.message);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  if (body.newAssigneeIds !== undefined) {
    /* Capture the prior assignee set BEFORE resyncing so we can notify only
       the people who are newly added (not everyone, every edit). */
    const { data: priorRows } = await supabaseServer
      .from("koleex_todo_assignees")
      .select("account_id")
      .eq("todo_id", id);
    const priorIds = new Set(
      (priorRows ?? []).map((r) => (r as { account_id: string }).account_id),
    );

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

    /* Fan out inbox notifications to newly-added assignees (excluding self),
       mirroring the POST create fan-out so assigning via edit also notifies. */
    const addedIds = body.newAssigneeIds.filter(
      (aid) => aid !== auth.account_id && !priorIds.has(aid),
    );
    if (addedIds.length > 0) {
      const { data: t } = await supabaseServer
        .from("koleex_todos")
        .select("title, description, priority")
        .eq("id", id)
        .maybeSingle();
      const td = (t as { title?: string; description?: string | null; priority?: string } | null) ?? {};
      const notifs = addedIds.map((recipientId) => ({
        recipient_account_id: recipientId,
        sender_account_id: auth.account_id,
        category: "task",
        subject: `New task: ${td.title ?? "Task"}`,
        body: td.description || td.title || "You have a new task.",
        link: `/todo?task=${id}`,
        metadata: {
          type: "todo_assignment",
          todo_id: id,
          priority: td.priority ?? "medium",
        },
      }));
      await supabaseServer.from("inbox_messages").insert(notifs);
    }
  }

  // Notify newly-added @mentions (excluding self + anyone already mentioned).
  if (Array.isArray(nextMentions)) {
    const prior = new Set(priorMentionIds);
    const added = Array.from(
      new Set(nextMentions.map((m) => m.account_id).filter(Boolean) as string[]),
    ).filter((mid) => mid !== auth.account_id && !prior.has(mid));
    if (added.length > 0) {
      const { data: t } = await supabaseServer
        .from("koleex_todos")
        .select("title, description")
        .eq("id", id)
        .maybeSingle();
      const td = (t as { title?: string; description?: string | null } | null) ?? {};
      await supabaseServer.from("inbox_messages").insert(
        added.map((recipientId) => ({
          recipient_account_id: recipientId,
          sender_account_id: auth.account_id,
          category: "task",
          subject: `You were mentioned: ${td.title ?? "Task"}`,
          body: td.description || td.title || "You were mentioned on a task.",
          link: `/todo?task=${id}`,
          metadata: { type: "todo_mention", todo_id: id },
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
  const deny = await requireModuleAction(auth, "To-do", "delete");
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
