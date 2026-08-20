"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTopRampOwner } from "@/lib/useTopRampOwner";
import BoundIcon from "@/components/common/BoundIcon";
import dynamic from "next/dynamic";
import { useSkin } from "@/lib/appearance";
import KdsSelect from "@/components/kds/Select";

const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });
import { useRouter, usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { PRODUCT_ARRAY_COLUMNS, toTextArray } from "@/lib/product-array-columns";
import { localizedName } from "@/lib/i18n-name";
import { FieldHelp, IDENTIFIER_HELP } from "@/components/admin/form-sections/FieldHelp";
import FeatureCardsSection from "@/components/admin/form-sections/FeatureCardsSection";
import { PRODUCTS_UI_I18N } from "@/lib/products-ui-i18n";
import { humanizeError } from "@/lib/ui/humanize-error";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import ArrowUpRightIcon from "@/components/icons/ui/ArrowUpRightIcon";
import DiskIcon from "@/components/icons/ui/DiskIcon";
import CameraIcon from "@/components/icons/ui/CameraIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import FolderTreeIcon from "@/components/icons/ui/FolderTreeIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import WrenchIcon from "@/components/icons/ui/WrenchIcon";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
import BoxIcon from "@/components/icons/ui/BoxIcon";
import ProductStockProfile from "@/components/admin/ProductStockProfile";
import DollarSignIcon from "@/components/icons/ui/DollarSignIcon";
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
import HashtagIcon from "@/components/icons/ui/HashtagIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import RocketIcon from "@/components/icons/ui/RocketIcon";
import TimerIcon from "@/components/icons/ui/TimerIcon";
import InfoIcon from "@/components/icons/ui/InfoIcon";
import GemIcon from "@/components/icons/ui/GemIcon";
import HistoryIcon from "@/components/icons/ui/HistoryIcon";
import CircleDollarSignIcon from "@/components/icons/ui/CircleDollarSignIcon";
import ScanLineIcon from "@/components/icons/ui/ScanLineIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import ListIcon from "@/components/icons/ui/ListIcon";
import CalendarRawIcon from "@/components/icons/ui/CalendarRawIcon";
import ShieldIcon from "@/components/icons/ui/ShieldIcon";
import ShieldOffIcon from "@/components/icons/ui/ShieldOffIcon";
import CogIcon from "@/components/icons/ui/CogIcon";
import GaugeIcon from "@/components/icons/ui/GaugeIcon";
import HeadphonesIcon from "@/components/icons/ui/HeadphonesIcon";
import Undo2Icon from "@/components/icons/ui/Undo2Icon";
import PhoneCallIcon from "@/components/icons/ui/PhoneCallIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import LockIcon from "@/components/icons/ui/LockIcon";
import {
  fetchTaxonomyAll,
  fetchProductById, fetchModelsByProductId, fetchMediaByProductId,
  fetchTranslationsByProductId, fetchMarketPricesByModelIds, fetchRelatedProducts,
  createProduct, updateProduct,
  createModel, updateModel, deleteModel,
  uploadProductFile, createProductMedia, deleteProductMedia,
  upsertTranslation, deleteTranslation,
  upsertMarketPrice,
  setRelatedProducts,
  fetchProductSuppliers, saveProductSuppliers,
  fetchProductCertifications, saveProductCertifications,
  fetchProductDocuments, saveProductDocuments,
  fetchSupplierNames, fetchUniqueBrands,
  fetchUniqueFamilies,
  fetchBrandLogos,
  fetchDivisionLogos, fetchCategoryLogos, fetchSubcategoryLogos, fetchClassificationIcons,
  fetchSewingSpecsByProductId, upsertSewingSpecs,
} from "@/lib/products-admin";
import { fetchAttributeConfig } from "@/lib/product-attributes";
import type { DivisionRow, CategoryRow, SubcategoryRow } from "@/types/supabase";
import type {
  ProductFormState, ModelFormState, MediaFormState,
  TranslationFormState, MarketPriceFormState, RelatedProductFormState, ProductSupplierFormState,
  ProductCertificationFormState, ProductDocumentFormState,
} from "@/types/product-form";
import { EMPTY_PRODUCT, createEmptyModel, COUNTRIES, LOCALES } from "@/types/product-form";
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
import PictureIcon from "@/components/icons/ui/PictureIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";

import ClassificationSection from "./form-sections/ClassificationSection";
import SelectWithCreate from "./form-sections/SelectWithCreate";
import CreateDivisionModal from "./form-sections/CreateDivisionModal";
import ConfirmDialog from "@/components/kds/ConfirmDialog";
import SupplierLinkSection from "./form-sections/SupplierLinkSection";
import CertificationsSection from "./form-sections/CertificationsSection";
import ProductDocumentsSection from "./form-sections/ProductDocumentsSection";
import CreateCategoryModal from "./form-sections/CreateCategoryModal";
import CreateSubcategoryModal from "./form-sections/CreateSubcategoryModal";
/* Lazy: this modal imports country-state-city, whose city.json is 7.7 MB.
   Statically imported it rode in the editor chunk for every product open,
   even though the modal is closed. Now it downloads on first use only. */
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
const CreateSupplierModal = dynamic(() => import("./form-sections/CreateSupplierModal"), { ssr: false });
import CreateBrandModal from "./form-sections/CreateBrandModal";
import DescriptionSection from "./form-sections/DescriptionSection";
import RichTextEditor from "./form-sections/RichTextEditor";
import KnowledgeSection from "./form-sections/KnowledgeSection";
import TechnicalSection from "./form-sections/TechnicalSection";
import ModelsSection from "./form-sections/ModelsSection";
import FamilySpecGrid from "./form-sections/FamilySpecGrid";
import { FamilyStrip, FamilySharedDivider, MemberPricingPanel, MemberLogisticsPanel } from "./form-sections/FamilyMemberPanels";
import MediaSection from "./form-sections/MediaSection";
import PricingIntelligenceCard from "./form-sections/PricingIntelligenceCard";
import AccessoryOptionsSection, { type AccessoryOptionRow, axesForSubcategory } from "./form-sections/AccessoryOptionsSection";
import BaseFobCard from "./form-sections/BaseFobCard";
import TabStrip from "@/components/ui/TabStrip";
import RelatedProductsSection from "./form-sections/RelatedProductsSection";
import SearchSocialSection from "./form-sections/SearchSocialSection";
import SewingMachineSection from "./form-sections/SewingMachineSection";
import type { SewingSpecsFormState } from "./form-sections/SewingMachineSection";
/* Lazy: pulls jsbarcode + qrcode, only needed once a model code exists. */
const BarcodeQRDisplay = dynamic(() => import("./form-sections/BarcodeQRDisplay"), { ssr: false, loading: () => null });
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
    <section id={id} {...kxInspectAttrs({ component: sectionComponentName(title), module: "Product Data", section: title })} className="kx-tab-in scroll-mt-24 kx-glass bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden transition-shadow hover:shadow-[0_2px_12px_rgba(0,0,0,0.15)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-6 py-4 hover:bg-[var(--bg-surface-subtle)]/50 transition-colors cursor-pointer"
      >
        <div className="kx-glass h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
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
  supplier: "step.supplierSourcing",
  identity: "step.identity",
  description: "step.description",
  specs: "step.specifications",
  "sewing-specs": "step.machineSpecs",
  commercial: "step.modelsVariants",
  pricing: "step.costPrice",
  logistics: "step.logisticsCustoms",
  compliance: "step.complianceWarranty",
  technical: "step.technical",
  media: "step.mediaDocuments",
  knowledge: "step.knowledgeRel",
  finalize: "step.reviewPublish",
};
const STEP_SHORT_KEY: Record<string, string> = {
  classify: "step.classify",
  supplier: "step.supplier",
  identity: "step.hero",
  description: "step.description",
  specs: "step.specs",
  "sewing-specs": "step.specs",
  commercial: "step.models",
  pricing: "step.price",
  logistics: "step.logistics",
  compliance: "step.compliance",
  technical: "step.technical",
  media: "step.media",
  knowledge: "step.knowledge",
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
/* One schema key can retire MULTIPLE legacy columns — e.g. the schema's
   power_consumption_w is THE power input, so the legacy "Motor Power" column
   must hide too; a bar-valued air_pressure supersedes the yes/no
   pneumatic_supply toggle. Pure de-duplication: one meaning, one input. */
const SCHEMA_KEY_COVERS_EXTRA: Record<string, string[]> = {
  power_consumption_w: ["motor_power_w"],
  air_pressure: ["pneumatic_supply"],
};

function computeSchemaCoveredColumns(
  schema: { groups?: { fields?: { key: string }[] }[] } | null | undefined,
): Set<string> {
  if (!schema?.groups) return new Set();
  const keys = new Set(schema.groups.flatMap((g) => (g.fields ?? []).map((f) => f.key)));
  const covered = new Set(
    Object.entries(SCHEMA_KEY_TO_COLUMN)
      .filter(([sk]) => keys.has(sk))
      .map(([, col]) => col),
  );
  for (const [sk, cols] of Object.entries(SCHEMA_KEY_COVERS_EXTRA)) {
    if (keys.has(sk)) for (const c of cols) covered.add(c);
  }
  return covered;
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
    } else if (PRODUCT_ARRAY_COLUMNS.has(col)) {
      /* THE product-save killer (fixed 2026-08-03): these legacy columns
         are Postgres ARRAYs, but their schema fields are scalars —
         voltage_options is a `select`, frequency_hz a `unit_number`.
         Writing the raw scalar produced `malformed array literal: "220V"`
         → 500 → the operator only ever saw "Failed to create product".
         Coerce to a text array; drop empties so we never write [""]. */
      const arr = toTextArray(v);
      if (arr) out[col] = arr;
    } else if (Array.isArray(v)) {
      /* Mirror image: a multi-value spec pointed at a scalar column. */
      out[col] = v.map((x) => String(x)).join(", ");
    } else {
      out[col] = v;
    }
  }
  /* air_pressure isn't in the column map (different shapes) but a positive
     bar value means the machine needs compressed air — keep the legacy
     boolean truthful for its remaining readers. */
  const air = specs["air_pressure"];
  if (typeof air === "number" && air > 0) out["pneumatic_supply"] = true;
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
    { id: "supplier", label: "Supplier & Sourcing", shortLabel: "Supplier", icon: <FactoryIcon className="h-4 w-4" /> },
    { id: "identity", label: "Hero & Identity", shortLabel: "Identity", icon: <SparklesIcon className="h-4 w-4" /> },
    { id: "specs", label: "Specifications", shortLabel: "Specs", icon: <Settings2Icon className="h-4 w-4" /> },
    { id: "commercial", label: "Variants", shortLabel: "Variants", icon: <BoxesIcon className="h-4 w-4" /> },
    { id: "pricing", label: "Cost & Price", shortLabel: "Price", icon: <DollarSignIcon className="h-4 w-4" /> },
    { id: "logistics", label: "Logistics & Customs", shortLabel: "Logistics", icon: <GlobeIcon className="h-4 w-4" /> },
    { id: "compliance", label: "Compliance & Warranty", shortLabel: "Compliance", icon: <ShieldCheckIcon className="h-4 w-4" /> },
    { id: "media", label: "Media & Documents", shortLabel: "Media", icon: <ImageRawIcon className="h-4 w-4" /> },
    { id: "knowledge", label: "Knowledge & Relationships", shortLabel: "Knowledge", icon: <BookOpenIcon className="h-4 w-4" /> },
    { id: "finalize", label: "Review & Publish", shortLabel: "Review", icon: <CheckIcon className="h-4 w-4" /> },
  ];
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
  /* This bar hosts the screen's ONE long ramp, so the main header pane
     must not add its flat frost on top — two filtered bands in the same
     strip read as two edges. Declared live, because only the component
     that mounts the layer knows it actually rendered. */
  useTopRampOwner(true);
  /* RAMP OVERHANG, TUNED. Without the two vars this bar took the 3rem
     default, so its ramp hung 48px BELOW itself while `mb-6` only clears 24 —
     the top half of whatever sits under the tabs (here the product title row
     and its chips) was inside the 28px blur layer and stayed frosted
     permanently, even with the page scrolled to the top. The ramp is for
     content PASSING under a bar, not for content parked there. 1rem / 2.5rem
     are the values ProductProfile and ProductList already use for this
     identical bar; this was the one that was missed. */
  /* FULL-BLEED, and the owner's screenshot ("what is this?") is why. The
     ramp layer is inset:0 of this nav — inside the page's px-4…px-16 padding
     it painted a floating blurred RECTANGLE with visible side edges over the
     empty strip above the tabs, instead of the edge-to-edge top frost every
     other page shows. Same negative-margin breakout ProductList's bar uses,
     sized to this page's own padding scale; the matching padding puts the
     tab strip itself back on the grid. */
  return (
    <nav className="kx-bar-host sticky top-0 z-20 mb-6 py-2 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 bg-[var(--bg-primary)]/90 backdrop-blur-md [--kx-ramp-top:26rem] [--kx-ramp-ext:1rem] [--kx-ramp-fade:1.5rem]">
      <div aria-hidden className="kx-glass-bar kx-bar-prog"><i /><i /><i /><i /></div>
      <TabStrip
        ariaLabel="Product sections"
        items={items.map((it) => ({
          key: it.id,
          label: it.label,
          active: it.index === activeIndex,
          onClick: () => onSelect(it.index),
        }))}
      />
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
  const aurora = useSkin() === "aurora";
  /* The wizard is mounted under BOTH /products and /product-data. Keep
     back / cancel / post-save inside whichever app the operator is
     actually in — mirrors ProductList's baseRoute logic so the
     list → form → back loop never jumps apps. */
  const baseRoute = (pathname || "").startsWith("/product-data") ? "/product-data" : "/products";
  const { t, lang } = useTranslation(PRODUCTS_UI_I18N);
  /* Locale names in the VIEWER's language (中文 UI → 阿拉伯语, عربي UI →
     الصينية …) — Intl.DisplayNames, no hand dictionaries. */
  const localeDisplay = useCallback((code: string) => {
    try {
      const dn = new Intl.DisplayNames([lang === "zh" ? "zh" : lang === "ar" ? "ar" : "en"], { type: "language" });
      return dn.of(code) || LOCALES.find((l) => l.code === code)?.name || code;
    } catch {
      return LOCALES.find((l) => l.code === code)?.name || code;
    }
  }, [lang]);
  const isEdit = !!productId;

  /* ── Adopted id: the product exists now, even if the URL still says "new" ──
     A save is not one write. createProduct() lands the row, then models,
     media, translations, suppliers, certifications, documents and specs
     follow. If any of those throws, we land in catch() and the redirect to
     /<id>/edit never runs — so the form stays in create mode while the
     product is already in the database. Two things then go wrong:

       · the slug check omits excludeProductId and the product is reported
         as colliding with ITSELF ("This URL is already used by <its own
         name>") — what the owner hit;
       · pressing Save again calls createProduct AGAIN, duplicating the
         product instead of finishing the one that exists.

     Remembering the new id the moment the row lands fixes both: every
     uniqueness check excludes it, and a retry updates instead of
     duplicating. `isEdit` deliberately stays tied to the ROUTE id so
     adopting an id never re-triggers the initial data load. */
  const [adoptedId, setAdoptedId] = useState<string | null>(null);
  const effectiveId = productId ?? adoptedId ?? null;

  /* P0 #3 · Draft Autosave — one localStorage slot per product
     (or "new" for a not-yet-saved product). Bumped key version (v1)
     so a future shape change can't try to restore an incompatible
     old draft. */
  const draftKey = useMemo(() => `koleex:pd:draft:v1:${productId || "new"}`, [productId]);

  /* ── Lookup data ── */
  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryRow[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; name_cn?: string | null; logo: string | null; supply_type?: string | null; payment_terms?: string | null; currency?: string | null; moq?: string | null; lead_time?: string | null; email?: string | null; phone?: string | null; website?: string | null; wechat?: string | null; location?: string | null; primary_contact?: { name: string | null; role: string | null; email: string | null; mobile: string | null } | null; rating?: number | null; sample_status?: string | null; employees?: string | null; year_established?: string | null; categories?: string[] | null; certifications?: string[] | null }[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [families, setFamilies] = useState<string[]>([]);
  const [brandLogos, setBrandLogos] = useState<Record<string, string>>({});
  const [divisionLogos, setDivisionLogos] = useState<Record<string, string>>({});
  const [categoryLogos, setCategoryLogos] = useState<Record<string, string>>({});
  const [subcategoryLogos, setSubcategoryLogos] = useState<Record<string, string>>({});
  /* Classification icon HUB overrides (DB) — { level: { slug: icon_url } }.
     Empty = built-in icons; a set entry wins. See /api/classification-icons. */
  const [classIcons, setClassIcons] = useState<Record<string, Record<string, string>>>({});
  const [allTags, setAllTags] = useState<string[]>([]);
  const [attrSuggestions, setAttrSuggestions] = useState<{ voltage: string[]; plug_types: { name: string; image?: string | null }[]; colors: string[]; watt: string[]; levels: string[] }>({ voltage: [], plug_types: [], colors: [], watt: [], levels: [] });

  /* ── Form state ── */
  const [product, setProduct] = useState<ProductFormState>({ ...EMPTY_PRODUCT });
  const [models, setModels] = useState<ModelFormState[]>([]);
  const [media, setMedia] = useState<MediaFormState[]>([]);
  /* Variants entry mode. "grid" = the catalog-shaped family spec grid
     (rows = specs, columns = models) — the junior data-entry path;
     "cards" = the detailed per-model cards (pricing, packing, photo). */
  const [variantsView, setVariantsView] = useState<"grid" | "cards">("grid");
  /* ── Family mode (owner's model) ──
     familyOn reveals the SECOND tab strip under the main tabs; the strip
     picks WHICH member the form is pointed at. activeMember 0 = the
     primary → the form behaves exactly as before; >0 = Hero/Specs/Price/
     Logistics bind to that member. */
  const [familyOn, setFamilyOn] = useState(false);
  const [activeMember, setActiveMember] = useState(0);
  const [translations, setTranslations] = useState<TranslationFormState[]>([]);
  const [prices, setPrices] = useState<MarketPriceFormState[]>([]);
  const [related, setRelated] = useState<RelatedProductFormState[]>([]);
  const [productSuppliers, setProductSuppliers] = useState<ProductSupplierFormState[]>([]);
  /* Stand / Table configurable options (their specs & variants). Held in form
     state so they can be entered before the product's first save, then
     persisted alongside everything else. */
  const [accessoryOptions, setAccessoryOptions] = useState<AccessoryOptionRow[]>([]);
  const [certifications, setCertifications] = useState<ProductCertificationFormState[]>([]);
  const [productDocuments, setProductDocuments] = useState<ProductDocumentFormState[]>([]);

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

  /* ── Hero Product-Name language control ──
     English is the base (product.product_name). This lets the operator
     pick another language and write that locale's product name inline —
     manually, or auto-filled from English via /api/ai/translate (which
     only supports zh + ar; other locales are manual-only). Writes into
     the same `translations` state as the Languages & Markets section
     (product_translations.product_name), so there's one source of truth. */
  const [heroNameLocale, setHeroNameLocale] = useState<string>("zh");
  /* Keep the Auto-translate TARGET aligned with the visible adder row:
     once a locale has a name it becomes a stacked row, so the adder (and
     the button) must advance to the first UNFILLED locale — otherwise
     "Auto-translate" silently retranslates an already-filled language and
     looks broken for the one on screen. */
  useEffect(() => {
    const filled = new Set(
      translations.filter((tr) => (tr.product_name || "").trim()).map((tr) => tr.locale),
    );
    if (filled.has(heroNameLocale)) {
      const next = LOCALES.find((l) => !filled.has(l.code));
      if (next) setHeroNameLocale(next.code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translations]);
  const [translatingHeroName, setTranslatingHeroName] = useState(false);
  /* Inline status for the auto-translate action so a failure / unconfigured
     provider is surfaced honestly instead of silently copying the English. */
  const [heroNameMsg, setHeroNameMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  /* ── Hero Short-Description language control — same pattern as the
     product name, but writes per-locale into product_translations.excerpt
     (English base = product.excerpt). */
  const [heroExcerptLocale, setHeroExcerptLocale] = useState<string>("zh");
  const [translatingHeroExcerpt, setTranslatingHeroExcerpt] = useState(false);
  const [heroExcerptMsg, setHeroExcerptMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  /* Full product description — same per-locale Auto-translate flow as the
     short description, writing into product_translations.description
     (English base = product.description). */
  const [descLocale, setDescLocale] = useState<string>("zh");
  const [translatingDesc, setTranslatingDesc] = useState(false);
  const [descMsg, setDescMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [showDescTr, setShowDescTr] = useState(false);
  /* Translation rows are collapsed by default to keep the hero clean — the
     operator opts in per field with a small link (and they auto-open when a
     translation already exists, e.g. when editing). */
  const [showNameTr, setShowNameTr] = useState(false);
  const [showExcerptTr, setShowExcerptTr] = useState(false);
  const [showTaglineTr, setShowTaglineTr] = useState(false);
  const [heroTaglineLocale, setHeroTaglineLocale] = useState<string>("zh");
  const [translatingHeroTagline, setTranslatingHeroTagline] = useState(false);
  const [heroTaglineMsg, setHeroTaglineMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  /* ── AI copy suggestions (tagline / excerpt / highlights / tags) ──
     One in-flight request at a time; aiBusy holds the field being drafted.
     Suggestions land in form state only — the operator reviews, edits, saves. */
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiMsg, setAiMsg] = useState<{ field: string; kind: "error" | "ok"; text: string } | null>(null);

  /* P0 #3 · recovered-draft banner. Holds the timestamp of an
     autosaved draft found on mount so we can offer Restore / Discard.
     We NEVER auto-apply it — the saved product is left untouched until
     the operator explicitly chooses to restore (no dumb overwrite). */
  const [draftMeta, setDraftMeta] = useState<{ savedAt: number; stale: boolean } | null>(null);
  const draftCheckedRef = useRef(false);
  /* The DB row's updated_at, captured at load. A draft autosaved BEFORE the
     product's last save is a time machine: restoring it and saving reverts
     every newer change (the save loop deletes DB rows absent from the form).
     That exact sequence collapsed a family's per-model photos and prices back
     to the family values on 2026-08-19 — so a stale draft must announce
     itself, not sit behind the primary button. */
  const dbSavedAtRef = useRef<number | null>(null);

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
  /* Programmatic-change budget: setup effects (e.g. the auto-seeded first
     model on a NEW product) increment this BEFORE mutating watched state;
     the watcher consumes one credit instead of marking dirty. Without it,
     opening /products/new armed the leave-warning with zero user input. */
  const programmaticChangesRef = useRef(0);
  useEffect(() => {
    if (loading) return;        // still hydrating from server
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;                   // first run AFTER hydration — baseline
    }
    if (programmaticChangesRef.current > 0) {
      programmaticChangesRef.current -= 1;
      return;                   // setup mutation, not a user edit
    }
    setDirty(true);
  }, [loading, product, models, media, translations, prices, related, productSuppliers, certifications, productDocuments, sewingSpecs]);

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
          productSuppliers,
          certifications,
          productDocuments,
          sewingSpecs,
        };
        window.localStorage.setItem(draftKey, JSON.stringify(snapshot));
      } catch {
        /* storage full / serialisation issue — drafting is best-effort */
      }
    }, 800);
    return () => window.clearTimeout(id);
  }, [loading, dirty, product, models, media, translations, prices, related, productSuppliers, certifications, productDocuments, sewingSpecs, draftKey]);

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
      setDraftMeta({
        savedAt: parsed.savedAt,
        stale: dbSavedAtRef.current != null && parsed.savedAt < dbSavedAtRef.current,
      });
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
      /* Ghost photos: a freshly-attached image exists only as `_file`, and
         `_file` is deliberately not serialised into the draft — so a draft
         row with no id and no url is an empty shell. Restoring it looks like
         the photo survived, then the save loop skips it silently (no _file,
         no id) and the photo is just gone. Drop the shells here and SAY so,
         or the operator learns photos "randomly" vanish. */
      let droppedPhotos = 0;
      if (Array.isArray(d.media)) {
        const rows = (d.media as MediaFormState[]).filter((m) => m.id || (m.url && m.url.trim() !== ""));
        droppedPhotos = d.media.length - rows.length;
        setMedia(rows);
      }
      if (Array.isArray(d.translations)) setTranslations(d.translations);
      if (Array.isArray(d.prices)) setPrices(d.prices);
      if (Array.isArray(d.related)) setRelated(d.related);
      if (Array.isArray(d.productSuppliers)) setProductSuppliers(d.productSuppliers);
      if (Array.isArray(d.certifications)) setCertifications(d.certifications);
      if (Array.isArray(d.productDocuments)) setProductDocuments(d.productDocuments);
      if (d.sewingSpecs) setSewingSpecs(d.sewingSpecs);
      setDirty(true);
      setDraftMeta(null);
      setError("");
      setSuccess(
        t("draft.restored", "Draft restored — review the fields, then Save when you're ready.") +
        (droppedPhotos > 0
          ? " " + t("draft.photosDropped", "{n} attached photo(s) could not be kept in the draft — please attach them again before saving.").replace("{n}", String(droppedPhotos))
          : ""),
      );
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
    /* When there are unsaved edits, open a themed ConfirmDialog instead
       of the native window.confirm (which Safari renders with a system
       dialog that clashes with the hub's dark theme). The actual leave
       happens in leaveNow() once the user confirms. */
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    leaveNow();
  };

  /* Return to the list of whichever app we're in (/product-data or
     /products) so Back / Cancel never bounces the operator into the
     other app. */
  const leaveNow = () => router.push(baseRoute);

  /* ── Main image ref for hero ── */
  const mainImageRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  /* ── Derived: Stand / Table accessory? Its "specs & variants" are the
        configurable option axes (shape/size/quality · thickness/lifting/
        wheels…), NOT machine specs. Force these out of the sewing path so the
        Specs/Variants tabs never show motor/needle/speed fields for them. ── */
  const isAccessory = product.subcategory_slug === "stands" || product.subcategory_slug === "tables";

  /* ── Derived: is this a sewing machine product? ── */
  const isSewing = !isAccessory && isSewingMachineSubcategory(product.subcategory_slug, product.division_slug, product.category_slug);

  /* ── Wizard steps ── */
  const steps = useMemo(() => getSteps(isSewing), [isSewing]);

  /* ── Load data ── */
  useEffect(() => {
    let cancelled = false;
    /* Resolve to a fallback if a reference fetch rejects OR stalls. A single
       slow/failed lookup (a storage logo list, the attribute config, etc.)
       must never trap the "Add product" form on an infinite spinner — that
       was the bug: the load had no try/finally and no timeout, so one hung
       request kept setLoading(false) from ever running. */
    const REF_TIMEOUT = 12_000;
    const guard = <T,>(p: Promise<T>, fallback: T): Promise<T> =>
      Promise.race([
        Promise.resolve(p).catch(() => fallback),
        new Promise<T>((res) => setTimeout(() => res(fallback), REF_TIMEOUT)),
      ]);
    (async () => {
     try {
      /* ONE taxonomy trip, not three. fetchDivisions + fetchCategories +
         fetchSubcategories are three separate endpoints carrying what
         /api/catalog-refs returns in a single response — and fetchTaxonomyAll
         also reads the local mirror the catalogue has usually already filled,
         so arriving here from the grid now costs zero taxonomy requests
         instead of three. Measured on /product-data/new: 15 requests on open,
         four of them taxonomy. */
      const [taxo, supplierList, brandList, familyList, logoMap, attrCfg, divLogos, catLogos, subLogos, classIconMap] = await Promise.all([
        guard(fetchTaxonomyAll(), { divisions: [], categories: [], subcategories: [] } as Awaited<ReturnType<typeof fetchTaxonomyAll>>),
        guard(fetchSupplierNames(), [] as Awaited<ReturnType<typeof fetchSupplierNames>>),
        guard(fetchUniqueBrands(), [] as Awaited<ReturnType<typeof fetchUniqueBrands>>),
        guard(fetchUniqueFamilies(), [] as Awaited<ReturnType<typeof fetchUniqueFamilies>>),
        guard(fetchBrandLogos(), {} as Awaited<ReturnType<typeof fetchBrandLogos>>),
        guard(fetchAttributeConfig(), { voltage: [], plug_types: [], colors: [], watt: [], levels: [], tags: [], tag_colors: {} } as Awaited<ReturnType<typeof fetchAttributeConfig>>),
        guard(fetchDivisionLogos(), {} as Awaited<ReturnType<typeof fetchDivisionLogos>>),
        guard(fetchCategoryLogos(), {} as Awaited<ReturnType<typeof fetchCategoryLogos>>),
        guard(fetchSubcategoryLogos(), {} as Awaited<ReturnType<typeof fetchSubcategoryLogos>>),
        guard(fetchClassificationIcons(), {} as Awaited<ReturnType<typeof fetchClassificationIcons>>),
      ]);
      if (cancelled) return;
      const divs = taxo.divisions, cats = taxo.categories, subs = taxo.subcategories;
      setDivisions(divs);
      setCategories(cats);
      setSubcategories(subs);
      setSuppliers(supplierList);
      /* Case-insensitive dedupe: one stray product typed "KOLEEX" while 452
         say "Koleex" — the union of brand strings then shows the same brand
         twice in the picker. First (registry) casing wins. */
      setBrands(
        brandList.filter(
          (b, i) => brandList.findIndex((x) => x.toLowerCase() === b.toLowerCase()) === i,
        ),
      );
      setFamilies(familyList.filter((f, i) => familyList.findIndex((x) => x.toLowerCase() === f.toLowerCase()) === i));
      setAllTags(attrCfg.tags);
      setBrandLogos(logoMap);
      setDivisionLogos(divLogos);
      setCategoryLogos(catLogos);
      setSubcategoryLogos(subLogos);
      setClassIcons(classIconMap);
      setAttrSuggestions({
        voltage: attrCfg.voltage,
        plug_types: attrCfg.plug_types,
        colors: attrCfg.colors,
        watt: attrCfg.watt,
        levels: attrCfg.levels,
      });

      if (isEdit && productId) {
        const [p, dbModels, dbMedia, dbTranslations, dbRelated, dbSewingSpecs, dbSuppliers, dbCerts, dbDocs] = await Promise.all([
          guard(fetchProductById(productId), null as Awaited<ReturnType<typeof fetchProductById>>),
          guard(fetchModelsByProductId(productId), [] as Awaited<ReturnType<typeof fetchModelsByProductId>>),
          guard(fetchMediaByProductId(productId), [] as Awaited<ReturnType<typeof fetchMediaByProductId>>),
          guard(fetchTranslationsByProductId(productId), [] as Awaited<ReturnType<typeof fetchTranslationsByProductId>>),
          guard(fetchRelatedProducts(productId), [] as Awaited<ReturnType<typeof fetchRelatedProducts>>),
          guard(fetchSewingSpecsByProductId(productId), null as Awaited<ReturnType<typeof fetchSewingSpecsByProductId>>),
          guard(fetchProductSuppliers(productId), [] as Awaited<ReturnType<typeof fetchProductSuppliers>>),
          guard(fetchProductCertifications(productId), [] as Awaited<ReturnType<typeof fetchProductCertifications>>),
          guard(fetchProductDocuments(productId), [] as Awaited<ReturnType<typeof fetchProductDocuments>>),
        ]);
        if (cancelled) return;
        if (!p) { setError("Product not found"); return; }
        dbSavedAtRef.current = p.updated_at ? new Date(p.updated_at).getTime() : null;

        const modelIds = dbModels.map(m => m.id);
        const dbPrices = await guard(fetchMarketPricesByModelIds(modelIds), [] as Awaited<ReturnType<typeof fetchMarketPricesByModelIds>>);

        setProduct({
          division_slug: p.division_slug,
          category_slug: p.category_slug,
          subcategory_slug: p.subcategory_slug,
          product_name: p.product_name,
          slug: p.slug,
          brand: p.brand || "",
          level: p.level || "",
          family: p.family || "",
          mpn: p.mpn || "",
          gtin: p.gtin || "",
          manufacturer: p.manufacturer || "",
          generation: p.generation || "",
          internal_sku: p.internal_sku || "",
          launch_date: p.launch_date || "",
          eol_date: p.eol_date || "",
          alternate_names: p.alternate_names || [],
          legacy_code: p.legacy_code || "",
          brand_mark_url: p.brand_mark_url || "",
          hero_poster_url: p.hero_poster_url || "",
          status_reason: p.status_reason || "",
          model_year: p.model_year || "",
          available_from: p.available_from || "",
          last_order_date: p.last_order_date || "",
          meta_title: p.meta_title || "",
          meta_description: p.meta_description || "",
          og_image_url: p.og_image_url || "",
          revision_history: Array.isArray(p.revision_history) ? p.revision_history : [],
          tags: p.tags || [],
          excerpt: p.excerpt || "",
          highlights: p.highlights || [],
          feature_cards: p.feature_cards || [],
          description: p.description || "",
          specs: (p.specs as Record<string, string>) || {},
          supports_head_only: p.supports_head_only,
          supports_complete_set: p.supports_complete_set,
          warranty: p.warranty || "",
          warranty_months: p.warranty_months?.toString() || "",
          warranty_type: p.warranty_type || "",
          warranty_start_from: p.warranty_start_from || "",
          warranty_coverage: p.warranty_coverage || "",
          warranty_exclusions: p.warranty_exclusions || "",
          spare_parts_availability: p.spare_parts_availability || "",
          spare_parts_stock: p.spare_parts_stock || "",
          service_life: p.service_life || "",
          maintenance_interval: p.maintenance_interval || "",
          technical_support: p.technical_support || "",
          support_channels: p.support_channels || [],
          training_available: !!p.training_available,
          installation_service: !!p.installation_service,
          returns_policy: p.returns_policy || "",
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
          pricing_mode: (m as { pricing_mode?: string }).pricing_mode as "fixed" | "from" | "on_request" || "fixed",
          price_note: (m as { price_note?: string }).price_note || "",
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
          container_40hq_qty: m.container_40hq_qty?.toString() || "",
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
          /* Typed DB JSON → UI strings (arrays comma-joined). */
          specs_overrides: Object.fromEntries(
            Object.entries((m as { specs_overrides?: Record<string, unknown> | null }).specs_overrides ?? {}).map(
              ([k, v]) => [k, Array.isArray(v) ? v.map(String).join(", ") : String(v)],
            ),
          ),
          name_i18n: ((m as { name_i18n?: Record<string, string> | null }).name_i18n) ?? {},
          supplier_overrides: ((m as { supplier_overrides?: Record<string, unknown> | null }).supplier_overrides) ?? {},
          tagline_i18n: ((m as { tagline_i18n?: Record<string, string> | null }).tagline_i18n) ?? {},
        }));
        setModels(mappedModels);
        setOriginalModelIds(modelIds);
        if (mappedModels.length > 1) setFamilyOn(true);

        const modelIdToTempIdEarly: Record<string, string> = {};
        mappedModels.forEach(mm => { if (mm.id) modelIdToTempIdEarly[mm.id] = mm._tempId; });
        const mappedMedia: MediaFormState[] = dbMedia.map(m => ({
          _tempId: crypto.randomUUID(),
          id: m.id,
          type: m.type,
          url: m.url,
          file_path: m.file_path,
          alt_text: m.alt_text || "",
          order: m.order,
          model_id: m.model_id,
          _modelTempId: m.model_id ? modelIdToTempIdEarly[m.model_id] || "" : "",
        }));
        setMedia(mappedMedia);
        setOriginalMediaIds(dbMedia.map(m => m.id));

        const mappedTranslations: TranslationFormState[] = dbTranslations.map(t => ({
          _tempId: crypto.randomUUID(),
          id: t.id,
          locale: t.locale,
          product_name: t.product_name,
          tagline: t.tagline || "",
          excerpt: t.excerpt || "",
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
          relation_type: r.relation_type || "related",
        }));
        setRelated(mappedRelated);

        const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
        setProductSuppliers(dbSuppliers.map(s => ({
          _tempId: crypto.randomUUID(),
          supplier_id: s.supplier_id,
          is_primary: !!s.is_primary,
          supplier_product_code: str(s.supplier_product_code),
          moq: str(s.moq),
          lead_time_days: str(s.lead_time_days),
          unit_cost_cny: str(s.unit_cost_cny),
          currency: s.currency || "CNY",
          cost_basis: (["factory_only", "packing", "delivered"].includes(s.cost_basis as string) ? s.cost_basis : "delivered") as ProductSupplierFormState["cost_basis"],
          cost_includes_tax: s.cost_includes_tax === undefined || s.cost_includes_tax === null ? true : !!s.cost_includes_tax,
          payment_terms: str(s.payment_terms),
          notes: str(s.notes),
          notes_i18n: Object.fromEntries(
            Object.entries(
              ((s as { notes_i18n?: Record<string, unknown> | null }).notes_i18n) ?? {},
            ).map(([k, v]) => [k, String(v ?? "")]),
          ),
          price_options: (s.price_options ?? []).map((o) => ({
            price: str(o.price),
            note: String(o.note ?? ""),
            note_i18n: Object.fromEntries(Object.entries(o.note_i18n ?? {}).map(([k, v]) => [k, String(v ?? "")])),
          })),
          supplier_product_name: str(s.supplier_product_name),
          supplier_product_name_i18n: Object.fromEntries(
            Object.entries(
              ((s as { supplier_product_name_i18n?: Record<string, unknown> | null }).supplier_product_name_i18n) ?? {},
            ).map(([k, v]) => [k, String(v ?? "")]),
          ),
          supplier_product_photo: str(s.supplier_product_photo),
          supply_type: s.supply_type || "",
          sample_available: !!s.sample_available,
          sample_cost: str(s.sample_cost),
          incoterms: s.incoterms || "",
          supplier_warranty_months: str(s.supplier_warranty_months),
          price_tiers: (s.price_tiers ?? []).map(t => ({ min_qty: str(t.min_qty), price: str(t.price) })),
          price_quoted_on: s.price_quoted_on || "",
          price_valid_until: s.price_valid_until || "",
          quotation_file_url: s.quotation_file_url || "",
          quotation_file_name: s.quotation_file_name || "",
          sourcing_status: s.sourcing_status || "",
          preferred_reason: str(s.preferred_reason),
          min_order_value: str(s.min_order_value),
          tooling_owner: s.tooling_owner || "",
          tooling_cost: str(s.tooling_cost),
        })));

        setCertifications(dbCerts.map(c => ({
          _tempId: crypto.randomUUID(),
          cert_type: c.cert_type || "CE",
          certified_standard: str(c.certified_standard),
          cert_number: str(c.cert_number),
          issuer: str(c.issuer),
          issued_date: str(c.issued_date),
          expiry_date: str(c.expiry_date),
          reminder_days: str(c.reminder_days),
          country_scope: str(c.country_scope),
          model_ids: c.model_ids || [],
          file_url: str(c.file_url),
          verification_url: str(c.verification_url),
          status: c.status || "active",
          notes: str(c.notes),
        })));

        setProductDocuments(dbDocs.map(d => ({
          _tempId: crypto.randomUUID(),
          doc_type: d.doc_type,
          title: str(d.title),
          file_url: str(d.file_url),
          file_name: str(d.file_name),
          language: str(d.language),
          version: str(d.version),
          model_ids: d.model_ids || [],
        })));

        if (dbSewingSpecs) {
          setSewingSpecs({
            template_slug: dbSewingSpecs.template_slug,
            common_specs: (dbSewingSpecs.common_specs as Record<string, unknown>) || {},
            template_specs: (dbSewingSpecs.template_specs as Record<string, unknown>) || {},
          });
        }
      }

     } catch (e) {
       // Last-resort guard: even an unexpected throw must not leave the
       // form stuck on the loading spinner.
       console.error("[ProductForm] load failed", e);
     } finally {
       if (!cancelled) setLoading(false);
     }
    })();
    return () => { cancelled = true; };
  }, [isEdit, productId]);

  /* Load Stand / Table configurable options on edit (kept separate from the
     main bundle since it's only relevant for accessories). */
  useEffect(() => {
    if (!isEdit || !productId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/products/${productId}/options`, { credentials: "include" });
        const j = (await r.json().catch(() => ({}))) as { options?: Array<Omit<AccessoryOptionRow, "_k">> };
        if (!cancelled) setAccessoryOptions((j.options ?? []).map((o, i) => ({ ...o, _k: `${o.axis}-${i}-${Math.round(o.price_delta_cny)}` })));
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
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
  const [discardOpen, setDiscardOpen] = useState(false);
  /* Family promote-to-primary confirmation (KDS CF-1, neutral tone). */
  const [promoteAsk, setPromoteAsk] = useState<ModelFormState | null>(null);
  const [supplierTarget, setSupplierTarget] = useState<"hero" | string>("hero");

  /* ── Hero: main image helpers ── */
  const mainImage = media.find(m => m.type === "main_image");
  const mainImageFile = mainImage?._file ?? null;
  const mainImageUrl = mainImage?.url || null;
  // Memoize the object URL so it isn't re-created on every render, and revoke
  // the previous one on change/unmount (was leaking a blob per render).
  const mainImageSrc = useMemo(
    () => (mainImageFile ? URL.createObjectURL(mainImageFile) : mainImageUrl),
    [mainImageFile, mainImageUrl],
  );
  useEffect(() => () => { if (mainImageFile && mainImageSrc) URL.revokeObjectURL(mainImageSrc); }, [mainImageFile, mainImageSrc]);

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
    /* Family mode: the strip points this tab at ONE member and the banner
       promises "Hero … save to this model". Writing `main_image` here would
       break that promise — the line below drops EVERY existing main_image
       row, so a member's upload replaced the family photo and all members
       ended up showing it. A member writes its own `model_image` row (the
       same shape the Models section already uses); only the primary owns
       `main_image`, so single-model products are untouched. */
    if (heroMember) { setModelPhoto(heroMember, file); return; }
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

  /* ── Gallery photos, right beside the main photo ──
     The Media tab always accepted multiple gallery images, but nothing on
     the identity step said so — operators saw one photo box and concluded
     the product could only hold one photo. Same deferred-upload contract as
     the main image (`_file` rides until save), same validation limits. */
  const handleGalleryAdd = (files: FileList | null) => {
    if (!files?.length) return;
    const MAX_MB = 8;
    const existing = media.filter((m) => m.type === "gallery").length;
    const additions: MediaFormState[] = [];
    for (const file of Array.from(files)) {
      if (!/^image\//.test(file.type)) {
        setError(t("media.mainNotImage", "{name} is not an image.").replace("{name}", file.name));
        continue;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        const mb = (file.size / (1024 * 1024)).toFixed(1);
        setError(
          t("media.mainTooBig", "{name} is {size} MB — max {max} MB.")
            .replace("{name}", file.name).replace("{size}", mb).replace("{max}", String(MAX_MB)),
        );
        continue;
      }
      additions.push({
        _tempId: crypto.randomUUID(),
        type: "gallery",
        url: "",
        file_path: null,
        alt_text: "",
        order: existing + additions.length,
        model_id: null,
        _file: file,
      });
    }
    if (additions.length) { setError(""); setMedia([...media, ...additions]); }
  };

  const removeGalleryPhoto = (tempId: string) => {
    setMedia(media.filter((m) => m._tempId !== tempId));
  };

  /* ── Model photos (family Phase 3) ──
     One optional hero per model, stored as product_media type
     "model_image" bound by model_id (or _modelTempId until the model is
     saved). A model without one inherits the family's main photo. */
  const modelPhotoOf = (m: { _tempId: string; id?: string }): MediaFormState | undefined =>
    media.find((x) =>
      x.type === "model_image" &&
      ((m.id && x.model_id === m.id) || (x._modelTempId && x._modelTempId === m._tempId)));

  const setModelPhoto = (m: { _tempId: string; id?: string }, file: File) => {
    const MAX_MB = 8;
    if (!file.type.startsWith("image/")) {
      setError(t("media.notImage", "{name} is not an image.").replace("{name}", file.name));
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setError(
        t("media.mainTooBig", "{name} is {size} MB — max {max} MB.")
          .replace("{name}", file.name).replace("{size}", mb).replace("{max}", String(MAX_MB)),
      );
      return;
    }
    setError("");
    const keep = media.filter((x) => x !== modelPhotoOf(m));
    setMedia([...keep, {
      _tempId: crypto.randomUUID(),
      type: "model_image",
      url: "",
      file_path: null,
      alt_text: "",
      order: 0,
      model_id: m.id ?? null,
      _modelTempId: m._tempId,
      _file: file,
    }]);
  };

  const removeModelPhoto = (m: { _tempId: string; id?: string }) => {
    const cur = modelPhotoOf(m);
    if (cur) setMedia(media.filter((x) => x !== cur));
  };

  /* Generic image uploader for the small Identity image fields (brand
     mark, OG image). Uploads immediately via uploadProductFile and writes
     the resulting URL straight onto the product — unlike the main image
     which is deferred to save. Image-only, 8 MB cap. */
  const uploadIdentityImage = async (
    files: FileList | null,
    key: "brand_mark_url" | "og_image_url" | "hero_poster_url",
  ) => {
    const file = files?.[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { setError(t("media.mainNotImage", "{name} is not an image.").replace("{name}", file.name)); return; }
    if (file.size > 8 * 1024 * 1024) { setError("Image must be under 8 MB."); return; }
    setError("");
    const res = await uploadProductFile(file);
    if (res?.url) updateProduct_({ [key]: res.url } as Partial<ProductFormState>);
  };

  /* ── Auto-create first model ── */
  const ensureFirstModel = useCallback(() => {
    if (models.length === 0) {
      programmaticChangesRef.current += 1;
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
  /* A schema group can be routed to the Logistics tab (formTab:"logistics") —
     shipping-unit data (packing dims, CBM, net/gross weight) lives with
     freight/customs, not machine specs. Split the resolved schema so the Specs
     editor shows everything EXCEPT those groups, and the Logistics tab renders
     ONLY those groups. Both write to the same product.schema_specs. */
  /* Memoised: a fresh object each render gave SchemaSpecsSection a new
     `schema` identity on every keystroke, re-running its own derivations
     and re-rendering the whole section. */
  const specsTabSchema = useMemo(() => (activeSpecsSchema
    ? { ...activeSpecsSchema, groups: activeSpecsSchema.groups.filter((g) => g.formTab !== "logistics") }
    : null), [activeSpecsSchema]);
  const logisticsTabSchema = useMemo(() => {
    if (!activeSpecsSchema) return null;
    const groups = activeSpecsSchema.groups.filter((g) => g.formTab === "logistics");
    return groups.length ? { ...activeSpecsSchema, groups } : null;
  }, [activeSpecsSchema]);
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
  /* When the active schema carries a `certifications` field (a public-facing
     CE/ISO badge on the Specs tab), that is the single input for certifications
     — so the Compliance tab hides its redundant CE toggle (keeping RoHS + the
     detailed certificate records). Avoids entering CE in two tabs. */
  const certsCoveredBySchema = !!activeSpecsSchema?.groups?.some(
    (g) => g.fields?.some((f) => f.key === "certifications"),
  );

  /* Flat schema fields for the family grid — same filter the ModelsSection
     override picker uses (no files/images/long text in a table cell). */
  const familyGridFields = useMemo(
    () => (activeSpecsSchema?.groups ?? []).flatMap((g) =>
      g.fields
        .filter((f) => !["file", "image", "long_text"].includes(f.fieldType))
        .map((f) => ({
          key: f.key,
          label: f.label ?? f.key,
          unit: f.unit ?? null,
          fieldType: f.fieldType,
          options: (f.options ?? []).map((o) => ({ value: o.value, label: o.label })),
        }))),
    [activeSpecsSchema],
  );

  /* Member-context plumbing (family mode). memberCtx is true only for a
     NON-primary selection: the primary keeps today's Hero/Price behaviour
     (those sections already edit models[0] / the supplier link). */
  const safeActiveMember = activeMember < models.length ? activeMember : 0;
  /* Include the PRIMARY (index 0): one strip, one editing model for every
     member. The primary's code stays governed by the Hero block (the
     panel shows it read-only and scrolls there); its factory cost binds
     to the supplier-link sync below. */
  const memberCtx = familyOn && !!models[safeActiveMember];
  const activeModel = models[safeActiveMember];
  const updateActiveMember = (u: Partial<ModelFormState>) =>
    setModels(models.map((m, i) => (i === safeActiveMember ? { ...m, ...u } : m)));

  /* ── Hero photo, scoped to the selected member ──
     Declared here rather than beside the other hero helpers above because it
     needs activeModel/memberCtx. handleMainImage closes over heroMember and
     only reads it when the operator clicks, so the later declaration is fine.
     A member with no photo of its own INHERITS the family photo for display,
     mirroring how factory cost inherits the supplier baseline — the caption
     under the slot says which of the two you are looking at. */
  const heroMember = memberCtx && safeActiveMember > 0 ? activeModel : null;
  const heroMemberPhoto = heroMember ? modelPhotoOf(heroMember) : undefined;
  const heroMemberFile = heroMemberPhoto?._file ?? null;
  const heroMemberUrl = heroMemberPhoto?.url || null;
  const heroMemberSrc = useMemo(
    () => (heroMemberFile ? URL.createObjectURL(heroMemberFile) : heroMemberUrl),
    [heroMemberFile, heroMemberUrl],
  );
  useEffect(() => () => { if (heroMemberFile && heroMemberSrc) URL.revokeObjectURL(heroMemberSrc); }, [heroMemberFile, heroMemberSrc]);
  /* What the Hero slot actually shows: the member's own photo, else the
     family photo it inherits, else the family photo when on the primary. */
  const heroSrc = heroMember ? (heroMemberSrc ?? mainImageSrc) : mainImageSrc;
  const heroInherited = !!heroMember && !heroMemberPhoto;
  /* New member = a COPY of the primary's identity you then edit — code,
     supplier reference, tagline and its zh/ar translations all start
     synced from the primary/family (owner rule: "synced with the primary
     then I edit manually"). The live uniqueness check flags the code
     until its suffix is changed. */
  const seedMemberFromPrimary = useCallback((): ModelFormState => {
    const m = createEmptyModel();
    const p0 = models[0];
    m.order = models.length;
    m.model_name = product.product_name || p0?.model_name || "";
    m.primary_model = p0?.primary_model || "";
    m.reference_model = p0?.reference_model || "";
    m.tagline = p0?.tagline || "";
    const trZh = translations.find((x) => x.locale === "zh");
    const trAr = translations.find((x) => x.locale === "ar");
    m.name_i18n = {
      ...(trZh?.product_name ? { zh: trZh.product_name } : {}),
      ...(trAr?.product_name ? { ar: trAr.product_name } : {}),
    };
    m.tagline_i18n = {
      ...(trZh?.tagline ? { zh: trZh.tagline } : {}),
      ...(trAr?.tagline ? { ar: trAr.tagline } : {}),
    };
    return m;
  }, [models, product.product_name, translations]);

  const addFamilyMember = () => {
    setModels([...models, seedMemberFromPrimary()]);
    setActiveMember(models.length);
    const heroIdx = steps.findIndex((st) => st.id === "identity");
    if (heroIdx >= 0) goToStep(heroIdx);
  };
  const removeFamilyMember = (i: number) => {
    if (i <= 0) return; /* the primary anchors the product */
    setModels(models.filter((_, x) => x !== i).map((m, x) => ({ ...m, order: x })));
    setActiveMember(0);
  };

  /* Product-level packing (Logistics tab, schema_specs) → offered to variant
     cards as a one-click copy. mm → cm for carton dims; enum → readable. */
  const productPackingDefaults = (() => {
    if (!activeSpecsSchema) return null;
    const sp = (product.schema_specs || {}) as Record<string, unknown>;
    const str = (v: unknown) => (v === undefined || v === null || v === "" ? undefined : String(v));
    const dims = (() => {
      const d = sp.packing_dimensions;
      if (d && typeof d === "object" && !Array.isArray(d)) {
        const o = d as { length?: number; width?: number; height?: number };
        if (o.length && o.width && o.height) return `${o.length / 10} × ${o.width / 10} × ${o.height / 10} cm`;
      }
      return undefined;
    })();
    const readable = typeof sp.packing_type === "string"
      ? sp.packing_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : undefined;
    return {
      packing_type: readable,
      carton_dimensions: dims,
      cbm: str(sp.cbm),
      net_weight: str(sp.net_weight),
      gross_weight: str(sp.gross_weight),
      container_20ft_qty: str(sp.container_20ft_qty),
      container_40ft_qty: str(sp.container_40ft_qty),
      container_40hq_qty: str(sp.container_40hq_qty),
    };
  })();

  /* ── Primary model helpers (shown in Hero) ── */
  const primaryModel = models[0];

  /* ── Market tier, resolved by the LIVE commercial policy ───────────────
     The tier chips and the pricing engine answer the same question — how
     expensive is this machine — so they must not answer it from different
     tables. Product levels are per-tenant rows the owner edits in Commercial
     Policy: this tenant runs L2 up to 30,000 and L3 up to 100,000, while the
     code's DEFAULT_CATEGORIES still said 20,000 / 50,000. Any threshold
     hardcoded here would be wrong today and drift again on the next edit.

     /api/products/price-preview already resolves the level through that live
     policy and returns its code, so we ask the engine instead of
     re-implementing it. Cost is read from the supplier link or the variant,
     whichever tab it was entered on. */
  const tierCost = useMemo(() => {
    const link = productSuppliers.find((x) => x.is_primary) || productSuppliers[0] || null;
    const raw = link?.unit_cost_cny ?? primaryModel?.cost_price ?? null;
    const n = raw == null || raw === "" ? NaN : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [productSuppliers, primaryModel?.cost_price]);

  const [tierSuggestion, setTierSuggestion] = useState<{ tier: string; levelName: string } | null>(null);

  useEffect(() => {
    if (tierCost == null) { setTierSuggestion(null); return; }
    let cancelled = false;
    const LEVEL_TO_TIER: Record<string, string> = { L1: "entry", L2: "mid", L3: "premium", L4: "enterprise" };
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/products/price-preview?cost_cny=${encodeURIComponent(String(tierCost))}&qty=1`, { credentials: "include" });
        if (!r.ok) return;
        const j = (await r.json()) as { base?: { productLevelCode?: string; productLevelName?: string } };
        const code = j?.base?.productLevelCode;
        if (cancelled || !code) return;
        const tier = LEVEL_TO_TIER[code];
        if (tier) setTierSuggestion({ tier, levelName: j.base?.productLevelName || code });
      } catch { /* the chips still work by hand */ }
    }, 350);
    return () => { cancelled = true; clearTimeout(id); };
  }, [tierCost]);

  /* Fill an EMPTY tier from the policy — once, and never over a choice the
     operator already made. Auto-correcting a deliberate override would make
     the control feel broken. */
  const tierAutofilledRef = useRef(false);
  useEffect(() => {
    if (!tierSuggestion || tierAutofilledRef.current) return;
    if (product.level) return;
    tierAutofilledRef.current = true;
    updateProduct_({ level: tierSuggestion.tier });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tierSuggestion, product.level]);

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

  /* Factory cost is a single value shared with the Supplier tab. If a cost was
     typed on the Price tab before any supplier existed (stored on the model),
     move it onto the primary supplier link the moment one is added — so the two
     never diverge. The guard (link cost empty + model cost set) self-clears, so
     this can't loop. */
  useEffect(() => {
    if (!productSuppliers.length) return;
    const cp = models[0]?.cost_price;
    if (!cp) return;
    const i = productSuppliers.findIndex((s) => s.is_primary);
    const ti = i >= 0 ? i : 0;
    const link = productSuppliers[ti];
    if (link && (link.unit_cost_cny == null || link.unit_cost_cny === "")) {
      /* Setup migration, not a user edit — credit the dirty watcher twice
         (one per watched-state write) so the form doesn't open "Unsaved". */
      programmaticChangesRef.current += 2;
      setProductSuppliers((prev) => prev.map((s, idx) => (idx === ti ? { ...s, unit_cost_cny: cp } : s)));
      updatePrimaryModel({ cost_price: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productSuppliers.length]);

  /* ── Hero localized-name helpers ──
     Read/write a single locale's product_name inside the shared
     `translations` array. A row is created lazily the first time a
     locale gets a value (other fields stay empty until the operator
     fills them in Languages & Markets). */
  const heroLocaleName = (locale: string): string =>
    translations.find((tr) => tr.locale === locale)?.product_name ?? "";

  const setHeroLocaleName = useCallback((locale: string, value: string) => {
    setTranslations((prev) => {
      const i = prev.findIndex((tr) => tr.locale === locale);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], product_name: value };
        return next;
      }
      return [
        ...prev,
        {
          _tempId: `tr_${locale}_${prev.length}`,
          locale,
          product_name: value,
          tagline: "",
          excerpt: "",
          description: "",
        },
      ];
    });
  }, []);

  /* Auto-translate the English product name into the selected locale.
     The /api/ai/translate service only supports zh + ar; for any other
     locale the button is hidden and the operator types manually. */
  const autoTranslateHeroName = useCallback(async () => {
    const source = product.product_name.trim();
    if (!source) return;
    setTranslatingHeroName(true);
    setHeroNameMsg(null);
    try {
      const res = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: source, target_lang: heroNameLocale, source_lang: "en" }),
      });
      const data = (await res.json()) as {
        translated?: string;
        fallback?: boolean;
        reason?: string;
        error?: string;
      };

      // The endpoint returns 200 with `fallback:true` when no AI provider is
      // configured (reason:"no_provider") or the provider call failed
      // (reason:"provider_error") — in both cases `translated` is just the
      // original English echoed back. Surface that instead of pretending.
      if (!res.ok || data?.fallback || !data?.translated) {
        const why =
          data?.reason === "no_provider"
            ? t("hero.translateNoProvider", "Auto-translate is off — no translation service is configured. Type the name manually for now.")
            : t("hero.translateFailed", "Couldn't translate right now. Try again, or type the name manually.");
        setHeroNameMsg({ kind: "error", text: why });
        return;
      }

      setHeroLocaleName(heroNameLocale, data.translated);
      setHeroNameMsg({ kind: "ok", text: t("hero.translateDone", "Translated — review before saving.") });
    } catch {
      setHeroNameMsg({
        kind: "error",
        text: t("hero.translateFailed", "Couldn't translate right now. Try again, or type the name manually."),
      });
    } finally {
      setTranslatingHeroName(false);
    }
  }, [product.product_name, heroNameLocale, setHeroLocaleName, t]);

  /* ── Hero localized short-description helpers ── (mirror of the name
     helpers, writing product_translations.excerpt). */
  const heroLocaleExcerpt = (locale: string): string =>
    translations.find((tr) => tr.locale === locale)?.excerpt ?? "";

  const setHeroLocaleExcerpt = useCallback((locale: string, value: string) => {
    setTranslations((prev) => {
      const i = prev.findIndex((tr) => tr.locale === locale);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], excerpt: value };
        return next;
      }
      return [
        ...prev,
        {
          _tempId: `tr_${locale}_${prev.length}`,
          locale,
          product_name: "",
          tagline: "",
          excerpt: value,
          description: "",
        },
      ];
    });
  }, []);

  /* Build the fact sheet the AI writes from: identity + classification +
     flattened structured specs + plain-text description. English canonical
     names on purpose — the copy targets the public (English) page. */
  const buildAiContext = () => {
    const specs: Record<string, string> = {};
    for (const [k, v] of Object.entries(product.schema_specs || {})) {
      if (v === null || v === undefined || v === "") continue;
      if (typeof v === "object") continue;
      specs[k] = String(v);
      if (Object.keys(specs).length >= 40) break;
    }
    return {
      name: product.product_name,
      brand: product.brand,
      family: product.family,
      division: divisions.find(d => d.slug === product.division_slug)?.name,
      category: categories.find(c => c.slug === product.category_slug)?.name,
      subcategory: subcategories.find(x => x.slug === product.subcategory_slug)?.name,
      models: models.map(m => m.primary_model || m.model_name).filter(Boolean).slice(0, 6),
      specs,
      description: (product.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1500),
    };
  };

  const aiSuggest = async (field: "tagline" | "excerpt" | "highlights" | "tags") => {
    if (aiBusy) return;
    setAiBusy(field);
    setAiMsg(null);
    try {
      const res = await fetch("/api/ai/product-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ field, context: buildAiContext() }),
      });
      const data = (await res.json()) as { value?: string; values?: string[]; fallback?: boolean; reason?: string; error?: string };
      if (!res.ok || data.fallback || (!data.value && !data.values)) {
        const why = data.reason === "no_provider"
          ? t("ai.noProvider", "AI is off — no provider configured.")
          : t("ai.failed", "Couldn't draft right now — try again.");
        setAiMsg({ field, kind: "error", text: why });
        return;
      }
      if (field === "tagline" && data.value) updatePrimaryModel({ tagline: data.value.slice(0, 80) });
      if (field === "excerpt" && data.value) updateProduct_({ excerpt: data.value });
      if (field === "highlights" && data.values) updateProduct_({ highlights: data.values.slice(0, 5) });
      if (field === "tags" && data.values) {
        const merged = [...product.tags];
        for (const tag of data.values) if (!merged.some(x => x.toLowerCase() === tag.toLowerCase())) merged.push(tag);
        updateProduct_({ tags: merged });
      }
      setAiMsg({ field, kind: "ok", text: t("ai.done", "Drafted — review before saving.") });
    } catch {
      setAiMsg({ field, kind: "error", text: t("ai.failed", "Couldn't draft right now — try again.") });
    } finally {
      setAiBusy(null);
    }
  };

  /* ── Hero localized tagline helpers ── (same shape as the excerpt
     helpers, writing product_translations.tagline). */
  const heroLocaleTagline = (locale: string): string =>
    translations.find((tr) => tr.locale === locale)?.tagline ?? "";

  const setHeroLocaleTagline = useCallback((locale: string, value: string) => {
    setTranslations((prev) => {
      const i = prev.findIndex((tr) => tr.locale === locale);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], tagline: value };
        return next;
      }
      return [
        ...prev,
        {
          _tempId: `tr_${locale}_${prev.length}`,
          locale,
          product_name: "",
          tagline: value,
          excerpt: "",
          description: "",
        },
      ];
    });
  }, []);

  const autoTranslateHeroTagline = useCallback(async () => {
    const source = (primaryModel?.tagline || "").trim();
    if (!source) return;
    setTranslatingHeroTagline(true);
    setHeroTaglineMsg(null);
    try {
      const res = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: source, target_lang: heroTaglineLocale, source_lang: "en" }),
      });
      const data = (await res.json()) as { translated?: string; fallback?: boolean; reason?: string };
      if (!res.ok || data?.fallback || !data?.translated) {
        const why =
          data?.reason === "no_provider"
            ? t("hero.translateNoProvider", "Auto-translate is off — no translation service is configured. Type the name manually for now.")
            : t("hero.translateFailed", "Couldn't translate right now. Try again, or type the name manually.");
        setHeroTaglineMsg({ kind: "error", text: why });
        return;
      }
      setHeroLocaleTagline(heroTaglineLocale, data.translated);
      setHeroTaglineMsg({ kind: "ok", text: t("hero.translateDone", "Translated — review before saving.") });
    } catch {
      setHeroTaglineMsg({ kind: "error", text: t("hero.translateFailed", "Couldn't translate right now. Try again, or type the name manually.") });
    } finally {
      setTranslatingHeroTagline(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroTaglineLocale, setHeroLocaleTagline, t, models]);

  const autoTranslateHeroExcerpt = useCallback(async () => {
    const source = product.excerpt.trim();
    if (!source) return;
    setTranslatingHeroExcerpt(true);
    setHeroExcerptMsg(null);
    try {
      const res = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: source, target_lang: heroExcerptLocale, source_lang: "en" }),
      });
      const data = (await res.json()) as {
        translated?: string;
        fallback?: boolean;
        reason?: string;
        error?: string;
      };
      if (!res.ok || data?.fallback || !data?.translated) {
        const why =
          data?.reason === "no_provider"
            ? t("hero.translateNoProvider", "Auto-translate is off — no translation service is configured. Type the name manually for now.")
            : t("hero.translateFailed", "Couldn't translate right now. Try again, or type the name manually.");
        setHeroExcerptMsg({ kind: "error", text: why });
        return;
      }
      setHeroLocaleExcerpt(heroExcerptLocale, data.translated);
      setHeroExcerptMsg({ kind: "ok", text: t("hero.translateDone", "Translated — review before saving.") });
    } catch {
      setHeroExcerptMsg({
        kind: "error",
        text: t("hero.translateFailed", "Couldn't translate right now. Try again, or type the name manually."),
      });
    } finally {
      setTranslatingHeroExcerpt(false);
    }
  }, [product.excerpt, heroExcerptLocale, setHeroLocaleExcerpt, t]);

  /* ── Full product description, per-locale ── */
  const localeDescription = (locale: string): string =>
    translations.find((tr) => tr.locale === locale)?.description ?? "";

  const setLocaleDescription = useCallback((locale: string, value: string) => {
    setTranslations((prev) => {
      const i = prev.findIndex((tr) => tr.locale === locale);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], description: value };
        return next;
      }
      return [
        ...prev,
        {
          _tempId: `tr_${locale}_${prev.length}`,
          locale,
          product_name: "",
          tagline: "",
          excerpt: "",
          description: value,
        },
      ];
    });
  }, []);

  const autoTranslateDescription = useCallback(async () => {
    const source = (product.description || "").trim();
    if (!source) return;
    setTranslatingDesc(true);
    setDescMsg(null);
    try {
      const res = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: source, target_lang: descLocale, source_lang: "en" }),
      });
      const data = (await res.json()) as {
        translated?: string;
        fallback?: boolean;
        reason?: string;
        error?: string;
      };
      if (!res.ok || data?.fallback || !data?.translated) {
        const why =
          data?.reason === "no_provider"
            ? t("hero.translateNoProvider", "Auto-translate is off — no translation service is configured. Type the name manually for now.")
            : t("hero.translateFailed", "Couldn't translate right now. Try again, or type the name manually.");
        setDescMsg({ kind: "error", text: why });
        return;
      }
      setLocaleDescription(descLocale, data.translated);
      setDescMsg({ kind: "ok", text: t("hero.translateDone", "Translated — review before saving.") });
    } catch {
      setDescMsg({
        kind: "error",
        text: t("hero.translateFailed", "Couldn't translate right now. Try again, or type the name manually."),
      });
    } finally {
      setTranslatingDesc(false);
    }
  }, [product.description, descLocale, setLocaleDescription, t]);

  /* Live auto-suggest: whenever the prefix or supplier-model changes,
     recompute the suggestion. Only push it into `primary_model` when
     the field has never been hand-edited (coding_status != "edited" /
     "locked"). The "Reset to auto" button below clears the flag so a
     user can reclaim the suggestion explicitly. */
  /* The supplier's own model code now lives on the primary supplier LINK
     (Supplier tab → "Model number" = supplier_product_code). Fall back to
     the legacy product_models.reference_model for products created before
     sourcing moved to the Supplier tab. This is what seeds the KOLEEX
     code suggestion (prefix + supplier model). */
  const primarySupplierModel =
    (productSuppliers.find((s) => s.is_primary) || productSuppliers[0])?.supplier_product_code ||
    primaryModel?.reference_model || "";
  /* Hero mirror must follow the SELECTED family member: a sub-model's
     supplier model = its supplier_overrides / reference_model, falling
     back to the primary's (inheritance). Only the KOLEEX code
     auto-suggest keeps reading the primary. */
  const shownSupplierModel =
    memberCtx && safeActiveMember > 0 && activeModel
      ? String(
          ((activeModel.supplier_overrides ?? {}) as Record<string, unknown>).supplier_product_code ??
            activeModel.reference_model ??
            "",
        ) || primarySupplierModel
      : primarySupplierModel;
  /* THE KOLEEX-code block edits the SELECTED family member, not always
     the primary (owner: "when I change the model number even I press
     the sub product it affects the primary only — big problem"). */
  const isMemberCodeTarget = memberCtx && safeActiveMember > 0 && !!activeModel;
  const codeModel = isMemberCodeTarget ? activeModel : primaryModel;
  const updateCodeModel = isMemberCodeTarget ? updateActiveMember : updatePrimaryModel;
  const suggestedPrimaryModel = suggestPrimaryModel(
    resolvedPrefix,
    primarySupplierModel,
  );
  const suggestedCodeForTarget = isMemberCodeTarget
    ? suggestPrimaryModel(resolvedPrefix, shownSupplierModel)
    : suggestedPrimaryModel;
  useEffect(() => {
    if (!primaryModel) return;
    if (!resolvedPrefix || !primarySupplierModel) return;
    const status = primaryModel.coding_status;
    /* Never overwrite a code the operator has taken ownership of —
       hand-edited, approved, or locked. Only auto/blank codes re-derive. */
    if (status === "edited" || status === "approved" || status === "locked") return;
    if (primaryModel.primary_model === suggestedPrimaryModel) return;
    /* Mirror the suggestion into model_name + slug too so the hero
       "Primary Model" input — bound to primary_model with a model_name
       fallback — picks it up regardless of how the form loaded. */
    /* Auto-derived code, not a user edit — see above. */
    programmaticChangesRef.current += 1;
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
    const code = (codeModel?.primary_model || "").trim();
    if (!code) {
      setCodeCheck({ status: "idle" });
      return;
    }
    /* Same-family duplicate — the server check excludes this product,
       so two members sharing a code must be caught locally. */
    const selfIdx = isMemberCodeTarget ? safeActiveMember : 0;
    const dupIdx = models.findIndex((m, i) => i !== selfIdx && (m.primary_model || "").trim().toUpperCase() === code.toUpperCase());
    if (dupIdx >= 0) {
      setCodeCheck({
        status: "taken",
        conflict: {
          product_id: effectiveId || "",
          product_name: product.product_name || "",
          product_slug: null,
          model_id: "",
          model_name: models[dupIdx].model_name || models[dupIdx].primary_model || "",
          primary_model: models[dupIdx].primary_model || "",
        },
      });
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
        if (effectiveId) params.set("excludeProductId", effectiveId);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeModel?.primary_model, effectiveId, resolvedPrefix, safeActiveMember, models.length]);

  /* ── Slug uniqueness check ──────────────────────────────────────
     The public URL is /products/<slug>; two products sharing a slug
     means only one resolves and the other silently 404s. Mirror the
     Primary-Model check: debounced ping to /api/products/check-slug,
     tenant-scoped, edit-aware. Surfaced as a friendly warning (not a
     hard save-block) because slug isn't guaranteed unique on legacy
     rows — we don't want to trap re-saves of old products. */
  type SlugCheck =
    | { status: "idle" }
    | { status: "checking" }
    | { status: "available" }
    | { status: "error" }
    | { status: "taken"; conflict: { product_id: string; product_name: string; slug: string } };
  const [slugCheck, setSlugCheck] = useState<SlugCheck>({ status: "idle" });

  useEffect(() => {
    const slug = (product.slug || "").trim().toLowerCase();
    if (!slug) {
      setSlugCheck({ status: "idle" });
      return;
    }
    let cancelled = false;
    setSlugCheck({ status: "checking" });
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ slug });
        if (effectiveId) params.set("excludeProductId", effectiveId);
        const res = await fetch(`/api/products/check-slug?${params.toString()}`, { credentials: "include" });
        if (cancelled) return;
        if (!res.ok) { setSlugCheck({ status: "error" }); return; }
        const payload = await res.json();
        if (cancelled) return;
        if (payload?.available === false && payload?.conflict) {
          setSlugCheck({ status: "taken", conflict: payload.conflict });
        } else {
          setSlugCheck({ status: "available" });
        }
      } catch (err) {
        if (cancelled) return;
        console.warn("[slug uniqueness] check failed", err);
        setSlugCheck({ status: "error" });
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [product.slug, effectiveId]);

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
        ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
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

  /* ── Publish-readiness gaps (advisory) ──
     Surfaced inline next to the hero Status / Visible toggles so the
     operator sees what's still missing AT THE MOMENT they flip a
     product live — not only when they hit Save or reach the Review
     tab. Combines the identity-critical required set with two soft
     commercial checks (a main photo + a headline price) that the
     catalog really wants before a product faces customers. Advisory
     only: it never blocks: the authoritative publish gate still lives
     in save(). */
  const publishGaps = useMemo(() => {
    const gaps = [...missingRequiredLabels];
    if (!media.some((m) => m.type === "main_image")) gaps.push(t("publish.gapImage", "Main photo"));
    if (!(primaryModel?.global_price || "").toString().trim()) gaps.push(t("publish.gapPrice", "Selling price"));
    /* Export-market readiness: Chinese is the priority second locale — flag
       a missing zh product name so a product doesn't go live English-only. */
    if (!translations.some((tr) => tr.locale === "zh" && (tr.product_name || "").trim())) {
      gaps.push(t("publish.gapChineseName", "Chinese name"));
    }
    return gaps;
  }, [missingRequiredLabels, media, primaryModel?.global_price, translations, t]);

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
        if (effectiveId) params.set("excludeProductId", effectiveId);
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
        feature_cards: product.feature_cards.length ? product.feature_cards : null,
        level: product.level || null,
        family: product.family || null,
        mpn: product.mpn || null,
        gtin: product.gtin || null,
        manufacturer: product.manufacturer || null,
        generation: product.generation || null,
        internal_sku: product.internal_sku || null,
        launch_date: product.launch_date || null,
        eol_date: product.eol_date || null,
        alternate_names: (() => { const a = product.alternate_names.map((s) => s.trim()).filter(Boolean); return a.length ? a : null; })(),
        legacy_code: product.legacy_code || null,
        brand_mark_url: product.brand_mark_url || null,
        hero_poster_url: product.hero_poster_url || null,
        status_reason: product.status_reason || null,
        model_year: product.model_year || null,
        available_from: product.available_from || null,
        last_order_date: product.last_order_date || null,
        meta_title: product.meta_title || null,
        meta_description: product.meta_description || null,
        og_image_url: product.og_image_url || null,
        revision_history: (product.revision_history || []).filter((r) => (r.version || r.date || r.note)),
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
        warranty_months: product.warranty_months === "" ? null : Number(product.warranty_months),
        warranty_type: product.warranty_type || null,
        warranty_start_from: product.warranty_start_from || null,
        warranty_coverage: product.warranty_coverage || null,
        warranty_exclusions: product.warranty_exclusions || null,
        spare_parts_availability: product.spare_parts_availability || null,
        spare_parts_stock: product.spare_parts_stock || null,
        service_life: product.service_life || null,
        maintenance_interval: product.maintenance_interval || null,
        technical_support: product.technical_support || null,
        support_channels: product.support_channels.length ? product.support_channels : null,
        training_available: product.training_available,
        installation_service: product.installation_service,
        returns_policy: product.returns_policy || null,
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
      if (effectiveId) {
        const ok = await updateProduct(effectiveId, productData);
        if (!ok) throw new Error("Failed to update product");
        pid = effectiveId;
      } else {
        const created = await createProduct(productData);
        if (!created) throw new Error("Failed to create product");
        pid = created.id;
        /* Adopt immediately — everything after this point can still throw,
           and a retry must finish THIS product, not create a second one. */
        setAdoptedId(pid);
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
          pricing_mode: m.pricing_mode || "fixed",
          price_note: m.price_note?.trim() || null,
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
          container_40hq_qty: m.container_40hq_qty ? parseInt(m.container_40hq_qty, 10) : null,
          stock_status: m.stock_status || null,
          supplier_overrides: m.supplier_overrides && Object.keys(m.supplier_overrides).length ? m.supplier_overrides : null,
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
          /* UI strings → typed JSON per the resolved schema field. */
          specs_overrides: (() => {
            const src = m.specs_overrides ?? {};
            const out: Record<string, unknown> = {};
            const fields = new Map(
              (activeSpecsSchema?.groups ?? []).flatMap((g) => g.fields.map((f) => [f.key, f] as const)),
            );
            for (const [k, raw] of Object.entries(src)) {
              const val = String(raw).trim();
              if (!val) continue;
              const f = fields.get(k);
              const ft = f?.fieldType;
              if (ft === "number" || ft === "unit_number") {
                const n = parseFloat(val);
                if (Number.isFinite(n)) out[k] = n;
              } else if (ft === "boolean") {
                out[k] = val === "true" || val === "yes";
              } else if (ft === "multi_select" || ft === "chips" || ft === "icon_chips" || ft === "image_chips") {
                const arr = val.split(",").map((x) => x.trim()).filter(Boolean);
                if (arr.length > 0) out[k] = arr;
              } else {
                out[k] = val;
              }
            }
            return Object.keys(out).length > 0 ? out : null;
          })(),
        };

        if (m.id) {
          /* updateModel returns a boolean and never throws — ignoring it
             meant a failed model write (403, validation, anything) still
             ended in "Product saved successfully!". The operator then
             reports "my price didn't save" and nothing anywhere says why.
             A failed model write is a failed SAVE: name the model, stop. */
          const ok = await updateModel(m.id, modelData);
          if (!ok) {
            throw new Error(
              t("save.modelFailed", "Couldn't save model \"{code}\" — the rest of the save was stopped so nothing is half-written. Check your access or try again.")
                .replace("{code}", m.primary_model || m.model_name || `#${m.order + 1}`),
            );
          }
          tempIdToRealId[m._tempId] = m.id;
        } else {
          const created = await createModel({ ...modelData, sku: "auto" });
          if (!created) {
            throw new Error(
              t("save.modelCreateFailed", "Couldn't create model \"{code}\" — the rest of the save was stopped.")
                .replace("{code}", m.primary_model || m.model_name || `#${m.order + 1}`),
            );
          }
          tempIdToRealId[m._tempId] = created.id;
        }
        /* Member translations ride a SEPARATE best-effort write: if the
           name_i18n/tagline_i18n columns aren't migrated yet, this fails
           quietly and the product save is untouched. */
        const realId = m.id || tempIdToRealId[m._tempId];
        const hasI18n = (m.name_i18n && Object.keys(m.name_i18n).length) || (m.tagline_i18n && Object.keys(m.tagline_i18n).length);
        if (realId && hasI18n) {
          try {
            await updateModel(realId, {
              name_i18n: m.name_i18n && Object.keys(m.name_i18n).length ? m.name_i18n : null,
              tagline_i18n: m.tagline_i18n && Object.keys(m.tagline_i18n).length ? m.tagline_i18n : null,
            });
          } catch { /* pending migration — advisory only */ }
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
            model_id: item.model_id || (item._modelTempId ? tempIdToRealId[item._modelTempId] ?? null : null),
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
          tagline: t.tagline || null,
          excerpt: t.excerpt || null,
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
        // Finite-safe: empty OR unparseable ("abc", "12kg") → null (skip),
        // never silently coerced to 0 (was a "free product" risk on the catalog).
        const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
        await upsertMarketPrice({
          model_id: realModelId,
          country_code: p.country_code,
          currency: p.currency,
          market_price: num(p.market_price),
          head_only_price: num(p.head_only_price),
          complete_set_price: num(p.complete_set_price),
        });
      }

      await setRelatedProducts(pid, related.map(r => ({ related_id: r.related_id, relation_type: r.relation_type || "related" })));

      /* Supplier LINKS — per-product facts only; supplier master stays in
         the Suppliers app. Replace-the-set on save. */
      await saveProductSuppliers(pid, productSuppliers.map(s => {
        /* Fields shared with the supplier record are owned by the Suppliers
           app (source of truth) — don't persist per-product copies. Currency
           is inherited from the supplier so the cost price keeps a unit. */
        const sup = suppliers.find(x => x.id === s.supplier_id);
        return ({
        supplier_id: s.supplier_id,
        is_primary: s.is_primary,
        supplier_product_code: s.supplier_product_code || null,
        moq: null,
        lead_time_days: null,
        unit_cost_cny: s.unit_cost_cny === "" ? null : Number(s.unit_cost_cny),
        currency: sup?.currency || null,
        cost_basis: s.cost_basis || "delivered",
        cost_includes_tax: s.cost_includes_tax,
        payment_terms: null,
        notes: s.notes || null,
        notes_i18n: (() => {
          const clean = Object.fromEntries(
            Object.entries(s.notes_i18n ?? {})
              .map(([k, v]) => [k, String(v ?? "").trim()])
              .filter(([, v]) => v.length > 0),
          );
          return Object.keys(clean).length > 0 ? clean : null;
        })(),
        price_options: (() => {
          const rows = (s.price_options || [])
            .map((o) => ({
              price: o.price === "" ? null : Number(o.price),
              note: (o.note || "").trim(),
              note_i18n: (() => {
                const clean = Object.fromEntries(
                  Object.entries(o.note_i18n ?? {}).map(([k, v]) => [k, String(v ?? "").trim()]).filter(([, v]) => v.length > 0),
                );
                return Object.keys(clean).length ? clean : null;
              })(),
            }))
            .filter((o) => (o.price !== null && Number.isFinite(o.price)) || o.note.length > 0);
          return rows.length ? rows : null;
        })(),
        supplier_product_name: s.supplier_product_name || null,
        supplier_product_name_i18n: (() => {
          const clean = Object.fromEntries(
            Object.entries(s.supplier_product_name_i18n ?? {})
              .map(([k, v]) => [k, String(v ?? "").trim()])
              .filter(([, v]) => v.length > 0),
          );
          return Object.keys(clean).length > 0 ? clean : null;
        })(),
        supplier_product_photo: s.supplier_product_photo || null,
        supply_type: s.supply_type || null,
        sample_available: s.sample_available,
        sample_cost: s.sample_cost === "" ? null : Number(s.sample_cost),
        incoterms: s.incoterms || null,
        supplier_warranty_months: s.supplier_warranty_months === "" ? null : Number(s.supplier_warranty_months),
        price_tiers: (() => {
          const rows = (s.price_tiers || [])
            .map(t => ({ min_qty: t.min_qty === "" ? null : Number(t.min_qty), price: t.price === "" ? null : Number(t.price) }))
            .filter(t => t.min_qty !== null || t.price !== null);
          return rows.length ? rows : null;
        })(),
        price_quoted_on: s.price_quoted_on || null,
        price_valid_until: s.price_valid_until || null,
        quotation_file_url: s.quotation_file_url || null,
        quotation_file_name: s.quotation_file_name || null,
        sourcing_status: s.sourcing_status || null,
        preferred_reason: s.preferred_reason || null,
        min_order_value: s.min_order_value === "" ? null : Number(s.min_order_value),
        tooling_owner: s.tooling_owner || null,
        tooling_cost: s.tooling_cost === "" ? null : Number(s.tooling_cost),
        });
      }));

      /* Stand / Table configurable options — replace-the-set. Only meaningful
         for accessories; persisted here so they save with the product (no
         "save first" step). */
      if (product.subcategory_slug === "stands" || product.subcategory_slug === "tables") {
        const optPayload = accessoryOptions
          .filter((r) => r.value.trim())
          .map((r, i) => ({ axis: r.axis, value: r.value.trim(), price_delta_cny: r.affects_price ? r.price_delta_cny : 0, affects_price: r.affects_price, is_default: r.is_default, sort_order: i }));
        await fetch(`/api/products/${pid}/options`, {
          method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ options: optPayload }),
        });
      }

      /* Phase 4 — certifications + documents (replace-the-set). */
      await saveProductCertifications(pid, certifications.map(c => ({
        cert_type: c.cert_type,
        certified_standard: c.certified_standard || null,
        cert_number: c.cert_number || null,
        issuer: c.issuer || null,
        issued_date: c.issued_date || null,
        expiry_date: c.expiry_date || null,
        reminder_days: c.reminder_days === "" ? null : Number(c.reminder_days),
        country_scope: c.country_scope || null,
        model_ids: c.model_ids,
        file_url: c.file_url || null,
        verification_url: c.verification_url || null,
        status: c.status || "active",
        notes: c.notes || null,
      })));
      await saveProductDocuments(pid, productDocuments
        .filter(d => d.file_url)
        .map(d => ({
          doc_type: d.doc_type,
          title: d.title || null,
          file_url: d.file_url,
          file_name: d.file_name || null,
          language: d.language || null,
          version: d.version || null,
          model_ids: d.model_ids,
        })));

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
  const divisionName = localizedName(divisions.find(d => d.slug === product.division_slug), lang) || undefined;
  const categoryName = localizedName(categories.find(c => c.slug === product.category_slug), lang) || undefined;
  const subcategoryName = localizedName(subcategories.find(s => s.slug === product.subcategory_slug), lang) || undefined;

  if (loading) {
    return (
      <div className="kx-pd min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <SpinnerIcon className="h-6 w-6 text-[var(--text-dim)]" />
      </div>
    );
  }

  return (
    <div className="kx-pd min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {aurora && (
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
          <WavyBackground topLight />
        </div>
      )}
      {/* Container matched to the rest of the Hub (owner, 2026-08-20: "is
          this fit the screen size same as the other apps?" — it wasn't).
          Padding follows the --kx-bleed convention (px-4/6/8) instead of a
          private 8/12/16 scale, and the 1500px cap + centering is the
          Purchase reference — without it the form stretched edge-to-edge
          on wide screens while every other app stops. */}
      <div className="relative z-[1] mx-auto max-w-[1500px] px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* ═══ INLINE HEADER — matches AccountForm / EmployeeWizard style.
              Back-arrow + Cancel both route to /products via handleCancel,
              which warns when there are unsaved changes. Save publishes
              and clears the dirty flag inside `save()`. ═══ */}
        {/* relative z-30 lifts this row ABOVE the tab bar's 26rem ramp —
            the same lift PageHeader gives its hero. Without it the ramp
            treats the parked title row as scrolled-under content and smears
            it (owner screenshot, 2026-08-20: "the header have a problem"). */}
        <div className="relative z-30 flex items-center justify-between mb-6 md:mb-8 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleCancel}
              className="kx-glass h-10 w-10 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all shrink-0 cursor-pointer"
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
              className="kx-glass hidden sm:inline-flex items-center justify-center h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all cursor-pointer"
            >
              {t("action.cancel", "Cancel")}
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 transition-all disabled:opacity-50 shadow-lg shrink-0"
            >
              {saving ? <SpinnerIcon className="h-4 w-4" /> : <DiskIcon className="h-4 w-4" />}
              <span className="hidden sm:inline">{saving ? t("action.saving", "Saving...") : t("action.saveProduct", "Save Product")}</span>
            </button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="relative z-30 mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[13px] text-red-400 flex items-center gap-2">
            <TriangleWarningIcon className="h-4 w-4 shrink-0" /> {error}
            <button onClick={() => setError("")} className="ml-auto text-red-400/50 hover:text-red-400">×</button>
          </div>
        )}
        {success && (
          <div className="relative z-30 mb-5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[13px] text-emerald-400 flex items-center gap-2">
            <CheckIcon className="h-4 w-4 shrink-0" /> {success}
          </div>
        )}

        {/* ═══ P0 #3 · DRAFT RECOVERY ═══
            Shown when an autosaved draft for this slot was found on
            mount. Restore loads it into the form (review-then-save);
            Discard throws it away and keeps whatever is loaded. The
            saved product is never touched automatically. */}
        {/* relative z-30, same lift as the title row: these three banners PARK
            in the strip the tab bar's ramp covers, and under it the recovery
            banner rendered as an unreadable amber smear with a white blob —
            the owner circled it twice before it was even recognizable as a
            banner ("what is this?", "still have the same problem"). Parked
            chrome goes ABOVE the frost, always. */}
        {draftMeta && (
          <div className="relative z-30 mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
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
                {/* A draft older than the product's last save is a revert, not
                    a recovery — restoring and saving it undoes every change
                    made since. Warn in words AND swap the button emphasis so
                    the safe action (Discard) is the prominent one. */}
                {draftMeta.stale && (
                  <p className="mt-1 text-[11px] font-semibold text-amber-500">
                    {t("draft.staleWarning", "⚠ This draft is OLDER than the last save — restoring it will bring back old values and undo newer changes.")}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={discardDraft}
                  className={draftMeta.stale
                    ? "h-10 rounded-xl bg-[var(--bg-inverted)] px-5 text-[13px] font-semibold text-[var(--text-inverted)] transition-all shadow-lg"
                    : "h-10 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-4 text-[13px] font-semibold text-[var(--text-muted)] transition-all hover:text-[var(--text-primary)] hover:border-[var(--border-focus)]"}
                >
                  {t("draft.discard", "Discard")}
                </button>
                <button
                  type="button"
                  onClick={restoreDraft}
                  className={draftMeta.stale
                    ? "h-10 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-4 text-[13px] font-semibold text-[var(--text-muted)] transition-all hover:text-[var(--text-primary)] hover:border-[var(--border-focus)]"
                    : "h-10 rounded-xl bg-[var(--bg-inverted)] px-5 text-[13px] font-semibold text-[var(--text-inverted)] transition-all shadow-lg"}
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
            items={steps.map((s, i) => ({ index: i, id: s.id, label: t(STEP_SHORT_KEY[s.id] ?? "", s.shortLabel || s.label) }))}
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

        {/* ═══ FAMILY STRIP — the second tab slider. Picks WHICH member the
            main tabs edit; "+" appends a member and jumps to Hero. ═══ */}
        {familyOn && !isAccessory && (
          <FamilyStrip
            models={models}
            active={safeActiveMember}
            onPick={setActiveMember}
            onAdd={addFamilyMember}
            onRemove={removeFamilyMember}
          />
        )}

        {/* ═══ GLOBAL CLASSIFICATION BREADCRUMB (shown once classification is set, across all steps) ═══ */}
        {divisionName && steps[currentStep]?.id !== "classify" && (
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-ghost)] mb-4 px-1">
            <span className="font-bold uppercase tracking-wider text-[var(--text-dim)]">{t("wizard.classificationLabel", "Classification:")}</span>
            <span>{divisionName}</span>
            {categoryName && <><AngleRightIcon className="h-3 w-3" /><span>{categoryName}</span></>}
            {subcategoryName && <><AngleRightIcon className="h-3 w-3" /><span className="text-[var(--text-primary)] font-medium">{subcategoryName}</span></>}
            {resolvedPrefix && (
              <span
                className="ml-1 font-mono font-bold text-[10px] tracking-[0.06em] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-md px-1.5 py-0.5"
                title={t("wizard.prefixChipTitle", "KOLEEX classification prefix — inherited from this subcategory.")}
              >
                {resolvedPrefix}
              </span>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           STEP: HERO (identity + primary model)
           ═══════════════════════════════════════════════════════════ */}
        <div key={onePage ? "one-page" : currentStep} className={(onePage ? "space-y-10" : "") + " kx-tab-in"}>
        {(onePage || steps[currentStep]?.id === "identity") && (
          <div id="sec-identity" className="space-y-5 scroll-mt-28 animate-in fade-in duration-300">
            {/* ── HAS FAMILY ── the owner's switch: ON reveals the member
                strip under the main tabs. OFF is only possible while the
                product still has a single model. */}
            {!isAccessory && (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                    {t("fam.toggle", "This product has a family (multiple models)")}
                  </p>
                  <p className="text-[11px] text-[var(--text-ghost)] mt-0.5 leading-relaxed">
                    {t("fam.toggleHint", "Turns on the model strip under the main tabs — pick a model there, then Hero, Specs, Price and Logistics edit that model.")}
                  </p>
                </div>
                <Toggle
                  checked={familyOn}
                  onChange={(v) => {
                    if (!v && models.length > 1) return; /* delete members first */
                    setFamilyOn(v);
                    if (!v) setActiveMember(0);
                  }}
                  label=""
                />
              </div>
            )}
                        {/* ═══ PRODUCT POSTER / HERO BANNER (first field) ═══
                Optional designed banner shown full-bleed at the top of the
                public product page. Blank = the page auto-builds its hero from
                the product photo + name + tagline. Placed first so it reads as
                the product's headline visual. */}
            <Section id="poster" icon={<ImageRawIcon className="h-4 w-4" />} title={t("identity.posterTitle", "Product poster / hero banner")} badge={t("identity.posterBadge", "Optional · public page header")} defaultOpen>
              <div>
                <div className="w-full aspect-[21/9] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden flex items-center justify-center mb-3">
                  {product.hero_poster_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.hero_poster_url} alt="Product poster" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-[var(--text-ghost)] text-center px-4">
                      <ImageRawIcon className="h-8 w-8" />
                      <span className="text-[12px] font-medium text-[var(--text-muted)]">Recommended: 2520 × 1080 px · 21:9 · under 8 MB</span>
                      <span className="text-[10px]">No custom poster — the public page builds one automatically</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input type="text" className={`${inp} flex-1`} value={product.hero_poster_url} placeholder="Paste poster image URL, or upload →"
                    onChange={(e) => updateProduct_({ hero_poster_url: e.target.value })} />
                  <label className="h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer transition-colors shrink-0">
                    <CameraIcon className="h-3.5 w-3.5" /> {t("idf.upload", "Upload")}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadIdentityImage(e.target.files, "hero_poster_url")} />
                  </label>
                  {product.hero_poster_url && (
                    <button type="button" onClick={() => updateProduct_({ hero_poster_url: "" })} className="text-[11px] text-[var(--text-ghost)] hover:text-[var(--state-error,#FF3333)] shrink-0">{t("idf.clear", "Clear")}</button>
                  )}
                </div>
                <p className="text-[10px] text-[var(--text-ghost)] mt-1.5"><strong className="text-[var(--text-muted)] font-semibold">Size: 2520 × 1080 px (21:9), under 8 MB.</strong> Keep the product centered/right — the bottom-left is overlaid with the name, tagline &amp; button. Leave empty to auto-build the hero from the product photo, name &amp; tagline.</p>
              </div>
            </Section>

            {/* ═══ HERO CARD ═══
                    overflow-visible (not hidden) so the SelectWithCreate
                    dropdowns inside the Primary Commercial strip —
                    Supplier, Brand — can render OUTSIDE the card bounds
                    instead of being clipped behind it. Nothing inside
                    the card actually overflows visually, so there's no
                    cost to turning clipping off here. */}
            <div className="bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-subtle)] overflow-visible shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
              {/* ═══ PRIMARY SUPPLIER — top of the hero shell so sourcing
                  reads first. Read-only mirror of the Supplier tab. ═══ */}
              <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/30 px-6 md:px-8 py-4 rounded-t-3xl">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-6 w-6 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center">
                    <FactoryIcon className="h-3 w-3 text-[var(--text-ghost)]" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">{t("hero.sourcingStrip", "Primary supplier")}</span>
                </div>
                <div>
                  {(() => {
                    const link = productSuppliers.find((s) => s.is_primary) || productSuppliers[0] || null;
                    if (!link) {
                      return (
                        <button type="button" onClick={() => goToStep(steps.findIndex((s) => s.id === "supplier"))}
                          className="w-full rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/50 px-3.5 h-[42px] flex items-center gap-2 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-colors">
                          <FactoryIcon className="h-3.5 w-3.5 text-[var(--text-ghost)] shrink-0" />
                          <span>{t("hero.noSupplierLinked", "No supplier linked — add one in the Supplier tab")}</span>
                        </button>
                      );
                    }
                    const sup = suppliers.find((x) => x.id === link.supplier_id);
                    const name = sup?.name || t("hero.unknownSupplier", "(supplier)");
                    const cur = link.currency || sup?.currency || "";
                    return (
                      <button type="button" onClick={() => goToStep(steps.findIndex((s) => s.id === "supplier"))}
                        title={t("hero.manageInSupplierTab", "Manage in the Supplier tab")}
                        className="w-full text-left rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/50 px-3.5 py-2 hover:border-[var(--border-focus)] transition-colors">
                        <div className="flex items-center justify-end mb-0.5">
                          {/* Label removed — the band header above already
                              reads "PRIMARY SUPPLIER"; only the source hint
                              stays here. */}
                          <span className="text-[9px] text-[var(--text-ghost)]">{t("hero.fromSupplierTab", "from Supplier tab ›")}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[12px] text-[var(--text-primary)] truncate">
                          {sup?.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={sup.logo} alt="" className="h-10 w-10 rounded-lg object-contain bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-0.5 shrink-0" />
                          ) : (
                            <span className="h-10 w-10 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                              <FactoryIcon className="h-5 w-5 text-[var(--text-ghost)]" />
                            </span>
                          )}
                          <span className="font-semibold truncate">{name}</span>
                          {link.supplier_product_code && (<><span className="text-[var(--text-ghost)]">·</span><span className="font-mono text-[11px] truncate">{link.supplier_product_code}</span></>)}
                          {link.unit_cost_cny && (<><span className="text-[var(--text-ghost)]">·</span><span className="whitespace-nowrap">{cur ? `${cur} ` : ""}{link.unit_cost_cny}</span></>)}
                        </div>
                      </button>
                    );
                  })()}
                </div>
              </div>

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
                    {heroSrc ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={heroSrc} alt="Product" className="w-full h-full object-contain p-6" />
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
                        <div className="text-center px-4">
                          <p className="text-[14px] font-semibold text-[var(--text-dim)]">{t("hero.uploadPhoto", "Upload Product Photo")}</p>
                          <p className="text-[11px] text-[var(--text-ghost)] mt-1">{t("hero.dropHint", "Click to browse or drag & drop")}</p>
                          <p className="text-[10.5px] text-[var(--text-faint)] mt-2">{t("hero.mainPhotoSize", "Recommended: 2000 × 2000 px · square · transparent PNG (or white) · under 8 MB")}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Which photo am I looking at? In family mode the slot is
                      member-scoped, and an inherited family photo looks
                      identical to an owned one — so it has to be said in
                      words. rounded-md on the revert control because the
                      Aurora control-hover rule paints a ring on any button
                      and a ring cannot be clipped into a curve. */}
                  {heroMember && (
                    <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--text-ghost)]">
                      {heroInherited
                        ? t("hero.memberPhotoInherited", "Showing the family photo — upload one to give this model its own.")
                        : t("hero.memberPhotoOwn", "This model's own photo.")}
                      {!heroInherited && (
                        <button
                          type="button"
                          onClick={() => removeModelPhoto(heroMember)}
                          className="ms-2 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                        >
                          {t("hero.memberPhotoRevert", "Use the family photo")}
                        </button>
                      )}
                    </p>
                  )}

                  {/* ── Gallery strip ──
                      More photos live here, not in a hidden tab. Items are
                      type:"gallery" in the same media state the Media step
                      edits — the two views can never disagree. */}
                  <div className="mt-3">
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => { handleGalleryAdd(e.target.files); e.target.value = ""; }}
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      {media.filter((m) => m.type === "gallery").map((g) => {
                        const src = g._file ? URL.createObjectURL(g._file) : g.url;
                        return (
                          <div key={g._tempId} className="relative group/g h-16 w-16 rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt={g.alt_text || ""} className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeGalleryPhoto(g._tempId)}
                              className="absolute inset-0 bg-black/55 opacity-0 group-hover/g:opacity-100 transition-opacity flex items-center justify-center text-white"
                              title={t("hero.removePhoto", "Remove photo")}
                              aria-label={t("hero.removePhoto", "Remove photo")}
                            >
                              <TrashIcon size={14} />
                            </button>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="h-16 w-16 rounded-lg border-2 border-dashed border-[var(--border-subtle)] hover:border-[var(--border-focus)] text-[var(--text-ghost)] hover:text-[var(--text-dim)] flex flex-col items-center justify-center gap-0.5 transition-colors shrink-0"
                        title={t("hero.addPhotos", "Add more photos")}
                        aria-label={t("hero.addPhotos", "Add more photos")}
                      >
                        <PlusIcon size={14} />
                        <span className="text-[8.5px] font-semibold uppercase tracking-wide">{t("hero.galleryLabel", "Gallery")}</span>
                      </button>
                    </div>
                    <p className="mt-1.5 text-[10px] text-[var(--text-faint)]">
                      {t("hero.galleryHint", "Extra angles & details — these appear in the product gallery. Manage all media in the Media tab.")}
                    </p>
                  </div>
                </div>

                {/* Right: Product Identity (3/5 width) */}
                <div className="lg:col-span-3 p-6 md:p-8 flex flex-col justify-center gap-5">
                  {/* ── Top control row: Status · Featured · Visible · Level ──
                        Publishing controls live in the hero instead of
                        being buried in the Technical step. Admins can
                        see at a glance whether the product will show
                        up on the site and where it ranks. */}
                  {(() => {
                    const groupLabel = "block text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--text-ghost)] mb-1.5";
                    return (
                  <div className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[0_1px_3px_rgba(0,0,0,0.18)] p-4 md:p-5">
                    {/* Row 1 — Status + Visibility, each as a labelled group. */}
                    <div className="flex items-end justify-between gap-x-6 gap-y-4 flex-wrap">
                      {/* Status group */}
                      <div>
                        <span className={groupLabel}>{t("hero.statusLabel", "Status")}</span>
                        <div className="inline-flex gap-1 p-0.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
                          {([
                            { v: "draft", label: t("status.draft", "Draft"), cls: "text-[var(--state-warning,#FFCC00)] bg-[var(--state-warning,#FFCC00)]/15" },
                            { v: "active", label: t("status.active", "Active"), cls: "text-[var(--state-success,#00CC66)] bg-[var(--state-success,#00CC66)]/15" },
                            { v: "archived", label: t("status.archived", "Archived"), cls: "text-[var(--state-error,#FF3333)] bg-[var(--state-error,#FF3333)]/15" },
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
                      </div>

                      {/* Visibility group — public-catalog gatekeeper + flagship */}
                      <div>
                        <span className={groupLabel}>{t("hero.visibilityLabel", "Visibility")}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateProduct_({ visible: !product.visible })}
                            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold border transition-all ${
                              product.visible
                                ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent"
                                : "bg-[var(--bg-surface-subtle)] text-[var(--text-dim)] border-[var(--border-subtle)] hover:text-[var(--text-muted)]"
                            }`}
                            title={product.visible ? t("hero.visibleOnCatalog", "Visible on public catalog") : t("hero.hiddenFromCatalog", "Hidden from public catalog")}
                          >
                            {product.visible ? <EyeIcon className="h-3 w-3" /> : <EyeOffIcon className="h-3 w-3" />}
                            {product.visible ? t("hero.visible", "Visible") : t("hero.hidden", "Hidden")}
                          </button>

                          <button
                            type="button"
                            onClick={() => updateProduct_({ featured: !product.featured })}
                            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold border transition-all ${
                              product.featured
                                ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent"
                                : "bg-[var(--bg-surface-subtle)] text-[var(--text-dim)] border-[var(--border-subtle)] hover:text-[var(--text-muted)]"
                            }`}
                            title={product.featured ? t("hero.featuredOnHome", "Flagship product — shown on the homepage") : t("hero.clickToFeature", "Mark as a flagship product (shown on the homepage)")}
                          >
                            <StarIcon className="h-3 w-3" />
                            {product.featured ? t("hero.featured", "Flagship") : t("hero.feature", "Flagship")}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Row 2 — market tier, same labelled-group treatment.
                        The tier is DERIVED from the factory cost through the
                        live Commercial Policy engine, because the
                        two were previously separate judgements about the same
                        thing and could disagree. The suggestion fills an empty
                        tier once; a tier you choose yourself is never
                        overwritten, and if it differs from the policy the
                        mismatch is shown rather than silently corrected. */}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className={`${groupLabel} mb-0`}>{t("hero.marketTier", "Market tier")}</span>
                        {tierSuggestion && (
                          product.level === tierSuggestion.tier ? (
                            <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border border-emerald-500/30 text-emerald-400/90">
                              {t("hero.tierAuto", "Auto")}
                            </span>
                          ) : product.level ? (
                            <button
                              type="button"
                              onClick={() => updateProduct_({ level: tierSuggestion.tier })}
                              title={tierSuggestion.levelName}
                              className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors"
                            >
                              {t("hero.tierUseSuggested", "Policy says {tier}").replace("{tier}", t(
                                `hero.level${tierSuggestion.tier.charAt(0).toUpperCase()}${tierSuggestion.tier.slice(1)}`,
                                tierSuggestion.tier,
                              ))}
                            </button>
                          ) : null
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {([
                          /* An ordinal ramp, cool -> warm, so the four read as
                             a ladder at a glance instead of four identical
                             chips. Colour is functional here (it encodes rank),
                             which is the one case the monochrome-first brand
                             rule allows. Fixed width so the row is a ruler —
                             the labels differ in length, and ragged chips made
                             the ladder hard to scan. */
                          { v: "entry", label: t("hero.levelEntry", "Entry"),
                            on: "bg-slate-400/15 text-slate-300 border-slate-400/40",
                            dot: "bg-slate-400" },
                          { v: "mid", label: t("hero.levelMid", "Mid"),
                            on: "bg-[#567FB2]/15 text-[#BCD8F0] border-[#567FB2]/50",
                            dot: "bg-[#7FA9D6]" },
                          { v: "premium", label: t("hero.levelPremium", "Premium"),
                            on: "bg-violet-500/15 text-violet-300 border-violet-500/45",
                            dot: "bg-violet-400" },
                          { v: "enterprise", label: t("hero.levelEnterprise", "Enterprise"),
                            on: "bg-amber-500/15 text-amber-300 border-amber-500/50",
                            dot: "bg-amber-400" },
                        ] as const).map(l => {
                          const active = product.level === l.v;
                          return (
                            <button
                              key={l.v}
                              type="button"
                              onClick={() => updateProduct_({ level: active ? "" : l.v })}
                              className={`h-7 w-[104px] shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
                                active
                                  ? l.on
                                  : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)] hover:border-[var(--border-focus)]"
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${active ? l.dot : "bg-[var(--border-subtle)]"}`} />
                              {l.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                    );
                  })()}

                  {/* The publish-controls shell above now provides the
                      separation, so no extra hairline is needed here. */}

                  {/* Publish-readiness hint — only when the product is set
                      to go live (Active or Visible) AND something the catalog
                      wants is still missing. Advisory, never blocks. */}
                  {(product.status === "active" || product.visible) && publishGaps.length > 0 && (
                    <div className="flex items-start gap-2 rounded-xl border border-[var(--state-warning,#FFCC00)]/40 bg-[var(--state-warning,#FFCC00)]/10 px-3.5 py-2.5">
                      <TriangleWarningIcon className="h-4 w-4 shrink-0 mt-0.5 text-[var(--state-warning,#FFCC00)]" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-[var(--text-primary)]">
                          {t("publish.notReadyTitle", "Not ready to go live yet")}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed mt-0.5">
                          {t("publish.notReadyBody", "Still missing:")} {publishGaps.join(" · ")}
                        </p>
                      </div>
                    </div>
                  )}

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

                    {/* ── Localized product name ──
                        English (above) is the base. Pick a language and write
                        that locale's name — manually, or auto-fill from English
                        (auto-translate covers 中文 + العربية; type the rest).
                        Writes into the shared `translations` state so it also
                        appears in Languages & Markets and on the public page. */}
                    {(() => {
                      const canAuto = true; // every offered locale is a translatable target
                      const hasNameTr = translations.some((tr) => (tr.product_name || "").trim().length > 0);
                      /* Collapsed by default — keep the hero clean. */
                      if (!showNameTr && !hasNameTr) {
                        return (
                          <button
                            type="button"
                            onClick={() => setShowNameTr(true)}
                            className="mt-2 text-[11px] font-medium text-[var(--accent,#0066FF)] hover:underline inline-flex items-center gap-1"
                          >
                            + {t("hero.addLanguage", "Add another language")}
                          </button>
                        );
                      }
                      /* Every language that HAS a name gets its own stacked
                         row — added names never disappear when you pick the
                         next language (owner rule). The adder row below
                         appends more. */
                      const filledLocales = LOCALES.filter((l) => (heroLocaleName(l.code) || "").trim().length > 0);
                      const filledCodes = new Set(filledLocales.map((l) => l.code));
                      const adderLocale = filledCodes.has(heroNameLocale)
                        ? (LOCALES.find((l) => !filledCodes.has(l.code))?.code ?? heroNameLocale)
                        : heroNameLocale;
                      return (
                        <div className="mt-3 space-y-2">
                          {filledLocales.map((l) => {
                            const rtl = l.code === "ar" || l.code === "ur";
                            return (
                              <div key={l.code} className="flex items-center gap-2">
                                <span className="shrink-0 w-16 text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)] text-start">
                                  {localeDisplay(l.code)}
                                </span>
                                <input
                                  type="text"
                                  dir={rtl ? "rtl" : "ltr"}
                                  value={heroLocaleName(l.code)}
                                  onChange={(e) => setHeroLocaleName(l.code, e.target.value)}
                                  className={`flex-1 h-11 px-4 rounded-xl bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-lg font-bold text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-all ${rtl ? "text-right" : ""}`}
                                />
                                <button
                                  type="button"
                                  onClick={() => setHeroLocaleName(l.code, "")}
                                  aria-label={t("hero.removeLang", "Remove this language")}
                                  className="shrink-0 h-8 w-8 rounded-lg inline-flex items-center justify-center text-[var(--text-ghost)] hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}

                          {/* Adder: pick a language that has no name yet, then
                              auto-translate or type — the row above appears the
                              moment it has content and stays. */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">
                              {t("hero.nameOtherLang", "Other language")}
                            </span>
                            <KdsSelect
                              value={adderLocale}
                              onChange={(v) => { setHeroNameLocale(v); setHeroNameMsg(null); }}
                              options={LOCALES.filter((l) => !filledCodes.has(l.code)).map((l) => ({ value: l.code, label: localeDisplay(l.code) }))}
                              triggerClassName={"h-8 px-2.5 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-all" + " pe-7 text-start"}
                            />
                            {canAuto && (
                              <button
                                type="button"
                                onClick={autoTranslateHeroName}
                                disabled={!product.product_name.trim() || translatingHeroName}
                                className="kx-ai-glow h-8 px-3 rounded-lg text-[11px] font-bold whitespace-nowrap text-[var(--accent,#0066FF)] border border-[var(--accent,#0066FF)]/40 hover:bg-[var(--accent,#0066FF)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
                              >
                                {translatingHeroName
                                  ? t("hero.translating", "Translating…")
                                  : t("hero.autoTranslate", "Auto-translate")}
                              </button>
                            )}
                            <input
                              type="text"
                              dir={adderLocale === "ar" || adderLocale === "ur" ? "rtl" : "ltr"}
                              value={heroLocaleName(adderLocale)}
                              onChange={(e) => { setHeroNameLocale(adderLocale); setHeroLocaleName(adderLocale, e.target.value); }}
                              placeholder={t("hero.nameInLangPlaceholder", "Product name in {lang}").replace("{lang}", localeDisplay(adderLocale))}
                              className="flex-1 min-w-[180px] h-9 px-3 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-all"
                            />
                          </div>
                        </div>
                      );
                    })()}
                    {heroNameMsg && (
                      <p
                        className={`mt-1.5 text-[11px] leading-relaxed ${
                          heroNameMsg.kind === "error"
                            ? "text-[var(--state-warning,#FFCC00)]"
                            : "text-[var(--text-muted)]"
                        }`}
                      >
                        {heroNameMsg.text}
                      </p>
                    )}
                  </div>

                  <span id="primary-code-anchor" aria-hidden="true" />
                  {/* Primary Model — the canonical KOLEEX commercial code.
                      Single source of truth for the 3-layer identity:
                      classification prefix (left chip) + editable code
                      (center input) + workflow actions (right buttons).
                      Bound to product_models.primary_model; writes are
                      mirrored into model_name + slug so the downstream
                      barcode / URL / SKU paths keep working. */}
                  {(() => {
                    const code = codeModel?.primary_model || codeModel?.model_name || "";
                    const status = codeModel?.coding_status;
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
                    const canReset = !!suggestedCodeForTarget && code !== suggestedCodeForTarget && status !== "locked";
                    const isLocked = status === "locked";
                    const statusLabel =
                      status === "edited" ? t("hero.statusEdited", "Edited") :
                      status === "approved" ? t("hero.statusApproved", "Approved") :
                      status === "locked" ? t("hero.statusLocked", "Locked") :
                      status === "auto_suggested" ? t("hero.statusAuto", "Auto") :
                      null;
                    const statusCls =
                      status === "approved" || status === "locked"
                        ? "border-[var(--state-success,#00CC66)]/50 text-[var(--state-success,#00CC66)]"
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
                            {isMemberCodeTarget && (
                              <span className="text-[9.5px] font-bold uppercase tracking-[0.16em] px-1.5 py-0.5 rounded-full border border-[#567FB2]/60 text-[#7FA9D6]">
                                {t("hero.selectedModelChip", "Selected model")}
                              </span>
                            )}
                            {suggestedCodeForTarget && code && code !== suggestedCodeForTarget && (
                              <span className="text-[10px] text-[var(--text-ghost)]">
                                {t("hero.suggested", "Suggested:")} <span className="font-mono font-semibold text-[var(--text-primary)]">{suggestedCodeForTarget}</span>
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
                              updateCodeModel({
                                primary_model: next,
                                model_name: next,
                                slug: slugify(next),
                                code_prefix: resolvedPrefix || codeModel?.code_prefix || "",
                                coding_status:
                                  next === suggestedCodeForTarget
                                    ? "auto_suggested"
                                    : "edited",
                              });
                            }}
                            onBlur={(e) => {
                              const normalized = normalizeKoleexCode(e.target.value);
                              if (normalized !== e.target.value) {
                                updateCodeModel({
                                  primary_model: normalized,
                                  model_name: normalized,
                                  slug: slugify(normalized),
                                });
                              }
                            }}
                            placeholder={
                              suggestedCodeForTarget ||
                              (resolvedPrefix ? `${resolvedPrefix}-…` : t("hero.codePlaceholder", "e.g. XCS-7800"))
                            }
                            className={`flex-1 min-w-[180px] h-12 px-5 rounded-xl bg-[var(--bg-surface-subtle)]/70 border ${
                              isTaken
                                ? "border-[var(--state-error,#FF3333)]/70 focus:border-[var(--state-error,#FF3333)]"
                                : "border-[var(--border-subtle)] focus:border-[var(--border-focus)]"
                            } text-[15px] font-bold font-mono tracking-[0.04em] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed`}
                          />

                          {/* Reset to auto-suggested — only enabled when the
                              current code differs from the suggestion. */}
                          <button
                            type="button"
                            onClick={() => {
                              if (!suggestedCodeForTarget) return;
                              updateCodeModel({
                                primary_model: suggestedCodeForTarget,
                                model_name: suggestedCodeForTarget,
                                slug: slugify(suggestedCodeForTarget),
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
                              updateCodeModel({ coding_status: "approved" });
                            }}
                            disabled={!canApprove}
                            className="h-12 px-3.5 rounded-xl border border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--text-inverted)] text-[11.5px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
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
                          <p className="text-[11px] text-[var(--state-error,#FF3333)] mt-2">{validationError}</p>
                        ) : isTaken && codeCheck.status === "taken" ? (
                          <p className="text-[11px] text-[var(--state-error,#FF3333)] mt-2 leading-relaxed">
                            <span className="font-semibold">{t("model.codeInUseInline", "Code already in use.")}</span>{" "}
                            <span className="font-mono font-bold">{codeCheck.conflict.primary_model}</span>{" "}
                            {t("model.codeBelongsTo", "belongs to")}{" "}
                            {codeCheck.conflict.product_slug ? (
                              <a
                                href={`${baseRoute}/${codeCheck.conflict.product_id}/edit`}
                                className="font-semibold underline underline-offset-2 hover:opacity-80"
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
                        ) : codeCheck.status === "available" && code && code !== suggestedCodeForTarget ? (
                          <p className="text-[11px] text-[var(--state-success,#00CC66)] mt-2">
                            ✓ {t("model.availableInline", "Available — no other product uses this code.")}
                          </p>
                        ) : codeCheck.status === "error" && code ? (
                          /* P0 #4 · the live check couldn't reach the server.
                             Be honest, and reassure that Save still verifies
                             (the save-time re-check + DB unique index). */
                          <p className="text-[11px] text-[var(--state-warning,#FFCC00)] mt-2">
                            {t("model.unableToVerify", "Couldn't verify this code right now — we'll re-check it when you save.")}
                          </p>
                        ) : validationWarning ? (
                          <p className="text-[11px] text-[var(--state-warning,#FFCC00)] mt-2">{validationWarning}</p>
                        ) : (
                          <p className="text-[10px] text-[var(--text-ghost)] mt-2 leading-relaxed">
                            {t("model.helperText", "KOLEEX commercial code — auto-suggested from the classification prefix + supplier model below, freely editable. Codes are unique across the catalog. Supplier model stays untouched as the factory reference.")}
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Old Model + Supplier Model — the two reference codes that
                      sit under the KOLEEX primary code. Old Model = the
                      previous / superseded code this product replaces
                      (product.legacy_code). Supplier Model = the factory's own
                      model number (product_models.reference_model), which also
                      seeds the KOLEEX code suggestion. Two-up on wider screens,
                      stacked on mobile. */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--text-ghost)] uppercase tracking-wider mb-2">
                        <span className="inline-flex items-center gap-1.5"><TagsIcon className="h-3 w-3" /> {t("hero.oldModel", "Old Model")}<FieldHelp {...IDENTIFIER_HELP.legacyCode} /></span>
                      </label>
                      <input
                        type="text"
                        value={product.legacy_code}
                        onChange={(e) => updateProduct_({ legacy_code: e.target.value })}
                        placeholder={t("hero.oldModelPlaceholder", "Previous / superseded code")}
                        className="w-full h-12 px-5 rounded-xl bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[15px] font-mono tracking-[0.03em] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--text-ghost)] uppercase tracking-wider mb-2">
                        <span className="inline-flex items-center gap-1.5"><FactoryIcon className="h-3 w-3" /> {t("hero.supplierModel", "Supplier Model")}</span>
                      </label>
                      {/* Read-only — the supplier's model number is owned by the
                          Supplier tab (primary supplier link → Model number). We
                          mirror it here so the operator sees it next to the codes,
                          with a shortcut to edit it where it actually lives. */}
                      <input
                        type="text"
                        value={shownSupplierModel}
                        readOnly
                        placeholder={t("hero.supplierModelPlaceholder", "e.g. JUKI DDL-8700H")}
                        title={t("hero.supplierModelReadonly", "Read from the primary supplier in the Supplier tab.")}
                        className="w-full h-12 px-5 rounded-xl bg-[var(--bg-surface-subtle)]/40 border border-[var(--border-subtle)] text-[15px] font-mono tracking-[0.03em] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none cursor-default"
                      />
                      <button
                        type="button"
                        onClick={() => goToStep(steps.findIndex((s) => s.id === "supplier"))}
                        className="mt-1.5 text-[10px] font-medium text-[var(--accent,#0066FF)] hover:underline inline-flex items-center gap-1"
                      >
                        {shownSupplierModel
                          ? t("hero.supplierModelEditInTab", "Edit in the Supplier tab")
                          : t("hero.supplierModelSetInTab", "Set in the Supplier tab →")}
                      </button>
                    </div>
                  </div>

                  {/* Short Description — the product excerpt (English base =
                      product.excerpt) with the same language picker + Auto-
                      translate control as the product name, writing per-locale
                      into product_translations.excerpt. Sits after the model
                      codes, before the tagline. */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[10px] font-bold text-[var(--text-ghost)] uppercase tracking-wider">
                        <span className="inline-flex items-center gap-1.5"><SparklesIcon className="h-3 w-3" /> {t("hero.shortDesc", "Short Description")}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => aiSuggest("excerpt")}
                        disabled={aiBusy !== null}
                        className="kx-ai-glow h-6 px-2 rounded-md text-[10px] font-bold text-[var(--accent,#0066FF)] border border-[var(--accent,#0066FF)]/40 hover:bg-[var(--accent,#0066FF)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        {aiBusy === "excerpt" ? t("ai.generating", "Drafting\u2026") : t("ai.suggest", "AI Suggest")}
                      </button>
                    </div>
                    <textarea
                      value={product.excerpt}
                      onChange={(e) => updateProduct_({ excerpt: e.target.value })}
                      placeholder={t("hero.shortDescPlaceholder", "One or two lines summarizing the product.")}
                      rows={2}
                      className="w-full px-5 py-3 rounded-xl bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[14px] leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-all resize-y"
                    />

                    {/* Localized short description — pick a language, write it
                        manually or auto-translate from English. Writes into the
                        shared `translations` state (product_translations.excerpt). */}
                    {(() => {
                      const isRtl = heroExcerptLocale === "ar" || heroExcerptLocale === "ur";
                      const localeName = LOCALES.find((l) => l.code === heroExcerptLocale)?.name ?? heroExcerptLocale;
                      const hasExcerptTr = translations.some((tr) => (tr.excerpt || "").trim().length > 0);
                      /* Collapsed by default — keep the hero clean. */
                      if (!showExcerptTr && !hasExcerptTr) {
                        return (
                          <button
                            type="button"
                            onClick={() => setShowExcerptTr(true)}
                            className="mt-2 text-[11px] font-medium text-[var(--accent,#0066FF)] hover:underline inline-flex items-center gap-1"
                          >
                            + {t("hero.addLanguage", "Add another language")}
                          </button>
                        );
                      }
                      return (
                        /* Stacked: controls row + full-width localized textarea
                           matching the English short description. */
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">
                                {t("hero.nameOtherLang", "Other language")}
                              </span>
                              <KdsSelect
                              value={heroExcerptLocale}
                              onChange={(v) => { setHeroExcerptLocale(v); setHeroExcerptMsg(null); }}
                              options={LOCALES.map((l) => ({ value: l.code, label: l.name }))}
                              triggerClassName={"h-8 px-2.5 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-all" + " pe-7 text-start"}
                            />
                            </div>
                            <button
                              type="button"
                              onClick={autoTranslateHeroExcerpt}
                              disabled={!product.excerpt.trim() || translatingHeroExcerpt}
                              className="kx-ai-glow h-8 px-3 rounded-lg text-[11px] font-bold whitespace-nowrap text-[var(--accent,#0066FF)] border border-[var(--accent,#0066FF)]/40 hover:bg-[var(--accent,#0066FF)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
                            >
                              {translatingHeroExcerpt
                                ? t("hero.translating", "Translating…")
                                : t("hero.autoTranslate", "Auto-translate")}
                            </button>
                          </div>
                          <textarea
                            dir={isRtl ? "rtl" : "ltr"}
                            value={heroLocaleExcerpt(heroExcerptLocale)}
                            onChange={(e) => setHeroLocaleExcerpt(heroExcerptLocale, e.target.value)}
                            placeholder={t("hero.shortDescInLangPlaceholder", "Short description in {lang}").replace("{lang}", localeName)}
                            rows={2}
                            className={`w-full px-5 py-3 rounded-xl bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[14px] leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-all resize-y ${isRtl ? "text-right" : ""}`}
                          />
                        </div>
                      );
                    })()}
                    {aiMsg?.field === "excerpt" && (
                      <p className={`mt-1.5 text-[11px] ${aiMsg.kind === "error" ? "text-[var(--state-warning,#FFCC00)]" : "text-[var(--text-muted)]"}`}>{aiMsg.text}</p>
                    )}
                    {heroExcerptMsg && (
                      <p
                        className={`mt-1.5 text-[11px] leading-relaxed ${
                          heroExcerptMsg.kind === "error"
                            ? "text-[var(--state-warning,#FFCC00)]"
                            : "text-[var(--text-muted)]"
                        }`}
                      >
                        {heroExcerptMsg.text}
                      </p>
                    )}
                  </div>

                  {/* Tagline — the one-liner shown directly under the
                      product name on the public hero. Lives on the primary
                      model but surfaced here so the admin isn't hunting for
                      it in Models. Sits below the identity codes now. */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[10px] font-bold text-[var(--text-ghost)] uppercase tracking-wider">
                        <span className="inline-flex items-center gap-1.5"><SparklesIcon className="h-3 w-3" /> {t("hero.tagline", "Tagline")}</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--text-ghost)]">
                          {t("hero.taglineMeta").replace("{n}", String((primaryModel?.tagline || "").length))}
                        </span>
                        <button
                        type="button"
                        onClick={() => aiSuggest("tagline")}
                        disabled={aiBusy !== null}
                        className="kx-ai-glow h-6 px-2 rounded-md text-[10px] font-bold text-[var(--accent,#0066FF)] border border-[var(--accent,#0066FF)]/40 hover:bg-[var(--accent,#0066FF)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        {aiBusy === "tagline" ? t("ai.generating", "Drafting\u2026") : t("ai.suggest", "AI Suggest")}
                      </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={primaryModel?.tagline || ""}
                      onChange={(e) => updatePrimaryModel({ tagline: e.target.value })}
                      placeholder={t("hero.taglinePlaceholder", "e.g. Precision jetted pockets at 3-second cycle.")}
                      maxLength={80}
                      className="w-full h-12 px-5 rounded-xl bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-all"
                    />

                    {/* Localized tagline — same language picker + Auto-translate
                        control as the name/short description, writing per-locale
                        into product_translations.tagline. */}
                    {(() => {
                      const isRtl = heroTaglineLocale === "ar" || heroTaglineLocale === "ur";
                      const localeName = LOCALES.find((l) => l.code === heroTaglineLocale)?.name ?? heroTaglineLocale;
                      const hasTaglineTr = translations.some((tr) => (tr.tagline || "").trim().length > 0);
                      if (!showTaglineTr && !hasTaglineTr) {
                        return (
                          <button
                            type="button"
                            onClick={() => setShowTaglineTr(true)}
                            className="mt-2 text-[11px] font-medium text-[var(--accent,#0066FF)] hover:underline inline-flex items-center gap-1"
                          >
                            + {t("hero.addLanguage", "Add another language")}
                          </button>
                        );
                      }
                      return (
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">
                                {t("hero.nameOtherLang", "Other language")}
                              </span>
                              <KdsSelect
                              value={heroTaglineLocale}
                              onChange={(v) => { setHeroTaglineLocale(v); setHeroTaglineMsg(null); }}
                              options={LOCALES.map((l) => ({ value: l.code, label: l.name }))}
                              triggerClassName={"h-8 px-2.5 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-all" + " pe-7 text-start"}
                            />
                            </div>
                            <button
                              type="button"
                              onClick={autoTranslateHeroTagline}
                              disabled={!(primaryModel?.tagline || "").trim() || translatingHeroTagline}
                              className="kx-ai-glow h-8 px-3 rounded-lg text-[11px] font-bold whitespace-nowrap text-[var(--accent,#0066FF)] border border-[var(--accent,#0066FF)]/40 hover:bg-[var(--accent,#0066FF)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
                            >
                              {translatingHeroTagline
                                ? t("hero.translating", "Translating…")
                                : t("hero.autoTranslate", "Auto-translate")}
                            </button>
                          </div>
                          <input
                            type="text"
                            dir={isRtl ? "rtl" : "ltr"}
                            value={heroLocaleTagline(heroTaglineLocale)}
                            onChange={(e) => setHeroLocaleTagline(heroTaglineLocale, e.target.value)}
                            placeholder={t("hero.taglineInLangPlaceholder", "Tagline in {lang}").replace("{lang}", localeName)}
                            maxLength={80}
                            className={`w-full h-12 px-5 rounded-xl bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-all ${isRtl ? "text-right" : ""}`}
                          />
                        </div>
                      );
                    })()}
                    {aiMsg?.field === "tagline" && (
                      <p className={`mt-1.5 text-[11px] ${aiMsg.kind === "error" ? "text-[var(--state-warning,#FFCC00)]" : "text-[var(--text-muted)]"}`}>{aiMsg.text}</p>
                    )}
                    {heroTaglineMsg && (
                      <p className={`mt-1.5 text-[11px] leading-relaxed ${heroTaglineMsg.kind === "error" ? "text-[var(--state-warning,#FFCC00)]" : "text-[var(--text-muted)]"}`}>
                        {heroTaglineMsg.text}
                      </p>
                    )}
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
                    t={t}
                  />
                  {/* Live slug-uniqueness feedback — a duplicate slug means
                      one of the two products won't resolve at /products/<slug>. */}
                  {slugCheck.status === "taken" ? (
                    <p className="text-[11px] text-[var(--state-error,#FF3333)] mt-1.5 leading-relaxed">
                      <span className="font-semibold">{t("hero.slugInUse", "This URL is already used by")}</span>{" "}
                      <span className="font-semibold">{slugCheck.conflict.product_name}</span>.{" "}
                      {t("hero.slugPickDifferent", "Edit it so each product has its own public URL.")}
                    </p>
                  ) : slugCheck.status === "checking" ? (
                    <p className="text-[11px] text-[var(--text-ghost)] mt-1.5">{t("hero.slugChecking", "Checking if this URL is available…")}</p>
                  ) : slugCheck.status === "available" ? (
                    <p className="text-[11px] text-[var(--state-success,#00CC66)] mt-1.5">✓ {t("hero.slugAvailable", "URL is available.")}</p>
                  ) : null}

                  {/* Brand · Family — Origin + Warranty moved to their own
                      tabs, so only these two remain. Two columns (not four)
                      so each field gets the full half-width instead of being
                      squeezed into a quarter. */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                        list="family-suggestions"
                      />
                      {/* Existing families as suggestions — free text still
                          allowed, but reusing a name beats inventing near-
                          duplicates (Pro Line / ProLine / pro-line). */}
                      <datalist id="family-suggestions">
                        {families.map((f) => <option key={f} value={f} />)}
                      </datalist>
                    </div>
                    {/* Country of Origin moved to the Logistics tab; Warranty
                        moved to the dedicated Compliance & Warranty tab — both
                        are post-identity data, not hero identity. */}
                  </div>
                </div>
              </div>

              {/* ═══ AUTO-GENERATED CODES — primary model barcode + QR.
                  (The primary-supplier mirror now lives at the top of the
                  shell.) Uses the KOLEEX primary_model when set so the
                  approved code is the one on the barcode + QR. ═══ */}
                {primaryModel?.model_name && (
                  <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-primary)]/30 px-6 md:px-8 py-6">
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

            {/* Pricing summary moved to the dedicated Cost & Price tab. */}

            {/* Short Description now lives in the hero (under the model
                codes, with the language picker + Auto-translate) — the old
                standalone excerpt section here was a duplicate of the same
                product.excerpt field and has been removed. */}

            {/* ── Full description (long, rich text) ──
                  Merged in from the old Description tab. Lives right
                  after the Short description so short + long copy are
                  authored together. Collapsed by default to keep the
                  Identity tab manageable. */}
            <Section id="description" icon={<DocumentIcon className="h-4 w-4" />} title={t("description.title", "Product Description")} badge={t("description.badgeRichText", "Rich text")} defaultOpen={false}>
              <DescriptionSection
                data={product}
                onChange={updateProduct_}
                subcategorySlug={product.subcategory_slug}
                machineKindSlug={(sewingSpecs.common_specs as { machine_kind?: string })?.machine_kind || ""}
              />

              {/* Localized full description — pick a language, write it
                  manually or auto-translate from the English description.
                  Writes into the shared `translations` state
                  (product_translations.description). */}
              {(() => {
                const isRtl = descLocale === "ar" || descLocale === "ur";
                const localeName = LOCALES.find((l) => l.code === descLocale)?.name ?? descLocale;
                const hasDescTr = translations.some((tr) => (tr.description || "").trim().length > 0);
                if (!showDescTr && !hasDescTr) {
                  return (
                    <button
                      type="button"
                      onClick={() => setShowDescTr(true)}
                      className="mt-3 text-[11px] font-medium text-[var(--accent,#0066FF)] hover:underline inline-flex items-center gap-1"
                    >
                      + {t("hero.addLanguage", "Add another language")}
                    </button>
                  );
                }
                return (
                  <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">
                          {t("hero.nameOtherLang", "Other language")}
                        </span>
                        <KdsSelect
                              value={descLocale}
                              onChange={(v) => { setDescLocale(v); setDescMsg(null); }}
                              options={LOCALES.map((l) => ({ value: l.code, label: l.name }))}
                              triggerClassName={"h-8 px-2.5 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-all" + " pe-7 text-start"}
                            />
                      </div>
                      <button
                        type="button"
                        onClick={autoTranslateDescription}
                        disabled={!(product.description || "").trim() || translatingDesc}
                        className="kx-ai-glow h-8 px-3 rounded-lg text-[11px] font-bold whitespace-nowrap text-[var(--accent,#0066FF)] border border-[var(--accent,#0066FF)]/40 hover:bg-[var(--accent,#0066FF)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
                      >
                        {translatingDesc
                          ? t("hero.translating", "Translating…")
                          : t("hero.autoTranslate", "Auto-translate")}
                      </button>
                    </div>
                    {/* Same rich-text editor as the English description, so
                        the localized copy keeps headings, bullet lists, tables,
                        links + images. key={descLocale} remounts on language
                        switch; the dir wrapper makes RTL locales read right. */}
                    <div dir={isRtl ? "rtl" : "ltr"}>
                      <RichTextEditor
                        key={descLocale}
                        value={localeDescription(descLocale)}
                        onChange={(html) => setLocaleDescription(descLocale, html)}
                        placeholder={t("description.inLangPlaceholder", "Full description in {lang}").replace("{lang}", localeName)}
                        minHeight={240}
                      />
                    </div>
                    {descMsg && (
                      <p className={`text-[11px] leading-relaxed ${descMsg.kind === "error" ? "text-[var(--state-warning,#FFCC00)]" : "text-[var(--text-muted)]"}`}>
                        {descMsg.text}
                      </p>
                    )}
                  </div>
                );
              })()}
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
              <div className="flex items-center justify-end mb-2 gap-2">
                {aiMsg?.field === "highlights" && (
                  <span className={`text-[10px] ${aiMsg.kind === "error" ? "text-[var(--state-warning,#FFCC00)]" : "text-[var(--text-muted)]"}`}>{aiMsg.text}</span>
                )}
                <button
                        type="button"
                        onClick={() => aiSuggest("highlights")}
                        disabled={aiBusy !== null}
                        className="kx-ai-glow h-6 px-2 rounded-md text-[10px] font-bold text-[var(--accent,#0066FF)] border border-[var(--accent,#0066FF)]/40 hover:bg-[var(--accent,#0066FF)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        {aiBusy === "highlights" ? t("ai.generating", "Drafting\u2026") : t("ai.suggest", "AI Suggest")}
                      </button>
              </div>
              <HighlightsEditor
                highlights={product.highlights}
                onChange={(highlights) => updateProduct_({ highlights })}
                t={t}
              />
            </Section>

            {/* ── Main Devices & Functions — the catalog photo-card pattern:
                one card per device/function/part (photo + title + short
                explanation). Universal across all categories; rendered as a
                uniform card grid on the public page. */}
            <Section
              id="feature-cards"
              icon={<PictureIcon className="h-4 w-4" />}
              title={t("fc.title", "Main Devices & Functions")}
              badge={product.feature_cards.length ? `${product.feature_cards.length}` : t("fc.badge", "Photo cards · public page")}
              defaultOpen={false}
            >
              <FeatureCardsSection
                cards={product.feature_cards}
                onChange={(feature_cards) => updateProduct_({ feature_cards })}
              />
            </Section>

            {/* Tags */}
            <Section id="tags" icon={<TagsIcon className="h-4 w-4" />} title={t("hero.tagsTitle", "Tags & Keywords")}>
              <div className="flex items-center justify-end mb-2 gap-2">
                {aiMsg?.field === "tags" && (
                  <span className={`text-[10px] ${aiMsg.kind === "error" ? "text-[var(--state-warning,#FFCC00)]" : "text-[var(--text-muted)]"}`}>{aiMsg.text}</span>
                )}
                <button
                        type="button"
                        onClick={() => aiSuggest("tags")}
                        disabled={aiBusy !== null}
                        className="kx-ai-glow h-6 px-2 rounded-md text-[10px] font-bold text-[var(--accent,#0066FF)] border border-[var(--accent,#0066FF)]/40 hover:bg-[var(--accent,#0066FF)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        {aiBusy === "tags" ? t("ai.generating", "Drafting\u2026") : t("ai.suggest", "AI Suggest")}
                      </button>
              </div>
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

            {/* Phase 5 — Identity identifiers + lifecycle. The KOLEEX
                primary model + per-model barcode/SKU live elsewhere; these
                are the manufacturer's identifiers + market lifecycle. */}
            {/* Trimmed 2026-07-31 (owner): Internal SKU / GTIN / Model year /
                Available-from / Last-order removed from the UI — 0 usage across
                the catalog and covered by the KOLEEX code + lifecycle core.
                Columns and any legacy data remain untouched. */}
            <Section id="identifiers" icon={<PackageIcon className="h-4 w-4" />} title={t("identity.identifiers", "Identifiers & Lifecycle")} badge={t("identity.identifiersBadge", "MPN · GTIN · Lifecycle")} defaultOpen={false}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className={lbl}><span className="inline-flex items-center gap-1.5"><FactoryIcon className="h-3 w-3" /> {t("idf.manufacturer", "Manufacturer (OEM)")}</span><FieldHelp {...IDENTIFIER_HELP.manufacturer} /></label>
                  <input className={inp} value={product.manufacturer} placeholder={t("idf.manufacturerPh", "Actual maker, if rebranded")}
                    onChange={(e) => updateProduct_({ manufacturer: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}><span className="inline-flex items-center gap-1.5"><HashtagIcon className="h-3 w-3" /> {t("idf.mpn", "MPN (manufacturer part no.)")}</span><FieldHelp {...IDENTIFIER_HELP.mpn} /></label>
                  <input className={inp} value={product.mpn} placeholder={`${t("sup.eg", "e.g.")} JK-9500`}
                    onChange={(e) => updateProduct_({ mpn: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}><span className="inline-flex items-center gap-1.5"><LayersIcon className="h-3 w-3" /> {t("idf.generation", "Generation / version")}</span><FieldHelp {...IDENTIFIER_HELP.generation} /></label>
                  <input className={inp} value={product.generation} placeholder={`${t("sup.eg", "e.g.")} Gen 2 / v3`}
                    onChange={(e) => updateProduct_({ generation: e.target.value })} />
                </div>
                {/* Old model / legacy code intentionally NOT here — it is edited
                    once, in the hero identity block next to the KOLEEX code
                    (same product.legacy_code column). One meaning = one input. */}
                <div>
                  <label className={lbl}><span className="inline-flex items-center gap-1.5"><RocketIcon className="h-3 w-3" /> {t("idf.launchDate", "Launch date")}</span><FieldHelp {...IDENTIFIER_HELP.launchDate} /></label>
                  <input type="date" className={inp} value={product.launch_date}
                    onChange={(e) => updateProduct_({ launch_date: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}><span className="inline-flex items-center gap-1.5"><TimerIcon className="h-3 w-3" /> {t("idf.eolDate", "End-of-life date")}</span><FieldHelp {...IDENTIFIER_HELP.eolDate} /></label>
                  <input type="date" className={inp} value={product.eol_date}
                    onChange={(e) => updateProduct_({ eol_date: e.target.value })} />
                  {product.launch_date && product.eol_date && product.eol_date <= product.launch_date && (
                    <p className="text-[10px] text-[var(--state-warning,#FFCC00)] mt-1">{t("idf.eolBeforeLaunch", "End-of-life is on or before the launch date.")}</p>
                  )}
                </div>
                <div>
                  <label className={lbl}><span className="inline-flex items-center gap-1.5"><InfoIcon className="h-3 w-3" /> {t("idf.statusReason", "Status reason")}</span><FieldHelp {...IDENTIFIER_HELP.statusReason} /></label>
                  <input className={inp} value={product.status_reason} placeholder={`${t("sup.eg", "e.g.")} Replaced by XSL-9100`}
                    onChange={(e) => updateProduct_({ status_reason: e.target.value })} />
                </div>

                {/* Brand mark / logo override — falls back to the brand's logo
                    on the public page when left empty. */}
                <div className="md:col-span-3">
                  <label className={lbl}><span className="inline-flex items-center gap-1.5"><GemIcon className="h-3 w-3" /> {t("idf.brandMark", "Brand mark / logo override")}</span><FieldHelp {...IDENTIFIER_HELP.brandMark} /></label>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] flex items-center justify-center overflow-hidden shrink-0">
                      {product.brand_mark_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.brand_mark_url} alt="Brand mark" className="h-full w-full object-contain p-1" />
                      ) : (
                        <ImageRawIcon className="h-5 w-5 text-[var(--text-ghost)]" />
                      )}
                    </div>
                    <input type="text" className={`${inp} flex-1`} value={product.brand_mark_url} placeholder={t("idf.brandMarkPh", "Paste image URL, or upload →")}
                      onChange={(e) => updateProduct_({ brand_mark_url: e.target.value })} />
                    <label className="h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer transition-colors shrink-0">
                      <CameraIcon className="h-3.5 w-3.5" /> Upload
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadIdentityImage(e.target.files, "brand_mark_url")} />
                    </label>
                    {product.brand_mark_url && (
                      <button type="button" onClick={() => updateProduct_({ brand_mark_url: "" })} className="text-[11px] text-[var(--text-ghost)] hover:text-[var(--state-error,#FF3333)] shrink-0">Clear</button>
                    )}
                  </div>
                </div>

                {/* Revision / version history — small inline log. */}
                <div className="md:col-span-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className={lbl}><span className="inline-flex items-center gap-1.5"><HistoryIcon className="h-3 w-3" /> {t("idf.revisionHistory", "Revision history")}</span><FieldHelp {...IDENTIFIER_HELP.revisionHistory} /></label>
                    <button type="button"
                      onClick={() => updateProduct_({ revision_history: [...product.revision_history, { version: "", date: "", note: "" }] })}
                      className="text-[11px] font-semibold text-[var(--accent,#0066FF)] hover:underline inline-flex items-center gap-1">
                      <PlusIcon className="h-3 w-3" /> {t("idf.addRevision", "Add revision")}
                    </button>
                  </div>
                  {product.revision_history.length === 0 ? (
                    <p className="text-[10px] text-[var(--text-ghost)]">{t("idf.noRevisions", "No revisions logged.")}</p>
                  ) : (
                    <div className="space-y-2">
                      {product.revision_history.map((r, i) => (
                        <div key={i} className="grid grid-cols-1 md:grid-cols-[120px_140px_1fr_auto] gap-2 items-center">
                          <input className={inp} value={r.version} placeholder={t("idf.revVersionPh", "v / rev")}
                            onChange={(e) => { const next = [...product.revision_history]; next[i] = { ...next[i], version: e.target.value }; updateProduct_({ revision_history: next }); }} />
                          <input type="date" className={inp} value={r.date}
                            onChange={(e) => { const next = [...product.revision_history]; next[i] = { ...next[i], date: e.target.value }; updateProduct_({ revision_history: next }); }} />
                          <input className={inp} value={r.note} placeholder={t("idf.revNotePh", "What changed")}
                            onChange={(e) => { const next = [...product.revision_history]; next[i] = { ...next[i], note: e.target.value }; updateProduct_({ revision_history: next }); }} />
                          <button type="button" onClick={() => updateProduct_({ revision_history: product.revision_history.filter((_, j) => j !== i) })}
                            className="h-9 w-9 flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-[var(--state-error,#FF3333)] transition-colors">
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="md:col-span-3">
                  <label className={lbl}><span className="inline-flex items-center gap-1.5"><TagsIcon className="h-3 w-3" /> {t("idf.alternateNames", "Alternate names / aliases")}</span><FieldHelp {...IDENTIFIER_HELP.alternateNames} /></label>
                  <TagsInput
                    tags={product.alternate_names}
                    onChange={(alternate_names) => updateProduct_({ alternate_names })}
                    suggestions={[]}
                    t={t}
                  />
                  <p className="text-[10px] text-[var(--text-ghost)] mt-1">{t("idf.aliasHint", "Helps search + matching. Press Enter or comma to add each alias.")}</p>
                </div>
              </div>
            </Section>

            {/* Languages & Markets section removed — per-language name +
                short description are now authored inline in the hero
                (the "+ Add another language" controls). The translations
                state + save path stay intact, so existing translations
                persist and the hero controls still read/write them. */}

            <Section id="search-social" icon={<EyeIcon className="h-4 w-4" />} title={t("review.searchSocialSection", "Search & Social")} badge={t("review.searchSocialBadge", "SEO preview")} defaultOpen>
              <SearchSocialSection
                productName={product.product_name}
                brand={product.brand}
                slug={product.slug}
                excerpt={product.excerpt}
                /* Use the same preview source as the hero: heroSrc is the
                   saved URL when present, or a local object-URL for a freshly
                   uploaded (not-yet-saved) file. Reading only .url here showed
                   "No main image yet" until the product was saved. In family
                   mode it follows the selected member, so the preview shows
                   the photo the operator is actually editing. */
                primaryImageUrl={heroSrc || undefined}
                primaryModel={primaryModel?.primary_model || primaryModel?.model_name || ""}
                categoryName={categoryName}
                metaTitle={product.meta_title}
                metaDescription={product.meta_description}
                ogImageUrl={product.og_image_url}
                onMetaTitleChange={(v) => updateProduct_({ meta_title: v })}
                onMetaDescriptionChange={(v) => updateProduct_({ meta_description: v })}
                onOgImageUrlChange={(v) => updateProduct_({ og_image_url: v })}
              />
            </Section>
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
                iconOverrides={classIcons}
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
           STEP: SUPPLIER & SOURCING (dedicated tab, after Classify)
           All supplier data lives here. Supplier MASTER (name, logo,
           contacts, ratings) stays in the Suppliers app — this links to
           an existing supplier and edits only the per-product facts.
           ═══════════════════════════════════════════════════════════ */}
        {(onePage || steps[currentStep]?.id === "supplier") && (
          <div id="sec-supplier" className="space-y-5 scroll-mt-28 animate-in fade-in duration-300">
            <Section id="suppliers" icon={<FactoryIcon className="h-4 w-4" />} title={t("models.suppliers", "Supplier & Sourcing")} badge={t("models.suppliersBadge", "From Suppliers app")} defaultOpen>
              {(() => {
                /* Spec lines offered by the cost-note "Import from product
                   specs" picker: resolved per selected member (override ??
                   family), family values otherwise. Computed here so both
                   branches share it. */
                const specFmt = (v: unknown): string => {
                  if (Array.isArray(v)) return v.map(String).filter(Boolean).join(", ");
                  if (v && typeof v === "object") {
                    const vals = Object.values(v as Record<string, unknown>).filter((x) => x !== null && x !== undefined && String(x).trim() !== "");
                    return vals.map(String).join(" × ");
                  }
                  return String(v ?? "");
                };
                const prettify = (k: string) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                const schemaMeta = new Map<string, { label: string; unit: string | null }>();
                (activeSpecsSchema?.groups ?? []).forEach((g) =>
                  g.fields
                    .filter((f) => !["file", "image", "long_text"].includes(f.fieldType))
                    .forEach((f) => schemaMeta.set(f.key, { label: f.label ?? f.key, unit: f.unit ?? null })),
                );
                const famSpecs = (product.schema_specs || {}) as Record<string, unknown>;
                const memberOv = memberCtx && safeActiveMember > 0 && activeModel ? ((activeModel.specs_overrides ?? {}) as Record<string, unknown>) : {};
                const resolvedSpecs: Record<string, unknown> = { ...famSpecs, ...memberOv };
                const specEntries: { label: string; value: string; unit: string | null }[] = [];
                const seenKeys = new Set<string>();
                for (const [k, v] of Object.entries(resolvedSpecs)) {
                  const val = specFmt(v);
                  if (!val.trim()) continue;
                  const meta = schemaMeta.get(k);
                  specEntries.push({ label: meta?.label ?? prettify(k), value: val, unit: meta?.unit ?? null });
                  seenKeys.add(k);
                }
                /* Legacy typed columns (products.*) — most existing products
                   keep their specs here, not in schema_specs. Skip columns a
                   schema entry above already represents. */
                const LEGACY_SPECS: { key: string; schemaKey?: string; label: string; unit: string | null; get: () => unknown }[] = [
                  { key: "voltage", schemaKey: "voltage_options", label: "Voltage", unit: null, get: () => product.voltage },
                  { key: "frequency_hz", label: "Frequency", unit: "Hz", get: () => product.frequency_hz },
                  { key: "phase", label: "Phase", unit: null, get: () => product.phase },
                  { key: "motor_power_w", label: "Motor power", unit: "W", get: () => product.motor_power_w },
                  { key: "power_consumption_w", label: "Power consumption", unit: "W", get: () => product.power_consumption_w },
                  { key: "plug_types", label: "Plug types", unit: null, get: () => product.plug_types },
                  { key: "machine_dimensions", label: "Dimensions", unit: null, get: () => product.machine_dimensions },
                  { key: "machine_weight_kg", label: "Machine weight", unit: "kg", get: () => product.machine_weight_kg },
                  { key: "hs_code", label: "HS code", unit: null, get: () => product.hs_code },
                  { key: "ip_rating", label: "IP rating", unit: null, get: () => product.ip_rating },
                  { key: "operating_temp", label: "Operating temperature", unit: null, get: () => product.operating_temp },
                  { key: "colors", label: "Colors", unit: null, get: () => product.colors },
                ];
                for (const c of LEGACY_SPECS) {
                  if (seenKeys.has(c.key) || (c.schemaKey && seenKeys.has(c.schemaKey))) continue;
                  const val = specFmt(c.get());
                  if (!val.trim()) continue;
                  specEntries.push({ label: c.label, value: val, unit: c.unit });
                }
                return memberCtx && safeActiveMember > 0 && activeModel ? (() => {
                /* MEMBER VIEW (owner rule): the SAME full supplier page as
                   the primary. Values render as primary-link ⊕ this
                   member's supplier_overrides; edits are diffed against the
                   primary and stored per member. The supplier itself is
                   locked (family-level); the star promotes this model to
                   PRIMARY. */
                const primaryLink = productSuppliers.find((x) => x.is_primary) ?? productSuppliers[0];
                if (!primaryLink) {
                  return (
                    <p className="text-[12px] text-[var(--text-ghost)] rounded-xl border border-dashed border-[var(--border-subtle)] p-4">
                      {t("fam.noLinkYet", "No supplier linked yet — switch to the PRIMARY model and link one first; members then inherit it.")}
                    </p>
                  );
                }
                const ov = (activeModel.supplier_overrides ?? {}) as Record<string, unknown>;
                /* Legacy members (pre-supplier_overrides) keep their model
                   number in reference_model and their cost in cost_price —
                   surface those ahead of the primary's values so the page
                   never LOOKS like it ignores the member's own data. */
                const legacy: Record<string, unknown> = {};
                if (!("supplier_product_code" in ov) && activeModel.reference_model && activeModel.reference_model !== primaryLink.supplier_product_code) {
                  legacy.supplier_product_code = activeModel.reference_model;
                }
                if (!("unit_cost_cny" in ov) && activeModel.cost_price && activeModel.cost_price !== primaryLink.unit_cost_cny) {
                  legacy.unit_cost_cny = activeModel.cost_price;
                }
                const merged = { ...primaryLink, ...legacy, ...ov, _tempId: `member-${activeModel._tempId}`, is_primary: true } as typeof primaryLink;
                const EDITABLE: (keyof typeof primaryLink)[] = [
                  "supplier_product_code", "moq", "lead_time_days", "unit_cost_cny", "currency",
                  "cost_basis", "cost_includes_tax", "payment_terms", "notes", "notes_i18n", "price_options",
                  "supplier_product_name", "supplier_product_name_i18n", "supplier_product_photo",
                  "quotation_file_url", "quotation_file_name",
                ];
                return (
                  <SupplierLinkSection
                    links={[merged]}
                    suppliers={suppliers}
                    productSpecs={specEntries}
                    memberMode={{
                      memberCode: activeModel.primary_model || activeModel.model_name || "",
                      onMakePrimary: () => setPromoteAsk(activeModel),
                    }}
                    onChange={(newLinks) => {
                      const upd = newLinks[0];
                      if (!upd) return;
                      const nextOv: Record<string, unknown> = {};
                      for (const f of EDITABLE) {
                        if (JSON.stringify(upd[f]) !== JSON.stringify(primaryLink[f])) nextOv[f as string] = upd[f];
                      }
                      const patch: Partial<ModelFormState> = { supplier_overrides: nextOv };
                      /* Mirror the two canonical member columns so profile,
                         quotations and the engine keep reading the truth. */
                      /* Mirror the code ONLY when the member actually
                         overrides it — never stomp a legacy per-member
                         reference_model just because another field changed. */
                      if ("supplier_product_code" in nextOv) patch.reference_model = String(nextOv.supplier_product_code ?? "");
                      if ("unit_cost_cny" in nextOv) patch.cost_price = String(nextOv.unit_cost_cny ?? "");
                      updateActiveMember(patch);
                    }}
                  />
                );
              })() : (
                <>
                  <SupplierLinkSection links={productSuppliers} suppliers={suppliers} onChange={setProductSuppliers} productSpecs={specEntries} />
                  {/* With the PRIMARY selected, the cost above is the FAMILY
                      baseline — but the strip sits right there, so an operator
                      who just saved a member's own cost reopens the form (it
                      always mounts on the primary), sees ¥40000, and reads it
                      as "my member's price was overwritten by the main one"
                      (reported 2026-08-19, prices were in fact saved). Show
                      the members' own costs HERE so the truth is visible at
                      the exact spot the misreading happens. */}
                  {familyOn && models.length > 1 && (() => {
                    const own = models.slice(1).map((m) => {
                      const ov = (m.supplier_overrides ?? {}) as Record<string, unknown>;
                      const cost = (ov.unit_cost_cny as string | number | undefined) ?? (m.cost_price || null);
                      const code = m.primary_model || m.model_name || "";
                      return cost != null && String(cost).trim() !== "" && code ? { code, cost: String(cost) } : null;
                    }).filter((x): x is { code: string; cost: string } => x !== null);
                    if (!own.length) return null;
                    return (
                      <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-ghost)]">
                        {t("sup.memberCosts", "This is the family cost. These models have their own — pick one on the strip above to edit it:")}{" "}
                        {own.map((o, i) => (
                          <span key={o.code} className="font-semibold tabular-nums text-[var(--text-muted)]">
                            {i > 0 ? " · " : ""}{o.code} ¥{o.cost}
                          </span>
                        ))}
                      </p>
                    );
                  })()}
                </>
              );
              })()}
            </Section>
          </div>
        )}

        {/* Description merged into the Identity (Hero & Identity) tab —
           the full rich-text description now lives there, right under the
           short description. */}

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

            <Section id="related" icon={<Link2Icon className="h-4 w-4" />} title={t("review.relatedSection", "Related Products")} badge={t("knowledge.relatedBadge", "Accessories · Spares · Compatible")} defaultOpen>
              <RelatedProductsSection related={related} onChange={setRelated} currentProductId={productId} />
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
        {/* Schema-driven specs — the canonical structured editor that writes
            product.schema_specs (the data that lights up the public product
            page, quotes, brochures, AI). Renders for ANY classification with a
            published schema (e.g. Spreading Machines), not just sewing — each
            subcategory gets its own data template. The free-form
            SewingMachineSection stays below ONLY for sewing machines. */}
        {steps[currentStep]?.id === "specs" && (isSewing || activeSpecsSchema) && (() => {
          const specsSchema = specsTabSchema;
          return (
            <div className="space-y-5 animate-in fade-in duration-300">
              {specsSchema ? (
                <Section
                  id="schema-specs"
                  icon={<Settings2Icon className="h-4 w-4" />}
                  title={t("specs.productSpecs", "Product Specs")}
                  badge={t("specs.badgeStructured", "Structured · Multi-surface")}
                >
                  {memberCtx && safeActiveMember > 0 && activeModel ? (
                    /* NON-primary member: the SAME spec editor, bound to the
                       member's RESOLVED view (family ⊕ overrides). The
                       PRIMARY deliberately falls through to the family
                       editor below — the primary IS the family baseline;
                       writing its specs as overrides would leave the family
                       column empty forever. */
                    <>
                      <p className="mb-3 text-[11px] text-[#567FB2] font-medium">
                        {t("fam.specsNote", "Editing specs of {code}. A changed field becomes this model's difference; clearing a field reverts it to the family value.")
                          .replace("{code}", (activeModel.primary_model || activeModel.model_name || ""))}
                      </p>
                      <SchemaSpecsSection
                        schema={specsSchema}
                        values={{ ...((product.schema_specs || {}) as Record<string, unknown>), ...((activeModel.specs_overrides || {}) as Record<string, unknown>) }}
                        onChange={(next) => {
                          const fam = (product.schema_specs || {}) as Record<string, unknown>;
                          const ov: Record<string, string> = {};
                          const norm = (v: unknown) =>
                            v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)
                              ? "" : Array.isArray(v) ? v.map(String).join("\u0001") : String(v);
                          for (const [k, v] of Object.entries(next)) {
                            if (norm(v) === "") continue;              /* empty → inherit */
                            if (norm(v) === norm(fam[k])) continue;    /* same as family → inherit */
                            ov[k] = Array.isArray(v) ? v.map(String).join(", ") : String(v);
                          }
                          updateActiveMember({ specs_overrides: ov });
                        }}
                      />
                    </>
                  ) : (
                  <SchemaSpecsSection
                    schema={specsSchema}
                    values={product.schema_specs || {}}
                    onChange={(next) => updateProduct_({ schema_specs: next })}
                  />
                  )}
                </Section>
              ) : null}

              {isSewing ? (
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
              ) : null}
            </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════════
           STEP N: TECHNICAL DETAILS
           ═══════════════════════════════════════════════════════════ */}
        {steps[currentStep]?.id === "specs" && (
          <div id="sec-technical" className="space-y-5 scroll-mt-28 animate-in fade-in duration-300">
            {/* Stand / Table products: their specs & variants ARE the
                configurable option axes (shape · type · size · quality —
                thickness · lifting · wheels · wheel size), each able to carry a
                ¥ price add-on. Shown here so the Specs tab is meaningful for
                accessories instead of machine electrical/physical fields. */}
            {isAccessory && (
              <Section
                id="accessory-specs"
                icon={<Settings2Icon className="h-4 w-4" />}
                title={t("specs.accessoryTitle", "Stand / Table Specifications & Variants")}
                badge={t("specs.accessoryBadge", "Options · price add-ons")}
                defaultOpen
              >
                <AccessoryOptionsSection rows={accessoryOptions} onChange={(r) => { setAccessoryOptions(r); setDirty(true); }} subcategorySlug={product.subcategory_slug || null} />
              </Section>
            )}
            {!isAccessory && (technicalHasVisibleField ? (
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
            ))}

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           STEP N: MODELS & VARIANTS
           ═══════════════════════════════════════════════════════════ */}
        {(onePage || steps[currentStep]?.id === "commercial") && (
          <div id="sec-commercial" className="space-y-5 scroll-mt-28 animate-in fade-in duration-300">
            {/* Purchase Options — which configurations (head-only / complete set)
                customers can order. Lives WITH the variants it governs
                (owner tab-cleanup: Specs stays purely technical). */}
            {!isAccessory && !purchaseCoveredBySchema && (
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

            {/* The redundant "Primary Model reminder" banner used to
                live here. It said "Identity & pricing entered in the
                Hero" — which was true but misleading, because the
                ModelCard below STILL let admins edit the same fields,
                causing Hero ⇄ Models desync. Now the primary card
                itself makes the Hero-basics-are-read-only story
                explicit, so the banner is redundant and removed. */}

            {isAccessory ? (
              /* Stand / Table variants = the configured option axes. The full
                 sewing Models & Variants editor (SKU / packing / per-model
                 pricing) doesn't fit an accessory — show its variant axes here
                 (read-only summary) with a jump to edit them on the Specs tab. */
              <Section
                id="accessory-variants"
                icon={<BoxesIcon className="h-4 w-4" />}
                title={t("models.accessoryTitle", "Variants")}
                badge={t("models.accessoryBadge", "From options")}
              >
                {(() => {
                  const axes = axesForSubcategory(product.subcategory_slug);
                  const filled = axes.filter((a) => accessoryOptions.some((r) => r.axis === a.key && r.value.trim()));
                  if (filled.length === 0) {
                    return (
                      <div className="flex items-start gap-3 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
                        <Settings2Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-ghost)]" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] leading-relaxed text-[var(--text-ghost)]">
                            {t("models.accessoryEmpty", "This product's variants are its options (size, quality, thickness, wheels…). Add them on the Specs tab and they'll show here and feed the complete-set price.")}
                          </p>
                          <button type="button" onClick={() => { const i = steps.findIndex((s) => s.id === "specs"); if (i >= 0) goToStep(i); }}
                            className="inline-flex items-center gap-1.5 h-7 px-2.5 mt-2 rounded-lg text-[11px] font-semibold text-[var(--accent)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/15 border border-[var(--accent)]/30 transition-colors">
                            <ArrowUpRightIcon className="h-3 w-3" /> {t("models.accessoryEdit", "Define options on Specs")}
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-2.5">
                      {filled.map((a) => {
                        const vals = accessoryOptions.filter((r) => r.axis === a.key && r.value.trim());
                        return (
                          <div key={a.key} className="rounded-xl border border-[var(--border-subtle)] p-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[12px] font-semibold text-[var(--text-primary)]">{a.label}</span>
                              {a.priced && <span className="text-[9px] uppercase tracking-wider text-[var(--accent)]">affects price</span>}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {vals.map((r) => (
                                <span key={r._k} className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
                                  {r.value}{a.priced && r.price_delta_cny ? <span className="text-[10px] text-[var(--text-ghost)]">+¥{r.price_delta_cny}</span> : null}
                                  {r.is_default ? <span className="text-[9px] uppercase text-[var(--accent)]">def</span> : null}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      <button type="button" onClick={() => { const i = steps.findIndex((s) => s.id === "specs"); if (i >= 0) goToStep(i); }}
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold text-[var(--accent)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/15 border border-[var(--accent)]/30 transition-colors">
                        <ArrowUpRightIcon className="h-3 w-3" /> {t("models.accessoryEdit", "Edit options on Specs")}
                      </button>
                    </div>
                  );
                })()}
              </Section>
            ) : (
            <Section
              id="models"
              icon={<BoxesIcon className="h-4 w-4" />}
              title={t("models.title", "Models & Variants")}
              badge={t("models.countBadge", `${models.length} models`).replace("{n}", String(models.length))}
            >
              {/* Entry-mode toggle — the grid transcribes a catalog page;
                  the cards hold the per-model commercial detail. */}
              {familyGridFields.length > 0 && (
                <div className="mb-4 flex rounded-xl border border-[var(--border-subtle)] overflow-hidden w-fit">
                  {([
                    ["grid", t("variants.viewGrid", "Catalog grid")],
                    ["cards", t("variants.viewCards", "Detailed cards")],
                  ] as const).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVariantsView(v)}
                      className={`h-9 px-4 text-[12px] font-semibold transition-all ${
                        variantsView === v
                          ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                          : "bg-[var(--bg-surface-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {familyGridFields.length > 0 && variantsView === "grid" ? (
                <FamilySpecGrid
                  specFields={familyGridFields}
                  familyProductName={product.product_name || ""}
                  seedModel={seedMemberFromPrimary}
                  productSpecs={(product.schema_specs || {}) as Record<string, unknown>}
                  onChangeProductSpecs={(next) => updateProduct_({ schema_specs: next })}
                  models={models}
                  onChange={setModels}
                />
              ) : (
              <ModelsSection
                specFields={(activeSpecsSchema?.groups ?? []).flatMap((g) =>
                  g.fields
                    .filter((f) => !["file", "image", "long_text"].includes(f.fieldType))
                    .map((f) => ({
                      key: f.key,
                      label: f.label ?? f.key,
                      unit: f.unit ?? null,
                      fieldType: f.fieldType,
                      options: (f.options ?? []).map((o) => ({ value: o.value, label: o.label })),
                    })),
                )}
                productPacking={productPackingDefaults}
                productSpecs={(product.schema_specs || {}) as Record<string, unknown>}
                modelPhotoUrl={(m) => {
                  const it = modelPhotoOf(m);
                  if (!it) return null;
                  return it._file ? URL.createObjectURL(it._file) : (it.url || null);
                }}
                onSetModelPhoto={setModelPhoto}
                onRemoveModelPhoto={removeModelPhoto}
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
              )}
            </Section>
            )}

            {/* Market Prices + the rest of pricing moved to the dedicated
                Cost & Price tab. Supplier & Sourcing lives in the Supplier
                tab. This step now owns only the variant definitions. */}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           STEP: COST & PRICE — everything price-related in one place.
           Supplier cost stays owned by the Supplier tab and is shown
           here READ-ONLY.
           ═══════════════════════════════════════════════════════════ */}
        {(onePage || steps[currentStep]?.id === "pricing") && (
          <div id="sec-pricing" className="space-y-5 scroll-mt-28 animate-in fade-in duration-300">
            {memberCtx && activeModel && (
              <>
                <MemberPricingPanel
                  model={activeModel}
                  onUpdate={updateActiveMember}
                  costNote={(() => {
                    const pl = productSuppliers.find((x) => x.is_primary) ?? productSuppliers[0];
                    const ov = safeActiveMember > 0 ? ((activeModel.supplier_overrides ?? {}) as Record<string, unknown>) : {};
                    const ovI18n = (ov.notes_i18n ?? null) as Record<string, string> | null;
                    const ovNote = (ovI18n?.[lang] || "").trim() || (ov.notes as string | undefined);
                    const plNote = ((pl?.notes_i18n ?? {})[lang] || "").trim() || pl?.notes;
                    return String(ovNote ?? plNote ?? "").trim() || null;
                  })()}
                  costExtras={(() => {
                    const pl = productSuppliers.find((x) => x.is_primary) ?? productSuppliers[0];
                    const ov = safeActiveMember > 0 ? ((activeModel.supplier_overrides ?? {}) as Record<string, unknown>) : {};
                    type PO = { price: string; note: string; note_i18n?: Record<string, string> };
                    const opts = ((ov.price_options as PO[] | undefined) ?? pl?.price_options ?? []) as PO[];
                    return opts.map((o) => ({ price: String(o.price ?? ""), note: ((o.note_i18n ?? {})[lang] || "").trim() || o.note || "" }));
                  })()}
                  familyCost={(() => {
                    const pl = productSuppliers.find((x) => x.is_primary) ?? productSuppliers[0];
                    return pl?.unit_cost_cny || models[0]?.cost_price || "";
                  })()}
                  costBinding={safeActiveMember === 0 ? (() => {
                    const primaryIdx = (() => {
                      const i = productSuppliers.findIndex((x) => x.is_primary);
                      return i >= 0 ? i : (productSuppliers.length ? 0 : -1);
                    })();
                    const link = primaryIdx >= 0 ? productSuppliers[primaryIdx] : null;
                    return {
                      value: String(link ? (link.unit_cost_cny || "") : (models[0]?.cost_price || "")),
                      onChange: (val: string) => {
                        if (primaryIdx >= 0) {
                          setProductSuppliers((prev) => prev.map((x, i) => (i === primaryIdx ? { ...x, unit_cost_cny: val } : x)));
                          if (models[0]?.cost_price) updatePrimaryModel({ cost_price: "" });
                        } else {
                          updatePrimaryModel({ cost_price: val });
                        }
                      },
                    };
                  })() : undefined}
                />
                <FamilySharedDivider />
              </>
            )}
            {/* Cost price (editable) — drives the FOB pricing engine below */}
            <Section id="selling-price" icon={<DollarSignIcon className="h-4 w-4" />} title={t("pricing.costPriceTitle", "Cost Price")} badge={t("pricing.costPriceBadge", "Factory · CNY")} defaultOpen>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(() => {
                  // The factory cost is a SINGLE value shared with the Supplier
                  // tab. When a supplier is linked, this reads/writes that link's
                  // unit_cost_cny (two-way sync). With no supplier yet, it lives
                  // on the model and is migrated onto the supplier once linked.
                  const primaryIdx = (() => {
                    const i = productSuppliers.findIndex((s) => s.is_primary);
                    return i >= 0 ? i : (productSuppliers.length ? 0 : -1);
                  })();
                  const primaryLink = primaryIdx >= 0 ? productSuppliers[primaryIdx] : null;
                  const sup = primaryLink ? suppliers.find((x) => x.id === primaryLink.supplier_id) : null;
                  const costValue = primaryLink ? (primaryLink.unit_cost_cny || "") : (primaryModel?.cost_price || "");
                  const setCost = (val: string) => {
                    if (primaryIdx >= 0) {
                      setProductSuppliers((prev) => prev.map((s, i) => (i === primaryIdx ? { ...s, unit_cost_cny: val } : s)));
                      if (primaryModel?.cost_price) updatePrimaryModel({ cost_price: "" });
                    } else {
                      updatePrimaryModel({ cost_price: val });
                    }
                  };
                  return (
                    <div>
                      <label className={lbl}><span className="inline-flex items-center gap-1.5"><CircleDollarSignIcon className="h-3 w-3" /> {t("pricing.factoryCostCny", "Factory cost (CNY)")}</span></label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-[var(--text-ghost)]">¥</span>
                        <input
                          type="number"
                          step="0.01"
                          value={costValue}
                          onChange={(e) => setCost(e.target.value)}
                          placeholder="0"
                          className={`${inp} pl-8`}
                        />
                      </div>
                      <p className="text-[10px] text-[var(--text-ghost)] mt-1.5">
                        {primaryLink
                          ? t("pricing.costPriceHintSynced", "Synced with the Supplier tab") + (sup?.name ? ` (${sup.name})` : "") + ". " + t("pricing.costPriceHint2", "Editing here updates the supplier cost too. The FOB Pricing below is derived from it via Commercial Setup.")
                          : t("pricing.costPriceHintNew", "The KOLEEX factory cost. Once you link a supplier it becomes the supplier cost (Supplier tab). The FOB Pricing below auto-detects level, margin, band and channel prices from Commercial Setup.")}
                      </p>
                      {/* The price's own note (Supplier tab) rides along
                          wherever the price is shown — member note first. */}
                      {(() => {
                        const ov = memberCtx && safeActiveMember > 0 && activeModel
                          ? ((activeModel.supplier_overrides ?? {}) as Record<string, unknown>)
                          : {};
                        const ovI18n = (ov.notes_i18n ?? null) as Record<string, string> | null;
                        const plI18n = primaryLink?.notes_i18n ?? null;
                        const memberNote = (ovI18n?.[lang] || "").trim() || (ov.notes as string | undefined);
                        const primaryNote = (plI18n?.[lang] || "").trim() || primaryLink?.notes;
                        const note = String(memberNote ?? primaryNote ?? "").trim();
                        type PO = { price: string; note: string; note_i18n?: Record<string, string> };
                        const options = ((ov.price_options as PO[] | undefined) ?? primaryLink?.price_options ?? []) as PO[];
                        if (!note && options.length === 0) return null;
                        return (
                          <div className="mt-1.5 space-y-1 border-s-2 border-[var(--border-strong)] ps-2">
                            {note && (
                              <p className="text-[10.5px] italic leading-snug text-[var(--text-muted)] whitespace-pre-wrap">{note}</p>
                            )}
                            {options.map((o, oi) => {
                              const onote = ((o.note_i18n ?? {})[lang] || "").trim() || o.note;
                              return (
                                <p key={oi} className="text-[10.5px] leading-snug text-[var(--text-muted)]">
                                  <span className="font-semibold text-[var(--text-subtle)] tabular-nums">¥{o.price || "—"}</span>
                                  {onote ? <span className="italic"> — {onote}</span> : null}
                                </p>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
              </div>
            </Section>

            {/* Base FOB — auto from cost via product level (Commercial Setup) */}
            <Section id="base-fob" icon={<DollarSignIcon className="h-4 w-4" />} title={t("pricing.baseFobTitle", "Base FOB Price")} badge={t("pricing.baseFobBadge", "Auto · by product level")} defaultOpen>
              {(() => {
                const link = productSuppliers.find((s) => s.is_primary) || productSuppliers[0] || null;
                const costNum = link?.unit_cost_cny ? Number(link.unit_cost_cny) : (primaryModel?.cost_price ? Number(primaryModel.cost_price) : null);
                return <BaseFobCard costCny={Number.isFinite(costNum as number) ? (costNum as number) : null} currency="CNY" />;
              })()}
            </Section>

            {/* FOB Pricing engine — live breakdown from Commercial Setup */}
            <Section id="fob-pricing" icon={<DollarSignIcon className="h-4 w-4" />} title={t("pricing.fobTitle", "Market & Customer Pricing")} badge={t("pricing.fobBadge", "Live · from Commercial Setup")} defaultOpen>
              {(() => {
                const link = productSuppliers.find((s) => s.is_primary) || productSuppliers[0] || null;
                const costNum = link?.unit_cost_cny ? Number(link.unit_cost_cny) : (primaryModel?.cost_price ? Number(primaryModel.cost_price) : null);
                return <PricingIntelligenceCard costCny={Number.isFinite(costNum as number) ? (costNum as number) : null} currency="CNY" subcategorySlug={product.subcategory_slug || null} supportsCompleteSet={!!product.supports_complete_set} />;
              })()}
            </Section>

            {/* Stand / Table configurable options now live on the Specs tab
                (they ARE the accessory's specs & variants). A pointer keeps the
                ¥ price-add-on context discoverable from the Variants/pricing
                area without duplicating the editor. */}
            {isAccessory && (
              <div className="flex items-start gap-3 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
                <Settings2Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-ghost)]" />
                <p className="text-[11px] leading-relaxed text-[var(--text-ghost)]">
                  {t("pricing.optionsMovedHint", "This product's options (shape, size, quality, thickness, lifting, wheels…) and their ¥ price add-ons are configured on the Specs tab. Each option's delta feeds the complete-set price on machines.")}
                </p>
              </div>
            )}

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
            {memberCtx && activeModel && (
              <>
                <MemberLogisticsPanel model={activeModel} onUpdate={updateActiveMember} />
                <FamilySharedDivider />
              </>
            )}
            <Section id="logistics-origin" icon={<GlobeIcon className="h-4 w-4" />} title={t("logistics.title", "Origin & Customs")} badge={t("logistics.badge", "Shipping · Customs")}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>
                    <span className="inline-flex items-center gap-1.5"><BoundIcon semanticKey="field.origin" className="h-3 w-3" fallback={<GlobeIcon className="h-3 w-3" />} /> {t("logistics.countryOfOrigin", "Country of Origin")}</span>
                  </label>
                  <KdsSelect
                    value={product.country_of_origin}
                    onChange={(v) => updateProduct_({ country_of_origin: v })}
                    options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
                    placeholder="—"
                    triggerClassName={inp + " pe-9 text-start"}
                  />
                </div>
                {!schemaCoveredCols.has("hs_code") ? (
                  <div>
                    <label className={lbl}><span className="inline-flex items-center gap-1.5"><ScanLineIcon className="h-3 w-3" /> {t("logistics.hsCode", "HS Code")}</span></label>
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

            {/* Schema-driven Packing & Shipping group (formTab:"logistics").
                Product-level packing/CBM/weights entered here, stored in
                schema_specs — the single source of truth for schema products.
                Rendered header-less (the group card carries its own title) so
                it doesn't duplicate the title or show the Specs-tab intro. */}
            {logisticsTabSchema ? (
              <div id="logistics-packing" className="scroll-mt-28">
                <SchemaSpecsSection
                  schema={logisticsTabSchema}
                  values={product.schema_specs || {}}
                  onChange={(next) => updateProduct_({ schema_specs: next })}
                  hideHeader
                />
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
                <BoxIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-ghost)]" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-[var(--text-primary)]">{t("logistics.packingTitle", "Packing & shipment are per-variant")}</p>
                  <p className="text-[10px] text-[var(--text-ghost)] mt-0.5 leading-relaxed">{t("logistics.packingBody", "Packing type, carton dimensions, CBM, net/gross weight and 20ft/40ft container quantities are entered per variant on the Variants tab.")}</p>
                  <button
                    type="button"
                    onClick={() => { const i = steps.findIndex((s) => s.id === "commercial"); if (i >= 0) goToStep(i); }}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold text-[var(--text-primary)] bg-[var(--bg-base)] hover:bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] transition-colors mt-2"
                  >
                    <ArrowUpRightIcon className="h-3 w-3" /> {t("logistics.jumpCommercial", "Open Variants")}
                  </button>
                </div>
              </div>
            )}

            {/* Fulfillment Defaults — MOQ + Lead Time cascade to new variants.
                Lives on the LOGISTICS tab with the rest of the order/shipping
                data (owner: keep Specs purely technical). */}
            {!fulfillmentCoveredBySchema && (
            <Section id="advanced" icon={<WrenchIcon className="h-4 w-4" />} title={t("technical.fulfillmentDefaults", "Fulfillment Defaults")} badge={t("technical.fulfillmentBadge", "MOQ · Lead Time")} defaultOpen={false}>
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}><span className="inline-flex items-center gap-1.5"><BoxesIcon className="h-3 w-3" /> {t("technical.defaultMoq", "Default MOQ (Product-level)")}</span></label>
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
                    <label className={lbl}><span className="inline-flex items-center gap-1.5"><ClockIcon className="h-3 w-3" /> {t("technical.defaultLeadTime", "Default Lead Time")}</span></label>
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
           STEP: COMPLIANCE & WARRANTY — universal compliance + warranty.
           Detailed certificate records (issuer, number, expiry, file) and
           after-sales fields (spare parts, service life, maintenance) land
           here in a later phase; CE/RoHS + warranty are surfaced now.
           ═══════════════════════════════════════════════════════════ */}
        {(onePage || steps[currentStep]?.id === "compliance") && (
          <div id="sec-compliance" className="space-y-5 scroll-mt-28 animate-in fade-in duration-300">
            <Section id="compliance-certs" icon={<ShieldCheckIcon className="h-4 w-4" />} title={t("compliance.title", "Compliance")} badge={t("compliance.badge", "Certifications")}>
              {certsCoveredBySchema && (
                <p className="mb-3 text-[11px] leading-relaxed text-[var(--text-ghost)]">{t("compliance.ceInSpecs", "CE and other certifications for this category are set on the Specifications tab (Safety & Compliance → Certifications). Add certificate records with issuer, number and expiry below.")}</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {([
                  ...(certsCoveredBySchema ? [] : [{ key: "ce_certified" as const, label: t("compliance.ce", "CE Certified"), help: t("compliance.ceHelp", "Required for sale in the European Economic Area.") }]),
                  { key: "rohs_compliant" as const, label: t("compliance.rohs", "RoHS Compliant"), help: t("compliance.rohsHelp", "EU restriction on hazardous substances in electronics.") },
                ]).map((c) => {
                  const on = !!product[c.key];
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => updateProduct_({ [c.key]: !on })}
                      aria-pressed={on}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-left hover:border-[var(--border-focus)] transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-[var(--text-primary)]">{c.label}</span>
                        <span className="block text-[10px] text-[var(--text-ghost)] mt-0.5 leading-relaxed">{c.help}</span>
                      </span>
                      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-[var(--bg-inverted)]" : "bg-[var(--bg-surface-active)]"}`}>
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-[var(--bg-card)] transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                <p className="text-[11px] font-medium text-[var(--text-faint)] mb-2">{t("compliance.recordsTitle", "Certificate records")}</p>
                <CertificationsSection certifications={certifications} onChange={setCertifications} />
              </div>
            </Section>

            <Section id="compliance-warranty" icon={<ShieldCheckIcon className="h-4 w-4" />} title={t("compliance.warrantyTitle", "Warranty & After-Sales")} badge={t("compliance.warrantyBadge", "Service")}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-3">
                  <label className={lbl}><span className="inline-flex items-center gap-1.5"><ShieldCheckIcon className="h-3 w-3" /> {t("hero.warranty", "Warranty")}</span></label>
                  <input type="text" value={product.warranty} placeholder={t("hero.warrantyPlaceholder", "e.g. 2 years parts & labour")} className={inp}
                    onChange={(e) => updateProduct_({ warranty: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}><span className="inline-flex items-center gap-1.5"><TimerIcon className="h-3 w-3" /> Warranty (months)</span></label>
                  <input className={inp} inputMode="numeric" value={product.warranty_months} placeholder="e.g. 36"
                    onChange={(e) => updateProduct_({ warranty_months: e.target.value.replace(/[^0-9]/g, "") })} />
                </div>
                <div>
                  <label className={lbl}><span className="inline-flex items-center gap-1.5"><ListIcon className="h-3 w-3" /> Warranty type</span></label>
                  <KdsSelect value={product.warranty_type} onChange={(v) => updateProduct_({ warranty_type: v })}
                    options={[{ value: "parts-only", label: "Parts only" }, { value: "parts-and-labour", label: "Parts & labour" }, { value: "on-site", label: "On-site" }]}
                    placeholder="—" triggerClassName={inp + " pe-9 text-start"} />
                </div>
                <div>
                  <label className={lbl}><span className="inline-flex items-center gap-1.5"><CalendarRawIcon className="h-3 w-3" /> Starts from</span></label>
                  <KdsSelect value={product.warranty_start_from} onChange={(v) => updateProduct_({ warranty_start_from: v })}
                    options={[{ value: "shipment", label: "Shipment" }, { value: "installation", label: "Installation" }, { value: "invoice", label: "Invoice date" }]}
                    placeholder="—" triggerClassName={inp + " pe-9 text-start"} />
                </div>
                <div className="md:col-span-3">
                  <label className={lbl}><span className="inline-flex items-center gap-1.5"><ShieldIcon className="h-3 w-3" /> Coverage</span></label>
                  <input className={inp} value={product.warranty_coverage} placeholder="What the warranty covers…"
                    onChange={(e) => updateProduct_({ warranty_coverage: e.target.value })} />
                </div>
                <div className="md:col-span-3">
                  <label className={lbl}><span className="inline-flex items-center gap-1.5"><ShieldOffIcon className="h-3 w-3" /> Exclusions</span></label>
                  <input className={inp} value={product.warranty_exclusions} placeholder="What is not covered (wear parts, misuse…)"
                    onChange={(e) => updateProduct_({ warranty_exclusions: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}><span className="inline-flex items-center gap-1.5"><CogIcon className="h-3 w-3" /> Spare-parts availability</span></label>
                  <input className={inp} value={product.spare_parts_availability} placeholder="e.g. 10 years"
                    onChange={(e) => updateProduct_({ spare_parts_availability: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}><span className="inline-flex items-center gap-1.5"><BoxIcon className="h-3 w-3" /> Spare-parts stock</span></label>
                  <input className={inp} value={product.spare_parts_stock} placeholder="e.g. In stock — Shenzhen DC"
                    onChange={(e) => updateProduct_({ spare_parts_stock: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}><span className="inline-flex items-center gap-1.5"><GaugeIcon className="h-3 w-3" /> Service life</span></label>
                  <input className={inp} value={product.service_life} placeholder="e.g. 8–10 years"
                    onChange={(e) => updateProduct_({ service_life: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}><span className="inline-flex items-center gap-1.5"><WrenchIcon className="h-3 w-3" /> Maintenance interval</span></label>
                  <input className={inp} value={product.maintenance_interval} placeholder="e.g. every 6 months"
                    onChange={(e) => updateProduct_({ maintenance_interval: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}><span className="inline-flex items-center gap-1.5"><HeadphonesIcon className="h-3 w-3" /> Technical support</span></label>
                  <input className={inp} value={product.technical_support} placeholder="e.g. 24/7 remote + on-site"
                    onChange={(e) => updateProduct_({ technical_support: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}><span className="inline-flex items-center gap-1.5"><Undo2Icon className="h-3 w-3" /> Returns policy</span></label>
                  <input className={inp} value={product.returns_policy} placeholder="e.g. 14-day DOA replacement"
                    onChange={(e) => updateProduct_({ returns_policy: e.target.value })} />
                </div>
                <div className="md:col-span-3">
                  <label className={lbl}><span className="inline-flex items-center gap-1.5"><PhoneCallIcon className="h-3 w-3" /> Support channels</span></label>
                  <div className="flex flex-wrap gap-2">
                    {["Phone", "Email", "WeChat", "WhatsApp", "On-site", "Remote"].map((ch) => {
                      const on = product.support_channels.includes(ch);
                      return (
                        <button key={ch} type="button" aria-pressed={on}
                          onClick={() => updateProduct_({ support_channels: on ? product.support_channels.filter((x) => x !== ch) : [...product.support_channels, ch] })}
                          className={`h-8 px-3 rounded-lg border text-[12px] transition-colors ${on ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent" : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"}`}>
                          {ch}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="md:col-span-3 flex flex-wrap gap-2">
                  {([
                    { key: "training_available" as const, label: "Training available" },
                    { key: "installation_service" as const, label: "Installation service" },
                  ]).map((f) => {
                    const on = !!product[f.key];
                    return (
                      <button key={f.key} type="button" aria-pressed={on}
                        onClick={() => updateProduct_({ [f.key]: !on })}
                        className={`h-9 px-3 rounded-lg border text-[12px] font-medium inline-flex items-center gap-2 transition-colors ${on ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent" : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"}`}>
                        <span className={`h-3.5 w-3.5 rounded-[4px] border ${on ? "bg-[var(--text-inverted)] border-transparent" : "border-[var(--border-subtle)]"}`} /> {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Section>
          </div>
        )}

        {(onePage || steps[currentStep]?.id === "media") && (
          <div id="sec-media" className="space-y-5 scroll-mt-28 animate-in fade-in duration-300">
            <Section id="media" icon={<ImageRawIcon className="h-4 w-4" />} title={t("media.filesTitle", "Media & Documents")}>
              <MediaSection
                media={media.filter(m => m.type !== "main_image")}
                excludeTypes={["main_image"]}
                onChange={(filtered) => {
                  const mainImages = media.filter(m => m.type === "main_image");
                  setMedia([...mainImages, ...filtered]);
                }}
              />
            </Section>

            {/* Phase 4 — structured industrial documents (separate from visuals). */}
            <Section id="documents" icon={<DocumentIcon className="h-4 w-4" />} title={t("documents.title", "Product Documents")} badge={t("documents.badge", "Manuals · Drawings · Certs")} defaultOpen={false}>
              <ProductDocumentsSection documents={productDocuments} onChange={setProductDocuments} />
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
                          <ReviewPill icon={<BoundIcon semanticKey="field.origin" className="h-3 w-3" fallback={<GlobeIcon className="h-3 w-3" />} />}>{t("review.madeInPill", "Made in {country}").replace("{country}", originName)}</ReviewPill>
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
                        <div className="h-1.5 rounded-full bg-[var(--bg-surface)] flex-1 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#567FB2] transition-all"
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
                <div className="h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
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
                <SummaryItem label={t("review.featured", "Flagship")} value={product.featured ? t("review.yes", "Yes") : t("review.no", "No")} dim={!product.featured} onClick={() => jumpTo("identity")} />
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
                <SummaryItem label={t("review.warranty", "Warranty")} value={product.warranty || "—"} dim={!product.warranty} onClick={() => jumpTo("compliance")} />
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
                <SummaryItem label={t("review.description", "Description")} value={product.description ? t("review.filled", "Filled") : "—"} dim={!product.description} onClick={() => jumpTo("identity")} />
                <SummaryItem label={t("review.mediaLabel", "Media")} value={t("review.mediaCount", "{n} files").replace("{n}", String(media.length))} dim={media.length === 0} onClick={() => jumpTo("media")} />
                <SummaryItem label={t("review.translations", "Translations")} value={t("review.translationsCount", "{n} locales").replace("{n}", String(translations.length))} dim={translations.length === 0} />
                <SummaryItem label={t("review.related", "Related")} value={t("review.relatedCount", "{n} links").replace("{n}", String(related.length))} dim={related.length === 0} />
              </ReviewGroup>

              {/* Translations + Related editors stay collapsed below
                  so the review remains scannable, but power-users can
                  still adjust them inline. */}
              {/* Translations are now authored on the Identity tab (Languages
                  & Markets), next to the English originals. The summary count
                  above links there. */}

              {/* Related Products → moved to the Knowledge & Relationships tab.
                 Search & Social (SEO) → moved to the Identity tab (next to the
                 slug + short description that feed it). Both open by default so
                 they're discovered during normal data entry, not buried here. */}

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
                  {saving ? <SpinnerIcon className="h-4 w-4" /> : <DiskIcon className="h-4 w-4" />}
                  {saving ? t("action.saving", "Saving...") : saveLabel}
                </button>
              </div>
            </div>
          );
        })()}
        </div>

        {/* ═══ STEP NAVIGATION BUTTONS ═══ */}
        {!onePage && !tabbed && (
        <div className="flex items-center justify-between mt-8 mb-4">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ArrowLeftIcon className="h-4 w-4" /> {t("wizard.previous", "Previous")}
          </button>

          <div className="text-[11px] text-[var(--text-ghost)]">
            {t("wizard.stepOf", "Step {current} of {total}").replace("{current}", String(currentStep + 1)).replace("{total}", String(steps.length))}
          </div>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={handleNext}
              className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold transition-all flex items-center gap-2 shadow-lg"
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
              {saving ? <SpinnerIcon className="h-4 w-4" /> : <DiskIcon className="h-4 w-4" />}
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
        divisionName={localizedName(divisions.find(d => d.slug === product.division_slug), lang)}
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
        categoryName={localizedName(categories.find(c => c.slug === product.category_slug), lang)}
        divisionName={localizedName(divisions.find(d => d.slug === product.division_slug), lang)}
        existingCount={subcategories.length}
      />

      {showSupplierModal && <CreateSupplierModal
        open={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        onCreated={(supplier) => {
          setSuppliers(prev => [...prev, { ...supplier, logo: supplier.logo || null }].sort((a, b) => a.name.localeCompare(b.name)));
          if (supplierTarget !== "hero") {
            setModels(prev => prev.map(m => m._tempId === supplierTarget ? { ...m, supplier: supplier.name } : m));
          }
        }}
      />}

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

      <ConfirmDialog
        open={promoteAsk !== null}
        tone="neutral"
        title={t("fam.promoteConfirm", "Make this model the PRIMARY of the family? The current primary becomes a regular member.")}
        confirmLabel={t("fam.promoteDo", "Make primary")}
        onCancel={() => setPromoteAsk(null)}
        onConfirm={() => {
          const target = promoteAsk;
          setPromoteAsk(null);
          if (!target) return;
          const reordered = [target, ...models.filter((x) => x !== target)].map((mm, i) => ({ ...mm, order: i }));
          setModels(reordered);
          setActiveMember(0);
        }}
      />
      <ConfirmDialog
        open={discardOpen}
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => { setDiscardOpen(false); leaveNow(); }}
        title={t("wizard.confirmDiscardTitle", "Discard unsaved changes?")}
        message={t("wizard.confirmDiscard", "Discard your changes and leave this page? Anything you've edited that hasn't been saved will be lost.")}
        confirmLabel={t("wizard.discardConfirm", "Discard & leave")}
        cancelLabel={t("wizard.discardCancel", "Keep editing")}
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
            className="h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all"
          >
            {t("hero.done", "Done")}
          </button>
          <button
            type="button"
            onClick={() => { onResetToAuto(); setEditing(false); }}
            className="h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all"
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
            className="h-11 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg"
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
          <div className="kx-glass-pop absolute z-50 top-full left-0 right-0 mt-1.5 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl shadow-2xl shadow-black/30 overflow-hidden max-h-[200px] overflow-y-auto py-1">
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
