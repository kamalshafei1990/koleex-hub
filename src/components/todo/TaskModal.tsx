"use client";

/* ---------------------------------------------------------------------------
   TaskModal — the full task form (create / edit). Loaded on demand: the list
   paints without it, and quick-add covers the everyday capture.

   Mounted fresh for every open (the parent keys it), so the fields are
   initialised from the task once instead of being reset by an effect.
   Esc closes; ⌘/Ctrl+Enter saves.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ScrollLockOverlay } from "@/hooks/useScrollLock";
import { useTranslation } from "@/lib/i18n";
import { todoT } from "@/lib/translations/todo";
import KdsSelect from "@/components/kds/Select";
import DatePicker from "@/components/ui/DatePicker";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import { fetchProjects } from "@/lib/projects";
import type {
  TodoAssigneeInfo, TodoChecklistItem, TodoLabelRow, TodoMetadata, TodoPriority, TodoRecurrence, TodoStatus, TodoWithRelations,
} from "@/types/supabase";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import CircleIcon from "@/components/icons/ui/CircleIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import ListTodoIcon from "@/components/icons/ui/ListTodoIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import RefreshCwIcon from "@/components/icons/ui/RefreshCwIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import MiniAvatar from "./MiniAvatar";
import { dayKey, isoToLocalInput, localInputToIso } from "./todo-dates";
import {
  CHOICE, CHOICE_OFF, CHOICE_ON, FIELD_LABEL, INPUT, PRIORITIES, PRIORITY_ON, RECURRENCES, STATUS_DOT, STATUSES, type TFn,
} from "./todo-ui";
import type { TaskFields } from "./use-todo-store";
import { createLabel } from "./todo-write";

/* Attachments · mentions · observers · products — its own chunk, fetched
   only when that section is opened. */
const TaskExtras = dynamic(() => import("./TaskExtras"), {
  ssr: false,
  loading: () => <div className="h-24 flex items-center justify-center"><SpinnerIcon className="h-4 w-4 text-[var(--text-dim)]" /></div>,
});

/* Active projects for the optional "Related project" link — one request per
   page life, not one per open. fetchProjects answers [] without access,
   which hides the field. */
let projectsPromise: Promise<{ id: string; name: string }[]> | null = null;
function loadProjects() {
  projectsPromise ??= fetchProjects({ status: "active" })
    .then((rows) => rows.map((r) => ({ id: r.id, name: r.name })))
    .catch(() => { projectsPromise = null; return []; });
  return projectsPromise;
}

export interface TaskModalProps {
  entry: TodoWithRelations | null;
  /** Prefill for a new task (from the list's current context). */
  initialDue?: string;
  employees: TodoAssigneeInfo[];
  departments: string[];
  labels: TodoLabelRow[];
  /** "Assign to everyone" is for admins only — the server refuses it too. */
  canAssignAll: boolean;
  onClose: () => void;
  /** Resolves null when saved, or the reason it was not. */
  onSubmit: (fields: TaskFields, assigneeIds: string[]) => Promise<string | null>;
  onLabelCreated: (label: TodoLabelRow) => void;
}

export default function TaskModal({ entry, initialDue, employees, departments, labels, canAssignAll, onClose, onSubmit, onLabelCreated }: TaskModalProps) {
  const { t, lang } = useTranslation(todoT);
  const meta0: TodoMetadata = entry?.metadata && typeof entry.metadata === "object" ? entry.metadata : {};

  const [title, setTitle] = useState(entry?.title ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [priority, setPriority] = useState<TodoPriority>(entry?.priority ?? "medium");
  const [label, setLabel] = useState(entry?.label ?? "");
  const [dueDate, setDueDate] = useState(dayKey(entry?.due_date) ?? initialDue ?? "");
  const [startDate, setStartDate] = useState(dayKey(entry?.start_date) ?? "");
  const [remindAt, setRemindAt] = useState(isoToLocalInput(entry?.remind_at ?? null));
  const [status, setStatus] = useState<TodoStatus>(entry?.status ?? "todo");
  const [recurrence, setRecurrence] = useState<TodoRecurrence>(entry?.recurrence ?? null);
  const [recurrenceUntil, setRecurrenceUntil] = useState(dayKey(entry?.recurrence_until) ?? "");
  const [assignees, setAssignees] = useState<string[]>(entry?.assignees.map((a) => a.account_id) ?? []);
  const [dept, setDept] = useState(entry?.assigned_department ?? "");
  const [assignAll, setAssignAll] = useState(entry?.assign_to_all ?? false);
  const [extras, setExtras] = useState<TodoMetadata>(meta0);
  /* Opens by itself only when the task already carries some. */
  const [showExtras, setShowExtras] = useState(
    !!(meta0.attachments?.length || meta0.mentions?.length || meta0.observers?.length || meta0.products?.length),
  );
  /* Assignment is folded away on a personal task — most tasks are your own. */
  const [showAssign, setShowAssign] = useState(!!(entry && (entry.assignees.length || entry.assign_to_all || entry.assigned_department)));
  const [empSearch, setEmpSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    let alive = true;
    void loadProjects().then((p) => { if (alive) setProjects(p); });
    return () => { alive = false; };
  }, []);

  const save = async () => {
    if (!title.trim()) { setError(t("err.titleRequired")); return; }
    if (saving) return;
    setSaving(true); setError("");
    const fields: TaskFields = {
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
      assigned_department: dept || null,
      assign_to_all: assignAll,
      metadata: extras,
    };
    /* The parent applies the change optimistically and reports whether the
       server kept it. The old form closed on ANY outcome, so a refused save
       looked exactly like a successful one. */
    const problem = await onSubmit(fields, assignees);
    setSaving(false);
    if (problem) setError(problem);
    else onClose();
  };

  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) { e.preventDefault(); onClose(); }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void saveRef.current(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleAssignee = (id: string) => {
    setAssignAll(false); setDept("");
    setAssignees((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const pickDept = (d: string) => {
    setAssignAll(false);
    if (d === dept) { setDept(""); setAssignees([]); return; }
    setDept(d);
    setAssignees(employees.filter((e) => e.department === d).map((e) => e.account_id));
  };
  const pickAll = () => {
    setDept("");
    if (assignAll) { setAssignAll(false); setAssignees([]); }
    else { setAssignAll(true); setAssignees(employees.map((e) => e.account_id)); }
  };

  const setProject = (id: string) =>
    setExtras((prev) => {
      const next = { ...prev };
      const p = projects.find((x) => x.id === id) ?? (prev.project?.id === id ? prev.project : null);
      if (p) next.project = { id: p.id, name: p.name };
      else delete next.project;
      return next;
    });

  const q = empSearch.trim().toLowerCase();
  const visibleEmployees = useMemo(() => (q
    ? employees.filter((e) =>
        (e.full_name || e.username).toLowerCase().includes(q) ||
        (e.name_alt ?? "").toLowerCase().includes(q) ||
        (e.department ?? "").toLowerCase().includes(q))
    : employees), [employees, q]);

  const assigneeNames = assignAll
    ? t("assign.everyone")
    : dept || employees.filter((e) => assignees.includes(e.account_id)).slice(0, 3).map((e) => e.full_name || e.username).join(", ");

  return (
    <ScrollLockOverlay className="fixed inset-0 z-50 flex items-start justify-center p-3 md:p-4 pt-16 md:pt-20 pb-6 overflow-y-auto bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="todo-modal-title"
        className="kx-app kx-glass-pop kx-pop-in w-full max-w-xl rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl overflow-hidden mb-10 max-h-[92dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5">
            <ListTodoIcon size={18} className="text-[var(--text-dim)]" />
            <h2 id="todo-modal-title" className="text-[15px] font-semibold text-[var(--text-primary)]">
              {entry ? t("modal.edit") : t("modal.add")}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t("modal.cancel")}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors">
            <CrossIcon size={16} className="text-[var(--text-dim)]" />
          </button>
        </div>

        <div className="p-4 md:p-5 space-y-4 flex-1 overflow-y-auto min-h-0">
          {error && (
            <div role="alert" className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">{error}</div>
          )}

          <div>
            <label htmlFor="todo-title" className={FIELD_LABEL}>{t("f.title")} *</label>
            <input id="todo-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={t("f.title.placeholder")} className={INPUT}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && title.trim()) { e.preventDefault(); void save(); } }} />
          </div>

          <div>
            <label htmlFor="todo-desc" className={FIELD_LABEL}>{t("f.description")} <span className="font-normal normal-case">{t("common.optional")}</span></label>
            <textarea id="todo-desc" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder={t("f.description.placeholder")} rows={3} className={`${INPUT} h-auto py-3 resize-none`} />
          </div>

          {/* Priority + due side by side — the two fields almost every task sets. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className={FIELD_LABEL}>{t("f.priority")}</span>
              <div className="flex gap-1.5" role="group" aria-label={t("f.priority")}>
                {PRIORITIES.map((p) => (
                  <button key={p} type="button" onClick={() => setPriority(p)} aria-pressed={priority === p}
                    className={`flex-1 h-10 ${CHOICE} ${priority === p ? PRIORITY_ON[p] : CHOICE_OFF}`}>
                    {t("p." + p)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className={FIELD_LABEL}>{t("f.dueDate")}</span>
              <DatePicker value={dueDate} onChange={setDueDate} placeholder={t("f.selectDate")} lang={lang} heightCls="h-10" min={startDate || undefined} />
            </div>
          </div>

          <div>
            <span className={FIELD_LABEL}>{t("f.status")}</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5" role="group" aria-label={t("f.status")}>
              {STATUSES.map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)} aria-pressed={status === s}
                  className={`h-9 ${CHOICE} ${status === s ? CHOICE_ON : CHOICE_OFF}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s]}`} /> {t("st." + s)}
                </button>
              ))}
            </div>
          </div>

          {/* Assign */}
          <div className="rounded-xl border border-[var(--border-subtle)]">
            <button type="button" onClick={() => setShowAssign((v) => !v)} aria-expanded={showAssign}
              className="w-full h-11 px-3.5 flex items-center gap-2 text-start rounded-xl">
              <UsersIcon size={14} className="text-[var(--text-dim)] shrink-0" />
              <span className="text-[12px] font-semibold text-[var(--text-muted)]">{t("f.assignTo")}</span>
              <span className="text-[12px] text-[var(--text-dim)] truncate flex-1 min-w-0">
                {assigneeNames || t("assign.onlyMe")}
                {!assignAll && !dept && assignees.length > 3 ? ` +${assignees.length - 3}` : ""}
              </span>
              <AngleDownIcon size={13} className={`text-[var(--text-dim)] transition-transform shrink-0 ${showAssign ? "rotate-180" : ""}`} />
            </button>
            {showAssign && (
              <div className="px-3.5 pb-3.5 space-y-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {/* Everyone in the company: admins only. A task that already
                      carries it keeps the pill so it can be switched off. */}
                  {(canAssignAll || assignAll) && (
                    <button type="button" onClick={pickAll} aria-pressed={assignAll}
                      className={`h-7 px-3 rounded-full text-[11px] font-semibold transition-colors border flex items-center gap-1.5 ${assignAll ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : CHOICE_OFF}`}>
                      <UsersIcon size={10} /> {t("assign.everyone")}
                    </button>
                  )}
                  {departments.map((d) => (
                    <button key={d} type="button" onClick={() => pickDept(d)} aria-pressed={dept === d}
                      className={`h-7 px-3 rounded-full text-[11px] font-semibold transition-colors border flex items-center gap-1.5 ${dept === d ? "bg-violet-500/15 border-violet-500/30 text-violet-300" : CHOICE_OFF}`}>
                      <Building2Icon size={10} /> {d}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <SearchIcon size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                  <input type="text" value={empSearch} onChange={(e) => setEmpSearch(e.target.value)} aria-label={t("filters.searchEmployees")}
                    placeholder={t("filters.searchEmployees")} className={`${INPUT} ps-9 h-9 text-[12px]`} />
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-[200px] overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 [&>*]:min-w-0">
                  {visibleEmployees.map((emp) => {
                    const on = assignees.includes(emp.account_id);
                    const alt = (emp.name_alt ?? "").trim();
                    return (
                      <button key={emp.account_id} type="button" onClick={() => toggleAssignee(emp.account_id)} aria-pressed={on}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${on ? "bg-[#567FB2]/15 ring-1 ring-[#567FB2]/40" : "hover:bg-[var(--bg-surface-subtle)]"}`}>
                        <span className="relative">
                          <MiniAvatar info={emp} size={34} />
                          {on && (
                            <span className="absolute -bottom-0.5 -end-0.5 w-4 h-4 rounded-full bg-[#567FB2] flex items-center justify-center">
                              <CheckCircleIcon size={10} className="text-white" />
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] font-medium text-[var(--text-primary)] text-center leading-tight truncate w-full">{emp.full_name || emp.username}</span>
                        {alt && alt !== (emp.full_name ?? "").trim() && (
                          <span lang="zh" className="text-[10px] text-[var(--text-dim)] text-center leading-tight truncate w-full">{alt}</span>
                        )}
                        {emp.position && <span className="text-[9px] text-[var(--text-dim)] text-center leading-tight truncate w-full">{emp.position}</span>}
                      </button>
                    );
                  })}
                  {visibleEmployees.length === 0 && (
                    <div className="col-span-full text-center py-4 text-[12px] text-[var(--text-dim)]">{t("assign.none")}</div>
                  )}
                </div>
                {assignees.length > 0 && (
                  <p className="text-[11px] text-[var(--text-muted)]">{assignees.length} {t("assign.selectedWord")}</p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className={FIELD_LABEL}>{t("f.startDate")}</span>
              <DatePicker value={startDate} onChange={setStartDate} placeholder={t("f.selectDate")} lang={lang} heightCls="h-10" max={dueDate || undefined} />
            </div>
            <div>
              <span className={FIELD_LABEL}>{t("f.reminder")} <span className="font-normal normal-case">{t("common.optional")}</span></span>
              {/* Day/Month/Year picker + a plain HH:MM box: a native
                  datetime-local renders month-first on an English browser. */}
              <div className="flex items-center gap-1.5">
                <div className="flex-1 min-w-0">
                  <DatePicker value={remindAt.slice(0, 10)} lang={lang} heightCls="h-10" floating
                    onChange={(iso) => setRemindAt(iso ? `${iso}T${remindAt.slice(11, 16) || "09:00"}` : "")}
                    placeholder={t("f.selectDate")} />
                </div>
                <input type="time" value={remindAt.slice(11, 16)} disabled={!remindAt} aria-label={t("f.reminderTime")}
                  onChange={(e) => { if (remindAt) setRemindAt(`${remindAt.slice(0, 10)}T${e.target.value || "09:00"}`); }}
                  className="h-10 w-[84px] px-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] tabular-nums text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-colors disabled:opacity-40" />
                {remindAt && (
                  <button type="button" onClick={() => setRemindAt("")} aria-label={t("common.clear")}
                    className="h-10 w-8 shrink-0 inline-flex items-center justify-center rounded-xl text-[var(--text-dim)] hover:text-[var(--text-primary)]">
                    <CrossIcon size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <span className={FIELD_LABEL}><RefreshCwIcon size={11} className="inline me-1 -mt-0.5" /> {t("f.recurrence")}</span>
            <div className="grid grid-cols-4 gap-1.5" role="group" aria-label={t("f.recurrence")}>
              {RECURRENCES.map((r) => (
                <button key={r ?? "once"} type="button" onClick={() => setRecurrence(r)} aria-pressed={recurrence === r}
                  className={`h-9 ${CHOICE} ${recurrence === r ? CHOICE_ON : CHOICE_OFF}`}>
                  {t(r ? "rec." + r : "rec.once")}
                </button>
              ))}
            </div>
            {recurrence && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] text-[var(--text-muted)] shrink-0">{t("f.recurrenceUntil")}</span>
                <div className="flex-1 min-w-0">
                  <DatePicker value={recurrenceUntil} onChange={setRecurrenceUntil} placeholder={t("f.recurrenceForever")} lang={lang} heightCls="h-9" min={dueDate || startDate || undefined} />
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className={FIELD_LABEL}>{t("f.label")}</span>
              <LabelPicker labels={labels} value={label} onChange={setLabel} t={t} onCreated={onLabelCreated} />
            </div>
            {(projects.length > 0 || extras.project) && (
              <div>
                <span className={FIELD_LABEL}><BriefcaseIcon size={11} className="inline me-1 -mt-0.5" /> {t("f.project")}</span>
                {/* A project already linked but no longer active keeps its own
                    row — otherwise the form would show "None" over a live link. */}
                <KdsSelect value={extras.project?.id ?? ""} onChange={setProject}
                  options={[
                    ...(extras.project && !projects.some((p) => p.id === extras.project?.id)
                      ? [{ value: extras.project.id, label: extras.project.name }] : []),
                    ...projects.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                  placeholder={t("f.noProject")}
                  triggerClassName="w-full h-11 ps-4 pe-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-colors cursor-pointer text-start" />
              </div>
            )}
          </div>

          <ChecklistField
            items={Array.isArray(extras.checklist) ? extras.checklist : []}
            onChange={(checklist) => setExtras((prev) => ({ ...prev, checklist }))}
            t={t}
          />

          {showExtras ? (
            <TaskExtras value={extras} onChange={setExtras} employees={employees} />
          ) : (
            <button type="button" onClick={() => setShowExtras(true)}
              className="w-full h-10 rounded-xl border border-dashed border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-colors flex items-center justify-center gap-1.5">
              <PlusIcon size={12} /> {t("extras.toggle")}
            </button>
          )}
        </div>

        <div className="shrink-0 flex items-center justify-between gap-2 px-4 md:px-5 py-3.5 border-t border-[var(--border-subtle)]">
          <span className="hidden sm:inline text-[11px] text-[var(--text-ghost)]">{t("modal.saveHint")}</span>
          <div className="flex items-center gap-2 ms-auto">
            <button type="button" onClick={onClose}
              className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors">
              {t("modal.cancel")}
            </button>
            <button type="button" onClick={() => void save()} disabled={saving || !title.trim()}
              className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity shadow-lg disabled:opacity-40">
              {saving && <SpinnerIcon className="h-4 w-4" />}
              {saving ? t("modal.saving") : entry ? t("modal.save") : t("modal.add")}
            </button>
          </div>
        </div>
      </div>
    </ScrollLockOverlay>
  );
}

/* ── Checklist / subtasks (metadata.checklist) ── */
function ChecklistField({ items, onChange, t }: { items: TodoChecklistItem[]; onChange: (next: TodoChecklistItem[]) => void; t: TFn }) {
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
      <span className={FIELD_LABEL}>
        {t("checklist.title")}{items.length > 0 && <span className="ms-1.5 text-[var(--text-muted)] normal-case">{done}/{items.length}</span>}
      </span>
      {items.length > 0 && (
        <ul className="space-y-1 mb-2">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 group">
              <button type="button" aria-pressed={it.done} aria-label={it.text}
                onClick={() => onChange(items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))} className="shrink-0">
                {it.done ? <CheckCircleIcon size={16} className="text-green-400" /> : <CircleIcon size={16} className="text-[var(--text-ghost)]" />}
              </button>
              <span className={`flex-1 min-w-0 break-words text-[12.5px] ${it.done ? "line-through text-[var(--text-dim)]" : "text-[var(--text-primary)]"}`}>{it.text}</span>
              <button type="button" onClick={() => onChange(items.filter((x) => x.id !== it.id))} aria-label={t("common.remove")}
                className="shrink-0 h-6 w-6 inline-flex items-center justify-center rounded-md text-[var(--text-dim)] hover:text-red-400 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity">
                <CrossIcon size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} aria-label={t("checklist.placeholder")}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); add(); } }}
          placeholder={t("checklist.placeholder")}
          className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors" />
        <button type="button" onClick={add} disabled={!text.trim()} aria-label={t("common.add")}
          className="h-9 w-9 shrink-0 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] disabled:opacity-30">
          <PlusIcon size={14} />
        </button>
      </div>
    </div>
  );
}

/* ── LabelPicker — one input-height control: searchable list, pick one
   (again to clear), or create a label from the footer. ── */
function LabelPicker({ labels, value, onChange, t, onCreated }: {
  labels: TodoLabelRow[];
  value: string;
  onChange: (name: string) => void;
  t: TFn;
  onCreated: (label: TodoLabelRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [labelError, setLabelError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => { setOpen(false); setQ(""); setCreating(false); };
    const onDown = (ev: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(ev.target as Node)) close();
    };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") { ev.preventDefault(); close(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const create = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true); setLabelError("");
    const r = await createLabel(name);
    setBusy(false);
    if (!r.ok || !r.data) {
      setLabelError(!r.ok && r.status === 409 ? t("err.labelExists") : !r.ok && r.status === 400 ? t("err.labelInvalid") : t("err.saveFailed"));
      return;
    }
    const created = r.data;
    onCreated(created);
    onChange(created.name);
    setNewName(""); setCreating(false); setOpen(false);
  };

  const selected = labels.find((l) => l.name === value) ?? null;
  const needle = q.trim().toLowerCase();
  const list = needle ? labels.filter((l) => l.name.toLowerCase().includes(needle)) : labels;

  return (
    <div ref={rootRef} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="listbox"
        className="w-full h-11 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] flex items-center gap-2 hover:border-[var(--border-focus)] transition-colors">
        <TagsIcon size={14} className="text-[var(--text-dim)] shrink-0" />
        {selected || value ? (
          <span className="flex items-center gap-2 text-[var(--text-primary)] min-w-0">
            {selected?.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selected.color }} />}
            <span className="truncate"><AutoTranslatedText text={selected?.name ?? value} plain /></span>
          </span>
        ) : (
          <span className="text-[var(--text-dim)]">{t("f.label.choose")}</span>
        )}
        <AngleDownIcon size={13} className={`ms-auto shrink-0 text-[var(--text-dim)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {value && (
        <button type="button" aria-label={t("common.clear")} onClick={() => onChange("")}
          className="absolute end-9 top-1/2 -translate-y-1/2 h-6 w-6 inline-flex items-center justify-center rounded-full hover:bg-[var(--bg-surface-hover)] text-[var(--text-dim)]">
          <CrossIcon size={11} />
        </button>
      )}

      {open && (
        <div className="kx-glass-pop absolute z-30 mt-1 w-full min-w-[240px] rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-[0_12px_40px_rgba(0,0,0,0.45)] overflow-hidden">
          <div className="p-1.5 border-b border-[var(--border-subtle)]">
            <input autoFocus value={q} onChange={(ev) => setQ(ev.target.value)} placeholder={t("f.label.search")} aria-label={t("f.label.search")}
              className="w-full h-8 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]" />
          </div>
          <div role="listbox" className="max-h-52 overflow-y-auto p-1 grid grid-cols-2 gap-0.5 [&>*]:min-w-0">
            {list.length === 0 && (
              <div className="col-span-2 px-3 h-8 flex items-center text-[12px] text-[var(--text-dim)]">{t("extras.noMatches")}</div>
            )}
            {list.map((l) => {
              const on = l.name === value;
              return (
                <button key={l.id} type="button" role="option" aria-selected={on}
                  onClick={() => { onChange(on ? "" : l.name); setOpen(false); setQ(""); }}
                  className={`h-8 px-2.5 rounded-lg text-[12px] flex items-center gap-2 text-start transition-colors ${on ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)] font-semibold" : "text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"}`}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.color ?? "#94a3b8" }} />
                  <span className="truncate"><AutoTranslatedText text={l.name} plain /></span>
                </button>
              );
            })}
          </div>
          <div className="p-1.5 border-t border-[var(--border-subtle)]">
            {creating ? (
              <div className="flex items-center gap-1.5">
                <input type="text" value={newName} onChange={(ev) => { setNewName(ev.target.value); setLabelError(""); }} autoFocus
                  placeholder={t("f.label.placeholder")} aria-label={t("f.label.placeholder")}
                  className="flex-1 min-w-0 h-8 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  onKeyDown={(ev) => { if (ev.key === "Enter" && !ev.nativeEvent.isComposing) { ev.preventDefault(); void create(); } }} />
                <button type="button" onClick={() => void create()} disabled={!newName.trim() || busy}
                  className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90 transition-opacity shrink-0 disabled:opacity-40">
                  {t("common.add")}
                </button>
              </div>
            ) : null}
            {creating && labelError && <p role="alert" className="px-1 pt-1.5 text-[11px] text-red-400">{labelError}</p>}
            {creating ? null : (
              <button type="button" onClick={() => setCreating(true)}
                className="w-full h-8 px-2.5 rounded-lg text-[12px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center gap-1.5">
                <PlusIcon size={11} /> {t("f.label.new")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
