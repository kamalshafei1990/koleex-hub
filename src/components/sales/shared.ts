/* Shared types + class tokens for the Sales app. Mirrors the HR
   shared-module pattern so the two feel like siblings. */

export type SalesTabId =
  | "dashboard"
  | "pipeline"
  | "quotations"
  | "orders"
  | "invoices"
  | "customers"
  | "activities"
  | "reports";

export const SALES_TAB_IDS: SalesTabId[] = [
  "dashboard", "pipeline", "quotations", "orders",
  "invoices", "customers", "activities", "reports",
];

export const SALES_TAB_LABEL_KEYS: Record<SalesTabId, string> = {
  dashboard:  "sales.tabDashboard",
  pipeline:   "sales.tabPipeline",
  quotations: "sales.tabQuotations",
  orders:     "sales.tabOrders",
  invoices:   "sales.tabInvoices",
  customers:  "sales.tabCustomers",
  activities: "sales.tabActivities",
  reports:    "sales.tabReports",
};

/* Shared design tokens (use these instead of inlining) so the Sales
   app matches HR/Contacts/Products visually. */
export const cardCls = "bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)]";
export const sectionTitleCls = "text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-3 flex items-center gap-2";
export const linkBtnCls = "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors";

/* Money formatter (USD default — matches the existing invoices lib). */
export function formatMoney(amount: number, currency = "USD"): string {
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function relativeTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  const diff = Date.now() - dt.getTime();
  const min = Math.round(diff / 60000);
  const hr  = Math.round(diff / 3600000);
  const day = Math.round(diff / 86400000);
  if (Math.abs(min) < 60) return min === 0 ? "now" : `${Math.abs(min)}m ${min < 0 ? "from now" : "ago"}`;
  if (Math.abs(hr) < 24) return `${Math.abs(hr)}h ${hr < 0 ? "from now" : "ago"}`;
  if (Math.abs(day) < 30) return `${Math.abs(day)}d ${day < 0 ? "from now" : "ago"}`;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
