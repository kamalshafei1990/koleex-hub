"use client";

/* ---------------------------------------------------------------------------
   ShippingDocumentsManager — admin UI for the international-trade
   documents master list. Same visual grammar as the other Workspace
   managers (Payment Terms / Incoterms / Pricing Tiers / Shipping
   Methods). Category filter chips at the top, per-row card below
   with code, name, applicable transport modes, issued-by chip, and
   the three trade-context flags (mandatory / L/C-required / customs-
   required) when set.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

interface DocRow {
  id: string;
  tenant_id: string | null;
  code: string;
  name: string;
  short_name: string | null;
  description: string | null;
  category: "transport" | "commercial" | "customs" | "quality" | "special" | "financial" | "other";
  applies_to_modes: string[];
  issued_by: "seller" | "buyer" | "third_party" | "bank" | "customs" | "any" | null;
  is_mandatory_export: boolean;
  is_lc_required: boolean;
  is_customs_required: boolean;
  notes: string | null;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  is_default: boolean;
}

const CATEGORY_META: Record<DocRow["category"], { label: string; chip: string }> = {
  transport:  { label: "Transport",  chip: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  commercial: { label: "Commercial", chip: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  customs:    { label: "Customs",    chip: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  quality:    { label: "Quality",    chip: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  special:    { label: "Special",    chip: "bg-pink-500/15 text-pink-400 border-pink-500/30" },
  financial:  { label: "Financial",  chip: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  other:      { label: "Other",      chip: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
};

export default function ShippingDocumentsManager({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [rows, setRows] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<DocRow["category"] | "all">("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shipping-documents", { credentials: "include" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Load failed (${res.status})`);
        return;
      }
      const json = (await res.json()) as { rows: DocRow[] };
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
      if (activeCategory !== "all" && r.category !== activeCategory) return false;
      if (!needle) return true;
      return (
        `${r.code} ${r.name} ${r.short_name ?? ""} ${r.description ?? ""}`.toLowerCase()
      ).includes(needle);
    });
  }, [rows, search, activeCategory]);

  const totals = useMemo(() => {
    const byCat: Record<string, number> = {};
    for (const r of rows) byCat[r.category] = (byCat[r.category] ?? 0) + 1;
    return { all: rows.length, byCat, custom: rows.filter((r) => !r.is_system).length };
  }, [rows]);

  return (
    <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold text-[var(--text-primary)] mb-1">
            Shipping Documents
          </h2>
          <p className="text-[12px] text-[var(--text-dim)]">
            Master list for the &ldquo;Documents Provided&rdquo; multi-select on every
            Quotation and Invoice. {totals.all} documents
            {totals.custom > 0 && (
              <> · <span className="text-[var(--text-primary)]">{totals.custom}</span> custom</>
            )}.
          </p>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold bg-[var(--bg-inverted)] text-[var(--text-inverted)] rounded-lg hover:opacity-90 transition"
            onClick={() => alert("Custom-document editor coming next.")}
          >
            <PlusIcon size={14} />
            Add Custom Document
          </button>
        )}
      </div>

      <div className="relative mb-4">
        <SearchIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, short code, or category (B/L, CI, CO, fumigation…)"
          className="w-full h-10 pl-9 pr-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] outline-none focus:border-[var(--border-strong)]"
        />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-5">
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
            activeCategory === "all"
              ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-[var(--bg-inverted)]"
              : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
          }`}
        >
          All ({totals.all})
        </button>
        {(Object.keys(CATEGORY_META) as DocRow["category"][]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActiveCategory(c)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
              activeCategory === c
                ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-[var(--bg-inverted)]"
                : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
            }`}
          >
            {CATEGORY_META[c].label} ({totals.byCat[c] ?? 0})
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-[var(--text-dim)]">
          <SpinnerIcon className="h-4 w-4 animate-spin" />
          <span className="text-[13px]">Loading documents…</span>
        </div>
      )}
      {!loading && error && (
        <div className="py-16 text-center text-[13px] text-red-400">{error}</div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {view.map((row) => <DocCard key={row.id} row={row} />)}
        </div>
      )}
    </section>
  );
}

function DocCard({ row }: { row: DocRow }) {
  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl p-3 hover:border-[var(--border-strong)] transition">
      <div className="flex items-start gap-3">
        <div className="shrink-0 min-w-[64px] flex flex-col items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] py-2 px-3">
          <div className="text-[12px] font-mono font-bold tracking-wide text-[var(--text-primary)]">
            {row.short_name ?? row.code.toUpperCase()}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">{row.name}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${CATEGORY_META[row.category].chip}`}>
              {CATEGORY_META[row.category].label}
            </span>
            {row.is_system && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-500/15 text-zinc-400 font-bold tracking-wide">
                SYSTEM
              </span>
            )}
            {row.is_default && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] font-bold tracking-wide">
                DEFAULT
              </span>
            )}
          </div>
          {row.description && (
            <p className="text-[11px] text-[var(--text-dim)] mb-2">{row.description}</p>
          )}
          <div className="flex flex-wrap gap-1">
            {row.is_mandatory_export && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                Mandatory export
              </span>
            )}
            {row.is_lc_required && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                L/C required
              </span>
            )}
            {row.is_customs_required && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                Customs required
              </span>
            )}
            {row.issued_by && row.issued_by !== "any" && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-[var(--border-subtle)] text-[var(--text-dim)] capitalize">
                Issued by {row.issued_by.replace("_", " ")}
              </span>
            )}
            {row.applies_to_modes.length > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-[var(--border-subtle)] text-[var(--text-dim)] capitalize">
                {row.applies_to_modes.join(" · ")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
