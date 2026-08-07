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
import { isUuid, BAD_ID_MESSAGE } from "../uuid";

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
  { days?: number; q?: string; limit?: number },
  Array<Record<string, unknown>>
> = {
  name: "listMyCalendar",
  description:
    "List the current user's own calendar events in an upcoming window (default next 7 days). Use for 'what's on my calendar', 'my meetings this week', 'am I free tomorrow'. When resolving a SPECIFIC event by name (to reschedule or delete it), pass q with words from its title and raise days if it might be further out. Only ever returns the current user's own calendar.",
  parameters: {
    type: "object",
    properties: {
      days: { type: "integer", description: "How many days ahead from now to include. Default 7, cap 60." },
      q: { type: "string", description: "Title search (case-insensitive contains). Use when looking for a specific event by name." },
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

    const titleQuery = typeof args.q === "string" ? args.q.trim() : "";
    if (titleQuery) {
      q = q.ilike("title", `%${titleQuery.replace(/[%_\\]/g, "\\$&")}%`);
    }

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
    {
      // DB CHECK is end_at >= start_at; equal start/end is a zero-length
      // event the calendar accepts, so only inverted windows are blocked.
      const s = Date.parse(startAt), e = Date.parse(endAt);
      if (!Number.isNaN(s) && !Number.isNaN(e) && e < s) {
        return { ok: false, permissionStatus: "denied", data: null, message: "The end time can't be before the start time." };
      }
    }

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

/* ── Shared loader for mutations — same shape as the route's loadEvent(),
   plus display fields so previews can echo the REAL event. Tenant is part
   of the query, so cross-tenant ids simply read as not-found. */
interface EventRow {
  id: string;
  account_id: string;
  tenant_id: string | null;
  title: string | null;
  start_at: string | null;
  end_at: string | null;
  all_day: boolean | null;
  description: string | null;
  is_private: boolean | null;
}

async function loadEventRow(id: string, tenantId: string | null): Promise<EventRow | null> {
  let q = supabaseServer
    .from("koleex_calendar_events")
    .select("id, account_id, tenant_id, title, start_at, end_at, all_day, description, is_private")
    .eq("id", id);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q.maybeSingle();
  return (data as EventRow | null) ?? null;
}

/* ── Edit event (with confirm) ──
   Ports /api/calendar/events/[id] PATCH: caller must own the calendar
   (account_id = me) or be Super Admin; server-managed fields can never be
   rewritten because only whitelisted fields are built into the patch. */
const updateCalendarEvent: ToolDef<
  {
    event_id?: string;
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
  name: "updateCalendarEvent",
  description:
    "Update (reschedule, rename, edit) an event on the current user's OWN calendar. Resolve the event id via listMyCalendar FIRST — never invent an id. ALWAYS call first WITHOUT confirm to preview the change; only call again with confirm:true after the user explicitly agrees. Pass ONLY the fields being changed; times are ISO datetimes resolved from the current date block.",
  parameters: {
    type: "object",
    properties: {
      event_id: { type: "string", description: "The event's id, taken from a listMyCalendar result." },
      title: { type: "string", description: "New title." },
      start_at: { type: "string", description: "New ISO start datetime." },
      end_at: { type: "string", description: "New ISO end datetime." },
      all_day: { type: "boolean", description: "Whether it becomes an all-day event." },
      description: { type: "string", description: "New details text." },
      is_private: { type: "boolean", description: "Whether the event is private." },
      confirm: { type: "boolean", description: "Leave unset to PREVIEW. Set true ONLY after the user explicitly confirmed the previewed change." },
    },
    required: ["event_id"],
  },
  requiredModule: CALENDAR_MODULE,
  requiredAction: "edit",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | { preview: Record<string, unknown> }>> => {
    const id = String(args.event_id ?? "").trim();
    if (!id) return { ok: false, permissionStatus: "denied", data: null, message: "Which event? Pick it from listMyCalendar first." };
    if (!isUuid(id)) return { ok: false, permissionStatus: "denied", data: null, message: BAD_ID_MESSAGE };

    const ev = await loadEventRow(id, ctx.auth.tenant_id);
    if (!ev) return { ok: false, permissionStatus: "denied", data: null, message: "I can't find that event — pick it again from listMyCalendar." };
    if (ev.account_id !== ctx.auth.account_id && !ctx.isSuperAdmin) {
      return { ok: false, permissionStatus: "denied", data: null, message: "You can only edit events on your own calendar." };
    }

    const changes: Record<string, unknown> = {};
    if (typeof args.title === "string" && args.title.trim()) changes.title = args.title.trim();
    if (typeof args.start_at === "string" && args.start_at.trim()) changes.start_at = args.start_at.trim();
    if (typeof args.end_at === "string" && args.end_at.trim()) changes.end_at = args.end_at.trim();
    if (typeof args.all_day === "boolean") changes.all_day = args.all_day;
    if (typeof args.description === "string") changes.description = args.description;
    if (typeof args.is_private === "boolean") changes.is_private = args.is_private;
    if (Object.keys(changes).length === 0) {
      return { ok: false, permissionStatus: "denied", data: null, message: "Nothing to change — tell me what to update (title, times, description, all-day, or privacy)." };
    }

    const effStart = Date.parse((changes.start_at as string | undefined) ?? ev.start_at ?? "");
    const effEnd = Date.parse((changes.end_at as string | undefined) ?? ev.end_at ?? "");
    if (!Number.isNaN(effStart) && !Number.isNaN(effEnd) && effEnd < effStart) {
      return { ok: false, permissionStatus: "denied", data: null, message: "The end time can't be before the start time." };
    }

    const title = ev.title ?? "Event";
    if (args.confirm !== true) {
      const parts = Object.entries(changes).map(([k, v]) => `${k.replace("_", " ")} → ${String(v)}`);
      return {
        ok: true,
        permissionStatus: "approval_required",
        data: {
          preview: {
            event_id: ev.id,
            title,
            current: { title: ev.title, start_at: ev.start_at, end_at: ev.end_at, all_day: ev.all_day },
            changes,
          },
        },
        message: `Ready to update "${title}": ${parts.join(", ")}. Confirm?`,
        pendingAction: { tool: "updateCalendarEvent", args: { ...args, event_id: ev.id, confirm: true } },
      };
    }

    const { data, error } = await supabaseServer
      .from("koleex_calendar_events")
      .update(changes)
      .eq("id", id)
      .select("id, title, start_at, end_at, all_day")
      .maybeSingle();
    if (error) {
      console.error("[tool.updateCalendarEvent]", error);
      return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't update the event — please try again." };
    }
    return {
      ok: true,
      permissionStatus: "allowed",
      data: (data ?? { id: ev.id }) as Record<string, unknown>,
      message: `Updated "${typeof changes.title === "string" ? changes.title : title}".`,
      sources: ["koleex_calendar_events(update)"],
    };
  },
};

/* ── Delete event (with confirm) ──
   Ports /api/calendar/events/[id] DELETE: own calendar or Super Admin. */
const deleteCalendarEvent: ToolDef<
  { event_id?: string; confirm?: boolean },
  Record<string, unknown> | { preview: Record<string, unknown> }
> = {
  name: "deleteCalendarEvent",
  description:
    "PERMANENTLY delete (cancel) an event on the current user's OWN calendar. Resolve the event id via listMyCalendar FIRST — never invent an id. ALWAYS call first WITHOUT confirm to preview exactly which event will be deleted; only call again with confirm:true after the user explicitly agrees. This cannot be undone.",
  parameters: {
    type: "object",
    properties: {
      event_id: { type: "string", description: "The event's id, taken from a listMyCalendar result." },
      confirm: { type: "boolean", description: "Leave unset to PREVIEW. Set true ONLY after the user explicitly confirmed deleting the previewed event." },
    },
    required: ["event_id"],
  },
  requiredModule: CALENDAR_MODULE,
  requiredAction: "delete",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | { preview: Record<string, unknown> }>> => {
    const id = String(args.event_id ?? "").trim();
    if (!id) return { ok: false, permissionStatus: "denied", data: null, message: "Which event? Pick it from listMyCalendar first." };
    if (!isUuid(id)) return { ok: false, permissionStatus: "denied", data: null, message: BAD_ID_MESSAGE };

    const ev = await loadEventRow(id, ctx.auth.tenant_id);
    if (!ev) return { ok: false, permissionStatus: "denied", data: null, message: "I can't find that event — pick it again from listMyCalendar." };
    if (ev.account_id !== ctx.auth.account_id && !ctx.isSuperAdmin) {
      return { ok: false, permissionStatus: "denied", data: null, message: "You can only delete events on your own calendar." };
    }

    const title = ev.title ?? "Event";
    const when = ev.start_at ? ` (${ev.start_at})` : "";
    if (args.confirm !== true) {
      return {
        ok: true,
        permissionStatus: "approval_required",
        data: { preview: { event_id: ev.id, title, start_at: ev.start_at, action: "delete" } },
        message: `This will PERMANENTLY delete "${title}"${when} from your calendar — it cannot be undone. Confirm?`,
        pendingAction: { tool: "deleteCalendarEvent", args: { event_id: ev.id, confirm: true } },
      };
    }

    const { error } = await supabaseServer.from("koleex_calendar_events").delete().eq("id", id);
    if (error) {
      console.error("[tool.deleteCalendarEvent]", error);
      return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't delete the event — please try again." };
    }
    return {
      ok: true,
      permissionStatus: "allowed",
      data: { id: ev.id, title, deleted: true },
      message: `Deleted "${title}" from your calendar.`,
      sources: ["koleex_calendar_events(delete)"],
    };
  },
};

export const calendarTools: ToolDef[] = [
  listMyCalendar as ToolDef,
  createCalendarEvent as ToolDef,
  updateCalendarEvent as ToolDef,
  deleteCalendarEvent as ToolDef,
];
