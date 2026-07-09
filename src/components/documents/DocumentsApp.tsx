"use client";

/* ---------------------------------------------------------------------------
   Documents app — a library of Koleex's official document FORMATS.

   Each template opens the SAME A4 design used by the live Quotations /
   Invoices apps (via the shared QuotationA4Preview renderer), but BLANK:
   a fillable, printable template held in local state only. Nothing here is
   saved as a real quotation/invoice record — the dedicated apps do that.
   Starts with Quotation + Invoice; the gallery is built to grow.
   --------------------------------------------------------------------------- */

import { useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import PageHeader from "@/components/ui/PageHeader";
import QuotationA4Preview, {
  type Quotation,
  type QuotationItem,
} from "@/components/quotations/QuotationA4Preview";
import { numberToWords, PRINT_AND_DOC_STYLES } from "@/components/quotations/Quotations";
import PackingListDoc from "@/components/documents/PackingListDoc";
import DocumentsIcon from "@/components/icons/DocumentsIcon";
import QuoteIcon from "@/components/icons/ui/QuoteIcon";
import ReceiptIcon from "@/components/icons/ui/ReceiptIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PrinterIcon from "@/components/icons/ui/PrinterIcon";

/* "quotation" | "invoice" share the QuotationA4Preview renderer (docKind);
   "packing" has its own renderer (different columns). */
type DocKind = "quotation" | "invoice";
type OpenKind = DocKind | "packing";

const TEMPLATES: { kind: OpenKind; title: string; subtitle: string; icon: ReactNode }[] = [
  { kind: "quotation", title: "Quotation",    subtitle: "Commercial quotation to a customer", icon: <QuoteIcon size={18} /> },
  { kind: "invoice",   title: "Invoice",      subtitle: "Commercial invoice / proforma",      icon: <ReceiptIcon size={18} /> },
  { kind: "packing",   title: "Packing List", subtitle: "Carton / weight / volume packing list", icon: <PackageIcon size={18} /> },
];

/* ── Blank document factory ─────────────────────────────────────────────── */
function blankItem(): QuotationItem {
  return { description: "", model: "", image: "", unitPrice: 0, qty: 0, notes: "" };
}

function makeBlankDoc(): Quotation {
  return {
    id: "template",
    customerName: "",
    companyName: "",
    invoiceNo: "",
    date: "",
    clientNo: "",
    validTill: "",
    quotTo: "",
    items: [blankItem(), blankItem(), blankItem()],
    tax: 0,
    shipping: 0,
    others: 0,
    terms: "",
    status: "draft",
    createdAt: "",
    updatedAt: "",
    currency: "USD",
  };
}

/* ── Blank template viewer ──────────────────────────────────────────────────
   Mounts QuotationA4Preview with a local, unsaved document + real handlers so
   the operator can fill and print a blank form in the exact Koleex design. */
function BlankTemplate({ kind, onBack }: { kind: DocKind; onBack: () => void }) {
  const [current, setCurrent] = useState<Quotation | null>(() => makeBlankDoc());
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  const updateItem = (
    idx: number,
    field: "description" | "model" | "image" | "unitPrice" | "qty" | "notes",
    value: string | number,
  ) =>
    setCurrent((prev) =>
      prev ? { ...prev, items: prev.items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)) } : prev,
    );

  const addItem = () => setCurrent((prev) => (prev ? { ...prev, items: [...prev.items, blankItem()] } : prev));
  const addHeader = () =>
    setCurrent((prev) => (prev ? { ...prev, items: [...prev.items, { ...blankItem(), kind: "header" as const }] } : prev));
  const removeItem = (idx: number) =>
    setCurrent((prev) => (prev ? { ...prev, items: prev.items.length > 1 ? prev.items.filter((_, i) => i !== idx) : prev.items } : prev));
  const moveItem = (idx: number, dir: -1 | 1) =>
    setCurrent((prev) => {
      if (!prev) return prev;
      const items = [...prev.items];
      const j = idx + dir;
      if (j < 0 || j >= items.length) return prev;
      [items[idx], items[j]] = [items[j], items[idx]];
      return { ...prev, items };
    });
  const insertItemBelow = (idx: number) =>
    setCurrent((prev) => {
      if (!prev) return prev;
      const items = [...prev.items];
      items.splice(idx + 1, 0, blankItem());
      return { ...prev, items };
    });
  const insertHeaderBelow = (idx: number) =>
    setCurrent((prev) => {
      if (!prev) return prev;
      const items = [...prev.items];
      items.splice(idx + 1, 0, { ...blankItem(), kind: "header" as const });
      return { ...prev, items };
    });
  const clearItem = (idx: number) =>
    setCurrent((prev) => (prev ? { ...prev, items: prev.items.map((it, i) => (i === idx ? blankItem() : it)) } : prev));
  const handleImageUpload = (idx: number, file: File) => updateItem(idx, "image", URL.createObjectURL(file));

  const { subTotal, grandTotal } = useMemo(() => {
    if (!current) return { subTotal: 0, grandTotal: 0 };
    const sub = current.items.reduce((s, it) => s + (Number(it.unitPrice) || 0) * (Number(it.qty) || 0), 0);
    const taxAmt = sub * (Math.max(0, Math.min(100, Number(current.taxPct) || 0)) / 100);
    const base = sub + taxAmt + (Number(current.shipping) || 0) + (Number(current.others) || 0);
    const pct = Math.max(0, Math.min(100, Number(current.discountPct) || 0));
    return { subTotal: +sub.toFixed(2), grandTotal: +(base * (1 - pct / 100)).toFixed(2) };
  }, [current]);

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!current) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* The editor's shared stylesheet — A4 sizing + print rules. Without it
          the doc renders against browser defaults. */}
      <style>{PRINT_AND_DOC_STYLES}</style>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff !important; }
          @page { size: auto; margin: 0; }
        }
      `}</style>

      {/* Toolbar (hidden when printing) */}
      <div className="no-print sticky top-0 z-20 flex items-center justify-between gap-3 px-4 md:px-6 py-3 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/95 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeftIcon size={14} /> Templates
        </button>
        <div className="text-sm font-semibold text-[var(--text-primary)]">
          {kind === "invoice" ? "Invoice" : "Quotation"} — blank template
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <PrinterIcon size={14} /> Print
        </button>
      </div>

      {/* The blank A4 document, in the exact Koleex design */}
      <div className="flex justify-center py-6 px-4 overflow-x-auto">
        <div className="quot-a4-stack">
          <QuotationA4Preview
            current={current}
            setCurrent={setCurrent as Dispatch<SetStateAction<Quotation | null>>}
            updateItem={updateItem}
            addItem={addItem}
            addHeader={addHeader}
            removeItem={removeItem}
            moveItem={moveItem}
            insertItemBelow={insertItemBelow}
            insertHeaderBelow={insertHeaderBelow}
            clearItem={clearItem}
            handleImageUpload={handleImageUpload}
            fileInputRefs={fileInputRefs}
            subTotal={subTotal}
            grandTotal={grandTotal}
            fmt={fmt}
            numberToWords={numberToWords}
            isSuperAdmin={false}
            docKind={kind}
            hidePanels
          />
        </div>
      </div>
    </div>
  );
}

/* ── Gallery ────────────────────────────────────────────────────────────── */
export default function DocumentsApp() {
  const [openKind, setOpenKind] = useState<OpenKind | null>(null);

  if (openKind === "packing") return <PackingListDoc onBack={() => setOpenKind(null)} />;
  if (openKind) return <BlankTemplate kind={openKind} onBack={() => setOpenKind(null)} />;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <PageHeader
        title="Documents"
        subtitle="Koleex document formats — open a blank template to fill and print"
        icon={<DocumentsIcon size={20} />}
      />
      <div className="px-4 md:px-6 py-6 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TEMPLATES.map((t) => (
            <button
              key={t.kind}
              type="button"
              onClick={() => setOpenKind(t.kind)}
              className="group text-start rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 hover:border-[var(--border-focus)] transition-colors"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] group-hover:border-[var(--border-focus)] transition-colors">
                  {t.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-[var(--text-primary)]">{t.title}</div>
                  <div className="text-xs text-[var(--text-dim)] truncate">{t.subtitle}</div>
                </div>
              </div>
              <div className="text-[11px] text-[var(--text-faint)] uppercase tracking-wider font-semibold">
                Blank A4 template · fill &amp; print
              </div>
            </button>
          ))}

          {/* Placeholder — the library is built to grow */}
          <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-primary)] p-5 flex items-center justify-center text-center min-h-[112px]">
            <div className="text-xs text-[var(--text-faint)]">More document templates coming soon</div>
          </div>
        </div>
      </div>
    </div>
  );
}
