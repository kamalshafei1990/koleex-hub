"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import WizardKnowledgePanel, { type WizardKnowledge } from "@/components/admin/WizardKnowledgePanel";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { PRODUCTS_UI_I18N } from "@/lib/products-ui-i18n";
import { humanizeError } from "@/lib/ui/humanize-error";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import ArrowUpRightIcon from "@/components/icons/ui/ArrowUpRightIcon";
import DiskIcon from "@/components/icons/ui/DiskIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CameraIcon from "@/components/icons/ui/CameraIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import FolderTreeIcon from "@/components/icons/ui/FolderTreeIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import WrenchIcon from "@/components/icons/ui/WrenchIcon";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
import BoxIcon from "@/components/icons/ui/BoxIcon";
import ProductStockProfile from "@/components/admin/ProductStockProfile";
import DollarSignIcon from "@/components/icons/ui/DollarSignIcon";
import LanguagesIcon from "@/components/icons/ui/LanguagesIcon";
import Link2Icon from "@/components/icons/ui/Link2Icon";
import ZapIcon from "@/components/icons/ui/ZapIcon";
import Settings2Icon from "@/components/icons/ui/Settings2Icon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import BookOpenIcon from "@/components/icons/ui/BookOpenIcon";
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
import {
  resolveSchema,
  computeReadiness,
  type ProductKnowledgeBlock,
} from "@/lib/product-schema";
import { ProductPreview } from "@/components/product-preview/ProductPreview";
import SchemaSpecsSection from "./form-sections/SchemaSpecsSection";
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
import KnowledgeSection from "./form-sections/KnowledgeSection";
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
import { getKindBySlug } from "@/lib/machine-kinds";
import { slugify } from "@/types/product-form";
import {
  suggestPrimaryModel,
  validatePrimaryModel,
  normalizeKoleexCode,
} from "@/lib/product-coding";
import { kxInspectAttrs } from "@/lib/qa/inspector";

// Derive a PascalCase component name from a section title (e.g. "Technical Details" → "TechnicalDetailsSection")
function sectionComponentName(title: string): string {
  const pascal = title
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  return `${pascal || "Product"}Section`;
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION WRAPPER — collapsible card with icon + title
   ═══════════════════════════════════════════════════════════════════ */
function Section({ icon, title, children, id, defaultOpen = true, badge }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; id?: string; defaultOpen?: boolean; badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} {...kxInspectAttrs({ component: sectionComponentName(title), module: "Product Data", section: title })} className="scroll-mt-24 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden transition-shadow hover:shadow-[0_2px_12px_rgba(0,0,0,0.15)]">
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

/* P0 #5b · i18n — getSteps runs OUTSIDE the component (no hook scope), so
   it keeps emitting stable English label / shortLabel for type-safety +
   any non-translated consumer. Translation happens at RENDER time by
   mapping the stable step `id` → dictionary keys via these maps, so the
   StepNav + jump chips localize without `getSteps` ever calling a hook. */
const STEP_LABEL_KEY: Record<string, string> = {
  classify: "step.classification",
  identity: "step.identity",
  description: "step.description",
  "sewing-specs": "step.machineSpecs",
  commercial: "step.modelsVariants",
  technical: "step.technical",
  media: "step.media",
  finalize: "step.reviewPublish",
};
const STEP_SHORT_KEY: Record<string, string> = {
  classify: "step.classify",
  identity: "step.hero",
  description: "step.description",
  "sewing-specs": "step.specs",
  commercial: "step.models",
  technical: "step.technical",
  media: "step.media",
  finalize: "step.review",
};

/* ═══════════════════════════════════════════════════════════════════
   SCHEMA ↔ LEGACY-COLUMN MIRROR
   ───────────────────────────────────────────────────────────────────
   The schema-driven Specs editor (products.schema_specs jsonb) and the
   legacy "Technical Details" block (typed products.* columns) historically
   captured the SAME ~20 fields, so an operator entered e.g. plug_types
   twice and the two copies could diverge.

   Resolution (no migration): the schema editor is the SINGLE input; the
   matching typed columns are hidden in the Technical block when the active
   schema covers them, and mirrored from schema_specs → columns at save so
   legacy readers (LegacyProductView, public API) keep working. Retiring the
   columns entirely is a later, sign-off step once those readers move to
   schema_specs.
   ═══════════════════════════════════════════════════════════════════ */
const SCHEMA_KEY_TO_COLUMN: Record<string, string> = {
  voltage_options: "voltage",
  frequency_hz: "frequency_hz",
  motor_power_w: "motor_power_w",
  power_consumption_w: "power_consumption_w",
  phase: "phase",
  plug_types: "plug_types",
  pneumatic_supply_required: "pneumatic_supply",
  machine_dimensions: "machine_dimensions",
  machine_weight_kg: "machine_weight_kg",
  hs_code: "hs_code",
  ip_rating: "ip_rating",
  operating_temperature: "operating_temp",
  ce_certified: "ce_certified",
  rohs_compliant: "rohs_compliant",
  oil_mist_filter: "oil_mist_filter",
  colors: "colors",
  moq: "moq",
  lead_time: "lead_time",
  supports_head_only: "supports_head_only",
  supports_complete_set: "supports_complete_set",
};

/* Build the set of typed columns the active schema covers (so the Technical
   block can hide those fields). Empty set when no schema is resolved. */
function computeSchemaCoveredColumns(
  schema: { groups?: { fields?: { key: string }[] }[] } | null | undefined,
): Set<string> {
  if (!schema?.groups) return new Set();
  const keys = new Set(schema.groups.flatMap((g) => (g.fields ?? []).map((f) => f.key)));
  return new Set(
    Object.entries(SCHEMA_KEY_TO_COLUMN)
      .filter(([sk]) => keys.has(sk))
      .map(([, col]) => col),
  );
}

/* Derive typed-column values from schema_specs for the overlap set, with the
   couple of shape conversions the columns need (dimension object → text,
   temperature range object → text). Only emits keys that are actually present
   in schema_specs so a partially-filled schema never nulls a legacy column. */
function schemaColumnMirror(
  schema: { groups?: { fields?: { key: string }[] }[] } | null | undefined,
  specs: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!schema || !specs) return {};
  const out: Record<string, unknown> = {};
  for (const [sk, col] of Object.entries(SCHEMA_KEY_TO_COLUMN)) {
    const v = specs[sk];
    if (v === undefined || v === null || v === "") continue;
    if (col === "machine_dimensions" && typeof v === "object" && !Array.isArray(v)) {
      const d = v as { length?: number; width?: number; height?: number };
      const parts = [d.length, d.width, d.height].filter((n) => n != null);
      out[col] = parts.length ? `${parts.join(" × ")} mm` : null;
    } else if (col === "operating_temp" && typeof v === "object" && !Array.isArray(v)) {
      const r = v as { min?: number; max?: number };
      out[col] = `${r.min ?? ""}–${r.max ?? ""} °C`;
    } else {
      out[col] = v;
    }
  }
  return out;
}

function getSteps(isSewing: boolean): WizardStep[] {
  /* Machine Kind used to be its own step (id: "machine-type") but
     it's really a 4th-tier classification decision — Division →
     Category → Subcategory → Kind — so it now lives INSIDE the
     Classify step. Keeping the wizard at 7 / 8 steps instead of
     8 / 9 and aligning the admin's mental model with how customers
     browse the catalog. */
  /* Specs is now ONE tab. The old split — "Machine Specs" (schema/sewing) +
     "Technical Details" (electrical/physical/compliance) — confused operators
     and scattered the spec systems across two tabs. They render together under
     this single "Specifications" tab. Always present (technical applies to
     every product; the sewing block inside only shows for sewing machines). */
  const steps: WizardStep[] = [
    /* Priority order: identity → description → the structured specs → money →
       shipping → media → knowledge enrichment → review. Knowledge sits late
       (it enriches an already-described product); Logistics is its own step so
       customs/shipping data stops scattering across Specs + Models. */
    { id: "classify", label: "Classification", shortLabel: "Classify", icon: <FolderTreeIcon className="h-4 w-4" /> },
    { id: "identity", label: "Hero & Identity", shortLabel: "Identity", icon: <SparklesIcon className="h-4 w-4" /> },
    { id: "description", label: "Description", shortLabel: "Description", icon: <DocumentIcon className="h-4 w-4" /> },
    { id: "specs", label: "Specifications", shortLabel: "Specs", icon: <Settings2Icon className="h-4 w-4" /> },
    { id: "commercial", label: "Models & Variants", shortLabel: "Commercial", icon: <BoxesIcon className="h-4 w-4" /> },
    { id: "logistics", label: "Logistics", shortLabel: "Logistics", icon: <GlobeIcon className="h-4 w-4" /> },
    { id: "media", label: "Media & Files", shortLabel: "Media", icon: <ImageRawIcon className="h-4 w-4" /> },
    { id: "knowledge", label: "Product Knowledge", shortLabel: "Knowledge", icon: <BookOpenIcon className="h-4 w-4" /> },
    { id: "finalize", label: "Review & Publish", shortLabel: "Review", icon: <CheckIcon className="h-4 w-4" /> },
  ];
  void ZapIcon; // retained import; the standalone Technical tab merged into Specs
  return steps;
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION TABS — clean sticky tab bar for the tabbed editor. Each tab is
   its OWN screen (only the active section renders), navigated freely — no
   step numbers, no lock/completed semantics, no forced Next/Back sequence.
   Fully controlled by the parent's currentStep.
   ═══════════════════════════════════════════════════════════════════ */
function SectionTabs({
  items,
  activeIndex,
  onSelect,
}: {
  items: { index: number; id: string; label: string }[];
  activeIndex: number;
  onSelect: (i: number) => void;
}) {
  return (
    <nav className="sticky top-0 z-20 mb-6 -mx-4 md:-mx-8 lg:-mx-12 xl:-mx-16 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/90 backdrop-blur-md">
      <div className="flex items-center gap-1 overflow-x-auto px-4 md:px-8 lg:px-12 xl:px-16 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((it) => {
          const on = it.index === activeIndex;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onSelect(it.index)}
              aria-current={on ? "page" : undefined}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                on
                  ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
              }`}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STEP NAVIGATION BAR
   ═══════════════════════════════════════════════════════════════════ */
function StepNav({ steps, currentStep, onStepChange, completedSteps, lockedSteps, issueCounts, t }: {
  steps: WizardStep[];
  currentStep: number;
  onStepChange: (i: number) => void;
  completedSteps: Set<number>;
  lockedSteps?: Set<number>;
  /* P0 #3 · per-step count of unmet required fields → red badge */
  issueCounts?: Map<number, number>;
  /* P0 #5b · translator passed down so step labels localize at render */
  t: (key: string, fallback?: string) => string;
}) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] px-2 py-2 mb-6">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {steps.map((step, i) => {
          const isActive = i === currentStep;
          const isCompleted = completedSteps.has(i);
          const isPast = i < currentStep;
          const isLocked = !!lockedSteps?.has(i);
          /* P0 #3 · this step has unmet required fields. We only
             surface it as an error AWAY from the active step — while
             you're filling a step, a red badge on it is just noise. */
          const issueCount = issueCounts?.get(i) || 0;
          const hasIssue = issueCount > 0 && !isLocked && !isActive;
          return (
            <button
              key={step.id}
              onClick={() => { if (!isLocked) onStepChange(i); }}
              disabled={isLocked}
              title={
                isLocked
                  ? t("wizard.completeClassificationFirst", "Complete classification first")
                  : hasIssue
                  ? t("validation.missingCount", `${issueCount} required field(s) missing`).replace("{n}", String(issueCount))
                  : t(STEP_LABEL_KEY[step.id] ?? "", step.label)
              }
              className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-medium transition-all shrink-0 ${
                isLocked
                  ? "text-[var(--text-ghost)]/60 cursor-not-allowed"
                  : isActive
                  ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] shadow-lg"
                  : hasIssue
                  ? "text-amber-500 hover:bg-amber-500/[0.06]"
                  : isPast || isCompleted
                  ? "text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)]"
                  : "text-[var(--text-ghost)] hover:text-[var(--text-dim)] hover:bg-[var(--bg-surface-subtle)]"
              }`}
            >
              <div className={`relative h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                isLocked ? "bg-[var(--bg-surface)]/60 text-[var(--text-ghost)]/50" :
                isActive ? "bg-white/20" :
                hasIssue ? "bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/40" :
                isCompleted ? "bg-emerald-500/20 text-emerald-400" :
                "bg-[var(--bg-surface)] text-[var(--text-ghost)]"
              }`}>
                {isLocked
                  ? <LockIcon className="h-3 w-3" />
                  : hasIssue
                  ? "!"
                  : (isCompleted && !isActive ? <CheckIcon className="h-3 w-3" /> : i + 1)}
              </div>
              <span className="hidden md:inline">{t(STEP_SHORT_KEY[step.id] ?? "", step.shortLabel)}</span>
              {hasIssue && (
                <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-black">
                  {issueCount}
                </span>
              )}
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
function StatusBadge({ status, t }: { status: string; t: (key: string, fallback?: string) => string }) {
  const colors: Record<string, string> = {
    draft: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    active: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    archived: "text-red-400 bg-red-400/10 border-red-400/20",
  };
  const s = status || "draft";
  return (
    <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider ${colors[status] || colors.draft}`}>
      <CircleDotIcon className="h-2.5 w-2.5" />
      {t(`status.${s}`, s)}
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
  const pathname = usePathname();
  /* The wizard is mounted under BOTH /products and /product-data. Keep
     back / cancel / post-save inside whichever app the operator is
     actually in — mirrors ProductList's baseRoute logic so the
     list → form → back loop never jumps apps. */
  const baseRoute = (pathname || "").startsWith("/product-data") ? "/product-data" : "/products";
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  const isEdit = !!productId;

  /* P0 #3 · Draft Autosave — one localStorage slot per product
     (or "new" for a not-yet-saved product). Bumped key version (v1)
     so a future shape change can't try to restore an incompatible
     old draft. */
  const draftKey = useMemo(() => `koleex:pd:draft:v1:${productId || "new"}`, [productId]);

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

  /* P0 #3 · recovered-draft banner. Holds the timestamp of an
     autosaved draft found on mount so we can offer Restore / Discard.
     We NEVER auto-apply it — the saved product is left untouched until
     the operator explicitly chooses to restore (no dumb overwrite). */
  const [draftMeta, setDraftMeta] = useState<{ savedAt: number } | null>(null);
  const draftCheckedRef = useRef(false);

  /* ── Track original IDs for diff in edit mode ── */
  const [originalModelIds, setOriginalModelIds] = useState<string[]>([]);
  const [originalMediaIds, setOriginalMediaIds] = useState<string[]>([]);
  const [originalTranslationIds, setOriginalTranslationIds] = useState<string[]>([]);

  /* ── Dirty tracking ──
     Set to true the first time the user edits any form state. Reset
     on successful save. Used to warn before leaving (Cancel button +
     browser beforeunload).

     Hydration guard: while `loading` is true, the form is
     receiving its initial values from the server. We ignore changes
     during that window — the first dep change AFTER loading flips
     to false counts as the first real edit. Implemented with a ref
     so we don't double-fire the gating effect itself. */
  const [dirty, setDirty] = useState(false);
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (loading) return;        // still hydrating from server
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;                   // first run AFTER hydration — baseline
    }
    setDirty(true);
  }, [loading, product, models, media, translations, prices, related, sewingSpecs]);

  /* Browser beforeunload warning — fires the native "Leave site?"
     dialog when the user tries to close/refresh/navigate away with
     unsaved changes. */
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  /* ── P0 #3 · Draft Autosave ──────────────────────────────────────
     Once the form is dirty, mirror the whole working state into
     localStorage on a short debounce so an accidental close / refresh
     / crash can't lose work. The raw File handles on pending media
     can't be serialised (and blob URLs don't survive a reload), so we
     drop `_file` — already-uploaded media keep their url. Writes are
     wrapped so a quota error can never break the form. */
  useEffect(() => {
    if (loading || !dirty) return;
    if (typeof window === "undefined") return;
    const id = window.setTimeout(() => {
      try {
        const snapshot = {
          v: 1,
          savedAt: Date.now(),
          product,
          models,
          media: media.map((m) => ({ ...m, _file: undefined })),
          translations,
          prices,
          related,
          sewingSpecs,
        };
        window.localStorage.setItem(draftKey, JSON.stringify(snapshot));
      } catch {
        /* storage full / serialisation issue — drafting is best-effort */
      }
    }, 800);
    return () => window.clearTimeout(id);
  }, [loading, dirty, product, models, media, translations, prices, related, sewingSpecs, draftKey]);

  /* ── P0 #3 · Draft recovery detection ──
     After the server load settles, look for a saved draft for this
     slot. If one exists we surface the Restore / Discard banner — we
     do NOT apply it automatically. Runs once per mount. */
  useEffect(() => {
    if (loading || draftCheckedRef.current) return;
    if (typeof window === "undefined") return;
    draftCheckedRef.current = true;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.savedAt !== "number") return;

      /* Only surface the Restore banner for a draft worth recovering: it
         must be recent (≤ 24h) AND actually contain entered data. Stale or
         essentially-empty drafts (the form can auto-save a blank snapshot the
         moment it goes dirty) are cleared silently so the banner never cries
         wolf — that false-alarm noise was the whole complaint. */
      const STALE_MS = 24 * 60 * 60 * 1000;
      const tooOld = Date.now() - parsed.savedAt > STALE_MS;
      const p = (parsed.product ?? {}) as Record<string, unknown>;
      const draftModels = Array.isArray(parsed.models) ? parsed.models : [];
      const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
      const hasContent =
        str(p.product_name) !== "" ||
        str(p.division_slug) !== "" ||
        str(p.category_slug) !== "" ||
        str(p.subcategory_slug) !== "" ||
        str(p.description) !== "" ||
        draftModels.some(
          (m: Record<string, unknown>) =>
            str(m?.model_name) !== "" ||
            str(m?.primary_model) !== "" ||
            str(m?.reference_model) !== "",
        );

      if (tooOld || !hasContent) {
        try { window.localStorage.removeItem(draftKey); } catch { /* noop */ }
        return;
      }
      setDraftMeta({ savedAt: parsed.savedAt });
    } catch {
      /* corrupt draft — ignore it rather than block the form */
    }
  }, [loading, draftKey]);

  /* Apply a recovered draft into the live form. This is an explicit
     user action, so we mark the form dirty and let them review before
     saving — nothing is written to the database here. */
  const restoreDraft = () => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) { setDraftMeta(null); return; }
      const d = JSON.parse(raw);
      if (d.product) setProduct(d.product);
      if (Array.isArray(d.models)) setModels(d.models);
      if (Array.isArray(d.media)) setMedia(d.media);
      if (Array.isArray(d.translations)) setTranslations(d.translations);
      if (Array.isArray(d.prices)) setPrices(d.prices);
      if (Array.isArray(d.related)) setRelated(d.related);
      if (d.sewingSpecs) setSewingSpecs(d.sewingSpecs);
      setDirty(true);
      setDraftMeta(null);
      setError("");
      setSuccess(t("draft.restored", "Draft restored — review the fields, then Save when you're ready."));
    } catch {
      setError(t("save.draftReadError", "That saved draft couldn't be read — it may be from an older version. Discarding it is safe."));
    }
  };

  /* Throw the saved draft away (keeps whatever is currently loaded). */
  const discardDraft = () => {
    if (typeof window !== "undefined") {
      try { window.localStorage.removeItem(draftKey); } catch { /* noop */ }
    }
    setDraftMeta(null);
  };

  /* Smart cancel — confirms with the user when there are unsaved
     edits, otherwise just routes back to the list. */
  const handleCancel = () => {
    if (dirty) {
      const ok = window.confirm(
        t("wizard.confirmDiscard", "Discard your changes and leave this page? Anything you've edited that hasn't been saved will be lost.")
      );
      if (!ok) return;
    }
    /* Return to the list of whichever app we're in (/product-data or
       /products) so Back / Cancel never bounces the operator into the
       other app. */
    router.push(baseRoute);
  };

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
          motor_power_w: p.motor_power_w?.toString() || "",
          power_consumption_w: p.power_consumption_w?.toString() || "",
          machine_weight_kg: p.machine_weight_kg?.toString() || "",
          machine_dimensions: p.machine_dimensions || "",
          ce_certified: !!p.ce_certified,
          rohs_compliant: !!p.rohs_compliant,
          oil_mist_filter: !!p.oil_mist_filter,
          pneumatic_supply: !!p.pneumatic_supply,
          frequency_hz: p.frequency_hz || [],
          phase: p.phase || "",
          ip_rating: p.ip_rating || "",
          operating_temp: p.operating_temp || "",
          visible: p.visible,
          featured: p.featured,
          status: (p.status as ProductFormState["status"]) || "draft",
          country_of_origin: p.country_of_origin || "",
          moq: p.moq?.toString() || "",
          lead_time: p.lead_time || "",
          /* Product Schema Engine v1 — hydrate the 5 schema columns
             with safe defaults so the new readiness panel + preview
             still render for legacy products with NULL values. */
          schema_id: p.schema_id || "",
          schema_version: p.schema_version || "",
          schema_specs: (p.schema_specs as Record<string, unknown>) || {},
          schema_knowledge: (p.schema_knowledge as unknown[]) || [],
          schema_visibility: (p.schema_visibility as Record<string, unknown>) || {},
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
          net_weight: m.net_weight?.toString() || "",
          cbm: m.cbm?.toString() || "",
          carton_dimensions: m.carton_dimensions || "",
          packing_type: m.packing_type || "",
          box_include: m.box_include || "",
          extra_accessories: m.extra_accessories || "",
          container_20ft_qty: m.container_20ft_qty?.toString() || "",
          container_40ft_qty: m.container_40ft_qty?.toString() || "",
          stock_status: m.stock_status || "",
          order: m.order,
          visible: m.visible,
          status: (m.status as ModelFormState["status"]) || "active",
          moq: m.moq?.toString() || "",
          lead_time: m.lead_time || "",
          barcode: m.barcode || "",
          primary_model: m.primary_model || "",
          code_prefix: m.code_prefix || "",
          coding_status: m.coding_status || "",
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
    /* ── P0 #3 · Media upload feedback ──
       The hero input's accept="image/*" only filters the file picker,
       not drag-and-drop, and doesn't guard size. Validate here so the
       operator gets a clear reason up-front instead of a silent failure
       at save time. Limits mirror the Media step's main-image slot
       (image type · 8 MB). */
    const MAIN_IMAGE_MAX_MB = 8;
    if (!/^image\//.test(file.type)) {
      setError(t("media.mainNotImage").replace("{name}", file.name));
      return;
    }
    if (file.size > MAIN_IMAGE_MAX_MB * 1024 * 1024) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setError(
        t("media.mainTooBig")
          .replace("{name}", file.name)
          .replace("{size}", mb)
          .replace("{max}", String(MAIN_IMAGE_MAX_MB)),
      );
      return;
    }
    setError("");
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

  /* ── v30: KOLEEX Primary Model auto-coding ──
     Resolve the prefix from the currently-selected subcategory's `code`
     column. When the user types into Supplier Model AND the primary
     model hasn't been hand-edited (status != "edited"), we re-derive
     the suggestion. The status flag stops us from clobbering manual
     overrides. */
  const selectedSubcategory = subcategories.find(
    (s) => s.slug === product.subcategory_slug,
  );
  const resolvedPrefix = selectedSubcategory?.code ?? "";

  /* Active schema for the current classification. Drives the Specs↔Technical
     de-duplication: any typed column the schema covers is HIDDEN in the
     Technical block (schema editor is the single input) and mirrored from
     schema_specs → columns at save time. */
  const activeSpecsSchema = resolveSchema({
    divisionCode: product.division_slug || "",
    categoryCode: product.category_slug || "",
    subcategoryCode: selectedSubcategory?.code || "",
  }).schema;
  const schemaCoveredCols = computeSchemaCoveredColumns(activeSpecsSchema);
  /* The legacy Technical block, Purchase Options + Fulfillment sub-sections are
     hidden when the active schema already covers their fields (no double entry).
     The schema editor is the single input; values mirror to columns on save. */
  const TECH_BLOCK_COLS = [
    "voltage", "frequency_hz", "motor_power_w", "power_consumption_w", "phase",
    "plug_types", "pneumatic_supply", "machine_dimensions", "machine_weight_kg",
    "hs_code", "ip_rating", "operating_temp", "ce_certified", "rohs_compliant",
    "oil_mist_filter", "colors",
  ];
  const technicalHasVisibleField = TECH_BLOCK_COLS.some((c) => !schemaCoveredCols.has(c));
  const purchaseCoveredBySchema = schemaCoveredCols.has("supports_head_only") && schemaCoveredCols.has("supports_complete_set");
  const fulfillmentCoveredBySchema = schemaCoveredCols.has("moq") && schemaCoveredCols.has("lead_time");

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

  /* Live auto-suggest: whenever the prefix or supplier-model changes,
     recompute the suggestion. Only push it into `primary_model` when
     the field has never been hand-edited (coding_status != "edited" /
     "locked"). The "Reset to auto" button below clears the flag so a
     user can reclaim the suggestion explicitly. */
  const suggestedPrimaryModel = suggestPrimaryModel(
    resolvedPrefix,
    primaryModel?.reference_model || "",
  );
  useEffect(() => {
    if (!primaryModel) return;
    if (!resolvedPrefix || !primaryModel.reference_model) return;
    const status = primaryModel.coding_status;
    if (status === "edited" || status === "locked") return;
    if (primaryModel.primary_model === suggestedPrimaryModel) return;
    /* Mirror the suggestion into model_name + slug too so the hero
       "Primary Model" input — bound to primary_model with a model_name
       fallback — picks it up regardless of how the form loaded. */
    updatePrimaryModel({
      primary_model: suggestedPrimaryModel,
      model_name: primaryModel.model_name || suggestedPrimaryModel,
      slug: primaryModel.slug || slugify(suggestedPrimaryModel),
      code_prefix: resolvedPrefix,
      coding_status: "auto_suggested",
    });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [suggestedPrimaryModel, resolvedPrefix]);

  /* ── Live uniqueness check ──────────────────────────────────────
     The DB owns the hard guarantee via the partial unique index on
     upper(primary_model). This client check is the friendly mirror —
     it pings /api/products/check-primary-model on each (debounced)
     change so the operator sees "this code is already used by X" the
     moment they type a duplicate, instead of finding out on Save.

     codeCheck shape:
       status   — "idle" | "checking" | "available" | "taken" | "error"
       conflict — populated only when status === "taken"           */
  type CodeCheck =
    | { status: "idle" }
    | { status: "checking" }
    | { status: "available" }
    | { status: "error" }
    | {
        status: "taken";
        conflict: {
          product_id: string;
          product_name: string;
          product_slug: string | null;
          model_id: string;
          model_name: string;
          primary_model: string;
        };
      };
  const [codeCheck, setCodeCheck] = useState<CodeCheck>({ status: "idle" });

  useEffect(() => {
    const code = (primaryModel?.primary_model || "").trim();
    if (!code) {
      setCodeCheck({ status: "idle" });
      return;
    }
    /* Bail on incomplete / structurally invalid codes — the
       validatePrimaryModel hint already covers those, no need to ping
       the server for them. */
    const v = validatePrimaryModel(code, resolvedPrefix);
    if (!v.ok) {
      setCodeCheck({ status: "idle" });
      return;
    }

    let cancelled = false;
    setCodeCheck({ status: "checking" });
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ code });
        if (productId) params.set("excludeProductId", productId);
        const res = await fetch(
          `/api/products/check-primary-model?${params.toString()}`,
          { credentials: "include" },
        );
        if (cancelled) return;
        if (!res.ok) {
          setCodeCheck({ status: "error" });
          return;
        }
        const payload = await res.json();
        if (cancelled) return;
        if (payload?.available === false && payload?.conflict) {
          setCodeCheck({ status: "taken", conflict: payload.conflict });
        } else {
          setCodeCheck({ status: "available" });
        }
      } catch (err) {
        if (cancelled) return;
        console.warn("[primary-model uniqueness] check failed", err);
        setCodeCheck({ status: "error" });
      }
    }, 350); /* 350ms debounce — fast enough to feel live, slow enough
                to not hammer the API on every keystroke */

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [primaryModel?.primary_model, productId, resolvedPrefix]);

  /* Smart save-button label + styling based on the chosen status.
     Shared between the Review step's preview card and the bottom
     nav's primary action so both stay in sync. Draft = grey
     surface (parking work), Active = green (going live),
     Archived = neutral dark (record-keeping). */
  const saveLabel =
    product.status === "active" ? t("action.savePublish", "Save & Publish")
    : product.status === "archived" ? t("action.saveChanges", "Save Changes")
    : t("action.saveAsDraft", "Save as Draft");
  const saveBtnCls =
    product.status === "active"
      ? "bg-emerald-600 text-white hover:bg-emerald-500"
      : product.status === "archived"
        ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90"
        : "bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-subtle)]";

  /* ── Classification-gated lock ──
     Classification is complete at Division → Category → Subcategory.
     The machine kind (4th tier inside Classify) is OPTIONAL — it
     refines the spec template when chosen, but the operator can skip
     it, so it does NOT gate the rest of the form. The kind slug rides
     inside sewingSpecs.common_specs.machine_kind; template_slug is
     kept as a back-compat fallback for products saved before the
     kind selector shipped. */
  const classificationComplete =
    !!product.division_slug &&
    !!product.category_slug &&
    !!product.subcategory_slug;

  const lockedSteps = useMemo(() => {
    const set = new Set<number>();
    steps.forEach((s, i) => {
      // Everything after classify is locked until classification is complete
      if (s.id !== "classify" && !classificationComplete) set.add(i);
    });
    return set;
  }, [steps, classificationComplete]);

  /* ── Live Product Knowledge — the persistent "Raise Product Maturity"
        signal shown above every step. Recomputed each render from the
        working form state, so completeness/maturity move on every edit.
        Same data-presence groups as the Product Detail Knowledge Object,
        so the number the operator builds here matches what they'll see
        on the product page. No new data. */
  const wizardKnowledge: WizardKnowledge = (() => {
    const cs = (sewingSpecs.common_specs || {}) as Record<string, unknown>;
    const ts = (sewingSpecs.template_specs || {}) as Record<string, unknown>;
    const gs = ((product as unknown as { specs?: Record<string, unknown> }).specs || {}) as Record<string, unknown>;
    const nonEmpty = (o: Record<string, unknown>) =>
      Object.values(o).filter((v) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)).length;
    const specsCount = nonEmpty(cs) + nonEmpty(ts) + nonEmpty(gs);
    const imgVid = media.filter((m) => ["main_image", "gallery", "video"].includes(m.type)).length;
    const docs = media.filter((m) => !["main_image", "gallery", "video"].includes(m.type)).length;
    const productTags = (product.tags || []) as string[];
    const apps = productTags.length;
    const fabricRe = /denim|jean|leather|canvas|tarp|knit|jersey|silk|satin|chiffon|cotton|polyester|nylon|wool|fleece|vinyl|pvc|mesh|spandex|elastane|twill|terry|velvet|corduroy|fabric|material/i;
    const fabrics = productTags.filter((t) => fabricRe.test(t)).length;
    const rel = related.length;
    const defs = [
      { key: "specifications", label: "Specs", present: specsCount > 0, w: 20 },
      { key: "media", label: "Media", present: imgVid > 0, w: 20 },
      { key: "applications", label: "Applications", present: apps > 0, w: 15 },
      { key: "documents", label: "Documents", present: docs > 0, w: 10 },
      { key: "fabrics", label: "Fabrics", present: fabrics > 0, w: 10 },
      { key: "operations", label: "Operations", present: false, w: 10 },
      { key: "relationships", label: "Relationships", present: rel > 0, w: 15 },
    ];
    const pct = defs.reduce((a, s) => a + (s.present ? s.w : 0), 0);
    let level: 1 | 2 | 3 | 4 | 5 = pct < 25 ? 1 : pct < 50 ? 2 : pct < 75 ? 3 : 4;
    if (level >= 4 && rel === 0) level = 3;
    if (pct >= 85 && rel > 0) level = 5;
    const levelLabel = ["", "Record", "Structured", "Knowledge", "Connected", "Complete"][level];
    const tone: WizardKnowledge["tone"] = pct < 35 ? "low" : pct < 70 ? "mid" : "high";
    return { pct, level, levelLabel, tone, connected: rel > 0, missing: defs.filter((s) => !s.present).map((s) => s.label), sections: defs.map(({ w: _w, ...s }) => s) };
  })();

  /* ── Editor mode ──
     `tabbed`: each section is its OWN screen, navigated freely via a clean
     tab bar (only the active section renders) — no step numbers, no locks,
     no forced Next/Back. The header "Save Product" button saves from any tab.
     `onePage` (the all-sections-stacked scroll variant) and the original
     numbered wizard are both kept behind their flags for fallback. */
  const tabbed = true;
  const onePage = false;

  /* ── Step / tab navigation ── */
  const goToStep = (idx: number) => {
    const safeIdx = Math.max(0, Math.min(idx, steps.length - 1));
    if (tabbed) {
      // free navigation between tabs — no lock gate
      setError("");
      setCurrentStep(safeIdx);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (onePage) {
      const id = steps[safeIdx]?.id;
      if (id && typeof document !== "undefined") {
        document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }
    if (lockedSteps.has(safeIdx)) {
      const target = steps[safeIdx];
      if (target?.id === "sewing-specs") {
        setError(t("wizard.selectMachineTypeFirst", "Select a machine type before entering specs"));
      } else {
        setError(t("wizard.unlockStepHint", "Complete the classification first to unlock this step"));
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

  /* ── P0 #3 · Wizard Data Integrity — required-field source of truth ──
     ONE authoritative map of stepId → missing required-field labels.
     It drives four consumers so they can never disagree:
       1. the per-step "Next" gate (validateCurrentStep)
       2. the StepNav error badges (visual-first count per step)
       3. the publish guard inside save()
       4. the finalize readiness banner
     Data-safety rule: this set is the *identity-critical* core only
     (name · classification · machine kind · primary model). Draft
     saves are never blocked on it — only publishing to `active` is
     gated — so editing any of the 710 legacy products stays safe.
     Media / specs remain advisory (shown on the finalize step) so we
     don't hard-block re-saving older products that predate them. */
  const requiredIssues = useMemo(() => {
    const byStep: Record<string, string[]> = {};
    const add = (step: string, label: string) => {
      (byStep[step] ||= []).push(label);
    };
    if (!product.product_name.trim()) add("identity", t("field.productName", "Product name"));
    if (!product.division_slug) add("classify", t("field.division", "Division"));
    if (!product.category_slug) add("classify", t("field.category", "Category"));
    if (!product.subcategory_slug) add("classify", t("field.subcategory", "Subcategory"));
    if (!(primaryModel?.primary_model || "").trim()) add("commercial", t("field.primaryModel", "Primary model"));
    return byStep;
  }, [
    product.product_name,
    product.division_slug,
    product.category_slug,
    product.subcategory_slug,
    primaryModel?.primary_model,
    t,
  ]);

  /* Map of step index → count of unmet required fields, for the
     StepNav badge. Indexed by position so the nav can render it
     without re-deriving anything. */
  const stepIssueCount = useMemo(() => {
    const m = new Map<number, number>();
    steps.forEach((s, i) => {
      const n = requiredIssues[s.id]?.length || 0;
      if (n > 0) m.set(i, n);
    });
    return m;
  }, [steps, requiredIssues]);

  const missingRequiredLabels = useMemo(
    () => Object.values(requiredIssues).flat(),
    [requiredIssues],
  );

  /* ── Validation per step ──
     Generalised over the required-set above: leaving a step is
     blocked only by that step's OWN unmet required fields, so the
     admin can still skip ahead past steps whose gaps live elsewhere. */
  const validateCurrentStep = (): string | null => {
    const stepId = steps[currentStep]?.id;
    const issues = stepId ? requiredIssues[stepId] : undefined;
    if (issues && issues.length > 0) {
      return issues.length === 1
        ? t("validation.fieldRequiredToContinue").replace("{field}", issues[0])
        : t("validation.completeRequiredList").replace("{fields}", issues.join(", "));
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
      setError(t("save.productNameRequired", "Product name is required"));
      setCurrentStep(0);
      return;
    }
    if (!product.division_slug || !product.category_slug || !product.subcategory_slug) {
      setError(t("save.classificationRequired", "Classification is required"));
      setCurrentStep(0);
      return;
    }

    /* ── Primary-Model uniqueness guard ──────────────────────────
       The DB has a partial unique index on upper(primary_model), so
       this is belt-and-braces — but blocking save here lets us point
       the operator straight back to the hero strip with a clear
       message instead of surfacing a raw Postgres error toast. */
    if (codeCheck.status === "taken") {
      setError(
        t("model.takenBlock")
          .replace("{code}", codeCheck.conflict.primary_model)
          .replace("{product}", codeCheck.conflict.product_name),
      );
      setCurrentStep(0);
      return;
    }
    if (codeCheck.status === "checking") {
      setError(t("model.stillChecking", "Still checking if the Primary Model code is available — try again in a moment."));
      setCurrentStep(0);
      return;
    }

    /* ── P0 #3 · Publish gate ──────────────────────────────────────
       Going live (status = active) requires the full identity-critical
       set. Draft / archived saves skip this entirely so work is never
       blocked — data-safety first. On a miss we jump to the first
       offending step and name every gap, and point to "Save as Draft"
       as the escape hatch. */
    if (product.status === "active" && missingRequiredLabels.length > 0) {
      const firstIdx = steps.findIndex((s) => (requiredIssues[s.id]?.length || 0) > 0);
      const n = missingRequiredLabels.length;
      setError(
        t("save.cantPublishList")
          .replace("{n}", String(n))
          .replace("{fields}", missingRequiredLabels.join(", ")),
      );
      if (firstIdx >= 0) setCurrentStep(firstIdx);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    /* ── P0 #4 · Authoritative save-time Primary-Model uniqueness re-check ──
       The live `codeCheck` can be stale: it sits "idle" for codes the
       structural validator skipped, and "error" when the live ping was
       offline — so a duplicate could slip past the UI. Before writing,
       ask the server once more (the same edit-aware endpoint, so a
       product never collides with itself). This blocks duplicates for
       Draft / Active / Archived alike — drafts included, because a
       duplicate primary_model becomes an SKU problem downstream. The DB
       partial unique index on upper(primary_model) is still the ultimate
       guarantee; this just turns a generic constraint error into a clear,
       named message and catches the bypass case. */
    const codeToVerify = (primaryModel?.primary_model || "").trim();
    if (codeToVerify) {
      try {
        const params = new URLSearchParams({ code: codeToVerify });
        if (productId) params.set("excludeProductId", productId);
        const res = await fetch(
          `/api/products/check-primary-model?${params.toString()}`,
          { credentials: "include" },
        );
        if (res.ok) {
          const payload = await res.json();
          if (payload?.available === false && payload?.conflict) {
            setError(
              t("model.takenBlockSave")
                .replace("{code}", payload.conflict.primary_model)
                .replace("{product}", payload.conflict.product_name),
            );
            setSaving(false);
            setCurrentStep(0);
            return;
          }
        }
        /* A failed check is NOT a hard block — the DB unique index still
           guarantees correctness and the save catch humanizes any clash. */
      } catch {
        /* network hiccup — fall through; the DB index is the backstop */
      }
    }

    /* Product Schema Engine v1 — resolve the schema definition for the
       chosen classification so we can persist {schema_id, schema_version}
       alongside the form values. Resolution is pure / synchronous and
       returns { schema: null } when no schema is registered for the
       (division, category, subcategory) triple, which we treat as "no
       schema bound" (nulls in DB). */
    const resolvedSchemaForSave = resolveSchema({
      divisionCode: product.division_slug || "",
      categoryCode: product.category_slug || "",
      subcategoryCode: selectedSubcategory?.code || "",
    });

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
        // Electrical / Physical / Compliance — moved out of common_specs
        // jsonb into typed columns so we can filter and compare cleanly.
        motor_power_w: product.motor_power_w ? parseInt(product.motor_power_w, 10) : null,
        power_consumption_w: product.power_consumption_w ? parseInt(product.power_consumption_w, 10) : null,
        machine_weight_kg: product.machine_weight_kg ? parseFloat(product.machine_weight_kg) : null,
        machine_dimensions: product.machine_dimensions || null,
        ce_certified: product.ce_certified,
        rohs_compliant: product.rohs_compliant,
        oil_mist_filter: product.oil_mist_filter,
        pneumatic_supply: product.pneumatic_supply,
        // Technical step v2 audit additions.
        frequency_hz: product.frequency_hz,
        phase: product.phase || null,
        ip_rating: product.ip_rating || null,
        operating_temp: product.operating_temp || null,
        supports_head_only: product.supports_head_only,
        supports_complete_set: product.supports_complete_set,
        warranty: product.warranty || null,
        visible: product.visible,
        featured: product.featured,
        status: product.status,
        country_of_origin: product.country_of_origin || null,
        moq: product.moq ? parseInt(product.moq) : null,
        lead_time: product.lead_time || null,
        /* Product Schema Engine v1 — persist the 5 new columns.
           schema_id / schema_version come from the resolved schema
           registry entry; the other three are passed straight from
           form state (currently always empty until editors land). */
        schema_id: resolvedSchemaForSave.schema?.id ?? null,
        schema_version: resolvedSchemaForSave.schema?.version ?? null,
        schema_specs: product.schema_specs || {},
        schema_knowledge: product.schema_knowledge || [],
        schema_visibility: product.schema_visibility || {},
      };

      /* De-dup mirror: when a schema is active it is the single source for the
         overlapping electrical/physical/compliance/fulfillment fields. Copy
         those schema_specs values into the matching legacy columns so
         LegacyProductView + the public API keep rendering. Spread last so it
         wins over the (now hidden) Technical-block column state. */
      Object.assign(
        productData,
        schemaColumnMirror(
          resolvedSchemaForSave.schema,
          product.schema_specs as Record<string, unknown>,
        ),
      );

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
          weight: num(m.weight),                    // gross / packed
          net_weight: num(m.net_weight),
          cbm: num(m.cbm),
          carton_dimensions: m.carton_dimensions || null,
          packing_type: m.packing_type || null,
          box_include: m.box_include || null,
          extra_accessories: m.extra_accessories || null,
          container_20ft_qty: m.container_20ft_qty ? parseInt(m.container_20ft_qty, 10) : null,
          container_40ft_qty: m.container_40ft_qty ? parseInt(m.container_40ft_qty, 10) : null,
          stock_status: m.stock_status || null,
          order: m.order,
          visible: m.visible,
          status: m.status,
          moq: m.moq ? parseInt(m.moq) : null,
          lead_time: m.lead_time || null,
          barcode: m.barcode || null,
          /* v30: KOLEEX 3-layer identity. Normalize the primary model to
             uppercase + strip whitespace before persisting so the
             partial-unique index does what we expect. Blank values stay
             null so the index ignores them. */
          primary_model: m.primary_model ? m.primary_model.trim().toUpperCase().replace(/\s+/g, "") : null,
          code_prefix: m.code_prefix ? m.code_prefix.trim().toUpperCase() : null,
          coding_status: m.coding_status || null,
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
          /* ── P0 #3 · Media upload feedback ──
             Name the file in any failure so the operator knows exactly
             which upload broke and can retry — instead of a generic
             error, or (worse) the product saving with the image
             silently dropped. */
          const fileLabel = item._file.name || `${item.type.replace(/_/g, " ")} file`;
          let uploaded;
          try {
            uploaded = await uploadProductFile(item._file);
          } catch (upErr) {
            throw new Error(`Couldn't upload "${fileLabel}": ${humanizeError(upErr)}`);
          }
          if (!uploaded) {
            throw new Error(t("media.uploadFailed").replace("{name}", fileLabel));
          }
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

      setSuccess(t("save.success", "Product saved successfully!"));
      /* Save succeeded → form is in sync with DB. Clear the dirty
         flag so the post-save router.push doesn't trip the
         beforeunload "leave this page?" warning. */
      setDirty(false);
      /* P0 #3 · the autosaved draft is now redundant — the DB holds the
         truth. Drop it so we don't offer to "restore" a stale copy. */
      setDraftMeta(null);
      if (typeof window !== "undefined") {
        try { window.localStorage.removeItem(draftKey); } catch { /* noop */ }
      }
      if (!isEdit) {
        setTimeout(() => router.push(`${baseRoute}/${pid}/edit`), 800);
      }
    } catch (err) {
      /* Humanize save failures — operators must never see raw Postgres /
         HTTP text. The form keeps its state (no reset), so the Save button
         doubles as Retry once the issue is addressed. */
      setError(humanizeError(err));
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

        {/* ═══ INLINE HEADER — matches AccountForm / EmployeeWizard style.
              Back-arrow + Cancel both route to /products via handleCancel,
              which warns when there are unsaved changes. Save publishes
              and clears the dirty flag inside `save()`. ═══ */}
        <div className="flex items-center justify-between mb-6 md:mb-8 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleCancel}
              className="h-9 w-9 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all shrink-0 cursor-pointer"
              title={dirty ? t("wizard.unsavedChangesTitle", "You have unsaved changes") : t("wizard.backToProducts", "Back to products")}
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-[26px] font-bold text-[var(--text-primary)] truncate">
                  {product.product_name || t("wizard.newProductHeading", "New Product")}
                </h1>
                {product.product_name && <StatusBadge status={product.status} t={t} />}
                {dirty && (
                  <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-[9px] font-bold uppercase tracking-wider text-amber-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    {t("wizard.unsaved", "Unsaved")}
                  </span>
                )}
              </div>
              <p className="text-[12px] md:text-[13px] text-[var(--text-dim)] mt-0.5">
                {product.product_name
                  ? t("wizard.editSubtitle", "Edit product details.")
                  : t("wizard.createSubtitle", "Create a new product in your catalogue.")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCancel}
              className="hidden sm:inline-flex items-center justify-center h-9 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all cursor-pointer"
            >
              {t("action.cancel", "Cancel")}
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="h-9 px-4 md:px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shrink-0"
            >
              {saving ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <DiskIcon className="h-4 w-4" />}
              <span className="hidden sm:inline">{saving ? t("action.saving", "Saving...") : t("action.saveProduct", "Save Product")}</span>
            </button>
          </div>
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

        {/* ═══ P0 #3 · DRAFT RECOVERY ═══
            Shown when an autosaved draft for this slot was found on
            mount. Restore loads it into the form (review-then-save);
            Discard throws it away and keeps whatever is loaded. The
            saved product is never touched automatically. */}
        {draftMeta && (
          <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-500">
                <DocumentIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="text-[13px] font-semibold leading-tight text-[var(--text-primary)]">
                  {t("draft.recovered", "Unsaved draft recovered")}
                </h4>
                <p className="mt-0.5 text-[11px] text-[var(--text-ghost)]">
                  {t("draft.recoveredBodyAt").replace("{when}", new Date(draftMeta.savedAt).toLocaleString())}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={discardDraft}
                  className="h-9 rounded-xl border border-[var(--border-subtle)] px-3 text-[12px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-subtle)]"
                >
                  {t("draft.discard", "Discard")}
                </button>
                <button
                  type="button"
                  onClick={restoreDraft}
                  className="h-9 rounded-xl bg-[var(--bg-inverted)] px-4 text-[12px] font-semibold text-[var(--text-inverted)] transition-opacity hover:opacity-90"
                >
                  {t("draft.restore", "Restore draft")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ NAVIGATION ═══
              Tabbed → clean sticky tab bar (each tab is its own screen).
              One-page → scrolling section index. Legacy → numbered stepper. */}
        {tabbed ? (
          <SectionTabs
            items={steps.map((s, i) => ({ index: i, id: s.id, label: s.shortLabel || s.label }))}
            activeIndex={currentStep}
            onSelect={goToStep}
          />
        ) : (
          <StepNav
            steps={steps}
            currentStep={currentStep}
            onStepChange={goToStep}
            completedSteps={completedSteps}
            lockedSteps={lockedSteps}
            issueCounts={stepIssueCount}
            t={t}
          />
        )}

        {/* "Raise Product Maturity" is a read-only meter, not an input. In the
            tabbed editor it appears only on the Review tab (so it never crowds
            the editing tabs); legacy step mode keeps it on top. */}
        {!onePage && !tabbed && <WizardKnowledgePanel knowledge={wizardKnowledge} />}
        {tabbed && steps[currentStep]?.id === "finalize" && (
          <WizardKnowledgePanel knowledge={wizardKnowledge} />
        )}

        {/* ═══ GLOBAL CLASSIFICATION BREADCRUMB (shown once classification is set, across all steps) ═══ */}
        {divisionName && steps[currentStep]?.id !== "classify" && (
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-ghost)] mb-4 px-1">
            <span className="font-bold uppercase tracking-wider text-[var(--text-dim)]">{t("wizard.classificationLabel", "Classification:")}</span>
            <span>{divisionName}</span>
            {categoryName && <><AngleRightIcon className="h-3 w-3" /><span>{categoryName}</span></>}
            {subcategoryName && <><AngleRightIcon className="h-3 w-3" /><span className="text-emerald-400 font-medium">{subcategoryName}</span></>}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           STEP: HERO (identity + primary model)
           ═══════════════════════════════════════════════════════════ */}
        <div className={onePage ? "space-y-10" : ""}>
        {(onePage || steps[currentStep]?.id === "identity") && (
          <div id="sec-identity" className="space-y-5 scroll-mt-28 animate-in fade-in duration-300">
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
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">{t("hero.mainPhotoLabel", "Main Product Photo")}</span>
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
                    /* Compact on narrow/stacked layouts (a full-width
                       aspect-square photo used to become a giant box that
                       buried Name + Code below the fold); only goes square on
                       lg where it sits in the 2/5 side column. No flex-1 so it
                       never stretches to match the tall fields column. */
                    className="relative w-full h-44 sm:h-52 lg:h-auto lg:aspect-square rounded-2xl overflow-hidden cursor-pointer group border-2 border-dashed border-[var(--border-subtle)] hover:border-[var(--border-focus)] transition-all bg-gradient-to-br from-[var(--bg-surface-subtle)] to-[var(--bg-surface)]"
                  >
                    {mainImageSrc ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={mainImageSrc} alt="Product" className="w-full h-full object-contain p-6" />
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                          <div className="flex items-center gap-2.5 bg-white/20 px-5 py-2.5 rounded-xl text-white text-[13px] font-medium backdrop-blur-sm">
                            <CameraIcon className="h-4 w-4" />
                            {t("media.changePhoto", "Change Photo")}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 group-hover:scale-105 transition-transform duration-300">
                        <div className="h-20 w-20 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shadow-lg">
                          <ImageRawIcon className="h-9 w-9 text-[var(--text-ghost)]" />
                        </div>
                        <div className="text-center">
                          <p className="text-[14px] font-semibold text-[var(--text-dim)]">{t("hero.uploadPhoto", "Upload Product Photo")}</p>
                          <p className="text-[11px] text-[var(--text-ghost)] mt-1">{t("hero.dropHint", "Click to browse or drag & drop")}</p>
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
                        { v: "draft", label: t("status.draft", "Draft"), cls: "text-amber-400 bg-amber-400/15" },
                        { v: "active", label: t("status.active", "Active"), cls: "text-emerald-400 bg-emerald-400/15" },
                        { v: "archived", label: t("status.archived", "Archived"), cls: "text-red-400 bg-red-400/15" },
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
                      title={product.featured ? t("hero.featuredOnHome", "Featured on homepage") : t("hero.clickToFeature", "Click to feature on homepage")}
                    >
                      <StarIcon className="h-3 w-3" />
                      {product.featured ? t("hero.featured", "Featured") : t("hero.feature", "Feature")}
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
                      title={product.visible ? t("hero.visibleOnCatalog", "Visible on public catalog") : t("hero.hiddenFromCatalog", "Hidden from public catalog")}
                    >
                      {product.visible ? <EyeIcon className="h-3 w-3" /> : <EyeOffIcon className="h-3 w-3" />}
                      {product.visible ? t("hero.visible", "Visible") : t("hero.hidden", "Hidden")}
                    </button>

                    {/* Level pills — shopper-facing tier. Drives price
                        tier + catalog filtering. */}
                    <div className="flex items-center gap-1 ml-auto">
                      {([
                        { v: "entry", label: t("hero.levelEntry", "Entry") },
                        { v: "mid", label: t("hero.levelMid", "Mid") },
                        { v: "premium", label: t("hero.levelPremium", "Premium") },
                        { v: "enterprise", label: t("hero.levelEnterprise", "Enterprise") },
                      ] as const).map(l => {
                        const active = product.level === l.v;
                        return (
                          <button
                            key={l.v}
                            type="button"
                            onClick={() => updateProduct_({ level: active ? "" : l.v })}
                            /* Level is a tier, not a status — monochrome per the
                               Koleex system (selected = inverted, no decorative colour). */
                            className={`h-7 px-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
                              active
                                ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-[var(--bg-inverted)]"
                                : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)] hover:border-[var(--border-focus)]"
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
                      <label className="block text-[10px] font-bold text-[var(--text-ghost)] uppercase tracking-wider">{t("hero.productNameLabel", "Product Name *")}</label>
                      {product.product_name && (
                        <span className="text-[10px] text-[var(--text-ghost)]">
                          {t("hero.charsCount", `${product.product_name.length} chars`).replace("{n}", String(product.product_name.length))}
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
                      placeholder={t("hero.productNamePlaceholder", "e.g. KX Lockstitch Industrial 9500")}
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
                        <span className="inline-flex items-center gap-1.5"><SparklesIcon className="h-3 w-3" /> {t("hero.tagline", "Tagline")}</span>
                      </label>
                      <span className="text-[10px] text-[var(--text-ghost)]">
                        {t("hero.taglineMeta").replace("{n}", String((primaryModel?.tagline || "").length))}
                      </span>
                    </div>
                    {/* Tagline is rendered at 32px on the public hero and
                        was designed to fit comfortably in one line at
                        ≤ 80 characters. The old maxLength=140 let admins
                        type past that and contradicted the "char / 80"
                        counter. Hard cap at 80 so WYSIWYG matches the
                        rendered page. */}
                    <input
                      type="text"
                      value={primaryModel?.tagline || ""}
                      onChange={(e) => updatePrimaryModel({ tagline: e.target.value })}
                      placeholder={t("hero.taglinePlaceholder", "e.g. Precision jetted pockets at 3-second cycle.")}
                      maxLength={80}
                      className="w-full h-12 px-5 rounded-xl bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-all"
                    />
                  </div>

                  {/* Primary Model — the canonical KOLEEX commercial code.
                      Single source of truth for the 3-layer identity:
                      classification prefix (left chip) + editable code
                      (center input) + workflow actions (right buttons).
                      Bound to product_models.primary_model; writes are
                      mirrored into model_name + slug so the downstream
                      barcode / URL / SKU paths keep working. */}
                  {(() => {
                    const code = primaryModel?.primary_model || primaryModel?.model_name || "";
                    const status = primaryModel?.coding_status;
                    const validation = code ? validatePrimaryModel(code, resolvedPrefix) : null;
                    const validationError = validation && !validation.ok ? validation.reason : null;
                    const validationWarning = validation && validation.ok ? validation.warning : null;
                    /* Live-uniqueness state — checked against the server.
                       A taken code blocks Approve AND Save (see canSave
                       below the action row). */
                    const isTaken = codeCheck.status === "taken";
                    const isChecking = codeCheck.status === "checking";
                    const canApprove =
                      !!code &&
                      !validationError &&
                      !isTaken &&
                      !isChecking &&
                      status !== "approved" &&
                      status !== "locked";
                    const canReset = !!suggestedPrimaryModel && code !== suggestedPrimaryModel && status !== "locked";
                    const isLocked = status === "locked";
                    const statusLabel =
                      status === "edited" ? t("hero.statusEdited", "Edited") :
                      status === "approved" ? t("hero.statusApproved", "Approved") :
                      status === "locked" ? t("hero.statusLocked", "Locked") :
                      status === "auto_suggested" ? t("hero.statusAuto", "Auto") :
                      null;
                    const statusCls =
                      status === "approved" || status === "locked"
                        ? "border-emerald-500/50 text-emerald-600 dark:text-emerald-300"
                        : status === "edited"
                          ? "border-[var(--text-primary)] text-[var(--text-primary)]"
                          : "border-[var(--border-subtle)] text-[var(--text-ghost)]";

                    return (
                      <div>
                        {/* Label row — title + suggested hint + status pill */}
                        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                          <label className="block text-[10px] font-bold text-[var(--text-ghost)] uppercase tracking-wider">
                            <span className="inline-flex items-center gap-1.5"><TagsIcon className="h-3 w-3" /> {t("hero.primaryModelLabel", "Primary Model · KOLEEX Code")}</span>
                          </label>
                          <div className="flex items-center gap-2">
                            {suggestedPrimaryModel && code && code !== suggestedPrimaryModel && (
                              <span className="text-[10px] text-[var(--text-ghost)]">
                                {t("hero.suggested", "Suggested:")} <span className="font-mono font-semibold text-[var(--text-primary)]">{suggestedPrimaryModel}</span>
                              </span>
                            )}
                            {statusLabel && (
                              <span className={`text-[9.5px] font-bold uppercase tracking-[0.16em] px-1.5 py-0.5 rounded-full border ${statusCls}`}>
                                {statusLabel}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Editor strip — prefix chip · input · reset · approve.
                            Flex+wrap so on narrow screens the buttons drop to
                            a new line without ever crowding the input. */}
                        <div className="flex items-stretch gap-2 flex-wrap">
                          {/* Classification prefix chip (read-only — inherited
                              from the selected subcategory). */}
                          {resolvedPrefix ? (
                            <div
                              className="h-12 px-3.5 rounded-xl border border-[var(--text-primary)] bg-[var(--bg-surface)] flex items-center font-mono text-[14px] font-bold tracking-[0.06em] text-[var(--text-primary)] shrink-0"
                              title={t("hero.prefixChipTitle", "Classification prefix — inherited from the selected subcategory.")}
                            >
                              {resolvedPrefix}
                            </div>
                          ) : (
                            <div
                              className="h-12 px-3.5 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] flex items-center text-[10.5px] text-[var(--text-faint)] shrink-0"
                              title={t("hero.pickSubcategoryTitle", "Pick a subcategory to inherit a classification prefix.")}
                            >
                              {t("hero.pickSubcategory", "PICK SUBCATEGORY")}
                            </div>
                          )}

                          {/* The code input itself — the canonical editor. */}
                          <input
                            type="text"
                            value={code}
                            disabled={isLocked}
                            onChange={(e) => {
                              const next = e.target.value.toUpperCase().replace(/\s+/g, "");
                              updatePrimaryModel({
                                primary_model: next,
                                model_name: next,
                                slug: slugify(next),
                                code_prefix: resolvedPrefix || primaryModel?.code_prefix || "",
                                coding_status:
                                  next === suggestedPrimaryModel
                                    ? "auto_suggested"
                                    : "edited",
                              });
                            }}
                            onBlur={(e) => {
                              const normalized = normalizeKoleexCode(e.target.value);
                              if (normalized !== e.target.value) {
                                updatePrimaryModel({
                                  primary_model: normalized,
                                  model_name: normalized,
                                  slug: slugify(normalized),
                                });
                              }
                            }}
                            placeholder={
                              suggestedPrimaryModel ||
                              (resolvedPrefix ? `${resolvedPrefix}-…` : t("hero.codePlaceholder", "e.g. XCS-7800"))
                            }
                            className={`flex-1 min-w-[180px] h-12 px-5 rounded-xl bg-[var(--bg-surface-subtle)]/70 border ${
                              isTaken
                                ? "border-red-500/70 focus:border-red-500"
                                : "border-[var(--border-subtle)] focus:border-[var(--border-focus)]"
                            } text-[15px] font-bold font-mono tracking-[0.04em] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed`}
                          />

                          {/* Reset to auto-suggested — only enabled when the
                              current code differs from the suggestion. */}
                          <button
                            type="button"
                            onClick={() => {
                              if (!suggestedPrimaryModel) return;
                              updatePrimaryModel({
                                primary_model: suggestedPrimaryModel,
                                model_name: suggestedPrimaryModel,
                                slug: slugify(suggestedPrimaryModel),
                                code_prefix: resolvedPrefix,
                                coding_status: "auto_suggested",
                              });
                            }}
                            disabled={!canReset}
                            className="h-12 px-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11.5px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
                            title={t("hero.resetToAuto", "Reset to the auto-suggested code")}
                          >
                            <span aria-hidden>↺</span>
                            {t("hero.reset", "Reset")}
                          </button>

                          {/* Approve — locks the code as commercially blessed.
                              Disabled when already approved/locked or invalid. */}
                          <button
                            type="button"
                            onClick={() => {
                              if (!canApprove) return;
                              updatePrimaryModel({ coding_status: "approved" });
                            }}
                            disabled={!canApprove}
                            className="h-12 px-3.5 rounded-xl border border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)] text-[11.5px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
                            title={status === "approved" ? t("hero.alreadyApproved", "Already approved") : status === "locked" ? t("hero.statusLocked", "Locked") : t("hero.markApproved", "Mark as approved")}
                          >
                            <span aria-hidden>✓</span>
                            {status === "approved" ? t("hero.statusApproved", "Approved") : status === "locked" ? t("hero.statusLocked", "Locked") : t("hero.approve", "Approve")}
                          </button>
                        </div>

                        {/* Validation + helper line. Single source of truth — no
                            duplicate panel below. Order of precedence:
                              1. Structural validation error
                              2. Live uniqueness collision (taken)
                              3. Uniqueness checking spinner
                              4. Uniqueness all-clear (only when code differs
                                 from the suggestion, to avoid noise)
                              5. Prefix-mismatch warning
                              6. Default helper text. */}
                        {validationError ? (
                          <p className="text-[11px] text-red-500 mt-2">{validationError}</p>
                        ) : isTaken && codeCheck.status === "taken" ? (
                          <p className="text-[11px] text-red-500 mt-2 leading-relaxed">
                            <span className="font-semibold">{t("model.codeInUseInline", "Code already in use.")}</span>{" "}
                            <span className="font-mono font-bold">{codeCheck.conflict.primary_model}</span>{" "}
                            {t("model.codeBelongsTo", "belongs to")}{" "}
                            {codeCheck.conflict.product_slug ? (
                              <a
                                href={`/admin/products/${codeCheck.conflict.product_id}`}
                                className="font-semibold underline underline-offset-2 hover:text-red-400"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {codeCheck.conflict.product_name} · {codeCheck.conflict.model_name}
                              </a>
                            ) : (
                              <span className="font-semibold">
                                {codeCheck.conflict.product_name} · {codeCheck.conflict.model_name}
                              </span>
                            )}
                            . {t("model.pickDifferentNumber", "Pick a different number after the prefix.")}
                          </p>
                        ) : isChecking ? (
                          <p className="text-[11px] text-[var(--text-ghost)] mt-2">
                            {t("model.checking", "Checking if this code is available…")}
                          </p>
                        ) : codeCheck.status === "available" && code && code !== suggestedPrimaryModel ? (
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-2">
                            ✓ {t("model.availableInline", "Available — no other product uses this code.")}
                          </p>
                        ) : codeCheck.status === "error" && code ? (
                          /* P0 #4 · the live check couldn't reach the server.
                             Be honest, and reassure that Save still verifies
                             (the save-time re-check + DB unique index). */
                          <p className="text-[11px] text-amber-500 mt-2">
                            {t("model.unableToVerify", "Couldn't verify this code right now — we'll re-check it when you save.")}
                          </p>
                        ) : validationWarning ? (
                          <p className="text-[11px] text-amber-500 mt-2">{validationWarning}</p>
                        ) : (
                          <p className="text-[10px] text-[var(--text-ghost)] mt-2 leading-relaxed">
                            {t("model.helperText", "KOLEEX commercial code — auto-suggested from the classification prefix + supplier model below, freely editable. Codes are unique across the catalog. Supplier model stays untouched as the factory reference.")}
                          </p>
                        )}
                      </div>
                    );
                  })()}

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
                    t={t}
                  />

                  {/* Brand · Family · Origin · Warranty
                      lg:grid-cols-4 (not xl:) — every laptop 1024px+
                      fits all four cells on one row. The old
                      xl:grid-cols-4 meant 1024–1280px screens wrapped
                      Origin + Warranty onto a second row awkwardly. */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className={lbl}>
                        <span className="inline-flex items-center gap-1.5"><StarIcon className="h-3 w-3" /> {t("hero.brand", "Brand")}</span>
                      </label>
                      <SelectWithCreate
                        value={product.brand}
                        options={brands.map(b => {
                          const slug = b.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                          return { value: b, label: b, icon: brandLogos[slug] || null };
                        })}
                        onChange={(val) => updateProduct_({ brand: val })}
                        onClickCreate={() => setShowBrandModal(true)}
                        placeholder={t("hero.selectBrand", "Select brand...")}
                        createLabel={t("hero.createBrand", "Create Brand")}
                      />
                    </div>
                    <div>
                      <label className={lbl}>
                        <span className="inline-flex items-center gap-1.5"><PackageIcon className="h-3 w-3" /> {t("hero.familySeries", "Family / Series")}</span>
                      </label>
                      <input
                        type="text"
                        value={product.family}
                        onChange={(e) => updateProduct_({ family: e.target.value })}
                        placeholder={t("hero.familyPlaceholder", "e.g. Pro Line")}
                        className={inp}
                      />
                    </div>
                    {/* Country of Origin moved to the dedicated Logistics tab —
                        it's customs/shipping data, not hero identity. */}
                    <div>
                      <label className={lbl}>
                        <span className="inline-flex items-center gap-1.5"><ShieldCheckIcon className="h-3 w-3" /> {t("hero.warranty", "Warranty")}</span>
                      </label>
                      <input
                        type="text"
                        value={product.warranty}
                        onChange={(e) => updateProduct_({ warranty: e.target.value })}
                        placeholder={t("hero.warrantyPlaceholder", "e.g. 2 years parts & labour")}
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
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">{t("hero.commercialStrip", "Primary Commercial · Supplier & Pricing")}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className={lbl}>
                      <span className="inline-flex items-center gap-1.5"><FactoryIcon className="h-3 w-3" /> {t("hero.supplier", "Supplier")}</span>
                    </label>
                    <SelectWithCreate
                      value={primaryModel?.supplier || ""}
                      options={suppliers.map(s => ({ value: s.name, label: s.name, icon: s.logo }))}
                      onChange={(val) => updatePrimaryModel({ supplier: val })}
                      onClickCreate={() => { setSupplierTarget("hero"); setShowSupplierModal(true); }}
                      placeholder={t("hero.selectSupplier", "Select supplier...")}
                      createLabel={t("hero.createSupplier", "Create Supplier")}
                    />
                  </div>
                  <div>
                    <label className={lbl}>{t("hero.supplierModel", "Supplier Model")}</label>
                    <input
                      type="text"
                      value={primaryModel?.reference_model || ""}
                      onChange={(e) => updatePrimaryModel({ reference_model: e.target.value })}
                      placeholder={t("hero.supplierModelPlaceholder", "e.g. JUKI DDL-8700H")}
                      className={inp}
                    />
                    <p className="text-[10px] text-[var(--text-ghost)] mt-1">
                      {t("hero.supplierModelHint", "The factory's own model code. Helps operations match invoices + spare parts.")}
                    </p>
                  </div>
                  <div>
                    {/* Cost is what Koleex pays the Chinese factory —
                        stored + entered in CNY (¥). The selling price
                        below stays in USD since we sell globally. */}
                    <label className={lbl}>{t("hero.costPrice", "Cost Price (CNY)")}</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-[var(--text-ghost)]">¥</span>
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
                    <label className={lbl}>{t("hero.globalPrice", "Global Selling Price (USD)")}</label>
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

                {/* Auto-generated codes for the primary model — uses the
                    KOLEEX primary_model when set so the approved code is
                    the one that lands on the barcode + QR. */}
                {primaryModel?.model_name && (
                  <div className="mt-5 pt-5 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">{t("hero.autoCodes", "Auto-Generated Codes")}</span>
                    </div>
                    <BarcodeQRDisplay
                      value={
                        primaryModel.primary_model ||
                        primaryModel.barcode ||
                        primaryModel.slug ||
                        primaryModel.model_name
                      }
                      label={primaryModel.primary_model || primaryModel.model_name}
                      qrPayload={JSON.stringify({
                        koleex_code: primaryModel.primary_model || null,
                        sku: primaryModel.slug,
                        name: primaryModel.model_name,
                        ref: primaryModel.reference_model,
                      })}
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
              title={t("hero.shortDescription", "Short Description")}
              badge={t("hero.shortDescBadge", "Cards · SEO · Quotes")}
            >
              <div>
                <textarea
                  value={product.excerpt}
                  onChange={(e) => updateProduct_({ excerpt: e.target.value })}
                  placeholder={t("hero.excerptPlaceholder", "One or two sentences that summarise this product — shown on product cards and used as the SEO meta description.")}
                  rows={3}
                  maxLength={320}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-all resize-none"
                />
                <p className="text-[10px] mt-1.5 flex items-center justify-between text-[var(--text-ghost)]">
                  <span>{t("hero.excerptSeoHint", "Aim for under 160 characters for best SEO display.")}</span>
                  <span className={product.excerpt.length > 160 ? "text-amber-400 font-semibold" : ""}>
                    {product.excerpt.length} / 320{product.excerpt.length > 160 ? ` · ${t("hero.excerptOverSeo", "over SEO limit")}` : ""}
                  </span>
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
              title={t("hero.keyHighlights", "Key Highlights")}
              badge={`${product.highlights.length} / 5`}
            >
              <HighlightsEditor
                highlights={product.highlights}
                onChange={(highlights) => updateProduct_({ highlights })}
                t={t}
              />
            </Section>

            {/* Tags */}
            <Section id="tags" icon={<TagsIcon className="h-4 w-4" />} title={t("hero.tagsTitle", "Tags & Keywords")}>
              <TagsInput
                tags={product.tags}
                onChange={(tags) => updateProduct_({ tags })}
                suggestions={allTags}
                t={t}
              />
            </Section>

            {/* ── Preview as customer ──
                  Opens the public product detail page in a new tab
                  so the admin can sanity-check how the product will
                  render before publishing.

                  Only works for SAVED products. A fresh new product
                  has a slug auto-filled from its name but no DB row
                  yet, so /products/<slug> would 404. Show a disabled
                  hint on new products instead of a clickable link. */}
            <div className="flex justify-end">
              {isEdit && product.slug ? (
                <a
                  href={`/products/${product.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all"
                >
                  <ExternalLinkIcon className="h-3.5 w-3.5" />
                  {t("hero.previewAsCustomer", "Preview as customer")}
                </a>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[var(--bg-surface-subtle)]/50 border border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-ghost)] cursor-not-allowed"
                  title={t("hero.previewAfterSaveTitle", "Save the product first to preview its public page")}
                >
                  <ExternalLinkIcon className="h-3.5 w-3.5" />
                  {t("hero.previewAfterSave", "Preview (available after save)")}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           STEP 2: CLASSIFICATION
           ═══════════════════════════════════════════════════════════ */}
        {(onePage || steps[currentStep]?.id === "classify") && (
          <div id="sec-classify" className="space-y-5 scroll-mt-28 animate-in fade-in duration-300">
            <Section
              id="classification"
              icon={<FolderTreeIcon className="h-4 w-4" />}
              title={t("classify.title", "Classification")}
              badge={isSewing ? t("classify.badgeWithKind", "Division · Category · Subcategory · Kind") : t("classify.badge", "Division · Category · Subcategory")}
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
        {(onePage || steps[currentStep]?.id === "description") && (
          <div id="sec-description" className="space-y-5 scroll-mt-28 animate-in fade-in duration-300">
            {/* Classification breadcrumb used to repeat here, but the
                same chips already appear in the Classify step and at
                the top of the wizard. Showing them a third time was
                noise — the StepNav's "Classify ✓" badge already
                signals the admin they're past classification. */}

            <Section id="description" icon={<DocumentIcon className="h-4 w-4" />} title={t("description.title", "Product Description")} badge={t("description.badgeRichText", "Rich text")}>
              {/* Pass the classification down so Quick Start Blocks
                  return lockstitch / overlock / automatic copy
                  tailored to the admin's choice. The machine-kind
                  slug lives on sewingSpecs.common_specs.machine_kind
                  (see the Classify step's wiring). */}
              <DescriptionSection
                data={product}
                onChange={updateProduct_}
                subcategorySlug={product.subcategory_slug}
                machineKindSlug={
                  (sewingSpecs.common_specs as { machine_kind?: string })?.machine_kind || ""
                }
              />
            </Section>

            {/* The legacy "Additional Specifications" key/value table
                has been removed from the wizard. Now that the three-tier
                structured Specs step (Common + Family + Kind) covers the
                full sewing-machine spec universe, the inline freeform
                table was a third place where data could land — pure
                ambiguity. The SpecsSection component still exists in
                form-sections/ for any future use; it's just not wired
                into the wizard. */}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           STEP: PRODUCT KNOWLEDGE
           Authors products.schema_knowledge — the layer that powers the
           customer-page knowledge sections, quotes, brochures and the AI
           assistant. Until now these blocks could only be set via API/SQL;
           this is the in-form editor for all 14 knowledge types.
           ═══════════════════════════════════════════════════════════ */}
        {(onePage || steps[currentStep]?.id === "knowledge") && (
          <div id="sec-knowledge" className="space-y-5 scroll-mt-28 animate-in fade-in duration-300">
            <Section
              id="knowledge"
              icon={<BookOpenIcon className="h-4 w-4" />}
              title={t("knowledge.title", "Product Knowledge")}
              badge={t("knowledge.badge", "Customer page · Quote · AI")}
            >
              <KnowledgeSection
                blocks={(product.schema_knowledge as ProductKnowledgeBlock[]) || []}
                onChange={(blocks) => updateProduct_({ schema_knowledge: blocks })}
              />
            </Section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           STEP: SEWING MACHINE SPECS (conditional — after description)
           Machine Type is now a 4th tier inside the Classify step,
           so this step only renders the dynamic spec fields driven
           by the template the kind chose.
           ═══════════════════════════════════════════════════════════ */}
        {onePage && isSewing && <div id="sec-sewing" className="scroll-mt-28" aria-hidden />}
        {steps[currentStep]?.id === "specs" && isSewing && (() => {
          /* Schema-driven specs — the canonical structured editor that
             writes product.schema_specs (the data that lights up the
             public product page, quotes, brochures, AI). Resolved from
             the current Division → Category → Subcategory classification.
             The legacy free-form SewingMachineSection stays below as a
             fallback for classifications without a published schema. */
          const specsSchema = resolveSchema({
            divisionCode: product.division_slug || "",
            categoryCode: product.category_slug || "",
            subcategoryCode: selectedSubcategory?.code || "",
          }).schema;
          return (
            <div className="space-y-5 animate-in fade-in duration-300">
              {specsSchema ? (
                <Section
                  id="schema-specs"
                  icon={<Settings2Icon className="h-4 w-4" />}
                  title={t("specs.productSpecs", "Product Specs")}
                  badge={t("specs.badgeStructured", "Structured · Multi-surface")}
                >
                  <SchemaSpecsSection
                    schema={specsSchema}
                    values={product.schema_specs || {}}
                    onChange={(next) => updateProduct_({ schema_specs: next })}
                  />
                </Section>
              ) : null}

              <Section
                id="sewing"
                icon={<Settings2Icon className="h-4 w-4" />}
                title={specsSchema ? t("specs.additionalLegacy", "Additional / Legacy Specs") : t("specs.machineSpecs", "Machine Specs")}
                badge={sewingSpecs.template_slug ? sewingSpecs.template_slug.replace(/-/g, " ") : undefined}
                defaultOpen={!specsSchema}
              >
                <SewingMachineSection
                  data={sewingSpecs}
                  onChange={setSewingSpecs}
                  subcategorySlug={product.subcategory_slug}
                  mode="specs"
                />
              </Section>
            </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════════
           STEP N: TECHNICAL DETAILS
           ═══════════════════════════════════════════════════════════ */}
        {steps[currentStep]?.id === "specs" && (
          <div id="sec-technical" className="space-y-5 scroll-mt-28 animate-in fade-in duration-300">
            {/* ── Hero-ownership note ──
                  Visibility (Visible/Featured), Marketing (Level,
                  Warranty), and URL basics (Slug, Made-in) used to
                  appear as full form widgets inside Technical —
                  duplicating Hero's editors and causing desync
                  risk identical to the one we closed on Models.
                  Removed them entirely; a compact banner points
                  admins at Hero when they need those fields. */}
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <div className="h-6 w-6 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <SparklesIcon className="h-3 w-3" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-[var(--text-primary)]">
                  {t("technical.heroNoticeTitle", "Publishing & marketing fields live on the Hero step.")}
                </p>
                <p className="text-[10px] text-[var(--text-ghost)] mt-0.5 leading-relaxed">
                  {t("technical.heroNoticeBody", "Visibility, Featured, Level, Warranty, Slug, and Made-in are edited on Hero — the single source of truth for customer-facing identity. This step focuses on electrical / physical specs and internal operations.")}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const heroIdx = steps.findIndex((s) => s.id === "identity");
                    if (heroIdx >= 0) goToStep(heroIdx);
                  }}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 transition-colors mt-2"
                >
                  <ArrowUpRightIcon className="h-3 w-3" />
                  {t("technical.jumpToHero", "Jump to Hero")}
                </button>
              </div>
            </div>

            {technicalHasVisibleField ? (
              <Section id="technical" icon={<ZapIcon className="h-4 w-4" />} title={t("technical.title", "Technical Details")} badge={t("technical.badge", "Electrical · Physical")}>
                <TechnicalSection data={product} onChange={updateProduct_} suggestions={attrSuggestions} hiddenFields={schemaCoveredCols} />
              </Section>
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
                <ZapIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-ghost)]" />
                <p className="text-[11px] leading-relaxed text-[var(--text-ghost)]">
                  {t("technical.coveredBySpecs", "Electrical, physical and compliance specs for this category are captured in the structured Product Specs above — entered once, no duplicate fields here.")}
                </p>
              </div>
            )}

            {/* Purchase Options — unique to this step (not on Hero).
                Visibility / Featured / Warranty / Level moved up to
                Hero when we redesigned Hero as the publishing hub. */}
            {!purchaseCoveredBySchema && (
            <Section id="config" icon={<Settings2Icon className="h-4 w-4" />} title={t("technical.purchaseOptions", "Purchase Options")} badge={t("technical.purchaseBadge", "Head-only · Complete set")}>
              <div className="space-y-3">
                <p className="text-[11px] text-[var(--text-ghost)] italic">
                  {t("technical.purchaseHint", "Which configurations can customers actually order for this product.")}
                </p>
                <Toggle checked={product.supports_head_only} onChange={(v) => updateProduct_({ supports_head_only: v })} label={t("technical.supportsHeadOnly", "Supports head-only purchase")} />
                <Toggle checked={product.supports_complete_set} onChange={(v) => updateProduct_({ supports_complete_set: v })} label={t("technical.supportsCompleteSet", "Supports complete set purchase")} />
              </div>
            </Section>
            )}

            {/* Fulfillment Defaults — collapsed by default. Slug and
                Country of Origin moved to Hero; this section now
                only holds the product-level MOQ + Lead Time that
                cascade to new variants. */}
            {!fulfillmentCoveredBySchema && (
            <Section id="advanced" icon={<WrenchIcon className="h-4 w-4" />} title={t("technical.fulfillmentDefaults", "Fulfillment Defaults")} badge={t("technical.fulfillmentBadge", "MOQ · Lead Time")} defaultOpen={false}>
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>{t("technical.defaultMoq", "Default MOQ (Product-level)")}</label>
                    <input
                      type="number"
                      value={product.moq}
                      onChange={(e) => updateProduct_({ moq: e.target.value })}
                      placeholder={t("technical.moqPlaceholder", "e.g. 10")}
                      className={inp}
                    />
                    <p className="text-[10px] text-[var(--text-ghost)] mt-1">{t("technical.moqOverrideHint", "Per-model MOQ in the Models step overrides this.")}</p>
                  </div>
                  <div>
                    <label className={lbl}>{t("technical.defaultLeadTime", "Default Lead Time")}</label>
                    <input
                      type="text"
                      value={product.lead_time}
                      onChange={(e) => updateProduct_({ lead_time: e.target.value })}
                      placeholder={t("technical.leadTimePlaceholder", "e.g. 7-14 days")}
                      className={inp}
                    />
                    <p className="text-[10px] text-[var(--text-ghost)] mt-1">{t("technical.leadTimeOverrideHint", "Per-model Lead Time in the Models step overrides this.")}</p>
                  </div>
                </div>
              </div>
            </Section>
            )}

            {/* INV-H1 — Stock Profile (tenant-scoped inventory_items row). */}
            {productId && (
              <Section id="stock-profile" icon={<BoxIcon className="h-4 w-4" />} title={t("technical.stockProfile", "Stock Profile")} badge={t("technical.stockBadge", "Inventory")} defaultOpen={false}>
                <ProductStockProfile productId={productId} />
              </Section>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           STEP N: MODELS & VARIANTS
           ═══════════════════════════════════════════════════════════ */}
        {(onePage || steps[currentStep]?.id === "commercial") && (
          <div id="sec-commercial" className="space-y-5 scroll-mt-28 animate-in fade-in duration-300">
            {/* The redundant "Primary Model reminder" banner used to
                live here. It said "Identity & pricing entered in the
                Hero" — which was true but misleading, because the
                ModelCard below STILL let admins edit the same fields,
                causing Hero ⇄ Models desync. Now the primary card
                itself makes the Hero-basics-are-read-only story
                explicit, so the banner is redundant and removed. */}

            <Section
              id="models"
              icon={<BoxesIcon className="h-4 w-4" />}
              title={t("models.title", "Models & Variants")}
              badge={t("models.countBadge", `${models.length} models`).replace("{n}", String(models.length))}
            >
              <ModelsSection
                models={models}
                onChange={setModels}
                suppliers={suppliers}
                onClickCreateSupplier={(tempId) => { setSupplierTarget(tempId); setShowSupplierModal(true); }}
                hidePrimary={false}
                onEditInHero={() => {
                  const heroIdx = steps.findIndex((s) => s.id === "identity");
                  if (heroIdx >= 0) goToStep(heroIdx);
                }}
              />
            </Section>

            {/* Market Prices */}
            <Section id="prices" icon={<DollarSignIcon className="h-4 w-4" />} title={t("models.marketPrices", "Market Prices")} badge={t("models.perCountry", "Per country")} defaultOpen={false}>
              <MarketPricesSection prices={prices} models={models} onChange={setPrices} />
            </Section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           STEP 5: MEDIA & FILES
           ═══════════════════════════════════════════════════════════ */}
        {/* ═══════════════════════════════════════════════════════════
           STEP: LOGISTICS — product-level customs/origin. Per-model
           packing, carton, CBM and container quantities live on the
           Commercial step (they differ per variant); this tab points
           there rather than duplicating them.
           ═══════════════════════════════════════════════════════════ */}
        {(onePage || steps[currentStep]?.id === "logistics") && (
          <div id="sec-logistics" className="space-y-5 scroll-mt-28 animate-in fade-in duration-300">
            <Section id="logistics-origin" icon={<GlobeIcon className="h-4 w-4" />} title={t("logistics.title", "Origin & Customs")} badge={t("logistics.badge", "Shipping · Customs")}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>
                    <span className="inline-flex items-center gap-1.5"><GlobeIcon className="h-3 w-3" /> {t("logistics.countryOfOrigin", "Country of Origin")}</span>
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
                {!schemaCoveredCols.has("hs_code") ? (
                  <div>
                    <label className={lbl}>{t("logistics.hsCode", "HS Code")}</label>
                    <input
                      type="text"
                      value={product.hs_code}
                      onChange={(e) => updateProduct_({ hs_code: e.target.value })}
                      placeholder="e.g. 8452.21"
                      className={inp}
                    />
                    <p className="text-[10px] text-[var(--text-ghost)] mt-1">{t("logistics.hsHint", "Harmonized System tariff code.")}</p>
                  </div>
                ) : (
                  <div className="flex items-end">
                    <p className="text-[11px] leading-relaxed text-[var(--text-ghost)]">{t("logistics.hsInSpecs", "HS Code for this category is set in the Specifications tab (Compliance & Customs).")}</p>
                  </div>
                )}
              </div>
            </Section>

            <div className="flex items-start gap-3 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
              <BoxIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-ghost)]" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-[var(--text-primary)]">{t("logistics.packingTitle", "Packing & shipment are per-model")}</p>
                <p className="text-[10px] text-[var(--text-ghost)] mt-0.5 leading-relaxed">{t("logistics.packingBody", "Packing type, carton dimensions, CBM, net/gross weight and 20ft/40ft container quantities are entered per variant on the Commercial tab.")}</p>
                <button
                  type="button"
                  onClick={() => { const i = steps.findIndex((s) => s.id === "commercial"); if (i >= 0) goToStep(i); }}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold text-[var(--text-primary)] bg-[var(--bg-base)] hover:bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] transition-colors mt-2"
                >
                  <ArrowUpRightIcon className="h-3 w-3" /> {t("logistics.jumpCommercial", "Open Commercial")}
                </button>
              </div>
            </div>
          </div>
        )}

        {(onePage || steps[currentStep]?.id === "media") && (
          <div id="sec-media" className="space-y-5 scroll-mt-28 animate-in fade-in duration-300">
            <Section id="media" icon={<ImageRawIcon className="h-4 w-4" />} title={t("media.filesTitle", "Media & Files")}>
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
        {onePage && <div id="sec-finalize" className="scroll-mt-28" aria-hidden />}
        {(onePage || steps[currentStep]?.id === "finalize") && (() => {
          /* ══════════════════════════════════════════════════════════
             REVIEW & PUBLISH — computed context for this step.
             All derived values + click-jump handlers live in this
             IIFE so the render block below stays clean.
             ══════════════════════════════════════════════════════════ */
          const jumpTo = (id: string) => {
            const idx = steps.findIndex((s) => s.id === id);
            if (idx >= 0) goToStep(idx);
          };

          /* Resolve the machine kind display name so the summary
             doesn't show an internal slug. Falls back to the
             template name, then "—" when neither is set. */
          const kindSlug = (sewingSpecs.common_specs as { machine_kind?: string })?.machine_kind || "";
          const kind = kindSlug ? getKindBySlug(kindSlug) : null;
          const templateName = kind?.name
            || (sewingSpecs.template_slug
              ? sewingSpecs.template_slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
              : null);

          /* Pre-save missing-fields check. Only flags the genuinely-
             required fields we marked on Hero + Specs. Each issue
             carries the step id so the banner can offer a jump. */
          const missing: { label: string; step: string }[] = [];
          if (!product.product_name.trim()) missing.push({ label: t("field.productName", "Product Name"), step: "identity" });
          if (!product.division_slug) missing.push({ label: t("field.division", "Division"), step: "classify" });
          if (!product.category_slug) missing.push({ label: t("field.category", "Category"), step: "classify" });
          if (!product.subcategory_slug) missing.push({ label: t("field.subcategory", "Subcategory"), step: "classify" });
          /* Machine Kind is OPTIONAL — refines the spec template when
             chosen, but never blocks save. Intentionally not flagged. */
          if (isSewing) {
            const cs = sewingSpecs.common_specs as Record<string, unknown>;
            if (!cs.max_sewing_speed) missing.push({ label: "Max Sewing Speed", step: "specs" });
            if (!cs.needle_system) missing.push({ label: "Needle System", step: "specs" });
            if (!cs.motor_type) missing.push({ label: "Motor Type", step: "specs" });
          }
          /* Every variant needs a price before publish — a model with no
             price shows "price unavailable" on the catalog. */
          models.forEach((m, i) => {
            if (String(m.status) === "discontinued") return;
            const hasPrice =
              String(m.global_price ?? "").trim() !== "" ||
              String(m.head_only_price ?? "").trim() !== "" ||
              String(m.complete_set_price ?? "").trim() !== "";
            if (!hasPrice) {
              const who =
                m.model_name && m.model_name.trim()
                  ? `${m.model_name} — ${t("field.price", "price")}`
                  : i === 0
                    ? t("field.primaryPrice", "Primary model price")
                    : t("field.variantPrice", "Variant price");
              missing.push({ label: who, step: "commercial" });
            }
          });

          /* Primary model commercial info for the summary chips. */
          const priceDisplay = primaryModel?.global_price
            ? `$${primaryModel.global_price}`
            : "—";
          const costDisplay = primaryModel?.cost_price
            ? `¥${primaryModel.cost_price}`
            : "—";

          /* Country-of-origin — the field stores an ISO code (e.g.
             "CN") while the admin picked a full country name in the
             Hero dropdown. Re-resolve via the COUNTRIES list so the
             chip reads "China" instead of "CN". */
          const originName = product.country_of_origin
            ? (COUNTRIES.find((c) => c.code === product.country_of_origin)?.name || product.country_of_origin)
            : "";

          /* saveLabel + saveBtnCls are hoisted to the component
             level so the bottom-nav Save button matches this
             preview card — see the useState block earlier. */

          /* ── Completion meter ──
                Counts essential fields filled vs total so the admin
                sees overall readiness at a glance. Includes the same
                fields as the missing-list above + a small set of
                strongly-recommended fields (excerpt, highlights,
                primary model) that don't block save but make the
                public page meaningfully better. */
          const essentialFilled = [
            product.product_name.trim(),
            product.division_slug,
            product.category_slug,
            product.subcategory_slug,
            product.brand,
            product.excerpt,
            product.highlights && product.highlights.length > 0 ? "ok" : "",
            primaryModel?.global_price,
            mainImageSrc,
            ...(isSewing
              ? [
                  (sewingSpecs.common_specs as Record<string, unknown>).max_sewing_speed,
                  (sewingSpecs.common_specs as Record<string, unknown>).needle_system,
                  (sewingSpecs.common_specs as Record<string, unknown>).motor_type,
                ]
              : []),
          ].filter(Boolean).length;
          const essentialTotal = isSewing ? 12 : 9;
          const completionPct = Math.round((essentialFilled / essentialTotal) * 100);

          /* ── Product Schema Engine — readiness + preview inputs ──
                The new schema-driven Intelligence panel sits ABOVE the
                legacy readiness card. We resolve the schema for the
                current classification and derive media counts from the
                actual ProductMediaType values used elsewhere in this
                file (main_image, gallery, manual, video, packing_photo).
                Plain consts (not useMemo) because this IIFE runs
                conditionally on the current step, and hooks can't sit
                inside a conditional branch. */
          const resolvedSchemaForReview = resolveSchema({
            divisionCode: product.division_slug || "",
            categoryCode: product.category_slug || "",
            subcategoryCode: selectedSubcategory?.code || "",
          });
          const primaryModelForReview = models[0];
          const galleryCount = media.filter((m) => m.type === "gallery").length;
          const packingCount = media.filter((m) => m.type === "packing_photo").length;
          const manualCount = media.filter((m) => m.type === "manual").length;
          const videoCount = media.filter((m) => m.type === "video").length;
          const mainImageCount = media.some((m) => m.type === "main_image") ? 1 : 0;
          const readinessReport = computeReadiness({
            schema: resolvedSchemaForReview.schema,
            values: product.schema_specs || {},
            media: {
              main: mainImageCount,
              gallery: galleryCount,
              packing: packingCount,
              manual: manualCount,
              video: videoCount,
            },
            commercial: {
              product_name: product.product_name,
              primary_model: primaryModelForReview?.primary_model || null,
              supplier_model: primaryModelForReview?.reference_model || null,
              cost_price: primaryModelForReview?.cost_price || null,
              global_price: primaryModelForReview?.global_price || null,
              warranty: product.warranty || null,
              moq: product.moq || null,
              lead_time: product.lead_time || null,
            },
            knowledge: (product.schema_knowledge as ProductKnowledgeBlock[]) || [],
          });
          const mainImageUrlForPreview =
            media.find((m) => m.type === "main_image")?.url || null;
          const galleryUrlsForPreview = media
            .filter((m) => m.type === "gallery")
            .map((m) => m.url);

          /* Status meaning for the publish card. */
          const statusCopy = product.status === "active"
            ? { headline: t("review.publishReadyHeadline", "Ready to publish"), body: t("review.publishReadyBody", "Status is Active — this product will go live on the public catalog as soon as you save.") }
            : product.status === "archived"
            ? { headline: t("review.archiveHeadline", "Archive on save"), body: t("review.archiveBody", "Status is Archived — the product stays in the catalog history but won't appear in the public shop.") }
            : { headline: t("review.draftHeadline", "Save as draft"), body: t("review.draftBody", "Status is Draft — saved internally, not shown on the public catalog. Switch to Active on the Hero step when ready to publish.") };

          return (
            <div className="space-y-5 animate-in fade-in duration-300">
              {/* ── Live preview card ──
                    Mirrors the public detail page's hero: image,
                    name, tagline, quick-fact pills, pricing. Built
                    so the admin sees what customers will see
                    BEFORE clicking save. Apple-light surface to
                    visually separate "preview" from the dark
                    wizard chrome around it. */}
              <div className="rounded-[22px] overflow-hidden border border-[var(--border-subtle)] bg-white dark:bg-white/[0.04]">
                <div className="px-5 py-3 border-b border-[var(--border-subtle)] bg-[#F5F5F7] dark:bg-white/[0.02] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[#86868B] dark:text-white/40">
                    <EyeIcon className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em]">{t("review.livePreview", "Live preview")}</span>
                  </div>
                  <span className="text-[10px] text-[#86868B] dark:text-white/40">{t("review.howCustomersSee", "How customers see this product")}</span>
                </div>
                <div className="p-7 md:p-10">
                  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_280px] gap-6 md:gap-8 items-center">
                    <div className="min-w-0">
                      {product.brand && (
                        <p className="text-[12px] font-medium text-[#86868B] dark:text-white/45 mb-1.5">
                          {product.brand}
                        </p>
                      )}
                      <h2 className="text-[24px] md:text-[30px] font-semibold tracking-[-0.01em] text-[#1D1D1F] dark:text-white leading-[1.1]">
                        {product.product_name || t("review.untitledProduct", "Untitled product")}
                      </h2>
                      {primaryModel?.tagline && (
                        <p className="mt-2 text-[15px] md:text-[17px] text-[#1D1D1F] dark:text-white/85 leading-snug">
                          {primaryModel.tagline}
                        </p>
                      )}
                      {product.excerpt && (
                        <p className="mt-2 text-[13px] text-[#6E6E73] dark:text-white/60 leading-[1.5] line-clamp-3">
                          {product.excerpt}
                        </p>
                      )}
                      {/* Quick-fact pills — same visual language as the
                          public detail page. Renders only filled fields. */}
                      <div className="mt-4 flex flex-wrap items-center gap-1.5">
                        {priceDisplay !== "—" && (
                          <ReviewPill icon={<DollarSignIcon className="h-3 w-3" />}>
                            {t("review.from", "From {price}").replace("{price}", priceDisplay)}
                          </ReviewPill>
                        )}
                        {templateName && (
                          <ReviewPill icon={<Settings2Icon className="h-3 w-3" />}>{templateName}</ReviewPill>
                        )}
                        {product.warranty && (
                          <ReviewPill icon={<ShieldCheckIcon className="h-3 w-3" />}>{t("review.warrantyPill", "{warranty} warranty").replace("{warranty}", product.warranty)}</ReviewPill>
                        )}
                        {originName && (
                          <ReviewPill icon={<GlobeIcon className="h-3 w-3" />}>{t("review.madeInPill", "Made in {country}").replace("{country}", originName)}</ReviewPill>
                        )}
                        {models.length > 0 && (
                          <ReviewPill icon={<BoxesIcon className="h-3 w-3" />}>
                            {t("review.variantsPill", "{n} variants").replace("{n}", String(models.length))}
                          </ReviewPill>
                        )}
                      </div>
                    </div>
                    <div className="aspect-[4/3] rounded-[16px] overflow-hidden bg-[#F5F5F7] dark:bg-white/[0.06] flex items-center justify-center">
                      {mainImageSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mainImageSrc} alt={product.product_name} className="w-full h-full object-contain p-3" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-[#86868B] dark:text-white/30">
                          <ImageRawIcon className="h-9 w-9" />
                          <span className="text-[10px] uppercase tracking-wider">{t("review.noImageYet", "No image yet")}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ══════════════════════════════════════════════════════
                  PRODUCT INTELLIGENCE READINESS — Schema Engine v1
                  Sits above the legacy readiness meter. Shows a 7-dim
                  breakdown (data / media / commercial / technical /
                  website / ai / brochure) sourced from computeReadiness
                  against the resolved schema for this classification.
                  Both panels coexist on purpose — the new one is rich
                  but additive; the legacy meter still drives the
                  publish-action card colour below. */}
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 md:p-6 mb-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">
                      {t("review.intelTitle", "Product Intelligence Readiness")}
                    </h3>
                    <p className="text-[11px] text-[var(--text-faint)] mt-1">
                      {t("review.intelSubtitle", "Schema-driven completeness across data, media, commercial, and AI dimensions.")}
                    </p>
                  </div>
                  <div className="text-3xl font-bold font-mono text-[var(--text-primary)] tabular-nums leading-none">
                    {readinessReport.overall}%
                  </div>
                </div>
                <div className="space-y-2">
                  {readinessReport.dimensions.map((dim) => {
                    const labelMap: Record<string, string> = {
                      data: t("review.dimData", "Data"),
                      media: t("review.dimMedia", "Media"),
                      commercial: t("review.dimCommercial", "Commercial"),
                      technical: t("review.dimTechnical", "Technical"),
                      website: t("review.dimWebsite", "Website"),
                      ai: t("review.dimAi", "AI"),
                      brochure: t("review.dimBrochure", "Brochure"),
                    };
                    const statusLabel =
                      dim.status === "ready"
                        ? t("review.statusReady", "Ready")
                        : dim.status === "incomplete"
                          ? t("review.statusIncomplete", "Incomplete")
                          : t("review.statusEmpty", "Empty");
                    const statusCls =
                      dim.status === "ready"
                        ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/5"
                        : dim.status === "incomplete"
                          ? "border-[var(--border-subtle)] text-[var(--text-ghost)]"
                          : "border-[var(--border-subtle)]/50 text-[var(--text-faint)]";
                    return (
                      <div key={dim.dimension} className="flex items-center gap-3">
                        <div className="w-20 text-[10px] uppercase tracking-wider text-[var(--text-ghost)]">
                          {labelMap[dim.dimension] || dim.dimension}
                        </div>
                        <div className="h-2 rounded-full bg-[var(--bg-surface-subtle)] flex-1 overflow-hidden">
                          <div
                            className="h-full bg-[var(--text-primary)] rounded-full transition-all"
                            style={{ width: `${dim.score}%` }}
                          />
                        </div>
                        <div className="w-10 text-right text-[11px] font-mono text-[var(--text-primary)] tabular-nums">
                          {dim.score}%
                        </div>
                        <div
                          className={`inline-flex items-center justify-center h-5 px-2 rounded-full text-[9px] font-bold uppercase tracking-wider border ${statusCls}`}
                        >
                          {statusLabel}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {readinessReport.topMissing.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)] mb-2">
                      {t("review.topMissing", "Top missing")}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {readinessReport.topMissing.slice(0, 5).map((m, i) => (
                        <span
                          key={`${m.dimension}:${m.key}:${i}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-ghost)]"
                        >
                          <span className="text-[var(--text-primary)]">{m.label}</span>
                          <span className="text-[var(--text-faint)]">· {m.dimension}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ══════════════════════════════════════════════════════
                  PUBLIC PREVIEW — Schema-driven public render
                  Renders the resolved schema + values + knowledge using
                  the same component the public website will use, so the
                  admin sees the customer-facing surface before save. */}
              <div className="mb-5">
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">
                    {t("review.publicPreview", "Public Preview")}
                  </h3>
                  <p className="text-[11px] text-[var(--text-faint)]">
                    {t("review.publicPreviewSubtitle", "This is what customers will see on the website.")}
                  </p>
                </div>
                <ProductPreview
                  productName={product.product_name}
                  primaryModel={primaryModelForReview?.primary_model || null}
                  tagline={primaryModelForReview?.tagline || null}
                  brand={product.brand || null}
                  schema={resolvedSchemaForReview.schema}
                  values={product.schema_specs || {}}
                  knowledge={(product.schema_knowledge as ProductKnowledgeBlock[]) || []}
                  mainImageUrl={mainImageUrlForPreview}
                  galleryUrls={galleryUrlsForPreview}
                  mediaCounts={{
                    photos: galleryCount,
                    videos: videoCount,
                    manuals: manualCount,
                  }}
                  surface="website"
                />
              </div>

              {/* ── Completion meter ──
                    Single thin progress bar with the % + filled/total
                    counters. Click jumps to the missing-fields banner
                    (or a smooth no-op when the product is complete). */}
              <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] px-5 py-4">
                <div className="flex items-center justify-between gap-3 mb-2.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-faint)]">{t("review.readiness", "Readiness")}</span>
                    <span className="text-[15px] font-semibold text-[var(--text-primary)] tabular-nums">{completionPct}%</span>
                    <span className="text-[11px] text-[var(--text-ghost)] tabular-nums">
                      {t("review.essentialFields", "· {filled} of {total} essential fields").replace("{filled}", String(essentialFilled)).replace("{total}", String(essentialTotal))}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      missing.length === 0
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${missing.length === 0 ? "bg-emerald-400" : "bg-amber-400"}`} />
                    {missing.length === 0 ? t("review.readyToPublish", "Ready to publish") : t("review.requiredCount", "{n} required fields").replace("{n}", String(missing.length))}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-inverted)]/[0.08] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      completionPct >= 90 ? "bg-emerald-500"
                      : completionPct >= 60 ? "bg-blue-500"
                      : "bg-amber-500"
                    }`}
                    style={{ width: `${Math.max(completionPct, 4)}%` }}
                  />
                </div>
              </div>

              {/* ── Missing-fields warning banner ──
                    Only when at least one required field is empty. */}
              {product.status === "active" && missing.length > 0 && (
                <div className="rounded-2xl bg-red-500/[0.06] border border-red-500/30 p-4 flex items-start gap-2.5">
                  <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 shrink-0">
                    <TriangleWarningIcon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <h4 className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight">{t("review.goLiveTitle", "This will go live with missing fields")}</h4>
                    <p className="text-[11px] text-[var(--text-ghost)] mt-0.5">
                      {t("review.goLiveBody", "Status is Active, so saving publishes this product to the public catalogue immediately. Switch to Draft on the Hero tab if it's not ready.")}
                    </p>
                  </div>
                </div>
              )}

              {missing.length > 0 && (
                <div className="rounded-2xl bg-amber-500/[0.06] border border-amber-500/25 p-5">
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                      <TriangleWarningIcon className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <h4 className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight">{t("review.missingTitle", "Missing required fields")}</h4>
                      <p className="text-[11px] text-[var(--text-ghost)] mt-0.5">
                        {t("review.missingBody", "Save as Draft anytime, but the product won't publish until these are filled.")}
                      </p>
                    </div>
                  </div>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {missing.map((m, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => jumpTo(m.step)}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[var(--bg-surface-subtle)]/50 border border-[var(--border-subtle)]/60 hover:border-amber-500/40 hover:bg-amber-500/[0.04] transition-colors group"
                        >
                          <span className="text-[12px] text-[var(--text-primary)]">{m.label}</span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400 group-hover:text-amber-300">
                            {t(STEP_SHORT_KEY[m.step] ?? "", steps.find((s) => s.id === m.step)?.shortLabel || m.step)}
                            <ArrowUpRightIcon className="h-3 w-3" />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── Grouped review sections ──
                    Each card carries its own icon + sub-title and
                    holds the SummaryItems for that domain. Replaces
                    the flat 4-row grid with a structured spec-sheet
                    feel that matches the new Specs / Technical / Models
                    pages. */}
              <ReviewGroup
                icon={<TagsIcon className="h-3.5 w-3.5" />}
                title={t("review.groupIdentity", "Identity & classification")}
                onJump={() => jumpTo("identity")}
                t={t}
              >
                <SummaryItem label={t("review.name", "Name")} value={product.product_name || "—"} dim={!product.product_name} onClick={() => jumpTo("identity")} />
                <SummaryItem label={t("review.brand", "Brand")} value={product.brand || "—"} dim={!product.brand} onClick={() => jumpTo("identity")} />
                <SummaryItem label={t("review.subcategory", "Subcategory")} value={subcategoryName || "—"} dim={!subcategoryName} onClick={() => jumpTo("classify")} />
                <SummaryItem label={t("review.status", "Status")} value={<StatusBadge status={product.status} t={t} />} onClick={() => jumpTo("identity")} />
                {isSewing && (
                  <SummaryItem label={t("review.machineKind", "Machine Kind")} value={templateName || "—"} dim={!templateName} onClick={() => jumpTo("classify")} />
                )}
                <SummaryItem label={t("review.level", "Level")} value={product.level ? product.level.charAt(0).toUpperCase() + product.level.slice(1) : "—"} dim={!product.level} onClick={() => jumpTo("identity")} />
                <SummaryItem label={t("review.featured", "Featured")} value={product.featured ? t("review.yes", "Yes") : t("review.no", "No")} dim={!product.featured} onClick={() => jumpTo("identity")} />
                <SummaryItem label={t("review.visible", "Visible")} value={product.visible ? t("review.public", "Public") : t("review.hidden", "Hidden")} dim={!product.visible} onClick={() => jumpTo("identity")} />
              </ReviewGroup>

              <ReviewGroup
                icon={<DollarSignIcon className="h-3.5 w-3.5" />}
                title={t("review.groupCommercial", "Commercial & primary model")}
                onJump={() => jumpTo("commercial")}
                t={t}
              >
                <SummaryItem label={t("review.primaryModelCode", "Primary model · KOLEEX code")} value={primaryModel?.primary_model || primaryModel?.model_name || "—"} dim={!(primaryModel?.primary_model || primaryModel?.model_name)} onClick={() => jumpTo("identity")} />
                <SummaryItem label={t("review.tagline", "Tagline")} value={primaryModel?.tagline || "—"} dim={!primaryModel?.tagline} onClick={() => jumpTo("commercial")} />
                <SummaryItem label={t("review.costCny", "Cost (CNY)")} value={costDisplay} dim={costDisplay === "—"} onClick={() => jumpTo("commercial")} />
                <SummaryItem label={t("review.sellingUsd", "Selling price (USD)")} value={priceDisplay} dim={priceDisplay === "—"} onClick={() => jumpTo("commercial")} />
                <SummaryItem label={t("review.warranty", "Warranty")} value={product.warranty || "—"} dim={!product.warranty} onClick={() => jumpTo("identity")} />
                <SummaryItem label={t("review.madeIn", "Made in")} value={originName || "—"} dim={!originName} onClick={() => jumpTo("identity")} />
                <SummaryItem label={t("review.variants", "Variants")} value={t("review.variantsCount", "{n} variants").replace("{n}", String(models.length))} onClick={() => jumpTo("commercial")} />
              </ReviewGroup>

              <ReviewGroup
                icon={<BoxesIcon className="h-3.5 w-3.5" />}
                title={t("review.groupContent", "Content & catalog")}
                onJump={() => jumpTo("media")}
                t={t}
              >
                <SummaryItem label={t("review.excerpt", "Excerpt")} value={product.excerpt ? t("review.filled", "Filled") : "—"} dim={!product.excerpt} onClick={() => jumpTo("identity")} />
                <SummaryItem label={t("review.highlights", "Highlights")} value={product.highlights && product.highlights.length > 0 ? t("review.highlightsCount", "{n} items").replace("{n}", String(product.highlights.length)) : "—"} dim={!product.highlights || product.highlights.length === 0} onClick={() => jumpTo("identity")} />
                <SummaryItem label={t("review.description", "Description")} value={product.description ? t("review.filled", "Filled") : "—"} dim={!product.description} onClick={() => jumpTo("description")} />
                <SummaryItem label={t("review.mediaLabel", "Media")} value={t("review.mediaCount", "{n} files").replace("{n}", String(media.length))} dim={media.length === 0} onClick={() => jumpTo("media")} />
                <SummaryItem label={t("review.translations", "Translations")} value={t("review.translationsCount", "{n} locales").replace("{n}", String(translations.length))} dim={translations.length === 0} />
                <SummaryItem label={t("review.related", "Related")} value={t("review.relatedCount", "{n} links").replace("{n}", String(related.length))} dim={related.length === 0} />
              </ReviewGroup>

              {/* Translations + Related editors stay collapsed below
                  so the review remains scannable, but power-users can
                  still adjust them inline. */}
              <Section id="translations" icon={<LanguagesIcon className="h-4 w-4" />} title={t("review.translationsSection", "Translations")} defaultOpen={false}>
                <TranslationsSection translations={translations} onChange={setTranslations} />
              </Section>

              <Section id="related" icon={<Link2Icon className="h-4 w-4" />} title={t("review.relatedSection", "Related Products")} defaultOpen={false}>
                <RelatedProductsSection related={related} onChange={setRelated} currentProductId={productId} />
              </Section>

              {/* ── Publish action card ──
                    Bigger, clearer, premium. Status meaning + the
                    button label preview live side-by-side; the
                    action button itself is here too so the admin
                    doesn't need to scroll back to the bottom nav. */}
              <div className={`rounded-2xl border p-6 md:p-7 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                missing.length === 0
                  ? "bg-emerald-500/[0.04] border-emerald-500/25"
                  : "bg-[var(--bg-surface-subtle)]/50 border-[var(--border-subtle)]"
              }`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`inline-flex items-center justify-center h-7 w-7 rounded-lg ${
                      missing.length === 0 ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : "bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-subtle)]"
                    }`}>
                      {missing.length === 0
                        ? <CheckIcon className="h-4 w-4" />
                        : <DiskIcon className="h-4 w-4" />}
                    </span>
                    <h4 className="text-[14px] font-semibold text-[var(--text-primary)]">
                      {statusCopy.headline}
                    </h4>
                  </div>
                  <p className="text-[12px] text-[var(--text-ghost)] leading-relaxed max-w-[560px]">
                    {statusCopy.body}
                  </p>
                </div>
                <button
                  onClick={save}
                  disabled={saving}
                  className={`h-11 px-6 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-50 inline-flex items-center gap-2 shadow-lg shrink-0 ${saveBtnCls}`}
                >
                  {saving ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <DiskIcon className="h-4 w-4" />}
                  {saving ? t("action.saving", "Saving...") : saveLabel}
                </button>
              </div>
            </div>
          );
        })()}
        </div>

        {/* Maturity meter lives at the bottom on the single page (read-only). */}
        {onePage && <div className="mt-2"><WizardKnowledgePanel knowledge={wizardKnowledge} /></div>}

        {/* ═══ STEP NAVIGATION BUTTONS ═══ */}
        {!onePage && !tabbed && (
        <div className="flex items-center justify-between mt-8 mb-4">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="h-10 px-5 rounded-xl border border-[var(--border-subtle)] text-[13px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ArrowLeftIcon className="h-4 w-4" /> {t("wizard.previous", "Previous")}
          </button>

          <div className="text-[11px] text-[var(--text-ghost)]">
            {t("wizard.stepOf", "Step {current} of {total}").replace("{current}", String(currentStep + 1)).replace("{total}", String(steps.length))}
          </div>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={handleNext}
              className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all flex items-center gap-2 shadow-lg"
            >
              {t("action.next", "Next")} <ArrowRightIcon className="h-4 w-4" />
            </button>
          ) : (
            /* Smart Save: label + colour driven by the chosen
               status. Matches the preview card on the Review step
               so admins always see the same wording in both
               places. */
            <button
              onClick={save}
              disabled={saving}
              className={`h-10 px-6 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg ${saveBtnCls}`}
            >
              {saving ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <DiskIcon className="h-4 w-4" />}
              {saving ? t("action.saving", "Saving...") : saveLabel}
            </button>
          )}
        </div>
        )}

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
/* Group container for the redesigned Review step. Wraps a set of
   SummaryItem cards under a small icon+title header, with a quiet
   "Edit" link in the top-right that jumps to the owning step.
   Visual cousin of the SubCard pattern used on Technical / Specs
   so the wizard reads as one coherent app. */
function ReviewGroup({
  icon, title, onJump, children, t,
}: {
  icon: React.ReactNode;
  title: string;
  onJump?: () => void;
  children: React.ReactNode;
  t: (key: string, fallback?: string) => string;
}) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[var(--border-subtle)]">
        <span className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] shrink-0">
          {icon}
        </span>
        <h4 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-faint)] flex-1">
          {title}
        </h4>
        {onJump && (
          <button
            type="button"
            onClick={onJump}
            className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-ghost)] hover:text-[var(--text-primary)] transition-colors"
          >
            {t("review.editLink", "Edit")}
            <ArrowUpRightIcon className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="p-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {children}
      </div>
    </div>
  );
}

/* Compact icon+label pill used on the live preview card under the
   product name. Matches the public detail page's quick-fact strip
   visual language so admins see the same cues customers will. */
function ReviewPill({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full bg-[#F5F5F7] dark:bg-white/[0.06] dark:border dark:border-white/10 text-[11px] font-medium text-[#1D1D1F] dark:text-white/85">
      <span className="text-[#06C] dark:text-[#2997FF]">{icon}</span>
      {children}
    </span>
  );
}

function SummaryItem({
  label, value, onClick, dim = false,
}: {
  label: string;
  value: React.ReactNode;
  onClick?: () => void;
  /* When the value is truly empty ("—"), the chip gets a quieter
     treatment so admins can spot unfilled fields without the chip
     screaming at them. */
  dim?: boolean;
}) {
  const base =
    "rounded-xl px-4 py-3 border transition-colors text-left w-full block";
  const tone = dim
    ? "bg-[var(--bg-surface-subtle)]/40 border-[var(--border-subtle)]/60"
    : "bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)]";
  const clickable = onClick
    ? "cursor-pointer hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface)]"
    : "";
  const content = (
    <>
      <div className="text-[10px] font-semibold text-[var(--text-ghost)] uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-[13px] font-medium truncate ${dim ? "text-[var(--text-ghost)] italic" : "text-[var(--text-primary)]"}`}>
        {value}
      </div>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${base} ${tone} ${clickable}`}>
        {content}
      </button>
    );
  }
  return <div className={`${base} ${tone}`}>{content}</div>;
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
  t,
}: {
  slug: string;
  onChange: (v: string) => void;
  onResetToAuto: () => void;
  t: (key: string, fallback?: string) => string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div>
        <label className="block text-[10px] font-bold text-[var(--text-ghost)] uppercase tracking-wider mb-2">
          <span className="inline-flex items-center gap-1.5"><Link2Icon className="h-3 w-3" /> {t("hero.publicUrl", "Public URL")}</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[var(--text-ghost)] font-mono shrink-0">/products/</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => onChange(e.target.value)}
            autoFocus
            placeholder={t("hero.slugPlaceholder", "lockstitch-9500")}
            className="flex-1 h-9 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[12px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
          />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            {t("hero.done", "Done")}
          </button>
          <button
            type="button"
            onClick={() => { onResetToAuto(); setEditing(false); }}
            className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-muted)] transition-colors"
            title={t("hero.regenerateSlug", "Regenerate slug from product name")}
          >
            {t("hero.reset", "Reset")}
          </button>
        </div>
        <p className="text-[10px] text-[var(--text-ghost)] mt-1.5">
          {t("hero.slugHint", "Lower-case, letters / numbers / hyphens only. Used in the public URL.")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-[10px] font-bold text-[var(--text-ghost)] uppercase tracking-wider mb-2">
        <span className="inline-flex items-center gap-1.5"><Link2Icon className="h-3 w-3" /> {t("hero.publicUrl", "Public URL")}</span>
      </label>
      <div className="flex items-center gap-2 px-4 h-11 rounded-xl bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)]">
        <span className="text-[12px] text-[var(--text-ghost)] font-mono">/products/</span>
        <span className={`text-[12px] font-mono truncate ${slug ? "text-[var(--text-primary)]" : "text-[var(--text-ghost)] italic"}`}>
          {slug || t("hero.slugAutoHint", "auto-generated from product name")}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="ml-auto inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0"
        >
          <PencilIcon className="h-3 w-3" /> {t("hero.edit", "Edit")}
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
  t,
}: {
  highlights: string[];
  onChange: (next: string[]) => void;
  t: (key: string, fallback?: string) => string;
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
          {t("hero.highlightsEmptyHint", "Add 3–5 short bullets that describe what makes this product stand out.")}
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
            aria-label={t("hero.removeHighlight", `Remove highlight ${i + 1}`).replace("{n}", String(i + 1))}
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
            placeholder={highlights.length === 0 ? t("hero.highlightPlaceholderFirst", "e.g. Max 5000 SPM") : t("hero.highlightPlaceholderMore", "Add another highlight...")}
            maxLength={80}
            className="flex-1 h-11 px-4 rounded-xl bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-all"
          />
          <button
            type="button"
            onClick={add}
            disabled={!input.trim()}
            className="h-11 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            <PlusIcon className="h-3.5 w-3.5" /> {t("hero.add", "Add")}
          </button>
        </div>
      )}
      {atCap && (
        <p className="text-[10px] text-[var(--text-ghost)] italic px-1">
          {t("hero.highlightCap", "You've reached the 5-bullet cap. Remove one to add another.")}
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAGS INPUT — with suggestions dropdown
   ═══════════════════════════════════════════════════════════════════ */
function TagsInput({ tags, onChange, suggestions = [], t }: { tags: string[]; onChange: (t: string[]) => void; suggestions?: string[]; t: (key: string, fallback?: string) => string }) {
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
          placeholder={t("hero.tagsPlaceholder", "Type or choose tags...")}
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
                {t("hero.createTag", "Create \"{tag}\"").replace("{tag}", input.trim())}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
