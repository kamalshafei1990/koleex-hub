/* ---------------------------------------------------------------------------
   excel-export — exports a Quotation/Invoice as an Excel workbook that mirrors
   the on-screen A4 document: real embedded KOLEEX logo, the company header
   band, a document title + details block, the items table, the totals block,
   and the terms section. Built on ExcelJS (the only mainstream lib that embeds
   images + full cell styling). Loaded lazily so it never weighs first paint.

   The document model stays small and is shared by quotations & invoices. All
   free-text is HTML-stripped first (rich-editor descriptions carry <b>/<font>
   tags that must never reach the sheet).
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
  /** Document kind, e.g. "QUOTATION" or "INVOICE". */
  title: string;
  number: string;
  /** Label / value pairs (Date, Customer, Currency, …) shown in the details block. */
  meta: [string, string][];
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
    .replace(/<br\s*\/?>(?=.)/gi, " ")
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
  contact:
    "Room 206, Building 88, West Feiyue Technological Innovative Park, Jiaojiang District, Taizhou City, Zhejiang, China  ·  +86 0576 8892 7796  ·  info@koleexgroup.com  ·  www.koleexgroup.com",
};

const BLACK = "FF000000";
const WHITE = "FFFFFFFF";
const HAIR = "FFD0D0D0";
const INK = "FF111111";
const GRAY = "FF777777";

const thin = { style: "thin" as const, color: { argb: HAIR } };
const borderAll = { top: thin, left: thin, bottom: thin, right: thin };

/* The exact KOLEEX wordmark used on the printed A4 document (inline SVG paths,
   viewBox -4 -4 727.83 115.57). We rasterise it to a crisp PNG at runtime so
   the spreadsheet carries the real company logo — not the HUB app logo. */
const KOLEEX_WORDMARK_PATHS = [
  "M116.59,96.3v11.05h-10.6L14.66,62.47v44.88H0V1.58h14.66v43.53L105.99,1.58h10.6v11.05L28.42,53.9l88.18,42.4Z",
  "M242.65,71.04c0,20.07-14.21,36.54-34.28,36.54h-50.74c-20.52,0-35.18-16.01-35.18-36.54v-35.18C122.45,15.11,136.88.45,157.63.45h49.84c20.52,0,35.18,14.88,35.18,35.41v35.18ZM227.77,38.11c0-12.4-8.34-23.23-20.3-23.23h-49.84c-11.95,0-20.3,10.83-20.3,23.23v31.8c0,11.95,8.34,23,20.3,23h49.84c11.95,0,20.3-11.05,20.3-23v-31.8Z",
  "M363.07,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54l.23-71.04h14.66v69.91c0,11.95,8.34,23,20.3,23h68.56v14.66h-.01Z",
  "M473.8,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68Z",
  "M585.42,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68Z",
  "M719.83,96.3v11.05h-10.6l-48.04-42.62-48.04,42.62h-10.37v-11.05l46.91-41.72-46.91-41.95V1.58h10.37l48.04,42.62L709.23,1.58h10.6v11.05l-47.13,41.95,47.13,41.72ZM661.19,71.04l40.59,36.31h-81.19l40.59-36.31Z",
];

/** Rasterise the KOLEEX wordmark to a PNG base64 (no data: prefix). null on failure. */
async function loadLogoBase64(): Promise<string | null> {
  try {
    const w = 210;
    const h = 33; // 727.83 / 115.57 ≈ 6.3 aspect
    const paths = KOLEEX_WORDMARK_PATHS.map((d) => `<path fill="#000000" d="${d}"/>`).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="-4 -4 727.83 115.57" preserveAspectRatio="xMinYMid meet">${paths}</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const base64 = await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = 3; // hi-dpi for crisp text
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
 * Build a letterhead Excel that mirrors the A4 document and trigger a browser
 * download. Must be called from a client handler.
 */
export async function downloadDocXlsx(filename: string, doc: DocExport): Promise<void> {
  const ExcelJSmod = await import("exceljs");
  const ExcelJS = (ExcelJSmod as unknown as { default?: typeof ExcelJSmod }).default ?? ExcelJSmod;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(doc.title.slice(0, 31) || "Document", {
    properties: { defaultRowHeight: 16 },
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
    views: [{ showGridLines: false }],
  });

  const nCols = Math.max(doc.columns.length, 4);
  const lastColLetter = String.fromCharCode(64 + nCols); // A=65
  ws.columns = doc.columns.map((c) => ({ width: c.width }));

  let r = 0;
  const next = () => (r += 1);

  /* ── Letterhead: logo (left) + company text (right of it) ── */
  next(); // row 1
  ws.getRow(1).height = 22;
  ws.getRow(2).height = 16;
  ws.getRow(3).height = 14;
  ws.mergeCells(`A1:B3`);
  // Company text — to the right of the logo.
  ws.mergeCells(`C1:${lastColLetter}1`);
  ws.getCell("C1").value = COMPANY.legal;
  ws.getCell("C1").font = { bold: true, size: 11, color: { argb: INK } };
  ws.getCell("C1").alignment = { vertical: "middle", horizontal: "right" };
  next(); // 2
  ws.mergeCells(`C2:${lastColLetter}2`);
  ws.getCell("C2").value = COMPANY.cn;
  ws.getCell("C2").font = { size: 9.5, color: { argb: GRAY } };
  ws.getCell("C2").alignment = { vertical: "middle", horizontal: "right" };
  next(); // 3
  ws.mergeCells(`C3:${lastColLetter}3`);
  ws.getCell("C3").value = COMPANY.tagline;
  ws.getCell("C3").font = { bold: true, size: 9, color: { argb: INK } };
  ws.getCell("C3").alignment = { vertical: "middle", horizontal: "right" };

  // Embed the real logo over A1:B3.
  const logo = await loadLogoBase64();
  if (logo) {
    const imgId = wb.addImage({ base64: logo, extension: "png" });
    ws.addImage(imgId, { tl: { col: 0.1, row: 0.35 }, ext: { width: 210, height: 33 } });
  } else {
    ws.getCell("A1").value = "KOLEEX";
    ws.getCell("A1").font = { bold: true, size: 20, color: { argb: BLACK } };
    ws.getCell("A1").alignment = { vertical: "middle" };
  }

  // Contact line (full width, gray).
  next(); // 4
  ws.getRow(4).height = 22;
  ws.mergeCells(`A4:${lastColLetter}4`);
  ws.getCell("A4").value = COMPANY.contact;
  ws.getCell("A4").font = { size: 8, color: { argb: GRAY } };
  ws.getCell("A4").alignment = { vertical: "middle", horizontal: "left", wrapText: true };

  // Black divider band.
  next(); // 5
  ws.getRow(5).height = 4;
  ws.mergeCells(`A5:${lastColLetter}5`);
  ws.getCell("A5").fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLACK } };

  next(); // 6 spacer
  ws.getRow(6).height = 8;

  /* ── Title + details block ── */
  next(); // 7
  ws.getRow(7).height = 26;
  const half = Math.max(1, Math.ceil(nCols / 2));
  const titleEnd = String.fromCharCode(64 + half);
  const numStart = String.fromCharCode(64 + half + 1);
  ws.mergeCells(`A7:${titleEnd}7`);
  ws.getCell("A7").value = doc.title;
  ws.getCell("A7").font = { bold: true, size: 18, color: { argb: BLACK } };
  ws.getCell("A7").alignment = { vertical: "middle" };
  ws.mergeCells(`${numStart}7:${lastColLetter}7`);
  ws.getCell(`${numStart}7`).value = `No.  ${doc.number}`;
  ws.getCell(`${numStart}7`).font = { bold: true, size: 12, color: { argb: INK } };
  ws.getCell(`${numStart}7`).alignment = { vertical: "middle", horizontal: "right" };

  // Details / Bill-to: each meta pair on its own row. The label spans the
  // first two columns (the "#" column alone is too narrow and truncates it);
  // the value spans the rest.
  const valueStart = String.fromCharCode(64 + 3); // column C
  for (const [label, value] of doc.meta) {
    next();
    const row = ws.getRow(r);
    row.height = 15;
    ws.mergeCells(`A${r}:B${r}`);
    ws.getCell(`A${r}`).value = label;
    ws.getCell(`A${r}`).font = { bold: true, size: 9.5, color: { argb: GRAY } };
    ws.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "left" };
    ws.mergeCells(`${valueStart}${r}:${lastColLetter}${r}`);
    ws.getCell(`${valueStart}${r}`).value = stripHtml(value);
    ws.getCell(`${valueStart}${r}`).font = { size: 10.5, color: { argb: INK } };
    ws.getCell(`${valueStart}${r}`).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  }

  next(); // spacer
  ws.getRow(r).height = 8;

  /* ── Items table ── */
  next();
  const headerRowIdx = r;
  const hdr = ws.getRow(headerRowIdx);
  hdr.height = 20;
  doc.columns.forEach((c, i) => {
    const cell = hdr.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, size: 10.5, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLACK } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = borderAll;
  });

  for (const dataRow of doc.rows) {
    next();
    const row = ws.getRow(r);
    // Estimate wrapped-line count from the text columns so long descriptions
    // aren't clipped (ExcelJS does not auto-fit row height).
    let maxLines = 1;
    doc.columns.forEach((col, i) => {
      if (col.money) return;
      const raw = dataRow[i];
      if (typeof raw === "string") {
        const t = stripHtml(raw);
        const cpl = Math.max(8, Math.floor(col.width * 1.05));
        maxLines = Math.max(maxLines, Math.ceil(t.length / cpl));
      }
    });
    row.height = Math.min(70, Math.max(16, maxLines * 13 + 2));
    // Section band: ["", "▸ Title", ...] → merge across, light fill, bold.
    const isBand = (dataRow[0] === "" || dataRow[0] == null) && typeof dataRow[1] === "string" && String(dataRow[1]).trim().startsWith("▸");
    if (isBand) {
      ws.mergeCells(`A${r}:${lastColLetter}${r}`);
      const cell = ws.getCell(`A${r}`);
      cell.value = stripHtml(dataRow[1]);
      cell.font = { bold: true, size: 10, color: { argb: INK } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
      cell.alignment = { vertical: "middle", horizontal: "left" };
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

  next(); // spacer
  ws.getRow(r).height = 6;

  /* ── Totals block (right-aligned, last two columns) ── */
  const labelColIdx = Math.max(1, nCols - 1);
  const labelColLetter = String.fromCharCode(64 + labelColIdx);
  const valueColLetter = lastColLetter;
  for (const tot of doc.totals) {
    next();
    const row = ws.getRow(r);
    row.height = 17;
    if (labelColIdx > 1) ws.mergeCells(`A${r}:${String.fromCharCode(64 + labelColIdx - 1)}${r}`);
    const lc = ws.getCell(`${labelColLetter}${r}`);
    const vc = ws.getCell(`${valueColLetter}${r}`);
    lc.value = tot.label;
    vc.value = money(tot.value);
    vc.numFmt = "#,##0.00";
    lc.alignment = { vertical: "middle", horizontal: "right" };
    vc.alignment = { vertical: "middle", horizontal: "right" };
    if (tot.strong) {
      lc.font = { bold: true, size: 11.5, color: { argb: WHITE } };
      vc.font = { bold: true, size: 11.5, color: { argb: WHITE } };
      lc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLACK } };
      vc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLACK } };
    } else {
      lc.font = { bold: true, size: 10.5, color: { argb: "FF333333" } };
      vc.font = { bold: true, size: 10.5, color: { argb: INK } };
    }
  }

  /* ── Terms ── */
  const termsText = stripHtml(doc.terms);
  if (termsText) {
    next();
    ws.getRow(r).height = 8;
    next();
    ws.mergeCells(`A${r}:${lastColLetter}${r}`);
    ws.getCell(`A${r}`).value = "TERMS & CONDITIONS";
    ws.getCell(`A${r}`).font = { bold: true, size: 10, color: { argb: WHITE } };
    ws.getCell(`A${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLACK } };
    ws.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "left" };
    next();
    ws.mergeCells(`A${r}:${lastColLetter}${r}`);
    ws.getCell(`A${r}`).value = termsText;
    ws.getCell(`A${r}`).font = { size: 9.5, color: { argb: INK } };
    ws.getCell(`A${r}`).alignment = { vertical: "top", horizontal: "left", wrapText: true };
    ws.getRow(r).height = Math.min(160, 26 + Math.ceil(termsText.length / 90) * 13);
    ws.getCell(`A${r}`).border = borderAll;
  }

  /* ── Footer ── */
  next();
  ws.getRow(r).height = 6;
  next();
  ws.mergeCells(`A${r}:${lastColLetter}${r}`);
  ws.getCell(`A${r}`).value = `${COMPANY.legal}  ·  ${COMPANY.tagline}`;
  ws.getCell(`A${r}`).font = { size: 8, italic: true, color: { argb: GRAY } };
  ws.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "center" };

  // Write + download.
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
