/* ---------------------------------------------------------------------------
   Reports — Koleex AI in the composer (Phase 2D, owner's pick 25 Sep 2026).

   Two actions, both "fill, never save": the result is shown under the
   section as a proposal, the author chooses Use / Add below / Discard, and
   even then it is only the draft's text — nothing is sent, nothing is
   saved beyond the draft, and the author reads it before sending.
     · write  — the summary of a weekly or monthly report, from the material
                the composer already holds (the carry-over from the author's
                earlier reports, their own work in the apps, and what the
                report already says).
     · tidy   — any section the author has written (often dictated): the same
                facts, said clearly, in the same language; nothing added.

   Pure (browser + server): which sections each action serves, the writing
   language, the material as one bounded text, and turning the model's
   answer back into a section. The route is /api/work-reports/[id]/ai.
   --------------------------------------------------------------------------- */

import { REPORT_LIMITS, reportTemplate, type ReportSectionKind } from "./templates";
import type { CarryGroup } from "./carry";

export type AiAction = "write" | "tidy";
export type WritingLang = "en" | "zh" | "ar";

/** Sections Koleex AI can WRITE from the period's material. Every other
 *  section can be tidied once the author has written something in it. */
export const AI_WRITE_SECTIONS: Record<string, string[]> = {
  weekly: ["summary"],
  monthly: ["summary"],
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

export const canWrite = (templateKey: string, sectionId: string) => (AI_WRITE_SECTIONS[templateKey] ?? []).includes(sectionId);

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
    parts.push(`## ${heading}\n${group.items.map((i) => (i.paragraph ? i.text : `- ${i.text}`)).join("\n")}`);
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
export function checkAiRequest(templateKey: string, body: Partial<AiDraftRequest>): string | null {
  const tpl = reportTemplate(templateKey);
  if (!tpl) return "unknown_template";
  if (body.action !== "write" && body.action !== "tidy") return "bad_action";
  if (!body.section || !tpl.sections.some((s) => s.id === body.section)) return "bad_section";
  if (body.lang !== "en" && body.lang !== "zh" && body.lang !== "ar") return "bad_lang";
  if (body.action === "write") {
    if (!canWrite(templateKey, body.section)) return "not_writable";
    if (typeof body.material !== "string" || !body.material.trim()) return "no_material";
    if (body.material.length > AI_LIMITS.material + 2) return "too_long";
  } else {
    if (typeof body.text !== "string" || body.text.trim().length < AI_LIMITS.tidyMin) return "too_short";
    if (body.text.length > AI_LIMITS.tidy) return "too_long";
  }
  return null;
}
