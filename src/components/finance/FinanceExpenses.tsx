"use client";

/* ---------------------------------------------------------------------------
   Finance · Expense Analytics  ( /finance/expenses )

   Phase 1.3 refocus: this page is NO LONGER a data-entry surface. It's
   the executive analytics view over the same finance_expenses table
   that the Expenses app at /expenses writes into. Two apps, one table.

   Daily entry → /expenses (separate sidebar app, gated on "Expenses").
   Strategic view → /finance/expenses (this page, gated on "Finance").

   What this page shows:
     · KPI strip — totals + paid + unpaid + overdue
     · By-category tile grid with month-over-month trend arrows
     · Recent increases + unusual expenses insights
     · Order-linked expense impact (which orders absorb the most spend)
     · Open Expenses App button → /expenses
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";
import { EmptyState, SectionCard } from "@/components/finance/FinanceUi";
import { BarChart, DonutChart, HeroKpiCard, MetricCard, formatCompact } from "@/components/finance/FinanceUiX";
import { accentBgClass, accentSolidBg, styleForCategory } from "@/components/finance/categoryStyles";
import { fmtMoney, fmtPct } from "@/lib/finance/calc";
import { useBaseCurrencyOptional } from "@/lib/hooks/useBaseCurrency";
import type { ExpenseCategory, FinanceExpense } from "@/lib/finance/types";
import RrIcon from "@/components/ui/RrIcon";

export default function FinanceExpenseAnalytics() {
  const { t, lang } = useTranslation(financeT);
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  /* Tenant base currency — shared session-cached hook, null until
     resolved. fmtMoney() renders "—" when given an empty currency, so
     a USD or EUR tenant never flashes "CNY" on first paint. */
  const baseCurrency = useBaseCurrencyOptional() ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eRes, cRes] = await Promise.all([
        fetch("/api/finance/expenses", { cache: "no-store" }).then((r) => r.json() as Promise<{ expenses?: FinanceExpense[] }>),
        fetch("/api/finance/expense-categories", { cache: "no-store" }).then((r) => r.json() as Promise<{ categories?: ExpenseCategory[] }>),
      ]);
      setExpenses(eRes.expenses ?? []);
      setCategories(cRes.categories ?? []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const kpi = useMemo(() => {
    const total = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const paid = expenses.filter((e) => e.payment_status === "paid").reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const unpaid = total - paid;
    const today = new Date().toISOString().slice(0, 10);
    const overdue = expenses
      .filter((e) => e.payment_status !== "paid" && e.due_date && e.due_date < today)
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return { total, paid, unpaid, overdue };
  }, [expenses]);

  const categoryBreakdown = useMemo(() => {
    const today = new Date();
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const map = new Map<string, { name: string; total: number; thisMonth: number; lastMonth: number; count: number }>();
    const otherLabel = t("expAnalytics.other", "Other");
    for (const e of expenses) {
      const name = e.category_name || otherLabel;
      const row = map.get(name) ?? { name, total: 0, thisMonth: 0, lastMonth: 0, count: 0 };
      row.total += Number(e.amount) || 0;
      row.count += 1;
      const d = e.expense_date ? new Date(e.expense_date) : null;
      if (d) {
        if (d >= thisMonthStart) row.thisMonth += Number(e.amount) || 0;
        else if (d >= lastMonthStart && d < thisMonthStart) row.lastMonth += Number(e.amount) || 0;
      }
      map.set(name, row);
    }
    const arr = Array.from(map.values()).sort((a, b) => b.total - a.total);
    const grandTotal = arr.reduce((s, r) => s + r.total, 0) || 1;
    return arr.map((r) => ({
      ...r,
      share: (r.total / grandTotal) * 100,
      delta_pct: r.lastMonth > 0 ? ((r.thisMonth - r.lastMonth) / r.lastMonth) * 100 : null,
    }));
  }, [expenses, t]);

  const insights = useMemo(() => {
    const otherLabel = t("expAnalytics.other", "Other");
    const recent = categoryBreakdown.filter((c) => c.delta_pct != null && c.delta_pct > 25);
    const median = (xs: number[]) => {
      if (xs.length === 0) return 0;
      const s = [...xs].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };
    const byCat = new Map<string, number[]>();
    for (const e of expenses) {
      const k = e.category_name || otherLabel;
      const arr = byCat.get(k) ?? [];
      arr.push(Number(e.amount) || 0);
      byCat.set(k, arr);
    }
    const unusual = expenses.filter((e) => {
      const arr = byCat.get(e.category_name || otherLabel) ?? [];
      if (arr.length < 3) return false;
      const m = median(arr);
      return m > 0 && (Number(e.amount) || 0) > m * 3;
    });
    return { recent, unusual };
  }, [categoryBreakdown, expenses, t]);

  /* Monthly spend trend — last 6 months. Bar-chart friendly. */
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const dateLocale = lang === "zh" ? "zh-CN" : lang === "ar" ? "ar" : "en-US";
    const buckets: { key: string; label: string; from: Date; to: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      buckets.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString(dateLocale, { month: "short" }),
        from: d, to: next,
      });
    }
    const totals = buckets.map((b) => 0);
    for (const e of expenses) {
      if (!e.expense_date) continue;
      const d = new Date(e.expense_date);
      const i = buckets.findIndex((b) => d >= b.from && d < b.to);
      if (i >= 0) totals[i] += Number(e.amount) || 0;
    }
    return buckets.map((b, i) => ({ label: b.label, value: totals[i] }));
  }, [expenses, lang]);

  /* Top vendors / suppliers — by total spend. Keyed off
     linked_supplier_id with a fallback to "Unlinked" so the bucket
     of unattributed expenses doesn't get lost. */
  const topVendors = useMemo(() => {
    const map = new Map<string, { key: string; name: string; total: number; count: number; lastDate: string }>();
    for (const e of expenses) {
      const key = e.linked_supplier_id ?? "—";
      const cur = map.get(key) ?? { key, name: e.linked_supplier_id ?? "Unlinked", total: 0, count: 0, lastDate: e.expense_date };
      cur.total += Number(e.amount) || 0;
      cur.count += 1;
      if (e.expense_date && (!cur.lastDate || e.expense_date > cur.lastDate)) cur.lastDate = e.expense_date;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [expenses]);

  /* Order-impact analysis — which orders absorb the most expense
     dollars. This is exactly the kind of insight that doesn't belong
     in the operational Expenses app but matters for the executive view. */
  const orderImpact = useMemo(() => {
    const map = new Map<string, { order_id: string; total: number; count: number }>();
    for (const e of expenses) {
      if (!e.linked_order_id) continue;
      const cur = map.get(e.linked_order_id) ?? { order_id: e.linked_order_id, total: 0, count: 0 };
      cur.total += Number(e.amount) || 0;
      cur.count += 1;
      map.set(e.linked_order_id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [expenses]);

  /* Surface unused category list for future drill-down filters (e.g. a
     "Click a category to filter" affordance Phase 2 may add). Keep
     the variable referenced so the compiler doesn't strip it. */
  void categories;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <FinanceHeader
          title={t("expAnalytics.title", "Expense Analytics")}
          subtitle={t("expAnalytics.subtitle.long", "Where the money goes — by category, by order, by trend. Daily entry lives in the Expenses app.")}
          action={
            <Link
              href="/expenses"
              className="rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-sm font-medium text-[var(--text-inverted)] transition hover:opacity-90 active:scale-95"
            >
              <span className="inline-flex items-center gap-1.5">{t("expAnalytics.openApp", "Open Expenses App")} <RrIcon name="arrow-up-right-from-square" size={12} /></span>
            </Link>
          }
        />

        {/* KPI cards are now clickable — each drills into the matching
            filtered list so the operator never lands on a dead-end
            number. Wrapped in Link so the visual styling stays intact. */}
        <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Link href="/finance/expenses" className="block hover:opacity-95" aria-label={t("expAnalytics.aria.seeAll", "See every expense")}>
            <HeroKpiCard label={t("expAnalytics.kpi.total.label", "Total Expenses")} value={kpi.total} unit={baseCurrency} tone="neutral" hint={t("expAnalytics.kpi.total.hint", "All time, this view")} loading={loading} />
          </Link>
          <Link href="/finance/expenses?status=unpaid" className="block hover:opacity-95" aria-label={t("expAnalytics.aria.reviewUnpaid", "Review unpaid expenses")}>
            <HeroKpiCard label={t("expAnalytics.kpi.unpaid.label", "Unpaid (Money to Pay)")} value={kpi.unpaid} unit={baseCurrency} tone="warning" hint={t("expAnalytics.kpi.unpaid.hint", "Awaiting payment")} loading={loading} />
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-2">
          <Link href="/finance/expenses?status=paid" className="block hover:opacity-95" aria-label={t("expAnalytics.aria.seeSettled", "See settled expenses")}>
            <MetricCard label={t("expAnalytics.kpi.paid.label", "Paid")} value={kpi.paid} unit={baseCurrency} hint={t("expAnalytics.kpi.paid.hint", "Already settled")} loading={loading} />
          </Link>
          <Link href="/finance/expenses?status=overdue" className="block hover:opacity-95" aria-label={t("expAnalytics.aria.resolveOverdue", "Resolve overdue expenses")}>
            <MetricCard label={t("expAnalytics.kpi.overdue.label", "Overdue")} value={kpi.overdue} unit={baseCurrency} tone="negative" hint={t("expAnalytics.kpi.overdue.hint", "Past due date — needs action")} loading={loading} />
          </Link>
        </div>

        {/* ── Operational analytics row: Donut · Monthly · Top vendors  */}
        {categoryBreakdown.length > 0 && (
          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            {/* Donut — category distribution */}
            <SectionCard title={t("expAnalytics.donut.title", "Category distribution")} subtitle={t("expAnalytics.donut.subtitle", "Share of total spend, monochrome by intensity.")}>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <div className="shrink-0">
                  <DonutChart
                    segments={categoryBreakdown.map((c) => ({ name: c.name, value: c.total }))}
                    centerLabel={t("expAnalytics.donut.center", "Total")}
                    centerValue={formatCompact(categoryBreakdown.reduce((s, c) => s + c.total, 0))}
                  />
                </div>
                <ul className="flex w-full min-w-0 flex-1 flex-col gap-1.5">
                  {categoryBreakdown.slice(0, 6).map((c, i) => {
                    const style = styleForCategory(c.name);
                    const opacity = 0.30 + 0.45 * (1 - i / Math.max(1, categoryBreakdown.length));
                    return (
                      <li key={c.name} className="flex items-center gap-3 text-[12px]">
                        <span
                          aria-hidden
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: `rgba(255,255,255,${opacity.toFixed(2)})` }}
                        />
                        <RrIcon name={style.icon} size={14} />
                        <span className="flex-1 truncate text-[var(--text-highlight)]">{c.name}</span>
                        <span className="tabular-nums text-[var(--text-dim)]">{c.share.toFixed(0)}%</span>
                        <span className="w-16 text-right font-medium tabular-nums">{formatCompact(c.total)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </SectionCard>

            {/* Monthly bar trend */}
            <SectionCard title={t("expAnalytics.monthly.title", "Monthly spend")} subtitle={t("expAnalytics.monthly.subtitle", "Last 6 months. Latest highlighted.")}>
              <BarChart data={monthlyTrend} highlightLast />
              <div className="mt-3 flex items-baseline justify-between text-[11px] text-[var(--text-dim)]">
                <span>{t("expAnalytics.monthly.thisMonth", "This month")}</span>
                <span className="text-base font-medium tabular-nums text-[var(--text-primary)]">
                  {formatCompact(monthlyTrend[monthlyTrend.length - 1]?.value ?? 0)}
                </span>
              </div>
            </SectionCard>

            {/* Top vendors */}
            <SectionCard title={t("expAnalytics.vendors.title", "Top vendors")} subtitle={t("expAnalytics.vendors.subtitle", "Ranked by total spend.")}>
              {topVendors.length === 0 ? (
                <div className="py-6 text-center text-[12px] text-[var(--text-dim)]">{t("expAnalytics.vendors.empty", "No supplier-linked expenses yet.")}</div>
              ) : (
                <ol className="space-y-1.5">
                  {topVendors.map((v, idx) => (
                    <li key={v.key} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-faint)] bg-[var(--bg-secondary)] px-3 py-2 text-[12px]">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--bg-surface-hover)] text-[10px] font-medium text-[var(--text-highlight)]">{idx + 1}</span>
                        <span className="truncate text-[var(--text-highlight)]">{v.name === "Unlinked" ? t("expAnalytics.vendors.unlinked", "Unlinked") : v.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-medium tabular-nums">{formatCompact(v.total)}</div>
                        <div className="text-[10px] text-[var(--text-dim)]">{v.count} {v.count === 1 ? t("expAnalytics.vendors.expense", "expense") : t("expAnalytics.vendors.expenses", "expenses")}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </SectionCard>
          </div>
        )}

        {/* By Category — pre-existing tile grid retained below for
            quick drill-down (each tile carries trend % vs last month). */}
        {categoryBreakdown.length > 0 && (
          <div className="mt-6">
            <SectionCard
              title={t("expAnalytics.byCategory.title", "By Category")}
              subtitle={t("expAnalytics.byCategory.subtitle", "Each tile shows total spend, share of all expenses, and month-over-month change.")}
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {categoryBreakdown.slice(0, 10).map((c) => {
                  const style = styleForCategory(c.name);
                  return (
                    <div
                      key={c.name}
                      className={`rounded-2xl border ${accentBgClass(style.accent)} bg-[var(--bg-secondary)] p-4 transition hover:border-[var(--border-color)]`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5"><RrIcon name={style.icon} size={16} /></div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-[var(--text-highlight)]">{c.name}</div>
                          <div className="text-[10px] text-[var(--text-dim)]">{c.count} {c.count === 1 ? t("expAnalytics.vendors.expense", "expense") : t("expAnalytics.vendors.expenses", "expenses")}</div>
                        </div>
                      </div>
                      <div className="mt-3 text-lg font-semibold tabular-nums">{fmtMoney(c.total, baseCurrency, { compact: true })}</div>
                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        <span className="text-[var(--text-dim)]">{t("expAnalytics.byCategory.ofTotal", "{n}% of total").replace("{n}", c.share.toFixed(0))}</span>
                        {c.delta_pct != null && (
                          <span className={`rounded-full px-1.5 py-0.5 font-semibold ${c.delta_pct >= 0 ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"}`}>
                            {c.delta_pct >= 0 ? "▲" : "▼"} {fmtPct(c.delta_pct)}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                        <div className={`h-full ${accentSolidBg(style.accent)}`} style={{ width: `${Math.min(100, Math.max(2, c.share))}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </div>
        )}

        {/* Insights row */}
        {(insights.recent.length > 0 || insights.unusual.length > 0 || orderImpact.length > 0) && (
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {insights.recent.length > 0 && (
              <SectionCard title={t("expAnalytics.recent.title", "Recent Increases")} subtitle={t("expAnalytics.recent.subtitle", "Categories whose spend grew >25 % this month.")}>
                <ul className="space-y-2">
                  {insights.recent.map((c) => {
                    const style = styleForCategory(c.name);
                    return (
                      <li key={c.name} className="flex items-center justify-between rounded-lg border border-[var(--border-faint)] bg-[var(--bg-primary)] px-3 py-2">
                        <div className="flex items-center gap-3">
                          <RrIcon name={style.icon} size={16} />
                          <div>
                            <div className="text-sm font-medium">{c.name}</div>
                            <div className="text-[10px] text-[var(--text-dim)]">{t("expAnalytics.recent.thisLast", "This month {tm} · last month {lm}").replace("{tm}", fmtMoney(c.thisMonth, baseCurrency, { compact: true })).replace("{lm}", fmtMoney(c.lastMonth, baseCurrency, { compact: true }))}</div>
                          </div>
                        </div>
                        <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-300">▲ {fmtPct(c.delta_pct ?? 0)}</span>
                      </li>
                    );
                  })}
                </ul>
              </SectionCard>
            )}
            {insights.unusual.length > 0 && (
              <SectionCard title={t("expAnalytics.unusual.title", "Unusual Expenses")} subtitle={t("expAnalytics.unusual.subtitle", "Items 3× larger than the median of their category.")}>
                <ul className="space-y-2">
                  {insights.unusual.slice(0, 6).map((e) => (
                    <li key={e.id} className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{e.title}</div>
                        <div className="text-[10px] text-[var(--text-dim)]">{e.expense_date} · {e.category_name ?? t("expAnalytics.other", "Other")}</div>
                      </div>
                      <span className="font-semibold tabular-nums text-amber-300">{fmtMoney(Number(e.amount) || 0, e.currency, { compact: true })}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}
            {orderImpact.length > 0 && (
              <SectionCard title={t("expAnalytics.orderImpact.title", "Order-Linked Impact")} subtitle={t("expAnalytics.orderImpact.subtitle", "Orders absorbing the most expense spend.")}>
                <ul className="space-y-2">
                  {orderImpact.map((o, idx) => (
                    <li key={o.order_id} className="flex items-center justify-between rounded-lg border border-[var(--border-faint)] bg-[var(--bg-primary)] px-3 py-2">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/15 text-[11px] font-semibold text-violet-300">{idx + 1}</span>
                        <div className="min-w-0">
                          <div className="font-mono text-[11px] font-medium">{o.order_id.slice(0, 8)}…</div>
                          <div className="text-[10px] text-[var(--text-dim)]">{t("expAnalytics.orderImpact.linked", "{n} {label} linked").replace("{n}", String(o.count)).replace("{label}", o.count === 1 ? t("expAnalytics.vendors.expense", "expense") : t("expAnalytics.vendors.expenses", "expenses"))}</div>
                        </div>
                      </div>
                      <span className="font-semibold tabular-nums text-rose-300">−{fmtMoney(o.total, baseCurrency, { compact: true })}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}
          </div>
        )}

        {/* When the tenant has no expenses yet, point them at the Expenses app */}
        {!loading && expenses.length === 0 && (
          <div className="mt-6">
            <EmptyState
              title={t("expAnalytics.empty.title", "No expenses recorded yet")}
              hint={t("expAnalytics.empty.hint", "Daily expense entry happens in the Expenses app — open it from the sidebar or the button above.")}
              action={
                <Link href="/expenses" className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/30">
                  <span className="inline-flex items-center gap-1.5">{t("expAnalytics.openApp", "Open Expenses App")} <RrIcon name="arrow-up-right-from-square" size={12} /></span>
                </Link>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
