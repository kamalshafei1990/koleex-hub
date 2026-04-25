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
import { INTERLOCK_FAMILY_FIELDS } from "./families/interlock";
import { DOUBLE_NEEDLE_FAMILY_FIELDS } from "./families/double-needle";
import { CHAINSTITCH_FAMILY_FIELDS } from "./families/chainstitch";
import { MULTI_NEEDLE_FAMILY_FIELDS } from "./families/multi-needle";
import { PATTERN_SEWING_FAMILY_FIELDS } from "./families/pattern-sewing";

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
import { OVERLOCK_GATHERING_FIELDS } from "./kinds/overlock/gathering";
import { OVERLOCK_ELASTIC_TAPE_FIELDS } from "./kinds/overlock/elastic-tape";
import { OVERLOCK_GLOVE_FIELDS } from "./kinds/overlock/glove";
import { OVERLOCK_AUTO_COLLAR_STATION_FIELDS } from "./kinds/overlock/auto-collar-station";
import { OVERLOCK_TOWEL_FIELDS } from "./kinds/overlock/towel";

// Kind extras (Tier 3) — Interlock
import { INTERLOCK_CYLINDER_BED_FIELDS } from "./kinds/interlock/cylinder-bed";
import { INTERLOCK_FEED_OFF_ARM_FIELDS } from "./kinds/interlock/feed-off-arm";
import { INTERLOCK_FLATLOCK_FIELDS } from "./kinds/interlock/flatlock";
import { INTERLOCK_RIB_BINDING_FIELDS } from "./kinds/interlock/rib-binding";
import { INTERLOCK_ELASTIC_ATTACH_FIELDS } from "./kinds/interlock/elastic-attach";
import { INTERLOCK_TAPE_BINDING_FIELDS } from "./kinds/interlock/tape-binding";

// Kind extras (Tier 3) — Double Needle (only NEW field shape;
// geometric variants reuse lockstitch extras, see KIND_EXTRAS below)
import { DOUBLE_NEEDLE_CHAINSTITCH_FIELDS } from "./kinds/double-needle/chainstitch";

// Kind extras (Tier 3) — Multi-Needle (NEW field shapes only;
// geometric variants reuse lockstitch extras, see KIND_EXTRAS below)
import { MULTI_NEEDLE_QUILTING_FIELDS } from "./kinds/multi-needle/quilting";
import { MULTI_NEEDLE_PICOT_FAGOTING_FIELDS } from "./kinds/multi-needle/picot-fagoting";

// Kind extras (Tier 3) — Pattern Sewing
import { POCKET_WELT_FIELDS } from "./kinds/pattern-sewing/pocket-welt";
import { DART_SEWER_FIELDS } from "./kinds/pattern-sewing/dart-sewer";
import { BELT_LOOP_FIELDS } from "./kinds/pattern-sewing/belt-loop";
import { VISION_FIELDS } from "./kinds/pattern-sewing/vision";
import { TEMPLATE_FIELDS } from "./kinds/pattern-sewing/template";
import { TACKING_FIELDS } from "./kinds/pattern-sewing/tacking";

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
  "interlock-machines": {
    title: "Coverstitch / Flatlock Basics",
    subtitle: "Core specs shared by every coverstitch / flatlock kind.",
    fields: INTERLOCK_FAMILY_FIELDS,
  },
  "double-needle-machines": {
    title: "Double Needle Basics",
    subtitle: "Twin-needle specs shared across every double-needle kind.",
    fields: DOUBLE_NEEDLE_FAMILY_FIELDS,
  },
  "chainstitch-machines": {
    title: "Chainstitch Basics",
    subtitle: "Core specs shared across every chainstitch kind (Class 101 / 401).",
    fields: CHAINSTITCH_FAMILY_FIELDS,
  },
  "multi-needle-machines": {
    title: "Multi-Needle Basics",
    subtitle: "Specs shared across 3+ needle heads (chainstitch / coverstitch / quilting).",
    fields: MULTI_NEEDLE_FAMILY_FIELDS,
  },
  "pattern-sewing-machines": {
    title: "Pattern Sewing Basics",
    subtitle: "Programmable XY pattern stitchers — work area + programming + drive specs.",
    fields: PATTERN_SEWING_FAMILY_FIELDS,
  },
  // Future: heavy-duty-machines, special-machines, plus the cycle
  // machines (buttonhole / bartack / button-attach) which need
  // their own families.
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
  "overlock-gathering": {
    title: "Gathering Mechanism",
    subtitle: "Ratio range + foot type for the ruffling attachment.",
    fields: OVERLOCK_GATHERING_FIELDS,
  },
  "overlock-elastic-tape": {
    title: "Tape Feeder",
    subtitle: "Tape width, stretch ratio + tension control for elastic / binding tape.",
    fields: OVERLOCK_ELASTIC_TAPE_FIELDS,
  },
  "overlock-glove": {
    title: "Glove Specifics",
    subtitle: "Tiny-cylinder geometry for finger-seam glove construction.",
    fields: OVERLOCK_GLOVE_FIELDS,
  },
  "overlock-auto-collar-station": {
    title: "Auto Station",
    subtitle: "Cycle envelope, programmable patterns + automation specs.",
    fields: OVERLOCK_AUTO_COLLAR_STATION_FIELDS,
  },
  "overlock-towel": {
    title: "Towel Specifics",
    subtitle: "Dust extraction + loop-pile handling for terry / fleece work.",
    fields: OVERLOCK_TOWEL_FIELDS,
  },

  // ── Interlock / Coverstitch ───────────────────────────────
  "interlock-cylinder-bed": {
    title: "Cylinder Bed Geometry",
    subtitle: "Tubular-arm dimensions for cuffs, neckbands, sleeve openings.",
    fields: INTERLOCK_CYLINDER_BED_FIELDS,
  },
  "interlock-feed-off-arm": {
    title: "Feed-Off-Arm Geometry",
    subtitle: "Narrow-arm specifics for tubular hems + side-seam joining.",
    fields: INTERLOCK_FEED_OFF_ARM_FIELDS,
  },
  "interlock-top-bottom-coverstitch": {
    title: "Flatlock Top Cover",
    subtitle: "Top spreader + decorative cover specifics that make this kind a flatlock.",
    fields: INTERLOCK_FLATLOCK_FIELDS,
  },
  "interlock-rib-binding": {
    title: "Rib-Tape Feeder",
    subtitle: "Tape feeder geometry for rib-knit neck + armhole binding.",
    fields: INTERLOCK_RIB_BINDING_FIELDS,
  },
  "interlock-elastic-attach": {
    title: "Elastic Feeder",
    subtitle: "Elastic feeder mechanism for swimwear / underwear waistbands.",
    fields: INTERLOCK_ELASTIC_ATTACH_FIELDS,
  },
  "interlock-tape-binding": {
    title: "Binding Folder",
    subtitle: "Folder geometry for flat-tape binding (T-shirt necks, lingerie trims).",
    fields: INTERLOCK_TAPE_BINDING_FIELDS,
  },

  // ── Double Needle ──────────────────────────────────────────
  // Geometric variants REUSE the lockstitch geometry extras —
  // walking-foot / long-arm / cylinder-bed / post-bed / feed-off-arm
  // are the same physical mechanism whether one or two needles ride
  // on top. The dn_needle_distance field already tells you how far
  // apart the twin needles sit.
  "dn-walking-foot": {
    title: "Walking-Foot Mechanism",
    subtitle: "Compound / triple-feed specifics for the twin-needle walking-foot head.",
    fields: WALKING_FOOT_FIELDS,
  },
  "dn-long-arm": {
    title: "Long-Arm Geometry",
    subtitle: "Extended reach for oversized twin-needle work.",
    fields: LONG_ARM_FIELDS,
  },
  "dn-cylinder-bed": {
    title: "Cylinder Bed Geometry",
    subtitle: "Tubular-arm dimensions for luggage, footwear, saddlery double-row stitching.",
    fields: CYLINDER_BED_FIELDS,
  },
  "dn-post-bed": {
    title: "Post-Bed Geometry",
    subtitle: "Vertical post dimensions for 3D twin-needle work (shoes, caps, bags).",
    fields: POST_BED_FIELDS,
  },
  "dn-feed-off-arm": {
    title: "Feed-Off-Arm Geometry",
    subtitle: "Narrow-arm specifics for jeans inseam double topstitch.",
    fields: FEED_OFF_ARM_FIELDS,
  },
  "dn-heavy-duty": {
    title: "Heavy-Duty Capacity",
    subtitle: "Reinforced build for leather, canvas, and webbing twin-needle work.",
    fields: HEAVY_DUTY_FIELDS,
  },
  "dn-chainstitch": {
    title: "Chainstitch Geometry",
    subtitle: "Two-row chainstitch specifics — looper count, stitch length, per-needle tension.",
    fields: DOUBLE_NEEDLE_CHAINSTITCH_FIELDS,
  },
  // dn-lockstitch-fixed / dn-lockstitch-split / dn-needle-feed
  // inherit Common + Family only — the dn_needle_bar_type field on
  // the family card fully captures the fixed / split distinction.

  // ── Chainstitch ────────────────────────────────────────────
  // All geometric variants reuse the lockstitch extras directly —
  // the underlying mechanism (walking-foot kinematics, long-arm
  // throat depth, cylinder dimensions) is identical regardless of
  // stitch class. The cs_thread_class family field already encodes
  // the chain-stitch lineage.
  "chainstitch-cylinder-bed": {
    title: "Cylinder Bed Geometry",
    subtitle: "Tubular-arm dimensions for tubular chainstitch work.",
    fields: CYLINDER_BED_FIELDS,
  },
  "chainstitch-post-bed": {
    title: "Post-Bed Geometry",
    subtitle: "Vertical post dimensions for 3D chainstitch work.",
    fields: POST_BED_FIELDS,
  },
  "chainstitch-long-arm": {
    title: "Long-Arm Geometry",
    subtitle: "Extended reach for oversized chainstitch work.",
    fields: LONG_ARM_FIELDS,
  },
  "chainstitch-feed-off-arm": {
    title: "Feed-Off-Arm Geometry",
    subtitle: "Narrow-arm specifics for tubular chainstitch hems.",
    fields: FEED_OFF_ARM_FIELDS,
  },
  "chainstitch-heavy-duty": {
    title: "Heavy-Duty Capacity",
    subtitle: "Reinforced chainstitch build for jeans / canvas / webbing.",
    fields: HEAVY_DUTY_FIELDS,
  },
  // chainstitch-single-needle / chainstitch-double-needle /
  // chainstitch-multi-needle inherit Common + Family only — the
  // family card already captures needle count + stitch class.

  // ── Multi-Needle ──────────────────────────────────────────
  "mn-quilting": {
    title: "Quilting Panel",
    subtitle: "Panel area, layer stack + pattern memory for industrial panel quilting.",
    fields: MULTI_NEEDLE_QUILTING_FIELDS,
  },
  "mn-picot-fagoting": {
    title: "Decorative Specifics",
    subtitle: "Picot loop / fagoting gap dimensions for openwork heads.",
    fields: MULTI_NEEDLE_PICOT_FAGOTING_FIELDS,
  },
  "mn-elastic-attach": {
    title: "Elastic Feeder",
    subtitle: "Elastic-feeder geometry — reused from the interlock family.",
    fields: INTERLOCK_ELASTIC_ATTACH_FIELDS,
  },
  // mn-3-chain / mn-4-chain / mn-multi-chain / mn-coverstitch /
  // mn-lockstitch inherit Common + Family only — the family card
  // (needle count + gauge + stitch class) covers them.

  // ── Pattern Sewing ────────────────────────────────────────
  // pattern-pocket-welt-single + pattern-pocket-welt-double share
  // the same pocket-welt field shape (the difference is just one
  // welt vs two parallel welts — both registered to the same set).
  "pattern-pocket-welt-single": {
    title: "Pocket Welt Station",
    subtitle: "Welt + corner-knife specifics for single-welt jetted pockets.",
    fields: POCKET_WELT_FIELDS,
  },
  "pattern-pocket-welt-double": {
    title: "Pocket Welt Station",
    subtitle: "Welt + corner-knife specifics for double-welt jetted pockets.",
    fields: POCKET_WELT_FIELDS,
  },
  "pattern-dart-sewer": {
    title: "Dart Station",
    subtitle: "Taper geometry + auto-trim specifics for the dart-sewing cycle.",
    fields: DART_SEWER_FIELDS,
  },
  "pattern-belt-loop": {
    title: "Belt Loop Station",
    subtitle: "Loop length range + production rate for auto belt-loop attaching.",
    fields: BELT_LOOP_FIELDS,
  },
  "pattern-vision": {
    title: "Vision System",
    subtitle: "Camera resolution + recognition specifics for vision-guided pattern sewing.",
    fields: VISION_FIELDS,
  },
  "pattern-template": {
    title: "Template System",
    subtitle: "Template count + swap mechanism for template-based pattern sewing.",
    fields: TEMPLATE_FIELDS,
  },
  "pattern-tacking": {
    title: "Tacking Station",
    subtitle: "Programmable tack length / width / pattern count.",
    fields: TACKING_FIELDS,
  },
  // pattern-small-area / pattern-medium-area / pattern-large-area /
  // pattern-xxl-long-arm / pattern-auto-sleeve-setter /
  // pattern-auto-waistband / pattern-label-patch inherit Common +
  // Family only — the work-area + programming family fields cover
  // them.
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
