/* Shared types + tokens for the Purchase app. Mirrors the Sales
   pattern so the two procure-to-pay / order-to-cash apps feel like
   siblings. */

/** Props every Purchase module component receives. Lives here (not in
 *  PurchaseApp.tsx) so route pages can construct them without a
 *  dependency on the legacy state-based shell. */
export interface PurchaseModuleProps {
  t: (key: string) => string;
  lang: string;
  /** Optional — legacy hook for state-based navigation. URL-based pages
   *  can omit this; the few modules that still call it will become noops. */
  setActiveTab?: (next: string) => void;
}

export type PurchaseTabId =
  | "dashboard"
  | "requisitions"
  | "rfqs"
  | "orders"
  | "receipts"
  | "bills"
  | "payments"
  | "returns"
  | "suppliers"
  | "contracts"
  | "categories"
  | "pricelists"
  | "approvals"
  | "reports";

export const PURCHASE_TAB_IDS: PurchaseTabId[] = [
  "dashboard",
  "requisitions",
  "rfqs",
  "orders",
  "receipts",
  "bills",
  "payments",
  "returns",
  "suppliers",
  "contracts",
  "categories",
  "pricelists",
  "approvals",
  "reports",
];

export const PURCHASE_TAB_LABEL_KEYS: Record<PurchaseTabId, string> = {
  dashboard:    "purchase.tabDashboard",
  requisitions: "purchase.tabRequisitions",
  rfqs:         "purchase.tabRFQs",
  orders:       "purchase.tabOrders",
  receipts:     "purchase.tabReceipts",
  bills:        "purchase.tabBills",
  payments:     "purchase.tabPayments",
  returns:      "purchase.tabReturns",
  suppliers:    "purchase.tabSuppliers",
  contracts:    "purchase.tabContracts",
  categories:   "purchase.tabCategories",
  pricelists:   "purchase.tabPriceLists",
  approvals:    "purchase.tabApprovals",
  reports:      "purchase.tabReports",
};

/* Two-tier nav. Workflow groups follow the standard procure-to-pay
   pipeline:  request → quote → order → receive → bill → pay.
   Vendors / Setup / Reports sit alongside it. */
export type PurchaseGroupId =
  | "overview"
  | "procurement"
  | "bills"
  | "vendors"
  | "setup"
  | "reports";

export const PURCHASE_GROUPS: Array<{ id: PurchaseGroupId; tabs: PurchaseTabId[] }> = [
  { id: "overview",    tabs: ["dashboard"] },
  { id: "procurement", tabs: ["requisitions", "rfqs", "orders", "receipts"] },
  { id: "bills",       tabs: ["bills", "payments", "returns"] },
  { id: "vendors",     tabs: ["suppliers", "contracts"] },
  { id: "setup",       tabs: ["categories", "pricelists", "approvals"] },
  { id: "reports",     tabs: ["reports"] },
];

export const PURCHASE_GROUP_LABEL_KEYS: Record<PurchaseGroupId, string> = {
  overview:    "purchase.groupOverview",
  procurement: "purchase.groupProcurement",
  bills:       "purchase.groupBills",
  vendors:     "purchase.groupVendors",
  setup:       "purchase.groupSetup",
  reports:     "purchase.groupReports",
};

export function groupForTab(tabId: PurchaseTabId): PurchaseGroupId {
  for (const g of PURCHASE_GROUPS) {
    if (g.tabs.includes(tabId)) return g.id;
  }
  return "overview";
}

/* Shared design tokens (use these instead of inlining) so the
   Purchase app matches Sales / HR / Contacts visually. */
export const cardCls = "bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)]";
export const sectionTitleCls = "text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-3 flex items-center gap-2";
export const linkBtnCls = "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors";

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

/* Status tones reused across PO / Bill / Return / Requisition / RFQ /
   Receipt / Contract list rows. PILL-1 tone classes (KDS StatusPill
   palette): tinted background + matching text + border.

   Keys are lowercased to be tolerant of how each table stores its
   enum text. */
const TONE_NEUTRAL = "bg-[var(--bg-inverted)]/[0.06] text-[var(--text-muted)] border-[var(--border-subtle)]";
const TONE_INFO    = "bg-[#567FB2]/15 text-[#7FA9D6] border-[#567FB2]/40";
const TONE_WARN    = "bg-[#F59E0B]/12 text-[#F59E0B] border-[#F59E0B]/35";
const TONE_OK      = "bg-[#10B981]/12 text-[#10B981] border-[#10B981]/35";
const TONE_BAD     = "bg-[#FF3333]/12 text-[#FF3333] border-[#FF3333]/35";

export const STATUS_TONE_PO: Record<string, string> = {
  draft:     TONE_WARN,
  confirmed: TONE_INFO,
  partial:   TONE_WARN,
  received:  TONE_OK,
  closed:    TONE_NEUTRAL,
  cancelled: TONE_BAD,
};

export const STATUS_TONE_BILL: Record<string, string> = {
  draft:     TONE_WARN,
  posted:    TONE_INFO,
  partial:   TONE_WARN,
  paid:      TONE_OK,
  overdue:   TONE_BAD,
  cancelled: TONE_BAD,
};

export const STATUS_TONE_REQ: Record<string, string> = {
  draft:     TONE_WARN,
  pending:   TONE_WARN,
  approved:  TONE_OK,
  rejected:  TONE_BAD,
  converted: TONE_INFO,
  cancelled: TONE_BAD,
};
