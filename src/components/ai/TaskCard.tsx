"use client";

/* ---------------------------------------------------------------------------
   TaskCard — a write tool's preview in the chat, saved by a tap
   (tasks phase 2, 2026-09-13; TASKS_BY_AI_PLAN §4).

   The text lane used to confirm a task by typing "yes". This is the same
   card the call screen shows: what will be saved, in words — the title in
   the user's words, the due and reminder times in their zone, the people by
   name — and two buttons. Save is the one Hub-Blue control in the card and
   the one thing that writes: the parent POSTs the preview's own arguments
   with confirm:true to /api/ai/agent/confirm, where the ledger decides.
   Nothing here decides anything.

   THE CARD OUTLIVES THE ANSWER. It stays in the transcript with its
   outcome — saved, not saved, or simply passed by — because the task and
   its details are the context for what was said after it. Only the LIVE
   card is tappable (the last message, no outcome yet); an older one is a
   record, as the question card is (Bubble.tsx).
   --------------------------------------------------------------------------- */

import { textLang } from "@/lib/text-direction";
import Link from "next/link";
import { type Lang } from "@/lib/i18n";
import { COPY } from "@/components/ai/copy";

export type TaskCardState =
  | { state: "pending" }
  | { state: "saving" }
  | { state: "saved"; text?: string; todoId?: string | null }
  | { state: "failed" }
  | { state: "cancelled" };

type Person = { name?: unknown };

/** "weekly" → "Every week" / "كل أسبوع"; a value this card does not know is
 *  shown as it came, rather than dropped (it is what will be saved). */
export function recurrenceWords(v: string, copy: (typeof COPY)[Lang]): string {
  return v === "daily" || v === "weekly" || v === "monthly" ? copy.recurrenceWord[v] : v;
}

/** One line of an update card, in the screen's language: the field by name,
 *  the value in words — priorities, repeats and yes/no translated, a cleared
 *  field as "—". The tool's own field names ("due_date") and values
 *  ("medium") were printed raw on every screen (review, 2026-09-26). */
export function taskChangeLine(key: string, value: unknown, copy: (typeof COPY)[Lang]): string {
  const field = (copy.taskField as Record<string, string>)[key] ?? key.replace(/_/g, " ");
  let said: string;
  if (value === null || value === undefined || value === "") said = "—";
  else if (key === "priority") said = value === "high" ? copy.priorityHigh : value === "low" ? copy.priorityLow : value === "medium" ? copy.priorityMedium : String(value);
  else if (key === "recurrence") said = recurrenceWords(String(value), copy);
  else if (typeof value === "boolean") said = value ? copy.yes : copy.no;
  else said = String(value);
  return key === "priority" && said !== "—" && said !== String(value) ? said : `${field}: ${said}`;
}

/** The lines under the title, from the tool's preview — names, times in
 *  words, the zone's day — with the raw arguments as the fallback. Pure. */
export function taskCardDetails(
  tool: string,
  preview: Record<string, unknown> | null,
  args: Record<string, unknown>,
  copy: (typeof COPY)[Lang],
): string[] {
  const pv = preview ?? {};
  const names = (v: unknown) => (Array.isArray(v) ? (v as Person[]).map((p) => String(p?.name ?? "")).filter(Boolean) : []);
  if (tool === "updateTodo") {
    const changes = pv.changes && typeof pv.changes === "object" ? (pv.changes as Record<string, unknown>) : {};
    const lines = Object.entries(changes).map(([k, v]) => taskChangeLine(k, v, copy));
    const obs = names(pv.observers);
    if (obs.length) lines.push(`${copy.observers} ${obs.join(", ")}`);
    return lines;
  }
  const when = (pv.when && typeof pv.when === "object" ? pv.when : {}) as { due?: unknown; remind?: unknown; start?: unknown };
  const due = typeof when.due === "string" && when.due ? when.due : typeof args.due_date === "string" ? args.due_date : "";
  const remind = typeof when.remind === "string" && when.remind ? when.remind : "";
  const start = typeof when.start === "string" && when.start ? when.start : "";
  const people = names(pv.assignees)
    .concat(typeof pv.department === "string" && pv.department ? [pv.department] : [])
    .concat(pv.assign_to_all === true ? [copy.everyone] : []);
  const priority = typeof args.priority === "string" ? args.priority : "";
  const label = typeof args.label === "string" ? args.label : "";
  const recurrence = typeof args.recurrence === "string" && args.recurrence ? args.recurrence : "";
  const observers = names(pv.observers);
  const mentions = names(pv.mentions);
  return [
    due ? `${copy.due} ${due}` : "",
    remind ? `${copy.remind} ${remind}` : "",
    start ? `${copy.starts} ${start}` : "",
    priority === "high" ? copy.priorityHigh : priority === "low" ? copy.priorityLow : "",
    label,
    people.length ? `${copy.forPeople} ${people.join(", ")}` : "",
    observers.length ? `${copy.observers} ${observers.join(", ")}` : "",
    mentions.length ? `${copy.mentions} ${mentions.join(", ")}` : "",
    recurrence ? `${copy.repeats} ${recurrenceWords(recurrence, copy)}` : "",
    args.is_private === true ? copy.privateTask : "",
  ].filter(Boolean);
}

export default function TaskCard({
  tool,
  pending,
  preview,
  status,
  live,
  lang,
  onSave,
  onCancel,
}: {
  tool: string;
  pending: { tool: string; args: Record<string, unknown> };
  preview: Record<string, unknown> | null;
  status: TaskCardState;
  /** Tappable: the last message, no outcome yet, a parent that can save. */
  live: boolean;
  lang: Lang;
  onSave?: () => void;
  onCancel?: () => void;
}) {
  const copy = COPY[lang] ?? COPY.en;
  const title = String(pending.args.title ?? (preview?.title ?? "")).trim();
  const details = taskCardDetails(tool, preview, pending.args, copy);
  const heading = tool === "updateTodo" ? copy.taskUpdate : copy.taskPreview;
  const settled = status.state === "saved" || status.state === "cancelled";
  const busy = status.state === "saving";
  return (
    <div
      className={`w-full max-w-[560px] rounded-2xl border px-4 py-3 ${settled ? "border-[var(--border-subtle)] bg-[var(--bg-secondary)]" : "border-[var(--border-strong)] bg-[var(--bg-elevated)]"}`}
      data-task-card
      data-task-state={status.state}
    >
      <div className="text-[12px] font-medium text-[var(--text-dim)]">
        {status.state === "saved" ? copy.taskSaved : status.state === "cancelled" ? copy.taskCancelled : heading}
      </div>
      {title && <div className="mt-1 text-[15px] font-semibold leading-snug text-[var(--text-primary)]" dir="auto" lang={textLang(title)} data-task-title>{title}</div>}
      {details.length > 0 && (
        <div className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]" data-task-details>{details.join(" · ")}</div>
      )}
      {status.state === "failed" && <div className="mt-2 text-[12px] text-[var(--kx-ai-danger-text,#FF7A7A)]" data-task-error>{copy.taskFailed}</div>}
      {status.state === "saved" && status.todoId && (
        <Link href={`/todo?task=${encodeURIComponent(status.todoId)}`} className="mt-2 inline-block text-[13px] font-medium text-[var(--kx-ai-accent,#0066FF)] hover:underline" data-task-open>
          {copy.openTodo} {lang === "ar" ? "←" : "→"}
        </Link>
      )}
      {live && (status.state === "pending" || status.state === "saving" || status.state === "failed") && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="h-10 flex-1 rounded-full bg-[var(--kx-ai-accent,#0066FF)] text-white text-[13px] font-semibold active:scale-95 transition-transform disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)]"
            data-task-save
          >
            {busy ? copy.savingTask : copy.saveTask}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-10 px-4 rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[13px] active:scale-95 transition-transform disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kx-ai-accent,#0066FF)]"
            data-task-cancel
          >
            {copy.cancelTask}
          </button>
        </div>
      )}
    </div>
  );
}
