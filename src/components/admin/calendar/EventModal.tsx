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
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useTranslation } from "@/lib/i18n";
import { calendarT } from "@/lib/translations/calendar";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import DiskIcon from "@/components/icons/ui/DiskIcon";
import CalendarPlusIcon from "@/components/icons/ui/CalendarPlusIcon";
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
  createEvent,
  updateEvent,
  fetchAttendees,
  saveAttendees,
  respondToInvite,
  type CalendarAttendee,
} from "@/lib/calendar-events";
import { CALENDAR_EVENT_TYPES, CALENDAR_RECURRENCES, EVENT_TYPE_COLORS } from "@/lib/calendar-enums";
import { toDateTimeLocal, fromDateTimeLocal, toDateInput, fromDateInput } from "@/lib/calendar-utils";

/* Preset swatches (type colors + a few neutrals) for the color picker. */
const COLOR_PALETTE = [
  "#3B82F6", "#10B981", "#F59E0B", "#A855F7",
  "#EC4899", "#EF4444", "#0EA5E9", "#64748B",
];
const REMINDER_MINUTES: Array<number | null> = [null, 0, 5, 10, 15, 30, 60, 1440];
const DURATION_CHIPS: { label: string; min: number }[] = [
  { label: "15m", min: 15 },
  { label: "30m", min: 30 },
  { label: "1h", min: 60 },
  { label: "2h", min: 120 },
];

export type EventDraft = CalendarEventInsert;
export type EventModalMode = "create" | "edit" | "view";

interface Props {
  draft: EventDraft;
  existingId: string | null;
  mode: EventModalMode;
  /** The signed-in account — the guest whose answer PATCH records. */
  viewerId: string | null;
  onClose: () => void;
  onSaved: (ev: CalendarEventRow) => void;
  onDelete?: () => void;
  onResponded?: (status: CalendarAttendeeStatus) => void;
  onError?: (msg: string) => void;
}

const inputClass =
  "w-full h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors disabled:opacity-70";
const textareaClass =
  "w-full px-3 py-2 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors resize-y disabled:opacity-70";
const labelClass =
  "block text-[10px] font-semibold text-[var(--text-dim)] mb-1.5 uppercase tracking-wider";

export default function EventModal({
  draft,
  existingId,
  mode,
  viewerId,
  onClose,
  onSaved,
  onDelete,
  onResponded,
  onError,
}: Props) {
  const { t } = useTranslation(calendarT);
  useScrollLock();
  const readOnly = mode === "view";
  const [form, setForm] = useState<EventDraft>(draft);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  // Portal to <body> so the overlay is viewport-level (the calendar page sits
  // inside a scroll container, which otherwise traps `position: fixed` and lets
  // the app header paint over the modal's top). mounted guards SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* Guests. Stored separately from the event row and persisted via the
     attendees endpoint after the event itself saves. */
  const [people, setPeople] = useState<TodoAssigneeInfo[]>([]);
  const [attendees, setAttendees] = useState<CalendarAttendee[]>([]);
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [showGuests, setShowGuests] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchAssignableEmployees().then((list) => { if (alive) setPeople(list); });
    if (existingId) {
      fetchAttendees(existingId).then((list) => {
        if (!alive) return;
        setAttendees(list);
        setAttendeeIds(list.map((a) => a.account_id));
        if (list.length) setShowGuests(true);
      });
    }
    return () => { alive = false; };
  }, [existingId]);

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
    return p?.full_name || p?.username || attendees.find((a) => a.account_id === id)?.name || "—";
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

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function patch<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** Toggle all-day: when enabled, round to day boundaries; when disabled,
      restore sensible hour defaults. */
  function toggleAllDay(next: boolean) {
    const start = new Date(form.start_at);
    const end = new Date(form.end_at);
    if (next) {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setHours(9, 0, 0, 0);
      end.setHours(10, 0, 0, 0);
    }
    setForm({ ...form, all_day: next, start_at: start.toISOString(), end_at: end.toISOString() });
  }

  async function handleSave() {
    if (readOnly) return;
    if (!form.title.trim()) { setLocalError(t("err.titleRequired")); return; }
    if (new Date(form.end_at) < new Date(form.start_at)) { setLocalError(t("err.endBeforeStart")); return; }
    setLocalError(null);
    setSaving(true);

    const payload: EventDraft = {
      ...form,
      title: form.title.trim(),
      description: form.description?.trim() || null,
      location: form.location?.trim() || null,
    };

    const saved = existingId ? await updateEvent(existingId, payload) : await createEvent(payload);
    setSaving(false);
    if (!saved) { onError?.(t("err.save")); return; }

    // Bridge: a NEW Calendar event of type "task" also appears in the To-do app.
    if (!existingId && form.event_type === "task") {
      try {
        const { createTodo } = await import("@/lib/todo-admin");
        await createTodo({
          title: payload.title,
          description: payload.description,
          priority: "medium",
          due_date: form.start_at,
          source: "calendar",
          source_id: saved.id,
          assignee_account_ids: [form.account_id],
        });
      } catch (e) {
        /* The event is saved; a failed bridge must not undo that. */
        console.error("[calendar→todo bridge]", e instanceof Error ? e.message : e);
      }
    }

    /* The guest list follows the event. Best-effort — the event is already
       saved; a failed invite is re-sent on the next edit. */
    const ok = await saveAttendees(saved.id, attendeeIds);
    if (!ok) console.error("[Calendar] guests were not saved for", saved.id);

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

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl"
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
            <h2 className="text-[15px] font-bold text-[var(--text-primary)]">{heading}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
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

          {/* Title */}
          <div>
            <label className={labelClass}>{t("f.title")}</label>
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => patch("title", e.target.value)}
              placeholder={t("f.title.placeholder")}
              autoFocus={!readOnly}
              disabled={readOnly}
            />
          </div>

          {/* Type */}
          <div>
            <label className={labelClass}>{t("f.type")}</label>
            <select
              className={inputClass}
              value={form.event_type}
              onChange={(e) => patch("event_type", e.target.value as CalendarEventType)}
              disabled={readOnly}
            >
              {CALENDAR_EVENT_TYPES.map((ev) => (
                <option key={ev} value={ev}>{t(`type.${ev}`)}</option>
              ))}
            </select>
          </div>

          {/* Color picker — Default (type color) + preset swatches */}
          {!readOnly && (
            <div>
              <label className={labelClass}>{t("f.color")}</label>
              <div className="flex items-center gap-2 flex-wrap">
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
                disabled={readOnly}
                className="h-4 w-4 rounded border-[var(--border-subtle)]"
              />
              <span className="text-[13px] text-[var(--text-muted)]">{t("f.allDay")}</span>
            </label>
            {!readOnly && (
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

          {/* Start / End */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("f.start")}</label>
              {form.all_day ? (
                <input
                  type="date"
                  className={inputClass}
                  value={toDateInput(startDate)}
                  disabled={readOnly}
                  onChange={(e) => {
                    const d = fromDateInput(e.target.value);
                    d.setHours(0, 0, 0, 0);
                    patch("start_at", d.toISOString());
                  }}
                />
              ) : (
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={toDateTimeLocal(startDate)}
                  disabled={readOnly}
                  onChange={(e) => patch("start_at", fromDateTimeLocal(e.target.value).toISOString())}
                />
              )}
            </div>
            <div>
              <label className={labelClass}>{t("f.end")}</label>
              {form.all_day ? (
                <input
                  type="date"
                  className={inputClass}
                  value={toDateInput(endDate)}
                  disabled={readOnly}
                  onChange={(e) => {
                    const d = fromDateInput(e.target.value);
                    d.setHours(23, 59, 59, 999);
                    patch("end_at", d.toISOString());
                  }}
                />
              ) : (
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={toDateTimeLocal(endDate)}
                  disabled={readOnly}
                  onChange={(e) => patch("end_at", fromDateTimeLocal(e.target.value).toISOString())}
                />
              )}
            </div>
          </div>

          {/* Quick duration chips (timed events only) */}
          {!form.all_day && !readOnly && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-[var(--text-dim)] me-1">{t("f.duration")}</span>
              {DURATION_CHIPS.map((d) => {
                const active = endDate.getTime() - startDate.getTime() === d.min * 60_000;
                return (
                  <button
                    key={d.min}
                    type="button"
                    onClick={() => setDuration(d.min)}
                    className={`h-7 px-3 rounded-full text-[11px] font-medium border transition-all ${
                      active
                        ? "border-[var(--border-focus)] text-[var(--text-primary)] bg-[var(--bg-surface-subtle)]"
                        : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Reminder + Repeat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("f.reminder")}</label>
              <select
                className={inputClass}
                value={form.reminder_minutes ?? ""}
                disabled={readOnly}
                onChange={(e) => patch("reminder_minutes", e.target.value === "" ? null : Number(e.target.value))}
              >
                {REMINDER_MINUTES.map((v) => (
                  <option key={String(v)} value={v ?? ""}>{t(`reminder.${v ?? "none"}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("f.repeat")}</label>
              <select
                className={inputClass}
                value={form.recurrence ?? ""}
                disabled={readOnly}
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
              <label className={labelClass}>{t("f.repeatUntil")}</label>
              <input
                type="date"
                className={inputClass}
                value={form.recurrence_until ?? ""}
                disabled={readOnly}
                onChange={(e) => patch("recurrence_until", e.target.value || null)}
              />
              {!readOnly && (
                <p className="mt-1 text-[11px] text-[var(--text-dim)]">{t("f.repeatUntil.hint")}</p>
              )}
            </div>
          )}

          {/* Guests */}
          {readOnly ? (
            attendees.length > 0 && (
              <div>
                <label className={labelClass}>{t("modal.guests")}</label>
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
                className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <span>{t("f.guests")}</span>
                {attendeeIds.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[10px] font-semibold">
                    {attendeeIds.length}
                  </span>
                )}
              </button>

              {showGuests && (
                <div className="mt-2 rounded-xl border border-[var(--border-subtle)] overflow-hidden">
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
                            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-surface-subtle)] transition-colors"
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

          {/* Location */}
          <div>
            <label className={labelClass}>{t("f.location")}</label>
            <input
              className={inputClass}
              value={form.location ?? ""}
              disabled={readOnly}
              onChange={(e) => patch("location", e.target.value || null)}
              placeholder={readOnly ? "" : t("f.location.placeholder")}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>{t("f.description")}</label>
            <textarea
              className={textareaClass}
              rows={3}
              value={form.description ?? ""}
              disabled={readOnly}
              onChange={(e) => patch("description", e.target.value || null)}
              placeholder={readOnly ? "" : t("f.description.placeholder")}
            />
          </div>

          {localError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/[0.08] text-red-300 px-3 py-2 text-[12px]">
              {localError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-[var(--border-subtle)]">
          {mode === "edit" && onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={saving}
              className="h-10 px-6 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-[13px] font-semibold flex items-center gap-2 hover:bg-red-500/30 transition-all disabled:opacity-60"
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
                    className="h-10 px-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-[13px] font-semibold hover:bg-red-500/30 transition-all disabled:opacity-60"
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
                  disabled={saving}
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
