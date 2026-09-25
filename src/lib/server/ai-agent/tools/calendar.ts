import "server-only";

/* ---------------------------------------------------------------------------
   Calendar tools — the agent's read and write operations on
   koleex_calendar_events, on the caller's OWN calendar only.

   Same rules as the routes, through the same helpers (lib/server/
   calendar-access, calendar-notify): the owner or a super admin changes an
   event, a reschedule re-arms the reminder and tells the guests, a delete
   tells them it was cancelled and closes every notification about it. The
   list reads the SAME feed as the Calendar screen (lib/server/calendar-feed):
   own events with every occurrence of a series, invitations, and the
   Planning / To-do / Projects / leave / report-deadline mirrors.

   Create and update can also set the recurrence, the meeting link and the
   guests — through the same sanitizer (calendar-access) and the same guest
   helper (calendar-guests) as the routes, so a guest the assistant adds is
   an active colleague and is invited exactly like one added on screen.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../../supabase-server";
import type { ToolDef, ToolParameterProperty, ToolResult } from "../types";
import { isUuid, BAD_ID_MESSAGE } from "../uuid";
import { eventAttendeeIds, insertEventRow, isEventOwner, loadCalendarEvent, sanitizeEventInput, updateEventRow, type CalendarEventCore } from "../../calendar-access";
import { clearEventNotifications, notifyEventChanged } from "../../calendar-notify";
import { replaceGuests } from "../../calendar-guests";
import { clearExceptions } from "../../calendar-exceptions";
import { internalAccountIds } from "../../internal-accounts";
import { feedWindow, loadCalendarFeed } from "../../calendar-feed";
import { deleteLinkedTodos, syncLinkedTodo } from "../../calendar-todo-bridge";
import { CALENDAR_EVENT_TYPES, CALENDAR_RECURRENCES } from "@/lib/calendar-enums";
import type { CalendarFeedEvent } from "@/lib/calendar-types";

const CALENDAR_MODULE = "Calendar";

/** Active internal colleagues among `ids`, with a display name each — for
 *  the preview, so the user confirms WHO is invited. */
async function guestPreview(ids: unknown, tenantId: string | null, organizerId: string): Promise<{ ids: string[]; names: string[]; dropped: number }> {
  const asked = Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string" && isUuid(x) && x !== organizerId) : [];
  const ok = await internalAccountIds(asked.slice(0, 100), tenantId);
  const names: string[] = [];
  if (ok.length) {
    const { data } = await supabaseServer.from("accounts").select("id, username, person:people ( full_name )").in("id", ok);
    for (const a of (data ?? []) as Array<{ id: string; username: string | null; person: { full_name: string | null } | { full_name: string | null }[] | null }>) {
      const p = Array.isArray(a.person) ? a.person[0] : a.person;
      names.push(p?.full_name || a.username || a.id);
    }
  }
  return { ids: ok, names, dropped: new Set(asked).size - ok.length };
}

const RECURRENCE_PARAMS: Record<string, ToolParameterProperty> = {
  recurrence: { type: "string", enum: [...CALENDAR_RECURRENCES, "none"], description: "Repeat daily, weekly or monthly from the start; \"none\" = does not repeat." },
  recurrence_until: { type: "string", description: "Last date the series repeats (YYYY-MM-DD); an empty string = no end." },
  meeting_url: { type: "string", description: "The call link (must start with https://). An empty string clears it." },
};

/** "none" / "" → null (no repeat); anything else goes to the sanitizer. */
const recOf = (v: unknown) => (v === "none" || v === "" || v === null ? null : v);

function inputError(error: string): string {
  return error.includes("end_at must not be before")
    ? "The end time can't be before the start time."
    : error.includes("datetime")
      ? "I couldn't read that time — give me a date and time."
      : error.includes("meeting_url")
        ? "The meeting link must be a full https:// address."
        : `I can't save that: ${error}.`;
}

/** One feed item as the agent sees it. `event_id` is what update/delete
 *  take — present only for the user's own editable events (an occurrence of
 *  a series answers with its series; editing it edits the whole series). */
function agentRow(e: CalendarFeedEvent): Record<string, unknown> {
  const own = !e.source && !e.invited;
  const title = e.title
    || (e.source === "leave" ? "Leave" : e.source === "planning" ? `Planning (${e.planning_type ?? "shift"})` : "Untitled");
  return {
    ...(own ? { event_id: e.series_base_id ?? e.id } : {}),
    title,
    kind: e.source ?? (e.invited ? "invitation" : "event"),
    event_type: e.event_type,
    ...(e.all_day ? { all_day: true, start_date: e.start_date, end_date: e.end_date } : { start_at: e.start_at, end_at: e.end_at }),
    ...(e.location ? { location: e.location } : {}),
    ...(e.meeting_url ? { meeting_url: e.meeting_url } : {}),
    ...(e.description && own ? { description: e.description } : {}),
    ...(e.series_base_id ? { recurring: e.recurrence ?? true } : {}),
    ...(e.invited ? { my_answer: e.invite_status ?? "invited" } : {}),
    ...(e.source_kind && e.source ? { status: e.source_kind } : {}),
    ...(e.is_private ? { private: true } : {}),
  };
}

const listMyCalendar: ToolDef<
  { days?: number; q?: string; limit?: number },
  Array<Record<string, unknown>>
> = {
  name: "listMyCalendar",
  description:
    "List what is on the current user's own calendar in an upcoming window (default next 7 days): their events (every occurrence of a recurring one), invitations, approved leave, to-dos and project tasks due, planning shifts and report deadlines. Use for 'what's on my calendar', 'my meetings this week', 'am I free tomorrow'. Only rows with an event_id are the user's own events and can be updated or deleted (an occurrence of a recurring event carries its series' id — changing it changes the whole series). When resolving a SPECIFIC event by name, pass q with words from its title and raise days if it might be further out.",
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
    const days = Math.min(Math.max(Number(args.days ?? 7) || 7, 1), 60);
    const limit = Math.min(Math.max(Number(args.limit ?? 30) || 30, 1), 60);
    const from = new Date();
    const to = new Date(from.getTime() + days * 86_400_000);

    let feed: CalendarFeedEvent[];
    try {
      // Always the caller's own calendar — matches the route's own-calendar rule.
      feed = await loadCalendarFeed(ctx.auth, ctx.auth.account_id, feedWindow(from, to));
    } catch (e) {
      console.error("[tool.listMyCalendar]", e instanceof Error ? e.message : e);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't load your calendar right now." };
    }

    const titleQuery = typeof args.q === "string" ? args.q.trim().toLowerCase() : "";
    const rows = feed
      .filter((e) => !titleQuery || (e.title ?? "").toLowerCase().includes(titleQuery))
      .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at))
      .slice(0, limit)
      .map(agentRow);
    return {
      ok: true,
      permissionStatus: "allowed",
      data: rows,
      message: rows.length ? `Found ${rows.length} item(s) in the next ${days} day(s).` : `Nothing on the calendar in the next ${days} day(s).`,
      sources: [`calendar-feed(account=me,tenant=${(ctx.auth.tenant_id ?? "").slice(0, 8)}…)`],
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
    event_type?: string;
    location?: string;
    description?: string;
    is_private?: boolean;
    reminder_minutes?: number;
    recurrence?: string | null;
    recurrence_until?: string | null;
    meeting_url?: string | null;
    guest_account_ids?: string[];
    confirm?: boolean;
  },
  Record<string, unknown> | { preview: Record<string, unknown> }
> = {
  name: "createCalendarEvent",
  description:
    "Create a NEW event on the current user's OWN calendar. Needs a title and start/end times (ISO datetimes). Can repeat (recurrence daily/weekly/monthly, optional recurrence_until), carry a meeting link (https) and invite colleagues (guest_account_ids — resolve each person with findTeamMember FIRST, never invent ids; they get an invitation). ALWAYS call WITHOUT confirm first to preview; only call again with confirm:true after the user explicitly agrees.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Event title (required)." },
      start_at: { type: "string", description: "ISO start datetime (required)." },
      end_at: { type: "string", description: "ISO end datetime (required)." },
      all_day: { type: "boolean", description: "All-day event. Default false." },
      event_type: { type: "string", enum: [...CALENDAR_EVENT_TYPES], description: "meeting (default), task, reminder, event, holiday or out_of_office." },
      location: { type: "string", description: "Where — a room, an address, a call link." },
      description: { type: "string", description: "Optional details." },
      is_private: { type: "boolean", description: "Mark private. Default false." },
      reminder_minutes: { type: "integer", description: "Minutes before the start to remind the user (0 = at start). Omit for no reminder." },
      ...RECURRENCE_PARAMS,
      guest_account_ids: { type: "array", items: { type: "string" }, description: "Colleagues to invite — account ids from findTeamMember." },
      confirm: { type: "boolean", description: "Leave unset to PREVIEW. Set true ONLY after explicit user confirmation." },
    },
    required: ["title", "start_at", "end_at"],
  },
  requiredModule: CALENDAR_MODULE,
  requiredAction: "create",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | { preview: Record<string, unknown> }>> => {
    const title = String(args.title ?? "").trim();
    if (!title) return { ok: false, permissionStatus: "allowed", data: null, message: "What's the event called?" };
    if (!args.start_at || !args.end_at) return { ok: false, permissionStatus: "allowed", data: null, message: "When is it? I need a start and end time." };

    const input = sanitizeEventInput({
      title,
      start_at: args.start_at,
      end_at: args.end_at,
      all_day: args.all_day === true,
      event_type: typeof args.event_type === "string" ? args.event_type : "meeting",
      location: typeof args.location === "string" ? args.location : null,
      description: typeof args.description === "string" ? args.description : null,
      is_private: args.is_private === true,
      reminder_minutes: Number.isInteger(args.reminder_minutes) ? args.reminder_minutes : null,
      ...(args.recurrence !== undefined ? { recurrence: recOf(args.recurrence) } : {}),
      ...(args.recurrence_until !== undefined && recOf(args.recurrence) ? { recurrence_until: args.recurrence_until || null } : {}),
      ...(args.meeting_url !== undefined ? { meeting_url: args.meeting_url || null } : {}),
    }, "create");
    if (!input.ok) return { ok: false, permissionStatus: "allowed", data: null, message: inputError(input.error) };
    const normalized = input.row;
    const guests = await guestPreview(args.guest_account_ids, ctx.auth.tenant_id, ctx.auth.account_id);
    const droppedNote = guests.dropped > 0 ? ` (${guests.dropped} of the people asked for are not active colleagues and won't be invited)` : "";

    if (args.confirm !== true) {
      const extras = [
        normalized.recurrence ? `repeats ${normalized.recurrence}${normalized.recurrence_until ? ` until ${normalized.recurrence_until}` : ""}` : null,
        normalized.meeting_url ? `link ${normalized.meeting_url}` : null,
        guests.names.length ? `inviting ${guests.names.join(", ")}` : null,
      ].filter(Boolean).join("; ");
      return {
        ok: true,
        permissionStatus: "approval_required",
        data: { preview: { ...normalized, ...(guests.names.length ? { guests: guests.names } : {}) } },
        message: `Ready to add to your calendar: "${title}" from ${normalized.start_at} to ${normalized.end_at}${normalized.all_day ? " (all day)" : ""}${extras ? ` — ${extras}` : ""}${droppedNote}. Confirm and I'll create it.`,
        pendingAction: { tool: "createCalendarEvent", args: { ...args, ...normalized, guest_account_ids: guests.ids, confirm: true } },
      };
    }

    const { data, error } = await insertEventRow({
      ...normalized,
      account_id: ctx.auth.account_id, // own calendar only
      tenant_id: ctx.auth.tenant_id,   // server-side truth
    });

    if (error || !data) {
      console.error("[tool.createCalendarEvent]", error);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't create the event — please try again." };
    }
    const created = data as CalendarEventCore;
    let guestNote = "";
    if (guests.ids.length) {
      const res = await replaceGuests(created, guests.ids, ctx.auth.account_id);
      guestNote = res.ok ? ` and invited ${res.added} guest(s)` : " — but the invitations could not be sent; add the guests in the Calendar";
    }
    return {
      ok: true,
      permissionStatus: "allowed",
      data: { id: created.id, title: created.title, start_at: created.start_at, end_at: created.end_at, all_day: created.all_day, recurrence: created.recurrence ?? null, meeting_url: created.meeting_url ?? null },
      message: `Added "${title}" to your calendar${guestNote}.`,
      sources: ["koleex_calendar_events(insert)"],
    };
  },
};

/* ── Edit event (with confirm) ──
   The same rule as /api/calendar/events/[id] PATCH: the owner or a Super
   Admin, only the writable columns, through the shared sanitizer. */
const updateCalendarEvent: ToolDef<
  {
    event_id?: string;
    title?: string;
    start_at?: string;
    end_at?: string;
    all_day?: boolean;
    location?: string;
    description?: string;
    is_private?: boolean;
    reminder_minutes?: number | null;
    recurrence?: string | null;
    recurrence_until?: string | null;
    meeting_url?: string | null;
    add_guest_account_ids?: string[];
    remove_guest_account_ids?: string[];
    confirm?: boolean;
  },
  Record<string, unknown> | { preview: Record<string, unknown> }
> = {
  name: "updateCalendarEvent",
  description:
    "Update (reschedule, rename, edit) an event on the current user's OWN calendar. Resolve the event id via listMyCalendar FIRST — never invent an id. ALWAYS call first WITHOUT confirm to preview the change; only call again with confirm:true after the user explicitly agrees. Pass ONLY the fields being changed; times are ISO datetimes resolved from the current date block. Can also change the recurrence, the meeting link (https) and the guests (add_guest_account_ids / remove_guest_account_ids — resolve people with findTeamMember first). Changes the WHOLE series of a recurring event. Guests are told automatically when the time, place or link changes; new guests get an invitation.",
  parameters: {
    type: "object",
    properties: {
      event_id: { type: "string", description: "The event's id, taken from a listMyCalendar result." },
      title: { type: "string", description: "New title." },
      start_at: { type: "string", description: "New ISO start datetime." },
      end_at: { type: "string", description: "New ISO end datetime." },
      all_day: { type: "boolean", description: "Whether it becomes an all-day event." },
      location: { type: "string", description: "New location." },
      description: { type: "string", description: "New details text." },
      is_private: { type: "boolean", description: "Whether the event is private." },
      reminder_minutes: { type: "integer", description: "Minutes before the start to remind (0 = at start); pass null to remove the reminder." },
      ...RECURRENCE_PARAMS,
      add_guest_account_ids: { type: "array", items: { type: "string" }, description: "Colleagues to invite — account ids from findTeamMember." },
      remove_guest_account_ids: { type: "array", items: { type: "string" }, description: "Guests to take off the list (account ids)." },
      confirm: { type: "boolean", description: "Leave unset to PREVIEW. Set true ONLY after the user explicitly confirmed the previewed change." },
    },
    required: ["event_id"],
  },
  requiredModule: CALENDAR_MODULE,
  requiredAction: "edit",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | { preview: Record<string, unknown> }>> => {
    const id = String(args.event_id ?? "").trim();
    if (!id) return { ok: false, permissionStatus: "allowed", data: null, message: "Which event? Pick it from listMyCalendar first." };
    if (!isUuid(id)) return { ok: false, permissionStatus: "allowed", data: null, message: BAD_ID_MESSAGE };

    const ev = await loadCalendarEvent(id, ctx.auth.tenant_id);
    if (!ev) return { ok: false, permissionStatus: "allowed", data: null, message: "I can't find that event — pick it again from listMyCalendar." };
    if (!isEventOwner(ev, { accountId: ctx.auth.account_id, isSuperAdmin: ctx.isSuperAdmin })) {
      return { ok: false, permissionStatus: "denied", data: null, message: "You can only edit events on your own calendar." };
    }

    const body: Record<string, unknown> = {};
    if (typeof args.title === "string" && args.title.trim()) body.title = args.title.trim();
    if (typeof args.start_at === "string" && args.start_at.trim()) body.start_at = args.start_at.trim();
    if (typeof args.end_at === "string" && args.end_at.trim()) body.end_at = args.end_at.trim();
    if (typeof args.all_day === "boolean") body.all_day = args.all_day;
    if (typeof args.location === "string") body.location = args.location;
    if (typeof args.description === "string") body.description = args.description;
    if (typeof args.is_private === "boolean") body.is_private = args.is_private;
    if (args.reminder_minutes === null || Number.isInteger(args.reminder_minutes)) body.reminder_minutes = args.reminder_minutes;
    if (args.recurrence !== undefined) body.recurrence = recOf(args.recurrence);
    if (args.recurrence_until !== undefined) body.recurrence_until = args.recurrence_until || null;
    if (args.meeting_url !== undefined) body.meeting_url = args.meeting_url || null;

    /* Guests: the current list, plus / minus what was asked. */
    const wantsGuests = Array.isArray(args.add_guest_account_ids) || Array.isArray(args.remove_guest_account_ids);
    const currentGuests = wantsGuests ? await eventAttendeeIds(id) : [];
    const removeSet = new Set(Array.isArray(args.remove_guest_account_ids) ? args.remove_guest_account_ids : []);
    const adding = wantsGuests ? await guestPreview(args.add_guest_account_ids, ev.tenant_id, ev.account_id) : { ids: [], names: [], dropped: 0 };
    const nextGuests = Array.from(new Set([...currentGuests.filter((g) => !removeSet.has(g)), ...adding.ids]));
    const guestsChange = wantsGuests && (nextGuests.length !== currentGuests.length || nextGuests.some((g) => !currentGuests.includes(g)));

    if (Object.keys(body).length === 0 && !guestsChange) {
      return { ok: false, permissionStatus: "allowed", data: null, message: "Nothing to change — tell me what to update (title, times, location, link, description, reminder, repeat, guests, all-day, or privacy)." };
    }

    const input = Object.keys(body).length ? sanitizeEventInput(body, "update", ev) : { ok: true as const, row: {}, timeChanged: false, locationChanged: false, meetingUrlChanged: false, seriesChanged: false };
    if (!input.ok) return { ok: false, permissionStatus: "allowed", data: null, message: inputError(input.error) };
    const { reminded_at: _reset, ...changes } = input.row as Record<string, unknown> & { reminded_at?: null };
    void _reset;
    const removedCount = currentGuests.filter((g) => !nextGuests.includes(g)).length;

    const title = ev.title ?? "Event";
    if (args.confirm !== true) {
      const parts = Object.entries(changes).map(([k, v]) => `${k.replace("_", " ")} → ${String(v)}`);
      if (adding.names.length) parts.push(`invite ${adding.names.join(", ")}`);
      if (removedCount) parts.push(`remove ${removedCount} guest(s)`);
      if (adding.dropped) parts.push(`(${adding.dropped} of the people asked for are not active colleagues and won't be invited)`);
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

    let updated = ev;
    let data: Record<string, unknown> | null = null;
    if (Object.keys(input.row).length) {
      const res = await updateEventRow(id, input.row);
      if (res.error) {
        console.error("[tool.updateCalendarEvent]", res.error);
        return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't update the event — please try again." };
      }
      data = (res.data ?? null) as Record<string, unknown> | null;
      updated = { ...ev, ...(data ?? {}) } as typeof ev;
      if (input.seriesChanged && (ev.recurrence || updated.recurrence)) await clearExceptions(id);
      const linkChanged = input.meetingUrlChanged && (updated.meeting_url ?? null) !== (ev.meeting_url ?? null);
      if (input.timeChanged || input.locationChanged || linkChanged) {
        const guests = await eventAttendeeIds(id, { excludeDeclined: true });
        await notifyEventChanged(updated, guests, ctx.auth.account_id, input.timeChanged ? "rescheduled" : input.locationChanged ? "moved" : "link");
      }
      if (input.timeChanged || "title" in changes || "description" in changes) await syncLinkedTodo(updated);
    }
    let guestNote = "";
    if (guestsChange) {
      const res = await replaceGuests(updated, nextGuests, ctx.auth.account_id);
      guestNote = res.ok ? ` Guests: ${res.added} invited, ${res.removed} removed.` : " The guest list could not be changed — try again in the Calendar.";
    }
    return {
      ok: true,
      permissionStatus: "allowed",
      data: data ? { id: data.id, title: data.title, start_at: data.start_at, end_at: data.end_at, all_day: data.all_day } : { id: ev.id },
      message: `Updated "${typeof changes.title === "string" ? changes.title : title}".${guestNote}`,
      sources: ["koleex_calendar_events(update)"],
    };
  },
};

/* ── Delete event (with confirm) — the owner or a Super Admin ── */
const deleteCalendarEvent: ToolDef<
  { event_id?: string; confirm?: boolean },
  Record<string, unknown> | { preview: Record<string, unknown> }
> = {
  name: "deleteCalendarEvent",
  description:
    "PERMANENTLY delete (cancel) an event on the current user's OWN calendar. Resolve the event id via listMyCalendar FIRST — never invent an id. ALWAYS call first WITHOUT confirm to preview exactly which event will be deleted; only call again with confirm:true after the user explicitly agrees. This cannot be undone; guests are told it was cancelled.",
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
    if (!id) return { ok: false, permissionStatus: "allowed", data: null, message: "Which event? Pick it from listMyCalendar first." };
    if (!isUuid(id)) return { ok: false, permissionStatus: "allowed", data: null, message: BAD_ID_MESSAGE };

    const ev = await loadCalendarEvent(id, ctx.auth.tenant_id);
    if (!ev) return { ok: false, permissionStatus: "allowed", data: null, message: "I can't find that event — pick it again from listMyCalendar." };
    if (!isEventOwner(ev, { accountId: ctx.auth.account_id, isSuperAdmin: ctx.isSuperAdmin })) {
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

    const guests = await eventAttendeeIds(id, { excludeDeclined: true });
    const { error } = await supabaseServer.from("koleex_calendar_events").delete().eq("id", id);
    if (error) {
      console.error("[tool.deleteCalendarEvent]", error);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't delete the event — please try again." };
    }
    await clearEventNotifications(id);
    await notifyEventChanged(ev, guests, ctx.auth.account_id, "cancelled");
    await deleteLinkedTodos(id, ev.tenant_id);
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
