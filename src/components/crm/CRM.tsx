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
  ChartPie,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Globe,
  Inbox,
  LayoutGrid,
  LineChart,
  List as ListIcon,
  Loader2,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  User as UserIcon,
  Users,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import {
  archiveOpportunity,
  completeActivity,
  createActivity,
  createOpportunity,
  createStage,
  deleteActivity,
  deleteOpportunity,
  deleteStage,
  fetchActivities,
  fetchActivityFeed,
  fetchOpportunities,
  fetchStages,
  generateLeads,
  markOpportunityLost,
  moveOpportunityToStage,
  reopenActivity,
  updateOpportunity,
  updateStage,
  type ActivityFeedRow,
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

  /* Top-level page: Pipeline (the kanban + views), Reporting, or
     Configuration. Mirrors Odoo CRM's three top-nav buckets. */
  const [mainView, setMainView] =
    useState<"pipeline" | "reporting" | "configuration">("pipeline");

  /* View toggle inside the Pipeline page. v1 only had pipeline + list;
     v2 expands to all the Odoo CRM views. */
  type CrmViewMode =
    | "pipeline"
    | "list"
    | "calendar"
    | "pivot"
    | "graph"
    | "map"
    | "activity";
  const [viewMode, setViewMode] = useState<CrmViewMode>("pipeline");

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

  /* Generate-leads wizard modal. */
  const [showGenerateLeads, setShowGenerateLeads] = useState(false);

  /* Stage edit modal — `"new"` to create, otherwise the stage id. */
  const [editingStageId, setEditingStageId] =
    useState<string | "new" | null>(null);

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

  /* ── Quick inline add on a kanban column ────────────────────────── */
  const handleQuickAdd = useCallback(
    async (input: {
      stageId: string;
      name: string;
      companyName?: string;
      revenue?: number;
    }) => {
      const res = await createOpportunity({
        name: input.name.trim(),
        description: null,
        stage_id: input.stageId,
        contact_id: null,
        company_name: input.companyName?.trim() || null,
        contact_name: null,
        email: null,
        phone: null,
        expected_revenue: input.revenue ?? 0,
        probability: 10,
        expected_close_date: null,
        priority: 0,
        source: null,
        tags: [],
        color: 0,
        owner_account_id: accountId,
        lost_reason: null,
        won_at: null,
        lost_at: null,
        archived_at: null,
      });
      if (res.ok) await reload();
      return res;
    },
    [accountId, reload],
  );

  /* ── Stage actions: fold/unfold, edit, delete ───────────────────── */
  const handleToggleFoldStage = useCallback(
    async (stage: CrmStageRow) => {
      const ok = await updateStage(stage.id, { fold: !stage.fold });
      if (ok) await reload();
    },
    [reload],
  );
  const handleDeleteStage = useCallback(
    async (stage: CrmStageRow) => {
      if (!confirm(t("stage.edit.deleteConfirm"))) return;
      const ok = await deleteStage(stage.id);
      if (ok) await reload();
    },
    [reload, t],
  );

  /* ── Generate leads ─────────────────────────────────────────────── */
  const handleGenerateLeads = useCallback(
    async (options: {
      count: number;
      stageId: string | null;
      source: string | null;
    }) => {
      const res = await generateLeads({
        count: options.count,
        stageId: options.stageId,
        ownerAccountId: accountId,
        source: options.source,
      });
      if (res.ok) await reload();
      return res;
    },
    [accountId, reload],
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 pt-4 pb-6">
        {/* ─ Row 1: top nav (Odoo-style — CRM brand + plain text tabs) ─ */}
        <div className="mb-3 flex items-center gap-5 overflow-x-auto -mx-1 px-1">
          <span className="inline-flex items-center gap-1.5 text-[15px] font-bold text-[var(--text-primary)] shrink-0">
            <span className="inline-block h-4 w-4 rounded-[5px] bg-gradient-to-br from-emerald-400 to-cyan-500" />
            {t("title")}
          </span>
          {(
            [
              { id: "pipeline", label: t("nav.sales") },
              { id: "reporting", label: t("nav.reporting") },
              { id: "configuration", label: t("nav.configuration") },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMainView(tab.id)}
              className={`text-[13px] font-semibold transition-colors shrink-0 pb-0.5 border-b-2 ${
                mainView === tab.id
                  ? "text-[var(--text-primary)] border-[var(--accent-primary,#22d3a7)]"
                  : "text-[var(--text-dim)] border-transparent hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─ Reporting page ─ */}
        {mainView === "reporting" && (
          <ReportingPage
            opps={opps}
            stages={stages}
            loading={loading}
            t={t}
          />
        )}

        {/* ─ Configuration page ─ */}
        {mainView === "configuration" && (
          <ConfigurationPage
            stages={stages}
            opps={opps}
            loading={loading}
            onAddStage={() => setEditingStageId("new")}
            onEditStage={(id) => setEditingStageId(id)}
            onToggleFold={handleToggleFoldStage}
            onDeleteStage={handleDeleteStage}
            t={t}
          />
        )}

        {mainView === "pipeline" && (
          <>

        {/* ─ Action bar — Odoo-style: New | Generate Leads | Pipeline ⚙ ......
              [search] ...... [view icons]                                ─ */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEditingId("new")}
            className="inline-flex items-center gap-1 h-9 px-3.5 rounded-lg bg-[var(--accent-primary,#22d3a7)] text-[#0a0a0a] text-[12.5px] font-bold hover:opacity-90 transition-all"
          >
            {t("new")}
          </button>
          <button
            type="button"
            onClick={() => setShowGenerateLeads(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[var(--border-subtle)] text-[12.5px] font-semibold text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t("generateLeads")}
          </button>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text-dim)] ml-1">
            {t("nav.pipeline")}
            <Settings className="h-3.5 w-3.5" />
          </span>

          {/* Search bar — chip + input + filter dropdown */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[240px] max-w-[480px] mx-auto h-9 px-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] focus-within:border-[var(--border-focus)] transition-colors">
            <Search className="h-3.5 w-3.5 text-[var(--text-ghost)] shrink-0" />
            {myOnly && (
              <button
                type="button"
                onClick={() => setMyOnly(false)}
                className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-md bg-[var(--accent-primary,#22d3a7)]/15 text-[var(--accent-primary,#22d3a7)] text-[11px] font-semibold shrink-0"
              >
                <Filter className="h-2.5 w-2.5" />
                {t("myPipeline")}
                <X className="h-3 w-3 ml-0.5" />
              </button>
            )}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search")}
              className="flex-1 min-w-0 bg-transparent text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none"
            />
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`p-1 rounded-md text-[var(--text-ghost)] hover:text-[var(--text-primary)] transition-colors ${
                showFilters || filterStageId || filterPriority
                  ? "text-[var(--text-primary)]"
                  : ""
              }`}
              title={t("filters")}
            >
              <Filter className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* My pipeline shortcut — only visible when not already filtering */}
          {!myOnly && (
            <button
              type="button"
              onClick={() => setMyOnly(true)}
              disabled={!accountId}
              className="hidden md:inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-[12px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              <UserIcon className="h-3.5 w-3.5" />
              {t("myPipeline")}
            </button>
          )}

          {/* View switcher — 7 icon-only modes, mirrors Odoo CRM. */}
          <div className="ml-auto inline-flex items-center h-9 rounded-lg border border-[var(--border-subtle)] overflow-hidden">
            {(
              [
                { id: "pipeline", label: t("view.pipeline"), icon: LayoutGrid },
                { id: "list",     label: t("view.list"),     icon: ListIcon },
                { id: "calendar", label: t("view.calendar"), icon: CalendarIcon },
                { id: "pivot",    label: t("view.pivot"),    icon: ChartPie },
                { id: "graph",    label: t("view.graph"),    icon: LineChart },
                { id: "map",      label: t("view.map"),      icon: Globe },
                { id: "activity", label: t("view.activity"), icon: Zap },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setViewMode(m.id)}
                className={`h-9 w-9 inline-flex items-center justify-center transition-colors shrink-0 border-l border-[var(--border-subtle)] first:border-l-0 ${
                  viewMode === m.id
                    ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                    : "text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                }`}
                title={m.label}
              >
                <m.icon className="h-3.5 w-3.5" />
              </button>
            ))}
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
            onQuickAdd={handleQuickAdd}
            onStageEdit={(id) => setEditingStageId(id)}
            onStageFold={handleToggleFoldStage}
            onStageDelete={handleDeleteStage}
            t={t}
          />
        ) : viewMode === "list" ? (
          <ListView
            opps={filteredOpps}
            onRowClick={(id) => setEditingId(id)}
            t={t}
          />
        ) : viewMode === "calendar" ? (
          <CalendarView
            opps={filteredOpps}
            onCardClick={(id) => setEditingId(id)}
            t={t}
          />
        ) : viewMode === "pivot" ? (
          <PivotView opps={filteredOpps} stages={stages} t={t} />
        ) : viewMode === "graph" ? (
          <GraphView opps={filteredOpps} stages={stages} t={t} />
        ) : viewMode === "map" ? (
          <MapView
            opps={filteredOpps}
            onCardClick={(id) => setEditingId(id)}
            t={t}
          />
        ) : (
          <ActivityView
            stages={stages}
            onOpenOpportunity={(id) => setEditingId(id)}
            t={t}
          />
        )}
          </>
        )}
      </div>

      {/* ─ Opportunity modal ─ */}
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

      {/* ─ Generate leads modal ─ */}
      {showGenerateLeads && (
        <GenerateLeadsModal
          stages={stages}
          onClose={() => setShowGenerateLeads(false)}
          onGenerate={handleGenerateLeads}
          t={t}
        />
      )}

      {/* ─ Stage edit modal ─ */}
      {editingStageId !== null && (
        <StageEditModal
          stage={
            editingStageId === "new"
              ? null
              : stages.find((s) => s.id === editingStageId) ?? null
          }
          existingStages={stages}
          onClose={() => setEditingStageId(null)}
          onSaved={async () => {
            setEditingStageId(null);
            await reload();
          }}
          t={t}
        />
      )}
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
  onQuickAdd,
  onStageEdit,
  onStageFold,
  onStageDelete,
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
  onQuickAdd: (input: {
    stageId: string;
    name: string;
    companyName?: string;
    revenue?: number;
  }) => Promise<{ ok: boolean }>;
  onStageEdit: (id: string) => void;
  onStageFold: (stage: CrmStageRow) => void;
  onStageDelete: (stage: CrmStageRow) => void;
  t: (key: string) => string;
}) {
  /* The "no stage" bucket only renders if it has anything in it — no
     point in showing an empty trash column. */
  const noStageRows = oppsByStage.get("__nostage__") ?? [];
  type Column = {
    id: string;
    name: string;
    isWon: boolean;
    fold: boolean;
    stage: CrmStageRow | null;
  };
  const allColumns: Column[] = [
    ...stages.map((s) => ({
      id: s.id,
      name: s.name,
      isWon: s.is_won,
      fold: s.fold,
      stage: s,
    })),
  ];
  if (noStageRows.length > 0) {
    allColumns.push({
      id: "__nostage__",
      name: "Unassigned",
      isWon: false,
      fold: false,
      stage: null,
    });
  }

  /* The largest stage value is used as the denominator for the per-stage
     progress bars so the bar fills are visually comparable across columns. */
  const maxStageRevenue = Math.max(
    1,
    ...allColumns.map((col) =>
      (oppsByStage.get(col.id) ?? []).reduce(
        (acc, o) => acc + (Number(o.expected_revenue) || 0),
        0,
      ),
    ),
  );

  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 overflow-x-auto pb-4">
      <div className="flex gap-3 md:gap-4 min-w-min items-start">
        {allColumns.map((col) => {
          const list = oppsByStage.get(col.id) ?? [];
          const total = list.reduce(
            (acc, o) => acc + (Number(o.expected_revenue) || 0),
            0,
          );
          const isHover = hoverStageId === col.id;

          /* Folded stages render as a thin clickable spine. Click to
             unfold (matches Odoo). */
          if (col.fold && col.stage) {
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => onStageFold(col.stage!)}
                onDragOver={(e) => onDragOver(e, col.id)}
                onDrop={(e) => onDrop(e, col.id)}
                className="w-[44px] shrink-0 self-stretch rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-surface)] transition-colors flex flex-col items-center justify-between py-4 min-h-[280px]"
                title={`${col.name} — ${list.length}`}
              >
                <div className="flex flex-col items-center gap-1.5">
                  <ChevronRight className="h-4 w-4 text-[var(--text-dim)]" />
                  <span className="text-[10px] font-bold text-[var(--text-ghost)]">
                    {list.length}
                  </span>
                </div>
                <div
                  className="text-[11px] font-bold text-[var(--text-dim)] uppercase tracking-wider"
                  style={{
                    writingMode: "vertical-rl",
                    transform: "rotate(180deg)",
                  }}
                >
                  {col.name}
                </div>
                <div className="h-3" />
              </button>
            );
          }

          return (
            <PipelineColumn
              key={col.id}
              col={col}
              list={list}
              total={total}
              maxRevenue={maxStageRevenue}
              isHover={isHover}
              draggingId={draggingId}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onCardClick={onCardClick}
              onQuickAdd={onQuickAdd}
              onStageEdit={onStageEdit}
              onStageFold={onStageFold}
              onStageDelete={onStageDelete}
              t={t}
            />
          );
        })}
      </div>
    </div>
  );
}

/* A single column on the kanban — header with progress bar + stage menu,
   the cards, and the quick inline add at the bottom. Pulled out so the
   kanban view itself stays small. */
function PipelineColumn({
  col,
  list,
  total,
  maxRevenue,
  isHover,
  draggingId,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onCardClick,
  onQuickAdd,
  onStageEdit,
  onStageFold,
  onStageDelete,
  t,
}: {
  col: {
    id: string;
    name: string;
    isWon: boolean;
    fold: boolean;
    stage: CrmStageRow | null;
  };
  list: CrmOpportunityWithRelations[];
  total: number;
  maxRevenue: number;
  isHover: boolean;
  draggingId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent, stageId: string) => void;
  onDrop: (e: DragEvent, stageId: string) => void;
  onCardClick: (id: string) => void;
  onQuickAdd: (input: {
    stageId: string;
    name: string;
    companyName?: string;
    revenue?: number;
  }) => Promise<{ ok: boolean }>;
  onStageEdit: (id: string) => void;
  onStageFold: (stage: CrmStageRow) => void;
  onStageDelete: (stage: CrmStageRow) => void;
  t: (key: string) => string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickCompany, setQuickCompany] = useState("");
  const [quickRevenue, setQuickRevenue] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    window.addEventListener("mousedown", handle);
    return () => window.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  const fillPct = Math.min(100, (total / maxRevenue) * 100);
  const isStageColumn = col.stage !== null;

  async function handleQuickSubmit() {
    if (!quickName.trim() || !isStageColumn) return;
    setQuickBusy(true);
    const res = await onQuickAdd({
      stageId: col.id,
      name: quickName.trim(),
      companyName: quickCompany.trim() || undefined,
      revenue: Number(quickRevenue) || 0,
    });
    setQuickBusy(false);
    if (res.ok) {
      setQuickName("");
      setQuickCompany("");
      setQuickRevenue("");
      setQuickOpen(false);
    }
  }

  return (
    <div
      onDragOver={(e) => onDragOver(e, col.id)}
      onDrop={(e) => onDrop(e, col.id)}
      className={`w-[280px] md:w-[300px] shrink-0 rounded-2xl border transition-colors ${
        isHover
          ? "bg-[var(--bg-secondary)] border-[var(--border-focus)]"
          : "bg-[var(--bg-secondary)] border-[var(--border-subtle)]"
      }`}
    >
      {/* Column header */}
      <div className="px-4 pt-4 pb-2.5">
        <div className="flex items-center justify-between gap-2">
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
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-[var(--text-dim)] tabular-nums">
              {formatCurrency(total)}
            </span>
            {isStageColumn && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="p-1 rounded-md text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                  title="Stage actions"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
                {menuOpen && col.stage && (
                  <div className="absolute right-0 top-7 z-30 w-44 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onStageFold(col.stage!);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] text-left"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 text-[var(--text-dim)]" />
                      {col.fold ? t("stage.menu.unfold") : t("stage.menu.fold")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onStageEdit(col.stage!.id);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] text-left"
                    >
                      <Settings className="h-3.5 w-3.5 text-[var(--text-dim)]" />
                      {t("stage.menu.edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onStageDelete(col.stage!);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-red-500 hover:bg-red-500/10 text-left"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("stage.menu.delete")}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Per-stage progress bar — width relative to the largest stage. */}
        <div className="mt-2 h-1 rounded-full bg-[var(--bg-surface-subtle)] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              col.isWon ? "bg-emerald-500" : "bg-[var(--accent-primary,#5b7cff)]"
            }`}
            style={{ width: `${fillPct}%` }}
          />
        </div>
      </div>

      {/* Cards */}
      <div className="px-3 pb-2 space-y-2 min-h-[80px]">
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

      {/* Quick inline add at the bottom of the column */}
      {isStageColumn && (
        <div className="px-3 pb-3">
          {quickOpen ? (
            <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-focus)] space-y-2">
              <input
                type="text"
                autoFocus
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleQuickSubmit();
                  if (e.key === "Escape") {
                    setQuickOpen(false);
                    setQuickName("");
                  }
                }}
                placeholder={t("quick.titlePh")}
                className="w-full h-8 px-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              />
              <input
                type="text"
                value={quickCompany}
                onChange={(e) => setQuickCompany(e.target.value)}
                placeholder={t("quick.companyPh")}
                className="w-full h-8 px-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              />
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="100"
                value={quickRevenue}
                onChange={(e) => setQuickRevenue(e.target.value)}
                placeholder={t("quick.revenuePh")}
                className="w-full h-8 px-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setQuickOpen(false);
                    setQuickName("");
                    setQuickCompany("");
                    setQuickRevenue("");
                  }}
                  className="h-7 px-2 rounded-md text-[11px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                >
                  {t("form.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleQuickSubmit}
                  disabled={quickBusy || !quickName.trim()}
                  className="h-7 px-2.5 rounded-md bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[11px] font-semibold disabled:opacity-50 inline-flex items-center gap-1"
                >
                  {quickBusy && <Loader2 className="h-3 w-3 animate-spin" />}
                  {t("quick.add.btn")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setQuickOpen(true)}
              className="w-full h-8 rounded-xl border border-dashed border-[var(--border-subtle)] text-[11.5px] font-semibold text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-colors"
            >
              {t("quick.add")}
            </button>
          )}
        </div>
      )}
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

/* ════════════════════════════════════════════════════════════════════════
   Calendar view — month grid with deals plotted on their expected close
   date. Click a deal to open its modal. Matches Odoo's calendar look.
   ════════════════════════════════════════════════════════════════════════ */

function CalendarView({
  opps,
  onCardClick,
  t,
}: {
  opps: CrmOpportunityWithRelations[];
  onCardClick: (id: string) => void;
  t: (key: string) => string;
}) {
  /* Anchor month — defaults to current month, navigated by prev/next. */
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  /* Bucket opportunities by YYYY-MM-DD of expected_close_date. */
  const byDate = useMemo(() => {
    const map = new Map<string, CrmOpportunityWithRelations[]>();
    for (const o of opps) {
      if (!o.expected_close_date) continue;
      const key = o.expected_close_date.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(o);
      map.set(key, list);
    }
    return map;
  }, [opps]);

  /* Build the 6×7 grid: pad with leading days from the previous month
     so the first column is always Monday. */
  const cells = useMemo(() => {
    const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    /* Monday = 0, Sunday = 6 */
    const offset = (firstOfMonth.getDay() + 6) % 7;
    const start = new Date(firstOfMonth);
    start.setDate(start.getDate() - offset);
    const out: Array<{ date: Date; inMonth: boolean; key: string }> = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push({
        date: d,
        inMonth: d.getMonth() === anchor.getMonth(),
        key: d.toISOString().slice(0, 10),
      });
    }
    return out;
  }, [anchor]);

  const monthLabel = anchor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const dayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const todayKey = new Date().toISOString().slice(0, 10);
  const monthHasAny = opps.some(
    (o) =>
      o.expected_close_date &&
      new Date(o.expected_close_date).getMonth() === anchor.getMonth() &&
      new Date(o.expected_close_date).getFullYear() === anchor.getFullYear(),
  );

  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-3 md:p-4">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-[14px] md:text-[16px] font-bold text-[var(--text-primary)]">
          {monthLabel}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              const d = new Date(anchor);
              d.setMonth(d.getMonth() - 1);
              setAnchor(d);
            }}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-surface)] text-[var(--text-dim)]"
            title={t("cal.prev")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              const d = new Date();
              setAnchor(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
            className="h-7 px-2.5 rounded-lg text-[11.5px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
          >
            {t("cal.today")}
          </button>
          <button
            type="button"
            onClick={() => {
              const d = new Date(anchor);
              d.setMonth(d.getMonth() + 1);
              setAnchor(d);
            }}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-surface)] text-[var(--text-dim)]"
            title={t("cal.next")}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 md:gap-1.5 mb-1.5">
        {dayHeaders.map((d) => (
          <div
            key={d}
            className="text-[9.5px] md:text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)] text-center"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1 md:gap-1.5">
        {cells.map((cell) => {
          const list = byDate.get(cell.key) ?? [];
          const isToday = cell.key === todayKey;
          return (
            <div
              key={cell.key}
              className={`min-h-[72px] md:min-h-[100px] rounded-lg p-1.5 border ${
                cell.inMonth
                  ? "bg-[var(--bg-surface)] border-[var(--border-subtle)]"
                  : "bg-transparent border-transparent opacity-40"
              } ${isToday ? "ring-2 ring-[var(--border-focus)]" : ""}`}
            >
              <div
                className={`text-[10.5px] font-bold mb-1 ${
                  isToday
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-dim)]"
                }`}
              >
                {cell.date.getDate()}
              </div>
              <div className="space-y-1">
                {list.slice(0, 3).map((o) => {
                  const swatch = SWATCH_COLORS[o.color] ?? SWATCH_COLORS[0];
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => onCardClick(o.id)}
                      className="w-full text-left px-1.5 py-0.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] transition-colors flex items-center gap-1 min-w-0"
                      title={`${o.name} — ${formatCurrency(Number(o.expected_revenue))}`}
                    >
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: swatch }}
                      />
                      <span className="text-[9.5px] md:text-[10px] font-semibold text-[var(--text-primary)] truncate">
                        {o.name}
                      </span>
                    </button>
                  );
                })}
                {list.length > 3 && (
                  <div className="text-[9px] text-[var(--text-ghost)] font-semibold pl-1">
                    +{list.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!monthHasAny && (
        <p className="text-center text-[12px] text-[var(--text-ghost)] mt-4 italic">
          {t("cal.empty")}
        </p>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Pivot view — group rows × columns with revenue/weighted/count cells.
   Mirrors Odoo's pivot table; row dimension is configurable.
   ════════════════════════════════════════════════════════════════════════ */

function PivotView({
  opps,
  stages,
  t,
}: {
  opps: CrmOpportunityWithRelations[];
  stages: CrmStageRow[];
  t: (key: string) => string;
}) {
  type Dimension = "stage" | "owner" | "month";
  const [dim, setDim] = useState<Dimension>("stage");

  const rows = useMemo(() => {
    type Row = {
      key: string;
      label: string;
      count: number;
      revenue: number;
      weighted: number;
    };
    const map = new Map<string, Row>();

    function bucket(key: string, label: string, o: CrmOpportunityWithRelations) {
      const existing = map.get(key) ?? {
        key,
        label,
        count: 0,
        revenue: 0,
        weighted: 0,
      };
      existing.count += 1;
      existing.revenue += Number(o.expected_revenue) || 0;
      existing.weighted +=
        ((Number(o.expected_revenue) || 0) * (Number(o.probability) || 0)) /
        100;
      map.set(key, existing);
    }

    if (dim === "stage") {
      for (const s of stages) map.set(s.id, { key: s.id, label: s.name, count: 0, revenue: 0, weighted: 0 });
      for (const o of opps) {
        const s = o.stage;
        bucket(s?.id ?? "__nostage__", s?.name ?? "Unassigned", o);
      }
    } else if (dim === "owner") {
      for (const o of opps) {
        const owner = o.owner;
        bucket(
          owner?.id ?? "__unassigned__",
          owner?.full_name || owner?.username || t("card.unassigned"),
          o,
        );
      }
    } else {
      for (const o of opps) {
        const date = o.expected_close_date
          ? new Date(o.expected_close_date)
          : null;
        const key = date
          ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
          : "__none__";
        const label = date
          ? date.toLocaleDateString(undefined, { month: "short", year: "numeric" })
          : "—";
        bucket(key, label, o);
      }
    }

    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [opps, stages, dim, t]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        count: acc.count + r.count,
        revenue: acc.revenue + r.revenue,
        weighted: acc.weighted + r.weighted,
      }),
      { count: 0, revenue: 0, weighted: 0 },
    );
  }, [rows]);

  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
      {/* Dimension picker */}
      <div className="flex items-center gap-1 p-3 border-b border-[var(--border-subtle)]">
        {(
          [
            { id: "stage", label: t("pivot.byStage") },
            { id: "owner", label: t("pivot.byOwner") },
            { id: "month", label: t("pivot.byMonth") },
          ] as const
        ).map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setDim(d.id)}
            className={`h-8 px-3 rounded-lg text-[11.5px] font-semibold transition-colors ${
              dim === d.id
                ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                : "text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Pivot table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
              <th className="text-left px-4 py-2.5">
                {dim === "stage"
                  ? t("form.stage")
                  : dim === "owner"
                    ? t("card.owner")
                    : t("card.closeDate")}
              </th>
              <th className="text-right px-4 py-2.5">{t("pivot.deals")}</th>
              <th className="text-right px-4 py-2.5">{t("pivot.revenue")}</th>
              <th className="text-right px-4 py-2.5">{t("pivot.weighted")}</th>
              <th className="text-right px-4 py-2.5">{t("pivot.average")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {rows.map((r) => (
              <tr key={r.key} className="hover:bg-[var(--bg-surface)]">
                <td className="px-4 py-2.5 text-[var(--text-primary)] font-semibold">
                  {r.label}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[var(--text-dim)]">
                  {r.count}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-[var(--text-primary)]">
                  {formatCurrency(r.revenue)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[var(--text-dim)]">
                  {formatCurrency(r.weighted)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[var(--text-dim)]">
                  {formatCurrency(r.count > 0 ? r.revenue / r.count : 0)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <td className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                {t("pivot.total")}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums font-bold text-[var(--text-primary)]">
                {totals.count}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums font-bold text-[var(--text-primary)]">
                {formatCurrency(totals.revenue)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums font-bold text-[var(--text-primary)]">
                {formatCurrency(totals.weighted)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums font-bold text-[var(--text-primary)]">
                {formatCurrency(
                  totals.count > 0 ? totals.revenue / totals.count : 0,
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Graph view — horizontal bar chart of revenue per dimension. Pure CSS,
   no chart library. Mirrors Odoo's graph view.
   ════════════════════════════════════════════════════════════════════════ */

function GraphView({
  opps,
  stages,
  t,
}: {
  opps: CrmOpportunityWithRelations[];
  stages: CrmStageRow[];
  t: (key: string) => string;
}) {
  type Dimension = "stage" | "owner" | "month";
  const [dim, setDim] = useState<Dimension>("stage");

  const bars = useMemo(() => {
    type Bar = { key: string; label: string; revenue: number; weighted: number; count: number };
    const map = new Map<string, Bar>();
    function add(key: string, label: string, o: CrmOpportunityWithRelations) {
      const existing = map.get(key) ?? { key, label, revenue: 0, weighted: 0, count: 0 };
      existing.revenue += Number(o.expected_revenue) || 0;
      existing.weighted += ((Number(o.expected_revenue) || 0) * (Number(o.probability) || 0)) / 100;
      existing.count += 1;
      map.set(key, existing);
    }
    if (dim === "stage") {
      for (const s of stages) map.set(s.id, { key: s.id, label: s.name, revenue: 0, weighted: 0, count: 0 });
      for (const o of opps) add(o.stage?.id ?? "__nostage__", o.stage?.name ?? "Unassigned", o);
    } else if (dim === "owner") {
      for (const o of opps) {
        const owner = o.owner;
        add(
          owner?.id ?? "__unassigned__",
          owner?.full_name || owner?.username || t("card.unassigned"),
          o,
        );
      }
    } else {
      for (const o of opps) {
        const date = o.expected_close_date ? new Date(o.expected_close_date) : null;
        const key = date
          ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
          : "__none__";
        const label = date
          ? date.toLocaleDateString(undefined, { month: "short", year: "numeric" })
          : "—";
        add(key, label, o);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [opps, stages, dim, t]);

  const max = Math.max(1, ...bars.map((b) => b.revenue));

  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
      <div className="flex items-center gap-1 p-3 border-b border-[var(--border-subtle)]">
        {(
          [
            { id: "stage", label: t("pivot.byStage") },
            { id: "owner", label: t("pivot.byOwner") },
            { id: "month", label: t("pivot.byMonth") },
          ] as const
        ).map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setDim(d.id)}
            className={`h-8 px-3 rounded-lg text-[11.5px] font-semibold transition-colors ${
              dim === d.id
                ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                : "text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="p-4 md:p-5 space-y-3">
        {bars.map((b) => {
          const fillPct = (b.revenue / max) * 100;
          const weightedPct = (b.weighted / max) * 100;
          return (
            <div key={b.key}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                  {b.label}
                </div>
                <div className="flex items-center gap-3 text-[11px] tabular-nums">
                  <span className="text-[var(--text-dim)]">{b.count}</span>
                  <span className="text-[var(--text-primary)] font-bold">
                    {formatCurrency(b.revenue)}
                  </span>
                </div>
              </div>
              <div className="relative h-6 rounded-md bg-[var(--bg-surface-subtle)] overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-[var(--accent-primary,#5b7cff)]/30"
                  style={{ width: `${fillPct}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 bg-[var(--accent-primary,#5b7cff)]"
                  style={{ width: `${weightedPct}%` }}
                />
              </div>
            </div>
          );
        })}
        {bars.length === 0 && (
          <p className="text-center text-[12px] text-[var(--text-ghost)] italic py-6">
            No data for this dimension
          </p>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Map view — geographic distribution. We don't ship a real map (no API
   key dependency); instead we show a country leaderboard with flags.
   ════════════════════════════════════════════════════════════════════════ */

function MapView({
  opps,
  onCardClick,
  t,
}: {
  opps: CrmOpportunityWithRelations[];
  onCardClick: (id: string) => void;
  t: (key: string) => string;
}) {
  const byCountry = useMemo(() => {
    type Bucket = {
      country: string;
      countryCode: string | null;
      count: number;
      revenue: number;
      opps: CrmOpportunityWithRelations[];
    };
    const map = new Map<string, Bucket>();
    for (const o of opps) {
      const country = o.contact?.country ?? null;
      const code = o.contact?.country_code ?? null;
      const key = country || "__unknown__";
      const label = country || t("map.unknown");
      const existing = map.get(key) ?? {
        country: label,
        countryCode: code,
        count: 0,
        revenue: 0,
        opps: [],
      };
      existing.count += 1;
      existing.revenue += Number(o.expected_revenue) || 0;
      existing.opps.push(o);
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [opps, t]);

  function flagFromCode(code: string | null): string {
    if (!code || code.length !== 2) return "";
    const A = 0x1f1e6;
    const offset = "A".charCodeAt(0);
    return (
      String.fromCodePoint(A + (code.toUpperCase().charCodeAt(0) - offset)) +
      String.fromCodePoint(A + (code.toUpperCase().charCodeAt(1) - offset))
    );
  }

  const hasCountryData = byCountry.some(
    (b) => b.country !== t("map.unknown"),
  );

  if (!hasCountryData) {
    return (
      <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-12 text-center">
        <div className="h-14 w-14 rounded-2xl bg-[var(--bg-surface-subtle)] flex items-center justify-center mx-auto mb-4">
          <Globe className="h-6 w-6 text-[var(--text-barely)]" />
        </div>
        <p className="text-[var(--text-primary)] text-[14px] font-semibold">
          {t("map.empty")}
        </p>
        <p className="text-[var(--text-ghost)] text-[12px] mt-1">
          Link opportunities to contacts with country data to populate this view.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {byCountry.map((b) => (
        <div
          key={b.country}
          className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[18px]">{flagFromCode(b.countryCode)}</span>
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-[var(--text-primary)] truncate">
                  {b.country}
                </div>
                <div className="text-[10.5px] text-[var(--text-dim)]">
                  {b.count} {t("map.deals")}
                </div>
              </div>
            </div>
            <div className="text-[14px] font-bold text-[var(--text-primary)] tabular-nums">
              {formatCurrency(b.revenue)}
            </div>
          </div>
          <div className="space-y-1.5">
            {b.opps.slice(0, 5).map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => onCardClick(o.id)}
                className="w-full text-left flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--bg-surface)] transition-colors"
              >
                <span className="text-[11.5px] text-[var(--text-primary)] font-semibold truncate">
                  {o.name}
                </span>
                <span className="text-[10.5px] text-[var(--text-dim)] tabular-nums shrink-0">
                  {formatCurrency(Number(o.expected_revenue))}
                </span>
              </button>
            ))}
            {b.opps.length > 5 && (
              <div className="text-[10.5px] text-[var(--text-ghost)] font-semibold pl-2.5">
                +{b.opps.length - 5} more
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Activity view — every pending activity across the pipeline, grouped by
   urgency bucket. Click an activity to jump to its parent opportunity.
   ════════════════════════════════════════════════════════════════════════ */

function ActivityView({
  stages,
  onOpenOpportunity,
  t,
}: {
  stages: CrmStageRow[];
  onOpenOpportunity: (id: string) => void;
  t: (key: string) => string;
}) {
  const [feed, setFeed] = useState<ActivityFeedRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchActivityFeed().then((rows) => {
      if (cancelled) return;
      setFeed(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const stageById = useMemo(() => {
    const map = new Map<string, CrmStageRow>();
    for (const s of stages) map.set(s.id, s);
    return map;
  }, [stages]);

  /* Anchor "now" once on mount so the urgency buckets stay stable
     across re-renders (and so the linter is happy about purity). */
  const [anchorTs] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });

  /* Bucket activities by urgency. */
  const buckets = useMemo(() => {
    const startOfToday = anchorTs;
    const startOfTomorrow = startOfToday + 86_400_000;
    const startOfDayAfter = startOfTomorrow + 86_400_000;
    const startOfNextWeek = startOfToday + 7 * 86_400_000;

    const overdue: ActivityFeedRow[] = [];
    const today: ActivityFeedRow[] = [];
    const tomorrow: ActivityFeedRow[] = [];
    const week: ActivityFeedRow[] = [];
    const later: ActivityFeedRow[] = [];

    for (const a of feed) {
      if (a.done_at) continue;
      if (!a.due_at) {
        later.push(a);
        continue;
      }
      const ts = new Date(a.due_at).getTime();
      if (ts < startOfToday) overdue.push(a);
      else if (ts < startOfTomorrow) today.push(a);
      else if (ts < startOfDayAfter) tomorrow.push(a);
      else if (ts < startOfNextWeek) week.push(a);
      else later.push(a);
    }

    return [
      { id: "overdue", label: t("act.feed.overdue"), tone: "overdue" as const, items: overdue },
      { id: "today", label: t("act.feed.today"), tone: "today" as const, items: today },
      { id: "tomorrow", label: t("act.feed.tomorrow"), tone: "default" as const, items: tomorrow },
      { id: "week", label: t("act.feed.thisWeek"), tone: "default" as const, items: week },
      { id: "later", label: t("act.feed.later"), tone: "default" as const, items: later },
    ];
  }, [feed, t, anchorTs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--text-dim)]" />
      </div>
    );
  }

  const total = buckets.reduce((acc, b) => acc + b.items.length, 0);
  if (total === 0) {
    return (
      <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-12 text-center">
        <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
          <Inbox className="h-6 w-6 text-emerald-500" />
        </div>
        <p className="text-[var(--text-primary)] text-[14px] font-semibold">
          {t("act.feed.empty")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {buckets.map((bucket) => {
        if (bucket.items.length === 0) return null;
        return (
          <div key={bucket.id}>
            <div
              className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${
                bucket.tone === "overdue"
                  ? "text-red-500"
                  : bucket.tone === "today"
                    ? "text-amber-500"
                    : "text-[var(--text-dim)]"
              }`}
            >
              {bucket.label} · {bucket.items.length}
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden">
              {bucket.items.map((a) => {
                const due = relativeDate(a.due_at);
                const stage = a.opportunity?.stage_id
                  ? stageById.get(a.opportunity.stage_id) ?? null
                  : null;
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
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      if (a.opportunity?.id) onOpenOpportunity(a.opportunity.id);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-[var(--bg-surface)] transition-colors flex items-start gap-3"
                  >
                    <div className="h-7 w-7 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="h-3.5 w-3.5 text-[var(--text-dim)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                        {a.title}
                      </div>
                      <div className="text-[11.5px] text-[var(--text-dim)] truncate">
                        {a.opportunity?.name ?? "—"}
                        {a.opportunity?.company_name && (
                          <> · {a.opportunity.company_name}</>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {stage && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[9.5px] font-bold text-[var(--text-dim)] uppercase tracking-wider">
                          {stage.name}
                        </span>
                      )}
                      <span
                        className={`text-[10.5px] font-semibold ${
                          due.tone === "overdue"
                            ? "text-red-500"
                            : due.tone === "soon"
                              ? "text-amber-500"
                              : "text-[var(--text-ghost)]"
                        }`}
                      >
                        {due.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Generate Leads modal — wizard to seed sample opportunities into a stage
   ════════════════════════════════════════════════════════════════════════ */

function GenerateLeadsModal({
  stages,
  onClose,
  onGenerate,
  t,
}: {
  stages: CrmStageRow[];
  onClose: () => void;
  onGenerate: (input: {
    count: number;
    stageId: string | null;
    source: string | null;
  }) => Promise<{ ok: true; created: number } | { ok: false; error: string }>;
  t: (key: string) => string;
}) {
  const [count, setCount] = useState(5);
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [source, setSource] = useState("Sample data");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<number | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  async function handleGenerate() {
    setError(null);
    setBusy(true);
    const res = await onGenerate({
      count,
      stageId: stageId || null,
      source: source.trim() || null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSuccess(res.created);
    setTimeout(() => onClose(), 900);
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-[210] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-[var(--bg-primary)] w-full max-w-md rounded-2xl border border-[var(--border-subtle)] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--text-dim)]" />
            <h2 className="text-[15px] font-bold text-[var(--text-primary)]">
              {t("gen.title")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-surface)] text-[var(--text-dim)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-[12.5px] text-[var(--text-dim)] leading-relaxed">
            {t("gen.subtitle")}
          </p>

          <Field label={t("gen.count")}>
            <input
              type="number"
              min="1"
              max="16"
              step="1"
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(16, Number(e.target.value) || 1)))}
              className={inputClass}
            />
          </Field>

          <Field label={t("gen.stage")}>
            <select
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              className={inputClass + " [color-scheme:dark]"}
            >
              <option value="">{t("card.unassigned")}</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("gen.source")}>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className={inputClass}
            />
          </Field>

          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[12px] text-red-500 font-medium">
              {error}
            </div>
          )}
          {success !== null && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[12px] text-emerald-500 font-medium">
              {t("gen.success")} ({success})
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-[12.5px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)]"
          >
            {t("form.cancel")}
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy || count < 1}
            className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12.5px] font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("gen.create")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Stage edit modal — create or edit a kanban stage
   ════════════════════════════════════════════════════════════════════════ */

function StageEditModal({
  stage,
  existingStages,
  onClose,
  onSaved,
  t,
}: {
  stage: CrmStageRow | null;
  existingStages: CrmStageRow[];
  onClose: () => void;
  onSaved: () => void;
  t: (key: string) => string;
}) {
  const isNew = !stage;
  const [name, setName] = useState(stage?.name ?? "");
  const [sequence, setSequence] = useState(
    String(stage?.sequence ?? (existingStages[existingStages.length - 1]?.sequence ?? 0) + 10),
  );
  const [isWon, setIsWon] = useState(stage?.is_won ?? false);
  const [fold, setFold] = useState(stage?.fold ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setBusy(true);
    setError(null);
    if (isNew) {
      const created = await createStage({
        name: name.trim(),
        sequence: Number(sequence) || 0,
        is_won: isWon,
        fold,
      });
      setBusy(false);
      if (!created) {
        setError("Failed to create stage");
        return;
      }
    } else {
      const ok = await updateStage(stage!.id, {
        name: name.trim(),
        sequence: Number(sequence) || 0,
        is_won: isWon,
        fold,
      });
      setBusy(false);
      if (!ok) {
        setError("Failed to save stage");
        return;
      }
    }
    onSaved();
  }

  async function handleDelete() {
    if (!stage) return;
    if (!confirm(t("stage.edit.deleteConfirm"))) return;
    setBusy(true);
    const ok = await deleteStage(stage.id);
    setBusy(false);
    if (!ok) {
      setError("Failed to delete stage");
      return;
    }
    onSaved();
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-[210] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-[var(--bg-primary)] w-full max-w-md rounded-2xl border border-[var(--border-subtle)] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-subtle)]">
          <h2 className="text-[15px] font-bold text-[var(--text-primary)]">
            {t("stage.edit.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-surface)] text-[var(--text-dim)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <Field label={t("stage.edit.name")}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              autoFocus
            />
          </Field>

          <Field label={t("stage.edit.sequence")}>
            <input
              type="number"
              value={sequence}
              onChange={(e) => setSequence(e.target.value)}
              className={inputClass}
            />
          </Field>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isWon}
              onChange={(e) => setIsWon(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border-color)]"
            />
            <span className="text-[12.5px] text-[var(--text-primary)] font-semibold">
              {t("stage.edit.isWon")}
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={fold}
              onChange={(e) => setFold(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border-color)]"
            />
            <span className="text-[12.5px] text-[var(--text-primary)] font-semibold">
              {t("stage.edit.fold")}
            </span>
          </label>

          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[12px] text-red-500 font-medium">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          {!isNew ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="inline-flex items-center gap-1 h-9 px-3 rounded-lg text-[12px] font-semibold text-red-500 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("stage.edit.delete")}
            </button>
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
              disabled={busy || !name.trim()}
              className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12.5px] font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("stage.edit.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Reporting page — KPI tiles + breakdowns by stage / source / owner
   ════════════════════════════════════════════════════════════════════════ */

function ReportingPage({
  opps,
  stages,
  loading,
  t,
}: {
  opps: CrmOpportunityWithRelations[];
  stages: CrmStageRow[];
  loading: boolean;
  t: (key: string) => string;
}) {
  const data = useMemo(() => {
    const open = opps.filter((o) => !o.won_at && !o.lost_at);
    const won = opps.filter((o) => o.won_at);
    const lost = opps.filter((o) => o.lost_at);

    const pipelineValue = open.reduce(
      (acc, o) => acc + (Number(o.expected_revenue) || 0),
      0,
    );
    const weighted = open.reduce(
      (acc, o) =>
        acc +
        ((Number(o.expected_revenue) || 0) * (Number(o.probability) || 0)) /
          100,
      0,
    );
    const avgDeal = open.length > 0 ? pipelineValue / open.length : 0;
    const closed = won.length + lost.length;
    const winRate = closed > 0 ? (won.length / closed) * 100 : 0;

    /* Average sales cycle: days between created_at and won_at, for won
       deals with both timestamps. */
    let cycleSum = 0;
    let cycleCount = 0;
    for (const o of won) {
      if (!o.won_at) continue;
      const created = new Date(o.created_at).getTime();
      const wonAt = new Date(o.won_at).getTime();
      if (Number.isNaN(created) || Number.isNaN(wonAt)) continue;
      cycleSum += (wonAt - created) / 86_400_000;
      cycleCount += 1;
    }
    const avgCycle = cycleCount > 0 ? Math.round(cycleSum / cycleCount) : 0;

    /* By-stage breakdown */
    type Bucket = { key: string; label: string; count: number; value: number };
    const byStage = new Map<string, Bucket>();
    for (const s of stages) byStage.set(s.id, { key: s.id, label: s.name, count: 0, value: 0 });
    for (const o of open) {
      const id = o.stage?.id ?? "__nostage__";
      const label = o.stage?.name ?? "Unassigned";
      const existing = byStage.get(id) ?? { key: id, label, count: 0, value: 0 };
      existing.count += 1;
      existing.value += Number(o.expected_revenue) || 0;
      byStage.set(id, existing);
    }
    const stageRows = Array.from(byStage.values()).sort(
      (a, b) => b.value - a.value,
    );

    /* By source */
    const bySource = new Map<string, Bucket>();
    for (const o of opps) {
      const key = (o.source && o.source.trim()) || "—";
      const existing = bySource.get(key) ?? { key, label: key, count: 0, value: 0 };
      existing.count += 1;
      existing.value += Number(o.expected_revenue) || 0;
      bySource.set(key, existing);
    }
    const sourceRows = Array.from(bySource.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    /* By owner */
    const byOwner = new Map<string, Bucket>();
    for (const o of opps) {
      const owner = o.owner;
      const key = owner?.id ?? "__unassigned__";
      const label = owner?.full_name || owner?.username || t("card.unassigned");
      const existing = byOwner.get(key) ?? { key, label, count: 0, value: 0 };
      existing.count += 1;
      existing.value += Number(o.expected_revenue) || 0;
      byOwner.set(key, existing);
    }
    const ownerRows = Array.from(byOwner.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    return {
      open: open.length,
      pipelineValue,
      weighted,
      avgDeal,
      winRate,
      avgCycle,
      stageRows,
      sourceRows,
      ownerRows,
    };
  }, [opps, stages, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--text-dim)]" />
      </div>
    );
  }

  const kpis = [
    { label: t("rep.kpi.opps"), value: String(data.open), icon: TrendingUp },
    { label: t("rep.kpi.value"), value: formatCurrency(data.pipelineValue), icon: LayoutGrid },
    { label: t("rep.kpi.weighted"), value: formatCurrency(data.weighted), icon: Activity },
    { label: t("rep.kpi.avg"), value: formatCurrency(data.avgDeal), icon: ChartPie },
    { label: t("rep.kpi.winrate"), value: `${data.winRate.toFixed(0)}%`, icon: CheckCircle2 },
    { label: t("rep.kpi.cycle"), value: `${data.avgCycle} ${t("rep.kpi.days")}`, icon: Clock },
  ];

  const maxStage = Math.max(1, ...data.stageRows.map((r) => r.value));
  const maxSource = Math.max(1, ...data.sourceRows.map((r) => r.value));
  const maxOwner = Math.max(1, ...data.ownerRows.map((r) => r.value));

  return (
    <div className="space-y-5">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]"
          >
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] mb-1.5">
              <k.icon className="h-3.5 w-3.5" />
              {k.label}
            </div>
            <div className="text-[20px] md:text-[22px] font-bold text-[var(--text-primary)] tabular-nums leading-tight">
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* By stage + by source */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportBlock title={t("rep.byStage")} rows={data.stageRows} max={maxStage} />
        <ReportBlock title={t("rep.bySource")} rows={data.sourceRows} max={maxSource} />
      </div>

      {/* By owner */}
      <ReportBlock title={t("rep.byOwner")} rows={data.ownerRows} max={maxOwner} />
    </div>
  );
}

function ReportBlock({
  title,
  rows,
  max,
}: {
  title: string;
  rows: Array<{ key: string; label: string; count: number; value: number }>;
  max: number;
}) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-4 md:p-5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] mb-3">
        {title}
      </div>
      {rows.length === 0 ? (
        <p className="text-[12px] text-[var(--text-ghost)] italic py-2">
          No data
        </p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => {
            const pct = (r.value / max) * 100;
            return (
              <div key={r.key}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                    {r.label}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] tabular-nums shrink-0">
                    <span className="text-[var(--text-ghost)]">{r.count}</span>
                    <span className="text-[var(--text-primary)] font-bold">
                      {formatCurrency(r.value)}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-surface-subtle)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--accent-primary,#5b7cff)]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Configuration page — manage stages
   ════════════════════════════════════════════════════════════════════════ */

function ConfigurationPage({
  stages,
  opps,
  loading,
  onAddStage,
  onEditStage,
  onToggleFold,
  onDeleteStage,
  t,
}: {
  stages: CrmStageRow[];
  opps: CrmOpportunityWithRelations[];
  loading: boolean;
  onAddStage: () => void;
  onEditStage: (id: string) => void;
  onToggleFold: (stage: CrmStageRow) => void;
  onDeleteStage: (stage: CrmStageRow) => void;
  t: (key: string) => string;
}) {
  const countsByStage = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of opps) {
      if (!o.stage_id) continue;
      map.set(o.stage_id, (map.get(o.stage_id) ?? 0) + 1);
    }
    return map;
  }, [opps]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--text-dim)]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
        <div className="flex items-start justify-between gap-3 p-4 md:p-5 border-b border-[var(--border-subtle)]">
          <div>
            <div className="text-[14px] font-bold text-[var(--text-primary)]">
              {t("cfg.stages")}
            </div>
            <div className="text-[12px] text-[var(--text-dim)] mt-0.5">
              {t("cfg.stagesHint")}
            </div>
          </div>
          <button
            type="button"
            onClick={onAddStage}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90 transition-all shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("cfg.addStage")}
          </button>
        </div>
        <div className="divide-y divide-[var(--border-subtle)]">
          {stages.length === 0 ? (
            <p className="text-[12.5px] text-[var(--text-ghost)] italic p-5 text-center">
              No stages defined. Add your first stage to start building the pipeline.
            </p>
          ) : (
            stages.map((s) => {
              const count = countsByStage.get(s.id) ?? 0;
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 p-3 md:p-4 hover:bg-[var(--bg-surface)] transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        s.is_won ? "bg-emerald-500" : "bg-[var(--text-ghost)]"
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-[var(--text-primary)] truncate">
                        {s.name}
                      </div>
                      <div className="text-[10.5px] text-[var(--text-dim)] mt-0.5 flex items-center gap-2">
                        <span>seq {s.sequence}</span>
                        {s.is_won && (
                          <span className="text-emerald-500 font-semibold">
                            won stage
                          </span>
                        )}
                        {s.fold && (
                          <span className="text-[var(--text-ghost)] font-semibold">
                            folded
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-[var(--text-dim)] tabular-nums shrink-0">
                    {count} {count === 1 ? "deal" : "deals"}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleFold(s)}
                      className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                      title={s.fold ? t("stage.menu.unfold") : t("stage.menu.fold")}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditStage(s.id)}
                      className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                      title={t("stage.menu.edit")}
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteStage(s)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10"
                      title={t("stage.menu.delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
