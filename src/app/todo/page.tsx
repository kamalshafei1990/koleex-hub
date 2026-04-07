"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, Plus, Search, X, Loader2, CheckSquare, Square, Trash2,
  Pencil, Calendar, Flag, Tag, ChevronDown, Circle, CheckCircle2,
  AlertCircle, Clock, MoreHorizontal, ListTodo,
} from "lucide-react";
import {
  fetchTodos, createTodo, updateTodo, toggleTodo, deleteTodo,
} from "@/lib/todo-admin";
import type { TodoEntry } from "@/lib/todo-admin";

/* ── Priority config ── */
const PRIORITIES: { value: TodoEntry["priority"]; label: string; color: string; icon: typeof Flag }[] = [
  { value: "high", label: "High", color: "text-red-400", icon: Flag },
  { value: "medium", label: "Medium", color: "text-yellow-400", icon: Flag },
  { value: "low", label: "Low", color: "text-blue-400", icon: Flag },
];

const LABELS = ["Work", "Personal", "Shopping", "Health", "Finance", "Learning", "Other"];

/* ── Helpers ── */
function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff <= 6) return d.toLocaleDateString("en", { weekday: "long" });
  return d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

/* ── Delete Confirmation Modal ── */
function DeleteModal({
  open, deleting, onConfirm, onClose,
}: { open: boolean; deleting: boolean; onConfirm: () => void; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 space-y-4">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Delete Task</h3>
        <p className="text-sm text-[var(--text-muted)]">This action cannot be undone.</p>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose}
            className="h-9 px-4 rounded-lg text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="h-9 px-4 rounded-lg bg-red-500/90 text-white text-[13px] font-semibold flex items-center gap-2 hover:bg-red-500 transition-colors disabled:opacity-50">
            {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Task Form Modal ── */
function TaskModal({
  open, editEntry, onClose, onSave,
}: {
  open: boolean;
  editEntry: TodoEntry | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TodoEntry["priority"]>("medium");
  const [label, setLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (editEntry) {
        setTitle(editEntry.title);
        setDescription(editEntry.description || "");
        setPriority(editEntry.priority);
        setLabel(editEntry.label || "");
        setDueDate(editEntry.due_date ? editEntry.due_date.split("T")[0] : "");
      } else {
        setTitle("");
        setDescription("");
        setPriority("medium");
        setLabel("");
        setDueDate("");
      }
      setError("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, editEntry]);

  const handleSave = async () => {
    if (!title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError("");
    try {
      if (editEntry) {
        await updateTodo(editEntry.id, {
          title: title.trim(),
          description: description.trim() || null,
          priority,
          label: label || null,
          due_date: dueDate || null,
        });
      } else {
        await createTodo({
          title: title.trim(),
          description: description.trim() || null,
          completed: false,
          priority,
          label: label || null,
          due_date: dueDate || null,
        });
      }
      setSaving(false);
      onSave();
      onClose();
    } catch {
      setError("Something went wrong.");
      setSaving(false);
    }
  };

  if (!open) return null;

  const inp = "w-full h-11 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all";
  const lbl = "block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh] overflow-y-auto bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5">
            <ListTodo size={18} className="text-[var(--text-dim)]" />
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
              {editEntry ? "Edit Task" : "New Task"}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors">
            <X size={16} className="text-[var(--text-dim)]" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className={lbl}>Title *</label>
            <input ref={inputRef} value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?" className={inp}
              onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) handleSave(); }}
            />
          </div>

          {/* Description */}
          <div>
            <label className={lbl}>Description <span className="font-normal normal-case">(optional)</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details..." rows={2} className={inp + " h-auto py-3 resize-none"} />
          </div>

          {/* Priority + Due Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Priority</label>
              <div className="flex gap-1.5">
                {PRIORITIES.map((p) => (
                  <button key={p.value} onClick={() => setPriority(p.value)}
                    className={`flex-1 h-9 rounded-lg text-[11px] font-semibold transition-all border ${
                      priority === p.value
                        ? p.value === "high" ? "bg-red-500/15 border-red-500/30 text-red-400"
                          : p.value === "medium" ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-400"
                          : "bg-blue-500/15 border-blue-500/30 text-blue-400"
                        : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={lbl}>Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className={inp + " text-[12px]"} />
            </div>
          </div>

          {/* Label */}
          <div>
            <label className={lbl}>Label</label>
            <div className="flex flex-wrap gap-1.5">
              {LABELS.map((l) => (
                <button key={l} onClick={() => setLabel(label === l ? "" : l)}
                  className={`h-7 px-3 rounded-full text-[11px] font-medium transition-all border ${
                    label === l
                      ? "bg-white/10 border-white/20 text-[var(--text-primary)]"
                      : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border-subtle)]">
          <button onClick={onClose}
            className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !title.trim()}
            className="h-10 px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-40">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving..." : editEntry ? "Save Changes" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Task Row ── */
function TaskRow({
  task, onToggle, onEdit, onDelete,
}: {
  task: TodoEntry;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const priorityConfig = PRIORITIES.find((p) => p.value === task.priority) || PRIORITIES[1];
  const overdue = !task.completed && isOverdue(task.due_date);

  return (
    <div className={`group flex items-start gap-3 px-4 py-3.5 rounded-xl transition-all hover:bg-[var(--bg-surface-subtle)] ${
      task.completed ? "opacity-50" : ""
    }`}>
      {/* Checkbox */}
      <button onClick={onToggle} className="mt-0.5 shrink-0 transition-transform hover:scale-110">
        {task.completed ? (
          <CheckCircle2 size={20} className="text-green-400" />
        ) : (
          <Circle size={20} className={`text-[var(--text-ghost)] hover:${priorityConfig.color}`} />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-medium leading-snug ${
          task.completed ? "line-through text-[var(--text-dim)]" : "text-[var(--text-primary)]"
        }`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-[12px] text-[var(--text-dim)] mt-0.5 line-clamp-1">{task.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {/* Priority badge */}
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${priorityConfig.color}`}>
            <Flag size={10} />
            {priorityConfig.label}
          </span>
          {/* Label */}
          {task.label && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--text-faint)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded">
              <Tag size={9} />
              {task.label}
            </span>
          )}
          {/* Due date */}
          {task.due_date && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${
              overdue ? "text-red-400" : task.completed ? "text-[var(--text-dim)]" : "text-[var(--text-faint)]"
            }`}>
              {overdue ? <AlertCircle size={10} /> : <Clock size={10} />}
              {formatDate(task.due_date)}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit}
          className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors text-[var(--text-dim)] hover:text-[var(--text-primary)]">
          <Pencil size={14} />
        </button>
        <button onClick={onDelete}
          className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-[var(--text-dim)] hover:text-red-400">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function TodoPage() {
  const [todos, setTodos] = useState<TodoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [modal, setModal] = useState<{ open: boolean; entry: TodoEntry | null }>({ open: false, entry: null });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; task: TodoEntry | null }>({ open: false, task: null });
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const loadTodos = useCallback(async () => {
    const data = await fetchTodos();
    setTodos(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadTodos(); }, [loadTodos]);

  const handleToggle = async (id: string) => {
    setToggling(id);
    // Optimistic update
    setTodos((prev) => prev.map((t) => t.id === id ? { ...t, completed: !t.completed } : t));
    await toggleTodo(id);
    setToggling(null);
  };

  const handleDelete = async () => {
    if (!deleteModal.task) return;
    setDeleting(true);
    await deleteTodo(deleteModal.task.id);
    setDeleting(false);
    setDeleteModal({ open: false, task: null });
    loadTodos();
  };

  const filtered = useMemo(() => {
    let list = todos;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.label?.toLowerCase().includes(q));
    }
    if (filter === "active") list = list.filter((t) => !t.completed);
    if (filter === "completed") list = list.filter((t) => t.completed);
    if (priorityFilter !== "all") list = list.filter((t) => t.priority === priorityFilter);
    return list;
  }, [todos, search, filter, priorityFilter]);

  const stats = useMemo(() => ({
    total: todos.length,
    active: todos.filter((t) => !t.completed).length,
    completed: todos.filter((t) => t.completed).length,
    overdue: todos.filter((t) => !t.completed && isOverdue(t.due_date)).length,
  }), [todos]);

  // Group: overdue → today → upcoming → no date → completed
  const grouped = useMemo(() => {
    const active = filtered.filter((t) => !t.completed);
    const completed = filtered.filter((t) => t.completed);
    const overdue = active.filter((t) => isOverdue(t.due_date));
    const today = active.filter((t) => t.due_date && formatDate(t.due_date) === "Today" && !isOverdue(t.due_date));
    const upcoming = active.filter((t) => t.due_date && !isOverdue(t.due_date) && formatDate(t.due_date) !== "Today");
    const noDate = active.filter((t) => !t.due_date);
    return { overdue, today, upcoming, noDate, completed };
  }, [filtered]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <Link href="/"
            className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-[var(--text-dim)]" />
            <h1 className="text-xl md:text-[26px] font-bold tracking-tight">To-do</h1>
          </div>
        </div>
        <p className="text-[12px] md:text-[13px] text-[var(--text-dim)] mb-6 md:mb-8 ml-11">Manage your tasks</p>

        {/* Stats */}
        <div className="flex flex-wrap gap-2 mb-5">
          <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <ListTodo className="h-3 w-3 text-[var(--text-dim)]" />
            <span className="text-[16px] font-bold text-[var(--text-primary)] tabular-nums">{stats.total}</span>
            <span className="text-[11px] text-[var(--text-dim)]">tasks</span>
          </div>
          <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <Circle className="h-3 w-3 text-[var(--text-dim)]" />
            <span className="text-[16px] font-bold text-[var(--text-primary)] tabular-nums">{stats.active}</span>
            <span className="text-[11px] text-[var(--text-dim)]">active</span>
          </div>
          <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <CheckCircle2 className="h-3 w-3 text-green-400" />
            <span className="text-[16px] font-bold text-[var(--text-primary)] tabular-nums">{stats.completed}</span>
            <span className="text-[11px] text-[var(--text-dim)]">done</span>
          </div>
          {stats.overdue > 0 && (
            <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="h-3 w-3 text-red-400" />
              <span className="text-[16px] font-bold text-red-400 tabular-nums">{stats.overdue}</span>
              <span className="text-[11px] text-red-400/70">overdue</span>
            </div>
          )}
        </div>

        {/* Search + Filter Bar */}
        <div className="space-y-4">
        {/* Search + Filter Bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 gap-3 focus-within:border-[var(--border-focus)] transition-all">
            <Search size={16} className="text-[var(--text-dim)]" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="flex-1 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none h-10" />
            {search && (
              <button onClick={() => setSearch("")} className="p-0.5">
                <X size={14} className="text-[var(--text-dim)]" />
              </button>
            )}
          </div>
          <button onClick={() => setModal({ open: true, entry: null })}
            className="h-10 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shrink-0">
            <Plus size={16} />
            <span className="hidden md:inline">Add Task</span>
          </button>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(["all", "active", "completed"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`h-7 px-3 rounded-full text-[11px] font-semibold transition-all border whitespace-nowrap ${
                filter === f
                  ? "bg-white/10 border-white/20 text-[var(--text-primary)]"
                  : "bg-transparent border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
              }`}
            >
              {f === "all" ? `All (${stats.total})` : f === "active" ? `Active (${stats.active})` : `Done (${stats.completed})`}
            </button>
          ))}
          <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />
          {PRIORITIES.map((p) => (
            <button key={p.value} onClick={() => setPriorityFilter(priorityFilter === p.value ? "all" : p.value)}
              className={`h-7 px-2.5 rounded-full text-[11px] font-semibold transition-all border flex items-center gap-1 whitespace-nowrap ${
                priorityFilter === p.value
                  ? p.value === "high" ? "bg-red-500/15 border-red-500/30 text-red-400"
                    : p.value === "medium" ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-400"
                    : "bg-blue-500/15 border-blue-500/30 text-blue-400"
                  : "bg-transparent border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
              }`}
            >
              <Flag size={10} />
              {p.label}
            </button>
          ))}
        </div>

        {/* Task List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--text-dim)]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[var(--bg-surface)]">
              <CheckSquare size={24} className="text-[var(--text-ghost)]" />
            </div>
            <p className="text-[var(--text-faint)] text-sm font-medium">
              {search ? "No tasks match your search" : filter === "completed" ? "No completed tasks" : "No tasks yet"}
            </p>
            {!search && filter === "all" && (
              <button onClick={() => setModal({ open: true, entry: null })}
                className="text-[12px] text-blue-400 hover:text-blue-300 font-medium transition-colors">
                Create your first task
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Overdue */}
            {grouped.overdue.length > 0 && (
              <Section title="Overdue" count={grouped.overdue.length} color="text-red-400">
                {grouped.overdue.map((t) => (
                  <TaskRow key={t.id} task={t}
                    onToggle={() => handleToggle(t.id)}
                    onEdit={() => setModal({ open: true, entry: t })}
                    onDelete={() => setDeleteModal({ open: true, task: t })}
                  />
                ))}
              </Section>
            )}

            {/* Today */}
            {grouped.today.length > 0 && (
              <Section title="Today" count={grouped.today.length} color="text-green-400">
                {grouped.today.map((t) => (
                  <TaskRow key={t.id} task={t}
                    onToggle={() => handleToggle(t.id)}
                    onEdit={() => setModal({ open: true, entry: t })}
                    onDelete={() => setDeleteModal({ open: true, task: t })}
                  />
                ))}
              </Section>
            )}

            {/* Upcoming */}
            {grouped.upcoming.length > 0 && (
              <Section title="Upcoming" count={grouped.upcoming.length} color="text-blue-400">
                {grouped.upcoming.map((t) => (
                  <TaskRow key={t.id} task={t}
                    onToggle={() => handleToggle(t.id)}
                    onEdit={() => setModal({ open: true, entry: t })}
                    onDelete={() => setDeleteModal({ open: true, task: t })}
                  />
                ))}
              </Section>
            )}

            {/* No date */}
            {grouped.noDate.length > 0 && (
              <Section title="No Due Date" count={grouped.noDate.length} color="text-[var(--text-faint)]">
                {grouped.noDate.map((t) => (
                  <TaskRow key={t.id} task={t}
                    onToggle={() => handleToggle(t.id)}
                    onEdit={() => setModal({ open: true, entry: t })}
                    onDelete={() => setDeleteModal({ open: true, task: t })}
                  />
                ))}
              </Section>
            )}

            {/* Completed */}
            {grouped.completed.length > 0 && (
              <Section title="Completed" count={grouped.completed.length} color="text-[var(--text-dim)]">
                {grouped.completed.map((t) => (
                  <TaskRow key={t.id} task={t}
                    onToggle={() => handleToggle(t.id)}
                    onEdit={() => setModal({ open: true, entry: t })}
                    onDelete={() => setDeleteModal({ open: true, task: t })}
                  />
                ))}
              </Section>
            )}
          </div>
        )}
      </div>
      </div>

      {/* Modals */}
      <TaskModal
        open={modal.open}
        editEntry={modal.entry}
        onClose={() => setModal({ open: false, entry: null })}
        onSave={loadTodos}
      />
      <DeleteModal
        open={deleteModal.open}
        deleting={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteModal({ open: false, task: null })}
      />
    </div>
  );
}

/* ── Section Group ── */
function Section({
  title, count, color, children,
}: { title: string; count: number; color: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <h3 className={`text-[12px] font-semibold uppercase tracking-wider ${color}`}>{title}</h3>
        <span className="text-[11px] text-[var(--text-dim)] bg-[var(--bg-surface)] px-2 py-0.5 rounded-full">{count}</span>
      </div>
      <div className="divide-y divide-[var(--border-subtle)]">
        {children}
      </div>
    </div>
  );
}
