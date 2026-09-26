import "server-only";

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { leftPublished, notifyPlanningPublished, notifyPlanningPublishedBatch, settlePlanningPublished } from "@/lib/server/planning-notify";
import { requireAuth, requireModuleAccess, requireModuleAction, type ServerAuthContext } from "@/lib/server/auth";
import {
  callerResourceIds,
  canWritePlanningRow,
  checkPlanningRefs,
  loadPlanningItemForCaller,
  PLANNING_ERR,
} from "@/lib/server/planning-access";
import { checkPlanningConflicts, conflictBody } from "@/lib/server/planning-conflicts";
import {
  logPlanningHoursOnTask,
  unlogPlanningHoursOnTask,
} from "@/lib/server/planning-project-sync";
import { validatePlanningItemInput } from "@/lib/planning-validate";
import {
  applyWallDelta,
  expandWeekly,
  parsePlanningRecurrence,
  parsePlanningTz,
  recurrenceRuleText,
  wallDelta,
} from "@/lib/planning-recurrence";

/* GET    /api/planning/items/:id — fetch a single item
   PATCH  /api/planning/items/:id — update fields
   DELETE /api/planning/items/:id — hard delete

   All three enforce the same ownership rule as the list route (see
   lib/server/planning-access.ts): a non-super-admin may READ items they
   created, items on their own resource and open shifts, and may WRITE only
   items they created or that sit on their own resource. Publishing is a
   PATCH { status: "published" } — the separate /publish route is gone.

   SERIES. Rows of a recurring series share recurrence_parent_id (see
   lib/planning-recurrence). `?scope=future` on PATCH / DELETE applies to
   this row and every LATER row of its series the caller may write; a time
   change is applied as a DELTA: each row's start moves by the change made
   to this row's start, and its end by the change made to this row's end,
   both as wall-clock changes in the planner's zone (DST-safe). A row that
   was resized on its own keeps its own length. A delta that would leave a
   later row ending at or before its start is refused (400
   series_end_before_start). Without the scope only this row changes. A PATCH carrying `recurrence` on a row
   that is not yet in a series turns it into the first row of a new one.

   CONFLICTS. A PATCH that moves an item in time, re-assigns it, or brings
   it back from cancelled runs the conflict check; 409 schedule_conflict
   unless a super admin sends `force: true`. */

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

interface PrevRow {
  id: string;
  resource_id: string | null;
  created_by_account_id: string | null;
  status: string;
  start_at: string;
  end_at: string;
  title: string | null;
  recurrence_parent_id: string | null;
}
const PREV_COLS = "id, status, resource_id, start_at, end_at, title, created_by_account_id, recurrence_parent_id";

export async function PATCH(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Planning", "edit");
  if (deny) return deny;
  const { id } = await params;
  const scopeFuture = new URL(req.url).searchParams.get("scope") === "future";

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  /* Pre-update row: ownership gate, the effective start/end for validation,
     and the status transitions (draft → published notifies; entering /
     leaving "completed" syncs hours onto a linked project task). */
  const prevRes = await loadPlanningItemForCaller<PrevRow>(auth, id, "write", PREV_COLS);
  if (!prevRes.ok) return err(prevRes.status);
  const prev = prevRes.item;

  const parsed = validatePlanningItemInput(raw, "patch", prev);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.code, field: parsed.field }, { status: 400 });
  }
  const extra = (raw ?? {}) as Record<string, unknown>;
  const tz = parsePlanningTz(extra.tz) ?? "UTC";
  const force = extra.force === true && auth.is_super_admin;
  const recurrence = parsePlanningRecurrence(extra.recurrence);
  if (recurrence === null) return NextResponse.json({ error: "invalid_recurrence", field: "recurrence" }, { status: 400 });

  const patch: Record<string, unknown> = { ...parsed.value };
  if (Object.keys(patch).length === 0 && !recurrence) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const badRef = await checkPlanningRefs(auth.tenant_id, {
    resource_id: "resource_id" in patch ? (patch.resource_id as string | null) : null,
    role_id: "role_id" in patch ? (patch.role_id as string | null) : null,
  });
  if (badRef) {
    return NextResponse.json({ error: badRef === "resource_id" ? "invalid_resource" : "invalid_role", field: badRef }, { status: 400 });
  }

  if (scopeFuture && prev.recurrence_parent_id) {
    return patchSeriesFuture(auth, prev, patch, { tz, force });
  }

  /* ── This row only (plus an optional new series after it) ── */
  const eff = {
    id: prev.id,
    title: (patch.title as string | undefined) ?? prev.title,
    resource_id: "resource_id" in patch ? (patch.resource_id as string | null) : prev.resource_id,
    start_at: (patch.start_at as string | undefined) ?? prev.start_at,
    end_at: (patch.end_at as string | undefined) ?? prev.end_at,
    status: (patch.status as string | undefined) ?? prev.status,
  };
  /* Compare VALUES, not keys: the modal always sends the full form, and
     editing the notes of an item must not be refused over its placement. */
  const placementChanged =
    !!recurrence ||
    Date.parse(eff.start_at) !== Date.parse(prev.start_at) ||
    Date.parse(eff.end_at) !== Date.parse(prev.end_at) ||
    eff.resource_id !== prev.resource_id ||
    (prev.status === "cancelled" && eff.status !== "cancelled");

  let extraRows: Array<{ id: string; start_at: string; end_at: string }> = [];
  if (recurrence) {
    if (prev.recurrence_parent_id) return NextResponse.json({ error: "invalid_recurrence", field: "recurrence" }, { status: 400 });
    const occ = expandWeekly(eff.start_at, eff.end_at, recurrence, tz);
    if (!occ) return NextResponse.json({ error: "invalid_recurrence", field: "recurrence" }, { status: 400 });
    extraRows = occ.slice(1).map((o) => ({ ...o, id: crypto.randomUUID() }));
    patch.recurrence_parent_id = prev.id;
    patch.recurrence_rule = recurrenceRuleText(recurrence);
  }

  if (placementChanged) {
    try {
      const check = await checkPlanningConflicts(
        auth.tenant_id,
        [eff, ...extraRows.map((r) => ({ ...eff, ...r }))],
        { tz },
      );
      if (check.total > 0 && !force) return NextResponse.json(conflictBody(check, auth.is_super_admin), { status: 409 });
    } catch (e) {
      console.error("[api/planning/items PATCH] conflicts:", e instanceof Error ? e.message : e);
      return err(500);
    }
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

  /* New series: clone the saved row onto every later occurrence. */
  let created: Record<string, unknown>[] = [];
  if (extraRows.length > 0) {
    const base = { ...(data as Record<string, unknown>) };
    delete base.id;
    delete base.created_at;
    delete base.updated_at;
    const { data: ins, error: iErr } = await supabaseServer
      .from("planning_items")
      .insert(extraRows.map((r) => ({ ...base, ...r, completed_at: null, created_by_account_id: auth.account_id })))
      .select("*");
    if (iErr) {
      console.error("[api/planning/items PATCH] series insert:", iErr.message);
      return err(500);
    }
    created = (ins ?? []) as Record<string, unknown>[];
  }

  if (leftPublished(prev, data)) {
    after(() => settlePlanningPublished(auth.tenant_id, [{ id: prev.id, resource_id: prev.resource_id }]));
  }
  const becamePublished = prev.status !== "published" && data.status === "published";
  if (becamePublished && data.resource_id) {
    if (created.length > 0) {
      const all = [data, ...created] as unknown as Parameters<typeof notifyPlanningPublishedBatch>[1];
      after(() => notifyPlanningPublishedBatch(auth, all));
    } else {
      after(() => notifyPlanningPublished(auth, data));
    }
  }

  /* Two-way sync with Projects — awaited, so the task's logged_hours is
     correct by the time the client refetches. */
  const becameCompleted = prev.status !== "completed" && data.status === "completed";
  const leftCompleted = prev.status === "completed" && data.status !== "completed";
  if (becameCompleted) await logPlanningHoursOnTask(auth, data);
  else if (leftCompleted) await unlogPlanningHoursOnTask(auth, data.id);

  return NextResponse.json({ item: data, items: [data, ...created] });
}

/** PATCH ?scope=future — this row and every later row of its series. */
async function patchSeriesFuture(
  auth: ServerAuthContext,
  prev: PrevRow,
  patch: Record<string, unknown>,
  opts: { tz: string; force: boolean },
) {
  /* Completing a whole run of future shifts makes no sense and would log
     hours onto a project for work not done. */
  if (patch.status === "completed") return NextResponse.json({ error: "invalid_status", field: "status" }, { status: 400 });
  delete patch.recurrence_rule;

  const [rowsRes, rids] = await Promise.all([
    supabaseServer
      .from("planning_items")
      .select(PREV_COLS)
      .eq("tenant_id", auth.tenant_id)
      .eq("recurrence_parent_id", prev.recurrence_parent_id as string)
      .gte("start_at", prev.start_at)
      .order("start_at", { ascending: true })
      .limit(500),
    auth.is_super_admin ? Promise.resolve([] as string[]) : callerResourceIds(auth),
  ]);
  if (rowsRes.error) {
    console.error("[api/planning/items PATCH future]", rowsRes.error.message);
    return err(500);
  }
  const rows = ((rowsRes.data ?? []) as unknown as PrevRow[]).filter((r) => canWritePlanningRow(auth, rids, r));
  if (!rows.some((r) => r.id === prev.id)) rows.unshift(prev);

  const ms = (s: string) => Date.parse(s);
  /* Deltas from the edited row, as wall-clock changes in the planner's
     zone: "start 30 min later, end 1 h later" lands on each row's own wall
     times, so a row resized on its own keeps its length and a DST change
     inside the series does not shift anything by an hour. */
  const newStartIso = (patch.start_at as string | undefined) ?? prev.start_at;
  const newEndIso = (patch.end_at as string | undefined) ?? prev.end_at;
  const startMoved = ms(newStartIso) !== ms(prev.start_at);
  const endMoved = ms(newEndIso) !== ms(prev.end_at);
  const timeChanged = startMoved || endMoved;
  const dStart = wallDelta(prev.start_at, newStartIso, opts.tz);
  const dEnd = wallDelta(prev.end_at, newEndIso, opts.tz);

  const now = new Date().toISOString();
  const updates = rows.map((r) => {
    const u: Record<string, unknown> = { ...patch };
    delete u.start_at;
    delete u.end_at;
    if (timeChanged) {
      if (r.id === prev.id) {
        /* The edited row gets exactly what was entered. */
        u.start_at = new Date(ms(newStartIso)).toISOString();
        u.end_at = new Date(ms(newEndIso)).toISOString();
      } else {
        u.start_at = startMoved ? applyWallDelta(r.start_at, dStart, opts.tz) : r.start_at;
        u.end_at = endMoved ? applyWallDelta(r.end_at, dEnd, opts.tz) : r.end_at;
      }
    }
    if (patch.status === "published" && r.status !== "published") u.published_at = now;
    if (patch.status === "cancelled" && r.status !== "cancelled") u.cancelled_at = now;
    return { row: r, u };
  });
  if (timeChanged && updates.some(({ u }) => ms(u.end_at as string) <= ms(u.start_at as string))) {
    return NextResponse.json({ error: "series_end_before_start", field: "end_at" }, { status: 400 });
  }

  const placementChanged =
    timeChanged ||
    ("resource_id" in patch && patch.resource_id !== prev.resource_id) ||
    ("status" in patch && patch.status !== "cancelled" && rows.some((r) => r.status === "cancelled"));
  if (placementChanged) {
    try {
      const check = await checkPlanningConflicts(
        auth.tenant_id,
        updates.map(({ row, u }) => ({
          id: row.id,
          title: (u.title as string | undefined) ?? row.title,
          resource_id: "resource_id" in u ? (u.resource_id as string | null) : row.resource_id,
          start_at: (u.start_at as string | undefined) ?? row.start_at,
          end_at: (u.end_at as string | undefined) ?? row.end_at,
          status: (u.status as string | undefined) ?? row.status,
        })),
        { tz: opts.tz, excludeIds: rows.map((r) => r.id) },
      );
      if (check.total > 0 && !opts.force) return NextResponse.json(conflictBody(check, auth.is_super_admin), { status: 409 });
    } catch (e) {
      console.error("[api/planning/items PATCH future] conflicts:", e instanceof Error ? e.message : e);
      return err(500);
    }
  }

  const saved: Record<string, unknown>[] = [];
  for (let i = 0; i < updates.length; i += 20) {
    const chunk = updates.slice(i, i + 20);
    const res = await Promise.all(
      chunk.map(({ row, u }) =>
        supabaseServer.from("planning_items").update(u).eq("id", row.id).eq("tenant_id", auth.tenant_id).select("*").maybeSingle(),
      ),
    );
    for (const r of res) {
      if (r.error) {
        console.error("[api/planning/items PATCH future] update:", r.error.message);
        return err(500);
      }
      if (r.data) saved.push(r.data as Record<string, unknown>);
    }
  }

  const prevStatus = new Map(rows.map((r) => [r.id, r.status]));
  const prevById = new Map(rows.map((r) => [r.id, r]));
  const unannounced = saved
    .filter((d) => { const b = prevById.get(d.id as string); return !!b && leftPublished(b, d); })
    .map((d) => ({ id: d.id as string, resource_id: prevById.get(d.id as string)!.resource_id }));
  if (unannounced.length > 0) after(() => settlePlanningPublished(auth.tenant_id, unannounced));
  const newlyPublished = saved.filter((d) => d.status === "published" && prevStatus.get(d.id as string) !== "published");
  if (newlyPublished.length > 0) {
    const list = newlyPublished as unknown as Parameters<typeof notifyPlanningPublishedBatch>[1];
    after(() => notifyPlanningPublishedBatch(auth, list));
  }
  for (const d of saved) {
    if (prevStatus.get(d.id as string) === "completed" && d.status !== "completed") await unlogPlanningHoursOnTask(auth, d.id as string);
  }

  const item = saved.find((d) => d.id === prev.id) ?? saved[0] ?? null;
  if (!item) return err(404);
  return NextResponse.json({ item, items: saved });
}

export async function DELETE(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Planning", "delete");
  if (deny) return deny;
  const { id } = await params;
  const scopeFuture = new URL(req.url).searchParams.get("scope") === "future";

  const r = await loadPlanningItemForCaller<PrevRow>(auth, id, "write", PREV_COLS);
  if (!r.ok) return err(r.status);

  let ids = [id];
  let doomed: PrevRow[] = [r.item];
  if (scopeFuture && r.item.recurrence_parent_id) {
    const [rowsRes, rids] = await Promise.all([
      supabaseServer
        .from("planning_items")
        .select(PREV_COLS)
        .eq("tenant_id", auth.tenant_id)
        .eq("recurrence_parent_id", r.item.recurrence_parent_id)
        .gte("start_at", r.item.start_at)
        .limit(500),
      auth.is_super_admin ? Promise.resolve([] as string[]) : callerResourceIds(auth),
    ]);
    if (rowsRes.error) {
      console.error("[api/planning/items DELETE future]", rowsRes.error.message);
      return err(500);
    }
    const more = ((rowsRes.data ?? []) as unknown as PrevRow[]).filter((x) => canWritePlanningRow(auth, rids, x));
    ids = [...new Set([id, ...more.map((x) => x.id)])];
    doomed = [r.item, ...more];
  }

  const { error } = await supabaseServer
    .from("planning_items")
    .delete()
    .in("id", ids)
    .eq("tenant_id", auth.tenant_id);
  if (error) {
    console.error("[api/planning/items DELETE]", error.message);
    return err(500);
  }
  const wasPublished = doomed.filter((x) => x.status === "published").map((x) => ({ id: x.id, resource_id: x.resource_id }));
  if (wasPublished.length > 0) after(() => settlePlanningPublished(auth.tenant_id, wasPublished));
  return NextResponse.json({ ok: true, ids });
}
