/* ---------------------------------------------------------------------------
   The printed report's pagination — pure, so validate:reports can prove it.

   `.quot-a4-doc` (the house 210 × 270 mm sheet) clips overflow in silence,
   so a sheet is never filled by hoping: every block has a COST in px at
   96 dpi and a sheet takes blocks until its budget is spent. The fixed rows
   (heads, label cells, strips) have their heights pinned in the markup so
   their costs are constants here.

   TEXT IS MEASURED, NOT GUESSED. The print page measures every paragraph in
   the browser, at the sheet's real width and font, before dealing it (the
   DOM measurer in ReportPrintDoc) — an estimate has to stay far under the
   real line capacity to be safe, and the first version left each sheet a
   third empty ("lots of empty pages" is the complaint the house style was
   built to end). The estimate below is only the fallback and the guard's
   stand-in: width units (a CJK glyph is two) against a capacity ~15 % under
   what a line holds, so it can only ever plan MORE lines than print.

   A long text section is cut at a word boundary (anywhere inside a CJK run)
   and continues on the next sheet under the same head marked "continued".
   A list item moves whole — it is at most a few lines — unless it already
   starts a fresh sheet, where moving it again would loop. A head never
   sits alone at a sheet's foot: it takes its first two lines with it.
   --------------------------------------------------------------------------- */

import { reportTemplate, type ReportSectionValue } from "@/lib/reports/templates";

/* 270 mm = 1020 px, minus the sheet's own 24 + 18 px padding, minus air. */
export const SHEET_PX = 968;
export const FIRST_HEAD_PX = 100 + 70 + 80;   // wordmark row, brand strips (they inherit the sheet's 1.4 line-height: ~66), meta grid
export const TITLE_PX = 52;                   // a custom title, two lines at most
export const CONT_HEAD_PX = 64 + 12;          // the compact strip and the air under it
export const FOOT_PX = 24;                    // "Page N of M"
export const CARD_PX = 22 + 16 + 2 + 10;      // black head, body padding, border, gap after
export const LINE_PX = 16;
export const PARA_GAP_PX = 4;
export const CAP_UNITS = 112;                 // Latin characters per line as ESTIMATED (a line holds ~134)
/** The width a paragraph prints at: the sheet (210 mm) minus its 28 px side
 *  padding, the card border and the card body's 12 px padding. */
export const PARA_WIDTH_CSS = "calc(210mm - 82px)";

function unitOf(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0;
  if (isCjk(cp)) return 2;
  if (cp >= 0x0600 && cp <= 0x06ff) return 1.15;
  return 1;
}
const isCjk = (cp: number) => (cp >= 0x2e80 && cp <= 0x9fff) || (cp >= 0xac00 && cp <= 0xd7af) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xff00 && cp <= 0xffef);

export function widthUnits(s: string): number {
  let u = 0;
  for (const ch of s) u += unitOf(ch);
  return u;
}

export const linesOf = (s: string) => Math.max(1, Math.ceil(widthUnits(s) / CAP_UNITS));

/** Where to cut `s` so its first part fits `maxLines` (estimated): the last
 *  space before the limit, or exactly at the limit without a usable space. */
export function cutAt(s: string, maxLines: number): number {
  const budget = maxLines * CAP_UNITS;
  let u = 0, i = 0, lastSpace = -1;
  for (const ch of s) {
    const w = unitOf(ch);
    if (u + w > budget) break;
    u += w; i += ch.length;
    if (ch === " ") lastSpace = i;
  }
  return lastSpace > i * 0.6 ? lastSpace : Math.max(1, i);
}

/** The places a paragraph may break: after a space, and after any CJK
 *  character (CJK wraps anywhere). Ascending; always ends at the length. */
export function breakPoints(s: string): number[] {
  const out: number[] = [];
  let i = 0;
  for (const ch of s) {
    i += ch.length;
    if (ch === " " || isCjk(ch.codePointAt(0) ?? 0)) out.push(i);
  }
  if (out[out.length - 1] !== s.length) out.push(s.length);
  return out;
}

export type PrintPara = { text: string; bullet: boolean };
export type PrintCard = { sid: string; cont: boolean; paras: PrintPara[]; empty: boolean };
/** `used` is the sheet's planned height in px — never above SHEET_PX. */
export type PrintSheet = { first: boolean; cards: PrintCard[]; review: boolean; used: number };

/** How tall a paragraph prints, and where it can be cut to fit a height. */
export interface Measurer {
  height(p: PrintPara): number;
  /** The longest head of `p` whose height is ≤ maxPx, as an index into
   *  p.text at a break point; 0 when not even the first piece fits. */
  cut(p: PrintPara, maxPx: number): number;
}

/** Cut by binary search over the break points — height only grows as the
 *  head gets longer, so the search is exact for any measurer. A "word" too
 *  long for the room (a pasted link, a code) is cut by character instead,
 *  the way the sheet itself wraps it (overflow-wrap: anywhere). */
export function cutByHeight(p: PrintPara, maxPx: number, height: (p: PrintPara) => number): number {
  const search = (pts: number[]) => {
    let lo = 0, hi = pts.length - 1, best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const head = p.text.slice(0, pts[mid]).trimEnd();
      if (head && height({ text: head, bullet: p.bullet }) <= maxPx) { best = pts[mid]; lo = mid + 1; }
      else hi = mid - 1;
    }
    return best;
  };
  const atWord = search(breakPoints(p.text));
  if (atWord > 0) return atWord;
  const every: number[] = [];
  let i = 0;
  for (const ch of p.text) { i += ch.length; every.push(i); }
  return search(every);
}

export const estimateMeasurer: Measurer = {
  height: (p) => linesOf(p.text) * LINE_PX,
  cut: (p, maxPx) => { const lines = Math.floor(maxPx / LINE_PX); return lines < 1 ? 0 : cutAt(p.text, lines); },
};

export interface PrintInput { templateKey: string; title: string; sections: ReportSectionValue[] }

/** The paragraphs of each of the template's sections, as they print. */
export function printParagraphs(report: PrintInput): Array<{ sid: string; paras: PrintPara[] }> {
  const tpl = reportTemplate(report.templateKey);
  return (tpl?.sections ?? []).map((s) => {
    const v = report.sections.find((x) => x.id === s.id);
    const paras: PrintPara[] = s.kind === "list"
      ? (v?.items ?? []).map((text) => ({ text, bullet: true }))
      : (v?.text ?? "").split("\n").map((l) => l.trimEnd())
        .filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== ""))   // one blank line at most, none leading
        .map((text) => ({ text, bullet: false }));
    while (paras.length && !paras[paras.length - 1].text) paras.pop();
    return { sid: s.id, paras };
  });
}

export function paginateReport(report: PrintInput, reviewPx: number, m: Measurer = estimateMeasurer): PrintSheet[] {
  const tpl = reportTemplate(report.templateKey);
  const sheets: PrintSheet[] = [];
  const firstUsed = FIRST_HEAD_PX + FOOT_PX + (report.title.trim() && tpl?.customTitle ? TITLE_PX : 0);
  let sheet: PrintSheet = { first: true, cards: [], review: false, used: firstUsed };
  const left = () => SHEET_PX - sheet.used;
  const newSheet = () => { sheets.push(sheet); sheet = { first: false, cards: [], review: false, used: CONT_HEAD_PX + FOOT_PX }; };

  for (const { sid, paras } of printParagraphs(report)) {
    if (paras.length === 0) {
      if (left() < CARD_PX + LINE_PX) newSheet();
      sheet.cards.push({ sid, cont: false, paras: [], empty: true });
      sheet.used += CARD_PX + LINE_PX;
      continue;
    }
    /* The head's first need: a whole list item (items never split), or the
       first two lines of a text. */
    const first = paras[0];
    if (left() < CARD_PX + (first.bullet ? m.height(first) : Math.min(2 * LINE_PX, m.height(first)))) newSheet();
    let card: PrintCard = { sid, cont: false, paras: [], empty: false };
    sheet.cards.push(card);
    sheet.used += CARD_PX;

    const queue = [...paras];
    let turns = 0;
    while (queue.length) {
      /* Belt and braces: a measurer that never lets text fit must not hang
         the print page — what is left lands on this card (and clips). */
      if (++turns > 5000) { card.paras.push(...queue); queue.length = 0; break; }
      const p = queue.shift()!;
      const gap = card.paras.length ? PARA_GAP_PX : 0;
      const need = gap + m.height(p);
      if (need <= left()) { card.paras.push(p); sheet.used += need; continue; }
      const room = left() - gap;
      const fresh = card.paras.length === 0 && sheet.cards.length === 1 && !sheet.first;
      const at = (!p.bullet || fresh) && room >= 2 * LINE_PX ? m.cut(p, room) : 0;
      if (at > 0 && at < p.text.length) {
        const head = { text: p.text.slice(0, at).trimEnd(), bullet: p.bullet };
        card.paras.push(head);
        sheet.used += gap + m.height(head);
        queue.unshift({ text: p.text.slice(at).trimStart(), bullet: p.bullet });
      } else {
        queue.unshift(p);
      }
      /* Nothing landed under this head here: the head moves with the text
         instead of standing alone at the foot of the sheet. */
      const wasCont = card.cont;
      const empty = card.paras.length === 0;
      if (empty) { sheet.cards.pop(); sheet.used -= CARD_PX; }
      newSheet();
      card = { sid, cont: empty ? wasCont : true, paras: [], empty: false };
      sheet.cards.push(card);
      sheet.used += CARD_PX;
    }
  }

  if (reviewPx > 0) {
    if (left() < CARD_PX + reviewPx) newSheet();
    sheet.review = true;
    sheet.used += CARD_PX + reviewPx;
  }
  sheets.push(sheet);
  return sheets;
}
