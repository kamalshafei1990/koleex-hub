"use client";

import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { ModelFormState } from "@/types/product-form";
import { createEmptyModel, slugify } from "@/types/product-form";
import SelectWithCreate from "./SelectWithCreate";

interface Props {
  models: ModelFormState[];
  onChange: (models: ModelFormState[]) => void;
  suppliers?: { id: string; name: string }[];
  onCreateSupplier?: (name: string) => Promise<string | null>;
}

function ModelCard({ model, idx, onUpdate, onRemove, suppliers, onCreateSupplier }: {
  model: ModelFormState; idx: number;
  onUpdate: (u: Partial<ModelFormState>) => void;
  onRemove: () => void;
  suppliers?: { id: string; name: string }[];
  onCreateSupplier?: (name: string) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(true);

  const inp = "w-full h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]";
  const lbl = "block text-[11px] font-medium text-[var(--text-faint)] mb-1";

  return (
    <div className="bg-[var(--bg-surface-subtle)] rounded-xl border border-white/[0.06] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-3">
          <span className="h-6 w-6 rounded-md bg-[var(--bg-surface)] flex items-center justify-center text-[11px] font-bold text-[var(--text-dim)]">{idx + 1}</span>
          <span className="text-[14px] font-medium text-[var(--text-highlight)]">{model.model_name || "Untitled Model"}</span>
          {model.id && <span className="text-[10px] font-mono text-[var(--text-ghost)]">SKU: {model.slug}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="h-7 w-7 flex items-center justify-center rounded-md text-[var(--text-ghost)] hover:text-red-400/70 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {open ? <ChevronUp className="h-4 w-4 text-[var(--text-ghost)]" /> : <ChevronDown className="h-4 w-4 text-[var(--text-ghost)]" />}
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/[0.04] pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Model Name *</label>
              <input type="text" value={model.model_name} onChange={(e) => onUpdate({ model_name: e.target.value, slug: slugify(e.target.value) })} placeholder="e.g. KX CoBot 5" className={inp} />
            </div>
            <div>
              <label className={lbl}>Slug</label>
              <input type="text" value={model.slug} onChange={(e) => onUpdate({ slug: e.target.value })} className={`${inp} font-mono text-[var(--text-subtle)]`} />
            </div>
          </div>
          <div>
            <label className={lbl}>Tagline</label>
            <input type="text" value={model.tagline} onChange={(e) => onUpdate({ tagline: e.target.value })} placeholder="e.g. 5 kg payload, desktop-class" className={inp} />
          </div>

          <div className="h-px bg-[var(--bg-surface-subtle)] my-2" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-ghost)]">Commercial (hidden from website)</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Supplier</label>
              {suppliers ? (
                <SelectWithCreate
                  value={model.supplier}
                  options={suppliers.map(s => ({ value: s.name, label: s.name }))}
                  onChange={(val) => onUpdate({ supplier: val })}
                  onCreate={onCreateSupplier}
                  placeholder="Select supplier..."
                  createLabel="Create Supplier"
                  className="[&_button]:h-10 [&_button]:rounded-lg [&_button]:bg-[var(--bg-inverted)]/[0.05]"
                />
              ) : (
                <input type="text" value={model.supplier} onChange={(e) => onUpdate({ supplier: e.target.value })} placeholder="Supplier name" className={inp} />
              )}
            </div>
            <div>
              <label className={lbl}>Cost Price (USD)</label>
              <input type="text" value={model.cost_price} onChange={(e) => onUpdate({ cost_price: e.target.value })} placeholder="0.00" className={inp} />
            </div>
          </div>

          <div className="h-px bg-[var(--bg-surface-subtle)] my-2" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-ghost)]">Pricing</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Global Price (USD)</label>
              <input type="text" value={model.global_price} onChange={(e) => onUpdate({ global_price: e.target.value })} placeholder="0.00" className={inp} />
            </div>
            <div>
              <label className={lbl}>Head-Only Price</label>
              <input type="text" value={model.head_only_price} onChange={(e) => onUpdate({ head_only_price: e.target.value })} placeholder="0.00" className={inp} />
            </div>
            <div>
              <label className={lbl}>Complete Set Price</label>
              <input type="text" value={model.complete_set_price} onChange={(e) => onUpdate({ complete_set_price: e.target.value })} placeholder="0.00" className={inp} />
            </div>
          </div>

          <div className="h-px bg-[var(--bg-surface-subtle)] my-2" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-ghost)]">Packaging & Logistics</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Weight (kg)</label>
              <input type="text" value={model.weight} onChange={(e) => onUpdate({ weight: e.target.value })} placeholder="0.00" className={inp} />
            </div>
            <div>
              <label className={lbl}>CBM</label>
              <input type="text" value={model.cbm} onChange={(e) => onUpdate({ cbm: e.target.value })} placeholder="0.0000" className={inp} />
            </div>
            <div>
              <label className={lbl}>Packing Type</label>
              <input type="text" value={model.packing_type} onChange={(e) => onUpdate({ packing_type: e.target.value })} placeholder="e.g. Wooden crate" className={inp} />
            </div>
          </div>
          <div>
            <label className={lbl}>Box Includes</label>
            <input type="text" value={model.box_include} onChange={(e) => onUpdate({ box_include: e.target.value })} placeholder="e.g. Main unit, power cable, manual" className={inp} />
          </div>
          <div>
            <label className={lbl}>Extra Accessories</label>
            <input type="text" value={model.extra_accessories} onChange={(e) => onUpdate({ extra_accessories: e.target.value })} placeholder="e.g. Spare parts kit" className={inp} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ModelsSection({ models, onChange, suppliers, onCreateSupplier }: Props) {
  const addModel = () => {
    onChange([...models, { ...createEmptyModel(), order: models.length }]);
  };

  const updateModel = (tempId: string, updates: Partial<ModelFormState>) => {
    onChange(models.map(m => m._tempId === tempId ? { ...m, ...updates } : m));
  };

  const removeModel = (tempId: string) => {
    if (!confirm("Remove this model?")) return;
    onChange(models.filter(m => m._tempId !== tempId));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <label className="text-[12px] font-medium text-[var(--text-subtle)]">Product Models / Variants</label>
          <p className="text-[11px] text-[var(--text-ghost)] mt-0.5">SKU is auto-generated on save</p>
        </div>
        <button
          onClick={addModel}
          className="h-8 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)]/80 flex items-center gap-1.5 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add Model
        </button>
      </div>
      {models.length === 0 ? (
        <p className="text-[13px] text-[var(--text-ghost)] py-8 text-center border border-dashed border-white/[0.06] rounded-xl">No models yet. Add your first model variant.</p>
      ) : (
        <div className="space-y-3">
          {models.map((m, i) => (
            <ModelCard
              key={m._tempId}
              model={m}
              idx={i}
              onUpdate={(u) => updateModel(m._tempId, u)}
              onRemove={() => removeModel(m._tempId)}
              suppliers={suppliers}
              onCreateSupplier={onCreateSupplier}
            />
          ))}
        </div>
      )}
    </div>
  );
}
