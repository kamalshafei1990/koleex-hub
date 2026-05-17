/* ===========================================================================
   Phase R — Enterprise table renderer.

   Bank-statement / GL-style table:
     · column header row (uppercase 8pt label, hard bottom rule)
     · body rows — hairline divider, optional very-subtle zebra
     · numeric cells right-aligned, mono, tabular-nums, accounting
       formatting (parens for negatives, em-dash for zero)
     · subtotal rows — top hairline, ink-soft label
     · totals row — top hard rule, bold, double rule above grand total
     · page-break-safe: thead repeats on every printed page via
       `display: table-header-group`; rows never split mid-row via
       `page-break-inside: avoid`
     · empty state — single hairline frame with a centred caption

   The renderer takes the existing `ReportTableSection` shape (no
   builder changes required), plus optional subtotal/total markers
   carried in individual row records via two reserved keys:
     · __subtotal: true   → row gets the subtotal style
     · __total:    true   → row gets the totals style (above any
                            normal body row, never on its own line)
   Builders that don't use those keys produce a clean ledger table —
   no behaviour change.
   ========================================================================== */

import { BORDER, COLOR, SPACE, TYPE, typeCss } from "./design-system";
import { escapeHtml, formatValue } from "./formatters";
import type {
  ReportColumn,
  ReportRowValue,
  ReportTableSection,
  ValueFormat,
} from "./types";

/* Inline number rendering for table cells. We always tabular-nums,
   always mono. The cell uses `text-align:right` when the column says
   right OR when the format is one of the numeric formats. */
function isNumericFormat(fmt: ValueFormat | undefined): boolean {
  return fmt === "money" || fmt === "count" || fmt === "percent";
}

function cellHtml(col: ReportColumn, raw: ReportRowValue, isSubtotal: boolean, isTotal: boolean): string {
  const numeric = isNumericFormat(col.format);
  const align = col.align ?? (numeric ? "right" : "left");
  const text = formatValue(raw, col.format, { /* defaults */ });
  const isEmDash = text === "—";
  const fontStyle = numeric || col.format === "date"
    ? "font-family:var(--rpt-mono);font-variant-numeric:tabular-nums"
    : "";
  /* Negative amounts (rendered as "(1,234.56)" by formatMoney) get a
     subtle underline emphasis — accountants expect to spot losses
     instantly without the document going technicolour. */
  const isNegativeMoney = col.format === "money" && typeof text === "string" && text.startsWith("(");
  const negativeStyle = isNegativeMoney
    ? `text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px`
    : "";
  const colorOverride = isEmDash ? COLOR.mutedSoft : COLOR.ink;
  const weight =
    isTotal ? "font-weight:700"
    : isSubtotal ? "font-weight:600"
    : "";
  /* Long text in non-numeric columns: wrap at word boundaries; never
     overflow the column. Numeric/date columns stay nowrap so a wide
     number doesn't break onto a second line — they get sized via
     the column's `width` hint. */
  const wrap = numeric || col.format === "date"
    ? "white-space:nowrap"
    : "white-space:normal;word-wrap:break-word;overflow-wrap:anywhere";
  return `<td style="
    padding:${SPACE.sm}px ${SPACE.md}px;
    text-align:${align};
    vertical-align:top;
    color:${colorOverride};
    ${fontStyle};
    ${weight};
    ${negativeStyle};
    ${wrap};
    font-size:${TYPE.tableNumber.size}pt;
    line-height:${TYPE.tableNumber.lineHeight};
  ">${escapeHtml(text)}</td>`;
}

function colgroup(columns: ReportColumn[]): string {
  return `<colgroup>${columns
    .map((c) => `<col${c.width ? ` style="width:${c.width}"` : ""} />`)
    .join("")}</colgroup>`;
}

function thead(columns: ReportColumn[]): string {
  const cells = columns
    .map((c) => {
      const align = c.align ?? (isNumericFormat(c.format) ? "right" : "left");
      return `<th style="
        ${typeCss("tableHeader")};
        color:${COLOR.muted};
        text-align:${align};
        padding:${SPACE.sm}px ${SPACE.md}px ${SPACE.sm}px ${SPACE.md}px;
        border-bottom:${BORDER.hard};
        white-space:nowrap;
      ">${escapeHtml(c.label)}</th>`;
    })
    .join("");
  return `<thead style="display:table-header-group">
    <tr>${cells}</tr>
  </thead>`;
}

/* Sentinel keys carried on a row record to mark it as a subtotal or
   total row. The builder layer doesn't have to set them; if it does,
   the table renders the row with the corresponding style + rules. */
const SUBTOTAL_KEY = "__subtotal";
const TOTAL_KEY    = "__total";

function rowStyle(isSubtotal: boolean, isTotal: boolean): string {
  if (isTotal) {
    return `
      border-top:${BORDER.hard};
      background:${COLOR.paper};
    `;
  }
  if (isSubtotal) {
    return `
      border-top:${BORDER.hairline};
      background:${COLOR.paper};
    `;
  }
  return "";
}

function tbody(section: ReportTableSection): string {
  const rows = section.rows
    .map((r, i) => {
      const isSubtotal = Boolean((r as Record<string, unknown>)[SUBTOTAL_KEY]);
      const isTotal    = Boolean((r as Record<string, unknown>)[TOTAL_KEY]);
      /* Subtle zebra — disabled on subtotal/total rows because they
         get their own border treatment. */
      const zebra = !isSubtotal && !isTotal && i % 2 === 1
        ? `background:${COLOR.zebra}`
        : "";
      return `<tr style="
        page-break-inside:avoid;
        border-bottom:${BORDER.hairline};
        ${zebra};
        ${rowStyle(isSubtotal, isTotal)}
      ">${section.columns
        .map((c) => cellHtml(c, (r as Record<string, ReportRowValue>)[c.key], isSubtotal, isTotal))
        .join("")}</tr>`;
    })
    .join("");
  return `<tbody>${rows}</tbody>`;
}

function emptyState(section: ReportTableSection): string {
  const cs = section.columns.length;
  return `
    <table class="rpt-table" style="
      width:100%;
      border-collapse:collapse;
      table-layout:fixed;
      page-break-inside:avoid;
    ">
      ${colgroup(section.columns)}
      ${thead(section.columns)}
      <tbody>
        <tr>
          <td colspan="${cs}" style="
            padding:${SPACE.xxl}px ${SPACE.lg}px;
            text-align:center;
            color:${COLOR.muted};
            ${typeCss("caption")};
            border-bottom:${BORDER.hairline};
          ">${escapeHtml(section.empty_state ?? "No rows.")}</td>
        </tr>
      </tbody>
    </table>
  `;
}

/* Public — render one table section into HTML. */
export function renderTable(section: ReportTableSection): string {
  const title = section.title
    ? `<div style="
        ${typeCss("sectionTitle")};
        color:${COLOR.ink};
        margin-bottom:${SPACE.sm}px;
      ">${escapeHtml(section.title)}</div>`
    : "";

  if (section.rows.length === 0) {
    return `<section style="margin-bottom:${SPACE.xl}px">${title}${emptyState(section)}</section>`;
  }

  return `
<section class="rpt-table-wrap" style="margin-bottom:${SPACE.xl}px">
  ${title}
  <table class="rpt-table" style="
    width:100%;
    border-collapse:collapse;
    table-layout:fixed;
  ">
    ${colgroup(section.columns)}
    ${thead(section.columns)}
    ${tbody(section)}
  </table>
</section>
`;
}

/* Re-export the sentinel keys so builders can opt into subtotal /
   total row styling without importing arcane string literals. */
export const TABLE_ROW_KEYS = {
  SUBTOTAL: SUBTOTAL_KEY,
  TOTAL:    TOTAL_KEY,
} as const;
