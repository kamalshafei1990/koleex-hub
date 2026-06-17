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

import { useState } from "react";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import FactoryIcon from "@/components/icons/ui/FactoryIcon";
import StarIcon from "@/components/icons/ui/StarIcon";
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
  const [adding, setAdding] = useState("");

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
    setAdding("");
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

      {/* Add a supplier — picks from existing suppliers (Suppliers app). */}
      <div className="flex items-center gap-2">
        <select
          value={adding}
          onChange={(e) => add(e.target.value)}
          disabled={available.length === 0}
          className={`${inp} max-w-xs disabled:opacity-40`}
        >
          <option value="">{available.length ? "Link a supplier…" : "All suppliers already linked"}</option>
          {available.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-ghost)]">
          <PlusIcon className="h-3 w-3" /> from the Suppliers app
        </span>
      </div>
    </div>
  );
}
