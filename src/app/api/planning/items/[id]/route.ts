import "server-only";

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { notifyPlanningPublished } from "@/lib/server/planning-notify";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import {
  checkPlanningRefs,
  loadPlanningItemForCaller,
  PLANNING_ERR,
} from "@/lib/server/planning-access";
import {
  logPlanningHoursOnTask,
  unlogPlanningHoursOnTask,
} from "@/lib/server/planning-project-sync";
import { validatePlanningItemInput } from "@/lib/planning-validate";

/* GET    /api/planning/items/:id — fetch a single item
   PATCH  /api/planning/items/:id — update fields
   DELETE /api/planning/items/:id — hard delete

   All three enforce the same ownership rule as the list route (see
   lib/server/planning-access.ts): a non-super-admin may READ items they
   created, items on their own resource and open shifts, and may WRITE only
   items they created or that sit on their own resource. Publishing is a
   PATCH { status: "published" } — the separate /publish route is gone. */

type RouteCtx = { params: Promise<{ id: string }> };

const err = (status: 400 | 403 | 404 | 500) =>
  NextResponse.json({ error: PLANNING_ERR[status] }, { status });

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;
  const { id } = await params;

  const r = await loadPlanningItemForCaller(
    auth,
    id,
    "read",
    `*,
     resource:resource_id ( id, name, type, account_id, color, icon ),
     role:role_id ( id, name, color )`,
  );
  if (!r.ok) return err(r.status);
  return NextResponse.json({ item: r.item }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Planning", "edit");
  if (deny) return deny;
  const { id } = await params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  /* Pre-update row: ownership gate, the effective start/end for validation,
     and the status transitions (draft → published notifies; entering /
     leaving "completed" syncs hours onto a linked project task). */
  const prevRes = await loadPlanningItemForCaller<{
    resource_id: string | null;
    created_by_account_id: string | null;
    status: string;
    start_at: string;
    end_at: string;
  }>(auth, id, "write", "id, status, resource_id, start_at, end_at, created_by_account_id");
  if (!prevRes.ok) return err(prevRes.status);
  const prev = prevRes.item;

  const parsed = validatePlanningItemInput(raw, "patch", prev);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.code, field: parsed.field }, { status: 400 });
  }
  const patch: Record<string, unknown> = { ...parsed.value };
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const badRef = await checkPlanningRefs(auth.tenant_id, {
    resource_id: "resource_id" in patch ? (patch.resource_id as string | null) : null,
    role_id: "role_id" in patch ? (patch.role_id as string | null) : null,
  });
  if (badRef) {
    return NextResponse.json({ error: badRef === "resource_id" ? "invalid_resource" : "invalid_role", field: badRef }, { status: 400 });
  }

  // Lifecycle timestamps stay in sync when status changes.
  const now = new Date().toISOString();
  if (patch.status === "published" && prev.status !== "published") patch.published_at = now;
  if (patch.status === "completed" && prev.status !== "completed") patch.completed_at = now;
  if (patch.status === "cancelled" && prev.status !== "cancelled") patch.cancelled_at = now;

  const { data, error } = await supabaseServer
    .from("planning_items")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[api/planning/items PATCH]", error.message);
    return err(500);
  }
  if (!data) return err(404);

  const becamePublished = prev.status !== "published" && data.status === "published";
  if (becamePublished && data.resource_id) {
    after(() => notifyPlanningPublished(auth, data));
  }

  /* Two-way sync with Projects — awaited, so the task's logged_hours is
     correct by the time the client refetches. */
  const becameCompleted = prev.status !== "completed" && data.status === "completed";
  const leftCompleted = prev.status === "completed" && data.status !== "completed";
  if (becameCompleted) await logPlanningHoursOnTask(auth, data);
  else if (leftCompleted) await unlogPlanningHoursOnTask(auth, data.id);

  return NextResponse.json({ item: data });
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Planning", "delete");
  if (deny) return deny;
  const { id } = await params;

  const r = await loadPlanningItemForCaller(auth, id, "write", "id, resource_id, created_by_account_id");
  if (!r.ok) return err(r.status);

  const { error } = await supabaseServer
    .from("planning_items")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) {
    console.error("[api/planning/items DELETE]", error.message);
    return err(500);
  }
  return NextResponse.json({ ok: true });
}
