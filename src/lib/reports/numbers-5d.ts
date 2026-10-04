/* ---------------------------------------------------------------------------
   Reports — the executive and control numbers, worked out (Phase 5D, owner's
   picks 26 Sep 2026). Pure: the loaders (src/lib/server/reports/exec-data.ts
   and control-data.ts) read the rows, these turn them into a block's lines,
   and validate:reports checks them with known figures.

   Money is never added across currencies: a sales or a money line is one
   figure in one currency. A department line is keyed by the department's id
   (a note written on it keeps to it); people with no department come last,
   under NO_DEPT_KEY.
   --------------------------------------------------------------------------- */

import type { ReportDataRow } from "./templates";
import type { TeamPersonFacts } from "./team";

const r2 = (n: number) => Math.round(n * 100) / 100;
const cur = (c: string | null | undefined) => (c || "USD").trim().toUpperCase() || "USD";
const DAY = 86_400_000;
const ms = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`);
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const daysBetween = (from: string, to: string) => Math.round((ms(to) - ms(from)) / DAY);
const addDays = (ymd: string, n: number) => new Date(ms(ymd) + n * DAY).toISOString().slice(0, 10);
/** A date n months on — the last day of a shorter month when the day does not exist (31 Jan + 1 → 28/29 Feb). */
export function addMonths(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
}

/* ── Sales and money: one line per figure and currency ──────────────── */

export const SALES_METRICS = ["quotations_sent", "orders_new", "invoices_issued"] as const;
export type SalesMetric = (typeof SALES_METRICS)[number];
export interface SaleDoc { metric: SalesMetric; currency: string | null; amount: number | string | null }

/** How many, and how much, of each: quotations sent, new orders, invoices
 *  issued — in each currency, the biggest first within a figure. */
export function salesRows(docs: SaleDoc[]): ReportDataRow[] {
  const by = new Map<string, { metric: SalesMetric; currency: string; count: number; amount: number }>();
  for (const d of docs) {
    const k = `${d.metric}:${cur(d.currency)}`;
    const e = by.get(k) ?? { metric: d.metric, currency: cur(d.currency), count: 0, amount: 0 };
    e.count++;
    e.amount = r2(e.amount + (Number(d.amount) || 0));
    by.set(k, e);
  }
  return [...by.values()]
    .sort((a, b) => SALES_METRICS.indexOf(a.metric) - SALES_METRICS.indexOf(b.metric) || b.amount - a.amount || a.currency.localeCompare(b.currency))
    .map((e) => ({ key: `${e.metric}:${e.currency}`, currency: e.currency, cells: { metric: e.metric, count: e.count, amount: e.amount } }));
}

export interface PaymentIn { currency: string | null; amount: number | string | null }
export interface OpenInvoice { currency: string | null; balance: number | string | null; due: string | null }

/** Money in over the days, and what customers still owe — of it, what is
 *  past due by `today` — each in its currency. */
export function moneyRows(payments: PaymentIn[], open: OpenInvoice[], today: string): ReportDataRow[] {
  type Line = { metric: string; currency: string; count: number; amount: number };
  const lines = new Map<string, Line>();
  const add = (metric: string, currency: string | null, amount: number) => {
    const k = `${metric}:${cur(currency)}`;
    const e = lines.get(k) ?? { metric, currency: cur(currency), count: 0, amount: 0 };
    e.count++;
    e.amount = r2(e.amount + amount);
    lines.set(k, e);
  };
  for (const p of payments) add("payments_received", p.currency, Number(p.amount) || 0);
  for (const i of open) {
    const bal = Number(i.balance) || 0;
    if (bal <= 0) continue;
    add("invoices_open", i.currency, bal);
    if (i.due && YMD.test(i.due) && i.due < today) add("invoices_overdue", i.currency, bal);
  }
  const ORDER = ["payments_received", "invoices_open", "invoices_overdue"];
  return [...lines.values()]
    .sort((a, b) => ORDER.indexOf(a.metric) - ORDER.indexOf(b.metric) || b.amount - a.amount || a.currency.localeCompare(b.currency))
    .map((e) => ({ key: `${e.metric}:${e.currency}`, currency: e.currency, cells: { metric: e.metric, count: e.count, amount: e.amount } }));
}

/** The stock picture: items low now (Inventory's one rule), and the
 *  movements in, out and written off over the days. */
export function stockRows(f: { low: number; movesIn: number; movesOut: number; writeoffs: number }): ReportDataRow[] {
  return ([["items_low", f.low], ["moves_in", f.movesIn], ["moves_out", f.movesOut], ["writeoffs", f.writeoffs]] as const)
    .map(([metric, value]) => ({ key: metric, cells: { metric, value } }));
}

/* ── Per department ──────────────────────────────────────────────────── */

/** The line of the people with no department (a valid id, so a note on it keeps). */
export const NO_DEPT_KEY = "00000000-0000-0000-0000-000000000000";

export interface DeptPerson {
  deptId: string | null;
  dept: string | null;
  attendance?: TeamPersonFacts["attendance"];
  workload?: TeamPersonFacts["workload"];
  /** Reports this person sent in the days. */
  sent?: number;
}

type Group = { key: string; name: string; people: DeptPerson[] };
function byDept(people: DeptPerson[], noDept: string): Group[] {
  const groups = new Map<string, Group>();
  for (const p of people) {
    const key = p.deptId && p.dept ? p.deptId : NO_DEPT_KEY;
    const g = groups.get(key) ?? { key, name: key === NO_DEPT_KEY ? noDept : p.dept!, people: [] };
    g.people.push(p);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => Number(a.key === NO_DEPT_KEY) - Number(b.key === NO_DEPT_KEY) || a.name.localeCompare(b.name));
}
const sum = (xs: DeptPerson[], f: (p: DeptPerson) => number | undefined) => xs.reduce((s, p) => s + (f(p) ?? 0), 0);

/** Each department's attendance days — only people whose sheet could be read. */
export function attendanceByDept(people: DeptPerson[], noDept = "—"): ReportDataRow[] {
  return byDept(people.filter((p) => p.attendance), noDept).map((g) => ({ key: g.key, cells: {
    department: g.name, people: g.people.length,
    present: sum(g.people, (p) => p.attendance?.present), late_days: sum(g.people, (p) => p.attendance?.late),
    absent: sum(g.people, (p) => p.attendance?.absent), leave_days: sum(g.people, (p) => p.attendance?.leave),
  } }));
}

/** Each department's reports sent: how many people, how many of them wrote, how many reports. */
export function reportsByDept(people: DeptPerson[], noDept = "—"): ReportDataRow[] {
  return byDept(people, noDept).map((g) => ({ key: g.key, cells: {
    department: g.name, people: g.people.length, writers: g.people.filter((p) => (p.sent ?? 0) > 0).length, sent: sum(g.people, (p) => p.sent),
  } }));
}

/** A share of days present, of the days that were present or absent (leave is neither). */
export function presentRate(present: number, absent: number): number | null {
  return present + absent > 0 ? Math.round((present / (present + absent)) * 100) : null;
}

/** Each department side by side: people, present %, late days, absences,
 *  reports sent, work done and overdue. */
export function deptKpiRows(people: DeptPerson[], noDept = "—"): ReportDataRow[] {
  return byDept(people, noDept).map((g) => {
    const withSheet = g.people.filter((p) => p.attendance);
    const present = sum(withSheet, (p) => p.attendance?.present), absent = sum(withSheet, (p) => p.attendance?.absent);
    return { key: g.key, cells: {
      department: g.name, people: g.people.length,
      present_rate: withSheet.length ? presentRate(present, absent) : null,
      late_days: withSheet.length ? sum(withSheet, (p) => p.attendance?.late) : null,
      absent: withSheet.length ? absent : null,
      sent: sum(g.people, (p) => p.sent),
      done_work: sum(g.people, (p) => p.workload?.done), overdue_work: sum(g.people, (p) => p.workload?.overdue),
    } };
  });
}

/* ── Control ─────────────────────────────────────────────────────────── */

/** The sensitive rights an access review lists, in this order. */
export const SENSITIVE_RIGHTS = ["super_admin", "bank_profit", "payroll_reports", "ceo_office", "mgmt_reports", "report_templates", "finance_approvals", "private_records"] as const;
export type SensitiveRight = (typeof SENSITIVE_RIGHTS)[number];

export interface AccountFacts {
  id: string;
  name: string;
  role: string | null;
  rights: SensitiveRight[];
  /** How many apps it opens — null for a super admin (every one). */
  apps: number | null;
  twoFactor: boolean;
  lastLogin: string | null;
  status: string;
}

/** Every account and what it may do: a super admin first, then the most
 *  rights, then by name. */
export function accessRows(list: AccountFacts[]): ReportDataRow[] {
  return [...list]
    .sort((a, b) => Number(b.rights.includes("super_admin")) - Number(a.rights.includes("super_admin")) || b.rights.length - a.rights.length || a.name.localeCompare(b.name))
    .map((a) => ({ key: a.id, cells: {
      person: a.name, role: a.role ?? "—",
      rights: SENSITIVE_RIGHTS.filter((r) => a.rights.includes(r)).join("|"),
      apps: a.apps, two_factor: a.twoFactor ? "on" : "off",
      last_login: a.lastLogin && YMD.test(a.lastLogin.slice(0, 10)) ? a.lastLogin.slice(0, 10) : null,
      status: a.status || "active",
    } }));
}

export interface UsageFacts { id: string; name: string; seconds: number; days: number; signIns: number; last: string | null }

/** Who used the Hub over the days, the most hours first — everyone, the
 *  ones who never did at the end (that is worth seeing too). */
export function usageRows(list: UsageFacts[]): ReportDataRow[] {
  return [...list]
    .sort((a, b) => b.seconds - a.seconds || b.signIns - a.signIns || a.name.localeCompare(b.name))
    .map((u) => ({ key: u.id, cells: {
      person: u.name, hours: Math.round((u.seconds / 3600) * 10) / 10, active_days: u.days, sign_ins: u.signIns,
      last_active: u.last && YMD.test(u.last) ? u.last : null,
    } }));
}

/** What a contract's lead time counts from (its terms): the deposit
 *  received, the order confirmed, the letter of credit opened. */
export type LeadBasis = "after_deposit" | "after_order" | "after_lc_opening";

export interface ContractFacts {
  id: string;
  no: string;
  customer: string;
  basis: LeadBasis | null;
  /** The day the lead time started (the first payment on its invoice, the
   *  order's date) — null while that has not happened, or cannot be read
   *  (an opened letter of credit is not recorded in the Hub). */
  basisDate: string | null;
  leadDays: number | null;
  warrantyMonths: number | null;
}

/** The dates a signed contract sets: delivery due (the lead time from its
 *  basis), then the warranty's end (that delivery + the warranty months).
 *  One line per contract: its nearest date between `back` days ago and
 *  `ahead` days from `today`, with the days left (below zero: past) — or,
 *  while the lead time has not started, what it waits for (no date is
 *  ever guessed). */
export function contractDateRows(list: ContractFacts[], today: string, ahead = 60, back = 30): ReportDataRow[] {
  const lo = addDays(today, -back), hi = addDays(today, ahead);
  const WAITS: Record<LeadBasis, string> = { after_deposit: "waiting_deposit", after_order: "waiting_order", after_lc_opening: "waiting_lc" };
  const rows: ReportDataRow[] = [];
  for (const c of list) {
    if (c.leadDays === null || !Number.isFinite(c.leadDays) || c.leadDays < 0) continue;
    if (!c.basisDate || !YMD.test(c.basisDate)) {
      if (c.basis) rows.push({ key: c.id, cells: { no: c.no || "—", customer: c.customer || "", what: WAITS[c.basis], date: null, days_left: null } });
      continue;
    }
    const delivery = addDays(c.basisDate, Math.round(c.leadDays));
    const warranty = c.warrantyMonths && c.warrantyMonths > 0 ? addMonths(delivery, Math.round(c.warrantyMonths)) : null;
    const dates: Array<[string, string]> = [["delivery_due", delivery], ...(warranty ? [["warranty_ends", warranty] as [string, string]] : [])];
    const due = dates.filter(([, d]) => d >= lo && d <= hi).sort((a, b) => a[1].localeCompare(b[1]))[0];
    if (!due) continue;
    rows.push({ key: c.id, cells: { no: c.no || "—", customer: c.customer || "", what: due[0], date: due[1], days_left: daysBetween(today, due[1]) } });
  }
  /* Dated lines by date, then what still waits. */
  return rows.sort((a, b) => String(a.cells.date ?? "9999").localeCompare(String(b.cells.date ?? "9999")) || String(a.cells.no).localeCompare(String(b.cells.no)));
}
