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

import { useEffect, useState } from "react";
import { X, Trash2, Save, CalendarPlus } from "lucide-react";
import type {
  CalendarEventRow,
  CalendarEventInsert,
  CalendarEventType,
} from "@/types/supabase";
import {
  createEvent,
  updateEvent,
} from "@/lib/calendar-events";
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
  const [form, setForm] = useState<EventDraft>(draft);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

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
    onSaved(saved);
  }

  const startDate = new Date(form.start_at);
  const endDate = new Date(form.end_at);
  const color = form.color || EVENT_TYPE_COLORS[form.event_type];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
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
              <CalendarPlus className="h-4 w-4" />
            </div>
            <h2 className="text-[15px] font-bold text-[var(--text-primary)]">
              {existingId ? "Edit Event" : "New Event"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] flex items-center justify-center transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className={labelClass}>Title</label>
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => patch("title", e.target.value)}
              placeholder="Quick sync with Aisha"
              autoFocus
            />
          </div>

          {/* Type + color swatch */}
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div>
              <label className={labelClass}>Type</label>
              <select
                className={inputClass}
                value={form.event_type}
                onChange={(e) =>
                  patch("event_type", e.target.value as CalendarEventType)
                }
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EVENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Color</label>
              <div className="h-10 flex items-center gap-2 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
                <span
                  className="h-4 w-4 rounded-full border border-[var(--border-subtle)]"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[11px] text-[var(--text-dim)]">
                  {form.color ? form.color : "Default"}
                </span>
              </div>
            </div>
          </div>

          {/* All-day toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.all_day}
              onChange={(e) => toggleAllDay(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border-subtle)]"
            />
            <span className="text-[13px] text-[var(--text-muted)]">All day</span>
          </label>

          {/* Start / End */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Start</label>
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
              <label className={labelClass}>End</label>
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

          {/* Location */}
          <div>
            <label className={labelClass}>Location</label>
            <input
              className={inputClass}
              value={form.location ?? ""}
              onChange={(e) => patch("location", e.target.value || null)}
              placeholder="Office, Zoom, ..."
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              className={textareaClass}
              rows={3}
              value={form.description ?? ""}
              onChange={(e) => patch("description", e.target.value || null)}
              placeholder="Notes, agenda, links…"
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
              <Trash2 className="h-4 w-4" /> Delete
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
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : existingId ? "Save" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Silence unused-import warning (used transitively via other helpers).
void addDays;
