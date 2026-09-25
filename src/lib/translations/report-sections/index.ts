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
   their families come too — worked out by the server, sent with the report.
   --------------------------------------------------------------------------- */

import type { Translations } from "@/lib/i18n";
import type { ReportFamily } from "@/lib/reports/templates";

const LOAD: Record<ReportFamily, () => Promise<{ default: Translations }>> = {
  work: () => import("./work"),
  team: () => import("./team"),
  office: () => import("./office"),
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

/** A report's section words, merged (one chunk per family). The families
 *  come WITH the report (the server works them out from the catalog —
 *  `sectionFamilies` in ../../reports/catalog.ts), so this page never loads
 *  the catalog to find them. */
export async function loadSectionWords(families: ReportFamily[]): Promise<Translations> {
  const parts = await Promise.all(families.map((f) => LOAD[f]()));
  return Object.assign({}, ...parts.map((p) => p.default)) as Translations;
}

/** The words a report shows: its families' words — and a builder type's
 *  own (4E, they come with the report) over those of the built-in it was
 *  copied from (its suggestions quote that one's reports). */
export async function loadReportWords(families: ReportFamily[], custom?: { words: Translations }): Promise<Translations> {
  const base = families.length ? await loadSectionWords(families) : {};
  return custom ? { ...base, ...custom.words } : base;
}
