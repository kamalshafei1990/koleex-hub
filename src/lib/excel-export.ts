/* ---------------------------------------------------------------------------
   excel-export — tiny, generic XLSX writer used by Quotations & Invoices to
   export a document as a real Excel file. SheetJS ("xlsx") is already a
   dependency (used for import); we lazy-load it so it never weighs down the
   first paint.

   Callers build a plain array-of-arrays (AOA) per sheet — numbers stay numeric
   so Excel can sum/format them — and we turn it into a downloadable .xlsx.
   --------------------------------------------------------------------------- */

export type XlsxCell = string | number | null | undefined;

export interface XlsxSheet {
  /** Tab name (Excel caps at 31 chars; we trim + sanitise). */
  name: string;
  /** Rows × cells. Numbers stay numeric in the cell. */
  rows: XlsxCell[][];
  /** Optional per-column widths (character units). */
  colWidths?: number[];
}

/** Excel forbids these in a sheet name: \ / ? * [ ] : */
function safeSheetName(name: string): string {
  return (name || "Sheet").replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet";
}

/**
 * Build a workbook from one or more sheets and trigger a browser download.
 * Lazy-imports SheetJS, so it must be called from a client handler.
 */
export async function downloadXlsx(filename: string, sheets: XlsxSheet[]): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows.map((r) => r.map((c) => (c == null ? "" : c))));
    if (s.colWidths) ws["!cols"] = s.colWidths.map((w) => ({ wch: w }));
    // De-dupe tab names (Excel rejects duplicates).
    let name = safeSheetName(s.name);
    let n = 2;
    while (used.has(name.toLowerCase())) name = safeSheetName(`${s.name} ${n++}`);
    used.add(name.toLowerCase());
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const safeName = filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, safeName);
}

/** Round to 2dp and keep it a number (so Excel treats it as money, not text). */
export function money(n: unknown): number {
  return +(Number(n) || 0).toFixed(2);
}
