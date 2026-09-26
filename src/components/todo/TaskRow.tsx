"use client";

/* ---------------------------------------------------------------------------
   TaskRow — one task in the list.

   THE ORIGINAL ROW (owner, 2026-09: "return the old shape as UI design but
   with the same performance and codes as now"), made to answer the four
   questions an employee has at a glance (owner: "if I got a notification of
   this task I don't know clearly what I should do"):
     · WHAT   — the title and two lines of the description
     · WHO    — the people's NAMES (not only faces) and who assigned it, when
     · WHEN   — "Due in 2 days · 28/09 15:00" / "3 days overdue"
     · NEXT   — the checklist's progress and its next open item
   Status and priority are words on tinted badges, never a colour alone.
   Opening the task (title, or the open button) shows the full detail sheet;
   the inline panel it replaced lives on as TaskSheet.

   Memoised with stable handlers: ticking one task re-renders one row.
   --------------------------------------------------------------------------- */

import { memo, type MouseEvent } from "react";
import Link from "next/link";
import type { TodoMetadata, TodoWithRelations } from "@/types/supabase";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import AtSignIcon from "@/components/icons/ui/AtSignIcon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import CheckSquareIcon from "@/components/icons/ui/CheckSquareIcon";
import CircleIcon from "@/components/icons/ui/CircleIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import FlagIcon from "@/components/icons/ui/FlagIcon";
import LockIcon from "@/components/icons/ui/LockIcon";
import MessageSquareIcon from "@/components/icons/ui/MessageSquareIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import PaperclipIcon from "@/components/icons/ui/PaperclipIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import RefreshCwIcon from "@/components/icons/ui/RefreshCwIcon";
import SquareIcon from "@/components/icons/ui/SquareIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import UserCheckIcon from "@/components/icons/ui/UserCheckIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import MiniAvatar from "./MiniAvatar";
import { dayKey, dueInfo, fmtAgo, fmtDue } from "./todo-dates";
import { PRIORITY_BADGE, STATUS_DOT, STATUS_PILL, metaOf, namesLine, nameOf, statusOf, type TFn } from "./todo-ui";
import { isTempTask, type TodoActions } from "./use-todo-store";

export interface TaskRowProps {
  task: TodoWithRelations;
  t: TFn;
  lang: string;
  meId: string | null;
  /** Creator / assigner / super admin (creator only on a private task) —
   *  may edit, delete, tick the checklist. */
  canManage: boolean;
  selectMode: boolean;
  selected: boolean;
  highlight: boolean;
  actions: TodoActions;
  onOpen: (id: string) => void;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onReject: (id: string) => void;
}

const BADGE = "inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded";
const DUE_TONE = {
  overdue: "text-red-400 bg-red-500/10",
  today: "text-amber-300 bg-amber-500/10",
  soon: "text-[#7FA9D6] bg-[#567FB2]/10",
  later: "text-[var(--text-muted)] bg-[var(--bg-surface)]",
} as const;

function TaskRow({
  task, t, lang, meId, canManage, selectMode, selected, highlight,
  actions, onOpen, onSelect, onEdit, onReject,
}: TaskRowProps) {
  const meta = metaOf(task);
  const checklist = Array.isArray(meta.checklist) ? meta.checklist : [];
  const checkDone = checklist.filter((c) => c.done).length;
  const nextItem = checklist.find((c) => !c.done);
  const attachments = Array.isArray(meta.attachments) ? meta.attachments.length : 0;
  const rejection = (meta as { rejection?: { reason?: string } }).rejection?.reason;

  const status = statusOf(task);
  const due = task.completed ? null : dueInfo(task.due_date, t);
  const pending = task.approval_state === "pending";
  const awaitsMe = pending && task.assigned_by_account_id === meId;
  const temp = isTempTask(task.id);
  const doneKey = dayKey(task.completed_at);
  const dueKey = dayKey(task.due_date);
  const late = task.completed && !!doneKey && !!dueKey && doneKey > dueKey;
  const byOther = task.assigner && task.assigner.account_id !== meId ? task.assigner : null;
  const people = task.assign_to_all ? t("assign.everyone") : task.assignees.length ? namesLine(task.assignees, meId, t) : "";

  const toggleLabel = task.completed ? t("row.markUndone") : pending ? t("row.withdraw") : t("row.markDone");

  // The whole card opens the task (or toggles it in select mode). Clicks on
  // the card's own controls and links keep their job, and a drag that
  // selects text never counts as a click.
  const onRowClick = (e: MouseEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    if (el.closest("button, a, input, textarea, select, label, [role=button]")) return;
    if (window.getSelection()?.toString()) return;
    if (selectMode) onSelect(task.id); else onOpen(task.id);
  };

  return (
    <div data-task-id={task.id} onClick={onRowClick}
      className={`[content-visibility:auto] [contain-intrinsic-size:auto_112px] transition-all ${task.completed ? "opacity-50" : ""} ${highlight ? "bg-[#567FB2]/10" : ""} ${temp ? "opacity-70" : ""}`}>
      <div className={`group flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-all ${selected ? "bg-[var(--bg-surface-active)]" : "hover:bg-[var(--bg-surface-subtle)]"}`}>
        {selectMode && (
          <button type="button" onClick={() => onSelect(task.id)} className="mt-0.5 shrink-0"
            aria-pressed={selected} aria-label={t("row.selectTask")}>
            {selected ? <CheckSquareIcon size={20} className="text-[#7FA9D6]" /> : <SquareIcon size={20} className="text-[var(--text-ghost)]" />}
          </button>
        )}
        {/* Done checkbox — amber clock while a completion is awaiting the
            assigner's approval, so the row never reads as "untouched". */}
        <button type="button" onClick={() => void actions.toggle(task.id)} disabled={temp}
          aria-label={toggleLabel} title={toggleLabel}
          className="mt-0.5 shrink-0 transition-transform hover:scale-110 disabled:hover:scale-100">
          {task.completed ? <CheckCircleIcon size={20} className="text-green-400" />
            : pending ? <ClockIcon size={20} className="text-amber-400" />
            : <CircleIcon size={20} className="text-[var(--text-ghost)]" />}
        </button>

        <div className="flex-1 min-w-0">
          {/* WHAT — the title opens the task; two lines of the description. */}
          <button type="button" onClick={() => onOpen(task.id)} data-kx-keep-hover
            className="w-full text-start rounded-md">
            <span className={`block text-[13px] font-medium leading-snug break-words ${task.completed ? "line-through text-[var(--text-dim)]" : "text-[var(--text-primary)]"}`}>
              <AutoTranslatedText text={task.title} plain />
            </span>
            {task.description && (
              <AutoTranslatedText text={task.description} plain block className="text-[12px] text-[var(--text-dim)] mt-0.5 line-clamp-2 whitespace-pre-line" />
            )}
          </button>

          {/* Situation — status, priority and WHEN, in words. */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap min-w-0">
            {!task.completed && (
              <span className={`${BADGE} ${STATUS_PILL[status]}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} /> {t("st." + status)}
              </span>
            )}
            <span className={`${BADGE} ${PRIORITY_BADGE[task.priority]}`}>
              <FlagIcon size={10} /> {t("p." + task.priority)}
            </span>
            {due && (
              <span className={`${BADGE} ${DUE_TONE[due.tone]}`}>
                {due.tone === "overdue" ? <ExclamationIcon size={10} /> : <ClockIcon size={10} />}
                {due.rel}
                <span className="font-medium opacity-80 tabular-nums">· {due.dm}{due.time && ` ${due.time}`}</span>
              </span>
            )}
            {pending && <span className={`${BADGE} text-amber-400 bg-amber-500/10`}>{t("approval.pending")}</span>}
            {task.is_private && (
              <span className={`${BADGE} text-[var(--text-muted)] bg-[var(--bg-surface-active)]`}
                title={task.created_by_account_id === meId ? t("row.privateMine") : t("row.privateShared")}>
                <LockIcon size={9} /> {t("row.private")}
              </span>
            )}
            {task.label && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--text-faint)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded">
                <TagsIcon size={9} /> <AutoTranslatedText text={task.label} plain />
              </span>
            )}
            {task.series_cadence && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--text-primary)] bg-[var(--bg-surface-active)] px-1.5 py-0.5 rounded">
                <RefreshCwIcon size={9} /> {t("rec." + task.series_cadence)}
                {task.series_period && <span className="font-medium text-[var(--text-faint)]">· {fmtDue(task.series_period, t, lang)}</span>}
              </span>
            )}
            {task.source === "report" && task.source_id ? (
              <Link href={`/reports/${task.source_id}`} onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-300 bg-violet-500/10 px-1.5 py-0.5 rounded hover:underline">
                {t("src.report")}
              </Link>
            ) : task.source !== "manual" && task.source !== "report" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-300 bg-violet-500/10 px-1.5 py-0.5 rounded">
                {task.source === "crm" ? t("src.crm") : t("src.calendar")}
              </span>
            )}
            {task.completed && dueKey && doneKey && (
              <span className={`${BADGE} ${late ? "text-red-400 bg-red-500/10" : "text-green-400 bg-green-500/10"}`}>
                {late ? t("row.late") : t("row.onTime")}
              </span>
            )}
          </div>

          {/* WHO — names, and who handed it over, when. */}
          {(people || task.assigned_department || byOther) && (
            <div className="flex items-center gap-x-2.5 gap-y-1 mt-2 flex-wrap min-w-0 text-[11px] text-[var(--text-muted)]">
              {people && (
                <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
                  {task.assign_to_all ? <UsersIcon size={12} className="text-[var(--text-dim)] shrink-0" /> : (
                    <span className="flex -space-x-1.5 shrink-0">
                      {task.assignees.slice(0, 3).map((a) => <MiniAvatar key={a.account_id} info={a} size={20} ring />)}
                    </span>
                  )}
                  <span className="truncate font-medium text-[var(--text-primary)]">{people}</span>
                </span>
              )}
              {!people && task.assigned_department && (
                <span className="inline-flex items-center gap-1 min-w-0"><Building2Icon size={11} className="shrink-0 text-[var(--text-dim)]" /> <span className="truncate">{task.assigned_department}</span></span>
              )}
              {byOther && (
                <span className="inline-flex items-center gap-1 min-w-0 max-w-full text-[var(--text-dim)]">
                  <UserCheckIcon size={11} className="shrink-0" />
                  <span className="truncate">{t("row.byAgo").replace("{name}", nameOf(byOther)).replace("{ago}", fmtAgo(task.created_at, lang))}</span>
                </span>
              )}
            </div>
          )}

          {/* NEXT — checklist progress + the next open item; notes / files. */}
          {(checklist.length > 0 || task.notes.length > 0 || attachments > 0) && (
            <div className="flex items-center gap-2.5 mt-2 min-w-0 text-[11px]">
              {checklist.length > 0 && (
                <span className="inline-flex items-center gap-1.5 shrink-0" title={t("checklist.title")}>
                  <span className="relative w-12 h-1 rounded-full bg-[var(--bg-surface-active)] overflow-hidden" aria-hidden>
                    <span className={`absolute inset-y-0 start-0 rounded-full ${checkDone === checklist.length ? "bg-green-400" : "bg-[#7FA9D6]"}`}
                      style={{ width: `${Math.round((checkDone / checklist.length) * 100)}%` }} />
                  </span>
                  <span className="font-semibold tabular-nums text-[var(--text-muted)]">{checkDone}/{checklist.length}</span>
                </span>
              )}
              {nextItem && !task.completed && (
                <span className="min-w-0 truncate text-[var(--text-dim)]">
                  <span className="font-semibold text-[var(--text-muted)]">{t("row.next")}</span> <AutoTranslatedText text={nextItem.text} plain />
                </span>
              )}
              <span className="ms-auto inline-flex items-center gap-2 shrink-0 text-[var(--text-dim)]">
                {task.notes.length > 0 && (
                  <span className="inline-flex items-center gap-0.5" title={t("common.notes")}><MessageSquareIcon size={11} /> {task.notes.length}</span>
                )}
                {attachments > 0 && (
                  <span className="inline-flex items-center gap-0.5" title={t("extras.attachments")}><PaperclipIcon size={11} /> {attachments}</span>
                )}
              </span>
            </div>
          )}

          {/* Returned for rework — the manager's reason stays on the card
              until the assignee finishes and resubmits. */}
          {task.approval_state === "rejected" && !task.completed && (
            <div className="mt-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-300">
              <span className="font-bold">{t("approval.returned")}</span>
              {rejection
                ? <>: <AutoTranslatedText text={rejection} plain /></>
                : <span className="font-normal text-red-300/70"> — {t("approval.noReason")}</span>}
            </div>
          )}

          <ExtrasStrip meta={meta} t={t} />
        </div>

        {/* Approve / Send back — on the row for the assigner while a
            completion waits for them. */}
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
        {/* Actions — always visible on mobile (no hover), fade in on desktop.
            Edit / delete only for the task's owner. */}
        <div className="shrink-0 flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {canManage && !temp && (
            <>
              <button type="button" onClick={() => onEdit(task.id)} title={t("modal.edit")} aria-label={t("modal.edit")}
                className="hidden sm:inline-flex p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors text-[var(--text-dim)] hover:text-[var(--text-primary)]">
                <PencilIcon size={14} />
              </button>
              <button type="button" onClick={() => actions.remove([task.id])} title={t("modal.delete")} aria-label={t("modal.delete")}
                className="hidden sm:inline-flex p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-[var(--text-dim)] hover:text-red-400">
                <TrashIcon size={14} />
              </button>
            </>
          )}
          <button type="button" onClick={() => onOpen(task.id)} title={t("row.open")} aria-label={t("row.open")}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors text-[var(--text-dim)] hover:text-[var(--text-primary)] inline-flex items-center">
            <AngleRightIcon size={14} className="rtl:-scale-x-100" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(TaskRow);

/* ── Extras strip — project · products · mentions · observers. Files are
   counted on the row and shown in full in the sheet. ── */
function ExtrasStrip({ meta, t }: { meta: TodoMetadata; t: TFn }) {
  const prods = Array.isArray(meta.products) ? meta.products : [];
  const mentions = Array.isArray(meta.mentions) ? meta.mentions : [];
  const observers = Array.isArray(meta.observers) ? meta.observers : [];
  const proj = meta.project && typeof meta.project === "object" ? meta.project : null;
  if (prods.length === 0 && mentions.length === 0 && observers.length === 0 && !proj) return null;

  const chip = "inline-flex items-center gap-1 h-6 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)] max-w-[150px]";
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {proj && (
        <span className={chip}>
          <BriefcaseIcon className="h-2.5 w-2.5 shrink-0 text-[var(--text-dim)]" />
          <span className="truncate">{proj.name}</span>
        </span>
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
      {observers.map((o) => (
        <span key={o.account_id} className={chip} title={t("extras.observers")}>
          <EyeIcon className="h-2.5 w-2.5 shrink-0 text-[var(--text-dim)]" />
          <span className="truncate">{o.full_name || o.username}</span>
        </span>
      ))}
    </div>
  );
}
