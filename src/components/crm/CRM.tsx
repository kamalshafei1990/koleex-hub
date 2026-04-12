"use client";

/* ---------------------------------------------------------------------------
   CRM — pipeline of opportunities, modeled after Odoo CRM but rendered
   in the Koleex Hub design language.

   What's in v1:
     · Pipeline kanban view with drag-and-drop between stages
     · List view (sortable rows, search, filter)
     · Opportunity create/edit modal with full form
     · Activities pinned to an opportunity (call/meeting/task/email/note)
     · Mark won / lost flow with reason capture
     · Pipeline summary strip (active, weighted forecast, won this month)

   Architecture:
     · Single client component (matches the convention from
       ProductList.tsx and Contacts.tsx)
     · Pipeline state lives in `opps` + `stages` + `loading`
     · Data layer is lib/crm.ts; we never call supabase directly here
     · Modal state is `editingId | "new" | null`
     · The detail panel (right rail) lives in the same modal so the
       user can see activities + form side-by-side without a route
   --------------------------------------------------------------------------- */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  Activity,
  Archive,
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Filter,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  Star,
  Trash2,
  TrendingUp,
  User as UserIcon,
  Users,
  X,
  XCircle,
} from "lucide-react";
import {
  archiveOpportunity,
  completeActivity,
  createActivity,
  createOpportunity,
  deleteActivity,
  deleteOpportunity,
  fetchActivities,
  fetchOpportunities,
  fetchStages,
  markOpportunityLost,
  moveOpportunityToStage,
  reopenActivity,
  summarizePipeline,
  updateOpportunity,
} from "@/lib/crm";
import { useCurrentAccount } from "@/lib/identity";
import { useTranslation } from "@/lib/i18n";
import { crmT } from "@/lib/translations/crm";
import type {
  CrmActivityRow,
  CrmActivityType,
  CrmOpportunityWithRelations,
  CrmStageRow,
} from "@/types/supabase";

/* ════════════════════════════════════════════════════════════════════════
   Helpers
   ════════════════════════════════════════════════════════════════════════ */

function formatCurrency(value: number): string {
  if (!value || Number.isNaN(value)) return "$0";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${Math.round(value).toLocaleString()}`;
}

function formatCurrencyFull(value: number): string {
  if (!value || Number.isNaN(value)) return "$0.00";
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function relativeDate(iso: string | null): {
  label: string;
  tone: "neutral" | "soon" | "overdue";
} {
  if (!iso) return { label: "—", tone: "neutral" };
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return { label: "—", tone: "neutral" };
  const now = Date.now();
  const diffDays = Math.round((then - now) / 86_400_000);
  if (diffDays < 0)
    return { label: `${Math.abs(diffDays)}d overdue`, tone: "overdue" };
  if (diffDays === 0) return { label: "Today", tone: "soon" };
  if (diffDays === 1) return { label: "Tomorrow", tone: "soon" };
  if (diffDays <= 7) return { label: `In ${diffDays}d`, tone: "soon" };
  return {
    label: new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    tone: "neutral",
  };
}

/* Odoo CRM uses a 12-color palette to tag deals; we keep the same swatch
   indices but render them with our own border-friendly hex values. */
const SWATCH_COLORS = [
  "#94a3b8", // 0 — slate
  "#ef4444", // 1 — red
  "#f97316", // 2 — orange
  "#f59e0b", // 3 — amber
  "#84cc16", // 4 — lime
  "#10b981", // 5 — emerald
  "#06b6d4", // 6 — cyan
  "#3b82f6", // 7 — blue
  "#8b5cf6", // 8 — violet
  "#d946ef", // 9 — fuchsia
  "#ec4899", // 10 — pink
  "#f43f5e", // 11 — rose
];

/* ════════════════════════════════════════════════════════════════════════
   Main component
   ════════════════════════════════════════════════════════════════════════ */

export default function CRM() {
  const { account } = useCurrentAccount();
  const accountId = account?.id ?? null;
  const { t } = useTranslation(crmT);

  const [stages, setStages] = useState<CrmStageRow[]>([]);
  const [opps, setOpps] = useState<CrmOpportunityWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  /* View toggle: Pipeline kanban (default) or List. */
  const [viewMode, setViewMode] = useState<"pipeline" | "list">("pipeline");

  /* "My pipeline" filters down to opportunities owned by the current
     user. Off by default so the team-wide picture is visible first. */
  const [myOnly, setMyOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterStageId, setFilterStageId] = useState("");
  const [filterPriority, setFilterPriority] = useState("");

  /* Modal state. `null` = closed, `"new"` = create blank, otherwise
     editing the opportunity with the given id. */
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  /* Drag-drop state for the kanban. We track the dragged opportunity
     id so the drop handler knows what to move; the highlighted column
     id drives the drop-target visual cue. */
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverStageId, setHoverStageId] = useState<string | null>(null);

  /* Initial load. Stages + opportunities in parallel because they're
     independent queries; we only block UI on the slower of the two. */
  const reload = useCallback(async () => {
    setLoading(true);
    const [s, o] = await Promise.all([fetchStages(), fetchOpportunities()]);
    setStages(s);
    setOpps(o);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /* Filtered list — applies search + my-only + stage + priority. */
  const filteredOpps = useMemo(() => {
    return opps.filter((o) => {
      if (myOnly && accountId && o.owner_account_id !== accountId)
        return false;
      if (filterStageId && o.stage_id !== filterStageId) return false;
      if (filterPriority && String(o.priority) !== filterPriority)
        return false;
      if (search.trim().length > 0) {
        const q = search.trim().toLowerCase();
        const haystack = [
          o.name,
          o.company_name,
          o.contact_name,
          o.email,
          o.contact?.display_name,
          o.contact?.company,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [opps, myOnly, accountId, filterStageId, filterPriority, search]);

  const summary = useMemo(
    () => summarizePipeline(filteredOpps),
    [filteredOpps],
  );

  /* Group by stage for the kanban. We always render every stage, even
     empty ones, so columns don't disappear when filters narrow the
     dataset (matches Odoo behavior). */
  const oppsByStage = useMemo(() => {
    const map = new Map<string, CrmOpportunityWithRelations[]>();
    for (const stage of stages) map.set(stage.id, []);
    /* Bucket for opportunities with no stage (data quality fallback). */
    map.set("__nostage__", []);
    for (const o of filteredOpps) {
      const key = o.stage_id ?? "__nostage__";
      const list = map.get(key) ?? [];
      list.push(o);
      map.set(key, list);
    }
    return map;
  }, [filteredOpps, stages]);

  /* ── Drag and drop ──────────────────────────────────────────────── */
  const handleDragStart = (id: string) => setDraggingId(id);
  const handleDragEnd = () => {
    setDraggingId(null);
    setHoverStageId(null);
  };
  const handleDragOver = (e: DragEvent, stageId: string) => {
    e.preventDefault();
    if (hoverStageId !== stageId) setHoverStageId(stageId);
  };
  const handleDrop = async (e: DragEvent, stageId: string) => {
    e.preventDefault();
    const id = draggingId;
    setDraggingId(null);
    setHoverStageId(null);
    if (!id) return;
    const opp = opps.find((o) => o.id === id);
    if (!opp || opp.stage_id === stageId) return;
    const stage = stages.find((s) => s.id === stageId);
    /* Optimistic local update so the card jumps immediately. */
    setOpps((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              stage_id: stageId,
              stage: stage ?? null,
              won_at: stage?.is_won ? new Date().toISOString() : o.won_at,
              probability: stage?.is_won ? 100 : o.probability,
            }
          : o,
      ),
    );
    await moveOpportunityToStage({
      opportunityId: id,
      stageId,
      isWonStage: stage?.is_won ?? false,
    });
  };

  /* ── Modal save handler ─────────────────────────────────────────── */
  const handleClose = () => setEditingId(null);
  const handleSaved = async () => {
    setEditingId(null);
    await reload();
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        {/* ─ Header strip ─ */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-xl md:text-[26px] font-bold text-[var(--text-primary)] tracking-tight">
              {t("title")}
            </h1>
            <p className="text-[12.5px] md:text-[13px] text-[var(--text-dim)] mt-0.5">
              {t("subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditingId("new")}
            className="inline-flex items-center gap-2 h-10 px-4 md:px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all"
          >
            <Plus className="h-4 w-4" />
            {t("newOpp")}
          </button>
        </div>

        {/* ─ Summary strip ─ */}
        <SummaryStrip summary={summary} t={t} />

        {/* ─ Toolbar ─ */}
        <div className="mt-5 mb-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-[420px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-ghost)] pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search")}
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-colors"
            />
          </div>

          {/* My pipeline toggle */}
          <button
            type="button"
            onClick={() => setMyOnly((v) => !v)}
            disabled={!accountId}
            className={`inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border text-[12.5px] font-semibold transition-colors disabled:opacity-50 ${
              myOnly
                ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-[var(--bg-inverted)]"
                : "bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-focus)]"
            }`}
          >
            <UserIcon className="h-3.5 w-3.5" />
            {myOnly ? t("myPipeline") : t("allPipeline")}
          </button>

          {/* Filter toggle */}
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border text-[12.5px] font-semibold transition-colors ${
              showFilters || filterStageId || filterPriority
                ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-[var(--bg-inverted)]"
                : "bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-focus)]"
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            {t("filters")}
            {(filterStageId || filterPriority) && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-white/20 text-[10px] font-bold">
                {[filterStageId, filterPriority].filter(Boolean).length}
              </span>
            )}
          </button>

          {/* View switcher */}
          <div className="ml-auto inline-flex items-center h-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-1 gap-0.5">
            <button
              type="button"
              onClick={() => setViewMode("pipeline")}
              className={`h-8 px-3 rounded-lg text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors ${
                viewMode === "pipeline"
                  ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                  : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              {t("view.pipeline")}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`h-8 px-3 rounded-lg text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors ${
                viewMode === "list"
                  ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                  : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              }`}
            >
              <ListIcon className="h-3.5 w-3.5" />
              {t("view.list")}
            </button>
          </div>
        </div>

        {/* ─ Filter panel ─ */}
        {showFilters && (
          <div className="mb-4 p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">
                {t("form.stage")}
              </label>
              <select
                value={filterStageId}
                onChange={(e) => setFilterStageId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] [color-scheme:dark]"
              >
                <option value="">All</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">
                {t("form.priority")}
              </label>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] [color-scheme:dark]"
              >
                <option value="">All</option>
                <option value="0">★</option>
                <option value="1">★★</option>
                <option value="2">★★★</option>
                <option value="3">★★★★</option>
              </select>
            </div>
            <div className="md:col-span-2 lg:col-span-2 flex items-end justify-end">
              <button
                type="button"
                onClick={() => {
                  setFilterStageId("");
                  setFilterPriority("");
                }}
                className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-[12px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Clear filters
              </button>
            </div>
          </div>
        )}

        {/* ─ Body ─ */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--text-dim)]" />
          </div>
        ) : opps.length === 0 ? (
          <EmptyState onCreate={() => setEditingId("new")} t={t} />
        ) : viewMode === "pipeline" ? (
          <PipelineView
            stages={stages}
            oppsByStage={oppsByStage}
            draggingId={draggingId}
            hoverStageId={hoverStageId}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onCardClick={(id) => setEditingId(id)}
            t={t}
          />
        ) : (
          <ListView
            opps={filteredOpps}
            onRowClick={(id) => setEditingId(id)}
            t={t}
          />
        )}
      </div>

      {/* ─ Modal ─ */}
      {editingId !== null && (
        <OpportunityModal
          opportunity={
            editingId === "new"
              ? null
              : opps.find((o) => o.id === editingId) ?? null
          }
          stages={stages}
          accountId={accountId}
          onClose={handleClose}
          onSaved={handleSaved}
          t={t}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Summary strip
   ════════════════════════════════════════════════════════════════════════ */

function SummaryStrip({
  summary,
  t,
}: {
  summary: ReturnType<typeof summarizePipeline>;
  t: (key: string) => string;
}) {
  const cards = [
    {
      label: t("summary.active"),
      value: String(summary.totalActive),
      icon: <TrendingUp className="h-4 w-4" />,
      tone: "default" as const,
    },
    {
      label: t("summary.weighted"),
      value: formatCurrency(summary.weightedForecast),
      icon: <Activity className="h-4 w-4" />,
      tone: "default" as const,
    },
    {
      label: t("summary.pipeline"),
      value: formatCurrency(summary.totalRevenue),
      icon: <LayoutGrid className="h-4 w-4" />,
      tone: "default" as const,
    },
    {
      label: t("summary.wonMonth"),
      value: formatCurrency(summary.wonThisMonthValue),
      sub: `${summary.wonThisMonthCount} deals`,
      icon: <CheckCircle2 className="h-4 w-4" />,
      tone: "won" as const,
    },
    {
      label: t("summary.lostMonth"),
      value: String(summary.lostThisMonthCount),
      icon: <XCircle className="h-4 w-4" />,
      tone: "lost" as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`p-4 rounded-2xl border ${
            c.tone === "won"
              ? "bg-emerald-500/[0.06] border-emerald-500/20"
              : c.tone === "lost"
                ? "bg-red-500/[0.05] border-red-500/15"
                : "bg-[var(--bg-secondary)] border-[var(--border-subtle)]"
          }`}
        >
          <div
            className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider mb-1.5 ${
              c.tone === "won"
                ? "text-emerald-500"
                : c.tone === "lost"
                  ? "text-red-500"
                  : "text-[var(--text-dim)]"
            }`}
          >
            {c.icon}
            {c.label}
          </div>
          <div
            className={`text-[20px] md:text-[22px] font-bold leading-tight ${
              c.tone === "won"
                ? "text-emerald-500"
                : c.tone === "lost"
                  ? "text-red-500"
                  : "text-[var(--text-primary)]"
            }`}
          >
            {c.value}
          </div>
          {c.sub && (
            <div className="text-[10.5px] text-[var(--text-ghost)] mt-0.5">
              {c.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Empty state
   ════════════════════════════════════════════════════════════════════════ */

function EmptyState({
  onCreate,
  t,
}: {
  onCreate: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-16 text-center">
      <div className="h-14 w-14 rounded-2xl bg-[var(--bg-surface-subtle)] flex items-center justify-center mx-auto mb-4">
        <TrendingUp className="h-6 w-6 text-[var(--text-barely)]" />
      </div>
      <p className="text-[var(--text-primary)] text-[15px] font-semibold">
        {t("empty.all")}
      </p>
      <p className="text-[var(--text-ghost)] text-[13px] mt-1">
        {t("empty.allHint")}
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex items-center gap-2 mt-5 h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all"
      >
        <Plus className="h-4 w-4" />
        {t("newOpp")}
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Pipeline view (kanban)
   ════════════════════════════════════════════════════════════════════════ */

function PipelineView({
  stages,
  oppsByStage,
  draggingId,
  hoverStageId,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onCardClick,
  t,
}: {
  stages: CrmStageRow[];
  oppsByStage: Map<string, CrmOpportunityWithRelations[]>;
  draggingId: string | null;
  hoverStageId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent, stageId: string) => void;
  onDrop: (e: DragEvent, stageId: string) => void;
  onCardClick: (id: string) => void;
  t: (key: string) => string;
}) {
  /* The "no stage" bucket only renders if it has anything in it — no
     point in showing an empty trash column. */
  const noStageRows = oppsByStage.get("__nostage__") ?? [];
  const allColumns: Array<{ id: string; name: string; isWon: boolean }> = [
    ...stages.map((s) => ({ id: s.id, name: s.name, isWon: s.is_won })),
  ];
  if (noStageRows.length > 0) {
    allColumns.push({ id: "__nostage__", name: "Unassigned", isWon: false });
  }

  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 overflow-x-auto pb-4">
      <div className="flex gap-3 md:gap-4 min-w-min">
        {allColumns.map((col) => {
          const list = oppsByStage.get(col.id) ?? [];
          const total = list.reduce(
            (acc, o) => acc + (Number(o.expected_revenue) || 0),
            0,
          );
          const isHover = hoverStageId === col.id;
          return (
            <div
              key={col.id}
              onDragOver={(e) => onDragOver(e, col.id)}
              onDrop={(e) => onDrop(e, col.id)}
              className={`w-[280px] md:w-[300px] shrink-0 rounded-2xl border transition-colors ${
                isHover
                  ? "bg-[var(--bg-secondary)] border-[var(--border-focus)]"
                  : "bg-[var(--bg-secondary)] border-[var(--border-subtle)]"
              }`}
            >
              {/* Column header */}
              <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      col.isWon ? "bg-emerald-500" : "bg-[var(--text-ghost)]"
                    }`}
                  />
                  <span className="text-[12.5px] font-bold text-[var(--text-primary)] truncate uppercase tracking-wide">
                    {col.name}
                  </span>
                  <span className="text-[10.5px] font-semibold text-[var(--text-ghost)]">
                    {list.length}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-[var(--text-dim)] tabular-nums">
                  {formatCurrency(total)}
                </span>
              </div>

              {/* Cards */}
              <div className="px-3 pb-3 space-y-2 min-h-[80px]">
                {list.length === 0 ? (
                  <div className="text-[11px] text-[var(--text-ghost)] text-center py-6 italic">
                    {t("empty.pipeline")}
                  </div>
                ) : (
                  list.map((o) => (
                    <OpportunityCard
                      key={o.id}
                      opportunity={o}
                      isDragging={draggingId === o.id}
                      onDragStart={() => onDragStart(o.id)}
                      onDragEnd={onDragEnd}
                      onClick={() => onCardClick(o.id)}
                      t={t}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Opportunity card (kanban tile)
   ════════════════════════════════════════════════════════════════════════ */

function OpportunityCard({
  opportunity,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
  t,
}: {
  opportunity: CrmOpportunityWithRelations;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
  t: (key: string) => string;
}) {
  const o = opportunity;
  const due = relativeDate(o.expected_close_date);
  const swatch = SWATCH_COLORS[o.color] ?? SWATCH_COLORS[0];
  const stars = Math.max(0, Math.min(3, o.priority));
  const customerLine =
    o.contact?.display_name ||
    o.contact_name ||
    o.contact?.company ||
    o.company_name ||
    "—";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`group relative p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] cursor-grab active:cursor-grabbing hover:border-[var(--border-focus)] hover:shadow-md transition-all ${
        isDragging ? "opacity-30" : "opacity-100"
      }`}
    >
      {/* Color swatch stripe */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ backgroundColor: swatch }}
      />

      {/* Title */}
      <div className="pl-1 mb-1.5 flex items-start justify-between gap-2">
        <div className="text-[13px] font-semibold text-[var(--text-primary)] leading-snug line-clamp-2 flex-1">
          {o.name}
        </div>
        {o.activities_overdue > 0 && (
          <span
            title={`${o.activities_overdue} ${t("card.activitiesOverdue")}`}
            className="inline-flex items-center justify-center h-5 px-1.5 rounded-full bg-red-500/15 text-red-500 text-[9px] font-bold shrink-0"
          >
            <Clock className="h-3 w-3 mr-0.5" />
            {o.activities_overdue}
          </span>
        )}
      </div>

      {/* Customer */}
      <div className="pl-1 text-[11.5px] text-[var(--text-dim)] truncate flex items-center gap-1">
        <Users className="h-3 w-3 shrink-0 text-[var(--text-ghost)]" />
        {customerLine}
      </div>

      {/* Tags */}
      {o.tags && o.tags.length > 0 && (
        <div className="pl-1 mt-1.5 flex flex-wrap gap-1">
          {o.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[var(--bg-surface-subtle)] text-[9.5px] font-semibold text-[var(--text-dim)] uppercase tracking-wider"
            >
              {tag}
            </span>
          ))}
          {o.tags.length > 3 && (
            <span className="text-[9.5px] text-[var(--text-ghost)]">
              +{o.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Bottom row: revenue + close date + owner */}
      <div className="pl-1 mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-bold text-[var(--text-primary)] tabular-nums">
            {formatCurrency(Number(o.expected_revenue))}
          </span>
          {stars > 0 && (
            <span className="inline-flex items-center text-amber-500 text-[10px]">
              {[...Array(stars)].map((_, i) => (
                <Star key={i} className="h-2.5 w-2.5 fill-current" />
              ))}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {o.expected_close_date && (
            <span
              className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${
                due.tone === "overdue"
                  ? "text-red-500"
                  : due.tone === "soon"
                    ? "text-amber-500"
                    : "text-[var(--text-dim)]"
              }`}
            >
              <CalendarIcon className="h-2.5 w-2.5" />
              {due.label}
            </span>
          )}
          <OwnerAvatar owner={o.owner} />
        </div>
      </div>
    </div>
  );
}

function OwnerAvatar({
  owner,
}: {
  owner: CrmOpportunityWithRelations["owner"];
}) {
  if (!owner) {
    return (
      <div
        className="h-5 w-5 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center"
        title="Unassigned"
      >
        <UserIcon className="h-2.5 w-2.5 text-[var(--text-ghost)]" />
      </div>
    );
  }
  const initials = (owner.full_name || owner.username || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (owner.avatar_url) {
    return (
      <img
        src={owner.avatar_url}
        alt={owner.username}
        title={owner.full_name || owner.username}
        className="h-5 w-5 rounded-full object-cover border border-[var(--border-subtle)]"
      />
    );
  }
  return (
    <div
      className="h-5 w-5 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center text-[8px] font-bold"
      title={owner.full_name || owner.username}
    >
      {initials}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   List view
   ════════════════════════════════════════════════════════════════════════ */

function ListView({
  opps,
  onRowClick,
  t,
}: {
  opps: CrmOpportunityWithRelations[];
  onRowClick: (id: string) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
      {/* Desktop header */}
      <div className="hidden md:grid grid-cols-[2fr_1.4fr_1fr_1fr_0.8fr_0.6fr_0.6fr] gap-3 px-4 py-3 border-b border-[var(--border-subtle)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
        <div>{t("form.name")}</div>
        <div>{t("form.contact")}</div>
        <div>{t("form.stage")}</div>
        <div>{t("card.expectedRevenue")}</div>
        <div>{t("card.closeDate")}</div>
        <div>{t("form.priority")}</div>
        <div>{t("card.owner")}</div>
      </div>
      <div className="divide-y divide-[var(--border-subtle)]">
        {opps.map((o) => {
          const due = relativeDate(o.expected_close_date);
          const customerLine =
            o.contact?.display_name ||
            o.contact_name ||
            o.contact?.company ||
            o.company_name ||
            "—";
          const stars = Math.max(0, Math.min(3, o.priority));
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onRowClick(o.id)}
              className="w-full text-left px-4 py-3 hover:bg-[var(--bg-surface)] transition-colors md:grid md:grid-cols-[2fr_1.4fr_1fr_1fr_0.8fr_0.6fr_0.6fr] md:gap-3 md:items-center flex flex-col gap-1"
            >
              {/* Mobile-first stacked, desktop grid */}
              <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                {o.name}
              </div>
              <div className="text-[12px] text-[var(--text-dim)] truncate">
                {customerLine}
              </div>
              <div className="md:flex hidden">
                {o.stage ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10.5px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">
                    {o.stage.is_won && (
                      <Check className="h-2.5 w-2.5 mr-1 text-emerald-500" />
                    )}
                    {o.stage.name}
                  </span>
                ) : (
                  <span className="text-[11px] text-[var(--text-ghost)]">—</span>
                )}
              </div>
              <div className="md:block hidden text-[13px] font-semibold text-[var(--text-primary)] tabular-nums">
                {formatCurrency(Number(o.expected_revenue))}
              </div>
              <div className="md:block hidden">
                <span
                  className={`text-[11.5px] font-semibold ${
                    due.tone === "overdue"
                      ? "text-red-500"
                      : due.tone === "soon"
                        ? "text-amber-500"
                        : "text-[var(--text-dim)]"
                  }`}
                >
                  {due.label}
                </span>
              </div>
              <div className="md:flex hidden items-center text-amber-500">
                {stars > 0 ? (
                  [...Array(stars)].map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-current" />
                  ))
                ) : (
                  <span className="text-[var(--text-ghost)] text-[11px]">—</span>
                )}
              </div>
              <div className="md:flex hidden">
                <OwnerAvatar owner={o.owner} />
              </div>

              {/* Mobile compact extras */}
              <div className="md:hidden flex items-center justify-between gap-2 mt-1">
                <span className="text-[12.5px] font-bold text-[var(--text-primary)] tabular-nums">
                  {formatCurrency(Number(o.expected_revenue))}
                </span>
                {o.stage && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[9.5px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">
                    {o.stage.name}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Opportunity modal — create / edit / activities / mark-won-lost
   ════════════════════════════════════════════════════════════════════════ */

interface OpportunityModalProps {
  opportunity: CrmOpportunityWithRelations | null;
  stages: CrmStageRow[];
  accountId: string | null;
  onClose: () => void;
  onSaved: () => void;
  t: (key: string) => string;
}

function OpportunityModal({
  opportunity,
  stages,
  accountId,
  onClose,
  onSaved,
  t,
}: OpportunityModalProps) {
  const isNew = !opportunity;
  const wonStage = stages.find((s) => s.is_won);

  /* Form state — seeded from the opportunity (or blank for new). */
  const [name, setName] = useState(opportunity?.name ?? "");
  const [companyName, setCompanyName] = useState(
    opportunity?.company_name ?? "",
  );
  const [contactName, setContactName] = useState(
    opportunity?.contact_name ?? "",
  );
  const [email, setEmail] = useState(opportunity?.email ?? "");
  const [phone, setPhone] = useState(opportunity?.phone ?? "");
  const [expectedRevenue, setExpectedRevenue] = useState(
    String(opportunity?.expected_revenue ?? 0),
  );
  const [probability, setProbability] = useState(
    String(opportunity?.probability ?? 10),
  );
  const [closeDate, setCloseDate] = useState(
    opportunity?.expected_close_date ?? "",
  );
  const [priority, setPriority] = useState(opportunity?.priority ?? 0);
  const [stageId, setStageId] = useState(
    opportunity?.stage_id ?? stages[0]?.id ?? "",
  );
  const [source, setSource] = useState(opportunity?.source ?? "");
  const [tags, setTags] = useState((opportunity?.tags ?? []).join(", "));
  const [description, setDescription] = useState(opportunity?.description ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showLost, setShowLost] = useState(false);
  const [lostReason, setLostReason] = useState("");

  /* Activities — only loaded for existing opportunities. */
  const [activities, setActivities] = useState<CrmActivityRow[]>([]);
  const [actLoading, setActLoading] = useState(false);
  const [showActForm, setShowActForm] = useState(false);

  const reloadActivities = useCallback(async () => {
    if (isNew || !opportunity) return;
    setActLoading(true);
    const rows = await fetchActivities(opportunity.id);
    setActivities(rows);
    setActLoading(false);
  }, [isNew, opportunity]);

  useEffect(() => {
    void reloadActivities();
  }, [reloadActivities]);

  /* Close on ESC. */
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  async function handleSave() {
    setError(null);
    if (name.trim().length === 0) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      stage_id: stageId || null,
      company_name: companyName.trim() || null,
      contact_name: contactName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      expected_revenue: Number(expectedRevenue) || 0,
      probability: Math.max(0, Math.min(100, Number(probability) || 0)),
      expected_close_date: closeDate || null,
      priority,
      source: source.trim() || null,
      tags: tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      color: opportunity?.color ?? 0,
      contact_id: opportunity?.contact_id ?? null,
      owner_account_id: opportunity?.owner_account_id ?? accountId ?? null,
      lost_reason: opportunity?.lost_reason ?? null,
      won_at: opportunity?.won_at ?? null,
      lost_at: opportunity?.lost_at ?? null,
      archived_at: opportunity?.archived_at ?? null,
    };
    if (isNew) {
      const res = await createOpportunity(payload);
      setSaving(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved();
    } else {
      const ok = await updateOpportunity(opportunity!.id, payload);
      setSaving(false);
      if (!ok) {
        setError("Failed to save");
        return;
      }
      onSaved();
    }
  }

  async function handleMarkWon() {
    if (isNew || !opportunity) return;
    if (!wonStage) {
      setError("No 'Won' stage configured");
      return;
    }
    setSaving(true);
    await moveOpportunityToStage({
      opportunityId: opportunity.id,
      stageId: wonStage.id,
      isWonStage: true,
    });
    setSaving(false);
    onSaved();
  }

  async function handleMarkLost() {
    if (isNew || !opportunity) return;
    if (!lostReason.trim()) {
      setError("Please provide a reason");
      return;
    }
    setSaving(true);
    await markOpportunityLost(opportunity.id, lostReason.trim());
    setSaving(false);
    onSaved();
  }

  async function handleArchive() {
    if (isNew || !opportunity) return;
    if (!confirm("Archive this opportunity?")) return;
    setSaving(true);
    await archiveOpportunity(opportunity.id);
    setSaving(false);
    onSaved();
  }

  async function handleDelete() {
    if (isNew || !opportunity) return;
    if (!confirm("Delete this opportunity permanently? This cannot be undone."))
      return;
    setSaving(true);
    await deleteOpportunity(opportunity.id);
    setSaving(false);
    onSaved();
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-0 md:p-6"
    >
      <div className="bg-[var(--bg-primary)] w-full md:max-w-4xl md:max-h-[92vh] h-full md:h-auto md:rounded-2xl border border-[var(--border-subtle)] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3.5 border-b border-[var(--border-subtle)] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="md:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-[var(--bg-surface)] text-[var(--text-dim)]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h2 className="text-[15px] md:text-[17px] font-bold text-[var(--text-primary)] truncate">
              {isNew ? t("newOpp") : opportunity?.name || t("form.title")}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            {!isNew && opportunity && (
              <>
                <button
                  type="button"
                  onClick={handleMarkWon}
                  disabled={saving || !!opportunity.won_at}
                  className="hidden md:inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-emerald-500/15 text-emerald-500 text-[11.5px] font-bold uppercase tracking-wider hover:bg-emerald-500/20 disabled:opacity-40 transition-colors"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t("form.markWon")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLost(true)}
                  disabled={saving || !!opportunity.lost_at}
                  className="hidden md:inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-red-500/15 text-red-500 text-[11.5px] font-bold uppercase tracking-wider hover:bg-red-500/20 disabled:opacity-40 transition-colors"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  {t("form.markLost")}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="hidden md:flex p-1.5 rounded-lg hover:bg-[var(--bg-surface)] text-[var(--text-dim)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body — scrollable two-column on desktop, stacked on mobile */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="grid md:grid-cols-[1.5fr_1fr] gap-0">
            {/* Left: form */}
            <div className="p-4 md:p-6 md:border-r border-[var(--border-subtle)] space-y-4">
              {/* Mobile won/lost buttons */}
              {!isNew && opportunity && (
                <div className="md:hidden flex gap-2">
                  <button
                    type="button"
                    onClick={handleMarkWon}
                    disabled={saving || !!opportunity.won_at}
                    className="flex-1 h-9 rounded-lg bg-emerald-500/15 text-emerald-500 text-[11.5px] font-bold uppercase tracking-wider hover:bg-emerald-500/20 disabled:opacity-40 inline-flex items-center justify-center gap-1"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t("form.markWon")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLost(true)}
                    disabled={saving || !!opportunity.lost_at}
                    className="flex-1 h-9 rounded-lg bg-red-500/15 text-red-500 text-[11.5px] font-bold uppercase tracking-wider hover:bg-red-500/20 disabled:opacity-40 inline-flex items-center justify-center gap-1"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    {t("form.markLost")}
                  </button>
                </div>
              )}

              <Field label={t("form.name")}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("form.namePh")}
                  className={inputClass}
                />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label={t("form.company")}>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder={t("form.companyPh")}
                    className={inputClass}
                  />
                </Field>
                <Field label={t("form.contactName")}>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label={t("form.email")}>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-ghost)] pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass + " pl-9"}
                    />
                  </div>
                </Field>
                <Field label={t("form.phone")}>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-ghost)] pointer-events-none" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={inputClass + " pl-9"}
                    />
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label={t("form.expectedRevenue")}>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={expectedRevenue}
                    onChange={(e) => setExpectedRevenue(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={t("form.probability")}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="100"
                    step="5"
                    value={probability}
                    onChange={(e) => setProbability(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={t("form.closeDate")}>
                  <input
                    type="date"
                    value={closeDate ?? ""}
                    onChange={(e) => setCloseDate(e.target.value)}
                    className={inputClass + " [color-scheme:dark]"}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label={t("form.stage")}>
                  <select
                    value={stageId}
                    onChange={(e) => setStageId(e.target.value)}
                    className={inputClass + " [color-scheme:dark]"}
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("form.priority")}>
                  <div className="flex items-center gap-1 h-10 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
                    {[1, 2, 3].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() =>
                          setPriority(priority === n ? n - 1 : n)
                        }
                        className={`p-1 transition-colors ${
                          n <= priority
                            ? "text-amber-500"
                            : "text-[var(--text-ghost)] hover:text-[var(--text-dim)]"
                        }`}
                      >
                        <Star
                          className="h-4 w-4"
                          fill={n <= priority ? "currentColor" : "none"}
                        />
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label={t("form.source")}>
                  <input
                    type="text"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder={t("form.sourcePh")}
                    className={inputClass}
                  />
                </Field>
                <Field label={t("form.tags")}>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder={t("form.tagsPh")}
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label={t("form.description")}>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder={t("form.descriptionPh")}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] resize-none"
                />
              </Field>

              {error && (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[12px] text-red-500 font-medium">
                  {error}
                </div>
              )}

              {/* Lost reason inline */}
              {showLost && (
                <div className="p-3 rounded-xl bg-red-500/[0.06] border border-red-500/20 space-y-2">
                  <div className="text-[11.5px] font-bold text-red-500 uppercase tracking-wider">
                    {t("form.lostReason")}
                  </div>
                  <input
                    type="text"
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                    placeholder={t("form.lostReasonPh")}
                    className="w-full h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-red-500/30 text-[13px] text-[var(--text-primary)] outline-none focus:border-red-500"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowLost(false);
                        setLostReason("");
                      }}
                      className="h-8 px-3 rounded-lg text-[12px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                    >
                      {t("form.cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={handleMarkLost}
                      disabled={saving || !lostReason.trim()}
                      className="h-8 px-3 rounded-lg bg-red-500 text-white text-[12px] font-semibold disabled:opacity-50"
                    >
                      Confirm lost
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: activities + meta */}
            <div className="p-4 md:p-6 bg-[var(--bg-secondary)] space-y-4 md:overflow-y-auto">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                    {t("activities")}
                  </h3>
                  {!isNew && (
                    <button
                      type="button"
                      onClick={() => setShowActForm((v) => !v)}
                      className="text-[11px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)] inline-flex items-center gap-0.5"
                    >
                      <Plus className="h-3 w-3" />
                      {t("act.add")}
                    </button>
                  )}
                </div>

                {isNew ? (
                  <p className="text-[11.5px] text-[var(--text-ghost)] italic">
                    Save the opportunity first to schedule activities.
                  </p>
                ) : (
                  <ActivitiesPanel
                    opportunityId={opportunity!.id}
                    activities={activities}
                    loading={actLoading}
                    accountId={accountId}
                    showForm={showActForm}
                    onCloseForm={() => setShowActForm(false)}
                    onChange={reloadActivities}
                    t={t}
                  />
                )}
              </div>

              {!isNew && opportunity && (
                <div className="pt-3 border-t border-[var(--border-subtle)] space-y-1.5 text-[11px] text-[var(--text-dim)]">
                  <div>
                    Created{" "}
                    {new Date(opportunity.created_at).toLocaleDateString()}
                  </div>
                  <div>
                    Updated{" "}
                    {new Date(opportunity.updated_at).toLocaleDateString()}
                  </div>
                  {opportunity.won_at && (
                    <div className="text-emerald-500 font-semibold">
                      Won {new Date(opportunity.won_at).toLocaleDateString()}
                    </div>
                  )}
                  {opportunity.lost_at && (
                    <div className="text-red-500 font-semibold">
                      Lost {new Date(opportunity.lost_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-2 px-4 md:px-6 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] shrink-0">
          {!isNew ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleArchive}
                className="inline-flex items-center gap-1 h-9 px-3 rounded-lg text-[12px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
              >
                <Archive className="h-3.5 w-3.5" />
                {t("form.archive")}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-1 h-9 px-3 rounded-lg text-[12px] font-semibold text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("form.delete")}
              </button>
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-lg text-[12.5px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)]"
            >
              {t("form.cancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12.5px] font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isNew ? t("form.create") : t("form.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Activities panel (inside the modal)
   ════════════════════════════════════════════════════════════════════════ */

function ActivitiesPanel({
  opportunityId,
  activities,
  loading,
  accountId,
  showForm,
  onCloseForm,
  onChange,
  t,
}: {
  opportunityId: string;
  activities: CrmActivityRow[];
  loading: boolean;
  accountId: string | null;
  showForm: boolean;
  onCloseForm: () => void;
  onChange: () => void;
  t: (key: string) => string;
}) {
  const [type, setType] = useState<CrmActivityType>("task");
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    if (!title.trim()) return;
    setBusy(true);
    await createActivity({
      opportunity_id: opportunityId,
      type,
      title: title.trim(),
      notes: notes.trim() || null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      done_at: null,
      assignee_account_id: accountId,
      created_by_account_id: accountId,
    });
    setBusy(false);
    setTitle("");
    setNotes("");
    setDueAt("");
    onCloseForm();
    onChange();
  }

  async function handleToggle(act: CrmActivityRow) {
    if (act.done_at) {
      await reopenActivity(act.id);
    } else {
      await completeActivity(act.id);
    }
    onChange();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this activity?")) return;
    await deleteActivity(id);
    onChange();
  }

  return (
    <div className="space-y-2">
      {showForm && (
        <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CrmActivityType)}
              className="h-9 px-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[12px] text-[var(--text-primary)] outline-none [color-scheme:dark]"
            >
              <option value="call">{t("act.type.call")}</option>
              <option value="meeting">{t("act.type.meeting")}</option>
              <option value="task">{t("act.type.task")}</option>
              <option value="email">{t("act.type.email")}</option>
              <option value="note">{t("act.type.note")}</option>
            </select>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="h-9 px-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[12px] text-[var(--text-primary)] outline-none [color-scheme:dark]"
            />
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("act.titlePh")}
            className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[12.5px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notes…"
            className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[12px] text-[var(--text-primary)] outline-none resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                onCloseForm();
                setTitle("");
                setNotes("");
                setDueAt("");
              }}
              className="h-7 px-2.5 rounded-md text-[11.5px] font-semibold text-[var(--text-dim)]"
            >
              {t("form.cancel")}
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={busy || !title.trim()}
              className="h-7 px-3 rounded-md bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[11.5px] font-semibold disabled:opacity-50"
            >
              {t("act.add")}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--text-dim)]" />
        </div>
      ) : activities.length === 0 ? (
        <p className="text-[11.5px] text-[var(--text-ghost)] italic py-2">
          {t("act.empty")}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {activities.map((a) => {
            const due = relativeDate(a.due_at);
            const Icon =
              a.type === "call"
                ? Phone
                : a.type === "meeting"
                  ? Users
                  : a.type === "email"
                    ? Mail
                    : a.type === "note"
                      ? Activity
                      : Check;
            return (
              <li
                key={a.id}
                className={`group p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] ${
                  a.done_at ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggle(a)}
                    className={`mt-0.5 h-4 w-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                      a.done_at
                        ? "bg-emerald-500 border-emerald-500"
                        : "border-[var(--border-color)] hover:border-emerald-500"
                    }`}
                  >
                    {a.done_at && <Check className="h-2.5 w-2.5 text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3 w-3 text-[var(--text-ghost)] shrink-0" />
                      <div
                        className={`text-[12px] font-semibold truncate ${
                          a.done_at
                            ? "line-through text-[var(--text-ghost)]"
                            : "text-[var(--text-primary)]"
                        }`}
                      >
                        {a.title}
                      </div>
                    </div>
                    {a.notes && (
                      <div className="text-[11px] text-[var(--text-dim)] mt-0.5 line-clamp-2">
                        {a.notes}
                      </div>
                    )}
                    {a.due_at && !a.done_at && (
                      <div
                        className={`text-[10.5px] mt-0.5 font-semibold ${
                          due.tone === "overdue"
                            ? "text-red-500"
                            : due.tone === "soon"
                              ? "text-amber-500"
                              : "text-[var(--text-ghost)]"
                        }`}
                      >
                        {due.label}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(a.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-ghost)] hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Tiny form helpers
   ════════════════════════════════════════════════════════════════════════ */

const inputClass =
  "w-full h-10 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-colors placeholder:text-[var(--text-ghost)]";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}
