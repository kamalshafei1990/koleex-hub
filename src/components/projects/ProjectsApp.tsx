"use client";

/* ---------------------------------------------------------------------------
   ProjectsApp — Odoo-Project-style app in Hub's visual language.

   Views:
     • Projects        — grid of project cards, click to drill into detail
                         (archived projects: Archived filter, Restore)
     • Project detail  — Board / List / Timeline (Gantt) of the project's
                         tasks, shared filters + saved filters, multi-select
                         bulk actions, quick-add per column, members drawer,
                         project chat, budget vs actual meter
     • My Tasks        — flat list across all projects, filtered to me, with
                         the "due today & overdue" strip on top
     • All Tasks       — flat list across all projects
     • Reporting       — KPI strip + progress / priority / assignee breakdown
     • Configuration   — tag CRUD

   Deep links: /projects?project=<id>[&task=<id>] opens that project's board
   (and that task's editor). The open project lives IN THE URL, so the
   browser Back button, notification links and the EntityTasksStrip rows all
   land in the right place, even while the app is already open.

   Reporting, the editors and the task panels are loaded on demand.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useConfirm } from "@/components/kds/useConfirm";
import { useToast } from "@/components/kds/useToast";
import { useTranslation } from "@/lib/i18n";
import { usePermissions } from "@/lib/permissions";
import { getCurrentAccountIdSync } from "@/lib/identity";
import { projectsT } from "@/lib/translations/projects";
import { useTabMotion } from "@/components/ui/useTabMotion";
import { DEFAULT_MAX_AGE_MS, useWarmData } from "@/lib/warm-cache";
import { progressPct } from "@/lib/project-progress";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import StarIcon from "@/components/icons/ui/StarIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import CogIcon from "@/components/icons/ui/CogIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import CheckSquareIcon from "@/components/icons/ui/CheckSquareIcon";
import ListTodoIcon from "@/components/icons/ui/ListTodoIcon";
import LinkIcon from "@/components/icons/ui/LinkIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { ArchiveIcon, GanttChartIcon, MessageSquareIcon, UndoIcon, UsersIcon } from "@/components/icons/ui";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import ProjectsIcon from "@/components/icons/ProjectsIcon";
import PageHeader from "@/components/ui/PageHeader";
import AppHomeMenu from "@/components/ui/AppHomeMenu";
import Button from "@/components/ui/Button";
import { useSearchPlaceholder } from "@/lib/searchPlaceholders";
import EntityPlanningStrip from "@/components/planning/EntityPlanningStrip";
import {
  applyTaskFilter,
  BulkBar,
  DueTodayStrip,
  filterDefaults,
  QuickAddTask,
  SelectBox,
  TaskFilterBar,
  useAccounts,
  useBulkRunner,
  useTaskSelection,
  type TaskFilterState,
} from "./TaskToolkit";
import { BudgetMeter, budgetSummary, sumLoggedHours } from "./ProjectBudget";
import type { DatePatch } from "./ProjectTimeline";
import {
  accountLabel,
  archiveProject,
  createStage,
  createTag,
  deleteStage,
  deleteTag,
  duplicateProject,
  fetchAccounts,
  fetchProjectById,
  fetchProjectList,
  fetchStages,
  fetchTagsStrict,
  fetchTasks,
  formatDMY,
  formatDueDate,
  isOverdue,
  openProjectBoardChannel,
  openProjectChat,
  PRIORITY_COLOR,
  ProjectsApiError,
  reorderTasks,
  restoreProject,
  updateProject,
  updateStage,
  updateTag,
  updateTask,
  type AccountLite,
  type ProjectRow,
  type ProjectStage,
  type ProjectStatus,
  type ProjectTag,
  type TaskRow,
  type TaskStatus,
} from "@/lib/projects";

const ProjectsReporting = dynamic(() => import("./ProjectsReporting"), {
  ssr: false,
  loading: () => <CenteredSpinner />,
});
const ProjectFormModal = dynamic(() => import("./ProjectModals").then((m) => m.ProjectFormModal), { ssr: false });
const TaskFormModal = dynamic(() => import("./ProjectModals").then((m) => m.TaskFormModal), { ssr: false });
const FlatTaskFormModal = dynamic(() => import("./ProjectModals").then((m) => m.FlatTaskFormModal), { ssr: false });
const MilestoneStrip = dynamic(() => import("./TaskExtras").then((m) => m.MilestoneStrip), { ssr: false });
const ProjectTimeline = dynamic(() => import("./ProjectTimeline"), { ssr: false, loading: () => <CenteredSpinner /> });
const ProjectMembersPanel = dynamic(() => import("./ProjectMembersPanel"), { ssr: false });

type TabId = "projects" | "mine" | "all" | "reporting" | "config";

/* Strip order — feeds the directional tab motion (kx-tab-fwd / kx-tab-back). */
const TAB_ORDER: TabId[] = ["projects", "mine", "all", "reporting", "config"];

/** Hub Blue — the fallback colour for a project without one. */
const HUB_BLUE = "#567FB2";
const UNSTAGED = "__unstaged__";

/* Segmented-control states. kx-seg-on / kx-seg-off are the Aurora
   selection grammar (Hub Blue outline); on Core they are inert and the
   solid inverted pill below shows through. */
const chipOn = "kx-seg-on bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent";
const chipOff = "kx-seg-off bg-transparent border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]";
/* Hover-revealed controls: also on keyboard focus, always on touch widths. */
const revealCls = "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity";

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const dueLabels = (t: (k: string) => string) => ({ today: t("date.today"), tomorrow: t("date.tomorrow"), yesterday: t("date.yesterday") });

function CenteredSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)]" />
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation(projectsT);
  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] py-12 text-center space-y-2">
      <div className="text-[13px] text-[var(--text-dim)]">{t("error.load")}</div>
      <button type="button" onClick={onRetry} className="h-8 px-3 rounded-lg border border-[var(--border-subtle)] text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        {t("btn.retry")}
      </button>
    </div>
  );
}

export default function ProjectsApp() {
  const { t } = useTranslation(projectsT);
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeProjectId = searchParams.get("project");
  const deepTaskId = searchParams.get("task");
  const searchPlaceholder = useSearchPlaceholder("projects");
  const [tab, setTab] = useState<TabId>("projects");
  const tabMotion = useTabMotion(TAB_ORDER.indexOf(tab));
  /* Lifted so the AppHomeMenu search bar can drive the Projects list. */
  const [projectSearch, setProjectSearch] = useState("");

  // Shared tag cache — warm-started, consumed by every task card.
  const { data: tagsData, reload: reloadTags } = useWarmData<ProjectTag[]>("projects:tags", fetchTagsStrict);
  const tags = tagsData ?? [];

  const openProject = useCallback((id: string) => {
    router.push(`/projects?project=${id}`, { scroll: false });
  }, [router]);

  if (activeProjectId) {
    return (
      <ProjectDetailView
        key={activeProjectId}
        projectId={activeProjectId}
        deepTaskId={deepTaskId}
        tags={tags}
        onBack={() => router.push("/projects", { scroll: false })}
      />
    );
  }

  return (
    <div className="h-full bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden w-full">
      {/* Page header — canonical Hub PageHeader + state tab strip */}
      <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] z-10 w-full overflow-x-hidden">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 min-w-0 pt-5 pb-3">
          <PageHeader
            title={t("app.title")}
            subtitle={t("app.subtitle")}
            icon={<ProjectsIcon className="h-4 w-4" />}
            showTabs={false}
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-4 min-w-0 space-y-4">
          {/* Brand-aligned tile menu + search — same across every Hub app.
              Submitting the search filters the Projects list. */}
          <AppHomeMenu
            navItems={[
              { key: "projects",  onClick: () => setTab("projects"),  active: tab === "projects",  icon: <LayoutGridIcon size={13} />,  label: t("tab.projects")      },
              { key: "mine",      onClick: () => setTab("mine"),      active: tab === "mine",      icon: <CheckSquareIcon size={13} />, label: t("tab.myTasks")       },
              { key: "all",       onClick: () => setTab("all"),       active: tab === "all",       icon: <ListTodoIcon size={13} />,    label: t("tab.allTasks")      },
              { key: "reporting", onClick: () => setTab("reporting"), active: tab === "reporting", icon: <BarChart3Icon size={13} />,   label: t("tab.reporting")     },
              { key: "config",    onClick: () => setTab("config"),    active: tab === "config",    icon: <CogIcon size={13} />,         label: t("tab.configuration") },
            ]}
            searchPlaceholder={searchPlaceholder}
            onSearchSubmit={(term) => { setTab("projects"); setProjectSearch(term); }}
          />

          <div key={tab} className={tabMotion}>
            {tab === "projects" && (
              <ProjectsListView search={projectSearch} onSearchChange={setProjectSearch} onOpenProject={openProject} />
            )}
            {tab === "mine" && <TasksListView mine tags={tags} />}
            {tab === "all" && <TasksListView mine={false} tags={tags} />}
            {tab === "reporting" && <ProjectsReporting />}
            {tab === "config" && <ConfigurationView tags={tags} reloadTags={reloadTags} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PROJECTS LIST — grid of cards
   ══════════════════════════════════════════════════════════════════ */

type StatusFilter = ProjectStatus | "all";

function ProjectsListView({
  search,
  onSearchChange,
  onOpenProject,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  onOpenProject: (id: string) => void;
}) {
  const { t } = useTranslation(projectsT);
  const { showToast, toastElement } = useToast();
  const { isSuperAdmin: isSA } = usePermissions();
  const meId = getCurrentAccountIdSync();
  /* SA audience lens — "own" | "all" | account_id (mirrors To-do's lens). */
  const [saView, setSaView] = useState<string>("own");
  const [lensAccounts, setLensAccounts] = useState<AccountLite[]>([]);
  useEffect(() => {
    if (isSA) fetchAccounts().then(setLensAccounts);
  }, [isSA]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  /* 300ms debounce: typing does not fire a request per keystroke. */
  const [debounced, setDebounced] = useState(search.trim());
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const involves = isSA && saView !== "own" && saView !== "all" ? saView : undefined;
  /* Warm only the DEFAULT view — a filtered answer must never repaint as
     the whole list on the next visit (warm-cache rule). */
  const warmKey = statusFilter === "active" && !debounced && !involves ? "projects:list:v2" : "";
  const loadList = useCallback(
    () => fetchProjectList({ status: statusFilter, search: debounced || undefined, involves }),
    [statusFilter, debounced, involves],
  );
  /* staleMs 0: always revalidate on mount — the warm copy paints at once,
     and a write made on the board is reflected when you come back. */
  const { data, loading, error, reload } = useWarmData(warmKey, loadList, DEFAULT_MAX_AGE_MS, 0);
  const projects = useMemo(() => data?.projects ?? [], [data]);
  const counts = data?.counts;

  /* "My view" for a super admin = projects they manage, created, or hold a
     task in (server-computed `involved`). Everyone else is already scoped. */
  const scopedProjects = useMemo(
    () => (isSA && saView === "own" ? projects.filter((p) => p.involved !== false) : projects),
    [projects, isSA, saView],
  );

  const run = async (id: string, fn: () => Promise<unknown>) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await fn();
      await reload();
    } catch (e) {
      showToast(t("toast.saveFailed").replace("{err}", errText(e)), "error");
    } finally {
      setBusyId(null);
    }
  };

  const chipLabel = (s: StatusFilter) => {
    const n = (k: ProjectStatus) => (counts ? ` (${counts[k]})` : "");
    if (s === "active") return `${t("filter.active")}${n("active")}`;
    if (s === "on_hold") return `${t("filter.onHold")}${n("on_hold")}`;
    if (s === "completed") return `${t("filter.completed")}${n("completed")}`;
    if (s === "archived") return `${t("filter.archived")}${n("archived")}`;
    return t("filter.all");
  };

  return (
    <div className="space-y-4">
      {toastElement}
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <SearchIcon size={13} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("form.name")}
            aria-label={t("tip.searchProjects")}
            className="h-9 w-full ps-8 pe-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none" role="group" aria-label={t("form.status")}>
          {(["active", "on_hold", "completed", "archived", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              aria-pressed={statusFilter === s}
              className={`h-7 px-3 rounded-full text-[11px] font-semibold border whitespace-nowrap transition-colors ${statusFilter === s ? chipOn : chipOff}`}
            >
              {chipLabel(s)}
            </button>
          ))}
        </div>
        {isSA && (
          <select value={saView} onChange={(e) => setSaView(e.target.value)} aria-label={t("sa.viewOwn")}
            className={`h-8 ps-3 pe-7 rounded-full text-[11px] font-semibold border outline-none cursor-pointer appearance-none ${
              saView === "own"
                ? "bg-transparent border-[var(--border-subtle)] text-[var(--text-dim)]"
                : "bg-[var(--bg-surface-active)] border-[var(--border-color)] text-[var(--text-primary)]"
            }`}>
            <option value="own">{t("sa.viewOwn")}</option>
            <option value="all">{t("sa.viewAll")}</option>
            {lensAccounts.filter((a) => a.id !== meId).map((a) => (
              <option key={a.id} value={a.id}>{accountLabel(a)}</option>
            ))}
          </select>
        )}
        <div className="flex-1" />
        <Button onClick={() => { setEditingProject(null); setFormOpen(true); }} icon={<PlusIcon size={12} />}>
          {t("action.newProject")}
        </Button>
      </div>

      {/* Grid */}
      {loading ? (
        <CenteredSpinner />
      ) : error && !data ? (
        <LoadError onRetry={() => { void reload(); }} />
      ) : scopedProjects.length === 0 ? (
        <div className="kx-glass rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] py-14 text-center">
          {projects.length > 0 || debounced || statusFilter !== "active" ? (
            <div className="text-[13px] text-[var(--text-dim)]">{t("empty.noMatch")}</div>
          ) : (
            <>
              <div className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">{t("empty.noProjects")}</div>
              <div className="text-[12px] text-[var(--text-dim)]">{t("empty.addFirst")}</div>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {scopedProjects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              busy={busyId === p.id}
              onOpen={() => onOpenProject(p.id)}
              onEdit={() => { setEditingProject(p); setFormOpen(true); }}
              onToggleFavourite={() => run(p.id, () => updateProject(p.id, { is_favorite: !p.is_favorite }))}
              onDuplicate={() => run(p.id, () => duplicateProject(p))}
              onRestore={p.status === "archived" ? () => run(p.id, async () => {
                await restoreProject(p.id);
                showToast(t("restore.done"), "success");
              }) : undefined}
            />
          ))}
        </div>
      )}

      {formOpen && (
        <ProjectFormModal
          key={editingProject?.id ?? "new"}
          editing={editingProject}
          onClose={() => { setFormOpen(false); setEditingProject(null); }}
          onSaved={() => { setFormOpen(false); setEditingProject(null); void reload(); }}
          onDeleted={() => { setFormOpen(false); setEditingProject(null); void reload(); }}
        />
      )}
    </div>
  );
}

function ProjectCard({
  project,
  busy,
  onOpen,
  onEdit,
  onToggleFavourite,
  onDuplicate,
  onRestore,
}: {
  project: ProjectRow;
  busy: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onToggleFavourite: () => void;
  onDuplicate: () => void;
  /** Archived cards only. */
  onRestore?: () => void;
}) {
  const { t } = useTranslation(projectsT);
  /* Server-side counts (GET /api/projects) — no task download. Progress is
     the shared rule: top-level, non-cancelled; 0 when there are none. */
  const c = project.task_counts ?? { open: 0, overdue: 0, done: 0, total: 0 };
  const progress = progressPct(c.done, c.total);
  const color = project.color ?? HUB_BLUE;
  const customerName = project.customer?.display_name ?? project.customer?.company_name;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) onOpen(); }}
      /* Leaf card → kx-glass. The remap already made it translucent; without
         the frost its text sits directly on the moving ground. Remap and
         frost are two steps, not one. */
      className={`kx-glass group cursor-pointer rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-subtle)] transition-all overflow-hidden ${busy ? "opacity-60 pointer-events-none" : ""}`}
    >
      {/* Colour stripe */}
      <div className="h-1" style={{ background: color }} />

      <div className="p-4 space-y-3">
        <div className="flex items-start gap-2 min-w-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleFavourite(); }}
            className="h-7 w-7 shrink-0 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-amber-400 transition-colors"
            aria-label={t("tip.favourite")}
            aria-pressed={project.is_favorite}
          >
            <StarIcon size={14} className={project.is_favorite ? "text-amber-400 fill-amber-400" : ""} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold text-[var(--text-primary)] truncate">
              <AutoTranslatedText text={project.name} />
            </div>
            <div className="text-[11px] text-[var(--text-dim)] truncate">
              {customerName ?? t("card.noCustomer")}{project.code ? ` · ${project.code}` : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            title={t("action.duplicate", "Duplicate project")}
            aria-label={t("action.duplicate", "Duplicate project")}
            className={`h-7 w-7 shrink-0 ${revealCls} rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)]`}
          >
            <CopyIcon className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            title={t("tip.editProject")}
            aria-label={t("tip.editProject")}
            className={`h-7 w-7 shrink-0 ${revealCls} rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)]`}
          >
            <PencilIcon className="h-3 w-3" />
          </button>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)] mb-1">
            <span>{progress}%</span>
            <span className="tabular-nums">{c.done} / {c.total}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[var(--bg-surface)] overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: color }} />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
          {project.status === "archived" && (
            <span className="px-2 py-0.5 rounded-full bg-[var(--bg-surface)] text-[var(--text-dim)] font-semibold inline-flex items-center gap-1">
              <ArchiveIcon size={10} />
              {project.archived_at ? t("archive.since").replace("{date}", formatDMY(project.archived_at)) : t("filter.archived")}
            </span>
          )}
          <span className="px-2 py-0.5 rounded-full bg-[var(--bg-surface)] text-[var(--text-muted)] font-semibold">
            {c.open} {c.open === 1 ? t("card.taskSingular") : t("card.tasks")}
          </span>
          {c.overdue > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-semibold">
              {c.overdue} {t("card.overdue")}
            </span>
          )}
          {onRestore && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRestore(); }}
              className="ms-auto h-6 px-2 rounded-full border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-semibold inline-flex items-center gap-1"
            >
              <UndoIcon size={10} /> {t("action.restore")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PROJECT DETAIL — kanban of stages × tasks
   ══════════════════════════════════════════════════════════════════ */

function ProjectDetailView({
  projectId,
  deepTaskId,
  tags,
  onBack,
}: {
  projectId: string;
  deepTaskId: string | null;
  tags: ProjectTag[];
  onBack: () => void;
}) {
  const { askConfirm, confirmDialog } = useConfirm();
  const { showToast, toastElement } = useToast();
  const { t, lang } = useTranslation(projectsT);
  const router = useRouter();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [taskModal, setTaskModal] = useState<{ open: boolean; editing: TaskRow | null; presetStageId?: string | null }>({ open: false, editing: null });
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dropBeforeId, setDropBeforeId] = useState<string | null>(null);
  const [newStageName, setNewStageName] = useState("");
  const [addingStage, setAddingStage] = useState(false);
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"board" | "list" | "timeline">("board");
  const [billing, setBilling] = useState(false);
  const accounts = useAccounts();
  const [filter, setFilter] = useState<TaskFilterState>(() => filterDefaults("all"));
  const [membersOpen, setMembersOpen] = useState(false);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const fail = useCallback(
    (key: "toast.saveFailed" | "toast.deleteFailed" | "toast.moveFailed", e: unknown) => {
      const msg = e instanceof ProjectsApiError && e.code === "last_stage" ? t("stage.lastStage") : errText(e);
      showToast(t(key).replace("{err}", msg), "error");
    },
    [showToast, t],
  );

  const load = useCallback(async (silent = false) => {
    try {
      const [proj, stgs, tks] = await Promise.all([
        fetchProjectById(projectId),
        fetchStages(projectId),
        fetchTasks({ project_id: projectId, status: "all", limit: 2000 }),
      ]);
      setProject(proj);
      setStages(stgs);
      setTasks(tks);
      setState("ready");
    } catch {
      /* A failed background refresh keeps the board as it is. */
      if (!silent) setState("error");
    }
  }, [projectId]);

  /* Broadcast channel handle — lets a write ping other open boards. */
  const boardChannel = useRef<{ signal: () => void; close: () => void } | null>(null);

  /* After a write: quiet refetch (no spinner) + ping teammates' boards. */
  const refresh = useCallback(async () => {
    await load(true);
    boardChannel.current?.signal();
  }, [load]);

  useEffect(() => {
    void load(false);
  }, [load]);

  /* Background refresh must never fight the user. It is skipped while an
     editor is open (the form would otherwise receive new props mid-edit),
     while a drag/reorder is in flight, and while the tab is hidden. */
  const modalOpen = taskModal.open || projectFormOpen || membersOpen;
  const pauseRef = useRef({ modal: false, reordering: false });
  useEffect(() => {
    pauseRef.current.modal = modalOpen;
  }, [modalOpen]);
  const quietRefresh = useCallback(() => {
    if (typeof document !== "undefined" && document.hidden) return;
    if (pauseRef.current.modal || pauseRef.current.reordering) return;
    void load(true);
  }, [load]);

  /* Subscribe to the project's Broadcast channel: when a teammate edits the
     board, they ping and we silently refetch (carries no row data → safe).
     This is the primary sync path. */
  useEffect(() => {
    const h = openProjectBoardChannel(projectId, quietRefresh);
    boardChannel.current = h;
    return () => { h.close(); boardChannel.current = null; };
  }, [projectId, quietRefresh]);

  /* Safety-net poll every 60s (a missed broadcast, another device), plus
     immediately when the tab becomes visible again. */
  useEffect(() => {
    const id = window.setInterval(quietRefresh, 60_000);
    const onVis = () => { if (!document.hidden) quietRefresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [quietRefresh]);

  /* Deep link ?task=<id>: open that task's editor once the board is in.
     Adjusted during render (React's "derive from props" pattern) rather
     than in an effect, so it also reacts when a notification link targets
     another task while this board is already open. */
  const [seenDeepTask, setSeenDeepTask] = useState<string | null>(null);
  if (deepTaskId !== seenDeepTask) {
    if (!deepTaskId) setSeenDeepTask(null);
    else if (state === "ready") {
      setSeenDeepTask(deepTaskId);
      const tk = tasks.find((x) => x.id === deepTaskId);
      if (tk) setTaskModal({ open: true, editing: tk });
    }
  }
  const closeTaskModal = () => {
    setTaskModal({ open: false, editing: null });
    if (deepTaskId) router.replace(`/projects?project=${projectId}`, { scroll: false });
  };

  const stageIds = useMemo(() => new Set(stages.map((s) => s.id)), [stages]);
  /* Filters apply to every view (board, list, timeline) client-side — the
     board already holds every task of the project. */
  const visibleTasks = useMemo(() => applyTaskFilter(tasks, filter), [tasks, filter]);
  const tasksByStage = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    for (const tk of visibleTasks) {
      /* A task whose stage was deleted (FK SET NULL) — or points at a stage
         that no longer exists — goes to the Unstaged column instead of
         silently vanishing from the board. */
      const key = tk.stage_id && stageIds.has(tk.stage_id) ? tk.stage_id : UNSTAGED;
      const arr = map.get(key) ?? [];
      arr.push(tk);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
    }
    return map;
  }, [visibleTasks, stageIds]);
  const unstaged = tasksByStage.get(UNSTAGED) ?? [];

  /* Multi-select: visual order (Unstaged, then stage columns top→bottom),
     so a shift-click range is what the user sees between the two cards. */
  const orderedIds = useMemo(
    () => [UNSTAGED, ...stages.map((s) => s.id)].flatMap((k) => (tasksByStage.get(k) ?? []).map((tk) => tk.id)),
    [tasksByStage, stages],
  );
  const selection = useTaskSelection(orderedIds);
  const selectedIds = useMemo(() => [...selection.selected], [selection.selected]);
  const runBulk = useBulkRunner({ ids: selectedIds, onDone: refresh, clear: selection.clear, toast: showToast });
  const selecting = selection.count > 0;
  const { clear: clearSelection } = selection;
  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pauseRef.current.modal && !document.querySelector('[role="alertdialog"]')) clearSelection();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selecting, clearSelection]);

  /* Timeline drag/resize: optimistic, one PATCH (server validates
     start ≤ due), and on failure only THIS task's dates roll back. */
  const updateDates = useCallback(
    async (task: TaskRow, patch: DatePatch) => {
      setTasks((prev) => prev.map((tk) => (tk.id === task.id ? { ...tk, ...patch } : tk)));
      pauseRef.current.reordering = true;
      try {
        await updateTask(task.id, patch);
        pauseRef.current.reordering = false;
        await refresh();
      } catch (e) {
        setTasks((prev) => prev.map((tk) => (tk.id === task.id ? { ...tk, start_date: task.start_date ?? null, due_date: task.due_date } : tk)));
        fail("toast.saveFailed", e);
      } finally {
        pauseRef.current.reordering = false;
      }
    },
    [refresh, fail],
  );

  /* Reorder within (or across) a stage. `beforeTaskId` = the card the
     dragged task should land in front of, or null to append. Optimistic:
     the board moves at once, ONE request persists the whole column, and a
     failure rolls the board back and says so. */
  const handleReorder = useCallback(
    async (draggedId: string, targetStageId: string, beforeTaskId: string | null) => {
      const dragged = tasks.find((x) => x.id === draggedId);
      if (!dragged || dragged.id === beforeTaskId || pauseRef.current.reordering) return;
      const stage = stages.find((s) => s.id === targetStageId);
      const crossStage = (dragged.stage_id ?? null) !== targetStageId;
      const nextStatus: TaskStatus = crossStage && stage?.is_closed && dragged.status !== "cancelled"
        ? "done"
        : crossStage && !stage?.is_closed && dragged.status === "done"
          ? "open"
          : dragged.status;

      const col = tasks
        .filter((tk) => (tk.stage_id ?? null) === targetStageId && tk.id !== draggedId)
        .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
      const at = beforeTaskId ? col.findIndex((tk) => tk.id === beforeTaskId) : -1;
      col.splice(at < 0 ? col.length : at, 0, dragged);
      const order = new Map(col.map((tk, i) => [tk.id, i]));

      const snapshot = tasks;
      setTasks((prev) =>
        prev.map((tk) => {
          const i = order.get(tk.id);
          if (i === undefined) return tk;
          return tk.id === draggedId
            ? { ...tk, sort_order: i, stage_id: targetStageId, status: nextStatus }
            : { ...tk, sort_order: i };
        }),
      );

      pauseRef.current.reordering = true;
      try {
        await reorderTasks({ project_id: projectId, stage_id: targetStageId, ordered_ids: col.map((tk) => tk.id), moved_id: draggedId });
        pauseRef.current.reordering = false;
        await refresh();
      } catch (e) {
        setTasks(snapshot);
        fail("toast.moveFailed", e);
      } finally {
        pauseRef.current.reordering = false;
      }
    },
    [tasks, stages, projectId, refresh, fail],
  );

  const handleAddStage = async () => {
    if (!newStageName.trim() || addingStage) return;
    setAddingStage(true);
    try {
      await createStage(projectId, { name: newStageName.trim(), color: "#94a3b8", sort_order: stages.length });
      setNewStageName("");
      await refresh();
    } catch (e) {
      fail("toast.saveFailed", e);
    } finally {
      setAddingStage(false);
    }
  };

  const invoiceTime = () => askConfirm(t("bill.confirm", "Create a draft invoice for all unbilled logged time on this project?"), async () => {
    if (billing) return;
    setBilling(true);
    try {
      const res = await fetch("/api/invoices/from-project-time", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });
      const json = (await res.json().catch(() => null)) as
        | { invoice?: { inv_no: string }; hours?: number; error?: string }
        | null;
      if (!res.ok || !json?.invoice) {
        showToast(json?.error ?? `HTTP ${res.status}`, "error");
        setBilling(false);
        return;
      }
      showToast(t("bill.created").replace("{inv}", json.invoice.inv_no).replace("{h}", String(json.hours ?? 0)), "success");
      /* Let the confirmation be read before leaving the page. */
      window.setTimeout(() => router.push("/invoices"), 1600);
    } catch (e) {
      showToast(errText(e), "error");
      setBilling(false);
    }
  }, { confirmLabel: t("bill.do", "Create invoice"), tone: "neutral" });

  const openChat = async () => {
    if (chatBusy) return;
    setChatBusy(true);
    try {
      const channelId = await openProjectChat(projectId);
      router.push(`/discuss?channel=${channelId}`);
    } catch (e) {
      const msg = e instanceof ProjectsApiError && e.code === "not_migrated" ? t("chat.notAvailable") : t("toast.saveFailed").replace("{err}", errText(e));
      showToast(msg, "error");
      setChatBusy(false);
    }
  };

  const toggleArchive = (archived: boolean) => {
    const go = async () => {
      if (archiveBusy) return;
      setArchiveBusy(true);
      try {
        if (archived) await restoreProject(projectId);
        else await archiveProject(projectId);
        showToast(archived ? t("restore.done") : t("archive.done"), "success");
        await refresh();
      } catch (e) {
        fail("toast.saveFailed", e);
      } finally {
        setArchiveBusy(false);
      }
    };
    if (archived) void go();
    else askConfirm(t("archive.confirm"), go, { confirmLabel: t("action.archive"), tone: "neutral" });
  };

  if (state === "loading") {
    return (
      <div className="h-full bg-[var(--bg-primary)] flex items-center justify-center">
        <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)]" />
      </div>
    );
  }
  if (state === "error" || !project) {
    return (
      <div className="h-full bg-[var(--bg-primary)] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="text-[13px] text-[var(--text-dim)] max-w-sm">{t("error.projectLoad")}</div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="h-8 px-3 rounded-lg border border-[var(--border-subtle)] text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1.5">
            <ArrowLeftIcon className="h-3.5 w-3.5 rtl:-scale-x-100" /> {t("tip.back")}
          </button>
          <button type="button" onClick={() => { setState("loading"); void load(false); }} className="h-8 px-3 rounded-lg border border-[var(--border-subtle)] text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            {t("btn.retry")}
          </button>
        </div>
      </div>
    );
  }

  const customerName = project.customer?.display_name ?? project.customer?.company_name;
  const color = project.color ?? HUB_BLUE;
  const openTask = (tk: TaskRow) => setTaskModal({ open: true, editing: tk });
  const isArchived = project.status === "archived";
  const budget = budgetSummary(project, sumLoggedHours(tasks));
  const headerBtn = "h-8 px-2.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center gap-1 text-[11px] font-semibold shrink-0 disabled:opacity-50";
  const viewSwitch = (
    <div className="flex items-center rounded-lg border border-[var(--border-subtle)] overflow-hidden shrink-0" role="group" aria-label={`${t("view.board", "Board")} / ${t("view.list", "List")} / ${t("view.timeline")}`}>
      {(["board", "list", "timeline"] as const).map((m) => {
        const label = m === "board" ? t("view.board", "Board") : m === "list" ? t("view.list", "List") : t("view.timeline");
        return (
          <button
            key={m}
            type="button"
            onClick={() => setViewMode(m)}
            aria-pressed={viewMode === m}
            aria-label={label}
            className={`h-8 px-2.5 flex items-center gap-1 text-[11px] font-semibold transition-colors ${
              viewMode === m ? "kx-seg-on rounded-md bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "kx-seg-off rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)]"
            }`}
          >
            {m === "board" ? <LayoutGridIcon size={12} /> : m === "list" ? <ListTodoIcon size={12} /> : <GanttChartIcon size={12} />}
            <span className="hidden md:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );

  const listRow = (tk: TaskRow) => {
    const overdue = isOverdue(tk.due_date) && tk.status === "open";
    const due = formatDueDate(tk.due_date, lang, dueLabels(t));
    return (
      <div
        key={tk.id}
        role="button"
        tabIndex={0}
        onClick={() => openTask(tk)}
        onKeyDown={(e) => { if (e.key === "Enter") openTask(tk); }}
        className={`kx-glass flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border hover:border-[var(--border-focus)] cursor-pointer transition-colors ${
          selection.selected.has(tk.id) ? "border-[#567FB2]/60 bg-[#567FB2]/5" : "border-[var(--border-subtle)]"
        }`}
      >
        <SelectBox checked={selection.selected.has(tk.id)} onToggle={(shift) => selection.toggle(tk.id, shift)} label={`${t("bulk.select")}: ${tk.title}`} />
        <span className="w-1 h-4 rounded-full shrink-0" style={{ background: PRIORITY_COLOR[tk.priority] }} />
        <span className={`flex-1 min-w-0 truncate text-[12.5px] ${tk.status === "done" ? "line-through text-[var(--text-dim)]" : "text-[var(--text-primary)]"}`}><AutoTranslatedText text={tk.title} /></span>
        {due && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${overdue ? "bg-rose-500/15 text-rose-400" : "bg-[var(--bg-surface-subtle)] text-[var(--text-dim)]"}`}>{due}</span>}
        {tk.assignee?.username && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] shrink-0">@{tk.assignee.username}</span>}
      </div>
    );
  };

  const listGroups: { id: string; name: string; color: string | null; items: TaskRow[] }[] = [
    ...(unstaged.length > 0 ? [{ id: UNSTAGED, name: t("stage.unstaged"), color: null, items: unstaged }] : []),
    ...stages.map((s) => ({ id: s.id, name: s.name, color: s.color, items: tasksByStage.get(s.id) ?? [] })),
  ];

  return (
    <div className="h-full bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden w-full">
      {confirmDialog}
      {toastElement}
      <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] z-10 w-full overflow-x-hidden">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 min-w-0">
          <div className="flex items-center gap-3 pt-4 pb-3">
            <button
              type="button"
              onClick={onBack}
              aria-label={t("tip.back")}
              title={t("tip.back")}
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0"
            >
              <ArrowLeftIcon className="h-4 w-4 rtl:-scale-x-100" />
            </button>
            <div className="h-8 w-1 rounded-full shrink-0" style={{ background: color }} />
            <div className="flex-1 min-w-0">
              <h1 className="text-[18px] md:text-[20px] font-bold tracking-tight truncate">
                <AutoTranslatedText text={project.name} />
              </h1>
              <div className="text-[11px] text-[var(--text-dim)] truncate">
                {customerName ?? t("card.noCustomer")}
                {project.code ? ` · ${project.code}` : ""}
                {project.is_billable ? ` · ${t("form.billable")}` : ""}
              </div>
            </div>
            {project.is_billable && (
              <button
                type="button"
                onClick={invoiceTime}
                disabled={billing}
                aria-label={t("bill.btn", "Invoice time")}
                className="h-8 px-2.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center gap-1 text-[11px] font-semibold shrink-0 disabled:opacity-50"
                title={t("bill.tip", "Invoice all unbilled logged time (uses the project's billing rate)")}
              >
                {billing ? <SpinnerIcon className="h-3 w-3" /> : <ClockIcon size={12} />}
                <span className="hidden md:inline">{t("bill.btn", "Invoice time")}</span>
              </button>
            )}
            <button type="button" onClick={() => setMembersOpen(true)} aria-label={t("mem.open")} title={t("mem.open")} className={headerBtn}>
              <UsersIcon size={12} />
              <span className="hidden md:inline">{t("mem.title")}</span>
              {memberCount != null && <span className="tabular-nums text-[var(--text-ghost)]">{memberCount}</span>}
            </button>
            <button type="button" onClick={() => { void openChat(); }} disabled={chatBusy} aria-label={t("chat.open")} title={t("chat.open")} className={headerBtn}>
              {chatBusy ? <SpinnerIcon className="h-3 w-3" /> : <MessageSquareIcon size={12} />}
              <span className="hidden lg:inline">{t("chat.short")}</span>
            </button>
            <button
              type="button"
              onClick={() => toggleArchive(isArchived)}
              disabled={archiveBusy}
              aria-label={isArchived ? t("action.restore") : t("action.archive")}
              title={isArchived ? t("action.restore") : t("action.archive")}
              className={headerBtn}
            >
              {archiveBusy ? <SpinnerIcon className="h-3 w-3" /> : isArchived ? <UndoIcon size={12} /> : <ArchiveIcon size={12} />}
              <span className="hidden lg:inline">{isArchived ? t("action.restore") : t("action.archive")}</span>
            </button>
            <button
              type="button"
              onClick={() => setProjectFormOpen(true)}
              aria-label={t("tip.editProject")}
              title={t("tip.editProject")}
              className="h-8 w-8 rounded-lg border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center shrink-0"
            >
              <PencilIcon className="h-3.5 w-3.5" />
            </button>
            <Button onClick={() => setTaskModal({ open: true, editing: null })} icon={<PlusIcon size={12} />} aria-label={t("btn.addTask")}>
              <span className="hidden sm:inline">{t("btn.addTask")}</span>
            </Button>
          </div>
          {(budget.hasBudget || budget.loggedHours > 0) && (
            <div className="pb-3" role="group" aria-label={t("budget.title")}>
              <BudgetMeter summary={budget} compact />
            </div>
          )}
        </div>
      </div>

      {/* Kanban / List */}
      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-4 min-w-0">
          {isArchived && (
            <div role="status" className="mb-3 flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[12px] text-[var(--text-muted)]">
              <ArchiveIcon size={13} className="shrink-0" />
              <span className="flex-1 min-w-0">
                {t("archive.banner")}
                {project.archived_at ? ` ${t("archive.since").replace("{date}", formatDMY(project.archived_at))}` : ""}
              </span>
              <button type="button" onClick={() => toggleArchive(true)} disabled={archiveBusy} className="h-7 px-2.5 rounded-lg border border-[var(--border-subtle)] text-[11px] font-semibold hover:text-[var(--text-primary)] disabled:opacity-50">
                {t("action.restore")}
              </button>
            </div>
          )}
          <div className="mb-3">
            <TaskFilterBar value={filter} onChange={setFilter} defaults={filterDefaults("all")} scope="project" tags={tags} accounts={accounts} trailing={viewSwitch} />
          </div>
          {viewMode === "timeline" && (
            <div className="pb-4">
              <ProjectTimeline
                projectId={project.id}
                tasks={visibleTasks}
                allTasks={tasks}
                stages={stages}
                onUpdateDates={updateDates}
                onOpenTask={openTask}
              />
            </div>
          )}
          {viewMode === "list" && (
            <div className="space-y-4 pb-4">
              {listGroups.map((g) => (
                <div key={g.id} className="space-y-1.5">
                  <div className="flex items-center gap-2 px-1">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: g.color ?? "var(--border-subtle)" }} />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{g.name}</span>
                    <span className="text-[10px] font-semibold text-[var(--text-ghost)]">{g.items.length}</span>
                  </div>
                  {g.items.length === 0
                    ? <div className="text-[11px] text-[var(--text-dim)] px-3 py-2">{t("empty.noTasks")}</div>
                    : g.items.map(listRow)}
                </div>
              ))}
            </div>
          )}
          <div className={`flex gap-3 overflow-x-auto pb-4 scrollbar-none ${viewMode !== "board" ? "hidden" : ""}`}>
            {/* Unstaged — tasks whose stage was deleted. Cards drag OUT of it
                into a real column; nothing drops INTO it. */}
            {unstaged.length > 0 && (
              <div className="kx-glass w-[280px] shrink-0 rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-secondary)]">
                <div className="px-3 py-2.5 border-b border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2">
                    <div className="text-[12px] font-bold text-[var(--text-primary)] flex-1">{t("stage.unstaged")}</div>
                    <span className="text-[10px] font-semibold text-[var(--text-ghost)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded-full">{unstaged.length}</span>
                  </div>
                  <div className="text-[10.5px] text-[var(--text-dim)] mt-0.5">{t("stage.unstagedHint")}</div>
                </div>
                <div className="p-2 space-y-2">
                  {unstaged.map((tk) => (
                    <TaskCard
                      key={tk.id}
                      task={tk}
                      tags={tags}
                      onClick={() => openTask(tk)}
                      selected={selection.selected.has(tk.id)}
                      selecting={selecting}
                      onToggleSelect={(shift) => selection.toggle(tk.id, shift)}
                    />
                  ))}
                </div>
              </div>
            )}
            {stages.map((stage) => {
              const cellTasks = tasksByStage.get(stage.id) ?? [];
              const dropping = dragOver === stage.id;
              return (
                <div
                  key={stage.id}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOver !== stage.id) setDragOver(stage.id); }}
                  onDragLeave={() => { if (dragOver === stage.id) setDragOver(null); setDropBeforeId(null); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(null);
                    setDropBeforeId(null);
                    const taskId = e.dataTransfer.getData("text/plain");
                    if (taskId) void handleReorder(taskId, stage.id, null);
                  }}
                  className={`kx-glass w-[280px] shrink-0 rounded-2xl border transition-colors ${
                    dropping ? "border-[#567FB2]/60 bg-[#567FB2]/10" : "border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
                  }`}
                >
                  <StageHeader
                    stage={stage}
                    taskCount={cellTasks.length}
                    canDelete={stages.length > 1}
                    onChanged={refresh}
                    onError={fail}
                  />
                  <div className="p-2 space-y-2 min-h-[120px]">
                    {cellTasks.map((tk) => (
                      <div
                        key={tk.id}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (dropBeforeId !== tk.id) setDropBeforeId(tk.id); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDropBeforeId(null);
                          setDragOver(null);
                          const draggedId = e.dataTransfer.getData("text/plain");
                          if (draggedId && draggedId !== tk.id) void handleReorder(draggedId, stage.id, tk.id);
                        }}
                        className={dropBeforeId === tk.id ? "rounded-xl ring-2 ring-[#567FB2]/60" : ""}
                      >
                        <TaskCard
                          task={tk}
                          tags={tags}
                          onClick={() => openTask(tk)}
                          selected={selection.selected.has(tk.id)}
                          selecting={selecting}
                          onToggleSelect={(shift) => selection.toggle(tk.id, shift)}
                        />
                      </div>
                    ))}
                    {cellTasks.length === 0 && (
                      <div className="text-[11px] text-[var(--text-dim)] text-center py-6">
                        {t("empty.noTasks")}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 min-w-0">
                        <QuickAddTask
                          projectId={project.id}
                          stageId={stage.id}
                          onCreated={(task) => {
                            setTasks((prev) => (prev.some((x) => x.id === task.id) ? prev : [...prev, task]));
                            void refresh();
                          }}
                          onError={(e) => fail("toast.saveFailed", e)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setTaskModal({ open: true, editing: null, presetStageId: stage.id })}
                        aria-label={`${t("btn.addTask")} — ${stage.name}`}
                        title={t("btn.addTask")}
                        className="h-8 w-8 shrink-0 rounded-lg border border-dashed border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] flex items-center justify-center"
                      >
                        <PencilIcon className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add stage column */}
            <div className="w-[260px] shrink-0 rounded-2xl border border-dashed border-[var(--border-subtle)] p-3 flex flex-col gap-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                {t("btn.addStage")}
              </div>
              <input
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleAddStage(); }}
                placeholder={t("cfg.stages.title")}
                aria-label={t("btn.addStage")}
                className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              />
              <button
                type="button"
                onClick={handleAddStage}
                disabled={addingStage || !newStageName.trim()}
                className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all shadow-lg disabled:opacity-50"
              >
                {addingStage ? t("btn.saving") : t("btn.add")}
              </button>
            </div>
          </div>

          {/* Milestones */}
          <div className="mt-3">
            <MilestoneStrip projectId={project.id} />
          </div>

          {/* Linked Planning strip */}
          <div className="mt-3">
            <EntityPlanningStrip entityType="project" entityId={project.id} />
          </div>

          {viewMode !== "timeline" && (
            <BulkBar
              count={selection.count}
              total={orderedIds.length}
              onSelectAll={selection.selectAll}
              onClear={selection.clear}
              stages={stages}
              accounts={accounts}
              onRun={runBulk}
            />
          )}
        </div>
      </div>

      {membersOpen && (
        <ProjectMembersPanel
          projectId={project.id}
          open={membersOpen}
          accounts={accounts}
          onClose={() => setMembersOpen(false)}
          onChanged={setMemberCount}
          onError={(msg) => showToast(msg, "error")}
        />
      )}

      {taskModal.open && (
        <TaskFormModal
          key={taskModal.editing?.id ?? `new:${taskModal.presetStageId ?? ""}`}
          editing={taskModal.editing}
          projectId={projectId}
          presetStageId={taskModal.presetStageId ?? null}
          stages={stages}
          tags={tags}
          allTasks={tasks}
          onClose={closeTaskModal}
          onSaved={() => { closeTaskModal(); void refresh(); }}
        />
      )}

      {projectFormOpen && (
        <ProjectFormModal
          editing={project}
          onClose={() => setProjectFormOpen(false)}
          onSaved={() => { setProjectFormOpen(false); void refresh(); }}
          onDeleted={() => onBack()}
        />
      )}
    </div>
  );
}

function StageHeader({
  stage,
  taskCount,
  canDelete,
  onChanged,
  onError,
}: {
  stage: ProjectStage;
  taskCount: number;
  canDelete: boolean;
  onChanged: () => Promise<void> | void;
  onError: (key: "toast.saveFailed" | "toast.deleteFailed", e: unknown) => void;
}) {
  const { t } = useTranslation(projectsT);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(stage.name);
  const [color, setColor] = useState(stage.color ?? "#94a3b8");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await updateStage(stage.id, { name: name.trim(), color });
      setEditing(false);
      await onChanged();
    } catch (e) {
      onError("toast.saveFailed", e);
    } finally {
      setSaving(false);
    }
  };
  const { askConfirm, confirmDialog } = useConfirm();
  const remove = () => askConfirm(t("stage.deleteConfirm"), async () => {
    try {
      await deleteStage(stage.id);
      await onChanged();
    } catch (e) {
      onError("toast.deleteFailed", e);
    }
  }, { confirmLabel: t("btn.delete") });

  return (
    <div className="group flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border-subtle)]">
      {confirmDialog}
      <div className="w-1 h-5 rounded-full shrink-0" style={{ background: stage.color ?? "var(--border-subtle)" }} />
      {editing ? (
        <>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label={t("tip.stageColor")}
            className="h-6 w-8 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void save(); if (e.key === "Escape") setEditing(false); }}
            aria-label={t("tip.editStage")}
            autoFocus
            className="flex-1 min-w-0 h-6 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] outline-none"
          />
          <button type="button" onClick={save} disabled={saving} aria-label={t("btn.save")} className="h-6 w-6 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center disabled:opacity-50">
            {saving ? <SpinnerIcon className="h-3 w-3" /> : <CheckIcon size={11} />}
          </button>
        </>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-bold text-[var(--text-primary)] truncate">
              {stage.name}
            </div>
          </div>
          <span className="text-[10px] font-semibold text-[var(--text-ghost)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded-full shrink-0">
            {taskCount}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={t("tip.editStage")}
            title={t("tip.editStage")}
            className={`h-6 w-6 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center ${revealCls}`}
          >
            <PencilIcon className="h-3 w-3" />
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={remove}
              aria-label={t("tip.deleteStage")}
              title={t("tip.deleteStage")}
              className={`h-6 w-6 rounded-md text-[var(--text-dim)] hover:text-rose-400 flex items-center justify-center ${revealCls}`}
            >
              <TrashIcon className="h-3 w-3" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

function TaskCard({
  task,
  tags,
  onClick,
  selected = false,
  selecting = false,
  onToggleSelect,
}: {
  task: TaskRow;
  tags: ProjectTag[];
  onClick: () => void;
  selected?: boolean;
  /** Any card selected → every checkbox stays visible. */
  selecting?: boolean;
  onToggleSelect?: (shift: boolean) => void;
}) {
  const { t, lang } = useTranslation(projectsT);
  const dueLabel = formatDueDate(task.due_date, lang, dueLabels(t));
  const overdue = isOverdue(task.due_date) && task.status === "open";
  const blocked = task.status === "open" && (task.blocked_by_task_ids?.length ?? 0) > 0;
  const color = PRIORITY_COLOR[task.priority];
  const visibleTags = tags.filter((tg) => task.tag_ids.includes(tg.id)).slice(0, 3);

  return (
    <div
      draggable
      role="button"
      tabIndex={0}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task.id);
      }}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      className={`group cursor-grab active:cursor-grabbing rounded-xl bg-[var(--bg-surface)] border p-2.5 hover:border-[var(--border-focus)] transition-all space-y-1.5 ${
        task.status === "done" ? "opacity-60" : ""
      } ${selected ? "border-[#567FB2] ring-1 ring-[#567FB2]/40" : "border-[var(--border-subtle)]"}`}
    >
      <div className="flex items-start gap-1.5">
        {onToggleSelect && (
          <SelectBox
            checked={selected}
            onToggle={onToggleSelect}
            label={`${t("bulk.select")}: ${task.title}`}
            className={`mt-0.5 ${selecting || selected ? "" : revealCls}`}
          />
        )}
        <div className="w-1 rounded-full shrink-0 self-stretch" style={{ background: color, minHeight: 20 }} />
        <div className="flex-1 min-w-0">
          {blocked && (
            <span className="inline-block text-[9px] font-bold uppercase tracking-wide text-red-400 bg-red-500/10 border border-red-500/30 rounded px-1 py-px mb-0.5">
              {t("task.blocked")}
            </span>
          )}
          <div className={`text-[12px] font-semibold text-[var(--text-primary)] ${task.status === "done" ? "line-through" : ""}`}>
            <AutoTranslatedText text={task.title} />
          </div>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-1.5 flex-wrap ps-2">
        {dueLabel && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
            overdue ? "bg-rose-500/15 text-rose-400" : "bg-[var(--bg-surface-subtle)] text-[var(--text-dim)]"
          }`}>
            {dueLabel}
          </span>
        )}
        {task.assignee?.username && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)] text-[var(--text-muted)]">
            @{task.assignee.username}
          </span>
        )}
        {task.linked_entity_label && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] truncate max-w-[120px]">
            <LinkIcon size={9} className="shrink-0" /> {task.linked_entity_label}
          </span>
        )}
      </div>

      {/* Tags */}
      {visibleTags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap ps-2">
          {visibleTags.map((tg) => (
            <span
              key={tg.id}
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: `${tg.color ?? "#94a3b8"}22`, color: tg.color ?? "#94a3b8" }}
            >
              {tg.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TASKS LIST — flat view (My Tasks / All Tasks)
   ══════════════════════════════════════════════════════════════════ */

function TasksListView({ mine, tags }: { mine: boolean; tags: ProjectTag[] }) {
  const { t } = useTranslation(projectsT);
  const { showToast, toastElement } = useToast();
  const accounts = useAccounts();
  const defaults = useMemo(() => filterDefaults("open"), []);
  const [filter, setFilter] = useState<TaskFilterState>(defaults);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<TaskRow | null>(null);
  /* Optimistic status flips, keyed by task id, until the refetch lands. */
  const [overrides, setOverrides] = useState<Record<string, TaskStatus>>({});
  /* Bumped after every write so the Due-today strip refreshes with the list. */
  const [version, setVersion] = useState(0);

  // Debounce search so each keystroke doesn't fire a request.
  useEffect(() => {
    const id = setTimeout(() => setSearch(filter.search.trim()), 300);
    return () => clearTimeout(id);
  }, [filter.search]);

  /* Status / priority / assignee / tag / search are server-side; "overdue"
     is a client-side view over the result. Only the default view is warm. */
  const isDefault = filter.status === "open" && filter.priority === "all" && !filter.assignee && !filter.tag && !search;
  const warmKey = isDefault ? (mine ? "projects:mytasks" : "projects:alltasks") : "";
  const loadTasks = useCallback(
    () => fetchTasks({
      mine,
      status: filter.status,
      priority: filter.priority === "all" ? undefined : filter.priority,
      assignee: filter.assignee ?? undefined,
      tag: filter.tag ?? undefined,
      search: search || undefined,
      limit: 1000,
    }),
    [mine, filter.status, filter.priority, filter.assignee, filter.tag, search],
  );
  const { data, loading, error, reload } = useWarmData(warmKey, loadTasks, DEFAULT_MAX_AGE_MS, 0);
  const tasks = useMemo(
    () => (data ?? []).map((tk) => (overrides[tk.id] ? { ...tk, status: overrides[tk.id] } : tk)),
    [data, overrides],
  );
  const afterWrite = useCallback(async () => {
    setVersion((v) => v + 1);
    await reload();
  }, [reload]);

  const toggleStatus = async (tk: TaskRow, next: TaskStatus) => {
    setOverrides((o) => ({ ...o, [tk.id]: next }));
    try {
      await updateTask(tk.id, { status: next });
      await afterWrite();
    } catch (e) {
      showToast(t("toast.saveFailed").replace("{err}", errText(e)), "error");
    } finally {
      setOverrides((o) => {
        const n = { ...o };
        delete n[tk.id];
        return n;
      });
    }
  };

  const grouped = useMemo(() => {
    const byStatus: Record<string, TaskRow[]> = { open: [], done: [], cancelled: [] };
    for (const tk of tasks) {
      if (filter.overdue && !(tk.status === "open" && isOverdue(tk.due_date))) continue;
      byStatus[tk.status]?.push(tk);
    }
    return byStatus;
  }, [tasks, filter.overdue]);

  const shownStatuses = (["open", "done", "cancelled"] as const).filter(
    (st) => grouped[st].length > 0 && (filter.status === "all" || filter.status === st),
  );
  const orderedIds = useMemo(
    () => (["open", "done", "cancelled"] as const)
      .filter((st) => filter.status === "all" || filter.status === st)
      .flatMap((st) => grouped[st].map((tk) => tk.id)),
    [grouped, filter.status],
  );
  const selection = useTaskSelection(orderedIds);
  const selectedIds = useMemo(() => [...selection.selected], [selection.selected]);
  const runBulk = useBulkRunner({ ids: selectedIds, onDone: afterWrite, clear: selection.clear, toast: showToast });

  return (
    <div className="space-y-4">
      {toastElement}
      {mine && <DueTodayStrip version={version} onOpen={setEditing} />}
      <TaskFilterBar
        value={filter}
        onChange={setFilter}
        defaults={defaults}
        scope={mine ? "mine" : "all"}
        tags={tags}
        accounts={accounts}
        hideAssignee={mine}
      />

      {loading ? (
        <CenteredSpinner />
      ) : error && !data ? (
        <LoadError onRetry={() => { void reload(); }} />
      ) : shownStatuses.length === 0 ? (
        <div className="kx-glass rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] py-14 text-center text-[13px] text-[var(--text-dim)]">
          {t("empty.noTasks")}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {shownStatuses.map((st) => {
            const list = grouped[st];
            return (
              <div key={st} className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)] px-1">
                  {t(`status.${st}`)} ({list.length})
                </div>
                <div className="space-y-2">
                  {list.map((tk) => (
                    <FlatTaskRow
                      key={tk.id}
                      task={tk}
                      tags={tags}
                      onClick={() => setEditing(tk)}
                      onToggleStatus={(next) => { void toggleStatus(tk, next); }}
                      selected={selection.selected.has(tk.id)}
                      onToggleSelect={(shift) => selection.toggle(tk.id, shift)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BulkBar
        count={selection.count}
        total={orderedIds.length}
        onSelectAll={selection.selectAll}
        onClear={selection.clear}
        accounts={accounts}
        onRun={runBulk}
      />

      {editing && (
        <FlatTaskFormModal
          key={editing.id}
          editing={editing}
          tags={tags}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void afterWrite(); }}
        />
      )}
    </div>
  );
}

function FlatTaskRow({
  task,
  tags,
  onClick,
  onToggleStatus,
  selected,
  onToggleSelect,
}: {
  task: TaskRow;
  tags: ProjectTag[];
  onClick: () => void;
  onToggleStatus: (next: TaskStatus) => void;
  selected: boolean;
  onToggleSelect: (shift: boolean) => void;
}) {
  const { t, lang } = useTranslation(projectsT);
  const dueLabel = formatDueDate(task.due_date, lang, dueLabels(t));
  const overdue = isOverdue(task.due_date) && task.status === "open";
  const color = PRIORITY_COLOR[task.priority];
  const projectColor = task.project?.color ?? HUB_BLUE;
  const visibleTags = tags.filter((tg) => task.tag_ids.includes(tg.id)).slice(0, 2);
  const done = task.status === "done";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) onClick(); }}
      className={`kx-glass w-full cursor-pointer text-start rounded-xl bg-[var(--bg-secondary)] border hover:border-[var(--border-focus)] p-3 transition-all space-y-1.5 ${
        selected ? "border-[#567FB2]/60 bg-[#567FB2]/5" : "border-[var(--border-subtle)]"
      }`}
    >
      <div className="flex items-start gap-2">
        <SelectBox checked={selected} onToggle={onToggleSelect} label={`${t("bulk.select")}: ${task.title}`} className="mt-0.5" />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleStatus(done ? "open" : "done"); }}
          aria-label={done ? t("task.reopen") : t("task.markDone")}
          aria-pressed={done}
          className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border flex items-center justify-center transition-colors ${
            done ? "bg-emerald-500 border-emerald-500 text-white" : "border-[var(--border-color)] text-transparent hover:border-emerald-400"
          }`}
        >
          <CheckIcon size={10} />
        </button>
        <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: color, minHeight: 20 }} />
        <div className="flex-1 min-w-0">
          <div className={`text-[12px] font-semibold text-[var(--text-primary)] truncate ${done ? "line-through opacity-60" : ""}`}>
            <AutoTranslatedText text={task.title} />
          </div>
          <div className="text-[10px] text-[var(--text-dim)] truncate flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: projectColor }} />
            {task.project?.name ?? "—"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap ps-3">
        {dueLabel && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${overdue ? "bg-rose-500/15 text-rose-400" : "bg-[var(--bg-surface-subtle)] text-[var(--text-dim)]"}`}>
            {dueLabel}
          </span>
        )}
        {task.assignee?.username && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)] text-[var(--text-muted)]">
            @{task.assignee.username}
          </span>
        )}
        {visibleTags.map((tg) => (
          <span
            key={tg.id}
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
            style={{ background: `${tg.color ?? "#94a3b8"}22`, color: tg.color ?? "#94a3b8" }}
          >
            {tg.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   CONFIGURATION — tag CRUD (stages are managed on each project's board)
   ══════════════════════════════════════════════════════════════════ */

function ConfigurationView({ tags, reloadTags }: { tags: ProjectTag[]; reloadTags: () => Promise<void> }) {
  const { t } = useTranslation(projectsT);
  const { showToast, toastElement } = useToast();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#60a5fa");
  const [saving, setSaving] = useState(false);

  const fail = useCallback(
    (key: "toast.saveFailed" | "toast.deleteFailed", e: unknown) => showToast(t(key).replace("{err}", errText(e)), "error"),
    [showToast, t],
  );

  const add = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await createTag({ name: name.trim(), color });
      setName("");
      await reloadTags();
    } catch (e) {
      fail("toast.saveFailed", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {toastElement}
      <div className="kx-glass rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CogIcon size={14} className="text-[var(--text-dim)]" />
          <h3 className="text-[13px] font-bold">{t("cfg.tags.title")}</h3>
        </div>
        <p className="text-[11px] text-[var(--text-dim)]">{t("cfg.tags.help")}</p>

        <div className="flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label={t("tip.tagColor")}
            className="h-9 w-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] cursor-pointer"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void add(); }}
            placeholder={t("cfg.tags.placeholder")}
            aria-label={t("cfg.tags.title")}
            className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
          />
          <button
            type="button"
            onClick={add}
            disabled={saving || !name.trim()}
            className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all shadow-lg disabled:opacity-50"
          >
            {saving ? t("btn.saving") : t("btn.add")}
          </button>
        </div>

        <div className="space-y-1.5 pt-1">
          {tags.map((tg) => (
            <TagRow key={tg.id} tag={tg} onReload={reloadTags} onError={fail} />
          ))}
          {tags.length === 0 && (
            <div className="text-[12px] text-[var(--text-dim)] py-3">{t("cfg.tags.empty", "No tags yet — add your first above.")}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function TagRow({
  tag,
  onReload,
  onError,
}: {
  tag: ProjectTag;
  onReload: () => Promise<void>;
  onError: (key: "toast.saveFailed" | "toast.deleteFailed", e: unknown) => void;
}) {
  const { t } = useTranslation(projectsT);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color ?? "#60a5fa");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await updateTag(tag.id, { name: name.trim(), color });
      setEditing(false);
      await onReload();
    } catch (e) {
      onError("toast.saveFailed", e);
    } finally {
      setSaving(false);
    }
  };
  const { askConfirm, confirmDialog } = useConfirm();
  const remove = () => askConfirm(t("tag.deleteConfirm"), async () => {
    try {
      await deleteTag(tag.id);
      await onReload();
    } catch (e) {
      onError("toast.deleteFailed", e);
    }
  }, { confirmLabel: t("btn.delete") });

  return (
    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
      {confirmDialog}
      {editing ? (
        <>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label={t("tip.tagColor")} className="h-7 w-8 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)]" />
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void save(); }} aria-label={t("tip.editTag")} className="flex-1 min-w-0 h-7 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] outline-none" />
          <button type="button" onClick={save} disabled={saving} aria-label={t("btn.save")} className="h-7 w-7 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center disabled:opacity-50">
            {saving ? <SpinnerIcon className="h-3 w-3" /> : <CheckIcon size={12} />}
          </button>
          <button type="button" onClick={() => setEditing(false)} aria-label={t("btn.cancel")} className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center"><CrossIcon size={12} /></button>
        </>
      ) : (
        <>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{ background: `${tag.color ?? "#94a3b8"}22`, color: tag.color ?? "#94a3b8" }}>{tag.name}</span>
          <div className="flex-1" />
          <button type="button" onClick={() => setEditing(true)} aria-label={t("tip.editTag")} title={t("tip.editTag")} className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center"><PencilIcon className="h-3 w-3" /></button>
          <button type="button" onClick={remove} aria-label={t("tip.deleteTag")} title={t("tip.deleteTag")} className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-rose-400 flex items-center justify-center"><TrashIcon className="h-3 w-3" /></button>
        </>
      )}
    </div>
  );
}
