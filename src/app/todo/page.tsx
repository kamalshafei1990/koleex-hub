"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { fpAvatar } from "@/lib/cdn";
import Link from "next/link";
import { ScrollLockOverlay } from "@/hooks/useScrollLock";
import { useTranslation } from "@/lib/i18n";
import { todoT } from "@/lib/translations/todo";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CheckSquareIcon from "@/components/icons/ui/CheckSquareIcon";
import SquareIcon from "@/components/icons/ui/SquareIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import CalendarRawIcon from "@/components/icons/ui/CalendarRawIcon";
import DatePicker from "@/components/ui/DatePicker";
import TaskExtras from "@/components/todo/TaskExtras";
import FlagIcon from "@/components/icons/ui/FlagIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import CircleIcon from "@/components/icons/ui/CircleIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import MoreHorizontalIcon from "@/components/icons/ui/MoreHorizontalIcon";
import ListTodoIcon from "@/components/icons/ui/ListTodoIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import AtSignIcon from "@/components/icons/ui/AtSignIcon";
import FileIcon from "@/components/icons/ui/FileIcon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import PaperPlaneIcon from "@/components/icons/ui/PaperPlaneIcon";
import MessageSquareIcon from "@/components/icons/ui/MessageSquareIcon";
import TrendingUpIcon from "@/components/icons/ui/TrendingUpIcon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import TargetIcon from "@/components/icons/ui/TargetIcon";
import AwardIcon from "@/components/icons/ui/AwardIcon";
import UserCheckIcon from "@/components/icons/ui/UserCheckIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import RefreshCwIcon from "@/components/icons/ui/RefreshCwIcon";
import LayoutListIcon from "@/components/icons/ui/LayoutListIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import FilterIcon from "@/components/icons/ui/FilterIcon";
import AngleUpIcon from "@/components/icons/ui/AngleUpIcon";
import TodoIcon from "@/components/icons/TodoIcon";
import MyWorkStrip from "@/components/todo/MyWorkStrip";
import {
  fetchTodos, createTodo, updateTodo, toggleTodo, deleteTodo,
  addTodoNote, deleteTodoNote,
  fetchTodoLabels, createTodoLabel,
  fetchAssignableEmployees, fetchDepartments,
  subscribeToTodos,
} from "@/lib/todo-admin";
import { fetchProjects } from "@/lib/projects";
import type {
  TodoWithRelations, TodoAssigneeInfo, TodoLabelRow, TodoPriority, TodoMetadata, TodoChecklistItem, TodoStatus, TodoRecurrence,
} from "@/types/supabase";
import { getCurrentAccountIdSync } from "@/lib/identity";
import { usePermissions } from "@/lib/permissions";
import { loadScopeContext, type ScopeContext } from "@/lib/scope";

/* ── Priority config ── */
const PRIORITIES: { value: TodoPriority; label: string; color: string }[] = [
  { value: "high", label: "High", color: "text-red-400" },
  { value: "medium", label: "Medium", color: "text-yellow-400" },
  { value: "low", label: "Low", color: "text-blue-400" },
];

/* ── Status (workflow stage) config ── */
const STATUSES: { value: TodoStatus; label: string; dot: string }[] = [
  { value: "todo", label: "To do", dot: "bg-[var(--text-dim)]" },
  { value: "in_progress", label: "In progress", dot: "bg-blue-400" },
  { value: "blocked", label: "Blocked", dot: "bg-red-400" },
  { value: "done", label: "Done", dot: "bg-green-400" },
];

/* ── Recurrence config (Phase C). value=null → one-off task. ── */
const RECURRENCES: { value: TodoRecurrence; key: string }[] = [
  { value: null, key: "rec.once" },
  { value: "daily", key: "rec.daily" },
  { value: "weekly", key: "rec.weekly" },
  { value: "monthly", key: "rec.monthly" },
];

/* datetime-local <-> ISO helpers for the reminder field. */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

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

/* Absolute date / date-time for the expanded task detail panel. */
function fmtDetailDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
}
function fmtDetailDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

function getInitials(name: string | null, username?: string): string {
  if (name) {
    const parts = name.split(" ").filter(Boolean);
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0]?.substring(0, 2).toUpperCase() || "?";
  }
  return username?.substring(0, 2).toUpperCase() || "?";
}

/* ── Avatar ── */
function MiniAvatar({ info, size = 28 }: { info: TodoAssigneeInfo; size?: number }) {
  // Track load failure so a broken/blocked image degrades to initials instead
  // of the browser's broken-image glyph. Reset when the source changes.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [info.avatar_url]);

  return info.avatar_url && !failed ? (
    <img src={fpAvatar(info.avatar_url)} alt="" className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }} onError={() => setFailed(true)} />
  ) : (
    <div className="rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0 font-bold"
      style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {getInitials(info.full_name, info.username)}
    </div>
  );
}

/* ── Section Group ── */
function Section({ title, count, color, children }: {
  title: string; count: number; color: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-[var(--bg-surface-subtle)] transition-colors">
        <AngleDownIcon size={14} className={`text-[var(--text-dim)] transition-transform ${open ? "" : "-rotate-90"}`} />
        <span className={`text-[12px] font-bold uppercase tracking-wider ${color}`}>{title}</span>
        <span className="text-[10px] font-semibold text-[var(--text-ghost)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded-full">{count}</span>
      </button>
      {open && <div className="border-t border-[var(--border-subtle)]">{children}</div>}
    </div>
  );
}

/* ── Delete Confirmation Modal ── */
function DeleteModal({ open, deleting, onConfirm, onClose }: {
  open: boolean; deleting: boolean; onConfirm: () => void; onClose: () => void;
}) {
  const { t } = useTranslation(todoT);
  if (!open) return null;
  return (
    <ScrollLockOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 space-y-4">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{t("modal.delete")}</h3>
        <p className="text-sm text-[var(--text-muted)]">{t("modal.deleteConfirm")}</p>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose}
            className="h-9 px-4 rounded-lg text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">
            {t("modal.cancel")}
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="h-9 px-4 rounded-lg bg-red-500/90 text-white text-[13px] font-semibold flex items-center gap-2 hover:bg-red-500 transition-colors disabled:opacity-50">
            {deleting && <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />}
            {t("modal.delete")}
          </button>
        </div>
      </div>
    </ScrollLockOverlay>
  );
}

/* ── Checklist / subtasks editor (stored in metadata.checklist) ── */
function ChecklistField({ items, onChange }: {
  items: TodoChecklistItem[];
  onChange: (next: TodoChecklistItem[]) => void;
}) {
  const { t } = useTranslation(todoT);
  const [text, setText] = useState("");
  const add = () => {
    const v = text.trim();
    if (!v) return;
    onChange([...items, { id: crypto.randomUUID(), text: v, done: false }]);
    setText("");
  };
  const done = items.filter((i) => i.done).length;
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
        {t("checklist.title")}{items.length > 0 && <span className="ml-1.5 text-[var(--text-muted)] normal-case">{done}/{items.length}</span>}
      </label>
      {items.length > 0 && (
        <div className="space-y-1 mb-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-2 group">
              <button type="button" onClick={() => onChange(items.map((x) => x.id === it.id ? { ...x, done: !x.done } : x))} className="shrink-0">
                {it.done
                  ? <CheckCircleIcon size={16} className="text-[var(--text-primary)]" />
                  : <CircleIcon size={16} className="text-[var(--text-ghost)]" />}
              </button>
              <span className={`flex-1 text-[12.5px] ${it.done ? "line-through text-[var(--text-dim)]" : "text-[var(--text-primary)]"}`}>{it.text}</span>
              <button type="button" onClick={() => onChange(items.filter((x) => x.id !== it.id))}
                className="shrink-0 text-[var(--text-dim)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                <CrossIcon size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={t("checklist.placeholder")}
          className="flex-1 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-all" />
        <button type="button" onClick={add} disabled={!text.trim()}
          className="h-9 w-9 shrink-0 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] disabled:opacity-30">
          <PlusIcon size={14} />
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TASK MODAL — Create / Edit with employee assignment
   ══════════════════════════════════════════════════════════════ */
function TaskModal({ open, editEntry, employees, departments, labels, onClose, onSave }: {
  open: boolean;
  editEntry: TodoWithRelations | null;
  employees: TodoAssigneeInfo[];
  departments: string[];
  labels: TodoLabelRow[];
  onClose: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation(todoT);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("medium");
  const [label, setLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [assignAll, setAssignAll] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [status, setStatus] = useState<TodoStatus>("todo");
  const [recurrence, setRecurrence] = useState<TodoRecurrence>(null);
  const [recurrenceUntil, setRecurrenceUntil] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newLabelName, setNewLabelName] = useState("");
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [empSearch, setEmpSearch] = useState("");
  const [extras, setExtras] = useState<TodoMetadata>({});
  const [showExtras, setShowExtras] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const accountId = getCurrentAccountIdSync();

  /* Active projects for the optional "Related project" link. fetchProjects
     returns [] when the user lacks Projects access, which hides the field. */
  useEffect(() => {
    if (!open || projects.length > 0) return;
    fetchProjects({ status: "active" })
      .then((rows) => setProjects(rows.map((r) => ({ id: r.id, name: r.name }))))
      .catch(() => {});
  }, [open, projects.length]);

  const setRelatedProject = (id: string) => {
    setExtras((prev) => {
      const next = { ...prev };
      const p = projects.find((x) => x.id === id) ?? (prev.project?.id === id ? prev.project : null);
      if (p) next.project = { id: p.id, name: p.name };
      else delete next.project;
      return next;
    });
  };

  useEffect(() => {
    if (open) {
      if (editEntry) {
        setTitle(editEntry.title);
        setDescription(editEntry.description || "");
        setPriority(editEntry.priority);
        setLabel(editEntry.label || "");
        setDueDate(editEntry.due_date ? editEntry.due_date.split("T")[0] : "");
        setStartDate(editEntry.start_date ? editEntry.start_date.split("T")[0] : "");
        setRemindAt(isoToLocalInput(editEntry.remind_at));
        setStatus(editEntry.status ?? "todo");
        setRecurrence(editEntry.recurrence ?? null);
        setRecurrenceUntil(editEntry.recurrence_until ? editEntry.recurrence_until.split("T")[0] : "");
        setSelectedAssignees(editEntry.assignees.map((a) => a.account_id));
        setSelectedDept(editEntry.assigned_department || "");
        setAssignAll(editEntry.assign_to_all);
        {
          const m = editEntry.metadata && typeof editEntry.metadata === "object" ? editEntry.metadata : {};
          setExtras(m);
          // Auto-expand the attachments section only when the task already has some.
          setShowExtras(!!(m.attachments?.length || m.mentions?.length || m.products?.length));
        }
      } else {
        setTitle(""); setDescription(""); setPriority("medium"); setLabel(""); setDueDate("");
        setStartDate(""); setRemindAt(""); setStatus("todo");
        setRecurrence(null); setRecurrenceUntil("");
        setSelectedAssignees([]); setSelectedDept(""); setAssignAll(false);
        setExtras({}); setShowExtras(false);
      }
      setError(""); setEmpSearch(""); setNewLabelName(""); setShowNewLabel(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, editEntry]);

  const toggleAssignee = (id: string) => {
    setAssignAll(false);
    setSelectedDept("");
    setSelectedAssignees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectDept = (dept: string) => {
    setAssignAll(false);
    setSelectedDept(dept === selectedDept ? "" : dept);
    if (dept !== selectedDept) {
      const deptEmpIds = employees.filter((e) => e.department === dept).map((e) => e.account_id);
      setSelectedAssignees(deptEmpIds);
    } else {
      setSelectedAssignees([]);
    }
  };

  const selectAll = () => {
    setSelectedDept("");
    if (assignAll) {
      setAssignAll(false);
      setSelectedAssignees([]);
    } else {
      setAssignAll(true);
      setSelectedAssignees(employees.map((e) => e.account_id));
    }
  };

  const handleSave = async () => {
    if (!title.trim()) { setError(t("err.titleRequired")); return; }
    setSaving(true); setError("");
    try {
      if (editEntry) {
        await updateTodo(editEntry.id, {
          title: title.trim(),
          description: description.trim() || null,
          priority,
          label: label || null,
          due_date: dueDate || null,
          start_date: startDate || null,
          remind_at: localInputToIso(remindAt),
          status,
          recurrence,
          recurrence_until: recurrence ? recurrenceUntil || null : null,
          assigned_department: selectedDept || null,
          assign_to_all: assignAll,
          metadata: extras,
        }, selectedAssignees);
      } else {
        await createTodo({
          title: title.trim(),
          description: description.trim() || null,
          priority,
          label: label || null,
          due_date: dueDate || null,
          start_date: startDate || null,
          remind_at: localInputToIso(remindAt),
          status,
          recurrence,
          recurrence_until: recurrence ? recurrenceUntil || null : null,
          created_by_account_id: accountId || null,
          assigned_by_account_id: accountId || null,
          assignee_account_ids: selectedAssignees,
          assigned_department: selectedDept || null,
          assign_to_all: assignAll,
          metadata: extras,
        });
      }
      onSave(); onClose();
    } catch {
      setError(t("err.generic"));
    } finally {
      setSaving(false);
    }
  };

  const handleNewLabel = async () => {
    if (!newLabelName.trim()) return;
    const created = await createTodoLabel(newLabelName.trim());
    if (created) {
      setLabel(created.name);
      setNewLabelName(""); setShowNewLabel(false);
      onSave(); // refresh labels
    }
  };

  if (!open) return null;

  const filteredEmployees = empSearch
    ? employees.filter((e) =>
        (e.full_name || e.username).toLowerCase().includes(empSearch.toLowerCase()) ||
        e.department?.toLowerCase().includes(empSearch.toLowerCase()),
      )
    : employees;

  const inp = "w-full h-11 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-all";
  const lbl = "block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5";

  return (
    <ScrollLockOverlay className="fixed inset-0 z-50 flex items-start justify-center p-3 md:p-4 pt-20 md:pt-24 pb-6 overflow-y-auto bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl overflow-hidden mb-10 max-h-[94vh] md:max-h-none flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5">
            <ListTodoIcon size={18} className="text-[var(--text-dim)]" />
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
              {editEntry ? t("modal.edit") : t("modal.add")}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors">
            <CrossIcon size={16} className="text-[var(--text-dim)]" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 md:p-6 space-y-4 flex-1 overflow-y-auto min-h-0">
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className={lbl}>{t("f.title")} *</label>
            <input ref={inputRef} value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={t("f.title.placeholder")} className={inp}
              onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) handleSave(); }} />
          </div>

          {/* Description */}
          <div>
            <label className={lbl}>{t("f.description")} <span className="font-normal normal-case">(optional)</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder={t("f.description.placeholder")} rows={4} className={inp + " h-auto py-3 resize-none"} />
          </div>

          <div className="h-px bg-[var(--border-subtle)]" />

          {/* Assign To */}
          <div>
            <label className={lbl}>{t("f.assignTo")}</label>

            {/* Department pills + All */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              <button onClick={selectAll}
                className={`h-7 px-3 rounded-full text-[11px] font-semibold transition-all border flex items-center gap-1.5 ${
                  assignAll ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                }`}>
                <UsersIcon size={10} /> All
              </button>
              {departments.map((dept) => (
                <button key={dept} onClick={() => selectDept(dept)}
                  className={`h-7 px-3 rounded-full text-[11px] font-semibold transition-all border flex items-center gap-1.5 ${
                    selectedDept === dept ? "bg-violet-500/15 border-violet-500/30 text-violet-400" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                  }`}>
                  <Building2Icon size={10} /> {dept}
                </button>
              ))}
            </div>

            {/* Employee search */}
            <div className="relative mb-2">
              <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
              <input type="text" value={empSearch} onChange={(e) => setEmpSearch(e.target.value)}
                placeholder={t("filters.searchEmployees")} className={inp + " pl-9 h-9 text-[12px]"} />
            </div>

            {/* Employee avatars grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[180px] overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
              {filteredEmployees.map((emp) => {
                const selected = selectedAssignees.includes(emp.account_id);
                return (
                  <button key={emp.account_id} onClick={() => toggleAssignee(emp.account_id)}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${
                      selected ? "bg-blue-500/10 ring-1 ring-blue-500/30" : "hover:bg-[var(--bg-surface-subtle)]"
                    }`}>
                    <div className="relative">
                      <MiniAvatar info={emp} size={36} />
                      {selected && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                          <CheckCircleIcon size={10} className="text-white" />
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-[var(--text-primary)] text-center leading-tight truncate w-full">
                      {emp.full_name || emp.username}
                    </span>
                    {emp.name_alt && emp.name_alt.trim() && emp.name_alt.trim() !== (emp.full_name ?? "").trim() && (
                      <span lang="zh" className="text-[10px] text-[var(--text-dim)] text-center leading-tight truncate w-full">
                        {emp.name_alt}
                      </span>
                    )}
                    {emp.position && (
                      <span className="text-[9px] text-[var(--text-dim)] text-center leading-tight truncate w-full">
                        {emp.position}
                      </span>
                    )}
                  </button>
                );
              })}
              {filteredEmployees.length === 0 && (
                <div className="col-span-full text-center py-4 text-[12px] text-[var(--text-dim)]">
                  {t("assign.none")}
                </div>
              )}
            </div>
            {selectedAssignees.length > 0 && (
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                {selectedAssignees.length} {t("assign.selectedWord")}
              </p>
            )}
          </div>

          <div className="h-px bg-[var(--border-subtle)]" />

          {/* Priority */}
          <div>
            <label className={lbl}>{t("f.priority")}</label>
            <div className="flex gap-1.5">
              {PRIORITIES.map((p) => (
                <button key={p.value} onClick={() => setPriority(p.value)}
                  className={`flex-1 h-9 rounded-lg text-[11px] font-semibold transition-all border ${
                    priority === p.value
                      ? p.value === "high" ? "bg-red-500/15 border-red-500/30 text-red-400"
                        : p.value === "medium" ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-400"
                        : "bg-blue-500/15 border-blue-500/30 text-blue-400"
                      : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                  }`}>
                  {t("p." + p.value)}
                </button>
              ))}
            </div>
          </div>

          {/* Status (workflow stage) */}
          <div>
            <label className={lbl}>{t("f.status")}</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {STATUSES.map((s) => (
                <button key={s.value} onClick={() => setStatus(s.value)}
                  className={`h-9 rounded-lg text-[11px] font-semibold transition-all border flex items-center justify-center gap-1.5 ${
                    status === s.value
                      ? "bg-[var(--bg-surface-active)] border-[var(--border-color)] text-[var(--text-primary)]"
                      : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /> {t("st." + s.value)}
                </button>
              ))}
            </div>
          </div>

          {/* Related project — stored in metadata.project, no schema change */}
          {(projects.length > 0 || extras.project) && (
            <div>
              <label className={lbl}>
                <BriefcaseIcon size={11} className="inline mr-1 -mt-0.5" /> {t("f.project", "Related project")}{" "}
                <span className="font-normal normal-case">{t("common.optional")}</span>
              </label>
              <select value={extras.project?.id ?? ""} onChange={(e) => setRelatedProject(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-all">
                <option value="">{t("f.noProject", "None")}</option>
                {extras.project && !projects.some((p) => p.id === extras.project?.id) && (
                  <option value={extras.project.id}>{extras.project.name}</option>
                )}
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {/* Start + Due date — stack on mobile so each picker gets full width */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lbl}>{t("f.startDate")}</label>
              <DatePicker value={startDate} onChange={setStartDate} placeholder={t("f.selectDate")} />
            </div>
            <div>
              <label className={lbl}>{t("f.dueDate")}</label>
              <DatePicker value={dueDate} onChange={setDueDate} placeholder={t("f.selectDate")} />
            </div>
          </div>

          {/* Reminder */}
          <div>
            <label className={lbl}>{t("f.reminder")} <span className="font-normal normal-case">{t("common.optional")}</span></label>
            <div className="flex items-center gap-2">
              <input type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)}
                className="flex-1 h-10 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-all" />
              {remindAt && (
                <button type="button" onClick={() => setRemindAt("")}
                  className="h-10 px-3 rounded-xl text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]">
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Recurrence (Phase C) */}
          <div>
            <label className={lbl}>
              <RefreshCwIcon size={11} className="inline mr-1 -mt-0.5" /> {t("f.recurrence")}
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {RECURRENCES.map((r) => (
                <button key={r.key} type="button" onClick={() => setRecurrence(r.value)}
                  className={`h-9 rounded-lg text-[11px] font-semibold transition-all border flex items-center justify-center ${
                    recurrence === r.value
                      ? "bg-[var(--bg-surface-active)] border-[var(--border-color)] text-[var(--text-primary)]"
                      : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                  }`}>
                  {t(r.key)}
                </button>
              ))}
            </div>
            {recurrence && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] text-[var(--text-muted)] shrink-0">{t("f.recurrenceUntil")}</span>
                <div className="flex-1">
                  <DatePicker value={recurrenceUntil} onChange={setRecurrenceUntil} placeholder={t("f.recurrenceForever")} />
                </div>
                {recurrenceUntil && (
                  <button type="button" onClick={() => setRecurrenceUntil("")}
                    className="h-9 px-2.5 rounded-lg text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] shrink-0">
                    {t("common.clear")}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Label */}
          <div>
            <label className={lbl}>{t("f.label")}</label>
            <div className="flex flex-wrap gap-1.5">
              {labels.map((l) => (
                <button key={l.id} onClick={() => setLabel(label === l.name ? "" : l.name)}
                  className={`h-7 px-3 rounded-full text-[11px] font-medium transition-all border flex items-center gap-1.5 ${
                    label === l.name
                      ? "bg-white/10 border-white/20 text-[var(--text-primary)]"
                      : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                  }`}>
                  {l.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />}
                  {l.name}
                </button>
              ))}
              {/* Add new label */}
              {showNewLabel ? (
                <div className="flex items-center gap-1">
                  <input type="text" value={newLabelName} onChange={(e) => setNewLabelName(e.target.value)}
                    placeholder={t("f.label.placeholder")} autoFocus
                    className="h-7 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] outline-none w-24"
                    onKeyDown={(e) => { if (e.key === "Enter") handleNewLabel(); if (e.key === "Escape") setShowNewLabel(false); }} />
                  <button onClick={handleNewLabel} className="h-7 px-2 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[10px] font-semibold">{t("common.add")}</button>
                  <button onClick={() => setShowNewLabel(false)} className="text-[var(--text-dim)]"><CrossIcon size={12} /></button>
                </div>
              ) : (
                <button onClick={() => setShowNewLabel(true)}
                  className="h-7 px-3 rounded-full text-[11px] font-medium border border-dashed border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)] transition-all flex items-center gap-1">
                  <PlusIcon size={10} /> {t("common.new")}
                </button>
              )}
            </div>
          </div>

          <div className="h-px bg-[var(--border-subtle)]" />

          {/* Checklist / subtasks */}
          <ChecklistField
            items={Array.isArray(extras.checklist) ? extras.checklist : []}
            onChange={(checklist) => setExtras({ ...extras, checklist })}
          />

          <div className="h-px bg-[var(--border-subtle)]" />

          {/* Attachments · Mentions · Products — collapsed by default so the core
             form stays short; expands on demand (or auto-opens when editing a
             task that already has extras). */}
          {showExtras ? (
            <TaskExtras value={extras} onChange={setExtras} employees={employees} />
          ) : (
            <button type="button" onClick={() => setShowExtras(true)}
              className="w-full h-10 rounded-xl border border-dashed border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-colors flex items-center justify-center gap-1.5">
              <PlusIcon size={12} /> {t("extras.toggle")}
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end gap-2 px-4 md:px-6 py-4 border-t border-[var(--border-subtle)]">
          <button onClick={onClose}
            className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors">
            {t("modal.cancel")}
          </button>
          <button onClick={handleSave} disabled={saving || !title.trim()}
            className="h-10 px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-40">
            {saving && <SpinnerIcon className="h-4 w-4 animate-spin" />}
            {saving ? t("modal.saving") : editEntry ? t("modal.save") : t("modal.add")}
          </button>
        </div>
      </div>
    </ScrollLockOverlay>
  );
}

/* ── Extras strip — attachments · products · mentions.
   These are captured in the Task modal (TaskExtras) and saved on
   koleex_todos.metadata, but were never rendered anywhere in the list, so the
   whole feature was write-only. This shows them compactly on each row. ── */
function TaskExtrasStrip({ metadata }: { metadata: TodoMetadata | null | undefined }) {
  const meta = metadata && typeof metadata === "object" ? metadata : {};
  const atts = Array.isArray(meta.attachments) ? meta.attachments : [];
  const prods = Array.isArray(meta.products) ? meta.products : [];
  const mentions = Array.isArray(meta.mentions) ? meta.mentions : [];
  const proj = meta.project && typeof meta.project === "object" ? meta.project : null;
  if (atts.length === 0 && prods.length === 0 && mentions.length === 0 && !proj) return null;

  const chip =
    "inline-flex items-center gap-1 h-6 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)] max-w-[150px]";
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {proj && (
        <span className={chip}>
          <BriefcaseIcon className="h-2.5 w-2.5 shrink-0 text-[var(--text-dim)]" />
          <span className="truncate">{proj.name}</span>
        </span>
      )}
      {atts.map((a) =>
        a.type?.startsWith("image/") ? (
          <a key={a.path} href={a.url} target="_blank" rel="noreferrer" onClick={stop}
            className="block h-9 w-9 rounded-md overflow-hidden border border-[var(--border-subtle)] shrink-0">
            <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
          </a>
        ) : (
          <a key={a.path} href={a.url} target="_blank" rel="noreferrer" onClick={stop} className={chip + " hover:text-[var(--text-primary)]"}>
            <FileIcon className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{a.name}</span>
          </a>
        ),
      )}
      {prods.map((p) => (
        <span key={p.id} className={chip}>
          <PackageIcon className="h-2.5 w-2.5 shrink-0 text-[var(--text-dim)]" />
          <span className="truncate">{p.code || p.name}</span>
        </span>
      ))}
      {mentions.map((m) => (
        <span key={m.account_id} className={chip}>
          <AtSignIcon className="h-2.5 w-2.5 shrink-0 text-[var(--text-dim)]" />
          <span className="truncate">{m.full_name || m.username}</span>
        </span>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TASK ROW — Compact row with assignee avatars, notes expand
   ══════════════════════════════════════════════════════════════ */
function TaskRow({ task, onToggle, onSetStatus, onApprove, onReopen, onEdit, onDelete, onAddNote, onDeleteNote, currentAccountId, selectMode = false, selected = false, onSelect }: {
  task: TodoWithRelations;
  onToggle: () => void;
  onSetStatus: (status: TodoStatus) => void;
  onApprove?: () => void;
  onReopen?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddNote: (body: string) => void;
  onDeleteNote: (noteId: string) => void;
  currentAccountId: string | null;
  selectMode?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const { t } = useTranslation(todoT);
  const priorityConfig = PRIORITIES.find((p) => p.value === task.priority) || PRIORITIES[1];
  const overdue = !task.completed && isOverdue(task.due_date);
  const checklist = Array.isArray(task.metadata?.checklist) ? task.metadata.checklist : [];
  const checkDone = checklist.filter((c) => c.done).length;
  const [expanded, setExpanded] = useState(false);
  const [noteText, setNoteText] = useState("");

  const handleSubmitNote = () => {
    if (!noteText.trim()) return;
    onAddNote(noteText.trim());
    setNoteText("");
  };

  return (
    <div className={`transition-all ${task.completed ? "opacity-50" : ""}`}>
      <div className={`group flex items-start gap-3 px-4 py-3.5 transition-all ${selected ? "bg-[var(--bg-surface-active)]" : "hover:bg-[var(--bg-surface-subtle)]"}`}>
        {/* Bulk-select checkbox (only in select mode) */}
        {selectMode && (
          <button onClick={onSelect} className="mt-0.5 shrink-0" aria-label="select task">
            {selected
              ? <CheckSquareIcon size={20} className="text-blue-400" />
              : <SquareIcon size={20} className="text-[var(--text-ghost)]" />}
          </button>
        )}
        {/* Done checkbox */}
        <button onClick={onToggle} className="mt-0.5 shrink-0 transition-transform hover:scale-110">
          {task.completed ? (
            <CheckCircleIcon size={20} className="text-green-400" />
          ) : (
            <CircleIcon size={20} className="text-[var(--text-ghost)]" />
          )}
        </button>

        {/* Content — clicking anywhere here opens the task's full details
            (the "show original" translation links stopPropagation, so they
            don't toggle it). */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded((v) => !v)}
          role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded((v) => !v); } }}>
          {/* Title + description auto-translate to the viewer's language so an
              employee always reads an assigned task in a language they know
              (one tap reveals the original). */}
          <p className={`text-[13px] font-medium leading-snug flex items-start gap-1.5 ${
            task.completed ? "line-through text-[var(--text-dim)]" : "text-[var(--text-primary)]"
          }`}>
            <AngleDownIcon size={13} className={`mt-0.5 shrink-0 text-[var(--text-dim)] transition-transform ${expanded ? "rotate-180" : ""}`} />
            <span className="flex-1"><AutoTranslatedText text={task.title} /></span>
          </p>
          {task.description && (
            <AutoTranslatedText
              text={task.description}
              block
              className="text-[12px] text-[var(--text-dim)] mt-0.5 line-clamp-1"
            />
          )}

          {/* Meta badges */}
          <div className="flex items-center gap-1.5 md:gap-2 mt-1.5 flex-wrap min-w-0">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${priorityConfig.color}`}>
              <FlagIcon size={10} /> {t("p." + task.priority)}
            </span>
            {(task.status === "in_progress" || task.status === "blocked") && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                task.status === "blocked" ? "text-red-400 bg-red-500/10" : "text-blue-400 bg-blue-500/10"
              }`}>
                {task.status === "blocked" ? t("st.blocked") : t("st.in_progress")}
              </span>
            )}
            {task.label && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--text-faint)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded">
                <TagsIcon size={9} /> {task.label}
              </span>
            )}
            {task.recurrence && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--text-primary)] bg-[var(--bg-surface-active)] px-1.5 py-0.5 rounded">
                <RefreshCwIcon size={9} /> {t("rec." + task.recurrence)}
              </span>
            )}
            {task.approval_state === "pending" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                {t("approval.pending")}
              </span>
            )}
            {task.due_date && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                overdue ? "text-red-400" : task.completed ? "text-[var(--text-dim)]" : "text-[var(--text-faint)]"
              }`}>
                {overdue ? <ExclamationIcon size={10} /> : <ClockIcon size={10} />}
                {formatDate(task.due_date)}
              </span>
            )}
            {task.source !== "manual" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-400/70 bg-violet-500/10 px-1.5 py-0.5 rounded">
                {task.source === "crm" ? t("src.crm") : t("src.calendar")}
              </span>
            )}
            {/* Only flag tasks a DIFFERENT person assigned — a badge that reads
                "assigned by X" so delegated work is distinct from own to-dos.
                Own tasks (assigner === me) carry no badge. */}
            {task.assigner && task.assigner.account_id !== currentAccountId && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--text-muted)] bg-[var(--bg-surface-active)] px-1.5 py-0.5 rounded">
                <UserCheckIcon size={9} /> {t("row.assignedBy")} {task.assigner.full_name || task.assigner.username}
              </span>
            )}
            {checklist.length > 0 && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                checkDone === checklist.length ? "text-[var(--text-primary)] bg-[var(--bg-surface-active)]" : "text-[var(--text-faint)] bg-[var(--bg-surface)]"
              }`}>
                <CheckSquareIcon size={9} /> {checkDone}/{checklist.length}
              </span>
            )}
            {task.completed && task.due_date && task.completed_at && (
              (task.completed_at.split("T")[0] <= task.due_date.split("T")[0])
                ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded text-green-400 bg-green-500/10">{t("row.onTime")}</span>
                : <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded text-red-400 bg-red-500/10">{t("row.late")}</span>
            )}
          </div>

          {/* Assignee avatars */}
          {task.assignees.length > 0 && (
            <div className="flex items-center gap-1 mt-2">
              <div className="flex -space-x-1.5">
                {task.assignees.slice(0, 5).map((a) => (
                  <MiniAvatar key={a.account_id} info={a} size={22} />
                ))}
              </div>
              {task.assignees.length > 5 && (
                <span className="text-[10px] text-[var(--text-dim)] ml-1">
                  +{task.assignees.length - 5}
                </span>
              )}
            </div>
          )}

          {/* Attachments · linked products · mentions */}
          <TaskExtrasStrip metadata={task.metadata} />
        </div>

        {/* Actions — always visible on mobile (no hover), fade-in on desktop */}
        <div className="shrink-0 flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button onClick={() => setExpanded(!expanded)} title={t("common.notes")}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors text-[var(--text-dim)] hover:text-[var(--text-primary)]">
            <MessageSquareIcon size={14} />
            {task.notes.length > 0 && (
              <span className="ml-0.5 text-[9px] font-bold">{task.notes.length}</span>
            )}
          </button>
          <button onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors text-[var(--text-dim)] hover:text-[var(--text-primary)]">
            <PencilIcon size={14} />
          </button>
          <button onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-[var(--text-dim)] hover:text-red-400">
            <TrashIcon size={14} />
          </button>
        </div>
      </div>

      {/* Full detail panel — opens on row click */}
      {expanded && (
        <div className="px-4 pb-3 ml-8 space-y-3">
          {/* Approval: the manager who assigned this sees Confirm / Reopen when
              the assignee has submitted it for approval. */}
          {task.approval_state === "pending" && task.assigned_by_account_id === currentAccountId && (
            <div className="flex items-center gap-2 flex-wrap rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <span className="text-[11.5px] font-semibold text-amber-400 flex-1">{t("approval.awaitingYou")}</span>
              <button onClick={onApprove}
                className="h-7 px-3 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-[11px] font-semibold flex items-center gap-1">
                <CheckCircleIcon size={12} /> {t("approval.confirm")}
              </button>
              <button onClick={onReopen}
                className="h-7 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[11px] font-semibold">
                {t("approval.reopen")}
              </button>
            </div>
          )}
          {/* Assignee's own view while pending */}
          {task.approval_state === "pending" && task.assigned_by_account_id !== currentAccountId && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] font-semibold text-amber-400">
              {t("approval.submitted")}
            </div>
          )}

          {/* Full description (no line-clamp here) */}
          {task.description && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-1">{t("f.description")}</div>
              <AutoTranslatedText text={task.description} block className="text-[12.5px] text-[var(--text-primary)] leading-relaxed" />
            </div>
          )}

          {/* Situation / status — set it directly here (To do / In progress /
              Blocked / Done), no need to open the edit form. */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-1.5">{t("f.status")}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {STATUSES.map((s) => (
                <button key={s.value} type="button"
                  onClick={(e) => { e.stopPropagation(); onSetStatus(s.value); }}
                  className={`h-8 rounded-lg text-[11px] font-semibold transition-all border flex items-center justify-center gap-1.5 ${
                    task.status === s.value
                      ? "bg-[var(--bg-surface-active)] border-[var(--border-color)] text-[var(--text-primary)]"
                      : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /> {t("st." + s.value)}
                </button>
              ))}
            </div>
          </div>

          {/* Other key fields — only the ones that are set */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
            {[
              task.start_date ? { label: t("f.startDate"), value: fmtDetailDate(task.start_date) } : null,
              task.due_date ? { label: t("f.dueDate"), value: fmtDetailDate(task.due_date) } : null,
              task.remind_at ? { label: t("f.reminder"), value: fmtDetailDateTime(task.remind_at) } : null,
              task.recurrence ? { label: t("f.recurrence"), value: t("rec." + task.recurrence) } : null,
              task.label ? { label: t("f.label"), value: task.label } : null,
            ].filter(Boolean).map((f, i) => (
              <div key={i}>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{f!.label}</div>
                <div className="text-[12px] text-[var(--text-primary)] mt-0.5">{f!.value}</div>
              </div>
            ))}
          </div>

          {/* Checklist / subtasks */}
          {checklist.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-1.5">
                {t("checklist.title")} · {checkDone}/{checklist.length}
              </div>
              <div className="space-y-1">
                {checklist.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-[12px]">
                    {c.done
                      ? <CheckSquareIcon size={13} className="text-green-400 shrink-0" />
                      : <SquareIcon size={13} className="text-[var(--text-dim)] shrink-0" />}
                    <span className={c.done ? "line-through text-[var(--text-dim)]" : "text-[var(--text-primary)]"}>
                      <AutoTranslatedText text={c.text} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes / comments */}
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-dim)] pt-1">{t("common.notes")}</div>
          {task.notes.map((note) => (
            <div key={note.id} className="flex items-start gap-2 text-[12px]">
              <div className="w-5 h-5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[8px] font-bold text-[var(--text-dim)] shrink-0 mt-0.5">
                {getInitials(note.author_full_name, note.author_username)}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-[var(--text-muted)]">{note.author_full_name || note.author_username}</span>
                <span className="text-[var(--text-dim)] ml-2">{new Date(note.created_at).toLocaleDateString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                <AutoTranslatedText text={note.body} block className="text-[var(--text-primary)] mt-0.5" />
              </div>
              {note.author_account_id === currentAccountId && (
                <button onClick={() => onDeleteNote(note.id)} className="text-[var(--text-dim)] hover:text-red-400 p-0.5 shrink-0">
                  <CrossIcon size={10} />
                </button>
              )}
            </div>
          ))}
          {/* Add note input */}
          <div className="flex items-center gap-2 mt-1">
            <input type="text" value={noteText} onChange={(e) => setNoteText(e.target.value)}
              placeholder={t("notes.placeholder")}
              className="flex-1 h-8 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-all"
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmitNote(); }} />
            <button onClick={handleSubmitNote} disabled={!noteText.trim()}
              className="h-8 w-8 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-30">
              <PaperPlaneIcon size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   BOARD (KANBAN) VIEW — columns by status; drag a card to change it
   ══════════════════════════════════════════════════════════════ */
function TodoBoard({ tasks, onSetStatus, t }: {
  tasks: TodoWithRelations[];
  onSetStatus: (id: string, status: TodoStatus) => void;
  t: (key: string, fallback?: string) => string;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TodoStatus | null>(null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {STATUSES.map((col) => {
        const colTasks = tasks.filter((task) => (task.status ?? "todo") === col.value);
        return (
          <div key={col.value}
            onDragOver={(e) => { e.preventDefault(); setOverCol(col.value); }}
            onDragLeave={() => setOverCol((c) => (c === col.value ? null : c))}
            onDrop={() => { if (dragId) onSetStatus(dragId, col.value); setDragId(null); setOverCol(null); }}
            className={`rounded-2xl border bg-[var(--bg-secondary)] p-2 min-h-[120px] transition-colors ${
              overCol === col.value ? "border-[var(--border-focus)] bg-[var(--bg-surface-active)]" : "border-[var(--border-color)]"
            }`}>
            <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1">
              <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
              <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{t("st." + col.value)}</span>
              <span className="text-[10px] font-semibold text-[var(--text-dim)] bg-[var(--bg-surface)] rounded-full px-1.5 ml-auto">{colTasks.length}</span>
            </div>
            <div className="space-y-2">
              {colTasks.map((task) => {
                const pconfig = PRIORITIES.find((p) => p.value === task.priority) || PRIORITIES[1];
                const overdue = !task.completed && isOverdue(task.due_date);
                return (
                  <div key={task.id} draggable
                    onDragStart={() => setDragId(task.id)}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                    className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 cursor-grab active:cursor-grabbing hover:border-[var(--border-color)] transition-colors ${
                      dragId === task.id ? "opacity-50" : ""
                    }`}>
                    <p className={`text-[12.5px] font-medium leading-snug ${task.completed ? "line-through text-[var(--text-dim)]" : "text-[var(--text-primary)]"}`}>
                      <AutoTranslatedText text={task.title} />
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${pconfig.color}`}>
                        <FlagIcon size={9} /> {t("p." + task.priority)}
                      </span>
                      {task.due_date && (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${overdue ? "text-red-400" : "text-[var(--text-faint)]"}`}>
                          <ClockIcon size={9} /> {formatDate(task.due_date)}
                        </span>
                      )}
                      {task.assignees.length > 0 && (
                        <div className="flex -space-x-1 ml-auto">
                          {task.assignees.slice(0, 3).map((a) => <MiniAvatar key={a.account_id} info={a} size={18} />)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {colTasks.length === 0 && (
                <div className="text-center text-[11px] text-[var(--text-ghost)] py-4">—</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   KPI DASHBOARD
   ══════════════════════════════════════════════════════════════ */
function KpiDashboard({ todos }: { todos: TodoWithRelations[] }) {
  const { t } = useTranslation(todoT);
  const total = todos.length;
  const completed = todos.filter((t) => t.completed).length;
  const active = total - completed;
  const overdue = todos.filter((t) => !t.completed && isOverdue(t.due_date)).length;
  const high = todos.filter((t) => !t.completed && t.priority === "high").length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Top performers (completed tasks by assignee)
  const performerMap = new Map<string, { info: TodoAssigneeInfo; count: number }>();
  todos.filter((t) => t.completed).forEach((t) => {
    t.assignees.forEach((a) => {
      const existing = performerMap.get(a.account_id);
      if (existing) existing.count++;
      else performerMap.set(a.account_id, { info: a, count: 1 });
    });
  });
  const topPerformers = Array.from(performerMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Week stats
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const doneThisWeek = todos.filter((t) => t.completed_at && new Date(t.completed_at) >= weekAgo).length;

  const cards = [
    { label: t("kpi.totalTasks"), value: total, icon: ListTodoIcon, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
    { label: t("kpi.active"), value: active, icon: TargetIcon, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { label: t("kpi.completed"), value: completed, icon: CheckCircleIcon, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
    { label: t("kpi.overdue"), value: overdue, icon: ExclamationIcon, color: "text-red-400", bg: overdue > 0 ? "bg-red-500/10 border-red-500/20" : "bg-[var(--bg-surface)] border-[var(--border-subtle)]" },
    { label: t("kpi.highPriority"), value: high, icon: FlagIcon, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
    { label: t("kpi.doneThisWeek"), value: doneThisWeek, icon: TrendingUpIcon, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
    { label: t("kpi.completion"), value: `${completionRate}%`, icon: BarChart3Icon, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
  ];

  return (
    <div className="space-y-3">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 min-w-0">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl border px-3 py-3 min-w-0 overflow-hidden ${c.bg}`}>
            <div className="flex items-center gap-1.5 mb-1 min-w-0">
              <c.icon size={12} className={`${c.color} shrink-0`} />
              <span className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-wider truncate">{c.label}</span>
            </div>
            <p className={`text-[20px] font-bold tabular-nums ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Top Performers */}
      {topPerformers.length > 0 && (
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-subtle)] px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <AwardIcon size={14} className="text-yellow-400" />
            <span className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("kpi.topPerformers")}</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap min-w-0">
            {topPerformers.map((p, i) => (
              <div key={p.info.account_id} className="flex items-center gap-2 min-w-0">
                <div className="relative shrink-0">
                  <MiniAvatar info={p.info} size={28} />
                  {i === 0 && <span className="absolute -top-1 -right-1 text-[10px]">🥇</span>}
                  {i === 1 && <span className="absolute -top-1 -right-1 text-[10px]">🥈</span>}
                  {i === 2 && <span className="absolute -top-1 -right-1 text-[10px]">🥉</span>}
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-[var(--text-primary)] truncate">{p.info.full_name || p.info.username}</p>
                  <p className="text-[10px] text-[var(--text-dim)]">{p.count} {t("kpi.completedWord")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════ */
export default function TodoPage() {
  const { t } = useTranslation(todoT);
  const [todos, setTodos] = useState<TodoWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  // Source lens: separate a user's own to-dos from what a manager/other
  // assigned them. "mine" = self-authored; "assigned" = given by someone else.
  const [sourceFilter, setSourceFilter] = useState<"all" | "mine" | "assigned">("all");
  // Phase C: cadence lens — "all" | "day" | "week" | "month". Filters the list
  // to tasks due within today / this week / this month, matching how a user
  // keeps a daily/weekly/monthly to-do.
  const [cadenceView, setCadenceView] = useState<"all" | "day" | "week" | "month">("all");
  // List vs. Board (Kanban) view; sort order; and bulk-select mode.
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [sortBy, setSortBy] = useState<"smart" | "due" | "priority" | "created">("smart");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [labelFilter, setLabelFilter] = useState<string>("");
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; entry: TodoWithRelations | null }>({ open: false, entry: null });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; task: TodoWithRelations | null }>({ open: false, task: null });
  const [deleting, setDeleting] = useState(false);

  // Reference data
  const [employees, setEmployees] = useState<TodoAssigneeInfo[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [labels, setLabels] = useState<TodoLabelRow[]>([]);
  const accountId = getCurrentAccountIdSync();
  const [scopeCtx, setScopeCtx] = useState<ScopeContext | null>(null);
  /* Super-admin audience lens: "own" (default — SA sees THEIR tasks like any
     user), "all" (every task in the tenant), or an account_id (that user's
     tasks). Non-SA callers never see this control; the server already limits
     their data to tasks they're involved in. */
  const [saView, setSaView] = useState<string>("own");
  const deepLinkHandledRef = useRef(false);

  // Load scope context once per session so fetchTodos knows which filter
  // (own / department / all + SA bypass) to apply. Non-blocking — if this
  // returns null we still render the page with the wide-open fetch.
  useEffect(() => {
    if (!accountId) return;
    loadScopeContext(accountId).then(setScopeCtx);
  }, [accountId]);

  const loadAll = useCallback(async () => {
    const [t, e, d, l] = await Promise.all([
      fetchTodos(scopeCtx),
      fetchAssignableEmployees(),
      fetchDepartments(),
      fetchTodoLabels(),
    ]);
    setTodos(t); setEmployees(e); setDepartments(d); setLabels(l);
    setLoading(false);
  }, [scopeCtx]);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* Deep link: inbox "New task" notifications point at /todo?task=<id>. Open
     that task once the list has loaded, then strip the param so a refresh
     doesn't reopen it. (The link was previously dead — the page ignored it.) */
  useEffect(() => {
    if (loading || deepLinkHandledRef.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get("task");
    if (!taskId) { deepLinkHandledRef.current = true; return; }
    const found = todos.find((t) => t.id === taskId);
    if (!found) return; // still resolving — wait for the next todos update
    deepLinkHandledRef.current = true;
    params.delete("task");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    // Defer opening so we don't setState synchronously inside the effect.
    const id = setTimeout(() => setModal({ open: true, entry: found }), 0);
    return () => clearTimeout(id);
  }, [loading, todos]);

  /* ── Realtime: auto-refresh when any todo is created/updated/deleted ── */
  useEffect(() => {
    return subscribeToTodos(
      () => { loadAll(); },   // INSERT  → full refresh to resolve relations
      () => { loadAll(); },   // UPDATE  → full refresh
      (old) => {              // DELETE  → optimistic remove + refresh
        setTodos((prev) => prev.filter((t) => t.id !== old.id));
      },
    );
  }, [loadAll]);

  const handleToggle = async (id: string) => {
    const before = todos.find((t) => t.id === id);
    if (!before) return;
    const isDelegatedToMe = !!before.assigned_by_account_id && before.assigned_by_account_id !== accountId;

    // Completing a task a manager delegated to me → submit for THEIR approval
    // instead of marking it done outright (unless it was already approved).
    if (!before.completed && isDelegatedToMe && before.approval_state !== "approved") {
      setTodos((prev) => prev.map((t) => t.id === id ? { ...t, approval_state: "pending" } : t));
      const ok = await updateTodo(id, { approval_state: "pending" });
      if (!ok) setTodos((prev) => prev.map((t) => t.id === id ? before : t));
      return;
    }
    // Toggling a still-pending submission back off → withdraw it.
    if (before.approval_state === "pending") {
      setTodos((prev) => prev.map((t) => t.id === id ? { ...t, approval_state: null } : t));
      const ok = await updateTodo(id, { approval_state: null });
      if (!ok) setTodos((prev) => prev.map((t) => t.id === id ? before : t));
      return;
    }

    setTodos((prev) => prev.map((t) => t.id === id ? { ...t, completed: !t.completed, completed_at: !t.completed ? new Date().toISOString() : null } : t));
    const ok = await toggleTodo(id);
    if (!ok && before) {
      // Server rejected the toggle — restore the prior state so the checkbox
      // never lies. (Previously the optimistic flip stuck even on failure.)
      setTodos((prev) => prev.map((t) => t.id === id ? { ...t, completed: before.completed, completed_at: before.completed_at } : t));
    }
  };

  // Manager decisions on a submitted task.
  const handleApprove = async (id: string) => {
    const now = new Date().toISOString();
    setTodos((prev) => prev.map((t) => t.id === id
      ? { ...t, approval_state: "approved", completed: true, completed_at: now, status: "done", approved_by_account_id: accountId, approved_at: now }
      : t));
    await updateTodo(id, { approval_state: "approved", status: "done", approved_by_account_id: accountId, approved_at: now });
    loadAll();
  };
  const handleReopen = async (id: string) => {
    setTodos((prev) => prev.map((t) => t.id === id
      ? { ...t, approval_state: "rejected", completed: false, completed_at: null, status: "in_progress" }
      : t));
    await updateTodo(id, { approval_state: "rejected", status: "in_progress" });
    loadAll();
  };

  // Set a task's situation directly from the row (To do / In progress /
  // Blocked / Done) — keeps completed in lockstep, optimistic with rollback.
  const handleSetStatus = async (id: string, status: TodoStatus) => {
    const before = todos.find((t) => t.id === id);
    if (!before || before.status === status) return;
    const done = status === "done";
    setTodos((prev) => prev.map((t) => t.id === id
      ? { ...t, status, completed: done, completed_at: done ? new Date().toISOString() : null }
      : t));
    const ok = await updateTodo(id, { status });
    if (!ok) setTodos((prev) => prev.map((t) => t.id === id ? before : t));
  };

  /* ── Bulk selection actions ── */
  const toggleSelect = (id: string) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const clearSelection = () => { setSelectedIds(new Set()); setSelectMode(false); };
  const bulkStatus = async (status: TodoStatus) => {
    const ids = [...selectedIds];
    await Promise.all(ids.map((id) => updateTodo(id, { status })));
    clearSelection();
    loadAll();
  };
  const bulkDelete = async () => {
    const ids = [...selectedIds];
    await Promise.all(ids.map((id) => deleteTodo(id)));
    clearSelection();
    loadAll();
  };
  const bulkReassign = async (assigneeId: string) => {
    if (!assigneeId) return;
    const ids = [...selectedIds];
    await Promise.all(ids.map((id) => updateTodo(id, {}, [assigneeId])));
    clearSelection();
    loadAll();
  };

  const handleDelete = async () => {
    if (!deleteModal.task) return;
    setDeleting(true);
    await deleteTodo(deleteModal.task.id);
    setDeleting(false);
    setDeleteModal({ open: false, task: null });
    loadAll();
  };

  const handleAddNote = async (todoId: string, body: string) => {
    if (!accountId) return;
    await addTodoNote(todoId, accountId, body);
    loadAll();
  };

  const handleDeleteNote = async (noteId: string) => {
    await deleteTodoNote(noteId);
    loadAll();
  };

  const { isSuperAdmin: isSA } = usePermissions();
  const involves = useCallback((t: TodoWithRelations, id: string) =>
    t.created_by_account_id === id ||
    t.assigned_by_account_id === id ||
    t.assignees.some((a) => a.account_id === id), []);
  const scopedTodos = useMemo(() => {
    if (!isSA || saView === "all") return todos;
    if (saView === "own") {
      return todos.filter((t) => t.assign_to_all || (accountId ? involves(t, accountId) : true));
    }
    return todos.filter((t) => involves(t, saView));
  }, [todos, isSA, saView, accountId, involves]);

  // Filtering
  const filtered = useMemo(() => {
    let list = scopedTodos;

    // Text search: title, description, label, assignee, department, date
    if (search) {
      const q = search.toLowerCase().trim();

      /** Check if any date on the task matches the search query.
       *  Supports: "2026-04-12", "Apr 12", "April", "12 Apr", "12/04" etc. */
      const matchesDate = (iso: string | null) => {
        if (!iso) return false;
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return false;
        // ISO string match (2026-04-12)
        if (iso.toLowerCase().includes(q)) return true;
        // Formatted date strings for flexible matching
        const formats = [
          d.toLocaleDateString("en", { month: "short", day: "numeric" }),               // "Apr 12"
          d.toLocaleDateString("en", { month: "long", day: "numeric" }),                 // "April 12"
          d.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }), // "Apr 12, 2026"
          d.toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" }), // "April 12, 2026"
          d.toLocaleDateString("en", { day: "numeric", month: "short" }),                 // "12 Apr"
          d.toLocaleDateString("en", { month: "long" }),                                  // "April"
          d.toLocaleDateString("en", { month: "short" }),                                 // "Apr"
          d.toLocaleDateString("en", { weekday: "long" }),                                // "Saturday"
          d.toLocaleDateString("en", { weekday: "short" }),                               // "Sat"
          `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`, // "12/04"
          `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`, // "04/12"
        ];
        return formats.some((f) => f.toLowerCase().includes(q));
      };

      list = list.filter((t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.label?.toLowerCase().includes(q) ||
        t.assignees.some((a) => (a.full_name || a.username).toLowerCase().includes(q) || a.department?.toLowerCase().includes(q)) ||
        t.assigner?.full_name?.toLowerCase().includes(q) ||
        t.assigner?.username?.toLowerCase().includes(q) ||
        t.assigned_department?.toLowerCase().includes(q) ||
        t.priority.includes(q) ||
        (q === "done" && t.completed) ||
        (q === "active" && !t.completed) ||
        (q === "overdue" && isOverdue(t.due_date)) ||
        matchesDate(t.due_date) ||
        matchesDate(t.created_at),
      );
    }

    if (filter === "active") list = list.filter((t) => !t.completed);
    if (filter === "completed") list = list.filter((t) => t.completed);
    // "Assigned to me" = someone else (an admin/manager) assigned it and it reached me.
    // A task is "assigned to me" when someone ELSE assigned it; otherwise it's
    // my own. This cleanly splits the personal list from delegated work.
    if (sourceFilter !== "all") {
      const isAssigned = (t: TodoWithRelations) =>
        !!t.assigned_by_account_id && t.assigned_by_account_id !== accountId;
      list = list.filter((t) => (sourceFilter === "assigned" ? isAssigned(t) : !isAssigned(t)));
    }
    if (priorityFilter !== "all") list = list.filter((t) => t.priority === priorityFilter);
    if (statusFilter) list = list.filter((t) => t.status === statusFilter);
    if (labelFilter) list = list.filter((t) => t.label === labelFilter);
    if (deptFilter) list = list.filter((t) =>
      t.assigned_department === deptFilter ||
      t.assignees.some((a) => a.department === deptFilter),
    );
    if (assigneeFilter) list = list.filter((t) =>
      t.assignees.some((a) => a.account_id === assigneeFilter),
    );

    // Date range filter — matches against due_date OR created_at
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      list = list.filter((t) => {
        const due = t.due_date ? new Date(t.due_date) : null;
        const created = new Date(t.created_at);
        return (due && due >= from) || created >= from;
      });
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((t) => {
        const due = t.due_date ? new Date(t.due_date) : null;
        const created = new Date(t.created_at);
        return (due && due <= to) || created <= to;
      });
    }

    // Cadence lens: keep tasks due within today / this week (Mon–Sun) / this
    // month. A task with no due date is kept only in "all".
    if (cadenceView !== "all") {
      const now = new Date();
      const start = new Date(now);
      const end = new Date(now);
      if (cadenceView === "day") {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      } else if (cadenceView === "week") {
        const dow = (now.getDay() + 6) % 7; // Mon=0
        start.setDate(now.getDate() - dow); start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
      } else {
        start.setDate(1); start.setHours(0, 0, 0, 0);
        end.setMonth(now.getMonth() + 1, 0); end.setHours(23, 59, 59, 999);
      }
      list = list.filter((t) => {
        if (!t.due_date) return false;
        const due = new Date(t.due_date);
        return due >= start && due <= end;
      });
    }

    return list;
  }, [scopedTodos, search, filter, priorityFilter, sourceFilter, accountId, cadenceView, statusFilter, labelFilter, deptFilter, assigneeFilter, dateFrom, dateTo]);

  const stats = useMemo(() => ({
    total: scopedTodos.length,
    active: scopedTodos.filter((t) => !t.completed).length,
    completed: scopedTodos.filter((t) => t.completed).length,
    overdue: scopedTodos.filter((t) => !t.completed && isOverdue(t.due_date)).length,
  }), [scopedTodos]);

  // Group: overdue → today → upcoming → no date → completed
  const grouped = useMemo(() => {
    const active = filtered.filter((t) => !t.completed);
    const completed = filtered.filter((t) => t.completed);
    const overdueList = active.filter((t) => isOverdue(t.due_date));
    const today = active.filter((t) => t.due_date && formatDate(t.due_date) === "Today" && !isOverdue(t.due_date));
    const upcoming = active.filter((t) => t.due_date && !isOverdue(t.due_date) && formatDate(t.due_date) !== "Today");
    const noDate = active.filter((t) => !t.due_date);
    return { overdue: overdueList, today, upcoming, noDate, completed };
  }, [filtered]);

  // Flat, explicitly-sorted list (used when the user picks a sort other than
  // "smart", and to fill the Board columns).
  const sortedFlat = useMemo(() => {
    const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const arr = [...filtered];
    if (sortBy === "priority") {
      arr.sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9));
    } else if (sortBy === "due") {
      arr.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1; // undated last
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    } else if (sortBy === "created") {
      arr.sort((a, b) => b.created_at.localeCompare(a.created_at)); // newest first
    }
    return arr;
  }, [filtered, sortBy]);

  // Unique assignees for filter dropdown
  const uniqueAssignees = useMemo(() => {
    const map = new Map<string, TodoAssigneeInfo>();
    todos.forEach((t) => t.assignees.forEach((a) => map.set(a.account_id, a)));
    return Array.from(map.values());
  }, [todos]);

  // Unique labels used
  const usedLabels = useMemo(() => {
    return [...new Set(todos.map((t) => t.label).filter(Boolean) as string[])];
  }, [todos]);

  const hasActiveFilters = statusFilter || labelFilter || deptFilter || assigneeFilter || dateFrom || dateTo;

  // One place that builds a task row, so List + Board + sorted views stay in
  // sync (and bulk-select props are threaded once).
  const renderRow = (t: TodoWithRelations) => (
    <TaskRow key={t.id} task={t} currentAccountId={accountId}
      selectMode={selectMode} selected={selectedIds.has(t.id)} onSelect={() => toggleSelect(t.id)}
      onToggle={() => handleToggle(t.id)}
      onSetStatus={(s) => handleSetStatus(t.id, s)}
      onApprove={() => handleApprove(t.id)}
      onReopen={() => handleReopen(t.id)}
      onEdit={() => setModal({ open: true, entry: t })}
      onDelete={() => setDeleteModal({ open: true, task: t })}
      onAddNote={(body) => handleAddNote(t.id, body)}
      onDeleteNote={handleDeleteNote} />
  );

  return (
    <div className="bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden w-full"
      style={{ height: "calc(100dvh - 3.5rem)" }}>

      {/* ── FIXED HEADER (never scrolls) ── */}
      <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] z-10 w-full overflow-x-hidden">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 min-w-0">

          {/* Title row */}
          <div className="flex flex-wrap items-center gap-3 pt-5 pb-1">
            <Link href="/" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
                <CheckSquareIcon className="h-4 w-4" />
              </div>
              <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">{t("app.title")}</h1>
            </div>
          </div>
          <p className="text-[12px] text-[var(--text-dim)] mb-3 ml-0 md:ml-11">
            {t("app.subtitle")} &middot; {stats.total}
          </p>

          {/* Search + Add */}
          <div className="flex items-center gap-2 pb-2 min-w-0">
            <div className="flex-1 min-w-0 flex items-center bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-3 md:px-4 gap-2 md:gap-3 focus-within:border-[var(--border-focus)] transition-all">
              <SearchIcon size={16} className="text-[var(--text-dim)] shrink-0" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={t("search")}
                className="flex-1 min-w-0 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none h-10" />
              {search && (
                <button onClick={() => setSearch("")} className="p-0.5">
                  <CrossIcon size={14} className="text-[var(--text-dim)]" />
                </button>
              )}
            </div>
            <button onClick={() => setShowFilters(!showFilters)}
              className={`h-10 px-3 rounded-xl border text-[13px] font-medium flex items-center gap-1.5 transition-all shrink-0 ${
                showFilters || hasActiveFilters
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                  : "bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              }`}>
              <FilterIcon size={14} />
              <span className="hidden md:inline">{t("filters")}</span>
              {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
            </button>
            <Link href="/todo/report"
              className="h-10 px-3 rounded-xl border text-[13px] font-medium flex items-center gap-1.5 transition-all shrink-0 bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              title={t("report.link")}>
              <BarChart3Icon size={14} />
              <span className="hidden md:inline">{t("report.link")}</span>
            </Link>
            <button onClick={() => setModal({ open: true, entry: null })}
              className="h-10 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shrink-0">
              <PlusIcon size={16} />
              <span className="hidden md:inline">{t("add")}</span>
            </button>
          </div>

          {/* Cross-app: my project tasks + upcoming shifts (renders only when non-empty) */}
          <MyWorkStrip />

          {/* Filter pills row */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-3 scrollbar-none">
            {(["all", "active", "completed"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`h-7 px-3 rounded-full text-[11px] font-semibold transition-all border whitespace-nowrap ${
                  filter === f
                    ? "bg-white/10 border-white/20 text-[var(--text-primary)]"
                    : "bg-transparent border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                }`}>
                {f === "all" ? `${t("pill.all")} (${stats.total})` : f === "active" ? `${t("pill.active")} (${stats.active})` : `${t("pill.done")} (${stats.completed})`}
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
                }`}>
                <FlagIcon size={10} /> {t("p." + p.value)}
              </button>
            ))}
            {isSA && (
              <>
                <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />
                {/* SA audience lens — whose tasks am I looking at? */}
                <select value={saView} onChange={(e) => setSaView(e.target.value)}
                  className={`h-7 ps-2.5 pe-7 rounded-full text-[11px] font-semibold border outline-none cursor-pointer appearance-none bg-no-repeat bg-[right_0.5rem_center] ${
                    saView === "own"
                      ? "bg-transparent border-[var(--border-subtle)] text-[var(--text-dim)]"
                      : "bg-[var(--bg-surface-active)] border-[var(--border-color)] text-[var(--text-primary)]"
                  }`}
                  style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='3'><path d='M6 9l6 6 6-6'/></svg>\")" }}>
                  <option value="own">{t("sa.viewOwn")}</option>
                  <option value="all">{t("sa.viewAll")}</option>
                  {employees.filter((e) => e.account_id !== accountId).map((e) => (
                    <option key={e.account_id} value={e.account_id}>
                      {(e.full_name || e.username) + (e.name_alt ? ` · ${e.name_alt}` : "")}
                    </option>
                  ))}
                </select>
              </>
            )}
            <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />
            {/* Source separator: my own to-dos vs. tasks a manager/other gave me */}
            {([
              { v: "all", key: "src.all" },
              { v: "mine", key: "src.mine", icon: <UserIcon size={11} /> },
              { v: "assigned", key: "pill.assignedToMe", icon: <UserCheckIcon size={11} /> },
            ] as const).map((s) => (
              <button key={s.v} onClick={() => setSourceFilter(s.v)}
                className={`h-7 px-3 rounded-full text-[11px] font-semibold transition-all border flex items-center gap-1.5 whitespace-nowrap ${
                  sourceFilter === s.v
                    ? "bg-[var(--bg-surface-active)] border-[var(--border-color)] text-[var(--text-primary)]"
                    : "bg-transparent border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                }`}>
                {"icon" in s ? s.icon : null} {t(s.key)}
              </button>
            ))}
            <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />
            {/* Cadence lens — daily / weekly / monthly to-do horizon */}
            {(["all", "day", "week", "month"] as const).map((c) => (
              <button key={c} onClick={() => setCadenceView(c)}
                className={`h-7 px-3 rounded-full text-[11px] font-semibold transition-all border whitespace-nowrap ${
                  cadenceView === c
                    ? "bg-[var(--bg-surface-active)] border-[var(--border-color)] text-[var(--text-primary)]"
                    : "bg-transparent border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                }`}>
                {t("cadence." + c)}
              </button>
            ))}
          </div>

          {/* View · Sort · Select controls */}
          <div className="flex items-center gap-2 pb-3 flex-wrap">
            {/* List / Board */}
            <div className="inline-flex rounded-lg border border-[var(--border-color)] overflow-hidden">
              {(["list", "board"] as const).map((v) => (
                <button key={v} onClick={() => setViewMode(v)}
                  className={`h-8 px-3 text-[11px] font-semibold transition-colors flex items-center gap-1.5 ${
                    viewMode === v ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "bg-[var(--bg-secondary)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                  }`}>
                  {v === "list" ? <LayoutListIcon size={13} /> : <LayoutGridIcon size={13} />}
                  {t("view." + v)}
                </button>
              ))}
            </div>
            {/* Sort */}
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="h-8 px-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[11px] font-medium text-[var(--text-muted)] outline-none">
              <option value="smart">{t("sort.smart")}</option>
              <option value="due">{t("sort.due")}</option>
              <option value="priority">{t("sort.priority")}</option>
              <option value="created">{t("sort.created")}</option>
            </select>
            {/* Select mode */}
            <button onClick={() => { setSelectMode((v) => !v); setSelectedIds(new Set()); }}
              className={`h-8 px-3 rounded-lg border text-[11px] font-semibold transition-colors ${
                selectMode ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              }`}>
              {selectMode ? t("bulk.cancel") : t("bulk.select")}
            </button>
          </div>

          {/* Bulk action bar */}
          {selectMode && selectedIds.size > 0 && (
            <div className="flex items-center gap-2 pb-3 flex-wrap">
              <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                {selectedIds.size} {t("bulk.selected")}
              </span>
              <div className="w-px h-4 bg-[var(--border-subtle)]" />
              <button onClick={() => bulkStatus("done")}
                className="h-8 px-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-[11px] font-semibold flex items-center gap-1.5">
                <CheckCircleIcon size={13} /> {t("bulk.markDone")}
              </button>
              <select onChange={(e) => { if (e.target.value) { bulkStatus(e.target.value as TodoStatus); e.target.value = ""; } }} defaultValue=""
                className="h-8 px-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[11px] font-medium text-[var(--text-muted)] outline-none">
                <option value="" disabled>{t("bulk.setStatus")}</option>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{t("st." + s.value)}</option>)}
              </select>
              {employees.length > 0 && (
                <select onChange={(e) => { if (e.target.value) { bulkReassign(e.target.value); e.target.value = ""; } }} defaultValue=""
                  className="h-8 px-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[11px] font-medium text-[var(--text-muted)] outline-none max-w-[160px]">
                  <option value="" disabled>{t("bulk.reassign")}</option>
                  {employees.map((emp) => <option key={emp.account_id} value={emp.account_id}>{emp.full_name || emp.username}</option>)}
                </select>
              )}
              <button onClick={bulkDelete}
                className="h-8 px-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-semibold flex items-center gap-1.5">
                <TrashIcon size={13} /> {t("bulk.delete")}
              </button>
            </div>
          )}

          {/* Advanced filters panel */}
          {showFilters && (
            <div className="pb-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                {/* Status filter */}
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-8 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none">
                  <option value="">{t("filters.allStatuses")}</option>
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{t("st." + s.value)}</option>)}
                </select>

                {/* Department filter */}
                <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
                  className="h-8 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none">
                  <option value="">{t("filters.allDepts")}</option>
                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>

                {/* Assignee filter */}
                <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="h-8 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none">
                  <option value="">{t("filters.allAssignees")}</option>
                  {uniqueAssignees.map((a) => (
                    <option key={a.account_id} value={a.account_id}>{a.full_name || a.username}</option>
                  ))}
                </select>

                {/* Label filter */}
                <select value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)}
                  className="h-8 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none">
                  <option value="">{t("filters.allLabels")}</option>
                  {usedLabels.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>

                {/* Date range filter */}
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 h-8 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                    <CalendarRawIcon size={12} className="text-[var(--text-dim)] shrink-0" />
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                      className="bg-transparent text-[12px] text-[var(--text-primary)] outline-none w-[110px]"
                      title="From date" />
                  </div>
                  <span className="text-[11px] text-[var(--text-dim)]">→</span>
                  <div className="flex items-center gap-1 h-8 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                    <CalendarRawIcon size={12} className="text-[var(--text-dim)] shrink-0" />
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                      className="bg-transparent text-[12px] text-[var(--text-primary)] outline-none w-[110px]"
                      title="To date" />
                  </div>
                </div>

                {hasActiveFilters && (
                  <button onClick={() => { setStatusFilter(""); setLabelFilter(""); setDeptFilter(""); setAssigneeFilter(""); setDateFrom(""); setDateTo(""); }}
                    className="h-8 px-3 rounded-lg text-[11px] font-medium text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1">
                    <CrossIcon size={12} /> {t("filters.clearBtn")}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-5 w-full min-w-0">

        {/* KPI Dashboard */}
        {!loading && scopedTodos.length > 0 && <div className="mb-5"><KpiDashboard todos={scopedTodos} /></div>}

        {/* Task List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <SpinnerIcon className="h-6 w-6 animate-spin text-[var(--text-dim)]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[var(--bg-surface)]">
              <TodoIcon size={24} className="text-[var(--text-ghost)]" />
            </div>
            <p className="text-[var(--text-faint)] text-sm font-medium">
              {search ? t("empty.noSearch") : filter === "completed" ? t("empty.noCompleted") : t("empty.title")}
            </p>
            {!search && filter === "all" && (
              <button onClick={() => setModal({ open: true, entry: null })}
                className="text-[12px] text-blue-400 hover:text-blue-300 font-medium transition-colors">
                {t("empty.createFirst")}
              </button>
            )}
          </div>
        ) : viewMode === "board" ? (
          <TodoBoard tasks={sortedFlat} onSetStatus={handleSetStatus} t={t} />
        ) : sortBy !== "smart" ? (
          /* Flat, explicitly-sorted list */
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-hidden divide-y divide-[var(--border-subtle)]">
            {sortedFlat.map(renderRow)}
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.overdue.length > 0 && (
              <Section title={t("section.overdue")} count={grouped.overdue.length} color="text-red-400">
                {grouped.overdue.map(renderRow)}
              </Section>
            )}
            {grouped.today.length > 0 && (
              <Section title={t("section.today")} count={grouped.today.length} color="text-green-400">
                {grouped.today.map(renderRow)}
              </Section>
            )}
            {grouped.upcoming.length > 0 && (
              <Section title={t("section.upcoming")} count={grouped.upcoming.length} color="text-blue-400">
                {grouped.upcoming.map(renderRow)}
              </Section>
            )}
            {grouped.noDate.length > 0 && (
              <Section title={t("section.noDate")} count={grouped.noDate.length} color="text-[var(--text-faint)]">
                {grouped.noDate.map(renderRow)}
              </Section>
            )}
            {grouped.completed.length > 0 && (
              <Section title={t("section.completed")} count={grouped.completed.length} color="text-[var(--text-dim)]">
                {grouped.completed.map(renderRow)}
              </Section>
            )}
          </div>
        )}
      </div>
      </div>

      {/* Modals */}
      <TaskModal
        open={modal.open} editEntry={modal.entry}
        employees={employees} departments={departments} labels={labels}
        onClose={() => setModal({ open: false, entry: null })}
        onSave={loadAll}
      />
      <DeleteModal
        open={deleteModal.open} deleting={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteModal({ open: false, task: null })}
      />
    </div>
  );
}
