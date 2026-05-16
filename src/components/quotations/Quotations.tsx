"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import QuotationIcon from "@/components/icons/QuotationIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import PrintIcon from "@/components/icons/ui/PrintIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import DownloadIcon from "@/components/icons/ui/DownloadIcon";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PaperPlaneIcon from "@/components/icons/ui/PaperPlaneIcon";
import { useTranslation } from "@/lib/i18n";
import { docsT } from "@/lib/translations/docs";
import { dialog } from "@/lib/ui-dialog";
import QuotationA4Preview from "./QuotationA4Preview";
import ProductPickerModal, { type PickResult } from "./ProductPickerModal";
import CustomerPickerModal, { type CustomerPickResult } from "./CustomerPickerModal";
import { useMeBootstrap } from "@/lib/me-bootstrap";
import {
  QUOTATIONS_SYNC,
  fetchDocList,
  fetchDocOne,
  upsertDoc,
  deleteDoc,
  convertQuotationToInvoice,
  type RemoteDocRow,
} from "@/lib/docs-sync";

/* ══════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════ */

interface QuotationItem {
  description: string;
  model: string;
  image: string;
  unitPrice: number;
  qty: number;
  notes: string;
}

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

/** Every transition the UI's status menu allows. "expired" is mostly
 *  derived (validTill < today) but we also let the operator force-set
 *  it manually for quotes that never had a hard expiry on them. */
export const QUOTE_STATUS_OPTIONS: { value: QuoteStatus; label: string }[] = [
  { value: "draft",    label: "Draft" },
  { value: "sent",     label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired",  label: "Expired" },
];

export interface Quotation {
  id: string;
  customerName: string;
  companyName: string;
  invoiceNo: string;
  date: string;
  clientNo: string;
  validTill: string;
  /* Legacy free-form field — superseded by toAddress / toAcid /
     toEmail but kept on the type for older saved docs. */
  quotTo: string;
  toAddress?: string;
  toAcid?: string;
  toPhone?: string;
  toMobile?: string;
  toEmail?: string;
  toWebsite?: string;
  items: QuotationItem[];
  tax: number;
  shipping: number;
  others: number;
  terms: string;
  /* Optional stamp + signature URLs stamped on this quote. Both
     stored as public Supabase Storage URLs. The doc-builder lets a
     super-admin attach the tenant's saved stamp/signature with one
     click (see /api/quotations/saved-assets). Older quotes have
     these undefined; the editor falls back to the dashed-placeholder
     in that case. */
  stampUrl?: string;
  signatureUrl?: string;
  /* Contact-table id of the linked CRM customer. The editor's
     "Link Customer" picker stores this when the user picks from
     the CRM; the QUOTATION TO fields below are auto-filled at the
     same time. Optional — historic quotes have this undefined. */
  customerContactId?: string;
  /* Master-data references for the Terms quick-fill row. The
     editor's quick-fill picks store the FK id here so a saved
     quote can be re-opened with the dropdowns pre-selected; the
     formatted text is also baked into `terms` for the printed doc.
     All optional — legacy quotes have these undefined. */
  paymentTermId?: string;
  incotermId?: string;
  /* Picked Incoterm's short code (FOB, CIF, DDP, ...). Stored
     alongside incotermId so the items-table header can show the
     'UNIT PRICE (FOB Ningbo, USD)' subtitle without fetching the
     full Incoterm row. */
  incotermCode?: string;
  /* DEPRECATED — kept for back-compat with quotes saved before the
     port-pair split. Newer docs use loadingPort + dischargePort. */
  incotermLocation?: string;
  /* Shipment route — loading port (origin) and discharge port
     (destination). Free-text so the operator can include the
     country ('Ningbo, China' / 'Alexandria, Egypt'). Both can be
     blank; whichever is set drives the Loading port: / Discharge
     port: lines in the terms. */
  loadingPort?: string;
  dischargePort?: string;
  shippingMethodId?: string;
  /* Shipping marks pick — three standard options in international
     trade. 'As per buyer's instruction' is the most common (buyer
     supplies exact marks before shipment). */
  shippingMarks?: string;
  /* Cargo + legal fields surfaced as structured rows in the Terms
     card. Quick Fill writes here, doc renders the value next to the
     matching bold label. Optional — historic quotes have these
     undefined. */
  containerType?: string;
  bankCharges?: string;
  cancellationPolicy?: string;
  governingLaw?: string;
  documentsProvided?: string[];        // array of short_name labels
  /* Global discount as a percentage (0-100). Applied to
     (subtotal + tax + shipping + others) on the totals card —
     reduces the Grand Total live. Stored as a number, not a
     fraction; 5 means 5%. */
  discountPct?: number;
  /* Timing block — Lead Time + auto-computed ETD/ETA. The picker
     writes 'Lead time: 30 days after receipt of deposit' + an ETD/
     ETA chip into the terms. The basis is one of 'after_deposit',
     'after_order', 'after_lc_opening'; the picker dropdown maps it
     to readable text. */
  leadTimeDays?: number;
  leadTimeBasis?: "after_deposit" | "after_order" | "after_lc_opening";
  /* Lifecycle:
       draft     — being edited internally; not yet customer-facing.
       sent      — emailed / handed over to the customer.
       accepted  — customer signed off on it (the deal is on).
       rejected  — customer declined.
       expired   — validity date passed without a decision.

     "final" is a legacy alias for "sent" — older rows in the DB use
     it; fromRow() maps them forward. New transitions always use the
     new vocabulary. */
  status: QuoteStatus;
  /* Audit trail of state changes. Optional — historic quotes have
     this missing. Each entry is { status, at, by? } where `at` is
     an ISO timestamp and `by` is the account id that performed the
     change. Used by the editor's status menu to show "Sent on …",
     "Accepted on …" and (later) by a forthcoming activity feed. */
  statusHistory?: { status: QuoteStatus; at: string; by?: string }[];
  createdAt: string;
  updatedAt: string;
  /* Server-side grand total from the quotations.total column. The
     list endpoint strips items from the doc payload to keep responses
     small, so a local recomputation from items always returns 0 for
     rows fetched in the list view. Use this for the per-row badge
     and the TOTAL VALUE KPI tile. Undefined for unsaved drafts. */
  serverTotal?: number;
}

/* ══════════════════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════════════════ */

const STORAGE_KEY = "koleex.quotations.v1";
const COUNTER_KEY = "koleex.quotations.counter";

/* Default terms shell for a fresh quotation. Each labelled row is
   its own <div> with a dashed bottom border so the rows visually
   separate from one another and read as a tidy checklist. Quick
   Fill picks land on the matching row; manual edits work inline.
   Order is by negotiation priority — payment first, then price
   formula, then route, then logistics, then cargo specs, then
   admin / legal. The trailing <div> is the free-text 'additional
   notes' area. */
const TERMS_ROW_STYLE =
  `border-bottom: 1px dashed rgba(0,0,0,0.12); padding: 3px 0; min-height: 22px;`;
const TERMS_NOTES_STYLE = `padding: 6px 0; min-height: 28px;`;
const DEFAULT_TERMS =
  `<div style="${TERMS_ROW_STYLE}"><strong>Payment terms:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Price Type:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Loading port:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Discharge port:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Sent by:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Container type:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Lead time:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Delivery time:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Shipping marks:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Packing:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Country of Origin:</strong> Made in China</div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Net Weight:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Gross Weight:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>CBM:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Number of Packages:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Documents Provided:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>All prices include tax:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Bank Charges:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Cancellation Policy:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Governing Law:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Total Qty:</strong> </div>` +
  `<div style="${TERMS_NOTES_STYLE}"><br></div>`;

const EMPTY_ITEM: QuotationItem = {
  description: "",
  model: "",
  image: "",
  unitPrice: 0,
  qty: 1,
  notes: "",
};

/* ══════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════ */

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayDDMMYYYY(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function addDays(dateStr: string, days: number): string {
  const parts = dateStr.split("/");
  if (parts.length !== 3) return dateStr;
  const d = new Date(+parts[2], +parts[1] - 1, +parts[0]);
  d.setDate(d.getDate() + days);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Map a server row back into the Quotation shape the UI uses. The
 * server treats `doc` as an opaque JSON blob — that's our UI snapshot.
 */
export function fromRow(row: RemoteDocRow): Quotation {
  const doc = row.doc as Partial<Quotation>;
  return {
    id: row.id,
    customerName: doc.customerName ?? "",
    companyName: doc.companyName ?? "",
    invoiceNo: (row.quote_no as string | null) ?? doc.invoiceNo ?? "",
    date: doc.date ?? todayDDMMYYYY(),
    clientNo: doc.clientNo ?? "",
    validTill: doc.validTill ?? addDays(todayDDMMYYYY(), 30),
    quotTo: doc.quotTo ?? "",
    toAddress: doc.toAddress ?? "",
    toAcid: doc.toAcid ?? "",
    toPhone: doc.toPhone ?? "",
    toMobile: doc.toMobile ?? "",
    toEmail: doc.toEmail ?? "",
    toWebsite: doc.toWebsite ?? "",
    items: Array.isArray(doc.items) && doc.items.length > 0 ? doc.items : [{ ...EMPTY_ITEM }],
    tax: Number(doc.tax ?? 0),
    shipping: Number(doc.shipping ?? 0),
    others: Number(doc.others ?? 0),
    terms: doc.terms ?? DEFAULT_TERMS,
    stampUrl: doc.stampUrl,
    signatureUrl: doc.signatureUrl,
    customerContactId: doc.customerContactId,
    paymentTermId: doc.paymentTermId,
    incotermId: doc.incotermId,
    incotermCode: doc.incotermCode,
    incotermLocation: doc.incotermLocation,
    loadingPort: doc.loadingPort,
    dischargePort: doc.dischargePort,
    shippingMethodId: doc.shippingMethodId,
    shippingMarks: doc.shippingMarks,
    containerType: doc.containerType,
    bankCharges: doc.bankCharges,
    cancellationPolicy: doc.cancellationPolicy,
    governingLaw: doc.governingLaw,
    documentsProvided: Array.isArray(doc.documentsProvided) ? doc.documentsProvided : undefined,
    discountPct: typeof doc.discountPct === "number" ? doc.discountPct : undefined,
    leadTimeDays: doc.leadTimeDays,
    leadTimeBasis: doc.leadTimeBasis,
    /* Status normalisation. "final" is the legacy name for "sent" —
       rows minted before the workflow expansion stored it that way.
       Anything else unknown falls back to "draft" so the row at
       least opens; the editor can then move it through the new
       lifecycle. */
    status: ((): QuoteStatus => {
      const s = row.status as string | null;
      if (s === "final") return "sent";
      if (
        s === "draft" || s === "sent" || s === "accepted" ||
        s === "rejected" || s === "expired"
      ) return s;
      return "draft";
    })(),
    statusHistory: Array.isArray(doc.statusHistory)
      ? (doc.statusHistory as Quotation["statusHistory"])
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    serverTotal: typeof row.total === "number" ? row.total : (row.total != null ? Number(row.total) : undefined),
  };
}

/** Compute the grand total the same way the UI renders it. Mirrors the
 *  GRAND TOTAL row so the list can show totals without re-rendering.
 *  Order of operations:
 *    (subtotal + tax + shipping + others)  → pre-discount base
 *    base * (1 - discountPct/100)          → after-discount grand total
 *  This matches industry practice: the discount applies to the whole
 *  bill, not just the line items. */
function computeGrandTotal(q: Quotation): number {
  const subtotal = q.items.reduce((s, i) => s + (Number(i.unitPrice) || 0) * (Number(i.qty) || 0), 0);
  const base = subtotal + (Number(q.tax) || 0) + (Number(q.shipping) || 0) + (Number(q.others) || 0);
  const pct = Math.max(0, Math.min(100, Number(q.discountPct) || 0));
  return +(base * (1 - pct / 100)).toFixed(2);
}

/** Parse a DD/MM/YYYY (or DD-MM-YYYY) string into ISO. Best-effort. */
function ddmmyyyyToISO(s: string): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

async function loadQuotationsRemote(opts: { fresh?: boolean } = {}): Promise<Quotation[]> {
  const rows = await fetchDocList(QUOTATIONS_SYNC, opts);
  return rows.map(fromRow);
}

/** Upsert a single quotation. Returns the server echo (canonical
 *  id + updatedAt) so the UI can reconcile optimistic state. */
async function saveQuotationRemote(q: Quotation): Promise<Quotation | null> {
  const row = await upsertDoc(QUOTATIONS_SYNC, {
    id: q.id.length === 36 ? q.id : undefined, // if it's our old local hex id, let server mint a new UUID
    quote_no: q.invoiceNo || undefined,
    status: q.status,
    currency: "USD",
    issue_date: ddmmyyyyToISO(q.date),
    valid_till: ddmmyyyyToISO(q.validTill),
    total: computeGrandTotal(q),
    doc: q, // stash the whole UI snapshot
  });
  return row ? fromRow(row) : null;
}

async function deleteQuotationRemote(id: string): Promise<boolean> {
  // Skip server call if the id isn't a real UUID (local-only legacy row).
  if (id.length !== 36) return true;
  return deleteDoc(QUOTATIONS_SYNC, id);
}

/* Smart money formatter. Drops the trailing '.00' when the value is
   a round number ('285' instead of '285.00') but preserves the
   decimals when there are real cents ('301,460.20'). Thousands
   separators are kept. The '$' suffix is appended at the call site
   so non-monetary callers (qty, days) can still use this for the
   number-only formatting. */
function fmt(n: number): string {
  const fixed = n.toFixed(2);
  const hasCents = !fixed.endsWith(".00");
  return n.toLocaleString("en-US", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = document.createElement("img");
      img.onload = () => {
        const MAX_W = 300;
        let w = img.width;
        let h = img.height;
        if (w > MAX_W) {
          h = (h * MAX_W) / w;
          w = MAX_W;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No canvas context"));
          return;
        }
        // Paint the canvas WHITE before drawing. The output format
        // is JPEG (which has no alpha channel) — without this fill
        // any transparent pixels in the source PNG get flattened to
        // BLACK on the canvas → JPEG conversion. Product photos are
        // commonly PNGs with transparent backgrounds, so the bug
        // shows up as a black halo / fill behind every uploaded
        // photo on the Quotation document.
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function numberToWords(num: number): string {
  if (!num || num === 0) return "ZERO USD ONLY";
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const scales = ["", "Thousand", "Million", "Billion"];
  const n = Math.floor(Math.abs(num));
  if (n === 0) return "ZERO USD ONLY";
  function chunk(c: number): string {
    if (c === 0) return "";
    if (c < 20) return ones[c];
    if (c < 100)
      return tens[Math.floor(c / 10)] + (c % 10 ? " " + ones[c % 10] : "");
    return (
      ones[Math.floor(c / 100)] +
      " Hundred" +
      (c % 100 ? " " + chunk(c % 100) : "")
    );
  }
  let str = "",
    s = 0,
    rem = n;
  while (rem > 0) {
    const c = rem % 1000;
    if (c > 0) {
      str =
        chunk(c) +
        (scales[s] ? " " + scales[s] : "") +
        (str ? " " + str : "");
    }
    rem = Math.floor(rem / 1000);
    s++;
  }
  const cents = Math.round((Math.abs(num) - n) * 100);
  let result = str.trim() + " USD";
  if (cents > 0) result += " AND " + chunk(cents) + " CENTS";
  result += " ONLY";
  return result.toUpperCase();
}

/* ══════════════════════════════════════════════════════════
   PRINT + A4 STYLES
   ══════════════════════════════════════════════════════════ */

const PRINT_AND_DOC_STYLES = `
/* ── A4 document base ── */
/* On-screen styling for the A4 page. Print sizing is handled
   exclusively by @media print below — DO NOT set height here, only
   min-height (so screen view fills A4 height but print pipeline can
   override cleanly via !important without competing with inline). */
.quot-a4-doc {
  box-sizing: border-box;
  width: 210mm;
  min-height: 297mm;
  padding: 32px 32px 24px;
  background: #fff;
  color: #000;
  margin: 0 auto 40px;
  box-shadow: 0 0 16px rgba(0,0,0,0.10);
  overflow: visible;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  font-size: 11px;
  line-height: 1.4;
}
.quot-doc-inner { padding: 0; }

/* Force black text on white for all children */
/* Set a sensible default text colour on the A4 surface, but do NOT
   use a wildcard !important rule here — the multi-page editor relies
   on inline color styles for every black-strip header (meta strip,
   From / Quotation To, stamp / signature, bank bar, totals) and a
   wildcard !important would obliterate them. */
.quot-a4-doc { color: #000; }
.quot-a4-doc .pq-stamp-box { color: #aaa !important; }
.quot-a4-doc .pq-footer { color: #555 !important; }
.quot-a4-doc .pq-strip-gray { color: #333 !important; }
.quot-a4-doc input,
.quot-a4-doc textarea {
  color: #000 !important;
  -webkit-text-fill-color: #000 !important;
  opacity: 1 !important;
}
.quot-a4-doc input::placeholder,
.quot-a4-doc textarea::placeholder {
  color: #aaa !important;
  -webkit-text-fill-color: #aaa !important;
}
/* Internal-notes panel lives OUTSIDE the printed A4 paper in the
   dark editor area, so its textarea needs WHITE text instead of
   the black-on-white forced above. Same exemption for its
   placeholder so the hint reads as light gray on dark. */
.quot-a4-doc .quot-row-notes textarea {
  color: rgba(255, 255, 255, 0.92) !important;
  -webkit-text-fill-color: rgba(255, 255, 255, 0.92) !important;
}
.quot-a4-doc .quot-row-notes textarea::placeholder {
  color: rgba(255, 255, 255, 0.40) !important;
  -webkit-text-fill-color: rgba(255, 255, 255, 0.40) !important;
}
.quot-a4-doc .pq-grand input {
  color: #fff !important;
  -webkit-text-fill-color: #fff !important;
}

/* Shared input */
.pq-in,
.quot-a4-doc input,
.quot-a4-doc input[type="text"],
.quot-a4-doc input[type="number"],
.quot-a4-doc input[type="date"] {
  border: none;
  padding: 0;
  font-size: 11px !important;
  font-family: inherit;
  color: #000;
  width: 100%;
  background: transparent;
  outline: none;
}
.pq-in::placeholder { color: #aaa; }
.pq-in:focus { background: #f4f6ff; }

/* Cell wrap (contentEditable) */
.pq-cell-wrap {
  min-height: 16px;
  width: 100%;
  font-size: 11px;
  font-family: inherit;
  color: #000;
  outline: none;
  line-height: 1.4;
  padding: 0;
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  word-break: break-word;
}
.pq-cell-wrap:empty::before {
  content: attr(data-placeholder);
  color: #aaa;
  pointer-events: none;
}
.pq-cell-wrap:focus { background: #f4f6ff; border-radius: 2px; }

/* Rich text item cell */
.quot-item-rich {
  min-height: 32px;
  width: 100%;
  font-size: 11px;
  font-family: inherit;
  color: #000;
  outline: none;
  line-height: 1.5;
  padding: 2px 0;
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  word-break: break-word;
  max-width: 100%;
}
.quot-item-rich:empty::before {
  content: attr(data-placeholder);
  color: #aaa;
  pointer-events: none;
}
.quot-item-rich:focus { background: #f4f6ff; border-radius: 2px; }

/* Image cell */
.quot-img-cell {
  width: 100%;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed #ccc;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  background: #fafafa;
}
.quot-img-cell:hover { border-color: #888; }
.quot-img-cell img { width: 100%; height: 100%; object-fit: contain; }
.quot-img-cell .quot-img-plus { font-size: 18px; color: #bbb; }
.quot-img-cell input[type="file"] {
  position: absolute;
  top: -9999px;
  left: -9999px;
  width: 0;
  height: 0;
  overflow: hidden;
}
.quot-img-cell.has-img { border: none; background: transparent; }

/* The row-action cluster (.quot-row-del-btn) is now positioned and
   styled inline by QuotationA4Preview — no screen styles here. The
   print rule below still hides it on the printed page; the screen
   rule is intentionally omitted so it doesn't clobber the new inline
   width / height / transform. */

/* Hide number spinners */
.quot-a4-doc input[type="number"]::-webkit-outer-spin-button,
.quot-a4-doc input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.quot-a4-doc input[type="number"] { -moz-appearance: textfield; }

/* Textarea in quotation-to */
.pq-in-area {
  resize: vertical;
  min-height: 40px;
  font-size: 11px;
  line-height: 1.5;
}

/* Terms area */
.pq-tc-area {
  width: 100%;
  font-size: 11px;
  font-weight: 400;
  line-height: 1.6;
  border: none;
  padding: 8px 10px;
  font-family: inherit;
  min-height: 80px;
  outline: none;
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
}
.pq-tc-area:focus { background: #f8f8ff; }

/* ── PRINT ──
   Strategy (rewritten — the previous visibility:hidden +
   position:absolute combo collapsed the multi-page document into
   2 print pages because absolutely-positioned content doesn't
   paginate across sheets):

   1. Hide chrome with DISPLAY:NONE so it occupies zero space:
        · <header>, <aside>  → MainHeader + Sidebar
        · .fixed              → FloatingPanel
        · .no-print           → editor toolbar
   2. Reset the Hub layout wrappers (pt-14, shell-content-offset,
      min-h-screen) so the .quot-a4-stack flows from the top of
      the page with no leftover header offset / scrollable shell.
   3. Each .quot-a4-doc is a normal in-flow A4 page with a hard
      page-break-after — Chrome / Safari / Firefox honour that
      because the parent is no longer position:absolute.
   4. @page { size: A4; margin: 0 } so the browser doesn't add
      print gutters that would shrink the usable width below the
      doc's 210 mm and force a scale-to-fit. */
@media print {
  /* Page setup — A4, zero browser margin (the doc has its own
     32 px / 24 px padding). */
  @page { size: A4 portrait; margin: 0; }

  /* Reset page chrome */
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    overflow: visible !important;
    height: auto !important;
    width: auto !important;
  }

  /* Hide every known piece of Hub chrome that should NOT print. */
  header, aside, .no-print, .fixed { display: none !important; }
  .quot-row-del-btn { display: none !important; }
  .pq-add-btn { display: none !important; }

  /* NUKE the Tailwind h-screen / overflow-hidden wrappers from
     the Hub shell so the multi-page doc stack can render its
     full height without being clipped to one viewport. Scoped
     to those specific wrappers -- we previously used a *
     wildcard that also blanketed every descendant of the docs
     with overflow:visible and max-height:none, which made
     Safari compute the doc's intrinsic content height and
     reserve TWO A4 sheets per doc (one with content, one
     blank). The targeted Tailwind reset achieves the same
     unblock without touching the docs themselves. */
  [class*="h-screen"],
  [class*="h-[calc"],
  [class*="min-h-screen"],
  [class*="min-h-0"],
  [class*="overflow-hidden"] {
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
  }
  [class~="pt-14"] { padding-top: 0 !important; }
  .shell-content-offset { padding: 0 !important; }

  /* Stack flows naturally — NO position:absolute. */
  .quot-a4-stack {
    margin: 0 !important;
    padding: 0 !important;
    width: 210mm !important;
    overflow: visible !important;
  }

  /* Every page sized to fit the SMALLER of A4 (297 mm) and US Letter
     (279 mm). Picking US-Letter-safe dimensions (275 mm tall) means
     the doc never overflows regardless of which paper size the
     printer driver defaults to. On A4 paper the bottom 22 mm will
     just be white space — acceptable trade-off vs the phantom-blank-
     page-between-every-real-page bug that hits when the doc is
     sized for A4 but printed to US Letter.

     On-screen view unaffected (inline style stays at 297 mm — only
     the print pipeline uses 275 mm). */
  /* Doc height = 268 mm. Carefully chosen:
     · US Letter printable area: ~265-270 mm depending on the
       printer driver's hairline.
     · A4 printable area: ~280 mm.
     · 268 mm fits inside US Letter's printable region without
       overflow (so no blank-after-every-page bug) AND uses enough
       of the sheet that pages 7-8 don't have huge unused white
       space at the bottom.

     Use page-break-AFTER (not -before) on every doc except the
     last one. -after on each doc forces the next doc to start on
     a fresh sheet; the :last-child exception keeps the print job
     from emitting a trailing blank sheet after the final doc.
     Without an explicit page-break the browser was natural-
     stacking the docs, and Safari (16+) sometimes drew the next
     doc as a "second page" of the previous doc -- producing the
     every-other-page-blank pattern reported in operator print
     screenshots. */
  .quot-a4-doc {
    box-sizing: border-box !important;
    display: block !important;
    position: static !important;
    width: 210mm !important;
    height: 268mm !important;
    min-height: 268mm !important;
    max-height: 268mm !important;
    margin: 0 !important;
    padding: 24px 28px 18px !important;
    box-shadow: none !important;
    border: none !important;
    background: #fff !important;
    overflow: hidden !important;
    page-break-after: always !important;
    break-after: page !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .quot-a4-doc:last-child {
    page-break-after: auto !important;
    break-after: auto !important;
  }

  /* Items table — never split a single row across sheets and
     never split the header / footer. The page already fits its
     items inside one A4 height, but these guards prevent edge
     cases where a row's image makes it slightly taller than
     expected. */
  .pq-tbl,
  .pq-tbl tr,
  .pq-tbl thead,
  .pq-tbl tfoot,
  .pq-tbl thead tr,
  .pq-tbl tfoot tr {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  input, textarea, [contenteditable] {
    background: transparent !important;
    border: transparent !important;
  }

  .pq-ml { background: #000 !important; color: #fff !important; }
  .pq-tbl thead th { background: #000 !important; color: #fff !important; }
  .pq-bank-bar { background: #000 !important; color: #fff !important; }
  .pq-terms-label { background: #000 !important; color: #fff !important; }
  .pq-to-label { background: #000 !important; color: #fff !important; }
  .pq-grand td { background: #000 !important; color: #fff !important; }
  .pq-strip-black { background: #000 !important; color: #fff !important; }
  .pq-strip-black * { color: #fff !important; }
  .pq-strip-gray { background: #e0e0e0 !important; color: #333 !important; }
  .pq-tfoot-row td { background: #f5f5f5 !important; }
  .pq-bl { background: #f5f5f5 !important; }
  /* Force the items-table header strip + tfoot summary row to
     keep their dark backgrounds when printed (Chrome and Safari
     otherwise strip backgrounds on print). */
  .pq-tbl thead th,
  .pq-tbl tfoot td {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
/* Force all browsers to print exact colors so the black header
   strips don't drop to white. */
.quot-a4-doc, .quot-a4-doc * {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
`;

/* ══════════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════════ */

export default function Quotations() {
  const { t } = useTranslation(docsT);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [view, setView] = useState<"list" | "editor">("list");
  const [current, setCurrent] = useState<Quotation | null>(null);
  const [loaded, setLoaded] = useState(false);
  /* Save state for the Save Draft / Save Final buttons. "idle" is the
     resting state; "saving" while the POST is in flight; "saved" for a
     brief confirmation flash; "error" if the request failed. Without
     this, the buttons gave NO visual feedback — users couldn't tell
     whether a click was registered or whether the save succeeded. */
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string>("");
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  /* "+ From catalog" picker. Owned by the parent so the modal can
     stay mounted across A4-page renders without each page mounting
     its own copy. */
  const [pickerOpen, setPickerOpen] = useState(false);
  /* "Link customer" picker — same pattern as the product picker:
     parent owns the modal, the preview triggers it via prop. */
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  /* Tenant-wide saved stamp + signature. Loaded once on editor
     mount; refreshed after the operator uploads a new one so the
     "Use saved" button appears immediately. Null until the fetch
     resolves so the editor doesn't flash a "missing saved asset"
     state during initial load. */
  const [savedStampUrl, setSavedStampUrl] = useState<string | null>(null);
  const [savedSignatureUrl, setSavedSignatureUrl] = useState<string | null>(null);
  /* Read the super-admin flag straight from the /api/me/bootstrap
     cache rather than useScopeContext. The latter has a fallback
     path that re-queries the `accounts` table via the browser anon
     client, which RLS strips to is_super_admin=false; the bootstrap
     payload comes from a server route that already knows the truth. */
  const { data: meBootstrap } = useMeBootstrap();
  const isSuperAdmin = meBootstrap?.auth?.is_super_admin ?? false;

  /* ── Load from Supabase on mount ── */
  useEffect(() => {
    let cancelled = false;
    loadQuotationsRemote().then((list) => {
      if (!cancelled) {
        setQuotations(list);
        setLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  /* ── Create new quotation. Kept as optimistic local-only until the
        user hits Save; the server mints the real UUID + quote_no at
        that point. This keeps "New" instant even on slow connections. */
  const handleNew = useCallback(() => {
    const today = todayDDMMYYYY();
    const q: Quotation = {
      id: generateId(),          // temp; replaced by UUID on first save
      customerName: "",
      companyName: "",
      invoiceNo: "",             // server assigns when first saved
      date: today,
      clientNo: "",
      validTill: addDays(today, 30),
      quotTo: "",
      toAddress: "",
      toAcid: "",
      toPhone: "",
      toMobile: "",
      toEmail: "",
      toWebsite: "",
      items: [{ ...EMPTY_ITEM }],
      tax: 0,
      shipping: 0,
      others: 0,
      terms: DEFAULT_TERMS,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCurrent(q);
    setView("editor");
  }, []);

  /* ── Open existing ──
     The list endpoint strips `items` from the doc payload to keep the
     response small, so the row coming from the list view has no items.
     Re-fetch the full quotation by id before mounting the editor —
     otherwise the items table renders as a single empty placeholder. */
  const handleOpen = useCallback(async (q: Quotation) => {
    // Optimistic mount so the editor opens immediately with header data…
    setCurrent({ ...q, items: q.items.map((i) => ({ ...i })) });
    setView("editor");
    // …then hydrate the full doc (with items) from the detail endpoint.
    if (q.id.length === 36) {
      const requestedId = q.id;
      const full = await fetchDocOne(QUOTATIONS_SYNC, q.id);
      /* Guard against a late response overwriting a NEWER open.
         If the operator clicked row A then quickly clicked row B,
         A's fetch can resolve after B's setCurrent — without this
         check the editor would silently revert to A's data. */
      if (full) {
        const hydrated = fromRow(full);
        setCurrent((prev) => {
          if (prev?.id && prev.id !== requestedId) return prev;
          return { ...hydrated, items: hydrated.items.map((i) => ({ ...i })) };
        });
      }
    }
  }, []);

  /* ── Delete from list ── */
  /* Track which row's Duplicate button is in flight so the icon can
     show a small spinner. The full-quote fetch + save round-trip on a
     long quote (Omar's 50+ items) can take a second on a slow link;
     without feedback the user double-clicks and ends up with two
     copies. */
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  /* ── Duplicate from the list view ──
     The list endpoint strips `items` from the doc to keep the
     response small, so we MUST re-fetch the full quote before
     cloning. Then we build a fresh draft (new client id, empty
     quote_no so the server mints a new KL{YYYY}-{MMDD}, today's
     date, 30-day validity), save it, refresh the list, and drop
     the user into the editor on the new copy so they can adjust
     customer fields straight away. */
  const handleDuplicateFromList = useCallback(
    async (id: string) => {
      if (duplicatingId) return;
      setDuplicatingId(id);
      try {
        const full = await fetchDocOne(QUOTATIONS_SYNC, id);
        if (!full) {
          alert("Could not load the quotation to duplicate.");
          return;
        }
        const source = fromRow(full);
        const today = todayDDMMYYYY();
        const copy: Quotation = {
          ...source,
          id: generateId(),
          invoiceNo: "",
          date: today,
          validTill: addDays(today, 30),
          status: "draft",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          serverTotal: undefined,
          items: source.items.map((it) => ({ ...it })),
        };
        const saved = await saveQuotationRemote(copy);
        const next = saved ?? copy;
        const list = await loadQuotationsRemote({ fresh: true });
        setQuotations(list);
        /* Open the new draft in the editor — the operator almost
           always wants to tweak the customer name / address right
           after duplicating, so the extra click would be friction. */
        setCurrent(next);
        setView("editor");
      } catch (e) {
        alert(`Duplicate failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setDuplicatingId(null);
      }
    },
    [duplicatingId],
  );

  const handleDeleteFromList = useCallback(
    async (id: string) => {
      if (!(await dialog.confirm({ message: t("quot.deleteConfirm"), destructive: true, confirmLabel: "Delete" }))) return;
      // Optimistic: remove from local state immediately so the user
      // sees the row disappear even if the browser HTTP cache is still
      // holding the pre-delete list.
      setQuotations((prev) => prev.filter((q) => q.id !== id));
      await deleteQuotationRemote(id);
      // `fresh: true` bypasses both the in-memory and browser HTTP
      // cache so the reconciliation read reflects the post-delete state.
      const list = await loadQuotationsRemote({ fresh: true });
      setQuotations(list);
    },
    [t]
  );

  /* ── Delete current (from editor) ── */
  const handleDeleteCurrent = useCallback(async () => {
    if (!current) return;
    if (!(await dialog.confirm({ message: t("quot.deleteConfirm"), destructive: true, confirmLabel: "Delete" }))) return;
    const id = current.id;
    setQuotations((prev) => prev.filter((q) => q.id !== id));
    setCurrent(null);
    setView("list");
    await deleteQuotationRemote(id);
    const list = await loadQuotationsRemote({ fresh: true });
    setQuotations(list);
  }, [current, t]);

  /* ── Save current ──
     The status parameter is overloaded: callers passing "final" want
     legacy "save as final" semantics (now mapped to "sent"). Everyone
     else passes a current QuoteStatus — usually "draft" — and we
     persist it as-is. The statusHistory audit log only grows when the
     status actually changes; idle saves don't pollute it with
     duplicate "draft" rows. */
  const handleSave = useCallback(
    async (status: QuoteStatus | "final") => {
      if (!current) return;
      setSaveState("saving");
      setSaveError("");
      const nextStatus: QuoteStatus = status === "final" ? "sent" : status;
      const history = current.statusHistory ?? [];
      const last = history[history.length - 1];
      const isTransition = !last || last.status !== nextStatus;
      const intent: Quotation = {
        ...current,
        status: nextStatus,
        statusHistory: isTransition
          ? [...history, { status: nextStatus, at: new Date().toISOString() }]
          : history,
        updatedAt: new Date().toISOString(),
      };
      try {
        const saved = await saveQuotationRemote(intent);
        if (saved) {
          setCurrent(saved);
          const list = await loadQuotationsRemote({ fresh: true });
          setQuotations(list);
          setSaveState("saved");
          // Reset the "Saved ✓" flash after 2.5 s so the button returns
          // to its idle label.
          setTimeout(() => setSaveState("idle"), 2500);
        } else {
          // saveQuotationRemote returns null when the POST returned non-OK.
          // upsertDoc swallows the error so we have no detail; surface a
          // generic message and keep the editor unchanged.
          setSaveState("error");
          setSaveError("Save failed — server returned an error.");
          setTimeout(() => setSaveState("idle"), 4000);
        }
      } catch (e) {
        setSaveState("error");
        setSaveError(e instanceof Error ? e.message : String(e));
        setTimeout(() => setSaveState("idle"), 4000);
      }
    },
    [current]
  );

  /* ── Convert current to invoice. Uses the server-side helper which
        clones the doc JSON + mints a fresh INV<year>-NNNN number, then
        takes the user straight to the Invoices app. ── */
  const handleConvertToInvoice = useCallback(async () => {
    if (!current) return;
    // Make sure latest edits are on the server first.
    if (current.id.length !== 36 || current.status === "draft") {
      await handleSave("final");
    }
    const saved = await loadQuotationsRemote();
    const match = saved.find(
      (q) => q.invoiceNo === current.invoiceNo || q.id === current.id,
    );
    const quotationId = match?.id ?? current.id;
    if (quotationId.length !== 36) {
      alert(t("alert.saveFirstConvert"));
      return;
    }
    const invoice = await convertQuotationToInvoice(quotationId);
    if (invoice) {
      window.location.href = "/invoices";
    }
  }, [current, handleSave]);

  /* ── Print ── */
  const handlePrint = useCallback(() => {
    if (!current) return;
    const prev = document.title;
    document.title = `${current.customerName} - ${current.companyName} - ${current.invoiceNo}`;
    /* Use `afterprint` to restore the title; Safari's window.print()
       is non-blocking, so the previous synchronous restore was
       sometimes running BEFORE the print dialog read the title --
       resulting in the default app name appearing in the saved
       PDF filename. The listener fires once and removes itself. */
    const restore = () => {
      document.title = prev;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  }, [current]);

  /* "saving" | "loading" state during the brief moment between click
     and the new window receiving focus. Used to disable the button
     so a frantic double-click doesn't open two print dialogs. */
  const [pdfState, setPdfState] = useState<"idle" | "loading" | "error">("idle");

  /* ── Export PDF ──
     Opens /quotations/<id>/print?auto=1 in a new window. That page
     renders the same A4 layout the server-side Puppeteer pipeline
     uses (210×297 mm, page-break-after each doc) and auto-fires
     window.print() once every image decodes. The operator picks
     "Save as PDF" in the native dialog.

     Why not the server-side /api/quotations/<id>/pdf route any
     more: Vercel cold-start on the Puppeteer function regularly
     ran ~30 s and occasionally hit the 60 s wall, leaving the
     user staring at "Rendering…" with no feedback. The new-window
     route is instant on every device, has no function-timeout
     failure mode, and produces an identical-quality PDF because
     the heavy lifting (the A4-fitted print page) is exactly the
     same. The /api/...pdf endpoint stays in the codebase for a
     future "email this quote" feature where we genuinely need a
     server-rendered buffer to attach. */
  const handleExportPdf = useCallback(async () => {
    if (!current) return;
    /* The operator asked for the "old" behaviour: trigger the
       browser's native print dialog on THIS window (no popup, no
       new tab). The editor's @media print CSS already hides every
       piece of Hub chrome, so the printed PDF looks identical to
       the standalone /print page. We save first so the printed
       doc reflects the latest edits, then set a friendly title
       (browsers use it as the default PDF filename), then call
       window.print(). The title is restored on afterprint. */
    setPdfState("loading");
    try {
      if (current.id.length !== 36 || current.status === "draft") {
        await handleSave("draft");
      }
      const prev = document.title;
      document.title = `${current.customerName} - ${current.companyName} - ${current.invoiceNo}`;
      const restore = () => {
        document.title = prev;
        window.removeEventListener("afterprint", restore);
      };
      window.addEventListener("afterprint", restore);
      setPdfState("idle");
      /* Small defer so React has flushed the loading-state UI
         repaint before the browser captures the print snapshot. */
      requestAnimationFrame(() => window.print());
    } catch (e) {
      setPdfState("error");
      alert(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
      setTimeout(() => setPdfState("idle"), 2_000);
    }
  }, [current, handleSave]);

  /* ── Send by email ──
     Opens a print window so the operator can "Save as PDF" the
     attachment, AND fires a mailto: with To/Subject/Body pre-
     filled from the quote. We deliberately don't try to attach
     the PDF programmatically — mailto can't carry binary
     attachments and rigging up a real SMTP path means adding
     Resend / SendGrid + an env-var dance. The two-window flow
     (print tab + Mail composer) gives a near-one-click experience
     on every platform without that infrastructure.

     Marks the quote as Sent on the way out so the status pill +
     audit log reflect the action. Skips that side-effect if the
     quote is already past Sent (Accepted / Rejected). */
  const handleSendEmail = useCallback(async () => {
    if (!current) return;
    const to = (current.toEmail || "").trim();
    if (!to) {
      alert("Add the customer's email in the QUOTATION TO card before sending.");
      return;
    }
    /* Same popup-blocker workaround as handleExportPdf: open the
       print window NOW (inside the click's user-gesture stack)
       and navigate it to the real URL once the save/refetch
       resolves. window.open() called after async awaits is
       silently blocked by every modern browser. */
    const win = window.open("about:blank", "_blank", "noopener,noreferrer");
    if (!win) {
      alert("The browser blocked the print window. Please allow popups for this site and try again.");
      return;
    }
    try {
      /* Save first so the print window pulls the latest doc. */
      const targetStatus: QuoteStatus =
        current.status === "accepted" ||
        current.status === "rejected" ||
        current.status === "expired"
          ? current.status
          : "sent";
      if (current.id.length !== 36 || current.status !== targetStatus) {
        await handleSave(targetStatus);
      }
      const refreshed = await loadQuotationsRemote({ fresh: true });
      const match = refreshed.find(
        (q) => q.id === current.id || q.invoiceNo === current.invoiceNo,
      );
      const quotationId = match?.id ?? current.id;
      if (quotationId.length !== 36) {
        win.close();
        alert("Please save the quotation before sending.");
        return;
      }

      /* Build a friendly cover-email skeleton. The operator can
         tweak it in their mail client before pressing send. */
      const greetingName = current.customerName?.trim() || "there";
      const grandTotalNum =
        current.serverTotal != null && current.serverTotal > 0
          ? current.serverTotal
          : computeGrandTotal(current);
      const subject = `Quotation ${current.invoiceNo || "from Koleex"}${
        current.companyName ? ` — ${current.companyName}` : ""
      }`;
      const body = [
        `Dear ${greetingName},`,
        "",
        `Please find attached our quotation ${current.invoiceNo || ""} ` +
          `for your review. The total amount is US$ ${fmt(grandTotalNum)}, ` +
          `valid until ${current.validTill || "the date noted on the quote"}.`,
        "",
        "We're happy to discuss any of the items, prices, or delivery terms — just reply to this email or give us a call.",
        "",
        "Best regards,",
        "Koleex Group",
      ].join("\n");

      /* Navigate the already-opened print window to the real URL
         (we opened a blank tab earlier inside the user gesture). */
      const printUrl = `/quotations/${encodeURIComponent(quotationId)}/print?auto=1`;
      win.location.href = printUrl;

      /* Fire the mailto on a small delay so the print window grabs
         focus first — otherwise some OS mail handlers steal it
         immediately and the print-as-PDF dialog never opens. */
      setTimeout(() => {
        const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
          subject,
        )}&body=${encodeURIComponent(body)}`;
        window.location.href = mailto;
      }, 600);
    } catch (e) {
      try { win.close(); } catch { /* already closed */ }
      alert(`Send failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [current, handleSave]);

  /* ── Duplicate ──
     Clones the current quote into a fresh draft and drops the user
     straight into the editor. The new draft gets:
       · A brand-new client-side id so React treats it as a new row.
       · An empty invoiceNo so the server mints a fresh
         KL{YYYY}-{MMDD} (date-based) number on first save.
       · Today's date as the new issue date + a 30-day validity.
       · Deep-cloned items so edits on the copy don't bleed back
         into the source quote's state. */
  const handleDuplicate = useCallback(() => {
    if (!current) return;
    const today = todayDDMMYYYY();
    const copy: Quotation = {
      ...current,
      id: generateId(),
      invoiceNo: "",
      date: today,
      validTill: addDays(today, 30),
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      serverTotal: undefined,
      items: current.items.map((it) => ({ ...it })),
    };
    setCurrent(copy);
    setView("editor");
  }, [current]);

  /* ── Item helpers ── */
  const updateItem = useCallback(
    (idx: number, field: keyof QuotationItem, value: string | number) => {
      if (!current) return;
      const items = current.items.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item
      );
      setCurrent({ ...current, items });
    },
    [current]
  );

  const addItem = useCallback(() => {
    if (!current) return;
    setCurrent({ ...current, items: [...current.items, { ...EMPTY_ITEM }] });
  }, [current]);

  /* Apply a CRM customer pick to the QUOTATION TO card. Fills the
     editor's company / contact / phone / mobile / email / website
     fields and stores customerContactId in the doc so we can show
     a "Linked" indicator on reload. Doesn't touch the legacy
     schema-level customer_id FK (that targets a different table) —
     just keeps the link in the doc payload. */
  const applyCustomerPick = useCallback(
    (pick: CustomerPickResult) => {
      if (!current) return;
      setCurrent({
        ...current,
        customerContactId: pick.id,
        customerName: pick.displayName || current.customerName,
        companyName: pick.companyName || current.companyName,
        toAddress: pick.address || current.toAddress,
        toPhone: pick.phone || current.toPhone,
        toMobile: pick.mobile || current.toMobile,
        toEmail: pick.email || current.toEmail,
        toWebsite: pick.website || current.toWebsite,
      });
    },
    [current],
  );

  /* Append a new item pre-filled from the catalog picker. If the
     bottom-most row is still completely blank (typical right after
     a "+ Add row"), replace it instead of appending — keeps the
     items list tidy when the user clicks "From catalog" first. */
  const addItemFromCatalog = useCallback(
    (pick: PickResult) => {
      if (!current) return;
      const fresh: QuotationItem = {
        ...EMPTY_ITEM,
        description: pick.description,
        model: pick.model,
        image: pick.imageUrl,
        unitPrice: pick.unitPrice,
        qty: 1,
      };
      const items = current.items.slice();
      const last = items[items.length - 1];
      const lastIsEmpty =
        last &&
        !last.description &&
        !last.model &&
        !last.image &&
        !last.unitPrice &&
        last.qty === 1;
      if (lastIsEmpty) items[items.length - 1] = fresh;
      else items.push(fresh);
      setCurrent({ ...current, items });
    },
    [current],
  );

  /* ── Stamp + Signature handlers ──
     The editor renders the stamp/signature cards on the last page.
     A super-admin can either (a) attach the tenant's saved asset
     with one click or (b) upload a new file (the API replaces the
     saved asset AND returns the URL we stamp on this quote). All
     four flows are gated client-side on isSuperAdmin AND server-
     side on auth.is_super_admin so the UI gate is a hint, not the
     security perimeter. */
  useEffect(() => {
    if (view !== "editor") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/quotations/saved-assets", {
          credentials: "include",
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          stampUrl: string | null;
          signatureUrl: string | null;
        };
        if (cancelled) return;
        setSavedStampUrl(json.stampUrl);
        setSavedSignatureUrl(json.signatureUrl);
      } catch { /* non-fatal — buttons just degrade to upload-only */ }
    })();
    return () => { cancelled = true; };
  }, [view, current?.id]);

  const attachSavedStamp = useCallback(() => {
    if (!current || !savedStampUrl) return;
    setCurrent({ ...current, stampUrl: savedStampUrl });
  }, [current, savedStampUrl]);
  const attachSavedSignature = useCallback(() => {
    if (!current || !savedSignatureUrl) return;
    setCurrent({ ...current, signatureUrl: savedSignatureUrl });
  }, [current, savedSignatureUrl]);
  const clearStamp = useCallback(() => {
    if (!current) return;
    setCurrent({ ...current, stampUrl: undefined });
  }, [current]);
  const clearSignature = useCallback(() => {
    if (!current) return;
    setCurrent({ ...current, signatureUrl: undefined });
  }, [current]);

  const uploadAsset = useCallback(
    async (kind: "stamp" | "signature", file: File) => {
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", file);
      try {
        const res = await fetch("/api/quotations/saved-assets", {
          method: "POST",
          credentials: "include",
          body: form,
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          alert(`Upload failed: ${j.error ?? res.status}`);
          return;
        }
        const json = (await res.json()) as { kind: string; url: string };
        if (kind === "stamp") {
          setSavedStampUrl(json.url);
          if (current) setCurrent({ ...current, stampUrl: json.url });
        } else {
          setSavedSignatureUrl(json.url);
          if (current) setCurrent({ ...current, signatureUrl: json.url });
        }
      } catch (e) {
        alert(`Upload failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [current],
  );

  const removeItem = useCallback(
    (idx: number) => {
      if (!current || current.items.length <= 1) return;
      setCurrent({
        ...current,
        items: current.items.filter((_, i) => i !== idx),
      });
    },
    [current]
  );

  /* Reorder a row up/down by one slot. Caps at the array bounds so
     callers don't have to bounds-check before firing. */
  const moveItem = useCallback(
    (idx: number, direction: -1 | 1) => {
      if (!current) return;
      const target = idx + direction;
      if (target < 0 || target >= current.items.length) return;
      const next = current.items.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      setCurrent({ ...current, items: next });
    },
    [current]
  );

  const handleImageUpload = useCallback(
    async (idx: number, file: File) => {
      try {
        const base64 = await compressImage(file);
        updateItem(idx, "image", base64);
      } catch (e) {
        console.error("Image compression failed", e);
      }
    },
    [updateItem]
  );

  /* ── Computed totals ──
     Pre-discount base = subtotal + tax + shipping + others
     Grand total       = base * (1 - discountPct/100)
     Discount is a global, whole-bill reduction applied last. */
  /* Number-coerce because legacy rows (saved before fromRow's
     Number() coercion) can carry strings in unitPrice / qty; a
     string concatenation would produce "01.5" etc. and break
     the editor totals + the printed PDF. */
  const subTotal = current
    ? current.items.reduce(
        (s, i) => s + (Number(i.unitPrice) || 0) * (Number(i.qty) || 0),
        0,
      )
    : 0;
  const grandTotal = current
    ? (() => {
        const base = subTotal + current.tax + current.shipping + current.others;
        const pct = Math.max(0, Math.min(100, Number(current.discountPct) || 0));
        return +(base * (1 - pct / 100)).toFixed(2);
      })()
    : 0;

  /* ── Sorted list ── */
  const sortedQuotations = [...quotations].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading...</div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     LIST VIEW
     ══════════════════════════════════════════════════════════ */
  if (view === "list") {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <style>{PRINT_AND_DOC_STYLES}</style>

        {/* Top bar */}
        <div className="max-w-[1500px] mx-auto px-4 pt-6 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <Link href="/" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
                <ArrowLeftIcon className="h-4 w-4" />
              </Link>
              <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
                <QuotationIcon size={16} />
              </div>
              <div className="flex items-center gap-2.5 min-w-0">
                <h1 className="text-xl md:text-[22px] font-bold tracking-tight">
                  {t("quot.title")}
                </h1>
                <p className="text-[12px] text-[var(--text-dim)]">
                  {quotations.length} {quotations.length === 1 ? t("quot.singular") : t("quot.plural")}
                </p>
              </div>
            </div>
            <button
              onClick={handleNew}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--bg-inverted)] hover:opacity-90 text-[var(--text-inverted)] rounded-xl text-sm font-medium transition active:scale-95"
            >
              <PlusIcon size={18} />
              {t("quot.new")}
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="max-w-[1500px] mx-auto px-4 pt-4">
          {(() => {
            const drafts = quotations.filter((q) => q.status === "draft").length;
            const sent = quotations.filter((q) => q.status === "sent").length;
            const accepted = quotations.filter((q) => q.status === "accepted").length;
            /* Prefer the server-side total column. The list payload
               has items stripped, so a local recomputation would
               give 0 for every saved quotation. */
            const total = quotations.reduce((s, q) => {
              const tt = q.serverTotal != null && q.serverTotal > 0 ? q.serverTotal : computeGrandTotal(q);
              return s + tt;
            }, 0);
            const now = new Date();
            const soon = new Date(now); soon.setDate(now.getDate() + 7);
            const expiringSoon = quotations.filter((q) => {
              if (q.status !== "sent") return false;
              const iso = ddmmyyyyToISO(q.validTill);
              if (!iso) return false;
              const d = new Date(iso);
              return d >= now && d <= soon;
            }).length;
            return (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard label={t("kpi.total")} value={String(quotations.length)} accent="text-blue-400" />
                <KpiCard label={t("kpi.drafts")} value={String(drafts)} accent="text-amber-400" />
                <KpiCard label="SENT" value={String(sent)} accent="text-sky-400" />
                <KpiCard label="ACCEPTED" value={String(accepted)} accent="text-emerald-400" />
                <KpiCard
                  label={t("kpi.totalValue")}
                  value={fmt(total)}
                  accent="text-[var(--text-primary)]"
                  sub={expiringSoon > 0 ? t("kpi.expiringSoon").replace("{n}", String(expiringSoon)) : undefined}
                />
              </div>
            );
          })()}
        </div>

        {/* List */}
        <div className="max-w-[1500px] mx-auto px-4 py-6">
          {sortedQuotations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-500">
              <DocumentIcon size={48} className="mb-4 opacity-40" />
              <p className="text-lg font-medium">{t("quot.none")}</p>
              <p className="text-sm mt-1">
                {t("quot.createFirst")}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {sortedQuotations.map((q) => {
                /* The list endpoint strips items from the doc payload
                   to keep responses small, so recomputing here gives 0.
                   Prefer the server-side `serverTotal` (the row's total
                   column). Fall back to local compute for unsaved
                   drafts where serverTotal hasn't been set yet. */
                const computed = q.items.reduce(
                  (s, i) => s + i.unitPrice * i.qty,
                  0
                ) + q.tax + q.shipping + q.others;
                const gt = q.serverTotal != null && q.serverTotal > 0 ? q.serverTotal : computed;
                return (
                  <div
                    key={q.id}
                    className="bg-[var(--bg-secondary)] border border-white/[0.06] rounded-xl p-4 sm:p-5 hover:border-white/[0.12] transition cursor-pointer group"
                    onClick={() => handleOpen(q)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1.5">
                          <span className="text-sm font-mono text-emerald-400 font-semibold">
                            {q.invoiceNo}
                          </span>
                          <span
                            className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                              q.status === "accepted"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : q.status === "sent"
                                  ? "bg-sky-500/15 text-sky-400"
                                  : q.status === "rejected"
                                    ? "bg-red-500/15 text-red-400"
                                    : q.status === "expired"
                                      ? "bg-zinc-500/15 text-zinc-400"
                                      : "bg-yellow-500/15 text-yellow-400"
                            }`}
                          >
                            {q.status}
                          </span>
                        </div>
                        <p className="text-[var(--text-primary)] font-medium truncate">
                          {q.customerName || t("list.unnamedCustomer")}
                          {q.companyName ? ` - ${q.companyName}` : ""}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {q.date}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-semibold text-[var(--text-primary)] tabular-nums">
                          ${fmt(gt)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateFromList(q.id);
                          }}
                          disabled={duplicatingId === q.id}
                          className="p-2 rounded-lg text-gray-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition opacity-0 group-hover:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Duplicate this quotation as a new draft"
                        >
                          {duplicatingId === q.id ? (
                            <SpinnerIcon className="h-4 w-4 animate-spin" />
                          ) : (
                            <CopyIcon size={16} />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFromList(q.id);
                          }}
                          className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100"
                          title={t("list.delete")}
                        >
                          <TrashIcon size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     EDITOR VIEW
     ══════════════════════════════════════════════════════════ */
  if (!current) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <style>{PRINT_AND_DOC_STYLES}</style>

      {/* ── Toolbar (dark bar above A4) ── */}
      <div
        className="no-print"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          background: "#111",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => setView("list")}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-300 hover:text-[var(--text-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-inverted)]/[0.1] rounded-lg transition"
        >
          <ArrowLeftIcon size={15} />
          {t("btn.back")}
        </button>
        <div style={{ flex: 1 }} />
        {/* Clickable status pill — opens a menu of transitions. The
            colour map mirrors the list-view row badge so the same
            quote reads the same in both views. */}
        <StatusMenu
          status={current.status}
          onChange={async (next) => {
            if (next === current.status) return;
            /* Transition + save in one round-trip. We reuse
               handleSave because it appends to statusHistory and
               updates updatedAt — duplicating that logic would
               drift over time. */
            await handleSave(next);
          }}
        />
        {/* Save state pill — gives the user explicit feedback that
            the save click was registered and what happened. Without
            this, both Save buttons did their network call silently
            and the user couldn't tell if anything was happening. */}
        {saveState !== "idle" && (
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full ${
              saveState === "saving" ? "bg-blue-500/15 text-blue-300"
              : saveState === "saved" ? "bg-green-500/20 text-green-300"
              : "bg-red-500/20 text-red-300"
            }`}
            title={saveError || undefined}
          >
            {saveState === "saving" && "Saving…"}
            {saveState === "saved" && "✓ Saved"}
            {saveState === "error" && "✕ Save failed"}
          </span>
        )}
        <button
          onClick={() => handleSave("draft")}
          disabled={saveState === "saving"}
          className="px-4 py-2 text-sm text-gray-300 bg-[var(--bg-surface)] hover:bg-[var(--bg-inverted)]/[0.1] rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saveState === "saving" ? "Saving…" : t("btn.saveDraft")}
        </button>
        <button
          onClick={() => handleSave("final")}
          disabled={saveState === "saving"}
          className="px-4 py-2 text-sm bg-[var(--bg-inverted)] hover:opacity-90 text-[var(--text-inverted)] rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saveState === "saving" ? "Saving…" : t("btn.saveFinal")}
        </button>
        <button
          onClick={handleDuplicate}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-300 bg-[var(--bg-surface)] hover:bg-[var(--bg-inverted)]/[0.1] rounded-lg transition"
          title="Clone this quote into a new draft (fresh number, today's date)."
        >
          <CopyIcon size={14} />
          Duplicate
        </button>
        <button
          onClick={handleConvertToInvoice}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-300 bg-[var(--bg-surface)] hover:bg-[var(--bg-inverted)]/[0.1] rounded-lg transition"
          title={t("tip.convert")}
        >
          <DocumentIcon size={14} />
          {t("btn.convertToInvoice")}
        </button>
        <button
          onClick={handleExportPdf}
          disabled={pdfState === "loading"}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-300 bg-[var(--bg-surface)] hover:bg-[var(--bg-inverted)]/[0.1] rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          title="Open the browser print dialog and pick 'Save as PDF'."
        >
          <DownloadIcon size={14} />
          {pdfState === "loading" ? "Opening…" : t("btn.exportPDF")}
        </button>
        <button
          onClick={handleSendEmail}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-300 bg-[var(--bg-surface)] hover:bg-[var(--bg-inverted)]/[0.1] rounded-lg transition"
          title="Open your mail app pre-filled with the customer's email, quote number, and a cover note. A print window also opens so you can save the PDF and attach it."
        >
          <PaperPlaneIcon size={14} />
          Send
        </button>
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-300 bg-[var(--bg-surface)] hover:bg-[var(--bg-inverted)]/[0.1] rounded-lg transition"
        >
          <PrintIcon size={14} />
          {t("btn.print")}
        </button>
        <button
          onClick={handleDeleteCurrent}
          className="inline-flex items-center gap-1 px-3 py-2 text-sm text-red-400 bg-[var(--bg-surface)] hover:bg-red-500/20 rounded-lg transition"
        >
          <TrashIcon size={14} />
        </button>
      </div>

      {/* ── Customer fields (dark row, above A4, not inside document) ── */}
      <div
        className="no-print"
        style={{
          display: "flex",
          gap: 12,
          padding: "12px 16px",
          background: "#0d0d0d",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#666",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 4,
              display: "block",
            }}
          >
            {t("field.customerName")}
          </label>
          <input
            type="text"
            value={current.customerName}
            onChange={(e) =>
              setCurrent({ ...current, customerName: e.target.value })
            }
            placeholder="e.g. Mr. Ahmed"
            className="w-full bg-[#1a1a1a] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition"
          />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#666",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 4,
              display: "block",
            }}
          >
            {t("field.companyName")}
          </label>
          <input
            type="text"
            value={current.companyName}
            onChange={(e) =>
              setCurrent({ ...current, companyName: e.target.value })
            }
            placeholder="e.g. ABC Trading Co."
            className="w-full bg-[#1a1a1a] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition"
          />
        </div>
      </div>

      {/* ── A4 Document (multi-page editor surface) ──
          The A4 paper, pagination, items table, action buttons,
          rich-text toolbar, notes panel, and footer (stamp /
          signature / bank / terms) all live in QuotationA4Preview. */}
      <QuotationA4Preview
        current={current}
        /* The parent's Quotation type adds two fields the preview
           doesn't know about (statusHistory, customerContactId) and
           the preview's local type doesn't list them either, but the
           preview never modifies state — it only renders. Cast to
           bypass the structural-equality check on setState. */
        setCurrent={setCurrent as never}
        updateItem={updateItem}
        addItem={addItem}
        onPickFromCatalog={() => setPickerOpen(true)}
        onPickCustomer={() => setCustomerPickerOpen(true)}
        savedStampUrl={savedStampUrl}
        savedSignatureUrl={savedSignatureUrl}
        isSuperAdmin={isSuperAdmin}
        onAttachSavedStamp={attachSavedStamp}
        onAttachSavedSignature={attachSavedSignature}
        onUploadStamp={(f) => uploadAsset("stamp", f)}
        onUploadSignature={(f) => uploadAsset("signature", f)}
        onClearStamp={clearStamp}
        onClearSignature={clearSignature}
        removeItem={removeItem}
        moveItem={moveItem}
        handleImageUpload={handleImageUpload}
        fileInputRefs={fileInputRefs}
        subTotal={subTotal}
        grandTotal={grandTotal}
        fmt={fmt}
        numberToWords={numberToWords}
      />
      <ProductPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addItemFromCatalog}
      />
      <CustomerPickerModal
        open={customerPickerOpen}
        onClose={() => setCustomerPickerOpen(false)}
        onPick={applyCustomerPick}
      />
    </div>
  );
}

/** Clickable status pill on the editor toolbar. Click to open a tiny
 *  dropdown of transitions; pick one to fire `onChange`. The colour
 *  map mirrors the list-view row badge so the same quote reads the
 *  same in both surfaces. */
function StatusMenu({
  status,
  onChange,
}: {
  status: QuoteStatus;
  onChange: (next: QuoteStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const colourFor = (s: QuoteStatus): string =>
    s === "accepted"
      ? "bg-emerald-500/15 text-emerald-400"
      : s === "sent"
        ? "bg-sky-500/15 text-sky-400"
        : s === "rejected"
          ? "bg-red-500/15 text-red-400"
          : s === "expired"
            ? "bg-zinc-500/15 text-zinc-400"
            : "bg-yellow-500/15 text-yellow-400";

  const labelFor = (s: QuoteStatus): string =>
    s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`text-xs font-semibold uppercase px-3 py-1 rounded-full inline-flex items-center gap-1.5 ${colourFor(status)}`}
        style={{ letterSpacing: "0.03em", border: "none", cursor: "pointer" }}
        title="Click to change status"
      >
        {labelFor(status)}
        <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            background: "var(--bg-secondary, #1f2937)",
            border: "1px solid var(--border-color, #374151)",
            borderRadius: 8,
            padding: 4,
            minWidth: 140,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            zIndex: 30,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {QUOTE_STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setOpen(false);
                onChange(opt.value);
              }}
              disabled={opt.value === status}
              className={`text-left px-2 py-1.5 rounded text-xs font-medium ${
                opt.value === status
                  ? "opacity-50 cursor-default"
                  : "hover:bg-white/[0.05] cursor-pointer text-gray-300"
              }`}
              style={{ background: "transparent", border: "none" }}
            >
              <span className={`inline-block w-2 h-2 rounded-full mr-2 align-middle ${colourFor(opt.value).split(" ")[0]}`}></span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Compact Hub-style KPI card, matched to the strip on Planning / Projects
 *  so all list-view dashboards share one visual language. */
function KpiCard({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string;
  accent?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] mb-2">
        {label}
      </div>
      <div className={`text-[20px] md:text-[24px] font-bold leading-none ${accent ?? "text-[var(--text-primary)]"}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-[var(--text-dim)] mt-2">{sub}</div>}
    </div>
  );
}
