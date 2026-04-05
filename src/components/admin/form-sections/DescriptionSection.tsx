"use client";

import type { ProductFormState } from "@/types/product-form";

interface Props {
  data: Pick<ProductFormState, "description">;
  onChange: (u: Partial<ProductFormState>) => void;
}

export default function DescriptionSection({ data, onChange }: Props) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">Product Description</label>
      <textarea
        value={data.description}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Describe the product..."
        rows={8}
        className="w-full px-4 py-3 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] resize-y leading-relaxed"
      />
      <p className="text-[11px] text-[var(--text-ghost)] mt-1.5">{data.description.length} characters</p>
    </div>
  );
}
