/* ---------------------------------------------------------------------------
   The number reports on paper (Reports 6C) — what prints, and how it is
   dealt onto the house sheets (210 × 270 mm). Pure, so validate:reports can
   prove it.

   A number report is TABLES and BARS: a table is a card with a black head,
   a column-head row, one row per line (a cell may hold one line per
   currency) and, on its last sheet, a black total bar (one row per
   currency); a bar is one figure on its own (gross profit, closing cash).

   Every row is ONE LINE PER CURRENCY and never wraps — a long name is cut
   with an ellipsis on paper, it is the record behind it that counts — so a
   row's height is arithmetic, pinned in NumbersPrintDoc's markup, and a
   sheet is filled by its budget, never by hope (`.quot-a4-doc` clips in
   silence). The sheet's budgets are the written report's (print-layout.ts);
   validate:reports keeps the two equal. A table that runs past a sheet
   continues on the next under the same head marked "continued", with its
   column heads again; a head never sits alone at a sheet's foot; the total
   bar never leaves its table's last row behind.
   --------------------------------------------------------------------------- */

/* The house sheet — the same budgets as the written report's paper. */
export const SHEET_PX = 968;
export const FIRST_HEAD_PX = 100 + 70 + 80;
export const CONT_HEAD_PX = 64 + 12;
export const FOOT_PX = 24;
/* A table's chrome: the black head, the column heads, the border, the gap
   after it. Pinned in NumbersPrintDoc. */
export const TABLE_HEAD_PX = 22;
export const COL_HEAD_PX = 20;
export const TABLE_PX = TABLE_HEAD_PX + COL_HEAD_PX + 2 + 10;
/* A row: 4 px of air + 16 px per line (one line per currency). */
export const ROW_PAD_PX = 4;
export const ROW_LINE_PX = 16;
/* A bar: 8 px of air + 16 px per line, and the gap after it. */
export const BAR_PAD_PX = 8;
export const BAR_GAP_PX = 10;

export type PrintAlign = "start" | "end";
export interface PrintColumn { label: string; align: PrintAlign; /** a CSS grid track, e.g. "minmax(0,2.2fr)" */ width: string }
/** `cells`: one array of lines per column. `tone` "sub" = a section's own
 *  total inside the table (bold on a grey band); "muted" = a section head. */
export interface PrintRow { cells: string[][]; tone?: "plain" | "sub" | "muted" }
export interface PrintTable { kind: "table"; head: string; cols: PrintColumn[]; rows: PrintRow[]; foot?: PrintRow[]; empty?: string }
/** `strong`: the black bar (net profit, closing cash); else a grey band. */
export interface PrintBar { kind: "bar"; label: string; lines: string[]; strong?: boolean }
export type PrintBlock = PrintTable | PrintBar;

export type SheetPart =
  | { kind: "table"; block: number; cont: boolean; rows: PrintRow[]; foot: PrintRow[] }
  | { kind: "bar"; block: number };
/** `used`: the planned height in px — never above SHEET_PX. */
export interface NumbersSheet { first: boolean; parts: SheetPart[]; used: number }

export const linesOfRow = (r: PrintRow) => Math.max(1, ...r.cells.map((c) => c.length));
export const rowPx = (r: PrintRow) => ROW_PAD_PX + ROW_LINE_PX * linesOfRow(r);
export const barPx = (b: PrintBar) => BAR_PAD_PX + ROW_LINE_PX * Math.max(1, b.lines.length) + BAR_GAP_PX;
const sum = (rows: PrintRow[]) => rows.reduce((s, r) => s + rowPx(r), 0);

/** The row an empty table prints ("Nothing recorded"). */
export function emptyRow(t: PrintTable): PrintRow {
  return { cells: t.cols.map((_, i) => (i === 0 ? [t.empty ?? "—"] : [])), tone: "muted" };
}

export function paginateNumbers(blocks: PrintBlock[]): NumbersSheet[] {
  const sheets: NumbersSheet[] = [];
  let cur: NumbersSheet = { first: true, parts: [], used: FIRST_HEAD_PX };
  const budget = () => SHEET_PX - FOOT_PX - cur.used;
  const next = () => { sheets.push(cur); cur = { first: false, parts: [], used: CONT_HEAD_PX }; };

  blocks.forEach((b, block) => {
    if (b.kind === "bar") {
      const px = barPx(b);
      if (px > budget() && cur.parts.length) next();
      cur.parts.push({ kind: "bar", block });
      cur.used += px;
      return;
    }
    const rows = b.rows.length ? b.rows : [emptyRow(b)];
    const foot = b.foot ?? [];
    const footPx = sum(foot);
    let i = 0;
    let cont = false;
    while (i < rows.length) {
      /* A head never sits alone: its first row comes with it. */
      if (TABLE_PX + rowPx(rows[i]) > budget() && cur.parts.length) next();
      let used = TABLE_PX;
      let k = i;
      while (k < rows.length && used + rowPx(rows[k]) <= budget()) { used += rowPx(rows[k]); k++; }
      /* A fresh sheet always takes at least one row — never loops. */
      if (k === i) { used += rowPx(rows[i]); k = i + 1; }
      const last = k === rows.length;
      if (last && used + footPx > budget()) {
        /* The total bar does not fit under the last rows: carry the last
           row over with it (when there is more than one here), so the bar
           never prints on a sheet of its own. */
        if (k - i > 1) { k -= 1; used -= rowPx(rows[k]); }
        cur.parts.push({ kind: "table", block, cont, rows: rows.slice(i, k), foot: [] });
        cur.used += used;
        i = k;
        cont = true;
        next();
        if (i === rows.length) {
          /* Only the bar is left (a single-row slice could not hold it). */
          cur.parts.push({ kind: "table", block, cont: true, rows: [], foot });
          cur.used += TABLE_PX + footPx;
        }
        continue;
      }
      cur.parts.push({ kind: "table", block, cont, rows: rows.slice(i, k), foot: last ? foot : [] });
      cur.used += used + (last ? footPx : 0);
      i = k;
      cont = true;
      if (!last) next();
    }
  });
  sheets.push(cur);
  return sheets;
}
