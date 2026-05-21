"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";
import { EmptyState, SectionCard, StatusBadge } from "@/components/finance/FinanceUi";
import { HeroKpiCard, MetricCard } from "@/components/finance/FinanceUiX";
import { fmtMoney } from "@/lib/finance/calc";
import { useBaseCurrency } from "@/lib/hooks/useBaseCurrency";
import type { FinanceNotification } from "@/lib/finance/types";

/* Severity model — driven by how far past (or before) the due date.
   We bucket into 4 levels so the UI can colour-code consistently.
       overdue > 7 days   → critical
       overdue 1..7 days  → urgent
       due today or next 3 days → warning
       due in 4+ days     → normal
   Returned by severityOf below. */
type Severity = "normal" | "warning" | "urgent" | "critical";

function severityOf(due: string): Severity {
  const today = new Date().toISOString().slice(0, 10);
  if (due < today) {
    const dueDate = new Date(due);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 7 ? "critical" : "urgent";
  }
  /* Future-dated: how close? */
  const dueDate = new Date(due);
  const now = new Date();
  const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 3) return "warning";
  return "normal";
}

const SEVERITY_STYLE: Record<Severity, { ring: string; chip: string; label: string }> = {
  normal:   { ring: "border-[var(--border-subtle)]",       chip: "bg-gray-500/15 text-[var(--text-highlight)]",   label: "Normal" },
  warning:  { ring: "border-amber-500/30",       chip: "bg-amber-500/20 text-amber-600 dark:text-amber-300", label: "Warning" },
  urgent:   { ring: "border-rose-500/40",        chip: "bg-rose-500/20 text-rose-600 dark:text-rose-300",   label: "Urgent" },
  critical: { ring: "border-rose-500/60 ring-1 ring-rose-500/30", chip: "bg-rose-500/30 text-rose-700 dark:text-rose-200", label: "Critical" },
};

const OFFSET_OPTIONS = [
  { value: 0, label: "Same day" },
  { value: 1, label: "1 day before" },
  { value: 3, label: "3 days before" },
  { value: 7, label: "7 days before" },
  { value: 14, label: "14 days before" },
];

export default function FinanceNotifications() {
  const { t } = useTranslation(financeT);
  const baseCurrency = useBaseCurrency();
  const [rows, setRows] = useState<FinanceNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/finance/notifications", { cache: "no-store" });
      const j = (await r.json()) as { notifications?: FinanceNotification[] };
      setRows(j.notifications ?? []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = useMemo(() => rows.filter((n) => n.status === "scheduled" || n.status === "snoozed"), [rows]);
  const overdue = useMemo(() => upcoming.filter((n) => n.due_date < today), [upcoming, today]);
  const done = useMemo(() => rows.filter((n) => n.status === "done" || n.status === "sent"), [rows]);

  const kpi = {
    collect: rows.filter((n) => n.type === "collect" && (n.status === "scheduled" || n.status === "snoozed")).reduce((s, n) => s + Number(n.amount), 0),
    pay: rows.filter((n) => n.type === "pay" && (n.status === "scheduled" || n.status === "snoozed")).reduce((s, n) => s + Number(n.amount), 0),
    overdue: overdue.reduce((s, n) => s + Number(n.amount), 0),
  };

  /* Severity buckets — used by the Reminder Center strip + the
     "Critical first" sort below. */
  const bySeverity = useMemo(() => {
    const buckets: Record<Severity, FinanceNotification[]> = { normal: [], warning: [], urgent: [], critical: [] };
    for (const n of upcoming) buckets[severityOf(n.due_date)].push(n);
    return buckets;
  }, [upcoming]);
  const sortedUpcoming = useMemo(() => {
    const order: Severity[] = ["critical", "urgent", "warning", "normal"];
    return order.flatMap((s) => bySeverity[s]);
  }, [bySeverity]);

  const action = async (id: string, act: "done" | "snooze" | "cancel", snooze_days?: number) => {
    await fetch("/api/finance/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: act, snooze_days }),
    });
    void load();
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <FinanceHeader
          title={t("notifications.title", "Reminders")}
          subtitle={t("notifications.subtitle.long", "Command center for money to collect and money to pay — colour-coded by severity.")}
        />

        <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <HeroKpiCard label="Money to Collect" value={kpi.collect} unit={baseCurrency} tone="positive" hint="From customers" loading={loading} />
          <HeroKpiCard label="Money to Pay" value={kpi.pay} unit={baseCurrency} tone="warning" hint="To suppliers + bills" loading={loading} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3">
          <MetricCard label="Overdue" value={kpi.overdue} unit={baseCurrency} tone="negative" hint={`${overdue.length} item${overdue.length === 1 ? "" : "s"} past due`} loading={loading} />
        </div>

        {/* Reminder Center — at-a-glance severity strip */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["critical", "urgent", "warning", "normal"] as const).map((sev) => {
            const items = bySeverity[sev];
            const total = items.reduce((s, n) => s + Number(n.amount), 0);
            const style = SEVERITY_STYLE[sev];
            return (
              <div key={sev} className={`rounded-2xl border bg-[var(--bg-secondary)] p-4 ${style.ring}`}>
                <div className="flex items-center justify-between">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.chip}`}>{style.label}</span>
                  <span className="text-xs text-[var(--text-dim)]">{items.length}</span>
                </div>
                <div className="mt-3 text-lg font-semibold tabular-nums">{fmtMoney(total, baseCurrency, { compact: true })}</div>
                <div className="mt-1 text-[10px] text-[var(--text-dim)]">
                  {sev === "critical" ? "Overdue > 7 days"
                  : sev === "urgent"   ? "Overdue 1–7 days"
                  : sev === "warning"  ? "Due in ≤ 3 days"
                  :                      "Due in 4+ days"}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <SectionCard title="Upcoming Reminders" subtitle="Critical first — colour-coded by severity.">
            {loading ? (
              <div className="py-6 text-center text-sm text-[var(--text-dim)]">Loading…</div>
            ) : sortedUpcoming.length === 0 ? (
              <EmptyState title="Nothing upcoming" hint="Reminders are auto-created when you set a due date on an order or expense." />
            ) : (
              <div className="space-y-3">
                {sortedUpcoming.map((n) => (
                  <ReminderRow key={n.id} n={n} onAction={action} />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Recently Done" subtitle="Reminders you've marked complete.">
            {done.length === 0 ? (
              <div className="py-6 text-center text-sm text-[var(--text-dim)]">No completed reminders yet.</div>
            ) : (
              <div className="space-y-3">
                {done.slice(0, 10).map((n) => (
                  <div key={n.id} className="flex items-center justify-between rounded-lg border border-[var(--border-faint)] bg-[var(--bg-primary)] px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{n.party_name || "—"}</div>
                      <div className="text-[10px] text-[var(--text-dim)]">{n.due_date} · {n.type === "collect" ? "Collected" : "Paid"}</div>
                    </div>
                    <span className={`tabular-nums font-semibold ${n.type === "collect" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {fmtMoney(Number(n.amount), n.currency, { compact: true })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="mt-6">
          <SectionCard
            title="How reminders work"
            subtitle="Phase 1 keeps the foundation simple — Phase 2 will deliver Slack + email pushes."
          >
            <div className="grid gap-3 sm:grid-cols-3 text-sm text-[var(--text-highlight)]">
              <div className="rounded-lg border border-[var(--border-faint)] bg-[var(--bg-primary)] p-3">
                <div className="font-semibold text-emerald-600 dark:text-emerald-400">1. Set a due date</div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">On any order or expense, set the payment due date.</p>
              </div>
              <div className="rounded-lg border border-[var(--border-faint)] bg-[var(--bg-primary)] p-3">
                <div className="font-semibold text-amber-600 dark:text-amber-400">2. Pick lead time</div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">Same day, 1 / 3 / 7 / 14 days before — or a custom number.</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {OFFSET_OPTIONS.map((o) => (
                    <span key={o.value} className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-0.5 text-[10px] text-[var(--text-highlight)]">{o.label}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-[var(--border-faint)] bg-[var(--bg-primary)] p-3">
                <div className="font-semibold text-sky-600 dark:text-sky-400">3. Act when prompted</div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">Reminders appear here. Mark Done, Snooze, or Cancel.</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function ReminderRow({ n, onAction }: { n: FinanceNotification; onAction: (id: string, act: "done" | "snooze" | "cancel", snooze_days?: number) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const sev = severityOf(n.due_date);
  const sevStyle = SEVERITY_STYLE[sev];
  const isOverdue = n.due_date < today;
  const daysFromToday = (() => {
    const due = new Date(n.due_date);
    const now = new Date();
    return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  })();
  const dueLabel =
    daysFromToday === 0 ? "Due today"
    : daysFromToday > 0 ? `Due in ${daysFromToday} day${daysFromToday === 1 ? "" : "s"}`
    : `Overdue by ${Math.abs(daysFromToday)} day${Math.abs(daysFromToday) === 1 ? "" : "s"}`;

  return (
    <div className={`rounded-lg border bg-[var(--bg-primary)] p-3 ${sevStyle.ring}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={n.type} />
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${sevStyle.chip}`}>
              {sevStyle.label}
            </span>
            {isOverdue && sev !== "critical" && (
              <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-600 dark:text-rose-400">Overdue</span>
            )}
          </div>
          <div className="mt-1.5 truncate text-sm font-medium">{n.party_name || "—"}</div>
          <div className="mt-0.5 text-[11px] text-[var(--text-dim)]">
            {dueLabel} · Due {n.due_date}
            {n.reference_type && <span> · {n.reference_type.replace(/_/g, " ")}</span>}
          </div>
        </div>
        <div className={`text-sm font-semibold tabular-nums ${n.type === "collect" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
          {fmtMoney(Number(n.amount), n.currency, { compact: true })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button onClick={() => onAction(n.id, "done")} className="rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] px-2 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15">
          {n.type === "collect" ? "Mark Collected" : "Mark Paid"}
        </button>
        <button onClick={() => onAction(n.id, "snooze", 1)} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-1 text-[11px] text-amber-600 dark:text-amber-400 hover:bg-amber-500/10">Snooze 1d</button>
        <button onClick={() => onAction(n.id, "snooze", 3)} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-1 text-[11px] text-amber-600 dark:text-amber-400 hover:bg-amber-500/10">3d</button>
        <button onClick={() => onAction(n.id, "snooze", 7)} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-1 text-[11px] text-amber-600 dark:text-amber-400 hover:bg-amber-500/10">7d</button>
        <button
          onClick={() => {
            const v = prompt("Snooze how many days?");
            const n_days = v ? parseInt(v, 10) : NaN;
            if (Number.isFinite(n_days) && n_days > 0) onAction(n.id, "snooze", n_days);
          }}
          className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-1 text-[11px] text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
        >
          Custom…
        </button>
        <button onClick={() => onAction(n.id, "cancel")} className="ml-auto rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-white/10">Cancel</button>
      </div>
    </div>
  );
}
