/* ---------------------------------------------------------------------------
   Reports — the section words of a report, loaded with it (Phase 4C).

   Every Reports page carries ../reports.ts (the UI and every template's name
   and description — lists show them). The words INSIDE a template — its
   sections, hints, checklist points, score criteria, table columns, answers
   — are only on the report's own page and its print, so each family's words
   are their own chunk, asked for together with the report (before it paints,
   like the blocks' code). The dictionary on every other page no longer grows
   with each new template.

   A report shows its own family's words, and the carry-over card quotes the
   earlier reports it draws from (CARRY_RULES — work templates today), so
   their families come too.
   --------------------------------------------------------------------------- */

import type { Translations } from "@/lib/i18n";
import { reportTemplate, type ReportFamily } from "@/lib/reports/templates";
import { CARRY_RULES } from "@/lib/reports/carry";

const LOAD: Record<ReportFamily, () => Promise<{ default: Translations }>> = {
  work: () => import("./work"),
  team: () => import("./team"),
  visits: () => import("./visits"),
  sales: () => import("./sales"),
  marketing: () => import("./marketing"),
  suppliers: () => import("./suppliers"),
  quality: () => import("./quality"),
  logistics: () => import("./logistics"),
  service: () => import("./service"),
  travel: () => import("./travel"),
  memos: () => import("./memos"),
  hr: () => import("./hr"),
};

/** The families whose section words a report shows. */
export function sectionFamilies(templateKey: string): ReportFamily[] {
  const own = reportTemplate(templateKey)?.family;
  const quoted = (CARRY_RULES[templateKey] ?? []).map((r) => reportTemplate(r.from)?.family);
  return Array.from(new Set([own, ...quoted].filter((f): f is ReportFamily => !!f)));
}

/** A report's section words, merged (one chunk per family). */
export async function loadSectionWords(templateKey: string): Promise<Translations> {
  const parts = await Promise.all(sectionFamilies(templateKey).map((f) => LOAD[f]()));
  return Object.assign({}, ...parts.map((p) => p.default)) as Translations;
}

/** The words a report shows: a built-in's family words — or a builder
 *  type's own (4E, they come with the report), over the words of the
 *  built-in it was copied from (its suggestions quote that one's reports). */
export async function loadReportWords(templateKey: string, custom?: { def: { base?: string }; words: Translations }): Promise<Translations> {
  if (!custom) return loadSectionWords(templateKey);
  const base = custom.def.base ? await loadSectionWords(custom.def.base) : {};
  return { ...base, ...custom.words };
}
