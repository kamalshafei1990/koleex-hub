"use client";

/* ---------------------------------------------------------------------------
   Filters sheet — every narrowing control in one side sheet, loaded only
   when opened. It replaces a toolbar of four pill groups (priority, source,
   horizon, audience) plus an inline panel, which on a phone pushed the first
   task below the fold before a single filter was even used. What is applied
   stays visible as removable chips under the tabs.
   --------------------------------------------------------------------------- */

import Drawer from "@/components/kds/Drawer";
import KdsSelect from "@/components/kds/Select";
import DatePicker from "@/components/ui/DatePicker";
import type { TodoAssigneeInfo } from "@/types/supabase";
import { NO_FILTERS, type DueFilter, type SourceFilter, type TodoFilters } from "./todo-filters";
import { CHOICE, CHOICE_OFF, CHOICE_ON, FIELD_LABEL, PRIORITIES, PRIORITY_ON, SELECT_TRIGGER, STATUSES, STATUS_DOT, type TFn } from "./todo-ui";

const DUE: DueFilter[] = ["", "overdue", "today", "week", "month", "none"];
const SOURCES: SourceFilter[] = ["all", "mine", "assigned"];

export default function FiltersSheet({ open, onClose, value, onChange, t, lang, isSA, meId, employees, departments, assignees, labels, resultCount }: {
  open: boolean;
  onClose: () => void;
  value: TodoFilters;
  onChange: (patch: Partial<TodoFilters>) => void;
  t: TFn;
  lang: string;
  isSA: boolean;
  meId: string | null;
  employees: TodoAssigneeInfo[];
  departments: string[];
  assignees: TodoAssigneeInfo[];
  labels: string[];
  resultCount: number;
}) {
  const f = value;
  return (
    <Drawer open={open} onClose={onClose} eyebrow={t("app.title")} title={t("filters")} maxWidth="sm:max-w-[420px]"
      footer={
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onChange({ ...NO_FILTERS, saView: f.saView })}
            className="h-10 px-4 rounded-xl text-[12.5px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors">
            {t("filters.clearBtn")}
          </button>
          <button type="button" onClick={onClose}
            className="ms-auto h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-opacity">
            {t("filters.show")} ({resultCount})
          </button>
        </div>
      }>
      {isSA && (
        <div>
          <span className={FIELD_LABEL}>{t("sa.audience")}</span>
          <KdsSelect value={f.saView} onChange={(v) => onChange({ saView: v || "own" })}
            options={[
              { value: "own", label: t("sa.viewOwn") },
              { value: "all", label: t("sa.viewAll") },
              ...employees.filter((e) => e.account_id !== meId).map((e) => ({
                value: e.account_id,
                label: (e.full_name || e.username) + (e.name_alt ? ` · ${e.name_alt}` : ""),
              })),
            ]}
            triggerClassName={SELECT_TRIGGER} />
        </div>
      )}

      <div>
        <span className={FIELD_LABEL}>{t("f.dueDate")}</span>
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={t("f.dueDate")}>
          {DUE.map((d) => (
            <button key={d || "any"} type="button" onClick={() => onChange({ due: d })} aria-pressed={f.due === d}
              className={`h-9 ${CHOICE} ${f.due === d ? CHOICE_ON : CHOICE_OFF}`}>
              {t(d ? "due." + d : "due.any")}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={FIELD_LABEL}>{t("filters.source")}</span>
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={t("filters.source")}>
          {SOURCES.map((s) => (
            <button key={s} type="button" onClick={() => onChange({ source: s })} aria-pressed={f.source === s}
              className={`h-9 ${CHOICE} ${f.source === s ? CHOICE_ON : CHOICE_OFF}`}>
              {s === "all" ? t("src.all") : s === "mine" ? t("src.mine") : t("pill.assignedToMe")}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={FIELD_LABEL}>{t("f.priority")}</span>
        <div className="grid grid-cols-4 gap-1.5" role="group" aria-label={t("f.priority")}>
          <button type="button" onClick={() => onChange({ priority: "" })} aria-pressed={!f.priority}
            className={`h-9 ${CHOICE} ${!f.priority ? CHOICE_ON : CHOICE_OFF}`}>{t("src.all")}</button>
          {PRIORITIES.map((p) => (
            <button key={p} type="button" onClick={() => onChange({ priority: f.priority === p ? "" : p })} aria-pressed={f.priority === p}
              className={`h-9 ${CHOICE} ${f.priority === p ? PRIORITY_ON[p] : CHOICE_OFF}`}>{t("p." + p)}</button>
          ))}
        </div>
      </div>

      <div>
        <span className={FIELD_LABEL}>{t("f.status")}</span>
        <div className="grid grid-cols-2 gap-1.5" role="group" aria-label={t("f.status")}>
          {STATUSES.map((s) => (
            <button key={s} type="button" onClick={() => onChange({ status: f.status === s ? "" : s })} aria-pressed={f.status === s}
              className={`h-9 ${CHOICE} ${f.status === s ? CHOICE_ON : CHOICE_OFF}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s]}`} /> {t("st." + s)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {assignees.length > 0 && (
          <div>
            <span className={FIELD_LABEL}>{t("filters.assignee")}</span>
            <KdsSelect value={f.assignee} onChange={(v) => onChange({ assignee: v })}
              options={assignees.map((a) => ({ value: a.account_id, label: a.full_name || a.username }))}
              placeholder={t("filters.allAssignees")} triggerClassName={SELECT_TRIGGER} />
          </div>
        )}
        {departments.length > 0 && (
          <div>
            <span className={FIELD_LABEL}>{t("filters.department")}</span>
            <KdsSelect value={f.dept} onChange={(v) => onChange({ dept: v })}
              options={departments.map((d) => ({ value: d, label: d }))}
              placeholder={t("filters.allDepts")} triggerClassName={SELECT_TRIGGER} />
          </div>
        )}
        {labels.length > 0 && (
          <div>
            <span className={FIELD_LABEL}>{t("f.label")}</span>
            <KdsSelect value={f.label} onChange={(v) => onChange({ label: v })}
              options={labels.map((l) => ({ value: l, label: l }))}
              placeholder={t("filters.allLabels")} triggerClassName={SELECT_TRIGGER} />
          </div>
        )}
      </div>

      <div>
        <span className={FIELD_LABEL}>{t("filters.range")}</span>
        <p className="text-[11px] text-[var(--text-dim)] -mt-1 mb-2">{t("filters.rangeHint")}</p>
        <div className="grid grid-cols-2 gap-2">
          <DatePicker value={f.from} onChange={(v) => onChange({ from: v })} placeholder={t("filters.fromDate")} lang={lang} heightCls="h-10" max={f.to || undefined} floating />
          <DatePicker value={f.to} onChange={(v) => onChange({ to: v })} placeholder={t("filters.toDate")} lang={lang} heightCls="h-10" min={f.from || undefined} floating />
        </div>
      </div>
    </Drawer>
  );
}
