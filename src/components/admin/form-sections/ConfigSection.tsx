"use client";

import type { ProductFormState } from "@/types/product-form";

interface Props {
  data: Pick<ProductFormState, "supports_head_only" | "supports_complete_set" | "warranty" | "visible" | "featured">;
  onChange: (u: Partial<ProductFormState>) => void;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${checked ? "bg-emerald-500/60" : "bg-[var(--bg-surface)]"}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-[var(--bg-inverted)] shadow transition-transform duration-200 ${checked ? "translate-x-5" : ""}`} />
      </button>
      <span className="text-[13px] text-[var(--text-muted)] group-hover:text-[var(--text-primary)]/80 transition-colors">{label}</span>
    </label>
  );
}

export default function ConfigSection({ data, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-3">Product Configuration</label>
        <div className="space-y-3">
          <Toggle checked={data.supports_head_only} onChange={(v) => onChange({ supports_head_only: v })} label="Supports head-only purchase" />
          <Toggle checked={data.supports_complete_set} onChange={(v) => onChange({ supports_complete_set: v })} label="Supports complete set purchase" />
        </div>
      </div>
      <div>
        <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">Warranty</label>
        <input
          type="text"
          value={data.warranty}
          onChange={(e) => onChange({ warranty: e.target.value })}
          placeholder="e.g. 2 years parts & labor"
          className="w-full h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
        />
      </div>
      <div>
        <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-3">Visibility</label>
        <div className="space-y-3">
          <Toggle checked={data.visible} onChange={(v) => onChange({ visible: v })} label="Visible on website" />
          <Toggle checked={data.featured} onChange={(v) => onChange({ featured: v })} label="Featured product" />
        </div>
      </div>
    </div>
  );
}
