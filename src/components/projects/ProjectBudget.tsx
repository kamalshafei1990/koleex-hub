"use client";

/* ---------------------------------------------------------------------------
   ProjectBudget — planned vs actual for one project.

   Actual hours = Σ project_tasks.logged_hours (itself derived from time
   entries by the single writer, src/lib/server/project-time.ts). Actual
   amount = hours × billing_rate, only when a rate exists; otherwise the
   amount row is omitted and the meter says "hours only". Callers pass the
   hours they already hold (the board has every task; Reporting has every
   visible task) — no extra fetch.
   --------------------------------------------------------------------------- */

import { useTranslation } from "@/lib/i18n";
import { projectsT } from "@/lib/translations/projects";
import { TriangleWarningIcon } from "@/components/icons/ui";
import type { ProjectRow, TaskRow } from "@/lib/projects";

export interface BudgetSummary {
  loggedHours: number;
  budgetHours: number | null;
  rate: number | null;
  actualAmount: number | null;
  budgetAmount: number | null;
  currency: string | null;
  overHours: boolean;
  overAmount: boolean;
  hasBudget: boolean;
}

export function sumLoggedHours(tasks: Pick<TaskRow, "logged_hours">[]): number {
  return Math.round(tasks.reduce((s, tk) => s + (Number(tk.logged_hours) || 0), 0) * 100) / 100;
}

export function budgetSummary(project: ProjectRow, loggedHours: number): BudgetSummary {
  const budgetHours = project.budget_hours != null ? Number(project.budget_hours) : null;
  const budgetAmount = project.budget_amount != null ? Number(project.budget_amount) : null;
  const rate = project.billing_rate != null && Number(project.billing_rate) > 0 ? Number(project.billing_rate) : null;
  const actualAmount = rate != null ? Math.round(loggedHours * rate * 100) / 100 : null;
  return {
    loggedHours,
    budgetHours,
    rate,
    actualAmount,
    budgetAmount,
    currency: project.currency ?? null,
    overHours: budgetHours != null && budgetHours > 0 && loggedHours > budgetHours,
    overAmount: budgetAmount != null && budgetAmount > 0 && actualAmount != null && actualAmount > budgetAmount,
    hasBudget: (budgetHours ?? 0) > 0 || (budgetAmount ?? 0) > 0,
  };
}

const LOCALE: Record<string, string> = { en: "en-GB", zh: "zh-CN", ar: "ar-EG" };

export function formatMoney(n: number, currency: string | null, lang: string): string {
  const loc = LOCALE[lang] ?? "en-GB";
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    try {
      return new Intl.NumberFormat(loc, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
    } catch { /* unknown code — fall through */ }
  }
  return new Intl.NumberFormat(loc, { maximumFractionDigits: 2 }).format(n);
}

export function formatHours(n: number, lang: string): string {
  return `${new Intl.NumberFormat(LOCALE[lang] ?? "en-GB", { maximumFractionDigits: 1 }).format(n)}h`;
}

function Meter({
  label,
  actual,
  planned,
  actualText,
  plannedText,
  over,
}: {
  label: string;
  actual: number;
  planned: number | null;
  actualText: string;
  plannedText: string | null;
  over: boolean;
}) {
  const { t } = useTranslation(projectsT);
  const pct = planned && planned > 0 ? Math.min(100, Math.round((actual / planned) * 100)) : 0;
  const text = plannedText
    ? t("budget.of").replace("{actual}", actualText).replace("{planned}", plannedText)
    : t("budget.logged").replace("{actual}", actualText);
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-semibold text-[var(--text-dim)] uppercase tracking-wider text-[10px]">{label}</span>
        <span className={`tabular-nums font-semibold truncate ${over ? "text-rose-400" : "text-[var(--text-muted)]"}`}>{text}</span>
      </div>
      {planned != null && planned > 0 && (
        <div
          className="h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden"
          role="progressbar"
          aria-label={label}
          aria-valuenow={Math.round((actual / planned) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={text}
        >
          <div className={`h-full rounded-full transition-all ${over ? "bg-rose-500" : "bg-[#567FB2] dark:bg-[#7FA9D6]"}`} style={{ width: `${over ? 100 : pct}%` }} />
        </div>
      )}
    </div>
  );
}

/** Hours + amount meters. `compact` = the one-line header variant. */
export function BudgetMeter({ summary, compact = false }: { summary: BudgetSummary; compact?: boolean }) {
  const { t, lang } = useTranslation(projectsT);
  const s = summary;
  const over = s.overHours || s.overAmount;
  return (
    <div className={compact ? "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5" : "space-y-2"}>
      <div className={compact ? "sm:w-64" : ""}>
        <Meter
          label={t("budget.hours")}
          actual={s.loggedHours}
          planned={s.budgetHours}
          actualText={formatHours(s.loggedHours, lang)}
          plannedText={s.budgetHours != null && s.budgetHours > 0 ? formatHours(s.budgetHours, lang) : null}
          over={s.overHours}
        />
      </div>
      {s.actualAmount != null ? (
        <div className={compact ? "sm:w-64" : ""}>
          <Meter
            label={t("budget.amount")}
            actual={s.actualAmount}
            planned={s.budgetAmount}
            actualText={formatMoney(s.actualAmount, s.currency, lang)}
            plannedText={s.budgetAmount != null && s.budgetAmount > 0 ? formatMoney(s.budgetAmount, s.currency, lang) : null}
            over={s.overAmount}
          />
        </div>
      ) : (
        (s.budgetAmount ?? 0) > 0 && <div className="text-[10.5px] text-[var(--text-dim)]">{t("budget.noRate")}</div>
      )}
      {over && (
        <span role="status" className="inline-flex items-center gap-1 self-start text-[10.5px] font-bold uppercase tracking-wide text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded px-1.5 py-0.5">
          <TriangleWarningIcon size={10} /> {t("budget.over")}
        </span>
      )}
    </div>
  );
}
