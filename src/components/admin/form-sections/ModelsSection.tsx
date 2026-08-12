"use client";

import PlusIcon from "@/components/icons/ui/PlusIcon";
import dynamic from "next/dynamic";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import AngleUpIcon from "@/components/icons/ui/AngleUpIcon";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import ArrowUpIcon from "@/components/icons/ui/ArrowUpIcon";
import ArrowDownIcon from "@/components/icons/ui/ArrowDownIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import DollarSignIcon from "@/components/icons/ui/DollarSignIcon";
import ScaleIcon from "@/components/icons/ui/ScaleIcon";
import ScanLineIcon from "@/components/icons/ui/ScanLineIcon";
import WarehouseIcon from "@/components/icons/ui/WarehouseIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import CrownIcon from "@/components/icons/ui/CrownIcon";
import ArrowUpRightIcon from "@/components/icons/ui/ArrowUpRightIcon";
import { useTranslation } from "@/lib/i18n";
import { PRODUCTS_UI_I18N } from "@/lib/products-ui-i18n";
import { useState } from "react";
import type { ModelFormState } from "@/types/product-form";
import { createEmptyModel, slugify } from "@/types/product-form";
import SelectWithCreate from "./SelectWithCreate";
const BarcodeQRDisplay = dynamic(() => import("./BarcodeQRDisplay"), { ssr: false, loading: () => null });
import ConfirmDialog from "@/components/kds/ConfirmDialog";

export interface VariantSpecField {
  key: string;
  label: string;
  unit: string | null;
  fieldType: string;
  options: Array<{ value: string; label: string }>;
}

interface Props {
  models: ModelFormState[];
  onChange: (models: ModelFormState[]) => void;
  /* Resolved-schema fields eligible for per-model TECHNICAL overrides
     (models system 2026-08-03). Empty/omitted → panel hidden. */
  specFields?: VariantSpecField[];
  suppliers?: { id: string; name: string; logo: string | null }[];
  onClickCreateSupplier?: (modelTempId: string) => void;
  hidePrimary?: boolean;  // when true, skip the first model (it's shown in Hero)
  /* When the admin clicks "Edit in Hero" on the primary model's
     read-only basics panel, we jump them back to the Hero step so
     they can change name / supplier / price there — the single
     source of truth. Optional because other callers of the section
     (if any land later) don't need it. */
  onEditInHero?: () => void;
  /* Product-level packing defaults (schema products) — offered as a
     one-click copy on every variant card's packing panel. */
  productPacking?: ProductPackingDefaults | null;
  productSpecs?: Record<string, unknown>;
  /* Family Phase 3 — per-model photo plumbing (media lives in the form). */
  modelPhotoUrl?: (m: { _tempId: string; id?: string }) => string | null;
  onSetModelPhoto?: (m: { _tempId: string; id?: string }, file: File) => void;
  onRemoveModelPhoto?: (m: { _tempId: string; id?: string }) => void;
}

/* ── Visual grouped panel ── */
function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--bg-primary)]/40 rounded-xl border border-[var(--border-subtle)]/70 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-6 w-6 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-ghost)]">
          {icon}
        </div>
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">{title}</h4>
      </div>
      {children}
    </div>
  );
}

/* ── Tiny read-only field renderer ──
   Used by the primary model's "Hero Basics" summary so the fields
   Hero owns (name, supplier, cost, price, etc.) appear as
   non-editable labels here without looking like they got greyed
   out "accidentally". Empty value renders a dim dash. */
function ReadOnlyField({
  label, value, mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-[var(--text-ghost)] uppercase tracking-wider mb-0.5">
        {label}
      </div>
      <div
        className={`text-[13px] text-[var(--text-primary)] truncate ${
          mono ? "font-mono text-[var(--text-muted)]" : ""
        } ${!value ? "italic text-[var(--text-ghost)]" : ""}`}
      >
        {value || "—"}
      </div>
    </div>
  );
}

export type ProductPackingDefaults = {
  packing_type?: string; carton_dimensions?: string; cbm?: string;
  net_weight?: string; gross_weight?: string;
  container_20ft_qty?: string; container_40ft_qty?: string; container_40hq_qty?: string;
};

function ModelCard({
  model, idx, total, onUpdate, onRemove, onDuplicate, onMoveUp, onMoveDown,
  suppliers, onClickCreateSupplier, defaultOpen = true, isPrimary = false, solo = false,
  onEditInHero, primaryModel, productPacking, specFields = [], productSpecs,
  photoUrl, onSetPhoto, onRemovePhoto,
}: {
  model: ModelFormState; idx: number; total: number;
  /* The product's primary variant (models[0]). Non-primary variants
     inherit packing & logistics from it unless they override. */
  primaryModel?: ModelFormState;
  onUpdate: (u: Partial<ModelFormState>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  suppliers?: { id: string; name: string; logo: string | null }[];
  onClickCreateSupplier?: () => void;
  defaultOpen?: boolean;
  isPrimary?: boolean;
  /* solo = this is the only model. With a single model there's no "primary
     vs variant" distinction to draw, so the crown + Primary badge are hidden. */
  solo?: boolean;
  /* Callback for the primary model's "Edit in Hero" jump — see Props
     comment on ModelsSection. Ignored for non-primary variants. */
  onEditInHero?: () => void;
  specFields?: VariantSpecField[];
  /* Product-level packing entered on the Logistics tab (schema products).
     One click copies it here — the SAME data must never be typed twice. */
  productPacking?: ProductPackingDefaults | null;
  /* The FAMILY's spec values (products.schema_specs). Shown greyed beside
     every override row so "change only the difference" is never blind —
     you see what you are overriding while you type. */
  productSpecs?: Record<string, unknown>;
  /* This model's own photo (deferred-upload preview or saved URL). */
  photoUrl?: string | null;
  onSetPhoto?: (f: File) => void;
  onRemovePhoto?: () => void;
}) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  const [open, setOpen] = useState(defaultOpen);
  /* Render a family spec value for display next to an override. */
  const famVal = (key: string): string => {
    const v = (productSpecs ?? {})[key];
    if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return "—";
    return Array.isArray(v) ? v.join(", ") : String(v);
  };

  const inp = "w-full h-10 px-4 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-colors";
  /* ── Variant packing auto-derivation (mirrors the product-level Logistics
   behaviour): carton dims (cm) → CBM → container quantities. Every derived
   field stays editable — typing over a computed value wins. Practical usable
   volumes (28 / 58 m³), not brochure volumes. */
const cbmFromCartonCm = (raw: string): number | null => {
  const nums = (raw.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => n > 0);
  if (nums.length < 3) return null;
  const cbm = (nums[0] * nums[1] * nums[2]) / 1_000_000; // cm³ → m³
  return Number.isFinite(cbm) && cbm > 0 ? Math.round(cbm * 10000) / 10000 : null;
};
const containerQtysFromCbm = (cbm: number) => ({
  c20: Math.max(0, Math.floor(28 / cbm)),
  c40: Math.max(0, Math.floor(58 / cbm)),
  c40hq: Math.max(0, Math.floor(68 / cbm)),
});

const lbl = "block text-[10px] font-semibold text-[var(--text-ghost)] uppercase tracking-wider mb-1.5";

  const isActive = model.status === "active";
  const barcodeValue = model.barcode || model.slug || model.model_name;
  const qrPayload = JSON.stringify({
    sku: model.slug || barcodeValue,
    name: model.model_name,
    ref: model.reference_model || null,
  });

  /* ── Packing & logistics inheritance ──
     Variants of the same machine almost always ship in the same box.
     Non-primary variants inherit packing/logistics from the primary
     variant unless they explicitly override. "All these fields empty"
     = inheriting; the operator only fills them for the rare variant
     that's a genuinely different size. */
  const LOGI_KEYS = [
    "net_weight", "weight", "cbm", "carton_dimensions", "packing_type",
    "box_include", "extra_accessories", "container_20ft_qty", "container_40ft_qty", "container_40hq_qty",
  ] as const;
  const canInherit = !isPrimary && !solo && !!primaryModel;
  /* Override is explicit state (not just "has values") so Customize works
     even when the primary variant has no packing entered yet. Defaults ON
     for variants that already carry their own logistics. */
  const [customizing, setCustomizing] = useState<boolean>(
    () => LOGI_KEYS.some((k) => String((model[k] ?? "") as string).trim() !== ""),
  );
  const inheritingLogistics = canInherit && !customizing;
  const customizeLogistics = () => {
    if (primaryModel) {
      const u: Partial<ModelFormState> = {};
      LOGI_KEYS.forEach((k) => { (u as Record<string, unknown>)[k] = primaryModel[k] ?? ""; });
      onUpdate(u);
    }
    setCustomizing(true);
  };
  const revertLogistics = () => {
    const u: Partial<ModelFormState> = {};
    LOGI_KEYS.forEach((k) => { (u as Record<string, unknown>)[k] = ""; });
    onUpdate(u);
    setCustomizing(false);
  };
  const pmLogiSummary = (() => {
    const pm = primaryModel;
    if (!pm) return "";
    const parts: string[] = [];
    if (pm.net_weight) parts.push(`NW ${pm.net_weight}kg`);
    if (pm.weight) parts.push(`GW ${pm.weight}kg`);
    if (pm.cbm) parts.push(`${pm.cbm} m³`);
    if (pm.carton_dimensions) parts.push(pm.carton_dimensions);
    if (pm.packing_type) parts.push(pm.packing_type);
    if (pm.container_20ft_qty || pm.container_40ft_qty || pm.container_40hq_qty) parts.push(`${pm.container_20ft_qty || "–"}/${pm.container_40ft_qty || "–"}/${pm.container_40hq_qty || "–"} per 20'/40'/40HQ`);
    return parts.join(" · ");
  })();

  return (
    <div className="relative bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.1)]">
      {/* Header — neutral chrome, single tier dot for the Primary
          identity. Matches the Specs/Technical card language. */}
      <div
        className={`flex items-center justify-between px-5 py-4 cursor-pointer transition-colors hover:bg-[var(--bg-surface-subtle)]/40 ${
          open ? "border-b border-[var(--border-subtle)]" : ""
        }`}
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] relative">
            {isPrimary && !solo ? (
              <CrownIcon className="h-4 w-4 text-[var(--text-muted)]" />
            ) : (
              <span className="text-[12px] font-bold tabular-nums">{idx + 1}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
                {model.model_name || t("mv.untitled", "Untitled Variant")}
              </span>
              {isPrimary && !solo && (
                <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-primary)]" />
                  Primary
                </span>
              )}
              <span
                className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]"
                title={isActive ? "Active" : "Discontinued"}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-400" : "bg-zinc-500"}`} />
                {isActive ? "Active" : "Discontinued"}
              </span>
            </div>
            {model.slug && (
              <div className="text-[10px] font-mono text-[var(--text-ghost)] mt-0.5 truncate">SKU: {model.slug}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            disabled={idx === 0}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={t("mv.moveUp", "Move up")}
          >
            <ArrowUpIcon className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            disabled={idx === total - 1}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={t("mv.moveDown", "Move down")}
          >
            <ArrowDownIcon className="h-3.5 w-3.5" />
          </button>
          {/* Duplicate + Delete are hidden on the primary model.
              Duplicating the primary would produce an ambiguous
              second "primary" and deleting the primary removes the
              record Hero depends on. Admins who want a variant of
              the primary can add a fresh model via the "Add Model"
              button below the grid and copy the fields manually. */}
          {!isPrimary && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                title="Duplicate"
              >
                <CopyIcon className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {open ? <AngleUpIcon className="h-4 w-4 text-[var(--text-ghost)] ml-1" /> : <AngleDownIcon className="h-4 w-4 text-[var(--text-ghost)] ml-1" />}
        </div>
      </div>

      {open && (
        <div className="p-5 space-y-4">
          {isPrimary ? (
            <>
              {/* ── Primary model: Hero-owned basics are READ-ONLY here.
                    Model name / slug / tagline / supplier / reference /
                    cost / global-price all belong to the Hero step —
                    editing them in two places would just de-sync.
                    Admins click "Edit in Hero" to jump back. */}
              <Panel
                icon={<CrownIcon className="h-3.5 w-3.5" />}
                title="Hero Basics (read-only · edit in Hero step)"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-3 mb-3">
                  <ReadOnlyField label="Variant Name" value={model.model_name} />
                  <ReadOnlyField label="Slug / SKU" value={model.slug} mono />
                  <ReadOnlyField label="Supplier" value={model.supplier} />
                  <ReadOnlyField label="Supplier Reference Model" value={model.reference_model} />
                  <ReadOnlyField
                    label="Cost Price (CNY)"
                    value={model.cost_price ? `¥ ${model.cost_price}` : ""}
                  />
                  <ReadOnlyField
                    label="Global Selling Price (USD)"
                    value={model.global_price ? `$ ${model.global_price}` : ""}
                  />
                </div>
                {model.tagline && (
                  <div className="mb-3">
                    <ReadOnlyField label="Tagline" value={model.tagline} />
                  </div>
                )}
                {onEditInHero && (
                  <button
                    type="button"
                    onClick={onEditInHero}
                    className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-[13px] font-semibold text-[var(--text-muted)] bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] border border-[var(--border-subtle)] transition-all"
                  >
                    <ArrowUpRightIcon className="h-3.5 w-3.5" />
                    Edit in Hero
                  </button>
                )}
                <p className="text-[10px] text-[var(--text-ghost)] mt-2 italic">
                  These fields are owned by the Hero step — the single source of truth
                  for the primary model&apos;s identity + commercial basics. Operational
                  detail (head-only price, packaging, MOQ, barcode override…) stays editable below.
                </p>
              </Panel>

              {/* ── Primary model: Status + Stock + operational pricing.
                    Status is the LIFECYCLE state (active vs retired);
                    Stock Status is the AVAILABILITY (in-stock vs
                    made-to-order vs sold-out). Two independent facts. */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>{t("mv.status", "Status")}</label>
                  <select
                    value={model.status}
                    onChange={(e) => onUpdate({ status: e.target.value as "active" | "discontinued" })}
                    className={inp}
                  >
                    <option value="active">{t("mv.stActive", "Active")}</option>
                    <option value="discontinued">{t("mv.stDiscontinued", "Discontinued")}</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>{t("mv.stockStatus", "Stock Status")}</label>
                  <select
                    value={model.stock_status}
                    onChange={(e) => onUpdate({ stock_status: e.target.value })}
                    className={inp}
                  >
                    <option value="">— Not specified —</option>
                    <option value="in_stock">{t("mv.ssInStock", "In stock")}</option>
                    <option value="made_to_order">{t("mv.ssMto", "Made to order")}</option>
                    <option value="pre_order">{t("mv.ssPreOrder", "Pre-order")}</option>
                    <option value="sold_out">{t("mv.ssSoldOut", "Sold out")}</option>
                  </select>
                </div>
              </div>

              <Panel icon={<DollarSignIcon className="h-3.5 w-3.5" />} title="Operational Pricing">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>{t("mv.headOnlyPrice", "Head-Only Price")}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-ghost)]">$</span>
                      <input type="number" step="0.01" value={model.head_only_price} onChange={(e) => onUpdate({ head_only_price: e.target.value })} placeholder="0.00" className={`${inp} pl-7`} />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>{t("mv.completeSetPrice", "Complete Set Price")}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-ghost)]">$</span>
                      <input type="number" step="0.01" value={model.complete_set_price} onChange={(e) => onUpdate({ complete_set_price: e.target.value })} placeholder="0.00" className={`${inp} pl-7`} />
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-[var(--text-ghost)] mt-2">
                  Separate sub-prices for customers who buy just the machine head vs. a full
                  set with table + motor. Leave blank to fall back to the Global Selling Price above.
                </p>
              </Panel>
            </>
          ) : (
            <>
              {/* Identity row — fully editable on secondary variants */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2">
                  <label className={lbl}>{t("mv.variantName", "Variant Name")} *</label>
                  <input
                    type="text"
                    value={model.model_name}
                    onChange={(e) => onUpdate({ model_name: e.target.value, slug: slugify(e.target.value) })}
                    placeholder="e.g. KX-9500-D"
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>{t("mv.slugSku", "Slug / SKU")}</label>
                  <input
                    type="text"
                    value={model.slug}
                    onChange={(e) => onUpdate({ slug: e.target.value })}
                    className={`${inp} font-mono text-[var(--text-muted)]`}
                  />
                </div>
                <div>
                  <label className={lbl}>{t("mv.status", "Status")}</label>
                  <select
                    value={model.status}
                    onChange={(e) => onUpdate({ status: e.target.value as "active" | "discontinued" })}
                    className={inp}
                  >
                    <option value="active">{t("mv.stActive", "Active")}</option>
                    <option value="discontinued">{t("mv.stDiscontinued", "Discontinued")}</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>{t("mv.stockStatus", "Stock Status")}</label>
                  <select
                    value={model.stock_status}
                    onChange={(e) => onUpdate({ stock_status: e.target.value })}
                    className={inp}
                  >
                    <option value="">—</option>
                    <option value="in_stock">{t("mv.ssInStock", "In stock")}</option>
                    <option value="made_to_order">{t("mv.ssMto", "Made to order")}</option>
                    <option value="pre_order">{t("mv.ssPreOrder", "Pre-order")}</option>
                    <option value="sold_out">{t("mv.ssSoldOut", "Sold out")}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={lbl}>{t("mv.tagline", "Tagline")}</label>
                <input
                  type="text"
                  value={model.tagline}
                  onChange={(e) => onUpdate({ tagline: e.target.value })}
                  placeholder={t("mv.phTagline", "Short sub-title shown under the model name")}
                  className={inp}
                />
              </div>

              {/* Supplier + Pricing panel */}
              <Panel icon={<DollarSignIcon className="h-3.5 w-3.5" />} title="Supplier & Pricing">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={lbl}>{t("mv.supplier", "Supplier")}</label>
                    {suppliers ? (
                      <SelectWithCreate
                        value={model.supplier}
                        options={suppliers.map((s) => ({ value: s.name, label: s.name, icon: s.logo }))}
                        onChange={(val) => onUpdate({ supplier: val })}
                        onClickCreate={onClickCreateSupplier}
                        placeholder={t("mv.phSupplier", "Select supplier...")}
                        createLabel="Create Supplier"
                        className="[&_button]:h-10 [&_button]:rounded-lg [&_button]:bg-[var(--bg-surface-subtle)]/70"
                      />
                    ) : (
                      <input type="text" value={model.supplier} onChange={(e) => onUpdate({ supplier: e.target.value })} placeholder={t("mv.phSupplierName", "Supplier name")} className={inp} />
                    )}
                  </div>
                  <div>
                    <label className={lbl}>{t("mv.supplierRef", "Supplier Reference Model")}</label>
                    <input
                      type="text"
                      value={model.reference_model}
                      onChange={(e) => onUpdate({ reference_model: e.target.value })}
                      placeholder={t("mv.phFactoryCode", "e.g. Factory model code")}
                      className={inp}
                    />
                  </div>
                  <div>
                    <label className={lbl}>{t("mv.costCny", "Cost Price (CNY)")}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-ghost)]">¥</span>
                      <input type="number" step="0.01" value={model.cost_price} onChange={(e) => onUpdate({ cost_price: e.target.value })} placeholder="0.00" className={`${inp} pl-7`}
                        disabled={model.pricing_mode === "on_request"} />
                    </div>
                  </div>
                </div>

                {/* ── How this model is priced ──
                    Without this, a machine that is quoted per configuration
                    could only be recorded by leaving the price blank — which
                    the grid and the readiness score read as MISSING DATA, so a
                    complete record sat at a permanent penalty and buried the
                    products that really were unfinished. */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                  <div>
                    <label className={lbl}>{t("mv.pricingMode", "Pricing")}</label>
                    <select
                      value={model.pricing_mode || "fixed"}
                      onChange={(e) => onUpdate({ pricing_mode: e.target.value as "fixed" | "from" | "on_request" })}
                      className={inp}
                    >
                      <option value="fixed">{t("mv.pricingFixed", "Fixed price")}</option>
                      <option value="from">{t("mv.pricingFrom", "From — base + options")}</option>
                      <option value="on_request">{t("mv.pricingOnRequest", "Priced per configuration")}</option>
                    </select>
                  </div>
                  {model.pricing_mode && model.pricing_mode !== "fixed" && (
                    <div className="md:col-span-2">
                      <label className={lbl}>{t("mv.priceNote", "What drives the price")}</label>
                      <input
                        value={model.price_note || ""}
                        onChange={(e) => onUpdate({ price_note: e.target.value })}
                        placeholder={t("mv.phPriceNote", "e.g. depends on table width, motor and automation level")}
                        className={inp}
                      />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                  <div>
                    <label className={lbl}>{t("mv.sellUsd", "Global Selling Price (USD)")}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-ghost)]">$</span>
                      <input type="number" step="0.01" value={model.global_price} onChange={(e) => onUpdate({ global_price: e.target.value })} placeholder="0.00" className={`${inp} pl-7`} />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>{t("mv.headOnlyPrice", "Head-Only Price")}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-ghost)]">$</span>
                      <input type="number" step="0.01" value={model.head_only_price} onChange={(e) => onUpdate({ head_only_price: e.target.value })} placeholder="0.00" className={`${inp} pl-7`} />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>{t("mv.completeSetPrice", "Complete Set Price")}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-ghost)]">$</span>
                      <input type="number" step="0.01" value={model.complete_set_price} onChange={(e) => onUpdate({ complete_set_price: e.target.value })} placeholder="0.00" className={`${inp} pl-7`} />
                    </div>
                  </div>
                </div>
              </Panel>
            </>
          )}

          {/* ── Technical differences (models system 2026-08-03) ──
              The catalog pattern: one product platform, several models
              that differ in a few TECHNICAL axes (needles, threads,
              speed, feed configuration…). A model INHERITS the
              product's Specifications and overrides only the keys
              listed here. Feeds the public "Choose your model" table. */}
          {/* ── Model photo (family Phase 3) ── optional; absent = the
              model inherits the family's main photo everywhere. */}
          {onSetPhoto && (
            <Panel icon={<ImageRawIcon className="h-3.5 w-3.5" />} title={t("models.photoTitle", "Model photo")}>
              <div className="flex items-center gap-3">
                {photoUrl ? (
                  <span className="h-14 w-14 shrink-0 rounded-lg bg-white border border-[var(--border-subtle)] overflow-hidden flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoUrl} alt="" className="h-full w-full object-contain p-1" />
                  </span>
                ) : (
                  <span className="h-14 w-14 shrink-0 rounded-lg border border-dashed border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-ghost)]">
                    <ImageRawIcon className="h-5 w-5" />
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-[var(--text-ghost)] leading-relaxed">
                    {photoUrl
                      ? t("models.photoOwn", "This model shows its own photo.")
                      : t("models.photoInherits", "No photo — this model inherits the family's main photo.")}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <label className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold cursor-pointer text-[var(--accent,#0066FF)] bg-[var(--accent,#0066FF)]/10 hover:bg-[var(--accent,#0066FF)]/15 border border-[var(--accent,#0066FF)]/30 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onSetPhoto(f);
                          e.currentTarget.value = "";
                        }}
                      />
                      {photoUrl ? t("models.photoReplace", "Replace") : t("models.photoAdd", "Add photo")}
                    </label>
                    {photoUrl && onRemovePhoto && (
                      <button type="button" onClick={onRemovePhoto}
                        className="h-7 px-2.5 rounded-lg text-[11px] font-semibold text-[var(--text-muted)] hover:text-rose-300 hover:bg-rose-500/10 border border-[var(--border-subtle)] transition-colors">
                        {t("models.photoRemove", "Remove")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Panel>
          )}

          {specFields.length > 0 && (
            <Panel icon={<ScaleIcon className="h-3.5 w-3.5" />} title="Technical differences (vs product specs)">
              <div className="space-y-2">
                {Object.entries(model.specs_overrides ?? {}).map(([k, v]) => {
                  const f = specFields.find((sf) => sf.key === k);
                  return (
                    <div key={k} className="flex items-center gap-2">
                      <span className="w-[38%] shrink-0 min-w-0 text-[11.5px] text-[var(--text-muted)]" title={f?.label ?? k}>
                        <span className="block truncate">
                          {f?.label ?? k}
                          {f?.unit ? <span className="text-[var(--text-ghost)]"> ({f.unit})</span> : null}
                        </span>
                        {/* What you are overriding — the family's value. */}
                        <span className="block truncate text-[10px] text-[var(--text-ghost)]">
                          {t("models.familyValue", "Family")}: {famVal(k)}{f?.unit && famVal(k) !== "—" ? ` ${f.unit}` : ""}
                        </span>
                      </span>
                      {f && (f.fieldType === "select") && f.options.length > 0 ? (
                        <select
                          value={v}
                          onChange={(e) => onUpdate({ specs_overrides: { ...model.specs_overrides, [k]: e.target.value } })}
                          className="h-8 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                        >
                          <option value="">—</option>
                          {f.options.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : f && f.fieldType === "boolean" ? (
                        <select
                          value={v}
                          onChange={(e) => onUpdate({ specs_overrides: { ...model.specs_overrides, [k]: e.target.value } })}
                          className="h-8 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                        >
                          <option value="">—</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      ) : (
                        <input
                          value={v}
                          onChange={(e) => onUpdate({ specs_overrides: { ...model.specs_overrides, [k]: e.target.value } })}
                          placeholder={f && (f.fieldType === "multi_select" || f.fieldType === "chips") ? "value1, value2…" : "value"}
                          className="h-8 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const next = { ...model.specs_overrides };
                          delete next[k];
                          onUpdate({ specs_overrides: next });
                        }}
                        className="h-8 w-8 shrink-0 rounded-lg text-[var(--text-ghost)] hover:text-rose-300 hover:bg-rose-500/10 inline-flex items-center justify-center"
                        aria-label={`Remove ${f?.label ?? k}`}
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
                <select
                  value=""
                  onChange={(e) => {
                    const k = e.target.value;
                    if (!k) return;
                    onUpdate({ specs_overrides: { ...model.specs_overrides, [k]: "" } });
                  }}
                  className="h-8 w-full rounded-lg border border-dashed border-[var(--border-subtle)] bg-transparent px-2 text-[12px] text-[var(--text-muted)] outline-none focus:border-[var(--border-focus)]"
                >
                  <option value="">+ Add a spec that differs on this model…</option>
                  {specFields
                    .filter((sf) => !(sf.key in (model.specs_overrides ?? {})))
                    .map((sf) => (
                      <option key={sf.key} value={sf.key}>
                        {sf.label}{famVal(sf.key) !== "—" ? ` — ${t("models.familyValue", "Family")}: ${famVal(sf.key)}${sf.unit ? ` ${sf.unit}` : ""}` : ""}
                      </option>
                    ))}
                </select>
                <p className="text-[10.5px] leading-relaxed text-[var(--text-ghost)]">
                  Everything not listed here is inherited from the product's Specifications tab.
                </p>
              </div>
            </Panel>
          )}

          {/* Packaging & Logistics panel — these are PACKED/SHIPMENT
              dimensions, distinct from the bare-machine dimensions and
              weight that live on the Technical step. Net + Gross weight
              both render here so admins can fill the standard
              NW / GW pair shown on every commercial invoice. */}
          <Panel icon={<PackageIcon className="h-3.5 w-3.5" />} title="Shipping & Packing (this variant)">
            {inheritingLogistics ? (
              <div className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-medium text-[var(--text-muted)] inline-flex items-center gap-1.5">
                    <PackageIcon className="h-3.5 w-3.5 text-[var(--text-ghost)]" /> Same packing &amp; logistics as the primary variant
                  </span>
                  <button type="button" onClick={customizeLogistics} className="text-[11px] font-semibold text-[var(--accent,#0066FF)] hover:underline shrink-0">
                    Customize for this variant
                  </button>
                </div>
                <p className="text-[11px] text-[var(--text-ghost)] leading-relaxed">
                  {pmLogiSummary || "Primary variant has no packing data yet — fill it on the primary variant card."}
                </p>
              </div>
            ) : (
            <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-[var(--text-ghost)] italic">
                {t("mv.packingIntro", "Packed crate dimensions and shipment data. The bare-machine weight + footprint live on the Technical step.")}
              </p>
              <div className="flex items-center gap-3 shrink-0 ml-2">
                {productPacking && Object.values(productPacking).some(Boolean) && (
                  <button
                    type="button"
                    onClick={() => {
                      const u: Record<string, string> = {};
                      for (const [k, v] of Object.entries(productPacking)) if (v) u[k] = v;
                      onUpdate(u as Partial<ModelFormState>);
                    }}
                    className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    {t("mv.copyFromLogistics", "⤓ Copy from product Logistics")}
                  </button>
                )}
                {canInherit && (
                  <button type="button" onClick={revertLogistics} className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                    {t("mv.usePrimaryPacking", "Use primary variant's packing")}
                  </button>
                )}
              </div>
            </div>
            {/* Entry order mirrors real packing logic: HOW it's packed →
                carton size → volume (auto) → weights. Same sequence as the
                product-level Logistics tab. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>{t("mv.packingType", "Packing Type")}</label>
                <input type="text" value={model.packing_type} onChange={(e) => onUpdate({ packing_type: e.target.value })} placeholder={t("mv.phPackingType", "e.g. Wooden crate")} className={inp} />
              </div>
              <div>
                <label className={lbl}>{t("mv.cartonDims", "Carton Dimensions (L × W × H)")}</label>
                <input
                  type="text"
                  value={model.carton_dimensions}
                  onChange={(e) => {
                    const v = e.target.value;
                    const cbm = cbmFromCartonCm(v);
                    if (cbm != null) {
                      const q = containerQtysFromCbm(cbm);
                      onUpdate({ carton_dimensions: v, cbm: String(cbm), container_20ft_qty: String(q.c20), container_40ft_qty: String(q.c40), container_40hq_qty: String(q.c40hq) });
                    } else {
                      onUpdate({ carton_dimensions: v });
                    }
                  }}
                  placeholder={t("mv.phCarton", "e.g. 60 × 50 × 65 cm")}
                  className={inp}
                />
                <p className="text-[10px] text-[var(--text-ghost)] mt-1">{t("mv.hintDims", "↻ Fills CBM + container loading automatically (cm).")}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
              <div>
                <label className={lbl}>{t("mv.packedCbm", "Packed CBM (m³)")}</label>
                <input
                  type="number"
                  step="0.0001"
                  value={model.cbm}
                  onChange={(e) => {
                    const v = e.target.value;
                    const n = Number(v);
                    if (Number.isFinite(n) && n > 0) {
                      const q = containerQtysFromCbm(n);
                      onUpdate({ cbm: v, container_20ft_qty: String(q.c20), container_40ft_qty: String(q.c40), container_40hq_qty: String(q.c40hq) });
                    } else {
                      onUpdate({ cbm: v });
                    }
                  }}
                  placeholder="0.0000"
                  className={inp}
                />
                <p className="text-[10px] text-[var(--text-ghost)] mt-1">{t("mv.hintAutoCbm", "↻ Auto from carton dims — you can also type it manually.")}</p>
              </div>
              <div>
                <label className={lbl}>{t("mv.netWeight", "Net Weight (kg)")}</label>
                <input type="number" step="0.1" value={model.net_weight} onChange={(e) => onUpdate({ net_weight: e.target.value })} placeholder="0.0" className={inp} />
                <p className="text-[10px] text-[var(--text-ghost)] mt-1">{t("mv.hintBare", "Bare machine, no packaging.")}</p>
              </div>
              <div>
                <label className={lbl}>{t("mv.grossWeight", "Gross Weight (kg)")}</label>
                <input type="number" step="0.1" value={model.weight} onChange={(e) => onUpdate({ weight: e.target.value })} placeholder="0.0" className={inp} />
                <p className="text-[10px] text-[var(--text-ghost)] mt-1">{t("mv.hintGross", "Includes crate + accessories.")}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div>
                <label className={lbl}>{t("mv.boxIncludes", "Box Includes")}</label>
                <input type="text" value={model.box_include} onChange={(e) => onUpdate({ box_include: e.target.value })} placeholder={t("mv.phBoxIncludes", "e.g. Main unit, cable, manual")} className={inp} />
              </div>
              <div>
                <label className={lbl}>{t("mv.extraAccessories", "Extra Accessories")}</label>
                <input type="text" value={model.extra_accessories} onChange={(e) => onUpdate({ extra_accessories: e.target.value })} placeholder={t("mv.phExtras", "e.g. Spare parts kit")} className={inp} />
              </div>
            </div>
            </>
            )}
          </Panel>

          {/* Advanced (MOQ / Lead Time / Container loading / Barcode) */}
          <details className="group">
            <summary className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--bg-surface-subtle)]/50 transition-colors list-none">
              <WarehouseIcon className="h-3.5 w-3.5 text-[var(--text-ghost)]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">{t("mv.advanced", "Advanced · Fulfillment & Codes")}</span>
              <AngleDownIcon className="h-3.5 w-3.5 text-[var(--text-ghost)] ml-auto transition-transform group-open:rotate-180" />
            </summary>
            <div className="pt-3 px-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={lbl}>{t("mv.moq", "MOQ (Min Order Qty)")}</label>
                  <input type="number" value={model.moq} onChange={(e) => onUpdate({ moq: e.target.value })} placeholder="e.g. 10" className={inp} />
                </div>
                <div>
                  <label className={lbl}>{t("mv.leadTime", "Lead Time")}</label>
                  <input type="text" value={model.lead_time} onChange={(e) => onUpdate({ lead_time: e.target.value })} placeholder={t("mv.phLeadTime", "e.g. 7-14 days")} className={inp} />
                </div>
                <div>
                  <label className={lbl}>{t("mv.barcodeOverride", "Barcode Override")}</label>
                  <input type="text" value={model.barcode} onChange={(e) => onUpdate({ barcode: e.target.value })} placeholder={t("mv.phBarcode", "Leave empty = auto from SKU")} className={`${inp} font-mono`} />
                </div>
              </div>
              {/* Container loading — units that fit in standard
                  20'/40' ocean containers. Used by the logistics
                  team to quote FCL pricing. Inherited from the primary
                  variant when packing is inherited. */}
              {inheritingLogistics ? (
                <p className="text-[11px] text-[var(--text-ghost)] italic">{t("mv.containerInherited", "Container loading inherited from the primary variant.")}</p>
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={lbl}>{t("mv.c20", "Container 20' (units)")}</label>
                  <input type="number" value={model.container_20ft_qty} onChange={(e) => onUpdate({ container_20ft_qty: e.target.value })} placeholder="e.g. 120" className={inp} />
                  <p className="text-[10px] text-[var(--text-ghost)] mt-1">{t("mv.hintAuto20", "↻ Auto from CBM — overtype if units stack.")}</p>
                </div>
                <div>
                  <label className={lbl}>{t("mv.c40", "Container 40' (units)")}</label>
                  <input type="number" value={model.container_40ft_qty} onChange={(e) => onUpdate({ container_40ft_qty: e.target.value })} placeholder="e.g. 280" className={inp} />
                  <p className="text-[10px] text-[var(--text-ghost)] mt-1">{t("mv.hintAuto40", "↻ Auto from CBM (standard 40').")}</p>
                </div>
                <div>
                  <label className={lbl}>{t("mv.c40hq", "Container 40'HQ (units)")}</label>
                  <input type="number" value={model.container_40hq_qty} onChange={(e) => onUpdate({ container_40hq_qty: e.target.value })} placeholder="e.g. 320" className={inp} />
                  <p className="text-[10px] text-[var(--text-ghost)] mt-1">{t("mv.hintAutoHq", "↻ Auto from CBM (High-Cube).")}</p>
                </div>
              </div>
              )}
            </div>
          </details>

          {/* Auto-generated codes panel */}
          <Panel icon={<ScanLineIcon className="h-3.5 w-3.5" />} title={t("mv.autoCodes", "Auto-Generated Codes")}>
            <BarcodeQRDisplay value={barcodeValue} label={model.model_name} qrPayload={qrPayload} />
          </Panel>
        </div>
      )}
    </div>
  );
}

export default function ModelsSection({ models, onChange, specFields = [], suppliers, onClickCreateSupplier, hidePrimary = false, onEditInHero, productPacking, productSpecs, modelPhotoUrl, onSetModelPhoto, onRemoveModelPhoto }: Props) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  /* ID of the model the admin is about to remove — drives the
     themed ConfirmDialog below. Replaces the native window.confirm()
     which Safari renders with a system dialog that clashes with
     the hub's dark theme. */
  const [removeTempId, setRemoveTempId] = useState<string | null>(null);

  const addModel = () => {
    onChange([...models, { ...createEmptyModel(), order: models.length }]);
  };

  const updateModel = (tempId: string, updates: Partial<ModelFormState>) => {
    onChange(models.map((m) => (m._tempId === tempId ? { ...m, ...updates } : m)));
  };

  const askRemove = (tempId: string) => setRemoveTempId(tempId);

  const confirmRemove = () => {
    if (!removeTempId) return;
    onChange(models.filter((m) => m._tempId !== removeTempId));
    setRemoveTempId(null);
  };

  const duplicateModel = (tempId: string) => {
    const source = models.find((m) => m._tempId === tempId);
    if (!source) return;
    const copy: ModelFormState = {
      ...source,
      _tempId: crypto.randomUUID(),
      id: undefined,
      model_name: `${source.model_name} (Copy)`,
      slug: slugify(`${source.model_name} (Copy)`),
      order: models.length,
    };
    onChange([...models, copy]);
  };

  const moveUp = (idx: number) => {
    if (idx <= 0) return;
    const next = [...models];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next.map((m, i) => ({ ...m, order: i })));
  };

  const moveDown = (idx: number) => {
    if (idx >= models.length - 1) return;
    const next = [...models];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(next.map((m, i) => ({ ...m, order: i })));
  };

  // When Hero owns the primary model, the Models section only shows additional variants.
  const visibleModels = hidePrimary ? models.slice(1) : models;
  const startIndex = hidePrimary ? 1 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <TagsIcon className="h-4 w-4 text-[var(--text-muted)]" />
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">
              {hidePrimary ? "Additional Variants" : "Product Variants"}
            </h3>
          </div>
          <p className="text-[11px] text-[var(--text-ghost)] mt-0.5">
            {hidePrimary
              ? t("mv.primaryInHero", "Primary model is entered in the Hero. Add extra variants only when needed.")
              : t("mv.skuAutoHint", "SKU is auto-generated on save. Barcode & QR codes are generated automatically.")}
          </p>
        </div>
        <button
          onClick={addModel}
          className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-1.5 transition-all shadow-lg"
        >
          <PlusIcon className="h-3.5 w-3.5" /> Add Variant
        </button>
      </div>

      {visibleModels.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-[var(--border-subtle)] rounded-2xl bg-[var(--bg-surface-subtle)]/30">
          <ScaleIcon className="h-8 w-8 text-[var(--text-ghost)] mx-auto mb-2" />
          <p className="text-[13px] text-[var(--text-dim)] font-medium">
            {hidePrimary ? "No additional variants" : "No variants yet"}
          </p>
          <p className="text-[11px] text-[var(--text-ghost)] mt-1">
            {hidePrimary ? t("mv.addWhenMultiple", "Add a variant when this product has multiple versions") : t("mv.addFirstVariant", "Add your first variant")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleModels.map((m, i) => {
            const trueIdx = startIndex + i;
            return (
              <ModelCard
                specFields={specFields}
                productPacking={productPacking}
                productSpecs={productSpecs}
                photoUrl={modelPhotoUrl ? modelPhotoUrl(m) : null}
                onSetPhoto={onSetModelPhoto ? (f: File) => onSetModelPhoto(m, f) : undefined}
                onRemovePhoto={onRemoveModelPhoto ? () => onRemoveModelPhoto(m) : undefined}
                key={m._tempId}
                model={m}
                idx={trueIdx}
                total={models.length}
                isPrimary={!hidePrimary && trueIdx === 0}
                solo={!hidePrimary && models.length === 1}
                onUpdate={(u) => updateModel(m._tempId, u)}
                onRemove={() => askRemove(m._tempId)}
                onDuplicate={() => duplicateModel(m._tempId)}
                onMoveUp={() => moveUp(trueIdx)}
                onMoveDown={() => moveDown(trueIdx)}
                suppliers={suppliers}
                onClickCreateSupplier={onClickCreateSupplier ? () => onClickCreateSupplier(m._tempId) : undefined}
                defaultOpen={i === 0}
                onEditInHero={onEditInHero}
                primaryModel={models[0]}
              />
            );
          })}
        </div>
      )}

      {/* Themed remove confirmation — replaces window.confirm() */}
      <ConfirmDialog
        open={removeTempId !== null}
        onCancel={() => setRemoveTempId(null)}
        onConfirm={confirmRemove}
        title="Remove this variant?"
        message="The variant and its saved prices are removed from this draft. Nothing is deleted from the database until you save the product."
        confirmLabel="Remove"
      />
    </div>
  );
}
