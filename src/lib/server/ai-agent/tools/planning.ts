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
  { days?: number; mine?: boolean; limit?: number },
  Array<Record<string, unknown>>
> = {
  name: "listMyPlanning",
  description:
    "List the current user's schedule / planning items (shifts, allocations) from the Planning app, scoped to what they can see. Use for 'my schedule', 'my shifts this week', 'what am I planned for', 'open shifts'. Defaults to the next 7 days.",
  parameters: {
    type: "object",
    properties: {
      days: { type: "integer", description: "How many days ahead from now to include. Default 7, cap 60." },
      mine: { type: "boolean", description: "If true, only items on the user's own resource (not open/unassigned shifts). Default false." },
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
      type: { type: "string", description: "shift | task | time_off | other. Default shift." },
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
    const title = args.title ? String(args.title) : "";
    const type = String(args.type ?? "shift");

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

export const planningTools: ToolDef[] = [listMyPlanning as ToolDef, createPlanningItem as ToolDef];
