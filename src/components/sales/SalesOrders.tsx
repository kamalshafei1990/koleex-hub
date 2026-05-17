"use client";

/* ---------------------------------------------------------------------------
   /sales/orders — Sales Order list (Phase O.4.1).

   Minimal but useful daily-operations surface:
     · search by SO number or customer name (debounced)
     · status filter chips (with counts)
     · date filter (created since)
     · columns: SO # · customer · status · ordered / shipped / remaining ·
                created
     · row click → SO detail page
     · header "+ Ship" link goes to detail flow; per-row Ship button
       opens an inline dialog for fast partial shipments without
       leaving the list
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import RrIcon from "@/components/ui/RrIcon";
import {
  InventoryEmpty,
  Panel,
  StatusBadge,
} from "@/components/inventory/InventoryUi";
import ShipDialog from "@/components/sales/ShipDialog";

interface SoRow {
  id: string;
  so_no: string | null;
  customer_id: string | null;
  customer_name: string | null;
  status: "draft" | "confirmed" | "partial" | "shipped" | "closed" | "cancelled";
  currency: string;
  qty_ordered: number;
  qty_shipped: number;
  qty_remaining: number;
  line_count: number;
  created_at: string;
}

type StatusKey = "" | "draft" | "confirmed" | "partial" | "shipped" | "cancelled";

const STATUS_CHIPS: Array<{ key: StatusKey; label: string }> = [
  { key: "",          label: "All" },
  { key: "draft",     label: "Draft" },
  { key: "confirmed", label: "Confirmed" },
  { key: "partial",   label: "Partial" },
  { key: "shipped",   label: "Shipped" },
  { key: "cancelled", label: "Cancelled" },
];

type DateRangeKey = "all" | "30d" | "90d" | "1y";
const DATE_RANGES: Array<{ key: DateRangeKey; label: string }> = [
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "1y",  label: "Last year" },
  { key: "all", label: "All time" },
];

function sinceFor(range: DateRangeKey): string | undefined {
  if (range === "all") return undefined;
  const now = new Date();
  const d = new Date(now);
  if (range === "30d") d.setDate(now.getDate() - 30);
  if (range === "90d") d.setDate(now.getDate() - 90);
  if (range === "1y")  d.setFullYear(now.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function fmtQty(n: number) {
  return Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export default function SalesOrders() {
  const [rows, setRows] = useState<SoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [searchKey, setSearchKey] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusKey>("");
  const [dateRange, setDateRange] = useState<DateRangeKey>("90d");

  const [shipSoId, setShipSoId] = useState<string | null>(null);

  /* Debounce search. */
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setSearchKey(search.trim()), 250);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("limit", "200");
      if (searchKey) qs.set("q", searchKey);
      if (filterStatus) qs.set("status", filterStatus);
      const since = sinceFor(dateRange);
      if (since) qs.set("since", since);
      const r = await fetch(`/api/sales/orders?${qs.toString()}`, { credentials: "include", cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `Failed (${r.status})`);
      setRows((j.orders ?? []) as SoRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [searchKey, filterStatus, dateRange]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    const m = new Map<StatusKey, number>();
    for (const r of rows) {
      const k = r.status as StatusKey;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    m.set("", rows.length);
    return m;
  }, [rows]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        {/* Page bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              aria-label="Back to Hub"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
            >
              <RrIcon name="arrow-left" size={16} />
            </Link>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)]">
              <RrIcon name="file-invoice" size={16} />
            </div>
            <div className="flex min-w-0 items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight md:text-[22px]">Sales Orders</h1>
              <p className="hidden text-[12px] text-[var(--text-dim)] sm:block">
                Order → shipment → inventory OUT.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/sales"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[12px] hover:bg-white/[0.06]"
            >
              Sales Hub
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </div>
        )}

        {/* Filter bar */}
        <Panel className="px-3 py-2.5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col">
              <span className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Search</span>
              <span className="relative">
                <span aria-hidden className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-gray-500">
                  <RrIcon name="search" size={12} />
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="SO # or customer…"
                  className="w-[260px] rounded-md border border-white/[0.06] bg-[var(--bg-primary)] py-1.5 pl-7 pr-2 text-[12px]"
                />
              </span>
            </label>
            <label className="flex flex-col">
              <span className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Created</span>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRangeKey)}
                className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
              >
                {DATE_RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </label>
            <div className="ml-auto self-end text-[11px] text-gray-500 tabular-nums">
              {loading ? "…" : `${rows.length} order${rows.length === 1 ? "" : "s"}`}
            </div>
          </div>

          {/* Status filter chips */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11.5px]">
            {STATUS_CHIPS.map((c) => {
              const isActive = filterStatus === c.key;
              const n = counts.get(c.key) ?? 0;
              return (
                <button
                  key={c.key || "all"}
                  onClick={() => setFilterStatus(c.key)}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 transition-colors ${
                    isActive ? "border-white/[0.14] bg-white/[0.06] text-[var(--text-primary)]" : "border-white/[0.06] text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {c.label}
                  <span className="text-gray-500 tabular-nums">{n}</span>
                </button>
              );
            })}
          </div>
        </Panel>

        {/* Orders table */}
        <Panel>
          <table className="min-w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
                <th className="px-4 py-2 text-left">SO #</th>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Ordered</th>
                <th className="px-4 py-2 text-right">Shipped</th>
                <th className="px-4 py-2 text-right">Remaining</th>
                <th className="px-4 py-2 text-left">Created</th>
                <th className="px-4 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-[11px] text-gray-600">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-0 py-0">
                  <InventoryEmpty
                    title={searchKey || filterStatus ? "No orders match the filters" : "No sales orders yet"}
                    hint={searchKey || filterStatus ? "Try clearing the filters or expanding the date range." : "Sales orders typically come from a confirmed quotation."}
                  />
                </td></tr>
              ) : (
                rows.map((s) => {
                  const canShip = s.status === "confirmed" || s.status === "partial";
                  const pct = s.qty_ordered > 0 ? Math.min(100, Math.round((s.qty_shipped / s.qty_ordered) * 100)) : 0;
                  return (
                    <tr key={s.id} className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02]">
                      <td className="px-4 py-2 font-mono text-[11.5px] text-gray-200 whitespace-nowrap">
                        <Link href={`/sales/orders/${s.id}`} className="hover:text-[var(--text-primary)]">
                          {s.so_no ?? s.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-gray-200">{s.customer_name ?? <span className="text-gray-500">—</span>}</td>
                      <td className="px-4 py-2"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-2 text-right tabular-nums font-mono text-gray-300">{fmtQty(s.qty_ordered)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-mono text-gray-400">{fmtQty(s.qty_shipped)}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="inline-flex flex-col items-end gap-1">
                          <span className="tabular-nums font-mono">{fmtQty(s.qty_remaining)}</span>
                          {s.qty_ordered > 0 && (
                            <span aria-hidden className="h-1 w-16 overflow-hidden rounded-full bg-white/[0.05]">
                              <span className="block h-full bg-emerald-400/50" style={{ width: `${pct}%` }} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-[11px] text-gray-500 whitespace-nowrap">{s.created_at.slice(0, 10)}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          {canShip && (
                            <button
                              onClick={() => setShipSoId(s.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-white/[0.10] bg-white/[0.04] px-2 py-1 text-[11px] hover:bg-white/[0.08]"
                            >
                              <RrIcon name="truck-side" size={11} /> Ship
                            </button>
                          )}
                          <Link
                            href={`/sales/orders/${s.id}`}
                            className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] px-2 py-1 text-[11px] text-gray-400 hover:text-gray-200"
                          >
                            Open
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Panel>
      </div>

      {shipSoId && (
        <ShipDialog
          soId={shipSoId}
          onClose={() => setShipSoId(null)}
          onSuccess={() => { setShipSoId(null); void load(); }}
        />
      )}
    </div>
  );
}
