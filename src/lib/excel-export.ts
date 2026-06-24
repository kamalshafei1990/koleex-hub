/* ---------------------------------------------------------------------------
   excel-export — exports a Quotation/Invoice as an Excel workbook laid out like
   the on-screen A4 document: real embedded KOLEEX logo + title, the company
   band, a boxed DATE · NO · CLIENT-NO strip, a two-column FROM / INVOICE-TO
   block, the items table, the totals block, and the terms. Built on ExcelJS
   (embeds images + full cell styling). Loaded lazily so it never weighs first
   paint. All free-text is HTML-stripped (rich-editor descriptions carry
   <b>/<font> tags that must never reach the sheet).
   --------------------------------------------------------------------------- */

export interface DocColumn {
  header: string;
  /** Column width in character units. */
  width: number;
  /** Render as money: number, right-aligned, #,##0.00. */
  money?: boolean;
  align?: "left" | "right" | "center";
}

export interface DocTotal {
  label: string;
  value: number;
  /** Emphasised row (Grand Total) — black band, bold white text. */
  strong?: boolean;
}

export interface DocExport {
  /** Big title shown right of the logo, e.g. "COMMERCIAL INVOICE" / "QUOTATION". */
  docTitle: string;
  /** Used for the download filename. */
  number: string;
  /** Boxed cells across the top, e.g. [["DATE", …], ["INVOICE NO", …], ["CLIENT NO", …]]. */
  metaStrip: [string, string][];
  /** INVOICE-TO block: pre-formatted lines (first line = name, rendered bold). */
  toLines: string[];
  columns: DocColumn[];
  /** Item rows, each aligned to `columns`. */
  rows: (string | number | null)[][];
  totals: DocTotal[];
  /** Optional free-text terms block (rendered at the bottom, HTML-stripped). */
  terms?: string;
}

/** Round to 2dp, keep numeric (so Excel treats it as money, not text). */
export function money(n: unknown): number {
  return +(Number(n) || 0).toFixed(2);
}

/** Strip HTML tags + decode the few entities the rich editor emits. */
function stripHtml(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li)>/gi, " ")
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

/* ── KOLEEX letterhead constants (mirror the printed A4 header) ──────────── */
const COMPANY = {
  legal: "KOLEEX INTERNATIONAL CORPORATION TAIZHOU CO., LTD.",
  cn: "科莱恪斯国际商业管理（台州）有限公司",
  tagline: "SHAPING THE FUTURE.",
  address:
    "Room 206, Building 88, West Feiyue Technological Innovative Park, Jingshui An Community, Xiachen Street, Jiaojiang District, Taizhou City, Zhejiang Province, China",
  phone: "+86 0576 8892 7796",
  mobile: "+86 130 7380 0720",
  email: "info@koleexgroup.com",
  web: "www.koleexgroup.com",
};
/** FROM block lines (the KOLEEX seller). First line bold. */
const FROM_LINES = [
  COMPANY.legal,
  COMPANY.address,
  `Phone:  ${COMPANY.phone}`,
  `Mobile:  ${COMPANY.mobile}`,
  `Email:  ${COMPANY.email}`,
  `Web:  ${COMPANY.web}`,
];

const BLACK = "FF000000";
const WHITE = "FFFFFFFF";
const HAIR = "FFD0D0D0";
const INK = "FF111111";
const GRAY = "FF777777";
const SOFT = "FFF2F2F2";

const thin = { style: "thin" as const, color: { argb: HAIR } };
const borderAll = { top: thin, left: thin, bottom: thin, right: thin };

function colLetter(i: number): string {
  // 1-based → A, B, … Z, AA…
  let s = "";
  let n = i;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/* The exact KOLEEX wordmark used on the printed A4 document (inline SVG paths,
   viewBox -4 -4 727.83 115.57). Rasterised to a crisp PNG at runtime so the
   sheet carries the real company logo. */
const KOLEEX_WORDMARK_PATHS = [
  "M116.59,96.3v11.05h-10.6L14.66,62.47v44.88H0V1.58h14.66v43.53L105.99,1.58h10.6v11.05L28.42,53.9l88.18,42.4Z",
  "M242.65,71.04c0,20.07-14.21,36.54-34.28,36.54h-50.74c-20.52,0-35.18-16.01-35.18-36.54v-35.18C122.45,15.11,136.88.45,157.63.45h49.84c20.52,0,35.18,14.88,35.18,35.41v35.18ZM227.77,38.11c0-12.4-8.34-23.23-20.3-23.23h-49.84c-11.95,0-20.3,10.83-20.3,23.23v31.8c0,11.95,8.34,23,20.3,23h49.84c11.95,0,20.3-11.05,20.3-23v-31.8Z",
  "M363.07,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54l.23-71.04h14.66v69.91c0,11.95,8.34,23,20.3,23h68.56v14.66h-.01Z",
  "M473.8,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68Z",
  "M585.42,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68Z",
  "M719.83,96.3v11.05h-10.6l-48.04-42.62-48.04,42.62h-10.37v-11.05l46.91-41.72-46.91-41.95V1.58h10.37l48.04,42.62L709.23,1.58h10.6v11.05l-47.13,41.95,47.13,41.72ZM661.19,71.04l40.59,36.31h-81.19l40.59-36.31Z",
];

async function loadLogoBase64(): Promise<string | null> {
  try {
    const w = 210;
    const h = 33;
    const paths = KOLEEX_WORDMARK_PATHS.map((d) => `<path fill="#000000" d="${d}"/>`).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="-4 -4 727.83 115.57" preserveAspectRatio="xMinYMid meet">${paths}</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const base64 = await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = 3;
          const canvas = document.createElement("canvas");
          canvas.width = w * scale;
          canvas.height = h * scale;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/png").split(",")[1] || null);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
    URL.revokeObjectURL(url);
    return base64;
  } catch {
    return null;
  }
}

/**
 * Build a letterhead Excel laid out like the A4 document and trigger a browser
 * download. Must be called from a client handler.
 */
export async function downloadDocXlsx(filename: string, doc: DocExport): Promise<void> {
  const ExcelJSmod = await import("exceljs");
  const ExcelJS = (ExcelJSmod as unknown as { default?: typeof ExcelJSmod }).default ?? ExcelJSmod;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(doc.docTitle.slice(0, 31) || "Document", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
    views: [{ showGridLines: false }],
  });

  const nCols = Math.max(doc.columns.length, 4);
  const LAST = colLetter(nCols);
  const mid = Math.ceil(nCols / 2);
  const MIDL = colLetter(mid);
  const MIDR = colLetter(mid + 1);
  ws.columns = doc.columns.map((c) => ({ width: c.width }));

  let r = 0;
  const fillCell = (addr: string, argb: string) => {
    ws.getCell(addr).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
  };

  /* ── Letterhead: logo (left half) + big title (right half) ── */
  r = 1;
  ws.getRow(1).height = 20;
  ws.getRow(2).height = 16;
  ws.getRow(3).height = 14;
  ws.mergeCells(`A1:${MIDL}3`);
  ws.mergeCells(`${MIDR}1:${LAST}3`);
  ws.getCell(`${MIDR}1`).value = doc.docTitle;
  ws.getCell(`${MIDR}1`).font = { bold: true, size: 18, color: { argb: BLACK } };
  ws.getCell(`${MIDR}1`).alignment = { vertical: "middle", horizontal: "right" };
  const logo = await loadLogoBase64();
  if (logo) {
    const imgId = wb.addImage({ base64: logo, extension: "png" });
    ws.addImage(imgId, { tl: { col: 0.12, row: 0.45 }, ext: { width: 210, height: 33 } });
  } else {
    ws.getCell("A1").value = "KOLEEX";
    ws.getCell("A1").font = { bold: true, size: 22, color: { argb: BLACK } };
    ws.getCell("A1").alignment = { vertical: "middle" };
  }

  /* ── Company band: legal (left) + Chinese (right) on black ── */
  r = 4;
  ws.getRow(4).height = 16;
  ws.mergeCells(`A4:${MIDL}4`);
  ws.mergeCells(`${MIDR}4:${LAST}4`);
  ws.getCell("A4").value = COMPANY.legal;
  ws.getCell("A4").font = { bold: true, size: 9, color: { argb: WHITE } };
  ws.getCell("A4").alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  fillCell("A4", BLACK);
  ws.getCell(`${MIDR}4`).value = COMPANY.cn;
  ws.getCell(`${MIDR}4`).font = { size: 9, color: { argb: WHITE } };
  ws.getCell(`${MIDR}4`).alignment = { vertical: "middle", horizontal: "right", indent: 1 };
  fillCell(`${MIDR}4`, BLACK);

  // Tagline strip.
  r = 5;
  ws.getRow(5).height = 14;
  ws.mergeCells(`A5:${LAST}5`);
  ws.getCell("A5").value = COMPANY.tagline;
  ws.getCell("A5").font = { bold: true, size: 9, color: { argb: INK } };
  ws.getCell("A5").alignment = { vertical: "middle", horizontal: "center" };
  fillCell("A5", SOFT);

  r = 6;
  ws.getRow(6).height = 8;

  /* ── Meta strip: boxed cells (DATE · NO · CLIENT NO) ── */
  const strip = doc.metaStrip.slice(0, nCols);
  const cellSpan = Math.max(1, Math.floor(nCols / strip.length));
  const labelRow = 7;
  const valueRow = 8;
  ws.getRow(labelRow).height = 15;
  ws.getRow(valueRow).height = 16;
  strip.forEach((pair, idx) => {
    const startC = idx * cellSpan + 1;
    const endC = idx === strip.length - 1 ? nCols : startC + cellSpan - 1;
    const a = colLetter(startC);
    const b = colLetter(endC);
    ws.mergeCells(`${a}${labelRow}:${b}${labelRow}`);
    ws.mergeCells(`${a}${valueRow}:${b}${valueRow}`);
    const lc = ws.getCell(`${a}${labelRow}`);
    lc.value = pair[0];
    lc.font = { bold: true, size: 9, color: { argb: WHITE } };
    lc.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    fillCell(`${a}${labelRow}`, BLACK);
    const vc = ws.getCell(`${a}${valueRow}`);
    vc.value = stripHtml(pair[1]);
    vc.font = { size: 11, color: { argb: INK } };
    vc.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    vc.border = borderAll;
  });

  r = 9;
  ws.getRow(9).height = 8;

  /* ── FROM / INVOICE TO — two columns ── */
  const blockHeaderRow = 10;
  ws.getRow(blockHeaderRow).height = 16;
  ws.mergeCells(`A${blockHeaderRow}:${MIDL}${blockHeaderRow}`);
  ws.mergeCells(`${MIDR}${blockHeaderRow}:${LAST}${blockHeaderRow}`);
  ws.getCell(`A${blockHeaderRow}`).value = "FROM";
  ws.getCell(`${MIDR}${blockHeaderRow}`).value = "INVOICE TO";
  [`A${blockHeaderRow}`, `${MIDR}${blockHeaderRow}`].forEach((addr) => {
    ws.getCell(addr).font = { bold: true, size: 9.5, color: { argb: WHITE } };
    ws.getCell(addr).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    fillCell(addr, BLACK);
  });

  const fromLines = FROM_LINES;
  const toLines = doc.toLines.map((l) => stripHtml(l)).filter((l) => l !== "");
  const lineCount = Math.max(fromLines.length, toLines.length);
  for (let i = 0; i < lineCount; i++) {
    const rowIdx = blockHeaderRow + 1 + i;
    const row = ws.getRow(rowIdx);
    const left = fromLines[i] ?? "";
    const right = toLines[i] ?? "";
    ws.mergeCells(`A${rowIdx}:${MIDL}${rowIdx}`);
    ws.mergeCells(`${MIDR}${rowIdx}:${LAST}${rowIdx}`);
    const lc = ws.getCell(`A${rowIdx}`);
    lc.value = left;
    lc.font = { bold: i === 0, size: i === 0 ? 10 : 9, color: { argb: i === 0 ? INK : GRAY } };
    lc.alignment = { vertical: "top", horizontal: "left", wrapText: true, indent: 1 };
    const rc = ws.getCell(`${MIDR}${rowIdx}`);
    rc.value = right;
    rc.font = { bold: i === 0, size: i === 0 ? 10 : 9, color: { argb: i === 0 ? INK : GRAY } };
    rc.alignment = { vertical: "top", horizontal: "left", wrapText: true, indent: 1 };
    // Estimate height from the longer wrapped line.
    const leftW = doc.columns.slice(0, mid).reduce((s, c) => s + c.width, 0);
    const rightW = doc.columns.slice(mid).reduce((s, c) => s + c.width, 0);
    const lLines = Math.ceil(left.length / Math.max(10, leftW));
    const rLines = Math.ceil(right.length / Math.max(10, rightW));
    row.height = Math.min(56, Math.max(14, Math.max(lLines, rLines) * 12));
    r = rowIdx;
  }

  r += 1;
  ws.getRow(r).height = 8;

  /* ── Items table ── */
  r += 1;
  const hdr = ws.getRow(r);
  hdr.height = 22;
  doc.columns.forEach((c, i) => {
    const cell = hdr.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, size: 10, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLACK } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = borderAll;
  });

  for (const dataRow of doc.rows) {
    r += 1;
    const row = ws.getRow(r);
    let maxLines = 1;
    doc.columns.forEach((col, i) => {
      if (col.money) return;
      const raw = dataRow[i];
      if (typeof raw === "string") {
        const t = stripHtml(raw);
        maxLines = Math.max(maxLines, Math.ceil(t.length / Math.max(8, Math.floor(col.width * 1.05))));
      }
    });
    row.height = Math.min(70, Math.max(16, maxLines * 13 + 2));
    const isBand = (dataRow[0] === "" || dataRow[0] == null) && typeof dataRow[1] === "string" && String(dataRow[1]).trim().startsWith("▸");
    if (isBand) {
      ws.mergeCells(`A${r}:${LAST}${r}`);
      const cell = ws.getCell(`A${r}`);
      cell.value = stripHtml(dataRow[1]);
      cell.font = { bold: true, size: 10, color: { argb: INK } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SOFT } };
      cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      cell.border = borderAll;
      continue;
    }
    doc.columns.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      const raw = dataRow[i];
      cell.border = borderAll;
      if (col.money) {
        cell.value = money(raw);
        cell.numFmt = "#,##0.00";
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.font = { size: 10.5, color: { argb: INK } };
      } else if (typeof raw === "number") {
        cell.value = raw;
        cell.alignment = { vertical: "middle", horizontal: col.align === "center" ? "center" : "right" };
        cell.font = { size: 10.5, color: { argb: INK } };
      } else {
        cell.value = stripHtml(raw);
        cell.alignment = { vertical: "middle", horizontal: col.align === "center" ? "center" : "left", wrapText: true };
        cell.font = { size: 10.5, color: { argb: INK } };
      }
    });
  }

  r += 1;
  ws.getRow(r).height = 6;

  /* ── Totals block (right-aligned, last two columns) ── */
  const labelColIdx = Math.max(1, nCols - 1);
  const LBL = colLetter(labelColIdx);
  for (const tot of doc.totals) {
    r += 1;
    const row = ws.getRow(r);
    row.height = 17;
    if (labelColIdx > 1) ws.mergeCells(`A${r}:${colLetter(labelColIdx - 1)}${r}`);
    const lc = ws.getCell(`${LBL}${r}`);
    const vc = ws.getCell(`${LAST}${r}`);
    lc.value = tot.label;
    vc.value = money(tot.value);
    vc.numFmt = "#,##0.00";
    lc.alignment = { vertical: "middle", horizontal: "right" };
    vc.alignment = { vertical: "middle", horizontal: "right" };
    if (tot.strong) {
      lc.font = { bold: true, size: 11.5, color: { argb: WHITE } };
      vc.font = { bold: true, size: 11.5, color: { argb: WHITE } };
      fillCell(`${LBL}${r}`, BLACK);
      fillCell(`${LAST}${r}`, BLACK);
    } else {
      lc.font = { bold: true, size: 10.5, color: { argb: "FF333333" } };
      vc.font = { bold: true, size: 10.5, color: { argb: INK } };
    }
  }

  /* ── Terms ── */
  const termsText = stripHtml(doc.terms);
  if (termsText) {
    r += 1;
    ws.getRow(r).height = 8;
    r += 1;
    ws.mergeCells(`A${r}:${LAST}${r}`);
    ws.getCell(`A${r}`).value = "TERMS & CONDITIONS";
    ws.getCell(`A${r}`).font = { bold: true, size: 10, color: { argb: WHITE } };
    fillCell(`A${r}`, BLACK);
    ws.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    r += 1;
    ws.mergeCells(`A${r}:${LAST}${r}`);
    ws.getCell(`A${r}`).value = termsText;
    ws.getCell(`A${r}`).font = { size: 9.5, color: { argb: INK } };
    ws.getCell(`A${r}`).alignment = { vertical: "top", horizontal: "left", wrapText: true, indent: 1 };
    ws.getRow(r).height = Math.min(180, 26 + Math.ceil(termsText.length / 95) * 13);
    ws.getCell(`A${r}`).border = borderAll;
  }

  /* ── Footer ── */
  r += 1;
  ws.getRow(r).height = 6;
  r += 1;
  ws.mergeCells(`A${r}:${LAST}${r}`);
  ws.getCell(`A${r}`).value = `${COMPANY.legal}  ·  ${COMPANY.tagline}`;
  ws.getCell(`A${r}`).font = { size: 8, italic: true, color: { argb: GRAY } };
  ws.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "center" };

  const out = await wb.xlsx.writeBuffer();
  const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
