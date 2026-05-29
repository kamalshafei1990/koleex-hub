import type {
  ProductSchemaDefinition,
  SpecField,
  ProductKnowledgeBlock,
} from "@/types/product-schema";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ReadinessDimension =
  | "data"
  | "media"
  | "commercial"
  | "technical"
  | "website"
  | "ai"
  | "brochure";

export interface ReadinessScore {
  dimension: ReadinessDimension;
  score: number;
  filled: number;
  total: number;
  missing: { key: string; label: string }[];
  status: "empty" | "incomplete" | "ready";
}

export interface ReadinessReport {
  overall: number;
  dimensions: ReadinessScore[];
  topMissing: { key: string; label: string; dimension: ReadinessDimension }[];
}

export interface ReadinessInput {
  schema: ProductSchemaDefinition | null;
  values: Record<string, unknown>;
  media: {
    main: number;
    gallery: number;
    packing: number;
    manual: number;
    video: number;
  };
  commercial: {
    product_name?: string | null;
    primary_model?: string | null;
    supplier_model?: string | null;
    cost_price?: string | number | null;
    global_price?: string | number | null;
    warranty?: string | null;
    moq?: string | null;
    lead_time?: string | null;
  };
  knowledge: ProductKnowledgeBlock[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A value is considered "filled" when it is meaningfully present:
 * - not null / undefined
 * - not an empty string (after trimming)
 * - not an empty array
 * - not the boolean `false`
 */
function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return value !== false;
  return true;
}

/** Iterate every SpecField across all groups in the schema. */
function allFields(schema: ProductSchemaDefinition | null): Array<{
  field: SpecField;
  groupId: string;
}> {
  if (!schema) return [];
  const out: Array<{ field: SpecField; groupId: string }> = [];
  for (const group of schema.groups ?? []) {
    for (const field of group.fields ?? []) {
      out.push({ field, groupId: group.id });
    }
  }
  return out;
}

/** Convert a raw score (0-100) into a status bucket. */
function statusFor(score: number, total: number): ReadinessScore["status"] {
  if (total === 0) return "ready";
  if (score < 20) return "empty";
  if (score < 80) return "incomplete";
  return "ready";
}

/** Build a ReadinessScore from filled/total counts plus a missing list. */
function buildScore(
  dimension: ReadinessDimension,
  filled: number,
  total: number,
  missing: { key: string; label: string }[],
): ReadinessScore {
  const score = total === 0 ? 100 : Math.round((filled / total) * 100);
  return {
    dimension,
    score,
    filled,
    total,
    missing: missing.slice(0, 5),
    status: statusFor(score, total),
  };
}

// ---------------------------------------------------------------------------
// Dimension scorers
// ---------------------------------------------------------------------------

/** Data: every required SpecField across all groups. */
function scoreData(input: ReadinessInput): ReadinessScore {
  const missing: { key: string; label: string }[] = [];
  let filled = 0;
  let total = 0;
  for (const { field } of allFields(input.schema)) {
    if (!field.required) continue;
    total += 1;
    if (isFilled(input.values[field.key])) {
      filled += 1;
    } else {
      missing.push({ key: field.key, label: field.label });
    }
  }
  return buildScore("data", filled, total, missing);
}

/** Media: 5 fixed slots — main, gallery, packing, manual, video. */
function scoreMedia(input: ReadinessInput): ReadinessScore {
  const checks: Array<{ key: string; label: string; ok: boolean }> = [
    { key: "main", label: "Main image", ok: input.media.main >= 1 },
    { key: "gallery", label: "Gallery (>=3)", ok: input.media.gallery >= 3 },
    { key: "packing", label: "Packing image", ok: input.media.packing >= 1 },
    { key: "manual", label: "Manual / document", ok: input.media.manual >= 1 },
    { key: "video", label: "Product video", ok: input.media.video >= 1 },
  ];
  const filled = checks.filter((c) => c.ok).length;
  const total = checks.length;
  const missing = checks.filter((c) => !c.ok).map(({ key, label }) => ({ key, label }));
  return buildScore("media", filled, total, missing);
}

/** Commercial: 8 fixed fields from input.commercial. */
function scoreCommercial(input: ReadinessInput): ReadinessScore {
  const fields: Array<{ key: keyof ReadinessInput["commercial"]; label: string }> = [
    { key: "product_name", label: "Product name" },
    { key: "primary_model", label: "Primary model" },
    { key: "supplier_model", label: "Supplier model" },
    { key: "cost_price", label: "Cost price" },
    { key: "global_price", label: "Global price" },
    { key: "warranty", label: "Warranty" },
    { key: "moq", label: "MOQ" },
    { key: "lead_time", label: "Lead time" },
  ];
  const missing: { key: string; label: string }[] = [];
  let filled = 0;
  for (const f of fields) {
    if (isFilled(input.commercial[f.key])) {
      filled += 1;
    } else {
      missing.push({ key: f.key as string, label: f.label });
    }
  }
  return buildScore("commercial", filled, fields.length, missing);
}

/** Technical: required SpecFields in electrical/physical/compliance/customs/technical groups. */
function scoreTechnical(input: ReadinessInput): ReadinessScore {
  const techGroups = new Set([
    "electrical",
    "physical",
    "compliance",
    "customs",
    "technical",
  ]);
  const missing: { key: string; label: string }[] = [];
  let filled = 0;
  let total = 0;
  for (const { field, groupId } of allFields(input.schema)) {
    if (!techGroups.has(groupId)) continue;
    if (!field.required) continue;
    total += 1;
    if (isFilled(input.values[field.key])) {
      filled += 1;
    } else {
      missing.push({ key: field.key, label: field.label });
    }
  }
  return buildScore("technical", filled, total, missing);
}

/** Website: every SpecField that is both publicVisible AND websiteVisible. */
function scoreWebsite(input: ReadinessInput): ReadinessScore {
  const missing: { key: string; label: string }[] = [];
  let filled = 0;
  let total = 0;
  for (const { field } of allFields(input.schema)) {
    if (!field.publicVisible || !field.websiteVisible) continue;
    total += 1;
    if (isFilled(input.values[field.key])) {
      filled += 1;
    } else {
      missing.push({ key: field.key, label: field.label });
    }
  }
  return buildScore("website", filled, total, missing);
}

/** AI: every aiReadable SpecField + every knowledge block flagged aiReadable. */
function scoreAi(input: ReadinessInput): ReadinessScore {
  const missing: { key: string; label: string }[] = [];
  let filled = 0;
  let total = 0;
  for (const { field } of allFields(input.schema)) {
    if (!field.aiReadable) continue;
    total += 1;
    if (isFilled(input.values[field.key])) {
      filled += 1;
    } else {
      missing.push({ key: field.key, label: field.label });
    }
  }
  for (const block of input.knowledge ?? []) {
    if (!block.visibility?.aiReadable) continue;
    total += 1;
    // A knowledge block counts as filled when it has any content body.
    const body =
      (block as unknown as { content?: unknown; body?: unknown }).content ??
      (block as unknown as { body?: unknown }).body;
    if (isFilled(body)) {
      filled += 1;
    } else {
      missing.push({
        key: `knowledge:${block.id}`,
        label: block.title || "Knowledge block",
      });
    }
  }
  return buildScore("ai", filled, total, missing);
}

/** Brochure: every brochureVisible SpecField + main image slot + gallery>=4 slot. */
function scoreBrochure(input: ReadinessInput): ReadinessScore {
  const missing: { key: string; label: string }[] = [];
  let filled = 0;
  let total = 0;
  for (const { field } of allFields(input.schema)) {
    if (!field.brochureVisible) continue;
    total += 1;
    if (isFilled(input.values[field.key])) {
      filled += 1;
    } else {
      missing.push({ key: field.key, label: field.label });
    }
  }
  // Extra media slots required for a usable brochure.
  total += 1;
  if (input.media.main >= 1) {
    filled += 1;
  } else {
    missing.push({ key: "main", label: "Main image" });
  }
  total += 1;
  if (input.media.gallery >= 4) {
    filled += 1;
  } else {
    missing.push({ key: "gallery", label: "Gallery (>=4)" });
  }
  return buildScore("brochure", filled, total, missing);
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

const WEIGHTS: Record<ReadinessDimension, number> = {
  data: 25,
  commercial: 20,
  technical: 15,
  media: 15,
  website: 10,
  ai: 10,
  brochure: 5,
};

export function computeReadiness(input: ReadinessInput): ReadinessReport {
  const dimensions: ReadinessScore[] = [
    scoreData(input),
    scoreMedia(input),
    scoreCommercial(input),
    scoreTechnical(input),
    scoreWebsite(input),
    scoreAi(input),
    scoreBrochure(input),
  ];

  // Weighted overall score, rounded to integer.
  let weightedSum = 0;
  let weightTotal = 0;
  for (const dim of dimensions) {
    const w = WEIGHTS[dim.dimension];
    weightedSum += dim.score * w;
    weightTotal += w;
  }
  const overall = weightTotal === 0 ? 0 : Math.round(weightedSum / weightTotal);

  // Flatten missing items across dimensions, capped at 10.
  const topMissing: ReadinessReport["topMissing"] = [];
  for (const dim of dimensions) {
    for (const m of dim.missing) {
      if (topMissing.length >= 10) break;
      topMissing.push({ key: m.key, label: m.label, dimension: dim.dimension });
    }
    if (topMissing.length >= 10) break;
  }

  return { overall, dimensions, topMissing };
}
