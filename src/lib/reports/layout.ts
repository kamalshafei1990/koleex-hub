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
import type {
  ReportPayload,
  ReportSummaryItem,
  ReportTotalsItem,
  ReportRecipient,
  SignatureSlot,
  SignatureRole,
  VerificationBlock,
} from "./types";
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
     left  = KOLEEX wordmark + tenant name + corporate-identity block
             (entity line + address / contact / website)
     right = formal metadata strip (report id · generated · period ·
             currency · prepared by · classification chip)

   Everything sits above a single hairline rule. Then comes the title
   block. No background tints, no cards, no boxes — Big-4 document
   discipline, not dashboard chrome.

   The header repeats only on cover + page 1 of the body; subsequent
   pages get the slimmer per-page running header via Puppeteer's
   displayHeaderFooter mechanism (see pageHeaderTemplate). */
export function documentHeader(payload: ReportPayload): string {
  const cls = classificationFor(payload.meta.visibility, payload.internal_warning ?? undefined);

  /* Refined metaRow: end-justified, hairline divider between rows so
     the column reads like a banking statement masthead. */
  const metaRow = (label: string, value: string, isMono = false) => `
    <div style="
      display:flex;
      align-items:baseline;
      gap:${SPACE.md}px;
      justify-content:flex-end;
      padding:2px 0;
    ">
      <div style="${typeCss("metaLabel")};color:${COLOR.muted}">${escapeHtml(label)}</div>
      <div style="${typeCss("metaValue")};color:${COLOR.ink};${isMono ? `font-family:var(--rpt-mono);font-variant-numeric:tabular-nums;` : ""}">${escapeHtml(value)}</div>
    </div>
  `;

  const periodLine = payload.meta.period
    ? metaRow("Period", `${formatDate(payload.meta.period.from)} → ${formatDate(payload.meta.period.to)}`)
    : "";

  /* Corporate-identity block beneath the wordmark. Tenant name in
     bold body weight, then a stack of address/website/email — light
     muted captions that read like the masthead of a real corporate
     letterhead. The current tenant table only stores `name`, so we
     hard-code the public corporate identity for the Hub instance;
     when per-tenant address/email become available we'll lift them
     into payload.meta. */
  const identityLines = corporateIdentityLines(payload.meta.tenant_name);

  return `
<header class="rpt-header avoid-break" style="
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:${SPACE.xl}px;
  padding-bottom:${SPACE.lg}px;
  border-bottom:${BORDER.hairline};
  margin-bottom:${SPACE.xl}px;
">
  <div class="rpt-header-left" style="max-width:60%">
    ${KOLEEX_WORDMARK}
    <div style="${typeCss("partyName")};color:${COLOR.ink};margin-top:${SPACE.sm}px">${escapeHtml(payload.meta.tenant_name)}</div>
    ${identityLines.map((l) => `<div style="${typeCss("caption")};color:${COLOR.muted};margin-top:2px">${escapeHtml(l)}</div>`).join("")}
  </div>

  <div class="rpt-header-right" style="display:flex;flex-direction:column;gap:0;align-items:flex-end;min-width:38%">
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

/* Corporate-identity lines printed under the wordmark. Today this
   is hardcoded for the KOLEEX Hub tenant; when per-tenant address /
   contact data is added to the tenants table we will read it out
   of the payload. The function is a single line to swap out later. */
function corporateIdentityLines(tenantName: string): string[] {
  /* Keep this compact — masthead, not a phone book. */
  const isKoleex = tenantName.toLowerCase().includes("koleex");
  if (isKoleex) {
    return [
      "KOLEEX International Corporation Taizhou Co., Ltd.",
      "Taizhou, Zhejiang, China",
      "finance@koleexgroup.com  ·  koleexgroup.com",
    ];
  }
  return [tenantName, "koleexgroup.com"];
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

/* Phase R.3 — formal signature architecture. Renderer draws a
   labelled signature line and a date line for each slot. If the
   builder doesn't pass `signatures`, we synthesise the standard set
   per visibility:
     · external  → Prepared by only
     · internal  → Prepared / Reviewed / Approved
     · executive → Prepared / Reviewed / Approved / Audited
   No upload + storage in R.3 — this is the labelled empty box ready
   for ink. The optional stamp slot below the grid is for an inked
   corporate stamp.
*/
const DEFAULT_LABEL: Record<SignatureRole, string> = {
  prepared_by:  "Prepared by",
  reviewed_by:  "Reviewed by",
  approved_by:  "Approved by",
  audited_by:   "Audited by",
};

function defaultSignaturesFor(payload: ReportPayload): SignatureSlot[] {
  if (payload.meta.visibility === "external") {
    return [
      { role: "prepared_by", name: payload.meta.generated_by_name, date: payload.meta.generated_at },
    ];
  }
  /* Internal — incl. EXECUTIVE — gets the full sign-off chain. */
  const isExecutive = (payload.internal_warning ?? "").toLowerCase().includes("executive");
  return [
    { role: "prepared_by", name: payload.meta.generated_by_name, date: payload.meta.generated_at },
    { role: "reviewed_by", name: null, date: null },
    { role: "approved_by", name: null, date: null },
    ...(isExecutive ? [{ role: "audited_by" as const, name: null, date: null }] : []),
  ];
}

export function signatureBlock(payload: ReportPayload): string {
  const slots = payload.signatures && payload.signatures.length > 0
    ? payload.signatures
    : defaultSignaturesFor(payload);
  if (slots.length === 0) return "";

  /* Grid auto-sizes to slot count so 1-4 slots all look balanced. */
  const cols = Math.min(slots.length, 4);

  const cell = (s: SignatureSlot) => {
    const label = s.label ?? DEFAULT_LABEL[s.role];
    const name = s.name ?? "";
    const dateStr = s.date ? formatDateTime(s.date) : "";
    return `
      <div class="avoid-break">
        <div style="${typeCss("label")};color:${COLOR.muted}">${escapeHtml(label)}</div>
        <div style="
          height:36px;
          border-bottom:${BORDER.hard};
          margin-top:${SPACE.lg}px;
          display:flex;
          align-items:flex-end;
          ${typeCss("body")};
          color:${COLOR.ink};
        ">${escapeHtml(name)}</div>
        <div style="display:flex;justify-content:space-between;margin-top:${SPACE.xs}px;${typeCss("caption")};color:${COLOR.muted}">
          <span>Signature</span>
          <span style="font-family:var(--rpt-mono);font-variant-numeric:tabular-nums">${escapeHtml(dateStr)}</span>
        </div>
      </div>
    `;
  };

  /* Stamp slot — small dashed-rule box labelled "Official stamp",
     printed only on internal docs (external statements rely on the
     letterhead). */
  const stamp = payload.meta.visibility === "internal" ? `
    <div class="avoid-break" style="margin-top:${SPACE.xl}px;display:flex;justify-content:flex-end">
      <div style="
        width:120px;
        height:80px;
        border:1px dashed ${COLOR.hairline};
        display:flex;
        align-items:center;
        justify-content:center;
        ${typeCss("caption")};
        color:${COLOR.mutedSoft};
        letter-spacing:0.12em;
        text-transform:uppercase;
      ">Official stamp</div>
    </div>
  ` : "";

  return `
<section class="rpt-signature section-safe" style="
  margin-top:${SPACE.xxxl}px;
  page-break-inside:avoid;
">
  <div style="
    display:grid;
    grid-template-columns:repeat(${cols}, minmax(0, 1fr));
    gap:${SPACE.xxl}px;
  ">
    ${slots.map(cell).join("")}
  </div>
  ${stamp}
</section>
`;
}

/* ─── QR verification placeholder ─────────────────────────────────── */

/* Phase R.3 architecture — no QR generator wired yet, just the
   labelled placeholder block ready for a future "scan to verify".
   Renders ONLY when payload.verification is set; the renderer treats
   absence as "feature off". */
export function verificationBlock(v: VerificationBlock | undefined, payload: ReportPayload): string {
  if (!v) return "";
  const url = v.verification_url ?? `koleexgroup.com/verify/${payload.meta.report_no}`;
  const token = v.token ?? payload.meta.report_no;
  const caption = v.caption ?? "Scan to verify document authenticity";
  return `
<section class="rpt-verification avoid-break" style="
  margin-top:${SPACE.xxxl}px;
  padding-top:${SPACE.md}px;
  border-top:${BORDER.hairline};
  display:flex;
  align-items:flex-start;
  gap:${SPACE.lg}px;
  page-break-inside:avoid;
">
  <div style="
    width:90px;
    height:90px;
    border:1px solid ${COLOR.hairline};
    display:flex;
    align-items:center;
    justify-content:center;
    ${typeCss("caption")};
    color:${COLOR.mutedSoft};
    letter-spacing:0.06em;
    text-align:center;
    line-height:1.25;
  ">QR<br/>placeholder</div>
  <div>
    <div style="${typeCss("label")};color:${COLOR.muted}">Verification</div>
    <div style="${typeCss("body")};color:${COLOR.ink};margin-top:2px">${escapeHtml(caption)}</div>
    <div style="${typeCss("caption")};color:${COLOR.muted};margin-top:${SPACE.xs}px">URL: <span style="font-family:var(--rpt-mono)">${escapeHtml(url)}</span></div>
    <div style="${typeCss("caption")};color:${COLOR.muted};margin-top:2px">Token: <span style="font-family:var(--rpt-mono);font-variant-numeric:tabular-nums">${escapeHtml(token)}</span></div>
  </div>
</section>
`;
}

/* ─── Cover page (Executive Summary) ──────────────────────────────── */

/* Phase R.3 — board-room cover sheet for the Executive Finance
   Summary. Layout:
     · KOLEEX wordmark + tenant identity (smaller than body header)
     · Title + reporting period
     · Executive classification chip
     · 4-tile headline KPI grid
     · Top 3 risks
     · 2-3 sentence narrative
     · "Page 2 →" hint at the foot

   Cover page sits in its own A4 sheet via `page-break-after: always`
   so the regular header re-renders cleanly on page 2. */
export function coverPage(payload: ReportPayload): string {
  const cover = payload.cover;
  if (!cover) return "";
  const cls = classificationFor(payload.meta.visibility, payload.internal_warning ?? undefined);

  const tile = (it: ReportSummaryItem) => {
    const valueStr = formatValue(it.value, it.format ?? "money");
    return `
      <div style="padding:${SPACE.xl}px 0;border-bottom:${BORDER.hairline}">
        <div style="${typeCss("label")};color:${COLOR.muted}">${escapeHtml(it.label)}</div>
        <div style="
          ${typeCss("documentTitle")};
          color:${COLOR.ink};
          margin-top:${SPACE.sm}px;
          font-family:var(--rpt-mono);
          font-variant-numeric:tabular-nums;
        ">${escapeHtml(valueStr)}</div>
        ${it.hint ? `<div style="${typeCss("caption")};color:${COLOR.muted};margin-top:2px">${escapeHtml(it.hint)}</div>` : ""}
      </div>
    `;
  };

  const periodLine = payload.meta.period
    ? `${formatDate(payload.meta.period.from)}  →  ${formatDate(payload.meta.period.to)}`
    : "";

  return `
<section class="rpt-cover" style="
  page-break-after:always;
  min-height:calc(297mm - ${PAGE.margin.top} - ${PAGE.margin.bottom});
  display:flex;
  flex-direction:column;
  justify-content:space-between;
">
  <div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:${SPACE.xl}px;border-bottom:${BORDER.hairline}">
      <div>
        ${KOLEEX_WORDMARK}
        <div style="${typeCss("partyName")};color:${COLOR.ink};margin-top:${SPACE.md}px">${escapeHtml(payload.meta.tenant_name)}</div>
        <div style="${typeCss("caption")};color:${COLOR.muted};margin-top:2px">koleexgroup.com</div>
      </div>
      <div style="
        ${typeCss("classification")};
        color:${cls.accent};
        border:1px solid ${cls.accent};
        padding:3px 8px;
      ">${escapeHtml(cls.label)}</div>
    </div>

    <div style="margin-top:${SPACE.xxxl}px">
      <div style="${typeCss("label")};color:${COLOR.muted}">Executive Briefing</div>
      <h1 style="${typeCss("documentTitle")};color:${COLOR.ink};margin:${SPACE.sm}px 0 ${SPACE.xs}px;font-size:34pt">${escapeHtml(payload.meta.title)}</h1>
      <div style="${typeCss("body")};color:${COLOR.muted}">${escapeHtml(periodLine)}</div>
    </div>

    <div style="
      margin-top:${SPACE.xxxl}px;
      display:grid;
      grid-template-columns:repeat(2, minmax(0, 1fr));
      gap:0 ${SPACE.xxxl}px;
      border-top:${BORDER.hard};
    ">
      ${cover.headline.slice(0, 4).map(tile).join("")}
    </div>

    ${cover.top_risks && cover.top_risks.length > 0 ? `
      <div style="margin-top:${SPACE.xxxl}px" class="avoid-break">
        <div style="${typeCss("sectionTitle")};color:${COLOR.ink};margin-bottom:${SPACE.md}px">Top Risks</div>
        <ol style="margin:0;padding-left:${SPACE.xl}px;${typeCss("body")};color:${COLOR.ink2}">
          ${cover.top_risks.slice(0, 3).map((r) => `<li style="margin-bottom:${SPACE.xs}px">${escapeHtml(r)}</li>`).join("")}
        </ol>
      </div>
    ` : ""}

    ${cover.narrative ? `
      <div style="margin-top:${SPACE.xl}px;${typeCss("body")};color:${COLOR.ink2};max-width:62ch" class="avoid-break">
        ${escapeHtml(cover.narrative)}
      </div>
    ` : ""}
  </div>

  <div style="
    display:flex;
    justify-content:space-between;
    align-items:baseline;
    border-top:${BORDER.hairline};
    padding-top:${SPACE.md}px;
    ${typeCss("caption")};
    color:${COLOR.muted};
  ">
    <span>${escapeHtml(payload.meta.tenant_name)} · ${escapeHtml(payload.meta.report_no)}</span>
    <span>Detail report follows →</span>
  </div>
</section>
`;
  /* Keep `SignatureRole` re-export shape stable for callers. */
  void ({} as SignatureRole);
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
  const cls = classificationFor(payload.meta.visibility, payload.internal_warning ?? undefined);
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
  -webkit-print-color-adjust:exact;
">
  <span>${escapeAttr(payload.meta.tenant_name)} · koleexgroup.com</span>
  <span style="text-transform:uppercase;letter-spacing:0.10em">${escapeAttr(cls.label)}</span>
  <span>${escapeAttr(payload.meta.report_no)} · Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
</div>
`;
}

/* Empty header template — keeps the top margin clean (the in-doc
   header sits inside the body on page 1; subsequent pages don't need
   a running header strip because the classification + report id are
   in the footer). Puppeteer requires *something* in headerTemplate
   when displayHeaderFooter is true, so we return a single empty div. */
export function pageHeaderTemplate(): string {
  return `<div></div>`;
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
