/**
 * Product Knowledge — ergonomic barrel + factory module.
 *
 * Re-exports the core product-knowledge types from ./product-schema and
 * provides default visibility presets + deterministic factory functions
 * for each ProductKnowledgeBlockType.
 *
 * Pure TS: no React, no Supabase, no runtime randomness, no time-based ids.
 */

export type {
  ProductKnowledgeBlock,
  ProductKnowledgeBlockType,
  VisibilityFlags,
} from "./product-schema";

import type {
  ProductKnowledgeBlock,
  ProductKnowledgeBlockType,
  VisibilityFlags,
} from "./product-schema";

/* -------------------------------------------------------------------------- */
/*  Canonical visibility presets                                              */
/*                                                                            */
/*  Uses the same flag names as VisibilityFlags on src/types/product-schema.  */
/*  aiWeight is NOT a visibility flag — it lives on the block itself and is   */
/*  defined separately in DEFAULT_KNOWLEDGE_AI_WEIGHT below.                  */
/* -------------------------------------------------------------------------- */

const PRESET_PUBLIC: VisibilityFlags = {
  internalOnly: false,
  publicVisible: true,
  websiteVisible: true,
  quoteVisible: false,
  invoiceVisible: false,
  brochureVisible: true,
  aiReadable: true,
  comparable: false,
  filterVisible: false,
  searchable: false,
  translatable: true,
};

const PRESET_TECHNICAL_COMPARABLE: VisibilityFlags = {
  ...PRESET_PUBLIC,
  comparable: true,
};

const PRESET_OPERATIONAL: VisibilityFlags = {
  ...PRESET_PUBLIC,
};

const PRESET_AI_HEAVY: VisibilityFlags = {
  internalOnly: false,
  publicVisible: false,
  websiteVisible: false,
  quoteVisible: false,
  invoiceVisible: false,
  brochureVisible: false,
  aiReadable: true,
  comparable: true,
  filterVisible: false,
  searchable: true,
  translatable: false,
};

const PRESET_INTERNAL_AI: VisibilityFlags = {
  internalOnly: true,
  publicVisible: false,
  websiteVisible: false,
  quoteVisible: false,
  invoiceVisible: false,
  brochureVisible: false,
  aiReadable: true,
  comparable: false,
  filterVisible: false,
  searchable: false,
  translatable: false,
};

export const DEFAULT_KNOWLEDGE_VISIBILITY: Record<
  ProductKnowledgeBlockType,
  VisibilityFlags
> = {
  overview: { ...PRESET_PUBLIC },
  key_features: { ...PRESET_PUBLIC },
  applications: { ...PRESET_PUBLIC },
  suitable_materials: { ...PRESET_PUBLIC },
  selling_points: { ...PRESET_PUBLIC },
  recommended_use_cases: { ...PRESET_PUBLIC },
  package_contents: { ...PRESET_PUBLIC },
  warranty_notes: { ...PRESET_PUBLIC },
  technical_advantages: { ...PRESET_TECHNICAL_COMPARABLE },
  comparison_notes: { ...PRESET_TECHNICAL_COMPARABLE },
  operation_notes: { ...PRESET_OPERATIONAL },
  maintenance_notes: { ...PRESET_OPERATIONAL },
  buyer_questions: { ...PRESET_AI_HEAVY },
  limitations: { ...PRESET_INTERNAL_AI },
  warnings: { ...PRESET_PUBLIC },
  troubleshooting: { ...PRESET_AI_HEAVY },
  ai_summary: { ...PRESET_AI_HEAVY },
};

/* Per-block aiWeight — drives readiness scoring + AI prompt prioritization.
   Higher = more important for the AI assistant to consider. */
export const DEFAULT_KNOWLEDGE_AI_WEIGHT: Record<ProductKnowledgeBlockType, number> = {
  overview: 0.8,
  key_features: 0.8,
  applications: 0.8,
  suitable_materials: 0.8,
  selling_points: 0.8,
  recommended_use_cases: 0.8,
  package_contents: 0.8,
  warranty_notes: 0.8,
  technical_advantages: 0.9,
  comparison_notes: 0.9,
  operation_notes: 0.6,
  maintenance_notes: 0.6,
  buyer_questions: 1.0,
  limitations: 0.5,
  warnings: 0.7,
  troubleshooting: 0.7,
  ai_summary: 1.0,
};

/* Default human-readable title per block type. Factories use these when
   the caller does not supply opts.title. */
export const DEFAULT_KNOWLEDGE_TITLE: Record<ProductKnowledgeBlockType, string> = {
  overview: "Overview",
  key_features: "Key Features",
  applications: "Applications",
  suitable_materials: "Suitable Materials",
  selling_points: "Selling Points",
  recommended_use_cases: "Recommended Use Cases",
  package_contents: "What's In The Box",
  warranty_notes: "Warranty",
  technical_advantages: "Technical Advantages",
  comparison_notes: "Comparison Notes",
  operation_notes: "Operation Notes",
  maintenance_notes: "Maintenance Notes",
  buyer_questions: "Buyer Questions",
  limitations: "Limitations",
  warnings: "Warnings & Safety",
  troubleshooting: "Troubleshooting",
  ai_summary: "AI Summary",
};

/* -------------------------------------------------------------------------- */
/*  Deterministic id derivation (djb2)                                        */
/*                                                                            */
/*  Pure, deterministic — no randomness or time-based seed. Two calls with    */
/*  the same (type, content) produce the same id, which is what we want for  */
/*  cache-friendly re-renders + workflow resume.                              */
/* -------------------------------------------------------------------------- */

function djb2(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function deriveId(type: ProductKnowledgeBlockType, content: unknown): string {
  const serialized = JSON.stringify(content) ?? "";
  const h = djb2(`${type}:${serialized}`).toString(36);
  return `${type}_${h}`;
}

/* -------------------------------------------------------------------------- */
/*  Factory options + builder                                                 */
/* -------------------------------------------------------------------------- */

export interface BlockFactoryOptions {
  /** Override the deterministically derived id. */
  id?: string;
  /** Override individual visibility flags (merged over the default preset). */
  visibility?: Partial<VisibilityFlags>;
  /** Override the default human-readable title. */
  title?: string;
  /** Override the default aiWeight. */
  aiWeight?: number;
  /** Spec-field keys this knowledge block elaborates on. */
  relatedFields?: string[];
}

function buildBlock<T extends ProductKnowledgeBlockType>(
  type: T,
  content: ProductKnowledgeBlock["content"],
  opts?: BlockFactoryOptions,
): ProductKnowledgeBlock {
  const visibility: VisibilityFlags = {
    ...DEFAULT_KNOWLEDGE_VISIBILITY[type],
    ...(opts?.visibility ?? {}),
  };
  return {
    id: opts?.id ?? deriveId(type, content),
    type,
    title: opts?.title ?? DEFAULT_KNOWLEDGE_TITLE[type],
    content,
    visibility,
    aiWeight: opts?.aiWeight ?? DEFAULT_KNOWLEDGE_AI_WEIGHT[type],
    relatedFields: opts?.relatedFields,
  };
}

/* -------------------------------------------------------------------------- */
/*  Factories — one per ProductKnowledgeBlockType                             */
/* -------------------------------------------------------------------------- */

export function makeOverviewBlock(
  content: string,
  opts?: BlockFactoryOptions,
): ProductKnowledgeBlock {
  return buildBlock("overview", content, opts);
}

export function makeKeyFeaturesBlock(
  items: string[],
  opts?: BlockFactoryOptions,
): ProductKnowledgeBlock {
  return buildBlock("key_features", items, opts);
}

export function makeApplicationsBlock(
  items: string[],
  opts?: BlockFactoryOptions,
): ProductKnowledgeBlock {
  return buildBlock("applications", items, opts);
}

export function makeSuitableMaterialsBlock(
  items: string[],
  opts?: BlockFactoryOptions,
): ProductKnowledgeBlock {
  return buildBlock("suitable_materials", items, opts);
}

export function makeSellingPointsBlock(
  items: string[],
  opts?: BlockFactoryOptions,
): ProductKnowledgeBlock {
  return buildBlock("selling_points", items, opts);
}

export function makeRecommendedUseCasesBlock(
  items: string[],
  opts?: BlockFactoryOptions,
): ProductKnowledgeBlock {
  return buildBlock("recommended_use_cases", items, opts);
}

export function makePackageContentsBlock(
  items: string[],
  opts?: BlockFactoryOptions,
): ProductKnowledgeBlock {
  return buildBlock("package_contents", items, opts);
}

export function makeWarrantyNotesBlock(
  content: string,
  opts?: BlockFactoryOptions,
): ProductKnowledgeBlock {
  return buildBlock("warranty_notes", content, opts);
}

export function makeTechnicalAdvantagesBlock(
  items: string[],
  opts?: BlockFactoryOptions,
): ProductKnowledgeBlock {
  return buildBlock("technical_advantages", items, opts);
}

export function makeComparisonNotesBlock(
  content: string | string[],
  opts?: BlockFactoryOptions,
): ProductKnowledgeBlock {
  return buildBlock("comparison_notes", content, opts);
}

export function makeOperationNotesBlock(
  content: string | string[],
  opts?: BlockFactoryOptions,
): ProductKnowledgeBlock {
  return buildBlock("operation_notes", content, opts);
}

export function makeMaintenanceNotesBlock(
  content: string | string[],
  opts?: BlockFactoryOptions,
): ProductKnowledgeBlock {
  return buildBlock("maintenance_notes", content, opts);
}

/* Buyer Questions are structured Q&A pairs. We stash them under the
   structured-record arm of ProductKnowledgeBlock.content as { questions: [...] }
   so the type stays string | string[] | Record<string, unknown>. */
export interface BuyerQuestion {
  question: string;
  answer: string;
}

export function makeBuyerQuestionsBlock(
  questions: BuyerQuestion[],
  opts?: BlockFactoryOptions,
): ProductKnowledgeBlock {
  return buildBlock(
    "buyer_questions",
    { questions: questions as unknown as Record<string, unknown>[] } as Record<string, unknown>,
    opts,
  );
}

export function makeLimitationsBlock(
  items: string[],
  opts?: BlockFactoryOptions,
): ProductKnowledgeBlock {
  return buildBlock("limitations", items, opts);
}
