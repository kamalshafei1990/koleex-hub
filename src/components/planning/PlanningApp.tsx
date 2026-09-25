"use client";

/* ---------------------------------------------------------------------------
   PlanningApp — universal planning tool (shifts, meetings, production,
   deliveries, maintenance, project tasks, room bookings). Built to mirror
   Odoo Planning semantics in Hub's visual language.

   Six tabs (kept in ?tab=, so a tab is linkable):
     • Schedule       — week grid by resource or role, or an hour Timeline
                        (?view=timeline, ?range=week) — Day/Week, drag to
                        move / resize (dynamic chunk)
     • Open Shifts    — published, unassigned items — anyone can Take
     • My Planning    — items on the caller's own resource (last 7 days on)
     • Utilization    — scheduled vs capacity per employee (dynamic chunk)
     • Workload       — heat grid of planned hours per person per day
                        (GET /api/planning/workload; dynamic chunk)
     • Configuration  — roles, non-employee resources, shift templates
   ?item=<id> opens that item's modal (inbox notifications and the entity
   strips link here).

   WEEK ACTIONS. "Copy last week" and "Publish week" preview a count first
   (server-side, only rows the caller may edit, only resources on screen)
   and act on confirm. "Add from template" on a cell drops a template's
   times onto that day.

   CONFLICTS. Every write can answer 409 schedule_conflict (double booking,
   approved leave or business trip, Calendar out-of-office time —
   lib/server/planning-conflicts). The board rolls back
   and shows ConflictDialog; a super admin may "Save anyway", which retries
   the same write with force.

   TIME ZONE. One planner's clock (lib/planning-tz): the Calendar's
   timezone preference when set, else the browser's. The week boundaries,
   the grid's days, the timeline, the item modal, templates, recurrence,
   copy-week / publish-week and the server's leave-day check all use it, so
   the grid and the timeline always agree. `weekStart` and the grid's days
   are WALL dates in that zone; they become instants only at the server
   edge (wallInstant).

   DATA. Resources and roles load once per visit through useWarmData (they
   paint from the last answer instantly); only items + the absence overlay
   (approved leave AND Calendar out-of-office, one request) are keyed by
   week, so week navigation refetches just those two — and the adjacent
   weeks are prefetched into the warm cache. Mutations are optimistic: the
   board updates at once from the local overlay and rolls back with a toast
   if the server refuses. Nothing is swallowed: a failed load shows an error
   with Retry, never an empty week.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslation } from "@/lib/i18n";
import { usePermissions } from "@/lib/permissions";
import { getCurrentAccountIdSync } from "@/lib/identity";
import { planningT } from "@/lib/translations/planning";
import { useTabMotion } from "@/components/ui/useTabMotion";
import { useToast } from "@/components/kds/useToast";
import { DEFAULT_MAX_AGE_MS, dropWarm, useWarmData, warmAge, writeWarm } from "@/lib/warm-cache";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import AngleLeftIcon from "@/components/icons/ui/AngleLeftIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import PaperPlaneIcon from "@/components/icons/ui/PaperPlaneIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import TableIcon from "@/components/icons/ui/TableIcon";
import TimelineIcon from "@/components/icons/ui/TimelineIcon";
import ConfirmDialog from "@/components/kds/ConfirmDialog";
import ConflictDialog from "@/components/planning/ConflictDialog";
import type { TimelinePatch, TimelineRow } from "@/components/planning/TimelineView";
import { zonedToUtc } from "@/lib/calendar-tz";
import { plannerNow, plannerWall, usePlannerTimeZone, wallInstant } from "@/lib/planning-tz";
import { AWAY_HATCH, awayDaySlices, awaySliceRange, overlapsAway, type AwaySlice } from "@/lib/planning-away";
import PlanningIcon from "@/components/icons/PlanningIcon";
import PageHeader from "@/components/ui/PageHeader";
import AppHomeMenu from "@/components/ui/AppHomeMenu";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import { useSearchPlaceholder } from "@/lib/searchPlaceholders";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import type { ItemModalPreset, ItemSaveOptions } from "@/components/planning/ItemModal";
import { planningErrorKey } from "@/components/planning/planningErrors";
import {
  addDays,
  conflictInfo,
  copyLastWeek,
  createItemsOrThrow,
  dateKey,
  deleteItem,
  fetchTemplates,
  publishWeek,
  updateItems,
  type PlanningConflictInfo,
  type PlanningTemplate,
  type SeriesScope,
  type WeekActionBody,
  durationHours,
  fetchItem,
  fetchItems,
  fetchWeekAbsence,
  fetchResources,
  fetchRoles,
  formatRange,
  formatTime,
  formatWeekRange,
  itemDayKeys,
  ITEM_TYPE_COLOR,
  ITEM_TYPE_LABELS,
  PlanningApiError,
  startOfWeek,
  takeOpenShift,
  updateItem,
  type AwaySpan,
  type LeaveSpan,
  type WeekAbsence,
  type PlanningItem,
  type PlanningResource,
  type PlanningResourceType,
  type PlanningRole,
} from "@/lib/planning";

const ItemModal = dynamic(() => import("@/components/planning/ItemModal"), { ssr: false });
const ConfigurationView = dynamic(() => import("@/components/planning/ConfigurationView"), {
  ssr: false,
  loading: () => <CenteredSpinner />,
});
const UtilizationView = dynamic(() => import("@/components/planning/UtilizationView"), {
  ssr: false,
  loading: () => <CenteredSpinner />,
});
const WorkloadView = dynamic(() => import("@/components/planning/WorkloadView"), {
  ssr: false,
  loading: () => <CenteredSpinner />,
});
const TimelineView = dynamic(() => import("@/components/planning/TimelineView"), {
  ssr: false,
  loading: () => <CenteredSpinner />,
});

type TabId = "schedule" | "open" | "mine" | "utilization" | "workload" | "config";

/* Strip order — feeds the directional tab motion (kx-tab-fwd / kx-tab-back). */
const TAB_ORDER: TabId[] = ["schedule", "open", "mine", "utilization", "workload", "config"];

type SchedMode = "grid" | "timeline";
type TlRange = "day" | "week";

const fillVars = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

/* Items/leave revalidate after 15s (other planners edit the same board);
   resources/roles use the warm-cache default. */
const ITEMS_STALE_MS = 15_000;

function readUrlParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

/** Update ?tab / ?item without a navigation (Next syncs useSearchParams). */
function writeUrlParams(patch: Record<string, string | null>) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === "") url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    window.history.replaceState(window.history.state, "", next);
  }
}

/* Items are keyed by zone too: the same wall week is a different window of
   instants in another zone. The absence overlay (leave dates + Calendar
   out-of-office instants, one request) is zone-free: the server widens its
   window a day each side and the board cuts it on its own clock. */
const itemsKeyFor = (weekStart: Date, tz: string) => `planning:items:${tz}:${dateKey(weekStart)}`;
const leavesKeyFor = (weekStart: Date) => `planning:absence:${dateKey(weekStart)}`;
const weekItemsLoader = (weekStart: Date, tz: string) => () =>
  fetchItems({ start: wallInstant(weekStart, tz).toISOString(), end: wallInstant(addDays(weekStart, 7), tz).toISOString() });
const weekLeavesLoader = (weekStart: Date) => () =>
  fetchWeekAbsence(dateKey(weekStart), dateKey(addDays(weekStart, 6)));

export default function PlanningApp() {
  const { t } = useTranslation(planningT);
  const { isSuperAdmin: isSA } = usePermissions();
  const meId = getCurrentAccountIdSync();
  const { showToast, toastElement } = useToast();
  /* The planner's clock: the Calendar timezone preference, else the browser's. */
  const tz = usePlannerTimeZone();
  /* SA audience lens — "own" | "all" | resource account_id. */
  const [saView, setSaView] = useState<string>("own");
  const searchPlaceholder = useSearchPlaceholder("planning");
  const [tab, setTabState] = useState<TabId>(() => {
    const v = readUrlParam("tab");
    return (TAB_ORDER as string[]).includes(v ?? "") ? (v as TabId) : "schedule";
  });
  const tabMotion = useTabMotion(TAB_ORDER.indexOf(tab));
  const setTab = useCallback((next: TabId) => {
    setTabState(next);
    writeUrlParams({ tab: next === "schedule" ? null : next });
  }, []);
  const [search, setSearch] = useState("");
  /* Schedule view (?view=timeline, ?range=week) — lives here so it survives tab switches. */
  const [schedMode, setSchedModeState] = useState<SchedMode>(() => (readUrlParam("view") === "timeline" ? "timeline" : "grid"));
  const [tlRange, setTlRangeState] = useState<TlRange>(() => (readUrlParam("range") === "week" ? "week" : "day"));
  const setSchedMode = useCallback((m: SchedMode) => {
    setSchedModeState(m);
    writeUrlParams({ view: m === "timeline" ? "timeline" : null });
  }, []);
  const setTlRange = useCallback((r: TlRange) => {
    setTlRangeState(r);
    writeUrlParams({ range: r === "week" ? "week" : null });
  }, []);
  /* Bumped after every successful mutation — My Planning refetches on it. */
  const [version, setVersion] = useState(0);

  const toastError = useCallback((e: unknown) => showToast(t(planningErrorKey(e)), "error"), [showToast, t]);

  /* ── Reference data: resources + roles (not week-keyed) ── */
  const loadResources = useCallback(() => fetchResources(), []);
  const loadRoles = useCallback(() => fetchRoles(), []);
  const loadTemplates = useCallback(() => fetchTemplates(), []);
  const resQ = useWarmData<PlanningResource[]>("planning:resources", loadResources);
  const rolesQ = useWarmData<PlanningRole[]>("planning:roles", loadRoles);
  /* Templates never block the board: a failure just means no template menu. */
  const tplQ = useWarmData<PlanningTemplate[]>("planning:templates", loadTemplates);
  const templates = useMemo(() => tplQ.data ?? [], [tplQ.data]);
  const resources = useMemo(() => resQ.data ?? [], [resQ.data]);
  const roles = useMemo(() => rolesQ.data ?? [], [rolesQ.data]);

  /* ── Week-keyed data: items + leave ── */
  /* null = the current week, read on the planner's clock (so it follows
     the zone once the preference loads). */
  const [anchor, setAnchor] = useState<Date | null>(null);
  const weekStart = useMemo(() => startOfWeek(anchor ?? plannerNow(tz)), [anchor, tz]);
  /* The week as real instants, for overlap tests against stored items. */
  const weekFromMs = useMemo(() => wallInstant(weekStart, tz).getTime(), [weekStart, tz]);
  const weekToMs = useMemo(() => wallInstant(addDays(weekStart, 7), tz).getTime(), [weekStart, tz]);
  const itemsKey = itemsKeyFor(weekStart, tz);
  const leavesKey = leavesKeyFor(weekStart);
  const loadItems = useMemo(() => weekItemsLoader(weekStart, tz), [weekStart, tz]);
  const loadLeaves = useMemo(() => weekLeavesLoader(weekStart), [weekStart]);
  const itemsQ = useWarmData<PlanningItem[]>(itemsKey, loadItems, DEFAULT_MAX_AGE_MS, ITEMS_STALE_MS);
  const leavesQ = useWarmData<WeekAbsence>(leavesKey, loadLeaves, DEFAULT_MAX_AGE_MS, ITEMS_STALE_MS);
  const leaves = useMemo(() => leavesQ.data?.leaves ?? [], [leavesQ.data]);
  const away = useMemo(() => leavesQ.data?.away ?? [], [leavesQ.data]);

  /* Optimistic overlay. It is stamped with the week key AND the server
     answer it was built on: the moment a fresh answer lands (different
     `base`), the overlay retires by itself and the server wins. */
  const serverItems = itemsQ.data;
  const [overlay, setOverlay] = useState<{ k: string; base: PlanningItem[] | null; items: PlanningItem[] } | null>(null);
  const items = useMemo(
    () => (overlay && overlay.k === itemsKey && overlay.base === serverItems ? overlay.items : serverItems ?? []),
    [overlay, itemsKey, serverItems],
  );

  /* Week keys this session has warmed — dropped after a mutation so a week
     the edited item moved into/out of refetches when visited. */
  const warmedWeeks = useRef<Set<string>>(new Set());
  useEffect(() => {
    warmedWeeks.current.add(itemsKey);
  }, [itemsKey]);

  /* Prefetch the adjacent weeks into the warm cache once this one is up. */
  useEffect(() => {
    if (!serverItems) return;
    for (const d of [-7, 7]) {
      const ws = addDays(weekStart, d);
      const ik = itemsKeyFor(ws, tz);
      const lk = leavesKeyFor(ws);
      if (warmAge(ik) > ITEMS_STALE_MS) {
        warmedWeeks.current.add(ik);
        weekItemsLoader(ws, tz)().then((v) => writeWarm(ik, v), () => {});
      }
      if (warmAge(lk) > ITEMS_STALE_MS) {
        weekLeavesLoader(ws)().then((v) => writeWarm(lk, v), () => {});
      }
    }
  }, [serverItems, weekStart, tz]);

  /* Attach the joined resource/role the list route returns, so an item
     coming back from a write renders exactly like a fetched one. */
  const enrich = useCallback(
    (row: PlanningItem): PlanningItem => {
      const r = resources.find((x) => x.id === row.resource_id);
      const ro = roles.find((x) => x.id === row.role_id);
      return {
        ...row,
        resource: r ? { id: r.id, name: r.name, type: r.type, account_id: r.account_id, color: r.color, icon: r.icon } : null,
        role: ro ? { id: ro.id, name: ro.name, color: ro.color } : null,
      };
    },
    [resources, roles],
  );

  const inWeek = useCallback(
    (it: { start_at: string; end_at: string }) =>
      new Date(it.end_at).getTime() >= weekFromMs && new Date(it.start_at).getTime() < weekToMs,
    [weekFromMs, weekToMs],
  );

  /** Show `next` now; persist it as the week's warm answer when `commit`. */
  const showItems = useCallback(
    (next: PlanningItem[], commit: boolean) => {
      const sorted = [...next].sort((a, b) => a.start_at.localeCompare(b.start_at));
      if (commit) {
        writeWarm(itemsKey, sorted);
        for (const k of warmedWeeks.current) if (k !== itemsKey) dropWarm(k);
      }
      setOverlay({ k: itemsKey, base: serverItems ?? null, items: sorted });
    },
    [itemsKey, serverItems],
  );

  const replaceItem = useCallback(
    (list: PlanningItem[], row: PlanningItem) => {
      const rest = list.filter((i) => i.id !== row.id);
      return inWeek(row) ? [...rest, enrich(row)] : rest;
    },
    [enrich, inWeek],
  );
  const replaceMany = useCallback(
    (list: PlanningItem[], rows: PlanningItem[]) => rows.reduce((acc, r) => replaceItem(acc, r), list),
    [replaceItem],
  );

  /* A retried write (conflict → "Save anyway") runs after later renders, so
     it reads the board through this ref, never a stale closure. */
  const latest = useRef({
    items: [] as PlanningItem[],
    showItems: (() => {}) as (next: PlanningItem[], commit: boolean) => void,
    replaceMany,
  });

  useEffect(() => {
    latest.current = { items, showItems, replaceMany };
  }, [items, showItems, replaceMany]);

  /* ── Scope: SA audience lens + search ── */
  const itemInvolves = useCallback((it: PlanningItem, id: string | null) => {
    if (!id) return true;
    return it.resource?.account_id === id || it.created_by_account_id === id || !it.resource_id;
  }, []);
  const matchesSearch = useCallback(
    (it: PlanningItem) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [it.title, it.resource?.name, it.role?.name, it.linked_entity_label, it.notes]
        .some((v) => (v ?? "").toLowerCase().includes(q));
    },
    [search],
  );
  const lensItems = useMemo(() => {
    if (!isSA || saView === "all") return items;
    return items.filter((it) => itemInvolves(it, saView === "own" ? meId : saView));
  }, [items, isSA, saView, meId, itemInvolves]);
  const scopedItems = useMemo(() => lensItems.filter(matchesSearch), [lensItems, matchesSearch]);

  const canWrite = useCallback(
    (it: PlanningItem) => isSA || it.created_by_account_id === meId || (!!it.resource?.account_id && it.resource.account_id === meId),
    [isSA, meId],
  );

  /* ── Modal + ?item deep link ── */
  const [modal, setModal] = useState<{ open: boolean; editing: PlanningItem | null; preset?: ItemModalPreset }>({
    open: false,
    editing: null,
  });
  const openItem = useCallback((item: PlanningItem) => {
    setModal({ open: true, editing: item });
    writeUrlParams({ item: item.id });
  }, []);
  const closeModal = useCallback(() => {
    setModal({ open: false, editing: null });
    writeUrlParams({ item: null });
  }, []);

  const deepLinkDone = useRef(false);
  /* The deep link runs once; it reads the zone through a ref. */
  const tzRef = useRef(tz);
  useEffect(() => {
    tzRef.current = tz;
  }, [tz]);
  useEffect(() => {
    if (deepLinkDone.current) return;
    deepLinkDone.current = true;
    const id = readUrlParam("item");
    if (!id) return;
    fetchItem(id).then(
      (item) => {
        setModal({ open: true, editing: item });
        /* Jump the board to the item's week so it is visible behind the modal. */
        setAnchor(startOfWeek(plannerWall(item.start_at, tzRef.current)));
      },
      (e) => {
        toastError(e);
        writeUrlParams({ item: null });
      },
    );
  }, [toastError]);

  /* ── Conflicts: 409 schedule_conflict → dialog (+ "Save anyway" for SA) ── */
  const [conflict, setConflict] = useState<{ info: PlanningConflictInfo; retry: () => Promise<void> } | null>(null);
  /** Show the conflict dialog when `e` is a schedule conflict; true if shown. */
  const offerConflict = useCallback((e: unknown, retry: () => Promise<void>) => {
    const info = conflictInfo(e);
    if (!info) return false;
    setConflict({ info, retry });
    return true;
  }, []);

  /* ── Mutations ── */
  const handleSave = useCallback(
    async (payload: Partial<PlanningItem> & { start_at: string; end_at: string }, opts: ItemSaveOptions) => {
      const editingItem = modal.editing;
      const attempt = async (force: boolean) => {
        const rows = editingItem
          ? await updateItems(editingItem.id, payload, { scope: opts.scope, recurrence: opts.recurrence, tz, force })
          : await createItemsOrThrow(payload, { recurrence: opts.recurrence, tz, force });
        const L = latest.current;
        L.showItems(L.replaceMany(L.items, rows), true);
        setVersion((v) => v + 1);
        closeModal();
        showToast(t("toast.saved"), "success");
      };
      try {
        await attempt(false);
      } catch (e) {
        if (!offerConflict(e, () => attempt(true))) toastError(e);
        throw e; // keep the modal open with the user's edits
      }
    },
    [modal.editing, tz, closeModal, showToast, t, toastError, offerConflict],
  );

  const handleDelete = useCallback(
    async (id: string, scope: SeriesScope = "this") => {
      const before = items;
      const target = items.find((i) => i.id === id);
      const series = target?.recurrence_parent_id;
      const doomed = (i: PlanningItem) =>
        i.id === id || (scope === "future" && !!series && i.recurrence_parent_id === series && !!target && i.start_at >= target.start_at && canWrite(i));
      showItems(items.filter((i) => !doomed(i)), false);
      try {
        const ids = new Set(await deleteItem(id, scope));
        showItems(before.filter((i) => !ids.has(i.id)), true);
        setVersion((v) => v + 1);
        closeModal();
        showToast(t("toast.deleted"), "success");
      } catch (e) {
        showItems(before, false); // rollback
        toastError(e);
        throw e;
      }
    },
    [items, canWrite, showItems, closeModal, showToast, t, toastError],
  );

  const [taking, setTaking] = useState<string | null>(null);
  const handleTake = useCallback(
    async (id: string) => {
      if (taking) return;
      setTaking(id);
      const attempt = async (force: boolean) => {
        const taken = await takeOpenShift(id, { force, tz });
        const L = latest.current;
        L.showItems(L.replaceMany(L.items, [taken]), true);
        setVersion((v) => v + 1);
        showToast(t("toast.taken"), "success");
      };
      try {
        await attempt(false);
      } catch (e) {
        if (offerConflict(e, () => attempt(true))) return;
        toastError(e);
        /* Someone else got there first / it vanished: show the truth. */
        if (e instanceof PlanningApiError && (e.status === 409 || e.status === 404)) void itemsQ.reload();
      } finally {
        setTaking(null);
      }
    },
    [taking, tz, showToast, t, toastError, itemsQ, offerConflict],
  );

  /** Move / resize / re-assign one item. Optimistic: it moves at once and
   *  snaps back if refused; a conflict offers "Save anyway" to managers. */
  const moveItem = useCallback(
    async (itemId: string, patch: { start_at: string; end_at: string; resource_id: string | null }) => {
      const run = async (force: boolean) => {
        const L0 = latest.current;
        const existing = L0.items.find((i) => i.id === itemId);
        if (!existing) return;
        const before = L0.items;
        L0.showItems(L0.replaceMany(before, [{ ...existing, ...patch }]), false);
        try {
          const saved = await updateItem(itemId, patch, { tz, force });
          L0.showItems(L0.replaceMany(before, [saved]), true);
          setVersion((v) => v + 1);
        } catch (e) {
          latest.current.showItems(before, false); // rollback
          throw e;
        }
      };
      try {
        await run(false);
      } catch (e) {
        if (!offerConflict(e, () => run(true))) toastError(e);
      }
    },
    [tz, toastError, offerConflict],
  );

  /** Grid drag: move to a new (resource, day) cell, keeping the time of day
   *  and duration — only the date and assignee change. */
  const handleItemDrop = useCallback(
    async (itemId: string, targetResourceId: string | null, targetDate: Date) => {
      const existing = items.find((i) => i.id === itemId);
      if (!existing) return;
      const durationMs = Date.parse(existing.end_at) - Date.parse(existing.start_at);
      // Stamp targetDate's Y/M/D (a wall day) onto the old wall time-of-day.
      const oldWall = plannerWall(existing.start_at, tz);
      const newWall = new Date(targetDate);
      newWall.setHours(oldWall.getHours(), oldWall.getMinutes(), oldWall.getSeconds(), oldWall.getMilliseconds());
      // No-op if nothing changed (e.g. dropped on same cell).
      if (dateKey(oldWall) === dateKey(newWall) && existing.resource_id === targetResourceId) return;
      const newStart = zonedToUtc(
        newWall.getFullYear(), newWall.getMonth() + 1, newWall.getDate(),
        newWall.getHours(), newWall.getMinutes(), newWall.getSeconds(), newWall.getMilliseconds(), tz,
      );
      await moveItem(itemId, {
        start_at: new Date(newStart).toISOString(),
        end_at: new Date(newStart + durationMs).toISOString(),
        resource_id: targetResourceId,
      });
    },
    [items, moveItem, tz],
  );

  const handleTimelineMove = useCallback(
    (itemId: string, patch: TimelinePatch) => void moveItem(itemId, patch),
    [moveItem],
  );

  /** "Add from template" on a cell: a draft at the template's times, that day. */
  const handleTemplateCreate = useCallback(
    async (tpl: PlanningTemplate, resourceId: string | null, day: Date) => {
      const [h, mi] = tpl.start_time.split(":").map(Number);
      const start = zonedToUtc(day.getFullYear(), day.getMonth() + 1, day.getDate(), h, mi, 0, 0, tz);
      const payload = {
        type: tpl.type,
        title: tpl.name,
        notes: tpl.default_note,
        role_id: tpl.role_id,
        resource_id: resourceId,
        start_at: new Date(start).toISOString(),
        end_at: new Date(start + tpl.duration_hours * 3_600_000).toISOString(),
        status: "draft" as const,
      };
      const attempt = async (force: boolean) => {
        const rows = await createItemsOrThrow(payload, { tz, force });
        const L = latest.current;
        L.showItems(L.replaceMany(L.items, rows), true);
        setVersion((v) => v + 1);
        showToast(t("toast.saved"), "success");
      };
      try {
        await attempt(false);
      } catch (e) {
        if (!offerConflict(e, () => attempt(true))) toastError(e);
      }
    },
    [tz, showToast, t, toastError, offerConflict],
  );

  /* ── Week actions: preview → confirm ── */
  const [weekBusy, setWeekBusy] = useState<"copy" | "publish" | null>(null);
  const [weekAction, setWeekAction] = useState<
    { kind: "copy" | "publish"; body: WeekActionBody; count: number; skipped: number; people: number } | null
  >(null);
  const startWeekAction = useCallback(
    async (kind: "copy" | "publish", resourceIds: string[] | null) => {
      if (weekBusy) return;
      const body: WeekActionBody = {
        week_start: wallInstant(weekStart, tz).toISOString(),
        resource_ids: resourceIds,
        include_open: true,
        tz,
      };
      setWeekBusy(kind);
      try {
        if (kind === "copy") {
          const r = await copyLastWeek(body, true);
          if (r.count === 0) showToast(t("copy.none"), "info");
          else setWeekAction({ kind, body, count: r.count, skipped: r.skipped, people: 0 });
        } else {
          const r = await publishWeek(body, true);
          if (r.count === 0) showToast(t("publish.none"), "info");
          else setWeekAction({ kind, body, count: r.count, skipped: 0, people: r.people });
        }
      } catch (e) {
        toastError(e);
      } finally {
        setWeekBusy(null);
      }
    },
    [weekBusy, weekStart, tz, showToast, t, toastError],
  );
  const confirmWeekAction = useCallback(async () => {
    const a = weekAction;
    if (!a || weekBusy) return;
    setWeekBusy(a.kind);
    try {
      const r = a.kind === "copy" ? await copyLastWeek(a.body, false) : await publishWeek(a.body, false);
      const L = latest.current;
      L.showItems(L.replaceMany(L.items, r.items), true);
      setVersion((v) => v + 1);
      showToast(fillVars(t(a.kind === "copy" ? "toast.copied" : "toast.published"), { n: r.count }), "success");
      setWeekAction(null);
    } catch (e) {
      toastError(e);
    } finally {
      setWeekBusy(null);
    }
  }, [weekAction, weekBusy, showToast, t, toastError]);

  /* ── Load state ── */
  const coreError = itemsQ.error ?? resQ.error ?? rolesQ.error;
  const loading = !coreError && (itemsQ.data == null || resQ.data == null || rolesQ.data == null);
  const retry = () => {
    if (itemsQ.error) void itemsQ.reload();
    if (resQ.error) void resQ.reload();
    if (rolesQ.error) void rolesQ.reload();
    if (leavesQ.error) void leavesQ.reload();
  };

  const navItems = (
    [
      { key: "schedule", icon: "calendar", label: t("tab.schedule") },
      { key: "open", icon: "paper-plane", label: t("tab.openShifts") },
      { key: "mine", icon: "clock", label: t("tab.myPlanning") },
      { key: "utilization", icon: "clock", label: t("tab.utilization") },
      { key: "workload", icon: "users", label: t("tab.workload") },
      { key: "config", icon: "cog", label: t("tab.configuration") },
    ] as const
  ).map((n) => ({ key: n.key, icon: n.icon, label: n.label, active: tab === n.key, onClick: () => setTab(n.key) }));

  return (
    <div className="h-full bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden w-full">
      {/* ── Page header — canonical Hub PageHeader ── */}
      <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] z-10 w-full overflow-x-hidden">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 min-w-0 pt-5 pb-3">
          <PageHeader
            title={t("app.title")}
            subtitle={t("app.subtitle")}
            icon={<PlanningIcon className="h-4 w-4" />}
            showTabs={false}
            action={
              <button
                type="button"
                onClick={() => setModal({ open: true, editing: null })}
                aria-label={t("action.new")}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--bg-inverted)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-inverted)] transition-opacity hover:opacity-90"
              >
                <PlusIcon size={12} />
                <span className="hidden md:inline">{t("action.new")}</span>
              </button>
            }
          />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-4 min-w-0 space-y-4">
          {/* Brand-aligned tile menu + search — search filters the loaded
              items by title / resource / role / linked record. */}
          <AppHomeMenu navItems={navItems} searchPlaceholder={searchPlaceholder} onSearchSubmit={setSearch} />

          {(search || isSA) && (
            <div className="flex items-center gap-2 flex-wrap">
              {search && (
                <span className="inline-flex items-center gap-1.5 h-8 ps-3 pe-1 rounded-full border border-[var(--border-color)] bg-[var(--bg-surface-active)] text-[11px] font-semibold text-[var(--text-primary)]">
                  <span className="text-[var(--text-dim)]">{t("search.filtered")}:</span>
                  <span className="max-w-[200px] truncate">{search}</span>
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label={t("search.clear")}
                    title={t("search.clear")}
                    className="h-6 w-6 rounded-full flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                  >
                    <CrossIcon size={10} />
                  </button>
                </span>
              )}
              {isSA && (
                <select
                  value={saView}
                  onChange={(e) => setSaView(e.target.value)}
                  aria-label={t("aria.audience")}
                  className={`ms-auto h-8 ps-3 pe-7 rounded-full text-[11px] font-semibold border outline-none cursor-pointer appearance-none ${
                    saView === "own"
                      ? "bg-transparent border-[var(--border-subtle)] text-[var(--text-dim)]"
                      : "bg-[var(--bg-surface-active)] border-[var(--border-color)] text-[var(--text-primary)]"
                  }`}
                >
                  <option value="own">{t("sa.viewOwn")}</option>
                  <option value="all">{t("sa.viewAll")}</option>
                  {resources
                    .filter((r) => r.type === "employee" && r.account_id && r.account_id !== meId)
                    .map((r) => (
                      <option key={r.id} value={r.account_id as string}>
                        {r.name}
                      </option>
                    ))}
                </select>
              )}
            </div>
          )}

          {coreError != null && !loading && (itemsQ.data == null || resQ.data == null || rolesQ.data == null) ? (
            <ErrorPanel onRetry={retry} />
          ) : loading ? (
            <CenteredSpinner />
          ) : (
            <div key={tab} className={tabMotion}>
              {(coreError != null || leavesQ.error != null) && <ErrorBanner onRetry={retry} />}
              {tab === "schedule" ? (
                <ScheduleView
                  weekStart={weekStart}
                  items={scopedItems}
                  resources={resources}
                  roles={roles}
                  leaves={leaves}
                  away={away}
                  onPrev={() => setAnchor(addDays(weekStart, -7))}
                  onNext={() => setAnchor(addDays(weekStart, 7))}
                  onToday={() => setAnchor(null)}
                  onCellClick={(resource_id, date) => setModal({ open: true, editing: null, preset: { resource_id, date } })}
                  onItemClick={openItem}
                  onItemDrop={handleItemDrop}
                  tz={tz}
                  mode={schedMode}
                  onMode={setSchedMode}
                  tlRange={tlRange}
                  onTlRange={setTlRange}
                  templates={templates}
                  canWrite={canWrite}
                  onTemplateCreate={handleTemplateCreate}
                  onTimelineMove={handleTimelineMove}
                  onTimelineCreate={(resource_id, start) => setModal({ open: true, editing: null, preset: { resource_id, date: start, start } })}
                  weekBusy={weekBusy}
                  onWeekAction={startWeekAction}
                />
              ) : tab === "utilization" ? (
                <UtilizationView items={lensItems} resources={resources} leaves={leaves} weekStart={weekStart} tz={tz} />
              ) : tab === "workload" ? (
                <WorkloadView
                  weekStart={weekStart}
                  resources={resources}
                  tz={tz}
                  version={version}
                  onPrev={() => setAnchor(addDays(weekStart, -7))}
                  onNext={() => setAnchor(addDays(weekStart, 7))}
                  onToday={() => setAnchor(null)}
                />
              ) : tab === "open" ? (
                <OpenShiftsView
                  items={scopedItems.filter((i) => !i.resource_id)}
                  tz={tz}
                  roles={roles}
                  taking={taking}
                  canWrite={canWrite}
                  onTake={handleTake}
                  onEdit={openItem}
                />
              ) : tab === "mine" ? (
                <MyPlanningView roles={roles} version={version} matches={matchesSearch} onEdit={openItem} tz={tz} />
              ) : (
                <ConfigurationView
                  roles={roles}
                  resources={resources}
                  templates={templates}
                  onRolesChanged={rolesQ.reload}
                  onResourcesChanged={resQ.reload}
                  onTemplatesChanged={tplQ.reload}
                  onError={toastError}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal (its own chunk, fetched the first time one opens) ── */}
      {modal.open && (
        <ItemModal
          open={modal.open}
          editing={modal.editing}
          preset={modal.preset}
          resources={resources}
          roles={roles}
          readOnly={!!modal.editing && !canWrite(modal.editing)}
          templates={templates}
          tz={tz}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
      <ConflictDialog
        info={conflict?.info ?? null}
        tz={tz}
        onClose={() => setConflict(null)}
        onOverride={async () => {
          const c = conflict;
          if (!c) return;
          try {
            await c.retry();
            setConflict(null);
          } catch (e) {
            setConflict(null);
            if (!offerConflict(e, c.retry)) toastError(e);
          }
        }}
      />
      <ConfirmDialog
        open={!!weekAction}
        tone="neutral"
        title={weekAction?.kind === "publish" ? t("publish.title") : t("copy.title")}
        message={
          weekAction
            ? weekAction.kind === "publish"
              ? fillVars(t("publish.preview"), { n: weekAction.count, p: weekAction.people })
              : `${fillVars(t("copy.preview"), { n: weekAction.count })}${weekAction.skipped ? ` ${fillVars(t("copy.skipped"), { n: weekAction.skipped })}` : ""}`
            : undefined
        }
        confirmLabel={weekBusy ? t("btn.saving") : weekAction?.kind === "publish" ? t("publish.confirm") : t("copy.confirm")}
        cancelLabel={t("btn.cancel")}
        busy={!!weekBusy}
        onConfirm={() => void confirmWeekAction()}
        onCancel={() => { if (!weekBusy) setWeekAction(null); }}
      />
      {toastElement}
    </div>
  );
}

function CenteredSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)]" />
    </div>
  );
}

function ErrorPanel({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation(planningT);
  return (
    <div role="alert" className="kx-glass rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] py-14 text-center space-y-3">
      <div className="text-[13px] text-red-600 dark:text-red-400">{t("err.load")}</div>
      <button
        type="button"
        onClick={onRetry}
        className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90"
      >
        {t("btn.retry")}
      </button>
    </div>
  );
}

function ErrorBanner({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation(planningT);
  return (
    <div role="alert" className="mb-3 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-[12px] text-red-600 dark:text-red-400 flex items-center gap-2">
      <ExclamationIcon size={13} className="shrink-0" />
      <span className="flex-1">{t("err.load")}</span>
      <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2">
        {t("btn.retry")}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SCHEDULE VIEW — weekly grid, rows = resource, cols = day
   ══════════════════════════════════════════════════════════════════ */

function ScheduleView({
  weekStart,
  items,
  resources,
  roles,
  leaves,
  away,
  onPrev,
  onNext,
  onToday,
  onCellClick,
  onItemClick,
  onItemDrop,
  tz,
  mode,
  onMode,
  tlRange,
  onTlRange,
  templates,
  canWrite,
  onTemplateCreate,
  onTimelineMove,
  onTimelineCreate,
  weekBusy,
  onWeekAction,
}: {
  weekStart: Date;
  items: PlanningItem[];
  resources: PlanningResource[];
  roles: PlanningRole[];
  leaves: LeaveSpan[];
  away: AwaySpan[];
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onCellClick: (resource_id: string | null, date: Date) => void;
  onItemClick: (item: PlanningItem) => void;
  onItemDrop: (itemId: string, resourceId: string | null, date: Date) => void | Promise<void>;
  tz: string;
  mode: SchedMode;
  onMode: (m: SchedMode) => void;
  tlRange: TlRange;
  onTlRange: (r: TlRange) => void;
  templates: PlanningTemplate[];
  canWrite: (i: PlanningItem) => boolean;
  onTemplateCreate: (tpl: PlanningTemplate, resourceId: string | null, day: Date) => void | Promise<void>;
  onTimelineMove: (itemId: string, patch: TimelinePatch) => void;
  onTimelineCreate: (resourceId: string | null, start: Date) => void;
  weekBusy: "copy" | "publish" | null;
  onWeekAction: (kind: "copy" | "publish", resourceIds: string[] | null) => void;
}) {
  // Track the cell currently under the dragged pointer so we can style it.
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const { t, lang } = useTranslation(planningT);
  const [groupBy, setGroupBy] = useState<"resource" | "role">("resource");
  const [resourceType, setResourceType] = useState<PlanningResourceType | "all">("all");

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const dayKeys = useMemo(() => days.map(dateKey), [days]);

  /* Approved-leave overlay: resource|dayKey cells the person is away. */
  const leaveCells = useMemo(() => {
    const set = new Set<string>();
    for (const lv of leaves) {
      for (const dk of dayKeys) {
        if (lv.start_date <= dk && dk <= lv.end_date) set.add(`${lv.resource_id}|${dk}`);
      }
    }
    return set;
  }, [leaves, dayKeys]);

  /* Calendar out-of-office overlay: resource|dayKey → that day's slices. */
  const awayCells = useMemo(() => awayDaySlices(away, days, tz), [away, days, tz]);
  const awayTip = useCallback(
    (slices: AwaySlice[]) =>
      `${t("sched.outOfOffice")} · ${slices
        .map((sl) => (sl.full ? t("sched.allDay") : awaySliceRange(sl, tz)))
        .join(", ")}\n${t("sched.outOfOfficeHint")}`,
    [t, tz],
  );

  /* Every day an item covers, computed once per item. */
  const coveredDays = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const it of items) m.set(it.id, itemDayKeys(it, days, tz));
    return m;
  }, [items, days, tz]);

  const visibleResources = useMemo(() => {
    if (resourceType === "all") return resources.filter((r) => r.is_active);
    return resources.filter((r) => r.is_active && r.type === resourceType);
  }, [resources, resourceType]);

  /* Index items by row key + day key. A multi-day item is placed on EVERY
     day it covers, not just its start day. */
  const byCell = useMemo(() => {
    const map = new Map<string, PlanningItem[]>();
    for (const it of items) {
      const rowKey = groupBy === "resource" ? it.resource_id ?? "__open__" : it.role_id ?? "__none__";
      for (const dayKey of coveredDays.get(it.id) ?? []) {
        const k = `${rowKey}|${dayKey}`;
        const arr = map.get(k) ?? [];
        arr.push(it);
        map.set(k, arr);
      }
    }
    return map;
  }, [items, groupBy, coveredDays]);

  /* Double-booking detection — same real resource, overlapping time window,
     not cancelled. Pure client-side over the loaded week; flags both sides
     of every overlapping pair. */
  const conflictIds = useMemo(() => {
    const set = new Set<string>();
    const byRes = new Map<string, PlanningItem[]>();
    for (const it of items) {
      if (!it.resource_id || it.status === "cancelled") continue;
      const arr = byRes.get(it.resource_id) ?? [];
      arr.push(it);
      byRes.set(it.resource_id, arr);
    }
    for (const arr of byRes.values()) {
      arr.sort((a, b) => a.start_at.localeCompare(b.start_at));
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          if (arr[j].start_at >= arr[i].end_at) break;
          set.add(arr[i].id);
          set.add(arr[j].id);
        }
      }
    }
    // Items scheduled over ANY day their resource is on approved leave.
    for (const it of items) {
      if (!it.resource_id || it.status === "cancelled") continue;
      const dks = coveredDays.get(it.id) ?? [];
      if (dks.some((dk) => leaveCells.has(`${it.resource_id}|${dk}`))) set.add(it.id);
      // …or over their Calendar out-of-office time.
      else if (overlapsAway(awayCells, it.resource_id, dks, it.start_at, it.end_at)) set.add(it.id);
    }
    return set;
  }, [items, leaveCells, awayCells, coveredDays]);

  const resourceSub = (r: PlanningResource) =>
    r.description ?? t(`cfg.resources.type.${r.type}`, r.type);

  const rows =
    groupBy === "resource"
      ? [
          { id: "__open__", name: t("sched.openShiftsRow"), sub: t("sched.unassigned"), color: null as string | null },
          ...visibleResources.map((r) => ({ id: r.id, name: r.name, sub: resourceSub(r), color: r.color })),
        ]
      : [
          { id: "__none__", name: t("sched.unrolled"), sub: t("sched.noRole"), color: null as string | null },
          ...roles.filter((r) => r.is_active).map((r) => ({ id: r.id, name: r.name, sub: null, color: r.color })),
        ];

  const rangeLabel = formatWeekRange(weekStart);

  // Mobile-only: which day is currently in focus. Defaults to today if
  // it's inside the current week, otherwise the first day of the week.
  const todayKey = dateKey(plannerNow(tz));
  const todayIdx = dayKeys.indexOf(todayKey);
  const [mobileDay, setMobileDay] = useState<{ week: string; idx: number } | null>(null);
  const weekId = dayKeys[0];
  const mobileDayIdx = mobileDay && mobileDay.week === weekId ? mobileDay.idx : todayIdx >= 0 ? todayIdx : 0;
  const activeDay = days[mobileDayIdx] ?? days[0];
  const activeDayKey = dateKey(activeDay);

  const weekdayLabel = (d: Date) => d.toLocaleDateString(lang, { weekday: "short" });
  const todayCls = "text-[#567FB2] dark:text-[#7FA9D6]";

  const isTimeline = mode === "timeline";
  /* Stable per day/week so the timeline keeps its scroll position across saves. */
  const tlDays = useMemo(() => (tlRange === "day" ? [activeDay] : days), [tlRange, activeDay, days]);
  /* Week actions act on what is on screen: the visible resources (and the
     open-shifts row), or everything when grouped by role. */
  const weekScopeIds = groupBy === "resource" || isTimeline ? visibleResources.map((r) => r.id) : null;
  const draftCount = items.filter((i) => i.status === "draft" && canWrite(i)).length;
  const tlRows: TimelineRow[] = [
    { id: "__open__", name: t("sched.openShiftsRow"), sub: t("sched.unassigned"), color: null, resourceId: null },
    ...visibleResources.map((r) => ({ id: r.id, name: r.name, sub: resourceSub(r), color: r.color, resourceId: r.id })),
  ];
  const segBtn = (on: boolean) =>
    `h-7 px-2.5 rounded-md text-[11px] font-semibold transition-colors inline-flex items-center gap-1.5 ${
      on ? "kx-seg-on bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "kx-seg-off text-[var(--text-dim)] hover:text-[var(--text-primary)]"
    }`;
  const toolBtn =
    "h-8 px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] inline-flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <div className="space-y-3">
      {conflictIds.size > 0 && (
        <div role="status" className="rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-[12px] text-red-600 dark:text-red-400 flex items-center gap-2">
          <ExclamationIcon size={13} className="shrink-0" />
          <span>
            {t("sched.conflictWarn")} {conflictIds.size} {t("sched.conflictWarnTail")}
          </span>
        </div>
      )}
      {/* Toolbar — stacks on mobile so controls don't cramp */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPrev}
            aria-label={t("aria.prevWeek")}
            title={t("aria.prevWeek")}
            className="h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center shrink-0"
          >
            <AngleLeftIcon size={14} className="rtl:-scale-x-100" />
          </button>
          <button
            type="button"
            onClick={onToday}
            className="h-8 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] shrink-0"
          >
            {t("sched.today")}
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label={t("aria.nextWeek")}
            title={t("aria.nextWeek")}
            className="h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center shrink-0"
          >
            <AngleRightIcon size={14} className="rtl:-scale-x-100" />
          </button>
          <div className="text-[12px] md:text-[13px] font-semibold text-[var(--text-primary)] truncate" aria-live="polite">
            {rangeLabel}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-0.5" role="group" aria-label={t("aria.viewMode")}>
            <button type="button" onClick={() => onMode("grid")} aria-pressed={!isTimeline} className={segBtn(!isTimeline)}>
              <TableIcon size={11} />
              {t("sched.view.grid")}
            </button>
            <button type="button" onClick={() => onMode("timeline")} aria-pressed={isTimeline} className={segBtn(isTimeline)}>
              <TimelineIcon size={11} />
              {t("sched.view.timeline")}
            </button>
          </div>

          {isTimeline && (
            <div className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-0.5" role="group" aria-label={t("aria.range")}>
              {(["day", "week"] as const).map((r) => (
                <button key={r} type="button" onClick={() => onTlRange(r)} aria-pressed={tlRange === r} className={segBtn(tlRange === r)}>
                  {t(r === "day" ? "sched.range.day" : "sched.range.week")}
                </button>
              ))}
            </div>
          )}

          {!isTimeline && (
          <div className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-0.5" role="group">
            {(["resource", "role"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroupBy(g)}
                aria-pressed={groupBy === g}
                className={`h-7 px-2.5 rounded-md text-[11px] font-semibold transition-colors ${
                  groupBy === g
                    ? "kx-seg-on bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                    : "kx-seg-off text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                }`}
              >
                {t(g === "resource" ? "sched.byResource" : "sched.byRole")}
              </button>
            ))}
          </div>
          )}

          {(groupBy === "resource" || isTimeline) && (
            <select
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value as PlanningResourceType | "all")}
              aria-label={t("aria.resourceType")}
              className="h-8 px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] font-semibold"
            >
              <option value="all">{t("sched.allTypes")}</option>
              <option value="employee">{t("sched.employees")}</option>
              <option value="material">{t("sched.materials")}</option>
              <option value="room">{t("sched.rooms")}</option>
              <option value="vehicle">{t("sched.vehicles")}</option>
              <option value="other">{t("sched.other")}</option>
            </select>
          )}

          <div className="flex items-center gap-1.5 ms-auto">
            <button
              type="button"
              onClick={() => onWeekAction("copy", weekScopeIds)}
              disabled={weekBusy !== null}
              aria-busy={weekBusy === "copy"}
              className={toolBtn}
            >
              {weekBusy === "copy" ? <SpinnerIcon className="h-3 w-3" /> : <CopyIcon size={12} />}
              <span className="hidden sm:inline">{t("sched.copyLastWeek")}</span>
              <span className="sr-only sm:hidden">{t("sched.copyLastWeek")}</span>
            </button>
            <button
              type="button"
              onClick={() => onWeekAction("publish", weekScopeIds)}
              disabled={weekBusy !== null}
              aria-busy={weekBusy === "publish"}
              className={toolBtn}
            >
              {weekBusy === "publish" ? <SpinnerIcon className="h-3 w-3" /> : <PaperPlaneIcon size={12} />}
              <span className="hidden sm:inline">{t("sched.publishWeek")}</span>
              <span className="sr-only sm:hidden">{t("sched.publishWeek")}</span>
              {draftCount > 0 && (
                <span className="min-w-4 h-4 px-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] font-bold inline-flex items-center justify-center tabular-nums">
                  {draftCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Day pager (mobile list; every breakpoint for the Day timeline) ── */}
      <div className={`${isTimeline && tlRange === "day" ? "" : "md:hidden"} space-y-3 ${isTimeline && tlRange !== "day" ? "hidden" : ""}`}>
        <div
          className="kx-glass flex items-center gap-1 overflow-x-auto scrollbar-none bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-1"
          role="group"
          aria-label={t("aria.weekDays")}
        >
          {days.map((d, i) => {
            const isToday = dayKeys[i] === todayKey;
            const isActive = i === mobileDayIdx;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setMobileDay({ week: weekId, idx: i })}
                aria-pressed={isActive}
                aria-current={isToday ? "date" : undefined}
                className={`shrink-0 min-w-[44px] py-1.5 rounded-lg text-center transition-all ${
                  isActive
                    ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                    : isToday
                      ? todayCls
                      : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                }`}
              >
                <div className="text-[9px] font-bold uppercase tracking-wider">{weekdayLabel(d)}</div>
                <div className="text-[14px] font-bold leading-tight">{d.getDate()}</div>
              </button>
            );
          })}
        </div>
      </div>

      {isTimeline && (
        <TimelineView
          days={tlDays}
          range={tlRange}
          rows={tlRows}
          items={items}
          tz={tz}
          conflictIds={conflictIds}
          leaveCells={leaveCells}
          awayCells={awayCells}
          awayTip={awayTip}
          canWrite={canWrite}
          onItemClick={onItemClick}
          onMove={onTimelineMove}
          onCreateAt={onTimelineCreate}
        />
      )}

      {/* ── Mobile: single-day list ── */}
      <div className={`md:hidden ${isTimeline ? "hidden" : ""}`}>
        <div className="kx-glass rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden divide-y divide-[var(--border-subtle)]">
          {rows.map((row) => {
            const key = `${row.id}|${activeDayKey}`;
            const cellItems = byCell.get(key) ?? [];
            const resourceId = row.id === "__open__" ? null : row.id;
            return (
              <div key={row.id} className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full shrink-0" style={{ background: row.color ?? "var(--border-subtle)" }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{row.name}</div>
                    {row.sub && <div className="text-[10px] text-[var(--text-dim)] truncate">{row.sub}</div>}
                  </div>
                  {groupBy === "resource" && templates.length > 0 && (
                    <TemplateMenu
                      templates={templates}
                      label={`${t("sched.addFromTemplate")}: ${row.name}`}
                      onPick={(tpl) => void onTemplateCreate(tpl, resourceId, activeDay)}
                      size="md"
                    />
                  )}
                  {groupBy === "resource" && (
                    <button
                      type="button"
                      onClick={() => onCellClick(resourceId, activeDay)}
                      className="h-7 w-7 rounded-lg border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center shrink-0"
                      aria-label={`${t("sched.addItem")}: ${row.name}`}
                    >
                      <PlusIcon size={12} />
                    </button>
                  )}
                </div>
                {leaveCells.has(key) && (
                  <div className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1">
                    {t("sched.onLeave")}
                  </div>
                )}
                {awayCells.has(key) && <AwayBadge slices={awayCells.get(key) ?? []} tz={tz} tip={awayTip} />}
                {cellItems.length > 0 ? (
                  <div className="space-y-1.5">
                    {cellItems.map((it) => (
                      <MobileItemRow key={it.id} item={it} tz={tz} onClick={onItemClick} conflict={conflictIds.has(it.id)} />
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-[var(--text-dim)] ps-3">{t("sched.nothing")}</div>
                )}
              </div>
            );
          })}
          {rows.length === 1 && (
            <div className="px-6 py-10 text-center text-[12px] text-[var(--text-dim)]">{t("sched.noResources")}</div>
          )}
        </div>
      </div>

      {/* ── Desktop: full 7-day grid ── */}
      {/* The schedule grid — one big leaf surface, so one blur pass rather
          than one per cell. Frost is a separate step from the remap: without
          it the whole roster reads directly against the moving ground. */}
      <div
        role="grid"
        aria-label={rangeLabel}
        className={`kx-glass hidden ${isTimeline ? "" : "md:block"} rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden`}
      >
        {/* Header row */}
        <div role="row" className="grid border-b border-[var(--border-subtle)]" style={{ gridTemplateColumns: "220px repeat(7, 1fr)" }}>
          <div role="columnheader" className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)] border-e border-[var(--border-subtle)]">
            {groupBy === "resource" ? t("sched.resource") : t("sched.role")}
          </div>
          {days.map((d, i) => {
            const isToday = dayKeys[i] === todayKey;
            return (
              <div
                key={i}
                role="columnheader"
                aria-current={isToday ? "date" : undefined}
                className={`px-2 py-2.5 text-center border-e last:border-e-0 border-[var(--border-subtle)] ${isToday ? "bg-[#567FB2]/10" : ""}`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{weekdayLabel(d)}</div>
                <div className={`text-[15px] font-bold ${isToday ? todayCls : "text-[var(--text-primary)]"}`}>{d.getDate()}</div>
              </div>
            );
          })}
        </div>

        {/* Body rows */}
        {rows.map((row) => (
          <div key={row.id} role="row" className="grid border-b last:border-b-0 border-[var(--border-subtle)]" style={{ gridTemplateColumns: "220px repeat(7, 1fr)" }}>
            <div role="rowheader" className="px-3 py-2 border-e border-[var(--border-subtle)] flex items-center gap-2">
              <div className="w-1.5 h-8 rounded-full shrink-0" style={{ background: row.color ?? "var(--border-subtle)" }} />
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{row.name}</div>
                {row.sub && <div className="text-[10px] text-[var(--text-dim)] truncate">{row.sub}</div>}
              </div>
            </div>
            {days.map((d, i) => {
              const key = `${row.id}|${dayKeys[i]}`;
              const cellItems = byCell.get(key) ?? [];
              const resourceId = row.id === "__open__" ? null : row.id;
              const isDragTarget = dragOverKey === key;
              const droppable = groupBy === "resource";
              /* A plain gridcell (not a <button>): it holds draggable pills,
                 and interactive content nested in a button is invalid and
                 breaks dragging in Firefox. Creating is its own button. */
              return (
                <div
                  key={i}
                  role="gridcell"
                  onClick={(e) => {
                    // Mouse convenience: a click on the empty cell area adds.
                    if (e.target !== e.currentTarget || !droppable) return;
                    onCellClick(resourceId, d);
                  }}
                  onDragOver={(e) => {
                    if (!droppable) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverKey !== key) setDragOverKey(key);
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                    if (dragOverKey === key) setDragOverKey(null);
                  }}
                  onDrop={(e) => {
                    if (!droppable) return;
                    e.preventDefault();
                    setDragOverKey(null);
                    const itemId = e.dataTransfer.getData("text/plain");
                    if (itemId) void onItemDrop(itemId, resourceId, d);
                  }}
                  className={`group relative min-h-[70px] p-1.5 border-e last:border-e-0 border-[var(--border-subtle)] text-start transition-colors flex flex-col gap-1 ${
                    isDragTarget
                      ? "bg-[#567FB2]/10 ring-1 ring-inset ring-[#567FB2]/50"
                      : "hover:bg-[var(--bg-surface-subtle)]"
                  }`}
                >
                  {leaveCells.has(key) && (
                    <span className="text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-1 py-px self-start">
                      {t("sched.onLeave")}
                    </span>
                  )}
                  {awayCells.has(key) && <AwayBadge slices={awayCells.get(key) ?? []} tz={tz} tip={awayTip} compact />}
                  {cellItems.map((it) => (
                    <ItemPill key={it.id} item={it} tz={tz} onClick={onItemClick} draggable={droppable} conflict={conflictIds.has(it.id)} />
                  ))}
                  {droppable && (
                    <div className="absolute top-1 end-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100 transition-opacity">
                      {templates.length > 0 && (
                        <TemplateMenu
                          templates={templates}
                          label={`${t("sched.addFromTemplate")}: ${row.name}, ${weekdayLabel(d)} ${d.getDate()}`}
                          onPick={(tpl) => void onTemplateCreate(tpl, resourceId, d)}
                          size="sm"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => onCellClick(resourceId, d)}
                        aria-label={`${t("sched.addItem")}: ${row.name}, ${weekdayLabel(d)} ${d.getDate()}`}
                        className="h-5 w-5 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] flex items-center justify-center"
                      >
                        <PlusIcon size={10} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {rows.length === 1 && (
          <div className="px-6 py-10 text-center text-[12px] text-[var(--text-dim)]">{t("sched.noResources")}</div>
        )}
      </div>
    </div>
  );
}

/** "Add from template" — a small menu button on a schedule cell. */
function TemplateMenu({
  templates,
  label,
  onPick,
  size,
}: {
  templates: PlanningTemplate[];
  label: string;
  onPick: (tpl: PlanningTemplate) => void;
  size: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        (wrapRef.current?.querySelector("button") as HTMLButtonElement | null)?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    // Focus the first entry so the keyboard lands in the menu.
    (wrapRef.current?.querySelector('[role="menuitem"]') as HTMLElement | null)?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const moveFocus = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const list = [...(wrapRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = list.indexOf(document.activeElement as HTMLElement);
    list[(i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length]?.focus();
  };

  return (
    <div ref={wrapRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={
          size === "sm"
            ? "h-5 w-5 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] flex items-center justify-center"
            : "h-7 w-7 rounded-lg border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center shrink-0"
        }
      >
        <LayersIcon size={size === "sm" ? 10 : 12} />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={moveFocus}
          className="kx-glass-pop absolute top-full end-0 mt-1 z-30 w-56 max-h-64 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1 shadow-xl"
        >
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onPick(tpl);
              }}
              className="w-full text-start rounded-lg px-2 py-1.5 flex items-center gap-2 hover:bg-[var(--bg-surface-hover)] focus-visible:bg-[var(--bg-surface-hover)] outline-none"
            >
              <span className="w-1.5 h-6 rounded-full shrink-0" style={{ background: tpl.color ?? ITEM_TYPE_COLOR[tpl.type] }} />
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold text-[var(--text-primary)] truncate">{tpl.name}</span>
                <span className="block text-[10px] tabular-nums text-[var(--text-dim)]">
                  {tpl.start_time}–{tpl.end_time}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Mobile list row — fuller info than ItemPill because it has real width. */
function MobileItemRow({
  item,
  tz,
  onClick,
  conflict = false,
}: {
  item: PlanningItem;
  tz: string;
  onClick: (i: PlanningItem) => void;
  conflict?: boolean;
}) {
  const { t } = useTranslation(planningT);
  const color = item.role?.color ?? ITEM_TYPE_COLOR[item.type];
  const isDraft = item.status === "draft";
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className={`w-full text-start rounded-lg px-2.5 py-2 flex items-center gap-2 transition-opacity hover:opacity-90 ${
        isDraft ? "border border-dashed" : ""
      }${conflict ? " ring-1 ring-red-500/70" : ""}`}
      style={{ background: `${color}22`, borderColor: isDraft ? color : "transparent" }}
    >
      <div className="w-1 h-8 rounded-full shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
          {item.title ? <AutoTranslatedText text={item.title} /> : t(`type.${item.type}`, ITEM_TYPE_LABELS[item.type])}
        </div>
        <div className="text-[10px] text-[var(--text-dim)] truncate">
          {formatRange(item.start_at, item.end_at, tz)}
          {item.role?.name ? ` · ${item.role.name}` : ""}
        </div>
      </div>
    </button>
  );
}

/** Week-grid pill. A focusable role="button" (Enter/Space opens) rather than
 *  a <button>: Firefox will not start a drag from a <button>. */
/* Calendar out-of-office — hatched (AWAY_HATCH), so it never reads as
   leave (amber, solid). The tooltip names only the time span: a Calendar
   event's title is private and never reaches the board. */
function AwayBadge({
  slices,
  tz,
  tip,
  compact = false,
}: {
  slices: AwaySlice[];
  tz: string;
  tip: (slices: AwaySlice[]) => string;
  compact?: boolean;
}) {
  const { t } = useTranslation(planningT);
  const full = slices.some((sl) => sl.full);
  const label = full ? t("sched.outOfOffice") : `${t("sched.outOfOffice")} ${awaySliceRange(slices[0], tz)}${slices.length > 1 ? " +" : ""}`;
  return (
    <span
      title={tip(slices)}
      className={`${compact ? "text-[9px] px-1 py-px self-start" : "text-[10px] px-1.5 py-0.5 inline-block mb-1"} max-w-full truncate font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 border border-dashed border-slate-500/50 rounded cursor-help`}
      style={{ backgroundImage: AWAY_HATCH }}
    >
      {label}
    </span>
  );
}

function ItemPill({
  item,
  tz,
  onClick,
  draggable = false,
  conflict = false,
}: {
  item: PlanningItem;
  tz: string;
  onClick: (i: PlanningItem) => void;
  draggable?: boolean;
  conflict?: boolean;
}) {
  const { t } = useTranslation(planningT);
  const color = item.role?.color ?? ITEM_TYPE_COLOR[item.type];
  const isDraft = item.status === "draft";
  const label = item.title || t(`type.${item.type}`, ITEM_TYPE_LABELS[item.type]);
  return (
    <div
      role="button"
      tabIndex={0}
      data-item-pill
      aria-label={`${label}, ${formatRange(item.start_at, item.end_at, tz)}, ${t(`status.${item.status}`)}`}
      draggable={draggable}
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.id);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(item);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(item);
        }
      }}
      className={`rounded-md px-1.5 py-1 text-[10px] leading-tight cursor-pointer hover:opacity-90 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-[#567FB2]${
        conflict ? " ring-1 ring-red-500/70" : ""
      } ${isDraft ? "border border-dashed" : ""} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={{ background: `${color}22`, borderColor: isDraft ? color : "transparent", color }}
    >
      <div className="font-bold text-[10px] text-[var(--text-primary)] truncate">
        {item.title ? <AutoTranslatedText text={item.title} /> : label}
      </div>
      <div className="text-[9px] opacity-80">
        {formatTime(item.start_at, tz)}–{formatTime(item.end_at, tz)}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   OPEN SHIFTS VIEW
   ══════════════════════════════════════════════════════════════════ */

function OpenShiftsView({
  items,
  tz,
  roles,
  taking,
  canWrite,
  onTake,
  onEdit,
}: {
  items: PlanningItem[];
  tz: string;
  roles: PlanningRole[];
  taking: string | null;
  canWrite: (i: PlanningItem) => boolean;
  onTake: (id: string) => void;
  onEdit: (i: PlanningItem) => void;
}) {
  const { t } = useTranslation(planningT);
  const published = items.filter((i) => i.status === "published");

  if (published.length === 0) {
    return (
      <div className="kx-glass rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] py-14 text-center">
        <div className="text-[13px] text-[var(--text-dim)]">{t("empty.noOpen")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {published.map((i) => {
        const role = roles.find((r) => r.id === i.role_id);
        const label = i.title || t(`type.${i.type}`, ITEM_TYPE_LABELS[i.type]);
        return (
          <div
            key={i.id}
            className="kx-glass rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3 sm:p-4 flex items-center gap-2 sm:gap-3"
          >
            <div className="w-1 h-10 rounded-full shrink-0" style={{ background: role?.color ?? ITEM_TYPE_COLOR[i.type] }} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                {i.title ? <AutoTranslatedText text={i.title} /> : label}
              </div>
              <div className="text-[11px] text-[var(--text-dim)] truncate">
                {formatRange(i.start_at, i.end_at, tz)} · {durationHours(i.start_at, i.end_at)}
                {t("unit.h")}
                {role ? ` · ${role.name}` : ""}
              </div>
            </div>
            {canWrite(i) && (
              <button
                type="button"
                onClick={() => onEdit(i)}
                aria-label={`${t("aria.edit")}: ${label}`}
                title={t("aria.edit")}
                className="h-8 w-8 rounded-lg border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center shrink-0"
              >
                <PencilIcon className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onTake(i.id)}
              disabled={taking !== null}
              aria-busy={taking === i.id}
              className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {taking === i.id ? <SpinnerIcon className="h-3.5 w-3.5" /> : t("btn.take")}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MY PLANNING VIEW — self-serve list
   From seven days ago onwards (not the whole history), capped, and
   refetched whenever the app records a mutation (`version`).
   ══════════════════════════════════════════════════════════════════ */

const MINE_LIMIT = 200;

function MyPlanningView({
  roles,
  version,
  matches,
  onEdit,
  tz,
}: {
  tz: string;
  roles: PlanningRole[];
  version: number;
  matches: (i: PlanningItem) => boolean;
  onEdit: (i: PlanningItem) => void;
}) {
  const { t } = useTranslation(planningT);
  const [state, setState] = useState<{ v: number; items: PlanningItem[] | null; failed: boolean } | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const reqV = version * 1000 + retryTick;

  useEffect(() => {
    let cancelled = false;
    /* Midnight seven days ago on the planner's clock. */
    const since = addDays(plannerNow(tz), -7);
    since.setHours(0, 0, 0, 0);
    fetchItems({ mine: true, start: wallInstant(since, tz).toISOString(), limit: MINE_LIMIT }).then(
      (res) => { if (!cancelled) setState({ v: reqV, items: res, failed: false }); },
      () => { if (!cancelled) setState({ v: reqV, items: null, failed: true }); },
    );
    return () => {
      cancelled = true;
    };
  }, [reqV, tz]);

  /* Keep showing the previous answer while a refetch runs. */
  if (!state) return <CenteredSpinner />;
  if (state.failed) return <ErrorPanel onRetry={() => setRetryTick((n) => n + 1)} />;

  const mine = (state.items ?? []).filter(matches);
  if (mine.length === 0) {
    return (
      <div className="kx-glass rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] py-14 text-center">
        <div className="text-[13px] text-[var(--text-dim)]">{t("empty.noMine")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {mine.map((i) => {
        const role = roles.find((r) => r.id === i.role_id);
        return (
          <button
            type="button"
            key={i.id}
            onClick={() => onEdit(i)}
            className="kx-glass w-full text-start rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 flex items-center gap-3 cursor-pointer hover:bg-[var(--bg-surface-subtle)]"
          >
            <div className="w-1 h-10 rounded-full shrink-0" style={{ background: role?.color ?? ITEM_TYPE_COLOR[i.type] }} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                {i.title ? <AutoTranslatedText text={i.title} /> : t(`type.${i.type}`, ITEM_TYPE_LABELS[i.type])}
              </div>
              <div className="text-[11px] text-[var(--text-dim)] truncate">
                {formatRange(i.start_at, i.end_at, tz)} · {durationHours(i.start_at, i.end_at)}
                {t("unit.h")}
                {role ? ` · ${role.name}` : ""}
              </div>
            </div>
            <StatusBadge status={i.status} />
          </button>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: PlanningItem["status"] }) {
  const { t } = useTranslation(planningT);
  const map: Record<PlanningItem["status"], { key: string; cls: string }> = {
    draft: { key: "badge.draft", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    published: { key: "badge.published", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
    completed: { key: "badge.done", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
    cancelled: { key: "badge.cancelled", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-400" },
  };
  const m = map[status];
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${m.cls}`}>{t(m.key)}</span>;
}
