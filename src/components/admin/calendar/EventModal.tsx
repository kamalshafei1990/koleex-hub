"use client";

/* ---------------------------------------------------------------------------
   EventModal — create / edit a calendar event.

   Fields:
     - Title
     - Type (meeting / task / reminder / event / holiday / out_of_office)
     - All-day toggle
     - Start / End (datetime-local when timed, date when all-day)
     - Location
     - Description
     - Color override (null = default for type)

   Calls onSaved with the persisted row, or onDelete for the delete button
   (only shown on existing events).
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
  AccountRow,
  CalendarEventRow,
  CalendarEventInsert,
  CalendarEventType,
  CalendarRecurrence,
} from "@/types/supabase";
import { fetchAccounts } from "@/lib/accounts-admin";
import {
  createEvent,
  updateEvent,
} from "@/lib/calendar-events";

/* Preset swatches (type colors + a few neutrals) for the color picker. */
const COLOR_PALETTE = [
  "#3B82F6", "#10B981", "#F59E0B", "#A855F7",
  "#EC4899", "#EF4444", "#0EA5E9", "#64748B",
];
const REMINDER_OPTIONS: { label: string; v: number | null }[] = [
  { label: "None", v: null },
  { label: "At start time", v: 0 },
  { label: "5 minutes before", v: 5 },
  { label: "10 minutes before", v: 10 },
  { label: "15 minutes before", v: 15 },
  { label: "30 minutes before", v: 30 },
  { label: "1 hour before", v: 60 },
  { label: "1 day before", v: 1440 },
];
const REPEAT_OPTIONS: { label: string; v: CalendarRecurrence }[] = [
  { label: "Does not repeat", v: null },
  { label: "Daily", v: "daily" },
  { label: "Weekly", v: "weekly" },
  { label: "Monthly", v: "monthly" },
];
const DURATION_CHIPS: { label: string; min: number }[] = [
  { label: "15m", min: 15 },
  { label: "30m", min: 30 },
  { label: "1h", min: 60 },
  { label: "2h", min: 120 },
];
import {
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_COLORS,
  toDateTimeLocal,
  fromDateTimeLocal,
  toDateInput,
  fromDateInput,
  addDays,
} from "@/lib/calendar-utils";

export type EventDraft = CalendarEventInsert;

interface Props {
  draft: EventDraft;
  existingId: string | null;
  onClose: () => void;
  onSaved: (ev: CalendarEventRow) => void;
  onDelete?: () => void;
  onError?: (msg: string) => void;
}

const inputClass =
  "w-full h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors";
const textareaClass =
  "w-full px-3 py-2 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors resize-y";
const labelClass =
  "block text-[10px] font-semibold text-[var(--text-dim)] mb-1.5 uppercase tracking-wider";

export default function EventModal({
  draft,
  existingId,
  onClose,
  onSaved,
  onDelete,
  onError,
}: Props) {
  const { t } = useTranslation(calendarT);
  useScrollLock();
  const [form, setForm] = useState<EventDraft>(draft);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  // Portal to <body> so the overlay is viewport-level (the calendar page sits
  // inside a scroll container, which otherwise traps `position: fixed` and lets
  // the app header paint over the modal's top). mounted guards SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* Attendees (invite people). Stored separately from the event row and
     persisted via the attendees endpoint after the event itself saves. */
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [showGuests, setShowGuests] = useState(false);

  // Load the account directory once; on edit, also load the current attendees.
  useEffect(() => {
    let alive = true;
    fetchAccounts()
      .then((list) => { if (alive) setAccounts(list.filter((a) => a.user_type === "internal")); })
      .catch(() => {});
    if (existingId) {
      fetch(`/api/calendar/events/${existingId}/attendees`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { attendees?: { account_id: string }[] } | null) => {
          if (alive && j?.attendees) {
            const ids = j.attendees.map((a) => a.account_id);
            setAttendeeIds(ids);
            if (ids.length) setShowGuests(true);
          }
        })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [existingId]);

  const organizerId = form.account_id;
  const filteredAccounts = useMemo(() => {
    const q = attendeeSearch.trim().toLowerCase();
    return accounts
      .filter((a) => a.id !== organizerId)
      .filter((a) => !q || (a.username ?? "").toLowerCase().includes(q) || (a.login_email ?? "").toLowerCase().includes(q))
      .slice(0, 40);
  }, [accounts, attendeeSearch, organizerId]);

  const nameFor = (id: string) => {
    const a = accounts.find((x) => x.id === id);
    return a?.username || a?.login_email || "Someone";
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
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
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
    setForm({
      ...form,
      all_day: next,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
    });
  }

  async function handleSave() {
    if (!form.title.trim()) {
      setLocalError("Title is required.");
      return;
    }
    const start = new Date(form.start_at);
    const end = new Date(form.end_at);
    if (end < start) {
      setLocalError("End time must be after start time.");
      return;
    }
    setLocalError(null);
    setSaving(true);

    const payload: EventDraft = {
      ...form,
      title: form.title.trim(),
      description: form.description?.trim() || null,
      location: form.location?.trim() || null,
    };

    const saved = existingId
      ? await updateEvent(existingId, payload)
      : await createEvent(payload);

    setSaving(false);
    if (!saved) {
      onError?.(`Could not ${existingId ? "update" : "create"} the event.`);
      return;
    }

    // Bridge: Calendar events with type "task" also appear in the To-do app
    if (!existingId && form.event_type === "task") {
      try {
        const { createTodo } = await import("@/lib/todo-admin");
        await createTodo({
          title: form.title.trim(),
          description: form.description?.trim() || null,
          priority: "medium",
          due_date: form.start_at,
          source: "calendar",
          source_id: saved.id,
          created_by_account_id: form.account_id,
          assigned_by_account_id: form.account_id,
          assignee_account_ids: [form.account_id],
        });
      } catch { /* todo table may not exist yet — ignore silently */ }
    }

    // Persist the guest list (organizer stripped server-side). Best-effort —
    // the event is already saved; a failed invite must not lose the event.
    try {
      await fetch(`/api/calendar/events/${saved.id}/attendees`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountIds: attendeeIds }),
      });
    } catch { /* ignore — invites can be re-sent on next edit */ }

    onSaved(saved);
  }

  const startDate = new Date(form.start_at);
  const endDate = new Date(form.end_at);
  const color = form.color || EVENT_TYPE_COLORS[form.event_type];

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70"
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
              style={{
                backgroundColor: color + "22",
                color,
                border: `1px solid ${color}55`,
              }}
            >
              <CalendarPlusIcon className="h-4 w-4" />
            </div>
            <h2 className="text-[15px] font-bold text-[var(--text-primary)]">
              {existingId ? t("modal.edit") : t("modal.new")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] flex items-center justify-center transition-all"
          >
            <CrossIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className={labelClass}>{t("f.title")}</label>
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => patch("title", e.target.value)}
              placeholder={t("f.title.placeholder")}
              autoFocus
            />
          </div>

          {/* Type */}
          <div>
            <label className={labelClass}>{t("f.type")}</label>
            <select
              className={inputClass}
              value={form.event_type}
              onChange={(e) =>
                patch("event_type", e.target.value as CalendarEventType)
              }
            >
              {EVENT_TYPES.map((ev) => (
                <option key={ev} value={ev}>
                  {t(`type.${ev}`, EVENT_TYPE_LABELS[ev])}
                </option>
              ))}
            </select>
          </div>

          {/* Color picker — Default (type color) + preset swatches */}
          <div>
            <label className={labelClass}>{t("f.color")}</label>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => patch("color", null)}
                title="Default (type color)"
                className={`h-7 px-2.5 rounded-full text-[11px] font-medium border transition-all ${
                  !form.color
                    ? "border-[var(--border-focus)] text-[var(--text-primary)]"
                    : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                }`}
              >
                Default
              </button>
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => patch("color", c)}
                  aria-label={`Color ${c}`}
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

          {/* All-day + Private toggles */}
          <div className="flex items-center gap-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.all_day}
                onChange={(e) => toggleAllDay(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border-subtle)]"
              />
              <span className="text-[13px] text-[var(--text-muted)]">{t("f.allDay")}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!form.is_private}
                onChange={(e) => patch("is_private", e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border-subtle)]"
              />
              <span className="text-[13px] text-[var(--text-muted)]">
                {t("f.private", "Private")}
              </span>
            </label>
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
                  onChange={(e) => {
                    const d = fromDateTimeLocal(e.target.value);
                    patch("start_at", d.toISOString());
                  }}
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
                  onChange={(e) => {
                    const d = fromDateTimeLocal(e.target.value);
                    patch("end_at", d.toISOString());
                  }}
                />
              )}
            </div>
          </div>

          {/* Quick duration chips (timed events only) */}
          {!form.all_day && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-[var(--text-dim)] mr-1">{t("f.duration", "Duration")}</span>
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
              <label className={labelClass}>{t("f.reminder", "Reminder")}</label>
              <select
                className={inputClass}
                value={form.reminder_minutes ?? ""}
                onChange={(e) =>
                  patch("reminder_minutes", e.target.value === "" ? null : Number(e.target.value))
                }
              >
                {REMINDER_OPTIONS.map((o) => (
                  <option key={String(o.v)} value={o.v ?? ""}>
                    {t(`reminder.${o.v ?? "none"}`, o.label)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("f.repeat", "Repeat")}</label>
              <select
                className={inputClass}
                value={form.recurrence ?? ""}
                onChange={(e) =>
                  patch("recurrence", (e.target.value || null) as CalendarRecurrence)
                }
              >
                {REPEAT_OPTIONS.map((o) => (
                  <option key={String(o.v)} value={o.v ?? ""}>
                    {t(`repeat.${o.v ?? "none"}`, o.label)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Repeat-until (only when a recurrence is set) */}
          {form.recurrence && (
            <div>
              <label className={labelClass}>{t("f.repeatUntil", "Repeat until")}</label>
              <input
                type="date"
                className={inputClass}
                value={form.recurrence_until ?? ""}
                onChange={(e) => patch("recurrence_until", e.target.value || null)}
              />
              <p className="mt-1 text-[11px] text-[var(--text-dim)]">
                {t("f.repeatUntil.hint", "Leave empty to repeat indefinitely.")}
              </p>
            </div>
          )}

          {/* Invite people (attendees) */}
          <div>
            <button
              type="button"
              onClick={() => setShowGuests((s) => !s)}
              className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <span>{t("f.guests", "Invite people")}</span>
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
                    {attendeeIds.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)]"
                      >
                        {nameFor(id)}
                        <button
                          type="button"
                          onClick={() => toggleAttendee(id)}
                          className="h-4 w-4 grid place-items-center rounded-full hover:bg-[var(--bg-surface-subtle)] text-[var(--text-dim)]"
                          aria-label="Remove"
                        >
                          <CrossIcon className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  className="w-full h-9 px-3 text-[13px] bg-transparent outline-none border-b border-[var(--border-subtle)] placeholder:text-[var(--text-dim)]"
                  value={attendeeSearch}
                  onChange={(e) => setAttendeeSearch(e.target.value)}
                  placeholder={t("f.guests.search", "Search people…")}
                />
                <div className="max-h-44 overflow-y-auto">
                  {filteredAccounts.length === 0 ? (
                    <p className="px-3 py-3 text-[12px] text-[var(--text-dim)]">
                      {t("f.guests.empty", "No people found.")}
                    </p>
                  ) : (
                    filteredAccounts.map((a) => {
                      const checked = attendeeIds.includes(a.id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => toggleAttendee(a.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-surface-subtle)] transition-colors"
                        >
                          <span
                            className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center ${
                              checked
                                ? "bg-[var(--bg-inverted)] border-[var(--bg-inverted)]"
                                : "border-[var(--border-subtle)]"
                            }`}
                          >
                            {checked && <span className="h-1.5 w-1.5 rounded-sm bg-[var(--text-inverted)]" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[13px] text-[var(--text-primary)] truncate">
                              {a.username || a.login_email || "—"}
                            </span>
                            {a.login_email && a.username && (
                              <span className="block text-[11px] text-[var(--text-dim)] truncate">
                                {a.login_email}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Location */}
          <div>
            <label className={labelClass}>{t("f.location")}</label>
            <input
              className={inputClass}
              value={form.location ?? ""}
              onChange={(e) => patch("location", e.target.value || null)}
              placeholder={t("f.location.placeholder")}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>{t("f.description")}</label>
            <textarea
              className={textareaClass}
              rows={3}
              value={form.description ?? ""}
              onChange={(e) => patch("description", e.target.value || null)}
              placeholder={t("f.description.placeholder")}
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
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={saving}
              className="h-10 px-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-[13px] font-medium flex items-center gap-2 hover:bg-red-500/15 transition-all disabled:opacity-60"
            >
              <TrashIcon className="h-4 w-4" /> {t("modal.delete")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-medium hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all"
            >
              {t("modal.cancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg disabled:opacity-60"
            >
              <DiskIcon className="h-4 w-4" />
              {saving ? t("modal.saving") : t("modal.save")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Silence unused-import warning (used transitively via other helpers).
void addDays;
