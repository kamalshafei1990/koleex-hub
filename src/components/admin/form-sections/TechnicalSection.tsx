"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { ProductFormState } from "@/types/product-form";

interface Props {
  data: Pick<ProductFormState, "hs_code" | "voltage" | "plug_types" | "watt" | "colors">;
  onChange: (u: Partial<ProductFormState>) => void;
}

function ChipInput({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState("");

  const add = () => {
    const v = input.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setInput("");
  };

  return (
    <div>
      <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map(v => (
          <span key={v} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[var(--bg-surface)] text-[12px] text-[var(--text-muted)]">
            {v}
            <button onClick={() => onChange(values.filter(x => x !== v))} className="text-[var(--text-dim)] hover:text-[var(--text-muted)]"><X className="h-3 w-3" /></button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        placeholder={placeholder}
        className="w-full h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
      />
    </div>
  );
}

export default function TechnicalSection({ data, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">HS Code</label>
          <input
            type="text"
            value={data.hs_code}
            onChange={(e) => onChange({ hs_code: e.target.value })}
            placeholder="e.g. 8428.90"
            className="w-full h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
          />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">Watt</label>
          <input
            type="text"
            value={data.watt}
            onChange={(e) => onChange({ watt: e.target.value })}
            placeholder="e.g. 500W"
            className="w-full h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
          />
        </div>
      </div>
      <ChipInput label="Voltage Options" values={data.voltage} onChange={(v) => onChange({ voltage: v })} placeholder="e.g. 220V (Enter to add)" />
      <ChipInput label="Plug Types" values={data.plug_types} onChange={(v) => onChange({ plug_types: v })} placeholder="e.g. Type C (Enter to add)" />
      <ChipInput label="Colors" values={data.colors} onChange={(v) => onChange({ colors: v })} placeholder="e.g. Silver (Enter to add)" />
    </div>
  );
}
