"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import AdminAuth from "@/components/admin/AdminAuth";
import TaxonomyAdmin from "@/components/admin/TaxonomyAdmin";
import {
  fetchDivisions, fetchCategories, fetchSubcategories,
  createSubcategory, updateSubcategory, deleteSubcategory,
} from "@/lib/products-admin";
import type { DivisionRow, CategoryRow, SubcategoryRow } from "@/types/supabase";

function SubcategoriesContent() {
  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [divs, cats, subs] = await Promise.all([
      fetchDivisions(), fetchCategories(), fetchSubcategories(),
    ]);
    setDivisions(divs);
    setCategories(cats);
    setSubcategories(subs);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Build parent options: show "Division > Category" for clarity
  const parentOptions = useMemo(() => {
    const divMap = Object.fromEntries(divisions.map(d => [d.id, d.name]));
    return categories.map(c => ({
      id: c.id,
      name: `${divMap[c.division_id] || "?"} → ${c.name}`,
    }));
  }, [divisions, categories]);

  const parentMap = useMemo(() => {
    const divMap = Object.fromEntries(divisions.map(d => [d.id, d.name]));
    return Object.fromEntries(categories.map(c => [c.id, `${divMap[c.division_id] || "?"} → ${c.name}`]));
  }, [divisions, categories]);

  const items = useMemo(() => subcategories.map(s => ({
    id: s.id, name: s.name, slug: s.slug,
    description: s.description, order: s.order,
    parent_id: s.category_id, created_at: s.created_at,
  })), [subcategories]);

  return (
    <TaxonomyAdmin
      title="Subcategories"
      singular="Subcategory"
      backHref="/products"
      parentLabel="Category"
      parentOptions={parentOptions}
      parentMap={parentMap}
      items={items}
      loading={loading}
      onRefresh={load}
      onCreate={async (data) => {
        const result = await createSubcategory({
          category_id: data.parent_id, name: data.name,
          slug: data.slug, description: data.description || null, order: data.order,
        });
        return !!result;
      }}
      onUpdate={async (id, data) => {
        return updateSubcategory(id, {
          category_id: data.parent_id, name: data.name,
          slug: data.slug, description: data.description || null, order: data.order,
        });
      }}
      onDelete={deleteSubcategory}
      onReorder={async (id, newOrder) => updateSubcategory(id, { order: newOrder })}
    />
  );
}

export default function SubcategoriesPage() {
  return (
    <AdminAuth title="Taxonomy Admin" subtitle="Manage product subcategories">
      <SubcategoriesContent />
    </AdminAuth>
  );
}
