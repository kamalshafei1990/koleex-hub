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
import { useTranslation } from "@/lib/i18n";
import { docsT } from "@/lib/translations/docs";
import { dialog } from "@/lib/ui-dialog";
import QuotationA4Preview from "./QuotationA4Preview";
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

interface Quotation {
  id: string;
  customerName: string;
  companyName: string;
  invoiceNo: string;
  date: string;
  clientNo: string;
  validTill: string;
  quotTo: string;
  items: QuotationItem[];
  tax: number;
  shipping: number;
  others: number;
  terms: string;
  status: "draft" | "final";
  createdAt: string;
  updatedAt: string;
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
function fromRow(row: RemoteDocRow): Quotation {
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
    items: Array.isArray(doc.items) && doc.items.length > 0 ? doc.items : [{ ...EMPTY_ITEM }],
    tax: Number(doc.tax ?? 0),
    shipping: Number(doc.shipping ?? 0),
    others: Number(doc.others ?? 0),
    terms: doc.terms ?? DEFAULT_TERMS,
    status: (row.status === "final" ? "final" : "draft") as "draft" | "final",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
.quot-a4-doc {
  width: 210mm;
  min-height: 297mm;
  background: #fff;
  color: #000;
  margin: 0 auto 40px;
  box-shadow: 0 0 16px rgba(0,0,0,0.10);
  overflow: visible;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  font-size: 11px;
  line-height: 1.4;
}
.quot-doc-inner { padding: 32px 32px 24px; }

/* Force black text on white for all children */
.quot-a4-doc, .quot-a4-doc * { color: #000 !important; }
.quot-a4-doc .pq-ml,
.quot-a4-doc .pq-strip-black *,
.quot-a4-doc .pq-to-label,
.quot-a4-doc .pq-tbl thead th,
.quot-a4-doc .pq-grand td,
.quot-a4-doc .pq-grand *,
.quot-a4-doc .pq-bank-bar,
.quot-a4-doc .pq-terms-label { color: #fff !important; }
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

/* Delete button outside table */
.quot-row-del-btn {
  position: absolute;
  top: 50%;
  right: -28px;
  transform: translateY(-50%);
  background: none;
  border: 1px solid rgba(0,0,0,0.10);
  color: #999;
  font-size: 13px;
  cursor: pointer;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
  font-weight: 400;
  border-radius: 50%;
  z-index: 5;
}
.quot-row-del-btn:hover { color: #fff; background: #e74c3c; border-color: #e74c3c; }

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

/* ── PRINT ── */
@media print {
  body * { visibility: hidden !important; }
  #quotation-a4-preview,
  #quotation-a4-preview * { visibility: visible !important; }
  #quotation-a4-preview {
    position: absolute !important;
    left: 0;
    top: 0;
    width: 210mm !important;
    margin: 0;
    padding: 32px 32px 24px;
    box-shadow: none;
    border: none;
    background: #fff !important;
  }
  @page { size: A4; margin: 5mm 8mm; }
  .no-print { display: none !important; }
  .quot-row-del-btn { display: none !important; }
  .pq-add-btn { display: none !important; }

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
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

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
      const intent = { ...current, status, updatedAt: new Date().toISOString() };
      const saved = await saveQuotationRemote(intent);
      if (saved) {
        setCurrent(saved);
        const list = await loadQuotationsRemote({ fresh: true });
        setQuotations(list);
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
            const total = quotations.reduce((s, q) => s + computeGrandTotal(q), 0);
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
                const st = q.items.reduce(
                  (s, i) => s + i.unitPrice * i.qty,
                  0
                );
                const gt = st + q.tax + q.shipping + q.others;
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
        <button
          onClick={() => handleSave("draft")}
          className="px-4 py-2 text-sm text-gray-300 bg-[var(--bg-surface)] hover:bg-[var(--bg-inverted)]/[0.1] rounded-lg transition"
        >
          {t("btn.saveDraft")}
        </button>
        <button
          onClick={() => handleSave("final")}
          className="px-4 py-2 text-sm bg-[var(--bg-inverted)] hover:opacity-90 text-[var(--text-inverted)] rounded-lg font-semibold transition"
        >
          {t("btn.saveFinal")}
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
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-300 bg-[var(--bg-surface)] hover:bg-[var(--bg-inverted)]/[0.1] rounded-lg transition"
        >
          <DownloadIcon size={14} />
          {t("btn.exportPDF")}
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
        removeItem={removeItem}
        moveItem={moveItem}
        handleImageUpload={handleImageUpload}
        fileInputRefs={fileInputRefs}
        subTotal={subTotal}
        grandTotal={grandTotal}
        fmt={fmt}
        numberToWords={numberToWords}
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
