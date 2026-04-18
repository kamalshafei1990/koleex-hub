"use client";

/* ---------------------------------------------------------------------------
   PlanningApp — universal planning tool (shifts, meetings, production,
   deliveries, maintenance, project tasks, room bookings). Built to mirror
   Odoo Planning semantics in Hub's visual language.

   Top tabs:
     • Schedule       — week grid by resource or role
     • Open Shifts    — published, unassigned items — anyone can Take
     • My Planning    — items on the caller's own resource
     • Configuration  — manage roles + non-employee resources
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { planningT } from "@/lib/translations/planning";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import AngleLeftIcon from "@/components/icons/ui/AngleLeftIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import CalendarRawIcon from "@/components/icons/ui/CalendarRawIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import CogIcon from "@/components/icons/ui/CogIcon";
import PaperPlaneIcon from "@/components/icons/ui/PaperPlaneIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PlanningIcon from "@/components/icons/PlanningIcon";
import {
  addDays,
  createItem,
  createResource,
  createRole,
  deleteItem,
  deleteResource,
  deleteRole,
  durationHours,
  fetchItems,
  fetchResources,
  fetchRoles,
  formatRange,
  ITEM_TYPE_COLOR,
  ITEM_TYPE_LABELS,
  publishItem,
  startOfWeek,
  takeOpenShift,
  toLocalDateKey,
  updateItem,
  updateResource,
  updateRole,
  type PlanningItem,
  type PlanningItemType,
  type PlanningResource,
  type PlanningResourceType,
  type PlanningRole,
} from "@/lib/planning";
import { ScrollLockOverlay } from "@/hooks/useScrollLock";

type TabId = "schedule" | "open" | "mine" | "config";

export default function PlanningApp() {
  const { t } = useTranslation(planningT);
  const [tab, setTab] = useState<TabId>("schedule");

  // Shared data — the schedule tab consumes everything, so load it up front.
  const [items, setItems] = useState<PlanningItem[]>([]);
  const [resources, setResources] = useState<PlanningResource[]>([]);
  const [roles, setRoles] = useState<PlanningRole[]>([]);
  const [loading, setLoading] = useState(true);

  const [anchor, setAnchor] = useState<Date>(() => startOfWeek(new Date()));
  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  const [modal, setModal] = useState<{
    open: boolean;
    editing: PlanningItem | null;
    preset?: { resource_id?: string | null; date?: Date };
  }>({ open: false, editing: null });

  const reload = useCallback(async () => {
    const [i, r, ro] = await Promise.all([
      fetchItems({
        start: weekStart.toISOString(),
        end: weekEnd.toISOString(),
      }),
      fetchResources(),
      fetchRoles(),
    ]);
    setItems(i);
    setResources(r);
    setRoles(ro);
  }, [weekStart, weekEnd]);

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [reload]);

  /* ── Handlers passed to children ── */
  const handleSave = useCallback(
    async (payload: Partial<PlanningItem>) => {
      if (modal.editing) {
        await updateItem(modal.editing.id, payload);
      } else {
        await createItem(payload as Partial<PlanningItem> & { start_at: string; end_at: string });
      }
      setModal({ open: false, editing: null });
      await reload();
    },
    [modal.editing, reload],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteItem(id);
      setModal({ open: false, editing: null });
      await reload();
    },
    [reload],
  );

  const handlePublish = useCallback(
    async (id: string) => {
      await publishItem(id);
      await reload();
    },
    [reload],
  );

  const handleTake = useCallback(
    async (id: string) => {
      await takeOpenShift(id);
      await reload();
    },
    [reload],
  );

  return (
    <div
      className="bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden w-full"
      style={{ height: "calc(100dvh - 3.5rem)" }}
    >
      {/* ── Page header ── */}
      <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] z-10 w-full overflow-x-hidden">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 min-w-0">
          <div className="flex flex-wrap items-center gap-3 pt-5 pb-1">
            <Link
              href="/"
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
                <PlanningIcon className="h-4 w-4" />
              </div>
              <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">
                {t("app.title")}
              </h1>
            </div>
            <button
              onClick={() => setModal({ open: true, editing: null })}
              className="h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shrink-0"
            >
              <PlusIcon size={16} />
              <span className="hidden md:inline">{t("action.new")}</span>
            </button>
          </div>
          <p className="text-[12px] text-[var(--text-dim)] mb-3 ml-0 md:ml-11">
            {t("app.subtitle")}
          </p>

          {/* Tabs */}
          <div className="flex items-center gap-1 pb-3 overflow-x-auto scrollbar-none">
            <TabButton
              active={tab === "schedule"}
              onClick={() => setTab("schedule")}
              icon={<CalendarRawIcon size={13} />}
              label={t("tab.schedule")}
            />
            <TabButton
              active={tab === "open"}
              onClick={() => setTab("open")}
              icon={<PaperPlaneIcon size={13} />}
              label={t("tab.openShifts")}
            />
            <TabButton
              active={tab === "mine"}
              onClick={() => setTab("mine")}
              icon={<ClockIcon size={13} />}
              label={t("tab.myPlanning")}
            />
            <TabButton
              active={tab === "config"}
              onClick={() => setTab("config")}
              icon={<CogIcon size={13} />}
              label={t("tab.configuration")}
            />
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-4 min-w-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)] animate-spin" />
            </div>
          ) : tab === "schedule" ? (
            <ScheduleView
              weekStart={weekStart}
              items={items}
              resources={resources}
              roles={roles}
              onPrev={() => setAnchor(addDays(weekStart, -7))}
              onNext={() => setAnchor(addDays(weekStart, 7))}
              onToday={() => setAnchor(startOfWeek(new Date()))}
              onCellClick={(resource_id, date) =>
                setModal({ open: true, editing: null, preset: { resource_id, date } })
              }
              onItemClick={(item) => setModal({ open: true, editing: item })}
            />
          ) : tab === "open" ? (
            <OpenShiftsView
              items={items.filter((i) => !i.resource_id)}
              roles={roles}
              onTake={handleTake}
              onEdit={(item) => setModal({ open: true, editing: item })}
            />
          ) : tab === "mine" ? (
            <MyPlanningView
              resources={resources}
              roles={roles}
              onEdit={(item) => setModal({ open: true, editing: item })}
            />
          ) : (
            <ConfigurationView
              roles={roles}
              resources={resources}
              onReload={reload}
            />
          )}
        </div>
      </div>

      {/* ── Modal ── */}
      <ItemModal
        open={modal.open}
        editing={modal.editing}
        preset={modal.preset}
        resources={resources}
        roles={roles}
        onClose={() => setModal({ open: false, editing: null })}
        onSave={handleSave}
        onDelete={handleDelete}
        onPublish={handlePublish}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TABS
   ══════════════════════════════════════════════════════════════════ */

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-8 px-3 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap border ${
        active
          ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent"
          : "bg-transparent border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
      }`}
    >
      {icon}
      {label}
    </button>
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
  onPrev,
  onNext,
  onToday,
  onCellClick,
  onItemClick,
}: {
  weekStart: Date;
  items: PlanningItem[];
  resources: PlanningResource[];
  roles: PlanningRole[];
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onCellClick: (resource_id: string | null, date: Date) => void;
  onItemClick: (item: PlanningItem) => void;
}) {
  const { t } = useTranslation(planningT);
  const [groupBy, setGroupBy] = useState<"resource" | "role">("resource");
  const [resourceType, setResourceType] = useState<PlanningResourceType | "all">("all");

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const visibleResources = useMemo(() => {
    if (resourceType === "all") return resources.filter((r) => r.is_active);
    return resources.filter((r) => r.is_active && r.type === resourceType);
  }, [resources, resourceType]);

  /* Index items by row key + day key for fast lookup. */
  const byCell = useMemo(() => {
    const map = new Map<string, PlanningItem[]>();
    for (const it of items) {
      const rowKey =
        groupBy === "resource"
          ? it.resource_id ?? "__open__"
          : it.role_id ?? "__none__";
      const dayKey = toLocalDateKey(it.start_at);
      const k = `${rowKey}|${dayKey}`;
      const arr = map.get(k) ?? [];
      arr.push(it);
      map.set(k, arr);
    }
    return map;
  }, [items, groupBy]);

  const rows =
    groupBy === "resource"
      ? [
          {
            id: "__open__",
            name: t("sched.openShiftsRow"),
            sub: t("sched.unassigned"),
            color: null,
          },
          ...visibleResources.map((r) => ({
            id: r.id,
            name: r.name,
            sub: r.description ?? r.type,
            color: r.color,
          })),
        ]
      : [
          {
            id: "__none__",
            name: t("sched.unrolled"),
            sub: t("sched.noRole"),
            color: null,
          },
          ...roles
            .filter((r) => r.is_active)
            .map((r) => ({ id: r.id, name: r.name, sub: null, color: r.color })),
        ];

  const rangeLabel = `${weekStart.toLocaleDateString("en", { month: "short", day: "numeric" })} – ${addDays(weekStart, 6).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}`;

  // Mobile-only: which day is currently in focus. Defaults to today if
  // it's inside the current week, otherwise the first day of the week.
  const todayKey = toLocalDateKey(new Date().toISOString());
  const todayIdx = days.findIndex(
    (d) => toLocalDateKey(d.toISOString()) === todayKey,
  );
  const [mobileDayIdx, setMobileDayIdx] = useState(
    todayIdx >= 0 ? todayIdx : 0,
  );
  useEffect(() => {
    setMobileDayIdx(todayIdx >= 0 ? todayIdx : 0);
  }, [todayIdx, weekStart]);

  const activeDay = days[mobileDayIdx] ?? days[0];

  return (
    <div className="space-y-3">
      {/* Toolbar — stacks on mobile so controls don't cramp */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onPrev}
            className="h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center shrink-0"
          >
            <AngleLeftIcon size={14} />
          </button>
          <button
            onClick={onToday}
            className="h-8 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] shrink-0"
          >
            {t("sched.today")}
          </button>
          <button
            onClick={onNext}
            className="h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center shrink-0"
          >
            <AngleRightIcon size={14} />
          </button>
          <div className="text-[12px] md:text-[13px] font-semibold text-[var(--text-primary)] truncate">
            {rangeLabel}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-0.5">
            {(["resource", "role"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`h-7 px-2.5 rounded-md text-[11px] font-semibold transition-colors ${
                  groupBy === g
                    ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                    : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                }`}
              >
                {t(g === "resource" ? "sched.byResource" : "sched.byRole")}
              </button>
            ))}
          </div>

          {groupBy === "resource" && (
            <select
              value={resourceType}
              onChange={(e) =>
                setResourceType(e.target.value as PlanningResourceType | "all")
              }
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
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-1">
          {days.map((d, i) => {
            const isToday =
              toLocalDateKey(d.toISOString()) === todayKey;
            const isActive = i === mobileDayIdx;
            return (
              <button
                key={i}
                onClick={() => setMobileDayIdx(i)}
                className={`shrink-0 min-w-[44px] py-1.5 rounded-lg text-center transition-all ${
                  isActive
                    ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                    : isToday
                      ? "text-amber-400"
                      : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                }`}
              >
                <div className="text-[9px] font-bold uppercase tracking-wider">
                  {d.toLocaleDateString("en", { weekday: "short" })}
                </div>
                <div className="text-[14px] font-bold leading-tight">
                  {d.getDate()}
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden divide-y divide-[var(--border-subtle)]">
          {rows.map((row) => {
            const key = `${row.id}|${toLocalDateKey(activeDay.toISOString())}`;
            const cellItems = byCell.get(key) ?? [];
            const resourceId = row.id === "__open__" ? null : row.id;
            return (
              <div key={row.id} className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-1 h-5 rounded-full shrink-0"
                    style={{ background: row.color ?? "var(--border-subtle)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                      {row.name}
                    </div>
                    {row.sub && (
                      <div className="text-[10px] text-[var(--text-dim)] truncate capitalize">
                        {row.sub}
                      </div>
                    )}
                  </div>
                  {groupBy === "resource" && (
                    <button
                      onClick={() => onCellClick(resourceId, activeDay)}
                      className="h-7 w-7 rounded-lg border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center shrink-0"
                      aria-label={t("sched.addItem")}
                    >
                      <PlusIcon size={12} />
                    </button>
                  )}
                </div>
                {cellItems.length > 0 ? (
                  <div className="space-y-1.5">
                    {cellItems.map((it) => (
                      <MobileItemRow
                        key={it.id}
                        item={it}
                        onClick={onItemClick}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-[var(--text-dim)] pl-3">
                    {t("sched.nothing")}
                  </div>
                )}
              </div>
            );
          })}
          {rows.length === 1 && (
            <div className="px-6 py-10 text-center text-[12px] text-[var(--text-dim)]">
              {t("sched.noResources")}
            </div>
          )}
        </div>
      </div>

      {/* ── Desktop: full 7-day grid ── */}
      <div className="hidden md:block rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden">
        {/* Header row */}
        <div
          className="grid border-b border-[var(--border-subtle)]"
          style={{ gridTemplateColumns: "220px repeat(7, 1fr)" }}
        >
          <div className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)] border-r border-[var(--border-subtle)]">
            {groupBy === "resource" ? t("sched.resource") : t("sched.role")}
          </div>
          {days.map((d, i) => {
            const isToday =
              toLocalDateKey(d.toISOString()) === todayKey;
            return (
              <div
                key={i}
                className={`px-2 py-2.5 text-center border-r last:border-r-0 border-[var(--border-subtle)] ${
                  isToday ? "bg-amber-500/5" : ""
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                  {d.toLocaleDateString("en", { weekday: "short" })}
                </div>
                <div
                  className={`text-[15px] font-bold ${
                    isToday ? "text-amber-400" : "text-[var(--text-primary)]"
                  }`}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Body rows */}
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid border-b last:border-b-0 border-[var(--border-subtle)]"
            style={{ gridTemplateColumns: "220px repeat(7, 1fr)" }}
          >
            <div className="px-3 py-2 border-r border-[var(--border-subtle)] flex items-center gap-2">
              <div
                className="w-1.5 h-8 rounded-full shrink-0"
                style={{ background: row.color ?? "var(--border-subtle)" }}
              />
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                  {row.name}
                </div>
                {row.sub && (
                  <div className="text-[10px] text-[var(--text-dim)] truncate capitalize">
                    {row.sub}
                  </div>
                )}
              </div>
            </div>
            {days.map((d, i) => {
              const key = `${row.id}|${toLocalDateKey(d.toISOString())}`;
              const cellItems = byCell.get(key) ?? [];
              const resourceId = row.id === "__open__" ? null : row.id;
              return (
                <button
                  key={i}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("[data-item-pill]"))
                      return;
                    if (groupBy !== "resource") return;
                    onCellClick(resourceId, d);
                  }}
                  className="min-h-[70px] p-1.5 border-r last:border-r-0 border-[var(--border-subtle)] text-start hover:bg-[var(--bg-surface-subtle)] transition-colors flex flex-col gap-1"
                >
                  {cellItems.map((it) => (
                    <ItemPill key={it.id} item={it} onClick={onItemClick} />
                  ))}
                </button>
              );
            })}
          </div>
        ))}
        {rows.length === 1 && (
          <div className="px-6 py-10 text-center text-[12px] text-[var(--text-dim)]">
            {t("sched.noResources")}
          </div>
        )}
      </div>
    </div>
  );
}

/** Mobile list row — fuller info than ItemPill because it has real width. */
function MobileItemRow({
  item,
  onClick,
}: {
  item: PlanningItem;
  onClick: (i: PlanningItem) => void;
}) {
  const { t } = useTranslation(planningT);
  const color = item.role?.color ?? ITEM_TYPE_COLOR[item.type];
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" });
  const isDraft = item.status === "draft";
  return (
    <button
      onClick={() => onClick(item)}
      className={`w-full text-start rounded-lg px-2.5 py-2 flex items-center gap-2 transition-opacity hover:opacity-90 ${
        isDraft ? "border border-dashed" : ""
      }`}
      style={{
        background: `${color}22`,
        borderColor: isDraft ? color : "transparent",
      }}
    >
      <div className="w-1 h-8 rounded-full shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
          {item.title || t(`type.${item.type}`, ITEM_TYPE_LABELS[item.type])}
        </div>
        <div className="text-[10px] text-[var(--text-dim)] truncate">
          {fmt(item.start_at)} – {fmt(item.end_at)}
          {item.role?.name ? ` · ${item.role.name}` : ""}
        </div>
      </div>
    </button>
  );
}

function ItemPill({
  item,
  onClick,
}: {
  item: PlanningItem;
  onClick: (i: PlanningItem) => void;
}) {
  const { t } = useTranslation(planningT);
  const color = item.role?.color ?? ITEM_TYPE_COLOR[item.type];
  const start = new Date(item.start_at);
  const end = new Date(item.end_at);
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" });
  const isDraft = item.status === "draft";
  return (
    <div
      data-item-pill
      onClick={(e) => {
        e.stopPropagation();
        onClick(item);
      }}
      className={`rounded-md px-1.5 py-1 text-[10px] leading-tight cursor-pointer hover:opacity-90 transition-opacity ${
        isDraft ? "border border-dashed" : ""
      }`}
      style={{
        background: `${color}22`,
        borderColor: isDraft ? color : "transparent",
        color: color,
      }}
    >
      <div className="font-bold text-[10px] text-[var(--text-primary)] truncate">
        {item.title || t(`type.${item.type}`, ITEM_TYPE_LABELS[item.type])}
      </div>
      <div className="text-[9px] opacity-80">
        {fmt(start)}–{fmt(end)}
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
  onTake,
  onEdit,
}: {
  items: PlanningItem[];
  roles: PlanningRole[];
  onTake: (id: string) => void;
  onEdit: (i: PlanningItem) => void;
}) {
  const { t } = useTranslation(planningT);
  const published = items.filter((i) => i.status === "published");

  if (published.length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] py-14 text-center">
        <div className="text-[13px] text-[var(--text-dim)]">
          {t("empty.noOpen")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {published.map((i) => {
        const role = roles.find((r) => r.id === i.role_id);
        return (
          <div
            key={i.id}
            className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3 sm:p-4 flex items-center gap-2 sm:gap-3"
          >
            <div
              className="w-1 h-10 rounded-full shrink-0"
              style={{ background: role?.color ?? ITEM_TYPE_COLOR[i.type] }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                {i.title || t(`type.${i.type}`, ITEM_TYPE_LABELS[i.type])}
              </div>
              <div className="text-[11px] text-[var(--text-dim)] truncate">
                {formatRange(i.start_at, i.end_at)} ·{" "}
                {durationHours(i.start_at, i.end_at)}h
                {role ? ` · ${role.name}` : ""}
              </div>
            </div>
            <button
              onClick={() => onEdit(i)}
              className="h-8 w-8 rounded-lg border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center shrink-0"
            >
              <PencilIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onTake(i.id)}
              className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90 shrink-0"
            >
              {t("btn.take")}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MY PLANNING VIEW — self-serve list
   ══════════════════════════════════════════════════════════════════ */

function MyPlanningView({
  resources: _resources,
  roles,
  onEdit,
}: {
  resources: PlanningResource[];
  roles: PlanningRole[];
  onEdit: (i: PlanningItem) => void;
}) {
  const { t } = useTranslation(planningT);
  const [mine, setMine] = useState<PlanningItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchItems({ mine: true }).then((res) => {
      setMine(res);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)] animate-spin" />
      </div>
    );
  }

  if (mine.length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] py-14 text-center">
        <div className="text-[13px] text-[var(--text-dim)]">
          {t("empty.noMine")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {mine.map((i) => {
        const role = roles.find((r) => r.id === i.role_id);
        return (
          <div
            key={i.id}
            className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 flex items-center gap-3 cursor-pointer hover:bg-[var(--bg-surface-subtle)]"
            onClick={() => onEdit(i)}
          >
            <div
              className="w-1 h-10 rounded-full shrink-0"
              style={{ background: role?.color ?? ITEM_TYPE_COLOR[i.type] }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                {i.title || t(`type.${i.type}`, ITEM_TYPE_LABELS[i.type])}
              </div>
              <div className="text-[11px] text-[var(--text-dim)] truncate">
                {formatRange(i.start_at, i.end_at)} ·{" "}
                {durationHours(i.start_at, i.end_at)}h
                {role ? ` · ${role.name}` : ""}
              </div>
            </div>
            <StatusBadge status={i.status} />
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: PlanningItem["status"] }) {
  const { t } = useTranslation(planningT);
  const map: Record<PlanningItem["status"], { key: string; bg: string; fg: string }> = {
    draft: { key: "badge.draft", bg: "bg-amber-500/15", fg: "text-amber-400" },
    published: { key: "badge.published", bg: "bg-emerald-500/15", fg: "text-emerald-400" },
    completed: { key: "badge.done", bg: "bg-blue-500/15", fg: "text-blue-400" },
    cancelled: { key: "badge.cancelled", bg: "bg-rose-500/15", fg: "text-rose-400" },
  };
  const m = map[status];
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${m.bg} ${m.fg}`}
    >
      {t(m.key)}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════
   CONFIGURATION VIEW — roles + non-employee resources
   ══════════════════════════════════════════════════════════════════ */

function ConfigurationView({
  roles,
  resources,
  onReload,
}: {
  roles: PlanningRole[];
  resources: PlanningResource[];
  onReload: () => Promise<void>;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <RoleConfig roles={roles} onReload={onReload} />
      <ResourceConfig resources={resources} onReload={onReload} />
    </div>
  );
}

function RoleConfig({
  roles,
  onReload,
}: {
  roles: PlanningRole[];
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation(planningT);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#60a5fa");

  const add = async () => {
    if (!name.trim()) return;
    await createRole({ name: name.trim(), color });
    setName("");
    await onReload();
  };

  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <UsersIcon size={14} className="text-[var(--text-dim)]" />
        <h3 className="text-[13px] font-bold text-[var(--text-primary)]">
          {t("cfg.roles.title")}
        </h3>
      </div>
      <p className="text-[11px] text-[var(--text-dim)]">{t("cfg.roles.help")}</p>

      <div className="flex items-center gap-2">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-9 w-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] cursor-pointer"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("cfg.roles.placeholder")}
          className="flex-1 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none"
        />
        <button
          onClick={add}
          className="h-9 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90"
        >
          {t("btn.add")}
        </button>
      </div>

      <div className="space-y-1.5 pt-1">
        {roles.map((r) => (
          <RoleRow key={r.id} role={r} onReload={onReload} />
        ))}
        {roles.length === 0 && (
          <div className="text-[12px] text-[var(--text-dim)] py-3">
            {t("cfg.roles.empty")}
          </div>
        )}
      </div>
    </div>
  );
}

function RoleRow({
  role,
  onReload,
}: {
  role: PlanningRole;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation(planningT);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(role.name);
  const [color, setColor] = useState(role.color ?? "#60a5fa");

  const save = async () => {
    await updateRole(role.id, { name, color });
    setEditing(false);
    await onReload();
  };
  const remove = async () => {
    if (!confirm(t("cfg.roles.deleteConfirm"))) return;
    await deleteRole(role.id);
    await onReload();
  };

  return (
    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
      {editing ? (
        <>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-7 w-8 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 h-7 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none"
          />
          <button
            onClick={save}
            className="h-7 px-2.5 rounded-md bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[11px] font-semibold"
          >
            {t("btn.save")}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center"
          >
            <CrossIcon size={12} />
          </button>
        </>
      ) : (
        <>
          <div
            className="w-2 h-6 rounded-full"
            style={{ background: role.color ?? "var(--border-subtle)" }}
          />
          <div className="flex-1 text-[12px] font-semibold text-[var(--text-primary)]">
            {role.name}
          </div>
          <button
            onClick={() => setEditing(true)}
            className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center"
          >
            <PencilIcon className="h-3 w-3" />
          </button>
          <button
            onClick={remove}
            className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-rose-400 flex items-center justify-center"
          >
            <TrashIcon className="h-3 w-3" />
          </button>
        </>
      )}
    </div>
  );
}

function ResourceConfig({
  resources,
  onReload,
}: {
  resources: PlanningResource[];
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation(planningT);
  const [type, setType] = useState<PlanningResourceType>("room");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const add = async () => {
    if (!name.trim()) return;
    await createResource({ type, name: name.trim(), description: description.trim() || null });
    setName("");
    setDescription("");
    await onReload();
  };

  const nonEmployeeRes = resources.filter((r) => r.type !== "employee");

  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CogIcon size={14} className="text-[var(--text-dim)]" />
        <h3 className="text-[13px] font-bold text-[var(--text-primary)]">
          {t("cfg.resources.title")}
        </h3>
      </div>
      <p className="text-[11px] text-[var(--text-dim)]">
        {t("cfg.resources.help")}
      </p>

      <div className="grid grid-cols-[90px_1fr_auto] sm:grid-cols-[110px_1fr_auto] gap-1.5 sm:gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as PlanningResourceType)}
          className="h-9 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] min-w-0"
        >
          <option value="room">{t("cfg.resources.type.room")}</option>
          <option value="vehicle">{t("cfg.resources.type.vehicle")}</option>
          <option value="material">{t("cfg.resources.type.material")}</option>
          <option value="other">{t("cfg.resources.type.other")}</option>
        </select>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("cfg.resources.placeholder")}
          className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none min-w-0"
        />
        <button
          onClick={add}
          className="h-9 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90"
        >
          {t("btn.add")}
        </button>
      </div>

      <div className="space-y-1.5 pt-1">
        {nonEmployeeRes.map((r) => (
          <ResourceRow key={r.id} resource={r} onReload={onReload} />
        ))}
        {nonEmployeeRes.length === 0 && (
          <div className="text-[12px] text-[var(--text-dim)] py-3">
            {t("cfg.resources.empty")}
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-[var(--border-subtle)]">
        <div className="text-[11px] text-[var(--text-dim)] mb-1">
          {t("cfg.resources.syncedLabel")}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {resources
            .filter((r) => r.type === "employee")
            .map((r) => (
              <span
                key={r.id}
                className="px-2 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)]"
              >
                {r.name}
              </span>
            ))}
          {resources.filter((r) => r.type === "employee").length === 0 && (
            <span className="text-[11px] text-[var(--text-dim)]">
              {t("cfg.resources.syncedEmpty")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ResourceRow({
  resource,
  onReload,
}: {
  resource: PlanningResource;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation(planningT);
  const remove = async () => {
    if (!confirm(t("cfg.resources.deleteConfirm"))) return;
    await deleteResource(resource.id);
    await onReload();
  };
  const rename = async () => {
    const next = prompt(t("cfg.resources.renamePrompt"), resource.name);
    if (!next || next === resource.name) return;
    await updateResource(resource.id, { name: next });
    await onReload();
  };
  return (
    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
      <span className="px-1.5 py-0.5 rounded-md bg-[var(--bg-surface)] text-[9px] uppercase tracking-wider font-bold text-[var(--text-dim)] border border-[var(--border-subtle)]">
        {resource.type}
      </span>
      <div className="flex-1 text-[12px] font-semibold text-[var(--text-primary)] truncate">
        {resource.name}
      </div>
      <button
        onClick={rename}
        className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center"
      >
        <PencilIcon className="h-3 w-3" />
      </button>
      <button
        onClick={remove}
        className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-rose-400 flex items-center justify-center"
      >
        <TrashIcon className="h-3 w-3" />
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ITEM MODAL — create / edit any kind of planning item
   ══════════════════════════════════════════════════════════════════ */

function ItemModal({
  open,
  editing,
  preset,
  resources,
  roles,
  onClose,
  onSave,
  onDelete,
  onPublish,
}: {
  open: boolean;
  editing: PlanningItem | null;
  preset?: { resource_id?: string | null; date?: Date };
  resources: PlanningResource[];
  roles: PlanningRole[];
  onClose: () => void;
  onSave: (payload: Partial<PlanningItem>) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onPublish: (id: string) => void | Promise<void>;
}) {
  const { t } = useTranslation(planningT);
  const [type, setType] = useState<PlanningItemType>("shift");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [resourceId, setResourceId] = useState<string>("");
  const [roleId, setRoleId] = useState<string>("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [linkedType, setLinkedType] = useState<string>("");
  const [linkedLabel, setLinkedLabel] = useState<string>("");
  const [status, setStatus] = useState<PlanningItem["status"]>("draft");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.type);
      setTitle(editing.title);
      setNotes(editing.notes ?? "");
      setResourceId(editing.resource_id ?? "");
      setRoleId(editing.role_id ?? "");
      setStartAt(toDTLocal(editing.start_at));
      setEndAt(toDTLocal(editing.end_at));
      setLinkedType(editing.linked_entity_type ?? "");
      setLinkedLabel(editing.linked_entity_label ?? "");
      setStatus(editing.status);
    } else {
      setType("shift");
      setTitle("");
      setNotes("");
      setResourceId(preset?.resource_id ?? "");
      setRoleId("");
      const base = preset?.date ?? new Date();
      const startD = new Date(base);
      startD.setHours(9, 0, 0, 0);
      const endD = new Date(base);
      endD.setHours(17, 0, 0, 0);
      setStartAt(toDTLocal(startD.toISOString()));
      setEndAt(toDTLocal(endD.toISOString()));
      setLinkedType("");
      setLinkedLabel("");
      setStatus("draft");
    }
  }, [open, editing, preset]);

  if (!open) return null;

  const save = () => {
    if (!startAt || !endAt) return;
    onSave({
      type,
      title: title.trim(),
      notes: notes.trim() || null,
      resource_id: resourceId || null,
      role_id: roleId || null,
      start_at: new Date(startAt).toISOString(),
      end_at: new Date(endAt).toISOString(),
      linked_entity_type: linkedType || null,
      linked_entity_label: linkedLabel.trim() || null,
      status,
    });
  };

  return (
    <ScrollLockOverlay className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-[var(--border-color)] shrink-0">
          <h2 className="text-[15px] font-bold text-[var(--text-primary)]">
            {editing ? t("modal.edit") : t("modal.new")}
          </h2>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center"
          >
            <CrossIcon size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 sm:px-5 py-4 space-y-3 overflow-y-auto">
          {/* Type + Title */}
          <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as PlanningItemType)}
              className="h-10 px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)]"
            >
              {(Object.keys(ITEM_TYPE_LABELS) as PlanningItemType[]).map((k) => (
                <option key={k} value={k}>
                  {t(`type.${k}`, ITEM_TYPE_LABELS[k])}
                </option>
              ))}
            </select>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("modal.titlePlaceholder")}
              className="h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none"
            />
          </div>

          {/* Resource + Role */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label={t("modal.resource")}>
              <select
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                className="w-full h-10 px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)]"
              >
                <option value="">{t("modal.unassignedOption")}</option>
                {(["employee", "room", "vehicle", "material", "other"] as const).map(
                  (typ) => {
                    const rs = resources.filter(
                      (r) => r.is_active && r.type === typ,
                    );
                    if (!rs.length) return null;
                    const labelKey =
                      typ === "employee"
                        ? "sched.employees"
                        : typ === "room"
                          ? "cfg.resources.type.room"
                          : typ === "vehicle"
                            ? "cfg.resources.type.vehicle"
                            : typ === "material"
                              ? "cfg.resources.type.material"
                              : "cfg.resources.type.other";
                    return (
                      <optgroup key={typ} label={t(labelKey).toUpperCase()}>
                        {rs.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  },
                )}
              </select>
            </Field>
            <Field label={t("modal.role")}>
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="w-full h-10 px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)]"
              >
                <option value="">{t("modal.noneOption")}</option>
                {roles
                  .filter((r) => r.is_active)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </Field>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label={t("modal.start")}>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full h-10 px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none"
              />
            </Field>
            <Field label={t("modal.end")}>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full h-10 px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none"
              />
            </Field>
          </div>

          {/* Linked entity — free-form for now; a picker is easy to add later. */}
          <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
            <select
              value={linkedType}
              onChange={(e) => setLinkedType(e.target.value)}
              className="h-10 px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)]"
            >
              <option value="">{t("modal.notLinked")}</option>
              <option value="customer">{t("linked.customer")}</option>
              <option value="supplier">{t("linked.supplier")}</option>
              <option value="project">{t("linked.project")}</option>
              <option value="product">{t("linked.product")}</option>
              <option value="quotation">{t("linked.quotation")}</option>
              <option value="invoice">{t("linked.invoice")}</option>
              <option value="other">{t("linked.other")}</option>
            </select>
            <input
              value={linkedLabel}
              onChange={(e) => setLinkedLabel(e.target.value)}
              placeholder={t("modal.linkedLabelPlaceholder")}
              className="h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none"
            />
          </div>

          {/* Notes */}
          <Field label={t("modal.notes")}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none resize-none"
            />
          </Field>

          {/* Status */}
          <Field label={t("modal.status")}>
            <div className="flex gap-1.5 flex-wrap">
              {(["draft", "published", "completed", "cancelled"] as const).map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`h-8 px-3 rounded-lg text-[11px] font-semibold border transition-colors ${
                      status === s
                        ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent"
                        : "bg-[var(--bg-surface)] text-[var(--text-dim)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {t(`status.${s}`)}
                  </button>
                ),
              )}
            </div>
          </Field>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-t border-[var(--border-color)] shrink-0">
          <div className="shrink-0">
            {editing && (
              <button
                onClick={() => {
                  if (confirm(t("modal.deleteConfirm"))) onDelete(editing.id);
                }}
                className="h-9 px-2.5 sm:px-3 rounded-lg text-rose-400 hover:bg-rose-500/10 text-[12px] font-semibold flex items-center gap-1.5"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("btn.delete")}</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {editing && editing.status === "draft" && (
              <button
                onClick={() => onPublish(editing.id)}
                className="h-9 px-2.5 sm:px-3 rounded-lg border border-emerald-500/40 text-emerald-400 text-[12px] font-semibold hover:bg-emerald-500/10"
              >
                {t("btn.publish")}
              </button>
            )}
            <button
              onClick={onClose}
              className="h-9 px-2.5 sm:px-3 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] text-[12px] font-semibold"
            >
              {t("btn.cancel")}
            </button>
            <button
              onClick={save}
              className="h-9 px-3 sm:px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90"
            >
              {editing ? t("btn.save") : t("btn.create")}
            </button>
          </div>
        </div>
      </div>
    </ScrollLockOverlay>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
        {label}
      </div>
      {children}
    </div>
  );
}

/** ISO → `<input type="datetime-local">` value using the user's local TZ. */
function toDTLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
