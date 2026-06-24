"use client";

/* ---------------------------------------------------------------------------
   ProductPicker — a grid browser for linking products to a task.

   Photo + name + code cards, searchable by name/code and filterable by
   division and category. Multi-select (click a card to toggle); selected
   cards get an accent ring + check. Opens above the Task modal.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import type { TodoProductRef, ProductRow, DivisionRow, CategoryRow } from "@/types/supabase";
import { fetchProducts, fetchDivisions, fetchCategories } from "@/lib/products-admin";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type Pick = {
  id: string;
  name: string;
  code: string | null;
  image: string | null;
  division_slug: string;
  category_slug: string;
};

export default function ProductPicker({
  open,
  selectedIds,
  onToggle,
  onClose,
}: {
  open: boolean;
  selectedIds: string[];
  onToggle: (ref: TodoProductRef) => void;
  onClose: () => void;
}) {
  const [products, setProducts] = useState<Pick[]>([]);
  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [div, setDiv] = useState("");
  const [cat, setCat] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const thumbsP = fetch("/api/products/media-thumbs", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { thumbs: {} }))
      .then((j: { thumbs?: Record<string, string> }) => j.thumbs ?? {})
      .catch(() => ({} as Record<string, string>));
    Promise.all([fetchProducts(), fetchDivisions(), fetchCategories(), thumbsP])
      .then(([prods, divs, cats, thumbs]) => {
        if (cancelled) return;
        setProducts(
          (prods as ProductRow[]).map((p) => ({
            id: p.id,
            name: p.product_name,
            code: p.internal_sku ?? p.legacy_code ?? null,
            image: thumbs[p.id] ?? p.hero_poster_url ?? p.og_image_url ?? null,
            division_slug: p.division_slug,
            category_slug: p.category_slug,
          })),
        );
        setDivisions(divs);
        setCategories(cats);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open]);

  /* Categories shown in the dropdown are scoped to the chosen division. */
  const divisionId = useMemo(
    () => divisions.find((d) => d.slug === div)?.id ?? null,
    [divisions, div],
  );
  const visibleCategories = useMemo(
    () => (divisionId ? categories.filter((c) => c.division_id === divisionId) : categories),
    [categories, divisionId],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products
      .filter((p) => {
        if (div && p.division_slug !== div) return false;
        if (cat && p.category_slug !== cat) return false;
        if (needle && !(p.name.toLowerCase().includes(needle) || (p.code || "").toLowerCase().includes(needle)))
          return false;
        return true;
      })
      // Photos first so the grid opens on real product imagery, not the
      // placeholder cards (products without a photo sink to the bottom).
      .sort((a, b) => (a.image ? 0 : 1) - (b.image ? 0 : 1));
  }, [products, q, div, cat]);

  if (!open) return null;

  const sel = new Set(selectedIds);
  const selectStyle =
    "h-9 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-3 md:p-4 pt-[4vh] bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl bg-[var(--bg-elevated,var(--bg-primary))] border border-[var(--border-subtle)] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 md:px-5 py-3.5 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <PackageIcon className="h-4 w-4 text-[var(--text-dim)]" />
            <span className="text-[14px] font-semibold text-[var(--text-primary)]">Link products</span>
            {selectedIds.length > 0 && (
              <span className="text-[11px] font-semibold text-[var(--accent)]">{selectedIds.length} selected</span>
            )}
          </div>
          <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:bg-[var(--bg-inverted)]/[0.06] hover:text-[var(--text-primary)]">
            <CrossIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 md:px-5 py-3 border-b border-[var(--border-subtle)]">
          <div className="relative flex-1 min-w-[180px]">
            <SearchIcon className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
            <input
              autoFocus
              className="w-full h-9 ps-9 pe-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
              placeholder="Search by name or code…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select className={selectStyle} value={div} onChange={(e) => { setDiv(e.target.value); setCat(""); }}>
            <option value="">All divisions</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.slug}>{d.name}</option>
            ))}
          </select>
          <select className={selectStyle} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">All categories</option>
            {visibleCategories.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5">
          {loading ? (
            <div className="h-40 flex items-center justify-center text-[var(--text-dim)]">
              <SpinnerIcon className="h-5 w-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="h-40 flex items-center justify-center text-[12px] text-[var(--text-ghost)]">No products match.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map((p) => {
                const isSel = sel.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onToggle({ id: p.id, name: p.name, code: p.code })}
                    className={`group relative text-start rounded-xl border overflow-hidden transition-all ${
                      isSel
                        ? "border-[var(--accent)] ring-1 ring-[var(--accent)]"
                        : "border-[var(--border-subtle)] hover:border-[var(--border-focus)]"
                    } bg-[var(--bg-surface)]`}
                  >
                    <div className="aspect-square w-full bg-white flex items-center justify-center overflow-hidden p-2">
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image} alt={p.name} className="max-h-full max-w-full object-contain" />
                      ) : (
                        <PackageIcon className="h-8 w-8 text-black/20" />
                      )}
                    </div>
                    {isSel && (
                      <span className="absolute top-1.5 end-1.5 h-5 w-5 rounded-full bg-[var(--accent)] text-white inline-flex items-center justify-center shadow">
                        <CheckIcon className="h-3 w-3" />
                      </span>
                    )}
                    <div className="p-2">
                      <p className="text-[12px] font-medium text-[var(--text-primary)] truncate" title={p.name}>{p.name}</p>
                      {p.code && <p className="text-[10.5px] text-[var(--text-dim)] truncate">{p.code}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-4 md:px-5 py-3 border-t border-[var(--border-subtle)]">
          <span className="text-[11px] text-[var(--text-ghost)]">{loading ? "" : `${filtered.length} product${filtered.length === 1 ? "" : "s"}`}</span>
          <button onClick={onClose} className="h-9 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
