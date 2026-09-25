import "server-only";

/* POST /api/projects/tasks/reorder — one board drag, one request.

   Body: { project_id, stage_id, ordered_ids: string[], moved_id }
     ordered_ids — the FULL target column top-to-bottom after the drop,
                   including the moved card.
     moved_id    — the dragged card (it may have changed stage).

   Replaces the old client loop that PATCHed every card in the column
   (≈4 queries each via the PATCH route) and then reloaded the whole board
   behind a spinner. Here: one access check, one membership check, one
   batched sort_order upsert for the cards whose position actually changed,
   and one stage/status update for the moved card (with the same
   stage⇄status rules as the PATCH route). */

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { assertProjectAccess, UUID_RE } from "@/lib/server/project-access";
import { loadStages, reconcileStageStatus } from "@/lib/server/project-task-rules";
import { recomputeProjectProgress } from "@/lib/server/project-progress";
import { clearTaskNotifications } from "@/lib/server/project-notify";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as {
    project_id?: unknown; stage_id?: unknown; ordered_ids?: unknown; moved_id?: unknown;
  } | null;
  const projectId = typeof body?.project_id === "string" ? body.project_id : "";
  const stageId = body?.stage_id === null ? null : typeof body?.stage_id === "string" ? body.stage_id : undefined;
  const movedId = typeof body?.moved_id === "string" ? body.moved_id : "";
  const ordered = Array.isArray(body?.ordered_ids) ? (body!.ordered_ids as unknown[]) : null;
  if (
    !UUID_RE.test(projectId) || stageId === undefined || (stageId !== null && !UUID_RE.test(stageId)) ||
    !UUID_RE.test(movedId) || !ordered || ordered.length === 0 || ordered.length > 1000 ||
    !ordered.every((x) => typeof x === "string" && UUID_RE.test(x)) || !ordered.includes(movedId) ||
    new Set(ordered).size !== ordered.length
  ) {
    return NextResponse.json({ error: "Invalid reorder request" }, { status: 400 });
  }
  const ids = ordered as string[];

  const gate = await assertProjectAccess(auth, projectId);
  if (gate instanceof NextResponse) return gate;

  const stages = await loadStages(auth.tenant_id, projectId);
  if (stageId && !stages.some((s) => s.id === stageId)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }

  const { data: rows, error: readErr } = await supabaseServer
    .from("project_tasks")
    .select("id, tenant_id, project_id, title, sort_order, stage_id, status")
    .eq("tenant_id", auth.tenant_id)
    .eq("project_id", projectId)
    .in("id", ids);
  if (readErr) {
    console.error("[api/projects/tasks/reorder]", readErr.message);
    return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
  }
  const byId = new Map((rows ?? []).map((r) => [r.id as string, r]));
  if (byId.size !== ids.length) {
    return NextResponse.json({ error: "Task is not in this project" }, { status: 400 });
  }

  /* 1. Positions — only rows whose sort_order changes, in one upsert. The
        NOT NULL columns ride along unchanged so the INSERT arm validates;
        every id exists, so only the UPDATE arm ever runs. */
  const changed = ids
    .map((id, i) => ({ r: byId.get(id)!, i }))
    .filter(({ r, i }) => r.sort_order !== i)
    .map(({ r, i }) => ({ id: r.id, tenant_id: r.tenant_id, project_id: r.project_id, title: r.title, sort_order: i }));
  if (changed.length > 0) {
    const { error } = await supabaseServer.from("project_tasks").upsert(changed, { onConflict: "id" });
    if (error) {
      console.error("[api/projects/tasks/reorder] upsert:", error.message);
      return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
    }
  }

  /* 2. The moved card's stage (and the status that follows from it). */
  const moved = byId.get(movedId)!;
  let movedPatch: Record<string, unknown> = {};
  if ((moved.stage_id ?? null) !== stageId) {
    movedPatch = reconcileStageStatus(
      { status: moved.status as string, stage_id: (moved.stage_id as string | null) ?? null },
      { stage_id: stageId },
      stages,
    );
    const { error } = await supabaseServer
      .from("project_tasks")
      .update(movedPatch)
      .eq("id", movedId)
      .eq("tenant_id", auth.tenant_id);
    if (error) {
      console.error("[api/projects/tasks/reorder] move:", error.message);
      return NextResponse.json({ error: "Failed to move task" }, { status: 500 });
    }
    const becameDone = movedPatch.status === "done" && moved.status !== "done";
    const statusChanged = "status" in movedPatch && movedPatch.status !== moved.status;
    after(async () => {
      if (becameDone) await clearTaskNotifications(movedId);
      if (statusChanged) await recomputeProjectProgress(auth.tenant_id, projectId);
    });
  }

  return NextResponse.json({
    ok: true,
    moved: { id: movedId, stage_id: stageId, status: (movedPatch.status as string | undefined) ?? moved.status },
  });
}
