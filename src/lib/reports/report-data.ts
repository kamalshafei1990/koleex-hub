/* ---------------------------------------------------------------------------
   Reports — numbers from the apps (Phase 4B, owner's pick 25 Sep 2026):
   what each numbers block shows, pure — the composer, the reader, the print
   and the server read the same columns.

   A block lists the AUTHOR's own documents (owner's pick: "the report's
   writer only"): quotations, orders and invoices in the report's period,
   the quotations sent and still unanswered, the invoices with money still
   owed — and (4C) their purchase orders and receipts in the period, the
   items still short on a partly received order, the orders past their
   delivery date, the supplier bills still to pay — and (4D) their own
   expenses in a trip's days — and (5A) a manager's TEAM: its reports,
   attendance and work, one row per person — and (5B, the CEO office) the
   writer's calendar (the day's or the week's events, where the time went,
   the meetings), the follow-ups per department, the birthdays and work
   anniversaries, the visitors of the invitation letters, and «waiting for
   your decision». The server computes the rows
   (src/lib/server/reports/report-data.ts) — fresh every time a draft
   opens, frozen into the report when it is sent — so a reader sees exactly
   what the author saw, and no figure is typed. The one exception is a LIVE
   source («waiting for your decision»): it is computed for whoever opens
   the report, as they open it, and a sent report stores none of it.

   Words: a column is `blk.dc.<id>`, a document status `blk.st.<status>`.

   Phase 5C (owner's picks, 26 Sep 2026) adds the HR, Projects, Inventory
   and Finance numbers. Who reads how far:
     HR        HR · view reads the whole company; a manager without it reads
               their own team where a number is about people's days
               (HR_TEAM_READS) — attendance, leave, overtime, training, a
               new hire's first days; everything else needs HR · view
     salaries  «Payroll Reports» in Roles (or a super admin) — whatever type
               the block sits in (PAYROLL_SOURCES)
     Projects  the projects the writer can see (the Projects app's own rule:
               manager, creator, member or assigned a task; a super admin all)
     Inventory the Inventory app; what stock is worth needs the role's cost
               switch — without it the block says so and leaves it out
     Finance   the Finance app; bank balances, cash and profit need «Bank &
               Profit» (the Finance app's own rows)
   A block can be about the one project, employee or warehouse its report
   links (DATA_ABOUT) — required, or else the whole reach above — and can
   take a figure the writer types beside the system's (templates.ts
   DataInputDef): blockColumns / blockRows work out the difference, the
   composer, the reader and the print alike.
   --------------------------------------------------------------------------- */

import type { DataInputDef, ReportDataRow, ReportDataSource, ReportDataValue, ReportLinkType, ReportSectionValue, ReportSubject } from "./templates";
import { entityHref } from "./link-targets";

/** 5C: "tags" — a few coded values in one cell ("a|b|c"), each in words
 *  (what an employee's file lacks, why a project is at risk). */
export type DataColumnType = "text" | "money" | "number" | "date" | "status" | "tags";
/** `total: false` — money never added up (a unit cost, a line of a
 *  statement); `typed` — the writer's own figure (5C). */
export interface DataColumn { id: string; type: DataColumnType; total?: false; typed?: true }

/** The team's numbers (5A): one row per person, keyed by their account. */
export const TEAM_SOURCES = ["team_reports", "team_attendance", "team_workload"] as const;
export type TeamSource = (typeof TEAM_SOURCES)[number];
export const isTeamSource = (s: string): s is TeamSource => (TEAM_SOURCES as readonly string[]).includes(s);

/** The CEO office's sources (5B): read by src/lib/server/reports/office.ts. */
export const OFFICE_SOURCES = ["decisions", "schedule", "time_split", "meetings", "followups", "occasions", "visitors"] as const;
export type OfficeSource = (typeof OFFICE_SOURCES)[number];
export const isOfficeSource = (s: string): s is OfficeSource => (OFFICE_SOURCES as readonly string[]).includes(s);
/** Computed for the READER when they open the report (5B, owner's pick):
 *  what waits for THEIR decision — the writer never sees the reader's. */
export const LIVE_SOURCES = ["decisions"] as const;
export const isLiveSource = (s: string): boolean => (LIVE_SOURCES as readonly string[]).includes(s);
/** What holding «CEO Office» in Roles reads company-wide inside a report
 *  (5B, owner's picks): the follow-up NUMBERS per department, the birthdays
 *  and work anniversaries (never a birth year or an age), the visitors of
 *  the invitation letters (never a passport). Without the row each keeps
 *  its own right — the team, HR, Travel. */
export const OFFICE_READS = ["followups", "occasions", "visitors"] as const;
export const isOfficeRead = (s: string): boolean => (OFFICE_READS as readonly string[]).includes(s);
export const OFFICE_MODULE = "CEO Office";

/* ── 5C ── */
export const HR_SOURCES = [
  "hiring", "onboarding", "staff_attendance", "late_absence", "leave_balances", "leave_taken", "overtime_hours",
  "payroll", "staff_cost", "salaries", "insurance",
  "appraisals", "appraisal_results", "training", "skills", "behavior", "grievances",
  "movement", "turnover", "expiring", "contracts", "missing_files", "hr_kpis", "headcount",
] as const;
export type HrSource = (typeof HR_SOURCES)[number];
export const isHrSource = (s: string): s is HrSource => (HR_SOURCES as readonly string[]).includes(s);
/** A salary shows in them: «Payroll Reports» (or a super admin), always. */
export const PAYROLL_SOURCES = ["payroll", "staff_cost", "salaries"] as const;
export const isPayrollSource = (s: string): boolean => (PAYROLL_SOURCES as readonly string[]).includes(s);
export const PAYROLL_MODULE = "Payroll Reports";
/** About people's days: a manager without HR · view reads their own team's. */
export const HR_TEAM_READS = ["onboarding", "staff_attendance", "late_absence", "leave_balances", "leave_taken", "overtime_hours", "training", "appraisals"] as const;
export const isHrTeamRead = (s: string): boolean => (HR_TEAM_READS as readonly string[]).includes(s);
export const PROJECT_SOURCES = [
  "project_overview", "project_done", "project_overdue", "project_milestones", "project_budget", "project_expenses",
  "project_team", "project_blocked", "project_schedule", "portfolio", "projects_at_risk",
] as const;
export type ProjectSource = (typeof PROJECT_SOURCES)[number];
export const isProjectSource = (s: string): s is ProjectSource => (PROJECT_SOURCES as readonly string[]).includes(s);
export const STOCK_SOURCES = ["stock_count", "stock_writeoffs", "stock_moves", "low_stock"] as const;
export type StockSource = (typeof STOCK_SOURCES)[number];
export const isStockSource = (s: string): s is StockSource => (STOCK_SOURCES as readonly string[]).includes(s);
export const FINANCE_SOURCES = ["expense_categories", "company_expenses", "cash_position", "cash_flow", "profit_loss", "ar_aging", "ap_aging", "month_close"] as const;
export type FinanceSource = (typeof FINANCE_SOURCES)[number];
export const isFinanceSource = (s: string): s is FinanceSource => (FINANCE_SOURCES as readonly string[]).includes(s);
/** Bank balances, cash and profit: «Bank & Profit» (the Finance app's row). */
export const BANK_PROFIT_SOURCES = ["cash_position", "cash_flow", "profit_loss"] as const;
export const isBankProfitSource = (s: string): boolean => (BANK_PROFIT_SOURCES as readonly string[]).includes(s);

/** What a block's numbers are about — the one record of that kind its
 *  report links. `required`: nothing is read until one is picked;
 *  otherwise, with none, the block covers everything the writer may read. */
export const DATA_ABOUT: Partial<Record<ReportDataSource, { type: ReportSubject; required: boolean }>> = {
  onboarding: { type: "employee", required: true },
  staff_attendance: { type: "employee", required: false },
  leave_balances: { type: "employee", required: false },
  leave_taken: { type: "employee", required: false },
  overtime_hours: { type: "employee", required: false },
  appraisals: { type: "employee", required: false },
  training: { type: "employee", required: false },
  behavior: { type: "employee", required: false },
  project_overview: { type: "project", required: true },
  project_budget: { type: "project", required: true },
  project_expenses: { type: "project", required: true },
  project_schedule: { type: "project", required: true },
  project_done: { type: "project", required: false },
  project_overdue: { type: "project", required: false },
  project_milestones: { type: "project", required: false },
  project_team: { type: "project", required: false },
  project_blocked: { type: "project", required: false },
  stock_count: { type: "warehouse", required: true },
  stock_writeoffs: { type: "warehouse", required: false },
  stock_moves: { type: "warehouse", required: false },
  low_stock: { type: "warehouse", required: false },
};

/** The sources by the app each comes from — the builder's picker (named
 *  by the families' words). Every source is in exactly one. */
export const SOURCE_GROUPS: Array<{ id: "sales" | "suppliers" | "travel" | "team" | "office" | "hr" | "projects" | "inventory" | "finance"; sources: ReportDataSource[] }> = [
  { id: "sales", sources: ["quotations", "orders", "invoices", "quotes_waiting", "receivables"] },
  { id: "suppliers", sources: ["purchase_orders", "receipts", "shortages", "pos_late", "payables"] },
  { id: "travel", sources: ["expenses"] },
  { id: "team", sources: [...TEAM_SOURCES] },
  { id: "office", sources: [...OFFICE_SOURCES] },
  { id: "hr", sources: [...HR_SOURCES] },
  { id: "projects", sources: [...PROJECT_SOURCES] },
  { id: "inventory", sources: [...STOCK_SOURCES] },
  { id: "finance", sources: [...FINANCE_SOURCES] },
];

/** The record a report is about, of one kind: the first of that kind in
 *  its links blocks — or null. */
export function subjectOf(sections: Array<Pick<ReportSectionValue, "links">> | undefined, type: ReportLinkType): string | null {
  for (const s of sections ?? []) for (const l of s.links ?? []) if (l.type === type && l.id) return l.id;
  return null;
}

const NO: DataColumn = { id: "no", type: "text" };
const PERSON: DataColumn = { id: "person", type: "text" };
const n = (id: string): DataColumn => ({ id, type: "number" });
const CUSTOMER: DataColumn = { id: "customer", type: "text" };
const SUPPLIER: DataColumn = { id: "supplier", type: "text" };
const tx = (id: string): DataColumn => ({ id, type: "text" });
const dt = (id: string): DataColumn => ({ id, type: "date" });
const mo = (id: string, total = true): DataColumn => (total ? { id, type: "money" } : { id, type: "money", total: false });
const st = (id: string): DataColumn => ({ id, type: "status" });
const DEPT = tx("department");
const EXPENSE_COLS: DataColumn[] = [tx("title"), tx("category"), dt("date"), mo("amount"), st("status")];

export const DATA_COLUMNS: Record<ReportDataSource, DataColumn[]> = {
  quotations: [NO, CUSTOMER, { id: "date", type: "date" }, { id: "amount", type: "money" }, { id: "status", type: "status" }],
  orders: [NO, CUSTOMER, { id: "date", type: "date" }, { id: "amount", type: "money" }, { id: "status", type: "status" }],
  invoices: [NO, CUSTOMER, { id: "date", type: "date" }, { id: "amount", type: "money" }, { id: "paid", type: "money" }, { id: "balance", type: "money" }],
  quotes_waiting: [NO, CUSTOMER, { id: "sent", type: "date" }, { id: "days", type: "number" }, { id: "amount", type: "money" }, { id: "valid", type: "date" }],
  receivables: [NO, CUSTOMER, { id: "due", type: "date" }, { id: "overdue", type: "number" }, { id: "balance", type: "money" }],
  purchase_orders: [NO, SUPPLIER, { id: "date", type: "date" }, { id: "amount", type: "money" }, { id: "status", type: "status" }],
  receipts: [NO, SUPPLIER, { id: "date", type: "date" }, { id: "po", type: "text" }, { id: "status", type: "status" }],
  shortages: [NO, { id: "item", type: "text" }, { id: "ordered", type: "number" }, { id: "received", type: "number" }, { id: "missing", type: "number" }],
  pos_late: [NO, SUPPLIER, { id: "expected", type: "date" }, { id: "late", type: "number" }, { id: "amount", type: "money" }, { id: "status", type: "status" }],
  payables: [NO, SUPPLIER, { id: "due", type: "date" }, { id: "overdue", type: "number" }, { id: "balance", type: "money" }],
  expenses: [{ id: "title", type: "text" }, { id: "category", type: "text" }, { id: "date", type: "date" }, { id: "amount", type: "money" }, { id: "status", type: "status" }],
  team_reports: [PERSON, n("owed"), n("on_time"), n("sent_late"), n("missed")],
  team_attendance: [PERSON, n("present"), n("late_days"), n("absent"), n("leave_days")],
  team_workload: [PERSON, n("open_work"), n("overdue_work"), n("done_work")],
  decisions: [{ id: "item", type: "text" }, { id: "app", type: "status" }, { id: "from", type: "text" }, { id: "amount", type: "money" }, { id: "since", type: "date" }, n("days")],
  schedule: [{ id: "event", type: "text" }, { id: "date", type: "date" }, { id: "time", type: "text" }, { id: "where", type: "text" }, n("with")],
  time_split: [{ id: "kind", type: "status" }, n("events"), n("hours"), n("share")],
  meetings: [{ id: "event", type: "text" }, { id: "date", type: "date" }, { id: "time", type: "text" }, n("hours"), n("with")],
  followups: [{ id: "department", type: "text" }, n("open_work"), n("overdue_work"), n("done_work")],
  occasions: [PERSON, { id: "occasion", type: "status" }, { id: "date", type: "date" }, n("years")],
  visitors: [{ id: "visitor", type: "text" }, { id: "company", type: "text" }, { id: "country", type: "text" }, { id: "arrival", type: "date" }, { id: "departure", type: "date" }, { id: "purpose", type: "status" }, { id: "status", type: "status" }],
  /* 5C — HR */
  hiring: [tx("job"), DEPT, n("applicants"), n("screening"), n("interview"), n("offer"), n("hired"), dt("closes")],
  onboarding: [tx("step"), dt("due"), st("state"), dt("done_on")],
  staff_attendance: [PERSON, n("workdays"), n("present"), n("late_days"), n("absent"), n("leave_days"), n("hours"), n("overtime_h")],
  late_absence: [PERSON, DEPT, n("late_days"), n("late_minutes"), n("absent"), n("explained")],
  leave_balances: [PERSON, tx("leave_type"), n("entitled"), n("used"), n("remaining")],
  leave_taken: [PERSON, tx("leave_type"), dt("starts"), dt("ends"), n("days_off"), st("status")],
  overtime_hours: [PERSON, n("ot_days"), n("approved_h"), n("pending_h")],
  payroll: [PERSON, mo("gross"), mo("deductions"), mo("net"), mo("employer"), st("status")],
  staff_cost: [DEPT, n("people"), mo("monthly")],
  salaries: [PERSON, DEPT, mo("current")],
  insurance: [PERSON, tx("provider"), tx("class"), dt("expires"), n("days_left")],
  appraisals: [PERSON, tx("cycle"), n("self_rating"), n("reviewer_rating"), n("overall"), st("status")],
  appraisal_results: [DEPT, n("appraised"), n("done_n"), n("average"), n("lowest"), n("highest")],
  training: [PERSON, tx("course"), st("status"), dt("done_on"), n("score"), dt("expires")],
  skills: [tx("skill"), n("assessed"), n("average"), n("required_by"), n("below")],
  behavior: [PERSON, n("score"), n("match"), n("critical"), st("recommendation")],
  grievances: [tx("month"), n("received"), n("unread"), n("acknowledged")],
  movement: [PERSON, st("change"), dt("date"), tx("detail")],
  turnover: [DEPT, n("start_n"), n("hires"), n("leavers"), n("end_n"), n("rate")],
  expiring: [PERSON, st("what"), dt("expires"), n("days_left")],
  contracts: [PERSON, dt("expires"), n("days_left"), st("employment")],
  missing_files: [PERSON, DEPT, { id: "gaps", type: "tags" }],
  hr_kpis: [st("metric"), n("value")],
  headcount: [DEPT, n("people"), n("full_time"), n("part_time"), n("intern"), n("other_n")],
  /* 5C — Projects */
  project_overview: [tx("project"), dt("starts"), dt("ends"), n("progress"), n("open_work"), n("overdue_work"), n("done_work"), n("logged_h"), n("budget_h")],
  project_done: [tx("task"), tx("project"), PERSON, dt("closed")],
  project_overdue: [tx("task"), tx("project"), PERSON, dt("due"), n("late"), st("priority")],
  project_milestones: [tx("milestone"), tx("project"), dt("due"), st("state"), n("late")],
  project_budget: [st("line"), mo("budget", false), mo("actual", false), mo("remaining", false), n("used")],
  project_expenses: EXPENSE_COLS,
  project_team: [PERSON, st("role"), n("open_work"), n("done_work"), n("logged_h")],
  project_blocked: [tx("task"), tx("project"), tx("waits_for"), PERSON, dt("due")],
  project_schedule: [tx("step"), st("kind"), dt("due"), dt("done_on"), n("slip")],
  portfolio: [tx("project"), st("status"), n("progress"), n("open_work"), n("overdue_work"), dt("ends"), st("health")],
  projects_at_risk: [tx("project"), { id: "reasons", type: "tags" }, n("overdue_work"), n("days_over")],
  /* 5C — Inventory */
  stock_count: [tx("code"), tx("item"), tx("unit"), n("system"), mo("unit_cost", false)],
  stock_writeoffs: [NO, dt("date"), tx("item"), tx("warehouse"), n("qty"), tx("reason"), st("status")],
  stock_moves: [NO, dt("date"), st("move"), tx("item"), tx("warehouse"), n("qty_in"), n("qty_out")],
  low_stock: [tx("item"), tx("warehouse"), n("on_hand"), n("reorder"), n("to_order")],
  /* 5C — Finance */
  expense_categories: [tx("category"), n("count"), mo("actual")],
  company_expenses: EXPENSE_COLS,
  cash_position: [tx("account"), tx("bank"), mo("balance")],
  cash_flow: [st("line"), mo("amount", false)],
  profit_loss: [st("line"), mo("amount", false)],
  ar_aging: [st("bucket"), n("count"), mo("balance")],
  ap_aging: [st("bucket"), n("count"), mo("balance")],
  month_close: [st("check"), n("count"), st("state")],
};

/** The app a source belongs to — the author must hold it (requireModuleAccess).
 *  The team's numbers need no app: the author's own team decides (5A). */
export const DATA_MODULE: Record<ReportDataSource, string> = {
  quotations: "Quotations", quotes_waiting: "Quotations", orders: "Orders", invoices: "Invoices", receivables: "Invoices",
  purchase_orders: "Purchase", receipts: "Purchase", shortages: "Purchase", pos_late: "Purchase", payables: "Purchase",
  expenses: "Expenses",
  team_reports: "Reports", team_attendance: "Reports", team_workload: "Reports",
  /* 5B: each approval kind checks its own right; the calendar is the
     writer's own; the office reads pass with «CEO Office» (OFFICE_READS). */
  decisions: "Reports", schedule: "Calendar", time_split: "Calendar", meetings: "Calendar",
  followups: "Reports", occasions: "HR", visitors: "Travel",
  /* 5C: HR · view, or a manager's own team (HR_TEAM_READS); a salary
     «Payroll Reports»; a project's expenses the Expenses app (beside the
     project's own right); bank, cash and profit «Bank & Profit». */
  hiring: "HR", onboarding: "HR", staff_attendance: "HR", late_absence: "HR", leave_balances: "HR", leave_taken: "HR", overtime_hours: "HR",
  payroll: PAYROLL_MODULE, staff_cost: PAYROLL_MODULE, salaries: PAYROLL_MODULE, insurance: "HR",
  appraisals: "HR", appraisal_results: "HR", training: "HR", skills: "HR", behavior: "HR", grievances: "HR",
  movement: "HR", turnover: "HR", expiring: "HR", contracts: "HR", missing_files: "HR", hr_kpis: "HR", headcount: "HR",
  project_overview: "Projects", project_done: "Projects", project_overdue: "Projects", project_milestones: "Projects", project_budget: "Projects",
  project_expenses: "Expenses", project_team: "Projects", project_blocked: "Projects", project_schedule: "Projects", portfolio: "Projects", projects_at_risk: "Projects",
  stock_count: "Inventory", stock_writeoffs: "Inventory", stock_moves: "Inventory", low_stock: "Inventory",
  expense_categories: "Finance", company_expenses: "Finance", cash_position: "Bank & Profit", cash_flow: "Bank & Profit", profit_loss: "Bank & Profit",
  ar_aging: "Finance", ap_aging: "Finance", month_close: "Finance",
};

/** What a row opens: the document in its own app — a quotation or an
 *  invoice in its editor, an order on its page; the Purchase app opens no
 *  single document by link, so a purchasing row opens its list. */
export function dataRowHref(source: ReportDataSource, key: string): string | null {
  switch (source) {
    case "quotations": case "quotes_waiting": return entityHref("quotation", key);
    case "invoices": case "receivables": return entityHref("invoice", key);
    case "orders": return entityHref("order", key);
    case "purchase_orders": case "shortages": case "pos_late": return "/purchase/orders";
    case "receipts": return "/purchase/receipts";
    case "payables": return "/purchase/bills";
    case "expenses": return "/finance/expenses";
    /* A person's reports on the compliance board; attendance and work
       open nothing (the manager may hold neither HR nor Projects). */
    case "team_reports": return "/reports?tab=compliance";
    /* 5B: a decision opens where it is decided (its key is kind:id); an
       event, the calendar. Follow-ups, occasions and visitors open nothing
       — the office may hold neither To-do, HR nor Travel. */
    case "decisions": return decisionHref(key);
    case "schedule": case "meetings": return "/calendar";
    /* 5C: a person opens their profile (keyed by the employee), a project
       its board, an expense or a movement its list. HR's own screens open
       for HR; the rest open nothing. */
    case "staff_attendance": case "late_absence": case "overtime_hours": case "insurance":
    case "salaries": case "behavior": case "expiring": case "contracts": case "missing_files": {
      /* The row's person: its key, or the key's first part (a person's visa
         and their contract are two rows). */
      const id = key.split(":")[0];
      return /^[0-9a-f-]{36}$/i.test(id) ? `/employees/${encodeURIComponent(id)}` : null;
    }
    case "leave_taken": return "/hr?tab=leave";
    case "payroll": return "/hr?tab=payroll";
    case "portfolio": case "projects_at_risk": return entityHref("project", key);
    case "project_done": case "project_overdue": case "project_blocked": {
      const [pid, tid] = key.split(":");
      return pid && tid ? `/projects?project=${encodeURIComponent(pid)}&task=${encodeURIComponent(tid)}` : null;
    }
    case "project_expenses": case "company_expenses": return "/finance/expenses";
    case "stock_count": case "low_stock": return "/inventory/balances";
    case "stock_writeoffs": case "stock_moves": return "/inventory/movements";
    case "ar_aging": case "ap_aging": return "/finance/statements";
    default: return null;
  }
}

/** Where a pending decision is taken (5B) — key `kind:id`. */
export function decisionHref(key: string): string | null {
  const at = key.indexOf(":");
  const kind = at > 0 ? key.slice(0, at) : key;
  const id = at > 0 ? key.slice(at + 1) : "";
  switch (kind) {
    case "leave_manager": return "/me?tab=approvals";
    case "leave_hr": return "/hr?tab=leave";
    case "overtime": case "correction": return "/hr?tab=attendance";
    case "expense": case "payment": case "bill": case "journal": return "/finance/approvals";
    case "todo": return id ? `/todo?task=${id}` : "/todo";
    case "report": return id ? `/reports/${id}` : "/reports";
    default: return null;
  }
}

/** The document statuses that have words (anything else shows as written). */
export const DATA_STATUSES = [
  "draft", "sent", "accepted", "rejected", "expired", "open", "confirmed", "in_production", "shipped", "delivered", "completed", "closed", "cancelled", "paid", "partial", "overdue",
  "pending", "approved", "received", "posted", "void", "issued", "final", "complete", "voided",
  "submitted", "changes_requested",
  /* 5B — coded values with a word: what a decision is, an event's kind, an
     occasion, a visit's purpose. */
  "leave", "overtime", "correction", "expense", "payment", "bill", "journal", "todo", "report",
  "meeting", "event", "task", "reminder", "out_of_office", "holiday", "private",
  "birthday", "anniversary", "exhibition", "factory", "training",
  /* 5C — HR: a leave step, an appraisal or a course's state, a
     recommendation, a change, what expires, what a file lacks, the month's
     numbers, a contract. */
  "manager_approved", "in_progress", "enrolled",
  "confirm", "extend", "develop", "escalate",
  "hire", "move", "exit",
  "visa", "insurance", "contract", "probation", "licence", "document",
  "no_department", "no_manager", "no_hire_date", "no_birth_date", "no_id_document", "no_emergency", "no_bank", "no_documents",
  "headcount", "hires", "leavers", "turnover_rate", "absent_days", "late_days", "leave_days", "overtime_hours", "open_jobs", "applicants",
  "full_time", "part_time", "intern",
  /* 5C — Projects: a task's priority, a member's role, a line of the
     budget, what a row of the schedule is, a project's health and why. */
  "low", "normal", "high", "urgent",
  "manager", "member", "viewer", "assignee",
  "hours", "amount",
  "milestone", "reached",
  "on_track", "at_risk", "late", "on_hold", "archived", "active",
  "overdue_tasks", "past_end", "over_hours", "over_budget",
  /* 5C — Inventory: how stock moved. */
  "opening_balance", "purchase_receipt", "sales_shipment", "adjustment_in", "adjustment_out", "transfer_in", "transfer_out", "return_in", "return_out", "manual", "not_required",
  /* 5C — Finance: a line of the statements, an age of what is owed, a
     check before the month is closed. */
  "revenue", "cost_of_sales", "gross_profit", "operating_expenses", "net_profit",
  "opening_cash", "operating", "investing", "financing", "net_cash", "closing_cash",
  "current", "d1_30", "d31_60", "d61_90", "d90_plus",
  "draft_entries", "entries_waiting", "posted_entries", "expenses_unposted", "period_locked", "closing_entry",
] as const;

/** A status's word: "partial" is partly RECEIVED on a purchase order or a
 *  receipt, partly PAID on an invoice or a bill. Null: show it as written. */
export function statusWordKey(source: ReportDataSource, status: string): string | null {
  if (status === "partial" && (source === "purchase_orders" || source === "receipts" || source === "pos_late")) return "blk.st.partial_received";
  return (DATA_STATUSES as readonly string[]).includes(status) ? `blk.st.${status}` : null;
}

/** A few coded values in one cell ("a|b|c" — 5C). */
export const tagsOf = (v: unknown): string[] => (typeof v === "string" && v ? v.split("|").filter(Boolean) : []);

/* ── 5C: the figure typed beside the system's ──────────────────────────
   The writer types one figure per row (the stock counted, the budget, the
   proposed salary, a score); the difference with the system's column and
   what it is worth follow from it — the composer, the reader and the print
   work them out the same way, and nothing worked out is ever stored. */

/** A block's columns as they show: the source's, then the typed figure,
 *  the difference and its worth. */
export function blockColumns(source: ReportDataSource, input?: DataInputDef): DataColumn[] {
  const base = DATA_COLUMNS[source];
  if (!input) return base;
  const out: DataColumn[] = [...base, { id: input.id, type: input.type, typed: true }];
  if (input.against) {
    out.push({ id: input.diff ?? "difference", type: input.type });
    if (input.valueBy) out.push({ id: input.value ?? "difference_value", type: "money" });
  }
  return out;
}

const r4 = (x: number) => Math.round(x * 10_000) / 10_000;

/** The rows with the typed figure and what follows from it: the difference
 *  is typed − system (stock missing is negative; a budget left over, a
 *  raise, positive), its worth the difference × the row's own money column.
 *  A row nobody typed for stays empty — never 0. */
export function blockRows(v: ReportDataValue, input?: DataInputDef, inputs?: Record<string, string>): ReportDataRow[] {
  if (!input) return v.rows;
  return v.rows.map((r) => {
    const raw = inputs?.[r.key];
    const typed = raw !== undefined && raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : null;
    const cells: ReportDataRow["cells"] = { ...r.cells, [input.id]: typed };
    if (input.against) {
      const sys = r.cells[input.against];
      const diff = typed !== null && typeof sys === "number" ? r4(typed - sys) + 0 : null;
      cells[input.diff ?? "difference"] = diff;
      if (input.valueBy) {
        const by = r.cells[input.valueBy];
        /* + 0 turns a −0 (nothing missing, or a zero cost) into 0. */
        cells[input.value ?? "difference_value"] = diff !== null && typeof by === "number" ? Math.round(diff * by * 100) / 100 + 0 : null;
      }
    }
    return { ...r, cells };
  });
}

export interface DataTotal { col: string; currency: string; value: number }

/** Each money column's total PER CURRENCY: a USD quotation and a CNY one
 *  are never added together. Only when two or more rows carry money. 5C:
 *  the typed figures and their difference too; a column marked
 *  `total: false` (a unit cost, a line of a statement) never. */
export function dataTotals(v: ReportDataValue | undefined, input?: DataInputDef, inputs?: Record<string, string>): DataTotal[] {
  if (!v || v.rows.length < 2) return [];
  const rows = blockRows(v, input, inputs);
  const out: DataTotal[] = [];
  for (const col of blockColumns(v.source, input).filter((c) => c.type === "money" && c.total !== false)) {
    const byCur = new Map<string, number>();
    let filled = 0;
    for (const r of rows) {
      const n = r.cells[col.id];
      if (typeof n !== "number" || !Number.isFinite(n)) continue;
      filled++;
      const cur = r.currency || "—";
      byCur.set(cur, (byCur.get(cur) ?? 0) + n);
    }
    if (filled < 2) continue;
    for (const [currency, value] of byCur) out.push({ col: col.id, currency, value: Math.round(value * 100) / 100 });
  }
  return out;
}

/** A draft's sections with the numbers the server just computed (the
 *  composer shows them, the print prints them); on a sent report the
 *  frozen numbers are already in its sections. */
export function withBlockData(sections: ReportSectionValue[], data: Record<string, ReportDataValue> | undefined): ReportSectionValue[] {
  if (!data) return sections;
  return sections.map((s) => (data[s.id] ? { ...s, data: data[s.id] } : s));
}
