import "server-only";

/* ---------------------------------------------------------------------------
   doc-gen — Koleex AI writes a document; this turns it into a real PDF.

   The document counterpart of image-gen: the user asks for "an organised
   PDF of this", "a packing list from these details", "redesign this file" —
   the model structures the content, and the adapter renders it server-side
   into an A4 PDF with the Koleex house style (minimal, black & white,
   premium — the owner's design philosophy, not a template gallery).

   NOTHING LEAVES OUR NETWORK. Unlike image-gen there is no vendor call at
   all: the content arrives from the model, is rendered by our own headless
   Chromium (pdf/chromium — the same launcher the quotation PDF uses), and
   the bytes go to our own bucket. The egress scanner therefore does not
   apply here; what DOES apply is escaping — every character the model
   emits is untrusted markup until it passes esc().

   WHAT THIS NEVER IS: an official Koleex business document. Quotations,
   invoices and invitations have their own signed, numbered, permissioned
   flows with their own PDF routes. A document made here is a working
   paper — the tool's result note says so beside the link, so a generated
   "price list" can never masquerade as a signed quotation.
   --------------------------------------------------------------------------- */

import { launchPdfBrowser } from "../pdf/chromium";

/* A4 render + snapshot budget. The quotation route budgets 35 s for the
   page and 8 s for the snapshot against a 60 s function ceiling; a
   setContent render skips the navigation entirely, so 30 s for the whole
   document is generous without letting a runaway hold the function. */
export const DOC_RENDER_TIMEOUT_MS = 30_000;
/* Guard-rail on input size: a pasted novel is not a document request.
   Sections are capped per field below; this caps the aggregate. */
export const MAX_DOC_CHARS = 20_000;
const MAX_SECTIONS = 40;
const MAX_ROWS = 200;
const MAX_CELL_CHARS = 500;

export interface DocTable {
  columns: string[];
  rows: string[][];
}

export interface DocSection {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: DocTable;
}

export interface DocInput {
  title: string;
  subtitle?: string;
  /** "Packing list", "Report", "Meeting summary" — printed as a kicker. */
  kind?: string;
  reference?: string;
  date?: string;
  sections: DocSection[];
  footerNote?: string;
  /** "en" | "ar" | "zh" — picks direction and font stack. Default en. */
  lang?: string;
}

export type DocGenOutcome =
  | { ok: true; bytes: Uint8Array; pages: number; ms: number }
  | { ok: false; error: string; ms: number };

/* ── Sanitising ──────────────────────────────────────────────────────── */

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clamp(s: unknown, n: number): string {
  return String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
}

/** Defensive copy of the model's structure: wrong types become empty,
 *  oversized fields are cut, totals are capped. Never throws. */
export function sanitizeDocInput(raw: unknown): DocInput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = clamp(o.title, 200);
  if (!title) return null;

  let budget = MAX_DOC_CHARS - title.length;
  const spend = (s: string): string => {
    if (budget <= 0) return "";
    const out = s.slice(0, budget);
    budget -= out.length;
    return out;
  };

  const sections: DocSection[] = [];
  const rawSections = Array.isArray(o.sections) ? o.sections : [];
  for (const rs of rawSections.slice(0, MAX_SECTIONS)) {
    if (!rs || typeof rs !== "object") continue;
    const s = rs as Record<string, unknown>;
    const section: DocSection = {};
    if (typeof s.heading === "string" && s.heading.trim()) section.heading = spend(clamp(s.heading, 200));
    if (Array.isArray(s.paragraphs)) {
      section.paragraphs = s.paragraphs
        .filter((p): p is string => typeof p === "string")
        .slice(0, 20)
        .map((p) => spend(clamp(p, 2000)))
        .filter(Boolean);
    }
    if (Array.isArray(s.bullets)) {
      section.bullets = s.bullets
        .filter((b): b is string => typeof b === "string")
        .slice(0, 30)
        .map((b) => spend(clamp(b, 400)))
        .filter(Boolean);
    }
    const t = s.table as Record<string, unknown> | undefined;
    if (t && Array.isArray(t.columns) && Array.isArray(t.rows)) {
      const columns = (t.columns as unknown[]).filter((c): c is string => typeof c === "string").slice(0, 10).map((c) => clamp(c, 80));
      const rows = (t.rows as unknown[])
        .filter((r): r is unknown[] => Array.isArray(r))
        .slice(0, MAX_ROWS)
        .map((r) => r.slice(0, columns.length).map((c) => clamp(c, MAX_CELL_CHARS)));
      if (columns.length && rows.length) section.table = { columns, rows };
    }
    if (section.heading || section.paragraphs?.length || section.bullets?.length || section.table) {
      sections.push(section);
    }
  }
  if (!sections.length) return null;

  return {
    title,
    subtitle: clamp(o.subtitle, 200) || undefined,
    kind: clamp(o.kind, 60) || undefined,
    reference: clamp(o.reference, 60) || undefined,
    date: clamp(o.date, 40) || undefined,
    sections,
    footerNote: clamp(o.footerNote, 200) || undefined,
    lang: clamp(o.lang, 8) || undefined,
  };
}

/* ── The house style ─────────────────────────────────────────────────── */

function dirFor(lang: string | undefined): "rtl" | "ltr" {
  return lang === "ar" ? "rtl" : "ltr";
}

function fontStackFor(lang: string | undefined): string {
  if (lang === "ar") return `"Segoe UI", "Tahoma", "Arial", sans-serif`;
  if (lang === "zh") return `"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`;
  return `"Helvetica Neue", "Helvetica", "Arial", sans-serif`;
}

/** The whole document as one self-contained HTML page. No external
 *  assets at all — no fonts, no images, no CSS files — so the render can
 *  never hang on a network fetch inside a serverless function. */
export function renderDocHtml(doc: DocInput): string {
  const dir = dirFor(doc.lang);
  const font = fontStackFor(doc.lang);
  const sections = doc.sections
    .map((s) => {
      const parts: string[] = [];
      if (s.heading) parts.push(`<h2>${esc(s.heading)}</h2>`);
      for (const p of s.paragraphs ?? []) parts.push(`<p>${esc(p)}</p>`);
      if (s.bullets?.length) {
        parts.push(`<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`);
      }
      if (s.table) {
        const head = s.table.columns.map((c) => `<th>${esc(c)}</th>`).join("");
        const body = s.table.rows
          .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
          .join("");
        parts.push(`<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`);
      }
      return `<section>${parts.join("\n")}</section>`;
    })
    .join("\n");

  const metaBits = [doc.kind, doc.reference, doc.date].filter(Boolean).map(esc).join(" · ");

  return `<!DOCTYPE html>
<html lang="${esc(doc.lang ?? "en")}" dir="${dir}">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ${font};
    color: #111;
    background: #fff; /* without it, headless screenshots and some PDF
                         viewers composite the transparent page over black */
    padding: 22mm 18mm 20mm;
    font-size: 11pt;
    line-height: 1.55;
  }
  .kicker {
    font-size: 8.5pt; letter-spacing: 0.22em; text-transform: uppercase;
    color: #666; margin-bottom: 4mm;
  }
  h1 {
    font-size: 21pt; font-weight: 700; letter-spacing: -0.01em;
    margin: 0 0 2mm; line-height: 1.2;
  }
  .subtitle { font-size: 11pt; color: #555; margin-bottom: 6mm; }
  .rule { border: 0; border-top: 2.5px solid #111; margin: 6mm 0 8mm; }
  section { margin-bottom: 7mm; break-inside: avoid-page; }
  h2 {
    font-size: 12.5pt; font-weight: 700; margin: 0 0 2.5mm;
    padding-bottom: 1.5mm; border-bottom: 1px solid #ddd;
  }
  p { margin: 0 0 2.5mm; }
  ul { margin: 0 0 2.5mm; padding-inline-start: 5.5mm; }
  li { margin-bottom: 1.2mm; }
  table {
    width: 100%; border-collapse: collapse; margin: 2mm 0 3mm;
    font-size: 9.5pt; break-inside: auto;
  }
  th {
    text-align: start; font-weight: 700; padding: 2mm 2.5mm;
    border-bottom: 1.5px solid #111; white-space: nowrap;
  }
  td { padding: 1.8mm 2.5mm; border-bottom: 0.5px solid #ddd; vertical-align: top; }
  tr:nth-child(even) td { background: #f7f7f7; }
  .foot {
    margin-top: 10mm; padding-top: 3mm; border-top: 1px solid #ddd;
    font-size: 8.5pt; color: #777;
  }
</style>
</head>
<body>
  ${metaBits ? `<div class="kicker">${metaBits}</div>` : ""}
  <h1>${esc(doc.title)}</h1>
  ${doc.subtitle ? `<div class="subtitle">${esc(doc.subtitle)}</div>` : ""}
  <hr class="rule">
  ${sections}
  ${doc.footerNote ? `<div class="foot">${esc(doc.footerNote)}</div>` : ""}
</body>
</html>`;
}

/* ── The render ──────────────────────────────────────────────────────── */

/**
 * One PDF for one structured document. Never throws: a missing Chrome, a
 * bad page, a timeout — all become ok:false with a cause the tool relays.
 */
export async function renderDocumentPdf(doc: DocInput): Promise<DocGenOutcome> {
  const startedAt = Date.now();
  const fail = (error: string): DocGenOutcome => {
    const ms = Date.now() - startedAt;
    console.warn(`[ai.doc] fail ms=${ms} cause=${error}`);
    return { ok: false, error, ms };
  };

  const html = renderDocHtml(doc);
  let browser: Awaited<ReturnType<typeof launchPdfBrowser>> | null = null;
  try {
    browser = await launchPdfBrowser();
  } catch (e) {
    return fail(`browser unavailable: ${(e as Error).message.slice(0, 120)}`);
  }
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: DOC_RENDER_TIMEOUT_MS });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      timeout: DOC_RENDER_TIMEOUT_MS,
    });
    const bytes = new Uint8Array(pdf);
    if (bytes.length < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50) { // %PDF
      return fail("renderer produced non-PDF bytes");
    }
    const ms = Date.now() - startedAt;
    console.log(`[ai.doc] ok ms=${ms} bytes=${bytes.byteLength}`);
    return { ok: true, bytes, pages: await page.evaluate(() => document.querySelectorAll("section").length).catch(() => 0) as number, ms };
  } catch (e) {
    return fail(`render failed: ${(e as Error).message.slice(0, 120)}`);
  } finally {
    await browser.close().catch(() => {});
  }
}
