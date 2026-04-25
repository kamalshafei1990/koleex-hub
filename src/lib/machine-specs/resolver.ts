/* ---------------------------------------------------------------------------
   Machine-Specs Resolver

   Given a subcategory slug + machine-kind slug, returns the stack of
   SpecCards the form should render:

       [ CommonCard, FamilyCard, (optional) KindCard ]

   The resolver is the ONLY place that knows the three-tier layering —
   consumers (SewingMachineSection) just render whatever cards it
   hands back, in order. Adding a new family or kind = adding a file
   under families/ or kinds/ and one line in the family / kind maps
   below.

   Back-compat: for subcategories that don't yet have a new-style
   family module (overlock, interlock, etc., until we port them),
   the resolver returns `null` and the caller falls back to the old
   `sewing-machine-templates.ts` rendering. Lets us migrate one
   family at a time without breaking existing products.
   --------------------------------------------------------------------------- */

import type { SpecCard, SpecField, ResolvedSpecs } from "./types";
import { COMMON_FIELDS } from "./common";

// Families (Tier 2)
import { LOCKSTITCH_FAMILY_FIELDS } from "./families/lockstitch";
import { OVERLOCK_FAMILY_FIELDS } from "./families/overlock";

// Kind extras (Tier 3) — Lockstitch
import { WALKING_FOOT_FIELDS } from "./kinds/lockstitch/walking-foot";
import { LONG_ARM_FIELDS } from "./kinds/lockstitch/long-arm";
import { CYLINDER_BED_FIELDS } from "./kinds/lockstitch/cylinder-bed";
import { POST_BED_FIELDS } from "./kinds/lockstitch/post-bed";
import { FEED_OFF_ARM_FIELDS } from "./kinds/lockstitch/feed-off-arm";
import { ZIGZAG_FIELDS } from "./kinds/lockstitch/zigzag";
import { EDGE_TRIMMER_FIELDS } from "./kinds/lockstitch/edge-trimmer";
import { HEAVY_DUTY_FIELDS } from "./kinds/lockstitch/heavy-duty";

// Kind extras (Tier 3) — Overlock
import { ROLLED_HEM_FIELDS } from "./kinds/overlock/rolled-hem";
import { VARIABLE_TOP_FEED_FIELDS } from "./kinds/overlock/variable-top-feed";
import { OVERLOCK_CYLINDER_BED_FIELDS } from "./kinds/overlock/cylinder-bed";
import { OVERLOCK_HEAVY_DUTY_FIELDS } from "./kinds/overlock/heavy-duty";
import { OVERLOCK_SAFETY_STITCH_FIELDS } from "./kinds/overlock/safety-stitch";

/* ═══════════════════════════════════════════════════════════════════════════
   Family registry
   ───────────────────────────────────────────────────────────────────────────
   Maps a subcategory slug to the family tier-2 spec set + card copy.
   Subcategories not listed here fall back to the legacy template
   system — the resolver returns null and the caller handles it.
   ═══════════════════════════════════════════════════════════════════════════ */

interface FamilyDef {
  title: string;
  subtitle: string;
  fields: SpecField[];
}

const FAMILIES: Record<string, FamilyDef> = {
  "lockstitch-machines": {
    title: "Lockstitch Basics",
    subtitle: "Core specs shared by every lockstitch kind.",
    fields: LOCKSTITCH_FAMILY_FIELDS,
  },
  "overlock-machines": {
    title: "Overlock Basics",
    subtitle: "Core specs shared by every overlock / serger kind.",
    fields: OVERLOCK_FAMILY_FIELDS,
  },
  // Future: interlock-machines, chainstitch-machines,
  // double-needle-machines, multi-needle-machines, pattern-sewing-machines,
  // heavy-duty-machines, special-machines.
};

/* ═══════════════════════════════════════════════════════════════════════════
   Kind-extras registry
   ───────────────────────────────────────────────────────────────────────────
   Maps a kind slug to its tier-3 extra fields. Only kinds with
   specifics appear here — standard / direct-drive / needle-feed /
   top-and-bottom inherit Common + Family only.
   ═══════════════════════════════════════════════════════════════════════════ */

interface KindExtrasDef {
  title: string;
  subtitle: string;
  fields: SpecField[];
}

const KIND_EXTRAS: Record<string, KindExtrasDef> = {
  // ── Lockstitch ────────────────────────────────────────────
  "lockstitch-walking-foot": {
    title: "Walking-Foot Mechanism",
    subtitle: "Compound / triple-feed specifics unique to walking-foot lockstitch.",
    fields: WALKING_FOOT_FIELDS,
  },
  "lockstitch-long-arm": {
    title: "Long-Arm Geometry",
    subtitle: "Extended reach specs for oversized work.",
    fields: LONG_ARM_FIELDS,
  },
  "lockstitch-cylinder-bed": {
    title: "Cylinder Bed Geometry",
    subtitle: "Tubular-arm dimensions for cuffs, sleeves, small leather goods.",
    fields: CYLINDER_BED_FIELDS,
  },
  "lockstitch-post-bed": {
    title: "Post-Bed Geometry",
    subtitle: "Vertical post dimensions for 3D curved work (shoes, caps, bags).",
    fields: POST_BED_FIELDS,
  },
  "lockstitch-feed-off-arm": {
    title: "Feed-Off-Arm Geometry",
    subtitle: "Narrow-arm specifics for jeans inseams + tubular side-seams.",
    fields: FEED_OFF_ARM_FIELDS,
  },
  "lockstitch-zigzag": {
    title: "Zig-Zag Stitch",
    subtitle: "Width + pattern specs for the zigzag swing.",
    fields: ZIGZAG_FIELDS,
  },
  "lockstitch-edge-trimmer": {
    title: "Edge Trimmer",
    subtitle: "Knife type + cutting width for the integrated edge trimmer.",
    fields: EDGE_TRIMMER_FIELDS,
  },
  "lockstitch-heavy-duty": {
    title: "Heavy-Duty Capacity",
    subtitle: "Max thread + material thickness — what makes this machine heavy-duty.",
    fields: HEAVY_DUTY_FIELDS,
  },

  // ── Overlock ──────────────────────────────────────────────
  "overlock-rolled-hem": {
    title: "Rolled-Hem Specifics",
    subtitle: "Tongue + plate dimensions for the narrow rolled-hem head.",
    fields: ROLLED_HEM_FIELDS,
  },
  "overlock-variable-top-feed": {
    title: "Variable Top-Feed",
    subtitle: "Adjustable top-feed travel + ratio for clean knit-fabric seaming.",
    fields: VARIABLE_TOP_FEED_FIELDS,
  },
  "overlock-cylinder-bed": {
    title: "Cylinder Bed Geometry",
    subtitle: "Tubular-arm dimensions for cuffs, socks, gloves.",
    fields: OVERLOCK_CYLINDER_BED_FIELDS,
  },
  "overlock-heavy-duty": {
    title: "Heavy-Duty Capacity",
    subtitle: "Max thread + material thickness for jeans / canvas / upholstery.",
    fields: OVERLOCK_HEAVY_DUTY_FIELDS,
  },
  "overlock-5t-safety": {
    title: "Safety-Stitch Geometry",
    subtitle: "Chain-stitch gauge + length unique to 5-thread safety heads.",
    fields: OVERLOCK_SAFETY_STITCH_FIELDS,
  },
  // Standard kinds (1n-2t, 1n-3t, 2n-4t) inherit Common + Family only.
};

/* ═══════════════════════════════════════════════════════════════════════════
   Resolver entry point
   ═══════════════════════════════════════════════════════════════════════════ */

/** Look up the composed spec cards for a given subcategory + kind.
 *  Returns null if the subcategory has no registered family — the
 *  caller should then fall back to the legacy template system. */
export function resolveSpecs(
  subcategorySlug: string | null | undefined,
  kindSlug: string | null | undefined,
): ResolvedSpecs | null {
  if (!subcategorySlug) return null;
  const family = FAMILIES[subcategorySlug];
  if (!family) return null;

  const cards: SpecCard[] = [
    {
      title: "Universal Specs",
      subtitle: "Fields shared across every sewing machine in the catalog.",
      source: "common",
      fields: COMMON_FIELDS,
    },
    {
      title: family.title,
      subtitle: family.subtitle,
      source: "family",
      fields: family.fields,
    },
  ];

  const extras = kindSlug ? KIND_EXTRAS[kindSlug] : null;
  if (extras) {
    cards.push({
      title: extras.title,
      subtitle: extras.subtitle,
      source: "kind",
      fields: extras.fields,
    });
  }

  const fieldIndex: Record<string, SpecField> = {};
  for (const c of cards) {
    for (const f of c.fields) {
      fieldIndex[f.key] = f;
    }
  }

  return { cards, fieldIndex };
}

/** Is this subcategory wired to the new three-tier system? Used by
 *  SewingMachineSection to decide whether to render the new layout
 *  or fall back to the legacy template flow. */
export function hasNewSpecSystem(subcategorySlug: string | null | undefined): boolean {
  if (!subcategorySlug) return false;
  return subcategorySlug in FAMILIES;
}
