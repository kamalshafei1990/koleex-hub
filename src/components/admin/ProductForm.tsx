"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import DiskIcon from "@/components/icons/ui/DiskIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CameraIcon from "@/components/icons/ui/CameraIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import FolderTreeIcon from "@/components/icons/ui/FolderTreeIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import WrenchIcon from "@/components/icons/ui/WrenchIcon";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
import DollarSignIcon from "@/components/icons/ui/DollarSignIcon";
import LanguagesIcon from "@/components/icons/ui/LanguagesIcon";
import Link2Icon from "@/components/icons/ui/Link2Icon";
import ZapIcon from "@/components/icons/ui/ZapIcon";
import Settings2Icon from "@/components/icons/ui/Settings2Icon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import StarIcon from "@/components/icons/ui/StarIcon";
import ArrowRightIcon from "@/components/icons/ui/ArrowRightIcon";
import CircleDotIcon from "@/components/icons/ui/CircleDotIcon";
import FactoryIcon from "@/components/icons/ui/FactoryIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import LockIcon from "@/components/icons/ui/LockIcon";
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
import { EMPTY_PRODUCT, createEmptyModel, COUNTRIES } from "@/types/product-form";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import EyeOffIcon from "@/components/icons/ui/EyeOffIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";

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
import BarcodeQRDisplay from "./form-sections/BarcodeQRDisplay";
import { isSewingMachineSubcategory } from "@/lib/sewing-machine-templates";
import { slugify } from "@/types/product-form";

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
        <AngleDownIcon className={`h-4 w-4 text-[var(--text-ghost)] transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
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
  /* Machine Kind used to be its own step (id: "machine-type") but
     it's really a 4th-tier classification decision — Division →
     Category → Subcategory → Kind — so it now lives INSIDE the
     Classify step. Keeping the wizard at 7 / 8 steps instead of
     8 / 9 and aligning the admin's mental model with how customers
     browse the catalog. */
  const steps: WizardStep[] = [
    { id: "classify", label: "Classification", shortLabel: "Classify", icon: <FolderTreeIcon className="h-4 w-4" /> },
    { id: "identity", label: "Hero & Identity", shortLabel: "Hero", icon: <SparklesIcon className="h-4 w-4" /> },
    { id: "description", label: "Description", shortLabel: "Description", icon: <DocumentIcon className="h-4 w-4" /> },
  ];
  if (isSewing) {
    steps.push({ id: "sewing-specs", label: "Machine Specs", shortLabel: "Specs", icon: <Settings2Icon className="h-4 w-4" />, conditional: true });
  }
  steps.push(
    { id: "commercial", label: "Models & Variants", shortLabel: "Models", icon: <BoxesIcon className="h-4 w-4" /> },
    { id: "technical", label: "Technical Details", shortLabel: "Technical", icon: <ZapIcon className="h-4 w-4" /> },
    { id: "media", label: "Media & Files", shortLabel: "Media", icon: <ImageRawIcon className="h-4 w-4" /> },
    { id: "finalize", label: "Review & Publish", shortLabel: "Review", icon: <CheckIcon className="h-4 w-4" /> },
  );
  return steps;
}

/* ═══════════════════════════════════════════════════════════════════
   STEP NAVIGATION BAR
   ═══════════════════════════════════════════════════════════════════ */
function StepNav({ steps, currentStep, onStepChange, completedSteps, lockedSteps }: {
  steps: WizardStep[];
  currentStep: number;
  onStepChange: (i: number) => void;
  completedSteps: Set<number>;
  lockedSteps?: Set<number>;
}) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] px-2 py-2 mb-6">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {steps.map((step, i) => {
          const isActive = i === currentStep;
          const isCompleted = completedSteps.has(i);
          const isPast = i < currentStep;
          const isLocked = !!lockedSteps?.has(i);
          return (
            <button
              key={step.id}
              onClick={() => { if (!isLocked) onStepChange(i); }}
              disabled={isLocked}
              title={isLocked ? "Complete classification first" : step.label}
              className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-medium transition-all shrink-0 ${
                isLocked
                  ? "text-[var(--text-ghost)]/60 cursor-not-allowed"
                  : isActive
                  ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] shadow-lg"
                  : isPast || isCompleted
                  ? "text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)]"
                  : "text-[var(--text-ghost)] hover:text-[var(--text-dim)] hover:bg-[var(--bg-surface-subtle)]"
              }`}
            >
              <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                isLocked ? "bg-[var(--bg-surface)]/60 text-[var(--text-ghost)]/50" :
                isActive ? "bg-white/20" :
                isCompleted ? "bg-emerald-500/20 text-emerald-400" :
                "bg-[var(--bg-surface)] text-[var(--text-ghost)]"
              }`}>
                {isLocked ? <LockIcon className="h-3 w-3" /> : (isCompleted && !isActive ? <CheckIcon className="h-3 w-3" /> : i + 1)}
              </div>
              <span className="hidden md:inline">{step.shortLabel}</span>
              {i < steps.length - 1 && (
                <AngleRightIcon className="h-3 w-3 text-[var(--text-ghost)] ml-1 hidden lg:block" />
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
        className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${checked ? "bg-emerald-500" : "bg-zinc-600"}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-5" : ""}`} />
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
      <CircleDotIcon className="h-2.5 w-2.5" />
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
          excerpt: p.excerpt || "",
          highlights: p.highlights || [],
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

  /* ── Primary model helpers (shown in Hero) ── */
  const primaryModel = models[0];
  const updatePrimaryModel = useCallback((updates: Partial<ModelFormState>) => {
    setModels(prev => {
      if (prev.length === 0) {
        return [{ ...createEmptyModel(), ...updates, order: 0 }];
      }
      const next = [...prev];
      next[0] = { ...next[0], ...updates };
      return next;
    });
  }, []);

  /* ── Classification-gated lock ──
     For sewing products, classification now includes the machine
     kind (the 4th tier inside Classify). For everything else it's
     still Division → Category → Subcategory. The kind slug rides
     inside sewingSpecs.common_specs.machine_kind; template_slug is
     kept as a back-compat fallback for products saved before the
     kind selector shipped. */
  const machineKindChosen =
    !!(sewingSpecs.common_specs as { machine_kind?: string })?.machine_kind ||
    !!sewingSpecs.template_slug;

  const classificationComplete =
    !!product.division_slug &&
    !!product.category_slug &&
    !!product.subcategory_slug &&
    (!isSewing || machineKindChosen);

  const lockedSteps = useMemo(() => {
    const set = new Set<number>();
    steps.forEach((s, i) => {
      // Everything after classify is locked until classification is complete
      if (s.id !== "classify" && !classificationComplete) set.add(i);
    });
    return set;
  }, [steps, classificationComplete]);

  /* ── Step navigation ── */
  const goToStep = (idx: number) => {
    const safeIdx = Math.max(0, Math.min(idx, steps.length - 1));
    if (lockedSteps.has(safeIdx)) {
      const target = steps[safeIdx];
      if (target?.id === "sewing-specs") {
        setError("Select a machine type before entering specs");
      } else {
        setError("Complete the classification first to unlock this step");
      }
      return;
    }
    // Mark current step as completed when moving forward
    if (safeIdx > currentStep) {
      setCompletedSteps(prev => new Set([...prev, currentStep]));
    }
    setError("");
    setCurrentStep(safeIdx);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const nextStep = () => goToStep(currentStep + 1);
  const prevStep = () => goToStep(currentStep - 1);

  /* ── Validation per step ── */
  const validateCurrentStep = (): string | null => {
    const stepId = steps[currentStep]?.id;
    if (stepId === "classify") {
      if (!product.division_slug || !product.category_slug || !product.subcategory_slug)
        return "Pick division, category and subcategory before continuing";
      /* Machine kind is the 4th classification tier for sewing
         products — don't let the admin leave Classify without it. */
      if (isSewing && !machineKindChosen)
        return "Pick a machine kind to finish classification";
    }
    if (stepId === "identity") {
      if (!product.product_name.trim()) return "Product name is required";
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
        excerpt: product.excerpt || null,
        highlights: product.highlights,
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
        <SpinnerIcon className="h-6 w-6 text-[var(--text-dim)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="w-full px-4 md:px-8 lg:px-12 xl:px-16 py-6 md:py-8">

        {/* ═══ INLINE HEADER — matches AccountForm / EmployeeWizard style ═══ */}
        <div className="flex items-center justify-between mb-6 md:mb-8 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/products"
              className="h-9 w-9 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all shrink-0"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-[26px] font-bold text-[var(--text-primary)] truncate">
                  {product.product_name || "New Product"}
                </h1>
                {product.product_name && <StatusBadge status={product.status} />}
              </div>
              <p className="text-[12px] md:text-[13px] text-[var(--text-dim)] mt-0.5">
                {product.product_name
                  ? "Edit product details."
                  : "Create a new product in your catalogue."}
              </p>
            </div>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="h-9 px-4 md:px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shrink-0"
          >
            {saving ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <DiskIcon className="h-4 w-4" />}
            <span className="hidden sm:inline">{saving ? "Saving..." : "Save Product"}</span>
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[13px] text-red-400 flex items-center gap-2">
            <TriangleWarningIcon className="h-4 w-4 shrink-0" /> {error}
            <button onClick={() => setError("")} className="ml-auto text-red-400/50 hover:text-red-400">×</button>
          </div>
        )}
        {success && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[13px] text-emerald-400 flex items-center gap-2">
            <CheckIcon className="h-4 w-4 shrink-0" /> {success}
          </div>
        )}

        {/* ═══ STEP NAVIGATION ═══ */}
        <StepNav
          steps={steps}
          currentStep={currentStep}
          onStepChange={goToStep}
          completedSteps={completedSteps}
          lockedSteps={lockedSteps}
        />

        {/* ═══ GLOBAL CLASSIFICATION BREADCRUMB (shown once classification is set, across all steps) ═══ */}
        {divisionName && steps[currentStep]?.id !== "classify" && (
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-ghost)] mb-4 px-1">
            <span className="font-bold uppercase tracking-wider text-[var(--text-dim)]">Classification:</span>
            <span>{divisionName}</span>
            {categoryName && <><AngleRightIcon className="h-3 w-3" /><span>{categoryName}</span></>}
            {subcategoryName && <><AngleRightIcon className="h-3 w-3" /><span className="text-emerald-400 font-medium">{subcategoryName}</span></>}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           STEP: HERO (identity + primary model)
           ═══════════════════════════════════════════════════════════ */}
        {steps[currentStep]?.id === "identity" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* ═══ HERO CARD ═══
                    overflow-visible (not hidden) so the SelectWithCreate
                    dropdowns inside the Primary Commercial strip —
                    Supplier, Brand — can render OUTSIDE the card bounds
                    instead of being clipped behind it. Nothing inside
                    the card actually overflows visually, so there's no
                    cost to turning clipping off here. */}
            <div className="bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-surface-subtle)]/40 rounded-3xl border border-[var(--border-subtle)] overflow-visible shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
                {/* Left: Main Product Image (2/5 width) */}
                <div className="lg:col-span-2 p-6 md:p-8 lg:border-r lg:border-[var(--border-subtle)] flex flex-col">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-6 w-6 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center">
                      <CameraIcon className="h-3 w-3 text-[var(--text-ghost)]" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">Main Product Photo</span>
                  </div>

                  <input
                    ref={mainImageRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleMainImage(e.target.files)}
                  />
                  <div
                    onClick={() => mainImageRef.current?.click()}
                    className="relative w-full aspect-square rounded-2xl overflow-hidden cursor-pointer group border-2 border-dashed border-[var(--border-subtle)] hover:border-[var(--border-focus)] transition-all bg-gradient-to-br from-[var(--bg-surface-subtle)] to-[var(--bg-surface)] flex-1"
                  >
                    {mainImageSrc ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={mainImageSrc} alt="Product" className="w-full h-full object-contain p-6" />
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                          <div className="flex items-center gap-2.5 bg-white/20 px-5 py-2.5 rounded-xl text-white text-[13px] font-medium backdrop-blur-sm">
                            <CameraIcon className="h-4 w-4" />
                            Change Photo
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 group-hover:scale-105 transition-transform duration-300">
                        <div className="h-20 w-20 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shadow-lg">
                          <ImageRawIcon className="h-9 w-9 text-[var(--text-ghost)]" />
                        </div>
                        <div className="text-center">
                          <p className="text-[14px] font-semibold text-[var(--text-dim)]">Upload Product Photo</p>
                          <p className="text-[11px] text-[var(--text-ghost)] mt-1">Click to browse or drag &amp; drop</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Product Identity (3/5 width) */}
                <div className="lg:col-span-3 p-6 md:p-8 flex flex-col justify-center gap-5">
                  {/* ── Top control row: Status · Featured · Visible · Level ──
                        Publishing controls live in the hero instead of
                        being buried in the Technical step. Admins can
                        see at a glance whether the product will show
                        up on the site and where it ranks. */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Status pills — 3-way toggle (Draft / Active / Archived) */}
                    <div className="flex gap-1 p-0.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
                      {([
                        { v: "draft", label: "Draft", cls: "text-amber-400 bg-amber-400/15" },
                        { v: "active", label: "Active", cls: "text-emerald-400 bg-emerald-400/15" },
                        { v: "archived", label: "Archived", cls: "text-red-400 bg-red-400/15" },
                      ] as const).map(s => {
                        const active = product.status === s.v;
                        return (
                          <button
                            key={s.v}
                            type="button"
                            onClick={() => updateProduct_({ status: s.v as ProductFormState["status"] })}
                            className={`h-7 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                              active ? s.cls : "text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                            }`}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Featured toggle — hero decision, not buried in Technical */}
                    <button
                      type="button"
                      onClick={() => updateProduct_({ featured: !product.featured })}
                      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold border transition-all ${
                        product.featured
                          ? "bg-amber-500/15 text-amber-400 border-amber-500/40"
                          : "bg-[var(--bg-surface-subtle)] text-[var(--text-dim)] border-[var(--border-subtle)] hover:text-[var(--text-muted)]"
                      }`}
                      title={product.featured ? "Featured on homepage" : "Click to feature on homepage"}
                    >
                      <StarIcon className="h-3 w-3" />
                      {product.featured ? "Featured" : "Feature"}
                    </button>

                    {/* Visibility toggle — gatekeeper for whether this
                        appears on the public catalog at all. Drafts
                        stay hidden regardless; Active + Visible = live. */}
                    <button
                      type="button"
                      onClick={() => updateProduct_({ visible: !product.visible })}
                      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold border transition-all ${
                        product.visible
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
                          : "bg-[var(--bg-surface-subtle)] text-[var(--text-dim)] border-[var(--border-subtle)] hover:text-[var(--text-muted)]"
                      }`}
                      title={product.visible ? "Visible on public catalog" : "Hidden from public catalog"}
                    >
                      {product.visible ? <EyeIcon className="h-3 w-3" /> : <EyeOffIcon className="h-3 w-3" />}
                      {product.visible ? "Visible" : "Hidden"}
                    </button>

                    {/* Level pills — shopper-facing tier. Drives price
                        tier + catalog filtering. */}
                    <div className="flex items-center gap-1 ml-auto">
                      {([
                        { v: "entry", label: "Entry", cls: "text-blue-400 bg-blue-500/15 border-blue-500/40" },
                        { v: "mid", label: "Mid", cls: "text-emerald-400 bg-emerald-500/15 border-emerald-500/40" },
                        { v: "premium", label: "Premium", cls: "text-amber-400 bg-amber-500/15 border-amber-500/40" },
                        { v: "enterprise", label: "Enterprise", cls: "text-purple-400 bg-purple-500/15 border-purple-500/40" },
                      ] as const).map(l => {
                        const active = product.level === l.v;
                        return (
                          <button
                            key={l.v}
                            type="button"
                            onClick={() => updateProduct_({ level: active ? "" : l.v })}
                            className={`h-7 px-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
                              active ? l.cls : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                            }`}
                          >
                            {l.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Product Name — XL prominent */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[10px] font-bold text-[var(--text-ghost)] uppercase tracking-wider">Product Name *</label>
                      {product.product_name && (
                        <span className="text-[10px] text-[var(--text-ghost)]">
                          {product.product_name.length} chars
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={product.product_name}
                      onChange={(e) => {
                        const updates: Partial<ProductFormState> = { product_name: e.target.value };
                        if (!slugEdited) updates.slug = slugify(e.target.value);
                        updateProduct_(updates);
                      }}
                      placeholder="e.g. KX Lockstitch Industrial 9500"
                      className="w-full h-14 px-5 rounded-xl bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-xl md:text-2xl font-bold text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
                    />
                  </div>

                  {/* Tagline — the one-liner shown directly under the
                      product name on the public hero. Biggest single
                      piece of marketing copy on the whole product
                      page. Lives on the primary model (each model can
                      have its own tagline) but surfaced here so the
                      admin isn't hunting for it in Models. */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[10px] font-bold text-[var(--text-ghost)] uppercase tracking-wider">
                        <span className="inline-flex items-center gap-1.5"><SparklesIcon className="h-3 w-3" /> Tagline</span>
                      </label>
                      <span className="text-[10px] text-[var(--text-ghost)]">
                        {(primaryModel?.tagline || "").length} / 80 · shown big on public page
                      </span>
                    </div>
                    <input
                      type="text"
                      value={primaryModel?.tagline || ""}
                      onChange={(e) => updatePrimaryModel({ tagline: e.target.value })}
                      placeholder="e.g. Precision jetted pockets at 3-second cycle."
                      maxLength={140}
                      className="w-full h-12 px-5 rounded-xl bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-all"
                    />
                  </div>

                  {/* Primary Model Name */}
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-ghost)] uppercase tracking-wider mb-2">
                      <span className="inline-flex items-center gap-1.5"><TagsIcon className="h-3 w-3" /> Primary Model</span>
                    </label>
                    <input
                      type="text"
                      value={primaryModel?.model_name || ""}
                      onChange={(e) => updatePrimaryModel({ model_name: e.target.value, slug: slugify(e.target.value) })}
                      placeholder="e.g. KX-9500-D"
                      className="w-full h-12 px-5 rounded-xl bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[15px] font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-all"
                    />
                  </div>

                  {/* Slug / URL preview — SEO-friendly URL that can be
                      edited. Auto-syncs from product name until the
                      admin manually edits it, then stays fixed. */}
                  <SlugEditor
                    slug={product.slug}
                    onChange={(v) => {
                      setSlugEdited(true);
                      updateProduct_({ slug: slugify(v) });
                    }}
                    onResetToAuto={() => {
                      setSlugEdited(false);
                      updateProduct_({ slug: slugify(product.product_name) });
                    }}
                  />

                  {/* Brand · Family · Origin · Warranty */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div>
                      <label className={lbl}>
                        <span className="inline-flex items-center gap-1.5"><StarIcon className="h-3 w-3" /> Brand</span>
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
                        <span className="inline-flex items-center gap-1.5"><PackageIcon className="h-3 w-3" /> Family / Series</span>
                      </label>
                      <input
                        type="text"
                        value={product.family}
                        onChange={(e) => updateProduct_({ family: e.target.value })}
                        placeholder="e.g. Pro Line"
                        className={inp}
                      />
                    </div>
                    <div>
                      <label className={lbl}>
                        <span className="inline-flex items-center gap-1.5"><GlobeIcon className="h-3 w-3" /> Made in</span>
                      </label>
                      <select
                        value={product.country_of_origin}
                        onChange={(e) => updateProduct_({ country_of_origin: e.target.value })}
                        className={inp}
                      >
                        <option value="">—</option>
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>
                        <span className="inline-flex items-center gap-1.5"><ShieldCheckIcon className="h-3 w-3" /> Warranty</span>
                      </label>
                      <input
                        type="text"
                        value={product.warranty}
                        onChange={(e) => updateProduct_({ warranty: e.target.value })}
                        placeholder="e.g. 2 years"
                        className={inp}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ═══ PRIMARY MODEL COMMERCIAL STRIP ═══ */}
              <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-primary)]/30 px-6 md:px-8 py-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-6 w-6 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center">
                    <DollarSignIcon className="h-3 w-3 text-[var(--text-ghost)]" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">Primary Commercial · Supplier &amp; Pricing</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className={lbl}>
                      <span className="inline-flex items-center gap-1.5"><FactoryIcon className="h-3 w-3" /> Supplier</span>
                    </label>
                    <SelectWithCreate
                      value={primaryModel?.supplier || ""}
                      options={suppliers.map(s => ({ value: s.name, label: s.name, icon: s.logo }))}
                      onChange={(val) => updatePrimaryModel({ supplier: val })}
                      onClickCreate={() => { setSupplierTarget("hero"); setShowSupplierModal(true); }}
                      placeholder="Select supplier..."
                      createLabel="Create Supplier"
                    />
                  </div>
                  <div>
                    <label className={lbl}>Supplier Model</label>
                    <input
                      type="text"
                      value={primaryModel?.reference_model || ""}
                      onChange={(e) => updatePrimaryModel({ reference_model: e.target.value })}
                      placeholder="Factory model code"
                      className={inp}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Cost Price (USD)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-[var(--text-ghost)]">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={primaryModel?.cost_price || ""}
                        onChange={(e) => updatePrimaryModel({ cost_price: e.target.value })}
                        placeholder="0.00"
                        className={`${inp} pl-8`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Global Selling Price (USD)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-[var(--text-ghost)]">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={primaryModel?.global_price || ""}
                        onChange={(e) => updatePrimaryModel({ global_price: e.target.value })}
                        placeholder="0.00"
                        className={`${inp} pl-8`}
                      />
                    </div>
                  </div>
                </div>

                {/* Auto-generated codes for the primary model */}
                {primaryModel?.model_name && (
                  <div className="mt-5 pt-5 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">Auto-Generated Codes</span>
                    </div>
                    <BarcodeQRDisplay
                      value={primaryModel.barcode || primaryModel.slug || primaryModel.model_name}
                      label={primaryModel.model_name}
                      qrPayload={JSON.stringify({ sku: primaryModel.slug, name: primaryModel.model_name, ref: primaryModel.reference_model })}
                      compact
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ── Short description (excerpt) ──
                  One or two sentences used on product cards in the
                  catalog, SEO meta descriptions, and quote emails.
                  Separate from the long rich-text Description step. */}
            <Section
              id="excerpt"
              icon={<DocumentIcon className="h-4 w-4" />}
              title="Short Description"
              badge="Cards · SEO · Quotes"
            >
              <div>
                <textarea
                  value={product.excerpt}
                  onChange={(e) => updateProduct_({ excerpt: e.target.value })}
                  placeholder="One or two sentences that summarise this product — shown on product cards and used as the SEO meta description."
                  rows={3}
                  maxLength={320}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-all resize-none"
                />
                <p className="text-[10px] text-[var(--text-ghost)] mt-1.5 flex items-center justify-between">
                  <span>Aim for under 160 characters for best SEO display.</span>
                  <span>{product.excerpt.length} / 320</span>
                </p>
              </div>
            </Section>

            {/* ── Key highlights ──
                  3-5 short bullet strings displayed on the public
                  product hero ("Max 5000 SPM", "Auto trimmer",
                  "2-year warranty"). Kept deliberately simple —
                  no rich text, just short punchy phrases. */}
            <Section
              id="highlights"
              icon={<StarIcon className="h-4 w-4" />}
              title="Key Highlights"
              badge={`${product.highlights.length} / 5`}
            >
              <HighlightsEditor
                highlights={product.highlights}
                onChange={(highlights) => updateProduct_({ highlights })}
              />
            </Section>

            {/* Tags */}
            <Section id="tags" icon={<TagsIcon className="h-4 w-4" />} title="Tags & Keywords">
              <TagsInput
                tags={product.tags}
                onChange={(tags) => updateProduct_({ tags })}
                suggestions={allTags}
              />
            </Section>

            {/* ── Preview as customer ──
                  Opens the public product detail page in a new tab
                  so the admin can sanity-check how the product will
                  render before publishing. Only clickable once a
                  slug exists (and the product has been saved — on a
                  fresh new product, this opens a 404, so we dim it
                  until there's a slug to navigate to). */}
            {product.slug && (
              <div className="flex justify-end">
                <a
                  href={`/products/${product.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all"
                >
                  <ExternalLinkIcon className="h-3.5 w-3.5" />
                  Preview as customer
                </a>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           STEP 2: CLASSIFICATION
           ═══════════════════════════════════════════════════════════ */}
        {steps[currentStep]?.id === "classify" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <Section
              id="classification"
              icon={<FolderTreeIcon className="h-4 w-4" />}
              title="Classification"
              badge={isSewing ? "Division · Category · Subcategory · Kind" : "Division · Category · Subcategory"}
            >
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
                /* 4th classification tier: machine kind for sewing
                   products. ClassificationSection only renders the
                   kind step when the subcategory has kinds in the
                   catalog AND onMachineKindChange is wired. */
                machineKindSlug={
                  (sewingSpecs.common_specs as { machine_kind?: string })?.machine_kind || ""
                }
                onMachineKindChange={(kind) => {
                  /* Empty-slug kind = "clear the kind" (breadcrumb
                     chip was clicked). Reset machine_kind and keep
                     template_specs shape since we're not switching
                     to a new template. */
                  if (!kind.slug) {
                    setSewingSpecs({
                      ...sewingSpecs,
                      common_specs: {
                        ...sewingSpecs.common_specs,
                        machine_kind: "",
                      },
                    });
                    return;
                  }
                  const templateChanged = kind.templateSlug !== sewingSpecs.template_slug;
                  setSewingSpecs({
                    ...sewingSpecs,
                    template_slug: kind.templateSlug,
                    template_specs: templateChanged ? {} : sewingSpecs.template_specs,
                    common_specs: {
                      ...sewingSpecs.common_specs,
                      machine_kind: kind.slug,
                    },
                  });
                }}
              />
            </Section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           STEP 3 (maybe): DESCRIPTION (rich text)
           ═══════════════════════════════════════════════════════════ */}
        {steps[currentStep]?.id === "description" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {divisionName && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)]">
                <FolderTreeIcon className="h-3.5 w-3.5 text-[var(--text-ghost)]" />
                <span>{divisionName}</span>
                {categoryName && <><AngleRightIcon className="h-3 w-3 text-[var(--text-ghost)]" /><span>{categoryName}</span></>}
                {subcategoryName && <><AngleRightIcon className="h-3 w-3 text-[var(--text-ghost)]" /><span className="text-emerald-400 font-medium">{subcategoryName}</span></>}
              </div>
            )}

            <Section id="description" icon={<DocumentIcon className="h-4 w-4" />} title="Product Description" badge="Rich text">
              <DescriptionSection data={product} onChange={updateProduct_} />
            </Section>

            {/* Additional text specs (key/value) */}
            <Section id="specs" icon={<WrenchIcon className="h-4 w-4" />} title="Additional Specifications" badge="Key/value" defaultOpen={false}>
              <SpecsSection data={product} onChange={updateProduct_} />
            </Section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           STEP: SEWING MACHINE SPECS (conditional — after description)
           Machine Type is now a 4th tier inside the Classify step,
           so this step only renders the dynamic spec fields driven
           by the template the kind chose.
           ═══════════════════════════════════════════════════════════ */}
        {steps[currentStep]?.id === "sewing-specs" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <Section id="sewing" icon={<Settings2Icon className="h-4 w-4" />} title="Machine Specs" badge={sewingSpecs.template_slug ? sewingSpecs.template_slug.replace(/-/g, " ") : undefined}>
              <SewingMachineSection
                data={sewingSpecs}
                onChange={setSewingSpecs}
                subcategorySlug={product.subcategory_slug}
                mode="specs"
              />
            </Section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           STEP N: TECHNICAL DETAILS
           ═══════════════════════════════════════════════════════════ */}
        {steps[currentStep]?.id === "technical" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <Section id="technical" icon={<ZapIcon className="h-4 w-4" />} title="Technical Details" badge="Electrical · Physical">
              <TechnicalSection data={product} onChange={updateProduct_} suggestions={attrSuggestions} />
            </Section>

            {/* Configuration */}
            <Section id="config" icon={<Settings2Icon className="h-4 w-4" />} title="Configuration & Options">
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="block text-[11px] font-bold text-[var(--text-ghost)] uppercase tracking-wider">Website Visibility</label>
                    <Toggle checked={product.visible} onChange={(v) => updateProduct_({ visible: v })} label="Visible on public catalog" />
                    <Toggle checked={product.featured} onChange={(v) => updateProduct_({ featured: v })} label="Featured on homepage" />
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[11px] font-bold text-[var(--text-ghost)] uppercase tracking-wider">Purchase Options</label>
                    <Toggle checked={product.supports_head_only} onChange={(v) => updateProduct_({ supports_head_only: v })} label="Supports head-only purchase" />
                    <Toggle checked={product.supports_complete_set} onChange={(v) => updateProduct_({ supports_complete_set: v })} label="Supports complete set purchase" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Warranty</label>
                    <input
                      type="text"
                      value={product.warranty}
                      onChange={(e) => updateProduct_({ warranty: e.target.value })}
                      placeholder="e.g. 2 years parts &amp; labor"
                      className={inp}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Level</label>
                    <div className="flex flex-wrap gap-1.5">
                      {(attrSuggestions.levels.length > 0
                        ? attrSuggestions.levels.map(l => ({ value: l.toLowerCase(), label: l }))
                        : [
                            { value: "entry", label: "Entry" },
                            { value: "mid", label: "Mid" },
                            { value: "premium", label: "Premium" },
                            { value: "enterprise", label: "Enterprise" },
                          ]
                      ).map(({ value, label }) => {
                        const active = product.level === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => updateProduct_({ level: active ? "" : value })}
                            className={`px-3 h-9 rounded-xl border text-[11px] font-bold uppercase tracking-wider transition-all ${
                              active
                                ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                                : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)]"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            {/* Advanced / Internal — collapsed by default */}
            <Section id="advanced" icon={<WrenchIcon className="h-4 w-4" />} title="Advanced · Internal Only" badge="MOQ · Lead Time · Slug" defaultOpen={false}>
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Slug (URL Path)</label>
                    <input
                      type="text"
                      value={product.slug}
                      onChange={(e) => { setSlugEdited(true); updateProduct_({ slug: e.target.value }); }}
                      className={`${inp} font-mono text-[var(--text-muted)]`}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Country of Origin</label>
                    <input
                      type="text"
                      value={product.country_of_origin}
                      onChange={(e) => updateProduct_({ country_of_origin: e.target.value })}
                      placeholder="e.g. China, Japan"
                      className={inp}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Default MOQ (Product-level)</label>
                    <input
                      type="number"
                      value={product.moq}
                      onChange={(e) => updateProduct_({ moq: e.target.value })}
                      placeholder="e.g. 10"
                      className={inp}
                    />
                    <p className="text-[10px] text-[var(--text-ghost)] mt-1">Can be overridden per model</p>
                  </div>
                  <div>
                    <label className={lbl}>Default Lead Time</label>
                    <input
                      type="text"
                      value={product.lead_time}
                      onChange={(e) => updateProduct_({ lead_time: e.target.value })}
                      placeholder="e.g. 7-14 days"
                      className={inp}
                    />
                  </div>
                </div>
              </div>
            </Section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           STEP N: MODELS & VARIANTS
           ═══════════════════════════════════════════════════════════ */}
        {steps[currentStep]?.id === "commercial" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Primary model summary reminder */}
            {primaryModel && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <StarIcon className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[var(--text-primary)]">Primary Model: {primaryModel.model_name || "(unnamed)"}</div>
                  <div className="text-[10px] text-[var(--text-ghost)]">Identity &amp; pricing entered in the Hero. Add additional variants below when needed.</div>
                </div>
              </div>
            )}

            <Section
              id="models"
              icon={<BoxesIcon className="h-4 w-4" />}
              title="Models &amp; Variants"
              badge={`${models.length} model${models.length !== 1 ? "s" : ""}`}
            >
              <ModelsSection
                models={models}
                onChange={setModels}
                suppliers={suppliers}
                onClickCreateSupplier={(tempId) => { setSupplierTarget(tempId); setShowSupplierModal(true); }}
                hidePrimary={false}
              />
            </Section>

            {/* Market Prices */}
            <Section id="prices" icon={<DollarSignIcon className="h-4 w-4" />} title="Market Prices" badge="Per country" defaultOpen={false}>
              <MarketPricesSection prices={prices} models={models} onChange={setPrices} />
            </Section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           STEP 5: MEDIA & FILES
           ═══════════════════════════════════════════════════════════ */}
        {steps[currentStep]?.id === "media" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <Section id="media" icon={<ImageRawIcon className="h-4 w-4" />} title="Media & Files">
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
            <Section id="translations" icon={<LanguagesIcon className="h-4 w-4" />} title="Translations" defaultOpen={false}>
              <TranslationsSection translations={translations} onChange={setTranslations} />
            </Section>

            {/* Related Products */}
            <Section id="related" icon={<Link2Icon className="h-4 w-4" />} title="Related Products" defaultOpen={false}>
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
            <ArrowLeftIcon className="h-4 w-4" /> Previous
          </button>

          <div className="text-[11px] text-[var(--text-ghost)]">
            Step {currentStep + 1} of {steps.length}
          </div>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={handleNext}
              className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all flex items-center gap-2 shadow-lg"
            >
              Next <ArrowRightIcon className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={save}
              disabled={saving}
              className="h-10 px-6 rounded-xl bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-500 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg"
            >
              {saving ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <DiskIcon className="h-4 w-4" />}
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
   SLUG EDITOR — URL preview with edit affordance

   The slug auto-syncs from product_name until the admin manually
   types into it, then stays fixed (the slugEdited flag tracks
   this on the parent). Render modes:
     · display — subtle URL preview line, pencil icon to edit
     · edit    — inline input with Done / Reset buttons
   ═══════════════════════════════════════════════════════════════════ */
function SlugEditor({
  slug,
  onChange,
  onResetToAuto,
}: {
  slug: string;
  onChange: (v: string) => void;
  onResetToAuto: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div>
        <label className="block text-[10px] font-bold text-[var(--text-ghost)] uppercase tracking-wider mb-2">
          <span className="inline-flex items-center gap-1.5"><Link2Icon className="h-3 w-3" /> Public URL</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[var(--text-ghost)] font-mono shrink-0">/products/</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => onChange(e.target.value)}
            autoFocus
            placeholder="lockstitch-9500"
            className="flex-1 h-9 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[12px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
          />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            Done
          </button>
          <button
            type="button"
            onClick={() => { onResetToAuto(); setEditing(false); }}
            className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-muted)] transition-colors"
            title="Regenerate slug from product name"
          >
            Reset
          </button>
        </div>
        <p className="text-[10px] text-[var(--text-ghost)] mt-1.5">
          Lower-case, letters / numbers / hyphens only. Used in the public URL.
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-[10px] font-bold text-[var(--text-ghost)] uppercase tracking-wider mb-2">
        <span className="inline-flex items-center gap-1.5"><Link2Icon className="h-3 w-3" /> Public URL</span>
      </label>
      <div className="flex items-center gap-2 px-4 h-11 rounded-xl bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)]">
        <span className="text-[12px] text-[var(--text-ghost)] font-mono">/products/</span>
        <span className={`text-[12px] font-mono truncate ${slug ? "text-[var(--text-primary)]" : "text-[var(--text-ghost)] italic"}`}>
          {slug || "auto-generated from product name"}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="ml-auto inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0"
        >
          <PencilIcon className="h-3 w-3" /> Edit
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HIGHLIGHTS EDITOR — 3-5 short bullet strings

   Renders each highlight as a row with a leading check icon and an
   inline remove button, plus a single add-row input at the bottom.
   Enforces a soft cap of 5 so the public hero doesn't turn into a
   wall of bullets.
   ═══════════════════════════════════════════════════════════════════ */
function HighlightsEditor({
  highlights,
  onChange,
}: {
  highlights: string[];
  onChange: (next: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const atCap = highlights.length >= 5;

  const add = () => {
    const v = input.trim();
    if (!v || atCap) return;
    onChange([...highlights, v]);
    setInput("");
  };

  const remove = (i: number) => {
    onChange(highlights.filter((_, idx) => idx !== i));
  };

  const update = (i: number, next: string) => {
    onChange(highlights.map((h, idx) => (idx === i ? next : h)));
  };

  return (
    <div className="space-y-2">
      {highlights.length === 0 && (
        <p className="text-[11px] text-[var(--text-ghost)] italic px-1">
          Add 3–5 short bullets that describe what makes this product stand out.
        </p>
      )}
      {highlights.map((h, i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-3 h-11 rounded-xl bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)]"
        >
          <CheckIcon className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <input
            type="text"
            value={h}
            onChange={(e) => update(i, e.target.value)}
            className="flex-1 bg-transparent text-[13px] text-[var(--text-primary)] outline-none"
            maxLength={80}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
            aria-label={`Remove highlight ${i + 1}`}
          >
            <CrossIcon className="h-3 w-3" />
          </button>
        </div>
      ))}
      {!atCap && (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={highlights.length === 0 ? "e.g. Max 5000 SPM" : "Add another highlight..."}
            maxLength={80}
            className="flex-1 h-11 px-4 rounded-xl bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-all"
          />
          <button
            type="button"
            onClick={add}
            disabled={!input.trim()}
            className="h-11 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            <PlusIcon className="h-3.5 w-3.5" /> Add
          </button>
        </div>
      )}
      {atCap && (
        <p className="text-[10px] text-[var(--text-ghost)] italic px-1">
          You&apos;ve reached the 5-bullet cap. Remove one to add another.
        </p>
      )}
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
