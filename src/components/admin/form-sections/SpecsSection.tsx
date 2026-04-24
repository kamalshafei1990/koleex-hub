"use client";

import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import type { ProductFormState } from "@/types/product-form";

interface Props {
  data: Pick<ProductFormState, "specs">;
  onChange: (u: Partial<ProductFormState>) => void;
}

export default function SpecsSection({ data, onChange }: Props) {
  const entries = Object.entries(data.specs);

  const updateKey = (oldKey: string, newKey: string) => {
    const newSpecs: Record<string, string> = {};
    for (const [k, v] of entries) {
      newSpecs[k === oldKey ? newKey : k] = v;
    }
    onChange({ specs: newSpecs });
  };

  const updateValue = (key: string, value: string) => {
    onChange({ specs: { ...data.specs, [key]: value } });
  };

  const addSpec = () => {
    onChange({ specs: { ...data.specs, "": "" } });
  };

  const removeSpec = (key: string) => {
    const newSpecs = { ...data.specs };
    delete newSpecs[key];
    onChange({ specs: newSpecs });
  };

  return (
    <div>
      {/* Label deliberately reads "Additional Key-Value Specs",
          NOT "Technical Specifications". The wizard has a separate
          "Technical Details" step (voltage, plug types, dimensions,
          etc.); reusing "Technical" in this inline key/value table
          meant admins couldn't tell the two apart. These are
          freeform facts that don't fit the structured Technical
          step — e.g. payload, stitching style, language support. */}
      <div className="flex items-center justify-between mb-4">
        <label className="text-[12px] font-medium text-[var(--text-subtle)]">Additional Key-Value Specs</label>
        <button
          onClick={addSpec}
          className="h-8 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)]/80 flex items-center gap-1.5 transition-colors"
        >
          <PlusIcon className="h-3.5 w-3.5" /> Add Spec
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="text-[13px] text-[var(--text-ghost)] py-4 text-center">No specs added. Click &quot;Add Spec&quot; to begin.</p>
      ) : (
        <div className="space-y-2">
          {entries.map(([key, value], idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={key}
                onChange={(e) => updateKey(key, e.target.value)}
                placeholder="Key (e.g. Payload)"
                className="flex-1 h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => updateValue(key, e.target.value)}
                placeholder="Value (e.g. 5 kg)"
                className="flex-1 h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
              />
              <button onClick={() => removeSpec(key)} className="h-10 w-10 flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-red-400/70 transition-colors">
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
