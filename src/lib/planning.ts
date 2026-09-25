"use client";

/* ---------------------------------------------------------------------------
   planning — client-side fetchers + shared types for the Planning app.

   Every function here hits the authenticated /api/planning/* routes so
   RLS bypass (service_role) stays server-side.

   READS GO THROUGH cachedGet WITH TTL 0. That is deliberate and is NOT a
   cache: cachedGet returns an already-in-flight promise before it ever looks
   at the TTL, so ttl 0 buys request COALESCING with no stale-data risk — a
   second identical read fired in the same tick joins the first instead of
   opening its own connection. Measured on a prod build, /planning issued all
   four of its opening reads TWICE, 1-3ms apart (items · resources · roles ·
   leaves), the slowest pair costing 779ms each. Writes are untouched.

   ERRORS ARE NOT SWALLOWED. Every read used to `.catch(() => [])`, so a
   failed request painted as "Nothing scheduled" — the screen could not tell
   an empty week from a broken one. Reads and the app's writes now throw a
   PlanningApiError (HTTP status + the route's error code) and the caller
   decides. `createItem` alone keeps its null-on-failure contract because
   Projects' "Schedule in Planning" action depends on it.
   --------------------------------------------------------------------------- */

import { cachedGet } from "./client-cache";
import { fmtDMY } from "./finance/format";
import { fromWall, toWall } from "./calendar-tz";

export class PlanningApiError extends Error {
  status: number;
  code: string;
  /** The parsed JSON error body (a schedule conflict carries its list). */
  body: Record<string, unknown> | null;
  constructor(status: number, code: string, body: Record<string, unknown> | null = null) {
    super(code || `HTTP ${status}`);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/* ── Schedule conflicts (409 schedule_conflict) ── */

export interface PlanningConflict {
  /** travel = approved HR leave of a business-trip type; out_of_office = a Calendar out-of-office event. */
  kind: "double_booking" | "leave" | "travel" | "out_of_office";
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
  away_start_at?: string;
  away_end_at?: string;
}

export interface PlanningConflictInfo {
  conflicts: PlanningConflict[];
  total: number;
  canOverride: boolean;
}

/** The conflict list of a refused write, or null for any other failure. */
export function conflictInfo(e: unknown): PlanningConflictInfo | null {
  if (!(e instanceof PlanningApiError) || e.status !== 409 || e.code !== "schedule_conflict" || !e.body) return null;
  const list = Array.isArray(e.body.conflicts) ? (e.body.conflicts as PlanningConflict[]) : [];
  return { conflicts: list, total: Number(e.body.total ?? list.length), canOverride: e.body.can_override === true };
}

async function send<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: "include", cache: "no-store", ...init });
  } catch {
    throw new PlanningApiError(0, "network");
  }
  if (!res.ok) {
    let code = "";
    let body: Record<string, unknown> | null = null;
    try {
      body = (await res.json()) as Record<string, unknown>;
      code = String(body.error ?? "");
    } catch { /* non-JSON error body */ }
    throw new PlanningApiError(res.status, code, body);
  }
  return (await res.json()) as T;
}

const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: body === undefined ? undefined : { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

/** cachedGet throws a plain Error on non-OK; normalise to PlanningApiError. */
async function read<T>(url: string): Promise<T> {
  try {
    return await cachedGet<T>(url, 0);
  } catch (e) {
    if (e instanceof PlanningApiError) throw e;
    const m = /HTTP (\d{3})/.exec(e instanceof Error ? e.message : "");
    throw new PlanningApiError(m ? Number(m[1]) : 0, m ? "http" : "network");
  }
}

export type PlanningItemType =
  | "shift"
  | "meeting"
  | "production"
  | "delivery"
  | "maintenance"
  | "project_task"
  | "room_booking"
  | "other";

export type PlanningStatus = "draft" | "published" | "completed" | "cancelled";

export type PlanningResourceType =
  | "employee"
  | "material"
  | "room"
  | "vehicle"
  | "other";

export interface PlanningRole {
  id: string;
  tenant_id: string;
  name: string;
  color: string | null;
  hourly_rate: number | null;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface PlanningResource {
  id: string;
  tenant_id: string;
  type: PlanningResourceType;
  account_id: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  capacity_hours_per_day: number | null;
  hourly_cost: number | null;
  is_active: boolean;
}

export interface PlanningItem {
  id: string;
  tenant_id: string;
  type: PlanningItemType;
  title: string;
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
  status: PlanningStatus;
  published_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  recurrence_rule: string | null;
  recurrence_parent_id: string | null;
  created_by_account_id: string | null;
  created_at: string;
  updated_at: string;
  resource?: Pick<PlanningResource, "id" | "name" | "type" | "account_id" | "color" | "icon"> | null;
  role?: Pick<PlanningRole, "id" | "name" | "color"> | null;
}

/* ── Type / labels ── */

export const ITEM_TYPE_LABELS: Record<PlanningItemType, string> = {
  shift: "Shift",
  meeting: "Meeting",
  production: "Production",
  delivery: "Delivery",
  maintenance: "Maintenance",
  project_task: "Project Task",
  room_booking: "Room Booking",
  other: "Other",
};

export const ITEM_TYPE_COLOR: Record<PlanningItemType, string> = {
  shift: "#60a5fa",
  meeting: "#a78bfa",
  production: "#fbbf24",
  delivery: "#34d399",
  maintenance: "#f472b6",
  project_task: "#818cf8",
  room_booking: "#38bdf8",
  other: "#94a3b8",
};

/* ── Items ── */

export interface FetchItemsParams {
  start?: string;
  end?: string;
  resource_id?: string;
  role_id?: string;
  type?: PlanningItemType;
  status?: PlanningStatus;
  open?: boolean;
  mine?: boolean;
  linked_entity_type?: string;
  linked_entity_id?: string;
  limit?: number;
}

function itemsQuery(params: FetchItemsParams): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    if (typeof v === "boolean") {
      if (v) q.set(k, "1");
    } else {
      q.set(k, String(v));
    }
  });
  return q.toString();
}

/** List items. Throws PlanningApiError on failure. */
export async function fetchItems(params: FetchItemsParams = {}): Promise<PlanningItem[]> {
  const { items } = await read<{ items: PlanningItem[] }>(`/api/planning/items?${itemsQuery(params)}`);
  return items ?? [];
}

/** One item (ownership-checked server side). Throws on failure. */
export async function fetchItem(id: string): Promise<PlanningItem> {
  const { item } = await send<{ item: PlanningItem }>(`/api/planning/items/${encodeURIComponent(id)}`, { method: "GET" });
  return item;
}

/** Weekly recurrence sent with a create (or an edit that starts a series).
 *  weekdays: 0 = Sunday … 6 = Saturday; until: "YYYY-MM-DD" inclusive. */
export interface RecurrenceInput {
  weekdays: number[];
  until: string;
}

/** Extra write options every item write understands. */
export interface WriteOptions {
  /** Super admin only: save despite a schedule conflict. */
  force?: boolean;
  /** The planner's IANA zone (series wall time, leave days). */
  tz?: string;
  recurrence?: RecurrenceInput;
}

export type ItemPayload = Partial<PlanningItem> & { start_at: string; end_at: string };

/** Create — throws PlanningApiError on failure. A recurring create answers
 *  every row of the new series in `items`. */
export async function createItemsOrThrow(body: ItemPayload, opts: WriteOptions = {}): Promise<PlanningItem[]> {
  const res = await send<{ item: PlanningItem; items?: PlanningItem[] }>(
    "/api/planning/items",
    jsonInit("POST", { ...body, ...opts }),
  );
  return res.items?.length ? res.items : [res.item];
}

/** Create — throws PlanningApiError on failure. */
export async function createItemOrThrow(body: ItemPayload, opts: WriteOptions = {}): Promise<PlanningItem> {
  return (await createItemsOrThrow(body, opts))[0];
}

/** Create — null on failure (contract kept for Projects' caller). */
export async function createItem(
  body: Partial<PlanningItem> & { start_at: string; end_at: string },
): Promise<PlanningItem | null> {
  try {
    return await createItemOrThrow(body);
  } catch {
    return null;
  }
}

/** "this" = only this row; "future" = this row and every later row of its series. */
export type SeriesScope = "this" | "future";

export async function updateItem(id: string, patch: Partial<PlanningItem>, opts: WriteOptions = {}): Promise<PlanningItem> {
  return (await updateItems(id, patch, opts))[0];
}

/** Update; answers every row that changed (a series edit touches many). */
export async function updateItems(
  id: string,
  patch: Partial<PlanningItem>,
  opts: WriteOptions & { scope?: SeriesScope } = {},
): Promise<PlanningItem[]> {
  const { scope, ...rest } = opts;
  const q = scope === "future" ? "?scope=future" : "";
  const res = await send<{ item: PlanningItem; items?: PlanningItem[] }>(
    `/api/planning/items/${encodeURIComponent(id)}${q}`,
    jsonInit("PATCH", { ...patch, ...rest }),
  );
  return res.items?.length ? res.items : [res.item];
}

/** Delete; answers the ids removed (a series delete removes many). */
export async function deleteItem(id: string, scope: SeriesScope = "this"): Promise<string[]> {
  const q = scope === "future" ? "?scope=future" : "";
  const res = await send<{ ok: true; ids?: string[] }>(`/api/planning/items/${encodeURIComponent(id)}${q}`, jsonInit("DELETE"));
  return res.ids ?? [id];
}

export async function takeOpenShift(id: string, opts: { force?: boolean; tz?: string } = {}): Promise<PlanningItem> {
  const q = new URLSearchParams();
  if (opts.force) q.set("force", "1");
  if (opts.tz) q.set("tz", opts.tz);
  const qs = q.toString();
  const { item } = await send<{ item: PlanningItem }>(
    `/api/planning/items/${encodeURIComponent(id)}/take${qs ? `?${qs}` : ""}`,
    jsonInit("POST"),
  );
  return item;
}

/** The series a row belongs to (recurrence_parent_id holds the series id). */
export function seriesIdOf(item: Pick<PlanningItem, "recurrence_parent_id">): string | null {
  return item.recurrence_parent_id ?? null;
}

/* ── Week actions ── */

export interface WeekActionBody {
  /** The instant the visible week starts. */
  week_start: string;
  /** Resources on screen (null = all). */
  resource_ids: string[] | null;
  include_open: boolean;
  tz: string;
}

export async function copyLastWeek(body: WeekActionBody, preview: boolean): Promise<{ count: number; skipped: number; items: PlanningItem[] }> {
  return send("/api/planning/week/copy", jsonInit("POST", { ...body, preview }));
}

export async function publishWeek(body: WeekActionBody, preview: boolean): Promise<{ count: number; people: number; items: PlanningItem[] }> {
  return send("/api/planning/week/publish", jsonInit("POST", { ...body, preview }));
}

/* ── Shift templates ── */

export interface PlanningTemplate {
  id: string;
  name: string;
  type: PlanningItemType;
  role_id: string | null;
  resource_id: string | null;
  color: string | null;
  /** "HH:MM" */
  start_time: string;
  /** "HH:MM" — earlier than start_time means it ends the next day. */
  end_time: string;
  duration_hours: number;
  default_note: string | null;
}

export type TemplateInput = {
  name: string;
  type: PlanningItemType;
  start_time: string;
  end_time: string;
  role_id: string | null;
  resource_id: string | null;
  color: string | null;
};

export async function fetchTemplates(): Promise<PlanningTemplate[]> {
  const { templates } = await read<{ templates: PlanningTemplate[] }>("/api/planning/templates");
  return templates ?? [];
}

export async function createTemplate(body: TemplateInput): Promise<PlanningTemplate> {
  const { template } = await send<{ template: PlanningTemplate }>("/api/planning/templates", jsonInit("POST", body));
  return template;
}

export async function updateTemplate(id: string, patch: Partial<TemplateInput>): Promise<PlanningTemplate> {
  const { template } = await send<{ template: PlanningTemplate }>(`/api/planning/templates/${encodeURIComponent(id)}`, jsonInit("PATCH", patch));
  return template;
}

export async function deleteTemplate(id: string): Promise<void> {
  await send<{ ok: true }>(`/api/planning/templates/${encodeURIComponent(id)}`, jsonInit("DELETE"));
}

/* ── Workload (planned hours per person per day) ── */

export interface WorkloadPerson {
  account_id: string;
  name: string;
  resource_ids: string[];
  capacity_hours_per_day: number;
  days: Record<string, number>;
  total: number;
}

export interface WorkloadResponse {
  from: string;
  to: string;
  tz: string;
  days: string[];
  people: WorkloadPerson[];
}

/** GET /api/planning/workload — also the feed Projects can call. */
export async function fetchWorkload(params: { from: string; to: string; tz?: string; accounts?: string[] }): Promise<WorkloadResponse> {
  const q = new URLSearchParams({ from: params.from, to: params.to });
  if (params.tz) q.set("tz", params.tz);
  if (params.accounts?.length) q.set("accounts", params.accounts.join(","));
  return read<WorkloadResponse>(`/api/planning/workload?${q.toString()}`);
}

/* ── Roles ── */

export async function fetchRoles(): Promise<PlanningRole[]> {
  const { roles } = await read<{ roles: PlanningRole[] }>("/api/planning/roles");
  return roles ?? [];
}

export async function createRole(body: {
  name: string;
  color?: string | null;
  hourly_rate?: number | null;
  sort_order?: number;
}): Promise<PlanningRole> {
  const { role } = await send<{ role: PlanningRole }>("/api/planning/roles", jsonInit("POST", body));
  return role;
}

export async function updateRole(id: string, patch: Partial<PlanningRole>): Promise<PlanningRole> {
  const { role } = await send<{ role: PlanningRole }>(`/api/planning/roles/${encodeURIComponent(id)}`, jsonInit("PATCH", patch));
  return role;
}

export async function deleteRole(id: string): Promise<void> {
  await send<{ ok: true }>(`/api/planning/roles/${encodeURIComponent(id)}`, jsonInit("DELETE"));
}

/* ── Resources ── */

export async function fetchResources(params: {
  type?: PlanningResourceType;
  includeInactive?: boolean;
} = {}): Promise<PlanningResource[]> {
  const q = new URLSearchParams();
  if (params.type) q.set("type", params.type);
  if (params.includeInactive) q.set("include_inactive", "1");
  const { resources } = await read<{ resources: PlanningResource[] }>(`/api/planning/resources?${q.toString()}`);
  return resources ?? [];
}

export async function createResource(body: {
  type: PlanningResourceType;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  capacity_hours_per_day?: number | null;
  hourly_cost?: number | null;
}): Promise<PlanningResource> {
  const { resource } = await send<{ resource: PlanningResource }>("/api/planning/resources", jsonInit("POST", body));
  return resource;
}

export async function updateResource(id: string, patch: Partial<PlanningResource>): Promise<PlanningResource> {
  const { resource } = await send<{ resource: PlanningResource }>(`/api/planning/resources/${encodeURIComponent(id)}`, jsonInit("PATCH", patch));
  return resource;
}

export async function deleteResource(id: string): Promise<void> {
  await send<{ ok: true }>(`/api/planning/resources/${encodeURIComponent(id)}`, jsonInit("DELETE"));
}

/* ── Date helpers ──
   Every helper that reads a clock takes the planner's zone (lib/planning-tz)
   as `tz`; without it they read the browser's zone. Days and week starts
   are WALL dates in that zone (see lib/planning-tz). */

/** YYYY-MM-DD of an instant, in `tz` (else the browser's zone). */
export function toLocalDateKey(iso: string, tz?: string): string {
  return dateKey(tz ? toWall(iso, tz) : new Date(iso));
}

export function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  // Monday as start of week (matches Odoo Planning + enterprise defaults).
  const dow = copy.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** "14:05" — 24-hour clock, the Hub's house time format, in `tz`. */
export function formatTime(d: Date | string, tz?: string): string {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return "—";
  const w = tz ? toWall(x, tz) : x;
  return `${String(w.getHours()).padStart(2, "0")}:${String(w.getMinutes()).padStart(2, "0")}`;
}

/** D/M/Y range in `tz`: "25/09/2026 · 09:00–17:00" or
 *  "25/09/2026 22:00 → 26/09/2026 06:00". */
export function formatRange(startISO: string, endISO: string, tz?: string): string {
  const s = new Date(startISO);
  const e = new Date(endISO);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "—";
  const ws = tz ? toWall(s, tz) : s;
  const we = tz ? toWall(e, tz) : e;
  const hm = (w: Date) => `${String(w.getHours()).padStart(2, "0")}:${String(w.getMinutes()).padStart(2, "0")}`;
  if (dateKey(ws) === dateKey(we)) return `${fmtDMY(ws)} · ${hm(ws)}–${hm(we)}`;
  return `${fmtDMY(ws)} ${hm(ws)} → ${fmtDMY(we)} ${hm(we)}`;
}

/** D/M/Y week label: "22/09/2026 – 28/09/2026". */
export function formatWeekRange(weekStart: Date): string {
  return `${fmtDMY(weekStart)} – ${fmtDMY(addDays(weekStart, 6))}`;
}

/** Day keys (YYYY-MM-DD) of every day in `days` (wall dates in `tz`) that
 *  the item overlaps — a multi-day item appears on each day it covers. */
export function itemDayKeys(item: { start_at: string; end_at: string }, days: Date[], tz?: string): string[] {
  const s = new Date(item.start_at).getTime();
  const e = new Date(item.end_at).getTime();
  const at = (wall: Date) => (tz ? fromWall(wall, tz) : wall).getTime();
  const keys: string[] = [];
  for (const d of days) {
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const from = at(dayStart);
    const to = at(addDays(dayStart, 1));
    /* Overlap test; a zero-length item still lands on its start day. */
    if ((s < to && e > from) || (s === e && s >= from && s < to)) {
      keys.push(dateKey(dayStart));
    }
  }
  return keys;
}

/** YYYY-MM-DD of a Date's LOCAL fields (never via toISOString, which is UTC). */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function durationHours(startISO: string, endISO: string): number {
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
  return Math.round((ms / 3600000) * 10) / 10;
}

/* ── Linked-entity search ── */

export type PickerEntityType = "customer" | "supplier" | "contact" | "product" | "project";

export interface EntitySearchResult {
  id: string;
  label: string;
  subtitle?: string | null;
  /** The record's real type (a "contact" search answers customer/supplier). */
  kind?: string;
}

export async function searchEntities(type: PickerEntityType, q: string): Promise<EntitySearchResult[]> {
  if (type === "project") {
    /* Projects' own list route (its own module check + involvement scope). */
    const params = new URLSearchParams();
    if (q.trim()) params.set("search", q.trim().replace(/[,()%*\\]/g, " ").slice(0, 60));
    let projects: Array<{ id: string; name: string | null; code: string | null }> = [];
    try {
      ({ projects } = await send<{ projects: typeof projects }>(`/api/projects?${params.toString()}`, { method: "GET" }));
    } catch (e) {
      // No Projects access → nothing to pick, not an error.
      if (e instanceof PlanningApiError && e.status === 403) return [];
      throw e;
    }
    return (projects ?? []).slice(0, 20).map((p) => ({ id: p.id, label: p.name || p.code || "—", subtitle: p.code, kind: "project" }));
  }
  const params = new URLSearchParams({ type, q });
  const { results } = await send<{ results: EntitySearchResult[] }>(`/api/planning/entity-search?${params.toString()}`, { method: "GET" });
  return results ?? [];
}

/**
 * Fetch planning items attached to a specific Hub entity. Used by the
 * "Scheduled" strip on Customer / Supplier / Contact / Product / Project
 * detail pages. no-store: a strip must reflect an item saved seconds ago.
 * Throws PlanningApiError on failure.
 */
export async function fetchLinkedItems(
  entityType: string,
  entityId: string,
  opts: { upcomingOnly?: boolean; limit?: number } = {},
): Promise<PlanningItem[]> {
  const q = new URLSearchParams({
    linked_entity_type: entityType,
    linked_entity_id: entityId,
  });
  if (opts.upcomingOnly) {
    // Only items ending in the future.
    q.set("start", new Date().toISOString());
  }
  if (opts.limit) q.set("limit", String(opts.limit));
  const { items } = await send<{ items: PlanningItem[] }>(`/api/planning/items?${q.toString()}`, { method: "GET" });
  return items ?? [];
}

/* ── HR leave overlay (approved leave mapped to employee resources) ── */
export interface LeaveSpan {
  resource_id: string;
  start_date: string;
  end_date: string;
}
/** Calendar out-of-office time on an employee resource. Never carries a
 *  title — the board shows it as "Out of office" and a time span only. */
export interface AwaySpan {
  resource_id: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  /** All-day only: inclusive date keys on the event owner's clock. */
  start_date?: string;
  end_date?: string;
}
/** A week's absence overlay: approved HR leave + Calendar out-of-office. */
export interface WeekAbsence {
  leaves: LeaveSpan[];
  away: AwaySpan[];
}
/** Both overlays in ONE request (from/to are inclusive date keys). */
export async function fetchWeekAbsence(from: string, to: string): Promise<WeekAbsence> {
  const r = await read<Partial<WeekAbsence>>(`/api/planning/leaves?from=${from}&to=${to}`);
  return { leaves: r.leaves ?? [], away: r.away ?? [] };
}
