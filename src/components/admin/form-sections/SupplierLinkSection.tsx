"use client";

/* ---------------------------------------------------------------------------
   SupplierLinkSection — the product↔supplier LINK control.

   Supplier master data (name, logo, country, contacts, ratings…) lives in
   the Suppliers app and is shown here READ-ONLY, pulled from the supplier
   list. This control only edits the per-product facts that belong on the
   product_suppliers link: supplier code, MOQ, lead time, unit cost, payment
   terms, notes, and which supplier is primary. No supplier-master field is
   duplicated or editable here.
   --------------------------------------------------------------------------- */

import { useState, useEffect, useMemo, useRef } from "react";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import FactoryIcon from "@/components/icons/ui/FactoryIcon";
import StarIcon from "@/components/icons/ui/StarIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import type { ProductSupplierFormState } from "@/types/product-form";

interface SupplierOption { id: string; name: string; logo: string | null }

interface Props {
  links: ProductSupplierFormState[];
  suppliers: SupplierOption[];
  onChange: (links: ProductSupplierFormState[]) => void;
}

const lbl = "block text-[11px] font-medium text-[var(--text-faint)] mb-1";
const inp =
  "w-full h-9 px-3 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]";

export default function SupplierLinkSection({ links, suppliers, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const linkedIds = new Set(links.map((l) => l.supplier_id));
  const available = suppliers.filter((s) => !linkedIds.has(s.id));
  const nameOf = (id: string) => suppliers.find((s) => s.id === id)?.name || "(unknown supplier)";
  const logoOf = (id: string) => suppliers.find((s) => s.id === id)?.logo || null;

  const add = (supplierId: string) => {
    if (!supplierId || linkedIds.has(supplierId)) return;
    const isFirst = links.length === 0;
    onChange([
      ...links,
      {
        _tempId: crypto.randomUUID(),
        supplier_id: supplierId,
        is_primary: isFirst, // first link defaults to primary
        supplier_product_code: "",
        moq: "",
        lead_time_days: "",
        unit_cost_cny: "",
        currency: "CNY",
        payment_terms: "",
        notes: "",
      },
    ]);
    setPickerOpen(false);
  };

  const update = (tempId: string, patch: Partial<ProductSupplierFormState>) =>
    onChange(links.map((l) => (l._tempId === tempId ? { ...l, ...patch } : l)));

  const remove = (tempId: string) => onChange(links.filter((l) => l._tempId !== tempId));

  /* Marking a link primary unmarks the others — at most one primary. */
  const setPrimary = (tempId: string) =>
    onChange(links.map((l) => ({ ...l, is_primary: l._tempId === tempId })));

  return (
    <div className="space-y-3">
      {links.length === 0 ? (
        <p className="text-[12px] text-[var(--text-ghost)] py-5 text-center border border-dashed border-[var(--border-subtle)] rounded-xl">
          No supplier linked yet. Link a supplier from the Suppliers app below.
        </p>
      ) : (
        <div className="space-y-3">
          {links.map((l) => {
            const logo = logoOf(l.supplier_id);
            return (
              <div key={l._tempId} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 space-y-3">
                {/* Header: read-only supplier identity (from Suppliers app) + actions */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden shrink-0">
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logo} alt="" className="h-full w-full object-contain p-0.5" />
                      ) : (
                        <FactoryIcon className="h-4 w-4 text-[var(--text-ghost)]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{nameOf(l.supplier_id)}</div>
                      <div className="text-[10px] text-[var(--text-ghost)]">Managed in the Suppliers app</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPrimary(l._tempId)}
                      aria-pressed={l.is_primary}
                      title={l.is_primary ? "Primary supplier" : "Make primary"}
                      className={`h-7 px-2.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-colors ${
                        l.is_primary
                          ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent"
                          : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      <StarIcon className="h-3 w-3" /> {l.is_primary ? "Primary" : "Make primary"}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(l._tempId)}
                      aria-label="Remove supplier link"
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-[var(--state-error,#FF3333)] border border-[var(--border-subtle)] hover:border-[var(--state-error,#FF3333)]/40 transition-colors"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Per-product link fields */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className={lbl}>Supplier code</label>
                    <input className={inp} value={l.supplier_product_code} placeholder="e.g. JK-58420"
                      onChange={(e) => update(l._tempId, { supplier_product_code: e.target.value })} />
                  </div>
                  <div>
                    <label className={lbl}>MOQ</label>
                    <input className={inp} value={l.moq} inputMode="numeric" placeholder="e.g. 10"
                      onChange={(e) => update(l._tempId, { moq: e.target.value.replace(/[^0-9]/g, "") })} />
                  </div>
                  <div>
                    <label className={lbl}>Lead time (days)</label>
                    <input className={inp} value={l.lead_time_days} inputMode="numeric" placeholder="e.g. 30"
                      onChange={(e) => update(l._tempId, { lead_time_days: e.target.value.replace(/[^0-9]/g, "") })} />
                  </div>
                  <div>
                    <label className={lbl}>Unit cost</label>
                    <input className={inp} value={l.unit_cost_cny} inputMode="decimal" placeholder="e.g. 1850"
                      onChange={(e) => update(l._tempId, { unit_cost_cny: e.target.value.replace(/[^0-9.]/g, "") })} />
                  </div>
                  <div>
                    <label className={lbl}>Currency</label>
                    <select className={inp} value={l.currency} onChange={(e) => update(l._tempId, { currency: e.target.value })}>
                      <option value="CNY">CNY</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="AED">AED</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Payment terms</label>
                    <input className={inp} value={l.payment_terms} placeholder="e.g. 30% TT, 70% on shipment"
                      onChange={(e) => update(l._tempId, { payment_terms: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Notes</label>
                  <input className={inp} value={l.notes} placeholder="Sourcing notes specific to this product…"
                    onChange={(e) => update(l._tempId, { notes: e.target.value })} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add a supplier — opens a searchable picker (89+ suppliers). */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={available.length === 0}
          className="h-9 px-3.5 inline-flex items-center gap-2 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <PlusIcon className="h-3.5 w-3.5" /> {available.length ? "Link a supplier" : "All suppliers linked"}
        </button>
        <span className="text-[10px] text-[var(--text-ghost)]">from the Suppliers app</span>
      </div>

      {pickerOpen && (
        <SupplierPickerModal
          suppliers={available}
          onPick={add}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Searchable supplier picker — modal with live filter + keyboard control.
   Esc closes, ↑/↓ move, Enter selects. Brand: monochrome + single blue accent.
   --------------------------------------------------------------------------- */
function SupplierPickerModal({
  suppliers,
  onPick,
  onClose,
}: {
  suppliers: SupplierOption[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => s.name.toLowerCase().includes(q));
  }, [query, suppliers]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      else if (e.key === "Enter") { e.preventDefault(); const s = filtered[active]; if (s) onPick(s.id); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, active, onClose, onPick]);

  /* Keep the highlighted row in view as you arrow through. */
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center p-4 pt-[12vh] bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Link a supplier"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header + search */}
        <div className="p-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center justify-between mb-2.5 px-1">
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Link a supplier</h3>
            <button type="button" onClick={onClose} aria-label="Close" className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors">
              <CrossIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-dim)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search suppliers by name…"
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
            />
          </div>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[44vh] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="text-[12px] text-[var(--text-ghost)] text-center py-8">No suppliers match “{query}”.</p>
          ) : (
            filtered.map((s, i) => (
              <button
                key={s.id}
                type="button"
                data-idx={i}
                onMouseEnter={() => setActive(i)}
                onClick={() => onPick(s.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                  i === active ? "bg-[var(--bg-surface)]" : "hover:bg-[var(--bg-surface)]"
                }`}
              >
                <div className="h-8 w-8 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden shrink-0">
                  {s.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logo} alt="" className="h-full w-full object-contain p-0.5" />
                  ) : (
                    <FactoryIcon className="h-4 w-4 text-[var(--text-ghost)]" />
                  )}
                </div>
                <span className="text-[13px] text-[var(--text-primary)] truncate">{s.name}</span>
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-3.5 py-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] text-[var(--text-ghost)]">
          <span>{filtered.length} of {suppliers.length} suppliers</span>
          <span>↑↓ to navigate · ↵ to link · esc to close</span>
        </div>
      </div>
    </div>
  );
}
