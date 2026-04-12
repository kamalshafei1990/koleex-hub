"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { ScrollLockOverlay } from "@/hooks/useScrollLock";
import {
  ArrowLeft, Plus, Search, X, Loader2, CheckSquare, Square, Trash2,
  Pencil, Calendar, Flag, Tag, ChevronDown, Circle, CheckCircle2,
  AlertCircle, Clock, MoreHorizontal, ListTodo, Users, Building2,
  Send, MessageSquare, TrendingUp, BarChart3, Target, Award,
  UserCheck, Filter, ChevronUp,
} from "lucide-react";
import {
  fetchTodos, createTodo, updateTodo, toggleTodo, deleteTodo,
  addTodoNote, deleteTodoNote,
  fetchTodoLabels, createTodoLabel,
  fetchAssignableEmployees, fetchDepartments,
} from "@/lib/todo-admin";
import type {
  TodoWithRelations, TodoAssigneeInfo, TodoLabelRow, TodoPriority,
} from "@/types/supabase";
import { getCurrentAccountIdSync } from "@/lib/identity";

/* ── Priority config ── */
const PRIORITIES: { value: TodoPriority; label: string; color: string }[] = [
  { value: "high", label: "High", color: "text-red-400" },
  { value: "medium", label: "Medium", color: "text-yellow-400" },
  { value: "low", label: "Low", color: "text-blue-400" },
];

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

function getInitials(name: string | null, username?: string): string {
  if (name) {
    const parts = name.split(" ").filter(Boolean);
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0]?.substring(0, 2).toUpperCase() || "?";
  }
  return username?.substring(0, 2).toUpperCase() || "?";
}

/* ── Avatar ── */
function MiniAvatar({ info, size = 28 }: { info: TodoAssigneeInfo; size?: number }) {
  return info.avatar_url ? (
    <img src={info.avatar_url} alt="" className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }} />
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
        <ChevronDown size={14} className={`text-[var(--text-dim)] transition-transform ${open ? "" : "-rotate-90"}`} />
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
  if (!open) return null;
  return (
    <ScrollLockOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
    </ScrollLockOverlay>
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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("medium");
  const [label, setLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [assignAll, setAssignAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newLabelName, setNewLabelName] = useState("");
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [empSearch, setEmpSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const accountId = getCurrentAccountIdSync();

  useEffect(() => {
    if (open) {
      if (editEntry) {
        setTitle(editEntry.title);
        setDescription(editEntry.description || "");
        setPriority(editEntry.priority);
        setLabel(editEntry.label || "");
        setDueDate(editEntry.due_date ? editEntry.due_date.split("T")[0] : "");
        setSelectedAssignees(editEntry.assignees.map((a) => a.account_id));
        setSelectedDept(editEntry.assigned_department || "");
        setAssignAll(editEntry.assign_to_all);
      } else {
        setTitle(""); setDescription(""); setPriority("medium"); setLabel(""); setDueDate("");
        setSelectedAssignees([]); setSelectedDept(""); setAssignAll(false);
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
    if (!title.trim()) { setError("Title is required."); return; }
    setSaving(true); setError("");
    try {
      if (editEntry) {
        await updateTodo(editEntry.id, {
          title: title.trim(),
          description: description.trim() || null,
          priority,
          label: label || null,
          due_date: dueDate || null,
          assigned_department: selectedDept || null,
          assign_to_all: assignAll,
        }, selectedAssignees);
      } else {
        await createTodo({
          title: title.trim(),
          description: description.trim() || null,
          priority,
          label: label || null,
          due_date: dueDate || null,
          created_by_account_id: accountId || null,
          assigned_by_account_id: accountId || null,
          assignee_account_ids: selectedAssignees,
          assigned_department: selectedDept || null,
          assign_to_all: assignAll,
        });
      }
      onSave(); onClose();
    } catch {
      setError("Something went wrong.");
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
    <ScrollLockOverlay className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[5vh] overflow-y-auto bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl overflow-hidden mb-10">
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
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
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
              onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) handleSave(); }} />
          </div>

          {/* Description */}
          <div>
            <label className={lbl}>Description <span className="font-normal normal-case">(optional)</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details..." rows={2} className={inp + " h-auto py-3 resize-none"} />
          </div>

          {/* Assign To */}
          <div>
            <label className={lbl}>Assign To</label>

            {/* Department pills + All */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              <button onClick={selectAll}
                className={`h-7 px-3 rounded-full text-[11px] font-semibold transition-all border flex items-center gap-1.5 ${
                  assignAll ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                }`}>
                <Users size={10} /> All
              </button>
              {departments.map((dept) => (
                <button key={dept} onClick={() => selectDept(dept)}
                  className={`h-7 px-3 rounded-full text-[11px] font-semibold transition-all border flex items-center gap-1.5 ${
                    selectedDept === dept ? "bg-violet-500/15 border-violet-500/30 text-violet-400" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                  }`}>
                  <Building2 size={10} /> {dept}
                </button>
              ))}
            </div>

            {/* Employee search */}
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
              <input type="text" value={empSearch} onChange={(e) => setEmpSearch(e.target.value)}
                placeholder="Search employees..." className={inp + " pl-9 h-9 text-[12px]"} />
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
                          <CheckCircle2 size={10} className="text-white" />
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-[var(--text-primary)] text-center leading-tight truncate w-full">
                      {emp.full_name || emp.username}
                    </span>
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
                  No employees found
                </div>
              )}
            </div>
            {selectedAssignees.length > 0 && (
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                {selectedAssignees.length} employee{selectedAssignees.length !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          {/* Priority + Due Date */}
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
                    }`}>
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
                    placeholder="Label name" autoFocus
                    className="h-7 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] outline-none w-24"
                    onKeyDown={(e) => { if (e.key === "Enter") handleNewLabel(); if (e.key === "Escape") setShowNewLabel(false); }} />
                  <button onClick={handleNewLabel} className="h-7 px-2 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[10px] font-semibold">Add</button>
                  <button onClick={() => setShowNewLabel(false)} className="text-[var(--text-dim)]"><X size={12} /></button>
                </div>
              ) : (
                <button onClick={() => setShowNewLabel(true)}
                  className="h-7 px-3 rounded-full text-[11px] font-medium border border-dashed border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)] transition-all flex items-center gap-1">
                  <Plus size={10} /> New
                </button>
              )}
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
    </ScrollLockOverlay>
  );
}

/* ══════════════════════════════════════════════════════════════
   TASK ROW — Compact row with assignee avatars, notes expand
   ══════════════════════════════════════════════════════════════ */
function TaskRow({ task, onToggle, onEdit, onDelete, onAddNote, onDeleteNote, currentAccountId }: {
  task: TodoWithRelations;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddNote: (body: string) => void;
  onDeleteNote: (noteId: string) => void;
  currentAccountId: string | null;
}) {
  const priorityConfig = PRIORITIES.find((p) => p.value === task.priority) || PRIORITIES[1];
  const overdue = !task.completed && isOverdue(task.due_date);
  const [expanded, setExpanded] = useState(false);
  const [noteText, setNoteText] = useState("");

  const handleSubmitNote = () => {
    if (!noteText.trim()) return;
    onAddNote(noteText.trim());
    setNoteText("");
  };

  return (
    <div className={`transition-all ${task.completed ? "opacity-50" : ""}`}>
      <div className="group flex items-start gap-3 px-4 py-3.5 hover:bg-[var(--bg-surface-subtle)] transition-all">
        {/* Checkbox */}
        <button onClick={onToggle} className="mt-0.5 shrink-0 transition-transform hover:scale-110">
          {task.completed ? (
            <CheckCircle2 size={20} className="text-green-400" />
          ) : (
            <Circle size={20} className="text-[var(--text-ghost)]" />
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

          {/* Meta badges */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${priorityConfig.color}`}>
              <Flag size={10} /> {priorityConfig.label}
            </span>
            {task.label && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--text-faint)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded">
                <Tag size={9} /> {task.label}
              </span>
            )}
            {task.due_date && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                overdue ? "text-red-400" : task.completed ? "text-[var(--text-dim)]" : "text-[var(--text-faint)]"
              }`}>
                {overdue ? <AlertCircle size={10} /> : <Clock size={10} />}
                {formatDate(task.due_date)}
              </span>
            )}
            {task.source !== "manual" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-400/70 bg-violet-500/10 px-1.5 py-0.5 rounded">
                {task.source === "crm" ? "CRM" : "Calendar"}
              </span>
            )}
            {task.assigner && (
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-faint)]">
                from {task.assigner.full_name || task.assigner.username}
              </span>
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
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setExpanded(!expanded)} title="Notes"
            className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors text-[var(--text-dim)] hover:text-[var(--text-primary)]">
            <MessageSquare size={14} />
            {task.notes.length > 0 && (
              <span className="ml-0.5 text-[9px] font-bold">{task.notes.length}</span>
            )}
          </button>
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

      {/* Notes expansion */}
      {expanded && (
        <div className="px-4 pb-3 ml-8 space-y-2">
          {task.notes.map((note) => (
            <div key={note.id} className="flex items-start gap-2 text-[12px]">
              <div className="w-5 h-5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[8px] font-bold text-[var(--text-dim)] shrink-0 mt-0.5">
                {getInitials(note.author_full_name, note.author_username)}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-[var(--text-muted)]">{note.author_full_name || note.author_username}</span>
                <span className="text-[var(--text-dim)] ml-2">{new Date(note.created_at).toLocaleDateString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                <p className="text-[var(--text-primary)] mt-0.5">{note.body}</p>
              </div>
              {note.author_account_id === currentAccountId && (
                <button onClick={() => onDeleteNote(note.id)} className="text-[var(--text-dim)] hover:text-red-400 p-0.5 shrink-0">
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
          {/* Add note input */}
          <div className="flex items-center gap-2 mt-1">
            <input type="text" value={noteText} onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write a note..."
              className="flex-1 h-8 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-all"
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmitNote(); }} />
            <button onClick={handleSubmitNote} disabled={!noteText.trim()}
              className="h-8 w-8 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-30">
              <Send size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   KPI DASHBOARD
   ══════════════════════════════════════════════════════════════ */
function KpiDashboard({ todos }: { todos: TodoWithRelations[] }) {
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
    { label: "Total Tasks", value: total, icon: ListTodo, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
    { label: "Active", value: active, icon: Target, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { label: "Completed", value: completed, icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
    { label: "Overdue", value: overdue, icon: AlertCircle, color: "text-red-400", bg: overdue > 0 ? "bg-red-500/10 border-red-500/20" : "bg-[var(--bg-surface)] border-[var(--border-subtle)]" },
    { label: "High Priority", value: high, icon: Flag, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
    { label: "Done This Week", value: doneThisWeek, icon: TrendingUp, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
    { label: "Completion", value: `${completionRate}%`, icon: BarChart3, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
  ];

  return (
    <div className="space-y-3">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl border px-3 py-3 ${c.bg}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <c.icon size={12} className={c.color} />
              <span className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{c.label}</span>
            </div>
            <p className={`text-[20px] font-bold tabular-nums ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Top Performers */}
      {topPerformers.length > 0 && (
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-subtle)] px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Award size={14} className="text-yellow-400" />
            <span className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Top Performers</span>
          </div>
          <div className="flex items-center gap-4">
            {topPerformers.map((p, i) => (
              <div key={p.info.account_id} className="flex items-center gap-2">
                <div className="relative">
                  <MiniAvatar info={p.info} size={28} />
                  {i === 0 && <span className="absolute -top-1 -right-1 text-[10px]">🥇</span>}
                  {i === 1 && <span className="absolute -top-1 -right-1 text-[10px]">🥈</span>}
                  {i === 2 && <span className="absolute -top-1 -right-1 text-[10px]">🥉</span>}
                </div>
                <div>
                  <p className="text-[12px] font-medium text-[var(--text-primary)]">{p.info.full_name || p.info.username}</p>
                  <p className="text-[10px] text-[var(--text-dim)]">{p.count} completed</p>
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
  const [todos, setTodos] = useState<TodoWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [labelFilter, setLabelFilter] = useState<string>("");
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; entry: TodoWithRelations | null }>({ open: false, entry: null });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; task: TodoWithRelations | null }>({ open: false, task: null });
  const [deleting, setDeleting] = useState(false);

  // Reference data
  const [employees, setEmployees] = useState<TodoAssigneeInfo[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [labels, setLabels] = useState<TodoLabelRow[]>([]);
  const accountId = getCurrentAccountIdSync();

  const loadAll = useCallback(async () => {
    const [t, e, d, l] = await Promise.all([
      fetchTodos(),
      fetchAssignableEmployees(),
      fetchDepartments(),
      fetchTodoLabels(),
    ]);
    setTodos(t); setEmployees(e); setDepartments(d); setLabels(l);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleToggle = async (id: string) => {
    setTodos((prev) => prev.map((t) => t.id === id ? { ...t, completed: !t.completed, completed_at: !t.completed ? new Date().toISOString() : null } : t));
    await toggleTodo(id);
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

  // Filtering
  const filtered = useMemo(() => {
    let list = todos;

    // Text search: title, description, label, assignee name/username, department
    if (search) {
      const q = search.toLowerCase();
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
        (q === "overdue" && isOverdue(t.due_date)),
      );
    }

    if (filter === "active") list = list.filter((t) => !t.completed);
    if (filter === "completed") list = list.filter((t) => t.completed);
    if (priorityFilter !== "all") list = list.filter((t) => t.priority === priorityFilter);
    if (labelFilter) list = list.filter((t) => t.label === labelFilter);
    if (deptFilter) list = list.filter((t) =>
      t.assigned_department === deptFilter ||
      t.assignees.some((a) => a.department === deptFilter),
    );
    if (assigneeFilter) list = list.filter((t) =>
      t.assignees.some((a) => a.account_id === assigneeFilter),
    );

    return list;
  }, [todos, search, filter, priorityFilter, labelFilter, deptFilter, assigneeFilter]);

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
    const overdueList = active.filter((t) => isOverdue(t.due_date));
    const today = active.filter((t) => t.due_date && formatDate(t.due_date) === "Today" && !isOverdue(t.due_date));
    const upcoming = active.filter((t) => t.due_date && !isOverdue(t.due_date) && formatDate(t.due_date) !== "Today");
    const noDate = active.filter((t) => !t.due_date);
    return { overdue: overdueList, today, upcoming, noDate, completed };
  }, [filtered]);

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

  const hasActiveFilters = labelFilter || deptFilter || assigneeFilter;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col">

      {/* ── STICKY HEADER ── */}
      <div className="sticky top-0 z-30 bg-[var(--bg-primary)]/95 backdrop-blur-md border-b border-[var(--border-subtle)]">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8">

          {/* Title row */}
          <div className="flex flex-wrap items-center gap-3 pt-5 pb-1">
            <Link href="/" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
                <CheckSquare className="h-4 w-4" />
              </div>
              <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">To-do</h1>
            </div>
          </div>
          <p className="text-[12px] text-[var(--text-dim)] mb-3 ml-0 md:ml-11">
            Task management &middot; {stats.total} tasks
          </p>

          {/* Search + Add */}
          <div className="flex items-center gap-2 pb-2">
            <div className="flex-1 flex items-center bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 gap-3 focus-within:border-[var(--border-focus)] transition-all">
              <Search size={16} className="text-[var(--text-dim)]" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, user, department, priority, status, tags..."
                className="flex-1 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none h-10" />
              {search && (
                <button onClick={() => setSearch("")} className="p-0.5">
                  <X size={14} className="text-[var(--text-dim)]" />
                </button>
              )}
            </div>
            <button onClick={() => setShowFilters(!showFilters)}
              className={`h-10 px-3 rounded-xl border text-[13px] font-medium flex items-center gap-1.5 transition-all shrink-0 ${
                showFilters || hasActiveFilters
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                  : "bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              }`}>
              <Filter size={14} />
              <span className="hidden md:inline">Filters</span>
              {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
            </button>
            <button onClick={() => setModal({ open: true, entry: null })}
              className="h-10 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shrink-0">
              <Plus size={16} />
              <span className="hidden md:inline">Add Task</span>
            </button>
          </div>

          {/* Filter pills row */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-3 scrollbar-none">
            {(["all", "active", "completed"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`h-7 px-3 rounded-full text-[11px] font-semibold transition-all border whitespace-nowrap ${
                  filter === f
                    ? "bg-white/10 border-white/20 text-[var(--text-primary)]"
                    : "bg-transparent border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                }`}>
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
                }`}>
                <Flag size={10} /> {p.label}
              </button>
            ))}
          </div>

          {/* Advanced filters panel */}
          {showFilters && (
            <div className="pb-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {/* Department filter */}
                <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
                  className="h-8 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none">
                  <option value="">All Departments</option>
                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>

                {/* Assignee filter */}
                <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="h-8 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none">
                  <option value="">All Assignees</option>
                  {uniqueAssignees.map((a) => (
                    <option key={a.account_id} value={a.account_id}>{a.full_name || a.username}</option>
                  ))}
                </select>

                {/* Label filter */}
                <select value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)}
                  className="h-8 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none">
                  <option value="">All Labels</option>
                  {usedLabels.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>

                {hasActiveFilters && (
                  <button onClick={() => { setLabelFilter(""); setDeptFilter(""); setAssigneeFilter(""); }}
                    className="h-8 px-3 rounded-lg text-[11px] font-medium text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1">
                    <X size={12} /> Clear Filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="flex-1 max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-5 w-full">

        {/* KPI Dashboard */}
        {!loading && todos.length > 0 && <div className="mb-5"><KpiDashboard todos={todos} /></div>}

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
          <div className="space-y-3">
            {grouped.overdue.length > 0 && (
              <Section title="Overdue" count={grouped.overdue.length} color="text-red-400">
                {grouped.overdue.map((t) => (
                  <TaskRow key={t.id} task={t} currentAccountId={accountId}
                    onToggle={() => handleToggle(t.id)}
                    onEdit={() => setModal({ open: true, entry: t })}
                    onDelete={() => setDeleteModal({ open: true, task: t })}
                    onAddNote={(body) => handleAddNote(t.id, body)}
                    onDeleteNote={handleDeleteNote} />
                ))}
              </Section>
            )}
            {grouped.today.length > 0 && (
              <Section title="Today" count={grouped.today.length} color="text-green-400">
                {grouped.today.map((t) => (
                  <TaskRow key={t.id} task={t} currentAccountId={accountId}
                    onToggle={() => handleToggle(t.id)}
                    onEdit={() => setModal({ open: true, entry: t })}
                    onDelete={() => setDeleteModal({ open: true, task: t })}
                    onAddNote={(body) => handleAddNote(t.id, body)}
                    onDeleteNote={handleDeleteNote} />
                ))}
              </Section>
            )}
            {grouped.upcoming.length > 0 && (
              <Section title="Upcoming" count={grouped.upcoming.length} color="text-blue-400">
                {grouped.upcoming.map((t) => (
                  <TaskRow key={t.id} task={t} currentAccountId={accountId}
                    onToggle={() => handleToggle(t.id)}
                    onEdit={() => setModal({ open: true, entry: t })}
                    onDelete={() => setDeleteModal({ open: true, task: t })}
                    onAddNote={(body) => handleAddNote(t.id, body)}
                    onDeleteNote={handleDeleteNote} />
                ))}
              </Section>
            )}
            {grouped.noDate.length > 0 && (
              <Section title="No Due Date" count={grouped.noDate.length} color="text-[var(--text-faint)]">
                {grouped.noDate.map((t) => (
                  <TaskRow key={t.id} task={t} currentAccountId={accountId}
                    onToggle={() => handleToggle(t.id)}
                    onEdit={() => setModal({ open: true, entry: t })}
                    onDelete={() => setDeleteModal({ open: true, task: t })}
                    onAddNote={(body) => handleAddNote(t.id, body)}
                    onDeleteNote={handleDeleteNote} />
                ))}
              </Section>
            )}
            {grouped.completed.length > 0 && (
              <Section title="Completed" count={grouped.completed.length} color="text-[var(--text-dim)]">
                {grouped.completed.map((t) => (
                  <TaskRow key={t.id} task={t} currentAccountId={accountId}
                    onToggle={() => handleToggle(t.id)}
                    onEdit={() => setModal({ open: true, entry: t })}
                    onDelete={() => setDeleteModal({ open: true, task: t })}
                    onAddNote={(body) => handleAddNote(t.id, body)}
                    onDeleteNote={handleDeleteNote} />
                ))}
              </Section>
            )}
          </div>
        )}
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
