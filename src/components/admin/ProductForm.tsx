"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
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

const TABS = [
  "Classification", "Basic Info", "Description", "Specs",
  "Config", "Technical", "Models", "Media",
  "Translations", "Prices", "Related",
] as const;

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
  const [tab, setTab] = useState<(typeof TABS)[number]>("Classification");
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Track original model IDs for diff in edit mode
  const [originalModelIds, setOriginalModelIds] = useState<string[]>([]);
  const [originalMediaIds, setOriginalMediaIds] = useState<string[]>([]);
  const [originalTranslationIds, setOriginalTranslationIds] = useState<string[]>([]);

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

        // Load related data in parallel
        const dbModels = await fetchModelsByProductId(productId);
        const dbMedia = await fetchMediaByProductId(productId);
        const dbTranslations = await fetchTranslationsByProductId(productId);
        const modelIds = dbModels.map(m => m.id);
        const dbPrices = await fetchMarketPricesByModelIds(modelIds);
        const dbRelated = await fetchRelatedProducts(productId);

        // Map models
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

        // Map media
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

        // Map translations
        const mappedTranslations: TranslationFormState[] = dbTranslations.map(t => ({
          _tempId: crypto.randomUUID(),
          id: t.id,
          locale: t.locale,
          product_name: t.product_name,
          description: t.description || "",
        }));
        setTranslations(mappedTranslations);
        setOriginalTranslationIds(dbTranslations.map(t => t.id));

        // Map prices — link to model tempIds
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

        // Map related
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

  // ── SAVE ──
  const save = async () => {
    // Validate
    if (!product.product_name) { setError("Product name is required"); setTab("Basic Info"); return; }
    if (!product.division_slug || !product.category_slug || !product.subcategory_slug) {
      setError("Classification is required"); setTab("Classification"); return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      // 1. Product
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

      // 2. Models — diff: create new, update existing, delete removed
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
          // Update existing
          await updateModel(m.id, modelData);
          tempIdToRealId[m._tempId] = m.id;
        } else {
          // Create new — pass sku as "auto" for trigger
          const created = await createModel({ ...modelData, sku: "auto" });
          if (created) tempIdToRealId[m._tempId] = created.id;
        }
      }

      // Delete removed models
      if (isEdit) {
        const currentModelIds = models.filter(m => m.id).map(m => m.id!);
        for (const oldId of originalModelIds) {
          if (!currentModelIds.includes(oldId)) await deleteModel(oldId);
        }
      }

      // 3. Media — upload new files, create records, delete removed
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

      // 4. Translations
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

      // 5. Market prices
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

      // 6. Related products
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-white/30 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-[900px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/products"
              className="h-9 w-9 flex items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/40 hover:text-white/80 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-[22px] font-bold text-white">
              {isEdit ? "Edit Product" : "New Product"}
            </h1>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="h-10 px-6 rounded-lg bg-white text-black text-[13px] font-semibold flex items-center gap-2 hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Product"}
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-[13px] text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[13px] text-emerald-400">
            {success}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1 scrollbar-none">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 h-9 px-4 rounded-lg text-[12px] font-medium transition-colors ${
                tab === t
                  ? "bg-white/[0.10] text-white"
                  : "text-white/30 hover:text-white/60 hover:bg-white/[0.04]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-[#141414] rounded-2xl border border-white/[0.06] p-6 sm:p-8">
          {tab === "Classification" && (
            <ClassificationSection
              data={product}
              onChange={updateProduct_}
              divisions={divisions}
              categories={categories}
              subcategories={subcategories}
            />
          )}
          {tab === "Basic Info" && (
            <BasicInfoSection
              data={product}
              onChange={updateProduct_}
              slugEdited={slugEdited}
              onSlugEdited={() => setSlugEdited(true)}
            />
          )}
          {tab === "Description" && (
            <DescriptionSection data={product} onChange={updateProduct_} />
          )}
          {tab === "Specs" && (
            <SpecsSection data={product} onChange={updateProduct_} />
          )}
          {tab === "Config" && (
            <ConfigSection data={product} onChange={updateProduct_} />
          )}
          {tab === "Technical" && (
            <TechnicalSection data={product} onChange={updateProduct_} />
          )}
          {tab === "Models" && (
            <ModelsSection models={models} onChange={setModels} />
          )}
          {tab === "Media" && (
            <MediaSection media={media} onChange={setMedia} />
          )}
          {tab === "Translations" && (
            <TranslationsSection translations={translations} onChange={setTranslations} />
          )}
          {tab === "Prices" && (
            <MarketPricesSection prices={prices} models={models} onChange={setPrices} />
          )}
          {tab === "Related" && (
            <RelatedProductsSection related={related} onChange={setRelated} currentProductId={productId} />
          )}
        </div>
      </div>
    </div>
  );
}
