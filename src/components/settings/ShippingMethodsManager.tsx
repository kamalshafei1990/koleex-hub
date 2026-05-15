"use client";

/* ---------------------------------------------------------------------------
   ShippingMethodsManager — admin UI for the "Sent by …" master list.

   Same visual grammar as the other Workspace managers. Each row shows:
     · A mode-coloured badge (sea = blue, air = sky, road = amber,
       rail = violet, courier = pink, multimodal = emerald, other = zinc)
     · Name + sub-type
     · Typical transit window (e.g. "18–35 days")
     · Speed + cost tier chips
     · Documents the shipment needs
     · Capability flags (DG / refrigerated / oversized)
     · Common carriers
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

interface ShippingMethodRow {
  id: string;
  tenant_id: string | null;
  code: string;
  name: string;
  short_name: string | null;
  description: string | null;
  mode: "sea" | "air" | "road" | "rail" | "multimodal" | "courier" | "other";
  sub_type: string | null;
  typical_transit_days_min: number | null;
  typical_transit_days_max: number | null;
  cost_tier: "low" | "medium" | "high" | "very_high" | null;
  speed_tier: "slow" | "medium" | "fast" | "express" | null;
  documents: string[];
  has_tracking: boolean;
  tracking_url_template: string | null;
  supports_dangerous_goods: boolean;
  supports_refrigerated: boolean;
  supports_oversized: boolean;
  supports_hazmat: boolean;
  common_carriers: string[];
  notes: string | null;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  is_default: boolean;
}

const MODE_META: Record<ShippingMethodRow["mode"], { label: string; chip: string }> = {
  sea:        { label: "Sea",        chip: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  air:        { label: "Air",        chip: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  road:       { label: "Road",       chip: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  rail:       { label: "Rail",       chip: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  multimodal: { label: "Multimodal", chip: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  courier:    { label: "Courier",    chip: "bg-pink-500/15 text-pink-400 border-pink-500/30" },
  other:      { label: "Other",      chip: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
};

const COST_LABEL: Record<NonNullable<ShippingMethodRow["cost_tier"]>, string> = {
  low: "$ Low cost",
  medium: "$$ Medium cost",
  high: "$$$ High cost",
  very_high: "$$$$ Very high",
};
const SPEED_LABEL: Record<NonNullable<ShippingMethodRow["speed_tier"]>, string> = {
  slow: "Slow",
  medium: "Medium speed",
  fast: "Fast",
  express: "Express",
};

export default function ShippingMethodsManager({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [rows, setRows] = useState<ShippingMethodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeMode, setActiveMode] = useState<ShippingMethodRow["mode"] | "all">("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shipping-methods", { credentials: "include" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Load failed (${res.status})`);
        return;
      }
      const json = (await res.json()) as { rows: ShippingMethodRow[] };
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
    return rows.filter((r) => {
      if (activeMode !== "all" && r.mode !== activeMode) return false;
      if (!needle) return true;
      const hay = `${r.code} ${r.name} ${r.short_name ?? ""} ${r.description ?? ""} ${r.common_carriers.join(" ")}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, search, activeMode]);

  const totals = useMemo(() => {
    const byMode = Object.keys(MODE_META).reduce((acc, m) => {
      acc[m as ShippingMethodRow["mode"]] = rows.filter((r) => r.mode === m).length;
      return acc;
    }, {} as Record<ShippingMethodRow["mode"], number>);
    return { all: rows.length, byMode, custom: rows.filter((r) => !r.is_system).length };
  }, [rows]);

  return (
    <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold text-[var(--text-primary)] mb-1">
            Shipping Methods
          </h2>
          <p className="text-[12px] text-[var(--text-dim)]">
            How goods leave the warehouse. The Quotation editor pulls this list
            for the &ldquo;Sent by …&rdquo; selector and the shipment record uses
            it for tracking + documents. {totals.all} methods
            {totals.custom > 0 && (
              <> · <span className="text-[var(--text-primary)]">{totals.custom}</span> custom</>
            )}.
          </p>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold bg-[var(--bg-inverted)] text-[var(--text-inverted)] rounded-lg hover:opacity-90 transition"
            onClick={() => alert("Custom shipping method editor coming next.")}
          >
            <PlusIcon size={14} />
            Add Custom Method
          </button>
        )}
      </div>

      <div className="relative mb-4">
        <SearchIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by mode, carrier, or sub-type (FCL, DHL, RoRo…)"
          className="w-full h-10 pl-9 pr-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] outline-none focus:border-[var(--border-strong)]"
        />
      </div>

      {/* Mode filter chips */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        <button
          type="button"
          onClick={() => setActiveMode("all")}
          className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
            activeMode === "all"
              ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-[var(--bg-inverted)]"
              : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
          }`}
        >
          All ({totals.all})
        </button>
        {(Object.keys(MODE_META) as ShippingMethodRow["mode"][]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setActiveMode(m)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
              activeMode === m
                ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-[var(--bg-inverted)]"
                : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
            }`}
          >
            {MODE_META[m].label} ({totals.byMode[m]})
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-[var(--text-dim)]">
          <SpinnerIcon className="h-4 w-4 animate-spin" />
          <span className="text-[13px]">Loading shipping methods…</span>
        </div>
      )}
      {!loading && error && (
        <div className="py-16 text-center text-[13px] text-red-400">{error}</div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {view.map((row) => (
            <ShippingMethodCard key={row.id} row={row} />
          ))}
          {view.length === 0 && (
            <div className="col-span-full py-12 text-center text-[var(--text-dim)] text-[13px]">
              No methods match {search ? `"${search}"` : "this filter"}.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ShippingMethodCard({ row }: { row: ShippingMethodRow }) {
  const transit =
    row.typical_transit_days_min != null && row.typical_transit_days_max != null
      ? row.typical_transit_days_min === row.typical_transit_days_max
        ? `${row.typical_transit_days_min} day${row.typical_transit_days_min === 1 ? "" : "s"}`
        : `${row.typical_transit_days_min}–${row.typical_transit_days_max} days`
      : null;

  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl p-3 hover:border-[var(--border-strong)] transition">
      <div className="flex items-start gap-3">
        {/* Mode badge */}
        <div className={`shrink-0 w-14 h-14 flex flex-col items-center justify-center rounded-lg border ${MODE_META[row.mode].chip}`}>
          <div className="text-[10px] font-bold uppercase tracking-wider">
            {MODE_META[row.mode].label}
          </div>
          {row.sub_type && (
            <div className="text-[8px] uppercase tracking-wider opacity-70">
              {row.sub_type}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
              {row.name}
            </span>
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
          </div>

          {/* Transit + speed + cost */}
          <div className="flex flex-wrap gap-1 mb-2">
            {transit && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)]">
                <span className="font-bold">{transit}</span>{" "}
                <span className="opacity-70">transit</span>
              </span>
            )}
            {row.speed_tier && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-sky-500/30 bg-sky-500/10 text-sky-400">
                {SPEED_LABEL[row.speed_tier]}
              </span>
            )}
            {row.cost_tier && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                {COST_LABEL[row.cost_tier]}
              </span>
            )}
            {row.has_tracking && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-dim)]">
                ✓ Tracking
              </span>
            )}
          </div>

          {row.description && (
            <p className="text-[11px] text-[var(--text-dim)] mb-2">{row.description}</p>
          )}

          {/* Capabilities */}
          {(row.supports_dangerous_goods || row.supports_refrigerated || row.supports_oversized) && (
            <div className="flex flex-wrap gap-1 mb-2">
              {row.supports_dangerous_goods && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400">
                  DG / hazmat
                </span>
              )}
              {row.supports_refrigerated && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                  Refrigerated
                </span>
              )}
              {row.supports_oversized && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400">
                  Oversized
                </span>
              )}
            </div>
          )}

          {/* Documents */}
          {row.documents && row.documents.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              <span className="text-[9px] text-[var(--text-dim)] uppercase tracking-wider mr-1 mt-0.5">Docs:</span>
              {row.documents.map((d) => (
                <span
                  key={d}
                  className="text-[9px] px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-dim)]"
                >
                  {d}
                </span>
              ))}
            </div>
          )}

          {/* Carriers */}
          {row.common_carriers && row.common_carriers.length > 0 && (
            <p className="text-[10px] text-[var(--text-dim)]">
              <span className="uppercase tracking-wider opacity-70">Carriers:</span>{" "}
              {row.common_carriers.join(" · ")}
            </p>
          )}

          {row.notes && (
            <p className="text-[11px] text-[var(--text-dim)] italic mt-1">{row.notes}</p>
          )}
        </div>
      </div>
    </div>
  );
}
