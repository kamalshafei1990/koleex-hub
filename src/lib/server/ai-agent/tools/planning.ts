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

export const planningTools: ToolDef[] = [listMyPlanning as ToolDef];
