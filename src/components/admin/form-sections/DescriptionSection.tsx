"use client";

import type { ProductFormState } from "@/types/product-form";
import RichTextEditor from "./RichTextEditor";

interface Props {
  data: Pick<ProductFormState, "description">;
  onChange: (u: Partial<ProductFormState>) => void;
}

export default function DescriptionSection({ data, onChange }: Props) {
  // Strip HTML for plain-text character count
  const plainText = (data.description || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();

  return (
    <div>
      <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-2">Product Description</label>
      <RichTextEditor
        value={data.description}
        onChange={(html) => onChange({ description: html })}
        placeholder="Write a compelling description for this product. Use headings for sections, bullet lists for features, and tables for specs."
        minHeight={280}
      />
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-[11px] text-[var(--text-ghost)]">{plainText.length} characters</p>
        <p className="text-[10px] text-[var(--text-ghost)] italic">Rich text · HTML saved to Supabase</p>
      </div>
    </div>
  );
}
