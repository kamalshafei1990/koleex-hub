import "server-only";

/* ---------------------------------------------------------------------------
   Calendar tools — agent-facing READ operations on koleex_calendar_events.

   Security: mirrors src/app/api/calendar/events/route.ts GET. The calendar
   is a "whose calendar" model — a non-super-admin can only read their OWN
   calendar. (The route returns [] when a non-SA asks for someone else's.)
   This tool always reads the caller's own account, so that rule holds by
   construction. Recurring-series expansion and the planning/to-do/task
   mirrors the app overlays are omitted in Phase 1 — this returns the user's
   real calendar events in a window, which is what "what's on my calendar"
   needs.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../../supabase-server";
import type { ToolDef, ToolResult } from "../types";

const CALENDAR_MODULE = "Calendar";

const EVENT_COLS = `id, title, description, start_at, end_at, all_day,
  is_private, recurrence, recurrence_until, color, created_at`;

/** Default window: now → +N days. */
function windowISO(days: number): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now); to.setDate(to.getDate() + days); to.setHours(23, 59, 59, 999);
  return { from: now.toISOString(), to: to.toISOString() };
}

const listMyCalendar: ToolDef<
  { days?: number; limit?: number },
  Array<Record<string, unknown>>
> = {
  name: "listMyCalendar",
  description:
    "List the current user's own calendar events in an upcoming window (default next 7 days). Use for 'what's on my calendar', 'my meetings this week', 'am I free tomorrow'. Only ever returns the current user's own calendar.",
  parameters: {
    type: "object",
    properties: {
      days: { type: "integer", description: "How many days ahead from now to include. Default 7, cap 60." },
      limit: { type: "integer", description: "Max rows. Default 30, cap 60." },
    },
    required: [],
  },
  requiredModule: CALENDAR_MODULE,
  requiredAction: "view",
  handler: async (ctx, args): Promise<ToolResult<Array<Record<string, unknown>>>> => {
    const accountId = ctx.auth.account_id;
    const tenantId = ctx.auth.tenant_id;
    const days = Math.min(Math.max(Number(args.days ?? 7) || 7, 1), 60);
    const limit = Math.min(Math.max(Number(args.limit ?? 30) || 30, 1), 60);
    const { from, to } = windowISO(days);

    // Always the caller's own calendar — matches the route's own-calendar rule.
    let q = supabaseServer
      .from("koleex_calendar_events")
      .select(EVENT_COLS)
      .eq("account_id", accountId)
      .eq("tenant_id", tenantId)
      .lt("start_at", to)
      .gte("end_at", from);

    const { data, error } = await q.order("start_at", { ascending: true }).limit(limit);
    if (error) {
      console.error("[tool.listMyCalendar]", error);
      return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't load your calendar right now." };
    }
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    return {
      ok: true,
      permissionStatus: "allowed",
      data: rows,
      message: rows.length ? `Found ${rows.length} event(s) in the next ${days} day(s).` : `No calendar events in the next ${days} day(s).`,
      sources: [`koleex_calendar_events(account=me,tenant=${tenantId.slice(0, 8)}…)`],
    };
  },
};

export const calendarTools: ToolDef[] = [listMyCalendar as ToolDef];
