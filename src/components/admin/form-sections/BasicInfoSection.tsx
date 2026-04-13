"use client";

import { useState } from "react";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import type { ProductFormState } from "@/types/product-form";
import { slugify } from "@/types/product-form";

interface Props {
  data: Pick<ProductFormState, "product_name" | "slug" | "brand" | "level" | "tags">;
  onChange: (u: Partial<ProductFormState>) => void;
  slugEdited: boolean;
  onSlugEdited: () => void;
}

export default function BasicInfoSection({ data, onChange, slugEdited, onSlugEdited }: Props) {
  const [tagInput, setTagInput] = useState("");

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !data.tags.includes(t)) {
      onChange({ tags: [...data.tags, t] });
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    onChange({ tags: data.tags.filter(t => t !== tag) });
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">Product Name *</label>
        <input
          type="text"
          value={data.product_name}
          onChange={(e) => {
            const updates: Partial<ProductFormState> = { product_name: e.target.value };
            if (!slugEdited) updates.slug = slugify(e.target.value);
            onChange(updates);
          }}
          placeholder="e.g. KX CoBot"
          className="w-full h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
        />
      </div>
      <div>
        <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">Slug (URL)</label>
        <input
          type="text"
          value={data.slug}
          onChange={(e) => { onSlugEdited(); onChange({ slug: e.target.value }); }}
          className="w-full h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[14px] text-[var(--text-muted)] outline-none focus:border-[var(--border-focus)] font-mono"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">Brand</label>
          <input
            type="text"
            value={data.brand}
            onChange={(e) => onChange({ brand: e.target.value })}
            placeholder="e.g. Koleex"
            className="w-full h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
          />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">Level</label>
          <select
            value={data.level}
            onChange={(e) => onChange({ level: e.target.value })}
            className="w-full h-10 px-3 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
          >
            <option value="">Select...</option>
            <option value="entry">Entry</option>
            <option value="mid">Mid</option>
            <option value="premium">Premium</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">Tags</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {data.tags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[var(--bg-surface)] text-[12px] text-[var(--text-muted)]">
              {tag}
              <button onClick={() => removeTag(tag)} className="text-[var(--text-dim)] hover:text-[var(--text-muted)]"><CrossIcon className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
          placeholder="Type and press Enter to add..."
          className="w-full h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
        />
      </div>
    </div>
  );
}
