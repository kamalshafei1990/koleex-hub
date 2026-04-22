"use client";

/* ---------------------------------------------------------------------------
   CalendarApp — top-level shell for the Koleex Hub calendar.

   Responsibilities:
   - Pick the active account (from ?account= URL param or first internal).
   - Load that account's preferences.calendar (timezone, working hours, OOO).
   - Manage the current focus date + view (month / week / day).
   - Fetch events in the visible window.
   - Delegate rendering to MonthView / WeekView / DayView.
   - Open EventModal for create / edit / delete.

   Stays fully self-contained — no Google sync, no external APIs. Data lives
   in koleex_calendar_events and accounts.preferences.calendar.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import AngleLeftIcon from "@/components/icons/ui/AngleLeftIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import UserCircle2Icon from "@/components/icons/ui/UserCircle2Icon";
import CalendarIcon from "@/components/icons/CalendarIcon";
import type {
  AccountRow,
  AccountWithLinks,
  CalendarEventRow,
} from "@/types/supabase";
import {
  fetchAccounts,
  fetchAccountWithLinks,
} from "@/lib/accounts-admin";
import { fetchEventsInRange, deleteEvent } from "@/lib/calendar-events";
import { withDefaults } from "@/lib/access-control";
import { useTranslation } from "@/lib/i18n";
import { calendarT } from "@/lib/translations/calendar";
import {
  loadScopeContext,
  filterAccessibleAccounts,
  type ScopeContext,
} from "@/lib/scope";
import { getCurrentAccountIdSync } from "@/lib/identity";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  formatMonthYear,
  formatWeekRange,
  startOfDay,
  endOfDay,
  startOfMonth,
  startOfWeek,
} from "@/lib/calendar-utils";

import MonthView from "./MonthView";
import WeekView from "./WeekView";
import DayView from "./DayView";
import EventModal, { type EventDraft } from "./EventModal";

type ViewKey = "month" | "week" | "day";

const viewLabels: Record<ViewKey, string> = {
  month: "Month",
  week: "Week",
  day: "Day",
};

export default function CalendarApp() {
  const { t } = useTranslation(calendarT);
  // Account selection
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [activeAccount, setActiveAccount] = useState<AccountWithLinks | null>(
    null,
  );

  // View state
  const [view, setView] = useState<ViewKey>("month");
  const [focusDate, setFocusDate] = useState<Date>(() => new Date());

  // Data
  const [events, setEvents] = useState<CalendarEventRow[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Modal state
  const [modalDraft, setModalDraft] = useState<EventDraft | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEventRow | null>(
    null,
  );

  // Feedback
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Scope context for the logged-in user — drives whether the "view as
  // another account" feature actually resolves any events (only Super Admin
  // can view other accounts' calendars; regular users are restricted to
  // their own scope).
  const [scopeCtx, setScopeCtx] = useState<ScopeContext | null>(null);
  useEffect(() => {
    const loggedInId = getCurrentAccountIdSync();
    if (!loggedInId) return;
    loadScopeContext(loggedInId).then(setScopeCtx);
  }, []);

  /* ── Initial account load ──
     The picker shows only accounts the current user is allowed to view.
     This is Scope-gated: Super Admin + Scope=All see everyone,
     Scope=Department sees their teammates, Scope=Own sees only themselves.
     Without scopeCtx loaded yet we fetch everything and filter on the
     next render once ctx arrives. */
  useEffect(() => {
    (async () => {
      setLoadingAccounts(true);
      const list = await fetchAccounts();

      // If scope context is already resolved, filter the account list by
      // what the viewer can access. Otherwise show the full list — the
      // later effect re-filters once ctx lands.
      let visible = list;
      if (scopeCtx) {
        const visibleIds = await filterAccessibleAccounts(
          scopeCtx,
          "Calendar",
          list.map((a) => a.id),
        );
        const allowedSet = new Set(visibleIds);
        visible = list.filter((a) => allowedSet.has(a.id));
      }
      setAccounts(visible);

      // URL hint
      let pickId: string | null = null;
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        pickId = params.get("account");
      }
      const chosen =
        (pickId && visible.find((a) => a.id === pickId)?.id) ||
        visible.find((a) => a.user_type === "internal")?.id ||
        visible[0]?.id ||
        null;
      setActiveAccountId(chosen);
      setLoadingAccounts(false);
    })();
    // Re-run when scopeCtx arrives so the picker narrows to accessible accounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeCtx]);

  /* ── Load account preferences whenever the active account changes ── */
  useEffect(() => {
    if (!activeAccountId) {
      setActiveAccount(null);
      return;
    }
    (async () => {
      const full = await fetchAccountWithLinks(activeAccountId);
      setActiveAccount(full);
    })();
  }, [activeAccountId]);

  /* ── Compute the visible time range based on view + focus date ── */
  const visibleRange = useMemo(() => {
    if (view === "month") {
      // Include leading / trailing days shown in the grid
      const gridStart = startOfWeek(startOfMonth(focusDate));
      const gridEnd = addDays(gridStart, 42);
      return { from: gridStart, to: gridEnd };
    }
    if (view === "week") {
      return {
        from: startOfWeek(focusDate),
        to: addDays(endOfWeek(focusDate), 1),
      };
    }
    return { from: startOfDay(focusDate), to: addDays(startOfDay(focusDate), 1) };
  }, [view, focusDate]);

  /* ── Fetch events whenever the account or visible window changes ── */
  const loadEvents = useCallback(async () => {
    if (!activeAccountId) return;
    setLoadingEvents(true);
    const rows = await fetchEventsInRange(
      activeAccountId,
      visibleRange.from,
      visibleRange.to,
      scopeCtx,
    );
    setEvents(rows);
    setLoadingEvents(false);
  }, [activeAccountId, visibleRange, scopeCtx]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  /* ── Navigation ── */
  function goPrev() {
    setFocusDate((d) =>
      view === "month" ? addMonths(d, -1) : addDays(d, view === "week" ? -7 : -1),
    );
  }
  function goNext() {
    setFocusDate((d) =>
      view === "month" ? addMonths(d, 1) : addDays(d, view === "week" ? 7 : 1),
    );
  }
  function goToday() {
    setFocusDate(new Date());
  }

  /* ── Event open handlers ── */
  function openNewEvent(dayHint?: Date) {
    if (!activeAccountId) return;
    const prefs = withDefaults(activeAccount?.preferences);
    const defaultLen = prefs.calendar?.default_meeting_duration_min ?? 30;
    const start = dayHint ? new Date(dayHint) : roundToNextHalfHour(new Date());
    // If hint was a day (midnight), bump to the default working-hour start
    if (dayHint && dayHint.getHours() === 0 && dayHint.getMinutes() === 0) {
      const wh = prefs.calendar?.working_hours?.start || "09:00";
      const [h, m] = wh.split(":").map(Number);
      start.setHours(h || 9, m || 0, 0, 0);
    }
    const end = new Date(start.getTime() + defaultLen * 60 * 1000);
    setEditingEvent(null);
    setModalDraft({
      account_id: activeAccountId,
      title: "",
      description: null,
      location: null,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      all_day: false,
      event_type: "meeting",
      color: null,
    });
  }

  function openEditEvent(e: CalendarEventRow) {
    setEditingEvent(e);
    setModalDraft({
      account_id: e.account_id,
      title: e.title,
      description: e.description,
      location: e.location,
      start_at: e.start_at,
      end_at: e.end_at,
      all_day: e.all_day,
      event_type: e.event_type,
      color: e.color,
    });
  }

  async function handleDeleteEvent(id: string) {
    const ok = await deleteEvent(id);
    if (!ok) {
      setError("Could not delete the event.");
      return;
    }
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setToast("Event deleted.");
    setModalDraft(null);
    setEditingEvent(null);
  }

  function handleSaved(saved: CalendarEventRow) {
    setEvents((prev) => {
      const without = prev.filter((e) => e.id !== saved.id);
      return [...without, saved].sort(
        (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
      );
    });
    setToast(editingEvent ? "Event updated." : "Event created.");
    setModalDraft(null);
    setEditingEvent(null);
  }

  const preferences = withDefaults(activeAccount?.preferences);
  const timezone = preferences.calendar?.timezone || "Asia/Dubai";

  /* ── Title for the current view ── */
  const viewTitle =
    view === "month"
      ? formatMonthYear(focusDate)
      : view === "week"
        ? formatWeekRange(focusDate)
        : focusDate.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          });

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="w-full">
        {/* ── Header ── */}
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 pt-6 md:pt-8">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <Link
              href="/"
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
                <CalendarIcon size={16} />
              </div>
              <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">
                {t("app.title")}
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {/* Account picker */}
              <div className="flex items-center gap-2">
                <UserCircle2Icon className="h-4 w-4 text-[var(--text-dim)]" />
                <select
                  value={activeAccountId || ""}
                  onChange={(e) => setActiveAccountId(e.target.value || null)}
                  className="h-10 px-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-colors min-w-[200px]"
                  disabled={loadingAccounts}
                >
                  {loadingAccounts && <option>{t("accounts.loading")}</option>}
                  {!loadingAccounts && accounts.length === 0 && (
                    <option value="">{t("accounts.none")}</option>
                  )}
                  {!loadingAccounts &&
                    accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.username} · {a.user_type}
                      </option>
                    ))}
                </select>
              </div>
              <button
                onClick={() => openNewEvent()}
                disabled={!activeAccountId}
                className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg disabled:opacity-50"
              >
                <PlusIcon className="h-4 w-4" /> {t("newEvent")}
              </button>
            </div>
          </div>
          <p className="text-[12px] text-[var(--text-dim)] mb-4 ml-0 md:ml-11">
            {timezone} · {t("app.subtitle")}
          </p>
        </div>

        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 pb-6 md:pb-8">
        {toast && (
          <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300 px-4 py-3 text-[13px] flex items-start gap-2">
            <CheckCircleIcon className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{toast}</span>
          </div>
        )}
        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/[0.08] text-red-300 px-4 py-3 text-[13px] flex items-start gap-2">
            <ExclamationIcon className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Toolbar (nav + view switcher) ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={goToday}
              className="h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-semibold hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all"
            >
              {t("today")}
            </button>
            <div className="flex items-center gap-0.5">
              <button
                onClick={goPrev}
                className="h-10 w-10 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all flex items-center justify-center"
                title={t("prev")}
              >
                <AngleLeftIcon className="h-4 w-4" />
              </button>
              <button
                onClick={goNext}
                className="h-10 w-10 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all flex items-center justify-center"
                title={t("next")}
              >
                <AngleRightIcon className="h-4 w-4" />
              </button>
            </div>
            <h2 className="ml-2 text-[16px] md:text-[18px] font-bold text-[var(--text-primary)]">
              {viewTitle}
            </h2>
          </div>

          {/* View switcher */}
          <div className="inline-flex items-center bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-xl p-1">
            {(Object.keys(viewLabels) as ViewKey[]).map((v) => {
              const active = view === v;
              return (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`h-8 px-4 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-all ${
                    active
                      ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                      : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {t(`view.${v}`, viewLabels[v])}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── View body ── */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
          {!activeAccountId ? (
            <div className="p-10 text-center text-[13px] text-[var(--text-dim)]">
              Pick an account above to see its calendar.
            </div>
          ) : loadingEvents && events.length === 0 ? (
            <div className="p-10 text-center text-[13px] text-[var(--text-dim)]">
              Loading events…
            </div>
          ) : view === "month" ? (
            <MonthView
              focusDate={focusDate}
              events={events}
              preferences={preferences}
              onDayClick={(d) => {
                setFocusDate(d);
                setView("day");
              }}
              onNewEventOnDay={(d) => openNewEvent(d)}
              onEventClick={openEditEvent}
            />
          ) : view === "week" ? (
            <WeekView
              focusDate={focusDate}
              events={events}
              preferences={preferences}
              onNewEventAtSlot={(d) => openNewEvent(d)}
              onEventClick={openEditEvent}
            />
          ) : (
            <DayView
              focusDate={focusDate}
              events={events}
              preferences={preferences}
              onNewEventAtSlot={(d) => openNewEvent(d)}
              onEventClick={openEditEvent}
            />
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-dim)]">
          <LegendDot color="#3B82F6" label="Meeting" />
          <LegendDot color="#10B981" label="Task" />
          <LegendDot color="#F59E0B" label="Reminder" />
          <LegendDot color="#A855F7" label="Event" />
          <LegendDot color="#EC4899" label="Holiday" />
          <LegendDot color="#EF4444" label="Out of Office" />
        </div>
        </div>
      </div>

      {/* ── Event Modal ── */}
      {modalDraft && (
        <EventModal
          draft={modalDraft}
          existingId={editingEvent?.id || null}
          onClose={() => {
            setModalDraft(null);
            setEditingEvent(null);
          }}
          onSaved={handleSaved}
          onDelete={editingEvent ? () => handleDeleteEvent(editingEvent.id) : undefined}
          onError={(m) => setError(m)}
        />
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

/** Round a Date forward to the next :00 or :30. */
function roundToNextHalfHour(d: Date): Date {
  const x = new Date(d);
  const m = x.getMinutes();
  if (m === 0 || m === 30) {
    x.setSeconds(0, 0);
    return x;
  }
  if (m < 30) {
    x.setMinutes(30, 0, 0);
  } else {
    x.setHours(x.getHours() + 1, 0, 0, 0);
  }
  return x;
}

// Silence unused import warning for endOfMonth / endOfDay — kept in the
// barrel for the per-view components.
void endOfMonth;
void endOfDay;
