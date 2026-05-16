import "server-only";

/* ===========================================================================
   Phase R.1 — Official KOLEEX Report HTML Renderer
   Produces a single-document HTML page (full <html>...</html>) ready
   to be:
     · returned to the print page (and styled for screen + print)
     · or driven by Puppeteer to emit a multi-page A4 PDF

   Design language:
     · Apple-level minimalism, Stripe-financial clarity
     · A4 portrait, 25mm margins
     · KOLEEX wordmark logo top-left, "KOLEEX International Group"
     · Multi-page tables break cleanly with repeated thead rows
     · Internal reports get a magenta "INTERNAL — NOT FOR DISTRIBUTION"
       band; external reports never do
     · Page number footer on every page via @page CSS

   The renderer is the LAST line of defence on the internal-vs-external
   contract. It explicitly STRIPS `internal_warning` from the output
   for any payload marked `visibility: "external"`, even if a builder
   was misconfigured.
   ========================================================================== */

import type {
  ReportPayload,
  ReportSection,
  ReportColumn,
  ReportRowValue,
  ReportTotalsItem,
  ReportSummaryItem,
  ValueFormat,
} from "./types";

interface RenderOptions {
  /** Inline the auto-print bootstrap so the browser fires window.print()
   *  once the page is ready. Used by the "Print" channel. */
  autoPrint?: boolean;
  /** Set the document title (defaults to report meta.title). */
  documentTitle?: string;
}

export function renderReportHtml(payload: ReportPayload, opts: RenderOptions = {}): string {
  /* DEFENCE IN DEPTH — strip any internal_warning if visibility is
     external. The builder shouldn't have set it, but if it did this
     guarantees the external recipient never sees the warning band. */
  if (payload.meta.visibility === "external" && payload.internal_warning) {
    payload = { ...payload, internal_warning: undefined };
  }

  const css = baseStyles(payload.meta.visibility);
  const body = renderBody(payload);
  const docTitle = escapeHtml(opts.documentTitle ?? `${payload.meta.title} — ${payload.meta.report_no}`);
  const autoPrintScript = opts.autoPrint
    ? `<script>
        window.addEventListener('load', () => {
          /* Defer one paint so multi-page reflow settles before the
             browser captures the print dialog. */
          requestAnimationFrame(() => setTimeout(() => window.print(), 150));
        });
       </script>`
    : "";
  /* Always set the ready flag so the PDF route can wait on it. */
  const readyFlag = `<script>
    window.addEventListener('load', () => {
      /* Same convention as the quotation print page. */
      if (typeof document !== 'undefined' && 'fonts' in document) {
        document.fonts.ready.finally(() => { window.__report_pdf_ready__ = true; });
      } else {
        window.__report_pdf_ready__ = true;
      }
    });
  </script>`;

  return `<!DOCTYPE html>
<html lang="${payload.meta.locale}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${docTitle}</title>
<style>${css}</style>
</head>
<body data-report-no="${escapeAttr(payload.meta.report_no)}" data-visibility="${payload.meta.visibility}">
<main class="rpt">
${body}
</main>
${readyFlag}
${autoPrintScript}
</body>
</html>`;
}

/* -------------------------------------------------------------------------
   Body composition
   ------------------------------------------------------------------------- */

function renderBody(p: ReportPayload): string {
  const internalBand = p.internal_warning
    ? `<div class="rpt-internal">${escapeHtml(p.internal_warning)}</div>`
    : "";

  const periodLine = p.meta.period
    ? `<span class="meta-row"><span class="meta-label">Period</span><span class="meta-val">${formatDate(p.meta.period.from)} → ${formatDate(p.meta.period.to)}</span></span>`
    : "";

  return `
${header(p)}
${internalBand}
<section class="rpt-title-block">
  <h1 class="rpt-title">${escapeHtml(p.meta.title)}</h1>
  ${p.meta.subtitle ? `<div class="rpt-subtitle">${escapeHtml(p.meta.subtitle)}</div>` : ""}
  <div class="rpt-meta">
    <span class="meta-row"><span class="meta-label">Report No</span><span class="meta-val mono">${escapeHtml(p.meta.report_no)}</span></span>
    <span class="meta-row"><span class="meta-label">Generated</span><span class="meta-val">${formatDateTime(p.meta.generated_at)}</span></span>
    ${periodLine}
    <span class="meta-row"><span class="meta-label">Currency</span><span class="meta-val">${escapeHtml(p.meta.currency)}</span></span>
    <span class="meta-row"><span class="meta-label">Prepared by</span><span class="meta-val">${escapeHtml(p.meta.generated_by_name)}</span></span>
  </div>
</section>

${p.recipient ? renderRecipient(p.recipient) : ""}

${renderSummary(p.summary, p.meta.currency)}

${p.sections.map((s) => renderSection(s, p.meta.currency)).join("\n")}

${p.totals && p.totals.length > 0 ? renderTotals(p.totals, p.meta.currency) : ""}

${p.notes && p.notes.length > 0 ? renderNotes(p.notes) : ""}

${footer(p)}
`;
}

function header(p: ReportPayload): string {
  /* KOLEEX wordmark — same SVG path data the quotation/invoice
     documents use. Inline so the PDF render doesn't depend on any
     external asset. */
  const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="24" viewBox="-4 -4 727.83 115.57" preserveAspectRatio="xMinYMid meet" aria-label="KOLEEX">
    <path fill="#0A0A0A" d="M116.59,96.3v11.05h-10.6L14.66,62.47v44.88H0V1.58h14.66v43.53L105.99,1.58h10.6v11.05L28.42,53.9l88.18,42.4Z" />
    <path fill="#0A0A0A" d="M242.65,71.04c0,20.07-14.21,36.54-34.28,36.54h-50.74c-20.52,0-35.18-16.01-35.18-36.54v-35.18C122.45,15.11,136.88.45,157.63.45h49.84c20.52,0,35.18,14.88,35.18,35.41v35.18ZM227.77,38.11c0-12.4-8.34-23.23-20.3-23.23h-49.84c-11.95,0-20.3,10.83-20.3,23.23v31.8c0,11.95,8.34,23,20.3,23h49.84c11.95,0,20.3-11.05,20.3-23v-31.8Z" />
    <path fill="#0A0A0A" d="M363.07,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54l.23-71.04h14.66v69.91c0,11.95,8.34,23,20.3,23h68.56v14.66h-.01Z" />
    <path fill="#0A0A0A" d="M473.8,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68Z" />
    <path fill="#0A0A0A" d="M585.42,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68Z" />
    <path fill="#0A0A0A" d="M719.83,96.3v11.05h-10.6l-48.04-42.62-48.04,42.62h-10.37v-11.05l46.91-41.72-46.91-41.95V1.58h10.37l48.04,42.62L709.23,1.58h10.6v11.05l-47.13,41.95,47.13,41.72ZM661.19,71.04l40.59,36.31h-81.19l40.59-36.31Z" />
  </svg>`;
  return `
<header class="rpt-header">
  <div class="rpt-header-brand">
    ${logo}
    <div class="rpt-header-org">
      <div class="org-name">${escapeHtml(p.meta.tenant_name)}</div>
      <div class="org-sub">koleexgroup.com · ${escapeHtml(p.meta.tenant_name === "KOLEEX International Group" ? "KOLEEX INTERNATIONAL GROUP" : "Official Finance Document")}</div>
    </div>
  </div>
  <div class="rpt-header-kind">${p.meta.visibility === "internal" ? "INTERNAL" : "OFFICIAL"}</div>
</header>
`;
}

function footer(p: ReportPayload): string {
  return `
<footer class="rpt-footer">
  <div>${escapeHtml(p.meta.tenant_name)} · koleexgroup.com</div>
  <div>Document ${escapeHtml(p.meta.report_no)} · Generated ${formatDateTime(p.meta.generated_at)}</div>
</footer>
`;
}

function renderRecipient(r: NonNullable<ReportPayload["recipient"]>): string {
  return `
<section class="rpt-recipient">
  <div class="rpt-recipient-label">${escapeHtml(r.label)}</div>
  <div class="rpt-recipient-name">${escapeHtml(r.name)}</div>
  ${r.address ? `<div class="rpt-recipient-line">${escapeHtml(r.address)}</div>` : ""}
  ${r.contact ? `<div class="rpt-recipient-line">${escapeHtml(r.contact)}</div>` : ""}
  ${r.account_no ? `<div class="rpt-recipient-line mono">Account: ${escapeHtml(r.account_no)}</div>` : ""}
</section>
`;
}

function renderSummary(items: ReportSummaryItem[], currency: string): string {
  if (!items.length) return "";
  return `
<section class="rpt-summary">
  ${items.map((it) => `
    <div class="rpt-summary-cell tone-${it.tone ?? "neutral"}">
      <div class="rpt-summary-label">${escapeHtml(it.label)}</div>
      <div class="rpt-summary-value">${formatValue(it.value, it.format ?? "money", currency)}</div>
      ${it.hint ? `<div class="rpt-summary-hint">${escapeHtml(it.hint)}</div>` : ""}
    </div>
  `).join("")}
</section>
`;
}

function renderSection(s: ReportSection, currency: string): string {
  if (s.kind === "spacer") return `<div class="rpt-spacer"></div>`;
  if (s.kind === "note") {
    return `<section class="rpt-note">
      ${s.title ? `<div class="rpt-note-title">${escapeHtml(s.title)}</div>` : ""}
      <div class="rpt-note-body">${escapeHtml(s.body)}</div>
    </section>`;
  }
  if (s.kind === "kv") {
    return `<section class="rpt-kv">
      ${s.title ? `<div class="rpt-section-title">${escapeHtml(s.title)}</div>` : ""}
      <dl>${s.pairs.map((p) => `<dt>${escapeHtml(p.label)}</dt><dd>${escapeHtml(p.value)}</dd>`).join("")}</dl>
    </section>`;
  }
  /* table */
  if (s.rows.length === 0) {
    return `<section class="rpt-table-wrap">
      ${s.title ? `<div class="rpt-section-title">${escapeHtml(s.title)}</div>` : ""}
      <div class="rpt-empty">${escapeHtml(s.empty_state ?? "No rows.")}</div>
    </section>`;
  }
  const colgroup = s.columns.map((c) => `<col ${c.width ? `style="width:${c.width}"` : ""} />`).join("");
  const thead = `<thead><tr>${s.columns.map((c) => `<th class="align-${c.align ?? "left"}">${escapeHtml(c.label)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${s.rows.map((r) => renderRow(r, s.columns, currency)).join("")}</tbody>`;
  return `<section class="rpt-table-wrap">
    ${s.title ? `<div class="rpt-section-title">${escapeHtml(s.title)}</div>` : ""}
    <table class="rpt-table">
      <colgroup>${colgroup}</colgroup>
      ${thead}
      ${tbody}
    </table>
  </section>`;
}

function renderRow(r: Record<string, ReportRowValue>, columns: ReportColumn[], currency: string): string {
  return `<tr>${columns.map((c) => `<td class="align-${c.align ?? "left"} ${c.format === "money" ? "mono" : ""}">${formatValue(r[c.key], c.format ?? "text", currency)}</td>`).join("")}</tr>`;
}

function renderTotals(items: ReportTotalsItem[], currency: string): string {
  return `
<section class="rpt-totals">
  ${items.map((it) => `
    <div class="rpt-totals-row ${it.emphasized ? "is-emphasized" : ""}">
      <div class="rpt-totals-label">${escapeHtml(it.label)}</div>
      <div class="rpt-totals-value mono">${formatValue(it.value, it.format ?? "money", currency)}</div>
    </div>
  `).join("")}
</section>
`;
}

function renderNotes(notes: string[]): string {
  return `
<section class="rpt-notes">
  <div class="rpt-section-title">Notes</div>
  <ul>${notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>
</section>
`;
}

/* -------------------------------------------------------------------------
   Format helpers
   ------------------------------------------------------------------------- */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatValue(v: ReportRowValue | number | string, fmt: ValueFormat, _currency: string): string {
  if (v === null || v === undefined || v === "") return `<span class="muted">—</span>`;
  if (fmt === "money") {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return `<span class="muted">—</span>`;
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (fmt === "percent") {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return `<span class="muted">—</span>`;
    return `${n.toFixed(1)}%`;
  }
  if (fmt === "count") {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return String(v);
    return n.toLocaleString("en-US");
  }
  if (fmt === "date") {
    if (typeof v !== "string") return escapeHtml(String(v));
    return formatDate(v);
  }
  return escapeHtml(String(v));
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

/* -------------------------------------------------------------------------
   Stylesheet — Apple-level minimalism + Stripe-financial clarity
   ------------------------------------------------------------------------- */

function baseStyles(visibility: "external" | "internal"): string {
  const accent = visibility === "internal" ? "#a3175a" : "#0A0A0A";
  return `
  :root {
    --ink: #0a0a0a;
    --muted: #6b7280;
    --line: #e5e7eb;
    --soft: #f9fafb;
    --accent: ${accent};
    --positive: #047857;
    --negative: #b91c1c;
    --warning: #b45309;
  }
  * { box-sizing: border-box; }
  html, body { background: #fff; color: var(--ink); }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 11px;
    line-height: 1.5;
    margin: 0;
    padding: 0;
    -webkit-font-smoothing: antialiased;
  }
  .mono { font-family: "SFMono-Regular", "ui-monospace", Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; }
  .muted { color: var(--muted); }

  /* A4 page sizing — 25mm margins so the doc breathes. */
  @page {
    size: A4 portrait;
    margin: 18mm 16mm 22mm 16mm;
  }

  main.rpt {
    width: 100%;
    max-width: 210mm;
    margin: 0 auto;
    padding: 24px;
  }
  @media print {
    main.rpt { padding: 0; }
  }

  .rpt-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--line);
    margin-bottom: 18px;
  }
  .rpt-header-brand { display: flex; align-items: center; gap: 14px; }
  .rpt-header-brand svg { display: block; flex-shrink: 0; }
  .org-name { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
  .org-sub { font-size: 9px; color: var(--muted); letter-spacing: 0.08em; text-transform: uppercase; margin-top: 2px; }
  .rpt-header-kind {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.18em;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 999px;
    padding: 4px 10px;
  }

  .rpt-internal {
    background: #fef2f7;
    border: 1px solid #fbcfe8;
    color: #9d174d;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-align: center;
    text-transform: uppercase;
    padding: 6px 0;
    border-radius: 6px;
    margin-bottom: 14px;
  }

  .rpt-title-block { margin-bottom: 16px; }
  .rpt-title {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.01em;
    margin: 0 0 4px;
    color: var(--ink);
  }
  .rpt-subtitle { font-size: 12px; color: var(--muted); margin-bottom: 10px; }
  .rpt-meta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px 24px;
    font-size: 10px;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    padding: 8px 0;
  }
  .meta-row { display: flex; gap: 8px; }
  .meta-label { color: var(--muted); min-width: 80px; text-transform: uppercase; letter-spacing: 0.06em; font-size: 9px; }
  .meta-val { color: var(--ink); font-weight: 500; }

  .rpt-recipient {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 14px 16px;
    margin-bottom: 16px;
    background: var(--soft);
  }
  .rpt-recipient-label { font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; }
  .rpt-recipient-name { font-size: 14px; font-weight: 700; margin: 2px 0 4px; }
  .rpt-recipient-line { font-size: 10px; color: var(--muted); }

  .rpt-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 18px;
    page-break-inside: avoid;
  }
  .rpt-summary-cell {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 10px 12px;
    background: #fff;
  }
  .rpt-summary-label { font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; }
  .rpt-summary-value { font-size: 15px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .rpt-summary-hint { font-size: 9px; color: var(--muted); margin-top: 2px; }
  .tone-positive .rpt-summary-value { color: var(--positive); }
  .tone-negative .rpt-summary-value { color: var(--negative); }
  .tone-warning .rpt-summary-value { color: var(--warning); }

  .rpt-section-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink);
    margin: 14px 0 8px;
  }
  .rpt-table-wrap { margin-bottom: 14px; }
  .rpt-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
  }
  .rpt-table thead { display: table-header-group; }
  .rpt-table tbody tr { page-break-inside: avoid; }
  .rpt-table th, .rpt-table td {
    padding: 6px 8px;
    border-bottom: 1px solid var(--line);
    text-align: left;
    vertical-align: top;
  }
  .rpt-table th {
    font-size: 9px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1px solid #0a0a0a;
  }
  .align-right { text-align: right; }
  .align-center { text-align: center; }

  .rpt-totals {
    margin-top: 6px;
    border-top: 2px solid var(--ink);
    padding-top: 8px;
    page-break-inside: avoid;
  }
  .rpt-totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; }
  .rpt-totals-row.is-emphasized {
    font-size: 14px;
    font-weight: 700;
    border-top: 1px solid var(--line);
    margin-top: 6px;
    padding-top: 10px;
  }

  .rpt-notes {
    margin-top: 18px;
    border-top: 1px dashed var(--line);
    padding-top: 12px;
    font-size: 10px;
  }
  .rpt-notes ul { margin: 4px 0 0; padding-left: 18px; }
  .rpt-notes li { margin: 2px 0; color: var(--muted); }

  .rpt-footer {
    margin-top: 24px;
    padding-top: 10px;
    border-top: 1px solid var(--line);
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: var(--muted);
    letter-spacing: 0.04em;
  }

  .rpt-empty {
    border: 1px dashed var(--line);
    border-radius: 6px;
    padding: 14px;
    text-align: center;
    color: var(--muted);
    font-size: 10px;
  }
  .rpt-spacer { height: 8px; }
  `;
}
