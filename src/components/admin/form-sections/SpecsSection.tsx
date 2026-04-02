"use client";

import { Plus, Trash2 } from "lucide-react";
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
      <div className="flex items-center justify-between mb-4">
        <label className="text-[12px] font-medium text-white/50">Technical Specifications</label>
        <button
          onClick={addSpec}
          className="h-8 px-3 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[12px] text-white/60 hover:text-white/80 flex items-center gap-1.5 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add Spec
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="text-[13px] text-white/20 py-4 text-center">No specs added. Click &quot;Add Spec&quot; to begin.</p>
      ) : (
        <div className="space-y-2">
          {entries.map(([key, value], idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={key}
                onChange={(e) => updateKey(key, e.target.value)}
                placeholder="Key (e.g. Payload)"
                className="flex-1 h-10 px-4 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[13px] text-white placeholder:text-white/25 outline-none focus:border-white/20"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => updateValue(key, e.target.value)}
                placeholder="Value (e.g. 5 kg)"
                className="flex-1 h-10 px-4 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[13px] text-white placeholder:text-white/25 outline-none focus:border-white/20"
              />
              <button onClick={() => removeSpec(key)} className="h-10 w-10 flex items-center justify-center rounded-lg text-white/20 hover:text-red-400/70 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
