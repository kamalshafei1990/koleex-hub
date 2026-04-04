"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import TaxonomyAdmin from "@/components/admin/TaxonomyAdmin";
import {
  fetchDivisions, fetchCategories, createCategory, updateCategory,
  deleteCategory, fetchSubcategoryCounts,
} from "@/lib/products-admin";
import type { DivisionRow, CategoryRow } from "@/types/supabase";

function CategoriesContent() {
  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [subCounts, setSubCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [divs, cats, counts] = await Promise.all([
      fetchDivisions(), fetchCategories(), fetchSubcategoryCounts(),
    ]);
    setDivisions(divs);
    setCategories(cats);
    setSubCounts(counts);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const parentOptions = useMemo(() => divisions.map(d => ({ id: d.id, name: d.name })), [divisions]);
  const parentMap = useMemo(() => Object.fromEntries(divisions.map(d => [d.id, d.name])), [divisions]);

  const items = useMemo(() => categories.map(c => ({
    id: c.id, name: c.name, slug: c.slug,
    description: c.description, order: c.order,
    parent_id: c.division_id, created_at: c.created_at,
  })), [categories]);

  return (
    <TaxonomyAdmin
      title="Categories"
      singular="Category"
      backHref="/products"
      parentLabel="Division"
      parentOptions={parentOptions}
      parentMap={parentMap}
      items={items}
      childCounts={subCounts}
      childLabel="Subcategories"
      loading={loading}
      onRefresh={load}
      onCreate={async (data) => {
        const result = await createCategory({
          division_id: data.parent_id, name: data.name,
          slug: data.slug, description: data.description || null, order: data.order,
        });
        return !!result;
      }}
      onUpdate={async (id, data) => {
        return updateCategory(id, {
          division_id: data.parent_id, name: data.name,
          slug: data.slug, description: data.description || null, order: data.order,
        });
      }}
      onDelete={deleteCategory}
      onReorder={async (id, newOrder) => updateCategory(id, { order: newOrder })}
    />
  );
}

export default function CategoriesPage() {
  return <CategoriesContent />;
}
