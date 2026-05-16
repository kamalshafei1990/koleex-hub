"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FinanceTabs from "@/components/finance/FinanceTabs";
import {
  EmptyState,
  KpiCard,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@/components/finance/FinanceUi";
import { fmtMoney } from "@/lib/finance/calc";
import type { FinanceNotification } from "@/lib/finance/types";

const OFFSET_OPTIONS = [
  { value: 0, label: "Same day" },
  { value: 1, label: "1 day before" },
  { value: 3, label: "3 days before" },
  { value: 7, label: "7 days before" },
  { value: 14, label: "14 days before" },
];

export default function FinanceNotifications() {
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
        <PageHeader
          title="Reminders"
          subtitle="Money to collect from customers and money to pay to suppliers — with your chosen lead time."
        />
        <div className="mt-5"><FinanceTabs /></div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KpiCard label="Money to Collect" value={kpi.collect} currency="USD" accent="emerald" loading={loading} />
          <KpiCard label="Money to Pay" value={kpi.pay} currency="USD" accent="rose" loading={loading} />
          <KpiCard label="Overdue" value={kpi.overdue} currency="USD" accent="rose" loading={loading} hint={`${overdue.length} item(s)`} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <SectionCard title="Upcoming Reminders" subtitle="Sorted by remind-at date.">
            {loading ? (
              <div className="py-6 text-center text-sm text-gray-500">Loading…</div>
            ) : upcoming.length === 0 ? (
              <EmptyState title="Nothing upcoming" hint="Reminders are auto-created when you set a due date on an order or expense." />
            ) : (
              <div className="space-y-3">
                {upcoming.map((n) => (
                  <ReminderRow key={n.id} n={n} onAction={action} />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Recently Done" subtitle="Reminders you've marked complete.">
            {done.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500">No completed reminders yet.</div>
            ) : (
              <div className="space-y-3">
                {done.slice(0, 10).map((n) => (
                  <div key={n.id} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-[var(--bg-primary)] px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{n.party_name || "—"}</div>
                      <div className="text-[10px] text-gray-500">{n.due_date} · {n.type === "collect" ? "Collected" : "Paid"}</div>
                    </div>
                    <span className={`tabular-nums font-semibold ${n.type === "collect" ? "text-emerald-400" : "text-rose-400"}`}>
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
            <div className="grid gap-3 sm:grid-cols-3 text-sm text-gray-300">
              <div className="rounded-lg border border-white/[0.04] bg-[var(--bg-primary)] p-3">
                <div className="font-semibold text-emerald-400">1. Set a due date</div>
                <p className="mt-1 text-xs text-gray-400">On any order or expense, set the payment due date.</p>
              </div>
              <div className="rounded-lg border border-white/[0.04] bg-[var(--bg-primary)] p-3">
                <div className="font-semibold text-amber-400">2. Pick lead time</div>
                <p className="mt-1 text-xs text-gray-400">Same day, 1 / 3 / 7 / 14 days before — or a custom number.</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {OFFSET_OPTIONS.map((o) => (
                    <span key={o.value} className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[10px] text-gray-300">{o.label}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-white/[0.04] bg-[var(--bg-primary)] p-3">
                <div className="font-semibold text-sky-400">3. Act when prompted</div>
                <p className="mt-1 text-xs text-gray-400">Reminders appear here. Mark Done, Snooze, or Cancel.</p>
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
  const isOverdue = n.due_date < today;
  const direction = n.type === "collect" ? "Money to collect" : "Money to pay";
  return (
    <div className="rounded-lg border border-white/[0.04] bg-[var(--bg-primary)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusBadge status={n.type} />
            {isOverdue && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-400">Overdue</span>}
          </div>
          <div className="mt-1.5 truncate text-sm font-medium">{n.party_name || "—"}</div>
          <div className="mt-0.5 text-[11px] text-gray-500">Due {n.due_date} · Remind on {n.remind_at}</div>
        </div>
        <div className={`text-sm font-semibold tabular-nums ${n.type === "collect" ? "text-emerald-400" : "text-rose-400"}`}>
          {fmtMoney(Number(n.amount), n.currency, { compact: true })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onAction(n.id, "done")} className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11px] text-emerald-400 hover:bg-emerald-500/10">Mark Done</button>
        <button onClick={() => onAction(n.id, "snooze", 1)} className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11px] text-amber-400 hover:bg-amber-500/10">Snooze 1d</button>
        <button onClick={() => onAction(n.id, "snooze", 7)} className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11px] text-amber-400 hover:bg-amber-500/10">Snooze 7d</button>
        <button onClick={() => onAction(n.id, "cancel")} className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11px] text-gray-400 hover:bg-white/10">Cancel</button>
      </div>
            {(n.reference_type) && (
        <div className="mt-2 text-[10px] text-gray-500">Linked to {n.reference_type.replace(/_/g, " ")}</div>
      )}
    </div>
  );
}
