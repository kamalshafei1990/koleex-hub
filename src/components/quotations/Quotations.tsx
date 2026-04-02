"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ClipboardList,
  ArrowLeft,
  Plus,
  Trash2,
  Printer,
  FileText,
  Edit3,
  Eye,
  Image,
  Home,
  Save,
  X,
  ChevronDown,
} from "lucide-react";

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

const DEFAULT_TERMS = `Payment terms:
Shipping:
Shipping Mark:
Delivery Time:
All prices Include Tax:
Total Qty:`;

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

function loadQuotations(): Quotation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQuotations(list: Quotation[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function loadCounter(): number {
  if (typeof window === "undefined") return 1;
  try {
    const raw = localStorage.getItem(COUNTER_KEY);
    return raw ? parseInt(raw, 10) : 1;
  } catch {
    return 1;
  }
}

function saveCounter(c: number): void {
  localStorage.setItem(COUNTER_KEY, String(c));
}

function generateInvoiceNo(existingList: Quotation[]): {
  invoiceNo: string;
  nextCounter: number;
} {
  let counter = loadCounter();
  const year = new Date().getFullYear();
  const existing = new Set(existingList.map((q) => q.invoiceNo));
  let invoiceNo = "";
  for (let i = 0; i < 9999; i++) {
    invoiceNo = `KL${year}-${counter.toString().padStart(4, "0")}`;
    if (!existing.has(invoiceNo)) break;
    counter++;
  }
  return { invoiceNo, nextCounter: counter + 1 };
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

/* ══════════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════════ */

export default function Quotations() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [view, setView] = useState<"list" | "editor">("list");
  const [current, setCurrent] = useState<Quotation | null>(null);
  const [loaded, setLoaded] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  /* ── Load from localStorage on mount ── */
  useEffect(() => {
    setQuotations(loadQuotations());
    setLoaded(true);
  }, []);

  /* ── Create new quotation ── */
  const handleNew = useCallback(() => {
    const list = loadQuotations();
    const { invoiceNo, nextCounter } = generateInvoiceNo(list);
    saveCounter(nextCounter);
    const today = todayDDMMYYYY();
    const q: Quotation = {
      id: generateId(),
      customerName: "",
      companyName: "",
      invoiceNo,
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
  const handleOpen = useCallback((q: Quotation) => {
    setCurrent({ ...q, items: q.items.map((i) => ({ ...i })) });
    setView("editor");
  }, []);

  /* ── Delete ── */
  const handleDelete = useCallback(
    (id: string) => {
      if (!confirm("Delete this quotation?")) return;
      const updated = quotations.filter((q) => q.id !== id);
      setQuotations(updated);
      saveQuotations(updated);
    },
    [quotations]
  );

  /* ── Save current ── */
  const handleSave = useCallback(() => {
    if (!current) return;
    const now = new Date().toISOString();
    const updated = { ...current, updatedAt: now };
    const list = loadQuotations();
    const idx = list.findIndex((q) => q.id === updated.id);
    if (idx >= 0) {
      list[idx] = updated;
    } else {
      list.push(updated);
    }
    saveQuotations(list);
    setQuotations(list);
    setCurrent(updated);
  }, [current]);

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
      setCurrent({ ...current, items: current.items.filter((_, i) => i !== idx) });
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
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading...</div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     PRINT STYLES  (injected once)
     ══════════════════════════════════════════════════════════ */
  const printStyles = `
    @media print {
      body * { visibility: hidden !important; }
      #quotation-a4-preview,
      #quotation-a4-preview * { visibility: visible !important; }
      #quotation-a4-preview {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 210mm !important;
        max-width: 210mm !important;
        margin: 0 !important;
        padding: 12mm !important;
        box-shadow: none !important;
        border: none !important;
        border-radius: 0 !important;
        background: #fff !important;
      }
      @page {
        size: A4;
        margin: 0;
      }
    }
  `;

  /* ══════════════════════════════════════════════════════════
     LIST VIEW
     ══════════════════════════════════════════════════════════ */
  if (view === "list") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <style>{printStyles}</style>

        {/* Top bar */}
        <div className="max-w-6xl mx-auto px-4 pt-6 pb-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition mb-4"
          >
            <Home size={16} />
            Back to Home
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/20 flex items-center justify-center">
                <ClipboardList size={22} className="text-emerald-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Quotations</h1>
                <p className="text-sm text-gray-500">
                  {quotations.length} quotation{quotations.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <button
              onClick={handleNew}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition active:scale-95"
            >
              <Plus size={18} />
              New Quotation
            </button>
          </div>
        </div>

        {/* List */}
        <div className="max-w-6xl mx-auto px-4 py-6">
          {sortedQuotations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-500">
              <FileText size={48} className="mb-4 opacity-40" />
              <p className="text-lg font-medium">No quotations yet</p>
              <p className="text-sm mt-1">Create your first quotation to get started.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {sortedQuotations.map((q) => {
                const st = q.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
                const gt = st + q.tax + q.shipping + q.others;
                return (
                  <div
                    key={q.id}
                    className="bg-[#111] border border-white/[0.06] rounded-xl p-4 sm:p-5 hover:border-white/[0.12] transition cursor-pointer group"
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
                        <p className="text-white font-medium truncate">
                          {q.customerName || "Unnamed Customer"}
                          {q.companyName ? ` - ${q.companyName}` : ""}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{q.date}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-semibold text-white tabular-nums">
                          ${fmt(gt)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(q.id);
                          }}
                          className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100"
                          title="Delete"
                        >
                          <Trash2 size={16} />
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
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <style>{printStyles}</style>

      {/* Top bar */}
      <div className="max-w-[1600px] mx-auto px-4 pt-4 pb-2 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            onClick={() => setView("list")}
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"
          >
            <ArrowLeft size={16} />
            Back to List
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition active:scale-95"
            >
              <Save size={16} />
              Save
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-white rounded-xl text-sm font-medium transition active:scale-95"
            >
              <Printer size={16} />
              Print / PDF
            </button>
          </div>
        </div>
      </div>

      {/* Editor grid */}
      <div className="max-w-[1600px] mx-auto px-4 py-4 flex flex-col xl:flex-row gap-6">
        {/* ── LEFT: Form ── */}
        <div className="w-full xl:w-[480px] xl:min-w-[480px] space-y-4 print:hidden">
          {/* Header info */}
          <div className="bg-[#111] border border-white/[0.06] rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Quotation Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={current.customerName}
                  onChange={(e) =>
                    setCurrent({ ...current, customerName: e.target.value })
                  }
                  className="w-full bg-[#1a1a1a] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition"
                  placeholder="Customer name"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Company Name</label>
                <input
                  type="text"
                  value={current.companyName}
                  onChange={(e) =>
                    setCurrent({ ...current, companyName: e.target.value })
                  }
                  className="w-full bg-[#1a1a1a] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition"
                  placeholder="Company name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Invoice No.</label>
                <div className="w-full bg-[#1a1a1a] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-emerald-400 font-mono">
                  {current.invoiceNo}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date</label>
                <input
                  type="text"
                  value={current.date}
                  onChange={(e) => {
                    const date = e.target.value;
                    setCurrent({
                      ...current,
                      date,
                      validTill: addDays(date, 30),
                    });
                  }}
                  className="w-full bg-[#1a1a1a] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition"
                  placeholder="DD/MM/YYYY"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Client No.</label>
                <input
                  type="text"
                  value={current.clientNo}
                  onChange={(e) =>
                    setCurrent({ ...current, clientNo: e.target.value })
                  }
                  className="w-full bg-[#1a1a1a] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition"
                  placeholder="Client #"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Valid Till</label>
                <input
                  type="text"
                  value={current.validTill}
                  onChange={(e) =>
                    setCurrent({ ...current, validTill: e.target.value })
                  }
                  className="w-full bg-[#1a1a1a] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition"
                  placeholder="DD/MM/YYYY"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Quotation To</label>
              <textarea
                value={current.quotTo}
                onChange={(e) => setCurrent({ ...current, quotTo: e.target.value })}
                rows={3}
                className="w-full bg-[#1a1a1a] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition resize-none"
                placeholder="Customer address / details..."
              />
            </div>
          </div>

          {/* Items */}
          <div className="bg-[#111] border border-white/[0.06] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Items
              </h2>
              <button
                onClick={addItem}
                className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition"
              >
                <Plus size={14} />
                Add Row
              </button>
            </div>

            {current.items.map((item, idx) => (
              <div
                key={idx}
                className="bg-[#0A0A0A] border border-white/[0.04] rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-500">Item #{idx + 1}</span>
                  {current.items.length > 1 && (
                    <button
                      onClick={() => removeItem(idx)}
                      className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(idx, "description", e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-white/[0.06] rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition"
                    placeholder="Description"
                  />
                  <input
                    type="text"
                    value={item.model}
                    onChange={(e) => updateItem(idx, "model", e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-white/[0.06] rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition"
                    placeholder="Model"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-gray-600 mb-0.5">Unit Price</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.unitPrice || ""}
                      onChange={(e) =>
                        updateItem(idx, "unitPrice", parseFloat(e.target.value) || 0)
                      }
                      className="w-full bg-[#1a1a1a] border border-white/[0.06] rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-600 mb-0.5">Qty</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={item.qty || ""}
                      onChange={(e) =>
                        updateItem(idx, "qty", parseInt(e.target.value) || 0)
                      }
                      className="w-full bg-[#1a1a1a] border border-white/[0.06] rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition"
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-600 mb-0.5">Total</label>
                    <div className="w-full bg-[#1a1a1a] border border-white/[0.06] rounded-lg px-3 py-1.5 text-sm text-emerald-400 font-mono">
                      ${fmt(item.unitPrice * item.qty)}
                    </div>
                  </div>
                </div>
                {/* Image upload */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 cursor-pointer transition">
                    <Image size={13} />
                    {item.image ? "Change Image" : "Upload Image"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImageUpload(idx, f);
                      }}
                    />
                  </label>
                  {item.image && (
                    <div className="flex items-center gap-2">
                      <img
                        src={item.image}
                        alt=""
                        className="w-10 h-10 object-cover rounded border border-white/10"
                      />
                      <button
                        onClick={() => updateItem(idx, "image", "")}
                        className="text-gray-600 hover:text-red-400 transition"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  value={item.notes}
                  onChange={(e) => updateItem(idx, "notes", e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-white/[0.06] rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition"
                  placeholder="Notes (optional)"
                />
              </div>
            ))}
          </div>

          {/* Extras & Terms */}
          <div className="bg-[#111] border border-white/[0.06] rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Totals & Extras
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tax</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={current.tax || ""}
                  onChange={(e) =>
                    setCurrent({ ...current, tax: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-[#1a1a1a] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Shipping</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={current.shipping || ""}
                  onChange={(e) =>
                    setCurrent({
                      ...current,
                      shipping: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-[#1a1a1a] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Others</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={current.others || ""}
                  onChange={(e) =>
                    setCurrent({
                      ...current,
                      others: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-[#1a1a1a] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition"
                  placeholder="0.00"
                />
              </div>
            </div>
            {/* Summary strip */}
            <div className="bg-[#0A0A0A] rounded-lg p-3 space-y-1 text-sm font-mono">
              <div className="flex justify-between text-gray-400">
                <span>SubTotal</span>
                <span>${fmt(subTotal)}</span>
              </div>
              {current.tax > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Tax</span>
                  <span>${fmt(current.tax)}</span>
                </div>
              )}
              {current.shipping > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Shipping</span>
                  <span>${fmt(current.shipping)}</span>
                </div>
              )}
              {current.others > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Others</span>
                  <span>${fmt(current.others)}</span>
                </div>
              )}
              <div className="flex justify-between text-white font-semibold border-t border-white/10 pt-1 mt-1">
                <span>Grand Total</span>
                <span>${fmt(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Terms */}
          <div className="bg-[#111] border border-white/[0.06] rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Terms & Conditions
            </h2>
            <textarea
              value={current.terms}
              onChange={(e) => setCurrent({ ...current, terms: e.target.value })}
              rows={8}
              className="w-full bg-[#1a1a1a] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition resize-none"
            />
          </div>

          {/* Status toggle */}
          <div className="bg-[#111] border border-white/[0.06] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Status
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrent({ ...current, status: "draft" })}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  current.status === "draft"
                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                    : "bg-[#1a1a1a] text-gray-500 border border-white/[0.06] hover:text-gray-300"
                }`}
              >
                Draft
              </button>
              <button
                onClick={() => setCurrent({ ...current, status: "final" })}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  current.status === "final"
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : "bg-[#1a1a1a] text-gray-500 border border-white/[0.06] hover:text-gray-300"
                }`}
              >
                Final
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: A4 Preview ── */}
        <div className="flex-1 min-w-0">
          <div className="print:hidden mb-3 flex items-center gap-2 text-sm text-gray-500">
            <Eye size={14} />
            <span>Document Preview</span>
          </div>

          <div
            id="quotation-a4-preview"
            ref={printRef}
            className="bg-white text-black mx-auto shadow-2xl"
            style={{
              width: "210mm",
              maxWidth: "100%",
              minHeight: "297mm",
              padding: "12mm",
              fontFamily: "'Segoe UI', Arial, sans-serif",
              fontSize: "9pt",
              lineHeight: "1.4",
            }}
          >
            {/* ── A4 Header ── */}
            <div style={{ textAlign: "center", marginBottom: "6mm" }}>
              <h1
                style={{
                  fontSize: "22pt",
                  fontWeight: 800,
                  letterSpacing: "6px",
                  margin: 0,
                  color: "#111",
                }}
              >
                QUOTATION
              </h1>
            </div>

            {/* Company strip */}
            <div
              style={{
                background: "#111",
                color: "#fff",
                padding: "3mm 5mm",
                textAlign: "center",
                marginBottom: "1mm",
              }}
            >
              <span style={{ fontSize: "9pt", fontWeight: 700, letterSpacing: "2px" }}>
                KOLEEX INTERNATIONAL CORPORATION TAIZHOU CO., LTD.
              </span>
            </div>
            <div
              style={{
                background: "#333",
                color: "#ccc",
                padding: "1.5mm 5mm",
                textAlign: "center",
                marginBottom: "5mm",
                fontSize: "7pt",
                letterSpacing: "3px",
              }}
            >
              SHAPING THE FUTURE.
            </div>

            {/* ── Meta info two columns ── */}
            <div
              style={{
                display: "flex",
                gap: "8mm",
                marginBottom: "5mm",
                fontSize: "8pt",
              }}
            >
              {/* Left: fields */}
              <div style={{ flex: 1 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {[
                      { label: "DATE", value: current.date },
                      { label: "INVOICE NO.", value: current.invoiceNo },
                      { label: "CLIENT NO.", value: current.clientNo },
                      { label: "VALID TILL", value: current.validTill },
                    ].map((r) => (
                      <tr key={r.label}>
                        <td
                          style={{
                            fontWeight: 700,
                            padding: "1.5mm 3mm 1.5mm 0",
                            color: "#555",
                            width: "35%",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.label}
                        </td>
                        <td style={{ padding: "1.5mm 0", color: "#111" }}>{r.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Right: address */}
              <div style={{ flex: 1, fontSize: "7.5pt", color: "#444", lineHeight: 1.5 }}>
                <div style={{ marginBottom: "1mm" }}>
                  <strong style={{ color: "#111" }}>Address:</strong> ROOM206, BUILDING88, WEST
                  FEIYUE TECHNOLOGICAL INNOVATIVE PARK, FEIYUE ROAD, WENLING, TAIZHOU,
                  ZHEJIANG, 317502, CHINA
                </div>
                <div>
                  <strong style={{ color: "#111" }}>Phone:</strong> +86057688927796
                </div>
                <div>
                  <strong style={{ color: "#111" }}>Mobile:</strong> +8613073800720
                </div>
                <div>
                  <strong style={{ color: "#111" }}>Email:</strong> info@koleexgroup.com
                </div>
                <div>
                  <strong style={{ color: "#111" }}>Website:</strong> www.koleexgroup.com
                </div>
              </div>
            </div>

            {/* ── Quotation To ── */}
            {(current.customerName || current.quotTo) && (
              <div
                style={{
                  border: "1px solid #ddd",
                  padding: "3mm 4mm",
                  marginBottom: "5mm",
                  borderRadius: "2px",
                }}
              >
                <div
                  style={{
                    fontSize: "7pt",
                    fontWeight: 700,
                    color: "#888",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: "1.5mm",
                  }}
                >
                  Quotation To
                </div>
                {current.customerName && (
                  <div style={{ fontWeight: 700, fontSize: "10pt", color: "#111" }}>
                    {current.customerName}
                  </div>
                )}
                {current.companyName && (
                  <div style={{ fontSize: "9pt", color: "#333" }}>{current.companyName}</div>
                )}
                {current.quotTo && (
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      fontSize: "8pt",
                      color: "#555",
                      marginTop: "1mm",
                    }}
                  >
                    {current.quotTo}
                  </div>
                )}
              </div>
            )}

            {/* ── Items Table ── */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginBottom: "4mm",
                fontSize: "8pt",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#111",
                    color: "#fff",
                    fontSize: "7pt",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  <th style={{ padding: "2.5mm 3mm", textAlign: "center", width: "7%" }}>
                    No.
                  </th>
                  <th style={{ padding: "2.5mm 3mm", textAlign: "left" }}>Item</th>
                  <th style={{ padding: "2.5mm 3mm", textAlign: "left", width: "14%" }}>
                    Model
                  </th>
                  <th style={{ padding: "2.5mm 3mm", textAlign: "center", width: "12%" }}>
                    Picture
                  </th>
                  <th style={{ padding: "2.5mm 3mm", textAlign: "right", width: "13%" }}>
                    Unit Price
                  </th>
                  <th style={{ padding: "2.5mm 3mm", textAlign: "center", width: "8%" }}>
                    Qty
                  </th>
                  <th style={{ padding: "2.5mm 3mm", textAlign: "right", width: "14%" }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {current.items.map((item, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: "1px solid #eee",
                      background: idx % 2 === 0 ? "#fafafa" : "#fff",
                    }}
                  >
                    <td
                      style={{
                        padding: "2.5mm 3mm",
                        textAlign: "center",
                        color: "#888",
                        fontWeight: 600,
                      }}
                    >
                      {idx + 1}
                    </td>
                    <td style={{ padding: "2.5mm 3mm", color: "#222" }}>
                      {item.description}
                      {item.notes && (
                        <div style={{ fontSize: "7pt", color: "#999", marginTop: "0.5mm" }}>
                          {item.notes}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "2.5mm 3mm", color: "#555" }}>{item.model}</td>
                    <td style={{ padding: "2mm 3mm", textAlign: "center" }}>
                      {item.image ? (
                        <img
                          src={item.image}
                          alt=""
                          style={{
                            maxWidth: "60px",
                            maxHeight: "50px",
                            objectFit: "contain",
                            display: "inline-block",
                          }}
                        />
                      ) : (
                        <span style={{ color: "#ccc", fontSize: "7pt" }}>--</span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "2.5mm 3mm",
                        textAlign: "right",
                        fontFamily: "monospace",
                        color: "#222",
                      }}
                    >
                      ${fmt(item.unitPrice)}
                    </td>
                    <td
                      style={{
                        padding: "2.5mm 3mm",
                        textAlign: "center",
                        fontWeight: 600,
                        color: "#222",
                      }}
                    >
                      {item.qty}
                    </td>
                    <td
                      style={{
                        padding: "2.5mm 3mm",
                        textAlign: "right",
                        fontFamily: "monospace",
                        fontWeight: 600,
                        color: "#111",
                      }}
                    >
                      ${fmt(item.unitPrice * item.qty)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── Totals ── */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "5mm" }}>
              <table
                style={{
                  borderCollapse: "collapse",
                  minWidth: "55mm",
                  fontSize: "8.5pt",
                }}
              >
                <tbody>
                  <tr>
                    <td style={{ padding: "1.5mm 4mm", color: "#666", fontWeight: 600 }}>
                      SubTotal
                    </td>
                    <td
                      style={{
                        padding: "1.5mm 4mm",
                        textAlign: "right",
                        fontFamily: "monospace",
                        color: "#222",
                      }}
                    >
                      ${fmt(subTotal)}
                    </td>
                  </tr>
                  {current.tax > 0 && (
                    <tr>
                      <td style={{ padding: "1.5mm 4mm", color: "#666" }}>Tax</td>
                      <td
                        style={{
                          padding: "1.5mm 4mm",
                          textAlign: "right",
                          fontFamily: "monospace",
                          color: "#222",
                        }}
                      >
                        ${fmt(current.tax)}
                      </td>
                    </tr>
                  )}
                  {current.shipping > 0 && (
                    <tr>
                      <td style={{ padding: "1.5mm 4mm", color: "#666" }}>Shipping</td>
                      <td
                        style={{
                          padding: "1.5mm 4mm",
                          textAlign: "right",
                          fontFamily: "monospace",
                          color: "#222",
                        }}
                      >
                        ${fmt(current.shipping)}
                      </td>
                    </tr>
                  )}
                  {current.others > 0 && (
                    <tr>
                      <td style={{ padding: "1.5mm 4mm", color: "#666" }}>Others</td>
                      <td
                        style={{
                          padding: "1.5mm 4mm",
                          textAlign: "right",
                          fontFamily: "monospace",
                          color: "#222",
                        }}
                      >
                        ${fmt(current.others)}
                      </td>
                    </tr>
                  )}
                  <tr
                    style={{
                      borderTop: "2px solid #111",
                    }}
                  >
                    <td
                      style={{
                        padding: "2.5mm 4mm",
                        fontWeight: 800,
                        fontSize: "10pt",
                        color: "#111",
                      }}
                    >
                      Grand Total
                    </td>
                    <td
                      style={{
                        padding: "2.5mm 4mm",
                        textAlign: "right",
                        fontFamily: "monospace",
                        fontWeight: 800,
                        fontSize: "10pt",
                        color: "#111",
                      }}
                    >
                      ${fmt(grandTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── Terms ── */}
            {current.terms && (
              <div
                style={{
                  border: "1px solid #eee",
                  padding: "3mm 4mm",
                  marginBottom: "5mm",
                  borderRadius: "2px",
                }}
              >
                <div
                  style={{
                    fontSize: "7pt",
                    fontWeight: 700,
                    color: "#888",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: "1.5mm",
                  }}
                >
                  Terms & Conditions
                </div>
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    fontSize: "8pt",
                    color: "#444",
                    lineHeight: 1.6,
                  }}
                >
                  {current.terms}
                </div>
              </div>
            )}

            {/* ── Bank Details ── */}
            <div
              style={{
                background: "#f7f7f7",
                border: "1px solid #eee",
                padding: "3mm 4mm",
                marginBottom: "5mm",
                borderRadius: "2px",
              }}
            >
              <div
                style={{
                  fontSize: "7pt",
                  fontWeight: 700,
                  color: "#888",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  marginBottom: "2mm",
                }}
              >
                Bank Details
              </div>
              <table style={{ fontSize: "7.5pt", borderCollapse: "collapse", color: "#333" }}>
                <tbody>
                  <tr>
                    <td
                      style={{
                        fontWeight: 700,
                        padding: "1mm 4mm 1mm 0",
                        color: "#555",
                        whiteSpace: "nowrap",
                        verticalAlign: "top",
                      }}
                    >
                      BENEFICIARY BANK:
                    </td>
                    <td style={{ padding: "1mm 0" }}>
                      AGRICULTURAL BANK OF CHINA, ZHEJIANG BRANCH
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        fontWeight: 700,
                        padding: "1mm 4mm 1mm 0",
                        color: "#555",
                        whiteSpace: "nowrap",
                      }}
                    >
                      SWIFT CODE:
                    </td>
                    <td style={{ padding: "1mm 0", fontFamily: "monospace" }}>ABOCCNBJ110</td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        fontWeight: 700,
                        padding: "1mm 4mm 1mm 0",
                        color: "#555",
                        whiteSpace: "nowrap",
                        verticalAlign: "top",
                      }}
                    >
                      BENEFICIARY NAME:
                    </td>
                    <td style={{ padding: "1mm 0" }}>
                      KOLEEX INTERNATIONAL CORPORATION TAIZHOU CO. LTD.
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        fontWeight: 700,
                        padding: "1mm 4mm 1mm 0",
                        color: "#555",
                        whiteSpace: "nowrap",
                      }}
                    >
                      BENEFICIARY A/C No.:
                    </td>
                    <td style={{ padding: "1mm 0", fontFamily: "monospace" }}>
                      19905814040007205
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        fontWeight: 700,
                        padding: "1mm 4mm 1mm 0",
                        color: "#555",
                        whiteSpace: "nowrap",
                        verticalAlign: "top",
                      }}
                    >
                      BANK ADDRESS:
                    </td>
                    <td style={{ padding: "1mm 0" }}>
                      100 JIANGJIN ROAD SHANGCHENG DISTRICT, HANGZHOU, ZHEJIANG, CHINA
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── Footer ── */}
            <div
              style={{
                borderTop: "2px solid #111",
                paddingTop: "3mm",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "7.5pt",
                color: "#555",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: "#111", fontSize: "8.5pt" }}>
                  Mr. Kamal Shafei
                </div>
                <div>info@koleexgroup.com</div>
                <div>+8613073800720</div>
              </div>
              <div
                style={{
                  textAlign: "right",
                  fontStyle: "italic",
                  color: "#888",
                  fontSize: "8pt",
                }}
              >
                Thanks for Choosing Koleex.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
