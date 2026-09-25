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
   --------------------------------------------------------------------------- */

import type { RrIconName } from "@/components/ui/RrIcon";

export type ReportFamily = "work" | "visits" | "memos" | "hr";
export type ReportCadence = "daily" | "weekly" | "monthly" | null;
/** "text" = one free text block · "list" = bullet items, one per line. */
export type ReportSectionKind = "text" | "list";
/** Who a new report goes to before the author changes anything:
 *  manager = the author's direct manager (the owner when there is none) ·
 *  hr = HR reviewers · manager_hr = both. */
export type ReportDefaultRecipients = "manager" | "hr" | "manager_hr";

export interface ReportSectionDef {
  id: string;
  kind: ReportSectionKind;
  required?: boolean;
}

export interface ReportTemplateDef {
  key: string;
  family: ReportFamily;
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
  /** The free report takes the author's own title. */
  customTitle?: boolean;
  /** Only an event asks for it (Phase 3D: the probation review): never
   *  offered in the list, and the server starts one only from its request. */
  requestOnly?: boolean;
}

const t = (id: string, kind: ReportSectionKind, required = false): ReportSectionDef => ({ id, kind, required });

export const REPORT_TEMPLATES: ReportTemplateDef[] = [
  /* ── Work: the Executive Assistant JD's reporting system, for everyone ── */
  { key: "daily", family: "work", icon: "calendar", cadence: "daily", recipients: "manager", reviewRequired: false, confidential: false,
    sections: [t("meetings", "list"), t("done", "list", true), t("pending", "list"), t("blockers", "text"), t("tomorrow", "list")] },
  { key: "weekly_plan", family: "work", icon: "bullseye-arrow", cadence: "weekly", recipients: "manager", reviewRequired: false, confidential: false,
    sections: [t("goals", "list", true), t("meetings", "list"), t("deadlines", "list"), t("support", "text")] },
  { key: "weekly", family: "work", icon: "clipboard", cadence: "weekly", recipients: "manager", reviewRequired: false, confidential: false,
    sections: [t("summary", "text", true), t("meetings", "list"), t("projects", "list"), t("decisions", "list"), t("next_week", "list")] },
  { key: "monthly", family: "work", icon: "newspaper", cadence: "monthly", recipients: "manager", reviewRequired: false, confidential: false,
    sections: [t("summary", "text", true), t("projects", "list"), t("travel", "list"), t("social", "text"), t("improvements", "list")] },
  /* ── Visits ── */
  { key: "customer_visit", family: "visits", icon: "handshake", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [t("who", "text", true), t("purpose", "text"), t("discussion", "text", true), t("opportunities", "list"), t("next_steps", "list")] },
  { key: "supplier_visit", family: "visits", icon: "building", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [t("who", "text", true), t("purpose", "text"), t("findings", "list", true), t("decisions", "list"), t("next_steps", "list")] },
  /* ── Memos ── */
  { key: "decision_memo", family: "memos", icon: "gavel", cadence: null, recipients: "manager", reviewRequired: true, confidential: false,
    sections: [t("background", "text", true), t("options", "list", true), t("recommendation", "text", true), t("deadline", "text")] },
  { key: "escalation", family: "memos", icon: "flag-alt", cadence: null, recipients: "manager", reviewRequired: false, confidential: false, urgent: true,
    sections: [t("what", "text", true), t("impact", "text", true), t("needed", "text", true)] },
  { key: "handover", family: "memos", icon: "briefcase", cadence: null, recipients: "manager", reviewRequired: true, confidential: false,
    sections: [t("open_tasks", "list", true), t("meetings", "list"), t("contacts", "list"), t("notes", "text")] },
  { key: "free", family: "memos", icon: "document", cadence: null, recipients: "manager", reviewRequired: false, confidential: false, customTitle: true,
    sections: [t("body", "text", true)] },
  /* ── HR (the owner: "I need the HR also") ── */
  { key: "hr_incident", family: "hr", icon: "hard-hat", cadence: null, recipients: "manager_hr", reviewRequired: false, confidential: false, urgent: true,
    sections: [t("what", "text", true), t("where_when", "text", true), t("people", "list"), t("action", "text")] },
  { key: "hr_grievance", family: "hr", icon: "lock", cadence: null, recipients: "hr", reviewRequired: false, confidential: true,
    sections: [t("subject", "text", true), t("details", "text", true), t("wanted", "text")] },
  { key: "hr_warning", family: "hr", icon: "id-badge", cadence: null, recipients: "hr", reviewRequired: false, confidential: true, hrOnly: true,
    sections: [t("employee", "text", true), t("incident", "text", true), t("rule", "text"), t("action", "text", true)] },
  { key: "hr_exit_interview", family: "hr", icon: "users", cadence: null, recipients: "hr", reviewRequired: false, confidential: true, hrOnly: true,
    sections: [t("employee", "text", true), t("reasons", "list", true), t("liked", "list"), t("improve", "list"), t("return", "text")] },
  /* ── Asked for by events (Phase 3D, owner's picks 25 Sep 2026) ──
     Anyone may also start the first two themselves; the probation review
     only ever comes from its request, to the employee's manager. */
  { key: "return_plan", family: "work", icon: "arrow-left", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [t("away", "text"), t("catch_up", "list", true), t("priorities", "list", true), t("help", "text")] },
  { key: "attendance_note", family: "work", icon: "fingerprint", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [t("what", "text"), t("reason", "text", true), t("covered", "text"), t("correction", "text")] },
  { key: "probation_review", family: "hr", icon: "award", cadence: null, recipients: "hr", reviewRequired: false, confidential: true, requestOnly: true,
    sections: [t("employee", "text", true), t("performance", "text", true), t("strengths", "list"), t("concerns", "list"), t("recommendation", "text", true)] },
];

export const REPORT_FAMILIES: ReportFamily[] = ["work", "visits", "memos", "hr"];

const BY_KEY = new Map(REPORT_TEMPLATES.map((x) => [x.key, x]));
export const reportTemplate = (key: string): ReportTemplateDef | null => BY_KEY.get(key) ?? null;

/* ── Limits (server-enforced; the composer mirrors them) ── */
export const REPORT_LIMITS = { title: 200, text: 8000, items: 60, item: 600, comment: 4000, recipients: 30 } as const;

/* ── Sections as stored ── */
export interface ReportSectionValue { id: string; text?: string; items?: string[] }

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
    return s.kind === "list" ? !(v?.items && v.items.length) : !(v?.text && v.text.trim());
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
