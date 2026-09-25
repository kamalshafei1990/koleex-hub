/* ---------------------------------------------------------------------------
   Reports — the types people make in the template builder (Phase 4E, owner's
   picks, 25 Sep 2026). Pure: the builder screen, the server routes and
   validate:reports share every rule here.

   Who: super admins, and anyone granted "Report Templates" in Roles.
   What: a type from nothing, or a COPY of a built-in (the original stays);
   the built-in types nobody uses can be hidden (old reports stay).
   Editing: a report keeps a copy of its type as it was when the report was
   started (work_reports.template_snapshot) — "old reports stay, new ones get
   the change". Archiving a type stops new reports of it; the old ones stay.

   A builder type is a row of work_report_templates: its settings and
   sections (`def`, the same shape as a built-in's) and its words (`words`),
   keyed like a built-in's minus `tpl.<key>.`:
     "name", "desc", "s.<section>", "s.<section>.hint",
     "s.<section>.i.<point>", "s.<section>.c.<column>", "s.<section>.o.<answer>"
   each { en, zh, ar }. A word written in one language only shows in that
   language on the other screens (English first, then Arabic, then Chinese)
   until someone fills the rest — the builder offers Koleex AI for that.

   The daily, weekly and monthly reports are what the compliance board
   counts, so they cannot be hidden; a copy of one is a type of its own and
   is not counted. A copy keeps what its built-in knew how to do (see
   ReportTemplateDef.base).
   --------------------------------------------------------------------------- */

import type { Lang, Translations } from "@/lib/i18n";
import type { RrIconName } from "@/components/ui/RrIcon";
import { isCustomKey, isWritten, type TemplateHead, type TemplateWords, type Word } from "./template-words";
import {
  REPORT_APPS, REPORT_DATA_SOURCES, REPORT_FAMILIES, REPORT_LINK_TYPES,
  type DataInputDef, type ReportApp, type ReportCadence, type ReportColumnType, type ReportDataSource, type ReportDefaultRecipients, type ReportFamily,
  type ReportLinkType, type ReportSectionDef, type ReportSectionKind, type ReportTemplateDef,
} from "./templates";
import { REPORT_TEMPLATES, reportTemplate } from "./catalog";
import { DATA_ABOUT } from "./report-data";

export { CUSTOM_KEY, isCustomKey, pickWord, templateWords, headWords } from "./template-words";
export type { Word, TemplateWords, TemplateHead } from "./template-words";

/** A builder type without its key (the row holds that). */
export interface CustomDef {
  family: ReportFamily;
  icon: RrIconName;
  cadence: ReportCadence;
  range: boolean;
  recipients: ReportDefaultRecipients;
  reviewRequired: boolean;
  confidential: boolean;
  urgent: boolean;
  customTitle: boolean;
  hrOnly: boolean;
  /** 5A: only someone with a team starts it. */
  teamOnly: boolean;
  /** 5B: only super admins and «CEO Office» in Roles start it. */
  officeOnly: boolean;
  /** 5C: only super admins and «Payroll Reports» in Roles start it. */
  payrollOnly: boolean;
  /** 5C: the app it needs (HR: HR · view) — or, `orTeam`, a team. A copy
   *  keeps its built-in's; the builder does not set them. */
  app?: ReportApp;
  orTeam?: boolean;
  base?: string;
  sections: ReportSectionDef[];
}

/** The copy a report keeps of its builder type. */
export interface TemplateSnapshot { v: number; def: CustomDef; words: TemplateWords; head: TemplateHead }

/** A builder type as the picker and the builder's list show it. */
export interface CustomTemplateHead {
  key: string;
  family: ReportFamily;
  icon: RrIconName;
  cadence: ReportCadence;
  hrOnly?: boolean;
  teamOnly?: boolean;
  officeOnly?: boolean;
  payrollOnly?: boolean;
  app?: ReportApp;
  orTeam?: boolean;
  name: Word;
  desc: Word;
  status?: "active" | "archived";
  version?: number;
  updatedAt?: string;
}

export const BUILDER_LIMITS = { sections: 20, points: 20, columns: 8, options: 10, name: 80, desc: 200, label: 120, hint: 240, perTenant: 100 } as const;

/** The blocks a builder type may hold, in the order the builder offers them. */
export const SECTION_KINDS: ReportSectionKind[] = ["text", "list", "checklist", "score", "table", "choice", "links", "data", "signature"];

/** The icons a builder type may take — each a Hub icon, never a new one:
 *  a set that suits reports, and every icon a built-in uses (a copy keeps
 *  its own). */
export const ICON_CHOICES: RrIconName[] = Array.from(new Set<RrIconName>([
  "document", "clipboard", "briefcase", "users", "handshake", "megaphone", "bullseye-arrow", "ad", "newspaper", "camera",
  "palette", "signal-stream", "calendar", "clock", "paper-plane", "file-invoice-dollar", "receipt", "coins", "wallet", "percentage",
  "box-open", "pallet", "truck-side", "ship-side", "plane-departure", "tools", "hard-hat", "flask", "shield-check", "badge-check",
  "award", "graduation-cap", "building", "bulb", "microphone", "gavel", "scale", "flag-checkered", "leaf", "heart-rate",
  ...REPORT_TEMPLATES.map((t) => t.icon),
]));

/** The three reports the compliance board counts — never hidden. */
export const UNHIDEABLE = ["daily", "weekly", "monthly"];

/** A built-in the builder may copy (and hide): anything a person starts —
 *  never a type only an event asks for. */
export const copyableBuiltin = (key: string): boolean => { const t = reportTemplate(key); return !!t && !t.requestOnly; };
export const hideableBuiltin = (key: string): boolean => copyableBuiltin(key) && !UNHIDEABLE.includes(key);

const ID = /^[a-z][a-z0-9_]{0,31}$/;
const RECIPIENTS: ReportDefaultRecipients[] = ["manager", "hr", "manager_hr", "none"];
const COLUMN_TYPES: ReportColumnType[] = ["text", "number", "money", "date"];
const LANGS: Lang[] = ["en", "zh", "ar"];
type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Ids in order, well formed, each once, at most `max`. */
function ids(raw: unknown, max: number): string[] {
  const out: string[] = [];
  for (const x of list(raw)) {
    const id = typeof x === "string" ? x : typeof obj(x).id === "string" ? (obj(x).id as string) : "";
    if (ID.test(id) && !out.includes(id)) out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

/** One section as the builder may define it: only the fields its kind has. */
function cleanSection(raw: Raw): ReportSectionDef | null {
  const id = typeof raw.id === "string" ? raw.id : "";
  const kind = raw.kind as ReportSectionKind;
  if (!ID.test(id) || !SECTION_KINDS.includes(kind)) return null;
  /* The numbers are the system's: there is nothing to fill in, so nothing to require. */
  const s: ReportSectionDef = { id, kind, required: kind !== "data" && raw.required === true };
  switch (kind) {
    case "checklist":
      s.points = ids(raw.points, BUILDER_LIMITS.points).map((pid) => ({ id: pid }));
      break;
    case "score": {
      const weights = new Map(list(raw.points).map((p) => [obj(p).id, obj(p).weight]));
      s.points = ids(raw.points, BUILDER_LIMITS.points).map((pid) => {
        const w = weights.get(pid);
        return typeof w === "number" && Number.isInteger(w) && w > 1 && w <= 100 ? { id: pid, weight: w } : { id: pid };
      });
      break;
    }
    case "table": {
      const types = new Map(list(raw.columns).map((c) => [obj(c).id, obj(c).type]));
      s.columns = ids(raw.columns, BUILDER_LIMITS.columns).map((cid) => {
        const type = types.get(cid) as ReportColumnType;
        return { id: cid, type: COLUMN_TYPES.includes(type) ? type : "text" };
      });
      s.summary = raw.summary === "lowest" || raw.summary === "none" ? raw.summary : "total";
      const of = ids(raw.summaryOf, BUILDER_LIMITS.columns).filter((cid) => s.columns!.some((c) => c.id === cid && (c.type === "number" || c.type === "money")));
      if (of.length) s.summaryOf = of;
      break;
    }
    case "links": {
      const types = list(raw.linkTypes).filter((x): x is ReportLinkType => REPORT_LINK_TYPES.includes(x as ReportLinkType));
      s.linkTypes = types.length ? REPORT_LINK_TYPES.filter((x) => types.includes(x)) : [...REPORT_LINK_TYPES];
      /* 5C: what the report is about — one, picking another replaces it. */
      if (raw.max === 1) s.max = 1;
      break;
    }
    case "choice":
      s.options = ids(raw.options, BUILDER_LIMITS.options);
      break;
    case "data":
      if (REPORT_DATA_SOURCES.includes(raw.source as ReportDataSource)) s.source = raw.source as ReportDataSource;
      if (raw.notes === true) s.notes = true;
      /* 5C: a copy keeps the figure its built-in takes beside the system's. */
      { const input = cleanInput(raw.input); if (input) s.input = input; }
      break;
  }
  return s;
}

/** A typed figure beside the system's (5C), as a copy of a built-in keeps it. */
function cleanInput(raw: unknown): DataInputDef | undefined {
  const o = obj(raw);
  if (typeof o.id !== "string" || !ID.test(o.id) || (o.type !== "number" && o.type !== "money")) return undefined;
  const out: DataInputDef = { id: o.id, type: o.type };
  for (const k of ["against", "diff", "valueBy", "value"] as const) if (typeof o[k] === "string" && ID.test(o[k] as string)) out[k] = o[k] as string;
  for (const k of ["min", "max"] as const) if (typeof o[k] === "number" && Number.isFinite(o[k])) out[k] = o[k] as number;
  return out;
}

/** Every word a definition needs, with its length cap and whether it must be written. */
export function wordSlots(def: Pick<CustomDef, "sections">): Array<{ key: string; max: number; required: boolean }> {
  const out: Array<{ key: string; max: number; required: boolean }> = [
    { key: "name", max: BUILDER_LIMITS.name, required: true },
    { key: "desc", max: BUILDER_LIMITS.desc, required: false },
  ];
  for (const s of def.sections) {
    out.push({ key: `s.${s.id}`, max: BUILDER_LIMITS.label, required: true });
    if (s.kind === "text" || s.kind === "list") out.push({ key: `s.${s.id}.hint`, max: BUILDER_LIMITS.hint, required: false });
    for (const p of s.points ?? []) out.push({ key: `s.${s.id}.i.${p.id}`, max: BUILDER_LIMITS.label, required: true });
    for (const c of s.columns ?? []) out.push({ key: `s.${s.id}.c.${c.id}`, max: BUILDER_LIMITS.label, required: true });
    for (const o of s.options ?? []) out.push({ key: `s.${s.id}.o.${o}`, max: BUILDER_LIMITS.label, required: true });
  }
  return out;
}


/** A builder type as it may be saved: the definition cleaned (only what
 *  each kind has, ids well formed and unique, within the limits), its words
 *  kept to what the definition names — and what is still wrong (codes the
 *  builder words: "no_sections", "name", "s.<id>", "points:<id>"…). Saving
 *  waits until `problems` is empty; the server runs the same check. */
export function checkTemplate(rawDef: unknown, rawWords: unknown): { def: CustomDef; words: TemplateWords; problems: string[] } {
  const d = obj(rawDef);
  const sections: ReportSectionDef[] = [];
  for (const raw of list(d.sections)) {
    const s = cleanSection(obj(raw));
    if (s && !sections.some((x) => x.id === s.id)) sections.push(s);
    if (sections.length >= BUILDER_LIMITS.sections) break;
  }
  const cadence: ReportCadence = d.cadence === "daily" || d.cadence === "weekly" || d.cadence === "monthly" ? d.cadence : null;
  const def: CustomDef = {
    family: REPORT_FAMILIES.includes(d.family as ReportFamily) ? (d.family as ReportFamily) : "work",
    icon: ICON_CHOICES.includes(d.icon as RrIconName) ? (d.icon as RrIconName) : "document",
    cadence,
    /* A trip's first and last day, or a day / week / month — never both. */
    range: !cadence && d.range === true,
    recipients: RECIPIENTS.includes(d.recipients as ReportDefaultRecipients) ? (d.recipients as ReportDefaultRecipients) : "manager",
    reviewRequired: d.reviewRequired === true,
    confidential: d.confidential === true,
    urgent: d.urgent === true,
    customTitle: d.customTitle === true,
    hrOnly: d.hrOnly === true,
    teamOnly: d.teamOnly === true,
    officeOnly: d.officeOnly === true,
    payrollOnly: d.payrollOnly === true,
    sections,
  };
  if (REPORT_APPS.includes(d.app as ReportApp)) { def.app = d.app as ReportApp; if (d.orTeam === true) def.orTeam = true; }
  if (typeof d.base === "string" && copyableBuiltin(d.base)) def.base = d.base;

  const src = obj(rawWords);
  const words: TemplateWords = {};
  const problems: string[] = [];
  if (!sections.length) problems.push("no_sections");
  for (const s of sections) {
    if ((s.kind === "checklist" || s.kind === "score") && !s.points?.length) problems.push(`points:${s.id}`);
    if (s.kind === "table" && !s.columns?.length) problems.push(`columns:${s.id}`);
    if (s.kind === "choice" && (s.options?.length ?? 0) < 2) problems.push(`options:${s.id}`);
    if (s.kind === "data" && !s.source) problems.push(`source:${s.id}`);
    /* 5C: numbers about one project, employee or warehouse need a links
       block that can pick one. */
    const about = s.kind === "data" && s.source ? DATA_ABOUT[s.source] : undefined;
    if (about?.required && !sections.some((x) => x.kind === "links" && (x.linkTypes ?? REPORT_LINK_TYPES).includes(about.type))) problems.push(`about:${s.id}`);
  }
  for (const slot of wordSlots(def)) {
    const w = obj(src[slot.key]);
    const kept: Word = {};
    for (const l of LANGS) {
      const v = typeof w[l] === "string" ? (w[l] as string).replace(/\s+/g, " ").trim().slice(0, slot.max) : "";
      if (v) kept[l] = v;
    }
    if (isWritten(kept)) words[slot.key] = kept;
    else if (slot.required) problems.push(slot.key);
  }
  return { def, words, problems };
}

export const headOf = (def: CustomDef, words: TemplateWords): TemplateHead => ({ name: words.name ?? {}, icon: def.icon, cadence: def.cadence, urgent: def.urgent });

/** What a new report of a builder type keeps of it. */
export const snapshotOf = (def: CustomDef, words: TemplateWords, v: number): TemplateSnapshot => ({ v, def, words, head: headOf(def, words) });

/** A builder type as the engine takes any type. */
export function asReportTemplate(key: string, def: CustomDef, v: number): ReportTemplateDef {
  const out: ReportTemplateDef = {
    key, family: def.family, icon: def.icon, cadence: def.cadence, sections: def.sections, recipients: def.recipients,
    reviewRequired: def.reviewRequired, confidential: def.confidential, custom: true, version: v,
  };
  if (def.urgent) out.urgent = true;
  if (def.customTitle) out.customTitle = true;
  if (def.hrOnly) out.hrOnly = true;
  if (def.teamOnly) out.teamOnly = true;
  if (def.officeOnly) out.officeOnly = true;
  if (def.payrollOnly) out.payrollOnly = true;
  if (def.app) { out.app = def.app; if (def.orTeam) out.orTeam = true; }
  if (def.range) out.range = true;
  if (def.base) out.base = def.base;
  return out;
}

/** The copy a report keeps, read back. It was checked when it was written,
 *  so this only makes sure of its shape — it never re-cleans it: a rule
 *  added later must not change a report already started. */
export function readSnapshot(raw: unknown): TemplateSnapshot | null {
  const snap = obj(raw);
  const def = obj(snap.def);
  const sections = list(def.sections).filter((s): s is ReportSectionDef => {
    const o = obj(s);
    return typeof o.id === "string" && SECTION_KINDS.includes(o.kind as ReportSectionKind);
  });
  if (!sections.length || !REPORT_FAMILIES.includes(def.family as ReportFamily)) return null;
  const v = typeof snap.v === "number" && snap.v >= 1 ? snap.v : 1;
  const clean: CustomDef = {
    family: def.family as ReportFamily,
    icon: typeof def.icon === "string" ? (def.icon as RrIconName) : "document",
    cadence: def.cadence === "daily" || def.cadence === "weekly" || def.cadence === "monthly" ? def.cadence : null,
    range: def.range === true, recipients: RECIPIENTS.includes(def.recipients as ReportDefaultRecipients) ? (def.recipients as ReportDefaultRecipients) : "manager",
    reviewRequired: def.reviewRequired === true, confidential: def.confidential === true, urgent: def.urgent === true,
    customTitle: def.customTitle === true, hrOnly: def.hrOnly === true, teamOnly: def.teamOnly === true, officeOnly: def.officeOnly === true,
    payrollOnly: def.payrollOnly === true, sections,
  };
  if (REPORT_APPS.includes(def.app as ReportApp)) { clean.app = def.app as ReportApp; if (def.orTeam === true) clean.orTeam = true; }
  if (typeof def.base === "string") clean.base = def.base;
  const words = obj(snap.words) as TemplateWords;
  return { v, def: clean, words, head: headOf(clean, words) };
}

/** A report's own type: a built-in by its key — or, for a builder type,
 *  the version the report was started with (its snapshot). */
export function templateOf(row: { template_key: string; template_snapshot?: unknown }): ReportTemplateDef | null {
  const builtin = reportTemplate(row.template_key);
  if (builtin) return builtin;
  if (!isCustomKey(row.template_key)) return null;
  const snap = readSnapshot(row.template_snapshot);
  return snap ? asReportTemplate(row.template_key, snap.def, snap.v) : null;
}

/** A built-in, as the starting point of a copy: the same settings and
 *  sections (the same ids, so what the built-in knew how to do still finds
 *  them) and every word it has in `dict` (the Reports dictionary with the
 *  family's section words). */
export function copyOfBuiltin(key: string, dict: Translations): { def: CustomDef; words: TemplateWords } | null {
  const t = reportTemplate(key);
  if (!t || t.requestOnly) return null;
  const def: CustomDef = {
    family: t.family, icon: t.icon, cadence: t.cadence, range: !!t.range,
    recipients: t.recipients, reviewRequired: t.reviewRequired, confidential: t.confidential, urgent: !!t.urgent,
    customTitle: !!t.customTitle, hrOnly: !!t.hrOnly, teamOnly: !!t.teamOnly, officeOnly: !!t.officeOnly, payrollOnly: !!t.payrollOnly, base: t.key,
    ...(t.app ? { app: t.app, ...(t.orTeam ? { orTeam: true } : {}) } : {}),
    sections: t.sections.map((s) => JSON.parse(JSON.stringify(s)) as ReportSectionDef),
  };
  const words: TemplateWords = {};
  for (const slot of wordSlots(def)) {
    const w = dict[`tpl.${key}.${slot.key}`];
    if (w) words[slot.key] = { en: w.en, zh: w.zh, ar: w.ar };
  }
  return { def, words };
}

/** The next free id for a new point, column or answer: prefix + n. */
export function nextId(taken: Iterable<string>, prefix: string): string {
  const used = new Set(taken);
  for (let n = 1; ; n++) if (!used.has(`${prefix}${n}`)) return `${prefix}${n}`;
}

/** A new section's id: "s" and four letters or digits, never one this type
 *  has — nor, by chance, one an earlier version had (a removed section's id
 *  is never handed to a different one). */
export function newSectionId(taken: Iterable<string>, random: () => number = Math.random): string {
  const used = new Set(taken);
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (;;) {
    let id = "s";
    for (let i = 0; i < 4; i++) id += abc[Math.floor(random() * abc.length) % abc.length];
    if (!used.has(id)) return id;
  }
}
