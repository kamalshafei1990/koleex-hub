import "server-only";

/* ---------------------------------------------------------------------------
   Planning tools — agent-facing READ operations on planning_items.

   Security: ports the EXACT non-super-admin scope from
   src/app/api/planning/items/route.ts GET — the caller sees items they
   created, open (unassigned) shifts, and items on a resource that belongs
   to them. Super-admins skip the scope (tenant filter still applies).

   Rate fields (hourly_rate) are intentionally not selected.

   Writes run the SAME server conflict check as the app
   (lib/server/planning-conflicts): a double booking or approved leave is
   shown in the preview and blocks the confirmed write, unless a super
   admin explicitly passes override_conflicts:true. copyLastWeek and
   publishWeek share lib/server/planning-week with the app's routes, so they
   only ever touch rows the user may edit.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../../supabase-server";
import type { ToolDef, ToolResult } from "../types";
import { isUuid, BAD_ID_MESSAGE } from "../uuid";
import {
  callerResourceIds,
  loadPlanningItemForCaller,
  planningReadScopeOr,
} from "../../planning-access";
import { checkPlanningConflicts, type PlanningConflict } from "../../planning-conflicts";
import { copyLastWeek as copyLastWeekCore, publishWeek as publishWeekCore } from "../../planning-week";
import { zonedParts, zonedToUtc } from "@/lib/calendar-tz";

/** One readable line per conflict, for previews and refusals. */
function describeConflicts(list: PlanningConflict[], total: number): string {
  const lines = list.slice(0, 5).map((c) =>
    c.kind === "leave"
      ? `${c.resource_name ?? "The person"} is on approved leave ${c.leave_start} → ${c.leave_end}`
      : `${c.resource_name ?? "That resource"} is already booked for "${c.other_title ?? "another item"}" (${c.other_start_at} → ${c.other_end_at})`,
  );
  if (total > lines.length) lines.push(`…and ${total - lines.length} more`);
  return lines.join("; ");
}

/** The instant a week starts (Monday 00:00 in `tz`), from "YYYY-MM-DD" or now. */
function weekStartInstant(arg: unknown, tz: string): string | null {
  let y: number, m: number, d: number;
  if (typeof arg === "string" && arg.trim()) {
    const mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(arg.trim());
    if (!mt) return null;
    [y, m, d] = [Number(mt[1]), Number(mt[2]), Number(mt[3])];
  } else {
    const p = zonedParts(Date.now(), tz);
    [y, m, d] = [p.y, p.m, p.d];
  }
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const back = dow === 0 ? 6 : dow - 1;
  return new Date(zonedToUtc(y, m, d - back, 0, 0, 0, 0, tz)).toISOString();
}

const PLANNING_MODULE = "Planning";

const PLANNING_COLS = `id, type, title, notes, resource_id, role_id,
  start_at, end_at, allocated_hours, allocated_pct, status, published_at,
  completed_at, cancelled_at, created_by_account_id, created_at, updated_at`;

/** Default window: now → +N days. */
function windowISO(days: number): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now); to.setDate(to.getDate() + days); to.setHours(23, 59, 59, 999);
  return { from: now.toISOString(), to: to.toISOString() };
}

const listMyPlanning: ToolDef<
  { days?: number; mine?: boolean; q?: string; limit?: number },
  Array<Record<string, unknown>>
> = {
  name: "listMyPlanning",
  description:
    "List the current user's schedule / planning items (shifts, allocations) from the Planning app, scoped to what they can see. Use for 'my schedule', 'my shifts this week', 'what am I planned for', 'open shifts'. When resolving a SPECIFIC item by name (to change/cancel/delete it), pass q with words from its title. Defaults to the next 7 days.",
  parameters: {
    type: "object",
    properties: {
      days: { type: "integer", description: "How many days ahead from now to include. Default 7, cap 60." },
      mine: { type: "boolean", description: "If true, only items on the user's own resource (not open/unassigned shifts). Default false." },
      q: { type: "string", description: "Title search (case-insensitive contains). Use when looking for a specific item by name." },
      limit: { type: "integer", description: "Max rows. Default 30, cap 60." },
    },
    required: [],
  },
  requiredModule: PLANNING_MODULE,
  requiredAction: "view",
  handler: async (ctx, args): Promise<ToolResult<Array<Record<string, unknown>>>> => {
    const accountId = ctx.auth.account_id;
    const tenantId = ctx.auth.tenant_id;
    const days = Math.min(Math.max(Number(args.days ?? 7) || 7, 1), 60);
    const limit = Math.min(Math.max(Number(args.limit ?? 30) || 30, 1), 60);
    const { from, to } = windowISO(days);

    // Resource ids belonging to the caller (shared helper — same rule as the app).
    let rids: string[];
    try {
      rids = await callerResourceIds({ account_id: accountId, tenant_id: tenantId });
    } catch (e) {
      console.error("[tool.listMyPlanning] resources", e);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't load your planning right now." };
    }

    let q = supabaseServer
      .from("planning_items")
      .select(PLANNING_COLS)
      .eq("tenant_id", tenantId)
      // Same date semantics as the route: items overlapping the window.
      .gte("end_at", from)
      .lt("start_at", to);

    if (args.mine === true) {
      // Own-resource only (matches the route's ?mine=1 narrowing).
      if (rids.length > 0) q = q.in("resource_id", rids);
      else return { ok: true, permissionStatus: "allowed", data: [], message: "You have no assigned resource, so no personal planning items." };
    } else if (!ctx.isSuperAdmin) {
      q = q.or(planningReadScopeOr(accountId, rids));
    }

    const titleQuery = typeof args.q === "string" ? args.q.trim() : "";
    if (titleQuery) {
      q = q.ilike("title", `%${titleQuery.replace(/[%_\\]/g, "\\$&")}%`);
    }

    const { data, error } = await q.order("start_at", { ascending: true }).limit(limit);
    if (error) {
      console.error("[tool.listMyPlanning]", error);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't load your planning right now." };
    }
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    return {
      ok: true,
      permissionStatus: "allowed",
      data: rows,
      message: rows.length ? `Found ${rows.length} planning item(s) in the next ${days} day(s).` : `No planning items in the next ${days} day(s).`,
      sources: [`planning_items(scope=me,tenant=${tenantId.slice(0, 8)}…)`],
    };
  },
};

/* ── Create planning item (with confirm) — on the user's own resource ── */
const createPlanningItem: ToolDef<
  {
    title?: string;
    start_at?: string;
    end_at?: string;
    type?: string;
    notes?: string;
    override_conflicts?: boolean;
    confirm?: boolean;
  },
  Record<string, unknown> | { preview: Record<string, unknown> }
> = {
  name: "createPlanningItem",
  description:
    "Create a NEW planning item / shift on the current user's own schedule. Needs start and end times (ISO). ALWAYS call WITHOUT confirm first to preview; only call again with confirm:true after the user explicitly agrees.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short title/label for the item." },
      start_at: { type: "string", description: "ISO start datetime (required)." },
      end_at: { type: "string", description: "ISO end datetime (required)." },
      type: { type: "string", description: "shift | meeting | other. Default shift.", enum: ["shift", "meeting", "other"] },
      notes: { type: "string", description: "Optional notes." },
      override_conflicts: { type: "boolean", description: "Super admins only: save even though the preview reported a schedule conflict — ONLY when the user explicitly said to save anyway." },
      confirm: { type: "boolean", description: "Leave unset to PREVIEW. Set true ONLY after explicit user confirmation." },
    },
    required: ["start_at", "end_at"],
  },
  requiredModule: PLANNING_MODULE,
  requiredAction: "create",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | { preview: Record<string, unknown> }>> => {
    const startAt = String(args.start_at ?? "").trim();
    const endAt = String(args.end_at ?? "").trim();
    if (!startAt || !endAt) return { ok: false, permissionStatus: "allowed", data: null, message: "When is it? I need a start and end time." };
    {
      const s = Date.parse(startAt), e = Date.parse(endAt);
      if (Number.isNaN(s) || Number.isNaN(e)) {
        return { ok: false, permissionStatus: "allowed", data: null, message: "I couldn't read those times — give me a start and end as full dates with times." };
      }
      if (e <= s) {
        return { ok: false, permissionStatus: "allowed", data: null, message: "The end time must be after the start time." };
      }
    }
    const title = args.title ? String(args.title).slice(0, 200) : "";
    /* planning_items_type_check allows shift|meeting|production|delivery|
       maintenance|project_task|room_booking|other — anything else from the
       model (it used to offer "task"/"time_off") collapses to "shift" so
       the insert can never hit the CHECK constraint. */
    const DB_TYPES = new Set(["shift", "meeting", "production", "delivery", "maintenance", "project_task", "room_booking", "other"]);
    const rawType = String(args.type ?? "shift");
    const type = DB_TYPES.has(rawType) ? rawType : "shift";

    // Attach to the caller's own resource so it's their planned time (not an
    // open shift). If they have none, it's created unassigned.
    const { data: mineRes } = await supabaseServer
      .from("planning_resources").select("id").eq("tenant_id", ctx.auth.tenant_id).eq("account_id", ctx.auth.account_id)
      .eq("is_active", true).order("created_at", { ascending: true }).order("id", { ascending: true }).limit(1);
    const resourceId = (mineRes ?? [])[0] ? (mineRes as { id: string }[])[0].id : null;

    const normalized = { title, start_at: startAt, end_at: endAt, type, notes: args.notes ? String(args.notes) : null };

    let check: { conflicts: PlanningConflict[]; total: number };
    try {
      check = await checkPlanningConflicts(
        ctx.auth.tenant_id,
        [{ title, resource_id: resourceId, start_at: new Date(Date.parse(startAt)).toISOString(), end_at: new Date(Date.parse(endAt)).toISOString(), status: "draft" }],
        { tz: ctx.timezone },
      );
    } catch (e) {
      console.error("[tool.createPlanningItem] conflicts", e);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't check your schedule for conflicts — please try again." };
    }
    const override = args.override_conflicts === true && ctx.isSuperAdmin;
    const conflictNote = check.total > 0 ? ` Conflict: ${describeConflicts(check.conflicts, check.total)}.` : "";

    if (args.confirm !== true) {
      return {
        ok: true,
        permissionStatus: "approval_required",
        data: { preview: { ...normalized, resource_assigned: !!resourceId, conflicts: check.conflicts } },
        message: `Ready to add to your schedule: ${title || type} from ${startAt} to ${endAt}${resourceId ? "" : " (unassigned — you have no personal resource)"}.${conflictNote}${check.total > 0 && !ctx.isSuperAdmin ? " It can't be saved while it conflicts — pick another time." : " Confirm and I'll create it."}`,
        pendingAction: { tool: "createPlanningItem", args: { ...normalized, override_conflicts: check.total > 0 && ctx.isSuperAdmin ? true : undefined, confirm: true } },
      };
    }
    if (check.total > 0 && !override) {
      return { ok: false, permissionStatus: "allowed", data: null, message: `Not saved — schedule conflict.${conflictNote}` };
    }

    const { data, error } = await supabaseServer
      .from("planning_items")
      .insert({
        tenant_id: ctx.auth.tenant_id,
        type: normalized.type,
        title: normalized.title,
        notes: normalized.notes,
        resource_id: resourceId,
        role_id: null,
        start_at: normalized.start_at,
        end_at: normalized.end_at,
        allocated_hours: null,
        allocated_pct: null,
        linked_entity_type: null,
        linked_entity_id: null,
        linked_entity_label: null,
        is_billable: false,
        hourly_rate: null,
        status: "draft",
        recurrence_rule: null,
        created_by_account_id: ctx.auth.account_id,
      })
      .select("id, type, title, start_at, end_at, status, created_at")
      .single();

    if (error) {
      console.error("[tool.createPlanningItem]", error);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't create the planning item — please try again." };
    }
    return {
      ok: true,
      permissionStatus: "allowed",
      data: data as Record<string, unknown>,
      message: `Added ${title || type} to your schedule (draft).`,
      sources: ["planning_items(insert)"],
    };
  },
};

/* ── Shared loader for mutations ──
   The ownership rule now lives in lib/server/planning-access.ts and is the
   SAME one the app's PATCH/DELETE routes enforce: an item is mutable only
   if the caller created it or it sits on their own resource (SA skips).
   Open shifts and other people's shifts are refused. */
interface PlanningRow {
  id: string;
  type: string | null;
  title: string | null;
  notes: string | null;
  resource_id: string | null;
  start_at: string | null;
  end_at: string | null;
  status: string | null;
  created_by_account_id: string | null;
}

async function loadOwnPlanningItem(
  ctx: { auth: { account_id: string; tenant_id: string }; isSuperAdmin: boolean },
  id: string,
): Promise<PlanningRow | null> {
  const r = await loadPlanningItemForCaller<PlanningRow>(
    { account_id: ctx.auth.account_id, tenant_id: ctx.auth.tenant_id, is_super_admin: ctx.isSuperAdmin },
    id,
    "write",
    "id, type, title, notes, resource_id, start_at, end_at, status, created_by_account_id",
  );
  return r.ok ? r.item : null;
}

/* ── Edit / cancel a planning item (with confirm) ──
   Fields mirror the PATCH whitelist we expose (title/notes/times) plus
   status:"cancelled" with the route's cancelled_at stamp. "completed" is
   deliberately NOT offered here: the app's completion path logs the
   item's hours onto a linked project task, and the AI must not complete
   items while skipping that side effect. */
const updatePlanningItem: ToolDef<
  {
    item_id?: string;
    title?: string;
    notes?: string;
    start_at?: string;
    end_at?: string;
    status?: string;
    override_conflicts?: boolean;
    confirm?: boolean;
  },
  Record<string, unknown> | { preview: Record<string, unknown> }
> = {
  name: "updatePlanningItem",
  description:
    "Update one of the current user's own planning items / shifts: title, notes, start/end times — or CANCEL it (status:\"cancelled\"). Resolve the item id via listMyPlanning FIRST — never invent an id. ALWAYS call first WITHOUT confirm to preview; only call again with confirm:true after the user explicitly agrees. Marking an item COMPLETED is not available here — that's done in the Planning app (it logs hours to linked tasks).",
  parameters: {
    type: "object",
    properties: {
      item_id: { type: "string", description: "The item's id, taken from a listMyPlanning result." },
      title: { type: "string", description: "New title." },
      notes: { type: "string", description: "New notes." },
      start_at: { type: "string", description: "New ISO start datetime." },
      end_at: { type: "string", description: "New ISO end datetime." },
      status: { type: "string", description: "Only \"cancelled\" is allowed — cancels the shift/item.", enum: ["cancelled"] },
      override_conflicts: { type: "boolean", description: "Super admins only: save even though the preview reported a schedule conflict — ONLY when the user explicitly said to save anyway." },
      confirm: { type: "boolean", description: "Leave unset to PREVIEW. Set true ONLY after the user explicitly confirmed the previewed change." },
    },
    required: ["item_id"],
  },
  requiredModule: PLANNING_MODULE,
  requiredAction: "edit",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | { preview: Record<string, unknown> }>> => {
    const id = String(args.item_id ?? "").trim();
    if (!id) return { ok: false, permissionStatus: "allowed", data: null, message: "Which planning item? Pick it from listMyPlanning first." };
    if (!isUuid(id)) return { ok: false, permissionStatus: "allowed", data: null, message: BAD_ID_MESSAGE };

    const item = await loadOwnPlanningItem(ctx, id);
    if (!item) return { ok: false, permissionStatus: "allowed", data: null, message: "I can't find that item on your own schedule — pick it again from listMyPlanning. Other people's shifts can only be changed in the Planning app." };

    const changes: Record<string, unknown> = {};
    if (typeof args.title === "string" && args.title.trim()) changes.title = args.title.trim();
    if (typeof args.notes === "string") changes.notes = args.notes;
    if (typeof args.start_at === "string" && args.start_at.trim()) changes.start_at = args.start_at.trim();
    if (typeof args.end_at === "string" && args.end_at.trim()) changes.end_at = args.end_at.trim();
    for (const k of ["start_at", "end_at"] as const) {
      if (typeof changes[k] === "string" && Number.isNaN(Date.parse(changes[k] as string))) {
        return { ok: false, permissionStatus: "allowed", data: null, message: "I couldn't read that time — give it as a full date with a time." };
      }
    }
    if (args.status === "cancelled") {
      changes.status = "cancelled";
      changes.cancelled_at = new Date().toISOString();
    }
    if (Object.keys(changes).length === 0) {
      return { ok: false, permissionStatus: "allowed", data: null, message: "Nothing to change — tell me what to update (title, notes, times, or cancel it)." };
    }

    /* planning_items CHECK (end_at > start_at): validate the EFFECTIVE
       bounds (changed value or the row's current one) so a one-sided
       reschedule can't produce an inverted window. */
    const effStart = Date.parse((changes.start_at as string | undefined) ?? item.start_at ?? "");
    const effEnd = Date.parse((changes.end_at as string | undefined) ?? item.end_at ?? "");
    if (!Number.isNaN(effStart) && !Number.isNaN(effEnd) && effEnd <= effStart) {
      return { ok: false, permissionStatus: "allowed", data: null, message: "The end time must be after the start time." };
    }

    const label = item.title || item.type || "planning item";

    /* A reschedule runs the conflict check (cancelling never conflicts). */
    let check: { conflicts: PlanningConflict[]; total: number } = { conflicts: [], total: 0 };
    if (changes.status !== "cancelled" && ("start_at" in changes || "end_at" in changes) && item.status !== "cancelled") {
      try {
        check = await checkPlanningConflicts(
          ctx.auth.tenant_id,
          [{
            id: item.id,
            title: label,
            resource_id: item.resource_id,
            start_at: new Date(effStart).toISOString(),
            end_at: new Date(effEnd).toISOString(),
            status: item.status,
          }],
          { tz: ctx.timezone },
        );
      } catch (e) {
        console.error("[tool.updatePlanningItem] conflicts", e);
        return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't check the schedule for conflicts — please try again." };
      }
    }
    const conflictNote = check.total > 0 ? ` Conflict: ${describeConflicts(check.conflicts, check.total)}.` : "";

    if (args.confirm !== true) {
      const cancelling = changes.status === "cancelled";
      const parts = Object.entries(changes)
        .filter(([k]) => k !== "cancelled_at")
        .map(([k, v]) => `${k.replace("_", " ")} → ${String(v)}`);
      return {
        ok: true,
        permissionStatus: "approval_required",
        data: { preview: { item_id: item.id, title: label, changes } },
        message: cancelling
          ? `Ready to CANCEL "${label}" (${item.start_at ?? ""}). Confirm?`
          : `Ready to update "${label}": ${parts.join(", ")}.${conflictNote}${check.total > 0 && !ctx.isSuperAdmin ? " It can't be saved while it conflicts — pick another time." : " Confirm?"}`,
        pendingAction: { tool: "updatePlanningItem", args: { ...args, item_id: item.id, override_conflicts: check.total > 0 && ctx.isSuperAdmin ? true : undefined, confirm: true } },
      };
    }
    if (check.total > 0 && !(args.override_conflicts === true && ctx.isSuperAdmin)) {
      return { ok: false, permissionStatus: "allowed", data: null, message: `Not saved — schedule conflict.${conflictNote}` };
    }

    const { error } = await supabaseServer
      .from("planning_items")
      .update(changes)
      .eq("id", id)
      .eq("tenant_id", ctx.auth.tenant_id);
    if (error) {
      console.error("[tool.updatePlanningItem]", error);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't update the planning item — please try again." };
    }
    return {
      ok: true,
      permissionStatus: "allowed",
      data: { id: item.id, updated: Object.keys(changes) },
      message: changes.status === "cancelled" ? `Cancelled "${label}".` : `Updated "${label}".`,
      sources: ["planning_items(update)"],
    };
  },
};

/* ── Delete a planning item (with confirm) ── */
const deletePlanningItem: ToolDef<
  { item_id?: string; confirm?: boolean },
  Record<string, unknown> | { preview: Record<string, unknown> }
> = {
  name: "deletePlanningItem",
  description:
    "PERMANENTLY delete one of the current user's own planning items / shifts. Resolve the item id via listMyPlanning FIRST — never invent an id. ALWAYS call first WITHOUT confirm to preview exactly which item will be deleted; only call again with confirm:true after the user explicitly agrees. This cannot be undone — to keep the record, cancel it instead (updatePlanningItem status:\"cancelled\").",
  parameters: {
    type: "object",
    properties: {
      item_id: { type: "string", description: "The item's id, taken from a listMyPlanning result." },
      confirm: { type: "boolean", description: "Leave unset to PREVIEW. Set true ONLY after the user explicitly confirmed deleting the previewed item." },
    },
    required: ["item_id"],
  },
  requiredModule: PLANNING_MODULE,
  requiredAction: "delete",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | { preview: Record<string, unknown> }>> => {
    const id = String(args.item_id ?? "").trim();
    if (!id) return { ok: false, permissionStatus: "allowed", data: null, message: "Which planning item? Pick it from listMyPlanning first." };
    if (!isUuid(id)) return { ok: false, permissionStatus: "allowed", data: null, message: BAD_ID_MESSAGE };

    const item = await loadOwnPlanningItem(ctx, id);
    if (!item) return { ok: false, permissionStatus: "allowed", data: null, message: "I can't find that item on your own schedule — pick it again from listMyPlanning." };

    const label = item.title || item.type || "planning item";
    const when = item.start_at ? ` (${item.start_at})` : "";
    if (args.confirm !== true) {
      return {
        ok: true,
        permissionStatus: "approval_required",
        data: { preview: { item_id: item.id, title: label, start_at: item.start_at, action: "delete" } },
        message: `This will PERMANENTLY delete "${label}"${when} from your schedule — it cannot be undone. Confirm?`,
        pendingAction: { tool: "deletePlanningItem", args: { item_id: item.id, confirm: true } },
      };
    }

    const { error } = await supabaseServer
      .from("planning_items")
      .delete()
      .eq("id", id)
      .eq("tenant_id", ctx.auth.tenant_id);
    if (error) {
      console.error("[tool.deletePlanningItem]", error);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't delete the planning item — please try again." };
    }
    return {
      ok: true,
      permissionStatus: "allowed",
      data: { id: item.id, title: label, deleted: true },
      message: `Deleted "${label}" from your schedule.`,
      sources: ["planning_items(delete)"],
    };
  },
};

/* ── Week actions: copy last week / publish week (with confirm) ── */
type WeekArgs = { week_start?: string; confirm?: boolean };
const weekParams = {
  type: "object",
  properties: {
    week_start: { type: "string", description: "Any date (YYYY-MM-DD) inside the target week; the week runs Monday → Sunday in the user's timezone. Default: the current week." },
    confirm: { type: "boolean", description: "Leave unset to PREVIEW the count. Set true ONLY after the user explicitly agreed." },
  },
  required: [],
} as const;

const copyLastWeek: ToolDef<WeekArgs, Record<string, unknown>> = {
  name: "copyLastWeek",
  description:
    "Copy the PREVIOUS week's planning items into the target week (default: this week) as DRAFTS, skipping any that already exist there. Only items the user may edit are copied (their own / on their resource; super admins: everyone's). ALWAYS call WITHOUT confirm first to preview the count; call again with confirm:true only after the user agrees.",
  parameters: weekParams as unknown as ToolDef["parameters"],
  requiredModule: PLANNING_MODULE,
  requiredAction: "create",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown>>> => {
    const weekStart = weekStartInstant(args.week_start, ctx.timezone);
    if (!weekStart) return { ok: false, permissionStatus: "allowed", data: null, message: "Give the week as a date like 2026-09-28." };
    const caller = { account_id: ctx.auth.account_id, tenant_id: ctx.auth.tenant_id, is_super_admin: ctx.isSuperAdmin };
    const scope = { weekStart, resourceIds: null, includeOpen: true, tz: ctx.timezone };
    try {
      if (args.confirm !== true) {
        const r = await copyLastWeekCore(caller, scope, true);
        if (r.count === 0) {
          return { ok: true, permissionStatus: "allowed", data: { count: 0, skipped: r.skipped }, message: r.skipped ? `Nothing to copy — all ${r.skipped} item(s) from last week are already in this week.` : "Nothing to copy — last week has no items you can edit." };
        }
        return {
          ok: true,
          permissionStatus: "approval_required",
          data: { preview: { week_start: weekStart, count: r.count, skipped: r.skipped } },
          message: `Ready to copy ${r.count} item(s) from the previous week into the week of ${weekStart.slice(0, 10)} as drafts${r.skipped ? ` (${r.skipped} already there, skipped)` : ""}. Confirm?`,
          pendingAction: { tool: "copyLastWeek", args: { week_start: args.week_start, confirm: true } },
        };
      }
      const r = await copyLastWeekCore(caller, scope, false);
      return { ok: true, permissionStatus: "allowed", data: { count: r.count, skipped: r.skipped }, message: `Copied ${r.count} item(s) as drafts${r.skipped ? `; ${r.skipped} already existed` : ""}.`, sources: ["planning_items(insert)"] };
    } catch (e) {
      console.error("[tool.copyLastWeek]", e);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't copy last week — please try again." };
    }
  },
};

const publishWeek: ToolDef<WeekArgs, Record<string, unknown>> = {
  name: "publishWeek",
  description:
    "Publish every DRAFT planning item in the target week (default: this week) that the user may edit, and notify each scheduled person once. ALWAYS call WITHOUT confirm first to preview the count; call again with confirm:true only after the user agrees.",
  parameters: weekParams as unknown as ToolDef["parameters"],
  requiredModule: PLANNING_MODULE,
  requiredAction: "edit",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown>>> => {
    const weekStart = weekStartInstant(args.week_start, ctx.timezone);
    if (!weekStart) return { ok: false, permissionStatus: "allowed", data: null, message: "Give the week as a date like 2026-09-28." };
    const caller = { account_id: ctx.auth.account_id, tenant_id: ctx.auth.tenant_id, is_super_admin: ctx.isSuperAdmin, username: ctx.auth.username };
    const scope = { weekStart, resourceIds: null, includeOpen: true, tz: ctx.timezone };
    try {
      if (args.confirm !== true) {
        const r = await publishWeekCore(caller, scope, true, () => {});
        if (r.count === 0) return { ok: true, permissionStatus: "allowed", data: { count: 0 }, message: "No drafts to publish in that week." };
        return {
          ok: true,
          permissionStatus: "approval_required",
          data: { preview: { week_start: weekStart, count: r.count, people: r.people } },
          message: `Ready to publish ${r.count} draft(s) in the week of ${weekStart.slice(0, 10)}; ${r.people} person(s) will be notified. Confirm?`,
          pendingAction: { tool: "publishWeek", args: { week_start: args.week_start, confirm: true } },
        };
      }
      const pending: Promise<void>[] = [];
      const r = await publishWeekCore(caller, scope, false, (fn) => { pending.push(fn()); });
      await Promise.all(pending);
      return { ok: true, permissionStatus: "allowed", data: { count: r.count, people: r.people }, message: `Published ${r.count} item(s); ${r.people} person(s) notified.`, sources: ["planning_items(update)"] };
    } catch (e) {
      console.error("[tool.publishWeek]", e);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't publish the week — please try again." };
    }
  },
};

export const planningTools: ToolDef[] = [
  listMyPlanning as ToolDef,
  createPlanningItem as ToolDef,
  updatePlanningItem as ToolDef,
  deletePlanningItem as ToolDef,
  copyLastWeek as ToolDef,
  publishWeek as ToolDef,
];
