"use client";

/* ---------------------------------------------------------------------------
   TaskExtras — the collaboration/data panels shown inside a task's workspace
   (Checklist · Comments · Time · Files) plus the project Milestone strip.
   Each panel is self-contained: it fetches on mount and re-fetches after its
   own mutations. Wired to the Phase 2 /api/projects/* routes.

   Every write reports failure with a toast (the server's message) and is
   guarded against double submission; hover-revealed delete buttons are also
   revealed on keyboard focus and are always visible on small (touch)
   screens, where hover does not exist.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/kds/useToast";
import { projectsT } from "@/lib/translations/projects";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import FileIcon from "@/components/icons/ui/FileIcon";
import UploadIcon from "@/components/icons/ui/UploadIcon";
import FlagIcon from "@/components/icons/ui/FlagIcon";
import {
  fetchChecklist, createChecklistItem, updateChecklistItem, deleteChecklistItem,
  fetchComments, createComment, deleteComment,
  fetchTimeEntries, createTimeEntry, deleteTimeEntry,
  fetchAttachments, uploadAttachment, deleteAttachment,
  fetchMilestones, createMilestone, updateMilestone, deleteMilestone,
  fetchTasks, createTask, updateTask, deleteTask,
  formatDMY, todayLocalISO,
  type ChecklistItem, type TaskComment, type TimeEntry, type TaskAttachment, type Milestone, type TaskRow,
} from "@/lib/projects";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

const card = "rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]";
const inputCls = "h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";
const btnCls = "h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all shadow-lg shrink-0 disabled:opacity-40";
/* Revealed on row hover OR keyboard focus; always shown below sm (touch). */
const revealCls = "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity";

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function stamp(iso: string): string {
  const d = new Date(iso);
  return `${formatDMY(iso)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Shared failure reporting for a panel. */
function usePanelFeedback() {
  const { t } = useTranslation(projectsT);
  const { showToast, toastElement } = useToast();
  const fail = useCallback(
    (kind: "save" | "delete", e: unknown) =>
      showToast(t(kind === "save" ? "toast.saveFailed" : "toast.deleteFailed").replace("{err}", errText(e)), "error"),
    [showToast, t],
  );
  return { fail, toastElement };
}

/* ── Checklist ──────────────────────────────────────────────────────── */
export function ChecklistPanel({ taskId }: { taskId: string }) {
  const { t } = useTranslation(projectsT);
  const { fail, toastElement } = usePanelFeedback();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchChecklist(taskId)
      .then((x) => { setItems(x); setLoadError(false); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [taskId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await createChecklistItem(taskId, title.trim());
      setTitle("");
      load();
    } catch (e) { fail("save", e); } finally { setBusy(false); }
  };
  const toggle = async (it: ChecklistItem) => {
    setItems((p) => p.map((x) => (x.id === it.id ? { ...x, is_done: !x.is_done } : x)));
    try {
      await updateChecklistItem(taskId, it.id, { is_done: !it.is_done });
    } catch (e) {
      setItems((p) => p.map((x) => (x.id === it.id ? { ...x, is_done: it.is_done } : x)));
      fail("save", e);
    }
  };
  const remove = async (id: string) => {
    try { await deleteChecklistItem(taskId, id); load(); } catch (e) { fail("delete", e); }
  };

  const done = items.filter((x) => x.is_done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  if (loading) return <PanelSpinner />;
  if (loadError) return <PanelError onRetry={load} />;
  return (
    <div className="space-y-3">
      {toastElement}
      {items.length > 0 && <MiniProgress done={done} total={items.length} pct={pct} />}
      <div className="space-y-1.5">
        {items.map((it) => (
          <div key={it.id} className={`group flex items-center gap-2 px-2.5 py-2 ${card}`}>
            <button
              type="button" onClick={() => toggle(it)}
              aria-label={t("tip.toggleDone")} aria-pressed={it.is_done}
              className={`h-4 w-4 shrink-0 rounded-full border flex items-center justify-center ${it.is_done ? "bg-emerald-500 border-emerald-500 text-white" : "border-[var(--border-color)] text-transparent hover:border-emerald-400"}`}
            ><CheckIcon size={10} /></button>
            <span className={`flex-1 text-[12.5px] ${it.is_done ? "line-through text-[var(--text-dim)]" : "text-[var(--text-primary)]"}`}>{it.title}</span>
            <button type="button" onClick={() => remove(it.id)} aria-label={t("tip.delete")} className={`${revealCls} h-6 w-6 rounded text-[var(--text-dim)] hover:text-rose-400 flex items-center justify-center`}><TrashIcon className="h-3 w-3" /></button>
          </div>
        ))}
        {items.length === 0 && <Empty text={t("x.noChecklist", "No checklist items yet.")} />}
      </div>
      <div className="flex items-center gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder={t("x.addItem", "Add an item…")} aria-label={t("x.addItem", "Add an item…")} className={`flex-1 ${inputCls}`} />
        <button type="button" onClick={add} disabled={busy || !title.trim()} aria-label={t("tip.addItem")} className={btnCls}>
          {busy ? <SpinnerIcon className="h-3 w-3" /> : <PlusIcon size={12} />}
        </button>
      </div>
    </div>
  );
}

/* ── Comments ───────────────────────────────────────────────────────── */
export function CommentsPanel({ taskId }: { taskId: string }) {
  const { t } = useTranslation(projectsT);
  const { fail, toastElement } = usePanelFeedback();
  const [items, setItems] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchComments(taskId)
      .then((x) => { setItems(x); setLoadError(false); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [taskId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      await createComment(taskId, body.trim());
      setBody("");
      load();
    } catch (e) { fail("save", e); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    try { await deleteComment(taskId, id); load(); } catch (e) { fail("delete", e); }
  };

  if (loading) return <PanelSpinner />;
  if (loadError) return <PanelError onRetry={load} />;
  return (
    <div className="space-y-3">
      {toastElement}
      <div className="space-y-2 max-h-[280px] overflow-y-auto">
        {items.map((c) => (
          <div key={c.id} className={`group px-3 py-2 ${card}`}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] font-semibold text-[var(--text-muted)]">{c.author?.username ?? "—"}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--text-ghost)] tabular-nums">{stamp(c.created_at)}</span>
                <button type="button" onClick={() => remove(c.id)} aria-label={t("tip.delete")} className={`${revealCls} text-[var(--text-dim)] hover:text-rose-400`}><TrashIcon className="h-3 w-3" /></button>
              </div>
            </div>
            <AutoTranslatedText block text={c.body} className="text-[12.5px] text-[var(--text-primary)] break-words" />
          </div>
        ))}
        {items.length === 0 && <Empty text={t("x.noComments", "No comments yet.")} />}
      </div>
      <div className="flex items-end gap-2">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder={t("x.writeComment", "Write a comment…")} aria-label={t("x.writeComment", "Write a comment…")} className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] resize-none" />
        <button type="button" onClick={add} disabled={!body.trim() || busy} className={btnCls}>{busy ? t("btn.saving") : t("x.post", "Post")}</button>
      </div>
    </div>
  );
}

/* ── Time tracking ──────────────────────────────────────────────────── */
export function TimePanel({ taskId }: { taskId: string }) {
  const { t } = useTranslation(projectsT);
  const { fail, toastElement } = usePanelFeedback();
  const [items, setItems] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchTimeEntries(taskId)
      .then((x) => { setItems(x); setLoadError(false); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [taskId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const h = Number(hours);
    if (!h || h <= 0 || busy) return;
    setBusy(true);
    try {
      /* The entry is dated with the user's LOCAL day, not the server's UTC one. */
      await createTimeEntry(taskId, { minutes: Math.round(h * 60), entry_date: todayLocalISO(), note: note.trim() || undefined });
      setHours(""); setNote("");
      load();
    } catch (e) { fail("save", e); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    try { await deleteTimeEntry(taskId, id); load(); } catch (e) { fail("delete", e); }
  };

  const totalMin = items.reduce((s, e) => s + e.minutes, 0);
  if (loading) return <PanelSpinner />;
  if (loadError) return <PanelError onRetry={load} />;
  return (
    <div className="space-y-3">
      {toastElement}
      <div className={`flex items-center gap-2 px-3 py-2 ${card}`}>
        <ClockIcon size={14} className="text-[var(--text-dim)]" />
        <span className="text-[12px] text-[var(--text-muted)]">{t("x.totalLogged", "Total logged")}</span>
        <span className="ms-auto text-[14px] font-bold tabular-nums">{(totalMin / 60).toFixed(2)}h</span>
      </div>
      <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
        {items.map((e) => (
          <div key={e.id} className={`group flex items-center gap-2 px-2.5 py-2 ${card}`}>
            <span className="text-[12px] font-semibold tabular-nums w-14">{(e.minutes / 60).toFixed(2)}h</span>
            <span className="text-[11px] text-[var(--text-dim)] w-20 shrink-0 tabular-nums">{formatDMY(e.entry_date)}</span>
            <span className="flex-1 text-[11.5px] text-[var(--text-muted)] truncate">{e.note ?? ""}</span>
            <span className="text-[10px] text-[var(--text-ghost)]">{e.account?.username ?? ""}</span>
            {e.invoiced_invoice_id ? (
              <span className="text-[10px] font-semibold text-[var(--text-dim)]">{t("x.invoiced")}</span>
            ) : (
              <button type="button" onClick={() => remove(e.id)} aria-label={t("tip.delete")} className={`${revealCls} text-[var(--text-dim)] hover:text-rose-400`}><TrashIcon className="h-3 w-3" /></button>
            )}
          </div>
        ))}
        {items.length === 0 && <Empty text={t("x.noTime", "No time logged yet.")} />}
      </div>
      <div className="flex items-center gap-2">
        <input value={hours} onChange={(e) => setHours(e.target.value)} type="number" step="0.25" min="0" placeholder={t("x.hours", "Hours")} aria-label={t("x.hours", "Hours")} className={`w-24 ${inputCls}`} />
        <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder={t("x.noteOptional", "Note (optional)")} aria-label={t("x.noteOptional", "Note (optional)")} className={`flex-1 ${inputCls}`} />
        <button type="button" onClick={add} disabled={busy || !(Number(hours) > 0)} className={btnCls}>{busy ? t("btn.saving") : t("x.log", "Log")}</button>
      </div>
    </div>
  );
}

/* ── Attachments ────────────────────────────────────────────────────── */
export function AttachmentsPanel({ taskId }: { taskId: string }) {
  const { t } = useTranslation(projectsT);
  const { fail, toastElement } = usePanelFeedback();
  const [items, setItems] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetchAttachments(taskId)
      .then((x) => { setItems(x); setLoadError(false); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [taskId]);
  useEffect(() => { load(); }, [load]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || busy) return;
    setBusy(true);
    try {
      await uploadAttachment(taskId, file);
      load();
    } catch (err) { fail("save", err); } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const remove = async (id: string) => {
    try { await deleteAttachment(taskId, id); load(); } catch (e) { fail("delete", e); }
  };

  const fmtSize = (n: number | null) => (n == null ? "" : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  if (loading) return <PanelSpinner />;
  if (loadError) return <PanelError onRetry={load} />;
  return (
    <div className="space-y-3">
      {toastElement}
      <div className="space-y-1.5">
        {items.map((a) => (
          <div key={a.id} className={`group flex items-center gap-2 px-2.5 py-2 ${card}`}>
            <FileIcon size={14} className="text-[var(--text-dim)] shrink-0" />
            {a.url ? (
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-[12.5px] text-[var(--text-primary)] hover:underline truncate">{a.file_name}</a>
            ) : (
              <span className="flex-1 text-[12.5px] text-[var(--text-primary)] truncate">{a.file_name}</span>
            )}
            <span className="text-[10px] text-[var(--text-ghost)] shrink-0">{fmtSize(a.file_size)}</span>
            <button type="button" onClick={() => remove(a.id)} aria-label={t("tip.delete")} className={`${revealCls} text-[var(--text-dim)] hover:text-rose-400`}><TrashIcon className="h-3 w-3" /></button>
          </div>
        ))}
        {items.length === 0 && <Empty text={t("x.noFiles", "No files attached.")} />}
      </div>
      <input ref={fileRef} type="file" onChange={onPick} className="hidden" />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="w-full h-9 rounded-lg border border-dashed border-[var(--border-subtle)] text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] flex items-center justify-center gap-1.5 disabled:opacity-50">
        {busy ? <SpinnerIcon className="h-3.5 w-3.5" /> : <UploadIcon size={13} />}
        {busy ? t("x.uploading") : t("x.upload")}
      </button>
    </div>
  );
}

/* ── Subtasks (child tasks via parent_task_id) ──────────────────────── */
export function SubtasksPanel({ taskId, projectId }: { taskId: string; projectId: string }) {
  const { t } = useTranslation(projectsT);
  const { fail, toastElement } = usePanelFeedback();
  const [items, setItems] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  /* Only this task's children — not the whole project board. */
  const load = useCallback(() => {
    fetchTasks({ project_id: projectId, parent_task_id: taskId, status: "all" })
      .then((rows) => { setItems(rows); setLoadError(false); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [projectId, taskId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await createTask({ project_id: projectId, title: title.trim(), parent_task_id: taskId });
      setTitle("");
      load();
    } catch (e) { fail("save", e); } finally { setBusy(false); }
  };
  const toggle = async (s: TaskRow) => {
    const next = s.status === "done" ? "open" : "done";
    setItems((p) => p.map((x) => (x.id === s.id ? { ...x, status: next } : x)));
    try {
      await updateTask(s.id, { status: next });
    } catch (e) {
      setItems((p) => p.map((x) => (x.id === s.id ? { ...x, status: s.status } : x)));
      fail("save", e);
    }
  };
  const remove = async (id: string) => {
    try { await deleteTask(id); load(); } catch (e) { fail("delete", e); }
  };

  const done = items.filter((x) => x.status === "done").length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  if (loading) return <PanelSpinner />;
  if (loadError) return <PanelError onRetry={load} />;
  return (
    <div className="space-y-3">
      {toastElement}
      {items.length > 0 && <MiniProgress done={done} total={items.length} pct={pct} />}
      <div className="space-y-1.5">
        {items.map((s) => (
          <div key={s.id} className={`group flex items-center gap-2 px-2.5 py-2 ${card}`}>
            <button
              type="button" onClick={() => toggle(s)}
              aria-label={s.status === "done" ? t("task.reopen") : t("task.markDone")} aria-pressed={s.status === "done"}
              className={`h-4 w-4 shrink-0 rounded-full border flex items-center justify-center ${s.status === "done" ? "bg-emerald-500 border-emerald-500 text-white" : "border-[var(--border-color)] text-transparent hover:border-emerald-400"}`}
            ><CheckIcon size={10} /></button>
            <span className={`flex-1 text-[12.5px] ${s.status === "done" ? "line-through text-[var(--text-dim)]" : "text-[var(--text-primary)]"}`}>{s.title}</span>
            <button type="button" onClick={() => remove(s.id)} aria-label={t("tip.delete")} className={`${revealCls} h-6 w-6 rounded text-[var(--text-dim)] hover:text-rose-400 flex items-center justify-center`}><TrashIcon className="h-3 w-3" /></button>
          </div>
        ))}
        {items.length === 0 && <Empty text={t("x.noSubtasks", "No subtasks yet.")} />}
      </div>
      <div className="flex items-center gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder={t("x.addSubtask", "Add a subtask…")} aria-label={t("x.addSubtask", "Add a subtask…")} className={`flex-1 ${inputCls}`} />
        <button type="button" onClick={add} disabled={busy || !title.trim()} aria-label={t("tip.addItem")} className={btnCls}>
          {busy ? <SpinnerIcon className="h-3 w-3" /> : <PlusIcon size={12} />}
        </button>
      </div>
    </div>
  );
}

/* ── Milestones (project detail) ────────────────────────────────────── */
export function MilestoneStrip({ projectId }: { projectId: string }) {
  const { t } = useTranslation(projectsT);
  const { fail, toastElement } = usePanelFeedback();
  const [items, setItems] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [due, setDue] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchMilestones(projectId)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await createMilestone(projectId, { name: name.trim(), due_date: due || null, sort_order: items.length });
      setName(""); setDue(""); setAdding(false);
      load();
    } catch (e) { fail("save", e); } finally { setBusy(false); }
  };
  const toggle = async (m: Milestone) => {
    setItems((p) => p.map((x) => (x.id === m.id ? { ...x, is_reached: !x.is_reached } : x)));
    try {
      await updateMilestone(projectId, m.id, { is_reached: !m.is_reached });
    } catch (e) {
      setItems((p) => p.map((x) => (x.id === m.id ? { ...x, is_reached: m.is_reached } : x)));
      fail("save", e);
    }
  };
  const remove = async (id: string) => {
    try { await deleteMilestone(projectId, id); load(); } catch (e) { fail("delete", e); }
  };

  if (loading) return null;
  return (
    <div className={`kx-glass p-3 ${card}`}>
      {toastElement}
      <div className="flex items-center gap-2 mb-2">
        <FlagIcon size={13} className="text-[var(--text-dim)]" />
        <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{t("x.milestones", "Milestones")}</h3>
        <button type="button" onClick={() => setAdding((v) => !v)} aria-label={t("x.addMilestone")} aria-expanded={adding} className="ms-auto h-6 w-6 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center"><PlusIcon size={13} /></button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((m) => (
          <div key={m.id} className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11.5px] ${m.is_reached ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-muted)]"}`}>
            <button type="button" onClick={() => toggle(m)} aria-label={t("tip.toggleDone")} aria-pressed={m.is_reached} className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center ${m.is_reached ? "bg-emerald-500 border-emerald-500 text-white" : "border-[var(--border-color)] text-transparent"}`}><CheckIcon size={9} /></button>
            <span className="font-semibold">{m.name}</span>
            {m.due_date && <span className="text-[10px] opacity-70 tabular-nums">{formatDMY(m.due_date)}</span>}
            <button type="button" onClick={() => remove(m.id)} aria-label={t("tip.delete")} className={`${revealCls} text-[var(--text-dim)] hover:text-rose-400 ms-0.5`}><TrashIcon className="h-2.5 w-2.5" /></button>
          </div>
        ))}
        {items.length === 0 && !adding && <span className="text-[11.5px] text-[var(--text-dim)]">{t("x.noMilestones", "No milestones yet.")}</span>}
      </div>
      {adding && (
        <div className="flex items-center gap-2 mt-2">
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder={t("x.milestoneName", "Milestone name")} aria-label={t("x.milestoneName", "Milestone name")} className={`flex-1 ${inputCls}`} />
          <input value={due} onChange={(e) => setDue(e.target.value)} type="date" aria-label={t("task.dueDate")} className={inputCls} />
          <button type="button" onClick={add} disabled={busy || !name.trim()} className={btnCls}>{busy ? t("btn.saving") : t("x.add", "Add")}</button>
        </div>
      )}
    </div>
  );
}

/* ── shared bits ────────────────────────────────────────────────────── */
function MiniProgress({ done, total, pct }: { done: number; total: number; pct: number }) {
  const { t } = useTranslation(projectsT);
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-[var(--text-dim)] mb-1">
        <span>{t("x.doneOf").replace("{done}", String(done)).replace("{total}", String(total))}</span><span>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
        <div className="h-full rounded-full bg-[#567FB2] transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
function PanelSpinner() {
  return <div className="flex items-center justify-center py-8"><SpinnerIcon className="h-4 w-4 text-[var(--text-dim)]" /></div>;
}
function PanelError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation(projectsT);
  return (
    <div className="text-center py-6 space-y-2">
      <div className="text-[12px] text-[var(--text-dim)]">{t("error.load")}</div>
      <button type="button" onClick={onRetry} className="h-8 px-3 rounded-lg border border-[var(--border-subtle)] text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]">{t("btn.retry")}</button>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="text-[12px] text-[var(--text-dim)] text-center py-5">{text}</div>;
}
