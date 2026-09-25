import "server-only";

/* ---------------------------------------------------------------------------
   planning-conflicts — the ONE server-side conflict check for planning writes.

   Every path that places an item on a resource runs it: POST / PATCH of an
   item (drag-and-drop and the timeline are PATCHes), taking an open shift,
   a recurring series, and the AI agent's create/update tools. It answers,
   per candidate:

     · double_booking — another item on the SAME resource overlaps it and
       is not cancelled (candidates in one batch are checked against each
       other too, so a series or a copied week can't double-book itself);
     · leave          — the resource's employee is on APPROVED HR leave on
       any day the item covers (days read in the caller's zone, else UTC).

   Travel: the Hub has no travel / trip booking table today (trip REPORTS are
   written after the fact and carry no approval of a planned absence), so no
   travel check runs. When a travel table lands, add it here — the routes and
   the UI already carry any `kind` through.

   Queries are bounded by the batch's own window and resources: one items
   query, and for leave one resources → employees → leave chain.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { safeTimeZone, zonedDateKey } from "@/lib/calendar-tz";

export type PlanningConflictKind = "double_booking" | "leave";

export interface PlanningConflictCandidate {
  id?: string | null;
  title?: string | null;
  resource_id: string | null;
  start_at: string;
  end_at: string;
  status?: string | null;
}

export interface PlanningConflict {
  kind: PlanningConflictKind;
  /** Index of the candidate in the checked batch. */
  index: number;
  item_id: string | null;
  title: string | null;
  resource_id: string;
  resource_name: string | null;
  start_at: string;
  end_at: string;
  other_id?: string | null;
  other_title?: string | null;
  other_start_at?: string;
  other_end_at?: string;
  leave_start?: string;
  leave_end?: string;
}

/** The most conflicts a response lists (the count is still exact). */
export const MAX_LISTED_CONFLICTS = 50;

const DAY_MS = 86_400_000;

/** Every local-day key ("YYYY-MM-DD") an item touches in `tz`. */
function coveredDayKeys(startIso: string, endIso: string, tz: string): string[] {
  const s = Date.parse(startIso);
  const e = Date.parse(endIso);
  const keys = new Set<string>();
  // The end is exclusive: an item ending exactly at midnight does not cover the next day.
  const last = Math.max(s, e - 1);
  for (let t = s; t <= last; t += DAY_MS / 2) keys.add(zonedDateKey(t, tz));
  keys.add(zonedDateKey(last, tz));
  return [...keys];
}

/**
 * Check a batch of candidate placements. `excludeIds` are rows that must
 * not count as "the other side" (the rows being edited or replaced).
 */
export async function checkPlanningConflicts(
  tenantId: string,
  candidates: PlanningConflictCandidate[],
  opts: { excludeIds?: string[]; tz?: string | null } = {},
): Promise<{ conflicts: PlanningConflict[]; total: number }> {
  const tz = safeTimeZone(opts.tz ?? "UTC");
  const live = candidates
    .map((c, index) => ({ c, index }))
    .filter(({ c }) => !!c.resource_id && c.status !== "cancelled" && Date.parse(c.end_at) > Date.parse(c.start_at));
  if (live.length === 0) return { conflicts: [], total: 0 };

  const resourceIds = [...new Set(live.map(({ c }) => c.resource_id as string))];
  const minStart = new Date(Math.min(...live.map(({ c }) => Date.parse(c.start_at)))).toISOString();
  const maxEnd = new Date(Math.max(...live.map(({ c }) => Date.parse(c.end_at)))).toISOString();
  const exclude = new Set([...(opts.excludeIds ?? []), ...live.map(({ c }) => c.id).filter((x): x is string => !!x)]);

  const [itemsRes, resRes] = await Promise.all([
    supabaseServer
      .from("planning_items")
      .select("id, title, type, resource_id, start_at, end_at")
      .eq("tenant_id", tenantId)
      .in("resource_id", resourceIds)
      .neq("status", "cancelled")
      .lt("start_at", maxEnd)
      .gt("end_at", minStart)
      .limit(5000),
    supabaseServer
      .from("planning_resources")
      .select("id, name, type, account_id")
      .eq("tenant_id", tenantId)
      .in("id", resourceIds),
  ]);
  if (itemsRes.error) throw new Error(itemsRes.error.message);
  if (resRes.error) throw new Error(resRes.error.message);

  type Row = { id: string; title: string | null; type: string; resource_id: string; start_at: string; end_at: string };
  const existing = ((itemsRes.data ?? []) as Row[]).filter((r) => !exclude.has(r.id));
  const byRes = new Map<string, Row[]>();
  for (const r of existing) {
    const arr = byRes.get(r.resource_id) ?? [];
    arr.push(r);
    byRes.set(r.resource_id, arr);
  }
  const resources = (resRes.data ?? []) as Array<{ id: string; name: string; type: string; account_id: string | null }>;
  const resName = new Map(resources.map((r) => [r.id, r.name]));

  const out: PlanningConflict[] = [];
  const base = (c: PlanningConflictCandidate, index: number) => ({
    index,
    item_id: c.id ?? null,
    title: c.title ?? null,
    resource_id: c.resource_id as string,
    resource_name: resName.get(c.resource_id as string) ?? null,
    start_at: c.start_at,
    end_at: c.end_at,
  });

  /* 1. Double booking — against stored rows, then within the batch. */
  for (const { c, index } of live) {
    const s = Date.parse(c.start_at);
    const e = Date.parse(c.end_at);
    for (const o of byRes.get(c.resource_id as string) ?? []) {
      if (Date.parse(o.start_at) < e && Date.parse(o.end_at) > s) {
        out.push({
          kind: "double_booking",
          ...base(c, index),
          other_id: o.id,
          other_title: o.title || o.type,
          other_start_at: o.start_at,
          other_end_at: o.end_at,
        });
      }
    }
  }
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const b = live[j];
      if (a.c.resource_id !== b.c.resource_id) continue;
      if (Date.parse(a.c.start_at) < Date.parse(b.c.end_at) && Date.parse(a.c.end_at) > Date.parse(b.c.start_at)) {
        out.push({
          kind: "double_booking",
          ...base(b.c, b.index),
          other_id: a.c.id ?? null,
          other_title: a.c.title ?? null,
          other_start_at: a.c.start_at,
          other_end_at: a.c.end_at,
        });
      }
    }
  }

  /* 2. Approved leave of the resource's employee. hr_leave_requests has no
        tenant column, so the chain runs FROM this tenant's resources (same
        rule as /api/planning/leaves). */
  const accountByRes = new Map(
    resources.filter((r) => r.type === "employee" && r.account_id).map((r) => [r.id, r.account_id as string]),
  );
  const accountIds = [...new Set(accountByRes.values())];
  if (accountIds.length > 0) {
    const fromKey = zonedDateKey(Date.parse(minStart) - DAY_MS, tz);
    const toKey = zonedDateKey(Date.parse(maxEnd) + DAY_MS, tz);
    const { data: emps, error: empErr } = await supabaseServer
      .from("koleex_employees")
      .select("id, account_id")
      .in("account_id", accountIds)
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
    if (empErr) throw new Error(empErr.message);
    const accountByEmp = new Map((emps ?? []).map((e) => [e.id as string, e.account_id as string]));
    const empIds = [...accountByEmp.keys()];
    if (empIds.length > 0) {
      const { data: reqs, error: lvErr } = await supabaseServer
        .from("hr_leave_requests")
        .select("employee_id, start_date, end_date")
        .eq("status", "approved")
        .in("employee_id", empIds)
        .lte("start_date", toKey)
        .gte("end_date", fromKey)
        .limit(1000);
      if (lvErr) throw new Error(lvErr.message);
      const leaveByAccount = new Map<string, Array<{ start: string; end: string }>>();
      for (const r of reqs ?? []) {
        const acct = accountByEmp.get(r.employee_id as string);
        if (!acct) continue;
        const arr = leaveByAccount.get(acct) ?? [];
        arr.push({ start: String(r.start_date).slice(0, 10), end: String(r.end_date).slice(0, 10) });
        leaveByAccount.set(acct, arr);
      }
      for (const { c, index } of live) {
        const acct = accountByRes.get(c.resource_id as string);
        const spans = acct ? leaveByAccount.get(acct) : undefined;
        if (!spans?.length) continue;
        const days = coveredDayKeys(c.start_at, c.end_at, tz);
        const hit = spans.find((sp) => days.some((d) => sp.start <= d && d <= sp.end));
        if (hit) out.push({ kind: "leave", ...base(c, index), leave_start: hit.start, leave_end: hit.end });
      }
    }
  }

  out.sort((a, b) => a.index - b.index || a.kind.localeCompare(b.kind));
  return { conflicts: out.slice(0, MAX_LISTED_CONFLICTS), total: out.length };
}

/** The 409 body every planning write answers with on a conflict. */
export function conflictBody(r: { conflicts: PlanningConflict[]; total: number }, canOverride: boolean) {
  return { error: "schedule_conflict", conflicts: r.conflicts, total: r.total, can_override: canOverride };
}
