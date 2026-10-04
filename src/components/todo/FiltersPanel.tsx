"use client";

/* Advanced filters — the original inline panel under the toolbar (status,
   department, assignee, label, date range), loaded when first opened. The
   date range uses the Hub's day-first picker, not a native month-first one. */

import KdsSelect from "@/components/kds/Select";
import DatePicker from "@/components/ui/DatePicker";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import type { TodoAssigneeInfo } from "@/types/supabase";
import type { TodoFilters } from "./todo-filters";
import { STATUSES, type TFn } from "./todo-ui";

const TRIGGER = "h-8 ps-3 pe-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none cursor-pointer text-start";

export default function FiltersPanel({ value, onChange, onClear, t, lang, departments, assignees, labels }: {
  value: TodoFilters;
  onChange: (patch: Partial<TodoFilters>) => void;
  onClear: () => void;
  t: TFn;
  lang: string;
  departments: string[];
  assignees: TodoAssigneeInfo[];
  labels: string[];
}) {
  const f = value;
  const active = !!(f.status || f.dept || f.assignee || f.label || f.from || f.to);
  return (
    <div className="pb-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <KdsSelect value={f.status} onChange={(v) => onChange({ status: v as TodoFilters["status"] })}
          options={STATUSES.map((s) => ({ value: s, label: t("st." + s) }))}
          placeholder={t("filters.allStatuses")} triggerClassName={TRIGGER} />
        <KdsSelect value={f.dept} onChange={(v) => onChange({ dept: v })}
          options={departments.map((d) => ({ value: d, label: d }))}
          placeholder={t("filters.allDepts")} triggerClassName={TRIGGER} />
        <KdsSelect value={f.assignee} onChange={(v) => onChange({ assignee: v })}
          options={assignees.map((a) => ({ value: a.account_id, label: a.full_name || a.username }))}
          placeholder={t("filters.allAssignees")} triggerClassName={TRIGGER} />
        <KdsSelect value={f.label} onChange={(v) => onChange({ label: v })}
          options={labels.map((l) => ({ value: l, label: l }))}
          placeholder={t("filters.allLabels")} triggerClassName={TRIGGER} />

        <div className="flex items-center gap-1.5">
          <div className="w-[150px]">
            <DatePicker value={f.from} onChange={(v) => onChange({ from: v })} placeholder={t("filters.fromDate")}
              lang={lang} heightCls="h-8" max={f.to || undefined} floating />
          </div>
          <span className="text-[11px] text-[var(--text-dim)] rtl:rotate-180">→</span>
          <div className="w-[150px]">
            <DatePicker value={f.to} onChange={(v) => onChange({ to: v })} placeholder={t("filters.toDate")}
              lang={lang} heightCls="h-8" min={f.from || undefined} floating />
          </div>
        </div>

        {active && (
          <button type="button" onClick={onClear}
            className="h-8 px-3 rounded-lg text-[11px] font-medium text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1">
            <CrossIcon size={12} /> {t("filters.clearBtn")}
          </button>
        )}
      </div>
    </div>
  );
}
