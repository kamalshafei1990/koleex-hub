"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Save, Loader2, Camera, ImageIcon, FolderTree,
  FileText, Wrench, Sliders, Boxes, Image, DollarSign,
  Languages, Link2, Zap, Shield, Star, Eye, Package,
  Upload, Plus, ChevronDown,
} from "lucide-react";
import {
  fetchDivisions, fetchCategories, fetchSubcategories,
  fetchProductById, fetchModelsByProductId, fetchMediaByProductId,
  fetchTranslationsByProductId, fetchMarketPricesByModelIds, fetchRelatedProducts,
  createProduct, updateProduct,
  createModel, updateModel, deleteModel,
  uploadProductFile, createProductMedia, deleteProductMedia,
  upsertTranslation, deleteTranslation,
  upsertMarketPrice, deleteMarketPrice,
  setRelatedProducts,
} from "@/lib/products-admin";
import type { DivisionRow, CategoryRow, SubcategoryRow } from "@/types/supabase";
import type {
  ProductFormState, ModelFormState, MediaFormState,
  TranslationFormState, MarketPriceFormState, RelatedProductFormState,
} from "@/types/product-form";
import { EMPTY_PRODUCT, createEmptyModel } from "@/types/product-form";

import ClassificationSection from "./form-sections/ClassificationSection";
import BasicInfoSection from "./form-sections/BasicInfoSection";
import DescriptionSection from "./form-sections/DescriptionSection";
import SpecsSection from "./form-sections/SpecsSection";
import ConfigSection from "./form-sections/ConfigSection";
import TechnicalSection from "./form-sections/TechnicalSection";
import ModelsSection from "./form-sections/ModelsSection";
import MediaSection from "./form-sections/MediaSection";
import TranslationsSection from "./form-sections/TranslationsSection";
import MarketPricesSection from "./form-sections/MarketPricesSection";
import RelatedProductsSection from "./form-sections/RelatedProductsSection";

/* ── Section wrapper with icon + title (collapsible) ── */
function Section({ icon, title, children, id, defaultOpen = true }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; id?: string; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className="scroll-mt-20 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
      >
        <div className="h-7 w-7 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
          {icon}
        </div>
        <h2 className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight flex-1 text-left">{title}</h2>
        <ChevronDown className={`h-4 w-4 text-[var(--text-dim)] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1">{children}</div>
      )}
    </section>
  );
}

interface Props {
  productId?: string;
}

export default function ProductForm({ productId }: Props) {
  const router = useRouter();
  const isEdit = !!productId;

  // Lookup data
  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryRow[]>([]);

  // Form state
  const [product, setProduct] = useState<ProductFormState>({ ...EMPTY_PRODUCT });
  const [models, setModels] = useState<ModelFormState[]>([]);
  const [media, setMedia] = useState<MediaFormState[]>([]);
  const [translations, setTranslations] = useState<TranslationFormState[]>([]);
  const [prices, setPrices] = useState<MarketPriceFormState[]>([]);
  const [related, setRelated] = useState<RelatedProductFormState[]>([]);

  // UI state
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Track original IDs for diff in edit mode
  const [originalModelIds, setOriginalModelIds] = useState<string[]>([]);
  const [originalMediaIds, setOriginalMediaIds] = useState<string[]>([]);
  const [originalTranslationIds, setOriginalTranslationIds] = useState<string[]>([]);

  // Main image ref for hero
  const mainImageRef = useRef<HTMLInputElement>(null);

  // Load data
  useEffect(() => {
    (async () => {
      const [divs, cats, subs] = await Promise.all([
        fetchDivisions(), fetchCategories(), fetchSubcategories(),
      ]);
      setDivisions(divs);
      setCategories(cats);
      setSubcategories(subs);

      if (isEdit && productId) {
        const p = await fetchProductById(productId);
        if (!p) { setError("Product not found"); setLoading(false); return; }

        setProduct({
          division_slug: p.division_slug,
          category_slug: p.category_slug,
          subcategory_slug: p.subcategory_slug,
          product_name: p.product_name,
          slug: p.slug,
          brand: p.brand || "",
          level: p.level || "",
          tags: p.tags || [],
          description: p.description || "",
          specs: (p.specs as Record<string, string>) || {},
          supports_head_only: p.supports_head_only,
          supports_complete_set: p.supports_complete_set,
          warranty: p.warranty || "",
          hs_code: p.hs_code || "",
          voltage: p.voltage || [],
          plug_types: p.plug_types || [],
          watt: p.watt || "",
          colors: p.colors || [],
          visible: p.visible,
          featured: p.featured,
        });
        setSlugEdited(true);

        const dbModels = await fetchModelsByProductId(productId);
        const dbMedia = await fetchMediaByProductId(productId);
        const dbTranslations = await fetchTranslationsByProductId(productId);
        const modelIds = dbModels.map(m => m.id);
        const dbPrices = await fetchMarketPricesByModelIds(modelIds);
        const dbRelated = await fetchRelatedProducts(productId);

        const mappedModels: ModelFormState[] = dbModels.map(m => ({
          _tempId: crypto.randomUUID(),
          id: m.id,
          model_name: m.model_name,
          slug: m.slug,
          tagline: m.tagline || "",
          supplier: m.supplier || "",
          cost_price: m.cost_price?.toString() || "",
          global_price: m.global_price?.toString() || "",
          supports_head_only: m.supports_head_only,
          supports_complete_set: m.supports_complete_set,
          head_only_price: m.head_only_price?.toString() || "",
          complete_set_price: m.complete_set_price?.toString() || "",
          weight: m.weight?.toString() || "",
          cbm: m.cbm?.toString() || "",
          packing_type: m.packing_type || "",
          box_include: m.box_include || "",
          extra_accessories: m.extra_accessories || "",
          order: m.order,
          visible: m.visible,
        }));
        setModels(mappedModels);
        setOriginalModelIds(modelIds);

        const mappedMedia: MediaFormState[] = dbMedia.map(m => ({
          _tempId: crypto.randomUUID(),
          id: m.id,
          type: m.type,
          url: m.url,
          file_path: m.file_path,
          alt_text: m.alt_text || "",
          order: m.order,
          model_id: m.model_id,
        }));
        setMedia(mappedMedia);
        setOriginalMediaIds(dbMedia.map(m => m.id));

        const mappedTranslations: TranslationFormState[] = dbTranslations.map(t => ({
          _tempId: crypto.randomUUID(),
          id: t.id,
          locale: t.locale,
          product_name: t.product_name,
          description: t.description || "",
        }));
        setTranslations(mappedTranslations);
        setOriginalTranslationIds(dbTranslations.map(t => t.id));

        const modelIdToTempId: Record<string, string> = {};
        mappedModels.forEach(m => { if (m.id) modelIdToTempId[m.id] = m._tempId; });

        const mappedPrices: MarketPriceFormState[] = dbPrices.map(p => ({
          _tempId: crypto.randomUUID(),
          id: p.id,
          _modelTempId: modelIdToTempId[p.model_id] || "",
          model_id: p.model_id,
          country_code: p.country_code,
          currency: p.currency,
          market_price: p.market_price?.toString() || "",
          head_only_price: p.head_only_price?.toString() || "",
          complete_set_price: p.complete_set_price?.toString() || "",
        }));
        setPrices(mappedPrices);

        const mappedRelated: RelatedProductFormState[] = dbRelated.map(r => ({
          related_id: r.related_id,
          related_name: r.product_name || r.related_id,
          order: r.order,
        }));
        setRelated(mappedRelated);
      }

      setLoading(false);
    })();
  }, [isEdit, productId]);

  const updateProduct_ = useCallback((updates: Partial<ProductFormState>) => {
    setProduct(prev => ({ ...prev, ...updates }));
  }, []);

  /* ── Hero: main image helpers ── */
  const mainImage = media.find(m => m.type === "main_image");
  const mainImageSrc = mainImage?._file
    ? URL.createObjectURL(mainImage._file)
    : mainImage?.url || null;

  const handleMainImage = (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    // Remove existing main_image entries
    const filtered = media.filter(m => m.type !== "main_image");
    const newItem: MediaFormState = {
      _tempId: crypto.randomUUID(),
      type: "main_image",
      url: "",
      file_path: null,
      alt_text: "",
      order: 0,
      model_id: null,
      _file: file,
    };
    setMedia([...filtered, newItem]);
  };

  /* ── Hero: model helpers ── */
  const ensureFirstModel = useCallback(() => {
    if (models.length === 0) {
      setModels([{ ...createEmptyModel(), order: 0 }]);
    }
  }, [models.length]);

  // Auto-create first model on mount
  useEffect(() => {
    if (!loading && models.length === 0) ensureFirstModel();
  }, [loading, ensureFirstModel]);

  const updateFirstModel = useCallback((updates: Partial<ModelFormState>) => {
    setModels(prev => {
      if (prev.length === 0) return prev;
      return [{ ...prev[0], ...updates }, ...prev.slice(1)];
    });
  }, []);

  // ── SAVE ──
  const save = async () => {
    if (!product.product_name) {
      setError("Product name is required");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!product.division_slug || !product.category_slug || !product.subcategory_slug) {
      setError("Classification is required");
      setTimeout(() => document.getElementById("classification")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const productData = {
        product_name: product.product_name,
        slug: product.slug,
        division_slug: product.division_slug,
        category_slug: product.category_slug,
        subcategory_slug: product.subcategory_slug,
        brand: product.brand || null,
        tags: product.tags,
        level: product.level || null,
        description: product.description || null,
        specs: product.specs,
        hs_code: product.hs_code || null,
        voltage: product.voltage,
        plug_types: product.plug_types,
        watt: product.watt || null,
        colors: product.colors,
        supports_head_only: product.supports_head_only,
        supports_complete_set: product.supports_complete_set,
        warranty: product.warranty || null,
        visible: product.visible,
        featured: product.featured,
      };

      let pid: string;
      if (isEdit && productId) {
        const ok = await updateProduct(productId, productData);
        if (!ok) throw new Error("Failed to update product");
        pid = productId;
      } else {
        const created = await createProduct(productData);
        if (!created) throw new Error("Failed to create product");
        pid = created.id;
      }

      const tempIdToRealId: Record<string, string> = {};

      for (const m of models) {
        const num = (v: string) => v ? parseFloat(v) : null;
        const modelData = {
          product_id: pid,
          model_name: m.model_name,
          slug: m.slug,
          tagline: m.tagline || null,
          supplier: m.supplier || null,
          cost_price: num(m.cost_price),
          global_price: num(m.global_price),
          supports_head_only: m.supports_head_only,
          supports_complete_set: m.supports_complete_set,
          head_only_price: num(m.head_only_price),
          complete_set_price: num(m.complete_set_price),
          weight: num(m.weight),
          cbm: num(m.cbm),
          packing_type: m.packing_type || null,
          box_include: m.box_include || null,
          extra_accessories: m.extra_accessories || null,
          order: m.order,
          visible: m.visible,
        };

        if (m.id) {
          await updateModel(m.id, modelData);
          tempIdToRealId[m._tempId] = m.id;
        } else {
          const created = await createModel({ ...modelData, sku: "auto" });
          if (created) tempIdToRealId[m._tempId] = created.id;
        }
      }

      if (isEdit) {
        const currentModelIds = models.filter(m => m.id).map(m => m.id!);
        for (const oldId of originalModelIds) {
          if (!currentModelIds.includes(oldId)) await deleteModel(oldId);
        }
      }

      for (const item of media) {
        if (item._file && !item.id) {
          const uploaded = await uploadProductFile(item._file);
          if (uploaded) {
            await createProductMedia({
              product_id: pid,
              model_id: item.model_id,
              type: item.type,
              url: uploaded.url,
              file_path: uploaded.file_path,
              alt_text: item.alt_text || null,
              order: item.order,
            });
          }
        }
      }

      if (isEdit) {
        const currentMediaIds = media.filter(m => m.id).map(m => m.id!);
        for (const oldId of originalMediaIds) {
          if (!currentMediaIds.includes(oldId)) await deleteProductMedia(oldId);
        }
      }

      for (const t of translations) {
        await upsertTranslation({
          product_id: pid,
          locale: t.locale,
          product_name: t.product_name,
          description: t.description || null,
        });
      }

      if (isEdit) {
        const currentTransIds = translations.filter(t => t.id).map(t => t.id!);
        for (const oldId of originalTranslationIds) {
          if (!currentTransIds.includes(oldId)) await deleteTranslation(oldId);
        }
      }

      for (const p of prices) {
        const realModelId = p.model_id || tempIdToRealId[p._modelTempId];
        if (!realModelId) continue;
        const num = (v: string) => v ? parseFloat(v) : null;
        await upsertMarketPrice({
          model_id: realModelId,
          country_code: p.country_code,
          currency: p.currency,
          market_price: num(p.market_price) || 0,
          head_only_price: num(p.head_only_price),
          complete_set_price: num(p.complete_set_price),
        });
      }

      await setRelatedProducts(pid, related.map(r => r.related_id));

      setSuccess("Product saved successfully!");
      if (!isEdit) {
        setTimeout(() => router.push(`/products/${pid}/edit`), 800);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ── Section nav for quick jump ──
  const sections = [
    { id: "classification", label: "Classification", icon: <FolderTree className="h-3.5 w-3.5" /> },
    { id: "description", label: "Description", icon: <FileText className="h-3.5 w-3.5" /> },
    { id: "specs", label: "Specs", icon: <Wrench className="h-3.5 w-3.5" /> },
    { id: "config", label: "Config", icon: <Sliders className="h-3.5 w-3.5" /> },
    { id: "models", label: "Models", icon: <Boxes className="h-3.5 w-3.5" /> },
    { id: "media", label: "Media", icon: <Image className="h-3.5 w-3.5" /> },
    { id: "prices", label: "Prices", icon: <DollarSign className="h-3.5 w-3.5" /> },
    { id: "translations", label: "Translations", icon: <Languages className="h-3.5 w-3.5" /> },
    { id: "related", label: "Related", icon: <Link2 className="h-3.5 w-3.5" /> },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-[var(--text-dim)] animate-spin" />
      </div>
    );
  }

  const inp = "w-full h-11 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors";
  const lbl = "block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5";

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="w-full px-4 md:px-8 lg:px-12 xl:px-16 py-6 md:py-8">

        {/* ═══ TOP BAR ═══ */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link
              href="/products"
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">
                {isEdit ? "Edit Product" : "New Product"}
              </h1>
              <p className="text-[12px] text-[var(--text-dim)] mt-0.5">
                {isEdit ? "Update product details below" : "Fill in the product information"}
              </p>
            </div>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="h-10 px-5 md:px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 shadow-lg"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Product"}
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[13px] text-red-400 flex items-center gap-2">
            <span className="shrink-0">&#9888;</span> {error}
          </div>
        )}
        {success && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[13px] text-emerald-400 flex items-center gap-2">
            <span className="shrink-0">&#10003;</span> {success}
          </div>
        )}

        {/* ═══ SECTION NAV (quick jump) ═══ */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1 scrollbar-none">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="shrink-0 h-8 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] flex items-center gap-1.5 transition-all"
            >
              {s.icon}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>

        {/* ═══ HERO SECTION ═══ */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-4 md:p-5 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 md:gap-5">

            {/* Left: Main Product Image */}
            <div className="sm:w-[160px] md:w-[180px] lg:w-[200px] shrink-0">
              <input
                ref={mainImageRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleMainImage(e.target.files)}
              />
              <div
                onClick={() => mainImageRef.current?.click()}
                className="relative w-full aspect-square max-h-[200px] rounded-xl overflow-hidden cursor-pointer group border-2 border-dashed border-[var(--border-subtle)] hover:border-[var(--border-focus)] transition-all bg-[var(--bg-surface-subtle)]"
              >
                {mainImageSrc ? (
                  <>
                    <img src={mainImageSrc} alt="Product" className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="flex items-center gap-2 text-white text-sm font-medium">
                        <Camera className="h-5 w-5" />
                        Change Photo
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <div className="h-12 w-12 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-[var(--text-ghost)]" />
                    </div>
                    <div className="text-center">
                      <p className="text-[12px] font-medium text-[var(--text-dim)]">Upload Photo</p>
                      <p className="text-[10px] text-[var(--text-ghost)] mt-0.5">Click or drag & drop</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Product Identity */}
            <div className="flex-1 flex flex-col justify-center gap-2.5">
              {/* Row 1: Product Name + Model + Supplier */}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr] gap-2.5">
                <div>
                  <label className={lbl}>Product Name *</label>
                  <input
                    type="text"
                    value={product.product_name}
                    onChange={(e) => {
                      const updates: Partial<ProductFormState> = { product_name: e.target.value };
                      if (!slugEdited) updates.slug = (e.target.value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                      updateProduct_(updates);
                    }}
                    placeholder="e.g. KX CoBot Pro"
                    className="w-full h-11 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[15px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-colors"
                  />
                </div>
                <div>
                  <label className={lbl}>
                    <span className="inline-flex items-center gap-1.5"><Boxes className="h-3 w-3" /> Product Model</span>
                  </label>
                  <input
                    type="text"
                    value={models[0]?.model_name || ""}
                    onChange={(e) => {
                      if (models.length === 0) ensureFirstModel();
                      updateFirstModel({ model_name: e.target.value, slug: (e.target.value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") });
                    }}
                    placeholder="e.g. KX-500A"
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>
                    <span className="inline-flex items-center gap-1.5"><Package className="h-3 w-3" /> Supplier</span>
                  </label>
                  <input
                    type="text"
                    value={models[0]?.supplier || ""}
                    onChange={(e) => {
                      if (models.length === 0) ensureFirstModel();
                      updateFirstModel({ supplier: e.target.value });
                    }}
                    placeholder="e.g. Zhejiang Manufacturing Co."
                    className={inp}
                  />
                </div>
              </div>

              {/* Row 2: Brand + Level + Slug + Tags */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <div>
                  <label className={lbl}>
                    <span className="inline-flex items-center gap-1.5"><Star className="h-3 w-3" /> Brand</span>
                  </label>
                  <input
                    type="text"
                    value={product.brand}
                    onChange={(e) => updateProduct_({ brand: e.target.value })}
                    placeholder="e.g. Koleex"
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>
                    <span className="inline-flex items-center gap-1.5"><Package className="h-3 w-3" /> Level</span>
                  </label>
                  <select
                    value={product.level}
                    onChange={(e) => updateProduct_({ level: e.target.value })}
                    className={inp}
                  >
                    <option value="">Select level...</option>
                    <option value="entry">Entry</option>
                    <option value="mid">Mid</option>
                    <option value="premium">Premium</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Slug</label>
                  <input
                    type="text"
                    value={product.slug}
                    onChange={(e) => { setSlugEdited(true); updateProduct_({ slug: e.target.value }); }}
                    className={`${inp} font-mono text-[var(--text-muted)]`}
                  />
                </div>
                <div>
                  <label className={lbl}>Tags</label>
                  <TagsInput
                    tags={product.tags}
                    onChange={(tags) => updateProduct_({ tags })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ ALL SECTIONS — 2-col grid on desktop ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">

          {/* Left column */}
          <div className="space-y-4 md:space-y-5">
            {/* 1. Classification */}
            <Section id="classification" icon={<FolderTree className="h-4 w-4" />} title="Classification">
              <ClassificationSection
                data={product}
                onChange={updateProduct_}
                divisions={divisions}
                categories={categories}
                subcategories={subcategories}
              />
            </Section>

            {/* 2. Description */}
            <Section id="description" icon={<FileText className="h-4 w-4" />} title="Description">
              <DescriptionSection data={product} onChange={updateProduct_} />
            </Section>

            {/* 3. Specs + Technical combined */}
            <Section id="specs" icon={<Wrench className="h-4 w-4" />} title="Specifications & Technical">
              <div className="space-y-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-ghost)] mb-3 flex items-center gap-2">
                    <Wrench className="h-3 w-3" /> Key Specifications
                  </p>
                  <SpecsSection data={product} onChange={updateProduct_} />
                </div>
                <div className="border-t border-[var(--border-subtle)] pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-ghost)] mb-3 flex items-center gap-2">
                    <Zap className="h-3 w-3" /> Electrical & Technical
                  </p>
                  <TechnicalSection data={product} onChange={updateProduct_} />
                </div>
              </div>
            </Section>

            {/* 4. Configuration */}
            <Section id="config" icon={<Sliders className="h-4 w-4" />} title="Configuration & Visibility">
              <ConfigSection data={product} onChange={updateProduct_} />
            </Section>

            {/* 8. Translations */}
            <Section id="translations" icon={<Languages className="h-4 w-4" />} title="Translations" defaultOpen={false}>
              <TranslationsSection translations={translations} onChange={setTranslations} />
            </Section>
          </div>

          {/* Right column */}
          <div className="space-y-4 md:space-y-5">
            {/* 5. Models */}
            <Section id="models" icon={<Boxes className="h-4 w-4" />} title="Models & Variants">
              <ModelsSection models={models} onChange={setModels} />
            </Section>

            {/* 6. Media */}
            <Section id="media" icon={<Image className="h-4 w-4" />} title="Media & Files">
              <MediaSection
                media={media.filter(m => m.type !== "main_image")}
                excludeTypes={["main_image"]}
                onChange={(filtered) => {
                  const mainImages = media.filter(m => m.type === "main_image");
                  setMedia([...mainImages, ...filtered]);
                }}
              />
            </Section>

            {/* 7. Market Prices */}
            <Section id="prices" icon={<DollarSign className="h-4 w-4" />} title="Market Prices" defaultOpen={false}>
              <MarketPricesSection prices={prices} models={models} onChange={setPrices} />
            </Section>

            {/* 9. Related Products */}
            <Section id="related" icon={<Link2 className="h-4 w-4" />} title="Related Products" defaultOpen={false}>
              <RelatedProductsSection related={related} onChange={setRelated} currentProductId={productId} />
            </Section>
          </div>
        </div>

        {/* ═══ BOTTOM SAVE BAR ═══ */}
        <div className="mt-8 pt-5 border-t border-[var(--border-subtle)] flex items-center justify-between">
          <Link href="/products" className="text-[13px] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">
            Cancel
          </Link>
          <button
            onClick={save}
            disabled={saving}
            className="h-11 px-8 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 shadow-lg"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Product"}
          </button>
        </div>

        {/* Bottom padding */}
        <div className="h-12" />
      </div>
    </div>
  );
}

/* ── Inline Tags Input ── */
function TagsInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");

  const add = () => {
    const t = input.trim().toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput("");
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[var(--bg-surface)] text-[12px] text-[var(--text-muted)]">
            {tag}
            <button onClick={() => onChange(tags.filter(t => t !== tag))} className="text-[var(--text-dim)] hover:text-[var(--text-muted)] ml-0.5">
              <span className="text-xs">&times;</span>
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        placeholder="Type tag and press Enter..."
        className="w-full h-11 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors"
      />
    </div>
  );
}
