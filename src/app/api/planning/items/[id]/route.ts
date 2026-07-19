import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { sendPushToAccounts } from "@/lib/server/web-push";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";

/* GET    /api/planning/items/:id — fetch a single item
   PATCH  /api/planning/items/:id — update fields (tenant-scoped)
   DELETE /api/planning/items/:id — hard delete */

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;
  const { id } = await params;

  const { data, error } = await supabaseServer
    .from("planning_items")
    .select(
      `*,
       resource:resource_id ( id, name, type, account_id, color, icon ),
       role:role_id ( id, name, color )`,
    )
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item: data });
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Planning", "edit");
  if (deny) return deny;
  const { id } = await params;

  const body = (await req.json()) as Record<string, unknown>;
  const allowed = [
    "type", "title", "notes", "resource_id", "role_id",
    "start_at", "end_at", "allocated_hours", "allocated_pct",
    "linked_entity_type", "linked_entity_id", "linked_entity_label",
    "is_billable", "hourly_rate", "status",
    "recurrence_rule",
  ];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) patch[k] = body[k];
  }

  // Lifecycle timestamps stay in sync when status changes.
  if (patch.status === "published" && !patch.published_at) {
    patch.published_at = new Date().toISOString();
  }
  if (patch.status === "completed") {
    patch.completed_at = new Date().toISOString();
  }
  if (patch.status === "cancelled") {
    patch.cancelled_at = new Date().toISOString();
  }

  // Look at the pre-update row so we can detect the draft → published
  // transition — that's when the assignee deserves an inbox notification
  // (not every time we touch a published row).
  const { data: prev } = await supabaseServer
    .from("planning_items")
    .select("status, resource_id")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();

  const { data, error } = await supabaseServer
    .from("planning_items")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const becamePublished =
    prev && prev.status !== "published" && data?.status === "published";
  if (becamePublished && data.resource_id) {
    void notifyAssigneeOnPublish(auth, data);
  }

  // Two-way sync: completing a planning item that a project task is linked
  // to logs the item's hours onto that task automatically.
  const becameCompleted =
    prev && prev.status !== "completed" && data?.status === "completed";
  if (becameCompleted) {
    void logHoursOnLinkedTask(auth, data);
  }

  return NextResponse.json({ item: data });
}

/** Mirrors the helper in the /publish route — DRYed out so both code
 *  paths notify identically. */
async function notifyAssigneeOnPublish(
  auth: { account_id: string; tenant_id: string },
  item: {
    id: string;
    title: string | null;
    type: string;
    start_at: string;
    resource_id: string | null;
  },
): Promise<void> {
  if (!item.resource_id) return;
  const { data: res } = await supabaseServer
    .from("planning_resources")
    .select("account_id")
    .eq("id", item.resource_id)
    .maybeSingle();
  if (!res?.account_id || res.account_id === auth.account_id) return;
  const start = new Date(item.start_at);
  const fmt = (d: Date) =>
    `${d.toLocaleDateString("en", { month: "short", day: "numeric" })} ${d.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" })}`;
  await supabaseServer.from("inbox_messages").insert({
    recipient_account_id: res.account_id,
    sender_account_id: auth.account_id,
    tenant_id: auth.tenant_id,
    category: "system",
    subject: `You've been scheduled: ${item.title || item.type}`,
    body: `A ${item.type} has been assigned to you starting ${fmt(start)}.`,
    link: "/planning",
    metadata: { source: "planning", planning_item_id: item.id, type: item.type },
  });
  try {
    await sendPushToAccounts(
      [res.account_id],
      {
        title: "You've been scheduled",
        body: `${item.title || item.type} — ${fmt(start)}`,
        url: "/planning",
        tag: `planning:${item.id}`,
        kind: "planning_published",
      },
      { actorAccountId: auth.account_id },
    );
  } catch (e) {
    console.error("[planning] publish push:", e);
  }
}

/** When a completed planning item is linked from a project task
 *  (task.linked_planning_item_id), add its hours to the task's logged_hours.
 *  Falls back to the item's wall-clock span when allocated_hours is unset.
 *  Fire-and-forget: never fails the PATCH. */
async function logHoursOnLinkedTask(
  auth: { account_id: string; tenant_id: string },
  item: { id: string; start_at: string; end_at: string; allocated_hours: number | null },
): Promise<void> {
  try {
    const { data: task } = await supabaseServer
      .from("project_tasks")
      .select("id, logged_hours")
      .eq("tenant_id", auth.tenant_id)
      .eq("linked_planning_item_id", item.id)
      .maybeSingle();
    if (!task) return;
    const spanH =
      (new Date(item.end_at).getTime() - new Date(item.start_at).getTime()) / 3_600_000;
    const add = item.allocated_hours ?? Math.round(spanH * 10) / 10;
    if (!add || add <= 0) return;
    await supabaseServer
      .from("project_tasks")
      .update({ logged_hours: (Number(task.logged_hours) || 0) + add })
      .eq("id", task.id)
      .eq("tenant_id", auth.tenant_id);
  } catch (e) {
    console.error("[planning] logHoursOnLinkedTask:", e);
  }
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Planning", "delete");
  if (deny) return deny;
  const { id } = await params;

  const { error } = await supabaseServer
    .from("planning_items")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
