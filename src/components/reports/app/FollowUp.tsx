"use client";

/* ---------------------------------------------------------------------------
   Reports — a report becomes work (Phase 6A): the two dialogs the reader
   opens, Forward and Make a task. Their own chunk — the reader asks for it
   when one opens, so the report page itself stays as light as it was.

   Both are the house light dialog (kds Modal, MD-4) PORTALLED to <body>:
   the reader's cards are glass, and glass traps a fixed child (Aurora
   canon H-5). The server holds every rule (lib/reports/follow-up); the
   dialogs only offer what it allows — the people the page was given, and
   for a confidential report that a non-author reads, only its readers.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Modal from "@/components/kds/Modal";
import Button from "@/components/kds/Button";
import DatePicker from "@/components/ui/DatePicker";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import RrIcon from "@/components/ui/RrIcon";
import { forwardReport, makeReportTask, type ReportDetail, type ReportPerson } from "@/lib/work-reports";
import { FOLLOW_UP_LIMITS, TASK_PRIORITIES, type TaskPriority } from "@/lib/reports/follow-up";
import { TODO_WRITE_VERSION_KEY } from "@/lib/todo-list-url";
import PeopleField from "./PeopleField";
import { FIELD, type T } from "./shared";

const SEL = "kx-seg-on border-[#567FB2]/50 bg-[#567FB2]/12 text-[var(--text-primary)]";
const OFF = "kx-seg-off border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]";

/** A new To-do task busts the To-do list's HTTP cache and the badges, as
 *  every To-do write does (lib/todo-admin's announceTodoChange — that module
 *  carries the whole supabase client, so the three steps are repeated here). */
async function announceTodoWrite(): Promise<void> {
  try {
    const n = Number(window.localStorage.getItem(TODO_WRITE_VERSION_KEY) ?? "0") + 1;
    window.localStorage.setItem(TODO_WRITE_VERSION_KEY, String(n));
  } catch { /* private mode */ }
  try {
    const { invalidateCachedGet } = await import("@/lib/client-cache");
    invalidateCachedGet("/api/todos");
    invalidateCachedGet("/api/inbox/feed");
  } catch { /* the event below still refreshes the badges */ }
  window.dispatchEvent(new CustomEvent("inbox:force-recount"));
}

function Dialog({ title, onClose, actions, children }: { title: string; onClose: () => void; actions: React.ReactNode; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <Modal open onClose={onClose} title={title} actions={actions} maxWidth="max-w-lg">{children}</Modal>,
    document.body,
  );
}

const errorWord = (t: T, error: string) =>
  error === "nobody" ? t("err.nobody")
    : error === "too_many_readers" ? t("err.tooManyReaders")
      : error === "people_not_allowed" ? t("err.peopleNotAllowed")
        : error === "forbidden" ? t("err.forbidden")
          : t("err.generic");

/* ── Forward ──────────────────────────────────────────────────────────── */

export function ForwardDialog({ t, detail, onClose, onDone }: { t: T; detail: ReportDetail; onClose: () => void; onDone: () => Promise<void> }) {
  const { report, recipients } = detail;
  const [ids, setIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /* Nobody who can already read it as a recipient, never its author, not
     the one forwarding it. */
  const people = useMemo(() => {
    const on = new Set([report.author.id, ...recipients.map((r) => r.id), ...(detail.viewerId ? [detail.viewerId] : [])]);
    return (detail.people ?? []).filter((p) => !on.has(p.id));
  }, [detail.people, detail.viewerId, recipients, report.author.id]);
  const nameOf = useMemo(() => new Map((detail.people ?? []).map((p) => [p.id, p])), [detail.people]);

  const send = async () => {
    setBusy(true); setProblem(null);
    const res = await forwardReport(report.id, { people: ids, note: note.trim() || undefined });
    setBusy(false);
    if (!res.ok) { setProblem(errorWord(t, res.error)); return; }
    await onDone();
    onClose();
  };

  return (
    <Dialog title={t("forward.title")} onClose={onClose} actions={<>
      <Button type="button" onClick={() => void send()} disabled={!ids.length || busy}>{busy ? <SpinnerIcon size={14} /> : <RrIcon name="share" size={13} />}{t("forward.send")}</Button>
      <Button type="button" variant="ghost" onClick={onClose}>{t("composer.cancel")}</Button>
    </>}>
      {report.confidential && <p className="rounded-lg bg-[var(--bg-surface-subtle)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">{t("forward.confidential")}</p>}
      <PeopleField t={t} label={t("forward.people")} ids={ids} people={people} nameOf={nameOf} onChange={setIds} max={FOLLOW_UP_LIMITS.forwardPeople} />
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-semibold text-[var(--text-secondary)]">{t("forward.note")}</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={FOLLOW_UP_LIMITS.note}
          placeholder={t("forward.notePlaceholder")} className={`${FIELD} resize-y`} />
      </label>
      <p className="text-[11.5px] leading-snug text-[var(--text-dim)]">{t("forward.hint")}</p>
      {problem && <p role="alert" className="text-[12.5px] text-red-500">{problem}</p>}
    </Dialog>
  );
}

/* ── Make a task ──────────────────────────────────────────────────────── */

export interface TaskLine { section: string; item: number; text: string }

export function TaskDialog({ t, lang, detail, line, onClose, onDone }: {
  t: T; lang: string; detail: ReportDetail;
  /** The line it is made from — none for a task written from scratch. */
  line: TaskLine | null;
  onClose: () => void; onDone: () => Promise<void>;
}) {
  const { report, recipients } = detail;
  const isAuthor = detail.access === "author";
  const readers = useMemo(() => new Set([report.author.id, ...recipients.map((r) => r.id)]), [report.author.id, recipients]);
  /* From a confidential report someone else wrote, only its readers. */
  const limited = report.confidential && !isAuthor;
  const people = useMemo(() => (detail.people ?? []).filter((p) => !limited || readers.has(p.id)), [detail.people, limited, readers]);
  const nameOf = useMemo(() => new Map((detail.people ?? []).map((p) => [p.id, p] as [string, ReportPerson])), [detail.people]);
  /* For its author by default — the one who wrote the line (yourself, on
     your own report). */
  const [ids, setIds] = useState<string[]>(() => (people.some((p) => p.id === report.author.id) ? [report.author.id] : []));
  const [title, setTitle] = useState(line?.text.slice(0, FOLLOW_UP_LIMITS.taskTitle) ?? "");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [share, setShare] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /* Sharing is a forward: offered where a forward is allowed, and only when
     someone picked is not already on the report (the server skips anyone
     who can read it by another road too). */
  const canShare = !!detail.can.forward && ids.some((id) => !readers.has(id));

  const create = async () => {
    setBusy(true); setProblem(null);
    const res = await makeReportTask(report.id, {
      title: title.trim(), people: ids, due: due || null, priority,
      line: line ? { section: line.section, item: line.item } : null,
      share: canShare && share,
    });
    setBusy(false);
    if (!res.ok) { setProblem(errorWord(t, res.error)); return; }
    await announceTodoWrite();
    await onDone();
    onClose();
  };

  return (
    <Dialog title={t("task.title")} onClose={onClose} actions={<>
      <Button type="button" onClick={() => void create()} disabled={!title.trim() || !ids.length || busy}>{busy ? <SpinnerIcon size={14} /> : <RrIcon name="list-check" size={13} />}{t("task.create")}</Button>
      <Button type="button" variant="ghost" onClick={onClose}>{t("composer.cancel")}</Button>
    </>}>
      {limited && <p className="rounded-lg bg-[var(--bg-surface-subtle)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">{t("task.confidential")}</p>}
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-semibold text-[var(--text-secondary)]">{t("task.what")}</span>
        <textarea value={title} onChange={(e) => setTitle(e.target.value)} rows={2} maxLength={FOLLOW_UP_LIMITS.taskTitle} autoFocus={!line} className={`${FIELD} resize-y`} />
      </label>
      <PeopleField t={t} label={t("task.for")} ids={ids} people={people} nameOf={nameOf} onChange={setIds} max={FOLLOW_UP_LIMITS.taskPeople} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">{t("task.due")}</p>
          <div className="flex items-center gap-1.5">
            <DatePicker id="kx-rep-task-due" value={due} onChange={(iso) => setDue(iso)} lang={lang} heightCls="h-10" className="min-w-0 flex-1" />
            {due && (
              <button type="button" onClick={() => setDue("")} aria-label={`${t("task.due")} ×`} className="grid h-10 w-9 shrink-0 place-items-center rounded-xl border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]">
                <RrIcon name="cross" size={10} />
              </button>
            )}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">{t("task.priority")}</p>
          <div className="flex gap-1.5" role="group" aria-label={t("task.priority")}>
            {TASK_PRIORITIES.map((p) => (
              <button key={p} type="button" aria-pressed={priority === p} onClick={() => setPriority(p)}
                className={`h-10 flex-1 rounded-xl border px-2 text-[12.5px] font-medium transition-colors ${priority === p ? SEL : OFF}`}>
                {t(`task.p.${p}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
      {canShare && (
        <label className="flex items-start gap-2.5 text-[12.5px] text-[var(--text-primary)]">
          <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#567FB2]" />
          <span>{t("task.share")}<span className="block text-[11.5px] text-[var(--text-dim)]">{t("task.shareHint")}</span></span>
        </label>
      )}
      {problem && <p role="alert" className="text-[12.5px] text-red-500">{problem}</p>}
    </Dialog>
  );
}
