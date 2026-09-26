import "server-only";

/* ---------------------------------------------------------------------------
   planning-week — week-level bulk actions, shared by the routes
   (/api/planning/week/copy, /api/planning/week/publish) and the AI agent's
   copyLastWeek / publishWeek tools, so both obey the same rules:

     · only rows the caller may WRITE (planning-access: created by me or on
       my resource; super admin: all rows of the tenant);
     · optionally narrowed to the resources on screen (`resourceIds`, plus
       `includeOpen` for the Open-shifts row);
     · every query is bounded by the week window.

   Copy last week: every non-cancelled item that STARTS in the previous week
   is copied +7 days (same wall time in the planner's zone) as a DRAFT;
   a copy is skipped when the target week already holds an identical row
   (same resource, start, end, type, title). Series links are not copied.

   Publish week: every DRAFT overlapping the week flips to published in one
   UPDATE; the people behind the resources get ONE grouped notice each.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { callerResourceIds, type PlanningCaller } from "@/lib/server/planning-access";
import { notifyPlanningPublishedBatch } from "@/lib/server/planning-notify";
import { shiftDaysInZone } from "@/lib/planning-recurrence";

export interface WeekScope {
  /** Instant the week starts at (the board's Monday 00:00, planner's zone). */
  weekStart: string;
  /** Resources on screen; null = every resource. */
  resourceIds: string[] | null;
  /** Include unassigned (open-shift) rows. */
  includeOpen: boolean;
  tz: string;
}

const COPY_COLS =
  "id, type, title, notes, resource_id, role_id, start_at, end_at, allocated_hours, allocated_pct, linked_entity_type, linked_entity_id, linked_entity_label, is_billable, hourly_rate, status, created_by_account_id";

type Row = {
  id: string;
  type: string;
  title: string | null;
  notes: string | null;
  resource_id: string | null;
  role_id: string | null;
  start_at: string;
  end_at: string;
  allocated_hours: number | null;
  allocated_pct: number | null;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  linked_entity_label: string | null;
  is_billable: boolean;
  hourly_rate: number | null;
  status: string;
  created_by_account_id: string | null;
};

async function writableFilter(caller: PlanningCaller, scope: WeekScope) {
  const mine = caller.is_super_admin ? null : new Set(await callerResourceIds(caller));
  const visible = scope.resourceIds ? new Set(scope.resourceIds) : null;
  return (r: Pick<Row, "resource_id" | "created_by_account_id">) => {
    if (mine && !(r.created_by_account_id === caller.account_id || (r.resource_id && mine.has(r.resource_id)))) return false;
    if (!r.resource_id) return scope.includeOpen;
    return visible ? visible.has(r.resource_id) : true;
  };
}

const ms = (iso: string) => Date.parse(iso);
const dupKey = (r: Pick<Row, "resource_id" | "start_at" | "end_at" | "type" | "title">) =>
  `${r.resource_id ?? "-"}|${ms(r.start_at)}|${ms(r.end_at)}|${r.type}|${(r.title ?? "").trim().toLowerCase()}`;

export interface CopyWeekResult {
  /** Rows that would be / were created. */
  count: number;
  /** Source rows skipped because the target week already has them. */
  skipped: number;
  created: Record<string, unknown>[];
}

export async function copyLastWeek(caller: PlanningCaller, scope: WeekScope, preview: boolean): Promise<CopyWeekResult> {
  const targetStart = new Date(ms(scope.weekStart)).toISOString();
  const sourceStart = shiftDaysInZone(targetStart, -7, scope.tz);
  const targetEnd = shiftDaysInZone(targetStart, 7, scope.tz);

  const { data: src, error } = await supabaseServer
    .from("planning_items")
    .select(COPY_COLS)
    .eq("tenant_id", caller.tenant_id)
    .neq("status", "cancelled")
    .gte("start_at", sourceStart)
    .lt("start_at", targetStart)
    .order("start_at", { ascending: true })
    .limit(2000);
  if (error) throw new Error(error.message);

  const allowed = await writableFilter(caller, scope);
  const source = ((src ?? []) as Row[]).filter(allowed);
  if (source.length === 0) return { count: 0, skipped: 0, created: [] };

  const { data: tgt, error: tErr } = await supabaseServer
    .from("planning_items")
    .select("resource_id, start_at, end_at, type, title")
    .eq("tenant_id", caller.tenant_id)
    .neq("status", "cancelled")
    .gte("start_at", targetStart)
    .lt("start_at", targetEnd)
    .limit(5000);
  if (tErr) throw new Error(tErr.message);
  const taken = new Set(((tgt ?? []) as Row[]).map(dupKey));

  const now = caller.account_id;
  const rows: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const r of source) {
    const start_at = shiftDaysInZone(r.start_at, 7, scope.tz);
    const end_at = new Date(ms(start_at) + (ms(r.end_at) - ms(r.start_at))).toISOString();
    const k = dupKey({ ...r, start_at, end_at });
    if (taken.has(k)) {
      skipped++;
      continue;
    }
    taken.add(k);
    rows.push({
      tenant_id: caller.tenant_id,
      type: r.type,
      title: r.title ?? "",
      notes: r.notes,
      resource_id: r.resource_id,
      role_id: r.role_id,
      start_at,
      end_at,
      allocated_hours: r.allocated_hours,
      allocated_pct: r.allocated_pct,
      linked_entity_type: r.linked_entity_type,
      linked_entity_id: r.linked_entity_id,
      linked_entity_label: r.linked_entity_label,
      is_billable: r.is_billable,
      hourly_rate: r.hourly_rate,
      status: "draft",
      created_by_account_id: now,
    });
  }
  if (preview || rows.length === 0) return { count: rows.length, skipped, created: [] };

  const { data: ins, error: iErr } = await supabaseServer.from("planning_items").insert(rows).select("*");
  if (iErr) throw new Error(iErr.message);
  return { count: rows.length, skipped, created: (ins ?? []) as Record<string, unknown>[] };
}

export interface PublishWeekResult {
  count: number;
  /** Distinct people who get a notice. */
  people: number;
  published: Record<string, unknown>[];
}

export async function publishWeek(
  caller: PlanningCaller & { username?: string | null },
  scope: WeekScope,
  preview: boolean,
  notify: (fn: () => Promise<void>) => void,
): Promise<PublishWeekResult> {
  const start = new Date(ms(scope.weekStart)).toISOString();
  const end = shiftDaysInZone(start, 7, scope.tz);
  const { data, error } = await supabaseServer
    .from("planning_items")
    .select("id, resource_id, created_by_account_id, resource:resource_id ( account_id )")
    .eq("tenant_id", caller.tenant_id)
    .eq("status", "draft")
    .gte("end_at", start)
    .lt("start_at", end)
    .limit(2000);
  if (error) throw new Error(error.message);

  const allowed = await writableFilter(caller, scope);
  type DraftRow = Pick<Row, "id" | "resource_id" | "created_by_account_id"> & { resource: unknown };
  const drafts = ((data ?? []) as DraftRow[]).filter(allowed);
  const acctOf = (r: DraftRow) => {
    const res = Array.isArray(r.resource) ? r.resource[0] : r.resource;
    return (res as { account_id?: string | null } | null)?.account_id ?? null;
  };
  const people = new Set(drafts.map(acctOf).filter((a): a is string => !!a && a !== caller.account_id)).size;
  if (preview || drafts.length === 0) return { count: drafts.length, people, published: [] };

  const now = new Date().toISOString();
  const ids = drafts.map((d) => d.id);
  const published: Record<string, unknown>[] = [];
  // Chunk the id list so the PostgREST URL stays short.
  for (let i = 0; i < ids.length; i += 200) {
    const { data: up, error: uErr } = await supabaseServer
      .from("planning_items")
      .update({ status: "published", published_at: now })
      .eq("tenant_id", caller.tenant_id)
      .eq("status", "draft")
      .in("id", ids.slice(i, i + 200))
      .select("*");
    if (uErr) throw new Error(uErr.message);
    published.push(...((up ?? []) as Record<string, unknown>[]));
  }
  if (published.length > 0) {
    const list = published as unknown as Array<{ id: string; title: string | null; type: string; start_at: string; resource_id: string | null }>;
    notify(() => notifyPlanningPublishedBatch(caller, list));
  }
  return { count: published.length, people, published };
}
