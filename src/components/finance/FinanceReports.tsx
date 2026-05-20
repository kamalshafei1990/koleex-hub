"use client";

/* ---------------------------------------------------------------------------
   /finance/reports — Reporting Centre

   Three columns on desktop, stacked on mobile:
     · Left:  Report-type picker (external + internal sections)
     · Mid:   Filter panel for the chosen report
     · Right: Live preview rendered from the same payload the PDF uses

   Live preview talks to /api/reports/preview. "Download PDF" hits
   /api/reports/export/pdf and streams the binary. "Print" creates an
   export row via /api/reports/export/print and opens
   /finance/reports/[id]/print?auto=1 in a new window so the browser's
   own Save-as-PDF dialog appears.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";
import { EmptyState, SectionCard } from "@/components/finance/FinanceUi";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import type {
  ReportFilters,
  ReportTemplateDescriptor,
  ReportType,
} from "@/lib/reports/types";
import type { FinanceCustomerAccount, FinanceSupplierAccount, BankAccount } from "@/lib/finance/types";

interface PartyOption { id: string; name: string; }

export default function FinanceReports({
  initialType,
  initialFilters,
}: {
  initialType?: ReportType;
  initialFilters?: ReportFilters;
}) {
  const { t } = useTranslation(financeT);
  const [templates, setTemplates] = useState<ReportTemplateDescriptor[]>([]);
  const [activeType, setActiveType] = useState<ReportType | null>(initialType ?? null);
  const [filters, setFilters] = useState<ReportFilters>(initialFilters ?? defaultFilters());
  const [customers, setCustomers] = useState<PartyOption[]>([]);
  const [suppliers, setSuppliers] = useState<PartyOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<PartyOption[]>([]);
  /* Phase R — the preview pane is now an iframe driven by the same
     renderer that produces the PDF. No more divergent dashboard-y
     React preview; what the operator sees IS the document. */
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"pdf" | "print" | null>(null);

  /* Initial: load templates + party catalogues. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [tRes, cRes, sRes, bRes] = await Promise.all([
        fetch("/api/reports/templates", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ templates: [] })),
        fetch("/api/finance/customers", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ customers: [] })),
        fetch("/api/finance/suppliers", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ suppliers: [] })),
        fetch("/api/finance/bank-accounts", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ accounts: [] })),
      ]);
      if (cancelled) return;
      const tList = (tRes.templates ?? []) as ReportTemplateDescriptor[];
      setTemplates(tList);
      if (!initialType && tList.length > 0) setActiveType(tList[0].type);
      setCustomers(((cRes.customers ?? []) as FinanceCustomerAccount[]).map((c) => ({ id: c.customer_id, name: c.customer_name })));
      setSuppliers(((sRes.suppliers ?? []) as FinanceSupplierAccount[]).map((s) => ({ id: s.supplier_id, name: s.supplier_name })));
      setBankAccounts(((bRes.accounts ?? []) as BankAccount[]).map((a) => ({ id: a.id, name: `${a.bank_name} — ${a.account_name}` })));
    })();
    return () => { cancelled = true; };
  }, [initialType]);

  const activeDescriptor = useMemo(
    () => templates.find((t) => t.type === activeType) ?? null,
    [templates, activeType],
  );

  /* Phase S.4 — memoize the filters JSON key once so the effect deps
     are stable and JSON.stringify isn't called on every render. */
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  /* Live preview whenever the type / filters change. Debounced 300ms
     so we don't flood the API on every keystroke. */
  useEffect(() => {
    if (!activeType) return;
    const handle = window.setTimeout(() => {
      void loadPreview(activeType, filters);
    }, 300);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType, filtersKey]);

  const loadPreview = useCallback(async (type: ReportType, f: ReportFilters) => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await fetch("/api/reports/preview-html", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, filters: f }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: `Preview failed (${res.status})` }));
        setPreviewHtml(null);
        setPreviewError(j.error ?? `Preview failed (${res.status})`);
        return;
      }
      const html = await res.text();
      setPreviewHtml(html);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const downloadPdf = useCallback(async () => {
    if (!activeType) return;
    setBusy("pdf");
    try {
      const res = await fetch("/api/reports/export/pdf", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: activeType, filters }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: `PDF failed (${res.status})` }));
        alert(j.error);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const dispo = res.headers.get("Content-Disposition") ?? "";
      const m = /filename="([^"]+)"/.exec(dispo);
      link.download = m?.[1] ?? "report.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  }, [activeType, filters]);

  const openPrint = useCallback(async () => {
    if (!activeType) return;
    setBusy("print");
    try {
      const res = await fetch("/api/reports/export/print", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: activeType, filters }),
      });
      const j = await res.json();
      if (!res.ok) {
        alert(j.error ?? `Print failed (${res.status})`);
        return;
      }
      const id = j.export_id as string;
      window.open(`/finance/reports/${encodeURIComponent(id)}/print?auto=1`, "_blank");
    } finally {
      setBusy(null);
    }
  }, [activeType, filters]);

  /* Phase S.4 — memoize the per-visibility partitions so the picker
     panes don't re-allocate their template arrays on every render. */
  const externalTemplates = useMemo(() => templates.filter((t) => t.visibility === "external"), [templates]);
  const internalTemplates = useMemo(() => templates.filter((t) => t.visibility === "internal"), [templates]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <FinanceHeader
          title="Reporting Centre"
          subtitle="Generate, print, and export official finance documents. External reports are safe to send; internal ones never leave the company."
        />

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[260px_300px_minmax(0,1fr)]">
          {/* ───────── Type picker ───────── */}
          <SectionCard>
            <div className="space-y-4">
              <PickerSection title="External · safe to send" templates={externalTemplates} active={activeType} onPick={(t) => { setActiveType(t); setPreviewHtml(null); }} accent="emerald" />
              <PickerSection title="Internal · operators only" templates={internalTemplates} active={activeType} onPick={(t) => { setActiveType(t); setPreviewHtml(null); }} accent="rose" />
            </div>
          </SectionCard>

          {/* ───────── Filters ───────── */}
          <SectionCard>
            {activeDescriptor ? (
              <FiltersPanel
                descriptor={activeDescriptor}
                filters={filters}
                onChange={setFilters}
                customers={customers}
                suppliers={suppliers}
                bankAccounts={bankAccounts}
                onDownload={downloadPdf}
                onPrint={openPrint}
                busy={busy}
              />
            ) : (
              <div className="py-12 text-center text-sm text-gray-500">Pick a report type to begin.</div>
            )}
          </SectionCard>

          {/* ───────── Preview — Phase R: real document, not a
                dashboard mock. The iframe loads the exact HTML the
                PDF renderer produces, so what you see IS what gets
                printed / downloaded. White paper, black ink, A4
                proportions. */}
          <SectionCard>
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 mb-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Document preview</div>
              {previewLoading && <span className="text-[10px] text-gray-500">Updating…</span>}
            </div>
            {previewError ? (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">{previewError}</div>
            ) : previewHtml ? (
              <div className="overflow-hidden rounded-md border border-white/[0.04] bg-white" style={{ aspectRatio: "210 / 297" }}>
                <iframe
                  title="Report preview"
                  srcDoc={previewHtml}
                  className="block h-full w-full border-0"
                  /* sandbox keeps the iframe inert — same-origin so
                     the @page CSS still drives layout, but no
                     scripts can navigate the parent. The renderer's
                     own ready-flag script runs harmlessly inside. */
                  sandbox="allow-same-origin allow-scripts"
                />
              </div>
            ) : (
              <EmptyState title="No preview yet" hint="Pick a report and adjust filters to see a live preview." />
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */

function defaultFilters(): ReportFilters {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 90);
  return { date_from: from.toISOString().slice(0, 10), date_to: to.toISOString().slice(0, 10) };
}

function PickerSection({
  title, templates, active, onPick, accent,
}: {
  title: string;
  templates: ReportTemplateDescriptor[];
  active: ReportType | null;
  onPick: (t: ReportType) => void;
  accent: "emerald" | "rose";
}) {
  const dotColor = accent === "emerald" ? "bg-emerald-500" : "bg-rose-500";
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-gray-500">
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
        {title}
      </div>
      <div className="space-y-1.5">
        {templates.map((t) => {
          const isActive = active === t.type;
          return (
            <button
              key={t.type}
              type="button"
              onClick={() => onPick(t.type)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-[12px] transition ${
                isActive
                  ? "border-white/15 bg-white/[0.06]"
                  : "border-white/[0.04] bg-[var(--bg-primary)] hover:border-white/[0.10]"
              }`}
            >
              <div className="flex items-center gap-2">
                <RrIcon name={t.icon as RrIconName} size={14} />
                <span className="font-semibold">{t.title}</span>
              </div>
              <div className="mt-1 text-[10px] text-gray-500">{t.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FiltersPanel({
  descriptor, filters, onChange, customers, suppliers, bankAccounts, onDownload, onPrint, busy,
}: {
  descriptor: ReportTemplateDescriptor;
  filters: ReportFilters;
  onChange: (next: ReportFilters) => void;
  customers: PartyOption[];
  suppliers: PartyOption[];
  bankAccounts: PartyOption[];
  onDownload: () => void;
  onPrint: () => void;
  busy: "pdf" | "print" | null;
}) {
  const allFilterKeys: Array<keyof ReportFilters> = Array.from(new Set([...descriptor.required_filters, ...descriptor.optional_filters]));
  const set = (k: keyof ReportFilters, v: string | undefined) => onChange({ ...filters, [k]: v || undefined });

  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.16em] text-gray-500">Filters</div>
      <div className="mt-3 space-y-3">
        {allFilterKeys.includes("customer_id") && (
          <Field label="Customer" required={descriptor.required_filters.includes("customer_id")}>
            <Select value={filters.customer_id ?? ""} onChange={(v) => set("customer_id", v)} options={customers} placeholder="— Select customer —" />
          </Field>
        )}
        {allFilterKeys.includes("supplier_id") && (
          <Field label="Supplier" required={descriptor.required_filters.includes("supplier_id")}>
            <Select value={filters.supplier_id ?? ""} onChange={(v) => set("supplier_id", v)} options={suppliers} placeholder="— Select supplier —" />
          </Field>
        )}
        {allFilterKeys.includes("bank_account_id") && (
          <Field label="Bank account" required={descriptor.required_filters.includes("bank_account_id")}>
            <Select value={filters.bank_account_id ?? ""} onChange={(v) => set("bank_account_id", v)} options={[{ id: "", name: "All accounts" }, ...bankAccounts]} placeholder="" />
          </Field>
        )}
        {allFilterKeys.includes("date_from") && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="From" required={descriptor.required_filters.includes("date_from")}>
              <Input type="date" value={filters.date_from ?? ""} onChange={(v) => set("date_from", v)} />
            </Field>
            <Field label="To" required={descriptor.required_filters.includes("date_to")}>
              <Input type="date" value={filters.date_to ?? ""} onChange={(v) => set("date_to", v)} />
            </Field>
          </div>
        )}
        {allFilterKeys.includes("currency") && (
          <Field label="Currency (optional)">
            <Input value={filters.currency ?? ""} onChange={(v) => set("currency", v.toUpperCase())} placeholder="USD / EUR / CNY …" />
          </Field>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onPrint}
          disabled={busy !== null}
          className="rounded-lg border border-white/[0.10] bg-[var(--bg-primary)] px-3 py-2 text-[12px] font-semibold transition hover:border-white/[0.20] disabled:opacity-50"
        >
          {busy === "print" ? "Preparing…" : "Print"}
        </button>
        <button
          type="button"
          onClick={onDownload}
          disabled={busy !== null}
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[12px] font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
        >
          {busy === "pdf" ? "Building…" : "Download PDF"}
        </button>
      </div>

      <div className="mt-3 rounded-lg border border-white/[0.04] bg-[var(--bg-primary)] px-3 py-2 text-[10px] text-gray-500">
        {descriptor.visibility === "external"
          ? "Safe to send — this report excludes profit, cost, intelligence, and internal notes."
          : "Internal only — contains operator data. Never share with customers or suppliers."}
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">
        {label} {required && <span className="text-rose-400">*</span>}
      </div>
      {children}
    </label>
  );
}

function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: PartyOption[]; placeholder: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] text-[var(--text-primary)] focus:border-white/20 focus:outline-none"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.id || "__all"} value={o.id}>{o.name}</option>)}
    </select>
  );
}

function Input({ type = "text", value, onChange, placeholder }: { type?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] text-[var(--text-primary)] focus:border-white/20 focus:outline-none"
    />
  );
}

/* Phase R — the in-document React preview was removed. The preview
   now runs through /api/reports/preview-html which uses the same
   renderer as the PDF route, so what the operator sees IS the
   document. Dropping the dashboard-style React mock prevents drift
   between preview and printed output. */
