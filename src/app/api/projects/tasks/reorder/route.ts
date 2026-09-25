import "server-only";

/* POST /api/projects/tasks/reorder — one board drag, one request.

   Body: { project_id, stage_id, ordered_ids: string[], moved_id }
     ordered_ids — the FULL target column top-to-bottom after the drop,
                   including the moved card.
     moved_id    — the dragged card (it may have changed stage).

   Replaces the old client loop that PATCHed every card in the column
   (≈4 queries each via the PATCH route) and then reloaded the whole board
   behind a spinner. Access: the project write gate, or ownership of the
   moved card (see below). Here: one access check, one membership check, a
   sort_order write for the MOVED card only (a position between its new
   neighbours — fractional once sort_order is double precision; the column
   is renumbered only when that gap is exhausted AND the caller has
   project write), and one stage/status update for the
   moved card (with the same stage⇄status rules as the PATCH route).
   Response: { moved, positions: { id → sort_order } for every card
   written }. */

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { assertProjectAccess, ownsTask, UUID_RE } from "@/lib/server/project-access";
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

  /* Project write access, or — for a view-only caller — ownership of the
     MOVED card (ownsTask, the per-task rule every task write route uses).
     Such a caller only ever writes that one card (see step 1). */
  const gate = await assertProjectAccess(auth, projectId, { write: true });
  let ownerOnly = false;
  if (gate instanceof NextResponse) {
    if (gate.status !== 403) return gate;
    ownerOnly = true;
  }

  const stages = await loadStages(auth.tenant_id, projectId);
  if (stageId && !stages.some((s) => s.id === stageId)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }

  const { data: rows, error: readErr } = await supabaseServer
    .from("project_tasks")
    .select("id, tenant_id, project_id, title, sort_order, stage_id, status, assignee_account_id, created_by_account_id")
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
  if (ownerOnly) {
    const m = byId.get(movedId)!;
    if (!ownsTask(auth, { assignee_account_id: (m.assignee_account_id as string | null) ?? null, created_by_account_id: (m.created_by_account_id as string | null) ?? null })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  /* 1. Position. The moved card alone gets a new sort_order strictly
        between its new neighbours' (placeMoved) — no other card is
        written. sort_order is double precision after
        20260930_projects_member_source, so the midpoint may be
        fractional and a gap only runs out after ~50 halvings of the same
        spot (or when the two neighbours share one value). Until that
        migration is applied the column is integer: a fractional write is
        refused (or comes back rounded), and the drop is planned again
        with integer midpoints. Only when the gap is exhausted:
          · a caller with project write renumbers the column (spaced by
            GAP, so later drops find room again);
          · an owner-only caller (view-only project, own card) never
            touches other cards: the card lands in the nearest slot that
            still has room (the column ends always do).
        The NOT NULL columns ride along in the upsert so the INSERT arm
        validates; every id exists, so only the UPDATE arm ever runs. */
  const k = ids.indexOf(movedId);
  const others = ids.filter((id) => id !== movedId).map((id) => byId.get(id)!);
  const sorts = others.map((r) => Number(r.sort_order) || 0);
  const moved0 = byId.get(movedId)!;
  const movedSort = Number(moved0.sort_order) || 0;
  type Row = typeof moved0;
  const plan = (fractional: boolean): { r: Row; sort: number }[] => {
    let slot = placeMoved(sorts, k, movedSort, fractional);
    if (slot === null && !ownerOnly) {
      return ids
        .map((id, i) => ({ r: byId.get(id)!, sort: (i + 1) * GAP }))
        .filter(({ r, sort }) => Number(r.sort_order) !== sort);
    }
    if (slot === null) slot = nearestSlot(sorts, k, fractional);
    return Number(moved0.sort_order) !== slot ? [{ r: moved0, sort: slot }] : [];
  };
  const toRows = (w: { r: Row; sort: number }[]) =>
    w.map(({ r, sort }) => ({ id: r.id, tenant_id: r.tenant_id, project_id: r.project_id, title: r.title, sort_order: sort }));
  const write = (rowsToWrite: ReturnType<typeof toRows>) =>
    supabaseServer.from("project_tasks").upsert(rowsToWrite, { onConflict: "id" }).select("id, sort_order");

  let changed = toRows(plan(true));
  if (changed.length > 0) {
    const first = await write(changed);
    const back = first.data;
    let error = first.error;
    const fractionalWrite = changed.some((c) => !Number.isInteger(c.sort_order));
    /* Integer column (migration pending): refused ("invalid input syntax
       for type integer") or stored rounded — plan again with integers. */
    const rounded = !error && fractionalWrite && ((back ?? []) as { id: string; sort_order: unknown }[]).some((b) => {
      const want = changed.find((c) => c.id === b.id)?.sort_order;
      return want !== undefined && Number(b.sort_order) !== want;
    });
    if (fractionalWrite && (rounded || error?.code === "22P02")) {
      let w = plan(false);
      /* A rounded write already landed: the moved card must be rewritten
         even when the integer plan would leave it where it was. */
      if (rounded && !w.some((x) => x.r.id === movedId)) w = [...w, { r: moved0, sort: movedSort }];
      changed = toRows(w);
      error = null;
      if (changed.length > 0) ({ error } = await write(changed));
    }
    if (error) {
      console.error("[api/projects/tasks/reorder] upsert:", error.message);
      return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
    }
  }
  const positions = Object.fromEntries(changed.map((c) => [c.id as string, c.sort_order]));

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
    /* id → new sort_order for every card written (usually just the moved one). */
    positions,
  });
}

/** Spacing for renumbered columns and for drops at a column end. */
const GAP = 1024;

/** A sort_order that puts the moved card at index `k` among `sorts` (the
 *  OTHER cards of the column, top→bottom) without touching them: above
 *  every card before k and below every card from k on. An integer
 *  midpoint when the gap allows one; otherwise, with `fractional` (a
 *  double precision column), the exact midpoint while it still differs
 *  from both neighbours. null = no room there (neighbours share a value,
 *  or the gap is exhausted). */
function placeMoved(sorts: number[], k: number, current: number | undefined, fractional: boolean): number | null {
  const before = sorts.slice(0, k);
  const after = sorts.slice(k);
  const lo = before.length > 0 ? Math.max(...before) : null;
  const hi = after.length > 0 ? Math.min(...after) : null;
  /* Already in place (or alone in the column): keep it — nothing to write. */
  if (current !== undefined && (lo === null || current > lo) && (hi === null || current < hi)) return current;
  if (lo === null && hi === null) return 0;
  if (lo === null) return Math.floor((hi as number) - GAP);
  if (hi === null) return Math.ceil(lo + GAP);
  if (hi - lo >= 2) return Math.floor((lo + hi) / 2);
  if (fractional && hi > lo) {
    const mid = lo + (hi - lo) / 2;
    if (mid > lo && mid < hi) return mid;
  }
  return null;
}

/** The slot closest to `k` that still has room (placeMoved not null). The
 *  two column ends always have room, so this always answers. */
function nearestSlot(sorts: number[], k: number, fractional: boolean): number {
  for (let d = 1; d <= sorts.length; d++) {
    for (const j of [k - d, k + d]) {
      if (j < 0 || j > sorts.length) continue;
      const v = placeMoved(sorts, j, undefined, fractional);
      if (v !== null) return v;
    }
  }
  return placeMoved(sorts, sorts.length, undefined, fractional) ?? 0;
}
