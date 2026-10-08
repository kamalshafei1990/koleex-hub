"use client";

/* ---------------------------------------------------------------------------
   EventModal — create, edit or view a calendar event.

   Three modes:
     · create — a new event on the active calendar
     · edit   — the organizer (or a super admin) changes it; delete lives here
     · view   — an INVITED guest reads it and answers the invitation; every
                field is inert. (A guest used to get the editor and a 403
                from the server on save.)

   Guests are picked from the same assignable-people list the To-do app uses
   (/api/todos/assignees): active internal colleagues, which is exactly who
   the server accepts. The old picker read the full account directory, which
   needs the Accounts module — a regular employee got an empty list and could
   not invite anyone.

   Times are edited on the CALENDAR's clock (`timezone`, the account's
   Settings → Calendar zone), not the browser's. An all-day event is edited
   as dates and stored as that zone's midnight → 23:59:59.999.

   The guest list is only written back once it has been READ and CHANGED: a
   save racing the first load (or after a failed load) used to PUT an empty
   list and silently uninvite everyone.

   Opened on ONE occurrence of a series (`occurrence`), the editor asks what
   a change applies to: "This event" stores an exception for that occurrence
   (title, time, place, link and notes — the fields one occurrence can have
   of its own; emptying the place, link or notes empties them for that
   occurrence only; the rest is locked while it is chosen), "All events" edits the
   series, shifting it by as much as the occurrence was moved. Delete asks
   the same.

   A meeting link (https) gets a Join button — Hub Blue on the day — and an
   event with other people on it a "Chat with attendees" link to Discuss
   (/discuss?with=<ids>&title=<event>: the DM with one person, else the
   group of exactly those people — the organizer and every guest who has
   not declined, never the viewer). With guests
   picked, a free/busy timeline shows everyone's day (FreeBusy).
   --------------------------------------------------------------------------- */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useTranslation } from "@/lib/i18n";
import { calendarT } from "@/lib/translations/calendar";
import { CalendarPlusIcon, CrossIcon, DiskIcon, MessageSquareIcon, TrashIcon, VideoIcon } from "@/components/icons/ui";
import { ChoiceRows } from "@/components/kds";
import { HUB } from "@/components/kds/colors";
import type {
  CalendarAttendeeStatus,
  CalendarEventRow,
  CalendarEventInsert,
  CalendarEventType,
  CalendarRecurrence,
  TodoAssigneeInfo,
} from "@/types/supabase";
import { fetchAssignableEmployees } from "@/lib/todo-admin";
import {
  changeOccurrence,
  createEvent,
  updateEvent,
  fetchAttendees,
  saveAttendees,
  respondToInvite,
  type CalendarAttendee,
  type OccurrenceChange,
} from "@/lib/calendar-events";
import { CALENDAR_EVENT_TYPES, CALENDAR_RECURRENCES, EVENT_TYPE_COLORS } from "@/lib/calendar-enums";
import { toDateTimeLocal, fromDateTimeLocal, isoDateKey } from "@/lib/calendar-utils";
import FreeBusy from "./FreeBusy";
import { allDayKeys, fromWall, toWall, zonedDateKey, zonedToUtc } from "@/lib/calendar-tz";

/* Preset swatches for the color picker — Hub Blue first. */
const COLOR_PALETTE = [
  HUB.steel, "#10B981", "#F59E0B", "#A855F7",
  "#EC4899", "#EF4444", "#0EA5E9", "#64748B",
];
const REMINDER_MINUTES: Array<number | null> = [null, 0, 5, 10, 15, 30, 60, 1440];
const DURATION_CHIPS = [15, 30, 60, 120];

/** The row being edited; start_date / end_date ride along on an all-day
 *  event read from the server (its dates in the ORGANIZER's zone). */
export type EventDraft = CalendarEventInsert & { start_date?: string; end_date?: string; meeting_url?: string | null };
export type EventModalMode = "create" | "edit" | "view";

/** The editor was opened on one occurrence of a series: its ORIGINAL start
 *  (the key of a "this occurrence" change) and the series row's own times. */
export interface OccurrenceContext {
  start: string;
  base: { start_at: string; end_at: string };
}

export type ChangeScope = "this" | "all";

/** An https link, or null when the text is not one. */
export function validMeetingUrl(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s || s.length > 500) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" && u.hostname ? s : null;
  } catch {
    return null;
  }
}

function keyParts(key: string): [number, number, number] {
  const [y, m, d] = key.split("-").map(Number);
  return [y, m, d];
}
const sameIds = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

interface Props {
  draft: EventDraft;
  existingId: string | null;
  mode: EventModalMode;
  /** The signed-in account — the guest whose answer PATCH records. */
  viewerId: string | null;
  /** The calendar's timezone — times are shown and entered on its clock. */
  timezone: string;
  onClose: () => void;
  /** Saved; the row when the series or a one-off was written, null when one
   *  occurrence was changed. */
  onSaved: (ev: CalendarEventRow | null) => void;
  /** Asks the shell to confirm and delete; says whether guests will hear,
   *  and — for an occurrence — whether it is that one or the whole series. */
  onDelete?: (info: { hasGuests: boolean; scope: ChangeScope }) => void;
  /** Set when opened on one occurrence of a series. */
  occurrence?: OccurrenceContext;
  /** Holiday names on a day (YYYY-MM-DD), for the free/busy timeline. */
  holidaysOn?: (dayKey: string) => string[];
  /** The calendar's wall "now" (the Join button is prominent on the day). */
  now?: Date;
  onResponded?: (status: CalendarAttendeeStatus) => void;
  onError?: (msg: string) => void;
}

const inputClass =
  "w-full h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors disabled:opacity-70";
const textareaClass =
  "w-full px-3 py-2 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors resize-y disabled:opacity-70";
const labelClass =
  "block text-[10px] font-semibold text-[var(--text-dim)] mb-1.5 uppercase tracking-wider";
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function EventModal({
  draft,
  existingId,
  mode,
  viewerId,
  timezone,
  onClose,
  onSaved,
  onDelete,
  onResponded,
  onError,
  occurrence,
  holidaysOn,
  now,
}: Props) {
  const { t } = useTranslation(calendarT);
  useScrollLock();
  const readOnly = mode === "view";
  const onOccurrence = mode === "edit" && !!occurrence;
  const [scope, setScope] = useState<ChangeScope>(onOccurrence ? "this" : "all");
  /* "This event": only the fields one occurrence can have of its own. */
  const occurrenceOnly = onOccurrence && scope === "this";
  const locked = readOnly || occurrenceOnly;
  const [form, setForm] = useState<EventDraft>(draft);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const ids = { title: useId(), heading: useId(), type: useId(), start: useId(), end: useId(), reminder: useId(), repeat: useId(), until: useId(), location: useId(), description: useId(), guests: useId(), link: useId(), linkHint: useId() };
  // Portalled to <body> so the overlay is viewport-level (the calendar page
  // sits inside a scroll container, which otherwise traps `position: fixed`
  // and lets the app header paint over the modal's top). The modal is
  // loaded client-only (next/dynamic, ssr: false), so document exists.

  /* Guests. Stored separately from the event row and persisted via the
     attendees endpoint after the event itself saves. `guestsState` says
     whether the list on screen is the real one: "loading" and "failed" both
     mean it must not be written back. */
  const [people, setPeople] = useState<TodoAssigneeInfo[]>([]);
  const [attendees, setAttendees] = useState<CalendarAttendee[]>([]);
  const [initialIds, setInitialIds] = useState<string[]>([]);
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [guestsState, setGuestsState] = useState<"loading" | "ready" | "failed">(existingId ? "loading" : "ready");
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [showGuests, setShowGuests] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchAssignableEmployees().then((list) => { if (alive) setPeople(list); });
    if (existingId) {
      fetchAttendees(existingId).then((list) => {
        if (!alive) return;
        if (list === null) { setGuestsState("failed"); return; }
        const current = list.map((a) => a.account_id);
        setAttendees(list);
        setInitialIds(current);
        setAttendeeIds(current);
        setGuestsState("ready");
        if (list.length) setShowGuests(true);
      });
    }
    return () => { alive = false; };
  }, [existingId]);

  /* Dialog focus: move in on open, keep Tab inside, give it back on close. */
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const first = dialogRef.current?.querySelector<HTMLElement>(readOnly ? "button" : "input");
    first?.focus();
    return () => { before?.focus?.(); };
  }, [readOnly]);

  const organizerId = form.account_id;
  const myInvite = attendees.find((a) => a.account_id === viewerId) ?? null;

  const filteredPeople = useMemo(() => {
    const q = attendeeSearch.trim().toLowerCase();
    return people
      .filter((p) => p.account_id !== organizerId)
      .filter((p) =>
        !q ||
        (p.username ?? "").toLowerCase().includes(q) ||
        (p.full_name ?? "").toLowerCase().includes(q) ||
        (p.name_alt ?? "").toLowerCase().includes(q) ||
        (p.department ?? "").toLowerCase().includes(q))
      .slice(0, 40);
  }, [people, attendeeSearch, organizerId]);

  const personById = useMemo(() => new Map(people.map((p) => [p.account_id, p])), [people]);
  const nameFor = (id: string) => {
    const p = personById.get(id);
    return p?.full_name || p?.username || attendees.find((a) => a.account_id === id)?.name || t("someone");
  };
  /** Native/alternate name (e.g. Chinese) for a person, or null. */
  const altFor = (id: string) => {
    const p = personById.get(id);
    const alt = (p?.name_alt ?? "").trim();
    return alt && alt !== (p?.full_name ?? "").trim() ? alt : null;
  };
  const toggleAttendee = (id: string) =>
    setAttendeeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  /** Set the end from the start + a fixed duration (duration chips). */
  function setDuration(minutes: number) {
    const start = new Date(form.start_at);
    patch("end_at", new Date(start.getTime() + minutes * 60_000).toISOString());
  }

  // ESC closes — but not mid-save, and not from under the confirm dialog.
  // Tab stays inside the dialog.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, saving]);

  function patch<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /* The all-day dates on screen: the server's (organizer's zone) until the
     user changes them, else read from the stored instants. */
  const dayKeys = form.start_date && form.end_date
    ? { start: form.start_date, end: form.end_date }
    : allDayKeys(form.start_at, form.end_at, timezone);

  /** An all-day span as instants: the zone's midnight → 23:59:59.999. */
  function allDaySpan(startKey: string, endKey: string): Pick<EventDraft, "start_at" | "end_at" | "start_date" | "end_date"> {
    const [sy, sm, sd] = keyParts(startKey);
    const [ey, em, ed] = keyParts(endKey < startKey ? startKey : endKey);
    return {
      start_at: new Date(zonedToUtc(sy, sm, sd, 0, 0, 0, 0, timezone)).toISOString(),
      end_at: new Date(zonedToUtc(ey, em, ed, 23, 59, 59, 999, timezone)).toISOString(),
      start_date: undefined,
      end_date: undefined,
    };
  }

  /** Toggle all-day: when enabled, the same dates as whole days; when
      disabled, 09:00–10:00 on the first day (calendar's clock). */
  function toggleAllDay(next: boolean) {
    if (next) {
      const s = zonedDateKey(form.start_at, timezone);
      const e = zonedDateKey(form.end_at, timezone);
      setForm({ ...form, all_day: true, ...allDaySpan(s, e) });
      return;
    }
    const [y, m, d] = keyParts(dayKeys.start);
    setForm({
      ...form,
      all_day: false,
      start_at: new Date(zonedToUtc(y, m, d, 9, 0, 0, 0, timezone)).toISOString(),
      end_at: new Date(zonedToUtc(y, m, d, 10, 0, 0, 0, timezone)).toISOString(),
      start_date: undefined,
      end_date: undefined,
    });
  }

  /** A datetime-local value (calendar's clock) → the stored instant. */
  function setTime(key: "start_at" | "end_at", value: string) {
    if (!value) return;
    const wall = fromDateTimeLocal(value);
    if (Number.isNaN(wall.getTime())) return;
    patch(key, fromWall(wall, timezone).toISOString());
  }

  /** "This event": the occurrence's changed fields, as an override. */
  async function saveOccurrence() {
    if (!existingId || !occurrence) return;
    const change: OccurrenceChange = {};
    if (form.title.trim() !== draft.title.trim()) change.title = form.title.trim();
    if (form.start_at !== draft.start_at || form.end_at !== draft.end_at) { change.start_at = form.start_at; change.end_at = form.end_at; }
    if ((form.location?.trim() || null) !== (draft.location?.trim() || null)) change.location = form.location?.trim() || null;
    /* null = none for this occurrence (the server stores it as ''). */
    if ((form.meeting_url?.trim() || null) !== (draft.meeting_url?.trim() || null)) change.meeting_url = form.meeting_url?.trim() || null;
    if ((form.description?.trim() || null) !== (draft.description?.trim() || null)) change.description = form.description?.trim() || null;
    if (Object.keys(change).length === 0) { onClose(); return; }
    setSaving(true);
    const res = await changeOccurrence(existingId, occurrence.start, { action: "override", ...change });
    setSaving(false);
    if (!res.ok) { onError?.(res.unavailable ? t("err.occurrenceUnavailable") : t("err.save")); return; }
    onSaved(null);
    /* Saved, but the server could not yet keep a cleared link / the notes. */
    if (res.degraded && ("meeting_url" in change || "description" in change)) onError?.(t("err.occurrencePartial"));
  }

  /** "All events" from an occurrence: only what changed goes to the series;
   *  a moved occurrence moves the series by the same amount. */
  function seriesPatch(payload: CalendarEventInsert & { meeting_url?: string | null }): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const before = draft as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(payload)) {
      if (k === "start_at" || k === "end_at" || k === "account_id") continue;
      if ((v ?? null) !== ((before[k] as unknown) ?? null)) out[k] = v;
    }
    if (occurrence && (form.start_at !== draft.start_at || form.end_at !== draft.end_at)) {
      const shift = Date.parse(form.start_at) - Date.parse(draft.start_at);
      const start = Date.parse(occurrence.base.start_at) + shift;
      out.start_at = new Date(start).toISOString();
      out.end_at = new Date(start + (Date.parse(form.end_at) - Date.parse(form.start_at))).toISOString();
    }
    return out;
  }

  async function handleSave() {
    if (readOnly || guestsState === "loading") return;
    if (!form.title.trim()) { setLocalError(t("err.titleRequired")); return; }
    if (new Date(form.end_at) < new Date(form.start_at)) { setLocalError(t("err.endBeforeStart")); return; }
    if (form.meeting_url?.trim() && !validMeetingUrl(form.meeting_url)) { setLocalError(t("err.meetingUrl")); return; }
    setLocalError(null);
    if (occurrenceOnly) { await saveOccurrence(); return; }
    setSaving(true);

    const { start_date: _sd, end_date: _ed, ...row } = form;
    void _sd; void _ed;
    const payload: CalendarEventInsert & { meeting_url?: string | null } = {
      ...row,
      title: form.title.trim(),
      description: form.description?.trim() || null,
      location: form.location?.trim() || null,
      meeting_url: form.meeting_url?.trim() || null,
    };

    let saved: CalendarEventRow | null;
    if (existingId && onOccurrence) {
      const patchBody = seriesPatch(payload);
      saved = Object.keys(patchBody).length ? await updateEvent(existingId, patchBody) : ({ id: existingId } as CalendarEventRow);
    } else {
      saved = existingId ? await updateEvent(existingId, payload) : await createEvent(payload);
    }
    setSaving(false);
    if (!saved) { onError?.(t("err.save")); return; }

    // Bridge: a NEW Calendar event of type "task" also appears in the To-do
    // app. Later edits and the delete follow it server-side
    // (lib/server/calendar-todo-bridge). due_date is a DATE: the start's day
    // on the calendar's clock.
    if (!existingId && form.event_type === "task") {
      try {
        const { createTodo } = await import("@/lib/todo-admin");
        await createTodo({
          title: payload.title,
          description: payload.description,
          priority: "medium",
          due_date: zonedDateKey(form.start_at, timezone),
          source: "calendar",
          source_id: saved.id,
          assignee_account_ids: [form.account_id],
        });
      } catch (e) {
        /* The event is saved; a failed bridge must not undo that. */
        console.error("[calendar→todo bridge]", e instanceof Error ? e.message : e);
      }
    }

    /* The guest list follows the event — only when it was read and changed.
       Best-effort: the event is already saved; a failed invite is re-sent on
       the next edit. */
    if (guestsState === "ready" && !sameIds(attendeeIds, initialIds)) {
      const ok = await saveAttendees(saved.id, attendeeIds);
      if (!ok) console.error("[Calendar] guests were not saved for", saved.id);
    }

    onSaved(saved);
  }

  async function respond(status: "accepted" | "declined") {
    if (!existingId) return;
    setSaving(true);
    const ok = await respondToInvite(existingId, status);
    setSaving(false);
    if (!ok) { onError?.(t("err.respond")); return; }
    setAttendees((prev) => prev.map((a) => (a.account_id === viewerId ? { ...a, status } : a)));
    onResponded?.(status);
  }

  const startDate = new Date(form.start_at);
  const endDate = new Date(form.end_at);
  const color = form.color || EVENT_TYPE_COLORS[form.event_type];
  const heading = mode === "create" ? t("modal.new") : mode === "edit" ? t("modal.edit") : t("modal.view");
  const editingSeries = mode === "edit" && !!draft.recurrence && !onOccurrence;
  const guestsLoading = guestsState === "loading";
  const liveGuests = attendees.filter((a) => a.status !== "declined").length > 0;
  const link = validMeetingUrl(form.meeting_url);
  const linkInvalid = !!form.meeting_url?.trim() && !link;
  /* "Chat with attendees": the saved event's organizer and every guest who
     has not declined, without the viewer — guests are internal accounts
     (lib/server/calendar-guests). Nobody else, no button. */
  const chatIds = existingId
    ? Array.from(new Set([draft.account_id, ...attendees.filter((a) => a.status !== "declined").map((a) => a.account_id)]))
        .filter((id): id is string => !!id && id !== viewerId)
    : [];
  const chatHref = chatIds.length
    ? `/discuss?with=${chatIds.map(encodeURIComponent).join(",")}&title=${encodeURIComponent(draft.title.trim())}`
    : null;
  /* Free/busy: the organizer and the picked guests, on the event's day. */
  const fbIds = useMemo(() => [organizerId, ...attendeeIds.filter((id) => id !== organizerId)].slice(0, 20), [organizerId, attendeeIds]);
  const startWall = toWall(form.start_at, timezone);
  const endWall = toWall(form.end_at, timezone);
  /* The Join button is Hub Blue on the event's day (the calendar's clock). */
  const joinToday = !!link && !!now && (form.all_day
    ? isoDateKey(now) >= dayKeys.start && isoDateKey(now) <= dayKeys.end
    : endWall.getTime() >= now.getTime() && (isoDateKey(startWall) === isoDateKey(now) || startWall.getTime() <= now.getTime()));
  const fbDay = form.all_day ? dayKeys.start : isoDateKey(startWall);
  const fbProposal = form.all_day ? null : {
    startMin: startWall.getHours() * 60 + startWall.getMinutes(),
    endMin: isoDateKey(endWall) > fbDay ? 24 * 60 : endWall.getHours() * 60 + endWall.getMinutes(),
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[var(--bg-overlay)] backdrop-blur-sm"
      onClick={() => { if (!saving) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ids.heading}
        className="kx-app kx-glass-pop relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: color + "22", color, border: `1px solid ${color}55` }}
            >
              <CalendarPlusIcon className="h-4 w-4" />
            </div>
            <h2 id={ids.heading} className="text-[15px] font-bold text-[var(--text-primary)]">{heading}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label={t("modal.close")}
            className="h-8 w-8 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] flex items-center justify-center transition-all"
          >
            <CrossIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {readOnly && (
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[12px] text-[var(--text-muted)]">
              {personById.has(organizerId)
                ? t("modal.invitedBy").replace("{name}", nameFor(organizerId))
                : t("modal.invited")}
              {myInvite && myInvite.status !== "invited" && (
                <span className="ms-2 font-semibold text-[var(--text-primary)]">
                  · {myInvite.status === "accepted" ? t("modal.accepted") : t("modal.declined")}
                </span>
              )}
            </div>
          )}

          {editingSeries && (
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[12px] text-[var(--text-muted)]">
              {t("modal.series")}
            </div>
          )}

          {onOccurrence && (
            <div>
              <span className={labelClass} id={ids.heading + "-scope"}>{t("scope.label")}</span>
              <div aria-labelledby={ids.heading + "-scope"}>
                <ChoiceRows<ChangeScope>
                  value={scope}
                  onChange={setScope}
                  options={[
                    { value: "this", label: t("scope.this"), hint: t("scope.this.hint") },
                    { value: "all", label: t("scope.all"), hint: t("scope.all.hint") },
                  ]}
                />
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor={ids.title} className={labelClass}>{t("f.title")}</label>
            <input
              id={ids.title}
              className={inputClass}
              value={form.title}
              onChange={(e) => patch("title", e.target.value)}
              placeholder={t("f.title.placeholder")}
              disabled={readOnly}
            />
          </div>

          {/* Type */}
          <div>
            <label htmlFor={ids.type} className={labelClass}>{t("f.type")}</label>
            <select
              id={ids.type}
              className={inputClass}
              value={form.event_type}
              onChange={(e) => patch("event_type", e.target.value as CalendarEventType)}
              disabled={locked}
            >
              {CALENDAR_EVENT_TYPES.map((ev) => (
                <option key={ev} value={ev}>{t(`type.${ev}`)}</option>
              ))}
            </select>
          </div>

          {/* Color picker — Default (type color) + preset swatches */}
          {!locked && (
            <div>
              <span className={labelClass}>{t("f.color")}</span>
              <div className="flex items-center gap-2 flex-wrap" role="group" aria-label={t("f.color")}>
                <button
                  type="button"
                  onClick={() => patch("color", null)}
                  title={t("f.color.defaultHint")}
                  className={`h-7 px-2.5 rounded-full text-[11px] font-medium border transition-all ${
                    !form.color
                      ? "border-[var(--border-focus)] text-[var(--text-primary)]"
                      : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {t("f.color.default")}
                </button>
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => patch("color", c)}
                    aria-label={`${t("f.color")} ${c}`}
                    aria-pressed={form.color === c}
                    className="h-7 w-7 rounded-full border transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: form.color === c ? "var(--text-primary)" : "transparent",
                      boxShadow: form.color === c ? "0 0 0 2px var(--bg-secondary), 0 0 0 3px var(--text-primary)" : undefined,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All-day + Private toggles */}
          <div className="flex items-center gap-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.all_day}
                onChange={(e) => toggleAllDay(e.target.checked)}
                disabled={locked}
                className="h-4 w-4 rounded border-[var(--border-subtle)]"
              />
              <span className="text-[13px] text-[var(--text-muted)]">{t("f.allDay")}</span>
            </label>
            {!locked && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form.is_private}
                  onChange={(e) => patch("is_private", e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border-subtle)]"
                />
                <span className="text-[13px] text-[var(--text-muted)]">{t("f.private")}</span>
              </label>
            )}
          </div>

          {/* Start / End — on the calendar's clock */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={ids.start} className={labelClass}>{t("f.start")}</label>
              {form.all_day ? (
                <input
                  id={ids.start}
                  type="date"
                  className={inputClass}
                  value={dayKeys.start}
                  disabled={readOnly}
                  onChange={(e) => { if (e.target.value) setForm((f) => ({ ...f, ...allDaySpan(e.target.value, dayKeys.end < e.target.value ? e.target.value : dayKeys.end) })); }}
                />
              ) : (
                <input
                  id={ids.start}
                  type="datetime-local"
                  className={inputClass}
                  value={toDateTimeLocal(toWall(startDate, timezone))}
                  disabled={readOnly}
                  onChange={(e) => setTime("start_at", e.target.value)}
                />
              )}
            </div>
            <div>
              <label htmlFor={ids.end} className={labelClass}>{t("f.end")}</label>
              {form.all_day ? (
                <input
                  id={ids.end}
                  type="date"
                  className={inputClass}
                  value={dayKeys.end}
                  min={dayKeys.start}
                  disabled={readOnly}
                  onChange={(e) => { if (e.target.value) setForm((f) => ({ ...f, ...allDaySpan(dayKeys.start, e.target.value) })); }}
                />
              ) : (
                <input
                  id={ids.end}
                  type="datetime-local"
                  className={inputClass}
                  value={toDateTimeLocal(toWall(endDate, timezone))}
                  disabled={readOnly}
                  onChange={(e) => setTime("end_at", e.target.value)}
                />
              )}
            </div>
          </div>

          {/* Quick duration chips (timed events only) */}
          {!form.all_day && !readOnly && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-[var(--text-dim)] me-1">{t("f.duration")}</span>
              {DURATION_CHIPS.map((min) => {
                const active = endDate.getTime() - startDate.getTime() === min * 60_000;
                return (
                  <button
                    key={min}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setDuration(min)}
                    className={`h-7 px-3 rounded-full text-[11px] font-medium border transition-all ${
                      active
                        ? "border-[var(--border-focus)] text-[var(--text-primary)] bg-[var(--bg-surface-subtle)]"
                        : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {t(`dur.${min}`)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Reminder + Repeat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={ids.reminder} className={labelClass}>{t("f.reminder")}</label>
              <select
                id={ids.reminder}
                className={inputClass}
                value={form.reminder_minutes ?? ""}
                disabled={locked}
                onChange={(e) => patch("reminder_minutes", e.target.value === "" ? null : Number(e.target.value))}
              >
                {REMINDER_MINUTES.map((v) => (
                  <option key={String(v)} value={v ?? ""}>{t(`reminder.${v ?? "none"}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={ids.repeat} className={labelClass}>{t("f.repeat")}</label>
              <select
                id={ids.repeat}
                className={inputClass}
                value={form.recurrence ?? ""}
                disabled={locked}
                onChange={(e) => patch("recurrence", (e.target.value || null) as CalendarRecurrence)}
              >
                <option value="">{t("repeat.none")}</option>
                {CALENDAR_RECURRENCES.map((r) => (
                  <option key={r} value={r}>{t(`repeat.${r}`)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Repeat-until (only when a recurrence is set) */}
          {form.recurrence && (
            <div>
              <label htmlFor={ids.until} className={labelClass}>{t("f.repeatUntil")}</label>
              <input
                id={ids.until}
                type="date"
                className={inputClass}
                value={form.recurrence_until ?? ""}
                disabled={locked}
                onChange={(e) => patch("recurrence_until", e.target.value || null)}
              />
              {!locked && (
                <p className="mt-1 text-[11px] text-[var(--text-dim)]">{t("f.repeatUntil.hint")}</p>
              )}
            </div>
          )}

          {/* Guests */}
          {locked ? (
            attendees.length > 0 && (
              <div>
                <span className={labelClass}>{t("modal.guests")}</span>
                <div className="flex flex-wrap gap-1.5">
                  {attendees.map((a) => (
                    <span
                      key={a.account_id}
                      className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)]"
                    >
                      {nameFor(a.account_id)}
                      <span className="text-[var(--text-dim)]">· {t(`status.${a.status}`)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )
          ) : (
            <div>
              <button
                type="button"
                onClick={() => setShowGuests((s) => !s)}
                aria-expanded={showGuests}
                aria-controls={ids.guests}
                className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <span>{t("f.guests")}</span>
                {attendeeIds.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[10px] font-semibold">
                    {attendeeIds.length}
                  </span>
                )}
              </button>

              {guestsLoading && (
                <p className="mt-1 text-[11px] text-[var(--text-dim)]">{t("modal.guestsLoading")}</p>
              )}
              {guestsState === "failed" && (
                <p className="mt-1 text-[11px] text-[var(--state-error)]">{t("modal.guestsError")}</p>
              )}
              {showGuests && guestsState !== "failed" && (
                <div id={ids.guests} className="mt-2 rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                  {attendeeIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
                      {attendeeIds.map((id) => {
                        const status = attendees.find((a) => a.account_id === id)?.status;
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 h-6 ps-2 pe-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)]"
                          >
                            {nameFor(id)}
                            {altFor(id) && (
                              <span lang="zh" className="ms-0.5 text-[0.85em] text-[var(--text-dim)]">{altFor(id)}</span>
                            )}
                            {status && status !== "invited" && (
                              <span className="text-[var(--text-dim)]">· {t(`status.${status}`)}</span>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleAttendee(id)}
                              className="h-4 w-4 grid place-items-center rounded-full hover:bg-[var(--bg-surface-subtle)] text-[var(--text-dim)]"
                              aria-label={t("f.guests.remove")}
                            >
                              <CrossIcon className="h-2.5 w-2.5" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <input
                    aria-label={t("f.guests.search")}
                    className="w-full h-9 px-3 text-[13px] bg-transparent outline-none border-b border-[var(--border-subtle)] placeholder:text-[var(--text-dim)]"
                    value={attendeeSearch}
                    onChange={(e) => setAttendeeSearch(e.target.value)}
                    placeholder={t("f.guests.search")}
                  />
                  <div className="max-h-44 overflow-y-auto">
                    {filteredPeople.length === 0 ? (
                      <p className="px-3 py-3 text-[12px] text-[var(--text-dim)]">{t("f.guests.empty")}</p>
                    ) : (
                      filteredPeople.map((p) => {
                        const checked = attendeeIds.includes(p.account_id);
                        return (
                          <button
                            key={p.account_id}
                            type="button"
                            onClick={() => toggleAttendee(p.account_id)}
                            aria-pressed={checked}
                            className="w-full flex items-center gap-2 px-3 py-2 text-start hover:bg-[var(--bg-surface-subtle)] transition-colors"
                          >
                            <span
                              className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center ${
                                checked ? "bg-[var(--bg-inverted)] border-[var(--bg-inverted)]" : "border-[var(--border-subtle)]"
                              }`}
                            >
                              {checked && <span className="h-1.5 w-1.5 rounded-sm bg-[var(--text-inverted)]" />}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[13px] text-[var(--text-primary)] truncate">
                                {p.full_name || p.username}
                                {altFor(p.account_id) && (
                                  <span lang="zh" className="ms-1 text-[0.85em] font-normal text-[var(--text-dim)]">
                                    {altFor(p.account_id)}
                                  </span>
                                )}
                              </span>
                              <span className="block text-[11px] text-[var(--text-dim)] truncate">
                                {[p.position, p.department].filter(Boolean).join(" · ") || `@${p.username}`}
                              </span>
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Free/busy of the organizer and the picked guests */}
          {!readOnly && attendeeIds.length > 0 && guestsState !== "failed" && (
            <FreeBusy
              accountIds={fbIds}
              nameFor={(id) => (id === organizerId && !personById.has(id) ? t("fb.organizer") : nameFor(id))}
              dayKey={fbDay}
              timezone={timezone}
              proposal={fbProposal}
              holidays={holidaysOn?.(fbDay) ?? []}
            />
          )}

          {/* Location */}
          <div>
            <label htmlFor={ids.location} className={labelClass}>{t("f.location")}</label>
            <input
              id={ids.location}
              className={inputClass}
              value={form.location ?? ""}
              disabled={readOnly}
              onChange={(e) => patch("location", e.target.value || null)}
              placeholder={readOnly ? "" : t("f.location.placeholder")}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor={ids.description} className={labelClass}>{t("f.description")}</label>
            <textarea
              id={ids.description}
              className={textareaClass}
              rows={3}
              value={form.description ?? ""}
              disabled={readOnly}
              onChange={(e) => patch("description", e.target.value || null)}
              placeholder={readOnly ? "" : t("f.description.placeholder")}
            />
          </div>

          {/* Meeting link + Join, and the chat with the guests */}
          {(!readOnly || link || chatHref) && (
          <div>
            {readOnly
              ? <span className={labelClass}>{t("f.meetingUrl")}</span>
              : <label htmlFor={ids.link} className={labelClass}>{t("f.meetingUrl")}</label>}
            {!readOnly && (
              <input
                id={ids.link}
                type="url"
                inputMode="url"
                dir="ltr"
                className={`${inputClass} ${linkInvalid ? "border-[var(--state-error)]" : ""}`}
                value={form.meeting_url ?? ""}
                maxLength={500}
                onChange={(e) => patch("meeting_url", e.target.value || null)}
                placeholder="https://"
                aria-invalid={linkInvalid || undefined}
                aria-describedby={linkInvalid ? ids.linkHint : undefined}
              />
            )}
            {linkInvalid && (
              <p id={ids.linkHint} className="mt-1 text-[11px] text-[var(--state-error)]">{t("err.meetingUrl")}</p>
            )}
            {(link || chatHref) && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`h-9 px-4 rounded-xl inline-flex items-center gap-2 text-[13px] font-semibold transition-colors ${
                      joinToday
                        ? "bg-[#567FB2] text-white hover:bg-[#4A6F9E] dark:bg-[#7FA9D6] dark:text-[#0B1320] dark:hover:bg-[#BCD8F0] shadow-lg"
                        : "bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[#567FB2] dark:text-[#7FA9D6] hover:border-[var(--border-focus)]"
                    }`}
                  >
                    <VideoIcon size={15} aria-hidden /> {t("join")}
                    <span className="sr-only"> · {link}</span>
                  </a>
                )}
                {chatHref && (
                  <a
                    href={chatHref}
                    className="h-9 px-4 rounded-xl inline-flex items-center gap-2 text-[13px] font-semibold bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-colors"
                  >
                    <MessageSquareIcon size={15} aria-hidden /> {t("chatAttendees")}
                  </a>
                )}
              </div>
            )}
          </div>
          )}

          {localError && (
            <div role="alert" className="rounded-lg border border-[var(--state-error)]/30 bg-[var(--state-error)]/[0.08] text-[var(--state-error)] px-3 py-2 text-[12px]">
              {localError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-[var(--border-subtle)]">
          {mode === "edit" && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete({ hasGuests: liveGuests, scope: onOccurrence ? scope : "all" })}
              disabled={saving}
              className="h-10 px-4 sm:px-6 rounded-xl bg-[var(--state-error)]/10 border border-[var(--state-error)]/30 text-[var(--state-error)] text-[13px] font-semibold flex items-center gap-2 hover:bg-[var(--state-error)]/20 transition-all disabled:opacity-60"
            >
              <TrashIcon className="h-4 w-4" /> {t("modal.delete")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {readOnly ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-semibold hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all"
                >
                  {t("modal.close")}
                </button>
                {myInvite && myInvite.status !== "declined" && (
                  <button
                    type="button"
                    onClick={() => respond("declined")}
                    disabled={saving}
                    className="h-10 px-4 rounded-xl bg-[var(--state-error)]/10 border border-[var(--state-error)]/30 text-[var(--state-error)] text-[13px] font-semibold hover:bg-[var(--state-error)]/20 transition-all disabled:opacity-60"
                  >
                    {t("modal.decline")}
                  </button>
                )}
                {myInvite && myInvite.status !== "accepted" && (
                  <button
                    type="button"
                    onClick={() => respond("accepted")}
                    disabled={saving}
                    className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold transition-all shadow-lg disabled:opacity-60"
                  >
                    {t("modal.accept")}
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-semibold hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all"
                >
                  {t("modal.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || guestsLoading}
                  title={guestsLoading ? t("modal.guestsLoading") : undefined}
                  className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 transition-all shadow-lg disabled:opacity-60"
                >
                  <DiskIcon className="h-4 w-4" />
                  {saving ? t("modal.saving") : t("modal.save")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
