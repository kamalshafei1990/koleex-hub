"use client";

/* ---------------------------------------------------------------------------
   CalendarApp — top-level shell for the Koleex Hub calendar.

   Responsibilities:
   - Know whose calendar is open: the signed-in account, or — for a Super
     Admin — any account picked from the directory (or `?account=`).
   - Read that account's preferences (timezone, working hours, first day of
     week) — the viewer's own from the bootstrap payload every screen already
     has, another account's from the account route.
   - Show the calendar on THAT timezone's clock: every instant is turned into
     a wall date of the zone (lib/calendar-tz) before the views see it, and
     back when a slot is clicked. A notice says so when the device runs on
     another zone.
   - Manage the focus date + view (month / week / day / agenda) and fetch the
     visible window through the gated route — cached per (account, window),
     shown at once from the cache and refreshed behind it, with the previous
     and next windows fetched while the browser is idle.
   - Open `?event=<id>` from a notification, on its date; keep the view and
     the date in the URL (`?view=month|week|day|agenda&date=YYYY-MM-DD`) so a
     reload or a shared link lands on the same page.
   - Delegate rendering to the views and open EventModal to create, edit or
     (for a guest) view and answer. An occurrence of a series opens on its
     own times with the "This event / All events" choice.
   - Drag to reschedule (week/day blocks, month chips): optimistic, rolled
     back when the save fails. A one-off goes through the same PATCH as the
     editor (reminder re-armed, guests told); an occurrence of a series is
     moved on its own ("this occurrence only").
   - Search (the toolbar box, "/"), N for a new event, and — for a Super
     Admin — the Holidays panel.

   The picker used to be built from the full account directory filtered by a
   browser-side scope context: a regular employee without the Accounts module
   got an empty list, no active account, and a calendar that said "pick an
   account" forever. The server already limits reads to the viewer's own
   calendar; the picker is a Super Admin tool.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import PageHeader from "@/components/ui/PageHeader";
import { AngleLeftIcon, AngleRightIcon, ExclamationIcon, PlusIcon, SettingsIcon2, SpinnerIcon, UserCircle2Icon } from "@/components/icons/ui";
import CalendarIcon from "@/components/icons/CalendarIcon";
import { ConfirmDialog, useToast } from "@/components/kds";
import type { AccountPreferences, AccountRow, AccountWithLinks } from "@/types/supabase";
import type { CalendarFeedEvent, CalendarSearchHit } from "@/lib/calendar-types";
import { fetchAccounts, fetchAccountWithLinks } from "@/lib/accounts-admin";
import { changeOccurrence, fetchEventsInRange, deleteEvent, fetchEventById, updateEvent, type CalendarEventDetail } from "@/lib/calendar-events";
import { fetchHolidays, expandHolidays, type HolidayInstance, type HolidayRow } from "@/lib/calendar-holidays";
import { withDefaults } from "@/lib/access-control";
import { useTranslation } from "@/lib/i18n";
import { calendarT } from "@/lib/translations/calendar";
import { useMeBootstrap } from "@/lib/me-bootstrap";
import { useOpenOnNewParam } from "@/lib/use-open-on-new-param";
import { CALENDAR_EVENT_TYPES, EVENT_TYPE_COLORS } from "@/lib/calendar-enums";
import { allDayKeys, browserTimeZone, fromWall, safeTimeZone, toWall, zonedToUtc } from "@/lib/calendar-tz";
import {
  addDays,
  addDaysToDateKey,
  addMonths,
  daysBetweenKeys,
  formatDMY,
  formatFullDay,
  formatMonthYear,
  formatWeekRange,
  fromDateInput,
  groupEventsByDay,
  isoDateKey,
  roundToNextHalfHour,
  startOfDay,
  startOfMonth,
  startOfWeek,
  type WeekStart,
} from "@/lib/calendar-utils";

import MonthView from "./MonthView";
import WeekView from "./WeekView";
import DayView from "./DayView";
import AgendaView from "./AgendaView";
import type { ChangeScope, EventDraft, EventModalMode, OccurrenceContext } from "./EventModal";
import type { ChipLabels } from "./EventChip";
import CalendarSearch from "./CalendarSearch";

/* The modal is the heaviest piece and only needed on a click. */
const EventModal = dynamic(() => import("./EventModal"), { ssr: false });
const HolidaysPanel = dynamic(() => import("./HolidaysPanel"), { ssr: false });

type ViewKey = "month" | "week" | "day" | "agenda";
const VIEWS: ViewKey[] = ["month", "week", "day", "agenda"];
const AGENDA_DAYS = 14;
const FRESH_MS = 60_000;
const DEFAULT_TZ = "Asia/Dubai";

interface ModalState {
  draft: EventDraft;
  existingId: string | null;
  mode: EventModalMode;
  occurrence?: OccurrenceContext;
}

interface PendingDelete {
  id: string;
  title: string;
  series: boolean;
  hasGuests: boolean;
  task: boolean;
  /** Set when only this occurrence of the series is deleted. */
  occurrence?: string;
}

type OpenableEvent = CalendarEventDetail & { invited?: boolean };

/** `?view=…&date=YYYY-MM-DD` — what a reload or a shared link restores. The
 *  page renders client-side only (AuthGate), so reading the URL while
 *  initialising state cannot disagree with a server render. */
function readUrlState(): { view: ViewKey | null; date: Date | null } {
  if (typeof window === "undefined") return { view: null, date: null };
  const p = new URLSearchParams(window.location.search);
  const v = p.get("view");
  const d = p.get("date");
  const date = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? fromDateInput(d) : null;
  return {
    view: v && (VIEWS as string[]).includes(v) ? (v as ViewKey) : null,
    date: date && !Number.isNaN(date.getTime()) ? date : null,
  };
}

/** One cached window. `tick` is the reload generation it answers. */
interface Entry { at: number; tick: number; ok: boolean; events: CalendarFeedEvent[] }
const CACHE_LIMIT = 16;

/** Where a report deadline leads (Reports Phase 3C). A sent report opens
 *  itself; on the viewer's own calendar a draft started opens too, and a
 *  report still owed opens ready to write. Someone else's deadline leads to
 *  the compliance board — a draft is only ever its author's to open. */
function reportHref(e: CalendarFeedEvent, own: boolean): string {
  const sent = e.source_kind === "sent" || e.source_kind === "late";
  if (e.report_id && (sent || own)) return `/reports/${e.report_id}`;
  if (!own) return "/reports?tab=compliance";
  if (sent) return "/reports?tab=mine";
  if ((e.source_kind === "due" || e.source_kind === "missing") && e.report_key && e.report_date) {
    return `/reports?write=${e.report_key}&date=${e.report_date}${e.report_request ? `&request=${e.report_request}` : ""}`;
  }
  return "/reports";
}

/** The window a view shows around a (wall) focus date, as wall dates. */
function wallRange(view: ViewKey, focus: Date, weekStart: WeekStart): { from: Date; to: Date } {
  if (view === "month") {
    const gridStart = startOfWeek(startOfMonth(focus), weekStart);
    return { from: gridStart, to: addDays(gridStart, 42) };
  }
  if (view === "week") {
    const from = startOfWeek(focus, weekStart);
    return { from, to: addDays(from, 7) };
  }
  const from = startOfDay(focus);
  return { from, to: addDays(from, view === "agenda" ? AGENDA_DAYS : 1) };
}

function shiftFocus(view: ViewKey, d: Date, dir: 1 | -1): Date {
  if (view === "month") return addMonths(d, dir);
  return addDays(d, dir * (view === "week" ? 7 : view === "agenda" ? AGENDA_DAYS : 1));
}

/* Phone detection without a hydration mismatch (the server says "not a
   phone"; the client answers from the media query). */
const PHONE_QUERY = "(max-width: 639px)";
function subscribePhone(cb: () => void) {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const isPhoneNow = () => window.matchMedia(PHONE_QUERY).matches;
const notPhone = () => false;
const noop = () => () => {};

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export default function CalendarApp() {
  const { t, lang } = useTranslation(calendarT);
  const boot = useMeBootstrap();
  const viewer = boot.data?.auth ?? null;
  const viewerId = viewer?.account_id ?? null;
  const isSA = boot.data?.isSuperAdmin === true;
  const { showToast, toastElement } = useToast();

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
  const timezone = safeTimeZone(preferences.calendar?.timezone || DEFAULT_TZ);
  const deviceTz = useSyncExternalStore(noop, browserTimeZone, () => null);

  /* ── Clock: the zone's "now", advanced every minute (now line, today) ── */
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const today = useMemo(() => toWall(nowMs, timezone), [nowMs, timezone]);

  /* ── View state ── Phones open on the agenda. */
  const isPhone = useSyncExternalStore(subscribePhone, isPhoneNow, notPhone);
  const [urlInit] = useState(readUrlState);
  const [viewChoice, setViewChoice] = useState<ViewKey | null>(urlInit.view);
  const view: ViewKey = viewChoice ?? (isPhone ? "agenda" : "month");
  const [focusChoice, setFocusChoice] = useState<Date | null>(urlInit.date); // null = today

  /* The view and the date follow into the URL (replaceState: no history
     entry per click). Other params (?account, ?event, ?new) are kept. */
  const focusKey = focusChoice ? isoDateKey(focusChoice) : null;
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (viewChoice) p.set("view", viewChoice); else p.delete("view");
    if (focusKey) p.set("date", focusKey); else p.delete("date");
    const qs = p.toString();
    const next = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
    if (next !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState(window.history.state, "", next);
    }
  }, [viewChoice, focusKey]);
  /* Today's date as a stable value — `today` itself ticks every minute. */
  const todayKey = isoDateKey(today);
  const todayDate = useMemo(() => fromDateInput(todayKey), [todayKey]);
  const focusDate = focusChoice ?? todayDate;

  /* The visible window: the grid and the fetch must agree on the first day
     of week, or the month view would request the wrong leading days. */
  const range = useMemo(() => wallRange(view, focusDate, weekStart), [view, focusDate, weekStart]);
  const visibleDays = useMemo(() => {
    const out: Date[] = [];
    for (let d = range.from; d < range.to; d = addDays(d, 1)) out.push(d);
    return out;
  }, [range]);
  const keyFor = useCallback(
    (acct: string, r: { from: Date; to: Date }) => `${acct}|${fromWall(r.from, timezone).toISOString()}|${fromWall(r.to, timezone).toISOString()}`,
    [timezone],
  );
  const fetchKey = activeAccountId ? keyFor(activeAccountId, range) : "";

  /* ── Events: cache per window, stale-while-revalidate ── */
  const [store, setStore] = useState<Map<string, Entry>>(() => new Map());
  const storeRef = useRef(store);
  useEffect(() => { storeRef.current = store; }, [store]);
  const [reloadTick, setReloadTick] = useState(0);
  const reload = useCallback(() => setReloadTick((n) => n + 1), []);

  const put = useCallback((key: string, entry: Entry) => {
    setStore((prev) => {
      const next = new Map(prev);
      next.set(key, entry);
      if (next.size > CACHE_LIMIT) {
        const oldest = [...next.entries()].sort((a, b) => a[1].at - b[1].at)[0]?.[0];
        if (oldest && oldest !== key) next.delete(oldest);
      }
      return next;
    });
  }, []);

  /** One window from the route, as a cache entry. A failed load keeps the
   *  events last known for the window and says it failed. */
  const fetchWindow = useCallback(async (acct: string, r: { from: Date; to: Date }, key: string, tick: number): Promise<Entry> => {
    const res = await fetchEventsInRange(acct, fromWall(r.from, timezone), fromWall(r.to, timezone));
    const prev = storeRef.current.get(key);
    return res.ok
      ? { at: Date.now(), tick, ok: true, events: res.events }
      : { at: prev?.at ?? 0, tick, ok: false, events: prev?.events ?? [] };
  }, [timezone]);

  /* The fetch runs per window key; what it needs to warm the neighbours is
     read from here so a re-render cannot re-trigger it. */
  const navRef = useRef({ range, view, focusDate, weekStart });
  useEffect(() => { navRef.current = { range, view, focusDate, weekStart }; }, [range, view, focusDate, weekStart]);

  useEffect(() => {
    if (!activeAccountId) return;
    const cached = storeRef.current.get(fetchKey);
    if (cached && cached.ok && cached.tick === reloadTick && Date.now() - cached.at < FRESH_MS) return;
    let cancelled = false;
    let idle: number | ReturnType<typeof setTimeout> | null = null;
    const nav = navRef.current;
    void fetchWindow(activeAccountId, nav.range, fetchKey, reloadTick).then((fresh) => {
      put(fetchKey, fresh);
      if (!fresh.ok || cancelled) return;
      /* Warm the neighbours once the browser has nothing better to do. */
      const warm = () => {
        for (const dir of [1, -1] as const) {
          const r = wallRange(nav.view, shiftFocus(nav.view, nav.focusDate, dir), nav.weekStart);
          const k = keyFor(activeAccountId, r);
          const c = storeRef.current.get(k);
          if (!c || Date.now() - c.at > FRESH_MS) {
            void fetchWindow(activeAccountId, r, k, reloadTick).then((e) => { if (e.ok) put(k, e); });
          }
        }
      };
      idle = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(warm) : setTimeout(warm, 300);
    });
    return () => {
      cancelled = true;
      if (idle !== null) {
        if (typeof idle === "number" && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
        else clearTimeout(idle as ReturnType<typeof setTimeout>);
      }
    };
  }, [activeAccountId, fetchKey, reloadTick, keyFor, fetchWindow, put]);

  /* What is on screen belongs to THIS window of THIS account — switching
     account never shows the previous person's events, not even for a frame. */
  const entry = activeAccountId ? store.get(fetchKey) : undefined;
  const events = useMemo(() => entry?.events ?? [], [entry]);
  const loadingEvents = !!activeAccountId && (!entry || entry.tick !== reloadTick);
  const loadFailed = !!entry && !entry.ok && !loadingEvents;

  /* Coming back to the tab refetches the window (a guest's calendar changes
     when the organizer moves a meeting) — at most once a minute. */
  const lastFocusReload = useRef(0);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const nowT = Date.now();
      if (nowT - lastFocusReload.current < FRESH_MS) return;
      lastFocusReload.current = nowT;
      reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  /* ── Display: worded in the viewer's language, on the zone's clock ── */
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const shownEvents = useMemo(() => events.map((e): CalendarFeedEvent => {
    let title = e.title;
    if (e.source === "report" && e.report_key) {
      /* Report deadlines arrive worded in English; here they take the
         viewer's language and say what became of them. */
      const k = e.source_kind;
      const state = k === "sent" || k === "late" || k === "missing" ? ` · ${t(`report.${k}`)}` : "";
      const about = e.report_subject ? ` · ${e.report_subject}` : "";
      title = `${t(`report.${e.report_key}`, e.title)}${about}${state}`;
    } else if (e.source === "leave") {
      const half = e.half_day_period ? ` (${t(`leave.half.${e.half_day_period}`, e.half_day_period)})` : "";
      title = `${e.title || t("leave.default")}${half}`;
    } else if (e.source === "planning" && !e.title) {
      const type = e.planning_type ?? "other";
      title = `[${t(`planning.type.${type}`, type)}]`;
    }
    if (e.all_day) {
      const k = e.start_date && e.end_date ? { start: e.start_date, end: e.end_date } : allDayKeys(e.start_at, e.end_at, timezone);
      return { ...e, title, start_date: k.start, end_date: k.end };
    }
    return {
      ...e,
      title,
      start_at: toWall(e.start_at, timezone).toISOString(),
      end_at: toWall(e.end_at, timezone).toISOString(),
    };
  }), [events, t, timezone]);
  const eventsByDay = useMemo(() => groupEventsByDay(shownEvents, visibleDays), [shownEvents, visibleDays]);
  const chipLabels: ChipLabels = useMemo(
    () => ({
      allDay: t("f.allDay"), readOnly: t("readOnly"), declined: t("invite.declinedTag"),
      join: t("join"), pending: t("leave.pending"), milestone: t("milestone"), dragHint: t("drag.hint"),
    }),
    [t],
  );

  /* ── Holidays (report GEN-10): tenant reference data, expanded per window.
     Weekly rest days are ONE hint (legend + a dot on the weekday), not a
     chip repeated on every Friday and Saturday. ── */
  const [holidayRows, setHolidayRows] = useState<HolidayRow[]>([]);
  const [holidayCountry, setHolidayCountry] = useState<string>(""); // "" = all
  useEffect(() => {
    const ctrl = new AbortController();
    fetchHolidays(ctrl.signal)
      .then(setHolidayRows)
      .catch(() => { /* non-fatal — the calendar works without holidays */ });
    return () => ctrl.abort();
  }, []);
  const reloadHolidays = useCallback(() => {
    fetchHolidays().then(setHolidayRows).catch(() => { /* non-fatal */ });
  }, []);
  const [holidaysOpen, setHolidaysOpen] = useState(false);
  /** Holiday names on a day, for the editor's free/busy timeline. */
  const holidaysOn = useCallback((key: string): string[] => {
    const d = fromDateInput(key);
    const rows = holidayCountry ? holidayRows.filter((h) => h.country === holidayCountry || h.scope_type === "customer") : holidayRows;
    return (expandHolidays(rows, d, d)[key] ?? []).map((h) => h.name);
  }, [holidayRows, holidayCountry]);
  const holidayCountries = useMemo(
    () => Array.from(new Set(holidayRows.map((h) => h.country).filter(Boolean) as string[])).sort(),
    [holidayRows],
  );
  const holidayView = useMemo(() => {
    const rows = holidayCountry
      ? holidayRows.filter((h) => h.country === holidayCountry || h.scope_type === "customer")
      : holidayRows;
    const restDays = new Map<number, string>();
    for (const h of rows) {
      if (h.is_active && h.holiday_type === "weekly" && h.weekday != null) restDays.set(h.weekday === 0 ? 7 : h.weekday, h.name);
    }
    const dated: Record<string, HolidayInstance[]> = {};
    for (const [k, list] of Object.entries(expandHolidays(rows.filter((h) => h.holiday_type !== "weekly"), range.from, addDays(range.to, -1)))) {
      dated[k] = list;
    }
    return { restDays, dated };
  }, [holidayRows, holidayCountry, range]);
  const restDayLabel = useMemo(() => {
    if (holidayView.restDays.size === 0) return null;
    return [...holidayView.restDays.keys()].sort((a, b) => a - b).map((iso) => t(`wd.${iso}`)).join(" · ");
  }, [holidayView.restDays, t]);

  /* ── Modal ── */
  const [modal, setModal] = useState<ModalState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openModalFor = useCallback((e: OpenableEvent, occurrence?: OccurrenceContext) => {
    const editable = !e.invited && !!viewerId && (isSA || e.account_id === viewerId);
    setModal({
      existingId: e.id,
      mode: editable ? "edit" : "view",
      occurrence: editable ? occurrence : undefined,
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
        start_date: e.all_day ? e.start_date : undefined,
        end_date: e.all_day ? e.end_date : undefined,
        meeting_url: e.meeting_url ?? null,
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
      setFocusChoice(toWall(ev.start_at, timezone));
      if (isSA && ev.account_id !== viewerId && !ev.invited) setPickedAccountId(ev.account_id);
      openModalFor(ev);
    });
  }, [viewerId, isSA, openModalFor, timezone]);

  /* ── Navigation ── */
  const goPrev = useCallback(() => setFocusChoice(shiftFocus(view, focusDate, -1)), [view, focusDate]);
  const goNext = useCallback(() => setFocusChoice(shiftFocus(view, focusDate, 1)), [view, focusDate]);
  const goToday = useCallback(() => setFocusChoice(null), []);
  const openDay = useCallback((d: Date) => { setFocusChoice(d); setViewChoice("day"); }, []);

  /* Keyboard: T today, ←/→ previous/next, M/W/D/A views — never while
     typing, and never under the modal or the confirm dialog. */
  const modalOpen = !!modal || !!pendingDelete || holidaysOpen;
  const searchRef = useRef<HTMLInputElement>(null);
  const newEventRef = useRef<() => void>(() => {});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modalOpen || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      const rtl = document.documentElement.dir === "rtl";
      const k = e.key.toLowerCase();
      if (e.key === "/") searchRef.current?.focus();
      else if (k === "n") newEventRef.current();
      else if (k === "t") goToday();
      else if (e.key === "ArrowLeft") (rtl ? goNext : goPrev)();
      else if (e.key === "ArrowRight") (rtl ? goPrev : goNext)();
      else if (k === "m") setViewChoice("month");
      else if (k === "w") setViewChoice("week");
      else if (k === "d") setViewChoice("day");
      else if (k === "a") setViewChoice("agenda");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, goToday, goPrev, goNext]);

  /* ── Event open handlers ── */
  function openNewEvent(dayHint?: Date) {
    if (!activeAccountId) return;
    const defaultLen = preferences.calendar?.default_meeting_duration_min ?? 30;
    /* Wall time on the calendar's clock → the instant. */
    const startWall = dayHint ? new Date(dayHint) : roundToNextHalfHour(toWall(Date.now(), timezone));
    // A day hint (midnight) starts at the account's working-hour start.
    if (dayHint && dayHint.getHours() === 0 && dayHint.getMinutes() === 0) {
      const [h, m] = (preferences.calendar?.working_hours?.start || "09:00").split(":").map(Number);
      startWall.setHours(h || 9, m || 0, 0, 0);
    }
    const start = fromWall(startWall, timezone);
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
  useEffect(() => { newEventRef.current = () => openNewEvent(); });

  async function openEvent(shown: CalendarFeedEvent) {
    /* The views hold wall-clock copies; open the real row. */
    const e = byId.get(shown.id) ?? shown;
    /* Mirrors are read-only shadows of another module. A To-do, a project
       task, a planning item or a report deadline deep-links to its app;
       approved leave says where it lives. */
    if (e.source === "todo" && e.todo_id) { window.location.assign(`/todo?task=${e.todo_id}`); return; }
    if (e.source === "project") {
      window.location.assign(
        e.project_id && e.project_task_id ? `/projects?project=${e.project_id}&task=${e.project_task_id}`
          : e.project_id ? `/projects?project=${e.project_id}`
            : "/projects",
      );
      return;
    }
    if (e.source === "planning" && e.planning_item_id) { window.location.assign(`/planning?item=${e.planning_item_id}`); return; }
    if (e.source === "report") { window.location.assign(reportHref(e, viewingOwn)); return; }
    if (e.source === "leave") { showToast(t(e.source_kind === "pending" ? "readOnly.leavePending" : "readOnly.leave"), "info"); return; }
    if (e.source) return;

    /* An occurrence of a series opens on ITS times (and its own title,
       place and link when it was changed on its own), with the series row
       behind it: the editor asks whether a change is to this occurrence or
       to all of them. */
    if (e.series_base_id) {
      const base = await fetchEventById(e.series_base_id);
      if (!base) { showToast(t("err.openSeries"), "error"); return; }
      const occurrence = e.occurrence_start ? { start: e.occurrence_start, base: { start_at: base.start_at, end_at: base.end_at } } : undefined;
      openModalFor({
        ...base,
        invited: e.invited || base.invited,
        ...(occurrence ? {
          start_at: e.start_at, end_at: e.end_at,
          start_date: e.start_date, end_date: e.end_date,
          title: e.title, location: e.location ?? null,
          meeting_url: e.meeting_url ?? base.meeting_url ?? null,
        } : {}),
      }, occurrence);
      return;
    }
    openModalFor(e);
  }

  /** A search hit: jump to its date (on the viewer's own calendar) and open
   *  it — an occurrence of a series as that occurrence. */
  async function openSearchHit(hit: CalendarSearchHit) {
    if (!viewingOwn) setPickedAccountId(null);
    setFocusChoice(hit.all_day && hit.start_date ? fromDateInput(hit.start_date) : toWall(hit.start_at, timezone));
    const base = await fetchEventById(hit.id);
    if (!base) { showToast(t("err.openSeries"), "error"); return; }
    const occurrence = hit.recurring && hit.occurrence_start ? { start: hit.occurrence_start, base: { start_at: base.start_at, end_at: base.end_at } } : undefined;
    openModalFor({
      ...base,
      ...(occurrence ? { start_at: hit.start_at, end_at: hit.end_at, start_date: hit.start_date, end_date: hit.end_date, title: hit.title, location: hit.location } : {}),
    }, occurrence);
  }

  /* ── Drag to reschedule ── */
  const canDrag = useCallback((e: CalendarFeedEvent) =>
    !e.source && !e.invited && !!viewerId && (isSA || e.account_id === viewerId) && (!e.series_base_id || !!e.occurrence_start),
  [viewerId, isSA]);

  /** Show the move at once, save it, roll back when the save fails. */
  async function persistMove(raw: CalendarFeedEvent, next: { start_at: string; end_at: string; start_date?: string; end_date?: string }) {
    const key = fetchKey;
    const prev = storeRef.current.get(key);
    if (prev) put(key, { ...prev, events: prev.events.map((x) => (x.id === raw.id ? { ...x, ...next } : x)) });
    let ok = false;
    let unavailable = false;
    if (raw.series_base_id && raw.occurrence_start) {
      const res = await changeOccurrence(raw.series_base_id, raw.occurrence_start, { action: "override", start_at: next.start_at, end_at: next.end_at });
      ok = res.ok;
      unavailable = !!res.unavailable;
    } else {
      ok = !!(await updateEvent(raw.id, { start_at: next.start_at, end_at: next.end_at }));
    }
    if (!ok) {
      if (prev) put(key, prev);
      showToast(unavailable ? t("err.occurrenceUnavailable") : t("err.move"), "error");
      return;
    }
    showToast(raw.series_base_id ? t("toast.movedOccurrence") : t("toast.moved"));
    invalidate();
  }

  /** Week/day: a block dropped on a new WALL start/end. */
  function handleEventMove(shown: CalendarFeedEvent, startWall: Date, endWall: Date) {
    const raw = byId.get(shown.id);
    if (!raw || !canDrag(raw)) return;
    void persistMove(raw, {
      start_at: fromWall(startWall, timezone).toISOString(),
      end_at: fromWall(endWall, timezone).toISOString(),
    });
  }

  /** Month: a chip dropped on another day — same time, days shifted. */
  function handleEventDropDay(shown: CalendarFeedEvent, fromKey: string, toKey: string) {
    const raw = byId.get(shown.id);
    if (!raw || !canDrag(raw)) return;
    const delta = daysBetweenKeys(fromKey, toKey);
    if (!delta) return;
    if (raw.all_day) {
      const k = raw.start_date && raw.end_date ? { start: raw.start_date, end: raw.end_date } : allDayKeys(raw.start_at, raw.end_at, timezone);
      const s = addDaysToDateKey(k.start, delta);
      const e = addDaysToDateKey(k.end, delta);
      const [sy, sm, sd] = s.split("-").map(Number);
      const [ey, em, ed] = e.split("-").map(Number);
      void persistMove(raw, {
        start_at: new Date(zonedToUtc(sy, sm, sd, 0, 0, 0, 0, timezone)).toISOString(),
        end_at: new Date(zonedToUtc(ey, em, ed, 23, 59, 59, 999, timezone)).toISOString(),
        start_date: s,
        end_date: e,
      });
      return;
    }
    void persistMove(raw, {
      start_at: fromWall(addDays(toWall(raw.start_at, timezone), delta), timezone).toISOString(),
      end_at: fromWall(addDays(toWall(raw.end_at, timezone), delta), timezone).toISOString(),
    });
  }

  /* After a write every cached window may be wrong (a series edit changes
     every month it touches): keep only the one on screen, then refetch it. */
  function invalidate() {
    setStore((prev) => {
      const next = new Map<string, Entry>();
      const cur = prev.get(fetchKey);
      if (cur) next.set(fetchKey, cur);
      return next;
    });
    reload();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    let ok: boolean;
    let unavailable = false;
    if (pendingDelete.occurrence) {
      const res = await changeOccurrence(pendingDelete.id, pendingDelete.occurrence, { action: "skip" });
      ok = res.ok;
      unavailable = !!res.unavailable;
    } else {
      ok = await deleteEvent(pendingDelete.id);
    }
    setDeleting(false);
    setPendingDelete(null);
    if (!ok) { showToast(unavailable ? t("err.occurrenceUnavailable") : t("err.delete"), "error"); return; }
    showToast(t("toast.deleted"));
    setModal(null);
    invalidate();
  }

  function handleSaved() {
    showToast(modal?.existingId ? t("toast.updated") : t("toast.created"));
    setModal(null);
    invalidate();
  }
  function handleResponded() {
    showToast(t("toast.responded"));
    setModal(null);
    invalidate();
  }

  const viewTitle =
    view === "month" ? formatMonthYear(focusDate, lang)
      : view === "week" ? formatWeekRange(focusDate, lang, weekStart)
        : view === "agenda" ? `${formatDMY(range.from)} – ${formatDMY(addDays(range.to, -1))}`
          : formatFullDay(focusDate, lang);

  const loadingAccounts = isSA && accounts === null;
  const tzDiffers = !!deviceTz && deviceTz !== timezone;
  const deleteMessage = pendingDelete
    ? [
        t(pendingDelete.occurrence ? "confirm.delete.occurrence" : pendingDelete.series ? "confirm.delete.series" : "confirm.delete.one").replace("{title}", pendingDelete.title),
        pendingDelete.hasGuests ? t("confirm.delete.guests") : null,
        pendingDelete.task && !pendingDelete.occurrence ? t("confirm.delete.todo") : null,
      ].filter(Boolean).join(" ")
    : "";

  const gridProps = {
    today,
    eventsByDay,
    preferences,
    holidaysByDay: holidayView.dated,
    restDays: holidayView.restDays,
    chipLabels,
    onEventClick: (e: CalendarFeedEvent) => { void openEvent(e); },
    canDrag,
  };

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
                  <UserCircle2Icon className="h-4 w-4 text-[var(--text-dim)]" aria-hidden />
                  <select
                    value={activeAccountId || ""}
                    onChange={(e) => setPickedAccountId(e.target.value || null)}
                    aria-label={t("accounts.pick", "Calendar of")}
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
          {/* ── Toolbar (nav + view switcher) ── */}
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={goToday}
                title="T"
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
              <h2 className="ms-2 text-[16px] md:text-[18px] font-bold text-[var(--text-primary)] truncate" aria-live="polite">{viewTitle}</h2>
              {loadingEvents && (
                <SpinnerIcon size={16} className="text-[var(--text-dim)] shrink-0" aria-label={t("events.loading")} />
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto sm:ms-auto order-last sm:order-none">
              <CalendarSearch timezone={timezone} inputRef={searchRef} onPick={(h) => { void openSearchHit(h); }} />
            </div>

            {/* View switcher */}
            <div
              role="group"
              aria-label={t("views.label")}
              title={t("shortcuts")}
              className="inline-flex items-center bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-xl p-1"
            >
              {VIEWS.map((v) => {
                const active = view === v;
                return (
                  <button
                    key={v}
                    onClick={() => setViewChoice(v)}
                    aria-pressed={active}
                    className={`h-8 px-3 sm:px-4 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-all ${
                      active
                        ? "kx-seg-on bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                        : "kx-seg-off text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {t(`view.${v}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {tzDiffers && (
            <p className="mb-3 text-[11px] text-[var(--text-dim)]">
              {t("tz.notice").replace("{tz}", timezone).replace("{device}", deviceTz ?? "")}
            </p>
          )}

          {/* Holiday country filter (report GEN-10) — only when holidays exist —
              and, for a Super Admin, the Holidays panel. */}
          {(holidayCountries.length > 0 || isSA) && (
            <div className="mb-3 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                {t("holidays")}
              </span>
              <select
                value={holidayCountry}
                onChange={(e) => setHolidayCountry(e.target.value)}
                className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                title={t("holidays.filter")}
                aria-label={t("holidays.filter")}
              >
                <option value="">{t("holidays.all")}</option>
                {holidayCountries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {isSA && (
                <button
                  type="button"
                  onClick={() => setHolidaysOpen(true)}
                  className="h-8 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] inline-flex items-center gap-1.5 transition-colors"
                >
                  <SettingsIcon2 className="h-3.5 w-3.5" aria-hidden /> {t("holidays.manage")}
                </button>
              )}
            </div>
          )}

          {loadFailed && (
            <div role="alert" className="mb-3 rounded-xl border border-[var(--state-error)]/30 bg-[var(--state-error)]/[0.08] text-[var(--state-error)] px-4 py-2.5 text-[13px] flex items-center gap-2">
              <ExclamationIcon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1">{t("err.load")}</span>
              <button
                type="button"
                onClick={reload}
                className="h-8 px-3 rounded-lg border border-[var(--state-error)]/30 text-[12px] font-semibold hover:bg-[var(--state-error)]/10 transition-colors"
              >
                {t("retry")}
              </button>
            </div>
          )}

          {/* ── View body ──
              The month grid is ONE glass surface, so the frost costs one pass.
              The day cells inside stay tints on purpose — backdrop-filter is
              priced per element. Same call as Planning's schedule grid. */}
          <div className="kx-glass bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden" aria-busy={loadingEvents}>
            {!activeAccountId ? (
              <div className="p-10 text-center text-[13px] text-[var(--text-dim)]">{t("empty.pickAccount")}</div>
            ) : view === "month" ? (
              <MonthView
                {...gridProps}
                focusDate={focusDate}
                weekStart={weekStart}
                onDayClick={openDay}
                onNewEventOnDay={(d) => openNewEvent(d)}
                onEventDropDay={handleEventDropDay}
              />
            ) : view === "week" ? (
              <WeekView
                {...gridProps}
                focusDate={focusDate}
                now={today}
                weekStart={weekStart}
                onDayClick={openDay}
                onNewEventAtSlot={(d) => openNewEvent(d)}
                onEventMove={handleEventMove}
              />
            ) : view === "day" ? (
              <DayView
                {...gridProps}
                focusDate={focusDate}
                now={today}
                onNewEventAtSlot={(d) => openNewEvent(d)}
                onEventMove={handleEventMove}
              />
            ) : (
              <AgendaView
                {...gridProps}
                days={visibleDays}
                onDayClick={openDay}
              />
            )}
          </div>

          {/* Legend — the same colors the chips and the modal's default swatch
              use, plus the weekly rest days as one hint. */}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-dim)]">
            {CALENDAR_EVENT_TYPES.map((type) => (
              <span key={type} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: EVENT_TYPE_COLORS[type] }} />
                {t(`type.${type}`)}
              </span>
            ))}
            {restDayLabel && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full" style={{ backgroundColor: EVENT_TYPE_COLORS.holiday }} />
                {t("weekend")}: {restDayLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {modal && (
        <EventModal
          draft={modal.draft}
          existingId={modal.existingId}
          mode={modal.mode}
          viewerId={viewerId}
          timezone={timezone}
          occurrence={modal.occurrence}
          holidaysOn={holidaysOn}
          now={today}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
          onDelete={modal.mode === "edit" && modal.existingId
            ? ({ hasGuests, scope }: { hasGuests: boolean; scope: ChangeScope }) => setPendingDelete({
                id: modal.existingId as string,
                title: modal.draft.title,
                series: !!modal.draft.recurrence,
                hasGuests,
                task: modal.draft.event_type === "task",
                occurrence: scope === "this" && modal.occurrence ? modal.occurrence.start : undefined,
              })
            : undefined}
          onResponded={handleResponded}
          onError={(m) => showToast(m, "error")}
        />
      )}

      {isSA && (
        <HolidaysPanel
          open={holidaysOpen}
          onClose={() => setHolidaysOpen(false)}
          rows={holidayRows}
          onChanged={reloadHolidays}
          onError={(m) => showToast(m, "error")}
          onDone={(m) => showToast(m)}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title={pendingDelete?.occurrence ? t("confirm.deleteOccurrence") : pendingDelete?.series ? t("confirm.deleteSeries") : t("confirm.delete")}
        message={deleteMessage}
        confirmLabel={t("modal.delete")}
        cancelLabel={t("modal.cancel")}
        busy={deleting}
        onConfirm={() => { void confirmDelete(); }}
        onCancel={() => { if (!deleting) setPendingDelete(null); }}
      />
      {toastElement}
    </div>
  );
}
