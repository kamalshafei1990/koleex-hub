"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Save, Loader2, Camera, ImageIcon, FolderTree,
  FileText, Wrench, Sliders, Boxes, Image, DollarSign,
  Languages, Link2, Zap, Settings2, ChevronDown, ChevronRight,
  Check, Package, Plus, AlertTriangle, Globe, Eye, Star,
  ArrowRight, CircleDot, Hash,
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
  fetchSupplierNames, fetchUniqueBrands,
  fetchBrandLogos, uploadBrandLogo,
  fetchDivisionLogos, fetchCategoryLogos, fetchSubcategoryLogos,
  fetchSewingSpecsByProductId, upsertSewingSpecs,
} from "@/lib/products-admin";
import { fetchAttributeConfig } from "@/lib/product-attributes";
import type { DivisionRow, CategoryRow, SubcategoryRow } from "@/types/supabase";
import type {
  ProductFormState, ModelFormState, MediaFormState,
  TranslationFormState, MarketPriceFormState, RelatedProductFormState,
} from "@/types/product-form";
import { EMPTY_PRODUCT, createEmptyModel } from "@/types/product-form";

import ClassificationSection from "./form-sections/ClassificationSection";
import SelectWithCreate from "./form-sections/SelectWithCreate";
import CreateDivisionModal from "./form-sections/CreateDivisionModal";
import CreateCategoryModal from "./form-sections/CreateCategoryModal";
import CreateSubcategoryModal from "./form-sections/CreateSubcategoryModal";
import CreateSupplierModal from "./form-sections/CreateSupplierModal";
import CreateBrandModal from "./form-sections/CreateBrandModal";
import DescriptionSection from "./form-sections/DescriptionSection";
import SpecsSection from "./form-sections/SpecsSection";
import ConfigSection from "./form-sections/ConfigSection";
import TechnicalSection from "./form-sections/TechnicalSection";
import ModelsSection from "./form-sections/ModelsSection";
import MediaSection from "./form-sections/MediaSection";
import TranslationsSection from "./form-sections/TranslationsSection";
import MarketPricesSection from "./form-sections/MarketPricesSection";
import RelatedProductsSection from "./form-sections/RelatedProductsSection";
import SewingMachineSection from "./form-sections/SewingMachineSection";
import type { SewingSpecsFormState } from "./form-sections/SewingMachineSection";
import { isSewingMachineSubcategory } from "@/lib/sewing-machine-templates";

/* ═══════════════════════════════════════════════════════════════════
   SECTION WRAPPER — collapsible card with icon + title
   ═══════════════════════════════════════════════════════════════════ */
function Section({ icon, title, children, id, defaultOpen = true, badge }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; id?: string; defaultOpen?: boolean; badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className="scroll-mt-24 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden transition-shadow hover:shadow-[0_2px_12px_rgba(0,0,0,0.15)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-6 py-4 hover:bg-[var(--bg-surface-subtle)]/50 transition-colors cursor-pointer"
      >
        <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
          {icon}
        </div>
        <h2 className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight flex-1 text-left">{title}</h2>
        {badge && (
          <span className="text-[10px] font-medium text-[var(--text-ghost)] bg-[var(--bg-surface)] px-2 py-0.5 rounded-full">{badge}</span>
        )}
        <ChevronDown className={`h-4 w-4 text-[var(--text-ghost)] transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-6 pb-6 pt-2 border-t border-[var(--border-subtle)]">{children}</div>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   WIZARD STEPS DEFINITION
   ═══════════════════════════════════════════════════════════════════ */
interface WizardStep {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  conditional?: boolean;
}

function getSteps(isSewing: boolean): WizardStep[] {
  const steps: WizardStep[] = [
    { id: "identity", label: "Identity & Classification", shortLabel: "Identity", icon: <Camera className="h-4 w-4" /> },
    { id: "details", label: "Product Information", shortLabel: "Details", icon: <FileText className="h-4 w-4" /> },
  ];
  if (isSewing) {
    steps.push({ id: "sewing", label: "Sewing Machine Specs", shortLabel: "Sewing", icon: <Settings2 className="h-4 w-4" />, conditional: true });
  }
  steps.push(
    { id: "commercial", label: "Models & Pricing", shortLabel: "Models", icon: <Boxes className="h-4 w-4" /> },
    { id: "media", label: "Media & Files", shortLabel: "Media", icon: <Image className="h-4 w-4" /> },
    { id: "finalize", label: "Review & Publish", shortLabel: "Finalize", icon: <Check className="h-4 w-4" /> },
  );
  return steps;
}

/* ═══════════════════════════════════════════════════════════════════
   STEP NAVIGATION BAR
   ═══════════════════════════════════════════════════════════════════ */
function StepNav({ steps, currentStep, onStepChange, completedSteps }: {
  steps: WizardStep[]; currentStep: number; onStepChange: (i: number) => void; completedSteps: Set<number>;
}) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] px-2 py-2 mb-6">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {steps.map((step, i) => {
          const isActive = i === currentStep;
          const isCompleted = completedSteps.has(i);
          const isPast = i < currentStep;
          return (
            <button
              key={step.id}
              onClick={() => onStepChange(i)}
              className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-medium transition-all shrink-0 ${
                isActive
                  ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] shadow-lg"
                  : isPast || isCompleted
                  ? "text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)]"
                  : "text-[var(--text-ghost)] hover:text-[var(--text-dim)] hover:bg-[var(--bg-surface-subtle)]"
              }`}
            >
              <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                isActive ? "bg-white/20" : isCompleted ? "bg-emerald-500/20 text-emerald-400" : "bg-[var(--bg-surface)] text-[var(--text-ghost)]"
              }`}>
                {isCompleted && !isActive ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span className="hidden md:inline">{step.shortLabel}</span>
              {i < steps.length - 1 && (
                <ChevronRight className="h-3 w-3 text-[var(--text-ghost)] ml-1 hidden lg:block" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TOGGLE COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${checked ? "bg-emerald-500/60" : "bg-[var(--bg-surface)]"}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-[var(--bg-inverted)] shadow transition-transform duration-200 ${checked ? "translate-x-5" : ""}`} />
      </button>
      <span className="text-[13px] text-[var(--text-muted)] group-hover:text-[var(--text-primary)]/80 transition-colors">{label}</span>
    </label>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STATUS BADGE
   ═══════════════════════════════════════════════════════════════════ */
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    active: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    archived: "text-red-400 bg-red-400/10 border-red-400/20",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider ${colors[status] || colors.draft}`}>
      <CircleDot className="h-2.5 w-2.5" />
      {status || "draft"}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PRODUCT FORM (WIZARD)
   ═══════════════════════════════════════════════════════════════════ */
interface Props {
  productId?: string;
}

export default function ProductForm({ productId }: Props) {
  const router = useRouter();
  const isEdit = !!productId;

  /* ── Lookup data ── */
  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryRow[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; logo: string | null }[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [brandLogos, setBrandLogos] = useState<Record<string, string>>({});
  const [divisionLogos, setDivisionLogos] = useState<Record<string, string>>({});
  const [categoryLogos, setCategoryLogos] = useState<Record<string, string>>({});
  const [subcategoryLogos, setSubcategoryLogos] = useState<Record<string, string>>({});
  const [allTags, setAllTags] = useState<string[]>([]);
  const [attrSuggestions, setAttrSuggestions] = useState<{ voltage: string[]; plug_types: { name: string; image?: string | null }[]; colors: string[]; watt: string[]; levels: string[] }>({ voltage: [], plug_types: [], colors: [], watt: [], levels: [] });

  /* ── Form state ── */
  const [product, setProduct] = useState<ProductFormState>({ ...EMPTY_PRODUCT });
  const [models, setModels] = useState<ModelFormState[]>([]);
  const [media, setMedia] = useState<MediaFormState[]>([]);
  const [translations, setTranslations] = useState<TranslationFormState[]>([]);
  const [prices, setPrices] = useState<MarketPriceFormState[]>([]);
  const [related, setRelated] = useState<RelatedProductFormState[]>([]);

  /* ── Sewing machine specs ── */
  const [sewingSpecs, setSewingSpecs] = useState<SewingSpecsFormState>({
    template_slug: "",
    common_specs: {},
    template_specs: {},
  });

  /* ── Wizard state ── */
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  /* ── UI state ── */
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* ── Track original IDs for diff in edit mode ── */
  const [originalModelIds, setOriginalModelIds] = useState<string[]>([]);
  const [originalMediaIds, setOriginalMediaIds] = useState<string[]>([]);
  const [originalTranslationIds, setOriginalTranslationIds] = useState<string[]>([]);

  /* ── Main image ref for hero ── */
  const mainImageRef = useRef<HTMLInputElement>(null);

  /* ── Derived: is this a sewing machine product? ── */
  const isSewing = isSewingMachineSubcategory(product.subcategory_slug, product.division_slug, product.category_slug);

  /* ── Wizard steps ── */
  const steps = useMemo(() => getSteps(isSewing), [isSewing]);

  /* ── Load data ── */
  useEffect(() => {
    (async () => {
      const [divs, cats, subs, supplierList, brandList, logoMap, attrCfg, divLogos, catLogos, subLogos] = await Promise.all([
        fetchDivisions(), fetchCategories(), fetchSubcategories(),
        fetchSupplierNames(), fetchUniqueBrands(), fetchBrandLogos(),
        fetchAttributeConfig(),
        fetchDivisionLogos(), fetchCategoryLogos(), fetchSubcategoryLogos(),
      ]);
      setDivisions(divs);
      setCategories(cats);
      setSubcategories(subs);
      setSuppliers(supplierList);
      setBrands(brandList);
      setAllTags(attrCfg.tags);
      setBrandLogos(logoMap);
      setDivisionLogos(divLogos);
      setCategoryLogos(catLogos);
      setSubcategoryLogos(subLogos);
      setAttrSuggestions({
        voltage: attrCfg.voltage,
        plug_types: attrCfg.plug_types,
        colors: attrCfg.colors,
        watt: attrCfg.watt,
        levels: attrCfg.levels,
      });

      if (isEdit && productId) {
        const [p, dbModels, dbMedia, dbTranslations, dbRelated, dbSewingSpecs] = await Promise.all([
          fetchProductById(productId),
          fetchModelsByProductId(productId),
          fetchMediaByProductId(productId),
          fetchTranslationsByProductId(productId),
          fetchRelatedProducts(productId),
          fetchSewingSpecsByProductId(productId),
        ]);
        if (!p) { setError("Product not found"); setLoading(false); return; }

        const modelIds = dbModels.map(m => m.id);
        const dbPrices = await fetchMarketPricesByModelIds(modelIds);

        setProduct({
          division_slug: p.division_slug,
          category_slug: p.category_slug,
          subcategory_slug: p.subcategory_slug,
          product_name: p.product_name,
          slug: p.slug,
          brand: p.brand || "",
          level: p.level || "",
          family: p.family || "",
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
          status: (p.status as ProductFormState["status"]) || "draft",
          country_of_origin: p.country_of_origin || "",
          moq: p.moq?.toString() || "",
          lead_time: p.lead_time || "",
        });
        setSlugEdited(true);

        const mappedModels: ModelFormState[] = dbModels.map(m => ({
          _tempId: crypto.randomUUID(),
          id: m.id,
          model_name: m.model_name,
          slug: m.slug,
          tagline: m.tagline || "",
          supplier: m.supplier || "",
          reference_model: m.reference_model || "",
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
          status: (m.status as ModelFormState["status"]) || "active",
          moq: m.moq?.toString() || "",
          lead_time: m.lead_time || "",
          barcode: m.barcode || "",
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

        if (dbSewingSpecs) {
          setSewingSpecs({
            template_slug: dbSewingSpecs.template_slug,
            common_specs: (dbSewingSpecs.common_specs as Record<string, unknown>) || {},
            template_specs: (dbSewingSpecs.template_specs as Record<string, unknown>) || {},
          });
        }
      }

      setLoading(false);
    })();
  }, [isEdit, productId]);

  const updateProduct_ = useCallback((updates: Partial<ProductFormState>) => {
    setProduct(prev => ({ ...prev, ...updates }));
  }, []);

  /* ── Modal state ── */
  const [showDivisionModal, setShowDivisionModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [supplierTarget, setSupplierTarget] = useState<"hero" | string>("hero");

  /* ── Hero: main image helpers ── */
  const mainImage = media.find(m => m.type === "main_image");
  const mainImageSrc = mainImage?._file
    ? URL.createObjectURL(mainImage._file)
    : mainImage?.url || null;

  const handleMainImage = (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
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

  /* ── Auto-create first model ── */
  const ensureFirstModel = useCallback(() => {
    if (models.length === 0) {
      setModels([{ ...createEmptyModel(), order: 0 }]);
    }
  }, [models.length]);

  useEffect(() => {
    if (!loading && models.length === 0) ensureFirstModel();
  }, [loading, ensureFirstModel]);

  /* ── Step navigation ── */
  const goToStep = (idx: number) => {
    // Mark current step as completed when moving forward
    if (idx > currentStep) {
      setCompletedSteps(prev => new Set([...prev, currentStep]));
    }
    setCurrentStep(Math.max(0, Math.min(idx, steps.length - 1)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const nextStep = () => goToStep(currentStep + 1);
  const prevStep = () => goToStep(currentStep - 1);

  /* ── Validation per step ── */
  const validateCurrentStep = (): string | null => {
    const stepId = steps[currentStep]?.id;
    if (stepId === "identity") {
      if (!product.product_name.trim()) return "Product name is required";
      if (!product.division_slug || !product.category_slug || !product.subcategory_slug) return "Complete the classification before proceeding";
    }
    return null;
  };

  const handleNext = () => {
    const err = validateCurrentStep();
    if (err) {
      setError(err);
      return;
    }
    setError("");
    nextStep();
  };

  /* ═══════════════════════════════════════════════
     SAVE
     ═══════════════════════════════════════════════ */
  const save = async () => {
    if (!product.product_name) {
      setError("Product name is required");
      setCurrentStep(0);
      return;
    }
    if (!product.division_slug || !product.category_slug || !product.subcategory_slug) {
      setError("Classification is required");
      setCurrentStep(0);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const productData: Record<string, unknown> = {
        product_name: product.product_name,
        slug: product.slug,
        division_slug: product.division_slug,
        category_slug: product.category_slug,
        subcategory_slug: product.subcategory_slug,
        brand: product.brand || null,
        tags: product.tags,
        level: product.level || null,
        family: product.family || null,
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
        status: product.status,
        country_of_origin: product.country_of_origin || null,
        moq: product.moq ? parseInt(product.moq) : null,
        lead_time: product.lead_time || null,
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
        const modelData: Record<string, unknown> = {
          product_id: pid,
          model_name: m.model_name,
          slug: m.slug,
          tagline: m.tagline || null,
          supplier: m.supplier || null,
          reference_model: m.reference_model || null,
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
          status: m.status,
          moq: m.moq ? parseInt(m.moq) : null,
          lead_time: m.lead_time || null,
          barcode: m.barcode || null,
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

      if (sewingSpecs.template_slug) {
        await upsertSewingSpecs({
          product_id: pid,
          template_slug: sewingSpecs.template_slug,
          common_specs: sewingSpecs.common_specs,
          template_specs: sewingSpecs.template_specs,
        });
      }

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

  /* ── Shared CSS ── */
  const inp = "w-full h-11 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all appearance-none";
  const lbl = "block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5";

  /* ── Classification summary for breadcrumb ── */
  const divisionName = divisions.find(d => d.slug === product.division_slug)?.name;
  const categoryName = categories.find(c => c.slug === product.category_slug)?.name;
  const subcategoryName = subcategories.find(s => s.slug === product.subcategory_slug)?.name;

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-[var(--text-dim)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* ═══ STICKY TOP BAR ═══ */}
      <div className="sticky top-14 z-40 bg-[var(--bg-secondary)]/90 backdrop-blur-xl border-b border-[var(--border-subtle)]">
        <div className="w-full px-4 md:px-8 lg:px-12 xl:px-16 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/products" className="text-[13px] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-2">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Products
            </Link>
            {product.product_name && (
              <div className="hidden md:flex items-center gap-2">
                <span className="text-[var(--text-ghost)]">/</span>
                <span className="text-[13px] text-[var(--text-muted)] font-medium truncate max-w-[200px]">{product.product_name}</span>
                <StatusBadge status={product.status} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="h-9 px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 shadow-lg"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : "Save Product"}
            </button>
          </div>
        </div>
      </div>

      <div className="w-full px-4 md:px-8 lg:px-12 xl:px-16 py-6 md:py-8">

        {/* Messages */}
        {error && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[13px] text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            <button onClick={() => setError("")} className="ml-auto text-red-400/50 hover:text-red-400">×</button>
          </div>
        )}
        {success && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[13px] text-emerald-400 flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0" /> {success}
          </div>
        )}

        {/* ═══ STEP NAVIGATION ═══ */}
        <StepNav
          steps={steps}
          currentStep={currentStep}
          onStepChange={goToStep}
          completedSteps={completedSteps}
        />

        {/* ═══════════════════════════════════════════════════════════
           STEP 1: IDENTITY & CLASSIFICATION
           ═══════════════════════════════════════════════════════════ */}
        {steps[currentStep]?.id === "identity" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Hero Card */}
            <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-8 shadow-[0_1px_8px_rgba(0,0,0,0.1)]">
              <div className="flex flex-col md:flex-row gap-6 md:gap-10">
                {/* Left: Main Product Image */}
                <div className="md:w-[280px] lg:w-[320px] shrink-0">
                  <input
                    ref={mainImageRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleMainImage(e.target.files)}
                  />
                  <div
                    onClick={() => mainImageRef.current?.click()}
                    className="relative w-full aspect-square rounded-2xl overflow-hidden cursor-pointer group border-2 border-dashed border-[var(--border-color)] hover:border-[var(--border-focus)] transition-all bg-gradient-to-br from-[var(--bg-surface-subtle)] to-[var(--bg-surface)]"
                  >
                    {mainImageSrc ? (
                      <>
                        <img src={mainImageSrc} alt="Product" className="w-full h-full object-contain p-5" />
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                          <div className="flex items-center gap-2.5 bg-white/20 px-5 py-2.5 rounded-xl text-white text-[13px] font-medium backdrop-blur-sm">
                            <Camera className="h-4 w-4" />
                            Change Photo
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 group-hover:scale-105 transition-transform duration-300">
                        <div className="h-16 w-16 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shadow-lg">
                          <ImageIcon className="h-7 w-7 text-[var(--text-ghost)]" />
                        </div>
                        <div className="text-center">
                          <p className="text-[13px] font-medium text-[var(--text-dim)]">Upload Product Photo</p>
                          <p className="text-[11px] text-[var(--text-ghost)] mt-1">Click to browse or drag & drop</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Product Identity */}
                <div className="flex-1 flex flex-col justify-center gap-4">
                  {/* Product Name — prominent */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-2">Product Name *</label>
                    <input
                      type="text"
                      value={product.product_name}
                      onChange={(e) => {
                        const updates: Partial<ProductFormState> = { product_name: e.target.value };
                        if (!slugEdited) updates.slug = (e.target.value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                        updateProduct_(updates);
                      }}
                      placeholder="e.g. KX CoBot Pro"
                      className="w-full h-14 px-5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-lg md:text-xl font-bold text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
                    />
                  </div>

                  <div className="border-t border-[var(--border-subtle)]" />

                  {/* Brand + Family + Status */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={lbl}>
                        <span className="inline-flex items-center gap-1.5"><Star className="h-3 w-3" /> Brand</span>
                      </label>
                      <SelectWithCreate
                        value={product.brand}
                        options={brands.map(b => {
                          const slug = b.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                          return { value: b, label: b, icon: brandLogos[slug] || null };
                        })}
                        onChange={(val) => updateProduct_({ brand: val })}
                        onClickCreate={() => setShowBrandModal(true)}
                        placeholder="Select brand..."
                        createLabel="Create Brand"
                      />
                    </div>
                    <div>
                      <label className={lbl}>
                        <span className="inline-flex items-center gap-1.5"><Package className="h-3 w-3" /> Product Family / Series</span>
                      </label>
                      <input
                        type="text"
                        value={product.family}
                        onChange={(e) => updateProduct_({ family: e.target.value })}
                        placeholder="e.g. CoBot Series, Pro Line"
                        className={inp}
                      />
                    </div>
                    <div>
                      <label className={lbl}>
                        <span className="inline-flex items-center gap-1.5"><CircleDot className="h-3 w-3" /> Product Status</span>
                      </label>
                      <select
                        value={product.status}
                        onChange={(e) => updateProduct_({ status: e.target.value as ProductFormState["status"] })}
                        className={inp}
                      >
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className={lbl}>Tags</label>
                    <TagsInput
                      tags={product.tags}
                      onChange={(tags) => updateProduct_({ tags })}
                      suggestions={allTags}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Classification */}
            <Section id="classification" icon={<FolderTree className="h-4 w-4" />} title="Classification">
              <ClassificationSection
                data={product}
                onChange={updateProduct_}
                divisions={divisions}
                categories={categories}
                subcategories={subcategories}
                divisionLogos={divisionLogos}
                categoryLogos={categoryLogos}
                subcategoryLogos={subcategoryLogos}
                onClickCreateDivision={() => setShowDivisionModal(true)}
                onClickCreateCategory={() => setShowCategoryModal(true)}
                onClickCreateSubcategory={() => setShowSubcategoryModal(true)}
              />
            </Section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           STEP 2: PRODUCT INFORMATION
           ═══════════════════════════════════════════════════════════ */}
        {steps[currentStep]?.id === "details" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Classification summary breadcrumb */}
            {divisionName && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)]">
                <FolderTree className="h-3.5 w-3.5 text-[var(--text-ghost)]" />
                <span>{divisionName}</span>
                {categoryName && <><ChevronRight className="h-3 w-3 text-[var(--text-ghost)]" /><span>{categoryName}</span></>}
                {subcategoryName && <><ChevronRight className="h-3 w-3 text-[var(--text-ghost)]" /><span className="text-emerald-400 font-medium">{subcategoryName}</span></>}
              </div>
            )}

            {/* Basic Information */}
            <Section id="basic" icon={<FileText className="h-4 w-4" />} title="Basic Information">
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">Slug (URL Path)</label>
                    <input
                      type="text"
                      value={product.slug}
                      onChange={(e) => { setSlugEdited(true); updateProduct_({ slug: e.target.value }); }}
                      className={`${inp} font-mono text-[var(--text-muted)]`}
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">Level</label>
                    <select
                      value={product.level}
                      onChange={(e) => updateProduct_({ level: e.target.value })}
                      className={inp}
                    >
                      <option value="">Select level...</option>
                      {attrSuggestions.levels.length > 0
                        ? attrSuggestions.levels.map(l => (
                            <option key={l} value={l.toLowerCase()}>{l}</option>
                          ))
                        : <>
                            <option value="entry">Entry</option>
                            <option value="mid">Mid</option>
                            <option value="premium">Premium</option>
                            <option value="enterprise">Enterprise</option>
                          </>
                      }
                    </select>
                  </div>
                </div>

                {/* New fields row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">Country of Origin</label>
                    <input
                      type="text"
                      value={product.country_of_origin}
                      onChange={(e) => updateProduct_({ country_of_origin: e.target.value })}
                      placeholder="e.g. China, Japan, Taiwan"
                      className={inp}
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">MOQ (Min. Order Qty)</label>
                    <input
                      type="number"
                      value={product.moq}
                      onChange={(e) => updateProduct_({ moq: e.target.value })}
                      placeholder="e.g. 10"
                      className={inp}
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">Lead Time</label>
                    <input
                      type="text"
                      value={product.lead_time}
                      onChange={(e) => updateProduct_({ lead_time: e.target.value })}
                      placeholder="e.g. 7-14 days"
                      className={inp}
                    />
                  </div>
                </div>

                {/* Visibility toggles */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-3">
                    <label className="block text-[12px] font-medium text-[var(--text-subtle)]">Visibility</label>
                    <Toggle checked={product.visible} onChange={(v) => updateProduct_({ visible: v })} label="Visible on website" />
                    <Toggle checked={product.featured} onChange={(v) => updateProduct_({ featured: v })} label="Featured product" />
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[12px] font-medium text-[var(--text-subtle)]">Purchase Options</label>
                    <Toggle checked={product.supports_head_only} onChange={(v) => updateProduct_({ supports_head_only: v })} label="Supports head-only purchase" />
                    <Toggle checked={product.supports_complete_set} onChange={(v) => updateProduct_({ supports_complete_set: v })} label="Supports complete set purchase" />
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">Warranty</label>
                  <input
                    type="text"
                    value={product.warranty}
                    onChange={(e) => updateProduct_({ warranty: e.target.value })}
                    placeholder="e.g. 2 years parts & labor"
                    className={inp}
                  />
                </div>
              </div>
            </Section>

            {/* Description */}
            <Section id="description" icon={<FileText className="h-4 w-4" />} title="Description">
              <DescriptionSection data={product} onChange={updateProduct_} />
            </Section>

            {/* Generic Specifications (key-value) */}
            <Section id="specs" icon={<Wrench className="h-4 w-4" />} title="Additional Specifications" badge="key/value">
              <SpecsSection data={product} onChange={updateProduct_} />
            </Section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           STEP 3: SEWING MACHINE SPECS (conditional)
           ═══════════════════════════════════════════════════════════ */}
        {steps[currentStep]?.id === "sewing" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Classification summary */}
            {divisionName && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)]">
                <FolderTree className="h-3.5 w-3.5 text-[var(--text-ghost)]" />
                <span>{divisionName}</span>
                {categoryName && <><ChevronRight className="h-3 w-3 text-[var(--text-ghost)]" /><span>{categoryName}</span></>}
                {subcategoryName && <><ChevronRight className="h-3 w-3 text-[var(--text-ghost)]" /><span className="text-emerald-400 font-medium">{subcategoryName}</span></>}
              </div>
            )}

            <Section id="sewing" icon={<Settings2 className="h-4 w-4" />} title="Sewing Machine Specs" badge={sewingSpecs.template_slug ? sewingSpecs.template_slug.replace(/-/g, " ") : undefined}>
              <SewingMachineSection
                data={sewingSpecs}
                onChange={setSewingSpecs}
                subcategorySlug={product.subcategory_slug}
              />
            </Section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           STEP 4: MODELS & PRICING
           ═══════════════════════════════════════════════════════════ */}
        {steps[currentStep]?.id === "commercial" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Models & Variants — the commercial source of truth */}
            <Section id="models" icon={<Boxes className="h-4 w-4" />} title="Models & Variants" badge={`${models.length} model${models.length !== 1 ? "s" : ""}`}>
              <ModelsSection
                models={models}
                onChange={setModels}
                suppliers={suppliers}
                onClickCreateSupplier={(tempId) => { setSupplierTarget(tempId); setShowSupplierModal(true); }}
              />
            </Section>

            {/* Technical Details */}
            <Section id="technical" icon={<Zap className="h-4 w-4" />} title="Technical Details">
              <TechnicalSection data={product} onChange={updateProduct_} suggestions={attrSuggestions} />
            </Section>

            {/* Market Prices */}
            <Section id="prices" icon={<DollarSign className="h-4 w-4" />} title="Market Prices" defaultOpen={false}>
              <MarketPricesSection prices={prices} models={models} onChange={setPrices} />
            </Section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           STEP 5: MEDIA & FILES
           ═══════════════════════════════════════════════════════════ */}
        {steps[currentStep]?.id === "media" && (
          <div className="space-y-5 animate-in fade-in duration-300">
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
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           STEP 6: REVIEW & PUBLISH
           ═══════════════════════════════════════════════════════════ */}
        {steps[currentStep]?.id === "finalize" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Summary Card */}
            <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-6">
              <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-4">Product Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryItem label="Product" value={product.product_name || "—"} />
                <SummaryItem label="Brand" value={product.brand || "—"} />
                <SummaryItem label="Classification" value={subcategoryName || "—"} />
                <SummaryItem label="Status" value={<StatusBadge status={product.status} />} />
                <SummaryItem label="Models" value={`${models.length} variant${models.length !== 1 ? "s" : ""}`} />
                <SummaryItem label="Media Files" value={`${media.length} file${media.length !== 1 ? "s" : ""}`} />
                <SummaryItem label="Translations" value={`${translations.length} locale${translations.length !== 1 ? "s" : ""}`} />
                <SummaryItem label="Template" value={sewingSpecs.template_slug ? sewingSpecs.template_slug.replace(/-/g, " ") : "—"} />
              </div>
            </div>

            {/* Translations */}
            <Section id="translations" icon={<Languages className="h-4 w-4" />} title="Translations" defaultOpen={false}>
              <TranslationsSection translations={translations} onChange={setTranslations} />
            </Section>

            {/* Related Products */}
            <Section id="related" icon={<Link2 className="h-4 w-4" />} title="Related Products" defaultOpen={false}>
              <RelatedProductsSection related={related} onChange={setRelated} currentProductId={productId} />
            </Section>
          </div>
        )}

        {/* ═══ STEP NAVIGATION BUTTONS ═══ */}
        <div className="flex items-center justify-between mt-8 mb-4">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="h-10 px-5 rounded-xl border border-[var(--border-subtle)] text-[13px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Previous
          </button>

          <div className="text-[11px] text-[var(--text-ghost)]">
            Step {currentStep + 1} of {steps.length}
          </div>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={handleNext}
              className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all flex items-center gap-2 shadow-lg"
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={save}
              disabled={saving}
              className="h-10 px-6 rounded-xl bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-500 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : "Save & Publish"}
            </button>
          )}
        </div>

        <div className="h-12" />
      </div>

      {/* ═══ CREATE MODALS ═══ */}
      <CreateDivisionModal
        open={showDivisionModal}
        onClose={() => setShowDivisionModal(false)}
        onCreated={(row) => {
          setDivisions(prev => [...prev, row]);
          updateProduct_({ division_slug: row.slug, category_slug: "", subcategory_slug: "" });
        }}
        existingCount={divisions.length}
      />

      <CreateCategoryModal
        open={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onCreated={(row) => {
          setCategories(prev => [...prev, row]);
          updateProduct_({ category_slug: row.slug, subcategory_slug: "" });
        }}
        divisionId={divisions.find(d => d.slug === product.division_slug)?.id || ""}
        divisionName={divisions.find(d => d.slug === product.division_slug)?.name || ""}
        existingCount={categories.length}
      />

      <CreateSubcategoryModal
        open={showSubcategoryModal}
        onClose={() => setShowSubcategoryModal(false)}
        onCreated={(row) => {
          setSubcategories(prev => [...prev, row]);
          updateProduct_({ subcategory_slug: row.slug });
        }}
        categoryId={categories.find(c => c.slug === product.category_slug)?.id || ""}
        categoryName={categories.find(c => c.slug === product.category_slug)?.name || ""}
        divisionName={divisions.find(d => d.slug === product.division_slug)?.name || ""}
        existingCount={subcategories.length}
      />

      <CreateSupplierModal
        open={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        onCreated={(supplier) => {
          setSuppliers(prev => [...prev, { ...supplier, logo: supplier.logo || null }].sort((a, b) => a.name.localeCompare(b.name)));
          if (supplierTarget !== "hero") {
            setModels(prev => prev.map(m => m._tempId === supplierTarget ? { ...m, supplier: supplier.name } : m));
          }
        }}
      />

      <CreateBrandModal
        open={showBrandModal}
        onClose={() => setShowBrandModal(false)}
        onCreated={(brandName, logoUrl) => {
          setBrands(prev => [...new Set([...prev, brandName])].sort());
          if (logoUrl) {
            const slug = brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            setBrandLogos(prev => ({ ...prev, [slug]: logoUrl }));
          }
          updateProduct_({ brand: brandName });
        }}
        existingBrands={brands}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SUMMARY ITEM — for review step
   ═══════════════════════════════════════════════════════════════════ */
function SummaryItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-[var(--bg-surface-subtle)] rounded-xl px-4 py-3 border border-[var(--border-subtle)]">
      <div className="text-[10px] font-semibold text-[var(--text-ghost)] uppercase tracking-wider mb-1">{label}</div>
      <div className="text-[13px] text-[var(--text-primary)] font-medium truncate">{value}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAGS INPUT — with suggestions dropdown
   ═══════════════════════════════════════════════════════════════════ */
function TagsInput({ tags, onChange, suggestions = [] }: { tags: string[]; onChange: (t: string[]) => void; suggestions?: string[] }) {
  const [input, setInput] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const available = suggestions.filter(s => !tags.includes(s));
  const filtered = input.trim()
    ? available.filter(s => s.toLowerCase().includes(input.toLowerCase()))
    : available;
  const canCreate = input.trim() && !suggestions.includes(input.trim().toLowerCase()) && !tags.includes(input.trim().toLowerCase());

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      onChange([...tags, t]);
    }
    setInput("");
    setShowDropdown(false);
  };

  return (
    <div ref={wrapperRef}>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-muted)]">
              {tag}
              <button onClick={() => onChange(tags.filter(t => t !== tag))} className="text-[var(--text-ghost)] hover:text-red-400 ml-0.5 transition-colors">
                <span className="text-[10px]">&times;</span>
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(input); } }}
          placeholder="Type or choose tags..."
          className="w-full h-11 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
        />
        {showDropdown && (filtered.length > 0 || canCreate) && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl shadow-2xl shadow-black/30 overflow-hidden max-h-[200px] overflow-y-auto py-1">
            {filtered.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => addTag(s)}
                className="w-full px-4 py-2 text-left text-[13px] text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
              >
                {s}
              </button>
            ))}
            {canCreate && (
              <button
                type="button"
                onClick={() => addTag(input)}
                className="w-full px-4 py-2 text-left text-[12px] font-medium text-blue-400 hover:bg-blue-500/10 flex items-center gap-2 border-t border-[var(--border-subtle)] transition-colors"
              >
                <span className="h-4 w-4 rounded bg-blue-500/20 flex items-center justify-center text-[10px]">+</span>
                Create &quot;{input.trim()}&quot;
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
