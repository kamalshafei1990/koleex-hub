"use client";

/* ---------------------------------------------------------------------------
   Documents app — Koleex's document library AND a save-capable document
   manager. Two things live here:

     1. NEW FROM TEMPLATE — open a blank Koleex format (Quotation, Invoice,
        Packing List) in the exact A4 design, fill it in, and save it.
     2. SAVED DOCUMENTS — everything saved from this app, in its OWN store
        (/api/documents, separate from the live Quotations/Invoices apps).
        Reopen, edit, duplicate, export, or delete.

   Quotation + Invoice share the QuotationA4Preview renderer (via docKind);
   Packing List has its own renderer. Every editor carries the same toolbar
   (Back · Status · Save Draft · Save Final · Duplicate · Export PDF · Excel ·
   Send · Print · Delete).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import PageHeader from "@/components/ui/PageHeader";
import QuotationA4Preview, {
  type Quotation,
  type QuotationItem,
} from "@/components/quotations/QuotationA4Preview";
import { numberToWords, PRINT_AND_DOC_STYLES } from "@/components/quotations/Quotations";
import PackingListDoc from "@/components/documents/PackingListDoc";
import DocToolbar, { type SaveState } from "@/components/documents/DocToolbar";
import {
  listDocuments,
  getDocument,
  saveDocument,
  removeDocument,
  type DocKind,
  type DocumentRow,
} from "@/lib/documents-store";
import { downloadDocXlsx, money } from "@/lib/excel-export";
import DocumentsIcon from "@/components/icons/DocumentsIcon";
import QuotationIcon from "@/components/icons/QuotationIcon";
import InvoicesIcon from "@/components/icons/InvoicesIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type OpenKind = DocKind; // "quotation" | "invoice" | "packing_list"

const TEMPLATES: { kind: OpenKind; title: string; subtitle: string; icon: ReactNode }[] = [
  { kind: "quotation", title: "Quotation", subtitle: "Commercial quotation to a customer", icon: <QuotationIcon size={18} /> },
  { kind: "invoice", title: "Invoice", subtitle: "Commercial invoice / proforma", icon: <InvoicesIcon size={18} /> },
  { kind: "packing_list", title: "Packing List", subtitle: "Carton / weight / volume packing list", icon: <PackageIcon size={18} /> },
];

const KIND_META: Record<OpenKind, { label: string; icon: ReactNode }> = {
  quotation: { label: "Quotation", icon: <QuotationIcon size={14} /> },
  invoice: { label: "Invoice", icon: <InvoicesIcon size={14} /> },
  packing_list: { label: "Packing List", icon: <PackageIcon size={14} /> },
};

/* ── Blank document factory (quotation / invoice) ───────────────────────── */
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

/* ═══════════════════════════════════════════════════════════════════════════
   Quotation / Invoice editor — QuotationA4Preview + the shared DocToolbar,
   wired to the Documents store.
   ═══════════════════════════════════════════════════════════════════════════ */
function DocEditor({
  kind,
  initial,
  onBack,
  onChanged,
}: {
  kind: "quotation" | "invoice";
  initial: DocumentRow | null;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [current, setCurrent] = useState<Quotation | null>(() => {
    if (!initial) return makeBlankDoc();
    const doc = { ...(initial.doc as unknown as Quotation) };
    // Backfill the minted number onto the sheet if the payload predates it.
    if (!doc.invoiceNo && initial.doc_no) doc.invoiceNo = initial.doc_no;
    return doc;
  });
  const [docId, setDocId] = useState<string | null>(initial?.id ?? null);
  const [version, setVersion] = useState<number>(initial?.version ?? 0);
  const [status, setStatus] = useState<string>(initial?.status ?? "draft");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  const edit = useCallback((fn: (p: Quotation) => Quotation) => {
    setCurrent((prev) => (prev ? fn(prev) : prev));
    setDirty(true);
  }, []);

  const updateItem = (idx: number, field: "description" | "model" | "image" | "unitPrice" | "qty" | "notes", value: string | number) =>
    edit((p) => ({ ...p, items: p.items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)) }));
  const addItem = () => edit((p) => ({ ...p, items: [...p.items, blankItem()] }));
  const addHeader = () => edit((p) => ({ ...p, items: [...p.items, { ...blankItem(), kind: "header" as const }] }));
  const removeItem = (idx: number) => edit((p) => ({ ...p, items: p.items.length > 1 ? p.items.filter((_, i) => i !== idx) : p.items }));
  const moveItem = (idx: number, dir: -1 | 1) =>
    edit((p) => {
      const items = [...p.items];
      const j = idx + dir;
      if (j < 0 || j >= items.length) return p;
      [items[idx], items[j]] = [items[j], items[idx]];
      return { ...p, items };
    });
  const insertItemBelow = (idx: number) =>
    edit((p) => {
      const items = [...p.items];
      items.splice(idx + 1, 0, blankItem());
      return { ...p, items };
    });
  const insertHeaderBelow = (idx: number) =>
    edit((p) => {
      const items = [...p.items];
      items.splice(idx + 1, 0, { ...blankItem(), kind: "header" as const });
      return { ...p, items };
    });
  const clearItem = (idx: number) => edit((p) => ({ ...p, items: p.items.map((it, i) => (i === idx ? blankItem() : it)) }));
  const handleImageUpload = (idx: number, file: File) => updateItem(idx, "image", URL.createObjectURL(file));

  const { subTotal, grandTotal } = useMemo(() => {
    if (!current) return { subTotal: 0, grandTotal: 0 };
    const priced = current.items.filter((i) => i.kind !== "header");
    const sub = priced.reduce((s, it) => s + (Number(it.unitPrice) || 0) * (Number(it.qty) || 0), 0);
    const taxAmt = sub * (Math.max(0, Math.min(100, Number(current.taxPct) || 0)) / 100);
    const base = sub + taxAmt + (Number(current.shipping) || 0) + (Number(current.others) || 0);
    const pct = Math.max(0, Math.min(100, Number(current.discountPct) || 0));
    return { subTotal: +sub.toFixed(2), grandTotal: +(base * (1 - pct / 100)).toFixed(2) };
  }, [current]);

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const doSave = useCallback(
    async (nextStatus: string) => {
      if (!current) return;
      setSaveState("saving");
      setSaveError(null);
      try {
        const saved = await saveDocument({
          id: docId ?? undefined,
          doc_kind: kind,
          doc_no: current.invoiceNo || undefined,
          title: current.companyName || current.customerName || null,
          currency: current.currency || "USD",
          status: nextStatus,
          total: grandTotal,
          doc: current as unknown as Record<string, unknown>,
          base_version: docId ? version : undefined,
        });
        if (!saved) throw new Error("Save failed");
        setDocId(saved.id);
        setVersion(saved.version ?? 1);
        setStatus(saved.status ?? nextStatus);
        if (saved.doc_no && saved.doc_no !== current.invoiceNo) {
          setCurrent((p) => (p ? { ...p, invoiceNo: saved.doc_no as string } : p));
        }
        setDirty(false);
        setSaveState("saved");
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1600);
        onChanged();
      } catch (e) {
        setSaveState("error");
        setSaveError(e instanceof Error ? e.message : String(e));
      }
    },
    [current, docId, version, kind, grandTotal, onChanged],
  );

  const handleDuplicate = () => {
    if (!current) return;
    setCurrent({ ...current, invoiceNo: "", status: "draft", items: current.items.map((it) => ({ ...it })) });
    setDocId(null);
    setVersion(0);
    setStatus("draft");
    setDirty(true);
    setSaveState("idle");
  };

  const handlePrint = () => window.print();

  const handleExcel = useCallback(async () => {
    if (!current) return;
    const q = current;
    const cur = q.currency || "USD";
    const priced = q.items.filter((i) => i.kind !== "header");
    const subtotal = priced.reduce((s, i) => s + (Number(i.unitPrice) || 0) * (Number(i.qty) || 0), 0);
    const taxPct = Math.max(0, Math.min(100, Number(q.taxPct) || 0));
    const taxAmt = subtotal * (taxPct / 100);
    const discPct = Math.max(0, Math.min(100, Number(q.discountPct) || 0));
    const base = subtotal + taxAmt + (Number(q.shipping) || 0) + (Number(q.others) || 0);
    const grand = +(base * (1 - discPct / 100)).toFixed(2);

    const rows: (string | number | null)[][] = [];
    const images: (string | null)[] = [];
    let n = 0;
    for (const it of q.items) {
      if (it.kind === "header") {
        rows.push(["", `▸ ${it.description || ""}`, "", "", "", "", ""]);
        images.push(null);
        continue;
      }
      n += 1;
      const lineTotal = money((Number(it.unitPrice) || 0) * (Number(it.qty) || 0));
      rows.push([n, it.description || "", it.model || "", "", money(it.unitPrice), Number(it.qty) || 0, lineTotal]);
      images.push(it.image || null);
    }
    const totals = [
      { label: "Subtotal", value: subtotal },
      ...(taxPct ? [{ label: `Tax (${taxPct}%)`, value: taxAmt }] : []),
      ...(Number(q.shipping) ? [{ label: "Shipping", value: Number(q.shipping) }] : []),
      ...(Number(q.others) ? [{ label: "Others", value: Number(q.others) }] : []),
      ...(discPct ? [{ label: `Discount (${discPct}%)`, value: -(base * discPct) / 100 }] : []),
      { label: `GRAND TOTAL (${cur})`, value: grand, strong: true },
    ];
    const toLines = [
      q.companyName || q.customerName || "",
      q.toAddress || "",
      q.customerName && q.companyName ? `Attn:  ${q.customerName}` : "",
      q.toPhone ? `Phone:  ${q.toPhone}` : "",
      q.toMobile ? `Mobile:  ${q.toMobile}` : "",
      q.toEmail ? `Email:  ${q.toEmail}` : "",
      q.toWebsite ? `Web:  ${q.toWebsite}` : "",
    ].filter((l) => l.trim() !== "");

    const docTitle = kind === "invoice" ? "COMMERCIAL INVOICE" : "QUOTATION";
    const noLabel = kind === "invoice" ? "INVOICE NO" : "QUOTATION NO";
    const fileBase = `${kind}-${(q.invoiceNo || "draft").replace(/[^\w-]+/g, "_")}`;
    await downloadDocXlsx(fileBase, {
      docTitle,
      number: q.invoiceNo || "draft",
      metaStrip: [
        ["DATE", q.date || ""],
        [noLabel, q.invoiceNo || ""],
        ["CLIENT NO", q.clientNo || ""],
        ...(kind === "quotation" ? ([["VALID TILL", q.validTill || ""]] as [string, string][]) : []),
      ],
      toLines,
      columns: [
        { header: "NO.", width: 5, align: "center" },
        { header: "ITEM", width: 40 },
        { header: "MODEL", width: 16 },
        { header: "PICTURE", width: 12, align: "center", image: true },
        { header: `UNIT PRICE (${cur})`, width: 15, money: true },
        { header: "QTY", width: 7, align: "center" },
        { header: `TOTAL (${cur})`, width: 15, money: true },
      ],
      rows,
      images,
      totals,
      terms: q.terms,
    });
  }, [current, kind]);

  const handleSend = useCallback(async () => {
    if (!current) return;
    const to = (current.toEmail || "").trim();
    // Save first so the number/record exists before we compose the email.
    await doSave(status === "draft" ? "sent" : status);
    const label = kind === "invoice" ? "Invoice" : "Quotation";
    const subject = `${label} ${current.invoiceNo || "from Koleex"}${current.companyName ? ` — ${current.companyName}` : ""}`;
    const body = [
      `Dear ${current.customerName?.trim() || "there"},`,
      "",
      `Please find our ${label.toLowerCase()} ${current.invoiceNo || ""} attached for your review.`,
      "",
      "Best regards,",
      "Koleex Group",
    ].join("\n");
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }, [current, doSave, status, kind]);

  const handleDelete = useCallback(async () => {
    if (!docId) {
      onBack();
      return;
    }
    if (!window.confirm("Delete this saved document? This cannot be undone.")) return;
    await removeDocument(docId);
    onChanged();
    onBack();
  }, [docId, onBack, onChanged]);

  if (!current) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <style>{PRINT_AND_DOC_STYLES}</style>
      <style>{`
        .quot-a4-stack { min-width: 0 !important; padding-inline: 0 !important; margin-inline: auto !important; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff !important; }
          @page { size: auto; margin: 0; }
        }
      `}</style>

      <DocToolbar
        onBack={onBack}
        status={status}
        statuses={kind === "invoice" ? ["draft", "sent", "paid", "cancelled"] : ["draft", "final", "sent"]}
        onStatusChange={(next) => doSave(next)}
        saveState={saveState}
        saveError={saveError}
        dirty={dirty}
        onSaveDraft={() => doSave("draft")}
        onSaveFinal={() => doSave(kind === "invoice" ? "sent" : "final")}
        onDuplicate={handleDuplicate}
        onExportPdf={handlePrint}
        onExcel={handleExcel}
        onSend={handleSend}
        onPrint={handlePrint}
        onDelete={docId ? handleDelete : undefined}
      />

      <div className="py-6 px-4 overflow-x-auto">
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

/* ═══════════════════════════════════════════════════════════════════════════
   Saved-documents list
   ═══════════════════════════════════════════════════════════════════════════ */
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}
const STATUS_CLS: Record<string, string> = {
  draft: "bg-[var(--warning)]/15 text-[var(--warning)]",
  final: "bg-[var(--success)]/15 text-[var(--success)]",
  sent: "bg-[var(--info)]/15 text-[var(--info)]",
  paid: "bg-[var(--success)]/20 text-[var(--success)]",
  cancelled: "bg-[var(--error)]/15 text-[var(--error)]",
};

function SavedList({
  docs,
  loading,
  onOpen,
  onDelete,
}: {
  docs: DocumentRow[];
  loading: boolean;
  onOpen: (row: DocumentRow) => void;
  onDelete: (row: DocumentRow) => void;
}) {
  const [filter, setFilter] = useState<OpenKind | "all">("all");
  const shown = filter === "all" ? docs : docs.filter((d) => d.doc_kind === filter);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Saved documents</h2>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["all", "quotation", "invoice", "packing_list"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === k
                  ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                  : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]"
              }`}
            >
              {k === "all" ? "All" : KIND_META[k].label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-[var(--text-dim)]">
          <SpinnerIcon className="h-5 w-5 animate-spin" />
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-primary)] p-8 text-center text-sm text-[var(--text-faint)]">
          No saved documents yet. Open a template above, fill it in, and press Save.
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border-color)] overflow-hidden divide-y divide-[var(--border-subtle)]">
          {shown.map((row) => (
            <div
              key={row.id}
              className="group flex items-center gap-3 px-4 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
              onClick={() => onOpen(row)}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] shrink-0">
                {KIND_META[row.doc_kind].icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{row.doc_no || "—"}</span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-faint)]">{KIND_META[row.doc_kind].label}</span>
                </div>
                <div className="text-xs text-[var(--text-dim)] truncate">{row.title || "Untitled"}</div>
              </div>
              <span className={`hidden sm:inline text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full ${STATUS_CLS[row.status] ?? "bg-[var(--bg-surface)] text-[var(--text-dim)]"}`}>
                {row.status}
              </span>
              <span className="hidden md:inline text-xs text-[var(--text-faint)] w-24 text-right shrink-0">{fmtDate(row.updated_at)}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(row); }}
                className="opacity-0 group-hover:opacity-100 text-[var(--text-faint)] hover:text-[var(--error)] transition p-1.5 rounded-lg shrink-0"
                title="Delete"
              >
                <TrashIcon size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Root
   ═══════════════════════════════════════════════════════════════════════════ */
export default function DocumentsApp() {
  const [openKind, setOpenKind] = useState<OpenKind | null>(null);
  const [editing, setEditing] = useState<DocumentRow | null>(null);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await listDocuments(undefined, { fresh: true });
    setDocs(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (openKind === null) void refresh();
  }, [openKind, refresh]);

  const openTemplate = (kind: OpenKind) => {
    setEditing(null);
    setOpenKind(kind);
  };
  const openSaved = async (row: DocumentRow) => {
    const full = (await getDocument(row.id)) ?? row;
    setEditing(full);
    setOpenKind(row.doc_kind);
  };
  const deleteSaved = async (row: DocumentRow) => {
    if (!window.confirm(`Delete ${row.doc_no || "this document"}? This cannot be undone.`)) return;
    setDocs((prev) => prev.filter((d) => d.id !== row.id));
    await removeDocument(row.id);
    void refresh();
  };
  const backToHome = () => {
    setOpenKind(null);
    setEditing(null);
  };

  if (openKind === "packing_list") {
    return <PackingListDoc initial={editing} onBack={backToHome} onChanged={refresh} />;
  }
  if (openKind) {
    return <DocEditor kind={openKind} initial={editing} onBack={backToHome} onChanged={refresh} />;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="px-4 md:px-6 pt-5 sm:pt-6">
        <PageHeader
          title="Documents"
          subtitle="Koleex document formats — create, save, and manage your quotations, invoices, and packing lists"
          icon={<DocumentsIcon size={20} />}
        />
      </div>
      <div className="px-4 md:px-6 py-6 w-full space-y-8">
        {/* New from template */}
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">New document</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TEMPLATES.map((t) => (
              <button
                key={t.kind}
                type="button"
                onClick={() => openTemplate(t.kind)}
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
                <div className="text-[11px] text-[var(--text-faint)] uppercase tracking-wider font-semibold">Blank A4 · fill · save · print</div>
              </button>
            ))}
          </div>
        </div>

        {/* Saved documents */}
        <SavedList docs={docs} loading={loading} onOpen={openSaved} onDelete={deleteSaved} />
      </div>
    </div>
  );
}
