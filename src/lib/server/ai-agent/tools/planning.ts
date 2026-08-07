import "server-only";

/* ---------------------------------------------------------------------------
   Planning tools — agent-facing READ operations on planning_items.

   Security: ports the EXACT non-super-admin scope from
   src/app/api/planning/items/route.ts GET — the caller sees items they
   created, open (unassigned) shifts, and items on a resource that belongs
   to them. Super-admins skip the scope (tenant filter still applies).

   Phase 1 is read-only. Rate fields (hourly_rate) are intentionally not
   selected.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../../supabase-server";
import type { ToolDef, ToolResult } from "../types";
import { isUuid, BAD_ID_MESSAGE } from "../uuid";

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

    // Resource ids belonging to the caller.
    const { data: mineRes } = await supabaseServer
      .from("planning_resources")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("account_id", accountId);
    const rids = (mineRes ?? []).map((r) => (r as { id: string }).id);

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
      const orParts = [
        `created_by_account_id.eq.${accountId}`,
        `resource_id.is.null`,
      ];
      if (rids.length > 0) orParts.push(`resource_id.in.(${rids.join(",")})`);
      q = q.or(orParts.join(","));
    }

    const titleQuery = typeof args.q === "string" ? args.q.trim() : "";
    if (titleQuery) {
      q = q.ilike("title", `%${titleQuery.replace(/[%_\\]/g, "\\$&")}%`);
    }

    const { data, error } = await q.order("start_at", { ascending: true }).limit(limit);
    if (error) {
      console.error("[tool.listMyPlanning]", error);
      return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't load your planning right now." };
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
      confirm: { type: "boolean", description: "Leave unset to PREVIEW. Set true ONLY after explicit user confirmation." },
    },
    required: ["start_at", "end_at"],
  },
  requiredModule: PLANNING_MODULE,
  requiredAction: "create",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | { preview: Record<string, unknown> }>> => {
    const startAt = String(args.start_at ?? "").trim();
    const endAt = String(args.end_at ?? "").trim();
    if (!startAt || !endAt) return { ok: false, permissionStatus: "denied", data: null, message: "When is it? I need a start and end time." };
    {
      const s = Date.parse(startAt), e = Date.parse(endAt);
      if (!Number.isNaN(s) && !Number.isNaN(e) && e <= s) {
        return { ok: false, permissionStatus: "denied", data: null, message: "The end time must be after the start time." };
      }
    }
    const title = args.title ? String(args.title) : "";
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
      .from("planning_resources").select("id").eq("tenant_id", ctx.auth.tenant_id).eq("account_id", ctx.auth.account_id).limit(1);
    const resourceId = (mineRes ?? [])[0] ? (mineRes as { id: string }[])[0].id : null;

    const normalized = { title, start_at: startAt, end_at: endAt, type, notes: args.notes ? String(args.notes) : null };

    if (args.confirm !== true) {
      return {
        ok: true,
        permissionStatus: "approval_required",
        data: { preview: { ...normalized, resource_assigned: !!resourceId } },
        message: `Ready to add to your schedule: ${title || type} from ${startAt} to ${endAt}${resourceId ? "" : " (unassigned — you have no personal resource)"}. Confirm and I'll create it.`,
        pendingAction: { tool: "createPlanningItem", args: { ...normalized, confirm: true } },
      };
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
      return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't create the planning item — please try again." };
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
   The app's PATCH/DELETE gate on module action + tenant; the agent holds
   itself to the caller's OWN slice of the schedule: an item is mutable
   via AI only if the caller created it or it sits on their own resource
   (SA skips). Open shifts and other people's shifts stay app-only. */
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
  const { data } = await supabaseServer
    .from("planning_items")
    .select("id, type, title, notes, resource_id, start_at, end_at, status, created_by_account_id")
    .eq("id", id)
    .eq("tenant_id", ctx.auth.tenant_id)
    .maybeSingle();
  const item = (data as PlanningRow | null) ?? null;
  if (!item) return null;
  if (ctx.isSuperAdmin) return item;
  if (item.created_by_account_id === ctx.auth.account_id) return item;
  if (item.resource_id) {
    const { data: res } = await supabaseServer
      .from("planning_resources")
      .select("id")
      .eq("id", item.resource_id)
      .eq("tenant_id", ctx.auth.tenant_id)
      .eq("account_id", ctx.auth.account_id)
      .maybeSingle();
    if (res) return item;
  }
  return null;
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
      confirm: { type: "boolean", description: "Leave unset to PREVIEW. Set true ONLY after the user explicitly confirmed the previewed change." },
    },
    required: ["item_id"],
  },
  requiredModule: PLANNING_MODULE,
  requiredAction: "edit",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | { preview: Record<string, unknown> }>> => {
    const id = String(args.item_id ?? "").trim();
    if (!id) return { ok: false, permissionStatus: "denied", data: null, message: "Which planning item? Pick it from listMyPlanning first." };
    if (!isUuid(id)) return { ok: false, permissionStatus: "denied", data: null, message: BAD_ID_MESSAGE };

    const item = await loadOwnPlanningItem(ctx, id);
    if (!item) return { ok: false, permissionStatus: "denied", data: null, message: "I can't find that item on your own schedule — pick it again from listMyPlanning. Other people's shifts can only be changed in the Planning app." };

    const changes: Record<string, unknown> = {};
    if (typeof args.title === "string" && args.title.trim()) changes.title = args.title.trim();
    if (typeof args.notes === "string") changes.notes = args.notes;
    if (typeof args.start_at === "string" && args.start_at.trim()) changes.start_at = args.start_at.trim();
    if (typeof args.end_at === "string" && args.end_at.trim()) changes.end_at = args.end_at.trim();
    if (args.status === "cancelled") {
      changes.status = "cancelled";
      changes.cancelled_at = new Date().toISOString();
    }
    if (Object.keys(changes).length === 0) {
      return { ok: false, permissionStatus: "denied", data: null, message: "Nothing to change — tell me what to update (title, notes, times, or cancel it)." };
    }

    /* planning_items CHECK (end_at > start_at): validate the EFFECTIVE
       bounds (changed value or the row's current one) so a one-sided
       reschedule can't produce an inverted window. */
    const effStart = Date.parse((changes.start_at as string | undefined) ?? item.start_at ?? "");
    const effEnd = Date.parse((changes.end_at as string | undefined) ?? item.end_at ?? "");
    if (!Number.isNaN(effStart) && !Number.isNaN(effEnd) && effEnd <= effStart) {
      return { ok: false, permissionStatus: "denied", data: null, message: "The end time must be after the start time." };
    }

    const label = item.title || item.type || "planning item";
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
          : `Ready to update "${label}": ${parts.join(", ")}. Confirm?`,
        pendingAction: { tool: "updatePlanningItem", args: { ...args, item_id: item.id, confirm: true } },
      };
    }

    const { error } = await supabaseServer
      .from("planning_items")
      .update(changes)
      .eq("id", id)
      .eq("tenant_id", ctx.auth.tenant_id);
    if (error) {
      console.error("[tool.updatePlanningItem]", error);
      return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't update the planning item — please try again." };
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
    if (!id) return { ok: false, permissionStatus: "denied", data: null, message: "Which planning item? Pick it from listMyPlanning first." };
    if (!isUuid(id)) return { ok: false, permissionStatus: "denied", data: null, message: BAD_ID_MESSAGE };

    const item = await loadOwnPlanningItem(ctx, id);
    if (!item) return { ok: false, permissionStatus: "denied", data: null, message: "I can't find that item on your own schedule — pick it again from listMyPlanning." };

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
      return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't delete the planning item — please try again." };
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

export const planningTools: ToolDef[] = [
  listMyPlanning as ToolDef,
  createPlanningItem as ToolDef,
  updatePlanningItem as ToolDef,
  deletePlanningItem as ToolDef,
];
