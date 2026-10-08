/* ---------------------------------------------------------------------------
   The blank paper form of a report the customer receives (owner, 28/09/2026:
   the technician's service report — "in the Hub plus a paper form"). A
   technician without the Hub fills it by hand on site; the office types it
   in later and the Hub gives it its number.

   ONE sheet, laid out in rows of one or two sections. The heights are fixed
   here and the form draws exactly these numbers, so validate:reports can
   prove every form fits its sheet — `.quot-a4-doc` clips overflow silently.
   --------------------------------------------------------------------------- */

import { FIRST_HEAD_PX, FOOT_PX, SHEET_PX } from "./print-layout";
import type { ReportSectionDef as SectionDef, ReportTemplateDef } from "./templates";

export const BLANK_LINE_PX = 22;          // one handwriting line (~5.8 mm)
export const BLANK_TABLE_HEAD_PX = 16;    // the column names over a table
export const BLANK_SIGN_BOX_PX = 56;      // the box a signature goes in
export const BLANK_CARD_PX = 22 + 12 + 2 + 8; // black head, body padding, border, gap after
/** What the body of the first sheet can hold under the head and over the foot. */
export const BLANK_BODY_PX = SHEET_PX - FIRST_HEAD_PX - FOOT_PX;

/** How many lines or rows each section gets on paper. */
const TEXT_LINES = 3;
const LIST_LINES = 4;
const TABLE_ROWS = 2;

/** Rows of the form, by section id — two ids share a row side by side. A
 *  template without its own rows gets one section a row. The links block
 *  never prints: the customer is written in the head. */
export const BLANK_ROWS: Record<string, string[][]> = {
  service_visit: [["machines", "time"], ["problem"], ["work"], ["parts", "result"], ["next_service", "next"], ["tech_sign", "customer_sign"]],
  installation: [["machines"], ["work"], ["checks"], ["issues"], ["tech_sign", "customer_sign"]],
};
/** Sections that need more (or fewer) lines or rows than the default. */
const TABLE_ROWS_BY_ID: Record<string, number> = { "service_visit.parts": 3, "installation.machines": 3, "service_visit.next_service": 1 };
const LINES_BY_ID: Record<string, number> = { "service_visit.next": 2 };

export function blankRows(tpl: ReportTemplateDef): SectionDef[][] {
  const printable = tpl.sections.filter((s) => s.kind !== "links");
  const byId = new Map(printable.map((s) => [s.id, s]));
  const rows = BLANK_ROWS[tpl.key];
  if (!rows) return printable.map((s) => [s]);
  return rows.map((r) => r.map((id) => byId.get(id)).filter((s): s is SectionDef => !!s));
}

export const blankTableRows = (tplKey: string, s: SectionDef) => TABLE_ROWS_BY_ID[`${tplKey}.${s.id}`] ?? TABLE_ROWS;
/** A checklist prints its points in two columns. */
export const blankChecklistRows = (s: SectionDef) => Math.ceil((s.points?.length ?? 0) / 2);

/** The body height of one section on paper (inside its card). */
export function blankBodyPx(tplKey: string, s: SectionDef): number {
  switch (s.kind) {
    case "text": return (LINES_BY_ID[`${tplKey}.${s.id}`] ?? TEXT_LINES) * BLANK_LINE_PX;
    case "list": return (LINES_BY_ID[`${tplKey}.${s.id}`] ?? LIST_LINES) * BLANK_LINE_PX;
    case "table": return BLANK_TABLE_HEAD_PX + blankTableRows(tplKey, s) * BLANK_LINE_PX;
    case "choice": return (s.options?.length ?? 1) * BLANK_LINE_PX;
    case "checklist": return blankChecklistRows(s) * BLANK_LINE_PX;
    case "score": return (s.points?.length ?? 1) * BLANK_LINE_PX;
    case "signature": return BLANK_SIGN_BOX_PX + BLANK_LINE_PX;
    default: return 2 * BLANK_LINE_PX;
  }
}

/** A row is as tall as its tallest section. */
export const blankRowPx = (tplKey: string, row: SectionDef[]) => BLANK_CARD_PX + Math.max(0, ...row.map((s) => blankBodyPx(tplKey, s)));

export const blankFormPx = (tpl: ReportTemplateDef) => blankRows(tpl).reduce((sum, row) => sum + blankRowPx(tpl.key, row), 0);
