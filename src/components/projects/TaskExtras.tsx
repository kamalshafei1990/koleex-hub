"use client";

/* ---------------------------------------------------------------------------
   TaskExtras — the collaboration/data panels shown inside a task's workspace
   (Checklist · Comments · Time · Files) plus the project Milestone strip.
   Each panel is self-contained: it fetches on mount and re-fetches after its
   own mutations. Wired to the Phase 2 /api/projects/* routes.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
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
  type ChecklistItem, type TaskComment, type TimeEntry, type TaskAttachment, type Milestone, type TaskRow,
} from "@/lib/projects";

const card = "rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]";
const inputCls = "h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";
const btnCls = "h-9 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90 shrink-0 disabled:opacity-40";

function relTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en", { month: "short", day: "numeric" }) + " " +
    d.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
}

/* ── Checklist ──────────────────────────────────────────────────────── */
export function ChecklistPanel({ taskId }: { taskId: string }) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");

  const load = useCallback(() => {
    fetchChecklist(taskId).then((x) => { setItems(x); setLoading(false); });
  }, [taskId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!title.trim()) return;
    await createChecklistItem(taskId, title.trim());
    setTitle("");
    load();
  };
  const toggle = async (it: ChecklistItem) => {
    setItems((p) => p.map((x) => (x.id === it.id ? { ...x, is_done: !x.is_done } : x)));
    await updateChecklistItem(taskId, it.id, { is_done: !it.is_done });
  };
  const remove = async (id: string) => { await deleteChecklistItem(taskId, id); load(); };

  const done = items.filter((x) => x.is_done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  if (loading) return <PanelSpinner />;
  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div>
          <div className="flex items-center justify-between text-[11px] text-[var(--text-dim)] mb-1">
            <span>{done} / {items.length} done</span><span>{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        {items.map((it) => (
          <div key={it.id} className={`group flex items-center gap-2 px-2.5 py-2 ${card}`}>
            <button
              type="button" onClick={() => toggle(it)}
              className={`h-4 w-4 shrink-0 rounded-full border flex items-center justify-center ${it.is_done ? "bg-emerald-500 border-emerald-500 text-white" : "border-[var(--border-color)] text-transparent hover:border-emerald-400"}`}
            ><CheckIcon size={10} /></button>
            <span className={`flex-1 text-[12.5px] ${it.is_done ? "line-through text-[var(--text-dim)]" : "text-[var(--text-primary)]"}`}>{it.title}</span>
            <button type="button" onClick={() => remove(it.id)} className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded text-[var(--text-dim)] hover:text-rose-400 flex items-center justify-center"><TrashIcon className="h-3 w-3" /></button>
          </div>
        ))}
        {items.length === 0 && <Empty text="No checklist items yet." />}
      </div>
      <div className="flex items-center gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="Add an item…" className={`flex-1 ${inputCls}`} />
        <button type="button" onClick={add} className={btnCls}><PlusIcon size={12} /></button>
      </div>
    </div>
  );
}

/* ── Comments ───────────────────────────────────────────────────────── */
export function CommentsPanel({ taskId }: { taskId: string }) {
  const [items, setItems] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");

  const load = useCallback(() => {
    fetchComments(taskId).then((x) => { setItems(x); setLoading(false); });
  }, [taskId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!body.trim()) return;
    await createComment(taskId, body.trim());
    setBody("");
    load();
  };

  if (loading) return <PanelSpinner />;
  return (
    <div className="space-y-3">
      <div className="space-y-2 max-h-[280px] overflow-y-auto">
        {items.map((c) => (
          <div key={c.id} className={`group px-3 py-2 ${card}`}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] font-semibold text-[var(--text-muted)]">{c.author?.username ?? "—"}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--text-ghost)]">{relTime(c.created_at)}</span>
                <button type="button" onClick={async () => { await deleteComment(taskId, c.id); load(); }} className="opacity-0 group-hover:opacity-100 text-[var(--text-dim)] hover:text-rose-400"><TrashIcon className="h-3 w-3" /></button>
              </div>
            </div>
            <div className="text-[12.5px] text-[var(--text-primary)] whitespace-pre-wrap break-words">{c.body}</div>
          </div>
        ))}
        {items.length === 0 && <Empty text="No comments yet." />}
      </div>
      <div className="flex items-end gap-2">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Write a comment…" className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] resize-none" />
        <button type="button" onClick={add} disabled={!body.trim()} className={btnCls}>Post</button>
      </div>
    </div>
  );
}

/* ── Time tracking ──────────────────────────────────────────────────── */
export function TimePanel({ taskId }: { taskId: string }) {
  const [items, setItems] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    fetchTimeEntries(taskId).then((x) => { setItems(x); setLoading(false); });
  }, [taskId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const h = Number(hours);
    if (!h || h <= 0) return;
    await createTimeEntry(taskId, { minutes: Math.round(h * 60), note: note.trim() || undefined });
    setHours(""); setNote("");
    load();
  };

  const totalMin = items.reduce((s, e) => s + e.minutes, 0);
  if (loading) return <PanelSpinner />;
  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 px-3 py-2 ${card}`}>
        <ClockIcon size={14} className="text-[var(--text-dim)]" />
        <span className="text-[12px] text-[var(--text-muted)]">Total logged</span>
        <span className="ml-auto text-[14px] font-bold tabular-nums">{(totalMin / 60).toFixed(2)}h</span>
      </div>
      <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
        {items.map((e) => (
          <div key={e.id} className={`group flex items-center gap-2 px-2.5 py-2 ${card}`}>
            <span className="text-[12px] font-semibold tabular-nums w-14">{(e.minutes / 60).toFixed(2)}h</span>
            <span className="text-[11px] text-[var(--text-dim)] w-20 shrink-0">{e.entry_date}</span>
            <span className="flex-1 text-[11.5px] text-[var(--text-muted)] truncate">{e.note ?? ""}</span>
            <span className="text-[10px] text-[var(--text-ghost)]">{e.account?.username ?? ""}</span>
            <button type="button" onClick={async () => { await deleteTimeEntry(taskId, e.id); load(); }} className="opacity-0 group-hover:opacity-100 text-[var(--text-dim)] hover:text-rose-400"><TrashIcon className="h-3 w-3" /></button>
          </div>
        ))}
        {items.length === 0 && <Empty text="No time logged yet." />}
      </div>
      <div className="flex items-center gap-2">
        <input value={hours} onChange={(e) => setHours(e.target.value)} type="number" step="0.25" min="0" placeholder="Hours" className={`w-24 ${inputCls}`} />
        <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="Note (optional)" className={`flex-1 ${inputCls}`} />
        <button type="button" onClick={add} className={btnCls}>Log</button>
      </div>
    </div>
  );
}

/* ── Attachments ────────────────────────────────────────────────────── */
export function AttachmentsPanel({ taskId }: { taskId: string }) {
  const [items, setItems] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetchAttachments(taskId).then((x) => { setItems(x); setLoading(false); });
  }, [taskId]);
  useEffect(() => { load(); }, [load]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    await uploadAttachment(taskId, file);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  const fmtSize = (n: number | null) => (n == null ? "" : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  if (loading) return <PanelSpinner />;
  return (
    <div className="space-y-3">
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
            <button type="button" onClick={async () => { await deleteAttachment(taskId, a.id); load(); }} className="opacity-0 group-hover:opacity-100 text-[var(--text-dim)] hover:text-rose-400"><TrashIcon className="h-3 w-3" /></button>
          </div>
        ))}
        {items.length === 0 && <Empty text="No files attached." />}
      </div>
      <input ref={fileRef} type="file" onChange={onPick} className="hidden" />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="w-full h-9 rounded-lg border border-dashed border-[var(--border-subtle)] text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] flex items-center justify-center gap-1.5 disabled:opacity-50">
        {busy ? <SpinnerIcon className="h-3.5 w-3.5 animate-spin" /> : <UploadIcon size={13} />}
        {busy ? "Uploading…" : "Upload file (max 25 MB)"}
      </button>
    </div>
  );
}

/* ── Subtasks (child tasks via parent_task_id) ──────────────────────── */
export function SubtasksPanel({ taskId, projectId }: { taskId: string; projectId: string }) {
  const [items, setItems] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");

  const load = useCallback(() => {
    fetchTasks({ project_id: projectId, status: "all" }).then((all) => {
      setItems(all.filter((t) => t.parent_task_id === taskId));
      setLoading(false);
    });
  }, [projectId, taskId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!title.trim()) return;
    await createTask({ project_id: projectId, title: title.trim(), parent_task_id: taskId });
    setTitle("");
    load();
  };
  const toggle = async (s: TaskRow) => {
    const next = s.status === "done" ? "open" : "done";
    setItems((p) => p.map((x) => (x.id === s.id ? { ...x, status: next } : x)));
    await updateTask(s.id, { status: next });
  };
  const remove = async (id: string) => { await deleteTask(id); load(); };

  const done = items.filter((x) => x.status === "done").length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  if (loading) return <PanelSpinner />;
  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div>
          <div className="flex items-center justify-between text-[11px] text-[var(--text-dim)] mb-1">
            <span>{done} / {items.length} done</span><span>{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        {items.map((s) => (
          <div key={s.id} className={`group flex items-center gap-2 px-2.5 py-2 ${card}`}>
            <button
              type="button" onClick={() => toggle(s)}
              className={`h-4 w-4 shrink-0 rounded-full border flex items-center justify-center ${s.status === "done" ? "bg-emerald-500 border-emerald-500 text-white" : "border-[var(--border-color)] text-transparent hover:border-emerald-400"}`}
            ><CheckIcon size={10} /></button>
            <span className={`flex-1 text-[12.5px] ${s.status === "done" ? "line-through text-[var(--text-dim)]" : "text-[var(--text-primary)]"}`}>{s.title}</span>
            <button type="button" onClick={() => remove(s.id)} className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded text-[var(--text-dim)] hover:text-rose-400 flex items-center justify-center"><TrashIcon className="h-3 w-3" /></button>
          </div>
        ))}
        {items.length === 0 && <Empty text="No subtasks yet." />}
      </div>
      <div className="flex items-center gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="Add a subtask…" className={`flex-1 ${inputCls}`} />
        <button type="button" onClick={add} className={btnCls}><PlusIcon size={12} /></button>
      </div>
    </div>
  );
}

/* ── Milestones (project detail) ────────────────────────────────────── */
export function MilestoneStrip({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [due, setDue] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    fetchMilestones(projectId).then((x) => { setItems(x); setLoading(false); });
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!name.trim()) return;
    await createMilestone(projectId, { name: name.trim(), due_date: due || null, sort_order: items.length });
    setName(""); setDue(""); setAdding(false);
    load();
  };
  const toggle = async (m: Milestone) => {
    setItems((p) => p.map((x) => (x.id === m.id ? { ...x, is_reached: !x.is_reached } : x)));
    await updateMilestone(projectId, m.id, { is_reached: !m.is_reached });
  };

  if (loading) return null;
  return (
    <div className={`p-3 ${card}`}>
      <div className="flex items-center gap-2 mb-2">
        <FlagIcon size={13} className="text-[var(--text-dim)]" />
        <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-dim)]">Milestones</h3>
        <button type="button" onClick={() => setAdding((v) => !v)} className="ml-auto h-6 w-6 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center"><PlusIcon size={13} /></button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((m) => (
          <div key={m.id} className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11.5px] ${m.is_reached ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-muted)]"}`}>
            <button type="button" onClick={() => toggle(m)} className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center ${m.is_reached ? "bg-emerald-500 border-emerald-500 text-white" : "border-[var(--border-color)] text-transparent"}`}><CheckIcon size={9} /></button>
            <span className="font-semibold">{m.name}</span>
            {m.due_date && <span className="text-[10px] opacity-70">{m.due_date}</span>}
            <button type="button" onClick={async () => { await deleteMilestone(projectId, m.id); load(); }} className="opacity-0 group-hover:opacity-100 text-[var(--text-dim)] hover:text-rose-400 ml-0.5"><TrashIcon className="h-2.5 w-2.5" /></button>
          </div>
        ))}
        {items.length === 0 && !adding && <span className="text-[11.5px] text-[var(--text-dim)]">No milestones yet.</span>}
      </div>
      {adding && (
        <div className="flex items-center gap-2 mt-2">
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="Milestone name" className={`flex-1 ${inputCls}`} />
          <input value={due} onChange={(e) => setDue(e.target.value)} type="date" className={inputCls} />
          <button type="button" onClick={add} className={btnCls}>Add</button>
        </div>
      )}
    </div>
  );
}

/* ── shared bits ────────────────────────────────────────────────────── */
function PanelSpinner() {
  return <div className="flex items-center justify-center py-8"><SpinnerIcon className="h-4 w-4 text-[var(--text-dim)] animate-spin" /></div>;
}
function Empty({ text }: { text: string }) {
  return <div className="text-[12px] text-[var(--text-dim)] text-center py-5">{text}</div>;
}
