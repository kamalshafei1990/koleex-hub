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
   --------------------------------------------------------------------------- */

import type { RrIconName } from "@/components/ui/RrIcon";

export type ReportFamily = "work" | "visits" | "suppliers" | "service" | "memos" | "hr";
export type ReportCadence = "daily" | "weekly" | "monthly" | null;
/** "text" = one free text block · "list" = bullet items, one per line ·
 *  the Phase 4A blocks: "checklist", "score", "table", "links", "signature". */
export type ReportSectionKind = "text" | "list" | "checklist" | "score" | "table" | "links" | "signature";
/** What a report can be linked to (and so appear on the page of). */
export type ReportLinkType = "customer" | "supplier" | "product" | "order";
export const REPORT_LINK_TYPES: ReportLinkType[] = ["customer", "supplier", "product", "order"];
export type ReportColumnType = "text" | "number" | "money";
/** The currencies a table's money is written in. */
export const REPORT_CURRENCIES = ["USD", "CNY", "EGP", "EUR", "AED", "SAR"] as const;
/** Who a new report goes to before the author changes anything:
 *  manager = the author's direct manager (the owner when there is none) ·
 *  hr = HR reviewers · manager_hr = both. */
export type ReportDefaultRecipients = "manager" | "hr" | "manager_hr";

export interface ReportSectionDef {
  id: string;
  kind: ReportSectionKind;
  required?: boolean;
  /** checklist: the points · score: the criteria and their weights. */
  points?: Array<{ id: string; weight?: number }>;
  /** table: the columns. */
  columns?: Array<{ id: string; type: ReportColumnType }>;
  /** table: the figures under it — each column's total (the default) or,
   *  for a comparison of offers, each column's lowest and whose it is. */
  summary?: "total" | "lowest";
  /** links: what it may point at. */
  linkTypes?: ReportLinkType[];
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
/** A block section (Phase 4A) with its points, columns or link types. */
const b = (id: string, kind: ReportSectionKind, extra: Omit<ReportSectionDef, "id" | "kind" | "required">, required = false): ReportSectionDef => ({ id, kind, required, ...extra });
const pts = (...ids: string[]) => ids.map((id) => ({ id }));

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
    sections: [b("link", "links", { linkTypes: ["customer", "product", "order"] }), t("who", "text", true), t("purpose", "text"), t("discussion", "text", true), t("opportunities", "list"), t("next_steps", "list")] },
  { key: "supplier_visit", family: "visits", icon: "building", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [b("link", "links", { linkTypes: ["supplier", "product"] }), t("who", "text", true), t("purpose", "text"), t("findings", "list", true), t("decisions", "list"), t("next_steps", "list")] },
  /* ── Purchasing & suppliers, After-sales: the first users of the Phase 4A
     blocks (the families fill out in their own phases) ── */
  { key: "factory_audit", family: "suppliers", icon: "tools", cadence: null, recipients: "manager", reviewRequired: true, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["supplier", "product"] }, true),
      b("checks", "checklist", { points: pts("licence", "capacity", "equipment", "quality_system", "materials", "samples", "packaging", "safety", "workforce") }, true),
      b("rating", "score", { points: [{ id: "quality", weight: 30 }, { id: "capacity", weight: 20 }, { id: "price", weight: 20 }, { id: "delivery", weight: 15 }, { id: "communication", weight: 15 }] }, true),
      t("findings", "list"),
      t("decision", "text", true),
    ] },
  { key: "price_comparison", family: "suppliers", icon: "balance-scale-left", cadence: null, recipients: "manager", reviewRequired: true, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["product", "supplier"] }),
      b("offers", "table", { columns: [{ id: "supplier", type: "text" }, { id: "price", type: "money" }, { id: "moq", type: "number" }, { id: "lead", type: "number" }, { id: "terms", type: "text" }], summary: "lowest" }, true),
      t("recommendation", "text", true),
    ] },
  { key: "installation", family: "service", icon: "hammer", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["customer", "order", "product"] }, true),
      t("work", "list", true),
      b("checks", "checklist", { points: pts("delivered", "installed", "power", "test_run", "settings", "training", "safety", "documents") }, true),
      t("issues", "text"),
      b("customer_sign", "signature", {}, true),
    ] },
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

export const REPORT_FAMILIES: ReportFamily[] = ["work", "visits", "suppliers", "service", "memos", "hr"];

const BY_KEY = new Map(REPORT_TEMPLATES.map((x) => [x.key, x]));
export const reportTemplate = (key: string): ReportTemplateDef | null => BY_KEY.get(key) ?? null;

/* ── Limits (server-enforced; the composer mirrors them) ── */
export const REPORT_LIMITS = { title: 200, text: 8000, items: 60, item: 600, comment: 4000, recipients: 30, rows: 50, cell: 200, links: 20, label: 200, signer: 120 } as const;

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
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
        if (links.length >= REPORT_LIMITS.links) break;
      }
      return { id, links };
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
  const list = rows ?? [];
  const nameCol = (def.columns ?? []).find((c) => c.type === "text");
  const out: TableFigure[] = [];
  for (const col of def.columns ?? []) {
    if (col.type === "text") continue;
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
