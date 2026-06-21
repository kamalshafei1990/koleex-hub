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

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import FactoryIcon from "@/components/icons/ui/FactoryIcon";
import StarIcon from "@/components/icons/ui/StarIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import UploadIcon from "@/components/icons/ui/UploadIcon";
import PictureIcon from "@/components/icons/ui/PictureIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import LayoutListIcon from "@/components/icons/ui/LayoutListIcon";
import InfoIcon from "@/components/icons/ui/InfoIcon";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import { uploadProductFile, fetchSupplierNames } from "@/lib/products-admin";
import type { ProductSupplierFormState } from "@/types/product-form";

const INCOTERMS = ["EXW", "FOB", "CIF", "CFR", "DDP", "DAP"];
const SOURCING_STATUS: { value: string; label: string }[] = [
  { value: "preferred", label: "Preferred" },
  { value: "backup", label: "Backup" },
  { value: "trial", label: "Trial" },
  { value: "phasing_out", label: "Phasing out" },
];
const TOOLING_OWNERS: { value: string; label: string }[] = [
  { value: "koleex", label: "KOLEEX-owned" },
  { value: "supplier", label: "Supplier-owned" },
  { value: "shared", label: "Shared" },
];

interface SupplierContact {
  name: string | null; role: string | null; email: string | null; mobile: string | null;
}
interface SupplierOption {
  id: string; name: string; name_cn?: string | null; logo: string | null;
  /* Supplier-level defaults — source of truth for shared fields. */
  supply_type?: string | null; payment_terms?: string | null;
  currency?: string | null; moq?: string | null; lead_time?: string | null;
  /* Contact info (read-only quick-look). */
  email?: string | null; phone?: string | null; website?: string | null;
  wechat?: string | null; location?: string | null;
  primary_contact?: SupplierContact | null;
  /* Supplier profile (read-only quick-look). */
  rating?: number | null; sample_status?: string | null; employees?: string | null;
  year_established?: string | null; categories?: string[] | null; certifications?: string[] | null;
}

interface Props {
  links: ProductSupplierFormState[];
  suppliers: SupplierOption[];
  onChange: (links: ProductSupplierFormState[]) => void;
}

const lbl = "block text-[11px] font-medium text-[var(--text-faint)] mb-1";
const inp =
  "w-full h-9 px-3 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]";

export default function SupplierLinkSection({ links, suppliers, onChange }: Props) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadingQuoteId, setUploadingQuoteId] = useState<string | null>(null);
  const [infoId, setInfoId] = useState<string | null>(null);   // supplier whose info popup is open

  /* Self-healing supplier list. The form loads suppliers at mount in a big
     parallel batch with a timeout; /api/suppliers occasionally spikes to
     several seconds, so that batch sometimes hands us an empty list and the
     picker had nothing to offer (the button then wrongly said "All suppliers
     linked"). We keep a local copy synced from the prop, and if it ever
     arrives empty we fetch the directory ourselves (warm ≈ 40ms) — plus a
     manual Retry — so linking a supplier never gets stuck. */
  const [supList, setSupList] = useState<SupplierOption[]>(suppliers);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [supLoadFailed, setSupLoadFailed] = useState(false);

  useEffect(() => { if (suppliers.length) setSupList(suppliers); }, [suppliers]);

  const loadSuppliers = useCallback(async () => {
    setLoadingSuppliers(true);
    setSupLoadFailed(false);
    try {
      const list = (await fetchSupplierNames()) as unknown as SupplierOption[];
      if (list.length) setSupList(list);
      else setSupLoadFailed(true);
    } catch {
      setSupLoadFailed(true);
    } finally {
      setLoadingSuppliers(false);
    }
  }, []);

  /* If the parent handed us nothing, recover on our own. */
  useEffect(() => {
    if (suppliers.length === 0 && supList.length === 0) loadSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const linkedIds = new Set(links.map((l) => l.supplier_id));
  const available = supList.filter((s) => !linkedIds.has(s.id));
  const supOf = (id: string) => supList.find((s) => s.id === id);
  const nameOf = (id: string) => supOf(id)?.name || "(unknown supplier)";
  const nameCnOf = (id: string) => supOf(id)?.name_cn || null;
  const logoOf = (id: string) => supOf(id)?.logo || null;

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
        cost_basis: "delivered",
        cost_includes_tax: true,
        payment_terms: "",
        notes: "",
        supplier_product_name: "",
        supplier_product_photo: "",
        supply_type: "",
        sample_available: false,
        sample_cost: "",
        incoterms: "",
        supplier_warranty_months: "",
        price_tiers: [],
        price_quoted_on: "",
        price_valid_until: "",
        quotation_file_url: "",
        quotation_file_name: "",
        sourcing_status: "",
        preferred_reason: "",
        min_order_value: "",
        tooling_owner: "",
        tooling_cost: "",
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
                {/* ── Supplier identity — clear header (logo + name) + actions ── */}
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setInfoId(l.supplier_id)}
                    title="View supplier details"
                    className="group flex items-center gap-3 min-w-0 text-left rounded-lg -m-1 p-1 hover:bg-[var(--bg-inverted)]/[0.04] transition-colors"
                  >
                    <div className="h-11 w-11 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden shrink-0">
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logo} alt="" className="h-full w-full object-contain p-1" />
                      ) : (
                        <FactoryIcon className="h-5 w-5 text-[var(--text-ghost)]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[15px] font-semibold text-[var(--text-primary)] truncate">{nameOf(l.supplier_id)}</span>
                        <InfoIcon className="h-3.5 w-3.5 text-[var(--text-ghost)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                      {nameCnOf(l.supplier_id) && (
                        <div className="text-[12px] text-[var(--text-muted)] truncate">{nameCnOf(l.supplier_id)}</div>
                      )}
                      <div className="text-[10px] text-[var(--text-ghost)]">Supplier · tap for details · managed in the Suppliers app</div>
                    </div>
                  </button>
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

                {/* ── HERO — big centered product photo, then name · model · cost ── */}
                <div className="rounded-xl bg-[var(--bg-surface)]/40 border border-[var(--border-subtle)] p-4 space-y-4">
                  <SupplierPhoto
                    url={l.supplier_product_photo}
                    uploading={uploadingId === l._tempId}
                    sizeClass="h-44 w-44 sm:h-52 sm:w-52 mx-auto"
                    onPick={async (file) => {
                      setUploadingId(l._tempId);
                      const res = await uploadProductFile(file);
                      setUploadingId(null);
                      if (res) update(l._tempId, { supplier_product_photo: res.url });
                    }}
                    onClear={() => update(l._tempId, { supplier_product_photo: "" })}
                  />

                  <div className="space-y-3">
                    <div>
                      <label className={lbl}>Product name</label>
                      <input
                        className="w-full h-11 px-3 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[16px] font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-dim)] placeholder:font-normal outline-none focus:border-[var(--border-focus)]"
                        value={l.supplier_product_name}
                        placeholder="What the supplier calls this product"
                        onChange={(e) => update(l._tempId, { supplier_product_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={lbl}>Model number</label>
                      <input className={inp} value={l.supplier_product_code} placeholder="e.g. JK-58420"
                        onChange={(e) => update(l._tempId, { supplier_product_code: e.target.value })} />
                    </div>
                    <div>
                      <label className={lbl}>Cost price</label>
                      <div className="flex gap-1.5">
                        <input className={`${inp} flex-1 min-w-0`} value={l.unit_cost_cny} inputMode="decimal" placeholder="e.g. 1850"
                          onChange={(e) => update(l._tempId, { unit_cost_cny: e.target.value.replace(/[^0-9.]/g, "") })} />
                        <div className="h-9 w-[84px] shrink-0 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)] flex items-center justify-center" title="Factory cost is always entered in CNY (¥) — the pricing engine works from the CNY cost.">
                          CNY
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* What the cost already includes. Display + warning only —
                      lets the same machine quoted ex-works vs full-landed be
                      told apart so it isn't silently mis-leveled. */}
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Cost includes</label>
                      <select className={inp} value={l.cost_basis}
                        onChange={(e) => update(l._tempId, { cost_basis: e.target.value as ProductSupplierFormState["cost_basis"] })}>
                        <option value="delivered">Delivered to Koleex (full landed)</option>
                        <option value="packing">+ Packing (no delivery)</option>
                        <option value="factory_only">Factory only (ex-works)</option>
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>Tax (VAT)</label>
                      <button type="button"
                        onClick={() => update(l._tempId, { cost_includes_tax: !l.cost_includes_tax })}
                        className={`h-9 w-full px-3 rounded-lg border text-[12px] font-medium flex items-center justify-between transition-colors ${l.cost_includes_tax ? "border-[var(--border-subtle)] bg-[var(--bg-inverted)]/[0.05] text-[var(--text-primary)]" : "border-amber-500/40 bg-amber-500/[0.06] text-amber-400"}`}>
                        <span>{l.cost_includes_tax ? "Tax included" : "Tax NOT included"}</span>
                        <span className={`h-4 w-7 rounded-full relative transition-colors ${l.cost_includes_tax ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]"}`}>
                          <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${l.cost_includes_tax ? "left-3.5" : "left-0.5"}`} />
                        </span>
                      </button>
                    </div>
                  </div>
                  {(l.cost_basis !== "delivered" || !l.cost_includes_tax) && (
                    <p className="mt-2 text-[10.5px] leading-relaxed text-amber-400/90">
                      ⚠ This cost is <b>not</b> full-landed/tax-in. Its margin isn&apos;t directly comparable to delivered costs — add the missing {l.cost_basis === "factory_only" ? "packing + delivery" : l.cost_basis === "packing" ? "delivery" : "components"}{!l.cost_includes_tax ? " + VAT" : ""} before relying on the auto-detected level.
                    </p>
                  )}
                </div>

                {/* From the supplier (Suppliers app) — source of truth, read-only here */}
                {(() => {
                  const sup = supOf(l.supplier_id);
                  const facts: { label: string; value: string | null | undefined }[] = [
                    { label: "Supply type", value: sup?.supply_type },
                    { label: "MOQ", value: sup?.moq },
                    { label: "Lead time", value: sup?.lead_time },
                    { label: "Payment terms", value: sup?.payment_terms },
                    { label: "Currency", value: sup?.currency },
                  ];
                  return (
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-ghost)]">From the supplier</span>
                        <span className="text-[10px] text-[var(--text-ghost)]">edit in the Suppliers app</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                        {facts.map((f) => (
                          <div key={f.label}>
                            <div className="text-[10px] uppercase tracking-wide text-[var(--text-ghost)]">{f.label}</div>
                            <div className="text-[12px] text-[var(--text-primary)] truncate">{f.value || "—"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Quotation & volume pricing — per product, from this supplier */}
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-ghost)]">Quotation &amp; volume pricing</span>
                    {l.price_valid_until && (() => {
                      const expired = new Date(l.price_valid_until) < new Date(new Date().toDateString());
                      return (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border border-[var(--border-subtle)]"
                          style={{ color: expired ? "var(--state-error,#FF3333)" : "var(--state-success,#00CC66)" }}>
                          {expired ? "Quote expired" : "Quote valid"}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Quote dates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Quoted on</label>
                      <input type="date" className={inp} value={l.price_quoted_on}
                        onChange={(e) => update(l._tempId, { price_quoted_on: e.target.value })} />
                    </div>
                    <div>
                      <label className={lbl}>Valid until</label>
                      <input type="date" className={inp} value={l.price_valid_until}
                        onChange={(e) => update(l._tempId, { price_valid_until: e.target.value })} />
                    </div>
                  </div>

                  {/* Volume price tiers */}
                  <div>
                    <label className={lbl}>Volume pricing (qty → unit price)</label>
                    <div className="space-y-1.5">
                      {l.price_tiers.map((tier, ti) => (
                        <div key={ti} className="flex items-center gap-1.5">
                          <input className={`${inp} flex-1`} inputMode="numeric" placeholder="Min qty (e.g. 10)" value={tier.min_qty}
                            onChange={(e) => update(l._tempId, { price_tiers: l.price_tiers.map((t, i) => i === ti ? { ...t, min_qty: e.target.value.replace(/[^0-9]/g, "") } : t) })} />
                          <span className="text-[var(--text-ghost)] text-[12px]">→</span>
                          <input className={`${inp} flex-1`} inputMode="decimal" placeholder="Unit price" value={tier.price}
                            onChange={(e) => update(l._tempId, { price_tiers: l.price_tiers.map((t, i) => i === ti ? { ...t, price: e.target.value.replace(/[^0-9.]/g, "") } : t) })} />
                          <button type="button" aria-label="Remove tier"
                            onClick={() => update(l._tempId, { price_tiers: l.price_tiers.filter((_, i) => i !== ti) })}
                            className="h-9 w-8 shrink-0 flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-[var(--state-error,#FF3333)]">
                            <CrossIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <button type="button"
                        onClick={() => update(l._tempId, { price_tiers: [...l.price_tiers, { min_qty: "", price: "" }] })}
                        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-dashed border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-ghost)] transition-colors">
                        <PlusIcon className="h-3 w-3" /> Add price tier
                      </button>
                    </div>
                  </div>

                  {/* Supplier quotation file */}
                  <div>
                    <label className={lbl}>Supplier quotation / spec file</label>
                    {l.quotation_file_url ? (
                      <div className="flex items-center justify-between gap-2 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                        <a href={l.quotation_file_url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[var(--accent,#0066FF)] truncate hover:underline">
                          {l.quotation_file_name || "View quotation"}
                        </a>
                        <button type="button" aria-label="Remove file" onClick={() => update(l._tempId, { quotation_file_url: "", quotation_file_name: "" })}
                          className="shrink-0 text-[var(--text-ghost)] hover:text-[var(--state-error,#FF3333)]">
                          <CrossIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 h-9 px-3 rounded-lg border border-dashed border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-primary)] hover:border-[var(--text-ghost)] transition-colors">
                        {uploadingQuoteId === l._tempId ? "Uploading…" : (<><UploadIcon className="h-3.5 w-3.5" /> Upload quotation (PDF/image)</>)}
                        <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" className="hidden" disabled={uploadingQuoteId === l._tempId}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploadingQuoteId(l._tempId);
                            const res = await uploadProductFile(file);
                            setUploadingQuoteId(null);
                            if (res) update(l._tempId, { quotation_file_url: res.url, quotation_file_name: file.name });
                          }} />
                      </label>
                    )}
                  </div>
                </div>

                {/* Per-product link fields (product-specific — not on the supplier record) */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className={lbl}>Incoterms</label>
                    <select className={inp} value={l.incoterms} onChange={(e) => update(l._tempId, { incoterms: e.target.value })}>
                      <option value="">—</option>
                      {INCOTERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Sample cost</label>
                    <input className={inp} value={l.sample_cost} inputMode="decimal" placeholder="e.g. 200"
                      onChange={(e) => update(l._tempId, { sample_cost: e.target.value.replace(/[^0-9.]/g, "") })} />
                  </div>
                  <div>
                    <label className={lbl}>Supplier warranty (months)</label>
                    <input className={inp} value={l.supplier_warranty_months} inputMode="numeric" placeholder="e.g. 12"
                      onChange={(e) => update(l._tempId, { supplier_warranty_months: e.target.value.replace(/[^0-9]/g, "") })} />
                  </div>
                  <div className="flex items-end pb-0.5">
                    <button type="button" onClick={() => update(l._tempId, { sample_available: !l.sample_available })}
                      aria-pressed={l.sample_available}
                      className={`h-9 px-3 w-full rounded-lg border text-[12px] font-medium flex items-center justify-center gap-2 transition-colors ${
                        l.sample_available
                          ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent"
                          : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                      }`}>
                      <span className={`h-2 w-2 rounded-full ${l.sample_available ? "bg-[var(--state-success,#00CC66)]" : "bg-[var(--text-ghost)]"}`} />
                      Sample {l.sample_available ? "available" : "not available"}
                    </button>
                  </div>
                </div>
                {/* Sourcing strategy — how this supplier is positioned for THIS product */}
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 space-y-3">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-ghost)]">Sourcing strategy</span>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className={lbl}>Sourcing status</label>
                      <select className={inp} value={l.sourcing_status} onChange={(e) => update(l._tempId, { sourcing_status: e.target.value })}>
                        <option value="">—</option>
                        {SOURCING_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className={lbl}>Why this supplier</label>
                      <input className={inp} value={l.preferred_reason} placeholder="e.g. best price / quality / fastest lead time"
                        onChange={(e) => update(l._tempId, { preferred_reason: e.target.value })} />
                    </div>
                    <div>
                      <label className={lbl}>Min order value</label>
                      <div className="flex gap-1.5">
                        <input className={`${inp} flex-1 min-w-0`} value={l.min_order_value} inputMode="decimal" placeholder="e.g. 5000"
                          onChange={(e) => update(l._tempId, { min_order_value: e.target.value.replace(/[^0-9.]/g, "") })} />
                        <div className="h-9 w-[84px] shrink-0 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)] flex items-center justify-center" title="Factory cost is always entered in CNY (¥) — the pricing engine works from the CNY cost.">
                          CNY
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className={lbl}>Tooling / mold owner</label>
                      <select className={inp} value={l.tooling_owner} onChange={(e) => update(l._tempId, { tooling_owner: e.target.value })}>
                        <option value="">—</option>
                        {TOOLING_OWNERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>Tooling / mold cost</label>
                      <input className={inp} value={l.tooling_cost} inputMode="decimal" placeholder="e.g. 12000"
                        onChange={(e) => update(l._tempId, { tooling_cost: e.target.value.replace(/[^0-9.]/g, "") })} />
                    </div>
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

      {/* Add a supplier — opens a searchable picker (89+ suppliers).
          The empty supplier list is treated honestly: "loading", "couldn't
          load → Retry", or genuinely "all linked" — never a misleading
          disabled button when the directory simply hasn't arrived. */}
      {supList.length === 0 ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadSuppliers}
            disabled={loadingSuppliers}
            className="h-9 px-3.5 inline-flex items-center gap-2 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            {loadingSuppliers ? "Loading suppliers…" : supLoadFailed ? "Retry loading suppliers" : "Load suppliers"}
          </button>
          <span className="text-[10px] text-[var(--text-ghost)]">
            {supLoadFailed ? "couldn't reach the Suppliers app — try again" : "from the Suppliers app"}
          </span>
        </div>
      ) : (
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
      )}

      {pickerOpen && (
        <SupplierPickerModal
          suppliers={available}
          onPick={add}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {infoId && supOf(infoId) && (
        <SupplierInfoModal supplier={supOf(infoId)!} router={router} onClose={() => setInfoId(null)} />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   SupplierInfoModal — quick-look popup of the supplier's key facts. All data
   is sourced from the Suppliers app (read-only here); a link opens the full
   profile in a new tab.
   --------------------------------------------------------------------------- */
function SupplierInfoModal({ supplier, router, onClose }: { supplier: SupplierOption; router: ReturnType<typeof useRouter>; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const facts: { label: string; value: string | null | undefined }[] = [
    { label: "Supply type", value: supplier.supply_type },
    { label: "MOQ", value: supplier.moq },
    { label: "Lead time", value: supplier.lead_time },
    { label: "Payment terms", value: supplier.payment_terms },
    { label: "Currency", value: supplier.currency },
  ];
  /* Profile facts only show when populated (most suppliers leave them blank). */
  if (supplier.rating) facts.push({ label: "Rating", value: `★ ${supplier.rating}/5` });
  if (supplier.sample_status) facts.push({ label: "Samples", value: supplier.sample_status });
  if (supplier.employees) facts.push({ label: "Employees", value: supplier.employees });
  if (supplier.year_established) facts.push({ label: "Established", value: supplier.year_established });
  const cats = supplier.categories || [];
  const certs = supplier.certifications || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-14 w-14 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden shrink-0">
              {supplier.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={supplier.logo} alt="" className="h-full w-full object-contain p-1" />
              ) : (
                <FactoryIcon className="h-6 w-6 text-[var(--text-ghost)]" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[16px] font-semibold text-[var(--text-primary)] leading-tight">{supplier.name}</div>
              {supplier.name_cn && <div className="text-[13px] text-[var(--text-muted)] truncate">{supplier.name_cn}</div>}
              <div className="text-[10px] text-[var(--text-ghost)] mt-0.5">Managed in the Suppliers app</div>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-inverted)]/[0.05]">
            <CrossIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Key facts */}
        <div className="p-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {facts.map((f) => (
              <div key={f.label}>
                <div className="text-[10px] uppercase tracking-wide text-[var(--text-ghost)]">{f.label}</div>
                <div className="text-[13px] text-[var(--text-primary)] truncate">{f.value || "—"}</div>
              </div>
            ))}
          </div>

          {/* Product categories + certifications (chips, only when present) */}
          {(cats.length > 0 || certs.length > 0) && (
            <div className="mt-3 space-y-2">
              {cats.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[var(--text-ghost)] mb-1">Product categories</div>
                  <div className="flex flex-wrap gap-1.5">
                    {cats.map((c) => (
                      <span key={c} className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)]">{c}</span>
                    ))}
                  </div>
                </div>
              )}
              {certs.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[var(--text-ghost)] mb-1">Certifications</div>
                  <div className="flex flex-wrap gap-1.5">
                    {certs.map((c) => (
                      <span key={c} className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)]">{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Contact */}
        {(supplier.email || supplier.phone || supplier.website || supplier.wechat || supplier.location || supplier.primary_contact) && (
          <div className="px-4 pb-4">
            <div className="text-[10px] uppercase tracking-wide text-[var(--text-ghost)] mb-2">Contact</div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] divide-y divide-[var(--border-subtle)]">
              {supplier.primary_contact?.name && (
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-[13px] text-[var(--text-primary)] truncate">{supplier.primary_contact.name}</div>
                    {supplier.primary_contact.role && <div className="text-[11px] text-[var(--text-ghost)] truncate">{supplier.primary_contact.role}</div>}
                  </div>
                  {supplier.primary_contact.mobile && (
                    <a href={`tel:${supplier.primary_contact.mobile}`} className="text-[12px] text-[var(--accent,#0066FF)] shrink-0 hover:underline">{supplier.primary_contact.mobile}</a>
                  )}
                </div>
              )}
              {supplier.email && (
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-[11px] text-[var(--text-ghost)]">Email</span>
                  <a href={`mailto:${supplier.email}`} className="text-[12px] text-[var(--accent,#0066FF)] truncate hover:underline">{supplier.email}</a>
                </div>
              )}
              {supplier.phone && (
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-[11px] text-[var(--text-ghost)]">Phone</span>
                  <a href={`tel:${supplier.phone}`} className="text-[12px] text-[var(--text-primary)] truncate hover:underline">{supplier.phone}</a>
                </div>
              )}
              {supplier.wechat && (
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-[11px] text-[var(--text-ghost)]">WeChat</span>
                  <span className="text-[12px] text-[var(--text-primary)] truncate">{supplier.wechat}</span>
                </div>
              )}
              {supplier.website && (
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-[11px] text-[var(--text-ghost)]">Website</span>
                  <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[var(--accent,#0066FF)] truncate hover:underline">{supplier.website.replace(/^https?:\/\//, "")}</a>
                </div>
              )}
              {supplier.location && (
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-[11px] text-[var(--text-ghost)]">Location</span>
                  <span className="text-[12px] text-[var(--text-primary)] truncate text-right">{supplier.location}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer — open full profile */}
        <div className="flex items-center justify-end gap-2 p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
          <button type="button"
            onClick={() => { onClose(); router.push(`/suppliers/${supplier.id}`); }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-medium hover:opacity-90 transition-opacity">
            <ExternalLinkIcon className="h-3.5 w-3.5" /> Open full profile
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   SupplierPhoto — the product photo for a supplier link. Click or drag-drop
   to upload; object-contain so the whole product shows (no crop); hover to
   change; small remove control. Uploads to storage via the parent's onPick.
   --------------------------------------------------------------------------- */
function SupplierPhoto({
  url, uploading, onPick, onClear, sizeClass = "h-28 w-28",
}: {
  url: string;
  uploading: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
  sizeClass?: string;
}) {
  const [drag, setDrag] = useState(false);
  const take = (files: FileList | null) => {
    const f = files?.[0];
    if (f && f.type.startsWith("image/")) onPick(f);
  };
  return (
    <div className={`relative shrink-0 ${sizeClass}`}>
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files); }}
        className={`group relative block h-full w-full rounded-xl overflow-hidden cursor-pointer transition-colors ${
          url
            ? "border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
            : drag
              ? "border-2 border-dashed border-[var(--border-focus)] bg-[var(--accent,#0066FF)]/[0.06]"
              : "border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--text-ghost)]"
        }`}
      >
        {url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-contain p-1.5" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white">
                <UploadIcon className="h-3.5 w-3.5" /> Change
              </span>
            </div>
          </>
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center gap-1 text-[var(--text-ghost)] group-hover:text-[var(--text-muted)] transition-colors">
            <PictureIcon className="h-7 w-7" />
            <span className="text-[10px] font-medium">Add photo</span>
            <span className="text-[9px] text-[var(--text-faint)]">drop or click</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-surface)]/85 text-[10px] font-medium text-[var(--text-muted)]">
            Uploading…
          </div>
        )}
        <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => take(e.target.files)} />
      </label>
      {url && !uploading && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Remove photo"
          className="absolute -top-1.5 -right-1.5 h-5 w-5 flex items-center justify-center rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-2 border-[var(--bg-card)] hover:opacity-90 transition-opacity"
        >
          <CrossIcon className="h-2.5 w-2.5" />
        </button>
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
  const [view, setView] = useState<"list" | "grid">("list");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.name_cn || "").toLowerCase().includes(q),
    );
  }, [query, suppliers]);

  useEffect(() => { inputRef.current?.focus(); }, []);

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
      <div className="w-full max-w-2xl rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header + search */}
        <div className="p-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center justify-between mb-2.5 px-1">
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Link a supplier</h3>
            <div className="flex items-center gap-2">
              {/* List / grid view toggle */}
              <div className="flex items-center rounded-lg border border-[var(--border-subtle)] overflow-hidden">
                <button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} aria-label="List view"
                  className={`h-7 w-7 flex items-center justify-center transition-colors ${view === "list" ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>
                  <LayoutListIcon className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => setView("grid")} aria-pressed={view === "grid"} aria-label="Grid view"
                  className={`h-7 w-7 flex items-center justify-center transition-colors ${view === "grid" ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>
                  <LayoutGridIcon className="h-3.5 w-3.5" />
                </button>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors">
                <CrossIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-dim)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              placeholder="Search suppliers by name…"
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
            />
          </div>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="text-[12px] text-[var(--text-ghost)] text-center py-8">No suppliers match “{query}”.</p>
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-0.5">
              {filtered.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  data-idx={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => onPick(s.id)}
                  className={`flex flex-col items-center text-center gap-2 p-3 rounded-xl border transition-colors ${
                    i === active ? "border-[var(--border-focus)] bg-[var(--bg-surface)]" : "border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]"
                  }`}
                >
                  <div className="h-14 w-14 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden shrink-0">
                    {s.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.logo} alt="" className="h-full w-full object-contain p-1" />
                    ) : (
                      <FactoryIcon className="h-6 w-6 text-[var(--text-ghost)]" />
                    )}
                  </div>
                  <div className="min-w-0 w-full">
                    <p className="text-[12px] font-medium text-[var(--text-primary)] leading-snug line-clamp-2">{s.name}</p>
                    {s.name_cn && <p className="text-[10px] text-[var(--text-ghost)] truncate mt-0.5">{s.name_cn}</p>}
                  </div>
                </button>
              ))}
            </div>
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
                <div className="min-w-0">
                  <span className="block text-[13px] text-[var(--text-primary)] truncate">{s.name}</span>
                  {s.name_cn && <span className="block text-[11px] text-[var(--text-ghost)] truncate">{s.name_cn}</span>}
                </div>
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
