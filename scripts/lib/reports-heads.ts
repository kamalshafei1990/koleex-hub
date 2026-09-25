/* The HEADS of the built-in report types, rendered from the catalog (Phase
 * 5C heads split, 26 Sep 2026).
 *
 * `npm run -s reports:heads` writes them to src/lib/reports/catalog-heads.ts;
 * validate:reports §25 renders them again and fails when that file differs —
 * a type added or removed, a flag changed, a hand edit. Pure: the writer and
 * the guard share it.
 */
import { REPORT_HEAD_FIELDS, type ReportFamily, type ReportTemplateDef, type ReportTemplateHead } from "../../src/lib/reports/templates";

export const HEADS_FILE = "src/lib/reports/catalog-heads.ts";

/** A type's head: its REPORT_HEAD_FIELDS — an optional flag only when set. */
export function headOf(t: ReportTemplateDef): ReportTemplateHead {
  const out: Record<string, unknown> = {};
  for (const f of REPORT_HEAD_FIELDS) {
    const v = (t as unknown as Record<string, unknown>)[f];
    if (v === undefined || v === false) continue;
    out[f] = v;
  }
  return out as unknown as ReportTemplateHead;
}

const lit = (v: unknown) => JSON.stringify(v);

/** The whole file, one type per line in the catalog's order. */
export function renderReportHeads(templates: readonly ReportTemplateDef[], groups: Partial<Record<ReportFamily, string[]>>): string {
  const rows = templates.map((t) => `  { ${Object.entries(headOf(t)).map(([k, v]) => `${k}: ${lit(v)}`).join(", ")} },`);
  const grp = Object.entries(groups).map(([f, gs]) => `  ${f}: [${(gs ?? []).map(lit).join(", ")}],`);
  return `/* AUTO-GENERATED from ./catalog.ts by scripts/reports-heads.ts — do not
   hand-edit. After changing the catalog, run \`npm run -s reports:heads\`:
   validate:reports fails while this file differs from it.

   The HEADS of the built-in report types — what the Reports home needs to
   list a type, group it, draw it and decide who is offered it; never its
   sections, readers or defaults. The home and its lists import this; the
   full catalog stays with the server and the template builder's own chunk
   (validate:reports §23/§25), so the page no longer carries every type's
   sections. */

import type { ReportFamily, ReportTemplateHead } from "./templates";

export const REPORT_HEADS: readonly ReportTemplateHead[] = [
${rows.join("\n")}
];

/** The groups a family's types show under on the Reports home, in order —
 *  each \`grp.<family>.<group>\`. A builder type has none: it shows after them. */
export const FAMILY_GROUPS: Partial<Record<ReportFamily, string[]>> = {
${grp.join("\n")}
};

const BY_KEY = new Map(REPORT_HEADS.map((h) => [h.key, h]));
/** A built-in's head by its key — null for a builder type or a key that is gone. */
export const reportHead = (key: string): ReportTemplateHead | null => BY_KEY.get(key) ?? null;
`;
}
