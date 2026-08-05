/* ===========================================================================
   Koleex AI Intelligence Platform — Phase 0 contracts.

   These types ARE the architecture, executable. They mirror the ratified
   spec (docs/koleex-ai/architecture-spec-v1.md) one-to-one, and every later
   phase builds against them — the database tables of Phases 1–3 will be
   projections of these shapes, not the other way around.

   Ground rules encoded here rather than remembered:
   · A Package is a MANIFEST that references shared assets — it contains no
     copies and no runtime state (ADR-001/P1/P2).
   · All mutable state (memory, lockfile, metrics) lives on the Instance
     (ADR-003).
   · Permissions are REQUESTED by a package, never granted by it (ADR-008).
   · Blast radius is a declared, ordered class — the runtime guards on it
     structurally (P7).
   · Nothing in this file may reference an AI vendor. Provider awareness
     ends at the adapter boundary (P3, §21).

   Pure types + tiny pure helpers only. No I/O, no React, no Supabase.
   =========================================================================== */

/* ── Blast radius (P7 / ADR-008) ─────────────────────────────────────────
   Ordered: each class includes everything before it. v1 HARD-CAPS execution
   at "write" — "irreversible" can be declared (so manifests are honest about
   intent) but the guard refuses to execute it. */
export const BLAST_RADII = ["read", "suggest", "write", "irreversible"] as const;
export type BlastRadius = (typeof BLAST_RADII)[number];

export function blastRadiusRank(r: BlastRadius): number {
  return BLAST_RADII.indexOf(r);
}

/** The widest class the v1 runtime will EXECUTE (spec Non-Goal 6). */
export const V1_EXECUTION_CAP: BlastRadius = "write";

/* ── Capabilities (ADR-004) ─────────────────────────────────────────────── */
export type CapabilityKind = "procedure" | "workflow" | "tool_grant" | "template_bundle";
export type CapabilityStatus = "draft" | "approved" | "deprecated" | "retired";

/** A reference from a manifest into the registry — a semver RANGE, never a
 *  copy and never an exact pin (pins live in the Instance lockfile). */
export interface CapabilityRef {
  capabilityId: string;
  /** Semver range, e.g. "^1.2". Resolution to an exact version happens at
   *  install time and is recorded in the lockfile (ADR-005). */
  range: string;
}

export interface CapabilityDescriptor {
  id: string;
  kind: CapabilityKind;
  version: string; // exact semver of THIS descriptor
  owner: string;
  status: CapabilityStatus;
  /** Tenancy flag (D1): platform assets are read-only to tenants. */
  tenancy: "platform" | "tenant";
  tenantId: string | null; // null ⇔ platform tier
  /** The worst this capability can do — a ceiling the package's own declared
   *  radius may not exceed when referencing it. */
  blastCeiling: BlastRadius;
}

/* ── Policy document (ADR-009) ───────────────────────────────────────────
   A flat, typed document. NO rules DSL — merging is a fixed-precedence pure
   function in policy-resolver.ts. Every field is optional in a LAYER;
   the resolved EffectivePolicy fills all fields from platform defaults. */
export type ThinkingEffort = "low" | "medium" | "high";
export type BudgetClass = "S" | "M" | "L";
export type LanguageCode = "en" | "zh" | "ar";

export interface PolicyLayer {
  /** Module/action pairs the package NEEDS, same vocabulary as the Hub's
   *  existing grants ("HR:view", "Quotations:create"). Requested — the
   *  effective set is an intersection computed at turn time (ADR-008). */
  requestedPermissions?: string[];
  blastRadius?: BlastRadius;
  languages?: LanguageCode[];
  /** Reply-language behavior: "mirror" the user, or lock to one code. */
  replyLanguage?: "mirror" | LanguageCode;
  outputStyle?: string;
  /** 0..1 — below this retrieval confidence the answer must declare
   *  uncertainty instead of asserting (P8). */
  confidenceFloor?: number;
  refuseOutOfScope?: boolean;
  budgetClass?: BudgetClass;
  thinkingEffort?: ThinkingEffort;
  safetyRules?: string[];
}

/** Fully-resolved policy: no optional fields left. */
export type EffectivePolicy = Required<PolicyLayer>;

/* Merge semantics per field (ADR-009): safety-class fields take the MOST
   RESTRICTIVE value across layers; style-class fields take the MOST SPECIFIC
   (last layer that set them wins). Encoded as data so the resolver has no
   per-field special cases to drift. */
export const POLICY_FIELD_SEMANTICS: Record<keyof PolicyLayer, "restrictive" | "specific"> = {
  requestedPermissions: "restrictive", // intersection across layers
  blastRadius: "restrictive",          // lowest rank wins
  languages: "restrictive",            // intersection (empty ⇒ viability warning)
  replyLanguage: "specific",
  outputStyle: "specific",
  confidenceFloor: "restrictive",      // highest floor wins
  refuseOutOfScope: "restrictive",     // true wins
  budgetClass: "restrictive",          // smallest wins
  thinkingEffort: "specific",
  safetyRules: "restrictive",          // union across layers (more rules = more restrictive)
};

export const PLATFORM_DEFAULT_POLICY: EffectivePolicy = {
  requestedPermissions: [],
  blastRadius: "read",
  languages: ["en", "zh", "ar"],
  replyLanguage: "mirror",
  outputStyle: "professional, concise",
  confidenceFloor: 0.4,
  refuseOutOfScope: true,
  budgetClass: "S",
  thinkingEffort: "medium",
  safetyRules: [],
};

/* ── Knowledge scope (ADR-006) ───────────────────────────────────────────
   A dynamic predicate over KU metadata — never a folder, never an id list.
   Documents are not "placed in" a package; the package SELECTS. */
export interface KnowledgeScope {
  domains?: string[];
  kinds?: KnowledgeKind[];
  languages?: LanguageCode[];
  maxSensitivity?: KnowledgeSensitivity;
  tags?: string[];
}

export type KnowledgeKind = "fact" | "procedure" | "template" | "rubric";
export const SENSITIVITY_LEVELS = ["public", "internal", "confidential"] as const;
export type KnowledgeSensitivity = (typeof SENSITIVITY_LEVELS)[number];

/** KU metadata contract — the invariant object: unit of citation = unit of
 *  permission = unit of versioning (ADR-006). Content stores arrive Phase 1;
 *  the SHAPE is fixed now so Phase 1 projects it, not invents it. */
export interface KnowledgeUnitMeta {
  id: string;
  version: number;
  sourceId: string;
  pipelineVersion: string;
  kind: KnowledgeKind;
  languages: LanguageCode[];
  domains: string[];
  tags: string[];
  sensitivity: KnowledgeSensitivity;
  trustScore: number;    // 0..1
  validUntil: string | null; // ISO date; null = no expiry set (freshness)
  status: "draft" | "approved" | "retired";
  tenantId: string | null;   // null ⇔ platform-published tier (D1)
}

/* ── The Intelligence Package manifest (ADR-001/002) ────────────────────── */
export interface PackageManifest {
  id: string;
  version: string; // semver
  name: string;
  domain: string;
  audience: string;
  /** Single-parent inheritance, chain depth ≤ 3 (ADR-002). Child layers may
   *  only NARROW policy — enforced by the resolver, not by convention. */
  extends: string | null;
  mixins: string[]; // capability-bundle ids
  scope: KnowledgeScope;
  capabilities: CapabilityRef[];
  policy: PolicyLayer;
  /** Promotion gate reference (ADR-012). A package without one can never
   *  leave draft. */
  evaluationSetId: string | null;
  tenancy: "platform" | "tenant";
  tenantId: string | null;
}

export const MAX_INHERITANCE_DEPTH = 3;

/* ── The installed Instance (ADR-003/005) ───────────────────────────────── */
export interface LockfileEntry {
  capabilityId: string;
  /** EXACT version resolved at install/upgrade time. Turns run against
   *  this — never against "latest" (reproducibility, ADR-005). */
  version: string;
}

export interface PackageInstance {
  id: string;
  packageId: string;
  packageVersion: string;
  tenantId: string;
  /** Exact pins + a hash the evaluation gate binds to (ADR-012). */
  lockfile: LockfileEntry[];
  lockfileHash: string;
  /** Permissions the tenant admin consented to at install — the middle term
   *  of the intersection (ADR-008). */
  consentedPermissions: string[];
  installedAt: string;
  /** Previous lockfile retained ⇒ rollback is a restore, not a rebuild. */
  previousLockfileHash: string | null;
}

/* ── Memory tiers (ADR-007) ──────────────────────────────────────────────
   Declared here so the cap/tier rules are code, not tribal knowledge.
   NO automatic promotion between tiers, ever. */
export const MEMORY_TIERS = ["user", "instance", "org"] as const;
export type MemoryTier = (typeof MEMORY_TIERS)[number];

export const MEMORY_TIER_RULES: Record<MemoryTier, { maxEntries: number; writePath: "direct" | "review" }> = {
  user: { maxEntries: 50, writePath: "direct" },     // personal, user-erasable
  instance: { maxEntries: 200, writePath: "review" }, // curated domain learnings
  org: { maxEntries: 100, writePath: "review" },      // governance-approved conventions
};

/* ── Turn IR (ADR-011 / §12) ─────────────────────────────────────────────
   The model-agnostic representation adapters translate. Nothing upstream of
   the adapter may know a vendor name; nothing in the IR may be
   vendor-formatted. */
export interface TurnIR {
  system: {
    identity: string;        // who the expert is (from manifest Identity)
    policyDirectives: string[]; // rendered from EffectivePolicy
    procedures: string[];    // resolved procedure texts (locked versions)
  };
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  /** Evidence is DATA, never instructions (P4/§15) — kept structurally apart
   *  from system directives so injection cannot cross the boundary. */
  evidence: Array<{ kuId: string; kuVersion: number; content: string }>;
  toolSchemas: Array<{ name: string; description: string; parameters: unknown }>;
  responseContract: {
    /** When evidence is present, grounded claims must cite or the answer
     *  must declare uncertainty (§13.2). */
    citationsRequired: boolean;
    language: "mirror" | LanguageCode;
  };
  budget: { maxLlmTokens: number; maxSequentialHops: number; maxWallClockMs: number };
}

/** Budget classes → concrete meters (Appendix A · D4, provisional until
 *  telemetry hardens them). Hop cap encodes P9 on the measured ~1s network. */
export const BUDGETS: Record<BudgetClass, TurnIR["budget"]> = {
  S: { maxLlmTokens: 8_000, maxSequentialHops: 3, maxWallClockMs: 15_000 },
  M: { maxLlmTokens: 32_000, maxSequentialHops: 4, maxWallClockMs: 30_000 },
  L: { maxLlmTokens: 100_000, maxSequentialHops: 6, maxWallClockMs: 90_000 },
};
