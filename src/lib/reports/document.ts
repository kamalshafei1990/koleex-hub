/* ===========================================================================
   Phase R — Document Composer.

   The top-level function that turns a ReportPayload into a complete
   HTML document ready for screen rendering OR Puppeteer PDF.

   Hierarchy (the seven levels from the Phase R spec):
     1. Company identity      → documentHeader (logo + tenant + meta)
     2. Report title          → titleBlock
     3. Recipient / context   → recipientBlock (customer/supplier only)
     4. Financial summary     → summaryGrid
     5. Detail ledger         → renderTable for each table section
     6. Totals + balances     → totalsBlock
     7. Footer + legal        → inlineDocumentFooter + signatureBlock

   The composer does NOT decide what those blocks contain — that's
   the builder's job. The composer's job is layout, page geometry,
   typography, and pagination glue.

   API:
     renderReportDocument(payload, opts)  →  string (full HTML doc)

   Backwards compatibility: html-renderer.ts re-exports
   renderReportHtml as a shim over this function, so the two existing
   API routes (/api/reports/export/pdf, /api/reports/exports/[id]/html)
   keep their signature.
   ========================================================================== */

import { COLOR, FONT_STACK, PAGE, SPACE, TYPE } from "./design-system";
import {
  classificationAccent,
  documentHeader,
  inlineDocumentFooter,
  notesBlock,
  recipientBlock,
  signatureBlock,
  summaryGrid,
  titleBlock,
  totalsBlock,
} from "./layout";
import { renderTable } from "./table";
import type { ReportPayload, ReportSection } from "./types";

export interface DocumentRenderOptions {
  /** Inline the auto-print bootstrap so the browser fires
   *  window.print() once the page is ready (used by the print page). */
  autoPrint?: boolean;
  /** Override the <title> element (defaults to "<title> · <report_no>"). */
  documentTitle?: string;
}

/* Defence-in-depth: external documents MUST NEVER carry an
   internal_warning. The composer enforces this even if a builder is
   misconfigured. Returns a sanitised copy without mutating the
   caller's payload. */
function enforceVisibilityContract(payload: ReportPayload): ReportPayload {
  if (payload.meta.visibility === "external" && payload.internal_warning) {
    return { ...payload, internal_warning: undefined };
  }
  return payload;
}

function renderSection(section: ReportSection): string {
  switch (section.kind) {
    case "table":
      return renderTable(section);
    case "spacer":
      return `<div style="height:${SPACE.lg}px"></div>`;
    case "note":
      return `<section style="margin-bottom:${SPACE.xl}px">
        ${section.title ? `<div style="font-size:${TYPE.sectionTitle.size}pt;font-weight:${TYPE.sectionTitle.weight};text-transform:uppercase;letter-spacing:${TYPE.sectionTitle.tracking};color:${COLOR.ink};margin-bottom:${SPACE.sm}px">${esc(section.title)}</div>` : ""}
        <div style="font-size:${TYPE.body.size}pt;line-height:${TYPE.body.lineHeight};color:${COLOR.ink2}">${esc(section.body)}</div>
      </section>`;
    case "kv":
      return `<section style="margin-bottom:${SPACE.xl}px">
        ${section.title ? `<div style="font-size:${TYPE.sectionTitle.size}pt;font-weight:${TYPE.sectionTitle.weight};text-transform:uppercase;letter-spacing:${TYPE.sectionTitle.tracking};color:${COLOR.ink};margin-bottom:${SPACE.sm}px">${esc(section.title)}</div>` : ""}
        <dl style="display:grid;grid-template-columns:1fr 2fr;gap:${SPACE.xs}px ${SPACE.lg}px;margin:0;font-size:${TYPE.body.size}pt">
          ${section.pairs.map((p) => `
            <dt style="color:${COLOR.muted};font-weight:600;text-transform:uppercase;letter-spacing:0.08em;font-size:${TYPE.label.size}pt">${esc(p.label)}</dt>
            <dd style="color:${COLOR.ink};margin:0">${esc(p.value)}</dd>
          `).join("")}
        </dl>
      </section>`;
    default:
      return "";
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ─── Stylesheet ─────────────────────────────────────────────────── */

function documentStylesheet(): string {
  /* Two stylesheet jobs: A4 page geometry via @page, and a minimal
     baseline reset so the inline-styled elements in layout.ts +
     table.ts compose consistently. We deliberately use inline styles
     on layout primitives so the same fragments work inside the
     in-app preview iframe even if a parent stylesheet leaks. */
  return `
  :root {
    --rpt-mono: ${FONT_STACK.mono};
  }
  @page {
    size: ${PAGE.size};
    margin: ${PAGE.margin.top} ${PAGE.margin.right} ${PAGE.margin.bottom} ${PAGE.margin.left};
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: ${COLOR.paper};
    color: ${COLOR.ink};
    font-family: ${FONT_STACK.body};
    font-size: ${TYPE.body.size}pt;
    line-height: ${TYPE.body.lineHeight};
    -webkit-font-smoothing: antialiased;
  }
  /* Reset elements that ship with default browser styling we don't
     want bleeding into the document. */
  h1, h2, h3, h4 { margin: 0; font-weight: inherit; }
  p { margin: 0; }
  ul, ol { margin: 0; }
  /* Screen-only container — Puppeteer ignores width:max-width inside
     @page rules, so this only affects the print/screen preview iframe. */
  main.rpt-document {
    max-width: 210mm;
    margin: 0 auto;
    padding: ${PAGE.margin.top} ${PAGE.margin.right} ${PAGE.margin.bottom} ${PAGE.margin.left};
    background: ${COLOR.paper};
  }
  @media print {
    main.rpt-document {
      padding: 0;
      max-width: none;
    }
  }
  /* Page-break hygiene */
  table, tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  /* In-document footer never sits alone on a page. */
  .rpt-inline-footer { page-break-inside: avoid; }
  `;
}

/* ─── Public entry ───────────────────────────────────────────────── */

export function renderReportDocument(
  rawPayload: ReportPayload,
  opts: DocumentRenderOptions = {},
): string {
  const payload = enforceVisibilityContract(rawPayload);
  const css = documentStylesheet();
  const docTitle = esc(opts.documentTitle ?? `${payload.meta.title} · ${payload.meta.report_no}`);

  /* The ready flag lets the PDF route and the print page wait until
     fonts + layout settle before snapshotting. Auto-print fires the
     browser's native print dialog (used by ?auto=1 on the print URL). */
  const readyScript = `<script>
    window.addEventListener('load', function () {
      function ready() { (window).__report_pdf_ready__ = true; }
      if (typeof document !== 'undefined' && 'fonts' in document) {
        document.fonts.ready.finally(ready);
      } else {
        ready();
      }
    });
  </script>`;
  const autoPrintScript = opts.autoPrint
    ? `<script>
        window.addEventListener('load', function () {
          /* Defer one paint so multi-page reflow settles before the
             browser captures the print dialog. */
          requestAnimationFrame(function () { setTimeout(function () { window.print(); }, 150); });
        });
      </script>`
    : "";

  /* dir attribute is architecture-ready for RTL — today we hardcode
     LTR until R.3 ships Arabic and Chinese. */
  const dir = "ltr";

  const sections = payload.sections.map(renderSection).join("\n");

  return `<!DOCTYPE html>
<html lang="${esc(payload.meta.locale)}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${docTitle}</title>
<style>${css}</style>
</head>
<body
  data-report-no="${esc(payload.meta.report_no)}"
  data-visibility="${esc(payload.meta.visibility)}"
  data-report-type="${esc(payload.meta.report_type)}"
>
<main class="rpt-document">
${classificationAccent(payload)}
${documentHeader(payload)}
${titleBlock(payload)}
${recipientBlock(payload.recipient)}
${summaryGrid(payload.summary, payload.meta.currency)}
${sections}
${totalsBlock(payload.totals)}
${notesBlock(payload.notes)}
${signatureBlock(payload)}
${inlineDocumentFooter(payload)}
</main>
${readyScript}
${autoPrintScript}
</body>
</html>`;
}
