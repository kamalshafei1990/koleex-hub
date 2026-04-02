"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import AdminAuth from "@/components/admin/AdminAuth";
import TaxonomyAdmin from "@/components/admin/TaxonomyAdmin";
import {
  fetchDivisions, createDivision, updateDivision, deleteDivision,
  fetchCategoryCounts,
} from "@/lib/products-admin";
import type { DivisionRow } from "@/types/supabase";

function DivisionsContent() {
  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [catCounts, setCatCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [divs, counts] = await Promise.all([fetchDivisions(), fetchCategoryCounts()]);
    setDivisions(divs);
    setCatCounts(counts);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const items = useMemo(() => divisions.map(d => ({
    id: d.id, name: d.name, slug: d.slug,
    description: d.tagline || d.description, order: d.order, created_at: d.created_at,
  })), [divisions]);

  return (
    <TaxonomyAdmin
      title="Divisions"
      singular="Division"
      backHref="/products"
      items={items}
      childCounts={catCounts}
      childLabel="Categories"
      loading={loading}
      onRefresh={load}
      onCreate={async (data) => {
        const result = await createDivision({
          name: data.name, slug: data.slug,
          tagline: data.description || null, description: data.description || null,
          order: data.order,
        });
        return !!result;
      }}
      onUpdate={async (id, data) => {
        return updateDivision(id, {
          name: data.name, slug: data.slug,
          tagline: data.description || null, description: data.description || null,
          order: data.order,
        });
      }}
      onDelete={deleteDivision}
      onReorder={async (id, newOrder) => updateDivision(id, { order: newOrder })}
    />
  );
}

export default function DivisionsPage() {
  return (
    <AdminAuth title="Taxonomy Admin" subtitle="Manage product divisions">
      <DivisionsContent />
    </AdminAuth>
  );
}
