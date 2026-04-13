"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import EyeOffIcon from "@/components/icons/ui/EyeOffIcon";
import FilterIcon from "@/components/icons/ui/FilterIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import StarIcon from "@/components/icons/ui/StarIcon";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import ListIcon from "@/components/icons/ui/ListIcon";
import SettingsIcon2 from "@/components/icons/ui/SettingsIcon2";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import ProductsIcon from "@/components/icons/ProductsIcon";
import {
  fetchProducts, fetchDivisions, fetchCategories, fetchSubcategories,
  fetchModelSummaries, fetchProductMainImages, deleteProduct,
} from "@/lib/products-admin";
import type { ProductRow, DivisionRow, CategoryRow, SubcategoryRow } from "@/types/supabase";

export default function ProductList() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryRow[]>([]);
  const [modelCounts, setModelCounts] = useState<Record<string, number>>({});
  const [productSuppliers, setProductSuppliers] = useState<Record<string, string[]>>({});
  const [allSuppliers, setAllSuppliers] = useState<string[]>([]);
  const [mainImages, setMainImages] = useState<Record<string, string>>({});
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
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    (async () => {
      const [p, d, c, s, ms, imgs] = await Promise.all([
        fetchProducts(), fetchDivisions(), fetchCategories(),
        fetchSubcategories(), fetchModelSummaries(), fetchProductMainImages(),
      ]);
      setProducts(p); setDivisions(d); setCategories(c);
      setSubcategories(s);
      setModelCounts(ms.counts);
      setProductSuppliers(ms.suppliers);
      setAllSuppliers(ms.allSuppliers);
      setMainImages(imgs);
      setLoading(false);
    })();
  }, []);

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

  const divMap = useMemo(() => Object.fromEntries(divisions.map(d => [d.slug, d.name])), [divisions]);
  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [c.slug, c.name])), [categories]);

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
      if (filterStatus && (p.status || "draft") !== filterStatus) return false;
      if (search && !p.product_name.toLowerCase().includes(search.toLowerCase()) && !p.slug.includes(search.toLowerCase())) return false;
      return true;
    });
  }, [products, filterDiv, filterCat, filterSub, filterBrand, filterLevel, filterSupplier, filterVisible, filterFeatured, filterStatus, search, productSuppliers]);

  const activeFilterCount = [filterDiv, filterCat, filterSub, filterBrand, filterLevel, filterSupplier, filterVisible, filterFeatured, filterStatus].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilterDiv(""); setFilterCat(""); setFilterSub(""); setFilterBrand("");
    setFilterLevel(""); setFilterSupplier(""); setFilterVisible(""); setFilterFeatured(""); setFilterStatus("");
    setSearch("");
  };

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${name}"? This will also delete all models, media, translations, and prices.`)) return;
    const ok = await deleteProduct(id);
    if (ok) setProducts(prev => prev.filter(p => p.id !== id));
  };

  const selectClass = "h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-secondary)] outline-none focus:border-[var(--border-focus)]";

  const levelColors: Record<string, string> = {
    entry: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    mid: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    premium: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    enterprise: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <Link href="/" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
              <ProductsIcon size={16} />
            </div>
            <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">
              Products
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/products/settings" className="h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-medium flex items-center gap-2 hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all">
              <SettingsIcon2 className="h-4 w-4" />
              <span className="hidden sm:inline">Control Panel</span>
            </Link>
            <Link href="/products/new" className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg">
              <PlusIcon className="h-4 w-4" /> Add Product
            </Link>
          </div>
        </div>
        <p className="text-[12px] text-[var(--text-dim)] mb-6 md:mb-8 ml-0 md:ml-11">
          {products.length} products in catalog
        </p>

        {/* Search + Filters */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-4 mb-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-dim)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..."
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors"
              />
            </div>
            {/* View Toggle */}
            <div className="flex rounded-xl border border-[var(--border-subtle)] overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`h-10 w-10 flex items-center justify-center transition-all ${
                  viewMode === "grid"
                    ? "bg-[var(--bg-surface)] text-[var(--text-primary)]"
                    : "bg-[var(--bg-surface-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                }`}
              >
                <LayoutGridIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`h-10 w-10 flex items-center justify-center border-l border-[var(--border-subtle)] transition-all ${
                  viewMode === "list"
                    ? "bg-[var(--bg-surface)] text-[var(--text-primary)]"
                    : "bg-[var(--bg-surface-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                }`}
              >
                <ListIcon className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`h-10 px-4 rounded-xl border text-[12px] font-medium flex items-center gap-2 transition-all ${
                showFilters || activeFilterCount > 0
                  ? "bg-[var(--bg-surface)] border-[var(--border-focus)] text-[var(--text-primary)]"
                  : "bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-faint)] hover:text-[var(--text-muted)]"
              }`}
            >
              <FilterIcon className="h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="h-5 min-w-[20px] px-1 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="h-10 px-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-dim)] hover:text-[var(--text-muted)] flex items-center gap-1.5 transition-colors"
              >
                <CrossIcon className="h-3 w-3" /> Clear
              </button>
            )}
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">Division</label>
                  <select value={filterDiv} onChange={(e) => { setFilterDiv(e.target.value); setFilterCat(""); setFilterSub(""); }} className={selectClass + " w-full"}>
                    <option value="">All</option>
                    {divisions.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">Category</label>
                  <select value={filterCat} onChange={(e) => { setFilterCat(e.target.value); setFilterSub(""); }} className={selectClass + " w-full"} disabled={!filterDiv}>
                    <option value="">All</option>
                    {filteredCats.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">Subcategory</label>
                  <select value={filterSub} onChange={(e) => setFilterSub(e.target.value)} className={selectClass + " w-full"} disabled={!filterCat}>
                    <option value="">All</option>
                    {filteredSubs.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">Supplier</label>
                  <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} className={selectClass + " w-full"}>
                    <option value="">All</option>
                    {allSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">Brand</label>
                  <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} className={selectClass + " w-full"}>
                    <option value="">All</option>
                    {allBrands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">Level</label>
                  <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className={selectClass + " w-full"}>
                    <option value="">All</option>
                    {allLevels.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">Visibility</label>
                  <select value={filterVisible} onChange={(e) => setFilterVisible(e.target.value)} className={selectClass + " w-full"}>
                    <option value="">All</option>
                    <option value="visible">Visible</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">Status</label>
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectClass + " w-full"}>
                    <option value="">All</option>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">Featured</label>
                  <select value={filterFeatured} onChange={(e) => setFilterFeatured(e.target.value)} className={selectClass + " w-full"}>
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
          <p className="text-[12px] text-[var(--text-dim)] mb-4 px-1">
            Showing {filtered.length} of {products.length} products
          </p>
        )}

        {/* Product Grid / List */}
        {loading ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden animate-pulse">
                  <div className="aspect-[4/3] bg-[var(--bg-surface-subtle)]" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-[var(--bg-surface-subtle)] rounded w-3/4" />
                    <div className="h-3 bg-[var(--bg-surface-subtle)] rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden divide-y divide-[var(--border-subtle)]">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                  <div className="h-14 w-14 rounded-xl bg-[var(--bg-surface-subtle)] shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[var(--bg-surface-subtle)] rounded w-1/3" />
                    <div className="h-3 bg-[var(--bg-surface-subtle)] rounded w-1/4" />
                  </div>
                  <div className="h-6 w-16 bg-[var(--bg-surface-subtle)] rounded" />
                </div>
              ))}
            </div>
          )
        ) : filtered.length === 0 ? (
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-16 text-center">
            <ProductsIcon size={48} className="text-[var(--text-barely)] mx-auto mb-4" />
            <p className="text-[var(--text-dim)] text-[15px] font-medium">
              {products.length === 0 ? "No products yet" : "No products match your filters"}
            </p>
            <p className="text-[var(--text-ghost)] text-[13px] mt-1">
              {products.length === 0 ? "Add your first product to get started." : "Try adjusting your search or filters."}
            </p>
            {products.length === 0 && (
              <Link href="/products/new" className="inline-flex items-center gap-2 mt-4 h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all">
                <PlusIcon className="h-4 w-4" /> Add Product
              </Link>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {filtered.map((p) => {
              const imgUrl = mainImages[p.id];
              const models = modelCounts[p.id] || 0;
              const suppliers = productSuppliers[p.id] || [];
              const lvl = levelColors[p.level || ""] || "";

              return (
                <Link
                  key={p.id}
                  href={`/products/${p.slug || p.id}`}
                  className="group bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden hover:border-[var(--border-focus)] hover:shadow-xl transition-all duration-200"
                >
                  {/* Image */}
                  <div className="relative aspect-[4/3] bg-[var(--bg-surface-subtle)] overflow-hidden">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={p.product_name}
                        className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageRawIcon className="h-10 w-10 text-[var(--text-ghost)]" />
                      </div>
                    )}

                    {/* Badges overlay */}
                    <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
                      {p.featured && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/90 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
                          <StarIcon className="h-2.5 w-2.5" /> Featured
                        </span>
                      )}
                      {p.level && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider border backdrop-blur-sm ${lvl}`}>
                          {p.level}
                        </span>
                      )}
                    </div>

                    {/* Visibility indicator */}
                    <div className="absolute top-2.5 right-2.5">
                      {p.visible ? (
                        <span className="h-6 w-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center backdrop-blur-sm">
                          <EyeIcon className="h-3 w-3 text-emerald-400" />
                        </span>
                      ) : (
                        <span className="h-6 w-6 rounded-full bg-[var(--bg-overlay)] border border-[var(--border-subtle)] flex items-center justify-center backdrop-blur-sm">
                          <EyeOffIcon className="h-3 w-3 text-[var(--text-dim)]" />
                        </span>
                      )}
                    </div>

                    {/* Actions (show on hover) */}
                    <div className="absolute bottom-2.5 right-2.5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(`/products/${p.id}/edit`);
                        }}
                        className="h-8 w-8 rounded-lg bg-[var(--bg-primary)]/80 border border-[var(--border-subtle)] backdrop-blur-sm flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                        title="Edit product"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, p.id, p.product_name)}
                        className="h-8 w-8 rounded-lg bg-[var(--bg-primary)]/80 border border-[var(--border-subtle)] backdrop-blur-sm flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 transition-colors"
                        title="Delete product"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-3.5 md:p-4">
                    {/* Product Name */}
                    <h3 className="text-[14px] md:text-[15px] font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--text-highlight)] transition-colors">
                      {p.product_name}
                    </h3>

                    {/* Category */}
                    <p className="text-[11px] text-[var(--text-dim)] mt-1 truncate flex items-center gap-1">
                      <LayersIcon className="h-3 w-3 shrink-0" />
                      {catMap[p.category_slug] || p.category_slug}
                    </p>

                    {/* Meta row */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {(() => {
                        const st = (p.status || "draft");
                        const stColors: Record<string, string> = {
                          draft: "text-amber-400 bg-amber-400/10 border-amber-400/20",
                          active: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
                          archived: "text-red-400 bg-red-400/10 border-red-400/20",
                        };
                        return (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${stColors[st] || stColors.draft}`}>
                            {st}
                          </span>
                        );
                      })()}
                      {p.brand && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-surface)] text-[10px] font-medium text-[var(--text-subtle)]">
                          <TagsIcon className="h-2.5 w-2.5" /> {p.brand}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-surface)] text-[10px] font-medium text-[var(--text-subtle)]">
                        <BoxesIcon className="h-2.5 w-2.5" /> {models} {models === 1 ? "model" : "models"}
                      </span>
                    </div>

                    {/* Supplier */}
                    {suppliers.length > 0 && (
                      <p className="text-[10px] text-[var(--text-ghost)] mt-2 truncate">
                        {suppliers.join(", ")}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          /* ── List View ── */
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
            {/* List header */}
            <div className="hidden md:grid grid-cols-[56px_1fr_140px_120px_100px_80px_80px] gap-4 items-center px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
              <span />
              <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Product</span>
              <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Category</span>
              <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Brand</span>
              <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Models</span>
              <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Status</span>
              <span />
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {filtered.map((p) => {
                const imgUrl = mainImages[p.id];
                const models = modelCounts[p.id] || 0;
                const suppliers = productSuppliers[p.id] || [];
                const lvl = levelColors[p.level || ""] || "";

                return (
                  <Link
                    key={p.id}
                    href={`/products/${p.slug || p.id}`}
                    className="group flex items-center gap-3 md:grid md:grid-cols-[56px_1fr_140px_120px_100px_80px_80px] md:gap-4 px-4 md:px-5 py-3 hover:bg-[var(--bg-surface-subtle)] transition-colors"
                  >
                    {/* Thumbnail */}
                    <div className="h-12 w-12 md:h-14 md:w-14 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] overflow-hidden shrink-0 flex items-center justify-center">
                      {imgUrl ? (
                        <img src={imgUrl} alt={p.product_name} className="w-full h-full object-contain p-1" />
                      ) : (
                        <ImageRawIcon className="h-5 w-5 text-[var(--text-ghost)]" />
                      )}
                    </div>

                    {/* Product info (mobile: all info here, desktop: just name) */}
                    <div className="flex-1 md:flex-none min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[13px] md:text-[14px] font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--text-highlight)] transition-colors">
                          {p.product_name}
                        </h3>
                        {p.featured && (
                          <StarIcon className="h-3 w-3 text-amber-400 shrink-0" />
                        )}
                      </div>
                      {/* Mobile: show all meta inline */}
                      <div className="md:hidden flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-[var(--text-dim)]">{catMap[p.category_slug] || p.category_slug}</span>
                        {p.brand && (
                          <>
                            <span className="text-[var(--text-ghost)]">·</span>
                            <span className="text-[11px] text-[var(--text-dim)]">{p.brand}</span>
                          </>
                        )}
                        <span className="text-[var(--text-ghost)]">·</span>
                        <span className="text-[11px] text-[var(--text-dim)]">{models} {models === 1 ? "model" : "models"}</span>
                      </div>
                      {/* Desktop: supplier line under name */}
                      {suppliers.length > 0 && (
                        <p className="hidden md:block text-[11px] text-[var(--text-ghost)] mt-0.5 truncate">
                          {suppliers.join(", ")}
                        </p>
                      )}
                    </div>

                    {/* Category (desktop only) */}
                    <div className="hidden md:flex items-center gap-1.5 min-w-0">
                      <LayersIcon className="h-3 w-3 text-[var(--text-ghost)] shrink-0" />
                      <span className="text-[12px] text-[var(--text-muted)] truncate">
                        {catMap[p.category_slug] || p.category_slug}
                      </span>
                    </div>

                    {/* Brand (desktop only) */}
                    <div className="hidden md:flex items-center gap-1.5 min-w-0">
                      {p.brand ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-surface)] text-[11px] font-medium text-[var(--text-subtle)] truncate">
                          <TagsIcon className="h-2.5 w-2.5 shrink-0" /> {p.brand}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--text-ghost)]">—</span>
                      )}
                    </div>

                    {/* Models count (desktop only) */}
                    <div className="hidden md:flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-surface)] text-[11px] font-medium text-[var(--text-subtle)]">
                        <BoxesIcon className="h-2.5 w-2.5" /> {models}
                      </span>
                      {p.level && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wider border ${lvl}`}>
                          {p.level}
                        </span>
                      )}
                    </div>

                    {/* Status (desktop only) */}
                    <div className="hidden md:flex items-center justify-center">
                      {(() => {
                        const st = (p.status || "draft");
                        const stColors: Record<string, string> = {
                          draft: "text-amber-400 bg-amber-400/10 border-amber-400/20",
                          active: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
                          archived: "text-red-400 bg-red-400/10 border-red-400/20",
                        };
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider ${stColors[st] || stColors.draft}`}>
                            {st}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Mobile visibility indicator */}
                      <div className="md:hidden">
                        {p.visible ? (
                          <EyeIcon className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <EyeOffIcon className="h-3.5 w-3.5 text-[var(--text-dim)]" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(`/products/${p.id}/edit`);
                        }}
                        className="h-8 w-8 rounded-lg hover:bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
                        title="Edit product"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, p.id, p.product_name)}
                        className="h-8 w-8 rounded-lg hover:bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-dim)] hover:text-red-400 transition-colors"
                        title="Delete product"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
