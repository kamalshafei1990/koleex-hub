"use client";

/* ---------------------------------------------------------------------------
   PlanningApp — universal planning tool (shifts, meetings, production,
   deliveries, maintenance, project tasks, room bookings). Built to mirror
   Odoo Planning semantics in Hub's visual language.

   Five tabs (kept in ?tab=, so a tab is linkable):
     • Schedule       — week grid by resource or role
     • Open Shifts    — published, unassigned items — anyone can Take
     • My Planning    — items on the caller's own resource (last 7 days on)
     • Utilization    — scheduled vs capacity per employee (dynamic chunk)
     • Configuration  — manage roles + non-employee resources (dynamic chunk)
   ?item=<id> opens that item's modal (inbox notifications and the entity
   strips link here).

   DATA. Resources and roles load once per visit through useWarmData (they
   paint from the last answer instantly); only items + leave are keyed by
   week, so week navigation refetches just those two — and the adjacent
   weeks are prefetched into the warm cache. Mutations are optimistic: the
   board updates at once from the local overlay and rolls back with a toast
   if the server refuses. Nothing is swallowed: a failed load shows an error
   with Retry, never an empty week.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import PlanningIcon from "@/components/icons/PlanningIcon";
import PageHeader from "@/components/ui/PageHeader";
import AppHomeMenu from "@/components/ui/AppHomeMenu";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import { useSearchPlaceholder } from "@/lib/searchPlaceholders";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import type { ItemModalPreset } from "@/components/planning/ItemModal";
import { planningErrorKey } from "@/components/planning/planningErrors";
import {
  addDays,
  createItemOrThrow,
  dateKey,
  deleteItem,
  durationHours,
  fetchItem,
  fetchItems,
  fetchLeaves,
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
  type LeaveSpan,
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

type TabId = "schedule" | "open" | "mine" | "utilization" | "config";

/* Strip order — feeds the directional tab motion (kx-tab-fwd / kx-tab-back). */
const TAB_ORDER: TabId[] = ["schedule", "open", "mine", "utilization", "config"];

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

const itemsKeyFor = (weekStart: Date) => `planning:items:${dateKey(weekStart)}`;
const leavesKeyFor = (weekStart: Date) => `planning:leaves:${dateKey(weekStart)}`;
const weekItemsLoader = (weekStart: Date) => () =>
  fetchItems({ start: weekStart.toISOString(), end: addDays(weekStart, 7).toISOString() });
const weekLeavesLoader = (weekStart: Date) => () =>
  fetchLeaves(dateKey(weekStart), dateKey(addDays(weekStart, 6)));

export default function PlanningApp() {
  const { t } = useTranslation(planningT);
  const { isSuperAdmin: isSA } = usePermissions();
  const meId = getCurrentAccountIdSync();
  const { showToast, toastElement } = useToast();
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
  /* Bumped after every successful mutation — My Planning refetches on it. */
  const [version, setVersion] = useState(0);

  const toastError = useCallback((e: unknown) => showToast(t(planningErrorKey(e)), "error"), [showToast, t]);

  /* ── Reference data: resources + roles (not week-keyed) ── */
  const loadResources = useCallback(() => fetchResources(), []);
  const loadRoles = useCallback(() => fetchRoles(), []);
  const resQ = useWarmData<PlanningResource[]>("planning:resources", loadResources);
  const rolesQ = useWarmData<PlanningRole[]>("planning:roles", loadRoles);
  const resources = useMemo(() => resQ.data ?? [], [resQ.data]);
  const roles = useMemo(() => rolesQ.data ?? [], [rolesQ.data]);

  /* ── Week-keyed data: items + leave ── */
  const [anchor, setAnchor] = useState<Date>(() => startOfWeek(new Date()));
  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const itemsKey = itemsKeyFor(weekStart);
  const leavesKey = leavesKeyFor(weekStart);
  const loadItems = useMemo(() => weekItemsLoader(weekStart), [weekStart]);
  const loadLeaves = useMemo(() => weekLeavesLoader(weekStart), [weekStart]);
  const itemsQ = useWarmData<PlanningItem[]>(itemsKey, loadItems, DEFAULT_MAX_AGE_MS, ITEMS_STALE_MS);
  const leavesQ = useWarmData<LeaveSpan[]>(leavesKey, loadLeaves, DEFAULT_MAX_AGE_MS, ITEMS_STALE_MS);
  const leaves = useMemo(() => leavesQ.data ?? [], [leavesQ.data]);

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
      const ik = itemsKeyFor(ws);
      const lk = leavesKeyFor(ws);
      if (warmAge(ik) > ITEMS_STALE_MS) {
        warmedWeeks.current.add(ik);
        weekItemsLoader(ws)().then((v) => writeWarm(ik, v), () => {});
      }
      if (warmAge(lk) > ITEMS_STALE_MS) {
        weekLeavesLoader(ws)().then((v) => writeWarm(lk, v), () => {});
      }
    }
  }, [serverItems, weekStart]);

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
      new Date(it.end_at).getTime() >= weekStart.getTime() && new Date(it.start_at).getTime() < weekEnd.getTime(),
    [weekStart, weekEnd],
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
  useEffect(() => {
    if (deepLinkDone.current) return;
    deepLinkDone.current = true;
    const id = readUrlParam("item");
    if (!id) return;
    fetchItem(id).then(
      (item) => {
        setModal({ open: true, editing: item });
        /* Jump the board to the item's week so it is visible behind the modal. */
        setAnchor(startOfWeek(new Date(item.start_at)));
      },
      (e) => {
        toastError(e);
        writeUrlParams({ item: null });
      },
    );
  }, [toastError]);

  /* ── Mutations ── */
  const handleSave = useCallback(
    async (payload: Partial<PlanningItem> & { start_at: string; end_at: string }) => {
      const editingItem = modal.editing;
      try {
        const saved = editingItem ? await updateItem(editingItem.id, payload) : await createItemOrThrow(payload);
        showItems(replaceItem(items, saved), true);
        setVersion((v) => v + 1);
        closeModal();
        showToast(t("toast.saved"), "success");
      } catch (e) {
        toastError(e);
        throw e; // keep the modal open with the user's edits
      }
    },
    [modal.editing, items, replaceItem, showItems, closeModal, showToast, t, toastError],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const before = items;
      showItems(items.filter((i) => i.id !== id), false);
      try {
        await deleteItem(id);
        showItems(before.filter((i) => i.id !== id), true);
        setVersion((v) => v + 1);
        closeModal();
        showToast(t("toast.deleted"), "success");
      } catch (e) {
        showItems(before, false); // rollback
        toastError(e);
        throw e;
      }
    },
    [items, showItems, closeModal, showToast, t, toastError],
  );

  const [taking, setTaking] = useState<string | null>(null);
  const handleTake = useCallback(
    async (id: string) => {
      if (taking) return;
      setTaking(id);
      try {
        const taken = await takeOpenShift(id);
        showItems(replaceItem(items, taken), true);
        setVersion((v) => v + 1);
        showToast(t("toast.taken"), "success");
      } catch (e) {
        toastError(e);
        /* Someone else got there first / it vanished: show the truth. */
        if (e instanceof PlanningApiError && (e.status === 409 || e.status === 404)) void itemsQ.reload();
      } finally {
        setTaking(null);
      }
    },
    [taking, items, replaceItem, showItems, showToast, t, toastError, itemsQ],
  );

  /** Move a dragged item to a new (resource, day) cell. Keeps the original
   *  time-of-day and duration — only the date and assignee change.
   *  Optimistic: the pill moves at once and snaps back if refused. */
  const handleItemDrop = useCallback(
    async (itemId: string, targetResourceId: string | null, targetDate: Date) => {
      const existing = items.find((i) => i.id === itemId);
      if (!existing) return;
      const oldStart = new Date(existing.start_at);
      const oldEnd = new Date(existing.end_at);
      const durationMs = oldEnd.getTime() - oldStart.getTime();
      // Stamp targetDate's Y/M/D onto old time-of-day.
      const newStart = new Date(targetDate);
      newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), oldStart.getSeconds(), oldStart.getMilliseconds());
      const newEnd = new Date(newStart.getTime() + durationMs);
      // No-op if nothing changed (e.g. dropped on same cell).
      if (dateKey(oldStart) === dateKey(newStart) && existing.resource_id === targetResourceId) return;

      const before = items;
      const patch = {
        start_at: newStart.toISOString(),
        end_at: newEnd.toISOString(),
        resource_id: targetResourceId,
      };
      showItems(replaceItem(items, { ...existing, ...patch }), false);
      try {
        const saved = await updateItem(itemId, patch);
        showItems(replaceItem(before, saved), true);
        setVersion((v) => v + 1);
      } catch (e) {
        showItems(before, false); // rollback
        toastError(e);
      }
    },
    [items, replaceItem, showItems, toastError],
  );

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
                  onPrev={() => setAnchor(addDays(weekStart, -7))}
                  onNext={() => setAnchor(addDays(weekStart, 7))}
                  onToday={() => setAnchor(startOfWeek(new Date()))}
                  onCellClick={(resource_id, date) => setModal({ open: true, editing: null, preset: { resource_id, date } })}
                  onItemClick={openItem}
                  onItemDrop={handleItemDrop}
                />
              ) : tab === "utilization" ? (
                <UtilizationView items={lensItems} resources={resources} leaves={leaves} weekStart={weekStart} />
              ) : tab === "open" ? (
                <OpenShiftsView
                  items={scopedItems.filter((i) => !i.resource_id)}
                  roles={roles}
                  taking={taking}
                  canWrite={canWrite}
                  onTake={handleTake}
                  onEdit={openItem}
                />
              ) : tab === "mine" ? (
                <MyPlanningView roles={roles} version={version} matches={matchesSearch} onEdit={openItem} />
              ) : (
                <ConfigurationView
                  roles={roles}
                  resources={resources}
                  onRolesChanged={rolesQ.reload}
                  onResourcesChanged={resQ.reload}
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
          onClose={closeModal}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
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
  onPrev,
  onNext,
  onToday,
  onCellClick,
  onItemClick,
  onItemDrop,
}: {
  weekStart: Date;
  items: PlanningItem[];
  resources: PlanningResource[];
  roles: PlanningRole[];
  leaves: LeaveSpan[];
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onCellClick: (resource_id: string | null, date: Date) => void;
  onItemClick: (item: PlanningItem) => void;
  onItemDrop: (itemId: string, resourceId: string | null, date: Date) => void | Promise<void>;
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

  /* Every day an item covers, computed once per item. */
  const coveredDays = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const it of items) m.set(it.id, itemDayKeys(it, days));
    return m;
  }, [items, days]);

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
      if ((coveredDays.get(it.id) ?? []).some((dk) => leaveCells.has(`${it.resource_id}|${dk}`))) set.add(it.id);
    }
    return set;
  }, [items, leaveCells, coveredDays]);

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
  const todayKey = dateKey(new Date());
  const todayIdx = dayKeys.indexOf(todayKey);
  const [mobileDay, setMobileDay] = useState<{ week: string; idx: number } | null>(null);
  const weekId = dayKeys[0];
  const mobileDayIdx = mobileDay && mobileDay.week === weekId ? mobileDay.idx : todayIdx >= 0 ? todayIdx : 0;
  const activeDay = days[mobileDayIdx] ?? days[0];
  const activeDayKey = dateKey(activeDay);

  const weekdayLabel = (d: Date) => d.toLocaleDateString(lang, { weekday: "short" });
  const todayCls = "text-[#567FB2] dark:text-[#7FA9D6]";

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

          {groupBy === "resource" && (
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
        </div>
      </div>

      {/* ── Mobile: day pager + single-day list ── */}
      <div className="md:hidden space-y-3">
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
                {cellItems.length > 0 ? (
                  <div className="space-y-1.5">
                    {cellItems.map((it) => (
                      <MobileItemRow key={it.id} item={it} onClick={onItemClick} conflict={conflictIds.has(it.id)} />
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
        className="kx-glass hidden md:block rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden"
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
                  {cellItems.map((it) => (
                    <ItemPill key={it.id} item={it} onClick={onItemClick} draggable={droppable} conflict={conflictIds.has(it.id)} />
                  ))}
                  {droppable && (
                    <button
                      type="button"
                      onClick={() => onCellClick(resourceId, d)}
                      aria-label={`${t("sched.addItem")}: ${row.name}, ${weekdayLabel(d)} ${d.getDate()}`}
                      className="absolute top-1 end-1 h-5 w-5 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                    >
                      <PlusIcon size={10} />
                    </button>
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

/** Mobile list row — fuller info than ItemPill because it has real width. */
function MobileItemRow({
  item,
  onClick,
  conflict = false,
}: {
  item: PlanningItem;
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
          {formatRange(item.start_at, item.end_at)}
          {item.role?.name ? ` · ${item.role.name}` : ""}
        </div>
      </div>
    </button>
  );
}

/** Week-grid pill. A focusable role="button" (Enter/Space opens) rather than
 *  a <button>: Firefox will not start a drag from a <button>. */
function ItemPill({
  item,
  onClick,
  draggable = false,
  conflict = false,
}: {
  item: PlanningItem;
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
      aria-label={`${label}, ${formatRange(item.start_at, item.end_at)}, ${t(`status.${item.status}`)}`}
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
        {formatTime(item.start_at)}–{formatTime(item.end_at)}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   OPEN SHIFTS VIEW
   ══════════════════════════════════════════════════════════════════ */

function OpenShiftsView({
  items,
  roles,
  taking,
  canWrite,
  onTake,
  onEdit,
}: {
  items: PlanningItem[];
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
                {formatRange(i.start_at, i.end_at)} · {durationHours(i.start_at, i.end_at)}
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
}: {
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
    const since = addDays(new Date(), -7);
    since.setHours(0, 0, 0, 0);
    fetchItems({ mine: true, start: since.toISOString(), limit: MINE_LIMIT }).then(
      (res) => { if (!cancelled) setState({ v: reqV, items: res, failed: false }); },
      () => { if (!cancelled) setState({ v: reqV, items: null, failed: true }); },
    );
    return () => {
      cancelled = true;
    };
  }, [reqV]);

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
                {formatRange(i.start_at, i.end_at)} · {durationHours(i.start_at, i.end_at)}
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
