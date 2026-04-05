"use client";

import type { DivisionRow, CategoryRow, SubcategoryRow } from "@/types/supabase";
import type { ProductFormState } from "@/types/product-form";
import { useMemo } from "react";
import SelectWithCreate from "./SelectWithCreate";

interface Props {
  data: Pick<ProductFormState, "division_slug" | "category_slug" | "subcategory_slug">;
  onChange: (u: Partial<ProductFormState>) => void;
  divisions: DivisionRow[];
  categories: CategoryRow[];
  subcategories: SubcategoryRow[];
  onCreateDivision?: (name: string) => Promise<string | null>;
  onCreateCategory?: (name: string) => Promise<string | null>;
  onCreateSubcategory?: (name: string) => Promise<string | null>;
}

export default function ClassificationSection({
  data, onChange, divisions, categories, subcategories,
  onCreateDivision, onCreateCategory, onCreateSubcategory,
}: Props) {
  const selectedDivId = useMemo(() => divisions.find(d => d.slug === data.division_slug)?.id, [divisions, data.division_slug]);
  const filteredCats = useMemo(() => selectedDivId ? categories.filter(c => c.division_id === selectedDivId) : [], [categories, selectedDivId]);
  const selectedCatId = useMemo(() => categories.find(c => c.slug === data.category_slug)?.id, [categories, data.category_slug]);
  const filteredSubs = useMemo(() => selectedCatId ? subcategories.filter(s => s.category_id === selectedCatId) : [], [subcategories, selectedCatId]);

  const divisionOptions = divisions.map(d => ({ value: d.slug, label: d.name }));
  const categoryOptions = filteredCats.map(c => ({ value: c.slug, label: c.name }));
  const subcategoryOptions = filteredSubs.map(s => ({ value: s.slug, label: s.name }));

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">Division *</label>
        <SelectWithCreate
          value={data.division_slug}
          options={divisionOptions}
          onChange={(val) => onChange({ division_slug: val, category_slug: "", subcategory_slug: "" })}
          onCreate={onCreateDivision}
          placeholder="Select division..."
          createLabel="Create Division"
        />
      </div>
      <div>
        <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">Category *</label>
        <SelectWithCreate
          value={data.category_slug}
          options={categoryOptions}
          onChange={(val) => onChange({ category_slug: val, subcategory_slug: "" })}
          onCreate={data.division_slug ? onCreateCategory : undefined}
          placeholder={data.division_slug ? "Select category..." : "Select a division first"}
          disabled={!data.division_slug}
          createLabel="Create Category"
        />
      </div>
      <div>
        <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">Subcategory *</label>
        <SelectWithCreate
          value={data.subcategory_slug}
          options={subcategoryOptions}
          onChange={(val) => onChange({ subcategory_slug: val })}
          onCreate={data.category_slug ? onCreateSubcategory : undefined}
          placeholder={data.category_slug ? "Select subcategory..." : "Select a category first"}
          disabled={!data.category_slug}
          createLabel="Create Subcategory"
        />
      </div>
    </div>
  );
}
