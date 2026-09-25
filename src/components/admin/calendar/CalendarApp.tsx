"use client";

/* ---------------------------------------------------------------------------
   CalendarApp — top-level shell for the Koleex Hub calendar.

   Responsibilities:
   - Know whose calendar is open: the signed-in account, or — for a Super
     Admin — any account picked from the directory (or `?account=`).
   - Read that account's preferences (timezone, working hours, first day of
     week) — the viewer's own from the bootstrap payload every screen already
     has, another account's from the account route.
   - Manage the focus date + view (month / week / day) and fetch the visible
     window through the gated route.
   - Open `?event=<id>` from a notification, on its date.
   - Delegate rendering to MonthView / WeekView / DayView and open EventModal
     to create, edit or (for a guest) view and answer.

   The picker used to be built from the full account directory filtered by a
   browser-side scope context: a regular employee without the Accounts module
   got an empty list, no active account, and a calendar that said "pick an
   account" forever. The server already limits reads to the viewer's own
   calendar; the picker is a Super Admin tool.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import AngleLeftIcon from "@/components/icons/ui/AngleLeftIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import UserCircle2Icon from "@/components/icons/ui/UserCircle2Icon";
import CalendarIcon from "@/components/icons/CalendarIcon";
import type {
  AccountPreferences,
  AccountRow,
  AccountWithLinks,
  CalendarEventRow,
  CalendarViewEvent,
} from "@/types/supabase";
import { fetchAccounts, fetchAccountWithLinks } from "@/lib/accounts-admin";
import { fetchEventsInRange, deleteEvent, fetchEventById } from "@/lib/calendar-events";
import { fetchHolidays, expandHolidays, type HolidayRow } from "@/lib/calendar-holidays";
import { withDefaults } from "@/lib/access-control";
import { useTranslation } from "@/lib/i18n";
import { calendarT } from "@/lib/translations/calendar";
import { useMeBootstrap } from "@/lib/me-bootstrap";
import { useOpenOnNewParam } from "@/lib/use-open-on-new-param";
import { CALENDAR_EVENT_TYPES, EVENT_TYPE_COLORS } from "@/lib/calendar-enums";
import {
  addDays,
  addMonths,
  formatFullDay,
  formatMonthYear,
  formatWeekRange,
  roundToNextHalfHour,
  startOfDay,
  startOfMonth,
  startOfWeek,
  type WeekStart,
} from "@/lib/calendar-utils";

import MonthView from "./MonthView";
import WeekView from "./WeekView";
import DayView from "./DayView";
import EventModal, { type EventDraft, type EventModalMode } from "./EventModal";

type ViewKey = "month" | "week" | "day";
const VIEWS: ViewKey[] = ["month", "week", "day"];

interface ModalState {
  draft: EventDraft;
  existingId: string | null;
  mode: EventModalMode;
}

type OpenableEvent = CalendarEventRow & { invited?: boolean };

/** Where a report deadline leads (Reports Phase 3C). A sent report opens
 *  itself; on the viewer's own calendar a draft started opens too, and a
 *  report still owed opens ready to write. Someone else's deadline leads to
 *  the compliance board — a draft is only ever its author's to open. */
function reportHref(e: CalendarViewEvent, own: boolean): string {
  const sent = e.source_kind === "sent" || e.source_kind === "late";
  if (e.report_id && (sent || own)) return `/reports/${e.report_id}`;
  if (!own) return "/reports?tab=compliance";
  if (sent) return "/reports?tab=mine";
  if ((e.source_kind === "due" || e.source_kind === "missing") && e.report_key && e.report_date) {
    return `/reports?write=${e.report_key}&date=${e.report_date}${e.report_request ? `&request=${e.report_request}` : ""}`;
  }
  return "/reports";
}

export default function CalendarApp() {
  const { t, lang } = useTranslation(calendarT);
  const boot = useMeBootstrap();
  const viewer = boot.data?.auth ?? null;
  const viewerId = viewer?.account_id ?? null;
  const isSA = boot.data?.isSuperAdmin === true;

  /* ── Whose calendar ── */
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null); // SA directory; null = not loaded
  const [pickedAccountId, setPickedAccountId] = useState<string | null>(null);
  const activeAccountId = pickedAccountId ?? viewerId;
  const viewingOwn = !!viewerId && activeAccountId === viewerId;

  useEffect(() => {
    if (!isSA) return;
    let alive = true;
    const hint = new URLSearchParams(window.location.search).get("account");
    fetchAccounts().then((list) => {
      if (!alive) return;
      setAccounts(list);
      if (hint && list.some((a) => a.id === hint)) setPickedAccountId(hint);
    });
    return () => { alive = false; };
  }, [isSA]);

  /* ── Preferences of the open calendar ── */
  const [otherAccount, setOtherAccount] = useState<AccountWithLinks | null>(null);
  useEffect(() => {
    if (!activeAccountId || viewingOwn) return;
    let alive = true;
    fetchAccountWithLinks(activeAccountId).then((full) => { if (alive) setOtherAccount(full); });
    return () => { alive = false; };
  }, [activeAccountId, viewingOwn]);

  const preferences: AccountPreferences = useMemo(() => {
    if (viewingOwn) {
      const header = boot.data?.header as { preferences?: AccountPreferences } | null | undefined;
      return withDefaults(header?.preferences);
    }
    return withDefaults(otherAccount && otherAccount.id === activeAccountId ? otherAccount.preferences : null);
  }, [viewingOwn, boot.data?.header, otherAccount, activeAccountId]);
  const weekStart: WeekStart = (preferences.display?.week_start as WeekStart) ?? 1;
  const timezone = preferences.calendar?.timezone || "Asia/Dubai";

  /* ── View state ── */
  const [view, setView] = useState<ViewKey>("month");
  const [focusDate, setFocusDate] = useState<Date>(() => new Date());

  /* The visible window: the grid and the fetch must agree on the first day
     of week, or the month view would request the wrong leading days. */
  const visibleRange = useMemo(() => {
    if (view === "month") {
      const gridStart = startOfWeek(startOfMonth(focusDate), weekStart);
      return { from: gridStart, to: addDays(gridStart, 42) };
    }
    if (view === "week") {
      const from = startOfWeek(focusDate, weekStart);
      return { from, to: addDays(from, 7) };
    }
    const from = startOfDay(focusDate);
    return { from, to: addDays(from, 1) };
  }, [view, focusDate, weekStart]);

  /* ── Events ── */
  const [events, setEvents] = useState<CalendarViewEvent[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const fetchKey = `${activeAccountId ?? ""}|${visibleRange.from.getTime()}|${visibleRange.to.getTime()}|${reloadTick}`;
  const loadingEvents = !!activeAccountId && loadedKey !== fetchKey;
  const reload = useCallback(() => setReloadTick((n) => n + 1), []);

  useEffect(() => {
    if (!activeAccountId) return;
    let alive = true;
    fetchEventsInRange(activeAccountId, visibleRange.from, visibleRange.to).then((rows) => {
      if (!alive) return;
      setEvents(rows);
      setLoadedKey(fetchKey);
    });
    return () => { alive = false; };
  }, [activeAccountId, visibleRange, fetchKey]);

  /* Report deadlines arrive worded in English; here they take the viewer's
     language and say what became of them (sent, late, missing). */
  const shownEvents = useMemo(() => events.map((e) => {
    if (e.source !== "report" || !e.report_key) return e;
    const k = e.source_kind;
    const state = k === "sent" || k === "late" || k === "missing" ? ` · ${t(`report.${k}`)}` : "";
    const about = e.report_subject ? ` · ${e.report_subject}` : "";
    return { ...e, title: `${t(`report.${e.report_key}`, e.title)}${about}${state}` };
  }), [events, t]);

  /* A guest's calendar changes when the organizer moves or cancels a
     meeting; coming back to the tab refetches the window. */
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") reload(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  /* ── Holidays (report GEN-10): tenant reference data, expanded per window ── */
  const [holidayRows, setHolidayRows] = useState<HolidayRow[]>([]);
  const [holidayCountry, setHolidayCountry] = useState<string>(""); // "" = all
  useEffect(() => {
    const ctrl = new AbortController();
    fetchHolidays(ctrl.signal)
      .then(setHolidayRows)
      .catch(() => { /* non-fatal — the calendar works without holidays */ });
    return () => ctrl.abort();
  }, []);
  const holidayCountries = useMemo(
    () => Array.from(new Set(holidayRows.map((h) => h.country).filter(Boolean) as string[])).sort(),
    [holidayRows],
  );
  const holidaysByDay = useMemo(() => {
    const rows = holidayCountry
      ? holidayRows.filter((h) => h.country === holidayCountry || h.scope_type === "customer")
      : holidayRows;
    return expandHolidays(rows, visibleRange.from, visibleRange.to);
  }, [holidayRows, holidayCountry, visibleRange]);

  /* ── Feedback ── */
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  /* ── Modal ── */
  const [modal, setModal] = useState<ModalState | null>(null);

  const openModalFor = useCallback((e: OpenableEvent) => {
    const editable = !e.invited && !!viewerId && (isSA || e.account_id === viewerId);
    setModal({
      existingId: e.id,
      mode: editable ? "edit" : "view",
      draft: {
        account_id: e.account_id,
        title: e.title,
        description: e.description,
        location: e.location,
        start_at: e.start_at,
        end_at: e.end_at,
        all_day: e.all_day,
        event_type: e.event_type,
        color: e.color,
        is_private: e.is_private ?? false,
        reminder_minutes: e.reminder_minutes ?? null,
        recurrence: e.recurrence ?? null,
        recurrence_until: e.recurrence_until ?? null,
      },
    });
  }, [viewerId, isSA]);

  /* Deep link: notifications point at /calendar?event=<id>. Open it on its
     date once the viewer is known, then strip the param so a refresh does
     not reopen it. */
  const deepLinkHandledRef = useRef(false);
  useEffect(() => {
    if (!viewerId || deepLinkHandledRef.current) return;
    deepLinkHandledRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get("event");
    if (!eventId) return;
    params.delete("event");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    fetchEventById(eventId).then((ev) => {
      if (!ev) return;
      setFocusDate(new Date(ev.start_at));
      if (isSA && ev.account_id !== viewerId && !ev.invited) setPickedAccountId(ev.account_id);
      openModalFor(ev);
    });
  }, [viewerId, isSA, openModalFor]);

  /* ── Navigation ── */
  function goPrev() {
    setFocusDate((d) => (view === "month" ? addMonths(d, -1) : addDays(d, view === "week" ? -7 : -1)));
  }
  function goNext() {
    setFocusDate((d) => (view === "month" ? addMonths(d, 1) : addDays(d, view === "week" ? 7 : 1)));
  }
  function goToday() {
    setFocusDate(new Date());
  }

  /* ── Event open handlers ── */
  function openNewEvent(dayHint?: Date) {
    if (!activeAccountId) return;
    const defaultLen = preferences.calendar?.default_meeting_duration_min ?? 30;
    const start = dayHint ? new Date(dayHint) : roundToNextHalfHour(new Date());
    // A day hint (midnight) starts at the account's working-hour start.
    if (dayHint && dayHint.getHours() === 0 && dayHint.getMinutes() === 0) {
      const [h, m] = (preferences.calendar?.working_hours?.start || "09:00").split(":").map(Number);
      start.setHours(h || 9, m || 0, 0, 0);
    }
    const end = new Date(start.getTime() + defaultLen * 60 * 1000);
    setModal({
      existingId: null,
      mode: "create",
      draft: {
        account_id: activeAccountId,
        title: "",
        description: null,
        location: null,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        all_day: false,
        event_type: "meeting",
        color: null,
        is_private: false,
        reminder_minutes: null,
        recurrence: null,
        recurrence_until: null,
      },
    });
  }
  /* ?new=1 (Smart Create) opens a new event once the viewer is known. */
  useOpenOnNewParam(openNewEvent, !!activeAccountId);

  async function openEvent(e: CalendarViewEvent) {
    /* Mirrors are read-only shadows of another module. A To-do, a project
       task or a report deadline deep-links to its app; the rest are inert. */
    if (e.source === "todo" && e.todo_id) { window.location.assign(`/todo?task=${e.todo_id}`); return; }
    if (e.source === "project") { window.location.assign("/projects"); return; }
    if (e.source === "report") { window.location.assign(reportHref(e, viewingOwn)); return; }
    if (e.source) return;

    /* An occurrence of a series edits the WHOLE series: open the base row
       (its true start/end + recurrence rule). */
    if (e.series_base_id) {
      const base = await fetchEventById(e.series_base_id);
      if (!base) { setError(t("err.openSeries")); return; }
      openModalFor({ ...base, invited: e.invited || base.invited });
      return;
    }
    openModalFor(e);
  }

  async function handleDeleteEvent(id: string) {
    const ok = await deleteEvent(id);
    if (!ok) { setError(t("err.delete")); return; }
    setToast(t("toast.deleted"));
    setModal(null);
    reload();
  }

  /* After a write the window is refetched rather than patched in place: a
     series edit changes every occurrence, a delete removes rows whose ids
     (`<base>~<i>`) never matched the base id. */
  function handleSaved() {
    setToast(modal?.existingId ? t("toast.updated") : t("toast.created"));
    setModal(null);
    reload();
  }
  function handleResponded() {
    setToast(t("toast.responded"));
    setModal(null);
    reload();
  }

  const viewTitle =
    view === "month" ? formatMonthYear(focusDate, lang)
      : view === "week" ? formatWeekRange(focusDate, lang, weekStart)
        : formatFullDay(focusDate, lang);

  const loadingAccounts = isSA && accounts === null;

  return (
    <div className="min-h-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="w-full">
        {/* ── Header ──
            pb-4 is the gap between the band and the date row below; the next
            container has bottom padding but no top padding. */}
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 pt-6 md:pt-8 pb-4">
          <PageHeader
            title={t("app.title")}
            subtitle={`${timezone} · ${t("app.subtitle")}`}
            icon={<CalendarIcon size={16} />}
            showTabs={false}
            controls={
              isSA ? (
                <div className="flex items-center gap-2">
                  <UserCircle2Icon className="h-4 w-4 text-[var(--text-dim)]" />
                  <select
                    value={activeAccountId || ""}
                    onChange={(e) => setPickedAccountId(e.target.value || null)}
                    className="h-10 px-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-colors min-w-[200px]"
                    disabled={loadingAccounts}
                  >
                    {loadingAccounts && <option>{t("accounts.loading")}</option>}
                    {!loadingAccounts && (accounts?.length ?? 0) === 0 && (
                      <option value="">{t("accounts.none")}</option>
                    )}
                    {!loadingAccounts &&
                      (accounts ?? []).map((a) => (
                        <option key={a.id} value={a.id}>{a.username} · {a.user_type}</option>
                      ))}
                  </select>
                </div>
              ) : undefined
            }
            action={
              <button
                onClick={() => openNewEvent()}
                disabled={!activeAccountId}
                className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 transition-all shadow-lg disabled:opacity-50"
              >
                <PlusIcon className="h-4 w-4" /> {t("newEvent")}
              </button>
            }
          />
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
                  aria-label={t("prev")}
                >
                  <AngleLeftIcon className="h-4 w-4 rtl:rotate-180" />
                </button>
                <button
                  onClick={goNext}
                  className="h-10 w-10 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all flex items-center justify-center"
                  title={t("next")}
                  aria-label={t("next")}
                >
                  <AngleRightIcon className="h-4 w-4 rtl:rotate-180" />
                </button>
              </div>
              <h2 className="ms-2 text-[16px] md:text-[18px] font-bold text-[var(--text-primary)]">{viewTitle}</h2>
            </div>

            {/* View switcher */}
            <div className="inline-flex items-center bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-xl p-1">
              {VIEWS.map((v) => {
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
                    {t(`view.${v}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Holiday country filter (report GEN-10) — only when holidays exist
              and we're in the month grid (the view that overlays them). */}
          {view === "month" && holidayCountries.length > 0 && (
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                {t("holidays")}
              </span>
              <select
                value={holidayCountry}
                onChange={(e) => setHolidayCountry(e.target.value)}
                className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                title={t("holidays.filter")}
              >
                <option value="">{t("holidays.all")}</option>
                {holidayCountries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          {/* ── View body ──
              The month grid is ONE glass surface, so the frost costs one pass.
              The day cells inside stay tints on purpose — backdrop-filter is
              priced per element. Same call as Planning's schedule grid. */}
          <div className="kx-glass bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
            {!activeAccountId ? (
              <div className="p-10 text-center text-[13px] text-[var(--text-dim)]">{t("empty.pickAccount")}</div>
            ) : loadingEvents && events.length === 0 ? (
              <div className="p-10 text-center text-[13px] text-[var(--text-dim)]">{t("events.loading")}</div>
            ) : view === "month" ? (
              <MonthView
                focusDate={focusDate}
                events={shownEvents}
                preferences={preferences}
                weekStart={weekStart}
                holidaysByDay={holidaysByDay}
                onDayClick={(d) => { setFocusDate(d); setView("day"); }}
                onNewEventOnDay={(d) => openNewEvent(d)}
                onEventClick={(e) => { void openEvent(e); }}
              />
            ) : view === "week" ? (
              <WeekView
                focusDate={focusDate}
                events={shownEvents}
                preferences={preferences}
                weekStart={weekStart}
                onNewEventAtSlot={(d) => openNewEvent(d)}
                onEventClick={(e) => { void openEvent(e); }}
              />
            ) : (
              <DayView
                focusDate={focusDate}
                events={shownEvents}
                preferences={preferences}
                onNewEventAtSlot={(d) => openNewEvent(d)}
                onEventClick={(e) => { void openEvent(e); }}
              />
            )}
          </div>

          {/* Legend — the same colors the chips and the modal's default swatch use */}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-dim)]">
            {CALENDAR_EVENT_TYPES.map((type) => (
              <span key={type} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: EVENT_TYPE_COLORS[type] }} />
                {t(`type.${type}`)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {modal && (
        <EventModal
          draft={modal.draft}
          existingId={modal.existingId}
          mode={modal.mode}
          viewerId={viewerId}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
          onDelete={modal.mode === "edit" && modal.existingId ? () => handleDeleteEvent(modal.existingId as string) : undefined}
          onResponded={handleResponded}
          onError={(m) => setError(m)}
        />
      )}
    </div>
  );
}
