"use client";

/* ---------------------------------------------------------------------------
   TaskSheet — the task, in full. What an employee lands on from a
   notification (/todo?task=<id>) or by opening a row.

   Owner: "if I am an employee and got a notification of this task I don't
   know clearly what I should do." So the sheet reads top to bottom as the
   questions come:
     header        title · status · priority · private · series
     next step     what THIS viewer is expected to do now (approve, start,
                   submit, wait) — or why it came back
     What to do    the full description, the checklist (tick it here)
     Who & when    assigned by / to, observers, due · start · reminder ·
                   repeat, created
     Files & links attachments, products, project, mentions, the report
     Notes         the thread, and a box to ask or report
     footer        the actions for this viewer, by the store's own rules
                   (Start · Mark done / Submit for approval · Approve /
                   Send back · Withdraw · Reopen)

   A side sheet on a desktop, the whole screen on a phone. Loaded on first
   open — the list never pays for it.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ScrollLockOverlay } from "@/hooks/useScrollLock";
import type { TodoMention, TodoWithRelations } from "@/types/supabase";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import AtSignIcon from "@/components/icons/ui/AtSignIcon";
import BellIcon from "@/components/icons/ui/BellIcon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import CalendarRawIcon from "@/components/icons/ui/CalendarRawIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import CircleIcon from "@/components/icons/ui/CircleIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import FileIcon from "@/components/icons/ui/FileIcon";
import FlagIcon from "@/components/icons/ui/FlagIcon";
import InfoIcon from "@/components/icons/ui/InfoIcon";
import ListTodoIcon from "@/components/icons/ui/ListTodoIcon";
import LockIcon from "@/components/icons/ui/LockIcon";
import MessageSquareIcon from "@/components/icons/ui/MessageSquareIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import PaperclipIcon from "@/components/icons/ui/PaperclipIcon";
import PaperPlaneIcon from "@/components/icons/ui/PaperPlaneIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import PlayIcon from "@/components/icons/ui/PlayIcon";
import RefreshCwIcon from "@/components/icons/ui/RefreshCwIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import UserCheckIcon from "@/components/icons/ui/UserCheckIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import { todoAttachmentHref as attachmentHref } from "@/lib/todo-admin";
import MiniAvatar from "./MiniAvatar";
import { dueInfo, fmtAgo, fmtDay, fmtDayTime, fmtDue } from "./todo-dates";
import {
  CHOICE, CHOICE_OFF, CHOICE_ON, PRIORITY_BADGE, metaOf, STATUS_DOT, STATUS_PILL, STATUSES, nameOf, statusOf, type TFn,
} from "./todo-ui";
import { isTempTask, type TodoActions } from "./use-todo-store";
import LabelIcon from "./LabelIcon";

export interface TaskSheetProps {
  task: TodoWithRelations;
  t: TFn;
  lang: string;
  meId: string | null;
  /** May edit / delete / tick the checklist (the row's rule). */
  canManage: boolean;
  /** Creator, assigner or super admin: "done" completes rather than submits
   *  (use-todo-store's own isOwner). */
  isOwner: boolean;
  /** Another dialog is on top (edit form, send-back) — Esc is theirs. */
  paused: boolean;
  actions: TodoActions;
  onClose: () => void;
  onEdit: (id: string) => void;
  onReject: (id: string) => void;
}

const BADGE = "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md";
const SUB = "text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-dim)]";
const BTN = "h-10 px-4 rounded-xl text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40";
const BTN_PRIMARY = `${BTN} bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90`;
const BTN_SOFT = `${BTN} bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]`;

export default function TaskSheet({
  task, t, lang, meId, canManage, isOwner, paused, actions, onClose, onEdit, onReject,
}: TaskSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const meta = metaOf(task);
  const checklist = Array.isArray(meta.checklist) ? meta.checklist : [];
  const checkDone = checklist.filter((c) => c.done).length;
  const atts = Array.isArray(meta.attachments) ? meta.attachments : [];
  const prods = Array.isArray(meta.products) ? meta.products : [];
  const mentions = Array.isArray(meta.mentions) ? meta.mentions : [];
  const observers = Array.isArray(meta.observers) ? meta.observers : [];
  const proj = meta.project && typeof meta.project === "object" ? meta.project : null;
  const rejection = (meta as { rejection?: { reason?: string } }).rejection?.reason;

  const status = statusOf(task);
  const temp = isTempTask(task.id);
  const pending = task.approval_state === "pending";
  const awaitsMe = pending && task.assigned_by_account_id === meId;
  const mine = !!meId && task.assignees.some((a) => a.account_id === meId);
  const due = dueInfo(task.due_date, t);
  const assignerName = task.assigner ? nameOf(task.assigner) : "";

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    if (paused) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused, onClose]);

  /* What THIS viewer should do next — the line an employee from a
     notification reads first. */
  let next: { tone: "amber" | "red" | "blue"; text: ReactNode } | null = null;
  if (!task.completed) {
    if (awaitsMe) next = { tone: "amber", text: t("approval.awaitingYou") };
    else if (pending) next = { tone: "amber", text: t("approval.submitted") };
    else if (task.approval_state === "rejected") {
      next = { tone: "red", text: <><b>{t("approval.returned")}</b>{rejection ? <>: <AutoTranslatedText dir="auto" text={rejection} plain /></> : ` — ${t("approval.noReason")}`}</> };
    } else if (mine && !isOwner) {
      next = {
        tone: "blue",
        text: status === "blocked" ? t("sheet.hintBlocked")
          : status === "in_progress" ? t("sheet.hintSubmit").replace("{name}", assignerName || "—")
          : t("sheet.hintStart"),
      };
    } else if (status === "blocked") next = { tone: "blue", text: t("sheet.hintBlocked") };
  }
  const NEXT_TONE = {
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    red: "border-red-500/25 bg-red-500/10 text-red-300",
    blue: "border-[#567FB2]/30 bg-[#567FB2]/10 text-[#BCD8F0]",
  } as const;

  const facts: { k: string; icon: ReactNode; label: string; value: ReactNode }[] = [];
  if (task.assigner) {
    facts.push({
      k: "by", icon: <UserCheckIcon size={13} />, label: t("sheet.assignedBy"),
      value: (
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <MiniAvatar info={task.assigner} size={20} />
          <span className="truncate font-medium">{task.assigner.account_id === meId ? t("sheet.you") : assignerName}</span>
          <span className="text-[var(--text-dim)] shrink-0">· {fmtAgo(task.created_at, lang)}</span>
        </span>
      ),
    });
  }
  if (task.due_date) {
    facts.push({
      k: "due", icon: <ClockIcon size={13} />, label: t("f.dueDate"),
      value: (
        <span>
          <span className="font-medium">{fmtDay(task.due_date, lang, true)}{due?.time && ` · ${due.time}`}</span>
          {due && !task.completed && (
            <span className={`ms-1.5 text-[11px] font-semibold ${due.tone === "overdue" ? "text-red-400" : due.tone === "today" ? "text-amber-300" : "text-[var(--text-dim)]"}`}>{due.rel}</span>
          )}
        </span>
      ),
    });
  }
  if (task.start_date) facts.push({ k: "start", icon: <CalendarRawIcon size={13} />, label: t("f.startDate"), value: fmtDay(task.start_date, lang, true) });
  if (task.remind_at) facts.push({ k: "remind", icon: <BellIcon size={13} />, label: t("f.reminder"), value: fmtDayTime(task.remind_at, lang) });
  if (task.series_cadence) {
    facts.push({
      k: "rec", icon: <RefreshCwIcon size={13} />, label: t("f.recurrence"),
      value: <>{t("rec." + task.series_cadence)}{task.series_period && <span className="text-[var(--text-dim)]"> · {t("f.occurrence")} {fmtDue(task.series_period, t, lang)}</span>}</>,
    });
  }
  facts.push({ k: "created", icon: <CalendarRawIcon size={13} />, label: t("sheet.created"), value: <>{fmtDay(task.created_at, lang, true)} <span className="text-[var(--text-dim)]">· {fmtAgo(task.created_at, lang)}</span></> });

  const hasLinks = atts.length > 0 || prods.length > 0 || mentions.length > 0 || !!proj || (task.source === "report" && !!task.source_id) || !!task.label;

  return (
    /* A centred window, like the task form — owner: "I don't want a slide
       window when I press the task, make it a centre popup". Full screen on
       phones, where a floating card would only leave slivers around it. */
    <ScrollLockOverlay className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:p-4 md:p-6 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-labelledby="todo-sheet-title"
        className="kx-app kx-todo kx-glass-pop kx-pop-in relative flex w-full h-full sm:h-auto sm:max-h-[88dvh] sm:max-w-2xl flex-col overflow-hidden sm:rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl">

        {/* ── Header ── */}
        <header className="shrink-0 border-b border-[var(--border-subtle)] px-4 sm:px-5 pt-3 pb-3.5" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
          <div className="flex items-center gap-2">
            <span className={`${SUB} flex items-center gap-1.5`}><ListTodoIcon size={12} /> {t("sheet.task")}</span>
            <div className="ms-auto flex items-center gap-1">
              {canManage && !temp && (
                <>
                  <button type="button" onClick={() => onEdit(task.id)} title={t("modal.edit")} aria-label={t("modal.edit")}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors">
                    <PencilIcon size={14} />
                  </button>
                  <button type="button" onClick={() => { actions.remove([task.id]); onClose(); }} title={t("modal.delete")} aria-label={t("modal.delete")}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <TrashIcon size={14} />
                  </button>
                </>
              )}
              <button ref={closeRef} type="button" onClick={onClose} aria-label={t("sheet.close")} title={t("sheet.close")}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors">
                <CrossIcon size={15} />
              </button>
            </div>
          </div>
          <h2 id="todo-sheet-title" className={`mt-1.5 text-[18px] font-semibold leading-snug break-words ${task.completed ? "line-through text-[var(--text-dim)]" : "text-[var(--text-primary)]"}`}>
            <AutoTranslatedText dir="auto" text={task.title} plain />
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={`${BADGE} ${STATUS_PILL[status]}`}><span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} /> {t("st." + status)}</span>
            <span className={`${BADGE} ${PRIORITY_BADGE[task.priority]}`}><FlagIcon size={11} /> {t("f.priority")}: {t("p." + task.priority)}</span>
            {pending && <span className={`${BADGE} text-amber-400 bg-amber-500/10`}><ClockIcon size={11} /> {t("approval.pending")}</span>}
            {task.is_private && (
              <span className={`${BADGE} text-[var(--text-muted)] bg-[var(--bg-surface-active)]`}
                title={task.created_by_account_id === meId ? t("row.privateMine") : t("row.privateShared")}>
                <LockIcon size={10} /> {t("row.private")}
              </span>
            )}
            {task.series_cadence && (
              <span className={`${BADGE} text-[var(--text-primary)] bg-[var(--bg-surface-active)]`}><RefreshCwIcon size={10} /> {t("rec." + task.series_cadence)}</span>
            )}
          </div>
        </header>

        {/* ── Body ── */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 space-y-5">
          {next && (
            <div role="status" className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] leading-relaxed ${NEXT_TONE[next.tone]}`}>
              <InfoIcon size={14} className="mt-0.5 shrink-0" />
              <span className="min-w-0">{next.text}</span>
            </div>
          )}

          {/* Situation — set straight from here. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 [&>*]:min-w-0" role="group" aria-label={t("f.status")}>
            {STATUSES.map((s) => (
              <button key={s} type="button" disabled={temp} aria-pressed={status === s}
                onClick={() => void actions.setStatus(task.id, s)}
                className={`h-8 ${CHOICE} ${status === s ? CHOICE_ON : CHOICE_OFF}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s]}`} /> {t("st." + s)}
              </button>
            ))}
          </div>

          <Section icon={<ListTodoIcon size={13} />} title={t("sheet.whatToDo")}>
            {task.description ? (
              <AutoTranslatedText dir="auto" text={task.description} block className="text-[13px] text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap break-words" />
            ) : (
              <p className="text-[12.5px] text-[var(--text-dim)]">{t("sheet.noDescription")}</p>
            )}
            {checklist.length > 0 && (
              <div className="mt-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className={SUB}>{t("checklist.title")}</span>
                  <span className="relative flex-1 h-1 rounded-full bg-[var(--bg-surface-active)] overflow-hidden" aria-hidden>
                    <span className={`absolute inset-y-0 start-0 rounded-full ${checkDone === checklist.length ? "bg-green-400" : "bg-[#7FA9D6]"}`}
                      style={{ width: `${Math.round((checkDone / checklist.length) * 100)}%` }} />
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums text-[var(--text-muted)]">{checkDone}/{checklist.length}</span>
                </div>
                <ul className="space-y-0.5">
                  {checklist.map((c) => (
                    <li key={c.id}>
                      <button type="button" disabled={!canManage || temp} aria-pressed={c.done}
                        onClick={() => void actions.toggleChecklistItem(task.id, c.id)}
                        className="w-full flex items-start gap-2 py-1 px-1 text-[12.5px] text-start rounded-md enabled:hover:bg-[var(--bg-surface-hover)] disabled:cursor-default">
                        {c.done ? <CheckCircleIcon size={15} className="mt-px text-green-400 shrink-0" /> : <CircleIcon size={15} className="mt-px text-[var(--text-ghost)] shrink-0" />}
                        <span className={`min-w-0 break-words ${c.done ? "line-through text-[var(--text-dim)]" : "text-[var(--text-primary)]"}`}>
                          <AutoTranslatedText dir="auto" text={c.text} plain />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          <Section icon={<UsersIcon size={13} />} title={t("sheet.whoWhen")}>
            <div className="space-y-3">
              {(task.assignees.length > 0 || task.assign_to_all || task.assigned_department) && (
                <div>
                  <div className={`${SUB} mb-1.5`}>{t("sheet.assignees")}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {task.assign_to_all && <PersonChip icon={<UsersIcon size={12} />} name={t("assign.everyone")} />}
                    {!task.assign_to_all && task.assigned_department && <PersonChip icon={<Building2Icon size={12} />} name={task.assigned_department} />}
                    {!task.assign_to_all && task.assignees.map((a) => (
                      <PersonChip key={a.account_id} avatar={<MiniAvatar info={a} size={22} />}
                        name={a.account_id === meId ? `${nameOf(a)} (${t("sheet.you")})` : nameOf(a)}
                        sub={a.position || a.department || ""} />
                    ))}
                  </div>
                </div>
              )}
              {observers.length > 0 && (
                <div>
                  <div className={`${SUB} mb-1.5`}>{t("extras.observers")}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {observers.map((o: TodoMention) => <PersonChip key={o.account_id} icon={<EyeIcon size={12} />} name={o.full_name || o.username || ""} />)}
                  </div>
                </div>
              )}
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 [&>*]:min-w-0">
                {facts.map((f) => (
                  <div key={f.k} className="flex items-start gap-2 min-w-0">
                    <span className="mt-0.5 h-6 w-6 shrink-0 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] inline-flex items-center justify-center text-[var(--text-dim)]">{f.icon}</span>
                    <div className="min-w-0">
                      <dt className={SUB}>{f.label}</dt>
                      <dd className="text-[12.5px] text-[var(--text-primary)] mt-0.5 min-w-0">{f.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>
          </Section>

          {hasLinks && (
            <Section icon={<PaperclipIcon size={13} />} title={t("sheet.linked")}>
              {atts.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2.5">
                  {atts.map((a) => a.type?.startsWith("image/") ? (
                    <a key={a.path} href={attachmentHref(a.path)} target="_blank" rel="noreferrer" title={a.name}
                      className="block h-20 w-20 rounded-lg overflow-hidden border border-[var(--border-subtle)] shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={attachmentHref(a.path)} alt={a.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    </a>
                  ) : (
                    <a key={a.path} href={attachmentHref(a.path)} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] max-w-full hover:border-[var(--border-color)]">
                      <FileIcon size={13} className="shrink-0 text-[var(--text-dim)]" /> <span className="truncate">{a.name}</span>
                    </a>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {proj && <LinkChip icon={<BriefcaseIcon size={12} />} text={proj.name} />}
                {task.label && <LinkChip icon={<LabelIcon name={task.label} size={12} className="text-current" />} text={<AutoTranslatedText dir="auto" text={task.label} plain />} />}
                {prods.map((p) => <LinkChip key={p.id} icon={<PackageIcon size={12} />} text={p.code ? `${p.code} · ${p.name}` : p.name} />)}
                {mentions.map((m) => <LinkChip key={m.account_id} icon={<AtSignIcon size={12} />} text={m.full_name || m.username} />)}
                {task.source === "report" && task.source_id && (
                  <Link href={`/reports/${task.source_id}`}
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium text-violet-300 bg-violet-500/10 border border-violet-500/20 hover:underline">
                    {t("src.report")}
                  </Link>
                )}
              </div>
            </Section>
          )}

          <Notes task={task} t={t} lang={lang} meId={meId} actions={actions} temp={temp} />
        </div>

        {/* ── Actions for THIS viewer ── */}
        {!temp && (
          <footer className="shrink-0 border-t border-[var(--border-subtle)] px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            {task.completed ? (
              <button type="button" onClick={() => void actions.toggle(task.id)} className={`${BTN_SOFT} flex-1 sm:flex-none`}>
                <RefreshCwIcon size={14} /> {t("row.markUndone")}
              </button>
            ) : awaitsMe ? (
              <>
                <button type="button" onClick={() => onReject(task.id)} className={`${BTN_SOFT} flex-1 sm:flex-none`}>{t("approval.rejectSubmit")}</button>
                <button type="button" onClick={() => void actions.approve(task.id)}
                  className={`${BTN} flex-1 sm:flex-none sm:ms-auto bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500/30`}>
                  <CheckCircleIcon size={15} /> {t("sheet.approve")}
                </button>
              </>
            ) : pending ? (
              <button type="button" onClick={() => void actions.toggle(task.id)} className={`${BTN_SOFT} flex-1 sm:flex-none`}>{t("row.withdraw")}</button>
            ) : (
              <>
                {status !== "in_progress" && (
                  <button type="button" onClick={() => void actions.setStatus(task.id, "in_progress")} className={`${BTN_SOFT} flex-1 sm:flex-none`}>
                    <PlayIcon size={13} /> {t("sheet.start")}
                  </button>
                )}
                <button type="button" onClick={() => void actions.toggle(task.id)} className={`${BTN_PRIMARY} flex-1 sm:flex-none sm:ms-auto`}>
                  <CheckCircleIcon size={15} /> {isOwner ? t("row.markDone") : t("sheet.submit")}
                </button>
              </>
            )}
          </footer>
        )}
      </aside>
    </ScrollLockOverlay>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="flex items-center gap-2 mb-2.5 text-[12px] font-semibold text-[var(--text-primary)]">
        <span className="h-6 w-6 rounded-md bg-[#567FB2]/15 text-[#7FA9D6] inline-flex items-center justify-center shrink-0">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function PersonChip({ avatar, icon, name, sub }: { avatar?: ReactNode; icon?: ReactNode; name: string; sub?: string }) {
  return (
    <span className="inline-flex items-center gap-2 h-9 ps-1.5 pe-3 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] max-w-full min-w-0">
      {avatar ?? <span className="h-[22px] w-[22px] rounded-full bg-[var(--bg-surface-active)] inline-flex items-center justify-center text-[var(--text-dim)] shrink-0">{icon}</span>}
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[12px] font-medium text-[var(--text-primary)]">{name}</span>
        {sub && <span className="block truncate text-[10px] text-[var(--text-dim)]">{sub}</span>}
      </span>
    </span>
  );
}

function LinkChip({ icon, text }: { icon: ReactNode; text: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)] max-w-full min-w-0">
      <span className="shrink-0 text-[var(--text-dim)]">{icon}</span> <span className="truncate">{text}</span>
    </span>
  );
}

/* ── Notes thread + add box ── */
function Notes({ task, t, lang, meId, actions, temp }: {
  task: TodoWithRelations; t: TFn; lang: string; meId: string | null; actions: TodoActions; temp: boolean;
}) {
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const send = async () => {
    const body = note.trim();
    if (!body || sending) return;
    setSending(true);
    const ok = await actions.addNote(task.id, body);
    setSending(false);
    if (ok) setNote("");
  };
  return (
    <Section icon={<MessageSquareIcon size={13} />} title={`${t("common.notes")}${task.notes.length ? ` · ${task.notes.length}` : ""}`}>
      {task.notes.length === 0 && <p className="text-[12px] text-[var(--text-dim)] mb-2">{t("sheet.noNotes")}</p>}
      <div className="space-y-2.5">
        {task.notes.map((n) => (
          <div key={n.id} className="flex items-start gap-2.5 text-[12.5px]">
            <MiniAvatar info={{ avatar_url: n.author_avatar_url, full_name: n.author_full_name, username: n.author_username }} size={26} />
            <div className="flex-1 min-w-0 rounded-xl rounded-ss-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3 py-2">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-[var(--text-primary)] truncate">{n.author_full_name || n.author_username}</span>
                <span className="text-[10.5px] text-[var(--text-dim)] shrink-0">{fmtDayTime(n.created_at, lang)}</span>
                {n.author_account_id === meId && (
                  <button type="button" onClick={() => void actions.deleteNote(task.id, n.id)} aria-label={t("notes.delete")}
                    className="ms-auto text-[var(--text-dim)] hover:text-red-400 p-0.5 shrink-0">
                    <CrossIcon size={10} />
                  </button>
                )}
              </div>
              <AutoTranslatedText dir="auto" text={n.body} block className="text-[var(--text-primary)] mt-0.5 break-words whitespace-pre-wrap" />
            </div>
          </div>
        ))}
      </div>
      {!temp && (
        <form className="flex items-end gap-2 mt-3" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
            placeholder={t("notes.placeholder")} aria-label={t("notes.placeholder")}
            className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors resize-none" />
          <button type="submit" disabled={!note.trim() || sending} aria-label={t("notes.send")}
            className="h-10 w-10 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-30 shrink-0">
            <PaperPlaneIcon size={14} className="rtl:-scale-x-100" />
          </button>
        </form>
      )}
    </Section>
  );
}
