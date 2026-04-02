"use client";

import type { DivisionRow, CategoryRow, SubcategoryRow } from "@/types/supabase";
import type { ProductFormState } from "@/types/product-form";
import { useMemo } from "react";

interface Props {
  data: Pick<ProductFormState, "division_slug" | "category_slug" | "subcategory_slug">;
  onChange: (u: Partial<ProductFormState>) => void;
  divisions: DivisionRow[];
  categories: CategoryRow[];
  subcategories: SubcategoryRow[];
}

export default function ClassificationSection({ data, onChange, divisions, categories, subcategories }: Props) {
  const selectedDivId = useMemo(() => divisions.find(d => d.slug === data.division_slug)?.id, [divisions, data.division_slug]);
  const filteredCats = useMemo(() => selectedDivId ? categories.filter(c => c.division_id === selectedDivId) : [], [categories, selectedDivId]);
  const selectedCatId = useMemo(() => categories.find(c => c.slug === data.category_slug)?.id, [categories, data.category_slug]);
  const filteredSubs = useMemo(() => selectedCatId ? subcategories.filter(s => s.category_id === selectedCatId) : [], [subcategories, selectedCatId]);

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-[12px] font-medium text-white/50 mb-1.5">Division *</label>
        <select
          value={data.division_slug}
          onChange={(e) => onChange({ division_slug: e.target.value, category_slug: "", subcategory_slug: "" })}
          className="w-full h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[14px] text-white outline-none focus:border-white/20"
        >
          <option value="">Select division...</option>
          {divisions.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[12px] font-medium text-white/50 mb-1.5">Category *</label>
        <select
          value={data.category_slug}
          onChange={(e) => onChange({ category_slug: e.target.value, subcategory_slug: "" })}
          className="w-full h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[14px] text-white outline-none focus:border-white/20"
          disabled={!data.division_slug}
        >
          <option value="">{data.division_slug ? "Select category..." : "Select a division first"}</option>
          {filteredCats.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[12px] font-medium text-white/50 mb-1.5">Subcategory *</label>
        <select
          value={data.subcategory_slug}
          onChange={(e) => onChange({ subcategory_slug: e.target.value })}
          className="w-full h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[14px] text-white outline-none focus:border-white/20"
          disabled={!data.category_slug}
        >
          <option value="">{data.category_slug ? "Select subcategory..." : "Select a category first"}</option>
          {filteredSubs.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}
        </select>
      </div>
    </div>
  );
}
