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

/* ── Create calendar event (with confirm) — always on the caller's own calendar ── */
const createCalendarEvent: ToolDef<
  {
    title?: string;
    start_at?: string;
    end_at?: string;
    all_day?: boolean;
    description?: string;
    is_private?: boolean;
    confirm?: boolean;
  },
  Record<string, unknown> | { preview: Record<string, unknown> }
> = {
  name: "createCalendarEvent",
  description:
    "Create a NEW event on the current user's OWN calendar. Needs a title and start/end times (ISO datetimes). ALWAYS call WITHOUT confirm first to preview; only call again with confirm:true after the user explicitly agrees.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Event title (required)." },
      start_at: { type: "string", description: "ISO start datetime (required)." },
      end_at: { type: "string", description: "ISO end datetime (required)." },
      all_day: { type: "boolean", description: "All-day event. Default false." },
      description: { type: "string", description: "Optional details." },
      is_private: { type: "boolean", description: "Mark private. Default false." },
      confirm: { type: "boolean", description: "Leave unset to PREVIEW. Set true ONLY after explicit user confirmation." },
    },
    required: ["title", "start_at", "end_at"],
  },
  requiredModule: CALENDAR_MODULE,
  requiredAction: "create",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | { preview: Record<string, unknown> }>> => {
    const title = String(args.title ?? "").trim();
    const startAt = String(args.start_at ?? "").trim();
    const endAt = String(args.end_at ?? "").trim();
    if (!title) return { ok: false, permissionStatus: "denied", data: null, message: "What's the event called?" };
    if (!startAt || !endAt) return { ok: false, permissionStatus: "denied", data: null, message: "When is it? I need a start and end time." };

    const normalized = {
      title,
      start_at: startAt,
      end_at: endAt,
      all_day: args.all_day === true,
      description: args.description ? String(args.description) : null,
      is_private: args.is_private === true,
    };

    if (args.confirm !== true) {
      return {
        ok: true,
        permissionStatus: "approval_required",
        data: { preview: normalized },
        message: `Ready to add to your calendar: "${title}" from ${startAt} to ${endAt}${normalized.all_day ? " (all day)" : ""}. Confirm and I'll create it.`,
        pendingAction: { tool: "createCalendarEvent", args: { ...normalized, confirm: true } },
      };
    }

    const { data, error } = await supabaseServer
      .from("koleex_calendar_events")
      .insert({
        title: normalized.title,
        start_at: normalized.start_at,
        end_at: normalized.end_at,
        all_day: normalized.all_day,
        description: normalized.description,
        is_private: normalized.is_private,
        account_id: ctx.auth.account_id, // own calendar only
        tenant_id: ctx.auth.tenant_id,   // server-side truth
      })
      .select("id, title, start_at, end_at, all_day, created_at")
      .maybeSingle();

    if (error) {
      console.error("[tool.createCalendarEvent]", error);
      return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't create the event — please try again." };
    }
    return {
      ok: true,
      permissionStatus: "allowed",
      data: (data ?? null) as Record<string, unknown> | null,
      message: `Added "${title}" to your calendar.`,
      sources: ["koleex_calendar_events(insert)"],
    };
  },
};

export const calendarTools: ToolDef[] = [listMyCalendar as ToolDef, createCalendarEvent as ToolDef];
