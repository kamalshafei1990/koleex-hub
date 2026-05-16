"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FinanceHeader from "@/components/finance/FinanceHeader";
import {
  EmptyState,
  KpiCard,
  SectionCard,
  StatusBadge,
} from "@/components/finance/FinanceUi";
import { accentBgClass, accentSolidBg, styleForCategory } from "@/components/finance/categoryStyles";
import { fmtMoney, fmtPct } from "@/lib/finance/calc";
import type { ExpenseCategory, FinanceExpense } from "@/lib/finance/types";

export default function FinanceExpenses() {
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<FinanceExpense> | null>(null);

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

  /* Build per-category breakdown + month-over-month delta for insights. */
  const categoryBreakdown = useMemo(() => {
    const today = new Date();
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const map = new Map<string, { name: string; total: number; thisMonth: number; lastMonth: number; count: number }>();
    for (const e of expenses) {
      const name = e.category_name || "Other";
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
  }, [expenses]);

  const insights = useMemo(() => {
    /* "Recent increases" — categories where this-month spend grew vs last
       month by more than 25%. "Unusual" — expenses that are 3× the median
       of their category. */
    const recent = categoryBreakdown.filter((c) => c.delta_pct != null && c.delta_pct > 25);
    const median = (xs: number[]) => {
      if (xs.length === 0) return 0;
      const s = [...xs].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };
    const byCat = new Map<string, number[]>();
    for (const e of expenses) {
      const k = e.category_name || "Other";
      const arr = byCat.get(k) ?? [];
      arr.push(Number(e.amount) || 0);
      byCat.set(k, arr);
    }
    const unusual = expenses.filter((e) => {
      const arr = byCat.get(e.category_name || "Other") ?? [];
      if (arr.length < 3) return false;
      const m = median(arr);
      return m > 0 && (Number(e.amount) || 0) > m * 3;
    });
    return { recent, unusual };
  }, [categoryBreakdown, expenses]);

  const startNew = () => setEditing({
    title: "",
    amount: 0,
    currency: "USD",
    expense_date: new Date().toISOString().slice(0, 10),
    payment_status: "unpaid",
    category_id: null,
  });

  const save = async () => {
    if (!editing) return;
    if (!editing.title?.trim() || !editing.amount) {
      alert("Please add a title and amount.");
      return;
    }
    const r = await fetch("/api/finance/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    if (!r.ok) { alert("Save failed"); return; }
    setEditing(null);
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    await fetch(`/api/finance/expenses/${id}`, { method: "DELETE" });
    void load();
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <FinanceHeader
          title="Expenses"
          subtitle="Record what the business spends — by category, with links to orders and suppliers."
          action={
            <button onClick={startNew} className="rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-sm font-medium text-[var(--text-inverted)] hover:opacity-90 active:scale-95">+ New Expense</button>
          }
        />

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Expenses" value={kpi.total} currency="USD" accent="rose" loading={loading} />
          <KpiCard label="Paid" value={kpi.paid} currency="USD" accent="emerald" loading={loading} />
          <KpiCard label="Unpaid" value={kpi.unpaid} currency="USD" accent="amber" loading={loading} />
          <KpiCard label="Overdue" value={kpi.overdue} currency="USD" accent="rose" loading={loading} />
        </div>

        {/* Visual category cards — one tile per category with glyph, color,
            share of total, and month-over-month trend arrow. Click filters
            the table below. */}
        {categoryBreakdown.length > 0 && (
          <div className="mt-6">
            <SectionCard
              title="By Category"
              subtitle="Each tile shows total spend, share of all expenses, and month-over-month change."
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {categoryBreakdown.slice(0, 10).map((c) => {
                  const style = styleForCategory(c.name);
                  return (
                    <div
                      key={c.name}
                      className={`rounded-2xl border ${accentBgClass(style.accent)} bg-[var(--bg-secondary)] p-4 transition hover:border-white/[0.15]`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-lg">{style.glyph}</div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-gray-300">{c.name}</div>
                          <div className="text-[10px] text-gray-500">{c.count} {c.count === 1 ? "expense" : "expenses"}</div>
                        </div>
                      </div>
                      <div className="mt-3 text-lg font-semibold tabular-nums">{fmtMoney(c.total, "USD", { compact: true })}</div>
                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        <span className="text-gray-500">{c.share.toFixed(0)}% of total</span>
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

        {/* Insights — recent increases + unusual expenses */}
        {(insights.recent.length > 0 || insights.unusual.length > 0) && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {insights.recent.length > 0 && (
              <SectionCard title="Recent increases" subtitle="Categories where this-month spend grew >25% vs last month.">
                <ul className="space-y-2">
                  {insights.recent.map((c) => {
                    const style = styleForCategory(c.name);
                    return (
                      <li key={c.name} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-[var(--bg-primary)] px-3 py-2">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{style.glyph}</span>
                          <div>
                            <div className="text-sm font-medium">{c.name}</div>
                            <div className="text-[10px] text-gray-500">This month {fmtMoney(c.thisMonth, "USD", { compact: true })} · last month {fmtMoney(c.lastMonth, "USD", { compact: true })}</div>
                          </div>
                        </div>
                        <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                          ▲ {fmtPct(c.delta_pct ?? 0)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </SectionCard>
            )}
            {insights.unusual.length > 0 && (
              <SectionCard title="Unusual expenses" subtitle="Items 3× larger than the median for their category.">
                <ul className="space-y-2">
                  {insights.unusual.slice(0, 6).map((e) => (
                    <li key={e.id} className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{e.title}</div>
                        <div className="text-[10px] text-gray-500">{e.expense_date} · {e.category_name ?? "Other"}</div>
                      </div>
                      <span className="font-semibold tabular-nums text-amber-300">{fmtMoney(Number(e.amount) || 0, e.currency, { compact: true })}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}
          </div>
        )}

        {editing && (
          <div className="mt-6">
            <SectionCard
              title={editing.id ? "Edit expense" : "New expense"}
              action={
                <div className="flex gap-2">
                  <button onClick={() => setEditing(null)} className="rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-white/[0.12]">Cancel</button>
                  <button onClick={save} className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/30">Save</button>
                </div>
              }
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Title" wide>
                  <input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="e.g. Sea freight Q2" className={INPUT} />
                </Field>
                <Field label="Amount">
                  <input type="number" inputMode="decimal" value={editing.amount ?? 0} onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) || 0 })} className={INPUT} />
                </Field>
                <Field label="Currency">
                  <select value={editing.currency ?? "USD"} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} className={INPUT}>
                    {["USD","EUR","CNY","EGP","GBP"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Date">
                  <input type="date" value={editing.expense_date ?? ""} onChange={(e) => setEditing({ ...editing, expense_date: e.target.value })} className={INPUT} />
                </Field>
                <Field label="Category">
                  <select value={editing.category_id ?? ""} onChange={(e) => setEditing({ ...editing, category_id: e.target.value || null })} className={INPUT}>
                    <option value="">—</option>
                    {categories.filter((c) => !c.parent_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select value={editing.payment_status ?? "unpaid"} onChange={(e) => setEditing({ ...editing, payment_status: e.target.value as FinanceExpense["payment_status"] })} className={INPUT}>
                    {(["unpaid","partial","paid","overdue"] as const).map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Due date">
                  <input type="date" value={editing.due_date ?? ""} onChange={(e) => setEditing({ ...editing, due_date: e.target.value || null })} className={INPUT} />
                </Field>
                <Field label="Linked supplier">
                  <input value={editing.linked_supplier_id ?? ""} onChange={(e) => setEditing({ ...editing, linked_supplier_id: e.target.value || null })} placeholder="Supplier name or ID" className={INPUT} />
                </Field>
                <Field label="Notes" wide>
                  <input value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} className={INPUT} />
                </Field>
              </div>
            </SectionCard>
          </div>
        )}

        <div className="mt-6">
          {loading ? (
            <SectionCard><div className="py-8 text-center text-sm text-gray-500">Loading expenses…</div></SectionCard>
          ) : expenses.length === 0 ? (
            <EmptyState
              title="No expenses recorded yet"
              hint="Track shipping costs, customs duties, banking fees, marketing spend and more."
              action={<button onClick={startNew} className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/30">+ Record First Expense</button>}
            />
          ) : (
            <SectionCard>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-[10px] uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Title</th>
                      <th className="py-2 pr-3">Category</th>
                      <th className="py-2 pr-3 text-right">Amount</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Due</th>
                      <th className="py-2 pr-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id} className="border-t border-white/[0.04] transition hover:bg-white/[0.02]">
                        <td className="py-3 pr-3 text-gray-400 tabular-nums">{e.expense_date}</td>
                        <td className="py-3 pr-3">
                          <div className="font-medium">{e.title || "—"}</div>
                          {e.notes && <div className="text-[11px] text-gray-500">{e.notes}</div>}
                        </td>
                        <td className="py-3 pr-3 text-gray-400">{e.category_name ?? "—"}</td>
                        <td className="py-3 pr-3 text-right tabular-nums font-semibold text-rose-400">−{fmtMoney(e.amount, e.currency, { compact: true })}</td>
                        <td className="py-3 pr-3"><StatusBadge status={e.payment_status} /></td>
                        <td className="py-3 pr-3 text-gray-400 tabular-nums">{e.due_date ?? "—"}</td>
                        <td className="py-3 pr-3 text-right">
                          <button onClick={() => setEditing(e)} className="text-[11px] text-gray-400 hover:text-gray-200">Edit</button>
                          <button onClick={() => remove(e.id)} className="ml-3 text-[11px] text-rose-400 hover:text-rose-300">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}

const INPUT = "w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-sm placeholder-gray-600 focus:border-emerald-500/50 focus:outline-none";

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? "col-span-2" : ""}`}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">{label}</span>
      {children}
    </label>
  );
}
