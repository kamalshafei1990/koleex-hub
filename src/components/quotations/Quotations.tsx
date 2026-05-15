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
import { useTranslation } from "@/lib/i18n";
import { docsT } from "@/lib/translations/docs";
import { dialog } from "@/lib/ui-dialog";
import QuotationA4Preview from "./QuotationA4Preview";
import ProductPickerModal, { type PickResult } from "./ProductPickerModal";
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
  status: "draft" | "final";
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

const DEFAULT_TERMS = `Payment terms:\nShipping:\nShipping Mark:\nDelivery Time:\nAll prices Include Tax:\nTotal Qty:`;

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
    status: (row.status === "final" ? "final" : "draft") as "draft" | "final",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    serverTotal: typeof row.total === "number" ? row.total : (row.total != null ? Number(row.total) : undefined),
  };
}

/** Compute the grand total the same way the UI renders it. Mirrors the
 *  GRAND TOTAL row so the list can show totals without re-rendering. */
function computeGrandTotal(q: Quotation): number {
  const subtotal = q.items.reduce((s, i) => s + (Number(i.unitPrice) || 0) * (Number(i.qty) || 0), 0);
  return +(subtotal + (Number(q.tax) || 0) + (Number(q.shipping) || 0) + (Number(q.others) || 0)).toFixed(2);
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

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
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

function numberToWords(num: number): string {
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

  /* NUKE all height + overflow constraints inherited from the Hub's
     Tailwind layout (RootShell uses h-[calc(100vh-0px)],
     overflow-hidden, min-h-0 on multiple wrappers — those collapse
     the printable area to a single viewport height and clip the
     multi-page stack). Forcing every element to have flexible
     height + visible overflow lets the .quot-a4-doc pages flow
     naturally through the print pipeline. */
  * {
    overflow: visible !important;
    max-height: none !important;
  }
  /* Tailwind-flavoured height utilities — reset to auto so the
     wrappers stop pinning the viewport at 100vh. */
  [class*="h-screen"],
  [class*="h-[calc"],
  [class*="min-h-screen"],
  [class*="min-h-0"] {
    height: auto !important;
    min-height: 0 !important;
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

     NO page-break-before — that rule was producing extra blank
     sheets between docs in Safari. With each doc at a fixed
     268 mm height and page-break-inside: avoid keeping it
     together, the browser naturally places each doc on its own
     sheet. */
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
    page-break-inside: avoid !important;
    break-inside: avoid !important;
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
      const full = await fetchDocOne(QUOTATIONS_SYNC, q.id);
      if (full) {
        const hydrated = fromRow(full);
        setCurrent({ ...hydrated, items: hydrated.items.map((i) => ({ ...i })) });
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

  /* ── Save current ── */
  const handleSave = useCallback(
    async (status: "draft" | "final") => {
      if (!current) return;
      setSaveState("saving");
      setSaveError("");
      const intent = { ...current, status, updatedAt: new Date().toISOString() };
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
    window.print();
    document.title = prev;
  }, [current]);

  /* "saving" | "loading" status for the Export-PDF flow so the button
     can spin while the server renders. PDF generation can take 5-15 s
     on the first call after deploy (Chromium cold start), so a
     visible state is important. */
  const [pdfState, setPdfState] = useState<"idle" | "loading" | "error">("idle");

  /* ── Export PDF (server-side render) ──
     Hits /api/quotations/<id>/pdf which spins up headless Chrome,
     navigates to the chrome-less /quotations/<id>/print page, and
     snapshots it to PDF. The output is identical on phone, tablet,
     and laptop — and ready to attach to email. The route requires
     the quote to be SAVED to the server first (server fetches it by
     id), so we save automatically if the user is on a fresh draft. */
  const handleExportPdf = useCallback(async () => {
    if (!current) return;
    setPdfState("loading");
    try {
      /* Make sure the doc is persisted before asking the server to
         render it — otherwise the PDF would show the previously-
         saved state, not the user's latest edits. */
      if (current.id.length !== 36) {
        await handleSave("draft");
      }
      const refreshed = await loadQuotationsRemote({ fresh: true });
      const match = refreshed.find(
        (q) => q.id === current.id || q.invoiceNo === current.invoiceNo,
      );
      const quotationId = match?.id ?? current.id;
      if (quotationId.length !== 36) {
        setPdfState("error");
        alert("Please save the quotation before exporting.");
        return;
      }
      const res = await fetch(
        `/api/quotations/${encodeURIComponent(quotationId)}/pdf`,
        { credentials: "include" },
      );
      if (!res.ok) {
        let detail = "";
        try {
          const j = await res.json();
          detail = j?.error || "";
        } catch { /* ignore */ }
        setPdfState("error");
        alert(`Export failed (${res.status})${detail ? `: ${detail}` : ""}`);
        return;
      }
      const blob = await res.blob();
      const filename = `${current.invoiceNo || "quotation"}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      /* Defer the revoke a tick so the browser actually starts the
         download before the URL becomes invalid. */
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setPdfState("idle");
    } catch (e) {
      setPdfState("error");
      alert(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
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

  /* ── Computed totals ── */
  const subTotal = current
    ? current.items.reduce((s, i) => s + i.unitPrice * i.qty, 0)
    : 0;
  const grandTotal = current
    ? subTotal + current.tax + current.shipping + current.others
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
            const finals = quotations.filter((q) => q.status === "final").length;
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
              if (q.status !== "final") return false;
              const iso = ddmmyyyyToISO(q.validTill);
              if (!iso) return false;
              const d = new Date(iso);
              return d >= now && d <= soon;
            }).length;
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label={t("kpi.total")} value={String(quotations.length)} accent="text-blue-400" />
                <KpiCard label={t("kpi.drafts")} value={String(drafts)} accent="text-amber-400" />
                <KpiCard label={t("kpi.finalised")} value={String(finals)} accent="text-emerald-400" />
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
                              q.status === "final"
                                ? "bg-green-500/15 text-green-400"
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
        <span
          className={`text-xs font-semibold uppercase px-3 py-1 rounded-full ${
            current.status === "final"
              ? "bg-green-500/15 text-green-400"
              : "bg-yellow-500/15 text-yellow-400"
          }`}
          style={{ letterSpacing: "0.03em" }}
        >
          {current.status === "final" ? t("status.final") : t("status.draft")}
        </span>
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
          title="Generate a PDF on the server — same output on every device."
        >
          <DownloadIcon size={14} />
          {pdfState === "loading" ? "Rendering…" : t("btn.exportPDF")}
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
        setCurrent={setCurrent}
        updateItem={updateItem}
        addItem={addItem}
        onPickFromCatalog={() => setPickerOpen(true)}
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
