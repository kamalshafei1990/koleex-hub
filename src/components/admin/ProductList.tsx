"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { IMG } from "@/lib/cdn";
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
import ProductDataIcon from "@/components/icons/ProductDataIcon";
import {
  fetchProducts, fetchDivisions, fetchCategories, fetchSubcategories,
  fetchModelSummaries, fetchProductMainImages, deleteProduct,
} from "@/lib/products-admin";
import type { ProductRow, DivisionRow, CategoryRow, SubcategoryRow } from "@/types/supabase";
import ConfirmDialog from "./form-sections/ConfirmDialog";

/* Koleex's flagship division. The hub treats this line as the
   default view on the public catalog and visually emphasises it
   everywhere we surface divisions (pill strip, badges). Other
   divisions are secondary — "extra lines" that customers can
   discover but aren't the hub's primary story. Keep this constant
   in one place so a future rename (e.g. "koleex-machinery") is a
   single-file change. */
const FLAGSHIP_DIVISION_SLUG = "garment-machinery";

export default function ProductList() {
  const router = useRouter();
  const pathname = usePathname();
  /* "internal" when the same component is rendered under /product-data.
     Under /products the view is the PUBLIC catalog: no supplier
     column, no Add button, no Edit/Delete actions, no cost hints. */
  const isInternal = (pathname || "").startsWith("/product-data");
  const baseRoute = isInternal ? "/product-data" : "/products";

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryRow[]>([]);
  const [modelCounts, setModelCounts] = useState<Record<string, number>>({});
  const [productSuppliers, setProductSuppliers] = useState<Record<string, string[]>>({});
  const [allSuppliers, setAllSuppliers] = useState<string[]>([]);
  const [primaryModelNames, setPrimaryModelNames] = useState<Record<string, string>>({});
  const [mainImages, setMainImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);


  /* Filter state — persisted to sessionStorage so the back-button
     from a product detail returns the user to the same filtered
     view they left. Keyed per route (admin /product-data vs public
     /products) so the two lists don't share state. Hydrated lazily
     on first render via the useState initialiser to avoid SSR
     mismatch — `window` only exists in the browser. */
  const filterStorageKey = `kx:productList:${pathname || "default"}`;
  type FilterSnapshot = {
    div: string; cat: string; sub: string; brand: string; level: string;
    supplier: string; visible: string; featured: string; status: string;
    search: string; showFilters: boolean; viewMode: "grid" | "list";
  };
  const readFilterSnapshot = (): Partial<FilterSnapshot> => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.sessionStorage.getItem(filterStorageKey);
      return raw ? (JSON.parse(raw) as Partial<FilterSnapshot>) : {};
    } catch { return {}; }
  };
  const initialFilters = readFilterSnapshot();

  const [filterDiv, setFilterDiv] = useState(initialFilters.div ?? "");
  const [filterCat, setFilterCat] = useState(initialFilters.cat ?? "");
  const [filterSub, setFilterSub] = useState(initialFilters.sub ?? "");
  const [filterBrand, setFilterBrand] = useState(initialFilters.brand ?? "");
  const [filterLevel, setFilterLevel] = useState(initialFilters.level ?? "");
  const [filterSupplier, setFilterSupplier] = useState(initialFilters.supplier ?? "");
  const [filterVisible, setFilterVisible] = useState(initialFilters.visible ?? "");
  const [filterFeatured, setFilterFeatured] = useState(initialFilters.featured ?? "");
  const [filterStatus, setFilterStatus] = useState(initialFilters.status ?? "");
  const [search, setSearch] = useState(initialFilters.search ?? "");
  const [showFilters, setShowFilters] = useState(initialFilters.showFilters ?? false);
  const [viewMode, setViewMode] = useState<"grid" | "list">(initialFilters.viewMode ?? "grid");

  /* Search suggestions — typeahead dropdown that pops below the
     input when it has focus + at least one typed character. The
     dropdown groups matches into Categories / Subcategories /
     Brands / Products. Keyboard nav (↑↓/Enter/Escape) and a
     click-outside close are wired below. */
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

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
      setPrimaryModelNames(ms.primaryModelNames || {});
      setMainImages(imgs);
      /* Public catalog lands on Garment Machinery by default — it's
         the flagship. Customers browsing /products should see the
         primary line first; they can click "All divisions" or any
         other pill to broaden. Admins (/product-data) still see
         everything so they don't miss products when filtering.

         Only apply the flagship default when the user has NO stored
         filter from a previous visit — otherwise we'd overwrite
         their persisted choice on every data refresh. */
      if (
        !isInternal &&
        !initialFilters.div &&
        d.some(x => x.slug === FLAGSHIP_DIVISION_SLUG)
      ) {
        setFilterDiv(FLAGSHIP_DIVISION_SLUG);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInternal]);

  /* Persist the filter snapshot to sessionStorage on every change.
     Back-button from a detail page returns to the same view. Stays
     scoped to the current route (admin vs public) via the storage
     key so the two lists never bleed into each other. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const snapshot: FilterSnapshot = {
        div: filterDiv, cat: filterCat, sub: filterSub,
        brand: filterBrand, level: filterLevel, supplier: filterSupplier,
        visible: filterVisible, featured: filterFeatured, status: filterStatus,
        search, showFilters, viewMode,
      };
      window.sessionStorage.setItem(filterStorageKey, JSON.stringify(snapshot));
    } catch { /* quota exceeded — fine */ }
  }, [
    filterDiv, filterCat, filterSub, filterBrand, filterLevel,
    filterSupplier, filterVisible, filterFeatured, filterStatus,
    search, showFilters, viewMode, filterStorageKey,
  ]);

  const allBrands = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.brand) set.add(p.brand); });
    return Array.from(set).sort();
  }, [products]);

  /* Close the suggestions dropdown on click-outside or Escape so
     the user always has a clean exit even when they don't pick a
     suggestion. */
  useEffect(() => {
    if (!searchOpen) return;
    const onDown = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [searchOpen]);

  const allLevels = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.level) set.add(p.level); });
    return Array.from(set).sort();
  }, [products]);

  const divMap = useMemo(() => Object.fromEntries(divisions.map(d => [d.slug, d.name])), [divisions]);

  /* Divisions re-ordered so the flagship is always first in any
     UI that iterates over them (pill strip, dropdown, etc.). The
     raw `divisions` array is alphabetical from the DB; this keeps
     that ordering for the "rest" but promotes the flagship to the
     head so brand hierarchy is visible at a glance. */
  const orderedDivisions = useMemo(() => {
    const flagship = divisions.filter(d => d.slug === FLAGSHIP_DIVISION_SLUG);
    const rest = divisions.filter(d => d.slug !== FLAGSHIP_DIVISION_SLUG);
    return [...flagship, ...rest];
  }, [divisions]);
  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [c.slug, c.name])), [categories]);

  const selectedDivId = useMemo(() => divisions.find(d => d.slug === filterDiv)?.id, [divisions, filterDiv]);
  const filteredCats = useMemo(() => selectedDivId ? categories.filter(c => c.division_id === selectedDivId) : categories, [categories, selectedDivId]);
  const selectedCatId = useMemo(() => categories.find(c => c.slug === filterCat)?.id, [categories, filterCat]);
  const filteredSubs = useMemo(() => selectedCatId ? subcategories.filter(s => s.category_id === selectedCatId) : subcategories, [subcategories, selectedCatId]);

  /* Cheap O(1) lookups so the search hot path doesn't re-scan the
     taxonomy arrays for every product on every keystroke. Built
     here (not inside the memo) so they're shared with section
     headers downstream. */
  const divNameBySlug = useMemo(
    () => Object.fromEntries(divisions.map(d => [d.slug, d.name.toLowerCase()])),
    [divisions],
  );
  const catNameBySlug = useMemo(
    () => Object.fromEntries(categories.map(c => [c.slug, c.name.toLowerCase()])),
    [categories],
  );
  const subNameBySlug = useMemo(
    () => Object.fromEntries(subcategories.map(s => [s.slug, s.name.toLowerCase()])),
    [subcategories],
  );

  /* Pre-build the per-product search haystack ONCE so each keystroke
     just runs N substring checks instead of rebuilding 600+ joined
     strings every render. Matters when the catalog grows past a few
     hundred products and the user is typing live. */
  const searchHaystack = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of products) {
      const mn = (primaryModelNames[p.id] || "").toLowerCase();
      map[p.id] = [
        p.product_name.toLowerCase(),
        p.slug,
        mn,
        (p.brand || "").toLowerCase(),
        (p.excerpt || "").toLowerCase(),
        (p.description || "").toLowerCase(),
        (p.level || "").toLowerCase(),
        (p.status || "").toLowerCase(),
        divNameBySlug[p.division_slug] || "",
        catNameBySlug[p.category_slug] || "",
        subNameBySlug[p.subcategory_slug] || "",
        (p.tags || []).join(" ").toLowerCase(),
      ].join(" ");
    }
    return map;
  }, [products, primaryModelNames, divNameBySlug, catNameBySlug, subNameBySlug]);

  /* Typeahead suggestions built from the typed query.
       · Categories  → click sets the category filter
       · Subcategories → click sets the subcategory filter
       · Brands  → click sets the brand filter
       · Products → click navigates to that product
     Each section is capped (3-6) to keep the dropdown short, with
     the first section being whatever currently has the strongest
     match so common typed prefixes (like "I" for "Industrial...")
     surface category hits first. */
  type Suggestion =
    | { kind: "category"; slug: string; label: string; count: number }
    | { kind: "subcategory"; slug: string; categorySlug: string; label: string; count: number }
    | { kind: "brand"; label: string; count: number }
    | { kind: "product"; id: string; slug: string; label: string; modelCode?: string; thumb?: string };

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || q.length < 1) return [] as Suggestion[];

    const categoryProductCounts: Record<string, number> = {};
    const subcategoryProductCounts: Record<string, number> = {};
    const brandProductCounts: Record<string, number> = {};
    for (const p of products) {
      categoryProductCounts[p.category_slug] = (categoryProductCounts[p.category_slug] || 0) + 1;
      subcategoryProductCounts[p.subcategory_slug] = (subcategoryProductCounts[p.subcategory_slug] || 0) + 1;
      if (p.brand) brandProductCounts[p.brand] = (brandProductCounts[p.brand] || 0) + 1;
    }

    /* Prefer prefix matches first (typing "i" → Industrial Sewing
       Machines comes before Cutting Equipment), fall back to
       contains-matches after, deduplicated. */
    const prefixThenContains = (haystack: string, needle: string) => {
      const h = haystack.toLowerCase();
      if (h.startsWith(needle)) return 0;
      if (h.split(/\s+/).some(w => w.startsWith(needle))) return 1;
      if (h.includes(needle)) return 2;
      return -1;
    };

    const cats = categories
      .map(c => ({ c, score: prefixThenContains(c.name, q) }))
      .filter(x => x.score >= 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 4)
      .map(({ c }): Suggestion => ({ kind: "category", slug: c.slug, label: c.name, count: categoryProductCounts[c.slug] || 0 }));

    const subs = subcategories
      .map(s => ({ s, score: prefixThenContains(s.name, q) }))
      .filter(x => x.score >= 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 5)
      .map(({ s }): Suggestion => ({
        kind: "subcategory",
        slug: s.slug,
        categorySlug: categories.find(c => c.id === s.category_id)?.slug || "",
        label: s.name,
        count: subcategoryProductCounts[s.slug] || 0,
      }));

    const brands = allBrands
      .map(b => ({ b, score: prefixThenContains(b, q) }))
      .filter(x => x.score >= 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map(({ b }): Suggestion => ({ kind: "brand", label: b, count: brandProductCounts[b] || 0 }));

    const prods: Suggestion[] = [];
    for (const p of products) {
      const mn = primaryModelNames[p.id] || "";
      const sName = prefixThenContains(p.product_name, q);
      const sModel = mn ? prefixThenContains(mn, q) : -1;
      const score = Math.min(sName === -1 ? Infinity : sName, sModel === -1 ? Infinity : sModel);
      if (!Number.isFinite(score)) continue;
      prods.push({ kind: "product", id: p.id, slug: p.slug || p.id, label: p.product_name, modelCode: mn || undefined, thumb: mainImages[p.id], _score: score } as Suggestion & { _score: number });
    }
    (prods as (Suggestion & { _score: number })[]).sort((a, b) => a._score - b._score);
    const productSuggestions = prods.slice(0, 6);

    return [...cats, ...subs, ...brands, ...productSuggestions];
  }, [search, categories, subcategories, allBrands, products, primaryModelNames, mainImages]);

  /* Reset the keyboard cursor whenever the suggestion list changes. */
  useEffect(() => { setActiveSuggestionIdx(-1); }, [suggestions]);

  /* Highlight matched substring inside a suggestion label. */
  const highlight = (label: string, q: string) => {
    if (!q) return label;
    const i = label.toLowerCase().indexOf(q.toLowerCase());
    if (i === -1) return label;
    return (
      <>
        {label.slice(0, i)}
        <strong className="text-[var(--text-highlight)] font-bold">{label.slice(i, i + q.length)}</strong>
        {label.slice(i + q.length)}
      </>
    );
  };

  /* Apply a suggestion: either set a filter or navigate to a product. */
  const applySuggestion = (s: Suggestion) => {
    setSearchOpen(false);
    setSearch("");
    setActiveSuggestionIdx(-1);
    if (s.kind === "category") {
      const cat = categories.find(c => c.slug === s.slug);
      const div = divisions.find(d => d.id === cat?.division_id);
      if (div) setFilterDiv(div.slug);
      setFilterCat(s.slug);
      setFilterSub("");
    } else if (s.kind === "subcategory") {
      const cat = categories.find(c => c.slug === s.categorySlug);
      const div = divisions.find(d => d.id === cat?.division_id);
      if (div) setFilterDiv(div.slug);
      if (cat) setFilterCat(cat.slug);
      setFilterSub(s.slug);
    } else if (s.kind === "brand") {
      setFilterBrand(s.label);
    } else if (s.kind === "product") {
      router.push(`${baseRoute}/${s.slug}`);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
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
      if (tokens.length > 0) {
        const hay = searchHaystack[p.id] || "";
        for (const t of tokens) if (!hay.includes(t)) return false;
      }
      return true;
    });
  }, [products, filterDiv, filterCat, filterSub, filterBrand, filterLevel, filterSupplier, filterVisible, filterFeatured, filterStatus, search, productSuppliers, searchHaystack]);

  /* Build sub-category and category name lookup tables once so
     section headers + the search index resolve in O(1). */
  const subMap = useMemo(
    () => Object.fromEntries(subcategories.map(s => [s.slug, s.name])),
    [subcategories],
  );

  /* TWO-LEVEL grouping: Category → Subcategory → Products.
     Lands the user on a real catalog page where each top-level
     CATEGORY (Industrial Sewing Machines / Cutting Equipment /
     Embroidery Equipment / etc.) is its own banner-headed section,
     and within it each SUBCATEGORY is a sub-section of cards.

     Order:
       · Categories appear in the order returned by fetchCategories
         (DB `order` then name).
       · Subcategories within each category match the DB order.

     Empty buckets drop out automatically. */
  type CategoryGroup = {
    slug: string;
    name: string;
    total: number;
    subSections: { slug: string; name: string; products: ProductRow[] }[];
  };

  const categoryTree = useMemo<CategoryGroup[]>(() => {
    if (filtered.length === 0) return [];
    // Build product index: cat -> sub -> ProductRow[]
    const catBuckets: Record<string, Record<string, ProductRow[]>> = {};
    for (const p of filtered) {
      const c = p.category_slug || "_uncategorized";
      const s = p.subcategory_slug || "_uncategorized";
      if (!catBuckets[c]) catBuckets[c] = {};
      if (!catBuckets[c][s]) catBuckets[c][s] = [];
      catBuckets[c][s].push(p);
    }
    const catOrder = categories.map(c => c.slug);
    const subOrder = subcategories.map(s => s.slug);
    const catSlugs = Object.keys(catBuckets).sort((a, b) => {
      const ai = catOrder.indexOf(a); const bi = catOrder.indexOf(b);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return catSlugs.map(catSlug => {
      const catName = catNameBySlug[catSlug] || (catSlug === "_uncategorized" ? "Uncategorized" : catSlug);
      const subSlugs = Object.keys(catBuckets[catSlug]).sort((a, b) => {
        const ai = subOrder.indexOf(a); const bi = subOrder.indexOf(b);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
      const subSections = subSlugs.map(subSlug => ({
        slug: subSlug,
        name: subMap[subSlug] || (subSlug === "_uncategorized" ? "Other" : subSlug),
        products: catBuckets[catSlug][subSlug],
      }));
      const total = subSections.reduce((a, s) => a + s.products.length, 0);
      // Capitalise first letter of category name even if input is title cased lower in our map
      const displayName = catName.charAt(0).toUpperCase() + catName.slice(1);
      return { slug: catSlug, name: displayName, total, subSections };
    });
  }, [filtered, categories, subcategories, subMap, catNameBySlug]);

  const activeFilterCount = [filterDiv, filterCat, filterSub, filterBrand, filterLevel, filterSupplier, filterVisible, filterFeatured, filterStatus].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilterDiv(""); setFilterCat(""); setFilterSub(""); setFilterBrand("");
    setFilterLevel(""); setFilterSupplier(""); setFilterVisible(""); setFilterFeatured(""); setFilterStatus("");
    setSearch("");
  };

  /* Delete confirmation — goes through the themed ConfirmDialog
     instead of the native window.confirm() which Safari renders
     with a system dialog that clashes with the hub's dark theme. */
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const askDelete = (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget({ id, name });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
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
              {isInternal ? <ProductDataIcon size={16} /> : <ProductsIcon size={16} />}
            </div>
            <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">
              {isInternal ? "Product Data" : "Products"}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Settings + Add are admin tools — only surface them on
                the internal /product-data path. The public /products
                catalog is read-only for customers. */}
            {isInternal && (
              <>
                <Link href={`${baseRoute}/settings`} className="h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-medium flex items-center gap-2 hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all">
                  <SettingsIcon2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Control Panel</span>
                </Link>
                <Link href={`${baseRoute}/new`} className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg">
                  <PlusIcon className="h-4 w-4" /> Add Product
                </Link>
              </>
            )}
          </div>
        </div>
        <p className="text-[12px] text-[var(--text-dim)] mb-6 md:mb-8 ml-0 md:ml-11">
          {products.length} products in catalog
        </p>

        {/* Search + Filters — sticky to the top of the viewport so
            the user can refine the query without scrolling back up.
            z-30 sits above the category jump-nav (z-20) so the
            search row always wins when both stack. */}
        <div className="sticky top-0 z-30 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 pt-3 pb-2 mb-4 bg-[var(--bg-primary)]/95 backdrop-blur-xl">
        <div className="bg-[var(--bg-secondary)]/80 backdrop-blur-sm rounded-xl border border-[var(--border-subtle)] p-3.5 shadow-sm">
          <div className="flex gap-3">
            <div className="relative flex-1" ref={searchBoxRef}>
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-dim)] z-10" />
              <input
                type="search"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSearchOpen(true);
                    setActiveSuggestionIdx(i => Math.min(i + 1, suggestions.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveSuggestionIdx(i => Math.max(i - 1, -1));
                  } else if (e.key === "Enter" && activeSuggestionIdx >= 0 && suggestions[activeSuggestionIdx]) {
                    e.preventDefault();
                    applySuggestion(suggestions[activeSuggestionIdx]);
                  } else if (e.key === "Escape") {
                    setSearchOpen(false);
                  }
                }}
                placeholder="Search by name, model code, brand, category, tags…"
                aria-label="Search products"
                aria-autocomplete="list"
                aria-expanded={searchOpen && suggestions.length > 0}
                className="w-full h-10 pl-10 pr-10 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors [&::-webkit-search-cancel-button]:hidden"
              />
              {/* Clear button — only when there's text. Native input
                  type=search clear button is inconsistent across
                  browsers so we render our own. */}
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); setSearchOpen(false); }}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                >
                  <span className="text-[16px] leading-none">×</span>
                </button>
              )}

              {/* ── Suggestions dropdown ── Pops below the input
                  while focused with a non-empty query. Groups
                  matches by kind (Categories, Subcategories,
                  Brands, Products). Keyboard nav: ↑↓ moves the
                  active row, Enter applies, Escape closes. */}
              {searchOpen && suggestions.length > 0 && (
                <div
                  role="listbox"
                  className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 max-h-[420px] overflow-y-auto rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] shadow-2xl"
                >
                  {(() => {
                    const groups: { title: string; items: Suggestion[] }[] = [];
                    const cats = suggestions.filter(s => s.kind === "category");
                    const subs = suggestions.filter(s => s.kind === "subcategory");
                    const brs  = suggestions.filter(s => s.kind === "brand");
                    const prs  = suggestions.filter(s => s.kind === "product");
                    if (cats.length) groups.push({ title: "Categories", items: cats });
                    if (subs.length) groups.push({ title: "Subcategories", items: subs });
                    if (brs.length)  groups.push({ title: "Brands", items: brs });
                    if (prs.length)  groups.push({ title: "Products", items: prs });

                    let idx = -1;
                    return groups.map((g) => (
                      <div key={g.title}>
                        <div className="sticky top-0 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-ghost)] bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]/40">
                          {g.title}
                        </div>
                        {g.items.map((s) => {
                          idx++;
                          const isActive = idx === activeSuggestionIdx;
                          const key = `${s.kind}-${"slug" in s ? s.slug : "id" in s ? s.id : s.label}`;
                          return (
                            <button
                              key={key}
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              onMouseEnter={() => setActiveSuggestionIdx(idx)}
                              onClick={() => applySuggestion(s)}
                              className={`w-full text-left flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors border-l-2 ${
                                isActive
                                  ? "bg-[var(--bg-surface)] border-[var(--border-focus)] text-[var(--text-primary)]"
                                  : "border-transparent text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                              }`}
                            >
                              {/* Icon / thumb per kind */}
                              {s.kind === "product" ? (
                                <div className="h-9 w-9 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] overflow-hidden shrink-0 flex items-center justify-center">
                                  {s.thumb ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={IMG.thumb(s.thumb)} alt="" className="w-full h-full object-contain p-1" />
                                  ) : (
                                    <ImageRawIcon className="h-4 w-4 text-[var(--text-ghost)]" />
                                  )}
                                </div>
                              ) : (
                                <div className="h-7 w-7 rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                                  {s.kind === "category" && <LayersIcon className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
                                  {s.kind === "subcategory" && <BoxesIcon className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
                                  {s.kind === "brand" && <TagsIcon className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
                                </div>
                              )}

                              {/* Label + secondary line */}
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">
                                  {s.kind === "product" && s.modelCode
                                    ? <>{highlight(s.modelCode, search)}<span className="text-[var(--text-dim)] ml-2 font-normal">{highlight(s.label, search)}</span></>
                                    : highlight(s.label, search)}
                                </div>
                                {s.kind === "subcategory" && (
                                  <div className="text-[11px] text-[var(--text-dim)] truncate">
                                    in {catNameBySlug[s.categorySlug] || s.categorySlug}
                                  </div>
                                )}
                              </div>

                              {/* Trailing count or arrow */}
                              {("count" in s) ? (
                                <span className="shrink-0 text-[10px] tabular-nums font-semibold text-[var(--text-dim)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-full px-1.5 h-[18px] inline-flex items-center justify-center">
                                  {s.count}
                                </span>
                              ) : (
                                <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--text-ghost)] font-semibold">
                                  Open →
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ));
                  })()}
                </div>
              )}
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
                    {orderedDivisions.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}
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
                {/* Supplier filter is an internal concept — hide on
                    the public /products catalog. */}
                {isInternal && (
                  <div>
                    <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">Supplier</label>
                    <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} className={selectClass + " w-full"}>
                      <option value="">All</option>
                      {allSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
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

          {/* Active filter chips — surfaces every active filter as a
              removable chip so the user always knows what's narrowing
              the catalog. Click the X on any chip to clear just that
              filter; clearing the search via the X here also clears
              its own filter. Only renders when at least one is set. */}
          {(activeFilterCount > 0 || search) && (
            <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-ghost)]">Active:</span>
              {(() => {
                const chips: { label: string; onClear: () => void }[] = [];
                if (search) chips.push({ label: `"${search}"`, onClear: () => setSearch("") });
                if (filterDiv) chips.push({ label: `Division: ${divNameBySlug[filterDiv] || filterDiv}`, onClear: () => { setFilterDiv(""); setFilterCat(""); setFilterSub(""); } });
                if (filterCat) chips.push({ label: `Category: ${catNameBySlug[filterCat] || filterCat}`, onClear: () => { setFilterCat(""); setFilterSub(""); } });
                if (filterSub) chips.push({ label: `Subcategory: ${subNameBySlug[filterSub] || filterSub}`, onClear: () => setFilterSub("") });
                if (filterBrand) chips.push({ label: `Brand: ${filterBrand}`, onClear: () => setFilterBrand("") });
                if (filterLevel) chips.push({ label: `Level: ${filterLevel}`, onClear: () => setFilterLevel("") });
                if (filterSupplier) chips.push({ label: `Supplier: ${filterSupplier}`, onClear: () => setFilterSupplier("") });
                if (filterVisible) chips.push({ label: filterVisible === "visible" ? "Visible" : "Hidden", onClear: () => setFilterVisible("") });
                if (filterFeatured) chips.push({ label: filterFeatured === "yes" ? "Featured" : "Not featured", onClear: () => setFilterFeatured("") });
                if (filterStatus) chips.push({ label: `Status: ${filterStatus}`, onClear: () => setFilterStatus("") });
                return chips.map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 h-7 pl-3 pr-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-focus)] text-[11px] font-medium text-[var(--text-primary)]">
                    {c.label}
                    <button
                      type="button"
                      onClick={c.onClear}
                      aria-label={`Remove filter ${c.label}`}
                      className="h-5 w-5 rounded-full flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
                    >
                      <span className="text-[14px] leading-none">×</span>
                    </button>
                  </span>
                ));
              })()}
            </div>
          )}
        </div>
        </div>

        {/* ── Division pill strip ──
            Koleex's brand hierarchy, surfaced visually. "All" is the
            opt-out; Garment Machinery is the flagship (always pinned
            first, always rendered as a filled accent pill even when
            not selected so it reads as the primary line); the rest
            are outlined secondary pills. Horizontally scrollable on
            mobile so long division names don't wrap awkwardly. */}
        {orderedDivisions.length > 0 && (
          <div className="mb-6 -mx-1 px-1 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max pb-1">
              {/* "All" — clears the division filter. */}
              <button
                type="button"
                onClick={() => { setFilterDiv(""); setFilterCat(""); setFilterSub(""); }}
                className={`h-8 px-3.5 rounded-full text-[12px] font-medium border transition-all shrink-0 ${
                  filterDiv === ""
                    ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-[var(--bg-inverted)]"
                    : "bg-[var(--bg-surface-subtle)] text-[var(--text-dim)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                }`}
              >
                All divisions
              </button>

              {orderedDivisions.map((d) => {
                const isFlagship = d.slug === FLAGSHIP_DIVISION_SLUG;
                const isActive = filterDiv === d.slug;

                /* Flagship styling: always filled/accent so customers
                   see it as the primary tile even when a different
                   division is active. Other divisions use the hub's
                   standard ghost-pill treatment and fill up only when
                   selected. */
                const cls = isFlagship
                  ? isActive
                    ? "bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)] ring-2 ring-[var(--text-primary)]/30"
                    : "bg-[var(--text-primary)]/10 text-[var(--text-primary)] border-[var(--text-primary)]/25 hover:bg-[var(--text-primary)]/15"
                  : isActive
                    ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-[var(--bg-inverted)]"
                    : "bg-[var(--bg-surface-subtle)] text-[var(--text-dim)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]";

                return (
                  <button
                    key={d.slug}
                    type="button"
                    onClick={() => { setFilterDiv(d.slug); setFilterCat(""); setFilterSub(""); }}
                    className={`h-8 px-3.5 rounded-full text-[12px] font-medium border transition-all shrink-0 ${cls} ${isFlagship ? "font-semibold" : ""}`}
                    aria-pressed={isActive}
                  >
                    {isFlagship && (
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full bg-current mr-1.5 -translate-y-[1px]"
                      />
                    )}
                    {d.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Results count — live tally tied to the search/filter state.
            When a search is typed, surface the match count
            prominently so the user gets immediate feedback that
            the query is doing something. */}
        {(activeFilterCount > 0 || search) && (
          <p className="text-[12px] text-[var(--text-dim)] mb-4 px-1">
            {filtered.length === 0 ? (
              <span className="text-amber-400">No matches for <strong className="text-[var(--text-primary)]">"{search}"</strong></span>
            ) : (
              <>Showing <strong className="text-[var(--text-primary)] tabular-nums">{filtered.length}</strong> of {products.length} products{search ? <> matching <strong className="text-[var(--text-primary)]">"{search}"</strong></> : null}</>
            )}
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
            {products.length === 0 && isInternal && (
              <Link href={`${baseRoute}/new`} className="inline-flex items-center gap-2 mt-4 h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all">
                <PlusIcon className="h-4 w-4" /> Add Product
              </Link>
            )}
          </div>
        ) : viewMode === "grid" ? (
          /* Two-level catalog layout:
               CATEGORY banner (e.g. "Industrial Sewing Machines")
                 SUB-CATEGORY header  (e.g. "Lockstitch Machines")
                   product cards in a 4-column grid
                 SUB-CATEGORY header  (e.g. "Overlock Machines")
                   product cards
               CATEGORY banner (e.g. "Cutting Equipment")
                 SUB-CATEGORY header
                   product cards
               …

             Sticky jump-nav at the top lets the user hop between
             categories instantly. content-visibility:auto on each
             category section keeps render fast even with 600+ cards
             mounted at once. */
          <>
            {/* ── Category jump-nav ── */}
            {categoryTree.length > 1 && (
              <nav className="sticky top-[68px] z-20 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-3 mb-8 bg-[var(--bg-primary)]/90 backdrop-blur-xl border-b border-[var(--border-subtle)] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex items-center gap-1.5">
                  {categoryTree.map((cat) => (
                    <a
                      key={cat.slug}
                      href={`#cat-${cat.slug}`}
                      onClick={(e) => {
                        e.preventDefault();
                        const el = document.getElementById(`cat-${cat.slug}`);
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className="inline-flex items-center gap-2 h-8 px-3.5 rounded-full text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>{cat.name}</span>
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--bg-surface)] text-[10px] tabular-nums font-semibold text-[var(--text-dim)]">{cat.total}</span>
                    </a>
                  ))}
                </div>
              </nav>
            )}

          <div className="space-y-14">
          {categoryTree.map((cat) => (
            <section
              key={cat.slug}
              id={`cat-${cat.slug}`}
              style={{ contentVisibility: "auto", containIntrinsicSize: "1px 800px" }}
              className="scroll-mt-32"
            >
              {/* ── CATEGORY headline — calm, editorial. An accent
                  bar on the left replaces the heavier gradient
                  background; the title sits big with the count
                  rendered as a small uppercase caption above. */}
              <div className="mb-7 flex items-end justify-between gap-3 pl-4 border-l-[3px] border-[var(--border-focus)]">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-ghost)] mb-1">
                    Category
                  </p>
                  <h2 className="text-[20px] md:text-[26px] font-bold tracking-tight text-[var(--text-primary)] truncate leading-tight">
                    {cat.name}
                  </h2>
                </div>
                <span className="shrink-0 text-[12px] font-semibold text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                  {cat.total} {cat.total === 1 ? "product" : "products"}
                </span>
              </div>

              {/* Sub-sections within the category */}
              <div className="space-y-10">
              {cat.subSections.map((section) => (
                <div key={section.slug}>
                  <header className="flex items-baseline gap-2.5 mb-4">
                    <h3 className="text-[15px] md:text-[16px] font-semibold tracking-tight text-[var(--text-primary)]">
                      {section.name}
                    </h3>
                    <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-semibold tabular-nums text-[var(--text-muted)]">
                      {section.products.length}
                    </span>
                    <span className="flex-1 h-px bg-[var(--border-subtle)] ml-1" />
                  </header>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {section.products.map((p) => {
              const imgUrl = mainImages[p.id];
              const models = modelCounts[p.id] || 0;
              const suppliers = productSuppliers[p.id] || [];
              const lvl = levelColors[p.level || ""] || "";

              return (
                <Link
                  key={p.id}
                  href={`${baseRoute}/${p.slug || p.id}`}
                  className="group relative bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-subtle)] overflow-hidden transition-all duration-300 hover:border-[var(--border-focus)] hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)]"
                >
                  {/* Image — calm, clean. Background matches the
                      card surface so transparent product photos
                      blend in (no white box around the photo).
                      No scale on hover — the card lifts, image
                      stays put. */}
                  <div className="relative aspect-[4/3] bg-[var(--bg-surface-subtle)] overflow-hidden">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={p.product_name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain p-4"
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

                    {/* Actions (show on hover) — internal only.
                        Edit is a real <Link> (with prefetch), wrapped
                        in stopPropagation so the click doesn't also
                        trigger the parent card's product-detail Link.
                        Delete stays a <button> since it opens a modal. */}
                    {isInternal && (
                    <div className="absolute bottom-2.5 right-2.5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Link
                        href={`${baseRoute}/${p.id}/edit`}
                        onClick={(e) => e.stopPropagation()}
                        className="h-8 w-8 rounded-lg bg-[var(--bg-primary)]/80 border border-[var(--border-subtle)] backdrop-blur-sm flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                        title="Edit product"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        onClick={(e) => askDelete(e, p.id, p.product_name)}
                        className="h-8 w-8 rounded-lg bg-[var(--bg-primary)]/80 border border-[var(--border-subtle)] backdrop-blur-sm flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 transition-colors"
                        title="Delete product"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-3.5 md:p-4">
                    {(() => {
                      const mn = primaryModelNames[p.id];
                      const hasDistinctName = mn && mn !== p.product_name;
                      if (hasDistinctName) {
                        // Catalog layout — code first as the heading,
                        // descriptive name as the subtitle below.
                        return (
                          <>
                            <h3 className="text-[16px] md:text-[18px] font-bold tracking-tight text-[var(--text-primary)] truncate group-hover:text-[var(--text-highlight)] transition-colors">
                              {mn}
                            </h3>
                            <p className="text-[12px] md:text-[13px] text-[var(--text-muted)] mt-0.5 line-clamp-2 leading-snug">
                              {p.product_name}
                            </p>
                          </>
                        );
                      }
                      // No descriptive name yet — show the model code
                      // as the title and a small "Needs name" pill to
                      // flag it for the admin.
                      return (
                        <>
                          <h3 className="text-[16px] md:text-[18px] font-bold tracking-tight text-[var(--text-primary)] truncate group-hover:text-[var(--text-highlight)] transition-colors">
                            {p.product_name}
                          </h3>
                          {isInternal && (
                            <p className="mt-0.5 text-[10px] font-medium text-amber-400/80">
                              Needs name
                            </p>
                          )}
                        </>
                      );
                    })()}

                    {/* Category + Subcategory line.
                        Subcategory shown as a chip after the category
                        so admins can spot at a glance whether a
                        product is in lockstitch / overlock / etc.
                        without opening it. */}
                    <p className="text-[11px] text-[var(--text-dim)] mt-2 truncate flex items-center gap-1.5">
                      <LayersIcon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{catMap[p.category_slug] || p.category_slug}</span>
                      {p.subcategory_slug && subMap[p.subcategory_slug] && (
                        <>
                          <span className="text-[var(--text-ghost)]">·</span>
                          <span className="truncate text-[var(--text-muted)]">{subMap[p.subcategory_slug]}</span>
                        </>
                      )}
                    </p>

                    {/* Division label — only for non-flagship products.
                        Garment Machinery is the default/home line and
                        gets a clean card; anything else gets tagged so
                        it's clear at a glance which line it belongs to. */}
                    {p.division_slug && p.division_slug !== FLAGSHIP_DIVISION_SLUG && divMap[p.division_slug] && (
                      <p className="text-[10px] text-[var(--text-ghost)] mt-0.5 uppercase tracking-wider truncate">
                        {divMap[p.division_slug]}
                      </p>
                    )}

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

                    {/* Supplier — internal only */}
                    {isInternal && suppliers.length > 0 && (
                      <p className="text-[10px] text-[var(--text-ghost)] mt-2 truncate">
                        {suppliers.join(", ")}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
              </div>
                </div>
              ))}
              </div>
            </section>
          ))}
          </div>
          </>
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
            <div className="divide-y divide-[var(--border-subtle)]" style={{ contentVisibility: "auto", containIntrinsicSize: "1px 1200px" }}>
              {filtered.map((p) => {
                const imgUrl = mainImages[p.id];
                const models = modelCounts[p.id] || 0;
                const suppliers = productSuppliers[p.id] || [];
                const lvl = levelColors[p.level || ""] || "";

                return (
                  <Link
                    key={p.id}
                    href={`${baseRoute}/${p.slug || p.id}`}
                    className="group flex items-center gap-3 md:grid md:grid-cols-[56px_1fr_140px_120px_100px_80px_80px] md:gap-4 px-4 md:px-5 py-3 hover:bg-[var(--bg-surface-subtle)] transition-colors"
                  >
                    {/* Thumbnail — Supabase Storage transform downscales
                        the source photo to ~96px @ q75 (typically <30 KB
                        instead of multi-MB originals). loading="lazy"
                        keeps off-screen rows from blocking the
                        first paint. */}
                    <div className="h-12 w-12 md:h-14 md:w-14 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] overflow-hidden shrink-0 flex items-center justify-center">
                      {imgUrl ? (
                        <img
                          src={IMG.thumb(imgUrl)}
                          alt={p.product_name}
                          className="w-full h-full object-contain p-1"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <ImageRawIcon className="h-5 w-5 text-[var(--text-ghost)]" />
                      )}
                    </div>

                    {/* Product info (mobile: all info here, desktop: just name) */}
                    <div className="flex-1 md:flex-none min-w-0">
                      {(() => {
                        const mn = primaryModelNames[p.id];
                        const hasDistinctName = mn && mn !== p.product_name;
                        if (hasDistinctName) {
                          return (
                            <>
                              <div className="flex items-center gap-2">
                                <h3 className="text-[14px] md:text-[16px] font-bold tracking-tight text-[var(--text-primary)] truncate group-hover:text-[var(--text-highlight)] transition-colors">
                                  {mn}
                                </h3>
                                {p.featured && <StarIcon className="h-3 w-3 text-amber-400 shrink-0" />}
                              </div>
                              <p className="text-[12px] md:text-[13px] text-[var(--text-muted)] truncate">
                                {p.product_name}
                              </p>
                            </>
                          );
                        }
                        return (
                          <div className="flex items-center gap-2">
                            <h3 className="text-[14px] md:text-[16px] font-bold tracking-tight text-[var(--text-primary)] truncate group-hover:text-[var(--text-highlight)] transition-colors">
                              {p.product_name}
                            </h3>
                            {p.featured && <StarIcon className="h-3 w-3 text-amber-400 shrink-0" />}
                          </div>
                        );
                      })()}
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
                      {/* Desktop: supplier line — internal only */}
                      {isInternal && suppliers.length > 0 && (
                        <p className="hidden md:block text-[11px] text-[var(--text-ghost)] mt-0.5 truncate">
                          {suppliers.join(", ")}
                        </p>
                      )}
                    </div>

                    {/* Category (desktop only) — show the division
                        below the category as a subtle caption when
                        the product is NOT in the flagship line. */}
                    <div className="hidden md:flex flex-col min-w-0 gap-0.5">
                      <span className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] truncate">
                        <LayersIcon className="h-3 w-3 text-[var(--text-ghost)] shrink-0" />
                        {catMap[p.category_slug] || p.category_slug}
                      </span>
                      {p.division_slug && p.division_slug !== FLAGSHIP_DIVISION_SLUG && divMap[p.division_slug] && (
                        <span className="text-[10px] text-[var(--text-ghost)] uppercase tracking-wider truncate pl-[18px]">
                          {divMap[p.division_slug]}
                        </span>
                      )}
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
                      {isInternal && (
                        <>
                          <Link
                            href={`${baseRoute}/${p.id}/edit`}
                            onClick={(e) => e.stopPropagation()}
                            className="h-8 w-8 rounded-lg hover:bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
                            title="Edit product"
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            onClick={(e) => askDelete(e, p.id, p.product_name)}
                            className="h-8 w-8 rounded-lg hover:bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-dim)] hover:text-red-400 transition-colors"
                            title="Delete product"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Themed confirm for product delete — replaces window.confirm() */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={deleteTarget ? `Delete "${deleteTarget.name}"?` : "Delete product?"}
        message="This also removes all its models, media, translations, and saved prices. This cannot be undone."
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}
