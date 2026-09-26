/* ---------------------------------------------------------------------------
   Reports — Koleex AI in the composer (Phase 2D, owner's pick 25 Sep 2026).

   Two actions, both "fill, never save": the result is shown under the
   section as a proposal, the author chooses Use / Add below / Discard, and
   even then it is only the draft's text — nothing is sent, nothing is
   saved beyond the draft, and the author reads it before sending.
     · write  — the summary of a weekly or monthly report, from the material
                the composer already holds (the carry-over from the author's
                earlier reports, their own work in the apps, and what the
                report already says). 27/09/2026: also the daily report's and
                the weekly plan's lists, each from ITS OWN suggestions only.
     · tidy   — any section the author has written (often dictated): the same
                facts, said clearly, in the same language; nothing added.

   Pure (browser + server): which sections each action serves, the writing
   language, the material as one bounded text, and turning the model's
   answer back into a section. The route is /api/work-reports/[id]/ai.
   --------------------------------------------------------------------------- */

import { REPORT_LIMITS, behaviourKey, type ReportSectionKind, type ReportTemplateDef } from "./templates";
import type { CarryGroup } from "./carry";

export type AiAction = "write" | "tidy";
export type WritingLang = "en" | "zh" | "ar";

/** Sections Koleex AI can WRITE from the period's material. Every other
 *  section can be tidied once the author has written something in it. */
export const AI_WRITE_SECTIONS: Record<string, string[]> = {
  weekly: ["summary"],
  monthly: ["summary"],
  /* 6D: from the shorter reports inside the period (and the quarter's
     finished records). */
  quarterly: ["summary"],
  halfyear: ["summary"],
  annual: ["summary"],
  /* 27/09/2026 (owner: «أيوه خلي اكتبهولي يشتغل في اليومي وخطة الأسبوع»):
     their lists, each from its own suggestions (writeGroups) with its own
     guide (WRITE_GUIDE). Never the problems or the help needed — only the
     writer knows those. */
  daily: ["meetings", "done", "pending", "tomorrow"],
  weekly_plan: ["goals", "meetings", "deadlines"],
  /* 5A: from what the team sent in the report's days — read by the server. */
  team_summary: ["summary"],
  /* 5D: from what the whole company sent — read by the server. */
  exec_weekly: ["summary"],
  exec_monthly_review: ["summary"],
};

/** What "write" is told a LIST section holds — the facts that belong in it,
 *  and nothing else (by the built-in's key and the section's id). */
export const WRITE_GUIDE: Record<string, string> = {
  "daily.meetings": "the meetings held that day, from the calendar and the customer activities: with whom, and about what, as the records say.",
  "daily.done": "the work FINISHED that day: only what the records show as done or issued (finished tasks, quotations, invoices, orders, customer activities).",
  "daily.pending": "what is still open: open tasks, and earlier plans or pending items that no record shows finished and that this report does not already list as done.",
  "daily.tomorrow": "what comes next: tomorrow's meetings, and the open tasks due next — a time or a day only where the material gives one.",
  "weekly_plan.goals": "this week's goals: what last week's report planned for this week, and the tasks and plans due this week. Write them as goals: merge related tasks into one goal; do not copy every task.",
  "weekly_plan.meetings": "the meetings planned this week, each with its day where the material gives one.",
  "weekly_plan.deadlines": "this week's deadlines: the tasks and plans due this week, each with its day where the material gives one.",
};

/** A list section written from the APPS' records only: an earlier plan
 *  ("tomorrow", "pending") is not proof the work was done. */
export const WRITE_APPS_ONLY: readonly string[] = ["daily.done"];

/** The most items "write" puts in a list. */
export const WRITE_LIST_MAX = 10;

/** A list section's guide (a builder copy follows its built-in). */
export function writeGuide(tpl: ReportTemplateDef | null | undefined, sectionId: string): string | null {
  if (!tpl) return null;
  return WRITE_GUIDE[`${tpl.key}.${sectionId}`] ?? WRITE_GUIDE[`${behaviourKey(tpl)}.${sectionId}`] ?? null;
}

/** The suggestion lists a section is written from. A text section (a
 *  summary) reads them all; a list section only those that may go in it —
 *  and the daily's "done" only the apps' records. */
export function writeGroups<G extends { to: string[]; app?: boolean }>(tpl: ReportTemplateDef, sectionId: string, groups: G[]): G[] {
  const kind = tpl.sections.find((s) => s.id === sectionId)?.kind;
  if (kind !== "list") return groups;
  const appsOnly = WRITE_APPS_ONLY.includes(`${behaviourKey(tpl)}.${sectionId}`);
  return groups.filter((g) => g.to.includes(sectionId) && (!appsOnly || !!g.app));
}

/** 5D: the types written from what the whole COMPANY sent (the executive
 *  summary and the monthly review — «Management Reports»). */
export const COMPANY_MATERIAL = ["exec_weekly", "exec_monthly_review"] as const;
export const companyMaterial = (tpl: ReportTemplateDef | null | undefined): boolean =>
  !!tpl && (COMPANY_MATERIAL as readonly string[]).includes(behaviourKey(tpl));

/** A type whose "write" material the SERVER gathers (5A: the team's reports;
 *  5D: the company's — the author's page never carries other people's
 *  reports to send back). */
export const serverMaterial = (tpl: ReportTemplateDef | null | undefined): boolean => {
  return !!tpl && (behaviourKey(tpl) === "team_summary" || companyMaterial(tpl));
};

export const AI_LIMITS = {
  /** The material sent for "write". */
  material: 12_000,
  /** A section sent for "tidy" — a whole section at most. */
  tidy: REPORT_LIMITS.text,
  /** Tidying needs something to tidy. */
  tidyMin: 12,
  /** Calls per author per hour (the route counts). */
  perHour: 40,
} as const;

/** A builder copy (4E) writes what its built-in writes, for the sections it kept. */
export function canWrite(tpl: ReportTemplateDef | null | undefined, sectionId: string): boolean {
  if (!tpl || !tpl.sections.some((s) => s.id === sectionId)) return false;
  return (AI_WRITE_SECTIONS[tpl.key] ?? AI_WRITE_SECTIONS[behaviourKey(tpl)] ?? []).includes(sectionId);
}

const isCjk = (cp: number) => (cp >= 0x2e80 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff);

/** The language the author WRITES in (not the screen's): the script most of
 *  their own words use; the screen's language when there is too little to
 *  tell. */
export function writingLang(samples: string[], fallback: WritingLang): WritingLang {
  let ar = 0, zh = 0, latin = 0;
  for (const s of samples) {
    for (const ch of s) {
      const cp = ch.codePointAt(0) ?? 0;
      if (cp >= 0x0600 && cp <= 0x06ff) ar++;
      else if (isCjk(cp)) zh += 2;
      else if ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a)) latin++;
    }
  }
  if (ar + zh + latin < 12) return fallback;
  if (ar >= zh && ar >= latin) return "ar";
  if (zh >= latin) return "zh";
  return "en";
}

/** The material for "write", as one text the model reads: each list of
 *  suggestions under its heading, then what the report already says.
 *  Bounded; the most useful lists come first. */
export function writeMaterial(
  groups: Array<{ heading: string; group: CarryGroup }>,
  sections: Array<{ name: string; text: string }>,
): string {
  const parts: string[] = [];
  for (const { heading, group } of groups) {
    if (!group.items.length) continue;
    /* An app suggestion keeps its tag ("To-do · 15/01") — the only place
       its day is written, so the model never has to guess one. */
    parts.push(`## ${heading}\n${group.items.map((i) => (i.paragraph ? i.text : `- ${i.text}${i.tag ? ` (${i.tag})` : ""}`)).join("\n")}`);
  }
  const written = sections.filter((s) => s.text.trim());
  if (written.length) parts.push(`## Already in this report\n${written.map((s) => `### ${s.name}\n${s.text.trim()}`).join("\n")}`);
  const all = parts.join("\n\n");
  return all.length > AI_LIMITS.material ? `${all.slice(0, AI_LIMITS.material)}\n…` : all;
}

/** The model's answer back into a section: plain text (no Markdown bold or
 *  headings), a list as one item per line without bullets, within the
 *  section's limits. */
export function toSection(answer: string, kind: ReportSectionKind): string {
  const plain = answer
    .replace(/\r/g, "")
    .replace(/^\s*```[a-z]*\s*$/gim, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .trim();
  if (kind === "list") {
    return plain.split("\n")
      .map((l) => l.replace(/^\s*(?:[-•*·▪–—]|\d{1,3}[.)])\s*/, "").trim())
      .filter(Boolean)
      .slice(0, REPORT_LIMITS.items)
      .map((l) => l.slice(0, REPORT_LIMITS.item))
      .join("\n");
  }
  return plain.replace(/\n{3,}/g, "\n\n").slice(0, REPORT_LIMITS.text);
}

/** A model asked for a section's text sometimes opens with the section's
 *  own name as a heading ("Quarter summary" — seen live on the first
 *  quarterly, 26/09/2026), which "Use it" would paste into the report. A
 *  first line that is one of the section's names — in any language, with
 *  or without a heading mark or a colon — is dropped; nothing else is. */
export function dropEchoedTitle(answer: string, names: string[]): string {
  const norm = (s: string) => s.replace(/^[\s#*_>]+|[\s:：*_.]+$/g, "").trim().toLowerCase();
  const wanted = new Set(names.map(norm).filter(Boolean));
  const lines = answer.replace(/\r/g, "").split("\n");
  const first = lines.findIndex((l) => l.trim());
  if (first < 0 || !wanted.has(norm(lines[first]))) return answer;
  return lines.slice(first + 1).join("\n").trim();
}

/** What the route accepts — the one shape both sides agree on. */
export interface AiDraftRequest {
  action: AiAction;
  section: string;
  lang: WritingLang;
  /** tidy: the section as the author has it now. */
  text?: string;
  /** write: writeMaterial(). */
  material?: string;
}

/** Checks a request against the report's template before any model is
 *  asked. Returns the problem, or null. */
export function checkAiRequest(tpl: ReportTemplateDef | null, body: Partial<AiDraftRequest>): string | null {
  if (!tpl) return "unknown_template";
  if (body.action !== "write" && body.action !== "tidy") return "bad_action";
  if (!body.section || !tpl.sections.some((s) => s.id === body.section)) return "bad_section";
  if (body.lang !== "en" && body.lang !== "zh" && body.lang !== "ar") return "bad_lang";
  if (body.action === "write") {
    if (!canWrite(tpl, body.section)) return "not_writable";
    if (!serverMaterial(tpl) && (typeof body.material !== "string" || !body.material.trim())) return "no_material";
    if (typeof body.material === "string" && body.material.length > AI_LIMITS.material + 2) return "too_long";
  } else {
    if (typeof body.text !== "string" || body.text.trim().length < AI_LIMITS.tidyMin) return "too_short";
    if (body.text.length > AI_LIMITS.tidy) return "too_long";
  }
  return null;
}
