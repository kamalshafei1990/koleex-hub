"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Plus, Search, Trash2, Pencil, Eye, EyeOff, Package, Filter, X } from "lucide-react";
import {
  fetchProducts, fetchDivisions, fetchCategories, fetchSubcategories,
  fetchModelSummaries, deleteProduct,
} from "@/lib/products-admin";
import type { ProductRow, DivisionRow, CategoryRow, SubcategoryRow } from "@/types/supabase";

export default function ProductList() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryRow[]>([]);
  const [modelCounts, setModelCounts] = useState<Record<string, number>>({});
  const [productSuppliers, setProductSuppliers] = useState<Record<string, string[]>>({});
  const [allSuppliers, setAllSuppliers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterDiv, setFilterDiv] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterSub, setFilterSub] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterVisible, setFilterVisible] = useState("");
  const [filterFeatured, setFilterFeatured] = useState("");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, d, c, s, ms] = await Promise.all([
        fetchProducts(), fetchDivisions(), fetchCategories(),
        fetchSubcategories(), fetchModelSummaries(),
      ]);
      setProducts(p); setDivisions(d); setCategories(c);
      setSubcategories(s);
      setModelCounts(ms.counts);
      setProductSuppliers(ms.suppliers);
      setAllSuppliers(ms.allSuppliers);
      setLoading(false);
    })();
  }, []);

  // Derive unique brands and levels from products
  const allBrands = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.brand) set.add(p.brand); });
    return Array.from(set).sort();
  }, [products]);

  const allLevels = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.level) set.add(p.level); });
    return Array.from(set).sort();
  }, [products]);

  // Build lookup maps
  const divMap = useMemo(() => Object.fromEntries(divisions.map(d => [d.slug, d.name])), [divisions]);
  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [c.slug, c.name])), [categories]);

  // Cascading dropdowns
  const selectedDivId = useMemo(() => divisions.find(d => d.slug === filterDiv)?.id, [divisions, filterDiv]);
  const filteredCats = useMemo(() => selectedDivId ? categories.filter(c => c.division_id === selectedDivId) : categories, [categories, selectedDivId]);
  const selectedCatId = useMemo(() => categories.find(c => c.slug === filterCat)?.id, [categories, filterCat]);
  const filteredSubs = useMemo(() => selectedCatId ? subcategories.filter(s => s.category_id === selectedCatId) : subcategories, [subcategories, selectedCatId]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (filterDiv && p.division_slug !== filterDiv) return false;
      if (filterCat && p.category_slug !== filterCat) return false;
      if (filterSub && p.subcategory_slug !== filterSub) return false;
      if (filterBrand && p.brand !== filterBrand) return false;
      if (filterLevel && p.level !== filterLevel) return false;
      if (filterSupplier && !(productSuppliers[p.id] || []).includes(filterSupplier)) return false;
      if (filterVisible === "visible" && !p.visible) return false;
      if (filterVisible === "hidden" && p.visible) return false;
      if (filterFeatured === "yes" && !p.featured) return false;
      if (filterFeatured === "no" && p.featured) return false;
      if (search && !p.product_name.toLowerCase().includes(search.toLowerCase()) && !p.slug.includes(search.toLowerCase())) return false;
      return true;
    });
  }, [products, filterDiv, filterCat, filterSub, filterBrand, filterLevel, filterSupplier, filterVisible, filterFeatured, search, productSuppliers]);

  const activeFilterCount = [filterDiv, filterCat, filterSub, filterBrand, filterLevel, filterSupplier, filterVisible, filterFeatured].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilterDiv(""); setFilterCat(""); setFilterSub(""); setFilterBrand("");
    setFilterLevel(""); setFilterSupplier(""); setFilterVisible(""); setFilterFeatured("");
    setSearch("");
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This will also delete all models, media, translations, and prices.`)) return;
    const ok = await deleteProduct(id);
    if (ok) setProducts(prev => prev.filter(p => p.id !== id));
  };

  const selectClass = "h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[13px] text-white/70 outline-none focus:border-white/20";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="px-4 md:px-6 lg:px-8 py-6 md:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
            <h1 className="text-xl md:text-[24px] font-bold text-white flex items-center gap-2">
              <Package className="h-5 w-5 md:h-6 md:w-6 text-white/40" />
              Products
            </h1>
            <p className="text-[12px] md:text-[13px] text-white/30 mt-0.5">{products.length} products in catalog</p>
          </div>
          <Link
            href="/products/new"
            className="h-9 md:h-10 px-4 md:px-5 rounded-lg bg-white text-black text-[12px] md:text-[13px] font-semibold flex items-center gap-2 hover:bg-white/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Product</span>
            <span className="sm:hidden">Add</span>
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-[#141414] rounded-xl border border-white/[0.06] p-3 md:p-4 mb-4 md:mb-6">
          {/* Top row: search + filter toggle */}
          <div className="flex gap-3 mb-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or slug..."
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[13px] text-white placeholder:text-white/25 outline-none focus:border-white/20"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`h-10 px-4 rounded-lg border text-[12px] font-medium flex items-center gap-2 transition-colors ${
                showFilters || activeFilterCount > 0
                  ? "bg-white/[0.08] border-white/[0.12] text-white/80"
                  : "bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/60"
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="h-5 min-w-[20px] px-1 rounded-full bg-white/20 text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="h-10 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/30 hover:text-white/60 flex items-center gap-1.5 transition-colors"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="mt-3 pt-3 border-t border-white/[0.06]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Division */}
                <div>
                  <label className="block text-[10px] font-medium text-white/30 mb-1 uppercase tracking-wider">Division</label>
                  <select
                    value={filterDiv}
                    onChange={(e) => { setFilterDiv(e.target.value); setFilterCat(""); setFilterSub(""); }}
                    className={selectClass + " w-full"}
                  >
                    <option value="">All</option>
                    {divisions.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}
                  </select>
                </div>
                {/* Category */}
                <div>
                  <label className="block text-[10px] font-medium text-white/30 mb-1 uppercase tracking-wider">Category</label>
                  <select
                    value={filterCat}
                    onChange={(e) => { setFilterCat(e.target.value); setFilterSub(""); }}
                    className={selectClass + " w-full"}
                    disabled={!filterDiv}
                  >
                    <option value="">All</option>
                    {filteredCats.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                  </select>
                </div>
                {/* Subcategory */}
                <div>
                  <label className="block text-[10px] font-medium text-white/30 mb-1 uppercase tracking-wider">Subcategory</label>
                  <select
                    value={filterSub}
                    onChange={(e) => setFilterSub(e.target.value)}
                    className={selectClass + " w-full"}
                    disabled={!filterCat}
                  >
                    <option value="">All</option>
                    {filteredSubs.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}
                  </select>
                </div>
                {/* Supplier */}
                <div>
                  <label className="block text-[10px] font-medium text-white/30 mb-1 uppercase tracking-wider">Supplier</label>
                  <select
                    value={filterSupplier}
                    onChange={(e) => setFilterSupplier(e.target.value)}
                    className={selectClass + " w-full"}
                  >
                    <option value="">All</option>
                    {allSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {/* Brand */}
                <div>
                  <label className="block text-[10px] font-medium text-white/30 mb-1 uppercase tracking-wider">Brand</label>
                  <select
                    value={filterBrand}
                    onChange={(e) => setFilterBrand(e.target.value)}
                    className={selectClass + " w-full"}
                  >
                    <option value="">All</option>
                    {allBrands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                {/* Level */}
                <div>
                  <label className="block text-[10px] font-medium text-white/30 mb-1 uppercase tracking-wider">Level</label>
                  <select
                    value={filterLevel}
                    onChange={(e) => setFilterLevel(e.target.value)}
                    className={selectClass + " w-full"}
                  >
                    <option value="">All</option>
                    {allLevels.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
                  </select>
                </div>
                {/* Visibility */}
                <div>
                  <label className="block text-[10px] font-medium text-white/30 mb-1 uppercase tracking-wider">Visibility</label>
                  <select
                    value={filterVisible}
                    onChange={(e) => setFilterVisible(e.target.value)}
                    className={selectClass + " w-full"}
                  >
                    <option value="">All</option>
                    <option value="visible">Visible</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
                {/* Featured */}
                <div>
                  <label className="block text-[10px] font-medium text-white/30 mb-1 uppercase tracking-wider">Featured</label>
                  <select
                    value={filterFeatured}
                    onChange={(e) => setFilterFeatured(e.target.value)}
                    className={selectClass + " w-full"}
                  >
                    <option value="">All</option>
                    <option value="yes">Featured</option>
                    <option value="no">Not Featured</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results count */}
        {(activeFilterCount > 0 || search) && (
          <p className="text-[12px] text-white/25 mb-3 px-1">
            Showing {filtered.length} of {products.length} products
          </p>
        )}

        {/* Product List */}
        {loading ? (
          <div className="bg-[#141414] rounded-xl border border-white/[0.06] p-12 text-center text-white/30 text-[14px]">Loading products...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-[#141414] rounded-xl border border-white/[0.06] p-12 text-center">
            <Package className="h-10 w-10 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-[14px]">
              {products.length === 0 ? "No products yet. Add your first product." : "No products match your filters."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-[#141414] rounded-xl border border-white/[0.06] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/25">Product</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/25">Division</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/25">Category</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/25">Brand</th>
                    <th className="text-center px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/25">Models</th>
                    <th className="text-center px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/25">Status</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/25">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="text-[14px] font-medium text-white">{p.product_name}</div>
                        <div className="text-[11px] text-white/25 mt-0.5">{p.slug}</div>
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-white/50">{divMap[p.division_slug] || p.division_slug}</td>
                      <td className="px-5 py-3.5 text-[13px] text-white/50">{catMap[p.category_slug] || p.category_slug}</td>
                      <td className="px-5 py-3.5">
                        {p.brand ? (
                          <span className="text-[12px] text-white/50">{p.brand}</span>
                        ) : (
                          <span className="text-[12px] text-white/15">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-2 rounded-full bg-white/[0.06] text-[11px] font-medium text-white/50">
                          {modelCounts[p.id] || 0}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          {p.visible ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400/70">
                              <Eye className="h-3 w-3" /> Visible
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-white/25">
                              <EyeOff className="h-3 w-3" /> Hidden
                            </span>
                          )}
                          {p.featured && (
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-400/60">Featured</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/products/${p.id}/edit`}
                            className="h-8 w-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            onClick={() => handleDelete(p.id, p.product_name)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg text-white/30 hover:text-red-400/70 hover:bg-red-400/[0.06] transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {filtered.map((p) => (
                <div key={p.id} className="bg-[#141414] rounded-xl border border-white/[0.06] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium text-white truncate">{p.product_name}</div>
                      <div className="text-[11px] text-white/25 mt-0.5 truncate">{p.slug}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Link
                        href={`/products/${p.id}/edit`}
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        onClick={() => handleDelete(p.id, p.product_name)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-white/30 hover:text-red-400/70 hover:bg-red-400/[0.06] transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className="text-[11px] text-white/40 bg-white/[0.04] px-2 py-0.5 rounded">{divMap[p.division_slug] || p.division_slug}</span>
                    <span className="text-[11px] text-white/40 bg-white/[0.04] px-2 py-0.5 rounded">{catMap[p.category_slug] || p.category_slug}</span>
                    {p.brand && <span className="text-[11px] text-white/40 bg-white/[0.04] px-2 py-0.5 rounded">{p.brand}</span>}
                    <span className="text-[11px] text-white/40 bg-white/[0.04] px-2 py-0.5 rounded">{modelCounts[p.id] || 0} models</span>
                    {p.visible ? (
                      <span className="text-[11px] text-emerald-400/70 bg-emerald-400/[0.08] px-2 py-0.5 rounded flex items-center gap-1"><Eye className="h-3 w-3" /> Visible</span>
                    ) : (
                      <span className="text-[11px] text-white/25 bg-white/[0.04] px-2 py-0.5 rounded flex items-center gap-1"><EyeOff className="h-3 w-3" /> Hidden</span>
                    )}
                    {p.featured && <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/60 bg-amber-400/[0.08] px-2 py-0.5 rounded">Featured</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
