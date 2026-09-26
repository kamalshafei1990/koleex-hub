"use client";

/* ---------------------------------------------------------------------------
   Board (Kanban) — columns by situation. Drag a card on a desktop; the ‹ ›
   buttons move it on a phone (HTML drag-and-drop does not fire on touch) and
   from the keyboard. Loaded only when the Board view is picked.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import type { TodoStatus, TodoWithRelations } from "@/types/supabase";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import AngleLeftIcon from "@/components/icons/ui/AngleLeftIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import FlagIcon from "@/components/icons/ui/FlagIcon";
import MiniAvatar from "./MiniAvatar";
import { fmtDue, isOverdueDate } from "./todo-dates";
import { PRIORITY_TEXT, STATUS_DOT, STATUSES, statusOf, type TFn } from "./todo-ui";
import { isTempTask, type TodoActions } from "./use-todo-store";

export default function TodoBoard({ tasks, t, lang, actions, onOpen }: {
  tasks: TodoWithRelations[];
  t: TFn;
  lang: string;
  actions: TodoActions;
  onOpen: (id: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TodoStatus | null>(null);

  const move = (id: string, to: TodoStatus) => void actions.setStatus(id, to);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 [&>*]:min-w-0">
      {STATUSES.map((col, ci) => {
        const colTasks = tasks.filter((task) => statusOf(task) === col);
        return (
          <section key={col} aria-label={t("st." + col)}
            onDragOver={(e) => { e.preventDefault(); setOverCol(col); }}
            onDragLeave={() => setOverCol((c) => (c === col ? null : c))}
            onDrop={() => { if (dragId) move(dragId, col); setDragId(null); setOverCol(null); }}
            className={`rounded-2xl border bg-[var(--bg-secondary)] p-2 min-h-[120px] transition-colors ${
              overCol === col ? "border-[var(--border-focus)] bg-[var(--bg-surface-active)]" : "border-[var(--border-color)]"
            }`}>
            <header className="flex items-center gap-1.5 px-2 py-1.5 mb-1">
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[col]}`} />
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{t("st." + col)}</h3>
              <span className="text-[10px] font-semibold text-[var(--text-dim)] bg-[var(--bg-surface)] rounded-full px-1.5 ms-auto">{colTasks.length}</span>
            </header>
            <div className="space-y-2">
              {colTasks.map((task) => {
                const overdue = !task.completed && isOverdueDate(task.due_date);
                const prev = STATUSES[ci - 1];
                const next = STATUSES[ci + 1];
                const temp = isTempTask(task.id);
                return (
                  <div key={task.id} draggable={!temp}
                    onDragStart={() => setDragId(task.id)}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                    className={`group rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 cursor-grab active:cursor-grabbing hover:border-[var(--border-color)] transition-colors ${dragId === task.id ? "opacity-50" : ""}`}>
                    <button type="button" onClick={() => onOpen(task.id)} data-kx-keep-hover
                      className={`w-full text-start text-[12.5px] font-medium leading-snug break-words rounded-md ${task.completed ? "line-through text-[var(--text-dim)]" : "text-[var(--text-primary)]"}`}>
                      <AutoTranslatedText dir="auto" text={task.title} plain />
                    </button>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${PRIORITY_TEXT[task.priority]}`}>
                        <FlagIcon size={9} /> {t("p." + task.priority)}
                      </span>
                      {task.due_date && (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${overdue ? "text-red-400" : "text-[var(--text-faint)]"}`}>
                          <ClockIcon size={9} /> {fmtDue(task.due_date, t, lang)}
                        </span>
                      )}
                      {task.assignees.length > 0 && (
                        <span className="flex -space-x-1 ms-auto">
                          {task.assignees.slice(0, 3).map((a) => <MiniAvatar key={a.account_id} info={a} size={18} ring />)}
                        </span>
                      )}
                    </div>
                    {!temp && (prev || next) && (
                      <div className="flex items-center justify-between mt-2 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                        {prev ? (
                          <button type="button" onClick={() => move(task.id, prev)} aria-label={`${t("board.moveTo")} ${t("st." + prev)}`}
                            className="h-6 px-1.5 rounded-md text-[10px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] inline-flex items-center gap-0.5">
                            <AngleLeftIcon size={11} className="rtl:-scale-x-100" /> {t("st." + prev)}
                          </button>
                        ) : <span />}
                        {next && (
                          <button type="button" onClick={() => move(task.id, next)} aria-label={`${t("board.moveTo")} ${t("st." + next)}`}
                            className="h-6 px-1.5 rounded-md text-[10px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] inline-flex items-center gap-0.5">
                            {t("st." + next)} <AngleRightIcon size={11} className="rtl:-scale-x-100" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {colTasks.length === 0 && <div className="text-center text-[11px] text-[var(--text-ghost)] py-4" aria-label={t("board.empty")}>—</div>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
