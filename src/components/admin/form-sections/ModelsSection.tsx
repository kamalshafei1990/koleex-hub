"use client";

import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import AngleUpIcon from "@/components/icons/ui/AngleUpIcon";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import ArrowUpIcon from "@/components/icons/ui/ArrowUpIcon";
import ArrowDownIcon from "@/components/icons/ui/ArrowDownIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import DollarSignIcon from "@/components/icons/ui/DollarSignIcon";
import ScaleIcon from "@/components/icons/ui/ScaleIcon";
import ScanLineIcon from "@/components/icons/ui/ScanLineIcon";
import WarehouseIcon from "@/components/icons/ui/WarehouseIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import CrownIcon from "@/components/icons/ui/CrownIcon";
import { useState } from "react";
import type { ModelFormState } from "@/types/product-form";
import { createEmptyModel, slugify } from "@/types/product-form";
import SelectWithCreate from "./SelectWithCreate";
import BarcodeQRDisplay from "./BarcodeQRDisplay";

interface Props {
  models: ModelFormState[];
  onChange: (models: ModelFormState[]) => void;
  suppliers?: { id: string; name: string; logo: string | null }[];
  onClickCreateSupplier?: (modelTempId: string) => void;
  hidePrimary?: boolean;  // when true, skip the first model (it's shown in Hero)
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

function ModelCard({
  model, idx, total, onUpdate, onRemove, onDuplicate, onMoveUp, onMoveDown,
  suppliers, onClickCreateSupplier, defaultOpen = true, isPrimary = false,
}: {
  model: ModelFormState; idx: number; total: number;
  onUpdate: (u: Partial<ModelFormState>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  suppliers?: { id: string; name: string; logo: string | null }[];
  onClickCreateSupplier?: () => void;
  defaultOpen?: boolean;
  isPrimary?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const inp = "w-full h-10 px-4 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-colors";
  const lbl = "block text-[10px] font-semibold text-[var(--text-ghost)] uppercase tracking-wider mb-1.5";

  const isActive = model.status === "active";
  const barcodeValue = model.barcode || model.slug || model.model_name;
  const qrPayload = JSON.stringify({
    sku: model.slug || barcodeValue,
    name: model.model_name,
    ref: model.reference_model || null,
  });

  return (
    <div className={`bg-[var(--bg-secondary)] rounded-2xl border overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.1)] ${
      isPrimary ? "border-amber-500/40 ring-1 ring-amber-500/20" : "border-[var(--border-subtle)]"
    }`}>
      {/* Header */}
      <div
        className={`flex items-center justify-between px-5 py-4 cursor-pointer transition-colors hover:bg-[var(--bg-surface-subtle)]/40 ${
          open ? "border-b border-[var(--border-subtle)]" : ""
        }`}
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-10 w-10 shrink-0 rounded-xl border flex items-center justify-center text-[12px] font-bold ${
            isPrimary
              ? "bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-amber-500/40 text-amber-300"
              : "bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)]"
          }`}>
            {isPrimary ? <CrownIcon className="h-4 w-4" /> : idx + 1}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
                {model.model_name || "Untitled Model"}
              </span>
              {isPrimary && (
                <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-amber-500/15 border border-amber-500/40 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                  <CrownIcon className="h-2.5 w-2.5" /> Primary
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1 h-5 px-2 rounded-full border text-[9px] font-bold uppercase tracking-wider ${
                  isActive
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                }`}
                title={isActive ? "Active" : "Discontinued"}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-400" : "bg-amber-400"}`} />
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
            title="Move up"
          >
            <ArrowUpIcon className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            disabled={idx === total - 1}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Move down"
          >
            <ArrowDownIcon className="h-3.5 w-3.5" />
          </button>
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
          {open ? <AngleUpIcon className="h-4 w-4 text-[var(--text-ghost)] ml-1" /> : <AngleDownIcon className="h-4 w-4 text-[var(--text-ghost)] ml-1" />}
        </div>
      </div>

      {open && (
        <div className="p-5 space-y-4">
          {/* Identity row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className={lbl}>Model Name *</label>
              <input
                type="text"
                value={model.model_name}
                onChange={(e) => onUpdate({ model_name: e.target.value, slug: slugify(e.target.value) })}
                placeholder="e.g. KX-9500-D"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Slug / SKU</label>
              <input
                type="text"
                value={model.slug}
                onChange={(e) => onUpdate({ slug: e.target.value })}
                className={`${inp} font-mono text-[var(--text-muted)]`}
              />
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select
                value={model.status}
                onChange={(e) => onUpdate({ status: e.target.value as "active" | "discontinued" })}
                className={inp}
              >
                <option value="active">Active</option>
                <option value="discontinued">Discontinued</option>
              </select>
            </div>
          </div>

          <div>
            <label className={lbl}>Tagline</label>
            <input
              type="text"
              value={model.tagline}
              onChange={(e) => onUpdate({ tagline: e.target.value })}
              placeholder="Short sub-title shown under the model name"
              className={inp}
            />
          </div>

          {/* Supplier + Pricing panel */}
          <Panel icon={<DollarSignIcon className="h-3.5 w-3.5" />} title="Supplier & Pricing">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={lbl}>Supplier</label>
                {suppliers ? (
                  <SelectWithCreate
                    value={model.supplier}
                    options={suppliers.map((s) => ({ value: s.name, label: s.name, icon: s.logo }))}
                    onChange={(val) => onUpdate({ supplier: val })}
                    onClickCreate={onClickCreateSupplier}
                    placeholder="Select supplier..."
                    createLabel="Create Supplier"
                    className="[&_button]:h-10 [&_button]:rounded-lg [&_button]:bg-[var(--bg-surface-subtle)]/70"
                  />
                ) : (
                  <input type="text" value={model.supplier} onChange={(e) => onUpdate({ supplier: e.target.value })} placeholder="Supplier name" className={inp} />
                )}
              </div>
              <div>
                <label className={lbl}>Supplier Reference Model</label>
                <input
                  type="text"
                  value={model.reference_model}
                  onChange={(e) => onUpdate({ reference_model: e.target.value })}
                  placeholder="e.g. Factory model code"
                  className={inp}
                />
              </div>
              <div>
                {/* Cost is what Koleex pays the Chinese factory —
                    stored + entered in CNY (¥) across the whole form.
                    Selling prices below stay in USD since we sell
                    globally. */}
                <label className={lbl}>Cost Price (CNY)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-ghost)]">¥</span>
                  <input type="number" step="0.01" value={model.cost_price} onChange={(e) => onUpdate({ cost_price: e.target.value })} placeholder="0.00" className={`${inp} pl-7`} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
              <div>
                <label className={lbl}>Global Selling Price (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-ghost)]">$</span>
                  <input type="number" step="0.01" value={model.global_price} onChange={(e) => onUpdate({ global_price: e.target.value })} placeholder="0.00" className={`${inp} pl-7`} />
                </div>
              </div>
              <div>
                <label className={lbl}>Head-Only Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-ghost)]">$</span>
                  <input type="number" step="0.01" value={model.head_only_price} onChange={(e) => onUpdate({ head_only_price: e.target.value })} placeholder="0.00" className={`${inp} pl-7`} />
                </div>
              </div>
              <div>
                <label className={lbl}>Complete Set Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-ghost)]">$</span>
                  <input type="number" step="0.01" value={model.complete_set_price} onChange={(e) => onUpdate({ complete_set_price: e.target.value })} placeholder="0.00" className={`${inp} pl-7`} />
                </div>
              </div>
            </div>
          </Panel>

          {/* Packaging & Logistics panel */}
          <Panel icon={<PackageIcon className="h-3.5 w-3.5" />} title="Packaging & Logistics">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={lbl}>Weight (kg)</label>
                <input type="number" step="0.1" value={model.weight} onChange={(e) => onUpdate({ weight: e.target.value })} placeholder="0.0" className={inp} />
              </div>
              <div>
                <label className={lbl}>CBM (m³)</label>
                <input type="number" step="0.0001" value={model.cbm} onChange={(e) => onUpdate({ cbm: e.target.value })} placeholder="0.0000" className={inp} />
              </div>
              <div>
                <label className={lbl}>Packing Type</label>
                <input type="text" value={model.packing_type} onChange={(e) => onUpdate({ packing_type: e.target.value })} placeholder="e.g. Wooden crate" className={inp} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div>
                <label className={lbl}>Box Includes</label>
                <input type="text" value={model.box_include} onChange={(e) => onUpdate({ box_include: e.target.value })} placeholder="e.g. Main unit, cable, manual" className={inp} />
              </div>
              <div>
                <label className={lbl}>Extra Accessories</label>
                <input type="text" value={model.extra_accessories} onChange={(e) => onUpdate({ extra_accessories: e.target.value })} placeholder="e.g. Spare parts kit" className={inp} />
              </div>
            </div>
          </Panel>

          {/* Advanced (MOQ / Lead Time / Barcode override) */}
          <details className="group">
            <summary className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--bg-surface-subtle)]/50 transition-colors list-none">
              <WarehouseIcon className="h-3.5 w-3.5 text-[var(--text-ghost)]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">Advanced · Fulfillment & Codes</span>
              <AngleDownIcon className="h-3.5 w-3.5 text-[var(--text-ghost)] ml-auto transition-transform group-open:rotate-180" />
            </summary>
            <div className="pt-3 px-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={lbl}>MOQ (Min Order Qty)</label>
                  <input type="number" value={model.moq} onChange={(e) => onUpdate({ moq: e.target.value })} placeholder="e.g. 10" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Lead Time</label>
                  <input type="text" value={model.lead_time} onChange={(e) => onUpdate({ lead_time: e.target.value })} placeholder="e.g. 7-14 days" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Barcode Override</label>
                  <input type="text" value={model.barcode} onChange={(e) => onUpdate({ barcode: e.target.value })} placeholder="Leave empty = auto from SKU" className={`${inp} font-mono`} />
                </div>
              </div>
            </div>
          </details>

          {/* Auto-generated codes panel */}
          <Panel icon={<ScanLineIcon className="h-3.5 w-3.5" />} title="Auto-Generated Codes">
            <BarcodeQRDisplay value={barcodeValue} label={model.model_name} qrPayload={qrPayload} />
          </Panel>
        </div>
      )}
    </div>
  );
}

export default function ModelsSection({ models, onChange, suppliers, onClickCreateSupplier, hidePrimary = false }: Props) {
  const addModel = () => {
    onChange([...models, { ...createEmptyModel(), order: models.length }]);
  };

  const updateModel = (tempId: string, updates: Partial<ModelFormState>) => {
    onChange(models.map((m) => (m._tempId === tempId ? { ...m, ...updates } : m)));
  };

  const removeModel = (tempId: string) => {
    if (!confirm("Remove this model?")) return;
    onChange(models.filter((m) => m._tempId !== tempId));
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
              {hidePrimary ? "Additional Model Variants" : "Product Models / Variants"}
            </h3>
          </div>
          <p className="text-[11px] text-[var(--text-ghost)] mt-0.5">
            {hidePrimary
              ? "Primary model is entered in the Hero. Add extra variants only when needed."
              : "SKU is auto-generated on save. Barcode & QR codes are generated automatically."}
          </p>
        </div>
        <button
          onClick={addModel}
          className="h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-1.5 hover:opacity-90 transition-all shadow-sm"
        >
          <PlusIcon className="h-3.5 w-3.5" /> Add Model
        </button>
      </div>

      {visibleModels.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-[var(--border-subtle)] rounded-2xl bg-[var(--bg-surface-subtle)]/30">
          <ScaleIcon className="h-8 w-8 text-[var(--text-ghost)] mx-auto mb-2" />
          <p className="text-[13px] text-[var(--text-dim)] font-medium">
            {hidePrimary ? "No additional variants" : "No models yet"}
          </p>
          <p className="text-[11px] text-[var(--text-ghost)] mt-1">
            {hidePrimary ? "Add a variant when this product has multiple versions" : "Add your first model variant"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleModels.map((m, i) => {
            const trueIdx = startIndex + i;
            return (
              <ModelCard
                key={m._tempId}
                model={m}
                idx={trueIdx}
                total={models.length}
                isPrimary={!hidePrimary && trueIdx === 0}
                onUpdate={(u) => updateModel(m._tempId, u)}
                onRemove={() => removeModel(m._tempId)}
                onDuplicate={() => duplicateModel(m._tempId)}
                onMoveUp={() => moveUp(trueIdx)}
                onMoveDown={() => moveDown(trueIdx)}
                suppliers={suppliers}
                onClickCreateSupplier={onClickCreateSupplier ? () => onClickCreateSupplier(m._tempId) : undefined}
                defaultOpen={i === 0}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
