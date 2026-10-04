"use client";

/* ---------------------------------------------------------------------------
   QuickAddPanels — the quick-add line's small pickers (Assign · Due + time ·
   Priority · Label) and its @ colleague list. Their own chunk: the list
   paints without them and they arrive the first time one is opened.
   Each is a small glass card anchored under the line; what it sets shows
   back on the line as a removable chip.
   --------------------------------------------------------------------------- */

import { useMemo, useState } from "react";
import type { TodoAssigneeInfo, TodoPriority } from "@/types/supabase";
import DatePicker from "@/components/ui/DatePicker";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import FlagIcon from "@/components/icons/ui/FlagIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import MiniAvatar from "./MiniAvatar";
import { isoDay } from "./todo-dates";
import { PRIORITIES, PRIORITY_TEXT, nameOf, type TFn } from "./todo-ui";
import LabelIcon from "./LabelIcon";

export type QuickPanelKind = "assign" | "due" | "priority" | "label";

const CARD = "kx-glass-pop kx-pop-in rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl overflow-hidden";
const ROW = "w-full flex items-center gap-2 px-2.5 h-9 rounded-lg text-[12px] text-start transition-colors";
const TIMES = ["09:00", "12:00", "15:00", "18:00"];

/* ── the @ list ── */
export function MentionList({ people, active, onPick, onHover, t }: {
  people: TodoAssigneeInfo[];
  active: number;
  onPick: (p: TodoAssigneeInfo) => void;
  onHover: (i: number) => void;
  t: TFn;
}) {
  return (
    <div className={CARD}>
      <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("quick.people")}</div>
      <ul id="todo-quick-mentions" role="listbox" className="p-1 max-h-64 overflow-y-auto">
        {people.map((p, i) => (
          <li key={p.account_id} id={`todo-quick-m-${p.account_id}`} role="option" aria-selected={i === active}>
            {/* mousedown, not click: the input keeps its focus and caret. */}
            <button type="button" tabIndex={-1} onMouseDown={(e) => { e.preventDefault(); onPick(p); }} onMouseEnter={() => onHover(i)}
              className={`${ROW} h-10 ${i === active ? "bg-[#567FB2]/15 text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
              <MiniAvatar info={p} size={24} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate font-medium text-[var(--text-primary)]">{nameOf(p)}{p.name_alt && p.name_alt !== p.full_name ? <span className="text-[var(--text-dim)] font-normal"> · {p.name_alt}</span> : null}</span>
                <span className="block truncate text-[10.5px] text-[var(--text-dim)]">@{p.username}{p.department ? ` · ${p.department}` : ""}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── the toolbar's pickers ── */
export default function QuickAddPanel(props: {
  kind: QuickPanelKind;
  t: TFn;
  lang: string;
  employees: TodoAssigneeInfo[];
  labels: string[];
  people: string[];
  onTogglePerson: (id: string) => void;
  day: string | null;
  time: string | null;
  onDue: (day: string | null, time: string | null) => void;
  priority: TodoPriority;
  onPriority: (p: TodoPriority) => void;
  label: string | null;
  onLabel: (l: string | null) => void;
  onClose: () => void;
}) {
  const { kind, t } = props;
  return (
    <div className={CARD} role="dialog" aria-label={kind === "assign" ? t("quick.assign") : kind === "due" ? t("quick.due") : kind === "priority" ? t("f.priority") : t("f.label")}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); props.onClose(); } }}>
      {kind === "assign" && <AssignPicker {...props} />}
      {kind === "due" && <DuePicker {...props} />}
      {kind === "priority" && (
        <div className="p-1">
          {PRIORITIES.map((p) => (
            <button key={p} type="button" onClick={() => props.onPriority(p)} aria-pressed={props.priority === p}
              className={`${ROW} ${props.priority === p ? "bg-[var(--bg-surface-active)]" : "hover:bg-[var(--bg-surface-hover)]"}`}>
              <FlagIcon size={13} className={PRIORITY_TEXT[p]} />
              <span className="flex-1 font-medium text-[var(--text-primary)]">{t("p." + p)}</span>
              {props.priority === p && <CheckIcon size={13} className="text-[#7FA9D6]" />}
            </button>
          ))}
        </div>
      )}
      {kind === "label" && (
        <div className="p-1 max-h-64 overflow-y-auto">
          {props.labels.length === 0 && <p className="px-2.5 py-2 text-[12px] text-[var(--text-dim)]">{t("extras.noMatches")}</p>}
          {props.labels.map((l) => (
            <button key={l} type="button" onClick={() => props.onLabel(props.label === l ? null : l)} aria-pressed={props.label === l}
              className={`${ROW} ${props.label === l ? "bg-[var(--bg-surface-active)]" : "hover:bg-[var(--bg-surface-hover)]"}`}>
              <LabelIcon name={l} size={14} className="text-[var(--text-muted)]" />
              <span className="flex-1 truncate text-[var(--text-primary)]">{l}</span>
              {props.label === l && <CheckIcon size={13} className="text-[#7FA9D6]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AssignPicker({ t, employees, people, onTogglePerson }: {
  t: TFn; employees: TodoAssigneeInfo[]; people: string[]; onTogglePerson: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? employees.filter((e) => nameOf(e).toLowerCase().includes(n) || e.username.toLowerCase().includes(n) ||
      (e.name_alt ?? "").toLowerCase().includes(n) || (e.department ?? "").toLowerCase().includes(n)) : employees;
  }, [employees, q]);
  return (
    <>
      <div className="p-2 border-b border-[var(--border-subtle)]">
        <div className="relative">
          <SearchIcon size={13} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("filters.searchEmployees")} aria-label={t("filters.searchEmployees")}
            className="w-full h-8 ps-8 pe-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]" />
        </div>
      </div>
      <ul className="p-1 max-h-64 overflow-y-auto">
        {list.length === 0 && <li className="px-2.5 py-2 text-[12px] text-[var(--text-dim)]">{t("assign.none")}</li>}
        {list.map((e) => {
          const on = people.includes(e.account_id);
          return (
            <li key={e.account_id}>
              <button type="button" onClick={() => onTogglePerson(e.account_id)} aria-pressed={on}
                className={`${ROW} h-10 ${on ? "bg-[#567FB2]/15" : "hover:bg-[var(--bg-surface-hover)]"}`}>
                <MiniAvatar info={e} size={24} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate font-medium text-[var(--text-primary)]">{nameOf(e)}</span>
                  <span className="block truncate text-[10.5px] text-[var(--text-dim)]">{e.position || e.department || `@${e.username}`}</span>
                </span>
                {on && <CheckIcon size={14} className="text-[#7FA9D6] shrink-0" />}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function DuePicker({ t, lang, day, time, onDue }: {
  t: TFn; lang: string; day: string | null; time: string | null; onDue: (day: string | null, time: string | null) => void;
}) {
  /* The box is for an off-grid time; a preset stays on its own button. */
  const [typed, setTyped] = useState(time && !TIMES.includes(time) ? time : "");
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((8 - now.getDay()) % 7 || 7));
  const quick = [
    { k: "today", label: t("date.today"), v: isoDay(now) },
    { k: "tomorrow", label: t("date.tomorrow"), v: isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)) },
    { k: "next", label: t("quick.nextWeek"), v: isoDay(monday) },
  ];
  const setTime = (v: string | null) => { setTyped(""); onDue(day ?? isoDay(now), v); };
  const pill = (on: boolean) => `h-8 px-3 rounded-lg text-[11.5px] font-semibold border transition-colors ${on ? "bg-[#567FB2]/15 border-[#567FB2]/30 text-[#7FA9D6]" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`;
  const sub = "text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-1.5";
  return (
    <div className="p-3 space-y-3">
      <div>
        <div className={sub}>{t("f.dueDate")}</div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {quick.map((q) => (
            <button key={q.k} type="button" onClick={() => onDue(q.v, time)} aria-pressed={day === q.v} className={pill(day === q.v)}>{q.label}</button>
          ))}
        </div>
        <DatePicker value={day ?? ""} onChange={(v) => onDue(v || null, v ? time : null)} lang={lang} heightCls="h-9" placeholder={t("f.selectDate")} />
      </div>
      <div>
        <div className={sub}>{t("f.dueTime")}</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {TIMES.map((v) => (
            <button key={v} type="button" onClick={() => setTime(time === v ? null : v)} aria-pressed={time === v} className={`${pill(time === v)} tabular-nums`}>{v}</button>
          ))}
          <input value={typed} inputMode="numeric" maxLength={5} placeholder="HH:MM" aria-label={t("f.dueTime")}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d:]/g, "");
              setTyped(v);
              const m = /^([01]?\d|2[0-3]):?([0-5]\d)$/.exec(v);
              if (m) onDue(day ?? isoDay(now), `${m[1].padStart(2, "0")}:${m[2]}`);
            }}
            className="w-[72px] h-8 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] tabular-nums text-center text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]" />
        </div>
      </div>
      {(day || time) && (
        <button type="button" onClick={() => { setTyped(""); onDue(null, null); }}
          className="h-8 px-2.5 rounded-lg text-[11.5px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] inline-flex items-center gap-1">
          <CrossIcon size={10} /> {t("common.clear")}
        </button>
      )}
    </div>
  );
}
