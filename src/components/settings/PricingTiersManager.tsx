"use client";

/* ---------------------------------------------------------------------------
   PricingTiersManager — admin UI for internal pricing tiers
   (List / Wholesale / Distributor / Dealer / Agent / End-User /
   Project / Spot / Promotional / Internal Cost).

   The tier drives:
     · which discount column to pull on a quote
     · the default minimum margin
     · whether the quote needs approval before going out
     · whether the line is internal-only (Cost) and must never reach
       a customer-facing PDF
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

interface PricingTierRow {
  id: string;
  tenant_id: string | null;
  code: string;
  name: string;
  short_name: string | null;
  description: string | null;
  default_discount_pct: number;
  min_margin_pct: number | null;
  customer_types: string[];
  is_internal_only: boolean;
  requires_approval: boolean;
  approval_threshold: number | null;
  notes: string | null;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  is_default: boolean;
}

export default function PricingTiersManager({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [rows, setRows] = useState<PricingTierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pricing-tiers", { credentials: "include" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Load failed (${res.status})`);
        return;
      }
      const json = (await res.json()) as { rows: PricingTierRow[] };
      setRows(json.rows ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const view = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      (r.code + " " + r.name + " " + (r.short_name ?? "") + " " + (r.description ?? "")).toLowerCase().includes(needle),
    );
  }, [rows, search]);

  const totals = useMemo(() => ({
    all: rows.length,
    custom: rows.filter((r) => !r.is_system).length,
    internal: rows.filter((r) => r.is_internal_only).length,
  }), [rows]);

  return (
    <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold text-[var(--text-primary)] mb-1">
            Pricing Tiers
          </h2>
          <p className="text-[12px] text-[var(--text-dim)]">
            Internal who-is-buying tiers. Each tier carries a default discount
            vs list, a minimum margin floor, and approval thresholds. {totals.all} tiers
            {totals.custom > 0 && (
              <> · <span className="text-[var(--text-primary)]">{totals.custom}</span> custom</>
            )}
            {totals.internal > 0 && (
              <> · <span className="text-[var(--text-primary)]">{totals.internal}</span> internal-only</>
            )}.
          </p>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold bg-[var(--bg-inverted)] text-[var(--text-inverted)] rounded-lg hover:opacity-90 transition"
            onClick={() => alert("Custom-tier editor coming next.")}
          >
            <PlusIcon size={14} />
            Add Custom Tier
          </button>
        )}
      </div>

      <div className="relative mb-4">
        <SearchIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by tier name or code (distributor, dealer, list, project…)"
          className="w-full h-10 pl-9 pr-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] outline-none focus:border-[var(--border-strong)]"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-[var(--text-dim)]">
          <SpinnerIcon className="h-4 w-4 animate-spin" />
          <span className="text-[13px]">Loading pricing tiers…</span>
        </div>
      )}
      {!loading && error && (
        <div className="py-16 text-center text-[13px] text-red-400">{error}</div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {view.map((row) => <TierCard key={row.id} row={row} />)}
        </div>
      )}
    </section>
  );
}

function TierCard({ row }: { row: PricingTierRow }) {
  const discount = Number(row.default_discount_pct ?? 0);
  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl p-3 hover:border-[var(--border-strong)] transition">
      <div className="flex items-start gap-3">
        {/* Discount badge — the headline number for this tier. */}
        <div className="shrink-0 min-w-[64px] flex flex-col items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] py-2 px-3">
          <div
            className={`text-[14px] font-mono font-bold tracking-wide ${
              discount === 0 ? "text-[var(--text-primary)]"
                : discount < 0 ? "text-emerald-400"
                : "text-amber-400"
            }`}
          >
            {discount > 0 ? "+" : ""}{discount}%
          </div>
          <div className="text-[8px] uppercase tracking-wider text-[var(--text-dim)]">vs list</div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">{row.name}</span>
            {row.is_default && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] font-bold tracking-wide">
                DEFAULT
              </span>
            )}
            {row.is_system && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-500/15 text-zinc-400 font-bold tracking-wide">
                SYSTEM
              </span>
            )}
            {row.is_internal_only && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-bold tracking-wide">
                INTERNAL ONLY
              </span>
            )}
            {row.requires_approval && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold tracking-wide">
                APPROVAL
                {row.approval_threshold ? ` > $${row.approval_threshold.toLocaleString()}` : ""}
              </span>
            )}
          </div>
          {row.description && (
            <p className="text-[11px] text-[var(--text-dim)] mb-2">{row.description}</p>
          )}
          <div className="flex flex-wrap gap-1 mb-1">
            {row.min_margin_pct != null && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-400">
                Min margin: {row.min_margin_pct}%
              </span>
            )}
            {row.customer_types?.map((ct) => (
              <span
                key={ct}
                className="text-[9px] px-1.5 py-0.5 rounded-full border border-[var(--border-subtle)] text-[var(--text-dim)] capitalize"
              >
                {ct.replace("_", " ")}
              </span>
            ))}
          </div>
          {row.notes && (
            <p className="text-[11px] text-[var(--text-dim)] italic mt-1">{row.notes}</p>
          )}
        </div>
      </div>
    </div>
  );
}
