"use client";

/* ---------------------------------------------------------------------------
   ProjectsApp — Odoo-Project-style app in Hub's visual language.

   Views:
     • Projects        — grid of project cards, click to drill into detail
     • Project detail  — kanban of tasks by stage, inline stage management
     • My Tasks        — flat kanban across all projects, filtered to me
     • All Tasks       — flat kanban across all projects
     • Reporting       — KPI strip + priority / assignee breakdown
     • Configuration   — tag CRUD
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { projectsT } from "@/lib/translations/projects";
import { ScrollLockOverlay } from "@/hooks/useScrollLock";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import StarIcon from "@/components/icons/ui/StarIcon";
import FlagIcon from "@/components/icons/ui/FlagIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import CogIcon from "@/components/icons/ui/CogIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import CheckSquareIcon from "@/components/icons/ui/CheckSquareIcon";
import ListTodoIcon from "@/components/icons/ui/ListTodoIcon";
import ProjectsIcon from "@/components/icons/ProjectsIcon";
import EntityPlanningStrip from "@/components/planning/EntityPlanningStrip";
import EntityPicker from "@/components/planning/EntityPicker";
import {
  createProject,
  createStage,
  createTag,
  createTask,
  deleteProject,
  deleteStage,
  deleteTag,
  deleteTask,
  fetchProjects,
  fetchStages,
  fetchTags,
  fetchTasks,
  formatDueDate,
  isOverdue,
  PRIORITY_COLOR,
  updateProject,
  updateStage,
  updateTag,
  updateTask,
  type ProjectRow,
  type ProjectStage,
  type ProjectTag,
  type TaskPriority,
  type TaskRow,
  type TaskStatus,
} from "@/lib/projects";

type TabId = "projects" | "mine" | "all" | "reporting" | "config";

export default function ProjectsApp() {
  const { t } = useTranslation(projectsT);
  const [tab, setTab] = useState<TabId>("projects");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Shared tag cache — loaded once, consumed by every task card.
  const [tags, setTags] = useState<ProjectTag[]>([]);
  useEffect(() => {
    fetchTags().then(setTags);
  }, []);
  const reloadTags = useCallback(() => {
    fetchTags().then(setTags);
  }, []);

  /* When drilling into a project, flip to a pseudo-view. Back button
     returns to the Projects list. */
  if (activeProjectId) {
    return (
      <ProjectDetailView
        projectId={activeProjectId}
        tags={tags}
        onBack={() => setActiveProjectId(null)}
        reloadTags={reloadTags}
      />
    );
  }

  return (
    <div
      className="bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden w-full"
      style={{ height: "calc(100dvh - 3.5rem)" }}
    >
      {/* Page header */}
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
                <ProjectsIcon className="h-4 w-4" />
              </div>
              <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">
                {t("app.title")}
              </h1>
            </div>
          </div>
          <p className="text-[12px] text-[var(--text-dim)] mb-3 ml-0 md:ml-11">
            {t("app.subtitle")}
          </p>

          {/* Tabs */}
          <div className="flex items-center gap-1 pb-3 overflow-x-auto scrollbar-none">
            <Tab active={tab === "projects"} onClick={() => setTab("projects")} icon={<LayoutGridIcon size={13} />} label={t("tab.projects")} />
            <Tab active={tab === "mine"} onClick={() => setTab("mine")} icon={<CheckSquareIcon size={13} />} label={t("tab.myTasks")} />
            <Tab active={tab === "all"} onClick={() => setTab("all")} icon={<ListTodoIcon size={13} />} label={t("tab.allTasks")} />
            <Tab active={tab === "reporting"} onClick={() => setTab("reporting")} icon={<BarChart3Icon size={13} />} label={t("tab.reporting")} />
            <Tab active={tab === "config"} onClick={() => setTab("config")} icon={<CogIcon size={13} />} label={t("tab.configuration")} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-4 min-w-0">
          {tab === "projects" && <ProjectsListView onOpenProject={setActiveProjectId} />}
          {tab === "mine" && <TasksListView mine tags={tags} />}
          {tab === "all" && <TasksListView mine={false} tags={tags} />}
          {tab === "reporting" && <ReportingView />}
          {tab === "config" && <ConfigurationView tags={tags} reloadTags={reloadTags} />}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TAB BUTTON
   ══════════════════════════════════════════════════════════════════ */

function Tab({
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
   PROJECTS LIST — grid of cards
   ══════════════════════════════════════════════════════════════════ */

function ProjectsListView({ onOpenProject }: { onOpenProject: (id: string) => void }) {
  const { t } = useTranslation(projectsT);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [tasksByProject, setTasksByProject] = useState<Record<string, TaskRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"active" | "on_hold" | "completed" | "archived" | "all">("active");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRow | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const rows = await fetchProjects({ status: statusFilter, search: search.trim() || undefined });
    setProjects(rows);
    // Fetch tasks counts in one call — all open tasks across all projects.
    const allTasks = await fetchTasks({ status: "all" });
    const grouped: Record<string, TaskRow[]> = {};
    for (const tr of allTasks) {
      grouped[tr.project_id] ??= [];
      grouped[tr.project_id].push(tr);
    }
    setTasksByProject(grouped);
    setLoading(false);
  }, [statusFilter, search]);

  useEffect(() => {
    reload();
  }, [reload]);

  const filterCounts = useMemo(() => {
    return {
      active: projects.filter((p) => p.status === "active").length,
      on_hold: projects.filter((p) => p.status === "on_hold").length,
      completed: projects.filter((p) => p.status === "completed").length,
      archived: projects.filter((p) => p.status === "archived").length,
    };
  }, [projects]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("form.name")}
          className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] w-full sm:w-64"
        />
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {(["active", "on_hold", "completed", "archived", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`h-7 px-3 rounded-full text-[11px] font-semibold border whitespace-nowrap transition-colors ${
                statusFilter === s
                  ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent"
                  : "bg-transparent border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              }`}
            >
              {s === "active"    && `${t("filter.active")} (${filterCounts.active})`}
              {s === "on_hold"   && `${t("filter.onHold")} (${filterCounts.on_hold})`}
              {s === "completed" && `${t("filter.completed")} (${filterCounts.completed})`}
              {s === "archived"  && `${t("filter.archived")} (${filterCounts.archived})`}
              {s === "all"       && t("filter.all")}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          onClick={() => { setEditingProject(null); setFormOpen(true); }}
          className="h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shrink-0"
        >
          <PlusIcon size={14} />
          {t("action.newProject")}
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)] animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] py-14 text-center">
          <div className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">{t("empty.noProjects")}</div>
          <div className="text-[12px] text-[var(--text-dim)]">{t("empty.addFirst")}</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              tasks={tasksByProject[p.id] ?? []}
              onOpen={() => onOpenProject(p.id)}
              onEdit={() => { setEditingProject(p); setFormOpen(true); }}
              onToggleFavourite={async () => {
                await updateProject(p.id, { is_favorite: !p.is_favorite });
                reload();
              }}
            />
          ))}
        </div>
      )}

      <ProjectFormModal
        open={formOpen}
        editing={editingProject}
        onClose={() => { setFormOpen(false); setEditingProject(null); }}
        onSaved={() => { setFormOpen(false); setEditingProject(null); reload(); }}
        onDeleted={() => { setFormOpen(false); setEditingProject(null); reload(); }}
      />
    </div>
  );
}

function ProjectCard({
  project,
  tasks,
  onOpen,
  onEdit,
  onToggleFavourite,
}: {
  project: ProjectRow;
  tasks: TaskRow[];
  onOpen: () => void;
  onEdit: () => void;
  onToggleFavourite: () => void;
}) {
  const { t } = useTranslation(projectsT);
  const openCount = tasks.filter((x) => x.status === "open").length;
  const doneCount = tasks.filter((x) => x.status === "done").length;
  const overdueCount = tasks.filter((x) => x.status === "open" && isOverdue(x.due_date)).length;
  const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : (project.progress_pct ?? 0);
  const color = project.color ?? "#818cf8";
  const customerName = project.customer?.display_name ?? project.customer?.company_name;

  return (
    <div
      onClick={onOpen}
      className="group cursor-pointer rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-subtle)] transition-all overflow-hidden"
    >
      {/* Colour stripe */}
      <div className="h-1" style={{ background: color }} />

      <div className="p-4 space-y-3">
        <div className="flex items-start gap-2 min-w-0">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavourite(); }}
            className="h-7 w-7 shrink-0 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-amber-400 transition-colors"
            aria-label={t("tip.favourite")}
          >
            <StarIcon
              size={14}
              className={project.is_favorite ? "text-amber-400 fill-amber-400" : ""}
            />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold text-[var(--text-primary)] truncate">
              {project.name}
            </div>
            <div className="text-[11px] text-[var(--text-dim)] truncate">
              {customerName ?? t("card.noCustomer")}{project.code ? ` · ${project.code}` : ""}
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-opacity"
          >
            <PencilIcon className="h-3 w-3" />
          </button>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)] mb-1">
            <span>{progress}%</span>
            <span>{doneCount} / {tasks.length || 0}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[var(--bg-surface)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: color }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="px-2 py-0.5 rounded-full bg-[var(--bg-surface)] text-[var(--text-muted)] font-semibold">
            {openCount} {openCount === 1 ? t("card.taskSingular") : t("card.tasks")}
          </span>
          {overdueCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-semibold">
              {overdueCount} {t("card.overdue")}
            </span>
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
  tags,
  onBack,
  reloadTags,
}: {
  projectId: string;
  tags: ProjectTag[];
  onBack: () => void;
  reloadTags: () => void;
}) {
  const { t } = useTranslation(projectsT);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskModal, setTaskModal] = useState<{ open: boolean; editing: TaskRow | null; presetStageId?: string | null }>({ open: false, editing: null });
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [newStageName, setNewStageName] = useState("");
  const [projectFormOpen, setProjectFormOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const [proj, stgs, tks] = await Promise.all([
      fetch(`/api/projects/${projectId}`, { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
      fetchStages(projectId),
      fetchTasks({ project_id: projectId, status: "all" }),
    ]);
    setProject(proj?.project ?? null);
    setStages(stgs);
    setTasks(tks);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const tasksByStage = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    for (const tk of tasks) {
      const key = tk.stage_id ?? "__no_stage__";
      const arr = map.get(key) ?? [];
      arr.push(tk);
      map.set(key, arr);
    }
    // Sort inside each column
    for (const arr of map.values()) {
      arr.sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
    }
    return map;
  }, [tasks]);

  const handleTaskDrop = useCallback(
    async (taskId: string, targetStageId: string) => {
      const task = tasks.find((x) => x.id === taskId);
      if (!task || task.stage_id === targetStageId) return;
      const stage = stages.find((s) => s.id === targetStageId);
      const nextStatus: TaskStatus = stage?.is_closed ? "done" : "open";
      await updateTask(taskId, { stage_id: targetStageId, status: nextStatus });
      reload();
    },
    [tasks, stages, reload],
  );

  const handleAddStage = async () => {
    if (!newStageName.trim()) return;
    await createStage(projectId, {
      name: newStageName.trim(),
      color: "#94a3b8",
      sort_order: stages.length,
    });
    setNewStageName("");
    reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)] animate-spin" />
      </div>
    );
  }
  if (!project) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center text-[var(--text-dim)]">
        {t("empty.noProjects")}
      </div>
    );
  }

  const customerName = project.customer?.display_name ?? project.customer?.company_name;
  const color = project.color ?? "#818cf8";

  return (
    <div
      className="bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden w-full"
      style={{ height: "calc(100dvh - 3.5rem)" }}
    >
      <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] z-10 w-full overflow-x-hidden">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 min-w-0">
          <div className="flex items-center gap-3 pt-4 pb-3">
            <button
              onClick={onBack}
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </button>
            <div className="h-8 w-1 rounded-full shrink-0" style={{ background: color }} />
            <div className="flex-1 min-w-0">
              <h1 className="text-[18px] md:text-[20px] font-bold tracking-tight truncate">
                {project.name}
              </h1>
              <div className="text-[11px] text-[var(--text-dim)] truncate">
                {customerName ?? t("card.noCustomer")}
                {project.code ? ` · ${project.code}` : ""}
                {project.is_billable ? ` · ${t("form.billable")}` : ""}
              </div>
            </div>
            <button
              onClick={() => setProjectFormOpen(true)}
              className="h-8 w-8 rounded-lg border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center shrink-0"
            >
              <PencilIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setTaskModal({ open: true, editing: null })}
              className="h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 shrink-0"
            >
              <PlusIcon size={14} />
              <span className="hidden sm:inline">{t("btn.addTask")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-4 min-w-0">
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-none">
            {stages.map((stage) => {
              const cellTasks = tasksByStage.get(stage.id) ?? [];
              const dropping = dragOver === stage.id;
              return (
                <div
                  key={stage.id}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOver !== stage.id) setDragOver(stage.id); }}
                  onDragLeave={() => { if (dragOver === stage.id) setDragOver(null); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(null);
                    const taskId = e.dataTransfer.getData("text/plain");
                    if (taskId) handleTaskDrop(taskId, stage.id);
                  }}
                  className={`w-[280px] shrink-0 rounded-2xl border transition-colors ${
                    dropping ? "border-amber-400/50 bg-amber-500/5" : "border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
                  }`}
                >
                  <StageHeader
                    stage={stage}
                    taskCount={cellTasks.length}
                    onReload={reload}
                  />
                  <div className="p-2 space-y-2 min-h-[120px]">
                    {cellTasks.map((tk) => (
                      <TaskCard
                        key={tk.id}
                        task={tk}
                        tags={tags}
                        onClick={() => setTaskModal({ open: true, editing: tk })}
                      />
                    ))}
                    {cellTasks.length === 0 && (
                      <div className="text-[11px] text-[var(--text-dim)] text-center py-6">
                        {t("empty.noTasks")}
                      </div>
                    )}
                    <button
                      onClick={() => setTaskModal({ open: true, editing: null, presetStageId: stage.id })}
                      className="w-full h-8 rounded-lg border border-dashed border-[var(--border-subtle)] text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] flex items-center justify-center gap-1.5"
                    >
                      <PlusIcon size={11} /> {t("btn.addTask")}
                    </button>
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
                onKeyDown={(e) => { if (e.key === "Enter") handleAddStage(); }}
                placeholder={t("cfg.stages.title")}
                className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none"
              />
              <button
                onClick={handleAddStage}
                className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90"
              >
                {t("btn.add")}
              </button>
            </div>
          </div>

          {/* Linked Planning strip */}
          <div className="mt-2">
            <EntityPlanningStrip entityType="project" entityId={project.id} />
          </div>
        </div>
      </div>

      <TaskFormModal
        open={taskModal.open}
        editing={taskModal.editing}
        projectId={projectId}
        presetStageId={taskModal.presetStageId ?? null}
        stages={stages}
        tags={tags}
        reloadTags={reloadTags}
        onClose={() => setTaskModal({ open: false, editing: null })}
        onSaved={() => { setTaskModal({ open: false, editing: null }); reload(); }}
      />

      <ProjectFormModal
        open={projectFormOpen}
        editing={project}
        onClose={() => setProjectFormOpen(false)}
        onSaved={() => { setProjectFormOpen(false); reload(); }}
        onDeleted={() => onBack()}
      />
    </div>
  );
}

function StageHeader({
  stage,
  taskCount,
  onReload,
}: {
  stage: ProjectStage;
  taskCount: number;
  onReload: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(stage.name);
  const [color, setColor] = useState(stage.color ?? "#94a3b8");

  const save = async () => {
    await updateStage(stage.id, { name, color });
    setEditing(false);
    onReload();
  };
  const remove = async () => {
    if (!confirm("Delete this stage?")) return;
    await deleteStage(stage.id);
    onReload();
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border-subtle)]">
      <div className="w-1 h-5 rounded-full shrink-0" style={{ background: stage.color ?? "var(--border-subtle)" }} />
      {editing ? (
        <>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-6 w-8 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            className="flex-1 h-6 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] outline-none"
          />
          <button onClick={save} className="h-6 px-2 rounded-md bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[10px] font-bold">OK</button>
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
            onClick={() => setEditing(true)}
            className="h-6 w-6 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center"
          >
            <PencilIcon className="h-3 w-3" />
          </button>
          <button
            onClick={remove}
            className="h-6 w-6 rounded-md text-[var(--text-dim)] hover:text-rose-400 flex items-center justify-center"
          >
            <TrashIcon className="h-3 w-3" />
          </button>
        </>
      )}
    </div>
  );
}

function TaskCard({
  task,
  tags,
  onClick,
}: {
  task: TaskRow;
  tags: ProjectTag[];
  onClick: () => void;
}) {
  const dueLabel = formatDueDate(task.due_date);
  const overdue = isOverdue(task.due_date) && task.status === "open";
  const color = PRIORITY_COLOR[task.priority];
  const visibleTags = tags.filter((tg) => task.tag_ids.includes(tg.id)).slice(0, 3);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task.id);
      }}
      onClick={onClick}
      className={`cursor-grab active:cursor-grabbing rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-2.5 hover:border-[var(--border-focus)] transition-all space-y-1.5 ${
        task.status === "done" ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-1.5">
        <div className="w-1 rounded-full shrink-0 self-stretch" style={{ background: color, minHeight: 20 }} />
        <div className="flex-1 min-w-0">
          <div className={`text-[12px] font-semibold text-[var(--text-primary)] ${task.status === "done" ? "line-through" : ""}`}>
            {task.title}
          </div>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-1.5 flex-wrap pl-2">
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
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] truncate max-w-[120px]">
            🔗 {task.linked_entity_label}
          </span>
        )}
      </div>

      {/* Tags */}
      {visibleTags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap pl-2">
          {visibleTags.map((tg) => (
            <span
              key={tg.id}
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
              style={{
                background: `${tg.color ?? "#94a3b8"}22`,
                color: tg.color ?? "#94a3b8",
              }}
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
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("open");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
  const [taskModal, setTaskModal] = useState<{ open: boolean; editing: TaskRow | null }>({ open: false, editing: null });

  const reload = useCallback(() => {
    setLoading(true);
    fetchTasks({ mine, status: statusFilter, priority: priorityFilter === "all" ? undefined : priorityFilter }).then((rows) => {
      setTasks(rows);
      setLoading(false);
    });
  }, [mine, statusFilter, priorityFilter]);

  useEffect(() => {
    reload();
  }, [reload]);

  const grouped = useMemo(() => {
    const byStatus: Record<string, TaskRow[]> = { open: [], done: [], cancelled: [] };
    for (const tk of tasks) {
      byStatus[tk.status]?.push(tk);
    }
    return byStatus;
  }, [tasks]);

  const priorities: (TaskPriority | "all")[] = ["all", "urgent", "high", "normal", "low"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {(["open", "done", "cancelled", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`h-7 px-3 rounded-full text-[11px] font-semibold border whitespace-nowrap transition-colors ${
                statusFilter === s
                  ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent"
                  : "bg-transparent border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              }`}
            >
              {s === "open" && t("status.open")}
              {s === "done" && t("status.done")}
              {s === "cancelled" && t("status.cancelled")}
              {s === "all" && t("filter.all")}
            </button>
          ))}
        </div>
        <div className="w-px h-4 bg-[var(--border-subtle)]" />
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {priorities.map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`h-7 px-2.5 rounded-full text-[11px] font-semibold border whitespace-nowrap flex items-center gap-1 transition-colors ${
                priorityFilter === p
                  ? "text-[var(--text-primary)] border-white/25 bg-white/10"
                  : "bg-transparent border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              }`}
            >
              <FlagIcon size={10} />
              {p === "all" ? t("filter.all") : t(`priority.${p}`)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)] animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] py-14 text-center text-[13px] text-[var(--text-dim)]">
          {t("empty.noTasks")}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(["open", "done", "cancelled"] as const).map((st) => {
            const list = grouped[st];
            if (list.length === 0 || (statusFilter !== "all" && statusFilter !== st)) return null;
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
                      onClick={() => setTaskModal({ open: true, editing: tk })}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <FlatTaskFormModal
        open={taskModal.open}
        editing={taskModal.editing}
        tags={tags}
        onClose={() => setTaskModal({ open: false, editing: null })}
        onSaved={() => { setTaskModal({ open: false, editing: null }); reload(); }}
      />
    </div>
  );
}

function FlatTaskRow({
  task,
  tags,
  onClick,
}: {
  task: TaskRow;
  tags: ProjectTag[];
  onClick: () => void;
}) {
  const dueLabel = formatDueDate(task.due_date);
  const overdue = isOverdue(task.due_date) && task.status === "open";
  const color = PRIORITY_COLOR[task.priority];
  const projectColor = task.project?.color ?? "#818cf8";
  const visibleTags = tags.filter((tg) => task.tag_ids.includes(tg.id)).slice(0, 2);

  return (
    <button
      onClick={onClick}
      className="w-full text-start rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] p-3 transition-all space-y-1.5"
    >
      <div className="flex items-start gap-2">
        <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: color, minHeight: 20 }} />
        <div className="flex-1 min-w-0">
          <div className={`text-[12px] font-semibold text-[var(--text-primary)] truncate ${task.status === "done" ? "line-through opacity-60" : ""}`}>
            {task.title}
          </div>
          <div className="text-[10px] text-[var(--text-dim)] truncate flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: projectColor }} />
            {task.project?.name ?? "—"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap pl-3">
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
            style={{
              background: `${tg.color ?? "#94a3b8"}22`,
              color: tg.color ?? "#94a3b8",
            }}
          >
            {tg.name}
          </span>
        ))}
      </div>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════
   REPORTING
   ══════════════════════════════════════════════════════════════════ */

function ReportingView() {
  const { t } = useTranslation(projectsT);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchProjects({ status: "all" }), fetchTasks({ status: "all" })]).then(([ps, ts]) => {
      setProjects(ps);
      setTasks(ts);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)] animate-spin" />
      </div>
    );
  }

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const totalProjects = projects.filter((p) => p.status === "active").length;
  const openTasks = tasks.filter((x) => x.status === "open").length;
  const overdue = tasks.filter((x) => x.status === "open" && isOverdue(x.due_date)).length;
  const doneThisWeek = tasks.filter((x) => x.status === "done" && x.closed_at && new Date(x.closed_at) >= oneWeekAgo).length;

  const byPriority: Record<TaskPriority, number> = { urgent: 0, high: 0, normal: 0, low: 0 };
  for (const tk of tasks) if (tk.status === "open") byPriority[tk.priority]++;
  const priorityMax = Math.max(1, ...Object.values(byPriority));

  const byAssignee = new Map<string, number>();
  for (const tk of tasks) {
    if (tk.status !== "open") continue;
    const name = tk.assignee?.username ?? "—";
    byAssignee.set(name, (byAssignee.get(name) ?? 0) + 1);
  }
  const assigneeRows = [...byAssignee.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const assigneeMax = Math.max(1, ...assigneeRows.map(([, c]) => c));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label={t("report.totalProjects")} value={totalProjects} accent="text-blue-400" />
        <KpiCard label={t("report.openTasks")} value={openTasks} accent="text-amber-400" />
        <KpiCard label={t("report.overdueTasks")} value={overdue} accent="text-rose-400" />
        <KpiCard label={t("report.completedWk")} value={doneThisWeek} accent="text-emerald-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* By priority */}
        <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-3">
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
            {t("report.byPriority")}
          </h3>
          {(["urgent", "high", "normal", "low"] as const).map((p) => (
            <div key={p} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: PRIORITY_COLOR[p] }} />
                  {t(`priority.${p}`)}
                </span>
                <span className="text-[var(--text-muted)] font-semibold">{byPriority[p]}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(byPriority[p] / priorityMax) * 100}%`, background: PRIORITY_COLOR[p] }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* By assignee */}
        <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-3">
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
            {t("report.byAssignee")}
          </h3>
          {assigneeRows.length === 0 ? (
            <div className="text-[11px] text-[var(--text-dim)]">{t("empty.noTasks")}</div>
          ) : (
            assigneeRows.map(([name, count]) => (
              <div key={name} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-muted)]">{name}</span>
                  <span className="text-[var(--text-muted)] font-semibold">{count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                  <div className="h-full rounded-full bg-blue-400" style={{ width: `${(count / assigneeMax) * 100}%` }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] mb-2">
        {label}
      </div>
      <div className={`text-[28px] font-bold leading-none ${accent}`}>{value}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   CONFIGURATION — tag CRUD
   ══════════════════════════════════════════════════════════════════ */

function ConfigurationView({ tags, reloadTags }: { tags: ProjectTag[]; reloadTags: () => void }) {
  const { t } = useTranslation(projectsT);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#60a5fa");

  const add = async () => {
    if (!name.trim()) return;
    await createTag({ name: name.trim(), color });
    setName("");
    reloadTags();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-3">
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
            className="h-9 w-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] cursor-pointer"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            placeholder={t("cfg.tags.placeholder")}
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
          {tags.map((tg) => (
            <TagRow key={tg.id} tag={tg} onReload={reloadTags} />
          ))}
          {tags.length === 0 && (
            <div className="text-[12px] text-[var(--text-dim)] py-3">{t("empty.noTasks")}</div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-2">
        <div className="flex items-center gap-2">
          <CogIcon size={14} className="text-[var(--text-dim)]" />
          <h3 className="text-[13px] font-bold">{t("cfg.stages.title")}</h3>
        </div>
        <p className="text-[11px] text-[var(--text-dim)]">{t("cfg.stages.help")}</p>
      </div>
    </div>
  );
}

function TagRow({ tag, onReload }: { tag: ProjectTag; onReload: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color ?? "#60a5fa");

  const save = async () => {
    await updateTag(tag.id, { name, color });
    setEditing(false);
    onReload();
  };
  const remove = async () => {
    if (!confirm("Delete this tag?")) return;
    await deleteTag(tag.id);
    onReload();
  };

  return (
    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
      {editing ? (
        <>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-8 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)]" />
          <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 h-7 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] outline-none" />
          <button onClick={save} className="h-7 px-2.5 rounded-md bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[11px] font-semibold">OK</button>
          <button onClick={() => setEditing(false)} className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center"><CrossIcon size={12} /></button>
        </>
      ) : (
        <>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{ background: `${tag.color ?? "#94a3b8"}22`, color: tag.color ?? "#94a3b8" }}>{tag.name}</span>
          <div className="flex-1" />
          <button onClick={() => setEditing(true)} className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center"><PencilIcon className="h-3 w-3" /></button>
          <button onClick={remove} className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-rose-400 flex items-center justify-center"><TrashIcon className="h-3 w-3" /></button>
        </>
      )}
    </div>
  );
}

/** Thin wrapper for opening the task modal from the flat My/All Tasks
 *  views — loads the editing task's project stages on demand so the
 *  Stage selector isn't stuck on "—". */
function FlatTaskFormModal({
  open,
  editing,
  tags,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: TaskRow | null;
  tags: ProjectTag[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [stages, setStages] = useState<ProjectStage[]>([]);

  useEffect(() => {
    if (!open || !editing) {
      setStages([]);
      return;
    }
    let cancelled = false;
    fetchStages(editing.project_id).then((s) => {
      if (!cancelled) setStages(s);
    });
    return () => { cancelled = true; };
  }, [open, editing]);

  return (
    <TaskFormModal
      open={open}
      editing={editing}
      projectId={editing?.project_id ?? ""}
      presetStageId={null}
      stages={stages}
      tags={tags}
      reloadTags={() => { /* no-op */ }}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

/* ══════════════════════════════════════════════════════════════════
   PROJECT FORM MODAL
   ══════════════════════════════════════════════════════════════════ */

function ProjectFormModal({
  open,
  editing,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  editing: ProjectRow | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation(projectsT);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#818cf8");
  const [isBillable, setIsBillable] = useState(false);
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
  const [budgetHours, setBudgetHours] = useState<string>("");
  const [status, setStatus] = useState<"active" | "on_hold" | "completed" | "archived">("active");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerLabel, setCustomerLabel] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setCode(editing.code ?? "");
      setDescription(editing.description ?? "");
      setColor(editing.color ?? "#818cf8");
      setIsBillable(editing.is_billable);
      setPlannedStart(editing.planned_start ?? "");
      setPlannedEnd(editing.planned_end ?? "");
      setBudgetHours(editing.budget_hours?.toString() ?? "");
      setStatus(editing.status);
      setCustomerId(editing.customer_id);
      setCustomerLabel(editing.customer?.display_name ?? editing.customer?.company_name ?? "");
    } else {
      setName("");
      setCode("");
      setDescription("");
      setColor("#818cf8");
      setIsBillable(false);
      setPlannedStart("");
      setPlannedEnd("");
      setBudgetHours("");
      setStatus("active");
      setCustomerId(null);
      setCustomerLabel("");
    }
  }, [open, editing]);

  if (!open) return null;

  const save = async () => {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      code: code.trim() || null,
      description: description.trim() || null,
      color,
      is_billable: isBillable,
      planned_start: plannedStart || null,
      planned_end: plannedEnd || null,
      budget_hours: budgetHours ? Number(budgetHours) : null,
      status,
      customer_id: customerId,
    };
    if (editing) {
      await updateProject(editing.id, payload);
    } else {
      await createProject(payload);
    }
    onSaved();
  };

  const remove = async () => {
    if (!editing) return;
    if (!confirm("Delete this project and all its tasks?")) return;
    await deleteProject(editing.id);
    onDeleted();
  };

  return (
    <ScrollLockOverlay className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-t-2xl sm:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-color)]">
          <h2 className="text-[15px] font-bold">
            {editing ? t("form.title.edit") : t("form.title.new")}
          </h2>
          <button onClick={onClose} className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center">
            <CrossIcon size={14} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3 overflow-y-auto">
          <Field label={t("form.name")}>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label={t("form.code")}>
              <input value={code} onChange={(e) => setCode(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none" />
            </Field>
            <Field label={t("form.color")}>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] cursor-pointer" />
            </Field>
          </div>
          <Field label={t("form.description")}>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none resize-none" />
          </Field>
          <Field label={t("form.customer")}>
            <EntityPicker
              entityType="customer"
              entityId={customerId}
              entityLabel={customerLabel || null}
              onChange={(id, label) => { setCustomerId(id); setCustomerLabel(label ?? ""); }}
              placeholder={t("form.customer")}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label={t("form.plannedStart")}>
              <input type="date" value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none" />
            </Field>
            <Field label={t("form.plannedEnd")}>
              <input type="date" value={plannedEnd} onChange={(e) => setPlannedEnd(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label={t("form.budgetHours")}>
              <input type="number" value={budgetHours} onChange={(e) => setBudgetHours(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none" />
            </Field>
            <Field label={t("form.billable")}>
              <label className="flex items-center gap-2 h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] cursor-pointer">
                <input type="checkbox" checked={isBillable} onChange={(e) => setIsBillable(e.target.checked)} className="accent-white" />
                <span className="text-[13px]">{isBillable ? t("form.billable") : "—"}</span>
              </label>
            </Field>
          </div>
          <Field label={t("form.status")}>
            <div className="flex gap-1.5 flex-wrap">
              {(["active", "on_hold", "completed", "archived"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`h-8 px-3 rounded-lg text-[11px] font-semibold border transition-colors ${
                    status === s ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent" : "bg-[var(--bg-surface)] text-[var(--text-dim)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {s === "active" && t("filter.active")}
                  {s === "on_hold" && t("filter.onHold")}
                  {s === "completed" && t("filter.completed")}
                  {s === "archived" && t("filter.archived")}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-[var(--border-color)]">
          <div>
            {editing && (
              <button onClick={remove} className="h-9 px-3 rounded-lg text-rose-400 hover:bg-rose-500/10 text-[12px] font-semibold flex items-center gap-1.5">
                <TrashIcon className="h-3.5 w-3.5" /> {t("btn.delete")}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="h-9 px-3 text-[var(--text-dim)] hover:text-[var(--text-primary)] text-[12px] font-semibold">{t("btn.cancel")}</button>
            <button onClick={save} className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold">
              {editing ? t("btn.save") : t("btn.create")}
            </button>
          </div>
        </div>
      </div>
    </ScrollLockOverlay>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TASK FORM MODAL
   ══════════════════════════════════════════════════════════════════ */

function TaskFormModal({
  open,
  editing,
  projectId,
  presetStageId,
  stages,
  tags,
  reloadTags: _reloadTags,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: TaskRow | null;
  projectId: string;
  presetStageId: string | null;
  stages: ProjectStage[];
  tags: ProjectTag[];
  reloadTags: () => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation(projectsT);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stageId, setStageId] = useState<string>("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [dueDate, setDueDate] = useState("");
  const [estimated, setEstimated] = useState<string>("");
  const [logged, setLogged] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<TaskStatus>("open");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [linkedType, setLinkedType] = useState<string>("");
  const [linkedId, setLinkedId] = useState<string | null>(null);
  const [linkedLabel, setLinkedLabel] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description ?? "");
      setStageId(editing.stage_id ?? "");
      setPriority(editing.priority);
      setDueDate(editing.due_date ?? "");
      setEstimated(editing.estimated_hours?.toString() ?? "");
      setLogged(editing.logged_hours.toString());
      setProgress(editing.progress_pct);
      setStatus(editing.status);
      setTagIds(editing.tag_ids);
      setLinkedType(editing.linked_entity_type ?? "");
      setLinkedId(editing.linked_entity_id);
      setLinkedLabel(editing.linked_entity_label ?? "");
    } else {
      setTitle("");
      setDescription("");
      setStageId(presetStageId ?? stages.find((s) => s.is_default_new)?.id ?? stages[0]?.id ?? "");
      setPriority("normal");
      setDueDate("");
      setEstimated("");
      setLogged("0");
      setProgress(0);
      setStatus("open");
      setTagIds([]);
      setLinkedType("");
      setLinkedId(null);
      setLinkedLabel("");
    }
  }, [open, editing, presetStageId, stages]);

  if (!open) return null;

  const save = async () => {
    if (!title.trim()) return;
    const payload = {
      project_id: editing ? editing.project_id : projectId,
      title: title.trim(),
      description: description.trim() || null,
      stage_id: stageId || null,
      priority,
      due_date: dueDate || null,
      estimated_hours: estimated ? Number(estimated) : null,
      logged_hours: logged ? Number(logged) : 0,
      progress_pct: progress,
      status,
      tag_ids: tagIds,
      linked_entity_type: linkedType || null,
      linked_entity_id: linkedId,
      linked_entity_label: linkedLabel || null,
    };
    if (editing) {
      await updateTask(editing.id, payload);
    } else {
      await createTask(payload);
    }
    onSaved();
  };

  const remove = async () => {
    if (!editing) return;
    if (!confirm(t("task.deleteConfirm"))) return;
    await deleteTask(editing.id);
    onSaved();
  };

  const toggleTag = (id: string) => {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <ScrollLockOverlay className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-t-2xl sm:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-color)]">
          <h2 className="text-[15px] font-bold">
            {editing ? t("task.title.edit") : t("task.title.new")}
          </h2>
          <button onClick={onClose} className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center">
            <CrossIcon size={14} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-y-auto">
          <Field label={t("task.namePh")}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("task.namePh")} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none" />
          </Field>
          <Field label={t("task.description")}>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none resize-none" />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label={t("task.stage")}>
              <select value={stageId} onChange={(e) => setStageId(e.target.value)} disabled={stages.length === 0} className="w-full h-10 px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px]">
                <option value="">—</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label={t("task.priority")}>
              <div className="flex gap-1">
                {(["low", "normal", "high", "urgent"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`flex-1 h-10 rounded-lg text-[11px] font-semibold border transition-colors ${
                      priority === p ? "border-transparent" : "bg-[var(--bg-surface)] text-[var(--text-dim)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                    }`}
                    style={priority === p ? { background: `${PRIORITY_COLOR[p]}22`, color: PRIORITY_COLOR[p] } : undefined}
                  >
                    {t(`priority.${p}`)}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label={t("task.dueDate")}>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none" />
            </Field>
            <Field label={t("task.estimated")}>
              <input type="number" value={estimated} onChange={(e) => setEstimated(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none" />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label={t("task.logged")}>
              <input type="number" value={logged} onChange={(e) => setLogged(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none" />
            </Field>
            <Field label={t("task.progress")}>
              <div className="flex items-center gap-2 h-10">
                <input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="flex-1" />
                <span className="text-[11px] font-semibold text-[var(--text-muted)] w-10 text-end">{progress}%</span>
              </div>
            </Field>
          </div>

          {tags.length > 0 && (
            <Field label={t("task.tags")}>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tg) => {
                  const on = tagIds.includes(tg.id);
                  return (
                    <button
                      key={tg.id}
                      onClick={() => toggleTag(tg.id)}
                      className={`text-[11px] font-semibold px-2 py-1 rounded border transition-colors ${on ? "" : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}
                      style={on ? { background: `${tg.color ?? "#94a3b8"}22`, color: tg.color ?? "#94a3b8", borderColor: "transparent" } : undefined}
                    >
                      {tg.name}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
            <select value={linkedType} onChange={(e) => { setLinkedType(e.target.value); setLinkedId(null); setLinkedLabel(""); }} className="h-10 px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px]">
              <option value="">{t("task.linked")}</option>
              <option value="customer">Customer</option>
              <option value="supplier">Supplier</option>
              <option value="contact">Contact</option>
              <option value="product">Product</option>
            </select>
            {linkedType === "customer" || linkedType === "supplier" || linkedType === "contact" || linkedType === "product" ? (
              <EntityPicker
                entityType={linkedType as "customer" | "supplier" | "contact" | "product"}
                entityId={linkedId}
                entityLabel={linkedLabel || null}
                onChange={(id, label) => { setLinkedId(id); setLinkedLabel(label ?? ""); }}
              />
            ) : (
              <div className="h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center text-[12px] text-[var(--text-ghost)]">—</div>
            )}
          </div>

          <Field label={t("task.status")}>
            <div className="flex gap-1.5 flex-wrap">
              {(["open", "done", "cancelled"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`h-8 px-3 rounded-lg text-[11px] font-semibold border transition-colors ${status === s ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent" : "bg-[var(--bg-surface)] text-[var(--text-dim)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"}`}
                >
                  {t(`status.${s}`)}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-[var(--border-color)]">
          <div>
            {editing && (
              <button onClick={remove} className="h-9 px-3 rounded-lg text-rose-400 hover:bg-rose-500/10 text-[12px] font-semibold flex items-center gap-1.5">
                <TrashIcon className="h-3.5 w-3.5" /> {t("btn.delete")}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="h-9 px-3 text-[var(--text-dim)] hover:text-[var(--text-primary)] text-[12px] font-semibold">{t("btn.cancel")}</button>
            <button onClick={save} className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold">
              {editing ? t("btn.save") : t("btn.create")}
            </button>
          </div>
        </div>
      </div>
    </ScrollLockOverlay>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{label}</div>
      {children}
    </div>
  );
}
