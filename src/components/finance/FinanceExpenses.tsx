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
        <PageHeader
          title="Expenses"
          subtitle="Record what the business spends — by category, with links to orders and suppliers."
          action={
            <button onClick={startNew} className="rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-sm font-medium text-[var(--text-inverted)] hover:opacity-90 active:scale-95">+ New Expense</button>
          }
        />
        <div className="mt-5"><FinanceTabs /></div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Expenses" value={kpi.total} currency="USD" accent="rose" loading={loading} />
          <KpiCard label="Paid" value={kpi.paid} currency="USD" accent="emerald" loading={loading} />
          <KpiCard label="Unpaid" value={kpi.unpaid} currency="USD" accent="amber" loading={loading} />
          <KpiCard label="Overdue" value={kpi.overdue} currency="USD" accent="rose" loading={loading} />
        </div>

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
