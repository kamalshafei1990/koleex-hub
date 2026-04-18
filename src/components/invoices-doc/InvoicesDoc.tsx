"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import InvoicesIcon from "@/components/icons/InvoicesIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import PrintIcon from "@/components/icons/ui/PrintIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import DownloadIcon from "@/components/icons/ui/DownloadIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import { useTranslation } from "@/lib/i18n";
import { docsT } from "@/lib/translations/docs";
import {
  INVOICES_DOC_SYNC,
  fetchDocList,
  upsertDoc,
  deleteDoc,
  type RemoteDocRow,
} from "@/lib/docs-sync";

/* ══════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════ */

interface InvoiceItem {
  description: string;
  model: string;
  image: string;
  unitPrice: number;
  qty: number;
  notes: string;
}

interface Invoice {
  id: string;
  customerName: string;
  companyName: string;
  invoiceNo: string;
  date: string;
  clientNo: string;
  validTill: string;
  quotTo: string;
  items: InvoiceItem[];
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

const STORAGE_KEY = "koleex.invoices-doc.v1";
const COUNTER_KEY = "koleex.invoices-doc.counter";

const DEFAULT_TERMS = `Payment terms:\nShipping:\nShipping Mark:\nDelivery Time:\nAll prices Include Tax:\nTotal Qty:`;

const EMPTY_ITEM: InvoiceItem = {
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

/** Map a server row into the Invoice UI shape. `doc` holds the full UI
 *  snapshot; the normalized columns (inv_no, customer_id, total,
 *  issue_date, status) stay authoritative. */
function fromRow(row: RemoteDocRow): Invoice {
  const doc = row.doc as Partial<Invoice>;
  return {
    id: row.id,
    customerName: doc.customerName ?? "",
    companyName: doc.companyName ?? "",
    invoiceNo: (row.inv_no as string | null) ?? doc.invoiceNo ?? "",
    date: doc.date ?? todayDDMMYYYY(),
    clientNo: doc.clientNo ?? "",
    validTill: doc.validTill ?? addDays(todayDDMMYYYY(), 30),
    quotTo: doc.quotTo ?? "",
    items: Array.isArray(doc.items) && doc.items.length > 0 ? doc.items : [{ ...EMPTY_ITEM }],
    tax: Number(doc.tax ?? 0),
    shipping: Number(doc.shipping ?? 0),
    others: Number(doc.others ?? 0),
    terms: doc.terms ?? DEFAULT_TERMS,
    // Invoices use a richer enum server-side but the doc builder only
    // cares about draft vs final for the UI button state.
    status: (row.status === "draft" ? "draft" : "final") as "draft" | "final",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function computeGrandTotal(q: Invoice): number {
  const subtotal = q.items.reduce((s, i) => s + (Number(i.unitPrice) || 0) * (Number(i.qty) || 0), 0);
  return +(subtotal + (Number(q.tax) || 0) + (Number(q.shipping) || 0) + (Number(q.others) || 0)).toFixed(2);
}

function ddmmyyyyToISO(s: string): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

async function loadInvoicesRemote(): Promise<Invoice[]> {
  const rows = await fetchDocList(INVOICES_DOC_SYNC);
  return rows.map(fromRow);
}

async function saveInvoiceRemote(q: Invoice): Promise<Invoice | null> {
  const row = await upsertDoc(INVOICES_DOC_SYNC, {
    id: q.id.length === 36 ? q.id : undefined,
    inv_no: q.invoiceNo || undefined,
    // The server's invoice_status enum uses draft/sent/paid/… — map the
    // doc builder's "final" → "sent" so overdue detection + AR reports
    // still make sense against the enum.
    status: q.status === "final" ? "sent" : "draft",
    currency: "USD",
    issue_date: ddmmyyyyToISO(q.date),
    due_date: ddmmyyyyToISO(q.validTill),
    total: computeGrandTotal(q),
    doc: q,
  });
  return row ? fromRow(row) : null;
}

async function deleteInvoiceRemote(id: string): Promise<boolean> {
  if (id.length !== 36) return true;
  return deleteDoc(INVOICES_DOC_SYNC, id);
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

/* Textarea in invoice-to */
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
  #invoice-a4-preview,
  #invoice-a4-preview * { visibility: visible !important; }
  #invoice-a4-preview {
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

/** Lightweight payment shape matching /api/invoices/[id]/payments. */
interface InvPayment {
  id: string;
  amount: number;
  currency: string;
  method: string | null;
  reference: string | null;
  received_at: string;
  notes: string | null;
}

export default function InvoicesDoc() {
  const { t } = useTranslation(docsT);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [view, setView] = useState<"list" | "editor">("list");
  const [current, setCurrent] = useState<Invoice | null>(null);
  const [loaded, setLoaded] = useState(false);
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  /* ── Payments sidecar — only populated when the current invoice
        has a real server UUID (i.e. has been saved at least once). */
  const [payments, setPayments] = useState<InvPayment[]>([]);
  const [amountPaid, setAmountPaid] = useState(0);
  const [balance, setBalance] = useState(0);

  const reloadPayments = useCallback(async (invoiceId: string | null) => {
    if (!invoiceId || invoiceId.length !== 36) {
      setPayments([]);
      setAmountPaid(0);
      setBalance(0);
      return;
    }
    const [pRes, iRes] = await Promise.all([
      fetch(`/api/invoices/${invoiceId}/payments`, { credentials: "include" }),
      fetch(`/api/invoices/${invoiceId}`, { credentials: "include" }),
    ]);
    if (pRes.ok) {
      const json = (await pRes.json()) as { payments: InvPayment[] };
      setPayments(json.payments ?? []);
    }
    if (iRes.ok) {
      const json = (await iRes.json()) as { invoice: { amount_paid?: number; balance?: number } };
      setAmountPaid(Number(json.invoice?.amount_paid ?? 0));
      setBalance(Number(json.invoice?.balance ?? 0));
    }
  }, []);

  useEffect(() => {
    reloadPayments(current?.id ?? null);
  }, [current?.id, reloadPayments]);

  const handleRecordPayment = useCallback(async () => {
    if (!current || current.id.length !== 36) {
      alert(t("alert.saveFirstPayment"));
      return;
    }
    const grand = current.items.reduce((s, i) => s + (Number(i.unitPrice) || 0) * (Number(i.qty) || 0), 0)
      + (Number(current.tax) || 0) + (Number(current.shipping) || 0) + (Number(current.others) || 0);
    const defaultAmt = Math.max(0, grand - amountPaid);
    const amt = prompt(`${t("prompt.payAmount")} ${defaultAmt.toFixed(2)}`, defaultAmt.toFixed(2));
    if (!amt) return;
    const amount = Number(amt);
    if (!amount || amount <= 0) return;
    const method = prompt(t("prompt.payMethod"), "bank_transfer") ?? "other";
    const reference = prompt(t("prompt.payRef")) ?? "";
    await fetch(`/api/invoices/${current.id}/payments`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, method, reference: reference || null }),
    });
    await reloadPayments(current.id);
  }, [current, amountPaid, reloadPayments, t]);

  /* ── Load from Supabase on mount ── */
  useEffect(() => {
    let cancelled = false;
    loadInvoicesRemote().then((list) => {
      if (!cancelled) {
        setInvoices(list);
        setLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  /* ── Create new invoice. Kept optimistic until first save — server
        mints the real UUID + INV number on upsert. */
  const handleNew = useCallback(() => {
    const today = todayDDMMYYYY();
    const q: Invoice = {
      id: generateId(),
      customerName: "",
      companyName: "",
      invoiceNo: "",
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

  /* ── Open existing ── */
  const handleOpen = useCallback((q: Invoice) => {
    setCurrent({ ...q, items: q.items.map((i) => ({ ...i })) });
    setView("editor");
  }, []);

  /* ── Delete from list ── */
  const handleDeleteFromList = useCallback(
    async (id: string) => {
      if (!confirm(t("inv.deleteConfirm"))) return;
      await deleteInvoiceRemote(id);
      const list = await loadInvoicesRemote();
      setInvoices(list);
    },
    []
  );

  /* ── Delete current (from editor) ── */
  const handleDeleteCurrent = useCallback(async () => {
    if (!current) return;
    if (!confirm(t("inv.deleteConfirm"))) return;
    await deleteInvoiceRemote(current.id);
    const list = await loadInvoicesRemote();
    setInvoices(list);
    setCurrent(null);
    setView("list");
  }, [current]);

  /* ── Save current ── */
  const handleSave = useCallback(
    async (status: "draft" | "final") => {
      if (!current) return;
      const intent = { ...current, status, updatedAt: new Date().toISOString() };
      const saved = await saveInvoiceRemote(intent);
      if (saved) {
        setCurrent(saved);
        const list = await loadInvoicesRemote();
        setInvoices(list);
      }
    },
    [current]
  );

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
    (idx: number, field: keyof InvoiceItem, value: string | number) => {
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
  const sortedInvoices = [...invoices].sort(
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
                <InvoicesIcon size={16} />
              </div>
              <div className="flex items-center gap-2.5 min-w-0">
                <h1 className="text-xl md:text-[22px] font-bold tracking-tight">
                  {t("inv.title")}
                </h1>
                <p className="text-[12px] text-[var(--text-dim)]">
                  {invoices.length} {invoices.length === 1 ? t("inv.singular") : t("inv.plural")}
                </p>
              </div>
            </div>
            <button
              onClick={handleNew}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--bg-inverted)] hover:opacity-90 text-[var(--text-inverted)] rounded-xl text-sm font-medium transition active:scale-95"
            >
              <PlusIcon size={18} />
              {t("inv.new")}
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="max-w-[1500px] mx-auto px-4 pt-4">
          {(() => {
            const drafts = invoices.filter((q) => q.status === "draft").length;
            const finals = invoices.filter((q) => q.status === "final").length;
            const total = invoices.reduce((s, q) => s + computeGrandTotal(q), 0);
            const now = new Date();
            const overdueCount = invoices.filter((q) => {
              if (q.status !== "final") return false;
              const iso = ddmmyyyyToISO(q.validTill);
              if (!iso) return false;
              return new Date(iso) < now;
            }).length;
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label={t("kpi.total")} value={String(invoices.length)} accent="text-blue-400" />
                <KpiCard label={t("kpi.drafts")} value={String(drafts)} accent="text-amber-400" />
                <KpiCard label={t("kpi.finalised")} value={String(finals)} accent="text-emerald-400" />
                <KpiCard
                  label={t("kpi.totalBilled")}
                  value={fmt(total)}
                  accent="text-[var(--text-primary)]"
                  sub={overdueCount > 0 ? t("kpi.pastDue").replace("{n}", String(overdueCount)) : undefined}
                />
              </div>
            );
          })()}
        </div>

        {/* List */}
        <div className="max-w-[1500px] mx-auto px-4 py-6">
          {sortedInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-500">
              <DocumentIcon size={48} className="mb-4 opacity-40" />
              <p className="text-lg font-medium">{t("inv.none")}</p>
              <p className="text-sm mt-1">
                {t("inv.createFirst")}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {sortedInvoices.map((q) => {
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

        {/* Payments chip + record button — only appears once the
            invoice has a server UUID (balance/amount_paid are
            authoritative for saved records). */}
        {current.id.length === 36 && (
          <>
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border ${
                balance <= 0
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : amountPaid > 0
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    : "bg-[var(--bg-surface)] border-white/[0.06] text-gray-400"
              }`}
              title={`${payments.length} payment(s) recorded`}
            >
              <CheckCircleIcon size={12} />
              {t("paid.paid")} ${amountPaid.toFixed(2)} / {t("paid.balance")} ${Math.max(0, balance).toFixed(2)}
            </div>
            <button
              onClick={handleRecordPayment}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-300 bg-[var(--bg-surface)] hover:bg-[var(--bg-inverted)]/[0.1] rounded-lg transition"
            >
              <CheckCircleIcon size={14} />
              {t("btn.recordPayment")}
            </button>
          </>
        )}

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

      {/* ── A4 Document (the editing surface) ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "24px 16px 40px",
          background: "#0A0A0A",
        }}
      >
        <div
          id="invoice-a4-preview"
          className="quot-a4-doc"
          dir="ltr"
        >
          <div className="quot-doc-inner">
            {/* ═══ (a) HEADER ROW ═══ */}
            <div
              className="pq-top-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 0 12px",
                margin: 0,
              }}
            >
              <div style={{ width: 170, height: "auto" }}>
                {/* Logo placeholder - 170px wide */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="170"
                  height="25.4"
                  viewBox="0 0 719.83 107.57"
                  style={{ display: "block" }}
                >
                  <path
                    fill="#000"
                    d="M116.59,96.3v11.05h-10.6L14.66,62.47v44.88H0V1.58h14.66v43.53L105.99,1.58h10.6v11.05L28.42,53.9l88.18,42.4Z"
                  />
                  <path
                    fill="#000"
                    d="M242.65,71.04c0,20.07-14.21,36.54-34.28,36.54h-50.74c-20.52,0-35.18-16.01-35.18-36.54v-35.18C122.45,15.11,136.88.45,157.63.45h49.84c20.52,0,35.18,14.88,35.18,35.41v35.18ZM227.77,38.11c0-12.4-8.34-23.23-20.3-23.23h-49.84c-11.95,0-20.3,10.83-20.3,23.23v31.8c0,11.95,8.34,23,20.3,23h49.84c11.95,0,20.3-11.05,20.3-23v-31.8Z"
                  />
                  <path
                    fill="#000"
                    d="M363.07,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54l.23-71.04h14.66v69.91c0,11.95,8.34,23,20.3,23h68.56v14.66h-.01Z"
                  />
                  <path
                    fill="#000"
                    d="M473.8,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68Z"
                  />
                  <path
                    fill="#000"
                    d="M585.42,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68Z"
                  />
                  <path
                    fill="#000"
                    d="M719.83,96.3v11.05h-10.6l-48.04-42.62-48.04,42.62h-10.37v-11.05l46.91-41.72-46.91-41.95V1.58h10.37l48.04,42.62L709.23,1.58h10.6v11.05l-47.13,41.95,47.13,41.72ZM661.19,71.04l40.59,36.31h-81.19l40.59-36.31Z"
                  />
                </svg>
              </div>
              <div
                className="pq-top-title"
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: "#000",
                  letterSpacing: "0.06em",
                }}
              >
                INVOICE
              </div>
            </div>

            {/* ═══ (b) BLACK STRIP ═══ */}
            <div
              className="pq-strip-black"
              style={{
                background: "#000",
                color: "#fff",
                padding: "6px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 8,
                fontWeight: 600,
                letterSpacing: "0.02em",
              }}
            >
              <span style={{ color: "#fff" }}>
                KOLEEX INTERNATIONAL CORPORATION TAIZHOU CO., LTD.
              </span>
              <span style={{ color: "#fff" }}>
                {"\u79D1\u83B1\u606A\u65AF\u56FD\u9645\u5546\u4E1A\u7BA1\u7406\uFF08\u53F0\u5DDE\uFF09\u6709\u9650\u516C\u53F8"}
              </span>
            </div>

            {/* ═══ (c) GRAY STRIP ═══ */}
            <div
              className="pq-strip-gray"
              style={{
                background: "#e0e0e0",
                color: "#333",
                padding: "4px 16px",
                textAlign: "center",
                fontSize: 8,
                fontWeight: 600,
                letterSpacing: "0.14em",
                margin: "0 0 16px",
              }}
            >
              SHAPING THE FUTURE.
            </div>

            {/* ═══ (d) INFO ROW - two tables side by side ═══ */}
            <div
              className="pq-info-row"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "stretch",
                gap: 24,
                marginBottom: 12,
              }}
            >
              {/* TABLE 1: Meta */}
              <table
                className="pq-meta-tbl"
                cellSpacing={0}
                style={{
                  borderCollapse: "collapse",
                  border: "1px solid #ddd",
                  width: "48%",
                  height: "100%",
                }}
              >
                <tbody>
                  <tr>
                    <td
                      className="pq-ml"
                      style={{
                        fontWeight: 700,
                        color: "#fff",
                        background: "#000",
                        width: 76,
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                        whiteSpace: "nowrap",
                        border: "1px solid #ddd",
                        padding: "2px 8px",
                        verticalAlign: "middle",
                        height: 24,
                      }}
                    >
                      DATE
                    </td>
                    <td
                      className="pq-mv"
                      style={{
                        border: "1px solid #ddd",
                        padding: "2px 8px",
                        verticalAlign: "middle",
                        height: 24,
                        fontSize: 11,
                      }}
                    >
                      <input
                        type="text"
                        className="pq-in"
                        placeholder="DD/MM/YYYY"
                        maxLength={10}
                        value={current.date}
                        onChange={(e) => {
                          const date = e.target.value;
                          setCurrent({
                            ...current,
                            date,
                            validTill: addDays(date, 30),
                          });
                        }}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td
                      className="pq-ml"
                      style={{
                        fontWeight: 700,
                        color: "#fff",
                        background: "#000",
                        width: 76,
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                        whiteSpace: "nowrap",
                        border: "1px solid #ddd",
                        padding: "2px 8px",
                        verticalAlign: "middle",
                        height: 24,
                      }}
                    >
                      INVOICE NO.
                    </td>
                    <td
                      className="pq-mv"
                      style={{
                        border: "1px solid #ddd",
                        padding: "2px 8px",
                        verticalAlign: "middle",
                        height: 24,
                        fontSize: 11,
                      }}
                    >
                      <input
                        type="text"
                        className="pq-in"
                        readOnly
                        value={current.invoiceNo}
                        style={{ color: "#999" }}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td
                      className="pq-ml"
                      style={{
                        fontWeight: 700,
                        color: "#fff",
                        background: "#000",
                        width: 76,
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                        whiteSpace: "nowrap",
                        border: "1px solid #ddd",
                        padding: "2px 8px",
                        verticalAlign: "middle",
                        height: 24,
                      }}
                    >
                      CLIENT NO.
                    </td>
                    <td
                      className="pq-mv"
                      style={{
                        border: "1px solid #ddd",
                        padding: "2px 8px",
                        verticalAlign: "middle",
                        height: 24,
                        fontSize: 11,
                      }}
                    >
                      <input
                        type="text"
                        className="pq-in"
                        placeholder="/"
                        value={current.clientNo}
                        onChange={(e) =>
                          setCurrent({ ...current, clientNo: e.target.value })
                        }
                      />
                    </td>
                  </tr>
                  <tr>
                    <td
                      className="pq-ml"
                      style={{
                        fontWeight: 700,
                        color: "#fff",
                        background: "#000",
                        width: 76,
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                        whiteSpace: "nowrap",
                        border: "1px solid #ddd",
                        padding: "2px 8px",
                        verticalAlign: "middle",
                        height: 24,
                      }}
                    >
                      VALID TILL
                    </td>
                    <td
                      className="pq-mv"
                      style={{
                        border: "1px solid #ddd",
                        padding: "2px 8px",
                        verticalAlign: "middle",
                        height: 24,
                        fontSize: 11,
                      }}
                    >
                      <input
                        type="text"
                        className="pq-in"
                        placeholder="DD/MM/YYYY"
                        maxLength={10}
                        value={current.validTill}
                        onChange={(e) =>
                          setCurrent({ ...current, validTill: e.target.value })
                        }
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* TABLE 2: Contact */}
              <table
                className="pq-contact-tbl"
                cellSpacing={0}
                style={{
                  borderCollapse: "collapse",
                  border: "1px solid #ddd",
                  width: "48%",
                }}
              >
                <tbody>
                  <tr>
                    <td
                      className="pq-cl"
                      style={{
                        fontWeight: 700,
                        width: 56,
                        fontSize: 11,
                        textAlign: "right",
                        paddingRight: 8,
                        whiteSpace: "nowrap",
                        border: "1px solid #ddd",
                        padding: "2px 8px",
                        verticalAlign: "middle",
                        height: 24,
                      }}
                    >
                      Address
                    </td>
                    <td
                      className="pq-cv"
                      style={{
                        fontSize: 11,
                        fontWeight: 400,
                        border: "1px solid #ddd",
                        padding: "2px 8px",
                        verticalAlign: "middle",
                        height: 24,
                      }}
                    >
                      ROOM206, BUILDING88, WEST FEIYUE TECHNOLOGICAL INNOVATIVE
                      PARK, JINGSHUI AN COMMUNITY, XIACHEN STREET, JIAOJIANG
                      DISTRICT, TAIZHOU CITY, ZHEJIANG PROVINCE, CHINA
                    </td>
                  </tr>
                  <tr>
                    <td
                      className="pq-cl"
                      style={{
                        fontWeight: 700,
                        width: 56,
                        fontSize: 11,
                        textAlign: "right",
                        paddingRight: 8,
                        whiteSpace: "nowrap",
                        border: "1px solid #ddd",
                        padding: "2px 8px",
                        verticalAlign: "middle",
                        height: 24,
                      }}
                    >
                      Phone
                    </td>
                    <td
                      className="pq-cv"
                      style={{
                        fontSize: 11,
                        fontWeight: 400,
                        border: "1px solid #ddd",
                        padding: "2px 8px",
                        verticalAlign: "middle",
                        height: 24,
                      }}
                    >
                      +86057688927796
                    </td>
                  </tr>
                  <tr>
                    <td
                      className="pq-cl"
                      style={{
                        fontWeight: 700,
                        width: 56,
                        fontSize: 11,
                        textAlign: "right",
                        paddingRight: 8,
                        whiteSpace: "nowrap",
                        border: "1px solid #ddd",
                        padding: "2px 8px",
                        verticalAlign: "middle",
                        height: 24,
                      }}
                    >
                      Mobile
                    </td>
                    <td
                      className="pq-cv"
                      style={{
                        fontSize: 11,
                        fontWeight: 400,
                        border: "1px solid #ddd",
                        padding: "2px 8px",
                        verticalAlign: "middle",
                        height: 24,
                      }}
                    >
                      +8613073800720
                    </td>
                  </tr>
                  <tr>
                    <td
                      className="pq-cl"
                      style={{
                        fontWeight: 700,
                        width: 56,
                        fontSize: 11,
                        textAlign: "right",
                        paddingRight: 8,
                        whiteSpace: "nowrap",
                        border: "1px solid #ddd",
                        padding: "2px 8px",
                        verticalAlign: "middle",
                        height: 24,
                      }}
                    >
                      Email
                    </td>
                    <td
                      className="pq-cv"
                      style={{
                        fontSize: 11,
                        fontWeight: 400,
                        border: "1px solid #ddd",
                        padding: "2px 8px",
                        verticalAlign: "middle",
                        height: 24,
                      }}
                    >
                      info@koleexgroup.com
                    </td>
                  </tr>
                  <tr>
                    <td
                      className="pq-cl"
                      style={{
                        fontWeight: 700,
                        width: 56,
                        fontSize: 11,
                        textAlign: "right",
                        paddingRight: 8,
                        whiteSpace: "nowrap",
                        border: "1px solid #ddd",
                        padding: "2px 8px",
                        verticalAlign: "middle",
                        height: 24,
                      }}
                    >
                      Website
                    </td>
                    <td
                      className="pq-cv"
                      style={{
                        fontSize: 11,
                        fontWeight: 400,
                        border: "1px solid #ddd",
                        padding: "2px 8px",
                        verticalAlign: "middle",
                        height: 24,
                      }}
                    >
                      www.koleexgroup.com
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ═══ (e) INVOICE TO ═══ */}
            <div
              className="pq-to-section"
              style={{ width: "48%", marginBottom: 16 }}
            >
              <div
                className="pq-to-label"
                style={{
                  background: "#000",
                  color: "#fff",
                  padding: "5px 10px",
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                }}
              >
                INVOICE TO
              </div>
              <div
                className="pq-to-value"
                style={{
                  border: "1px solid #ddd",
                  borderTop: "none",
                  padding: "8px 10px",
                }}
              >
                <textarea
                  className="pq-in pq-in-area"
                  rows={3}
                  placeholder="Company name, contact person, address..."
                  value={current.quotTo}
                  onChange={(e) =>
                    setCurrent({ ...current, quotTo: e.target.value })
                  }
                  style={{
                    fontSize: 11,
                    fontWeight: 400,
                    width: "100%",
                    border: "none",
                    outline: "none",
                    fontFamily: "inherit",
                    resize: "vertical",
                    minHeight: 40,
                    lineHeight: 1.5,
                    background: "transparent",
                    padding: 0,
                  }}
                />
              </div>
            </div>

            {/* ═══ (f) ITEMS TABLE ═══ */}
            <table
              className="pq-tbl"
              cellSpacing={0}
              style={{
                width: "100%",
                borderCollapse: "collapse",
                border: "1px solid #ddd",
                marginTop: 12,
                tableLayout: "fixed",
                overflow: "visible",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      background: "#000",
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      padding: "7px 8px",
                      textAlign: "center",
                      border: "1px solid #555",
                      width: "5%",
                    }}
                  >
                    NO.
                  </th>
                  <th
                    style={{
                      background: "#000",
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      padding: "7px 8px",
                      textAlign: "center",
                      border: "1px solid #555",
                      width: "30%",
                    }}
                  >
                    ITEM
                  </th>
                  <th
                    style={{
                      background: "#000",
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      padding: "7px 8px",
                      textAlign: "center",
                      border: "1px solid #555",
                      width: "13%",
                    }}
                  >
                    MODEL
                  </th>
                  <th
                    style={{
                      background: "#000",
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      padding: "7px 8px",
                      textAlign: "center",
                      border: "1px solid #555",
                      width: "13%",
                    }}
                  >
                    PICTURE
                  </th>
                  <th
                    style={{
                      background: "#000",
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      padding: "7px 8px",
                      textAlign: "center",
                      border: "1px solid #555",
                      width: "10%",
                    }}
                  >
                    UNIT PRICE
                  </th>
                  <th
                    style={{
                      background: "#000",
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      padding: "7px 8px",
                      textAlign: "center",
                      border: "1px solid #555",
                      width: "7%",
                    }}
                  >
                    QTY
                  </th>
                  <th
                    style={{
                      background: "#000",
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      padding: "7px 8px",
                      textAlign: "center",
                      border: "1px solid #555",
                      width: "16%",
                    }}
                  >
                    TOTAL
                  </th>
                </tr>
              </thead>
              <tbody>
                {current.items.map((item, idx) => (
                  <tr
                    key={idx}
                    style={{ minHeight: 56, height: "auto" }}
                  >
                    {/* NO. */}
                    <td
                      style={{
                        padding: "10px 8px",
                        fontSize: 11,
                        border: "1px solid #ddd",
                        verticalAlign: "middle",
                        textAlign: "center",
                      }}
                    >
                      {idx + 1}
                    </td>
                    {/* ITEM - contentEditable rich text */}
                    <td
                      className="quot-item-td"
                      style={{
                        padding: "10px 8px",
                        fontSize: 11,
                        border: "1px solid #ddd",
                        verticalAlign: "middle",
                        position: "relative",
                        overflow: "visible",
                      }}
                    >
                      <div
                        className="quot-item-rich"
                        contentEditable
                        suppressContentEditableWarning
                        data-placeholder="Item description..."
                        onBlur={(e) =>
                          updateItem(
                            idx,
                            "description",
                            e.currentTarget.innerHTML
                          )
                        }
                        dangerouslySetInnerHTML={{
                          __html: item.description,
                        }}
                        style={{
                          minHeight: 32,
                          width: "100%",
                          fontSize: 11,
                          fontFamily: "inherit",
                          outline: "none",
                          lineHeight: 1.5,
                          padding: "2px 0",
                          wordWrap: "break-word",
                          overflowWrap: "break-word",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          maxWidth: "100%",
                        }}
                      />
                    </td>
                    {/* MODEL - contentEditable */}
                    <td
                      style={{
                        padding: "10px 8px",
                        fontSize: 11,
                        border: "1px solid #ddd",
                        verticalAlign: "middle",
                      }}
                    >
                      <div
                        className="pq-cell-wrap"
                        contentEditable
                        suppressContentEditableWarning
                        data-placeholder="Model"
                        onBlur={(e) =>
                          updateItem(
                            idx,
                            "model",
                            e.currentTarget.textContent || ""
                          )
                        }
                        dangerouslySetInnerHTML={{ __html: item.model }}
                        style={{
                          minHeight: 16,
                          width: "100%",
                          fontSize: 11,
                          fontFamily: "inherit",
                          outline: "none",
                          lineHeight: 1.4,
                          padding: 0,
                        }}
                      />
                    </td>
                    {/* PICTURE - click to upload */}
                    <td
                      style={{
                        padding: "10px 8px",
                        fontSize: 11,
                        border: "1px solid #ddd",
                        verticalAlign: "middle",
                      }}
                    >
                      <div
                        className={`quot-img-cell${item.image ? " has-img" : ""}`}
                        onClick={() => fileInputRefs.current[idx]?.click()}
                        style={{
                          width: "100%",
                          height: 80,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: item.image ? "none" : "1px dashed #ccc",
                          cursor: "pointer",
                          position: "relative",
                          overflow: "hidden",
                          background: item.image ? "transparent" : "#fafafa",
                        }}
                      >
                        {item.image ? (
                          <img
                            src={item.image}
                            alt=""
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                            }}
                          />
                        ) : (
                          <span
                            className="quot-img-plus"
                            style={{ fontSize: 18, color: "#bbb" }}
                          >
                            +
                          </span>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          ref={(el) => {
                            fileInputRefs.current[idx] = el;
                          }}
                          style={{
                            position: "absolute",
                            top: -9999,
                            left: -9999,
                            width: 0,
                            height: 0,
                            overflow: "hidden",
                          }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleImageUpload(idx, f);
                          }}
                        />
                      </div>
                    </td>
                    {/* UNIT PRICE - contentEditable, right-aligned */}
                    <td
                      style={{
                        padding: "10px 8px",
                        fontSize: 11,
                        border: "1px solid #ddd",
                        verticalAlign: "middle",
                        textAlign: "right",
                      }}
                    >
                      <div
                        className="pq-cell-wrap"
                        contentEditable
                        suppressContentEditableWarning
                        data-placeholder="0.00"
                        onBlur={(e) => {
                          const val =
                            parseFloat(
                              (e.currentTarget.textContent || "0").replace(
                                /[^0-9.]/g,
                                ""
                              )
                            ) || 0;
                          updateItem(idx, "unitPrice", val);
                        }}
                        style={{
                          minHeight: 16,
                          width: "100%",
                          fontSize: 11,
                          fontFamily: "inherit",
                          outline: "none",
                          lineHeight: 1.4,
                          padding: 0,
                          textAlign: "right",
                        }}
                      >
                        {item.unitPrice > 0 ? fmt(item.unitPrice) : ""}
                      </div>
                    </td>
                    {/* QTY - contentEditable, centered */}
                    <td
                      style={{
                        padding: "10px 8px",
                        fontSize: 11,
                        border: "1px solid #ddd",
                        verticalAlign: "middle",
                        textAlign: "center",
                      }}
                    >
                      <div
                        className="pq-cell-wrap"
                        contentEditable
                        suppressContentEditableWarning
                        data-placeholder="1"
                        onBlur={(e) => {
                          const val =
                            parseInt(
                              (e.currentTarget.textContent || "1").replace(
                                /[^0-9]/g,
                                ""
                              ),
                              10
                            ) || 1;
                          updateItem(idx, "qty", val);
                        }}
                        style={{
                          minHeight: 16,
                          width: "100%",
                          fontSize: 11,
                          fontFamily: "inherit",
                          outline: "none",
                          lineHeight: 1.4,
                          padding: 0,
                          textAlign: "center",
                        }}
                      >
                        {item.qty > 0 ? String(item.qty) : ""}
                      </div>
                    </td>
                    {/* TOTAL - calculated, right-aligned */}
                    <td
                      style={{
                        padding: "10px 8px",
                        fontSize: 12,
                        fontWeight: 700,
                        border: "1px solid #ddd",
                        verticalAlign: "middle",
                        textAlign: "right",
                        whiteSpace: "nowrap",
                        overflow: "visible",
                        position: "relative",
                      }}
                    >
                      ${fmt(item.unitPrice * item.qty)}
                      {/* Delete button outside total cell */}
                      {current.items.length > 1 && (
                        <button
                          className="quot-row-del-btn no-print"
                          onClick={() => removeItem(idx)}
                          title="Delete row"
                          style={{
                            position: "absolute",
                            top: "50%",
                            right: -28,
                            transform: "translateY(-50%)",
                            background: "none",
                            border: "1px solid rgba(0,0,0,0.10)",
                            color: "#999",
                            fontSize: 13,
                            cursor: "pointer",
                            width: 22,
                            height: 22,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                            lineHeight: 1,
                            fontWeight: 400,
                            borderRadius: "50%",
                            zIndex: 5,
                          }}
                        >
                          {"\u00D7"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="pq-tfoot-row">
                  <td
                    colSpan={5}
                    style={{
                      borderTop: "1px solid #ddd",
                      background: "#f5f5f5",
                      padding: 8,
                      fontSize: 14,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  />
                  <td
                    style={{
                      borderTop: "1px solid #ddd",
                      background: "#f5f5f5",
                      padding: 8,
                      fontSize: 14,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      textAlign: "right",
                    }}
                  >
                    Total
                  </td>
                  <td
                    style={{
                      borderTop: "1px solid #ddd",
                      background: "#f5f5f5",
                      padding: 8,
                      fontSize: 14,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      textAlign: "right",
                    }}
                  >
                    ${fmt(subTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* + Add Item button */}
            <div
              className="no-print"
              style={{ textAlign: "center", padding: "5px 0 8px" }}
            >
              <button
                className="pq-add-btn"
                onClick={addItem}
                style={{
                  background: "#f8f8f8",
                  border: "1px dashed #ccc",
                  padding: "6px 24px",
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#888",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                + Add Item
              </button>
            </div>

            {/* ═══ (g) BOTTOM SECTION - totals + terms ═══ */}
            <table
              className="pq-bot"
              cellSpacing={0}
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: 16,
              }}
            >
              <tbody>
                <tr>
                  {/* LEFT: Totals */}
                  <td
                    className="pq-bot-l"
                    style={{
                      width: "44%",
                      paddingRight: 16,
                      verticalAlign: "top",
                    }}
                  >
                    <table
                      className="pq-tots"
                      cellSpacing={0}
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        border: "1px solid #ddd",
                      }}
                    >
                      <tbody>
                        <tr>
                          <td
                            className="pq-tl"
                            style={{
                              fontWeight: 700,
                              background: "#f5f5f5",
                              width: 80,
                              fontSize: 11,
                              textTransform: "uppercase",
                              border: "1px solid #ddd",
                              padding: "5px 10px",
                            }}
                          >
                            SubTotal
                          </td>
                          <td
                            className="pq-tv"
                            style={{
                              textAlign: "right",
                              fontWeight: 400,
                              fontSize: 11,
                              border: "1px solid #ddd",
                              padding: "5px 10px",
                            }}
                          >
                            US$ {fmt(subTotal)}
                          </td>
                        </tr>
                        <tr>
                          <td
                            className="pq-tl"
                            style={{
                              fontWeight: 700,
                              background: "#f5f5f5",
                              width: 80,
                              fontSize: 11,
                              textTransform: "uppercase",
                              border: "1px solid #ddd",
                              padding: "5px 10px",
                            }}
                          >
                            Tax
                          </td>
                          <td
                            className="pq-tv"
                            style={{
                              textAlign: "right",
                              fontWeight: 400,
                              fontSize: 11,
                              border: "1px solid #ddd",
                              padding: "5px 10px",
                            }}
                          >
                            <div
                              className="pq-in-r"
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => {
                                const val =
                                  parseFloat(
                                    (
                                      e.currentTarget.textContent || "0"
                                    ).replace(/[^0-9.]/g, "")
                                  ) || 0;
                                setCurrent({ ...current, tax: val });
                              }}
                              style={{
                                textAlign: "right",
                                fontWeight: 400,
                                fontSize: 11,
                                width: "100%",
                                outline: "none",
                              }}
                            >
                              {current.tax > 0 ? String(current.tax) : "0"}
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td
                            className="pq-tl"
                            style={{
                              fontWeight: 700,
                              background: "#f5f5f5",
                              width: 80,
                              fontSize: 11,
                              textTransform: "uppercase",
                              border: "1px solid #ddd",
                              padding: "5px 10px",
                            }}
                          >
                            Shipping
                          </td>
                          <td
                            className="pq-tv"
                            style={{
                              textAlign: "right",
                              fontWeight: 400,
                              fontSize: 11,
                              border: "1px solid #ddd",
                              padding: "5px 10px",
                            }}
                          >
                            <div
                              className="pq-in-r"
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => {
                                const val =
                                  parseFloat(
                                    (
                                      e.currentTarget.textContent || "0"
                                    ).replace(/[^0-9.]/g, "")
                                  ) || 0;
                                setCurrent({ ...current, shipping: val });
                              }}
                              style={{
                                textAlign: "right",
                                fontWeight: 400,
                                fontSize: 11,
                                width: "100%",
                                outline: "none",
                              }}
                            >
                              {current.shipping > 0
                                ? String(current.shipping)
                                : "0"}
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td
                            className="pq-tl"
                            style={{
                              fontWeight: 700,
                              background: "#f5f5f5",
                              width: 80,
                              fontSize: 11,
                              textTransform: "uppercase",
                              border: "1px solid #ddd",
                              padding: "5px 10px",
                            }}
                          >
                            Others
                          </td>
                          <td
                            className="pq-tv"
                            style={{
                              textAlign: "right",
                              fontWeight: 400,
                              fontSize: 11,
                              border: "1px solid #ddd",
                              padding: "5px 10px",
                            }}
                          >
                            <div
                              className="pq-in-r"
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => {
                                const val =
                                  parseFloat(
                                    (
                                      e.currentTarget.textContent || "0"
                                    ).replace(/[^0-9.]/g, "")
                                  ) || 0;
                                setCurrent({ ...current, others: val });
                              }}
                              style={{
                                textAlign: "right",
                                fontWeight: 400,
                                fontSize: 11,
                                width: "100%",
                                outline: "none",
                              }}
                            >
                              {current.others > 0
                                ? String(current.others)
                                : "0"}
                            </div>
                          </td>
                        </tr>
                        {/* Grand Total row */}
                        <tr className="pq-grand">
                          <td
                            className="pq-tl"
                            style={{
                              background: "#000",
                              borderColor: "#000",
                              padding: "5px 10px",
                              fontSize: 14,
                              fontWeight: 700,
                              color: "#fff",
                            }}
                          >
                            Total
                          </td>
                          <td
                            className="pq-tv"
                            style={{
                              background: "#000",
                              borderColor: "#000",
                              padding: "5px 10px",
                              fontSize: 14,
                              fontWeight: 700,
                              textAlign: "right",
                              color: "#fff",
                            }}
                          >
                            US$ {fmt(grandTotal)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    {/* Total in Letters */}
                    <table
                      className="pq-tots"
                      cellSpacing={0}
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        border: "1px solid #ddd",
                        marginTop: -1,
                      }}
                    >
                      <tbody>
                        <tr>
                          <td
                            className="pq-tl"
                            style={{
                              fontWeight: 700,
                              background: "#f5f5f5",
                              width: 80,
                              fontSize: 11,
                              textTransform: "uppercase",
                              border: "1px solid #ddd",
                              padding: "5px 10px",
                            }}
                          >
                            Total in Letters
                          </td>
                          <td
                            className="pq-tv pq-tv-words"
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              textAlign: "right",
                              border: "1px solid #ddd",
                              padding: "5px 10px",
                            }}
                          >
                            {numberToWords(grandTotal)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>

                  {/* RIGHT: Terms & Conditions */}
                  <td
                    className="pq-bot-r"
                    style={{
                      width: "56%",
                      paddingLeft: 16,
                      verticalAlign: "top",
                    }}
                  >
                    <table
                      className="pq-terms-tbl"
                      cellSpacing={0}
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        border: "1px solid #ddd",
                        height: "100%",
                      }}
                    >
                      <tbody>
                        <tr>
                          <td
                            className="pq-terms-label"
                            style={{
                              background: "#000",
                              padding: "5px 10px",
                              fontSize: 9,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.03em",
                              color: "#fff",
                            }}
                          >
                            Terms &amp; Conditions
                          </td>
                        </tr>
                        <tr>
                          <td
                            className="pq-terms-value"
                            style={{ padding: 0, verticalAlign: "top" }}
                          >
                            <div
                              className="pq-tc-area"
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) =>
                                setCurrent({
                                  ...current,
                                  terms:
                                    e.currentTarget.innerText ||
                                    e.currentTarget.textContent ||
                                    "",
                                })
                              }
                              dangerouslySetInnerHTML={{
                                __html: current.terms.replace(/\n/g, "<br>"),
                              }}
                              style={{
                                width: "100%",
                                fontSize: 11,
                                fontWeight: 400,
                                lineHeight: 1.6,
                                border: "none",
                                padding: "8px 10px",
                                fontFamily: "inherit",
                                minHeight: 80,
                                outline: "none",
                                wordWrap: "break-word",
                                overflowWrap: "break-word",
                                whiteSpace: "pre-wrap",
                              }}
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ═══ (h) STAMP SECTION ═══ */}
            <table
              className="pq-stamp-tbl"
              cellSpacing={0}
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: 16,
              }}
            >
              <tbody>
                <tr>
                  <td style={{ width: "65%" }} />
                  <td>
                    <div
                      className="pq-stamp-box"
                      style={{
                        width: 150,
                        height: 60,
                        border: "1px solid #ccc",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 9,
                        color: "#aaa",
                      }}
                    >
                      Stamp
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ═══ (i) BANK DETAILS ═══ */}
            <div
              className="pq-bank-bar"
              style={{
                marginTop: 16,
                padding: "5px 10px",
                background: "#000",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "#fff",
              }}
            >
              RECEIVING U.S DOLLAR PAYMENT AT
            </div>
            <table
              className="pq-bank"
              cellSpacing={0}
              style={{
                width: "100%",
                borderCollapse: "collapse",
                border: "1px solid #ddd",
              }}
            >
              <tbody>
                <tr>
                  <td
                    className="pq-bl"
                    style={{
                      fontWeight: 700,
                      background: "#f5f5f5",
                      width: 140,
                      textTransform: "uppercase",
                      fontSize: 9,
                      letterSpacing: "0.02em",
                      whiteSpace: "nowrap",
                      border: "1px solid #ddd",
                      padding: "4px 10px",
                    }}
                  >
                    BENEFICIARY BANK
                  </td>
                  <td
                    className="pq-bv"
                    style={{
                      fontSize: 10,
                      border: "1px solid #ddd",
                      padding: "4px 10px",
                    }}
                  >
                    AGRICULTURAL BANK OF CHINA, ZHEJIANG BRANCH
                  </td>
                </tr>
                <tr>
                  <td
                    className="pq-bl"
                    style={{
                      fontWeight: 700,
                      background: "#f5f5f5",
                      width: 140,
                      textTransform: "uppercase",
                      fontSize: 9,
                      letterSpacing: "0.02em",
                      whiteSpace: "nowrap",
                      border: "1px solid #ddd",
                      padding: "4px 10px",
                    }}
                  >
                    SWIFT CODE
                  </td>
                  <td
                    className="pq-bv"
                    style={{
                      fontSize: 10,
                      border: "1px solid #ddd",
                      padding: "4px 10px",
                    }}
                  >
                    ABOCCNBJ110
                  </td>
                </tr>
                <tr>
                  <td
                    className="pq-bl"
                    style={{
                      fontWeight: 700,
                      background: "#f5f5f5",
                      width: 140,
                      textTransform: "uppercase",
                      fontSize: 9,
                      letterSpacing: "0.02em",
                      whiteSpace: "nowrap",
                      border: "1px solid #ddd",
                      padding: "4px 10px",
                    }}
                  >
                    BENEFICIARY NAME
                  </td>
                  <td
                    className="pq-bv"
                    style={{
                      fontSize: 10,
                      border: "1px solid #ddd",
                      padding: "4px 10px",
                    }}
                  >
                    KOLEEX INTERNATIONAL CORPORATION TAIZHOU CO. LTD.
                  </td>
                </tr>
                <tr>
                  <td
                    className="pq-bl"
                    style={{
                      fontWeight: 700,
                      background: "#f5f5f5",
                      width: 140,
                      textTransform: "uppercase",
                      fontSize: 9,
                      letterSpacing: "0.02em",
                      whiteSpace: "nowrap",
                      border: "1px solid #ddd",
                      padding: "4px 10px",
                    }}
                  >
                    BENEFICIARY A/C No.
                  </td>
                  <td
                    className="pq-bv"
                    style={{
                      fontSize: 10,
                      border: "1px solid #ddd",
                      padding: "4px 10px",
                    }}
                  >
                    19905814040007205
                  </td>
                </tr>
                <tr>
                  <td
                    className="pq-bl"
                    style={{
                      fontWeight: 700,
                      background: "#f5f5f5",
                      width: 140,
                      textTransform: "uppercase",
                      fontSize: 9,
                      letterSpacing: "0.02em",
                      whiteSpace: "nowrap",
                      border: "1px solid #ddd",
                      padding: "4px 10px",
                    }}
                  >
                    BANK ADDRESS
                  </td>
                  <td
                    className="pq-bv"
                    style={{
                      fontSize: 10,
                      border: "1px solid #ddd",
                      padding: "4px 10px",
                    }}
                  >
                    100 JIANGJIN ROAD SHANGCHENG DISTRICT, HANGZHOU, ZHEJIANG,
                    CHINA
                  </td>
                </tr>
                <tr>
                  <td
                    className="pq-bl"
                    style={{
                      fontWeight: 700,
                      background: "#f5f5f5",
                      width: 140,
                      textTransform: "uppercase",
                      fontSize: 9,
                      letterSpacing: "0.02em",
                      whiteSpace: "nowrap",
                      border: "1px solid #ddd",
                      padding: "4px 10px",
                    }}
                  >
                    BENEFICIARY ADDRESS
                  </td>
                  <td
                    className="pq-bv"
                    style={{
                      fontSize: 10,
                      border: "1px solid #ddd",
                      padding: "4px 10px",
                    }}
                  >
                    ROOM206, BUILDING88, WEST FEIYUE TECHNOLOGICAL INNOVATIVE
                    PARK, JINGSHUI AN COMMUNITY, XIACHEN STREET, JIAOJIANG
                    DISTRICT, TAIZHOU CITY, ZHEJIANG PROVINCE, CHINA
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ═══ (j) FOOTER ═══ */}
            <div
              className="pq-footer"
              style={{
                marginTop: 16,
                paddingTop: 10,
                borderTop: "1px solid #ddd",
                textAlign: "center",
                fontSize: 9,
                lineHeight: 1.7,
                color: "#555",
              }}
            >
              If you have any questions regarding this invoice, please contact
              <br />
              <strong style={{ fontWeight: 700 }}>Mr. Kamal Shafei</strong> /
              info@koleexgroup.com / +8613073800720
              <br />
              Thanks for Choosing Koleex.
            </div>
          </div>
          {/* /quot-doc-inner */}
        </div>
        {/* /quot-a4-doc */}
      </div>
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
