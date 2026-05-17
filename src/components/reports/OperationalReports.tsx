"use client";

/* ---------------------------------------------------------------------------
   /reports — Operational reports hub.

   Six report kinds wired to /api/reports/operational. Single page with
   tabs, standardized filters, ReportUi primitives, and print/PDF.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ReportShell, ReportFilters, ReportToolbar, ReportTable, ReportFooter,
  type ReportColumn, fmtMoney,
} from "@/components/ui/report/ReportUi";

type Kind = "sales" | "purchases" | "expenses" | "inventory" | "customers" | "suppliers";

const TABS: Array<{ k: Kind; label: string; needsDate: boolean; hint: string }> = [
  { k: "sales",     label: "Sales",     needsDate: true,  hint: "Posted invoices by customer" },
  { k: "purchases", label: "Purchases", needsDate: true,  hint: "Vendor bills by supplier" },
  { k: "expenses",  label: "Expenses",  needsDate: true,  hint: "By expense category" },
  { k: "inventory", label: "Inventory", needsDate: false, hint: "Value by warehouse" },
  { k: "customers", label: "Customers", needsDate: false, hint: "Customer ledger" },
  { k: "suppliers", label: "Suppliers", needsDate: false, hint: "Supplier ledger" },
];

interface Row {
  key: string; label: string; count?: number; amount: number; currency?: string;
  meta?: Record<string, string | number | null>;
}
interface Report {
  title: string; rows: Row[]; totals: { count: number; amount: number };
}

export default function OperationalReports() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const yearStart = useMemo(() => `${new Date().getUTCFullYear()}-01-01`, []);
  const [kind, setKind] = useState<Kind>("sales");
  const [from, setFrom] = useState(yearStart);
  const [to,   setTo]   = useState(today);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams({ kind, from, to });
      const r = await fetch(`/api/reports/operational?${qs.toString()}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setReport(j.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, [kind, from, to]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const currentTab = TABS.find((t) => t.k === kind)!;

  const columns: Array<ReportColumn<Row>> = useMemo(() => {
    const base: Array<ReportColumn<Row>> = [
      { key: "label", header: "Name",   render: (r) => (
        <Link href={drillFor(kind, r)} className="hover:underline">{r.label}</Link>
      ) },
    ];
    if (kind === "sales" || kind === "purchases" || kind === "expenses") {
      base.push({ key: "count", header: "Docs", align: "right", render: (r) => String(r.count ?? 0) });
    }
    if (kind === "inventory") {
      base.push({ key: "qty", header: "Qty on hand", align: "right",
        render: (r) => (r.meta?.qty as number | undefined)?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? "—" });
    }
    if (kind === "customers") {
      base.push({ key: "open_ar", header: "Open AR", align: "right",
        render: (r) => fmtMoney(Number(r.meta?.open_ar) || 0) });
    }
    if (kind === "suppliers") {
      base.push({ key: "open_ap", header: "Open AP", align: "right",
        render: (r) => fmtMoney(Number(r.meta?.open_ap) || 0) });
    }
    if (kind === "customers" && true) {
      base.push({ key: "country", header: "Country", render: (r) => (r.meta?.country as string) ?? "—" });
    }
    base.push({ key: "amt", header: "Amount", align: "right", render: (r) => fmtMoney(r.amount) });
    return base;
  }, [kind]);

  const totalsRow = useMemo(() => {
    if (!report) return [];
    const cells: string[] = [`Total · ${report.rows.length} rows`];
    while (cells.length < columns.length - 1) cells.push("");
    cells.push(fmtMoney(report.totals.amount));
    return cells;
  }, [report, columns.length]);

  const filterFields = useMemo(() => {
    if (!currentTab.needsDate) return [];
    return [
      { key: "from", label: "From", type: "date" as const, value: from, onChange: setFrom },
      { key: "to",   label: "To",   type: "date" as const, value: to,   onChange: setTo },
    ];
  }, [currentTab, from, to]);

  function handlePrint() { if (typeof window !== "undefined") window.print(); }

  return (
    <ReportShell
      title="Reports"
      subtitle={`${currentTab.label} · ${currentTab.hint}`}
      icon="newspaper"
      backHref="/"
      filters={
        <div className="space-y-3">
          {/* Tabs */}
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/[0.05] bg-white/[0.012] p-1.5">
            {TABS.map((t) => (
              <button key={t.k} type="button" onClick={() => setKind(t.k)}
                      className={`rounded-md px-3 py-1.5 text-[12px] transition-colors ${
                        t.k === kind ? "bg-white/[0.10] text-white" : "text-gray-400 hover:bg-white/[0.05]"
                      }`}>
                {t.label}
              </button>
            ))}
          </div>
          {filterFields.length > 0 && (
            <ReportFilters fields={filterFields} onApply={fetchReport}
                           onReset={() => { setFrom(yearStart); setTo(today); }} />
          )}
        </div>
      }
      toolbar={<ReportToolbar onPrint={handlePrint} />}
      footer={<ReportFooter note={`${currentTab.label} · ${from} → ${to}`} />}
    >
      {loading && <div className="px-1 text-sm text-gray-500">Loading…</div>}
      {error && <div className="px-1 text-sm text-rose-300">{error}</div>}
      {report && !loading && (
        <ReportTable<Row>
          rows={report.rows}
          columns={columns}
          rowKey={(r) => r.key}
          footerTotals={totalsRow}
          empty="No data in this range."
        />
      )}
    </ReportShell>
  );
}

/* ─── Drill-down route map ─── */
function drillFor(kind: Kind, r: Row): string {
  switch (kind) {
    case "sales":     return r.key === "—" ? "/invoices" : `/customers/${r.key}`;
    case "purchases": return `/contacts/${r.key}`;
    case "expenses":  return `/finance/expenses?category=${encodeURIComponent(r.key)}`;
    case "inventory": return `/inventory?warehouse=${encodeURIComponent(r.key)}`;
    case "customers": return `/customers/${r.key}`;
    case "suppliers": return `/contacts/${r.key}`;
  }
}
