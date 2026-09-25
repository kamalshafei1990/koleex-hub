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

   Photos (Phase 2C) print two to a row in FIXED boxes (the photo fitted
   inside, a two-line caption band under it), so every row costs the same
   and a row never splits; files follow as one line each. They come after
   the sections and before the review.

   Blocks (Phase 4A) print as measured lines like any text — a checklist
   point with its mark (✓ ✗ —) and note, each score and the overall, a
   table's column heads then one line per row and its figures (the totals,
   or a comparison's lowest — tableSummary, as on screen), each link —
   so they paginate by the same rule. A checklist photo joins the photo
   rows, its point as the caption. A signature is one FIXED box (the drawn
   PNG, the signer and the moment) that never splits.

   Phase 4B: a choice prints its answer; a numbers block prints its column
   heads, one line per document (with the author's note), the totals per
   currency and the moment the numbers were taken; a date cell is D/M/Y.
   --------------------------------------------------------------------------- */

import { scoreAverage, tableSummary, type ReportDataRow, type ReportDataSource, type ReportSectionValue, type ReportTemplateDef, type SignatureValue } from "@/lib/reports/templates";
import { DATA_COLUMNS, DATA_MODULE, dataTotals, statusWordKey, type DataColumn } from "@/lib/reports/report-data";

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
/** One printed photo: which attachment, and its caption. */
export type PrintPhoto = { id: string; caption: string };
/** `photos`: the photo rows (two a row) — only on the attachments card.
 *  `signature`: a signature block's one fixed box (Phase 4A). */
export type PrintCard = { sid: string; cont: boolean; paras: PrintPara[]; empty: boolean; photos?: PrintPhoto[][]; signature?: SignatureValue };
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

/** `tpl`: a builder type (4E) comes whole with its report; a built-in is found by its key. */
/** `tpl`: the report's own type, as the server sent it with the report (the print carries no catalog). */
export interface PrintInput { templateKey: string; title: string; sections: ReportSectionValue[]; tpl: ReportTemplateDef | null }
/** The words a block prints with (the print page's dictionary). */
export type PrintWord = (key: string) => string;
/** A signature box: the drawn signature, then the signer and the moment. */
export const SIGN_BOX_PX = 90;
export const SIGN_PX = SIGN_BOX_PX + 8 + 2 * LINE_PX;
const MARK: Record<string, string> = { ok: "✓", issue: "✗", na: "—" };
const fmt = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(n);
const pad2 = (n: number) => String(n).padStart(2, "0");
/** D/M/Y for a date cell; D/M/Y HH:MM (the reader's own clock) for a moment. */
const dmy = (ymd: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd); return m ? `${m[3]}/${m[2]}/${m[1]}` : ymd; };
const dmyHm = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
/** "Total Amount: 1,500 USD" — each language orders it its own way
 *  (إجمالي المبلغ · 金额合计), so the phrase is a pattern, not glued words. */
const figure = (word: PrintWord, kind: "total" | "lowest", col: string, value: string) =>
  word(kind === "lowest" ? "blk.printLowest" : "blk.printTotal").replace("{col}", col).replace("{value}", value);
function dataCellText(word: PrintWord, source: ReportDataSource, r: ReportDataRow, c: DataColumn): string {
  const v = r.cells[c.id];
  if (v === null || v === undefined || v === "") return "—";
  if (c.type === "date") return dmy(String(v));
  if (c.type === "money") return typeof v === "number" ? `${fmt(v)}${r.currency ? ` ${r.currency}` : ""}` : "—";
  if (c.type === "status") { const key = statusWordKey(source, String(v)); return key ? word(key) : String(v); }
  return String(v);
}

/* ── Photos and files ──────────────────────────────────────────────────── */
/** The attachments card's id (never a template section id). */
export const ATTACH_SID = "__attachments";
export const PHOTO_BOX_PX = 236;
export const PHOTO_CAPTION_PX = 30;           // 4 px of air + two lines at 13 px
export const PHOTO_ROW_GAP_PX = 8;
export const PHOTO_ROW_PX = PHOTO_BOX_PX + PHOTO_CAPTION_PX + PHOTO_ROW_GAP_PX;
export interface PrintAttachments { photos: PrintPhoto[]; files: PrintPara[] }

/** The paragraphs of each of the template's sections, as they print. */
export function printParagraphs(report: PrintInput, word: PrintWord = (k) => k): Array<{ sid: string; paras: PrintPara[]; signature?: SignatureValue }> {
  const tpl = report.tpl ?? null;
  return (tpl?.sections ?? []).map((s) => {
    const v = report.sections.find((x) => x.id === s.id);
    const name = (kind: "i" | "c", id: string) => word(`tpl.${report.templateKey}.s.${s.id}.${kind}.${id}`);
    switch (s.kind) {
      case "checklist":
        /* Only what was answered or noted: an untouched point prints nothing. */
        return { sid: s.id, paras: (s.points ?? []).flatMap((pt) => {
          const c = v?.checks?.[pt.id];
          if (!c?.state && !c?.note) return [];
          return [{ text: `${c.state ? MARK[c.state] : "·"} ${name("i", pt.id)}${c.note ? ` — ${c.note}` : ""}`, bullet: false }];
        }) };
      case "score": {
        const scored = (s.points ?? []).filter((pt) => v?.scores?.[pt.id]);
        if (!scored.length) return { sid: s.id, paras: [] };
        const avg = scoreAverage(s, v);
        return { sid: s.id, paras: [
          ...scored.map((pt) => ({ text: `${name("i", pt.id)}: ${v!.scores![pt.id]} / 5`, bullet: true })),
          { text: `${word("blk.overall")}: ${avg} / 5`, bullet: false },
        ] };
      }
      case "table": {
        const cols = s.columns ?? [];
        const rows = v?.rows ?? [];
        if (!rows.length) return { sid: s.id, paras: [] };
        const cur = v?.currency ?? "USD";
        const figures = tableSummary(s, rows);
        return { sid: s.id, paras: [
          { text: cols.map((c) => `${name("c", c.id)}${c.type === "money" ? ` (${cur})` : ""}`).join(" · "), bullet: false },
          ...rows.map((r) => ({ text: cols.map((c) => (r[c.id] ? (c.type === "text" ? r[c.id] : c.type === "date" ? dmy(r[c.id]) : fmt(Number(r[c.id]))) : "—")).join(" · "), bullet: true })),
          ...(figures.length ? [{
            text: figures.map((f) => `${figure(word, f.kind, name("c", f.col.id), `${fmt(f.value)}${f.col.type === "money" ? ` ${cur}` : ""}`)}${f.who ? ` (${f.who})` : ""}`).join(" · "),
            bullet: false,
          }] : []),
        ] };
      }
      case "links":
        return { sid: s.id, paras: (v?.links ?? []).map((l) => ({ text: `${word(`blk.link.${l.type}`)}: ${l.label}`, bullet: true })) };
      case "signature":
        return { sid: s.id, paras: [], ...(v?.signature ? { signature: v.signature } : {}) };
      case "choice":
        return { sid: s.id, paras: v?.choice ? [{ text: word(`tpl.${report.templateKey}.s.${s.id}.o.${v.choice}`), bullet: false }] : [] };
      case "data": {
        const d = v?.data;
        if (!d) return { sid: s.id, paras: [] };
        if (d.denied) return { sid: s.id, paras: [{ text: word("blk.dataNoAccess").replace("{app}", DATA_MODULE[d.source]), bullet: false }] };
        if (d.failed) return { sid: s.id, paras: [{ text: word("blk.dataFailed"), bullet: false }] };
        if (d.untracked) return { sid: s.id, paras: [{ text: word("blk.dataUntracked"), bullet: false }] };
        /* A live block (5B) is what waits for the one printing, as of now. */
        const asOf = { text: word(d.live ? "blk.dataLiveReader" : "blk.dataAsOf").replace("{at}", dmyHm(d.capturedAt)), bullet: false };
        if (!d.rows.length) return { sid: s.id, paras: [{ text: word(`blk.de.${d.source}`), bullet: false }, asOf] };
        const cols = DATA_COLUMNS[d.source];
        const totals = dataTotals(d);
        return { sid: s.id, paras: [
          { text: cols.map((c) => word(`blk.dc.${c.id}`)).join(" · "), bullet: false },
          ...d.rows.map((r) => ({ text: `${cols.map((c) => dataCellText(word, d.source, r, c)).join(" · ")}${v?.notes?.[r.key] ? ` — ${v.notes[r.key]}` : ""}`, bullet: true })),
          ...(totals.length ? [{ text: totals.map((x) => figure(word, "total", word(`blk.dc.${x.col}`), `${fmt(x.value)} ${x.currency}`)).join(" · "), bullet: false }] : []),
          asOf,
        ] };
      }
      default:
        break;
    }
    const paras: PrintPara[] = s.kind === "list"
      ? (v?.items ?? []).map((text) => ({ text, bullet: true }))
      : (v?.text ?? "").split("\n").map((l) => l.trimEnd())
        .filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== ""))   // one blank line at most, none leading
        .map((text) => ({ text, bullet: false }));
    while (paras.length && !paras[paras.length - 1].text) paras.pop();
    return { sid: s.id, paras };
  });
}

export function paginateReport(report: PrintInput, reviewPx: number, m: Measurer = estimateMeasurer, att?: PrintAttachments, word?: PrintWord): PrintSheet[] {
  const tpl = report.tpl ?? null;
  const sheets: PrintSheet[] = [];
  const firstUsed = FIRST_HEAD_PX + FOOT_PX + (report.title.trim() && tpl?.customTitle ? TITLE_PX : 0);
  let sheet: PrintSheet = { first: true, cards: [], review: false, used: firstUsed };
  const left = () => SHEET_PX - sheet.used;
  const newSheet = () => { sheets.push(sheet); sheet = { first: false, cards: [], review: false, used: CONT_HEAD_PX + FOOT_PX }; };

  for (const { sid, paras, signature } of printParagraphs(report, word)) {
    /* A signature: one fixed box that never splits. */
    if (signature) {
      if (left() < CARD_PX + SIGN_PX) newSheet();
      sheet.cards.push({ sid, cont: false, paras: [], empty: false, signature });
      sheet.used += CARD_PX + SIGN_PX;
      continue;
    }
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

  /* Photos and files: a card opens only where its first row (or line) fits
     too, so its head never stands alone; it continues on the next sheet
     marked "continued". */
  if (att && (att.photos.length || att.files.length)) {
    let card: PrintCard | null = null;
    let opened = 0;
    const open = (): PrintCard => {
      const c: PrintCard = { sid: ATTACH_SID, cont: opened++ > 0, paras: [], empty: false, photos: [] };
      sheet.cards.push(c);
      sheet.used += CARD_PX;
      return c;
    };
    for (let i = 0; i < att.photos.length; i += 2) {
      if (left() < PHOTO_ROW_PX + (card ? 0 : CARD_PX)) { newSheet(); card = null; }
      card = card ?? open();
      card.photos!.push(att.photos.slice(i, i + 2));
      sheet.used += PHOTO_ROW_PX;
    }
    for (const f of att.files) {
      const h = m.height(f);
      const gapIn = (c: PrintCard | null) => (c && (c.paras.length || c.photos!.length) ? PARA_GAP_PX : 0);
      if (left() < gapIn(card) + h + (card ? 0 : CARD_PX)) { newSheet(); card = null; }
      card = card ?? open();
      sheet.used += gapIn(card) + h;
      card.paras.push(f);
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
