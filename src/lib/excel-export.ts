/* ---------------------------------------------------------------------------
   excel-export — branded, styled XLSX export for Quotations & Invoices.

   Uses `xlsx-js-style` (a drop-in SheetJS fork that actually writes cell
   styling: fonts, fills, borders, number formats, alignment, merges). Loaded
   lazily so it never weighs down first paint.

   The document model is intentionally small: a title, a meta block, a typed
   column set, item rows, and a totals block. The renderer turns that into a
   clean Koleex-monochrome sheet — black header band, hairline borders, money
   columns right-aligned with thousands separators, and a bold black grand-total
   row. All free-text is HTML-stripped first (rich-editor descriptions carry
   tags like <b>/<font> that must never reach the spreadsheet).
   --------------------------------------------------------------------------- */

export interface DocColumn {
  header: string;
  /** Column width in character units. */
  width: number;
  /** Render as money: number type, right-aligned, #,##0.00. */
  money?: boolean;
  align?: "left" | "right" | "center";
}

export interface DocTotal {
  label: string;
  value: number;
  /** Emphasised row (e.g. Grand Total) — black band, bold white text. */
  strong?: boolean;
}

export interface DocExport {
  /** Top brand line. Defaults to "KOLEEX". */
  brand?: string;
  /** Document kind, e.g. "QUOTATION" or "INVOICE". */
  title: string;
  /** Document number shown next to the title. */
  number: string;
  /** Label / value pairs (Date, Customer, Currency, …). */
  meta: [string, string][];
  columns: DocColumn[];
  /** Item rows, each aligned to `columns`. */
  rows: (string | number | null)[][];
  totals: DocTotal[];
}

/** Round to 2dp, keep numeric (so Excel treats it as money, not text). */
export function money(n: unknown): number {
  return +(Number(n) || 0).toFixed(2);
}

/** Strip HTML tags + decode the few entities the rich editor emits. */
function stripHtml(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/* ── Koleex monochrome style presets ─────────────────────────────────────── */
const HAIRLINE = { style: "thin", color: { rgb: "D0D0D0" } };
const BORDER_ALL = { top: HAIRLINE, bottom: HAIRLINE, left: HAIRLINE, right: HAIRLINE };

const S_BRAND = { font: { bold: true, sz: 20, color: { rgb: "000000" } } };
const S_TITLE = { font: { bold: true, sz: 12, color: { rgb: "555555" } } };
const S_META_LABEL = { font: { bold: true, sz: 10, color: { rgb: "777777" } } };
const S_META_VALUE = { font: { sz: 11, color: { rgb: "111111" } } };
const S_HEADER = {
  font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: "000000" } },
  alignment: { horizontal: "center", vertical: "center" },
  border: BORDER_ALL,
};
const S_CELL_TEXT = { font: { sz: 10.5, color: { rgb: "111111" } }, alignment: { horizontal: "left", vertical: "center", wrapText: true }, border: BORDER_ALL };
const S_CELL_NUM = { font: { sz: 10.5, color: { rgb: "111111" } }, alignment: { horizontal: "right", vertical: "center" }, border: BORDER_ALL, numFmt: "#,##0.00" };
const S_CELL_CENTER = { font: { sz: 10.5, color: { rgb: "111111" } }, alignment: { horizontal: "center", vertical: "center" }, border: BORDER_ALL };
const S_TOTAL_LABEL = { font: { bold: true, sz: 10.5, color: { rgb: "333333" } }, alignment: { horizontal: "right", vertical: "center" } };
const S_TOTAL_VALUE = { font: { bold: true, sz: 10.5, color: { rgb: "111111" } }, alignment: { horizontal: "right", vertical: "center" }, numFmt: "#,##0.00" };
const S_GRAND_LABEL = { font: { bold: true, sz: 11.5, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "000000" } }, alignment: { horizontal: "right", vertical: "center" } };
const S_GRAND_VALUE = { font: { bold: true, sz: 11.5, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "000000" } }, alignment: { horizontal: "right", vertical: "center" }, numFmt: "#,##0.00" };

type Cell = { v: string | number; t: "s" | "n"; s: object } | null;

/**
 * Build a styled, branded single-sheet workbook for a quotation/invoice and
 * trigger a browser download. Must be called from a client handler.
 */
export async function downloadDocXlsx(filename: string, doc: DocExport): Promise<void> {
  const XLSX = await import("xlsx-js-style");
  const nCols = Math.max(doc.columns.length, 2);
  const lastCol = nCols - 1;
  const grid: Cell[][] = [];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];

  const blank = (): Cell[] => Array(nCols).fill(null);

  // Brand + title (each merged across the full width).
  grid.push([{ v: doc.brand || "KOLEEX", t: "s", s: S_BRAND }, ...Array(nCols - 1).fill(null)]);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } });
  grid.push([{ v: `${doc.title} · ${doc.number}`, t: "s", s: S_TITLE }, ...Array(nCols - 1).fill(null)]);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } });
  grid.push(blank());

  // Meta block — label in col 0, value merged across col 1..last.
  for (const [label, value] of doc.meta) {
    const row: Cell[] = blank();
    row[0] = { v: label, t: "s", s: S_META_LABEL };
    row[1] = { v: stripHtml(value), t: "s", s: S_META_VALUE };
    const r = grid.length;
    if (lastCol > 1) merges.push({ s: { r, c: 1 }, e: { r, c: lastCol } });
    grid.push(row);
  }
  grid.push(blank());

  // Header row.
  grid.push(doc.columns.map((c) => ({ v: c.header, t: "s", s: S_HEADER } as Cell)));

  // Item rows.
  for (const r of doc.rows) {
    const row: Cell[] = doc.columns.map((col, i) => {
      const raw = r[i];
      if (col.money) return { v: money(raw), t: "n", s: S_CELL_NUM };
      if (typeof raw === "number") {
        return { v: raw, t: "n", s: col.align === "center" ? S_CELL_CENTER : { ...S_CELL_NUM, numFmt: "0" } };
      }
      const txt = stripHtml(raw);
      return { v: txt, t: "s", s: col.align === "center" ? S_CELL_CENTER : S_CELL_TEXT };
    });
    grid.push(row);
  }
  grid.push(blank());

  // Totals — label in the second-to-last column, value in the last.
  const labelCol = Math.max(0, lastCol - 1);
  for (const tot of doc.totals) {
    const row: Cell[] = blank();
    row[labelCol] = { v: tot.label, t: "s", s: tot.strong ? S_GRAND_LABEL : S_TOTAL_LABEL };
    row[lastCol] = { v: money(tot.value), t: "n", s: tot.strong ? S_GRAND_VALUE : S_TOTAL_VALUE };
    if (labelCol > 0) {
      const r = grid.length;
      merges.push({ s: { r, c: 0 }, e: { r, c: labelCol - 1 } });
    }
    grid.push(row);
  }

  // Assemble worksheet.
  const ws: Record<string, unknown> = {};
  grid.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (!cell) return;
      ws[XLSX.utils.encode_cell({ r, c })] = cell;
    });
  });
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: grid.length - 1, c: lastCol } });
  ws["!cols"] = doc.columns.map((c) => ({ wch: c.width }));
  ws["!merges"] = merges;
  // Freeze the brand/title/meta + header so item rows scroll under them.
  ws["!freeze"] = { xSplit: 0, ySplit: doc.meta.length + 5 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, doc.title.slice(0, 31) || "Sheet");
  const safeName = filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, safeName);
}
