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
import { EmptyState, SectionCard } from "@/components/finance/FinanceUi";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import type {
  ReportFilters,
  ReportPayload,
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
  const [templates, setTemplates] = useState<ReportTemplateDescriptor[]>([]);
  const [activeType, setActiveType] = useState<ReportType | null>(initialType ?? null);
  const [filters, setFilters] = useState<ReportFilters>(initialFilters ?? defaultFilters());
  const [customers, setCustomers] = useState<PartyOption[]>([]);
  const [suppliers, setSuppliers] = useState<PartyOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<PartyOption[]>([]);
  const [preview, setPreview] = useState<ReportPayload | null>(null);
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
      const res = await fetch("/api/reports/preview", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, filters: f }),
      });
      const j = await res.json();
      if (!res.ok) {
        setPreview(null);
        setPreviewError(j.error ?? `Preview failed (${res.status})`);
        return;
      }
      setPreview(j.payload as ReportPayload);
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
              <PickerSection title="External · safe to send" templates={externalTemplates} active={activeType} onPick={(t) => { setActiveType(t); setPreview(null); }} accent="emerald" />
              <PickerSection title="Internal · operators only" templates={internalTemplates} active={activeType} onPick={(t) => { setActiveType(t); setPreview(null); }} accent="rose" />
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

          {/* ───────── Preview ───────── */}
          <SectionCard>
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 mb-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Preview</div>
              {previewLoading && <span className="text-[10px] text-gray-500">Updating…</span>}
            </div>
            {previewError ? (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">{previewError}</div>
            ) : preview ? (
              <PreviewPanel payload={preview} />
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

/* ────────────────────────────────────────────────────────────── */

function PreviewPanel({ payload }: { payload: ReportPayload }) {
  const fmtMoney = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="space-y-4 text-[12px]">
      {payload.internal_warning && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-300">
          {payload.internal_warning}
        </div>
      )}
      <div className="border-b border-white/[0.06] pb-3">
        <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{payload.meta.tenant_name}</div>
        <div className="mt-1 text-lg font-bold">{payload.meta.title}</div>
        {payload.meta.subtitle && <div className="text-[11px] text-gray-400">{payload.meta.subtitle}</div>}
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-gray-500">
          <div>Report No: <span className="text-gray-300">{payload.meta.report_no}</span></div>
          <div>Currency: <span className="text-gray-300">{payload.meta.currency}</span></div>
          {payload.meta.period && <div className="col-span-2">Period: <span className="text-gray-300">{payload.meta.period.from} → {payload.meta.period.to}</span></div>}
        </div>
      </div>

      {payload.recipient && (
        <div className="rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] p-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{payload.recipient.label}</div>
          <div className="mt-1 text-[13px] font-semibold">{payload.recipient.name}</div>
          {payload.recipient.address && <div className="text-[10px] text-gray-400">{payload.recipient.address}</div>}
          {payload.recipient.contact && <div className="text-[10px] text-gray-400">{payload.recipient.contact}</div>}
        </div>
      )}

      {payload.summary.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {payload.summary.map((s) => (
            <div key={s.label} className="rounded-lg border border-white/[0.04] bg-[var(--bg-primary)] p-2">
              <div className="text-[9px] uppercase tracking-[0.12em] text-gray-500">{s.label}</div>
              <div className={`mt-1 text-sm font-semibold tabular-nums ${toneClass(s.tone)}`}>
                {s.format === "money" || s.format === undefined && typeof s.value === "number"
                  ? typeof s.value === "number" ? fmtMoney(s.value) : s.value
                  : String(s.value)}
              </div>
              {s.hint && <div className="text-[9px] text-gray-500">{s.hint}</div>}
            </div>
          ))}
        </div>
      )}

      {payload.sections.map((sec, i) => (sec.kind === "table" ? (
        <div key={i}>
          {sec.title && <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-gray-400">{sec.title}</div>}
          {sec.rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/[0.08] px-3 py-4 text-center text-[10px] text-gray-500">{sec.empty_state ?? "Empty"}</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-white/[0.04]">
              <table className="min-w-full text-[11px]">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    {sec.columns.map((c) => (
                      <th key={c.key} className={`px-2 py-1.5 text-[9px] uppercase tracking-[0.10em] text-gray-500 ${c.align === "right" ? "text-right" : "text-left"}`}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sec.rows.slice(0, 50).map((r, j) => (
                    <tr key={j} className="border-b border-white/[0.04]">
                      {sec.columns.map((c) => {
                        const v = r[c.key];
                        const cls = `px-2 py-1.5 ${c.align === "right" ? "text-right tabular-nums" : ""}`;
                        if (v === null || v === undefined || v === "") return <td key={c.key} className={`${cls} text-gray-500`}>—</td>;
                        if (c.format === "money") return <td key={c.key} className={cls}>{fmtMoney(Number(v))}</td>;
                        if (c.format === "percent") return <td key={c.key} className={cls}>{Number(v).toFixed(1)}%</td>;
                        if (c.format === "date") return <td key={c.key} className={cls}>{String(v)}</td>;
                        return <td key={c.key} className={cls}>{String(v)}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {sec.rows.length > 50 && <div className="px-2 py-1 text-[10px] text-gray-500">Showing first 50 of {sec.rows.length} rows. PDF contains everything.</div>}
            </div>
          )}
        </div>
      ) : sec.kind === "note" ? (
        <div key={i} className="text-[11px] text-gray-400">{sec.title && <div className="mb-1 font-semibold text-gray-300">{sec.title}</div>}{sec.body}</div>
      ) : null))}

      {payload.totals && payload.totals.length > 0 && (
        <div className="rounded-lg border-t-2 border-white/20 pt-2">
          {payload.totals.map((t) => (
            <div key={t.label} className={`flex justify-between ${t.emphasized ? "text-base font-bold" : "text-[12px]"}`}>
              <span>{t.label}</span>
              <span className="tabular-nums">{fmtMoney(t.value)}</span>
            </div>
          ))}
        </div>
      )}

      {payload.notes && payload.notes.length > 0 && (
        <ul className="list-disc space-y-1 pl-4 text-[10px] text-gray-500">
          {payload.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
    </div>
  );
}

function toneClass(tone?: "positive" | "negative" | "neutral" | "warning"): string {
  if (tone === "positive") return "text-emerald-400";
  if (tone === "negative") return "text-rose-400";
  if (tone === "warning") return "text-amber-400";
  return "text-[var(--text-primary)]";
}
