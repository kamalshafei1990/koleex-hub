/* ---------------------------------------------------------------------------
   The number reports (Reports 6C) — the pure pieces the two pages, their
   paper and validate:reports share: which reports and tabs exist, how an
   amount reads, the quick periods, and the words for labels the server
   sends in English.

   AN AMOUNT IS ALWAYS "CODE 1,234.50" — the code, never a symbol (¥ is both
   the yuan and the yen), Latin digits in every language like the rest of
   the Hub, and one line per currency: two currencies are never added.
   --------------------------------------------------------------------------- */

/** Amounts by currency code. */
export type Money = Record<string, number>;

export const OPS_KINDS = ["sales", "purchases", "expenses", "inventory", "customers", "suppliers"] as const;
export type OpsKind = (typeof OPS_KINDS)[number];
/** The reports read over a period; the rest are as of today. */
export const DATED_KINDS: ReadonlySet<OpsKind> = new Set(["sales", "purchases", "expenses"]);
/** The reports that carry costs — the route answers 403 without the Roles
 *  «private records» switch. Mirror of the route's RESTRICTED set (the
 *  validator keeps the two equal). */
export const COST_KINDS: ReadonlySet<OpsKind> = new Set(["purchases", "expenses", "inventory"]);

export const STATEMENT_TABS = ["pl", "bs", "cf", "ar", "ap"] as const;
export type StatementTab = (typeof STATEMENT_TABS)[number];
/** Read over a period (from–to); the rest as of one day. */
export const RANGED_TABS: ReadonlySet<StatementTab> = new Set(["pl", "cf"]);

export const AGING_BUCKETS = ["current", "1-30", "31-60", "61-90", "90+"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export const isOpsKind = (v: unknown): v is OpsKind => typeof v === "string" && (OPS_KINDS as readonly string[]).includes(v);
export const isStatementTab = (v: unknown): v is StatementTab => typeof v === "string" && (STATEMENT_TABS as readonly string[]).includes(v);
export const isYmd = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

const GROUPED = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const WHOLE = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** "1,234.50" — negative as "−1,234.50" (a real minus, not a hyphen). */
export function fmtAmount(n: number): string {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return v < 0 ? `−${GROUPED.format(-v)}` : GROUPED.format(v === 0 ? 0 : v);
}
/** A count or a quantity: no forced decimals. */
export const fmtCount = (n: number) => WHOLE.format(Number(n) || 0);
export const moneyLine = (code: string, n: number) => `${code} ${fmtAmount(n)}`;

/** The currency codes in reading order: the base first, the others by code. */
export function currencyOrder(base: string, ...ms: Array<Money | undefined>): string[] {
  const codes = new Set<string>();
  for (const m of ms) for (const [c, v] of Object.entries(m ?? {})) if (Math.abs(v) > 0.004) codes.add(c);
  return [...codes].sort((a, b) => (a === base ? -1 : b === base ? 1 : a.localeCompare(b)));
}

/** One line per currency with money in it; nothing at all → one "—"-free
 *  zero in the base currency, so an empty cell still reads as an amount. */
export function moneyLines(m: Money | undefined, base: string): string[] {
  const codes = currencyOrder(base, m);
  return codes.length ? codes.map((c) => moneyLine(c, m![c])) : [moneyLine(base, 0)];
}

/** "26/09/2026" — the Hub's day-first rule, for a YYYY-MM-DD or a moment. */
export function dmy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m && iso.length <= 10) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
/** "26/09/2026 14:05" — local. */
export function dmyHm(d: Date): string {
  return `${dmy(ymdOf(d))} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Local calendar day as YYYY-MM-DD. */
export function ymdOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type RangeKey = "month" | "quarter" | "year" | "lastYear";
export type AsOfKey = "today" | "monthEnd" | "yearEnd";

/** The quick periods, from today (a local YYYY-MM-DD). */
export function quickRange(key: RangeKey, today: string): { from: string; to: string } {
  const [y, m] = today.split("-").map(Number);
  switch (key) {
    case "month": return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: today };
    case "quarter": { const q0 = Math.floor((m - 1) / 3) * 3 + 1; return { from: `${y}-${String(q0).padStart(2, "0")}-01`, to: today }; }
    case "year": return { from: `${y}-01-01`, to: today };
    case "lastYear": return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
  }
}

export function quickAsOf(key: AsOfKey, today: string): string {
  const [y, m] = today.split("-").map(Number);
  if (key === "today") return today;
  if (key === "yearEnd") return `${y - 1}-12-31`;
  /* The last day of last month: day 0 of this month. */
  return ymdOf(new Date(y, m - 1, 0));
}

/** The cash-flow line labels the server writes in English
 *  (lib/accounting/statements CASH_FLOW_LABELS) → their words. Anything
 *  else is shown as sent. */
export const CASH_FLOW_LINE_WORDS: Record<string, string> = {
  "Customer collections": "num.cf.line.collections",
  "Supplier payments": "num.cf.line.supplierPay",
  "Operating disbursements": "num.cf.line.operatingPay",
  "Unclassified bank inflow": "num.cf.line.inflow",
  "Unclassified bank outflow": "num.cf.line.outflow",
  "Opening / capital movements": "num.cf.line.capital",
  "Salaries paid": "num.cf.line.salaries",
  "Currency exchange": "num.cf.line.fx",
  "Reversals": "num.cf.line.reversals",
  "Manual entries": "num.cf.line.manual",
  "Other": "num.cf.line.other",
};

/** "{p}% of revenue" with one decimal — a real minus like every amount,
 *  never "-0.0". */
export const pct = (n: number) => {
  const v = Math.round((Number(n) || 0) * 10) / 10;
  return v < 0 ? `−${(-v).toFixed(1)}` : (v === 0 ? 0 : v).toFixed(1);
};
