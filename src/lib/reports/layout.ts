/* ===========================================================================
   Phase R — Layout primitives.

   Pure functions that emit HTML fragments for the document chrome:
     · documentHeader(payload)   — KOLEEX logo + company block + meta strip
     · documentFooter(payload)   — page X of Y + report ID + confidentiality
     · classificationBand(...)   — single accent line at the top of the page
     · titleBlock(...)           — report title + subtitle + classification chip
     · recipientBlock(recipient) — "To:" / "From:" + name + address + account
     · summaryGrid(items)        — 4-column label/value grid (NO cards)
     · totalsBlock(totals)       — totals stack with grand-total double rule
     · notesBlock(notes)         — terms / payment instructions
     · signatureBlock()          — placeholder area for prepared-by / approved-by

   Layout NEVER hardcodes pixels or colours — every value is read from
   design-system.ts. Layout NEVER emits a <table>; tables live in
   table.ts. The split keeps the table renderer (which has its own
   page-break logic) cleanly separated from the document chrome.
   ========================================================================== */

import { BORDER, COLOR, PAGE, SPACE, classificationFor, typeCss } from "./design-system";
import { formatDate, formatDateTime, escapeHtml, escapeAttr } from "./formatters";
import type { ReportPayload, ReportSummaryItem, ReportTotalsItem, ReportRecipient } from "./types";
import { formatValue } from "./formatters";

/* ─── KOLEEX wordmark (inline SVG) ─────────────────────────────────
   Same path data the quotation/invoice docs use. Inline so the PDF
   render doesn't depend on any external asset — every byte the
   document needs lives in the HTML it produces. */
const KOLEEX_WORDMARK = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20" viewBox="-4 -4 727.83 115.57" preserveAspectRatio="xMinYMid meet" aria-label="KOLEEX">
  <path fill="${COLOR.ink}" d="M116.59,96.3v11.05h-10.6L14.66,62.47v44.88H0V1.58h14.66v43.53L105.99,1.58h10.6v11.05L28.42,53.9l88.18,42.4Z" />
  <path fill="${COLOR.ink}" d="M242.65,71.04c0,20.07-14.21,36.54-34.28,36.54h-50.74c-20.52,0-35.18-16.01-35.18-36.54v-35.18C122.45,15.11,136.88.45,157.63.45h49.84c20.52,0,35.18,14.88,35.18,35.41v35.18ZM227.77,38.11c0-12.4-8.34-23.23-20.3-23.23h-49.84c-11.95,0-20.3,10.83-20.3,23.23v31.8c0,11.95,8.34,23,20.3,23h49.84c11.95,0,20.3-11.05,20.3-23v-31.8Z" />
  <path fill="${COLOR.ink}" d="M363.07,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54l.23-71.04h14.66v69.91c0,11.95,8.34,23,20.3,23h68.56v14.66h-.01Z" />
  <path fill="${COLOR.ink}" d="M473.8,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68Z" />
  <path fill="${COLOR.ink}" d="M585.42,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68Z" />
  <path fill="${COLOR.ink}" d="M719.83,96.3v11.05h-10.6l-48.04-42.62-48.04,42.62h-10.37v-11.05l46.91-41.72-46.91-41.95V1.58h10.37l48.04,42.62L709.23,1.58h10.6v11.05l-47.13,41.95,47.13,41.72ZM661.19,71.04l40.59,36.31h-81.19l40.59-36.31Z" />
</svg>`;

/* ─── Classification accent line ──────────────────────────────────── */

export function classificationAccent(payload: ReportPayload): string {
  const cls = classificationFor(payload.meta.visibility, payload.internal_warning ?? undefined);
  /* A 2px solid line at the very top of the document. The colour
     IS the classification signal — there is no warning band, no
     full-width red stripe, no shouting. Bank statements work this
     way: the document IS the proof. */
  return `<div style="height:2px;background:${cls.accent};margin-bottom:${SPACE.lg}px"></div>`;
}

/* ─── Document header ─────────────────────────────────────────────── */

/* Two-column header:
     left  = KOLEEX wordmark + tenant name + koleexgroup.com
     right = report number + generated datetime + period + currency

   Everything sits above a single hairline rule. Then comes the title
   block. No background tints, no cards, no boxes.
*/
export function documentHeader(payload: ReportPayload): string {
  const cls = classificationFor(payload.meta.visibility, payload.internal_warning ?? undefined);

  const metaRow = (label: string, value: string, isMono = false) => `
    <div style="display:flex;align-items:baseline;gap:${SPACE.md}px;justify-content:flex-end">
      <div style="${typeCss("metaLabel")};color:${COLOR.muted}">${escapeHtml(label)}</div>
      <div style="${typeCss("metaValue")};color:${COLOR.ink};${isMono ? `font-family:var(--rpt-mono);font-variant-numeric:tabular-nums;` : ""}">${escapeHtml(value)}</div>
    </div>
  `;

  const periodLine = payload.meta.period
    ? metaRow("Period", `${formatDate(payload.meta.period.from)} → ${formatDate(payload.meta.period.to)}`)
    : "";

  return `
<header class="rpt-header" style="
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:${SPACE.xl}px;
  padding-bottom:${SPACE.lg}px;
  border-bottom:${BORDER.hairline};
  margin-bottom:${SPACE.xl}px;
">
  <div class="rpt-header-left">
    ${KOLEEX_WORDMARK}
    <div style="${typeCss("metaLabel")};color:${COLOR.muted};margin-top:${SPACE.sm}px">${escapeHtml(payload.meta.tenant_name)}</div>
    <div style="${typeCss("caption")};color:${COLOR.muted};margin-top:2px">koleexgroup.com</div>
  </div>

  <div class="rpt-header-right" style="display:flex;flex-direction:column;gap:${SPACE.xs}px;align-items:flex-end">
    <div style="
      ${typeCss("classification")};
      color:${cls.accent};
      border:1px solid ${cls.accent};
      padding:3px 8px;
      margin-bottom:${SPACE.md}px;
    ">${escapeHtml(cls.label)}</div>
    ${metaRow("Report No",  payload.meta.report_no, true)}
    ${metaRow("Generated",  formatDateTime(payload.meta.generated_at))}
    ${periodLine}
    ${metaRow("Currency",   payload.meta.currency)}
    ${metaRow("Prepared by", payload.meta.generated_by_name)}
  </div>
</header>
`;
}

/* ─── Title block ─────────────────────────────────────────────────── */

export function titleBlock(payload: ReportPayload): string {
  return `
<section class="rpt-title-block" style="margin-bottom:${SPACE.xl}px">
  <h1 style="${typeCss("documentTitle")};color:${COLOR.ink};margin:0">${escapeHtml(payload.meta.title)}</h1>
  ${payload.meta.subtitle ? `<div style="${typeCss("body")};color:${COLOR.muted};margin-top:${SPACE.xs}px">${escapeHtml(payload.meta.subtitle)}</div>` : ""}
</section>
`;
}

/* ─── Recipient block ─────────────────────────────────────────────── */

/* "Statement For" — used on customer + supplier statements. Renders
   only when payload.recipient is present. Plain typography — no card,
   no border (the spacing is enough). */
export function recipientBlock(recipient: ReportRecipient | undefined): string {
  if (!recipient) return "";
  return `
<section class="rpt-recipient" style="margin-bottom:${SPACE.xl}px">
  <div style="${typeCss("label")};color:${COLOR.muted};margin-bottom:${SPACE.xs}px">Statement for · ${escapeHtml(recipient.label)}</div>
  <div style="${typeCss("partyName")};color:${COLOR.ink}">${escapeHtml(recipient.name)}</div>
  ${recipient.address ? `<div style="${typeCss("body")};color:${COLOR.ink2};margin-top:2px">${escapeHtml(recipient.address)}</div>` : ""}
  ${recipient.contact ? `<div style="${typeCss("body")};color:${COLOR.ink2};margin-top:2px">${escapeHtml(recipient.contact)}</div>` : ""}
  ${recipient.account_no ? `<div style="${typeCss("caption")};color:${COLOR.muted};margin-top:${SPACE.xs}px;font-family:var(--rpt-mono);font-variant-numeric:tabular-nums">Account No: ${escapeHtml(recipient.account_no)}</div>` : ""}
</section>
`;
}

/* ─── Summary grid ────────────────────────────────────────────────── */

/* Four-column grid of label/value pairs. No card, no background,
   single hairline rule above. Hierarchy is in the spacing + the
   weight of the value, not in colour. The "tone" hint from the
   builder is respected ONLY as a small modifier on the value (e.g.
   warning amounts get a soft underline) — it never paints a card. */
export function summaryGrid(items: ReportSummaryItem[], currency: string): string {
  if (!items.length) return "";

  const cell = (it: ReportSummaryItem) => {
    const valueStr = formatValue(it.value, it.format ?? "money", { /* currency unused in scalar format */ });
    const valueColor =
      it.tone === "negative" ? COLOR.ink
      : it.tone === "warning"  ? COLOR.ink
      : COLOR.ink;
    const underline = it.tone === "warning" || it.tone === "negative" ? `border-bottom:2px solid ${COLOR.ink};padding-bottom:2px;display:inline-block` : "";
    return `
      <div style="display:flex;flex-direction:column;gap:${SPACE.xs}px;padding:${SPACE.md}px ${SPACE.lg}px ${SPACE.md}px 0">
        <div style="${typeCss("label")};color:${COLOR.muted}">${escapeHtml(it.label)}</div>
        <div style="${typeCss("summaryValue")};color:${valueColor};font-family:var(--rpt-mono);font-variant-numeric:tabular-nums">
          <span style="${underline}">${escapeHtml(valueStr)}</span>
        </div>
        ${it.hint ? `<div style="${typeCss("caption")};color:${COLOR.muted}">${escapeHtml(it.hint)}</div>` : ""}
      </div>
    `;
  };

  /* Cap at 4 columns for visual rhythm; if a builder gives 5 or 6
     we wrap to the next row automatically thanks to the grid. */
  return `
<section class="rpt-summary" style="
  display:grid;
  grid-template-columns:repeat(4, minmax(0, 1fr));
  gap:0;
  border-top:${BORDER.hairline};
  border-bottom:${BORDER.hairline};
  margin-bottom:${SPACE.xl}px;
  page-break-inside:avoid;
">
  ${items.map(cell).join("")}
</section>
`;
  /* Note: deliberately ${currency} is unused here. We DO NOT append
     the currency suffix to each value — the currency lives in the
     header meta strip. Tables put it in its own column. This keeps
     decimal alignment perfect. */
  // (suppress unused warning at call site if needed)
  void currency;
}

/* ─── Totals block ────────────────────────────────────────────────── */

/* The totals stack sits below the detail table. Each line is
   "Label …………………… Amount" with a hairline top rule on the section
   and a HARD double rule above the grand total (last `emphasized`
   item or the last item if none are emphasized).

   No padding, no card, no background — just rules and type. */
export function totalsBlock(totals: ReportTotalsItem[] | undefined): string {
  if (!totals || totals.length === 0) return "";

  const lastEmphasizedIdx = (() => {
    for (let i = totals.length - 1; i >= 0; i -= 1) {
      if (totals[i].emphasized) return i;
    }
    return totals.length - 1;
  })();

  const lines = totals.map((t, i) => {
    const isGrand = i === lastEmphasizedIdx;
    const labelStyle = isGrand ? "totalLabel" : "totalLabel";
    const valueStyle = isGrand ? "grandValue" : "totalValue";
    const topRule = isGrand && i > 0 ? `border-top:${BORDER.double};padding-top:${SPACE.md}px;margin-top:${SPACE.sm}px` : "";
    const valueText = formatValue(t.value, t.format ?? "money", { zeroAsDash: false });
    return `
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:baseline;
        padding:${SPACE.xs}px 0;
        ${topRule}
      ">
        <span style="${typeCss(labelStyle)};color:${COLOR.ink}">${escapeHtml(t.label)}</span>
        <span style="${typeCss(valueStyle)};color:${COLOR.ink};font-family:var(--rpt-mono);font-variant-numeric:tabular-nums">${escapeHtml(valueText)}</span>
      </div>
    `;
  }).join("");

  return `
<section class="rpt-totals" style="
  margin-top:${SPACE.lg}px;
  margin-bottom:${SPACE.xl}px;
  border-top:${BORDER.hard};
  padding-top:${SPACE.md}px;
  page-break-inside:avoid;
">
  ${lines}
</section>
`;
}

/* ─── Notes block ─────────────────────────────────────────────────── */

export function notesBlock(notes: string[] | undefined, sectionLabel = "Notes"): string {
  if (!notes || notes.length === 0) return "";
  return `
<section class="rpt-notes" style="margin-top:${SPACE.xl}px;page-break-inside:avoid">
  <div style="${typeCss("sectionTitle")};color:${COLOR.ink};margin-bottom:${SPACE.sm}px">${escapeHtml(sectionLabel)}</div>
  <ul style="${typeCss("body")};color:${COLOR.ink2};margin:0;padding-left:${SPACE.lg}px">
    ${notes.map((n) => `<li style="margin-bottom:${SPACE.xs}px">${escapeHtml(n)}</li>`).join("")}
  </ul>
</section>
`;
}

/* ─── Signature block ─────────────────────────────────────────────── */

/* Two columns: "Prepared by" + "Approved by", each with a hairline
   rule above space for a signature. Only shown when the document is
   internal (external statements don't need an internal sign-off). */
export function signatureBlock(payload: ReportPayload): string {
  if (payload.meta.visibility !== "internal") return "";
  return `
<section class="rpt-signature" style="
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:${SPACE.xxl}px;
  margin-top:${SPACE.xxxl}px;
  page-break-inside:avoid;
">
  <div>
    <div style="border-top:${BORDER.hard};padding-top:${SPACE.sm}px">
      <div style="${typeCss("label")};color:${COLOR.muted}">Prepared by</div>
      <div style="${typeCss("body")};color:${COLOR.ink};margin-top:2px">${escapeHtml(payload.meta.generated_by_name)}</div>
      <div style="${typeCss("caption")};color:${COLOR.muted};margin-top:2px">${escapeHtml(formatDateTime(payload.meta.generated_at))}</div>
    </div>
  </div>
  <div>
    <div style="border-top:${BORDER.hard};padding-top:${SPACE.sm}px">
      <div style="${typeCss("label")};color:${COLOR.muted}">Reviewed by</div>
      <div style="${typeCss("body")};color:${COLOR.mutedSoft};margin-top:2px">—</div>
    </div>
  </div>
</section>
`;
}

/* ─── Document footer (per-page, via @page-bottom CSS) ────────────── */

/* The footer that appears at the bottom of EVERY page is emitted
   inside the printed area as a fixed element. We don't use CSS Paged
   Media `@bottom-center` because Puppeteer/Chromium support there is
   inconsistent across the chromium-min build. Instead we render the
   footer as a static block at the end of the document AND use a CSS
   running header trick in the @page rule for the page number.

   The simpler practical solution Puppeteer's pdf.format respects:
   pass `displayHeaderFooter: true` with a header/footer template. The
   document compositor invokes that — this function returns the
   inline string used as the footer template. */
export function pageFooterTemplate(payload: ReportPayload): string {
  return `
<div style="
  width:100%;
  font-family:${"Helvetica, sans-serif"};
  font-size:7pt;
  color:${COLOR.muted};
  padding:0 ${PAGE.margin.left} 0 ${PAGE.margin.left};
  display:flex;
  justify-content:space-between;
  align-items:center;
">
  <span>${escapeAttr(payload.meta.tenant_name)} · koleexgroup.com</span>
  <span>${escapeAttr(payload.meta.report_no)}</span>
  <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
</div>
`;
}

/* In-document footer that prints once after the body (acts as the
   closing block for the document; per-page footers come from the
   Puppeteer template, but we keep an in-document closing line for
   screens that don't have access to @page running headers). */
export function inlineDocumentFooter(payload: ReportPayload): string {
  const cls = classificationFor(payload.meta.visibility, payload.internal_warning ?? undefined);
  return `
<footer class="rpt-inline-footer" style="
  margin-top:${SPACE.xxxl}px;
  padding-top:${SPACE.md}px;
  border-top:${BORDER.hairline};
  display:flex;
  justify-content:space-between;
  align-items:baseline;
  ${typeCss("caption")};
  color:${COLOR.muted};
">
  <span>${escapeHtml(payload.meta.tenant_name)} · koleexgroup.com</span>
  <span style="font-family:var(--rpt-mono);font-variant-numeric:tabular-nums">${escapeHtml(payload.meta.report_no)}</span>
  <span>${escapeHtml(cls.label)}</span>
</footer>
`;
}
