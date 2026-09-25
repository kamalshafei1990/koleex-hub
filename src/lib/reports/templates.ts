/* ---------------------------------------------------------------------------
   Reports — the built-in templates (Phase 1, owner-approved 25 Sep 2026).

   A report TYPE is data, not a screen: its sections, who it goes to by
   default, whether it needs a review, and whether it is confidential. The
   engine (composer, reader, routes) knows nothing about any single type, so
   a new one is a new entry here plus its strings in translations/reports.ts
   — never a migration and never a new page.

   Shared by the browser and the server (no server-only imports). Every
   user-facing string is a translation key: `tpl.<key>.name`, `tpl.<key>.desc`
   and `tpl.<key>.s.<section>` (+ `.hint`), checked for en/zh/ar by
   validate:reports.

   Phase 4A (owner's pick, 25 Sep 2026) adds BLOCKS beside text and lists —
   a checklist (OK / problem / not applicable, a note and a photo per point),
   a 1–5 score over weighted criteria, a table of numbers and money, links to
   the customers, suppliers, products and orders a report is about (the
   report then shows on their pages), and a signature drawn on the phone.
   A checklist point or a score criterion is `tpl.<key>.s.<section>.i.<id>`,
   a table column `tpl.<key>.s.<section>.c.<id>`.

   Phase 4B (owner's picks, 25 Sep 2026) adds the Sales & customers family
   and two blocks: a CHOICE (one of a few fixed answers — a reason, a
   severity, a channel; `tpl.<key>.s.<section>.o.<id>`) and NUMBERS FROM
   THE APPS (`data`): the author's own quotations, orders, invoices, open
   quotes and money still owed, computed by the server — never typed — and
   frozen into the report when it is sent. A table column can be a date.

   Phase 4C (owner's picks, 25 Sep 2026) adds the Quality family and fills
   Purchasing & suppliers: inspections, defects and corrective action;
   supplier approval, samples and negotiation; production follow-up, rating,
   risk and stopping a supplier; and the purchasing numbers (the writer's own
   purchase orders, receipts, shortages, late orders and bills to pay).

   Phase 4D (owner's picks, 25 Sep 2026): Logistics (container loading,
   shipment status, damage and claim, customs), After-sales (service visit,
   warranty claim, training, spare parts) and Travel, visitors & meetings
   (trip, delegation visit, minutes, decision log). A trip or a visit spans
   the days its author picks (`range`); the trip's own expenses come from
   Finance.

   Phase 4E (owner's picks, 25 Sep 2026): the template builder. Super admins,
   and anyone granted "Report Templates" in Roles, make their own types — from
   nothing, or as a copy of a built-in (the original stays) — and hide the
   built-in types nobody uses. A builder type lives in the database
   (src/lib/reports/custom-templates.ts); a report of one keeps a copy of the
   type as it was when the report was started, so editing the type changes
   only the reports started after. The Marketing group is theirs until the
   Marketing app brings its own reports.

   Phase 5A (owner's picks, 25 Sep 2026): the manager and the team. The
   team summary — Koleex AI reads what the team sent (everyone under the
   manager, at every level; a super admin: everyone) and the manager sends
   it up — with the team's numbers: its reports (sent, late, missing), its
   attendance (late, absent, leave days — the manager sees his own team's)
   and its work (project tasks and the to-dos someone assigned; a person's
   own to-dos stay private). And the 1-on-1 minutes and the promotion or
   bonus recommendation. Only someone with a team starts these (teamOnly).
   --------------------------------------------------------------------------- 
   Phase 5B (owner's picks, 25 Sep 2026): the CEO office — 22 types in four
   groups (the CEO's day, time and travel, the office, documents), started
   only by super admins and whoever holds «CEO Office» in Roles
   (`officeOnly`). Their numbers come from the calendar (the writer's own
   events), the approvals across the apps, the follow-ups per department,
   the birthdays and work anniversaries, and the visitors of the invitation
   letters; «waiting for your decision» is the one block computed for its
   READER, when they open it — never frozen (LIVE_SOURCES).
   ---------------------------------------------------------------------------
   Phase 5C (owner's picks, 26 Sep 2026): HR (31 types in seven groups),
   Projects (20), Inventory (4) and Finance (6). Two new things a block can
   do: its numbers can be ABOUT one record the report is about — the
   project, the employee or the warehouse picked in its links (`about`, per
   source: DATA_ABOUT) — and a row can take a figure the writer types BESIDE
   the system's (`input`): the stock counted beside the stock in the system,
   the budget beside what was spent, the proposed salary beside the current
   one — the difference is worked out, never typed. A type can need an app
   to be started (`app`: HR · view, Projects, Inventory, Finance, Expenses —
   or, `orTeam`, a team); the salary types need «Payroll Reports» in Roles
   (`payrollOnly`), and so does every block that shows a salary, whatever
   type it is in. A report never changes stock or the books: a count or a
   write-off is adjusted in Inventory, with its own approval.
   */

import type { RrIconName } from "@/components/ui/RrIcon";

export type ReportFamily = "work" | "team" | "office" | "visits" | "sales" | "marketing" | "suppliers" | "quality" | "logistics" | "service" | "travel" | "memos" | "hr" | "projects" | "inventory" | "finance";
export type ReportCadence = "daily" | "weekly" | "monthly" | null;
/** "text" = one free text block · "list" = bullet items, one per line ·
 *  the Phase 4A blocks: "checklist", "score", "table", "links", "signature" ·
 *  4B: "choice" (one fixed answer) and "data" (numbers from the apps). */
export type ReportSectionKind = "text" | "list" | "checklist" | "score" | "table" | "links" | "signature" | "choice" | "data";
/** What a report can be linked to (and so appear on the page of). 5C: a
 *  project, an employee or a warehouse — what a block's numbers can be
 *  about (DATA_ABOUT). */
export type ReportLinkType = "customer" | "supplier" | "product" | "order" | "quotation" | "invoice" | "project" | "employee" | "warehouse";
export const REPORT_LINK_TYPES: ReportLinkType[] = ["customer", "supplier", "product", "order", "quotation", "invoice", "project", "employee", "warehouse"];
/** The kinds a report is listed on the page of (work_report_links'
 *  CHECK). A project, an employee or a warehouse (5C) only says what the
 *  report's numbers are about: an employee's page never lists the
 *  confidential HR reports about them. */
export const STORED_LINK_TYPES: ReportLinkType[] = ["customer", "supplier", "product", "order", "quotation", "invoice"];
/** What a block's numbers can be about (5C). */
export type ReportSubject = "project" | "employee" | "warehouse";
export type ReportColumnType = "text" | "number" | "money" | "date";
/** Where a numbers block reads from — always the AUTHOR's own documents:
 *  quotations / orders / invoices in the report's period, the quotations
 *  sent and still unanswered, the invoices with money still owed. 5C: the
 *  HR, Projects, Inventory and Finance numbers (src/lib/reports/report-data.ts
 *  says who reads each and how far). */
export type ReportDataSource =
  | "quotations" | "orders" | "invoices" | "quotes_waiting" | "receivables"
  | "purchase_orders" | "receipts" | "shortages" | "pos_late" | "payables"
  | "expenses"
  | "team_reports" | "team_attendance" | "team_workload"
  | "decisions" | "schedule" | "time_split" | "meetings" | "followups" | "occasions" | "visitors"
  | "hiring" | "onboarding" | "staff_attendance" | "late_absence" | "leave_balances" | "leave_taken" | "overtime_hours"
  | "payroll" | "staff_cost" | "salaries" | "insurance"
  | "appraisals" | "appraisal_results" | "training" | "skills" | "behavior" | "grievances"
  | "movement" | "turnover" | "expiring" | "contracts" | "missing_files" | "hr_kpis" | "headcount"
  | "project_overview" | "project_done" | "project_overdue" | "project_milestones" | "project_budget" | "project_expenses"
  | "project_team" | "project_blocked" | "project_schedule" | "portfolio" | "projects_at_risk"
  | "stock_count" | "stock_writeoffs" | "stock_moves" | "low_stock"
  | "expense_categories" | "company_expenses" | "cash_position" | "cash_flow" | "profit_loss" | "ar_aging" | "ap_aging" | "month_close";
export const REPORT_DATA_SOURCES: ReportDataSource[] = [
  "quotations", "orders", "invoices", "quotes_waiting", "receivables",
  "purchase_orders", "receipts", "shortages", "pos_late", "payables",
  "expenses",
  "team_reports", "team_attendance", "team_workload",
  "decisions", "schedule", "time_split", "meetings", "followups", "occasions", "visitors",
  "hiring", "onboarding", "staff_attendance", "late_absence", "leave_balances", "leave_taken", "overtime_hours",
  "payroll", "staff_cost", "salaries", "insurance",
  "appraisals", "appraisal_results", "training", "skills", "behavior", "grievances",
  "movement", "turnover", "expiring", "contracts", "missing_files", "hr_kpis", "headcount",
  "project_overview", "project_done", "project_overdue", "project_milestones", "project_budget", "project_expenses",
  "project_team", "project_blocked", "project_schedule", "portfolio", "projects_at_risk",
  "stock_count", "stock_writeoffs", "stock_moves", "low_stock",
  "expense_categories", "company_expenses", "cash_position", "cash_flow", "profit_loss", "ar_aging", "ap_aging", "month_close",
];
/** 5C: a figure the writer types beside the system's, on every row of a
 *  numbers block — the stock counted beside the stock in the system, the
 *  budget beside what was spent, the proposed salary beside the current
 *  one, a score. `against`: the system's column it is compared with — the
 *  difference (`diff`) is typed − system, worked out, never typed; `valueBy`:
 *  a money column the difference is multiplied by (`value`: what the stock
 *  missing is worth). `min` / `max` bound what may be typed (a score 1–5). */
export interface DataInputDef {
  id: string;
  type: "number" | "money";
  against?: string;
  diff?: string;
  valueBy?: string;
  value?: string;
  min?: number;
  max?: number;
}
/** 5C: who may start a type, beside everyone — the app's own right (HR is
 *  HR · view). */
export type ReportApp = "HR" | "Projects" | "Inventory" | "Finance" | "Expenses";
export const REPORT_APPS: ReportApp[] = ["HR", "Projects", "Inventory", "Finance", "Expenses"];
/** The currencies a table's money is written in. */
export const REPORT_CURRENCIES = ["USD", "CNY", "EGP", "EUR", "AED", "SAR"] as const;
/** Who a new report goes to before the author changes anything:
 *  manager = the author's direct manager (the owner when there is none) ·
 *  hr = HR reviewers · manager_hr = both. */
/** none (5A): the writer picks — a 1-on-1 goes to the person it was with. */
export type ReportDefaultRecipients = "manager" | "hr" | "manager_hr" | "none";

export interface ReportSectionDef {
  id: string;
  kind: ReportSectionKind;
  required?: boolean;
  /** checklist: the points · score: the criteria and their weights. */
  points?: Array<{ id: string; weight?: number }>;
  /** table: the columns. */
  columns?: Array<{ id: string; type: ReportColumnType }>;
  /** table: the figures under it — each column's total (the default) or,
   *  for a comparison of offers, each column's lowest and whose it is; none
   *  when adding up means nothing (quantities of different items). */
  summary?: "total" | "lowest" | "none";
  /** table: only these columns get a figure (a negotiation's lowest is
   *  their offer — never our own target). */
  summaryOf?: string[];
  /** links: what it may point at. */
  linkTypes?: ReportLinkType[];
  /** links (5C): how many — 1 for what the report is about (picking
   *  another replaces it). */
  max?: number;
  /** choice: the answers, in order. */
  options?: string[];
  /** data: where the numbers come from, and whether each row takes the
   *  author's note (what the customer said, the next step). */
  source?: ReportDataSource;
  notes?: boolean;
  /** data (5C): the figure the writer types beside the system's. */
  input?: DataInputDef;
}

export interface ReportTemplateDef {
  key: string;
  family: ReportFamily;
  /** 5C: the group it shows under inside its family on the Reports home
   *  (catalog.ts FAMILY_GROUPS; `grp.<family>.<group>`). */
  group?: string;
  icon: RrIconName;
  cadence: ReportCadence;
  sections: ReportSectionDef[];
  recipients: ReportDefaultRecipients;
  reviewRequired: boolean;
  confidential: boolean;
  urgent?: boolean;
  /** Only people with HR·create may start one (a warning, an exit
   *  interview). Everyone else never sees it offered. */
  hrOnly?: boolean;
  /** Only someone with a team (anyone under them) — or a super admin —
   *  starts it (5A: the team summary, a 1-on-1, a recommendation). */
  teamOnly?: boolean;
  /** Only super admins and holders of «CEO Office» in Roles start it (5B:
   *  the CEO office's types). Everyone else never sees it offered. */
  officeOnly?: boolean;
  /** 5C: only someone with this app starts it (HR: HR · view) — or, with
   *  `orTeam`, someone with a team (a manager writes about their own). */
  app?: ReportApp;
  orTeam?: boolean;
  /** 5C: salaries — only super admins and holders of «Payroll Reports» in
   *  Roles start it. */
  payrollOnly?: boolean;
  /** The free report takes the author's own title. */
  customTitle?: boolean;
  /** Only an event asks for it (Phase 3D: the probation review): never
   *  offered in the list, and the server starts one only from its request. */
  requestOnly?: boolean;
  /** Its author picks the first and the last day (a trip, a visit — 4D);
   *  at most REPORT_LIMITS.rangeDays long. */
  range?: boolean;
  /** 4E: made in the builder — the version a report was started with. */
  custom?: true;
  version?: number;
  /** 4E: the built-in a builder type was copied from. It keeps what that
   *  one knew how to do — the suggestions from earlier reports, the facts
   *  from the apps, Koleex AI's summary — for the sections it kept. */
  base?: string;
}

/* The built-in types themselves live in ./catalog.ts (Phase 5C): the
   server, the builder and validate:reports import them; the report page and
   its print never do — a report arrives with its own type from the server.
   The Reports home imports only their HEADS (./catalog-heads.ts, generated
   from the catalog): what it takes to list a type, group it, draw it and
   decide who is offered it — never its sections. */
export const REPORT_HEAD_FIELDS = ["key", "family", "group", "icon", "cadence", "urgent", "hrOnly", "requestOnly", "teamOnly", "officeOnly", "payrollOnly", "app"] as const;
export type ReportTemplateHead = Pick<ReportTemplateDef, (typeof REPORT_HEAD_FIELDS)[number]>;

export const REPORT_FAMILIES: ReportFamily[] = ["work", "team", "office", "visits", "sales", "marketing", "suppliers", "quality", "logistics", "service", "travel", "memos", "hr", "projects", "inventory", "finance"];

/** The built-in whose suggestions, app facts and AI summary a type uses: its
 *  own — or, for a builder copy, the one it was copied from. */
export const behaviourKey = (tpl: Pick<ReportTemplateDef, "key" | "base">): string => tpl.base ?? tpl.key;

/* ── Limits (server-enforced; the composer mirrors them) ── */
export const REPORT_LIMITS = { title: 200, text: 8000, items: 60, item: 600, comment: 4000, recipients: 30, rows: 50, cell: 200, links: 20, label: 200, signer: 120, dataRows: 100, rangeDays: 62 } as const;

/* ── Sections as stored ── */
export type CheckState = "ok" | "issue" | "na";
export interface CheckValue { state?: CheckState; note?: string; photo?: string }
export interface ReportLink { type: ReportLinkType; id: string; label: string }
export interface SignatureValue {
  /** The drawn signature: an attachment of the report (a PNG). */
  file: string;
  name: string;
  at: string;
  /** The version it was signed on — a later version shows it as such. */
  version: number;
}
/** One document in a numbers block: its id (the note's key), its cells by
 *  column, its currency (documents differ — totals never mix them). */
export interface ReportDataRow { key: string; cells: Record<string, string | number | null>; currency?: string }
/** A numbers block as the SERVER computed it — on a draft fresh at every
 *  open, frozen into the report when it is sent. */
export interface ReportDataValue {
  source: ReportDataSource;
  rows: ReportDataRow[];
  capturedAt: string;
  /** The author has no access to the app the numbers come from. */
  denied?: boolean;
  /** More than REPORT_LIMITS.dataRows — the first ones are kept. */
  truncated?: boolean;
  /** The read failed — said as such, never shown as "nothing". */
  failed?: boolean;
  /** The team's reports before counting starts (5A): nothing is late or
   *  missing yet — said as such. */
  untracked?: boolean;
  /** 5B: computed for whoever OPENS the report, as they open it («waiting
   *  for your decision») — never frozen; a sent report stores no rows. */
  live?: boolean;
  /** 5C: about one record, and none is picked yet — the block asks for it
   *  («pick the project above»). */
  needsAbout?: ReportSubject;
  /** 5C: the writer's role shows no cost, so what stock is worth is left
   *  out — said as such, never shown as nothing. */
  noCost?: boolean;
}
export interface ReportSectionValue {
  id: string;
  text?: string;
  items?: string[];
  checks?: Record<string, CheckValue>;
  scores?: Record<string, number>;
  rows?: Array<Record<string, string>>;
  currency?: string;
  links?: ReportLink[];
  signature?: SignatureValue | null;
  choice?: string;
  data?: ReportDataValue;
  /** A numbers block's notes, by row key. */
  notes?: Record<string, string>;
  /** 5C: the figures the writer typed beside the system's, by row key. */
  inputs?: Record<string, string>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A typed figure's row (5C): a document, a person, a stock line — or a
 *  category in one currency ("<id>:USD": spending is never mixed). */
const ROW_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?::[A-Z]{3})?$/i;
const NUMBER = /^-?\d{1,12}(\.\d{1,4})?$/;
/** A number or money cell as it is kept: commas and spaces out
 *  ("1,180.00" → "1180.00"), up to 12 digits and 4 decimals — or null.
 *  The editor's figures read it the same way the server stores it. */
export function cellNumber(raw: unknown): string | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const n = String(raw).replace(/[,\s]/g, "");
  return NUMBER.test(n) ? n : null;
}
const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const YMD = /^\d{4}-\d{2}-\d{2}$/;
/** A date cell as it is kept: YYYY-MM-DD and a real day — or null. */
export function cellDate(raw: unknown): string | null {
  if (typeof raw !== "string" || !YMD.test(raw.trim())) return null;
  const v = raw.trim();
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
}

/** One block's stored value, cleaned: only the template's points / criteria /
 *  columns / link types, in range, capped. The single normaliser the
 *  composer and the server share. */
function normalizeBlock(def: ReportSectionDef, v: Record<string, unknown> | undefined): ReportSectionValue {
  const id = def.id;
  switch (def.kind) {
    case "checklist": {
      const raw = (v?.checks && typeof v.checks === "object" ? v.checks : {}) as Record<string, Record<string, unknown>>;
      const checks: Record<string, CheckValue> = {};
      for (const pt of def.points ?? []) {
        const c = raw[pt.id];
        if (!c || typeof c !== "object") continue;
        const out: CheckValue = {};
        if (c.state === "ok" || c.state === "issue" || c.state === "na") out.state = c.state;
        const note = clip(c.note, REPORT_LIMITS.item);
        if (note) out.note = note;
        if (typeof c.photo === "string" && UUID.test(c.photo)) out.photo = c.photo;
        if (out.state || out.note || out.photo) checks[pt.id] = out;
      }
      return { id, checks };
    }
    case "score": {
      const raw = (v?.scores && typeof v.scores === "object" ? v.scores : {}) as Record<string, unknown>;
      const scores: Record<string, number> = {};
      for (const pt of def.points ?? []) {
        const n = raw[pt.id];
        if (typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5) scores[pt.id] = n;
      }
      const text = clip(v?.text, REPORT_LIMITS.text);
      return text ? { id, scores, text } : { id, scores };
    }
    case "table": {
      const cols = def.columns ?? [];
      const rows = (Array.isArray(v?.rows) ? v.rows : []).slice(0, REPORT_LIMITS.rows * 4).map((r) => {
        const row: Record<string, string> = {};
        for (const c of cols) {
          const cell = clip((r as Record<string, unknown> | null)?.[c.id], REPORT_LIMITS.cell);
          if (!cell) continue;
          if (c.type === "text") row[c.id] = cell;
          else if (c.type === "date") { const d = cellDate(cell); if (d !== null) row[c.id] = d; }
          else { const n = cellNumber(cell); if (n !== null) row[c.id] = n; }
        }
        return row;
      }).filter((r) => Object.keys(r).length > 0).slice(0, REPORT_LIMITS.rows);
      const currency = (REPORT_CURRENCIES as readonly string[]).includes(v?.currency as string) ? (v!.currency as string) : "USD";
      return cols.some((c) => c.type === "money") ? { id, rows, currency } : { id, rows };
    }
    case "links": {
      const allowed = def.linkTypes ?? REPORT_LINK_TYPES;
      const seen = new Set<string>();
      const links: ReportLink[] = [];
      for (const l of Array.isArray(v?.links) ? (v.links as Array<Record<string, unknown>>) : []) {
        const type = l?.type as ReportLinkType;
        const lid = clip(l?.id, 64);
        if (!allowed.includes(type) || !lid || seen.has(`${type}|${lid}`)) continue;
        seen.add(`${type}|${lid}`);
        links.push({ type, id: lid, label: clip(l?.label, REPORT_LIMITS.label) || lid });
        if (links.length >= Math.min(def.max ?? REPORT_LIMITS.links, REPORT_LIMITS.links)) break;
      }
      return { id, links };
    }
    case "choice": {
      const pick = typeof v?.choice === "string" && (def.options ?? []).includes(v.choice) ? v.choice : undefined;
      return pick ? { id, choice: pick } : { id };
    }
    case "data": {
      /* Only the author's notes come from the composer. The numbers never
         do: the server computes them (fresh on a draft) and writes them
         itself when the report is sent — a typed figure is refused. */
      const notes: Record<string, string> = {};
      if (def.notes && v?.notes && typeof v.notes === "object") {
        for (const [k, n] of Object.entries(v.notes as Record<string, unknown>).slice(0, REPORT_LIMITS.dataRows)) {
          const note = clip(n, REPORT_LIMITS.item);
          if (UUID.test(k) && note) notes[k] = note;
        }
      }
      /* 5C: what the writer typed beside the system's figure — a number,
         by row, within the block's bounds. The system's own figures still
         never come from the composer. */
      const inputs: Record<string, string> = {};
      if (def.input && v?.inputs && typeof v.inputs === "object") {
        for (const [k, raw] of Object.entries(v.inputs as Record<string, unknown>).slice(0, REPORT_LIMITS.dataRows)) {
          const n = cellNumber(raw);
          if (!ROW_KEY.test(k) || n === null) continue;
          if ((def.input.min !== undefined && Number(n) < def.input.min) || (def.input.max !== undefined && Number(n) > def.input.max)) continue;
          inputs[k] = n;
        }
      }
      return { id, ...(Object.keys(notes).length ? { notes } : {}), ...(Object.keys(inputs).length ? { inputs } : {}) };
    }
    case "signature": {
      const sg = v?.signature as Record<string, unknown> | null | undefined;
      if (!sg || typeof sg.file !== "string" || !UUID.test(sg.file) || typeof sg.at !== "string" || Number.isNaN(Date.parse(sg.at))) return { id, signature: null };
      const version = typeof sg.version === "number" && Number.isInteger(sg.version) && sg.version > 0 ? sg.version : 1;
      return { id, signature: { file: sg.file, name: clip(sg.name, REPORT_LIMITS.signer), at: new Date(sg.at).toISOString(), version } };
    }
    default:
      return { id };
  }
}

/** A score block's weighted average (1–5), or null until something is
 *  scored. Unscored criteria are left out, never counted as zero. */
export function scoreAverage(def: ReportSectionDef, v: ReportSectionValue | undefined): number | null {
  let sum = 0, weight = 0;
  for (const pt of def.points ?? []) {
    const n = v?.scores?.[pt.id];
    if (!n) continue;
    const w = pt.weight ?? 1;
    sum += n * w; weight += w;
  }
  return weight ? Math.round((sum / weight) * 10) / 10 : null;
}

/** A table's total for one number or money column. */
export function columnTotal(rows: Array<Record<string, string>> | undefined, colId: string): number {
  return Math.round((rows ?? []).reduce((a, r) => a + Number(cellNumber(r[colId]) ?? 0), 0) * 10_000) / 10_000;
}

export interface TableFigure {
  col: { id: string; type: ReportColumnType };
  kind: "total" | "lowest";
  value: number;
  /** lowest: the row it is in (-1 for a total) and that row's name — its
   *  first text cell, e.g. the supplier. */
  row: number;
  who: string;
}

/** The figures under a table (the editor, the reader and the print alike):
 *  each number or money column's total, or — a comparison — its lowest and
 *  whose it is; adding up competing offers means nothing. Only a column
 *  that two or more rows fill: one row's total or lowest is the row. */
export function tableSummary(def: ReportSectionDef, rows: Array<Record<string, string>> | undefined): TableFigure[] {
  if (def.summary === "none") return [];
  const list = rows ?? [];
  const nameCol = (def.columns ?? []).find((c) => c.type === "text");
  const out: TableFigure[] = [];
  for (const col of def.columns ?? []) {
    if (col.type !== "number" && col.type !== "money") continue;
    if (def.summaryOf && !def.summaryOf.includes(col.id)) continue;
    const filled = list.flatMap((r, i) => { const n = cellNumber(r[col.id]); return n === null ? [] : [{ n: Number(n), i }]; });
    if (filled.length < 2) continue;
    if (def.summary === "lowest") {
      const best = filled.reduce((a, x) => (x.n < a.n ? x : a));
      out.push({ col, kind: "lowest", value: best.n, row: best.i, who: nameCol ? (list[best.i][nameCol.id] ?? "") : "" });
    } else {
      out.push({ col, kind: "total", value: columnTotal(list, col.id), row: -1, who: "" });
    }
  }
  return out;
}

/** The attachments a report's blocks show in place (checklist photos, the
 *  signature) — the general photos-and-files list leaves them out. */
export function blockFileIds(sections: ReportSectionValue[] | undefined): Set<string> {
  const out = new Set<string>();
  for (const sct of sections ?? []) {
    for (const c of Object.values(sct.checks ?? {})) if (c.photo) out.add(c.photo);
    if (sct.signature?.file) out.add(sct.signature.file);
  }
  return out;
}

/** The records a report is linked to (every links block). */
export function reportLinks(sections: ReportSectionValue[] | undefined): ReportLink[] {
  const seen = new Set<string>();
  const out: ReportLink[] = [];
  for (const sct of sections ?? []) for (const l of sct.links ?? []) {
    const k = `${l.type}|${l.id}`;
    if (!seen.has(k)) { seen.add(k); out.push(l); }
  }
  return out;
}

/** A new version points its blocks at its own copies of the attachments. */
export function remapBlockFiles(sections: ReportSectionValue[], map: Map<string, string>): ReportSectionValue[] {
  return sections.map((sct) => {
    const next: ReportSectionValue = { ...sct };
    if (sct.checks) {
      next.checks = Object.fromEntries(Object.entries(sct.checks).map(([k, c]) => [k, c.photo ? { ...c, photo: map.get(c.photo) ?? c.photo } : c]));
    }
    if (sct.signature?.file) next.signature = { ...sct.signature, file: map.get(sct.signature.file) ?? sct.signature.file };
    return next;
  });
}

/** Keep only the template's sections, in its order, trimmed and capped —
 *  the one normaliser both the composer and the server use. */
export function normalizeSections(tpl: ReportTemplateDef, raw: unknown): ReportSectionValue[] {
  const byId = new Map<string, ReportSectionValue>();
  if (Array.isArray(raw)) {
    for (const r of raw as Array<Record<string, unknown>>) {
      if (r && typeof r.id === "string") byId.set(r.id, r as unknown as ReportSectionValue);
    }
  }
  return tpl.sections.map((s) => {
    const v = byId.get(s.id);
    if (s.kind !== "list" && s.kind !== "text") return normalizeBlock(s, v as unknown as Record<string, unknown> | undefined);
    if (s.kind === "list") {
      const items = Array.isArray(v?.items) ? v!.items : [];
      return { id: s.id, items: items.filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, REPORT_LIMITS.item)).filter(Boolean).slice(0, REPORT_LIMITS.items) };
    }
    return { id: s.id, text: typeof v?.text === "string" ? v.text.slice(0, REPORT_LIMITS.text) : "" };
  });
}

/** Required sections that are still empty (their ids). */
export function missingSections(tpl: ReportTemplateDef, sections: ReportSectionValue[]): string[] {
  const byId = new Map(sections.map((s) => [s.id, s]));
  return tpl.sections.filter((s) => {
    if (!s.required) return false;
    const v = byId.get(s.id);
    switch (s.kind) {
      case "list": return !(v?.items && v.items.length);
      /* Every point answered; every criterion scored. */
      case "checklist": return (s.points ?? []).some((pt) => !v?.checks?.[pt.id]?.state);
      case "score": return (s.points ?? []).some((pt) => !v?.scores?.[pt.id]);
      case "table": return !(v?.rows && v.rows.length);
      case "links": return !(v?.links && v.links.length);
      case "signature": return !v?.signature;
      case "choice": return !v?.choice;
      /* The numbers are the system's: there is nothing to fill in. */
      case "data": return false;
      default: return !(v?.text && v.text.trim());
    }
  }).map((s) => s.id);
}

/* ── Periods ─────────────────────────────────────────────────────────────
   Computed from a local calendar date (YYYY-MM-DD) so a China evening and
   a Cairo afternoon land on their own day, the same way attendance does. */
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utc = (ymd: string) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };

/** ISO-8601 week: "2026-W39" (weeks start on Monday). */
export function isoWeekKey(ymd: string): string {
  const d = utc(ymd);
  const day = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - day + 3); // the week's Thursday
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((d.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${pad(week)}`;
}

export interface ReportPeriod { start: string; end: string; key: string }

/** A range's last day (4D): never before its first, at most
 *  REPORT_LIMITS.rangeDays long. */
export function rangeEnd(start: string, end: string | null | undefined): string {
  if (!end || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) return start;
  const max = new Date(Date.parse(`${start}T00:00:00Z`) + (REPORT_LIMITS.rangeDays - 1) * 86_400_000).toISOString().slice(0, 10);
  return end > max ? max : end;
}

/** The period a new report of this cadence covers, for a local date. */
export function periodFor(cadence: ReportCadence, ymd: string): ReportPeriod {
  if (cadence === "weekly") {
    const d = utc(ymd);
    const day = (d.getUTCDay() + 6) % 7;
    const start = new Date(d); start.setUTCDate(d.getUTCDate() - day);
    const end = new Date(start); end.setUTCDate(start.getUTCDate() + 6);
    return { start: iso(start), end: iso(end), key: isoWeekKey(ymd) };
  }
  if (cadence === "monthly") {
    const [y, m] = ymd.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(last)}`, key: `${y}-${pad(m)}` };
  }
  return { start: ymd, end: ymd, key: ymd };
}
