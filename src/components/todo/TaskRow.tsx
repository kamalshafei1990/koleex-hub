"use client";

/* ---------------------------------------------------------------------------
   TaskRow — one task in the list, and its detail panel when opened.

   Memoised: the list hands it a STABLE `actions` object and stable
   callbacks, so ticking one task re-renders that one row, not the list.

   Row = what you scan (tick, title, due, who, a few counts). Everything else
   — description, situation, checklist, attachments, notes, edit, delete —
   lives in the panel, so a busy row no longer wraps into five lines of chips
   on a phone.
   --------------------------------------------------------------------------- */

import { memo, useState } from "react";
import Link from "next/link";
import type { TodoMetadata, TodoWithRelations } from "@/types/supabase";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import AtSignIcon from "@/components/icons/ui/AtSignIcon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import CheckSquareIcon from "@/components/icons/ui/CheckSquareIcon";
import CircleIcon from "@/components/icons/ui/CircleIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import FileIcon from "@/components/icons/ui/FileIcon";
import FlagIcon from "@/components/icons/ui/FlagIcon";
import MessageSquareIcon from "@/components/icons/ui/MessageSquareIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import PaperclipIcon from "@/components/icons/ui/PaperclipIcon";
import PaperPlaneIcon from "@/components/icons/ui/PaperPlaneIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import RefreshCwIcon from "@/components/icons/ui/RefreshCwIcon";
import SquareIcon from "@/components/icons/ui/SquareIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import LockIcon from "@/components/icons/ui/LockIcon";
import UserCheckIcon from "@/components/icons/ui/UserCheckIcon";
import MiniAvatar from "./MiniAvatar";
import { dayKey, fmtDay, fmtDayTime, fmtDue, isOverdueDate } from "./todo-dates";
import { CHOICE, CHOICE_OFF, CHOICE_ON, PRIORITY_TEXT, STATUS_DOT, STATUSES, initials, type TFn } from "./todo-ui";
import { isTempTask, type TodoActions } from "./use-todo-store";
import { todoAttachmentHref as attachmentHref } from "@/lib/todo-admin";

export interface TaskRowProps {
  task: TodoWithRelations;
  t: TFn;
  lang: string;
  meId: string | null;
  /** Creator / assigner / super admin — may edit, delete, tick the checklist. */
  canManage: boolean;
  expanded: boolean;
  selectMode: boolean;
  selected: boolean;
  highlight: boolean;
  actions: TodoActions;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onReject: (id: string) => void;
}

const META = "inline-flex items-center gap-1 text-[10px] font-medium";
const BADGE = "inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded";
const ICON_BTN = "h-8 w-8 inline-flex items-center justify-center rounded-lg transition-colors text-[var(--text-dim)]";
const SUB = "text-[10px] font-semibold uppercase tracking-wide text-[var(--text-dim)]";

function metaOf(task: TodoWithRelations): TodoMetadata {
  return task.metadata && typeof task.metadata === "object" ? task.metadata : {};
}

function TaskRow({
  task, t, lang, meId, canManage, expanded, selectMode, selected, highlight,
  actions, onToggleExpand, onSelect, onEdit, onReject,
}: TaskRowProps) {
  const meta = metaOf(task);
  const checklist = Array.isArray(meta.checklist) ? meta.checklist : [];
  const checkDone = checklist.filter((c) => c.done).length;
  const atts = Array.isArray(meta.attachments) ? meta.attachments : [];
  const prods = Array.isArray(meta.products) ? meta.products : [];
  const mentions = Array.isArray(meta.mentions) ? meta.mentions : [];
  const observers = Array.isArray(meta.observers) ? meta.observers : [];
  const project = meta.project && typeof meta.project === "object" ? meta.project : null;
  const rejection = (meta as { rejection?: { reason?: string } }).rejection?.reason;

  const overdue = !task.completed && isOverdueDate(task.due_date);
  const pending = task.approval_state === "pending";
  const awaitsMe = pending && task.assigned_by_account_id === meId;
  const temp = isTempTask(task.id);
  const doneKey = dayKey(task.completed_at);
  const dueKey = dayKey(task.due_date);
  const late = task.completed && !!doneKey && !!dueKey && doneKey > dueKey;

  const toggleLabel = task.completed ? t("row.markUndone") : pending ? t("row.withdraw") : t("row.markDone");

  return (
    <div data-task-id={task.id}
      className={`[content-visibility:auto] [contain-intrinsic-size:auto_76px] transition-colors ${highlight ? "bg-[#567FB2]/10" : ""} ${temp ? "opacity-70" : ""}`}>
      <div className={`group flex items-start gap-2.5 px-3 md:px-4 py-3 ${selected ? "bg-[var(--bg-surface-active)]" : "hover:bg-[var(--bg-surface-subtle)]"}`}>
        {selectMode && (
          <button type="button" onClick={() => onSelect(task.id)} className="mt-0.5 shrink-0 h-6 w-6 inline-flex items-center justify-center"
            aria-pressed={selected} aria-label={t("row.selectTask")}>
            {selected ? <CheckSquareIcon size={19} className="text-[#7FA9D6]" /> : <SquareIcon size={19} className="text-[var(--text-ghost)]" />}
          </button>
        )}
        {/* Done / submit. An amber clock while a completion awaits the
            assigner, so the row never reads as untouched. */}
        <button type="button" onClick={() => void actions.toggle(task.id)} disabled={temp}
          aria-label={toggleLabel} title={toggleLabel}
          className="mt-0.5 shrink-0 h-6 w-6 inline-flex items-center justify-center rounded-full transition-transform hover:scale-110 disabled:hover:scale-100">
          {task.completed ? <CheckCircleIcon size={20} className="text-green-400" />
            : pending ? <ClockIcon size={20} className="text-amber-400" />
            : <CircleIcon size={20} className={task.priority === "high" ? "text-red-400/70" : "text-[var(--text-ghost)]"} />}
        </button>

        <div className="flex-1 min-w-0">
          {/* Title + description auto-translate to the reader's language (the
              original is one hover away); the whole block opens the panel. */}
          <button type="button" onClick={() => onToggleExpand(task.id)} aria-expanded={expanded}
            data-kx-keep-hover
            className="w-full text-start flex items-start gap-1.5 rounded-md">
            <span className={`flex-1 min-w-0 text-[13px] font-medium leading-snug break-words ${task.completed ? "line-through text-[var(--text-dim)]" : "text-[var(--text-primary)]"}`}>
              <AutoTranslatedText text={task.title} plain />
            </span>
            <AngleDownIcon size={13} className={`mt-0.5 shrink-0 text-[var(--text-dim)] transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
          {task.description && !expanded && (
            <AutoTranslatedText text={task.description} plain block className="text-[12px] text-[var(--text-dim)] mt-0.5 line-clamp-1" />
          )}

          {/* Scan line */}
          <div className="flex items-center gap-x-2 gap-y-1 mt-1.5 flex-wrap min-w-0">
            {/* Private: only its creator (and admins with private access)
                see it — plus the people it is assigned to. Said on the row
                so an assignee knows not to share it. */}
            {task.is_private && (
              <span className={`${BADGE} text-[var(--text-muted)] bg-[var(--bg-surface-active)]`}
                title={task.created_by_account_id === meId ? t("row.privateMine") : t("row.privateShared")}>
                <LockIcon size={9} /> {t("row.private")}
              </span>
            )}
            {task.priority !== "medium" && (
              <span className={`${META} font-semibold ${PRIORITY_TEXT[task.priority]}`}>
                <FlagIcon size={10} /> {t("p." + task.priority)}
              </span>
            )}
            {task.due_date && (
              <span className={`${META} ${overdue ? "text-red-400 font-semibold" : task.completed ? "text-[var(--text-dim)]" : "text-[var(--text-faint)]"}`}>
                {overdue ? <ExclamationIcon size={10} /> : <ClockIcon size={10} />}
                {fmtDue(task.due_date, t, lang)}
              </span>
            )}
            {(task.status === "in_progress" || task.status === "blocked") && !task.completed && (
              <span className={`${BADGE} ${task.status === "blocked" ? "text-red-400 bg-red-500/10" : "text-[#7FA9D6] bg-[#567FB2]/10"}`}>
                {t("st." + task.status)}
              </span>
            )}
            {pending && <span className={`${BADGE} text-amber-400 bg-amber-500/10`}>{t("approval.pending")}</span>}
            {task.series_cadence && (
              <span className={`${BADGE} text-[var(--text-muted)] bg-[var(--bg-surface-active)]`}>
                <RefreshCwIcon size={9} /> {t("rec." + task.series_cadence)}
                {task.series_period && <span className="font-medium text-[var(--text-faint)]">· {fmtDue(task.series_period, t, lang)}</span>}
              </span>
            )}
            {task.label && (
              <span className={`${BADGE} font-medium text-[var(--text-faint)] bg-[var(--bg-surface)]`}>
                <TagsIcon size={9} /> <AutoTranslatedText text={task.label} plain />
              </span>
            )}
            {project && (
              <span className={`${BADGE} font-medium text-[var(--text-faint)] bg-[var(--bg-surface)] max-w-[160px]`}>
                <BriefcaseIcon size={9} className="shrink-0" /> <span className="truncate">{project.name}</span>
              </span>
            )}
            {/* A task made from a report (Reports 6A) opens that report —
                the report page itself decides whether this reader may. */}
            {task.source === "report" && task.source_id ? (
              <Link href={`/reports/${task.source_id}`} onClick={(e) => e.stopPropagation()}
                className={`${BADGE} font-medium text-violet-300 bg-violet-500/10 hover:underline`}>
                {t("src.report")}
              </Link>
            ) : task.source !== "manual" && task.source !== "report" && (
              <span className={`${BADGE} font-medium text-violet-300 bg-violet-500/10`}>
                {task.source === "crm" ? t("src.crm") : t("src.calendar")}
              </span>
            )}
            {/* Only when a DIFFERENT person assigned it — delegated work reads
                apart from your own to-dos. */}
            {task.assigner && task.assigner.account_id !== meId && (
              <span className={`${BADGE} text-[var(--text-muted)] bg-[var(--bg-surface-active)] max-w-[200px]`}>
                <UserCheckIcon size={9} className="shrink-0" />
                <span className="truncate">{t("row.assignedBy")} {task.assigner.full_name || task.assigner.username}</span>
              </span>
            )}
            {checklist.length > 0 && (
              <span className={`${META} ${checkDone === checklist.length ? "text-green-400" : "text-[var(--text-faint)]"}`}>
                <CheckSquareIcon size={10} /> {checkDone}/{checklist.length}
              </span>
            )}
            {task.notes.length > 0 && (
              <span className={`${META} text-[var(--text-faint)]`} title={t("common.notes")}>
                <MessageSquareIcon size={10} /> {task.notes.length}
              </span>
            )}
            {atts.length > 0 && (
              <span className={`${META} text-[var(--text-faint)]`} title={t("extras.attachments")}>
                <PaperclipIcon size={10} /> {atts.length}
              </span>
            )}
            {prods.length > 0 && (
              <span className={`${META} text-[var(--text-faint)]`} title={t("extras.linkProducts")}>
                <PackageIcon size={10} /> {prods.length}
              </span>
            )}
            {task.completed && dueKey && doneKey && (
              <span className={`${BADGE} ${late ? "text-red-400 bg-red-500/10" : "text-green-400 bg-green-500/10"}`}>
                {late ? t("row.late") : t("row.onTime")}
              </span>
            )}
            {task.assignees.length > 0 && (
              <span className="inline-flex items-center ms-auto">
                <span className="flex -space-x-1.5">
                  {task.assignees.slice(0, 4).map((a) => <MiniAvatar key={a.account_id} info={a} size={20} ring />)}
                </span>
                {task.assignees.length > 4 && <span className="text-[10px] text-[var(--text-dim)] ms-1">+{task.assignees.length - 4}</span>}
              </span>
            )}
          </div>

          {/* Sent back for rework — the reason stays on the row until the
              assignee finishes and resubmits. */}
          {task.approval_state === "rejected" && !task.completed && (
            <div className="mt-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-300">
              <span className="font-bold">{t("approval.returned")}</span>
              {rejection
                ? <>: <AutoTranslatedText text={rejection} plain /></>
                : <span className="font-normal text-red-300/70"> — {t("approval.noReason")}</span>}
            </div>
          )}
        </div>

        {/* Waiting for MY sign-off: the decision is on the row itself, not
            hidden in the panel. */}
        {awaitsMe && !task.completed && (
          <div className="shrink-0 flex flex-col sm:flex-row items-stretch gap-1">
            <button type="button" onClick={() => void actions.approve(task.id)}
              className="h-7 px-2.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-[11px] font-semibold flex items-center justify-center gap-1 hover:bg-green-500/25 transition-colors">
              <CheckCircleIcon size={12} /> {t("approval.confirm")}
            </button>
            <button type="button" onClick={() => onReject(task.id)}
              className="h-7 px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[11px] font-semibold hover:bg-[var(--bg-surface-hover)] transition-colors">
              {t("approval.reopen")}
            </button>
          </div>
        )}

        {/* Quick edit / delete on desktop hover. On a phone they live in the
            panel — three icons beside every title left it no room. */}
        {canManage && !temp && (
          <div className="shrink-0 hidden md:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button type="button" onClick={() => onEdit(task.id)} aria-label={t("modal.edit")} title={t("modal.edit")}
              className={`${ICON_BTN} hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]`}>
              <PencilIcon size={14} />
            </button>
            <button type="button" onClick={() => actions.remove([task.id])} aria-label={t("modal.delete")} title={t("modal.delete")}
              className={`${ICON_BTN} hover:bg-red-500/10 hover:text-red-400`}>
              <TrashIcon size={14} />
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <TaskDetails task={task} t={t} lang={lang} meId={meId} canManage={canManage}
          actions={actions} onEdit={onEdit} checklist={checklist} atts={atts} prods={prods}
          mentions={mentions} observers={observers} awaitsMe={awaitsMe} />
      )}
    </div>
  );
}

export default memo(TaskRow);

/* ── Detail panel ─────────────────────────────────────────────────────── */
function TaskDetails({ task, t, lang, meId, canManage, actions, onEdit, checklist, atts, prods, mentions, observers, awaitsMe }: {
  task: TodoWithRelations;
  t: TFn;
  lang: string;
  meId: string | null;
  canManage: boolean;
  actions: TodoActions;
  onEdit: (id: string) => void;
  checklist: NonNullable<TodoMetadata["checklist"]>;
  atts: NonNullable<TodoMetadata["attachments"]>;
  prods: NonNullable<TodoMetadata["products"]>;
  mentions: NonNullable<TodoMetadata["mentions"]>;
  observers: NonNullable<TodoMetadata["observers"]>;
  awaitsMe: boolean;
}) {
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const temp = isTempTask(task.id);

  const send = async () => {
    const body = note.trim();
    if (!body || sending) return;
    setSending(true);
    const ok = await actions.addNote(task.id, body);
    setSending(false);
    if (ok) setNote("");
  };

  const fields = [
    task.start_date ? { k: "start", label: t("f.startDate"), value: fmtDay(task.start_date, lang, true) } : null,
    task.due_date ? { k: "due", label: t("f.dueDate"), value: fmtDay(task.due_date, lang, true) } : null,
    task.remind_at ? { k: "remind", label: t("f.reminder"), value: fmtDayTime(task.remind_at, lang) } : null,
    task.series_cadence ? { k: "rec", label: t("f.recurrence"), value: t("rec." + task.series_cadence) } : null,
    task.series_cadence && task.series_period ? { k: "run", label: t("f.occurrence"), value: fmtDue(task.series_period, t, lang) } : null,
    task.completed_at ? { k: "done", label: t("f.completedAt"), value: fmtDayTime(task.completed_at, lang) } : null,
  ].filter((f): f is { k: string; label: string; value: string } => f !== null);

  const chip = "inline-flex items-center gap-1 h-6 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10.5px] text-[var(--text-muted)] max-w-[180px]";

  return (
    <div className="px-3 md:px-4 pb-4 ps-11 md:ps-12 space-y-3">
      {task.approval_state === "pending" && !awaitsMe && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] font-semibold text-amber-400">
          {t("approval.submitted")}
        </div>
      )}

      {task.description && (
        <AutoTranslatedText text={task.description} block className="text-[12.5px] text-[var(--text-primary)] leading-relaxed" />
      )}

      {/* Situation — set straight from here. */}
      <div>
        <div className={`${SUB} mb-1.5`}>{t("f.status")}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5" role="group" aria-label={t("f.status")}>
          {STATUSES.map((s) => (
            <button key={s} type="button" disabled={temp} aria-pressed={task.status === s}
              onClick={() => void actions.setStatus(task.id, s)}
              className={`h-8 ${CHOICE} ${task.status === s ? CHOICE_ON : CHOICE_OFF}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s]}`} /> {t("st." + s)}
            </button>
          ))}
        </div>
      </div>

      {fields.length > 0 && (
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
          {fields.map((f) => (
            <div key={f.k} className="min-w-0">
              <dt className={SUB}>{f.label}</dt>
              <dd className="text-[12px] text-[var(--text-primary)] mt-0.5">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {checklist.length > 0 && (
        <div>
          <div className={`${SUB} mb-1.5`}>{t("checklist.title")} · {checklist.filter((c) => c.done).length}/{checklist.length}</div>
          <ul className="space-y-0.5">
            {checklist.map((c) => (
              <li key={c.id}>
                <button type="button" disabled={!canManage || temp} aria-pressed={c.done}
                  onClick={() => void actions.toggleChecklistItem(task.id, c.id)}
                  className="w-full flex items-center gap-2 text-[12px] text-start rounded-md px-1 py-1 enabled:hover:bg-[var(--bg-surface-subtle)] disabled:cursor-default">
                  {c.done ? <CheckSquareIcon size={14} className="text-green-400 shrink-0" /> : <SquareIcon size={14} className="text-[var(--text-dim)] shrink-0" />}
                  <span className={c.done ? "line-through text-[var(--text-dim)]" : "text-[var(--text-primary)]"}>
                    <AutoTranslatedText text={c.text} plain />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {task.assignees.length > 0 && (
        <div>
          <div className={`${SUB} mb-1.5`}>{t("f.assignTo")}</div>
          <div className="flex flex-wrap gap-1.5">
            {task.assignees.map((a) => (
              <span key={a.account_id} className="inline-flex items-center gap-1.5 h-7 ps-1 pe-2.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] max-w-[200px]">
                <MiniAvatar info={a} size={20} />
                <span className="truncate">{a.full_name || a.username}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {(atts.length > 0 || prods.length > 0 || mentions.length > 0 || observers.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {atts.map((a) =>
            a.type?.startsWith("image/") ? (
              <a key={a.path} href={attachmentHref(a.path)} target="_blank" rel="noreferrer" title={a.name}
                className="block h-12 w-12 rounded-md overflow-hidden border border-[var(--border-subtle)] shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={attachmentHref(a.path)} alt={a.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </a>
            ) : (
              <a key={a.path} href={attachmentHref(a.path)} target="_blank" rel="noreferrer" className={`${chip} hover:text-[var(--text-primary)]`}>
                <FileIcon className="h-3 w-3 shrink-0" /> <span className="truncate">{a.name}</span>
              </a>
            ),
          )}
          {prods.map((p) => (
            <span key={p.id} className={chip}><PackageIcon className="h-3 w-3 shrink-0 text-[var(--text-dim)]" /><span className="truncate">{p.code || p.name}</span></span>
          ))}
          {mentions.map((m) => (
            <span key={m.account_id} className={chip}><AtSignIcon className="h-3 w-3 shrink-0 text-[var(--text-dim)]" /><span className="truncate">{m.full_name || m.username}</span></span>
          ))}
          {observers.map((o) => (
            <span key={o.account_id} className={chip} title={t("extras.observers")}><EyeIcon className="h-3 w-3 shrink-0 text-[var(--text-dim)]" /><span className="truncate">{o.full_name || o.username}</span></span>
          ))}
        </div>
      )}

      {/* Notes */}
      <div>
        <div className={`${SUB} mb-1.5`}>{t("common.notes")}{task.notes.length > 0 && ` · ${task.notes.length}`}</div>
        <div className="space-y-2">
          {task.notes.map((n) => (
            <div key={n.id} className="flex items-start gap-2 text-[12px]">
              <span aria-hidden className="w-5 h-5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[8px] font-bold text-[var(--text-dim)] shrink-0 mt-0.5">
                {initials(n.author_full_name, n.author_username)}
              </span>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-[var(--text-muted)]">{n.author_full_name || n.author_username}</span>
                <span className="text-[var(--text-dim)] ms-2 text-[11px]">{fmtDayTime(n.created_at, lang)}</span>
                <AutoTranslatedText text={n.body} block className="text-[var(--text-primary)] mt-0.5 break-words" />
              </div>
              {n.author_account_id === meId && (
                <button type="button" onClick={() => void actions.deleteNote(task.id, n.id)} aria-label={t("notes.delete")}
                  className="h-6 w-6 inline-flex items-center justify-center rounded-md text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10 shrink-0">
                  <CrossIcon size={10} />
                </button>
              )}
            </div>
          ))}
        </div>
        {!temp && (
          <form className="flex items-center gap-2 mt-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={t("notes.placeholder")} aria-label={t("notes.placeholder")}
              className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors" />
            <button type="submit" disabled={!note.trim() || sending} aria-label={t("notes.send")}
              className="h-9 w-9 shrink-0 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-30">
              <PaperPlaneIcon size={13} className="rtl:-scale-x-100" />
            </button>
          </form>
        )}
      </div>

      {canManage && !temp && (
        <div className="flex items-center gap-2 pt-1">
          <button type="button" onClick={() => onEdit(task.id)}
            className="h-8 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1.5 transition-colors">
            <PencilIcon size={12} /> {t("modal.edit")}
          </button>
          <button type="button" onClick={() => actions.remove([task.id])}
            className="h-8 px-3 rounded-lg border border-red-500/25 bg-red-500/5 text-[12px] font-medium text-red-400 hover:bg-red-500/15 flex items-center gap-1.5 transition-colors">
            <TrashIcon size={12} /> {t("modal.delete")}
          </button>
        </div>
      )}
    </div>
  );
}
