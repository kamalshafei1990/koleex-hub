/* ===========================================================================
   Policy Resolver — ADR-009, executable.

   Merges policy layers in FIXED precedence order:

     platform defaults → parent chain (top-down) → package → tenant install
     overrides → per-turn narrowing

   No rules DSL, deliberately: every effective policy must be explainable as
   a five-layer diff, and the whole resolver must stay a pure function a test
   can hold in one hand. Per-field semantics come from POLICY_FIELD_SEMANTICS
   as data — "most restrictive wins" for safety-class fields, "most specific
   wins" (last writer) for style-class fields.

   The resolver also emits VIABILITY WARNINGS (R-10): five layers of
   narrowing can accidentally strip a package inert — all languages
   intersected away, every permission removed. That is surfaced to the
   consent screen, never silently shipped.

   Pure function. No I/O. Cacheable per (instance, user, lockfileHash).
   =========================================================================== */

import {
  BLAST_RADII,
  blastRadiusRank,
  PLATFORM_DEFAULT_POLICY,
  type BlastRadius,
  type BudgetClass,
  type EffectivePolicy,
  type PolicyLayer,
} from "./contracts";

export interface PolicyResolution {
  policy: EffectivePolicy;
  /** Human-readable viability warnings (R-10) — shown at install/consent. */
  warnings: string[];
  /** Which layer index decided each field — the "five-layer diff" that makes
   *  every effective policy explainable (ADR-009 advantage clause). */
  provenance: Record<keyof PolicyLayer, number>;
}

const BUDGET_ORDER: BudgetClass[] = ["S", "M", "L"];

function moreRestrictiveBlast(a: BlastRadius, b: BlastRadius): BlastRadius {
  return blastRadiusRank(a) <= blastRadiusRank(b) ? a : b;
}

/**
 * Resolve layers into one effective policy.
 *
 * @param layers ORDERED, least- to most-specific:
 *   [platformDefaults?, ...parentChainTopDown, package, installOverrides?, turnNarrowing?]
 *   The platform default layer is implicit — callers pass only the rest.
 */
export function resolveEffectivePolicy(layers: PolicyLayer[]): PolicyResolution {
  const warnings: string[] = [];
  const policy: EffectivePolicy = { ...PLATFORM_DEFAULT_POLICY };
  const provenance = Object.fromEntries(
    (Object.keys(PLATFORM_DEFAULT_POLICY) as Array<keyof PolicyLayer>).map((k) => [k, -1]),
  ) as Record<keyof PolicyLayer, number>;

  layers.forEach((layer, i) => {
    /* requestedPermissions — restrictive: INTERSECTION once any layer has
       constrained it; the first layer to set it establishes the universe.
       (A later layer can only remove, never add — the narrowing rule of
       ADR-002 made mechanical.) */
    if (layer.requestedPermissions !== undefined) {
      policy.requestedPermissions =
        provenance.requestedPermissions === -1
          ? [...layer.requestedPermissions]
          : policy.requestedPermissions.filter((p) => layer.requestedPermissions!.includes(p));
      provenance.requestedPermissions = i;
    }

    if (layer.blastRadius !== undefined) {
      const next =
        provenance.blastRadius === -1
          ? layer.blastRadius
          : moreRestrictiveBlast(policy.blastRadius, layer.blastRadius);
      if (provenance.blastRadius !== -1 && blastRadiusRank(layer.blastRadius) > blastRadiusRank(policy.blastRadius)) {
        warnings.push(
          `Layer ${i} tried to WIDEN blast radius to "${layer.blastRadius}" — ignored; children may only narrow (ADR-002).`,
        );
      }
      policy.blastRadius = next;
      provenance.blastRadius = i;
    }

    if (layer.languages !== undefined) {
      policy.languages =
        provenance.languages === -1
          ? [...layer.languages]
          : policy.languages.filter((l) => layer.languages!.includes(l));
      provenance.languages = i;
    }

    if (layer.replyLanguage !== undefined) { policy.replyLanguage = layer.replyLanguage; provenance.replyLanguage = i; }
    if (layer.outputStyle !== undefined) { policy.outputStyle = layer.outputStyle; provenance.outputStyle = i; }

    if (layer.confidenceFloor !== undefined) {
      policy.confidenceFloor = Math.max(policy.confidenceFloor, layer.confidenceFloor);
      provenance.confidenceFloor = i;
    }

    if (layer.refuseOutOfScope !== undefined) {
      policy.refuseOutOfScope = policy.refuseOutOfScope || layer.refuseOutOfScope;
      provenance.refuseOutOfScope = i;
    }

    if (layer.budgetClass !== undefined) {
      const cur = BUDGET_ORDER.indexOf(policy.budgetClass);
      const next = BUDGET_ORDER.indexOf(layer.budgetClass);
      policy.budgetClass = provenance.budgetClass === -1
        ? layer.budgetClass
        : BUDGET_ORDER[Math.min(cur, next)];
      provenance.budgetClass = i;
    }

    if (layer.thinkingEffort !== undefined) { policy.thinkingEffort = layer.thinkingEffort; provenance.thinkingEffort = i; }

    if (layer.safetyRules !== undefined) {
      policy.safetyRules = [...new Set([...policy.safetyRules, ...layer.safetyRules])];
      provenance.safetyRules = i;
    }
  });

  /* ── Viability (R-10): warn when narrowing produced an inert package ── */
  if (policy.languages.length === 0) {
    warnings.push("Language intersection is EMPTY — the package cannot answer in any language.");
  }
  if (
    provenance.requestedPermissions !== -1 &&
    policy.requestedPermissions.length === 0 &&
    blastRadiusRank(policy.blastRadius) > blastRadiusRank(BLAST_RADII[0])
  ) {
    warnings.push(
      `Blast radius is "${policy.blastRadius}" but every requested permission was stripped — the package can act on nothing.`,
    );
  }
  if (policy.confidenceFloor >= 0.95) {
    warnings.push(
      `Confidence floor ${policy.confidenceFloor} will refuse nearly every grounded answer — likely an over-narrowed merge.`,
    );
  }

  return { policy, warnings, provenance };
}
