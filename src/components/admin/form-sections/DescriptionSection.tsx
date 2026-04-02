"use client";

import type { ProductFormState } from "@/types/product-form";

interface Props {
  data: Pick<ProductFormState, "description">;
  onChange: (u: Partial<ProductFormState>) => void;
}

export default function DescriptionSection({ data, onChange }: Props) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-white/50 mb-1.5">Product Description</label>
      <textarea
        value={data.description}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Describe the product..."
        rows={8}
        className="w-full px-4 py-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[14px] text-white placeholder:text-white/25 outline-none focus:border-white/20 resize-y leading-relaxed"
      />
      <p className="text-[11px] text-white/20 mt-1.5">{data.description.length} characters</p>
    </div>
  );
}
