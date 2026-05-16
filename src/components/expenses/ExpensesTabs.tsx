"use client";

/* ---------------------------------------------------------------------------
   ExpensesTabs — sub-navigation for the Expenses app.

   Stateful (driven by the parent's `value` / `onChange`) because we want
   tab clicks to flip the visible list without a route change. Mirrors
   the FinanceTabs visual language: rounded-xl pill row, white/0.08
   border, primary-bg surface, active pill in white/0.10 with a soft
   inset shadow.

   The counts shown in each tab are passed in so they stay in sync with
   the list page's current filter state.
   --------------------------------------------------------------------------- */

export type ExpensesTabKey = "all" | "unpaid" | "paid" | "overdue";

const TABS: { key: ExpensesTabKey; label: string; tone: string }[] = [
  { key: "all",     label: "All",     tone: "text-gray-200" },
  { key: "unpaid",  label: "Unpaid",  tone: "text-amber-300" },
  { key: "paid",    label: "Paid",    tone: "text-emerald-300" },
  { key: "overdue", label: "Overdue", tone: "text-rose-300" },
];

export default function ExpensesTabs({
  value,
  onChange,
  counts,
}: {
  value: ExpensesTabKey;
  onChange: (next: ExpensesTabKey) => void;
  counts: { all: number; unpaid: number; paid: number; overdue: number };
}) {
  return (
    <nav aria-label="Expenses filters" className="overflow-x-auto">
      <div className="inline-flex items-center gap-1 rounded-xl border border-white/[0.08] bg-[var(--bg-primary)] p-1 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
        {TABS.map((t) => {
          const active = value === t.key;
          const count = counts[t.key];
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              className={
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition " +
                (active
                  ? "bg-white/[0.10] text-[var(--text-primary)] shadow-sm"
                  : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200")
              }
            >
              <span className={active ? "" : t.tone}>{t.label}</span>
              <span className={
                "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums " +
                (active ? "bg-white/[0.08] text-gray-200" : "bg-white/[0.04] text-gray-500")
              }>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
