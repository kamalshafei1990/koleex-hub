/* ---------------------------------------------------------------------------
   Machine Kinds catalog
   ---------------------------------------------------------------------------

   The Machine Type step in the product builder asks the admin to
   pick the SPECIFIC kind of industrial sewing machine they are
   cataloguing — not just the subcategory.

   Subcategory → Kind relationship:
     · "lockstitch-machines"  → ~10 kinds (walking foot, needle feed,
                                 long arm, cylinder bed, post bed, ...)
     · "overlock-machines"    → ~8 kinds (3-thread, 4-thread, 5-thread
                                 safety, rolled hem, ...)
     · ...

   Each kind carries:
     · `slug`         — stable identifier persisted in
                        `product_sewing_specs.common_specs.machine_kind`
     · `name`         — display label
     · `description`  — one-line summary shown on the picker card
     · `subcategory`  — the subcategory slug this kind belongs to
                        (a kind belongs to exactly one subcategory to
                        keep the picker clean; if a kind logically
                        fits two subcategories, duplicate with a
                        suffixed slug)
     · `icon`         — React component rendering the schematic icon
     · `templateSlug` — which entry in SEWING_MACHINE_TEMPLATES
                        drives the spec fields for this kind. A kind
                        always maps to exactly one template so the
                        downstream spec form doesn't need to change.

   Adding a new kind: append to MACHINE_KINDS with a unique slug.
   Adding a new subcategory: add kinds with that subcategory slug
   and (optionally) add a new template in sewing-machine-templates.ts
   if the spec shape is genuinely different.
   --------------------------------------------------------------------------- */

import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from "react";

import FlatBedMachineIcon from "@/components/icons/machine-kinds/FlatBedMachineIcon";
import CylinderBedMachineIcon from "@/components/icons/machine-kinds/CylinderBedMachineIcon";
import PostBedMachineIcon from "@/components/icons/machine-kinds/PostBedMachineIcon";
import LongArmMachineIcon from "@/components/icons/machine-kinds/LongArmMachineIcon";
import FeedOffArmMachineIcon from "@/components/icons/machine-kinds/FeedOffArmMachineIcon";
import DoubleNeedleIcon from "@/components/icons/machine-kinds/DoubleNeedleIcon";
import MultiNeedleIcon from "@/components/icons/machine-kinds/MultiNeedleIcon";
import OverlockMachineIcon from "@/components/icons/machine-kinds/OverlockMachineIcon";
import CoverstitchIcon from "@/components/icons/machine-kinds/CoverstitchIcon";
import ChainstitchIcon from "@/components/icons/machine-kinds/ChainstitchIcon";
import ButtonholeMachineIcon from "@/components/icons/machine-kinds/ButtonholeMachineIcon";
import ButtonAttachIcon from "@/components/icons/machine-kinds/ButtonAttachIcon";
import BartackIcon from "@/components/icons/machine-kinds/BartackIcon";
import ZigzagMachineIcon from "@/components/icons/machine-kinds/ZigzagMachineIcon";
import BlindstitchIcon from "@/components/icons/machine-kinds/BlindstitchIcon";
import PatternSewerIcon from "@/components/icons/machine-kinds/PatternSewerIcon";
import HeavyDutyMachineIcon from "@/components/icons/machine-kinds/HeavyDutyMachineIcon";
import WalkingFootMachineIcon from "@/components/icons/machine-kinds/WalkingFootMachineIcon";
import AutomaticMachineIcon from "@/components/icons/machine-kinds/AutomaticMachineIcon";
import SafetyStitchIcon from "@/components/icons/machine-kinds/SafetyStitchIcon";
import SpecialMachineIcon from "@/components/icons/machine-kinds/SpecialMachineIcon";

/* Icon component signature used by the picker. Both forwardRef
   components and plain stateless SVG components satisfy this. */
export type MachineKindIcon = ForwardRefExoticComponent<
  { size?: number | string; className?: string; style?: React.CSSProperties } &
    Omit<SVGProps<SVGSVGElement>, "ref">
  > extends infer T
  ? T
  : never;

export interface MachineKind {
  slug: string;
  name: string;
  description: string;
  subcategory: string;
  templateSlug: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any; // React component — kept loose so both styles work
}

/* ═══════════════════════════════════════════════════════════════════════════
   Lockstitch Machines
   Subcategory slug: lockstitch-machines
   Template: single-needle-lockstitch
   ═══════════════════════════════════════════════════════════════════════════ */

const LOCKSTITCH_KINDS: MachineKind[] = [
  {
    slug: "lockstitch-standard",
    name: "Standard Single Needle Lockstitch",
    description: "Classic flat-bed SNLS for general-purpose garment sewing.",
    subcategory: "lockstitch-machines",
    templateSlug: "single-needle-lockstitch",
    icon: FlatBedMachineIcon,
  },
  {
    slug: "lockstitch-direct-drive",
    name: "Direct-Drive Electronic Lockstitch",
    description: "Servo-motor direct-drive head with auto trimmer / back tack.",
    subcategory: "lockstitch-machines",
    templateSlug: "single-needle-lockstitch",
    icon: FlatBedMachineIcon,
  },
  {
    slug: "lockstitch-needle-feed",
    name: "Needle-Feed Lockstitch",
    description: "Needle moves with the feed dog — accurate on slippery fabrics.",
    subcategory: "lockstitch-machines",
    templateSlug: "single-needle-lockstitch",
    icon: FlatBedMachineIcon,
  },
  {
    slug: "lockstitch-walking-foot",
    name: "Walking-Foot Lockstitch",
    description: "Compound feed — keeps multi-layer material from shifting.",
    subcategory: "lockstitch-machines",
    templateSlug: "single-needle-lockstitch",
    icon: WalkingFootMachineIcon,
  },
  {
    slug: "lockstitch-top-bottom-feed",
    name: "Top-and-Bottom Feed Lockstitch",
    description: "Two feed sources pull cleanly through dense seams.",
    subcategory: "lockstitch-machines",
    templateSlug: "single-needle-lockstitch",
    icon: WalkingFootMachineIcon,
  },
  {
    slug: "lockstitch-long-arm",
    name: "Long-Arm Lockstitch",
    description: "Extended throat (600–900 mm) for oversized work.",
    subcategory: "lockstitch-machines",
    templateSlug: "single-needle-lockstitch",
    icon: LongArmMachineIcon,
  },
  {
    slug: "lockstitch-cylinder-bed",
    name: "Cylinder-Bed Lockstitch",
    description: "Narrow cylinder arm for tubular work (cuffs, sleeves).",
    subcategory: "lockstitch-machines",
    templateSlug: "single-needle-lockstitch",
    icon: CylinderBedMachineIcon,
  },
  {
    slug: "lockstitch-post-bed",
    name: "Post-Bed Lockstitch",
    description: "Vertical post head — shoes, caps, structured 3D goods.",
    subcategory: "lockstitch-machines",
    templateSlug: "single-needle-lockstitch",
    icon: PostBedMachineIcon,
  },
  {
    slug: "lockstitch-feed-off-arm",
    name: "Feed-Off-the-Arm Lockstitch",
    description: "Narrow side-exiting arm — jeans inseams, shirt side seams.",
    subcategory: "lockstitch-machines",
    templateSlug: "single-needle-lockstitch",
    icon: FeedOffArmMachineIcon,
  },
  {
    slug: "lockstitch-zigzag",
    name: "Zig-Zag Lockstitch",
    description: "Lockstitch head with a zigzag swing for elastic / decorative seams.",
    subcategory: "lockstitch-machines",
    templateSlug: "single-needle-lockstitch",
    icon: ZigzagMachineIcon,
  },
  {
    slug: "lockstitch-edge-trimmer",
    name: "Lockstitch with Edge Trimmer",
    description: "Integrated knife trims the excess fabric as you sew.",
    subcategory: "lockstitch-machines",
    templateSlug: "single-needle-lockstitch",
    icon: FlatBedMachineIcon,
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   Overlock Machines
   Subcategory slug: overlock-machines
   Template: overlock
   ═══════════════════════════════════════════════════════════════════════════ */

const OVERLOCK_KINDS: MachineKind[] = [
  {
    slug: "overlock-1n-2t",
    name: "1-Needle 2-Thread Overlock",
    description: "Lightweight overedge for lingerie and delicate fabrics.",
    subcategory: "overlock-machines",
    templateSlug: "overlock",
    icon: OverlockMachineIcon,
  },
  {
    slug: "overlock-1n-3t",
    name: "1-Needle 3-Thread Overlock",
    description: "Standard edge-wrapping for light-to-medium fabrics.",
    subcategory: "overlock-machines",
    templateSlug: "overlock",
    icon: OverlockMachineIcon,
  },
  {
    slug: "overlock-2n-4t",
    name: "2-Needle 4-Thread Overlock",
    description: "The production workhorse — secure overedge for most garments.",
    subcategory: "overlock-machines",
    templateSlug: "overlock",
    icon: OverlockMachineIcon,
  },
  {
    slug: "overlock-5t-safety",
    name: "5-Thread Safety-Stitch Overlock",
    description: "Overlock + chainstitch in one pass — high-strength seam.",
    subcategory: "overlock-machines",
    templateSlug: "overlock",
    icon: SafetyStitchIcon,
  },
  {
    slug: "overlock-rolled-hem",
    name: "Rolled-Hem Overlock",
    description: "Narrow rolled hem for chiffon, silk, and scarves.",
    subcategory: "overlock-machines",
    templateSlug: "overlock",
    icon: OverlockMachineIcon,
  },
  {
    slug: "overlock-variable-top-feed",
    name: "Variable Top-Feed Overlock",
    description: "Adjustable top feed — handles stretchy knit fabrics cleanly.",
    subcategory: "overlock-machines",
    templateSlug: "overlock",
    icon: OverlockMachineIcon,
  },
  {
    slug: "overlock-cylinder-bed",
    name: "Cylinder-Bed Overlock",
    description: "Tubular overlock for small round parts (socks, gloves).",
    subcategory: "overlock-machines",
    templateSlug: "overlock",
    icon: CylinderBedMachineIcon,
  },
  {
    slug: "overlock-heavy-duty",
    name: "Heavy-Duty Overlock",
    description: "Reinforced overlock for jeans, canvas, and dense seams.",
    subcategory: "overlock-machines",
    templateSlug: "overlock",
    icon: HeavyDutyMachineIcon,
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   Interlock Machines (flatlock / coverstitch family)
   Subcategory slug: interlock-machines
   Template: flatlock-interlock
   ═══════════════════════════════════════════════════════════════════════════ */

const INTERLOCK_KINDS: MachineKind[] = [
  {
    slug: "interlock-2n-coverstitch",
    name: "2-Needle Coverstitch",
    description: "Two parallel top stitches — hemming, binding, T-shirt finish.",
    subcategory: "interlock-machines",
    templateSlug: "flatlock-interlock",
    icon: CoverstitchIcon,
  },
  {
    slug: "interlock-3n-coverstitch",
    name: "3-Needle Coverstitch",
    description: "Three parallel top stitches — stronger, wider cover seam.",
    subcategory: "interlock-machines",
    templateSlug: "flatlock-interlock",
    icon: CoverstitchIcon,
  },
  {
    slug: "interlock-top-bottom-coverstitch",
    name: "Top-and-Bottom Coverstitch (Flatlock)",
    description: "Cover stitch on both faces — sportswear seams and joining.",
    subcategory: "interlock-machines",
    templateSlug: "flatlock-interlock",
    icon: CoverstitchIcon,
  },
  {
    slug: "interlock-cylinder-bed",
    name: "Cylinder-Bed Coverstitch",
    description: "Tubular coverstitch — cuffs, neckbands, sleeve openings.",
    subcategory: "interlock-machines",
    templateSlug: "flatlock-interlock",
    icon: CylinderBedMachineIcon,
  },
  {
    slug: "interlock-rib-binding",
    name: "Rib-Binding Coverstitch",
    description: "Attaches ribbed binding tape to necks and armholes.",
    subcategory: "interlock-machines",
    templateSlug: "flatlock-interlock",
    icon: CoverstitchIcon,
  },
  {
    slug: "interlock-elastic-attach",
    name: "Elastic-Attaching Coverstitch",
    description: "Lays and stitches elastic in one pass (swimwear, underwear).",
    subcategory: "interlock-machines",
    templateSlug: "flatlock-interlock",
    icon: CoverstitchIcon,
  },
  {
    slug: "interlock-feed-off-arm",
    name: "Feed-Off-the-Arm Coverstitch",
    description: "Arm-exit feed for tubular hems and joining seams.",
    subcategory: "interlock-machines",
    templateSlug: "flatlock-interlock",
    icon: FeedOffArmMachineIcon,
  },
  {
    slug: "interlock-tape-binding",
    name: "Tape-Binding Coverstitch",
    description: "Attaches binding tape — T-shirt necks, lingerie trims.",
    subcategory: "interlock-machines",
    templateSlug: "flatlock-interlock",
    icon: CoverstitchIcon,
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   Chainstitch Machines
   Subcategory slug: chainstitch-machines
   Template: flatlock-interlock  (spec shape is close enough)
   ═══════════════════════════════════════════════════════════════════════════ */

const CHAINSTITCH_KINDS: MachineKind[] = [
  {
    slug: "chainstitch-single-needle",
    name: "Single-Needle Chainstitch",
    description: "Single-thread chain — elastic, fast, ideal for basting.",
    subcategory: "chainstitch-machines",
    templateSlug: "flatlock-interlock",
    icon: ChainstitchIcon,
  },
  {
    slug: "chainstitch-double-needle",
    name: "Double-Needle Chainstitch",
    description: "Two parallel chainstitch rows — denim, workwear topstitch.",
    subcategory: "chainstitch-machines",
    templateSlug: "flatlock-interlock",
    icon: ChainstitchIcon,
  },
  {
    slug: "chainstitch-feed-off-arm",
    name: "Feed-Off-the-Arm Chainstitch",
    description: "Jeans inseams, shirt side-seams — arm-exit feed chain.",
    subcategory: "chainstitch-machines",
    templateSlug: "flatlock-interlock",
    icon: FeedOffArmMachineIcon,
  },
  {
    slug: "chainstitch-multi-needle",
    name: "Multi-Needle Chainstitch",
    description: "3–12 needles — waistbands, smocking, shirring.",
    subcategory: "chainstitch-machines",
    templateSlug: "flatlock-interlock",
    icon: MultiNeedleIcon,
  },
  {
    slug: "chainstitch-post-bed",
    name: "Post-Bed Chainstitch",
    description: "Vertical post + chain — shoes, handbags, decorative stitching.",
    subcategory: "chainstitch-machines",
    templateSlug: "flatlock-interlock",
    icon: PostBedMachineIcon,
  },
  {
    slug: "chainstitch-cylinder-bed",
    name: "Cylinder-Bed Chainstitch",
    description: "Tubular chainstitch for round parts and small cuffs.",
    subcategory: "chainstitch-machines",
    templateSlug: "flatlock-interlock",
    icon: CylinderBedMachineIcon,
  },
  {
    slug: "chainstitch-long-arm",
    name: "Long-Arm Chainstitch",
    description: "Extended throat for oversized chain-seam work.",
    subcategory: "chainstitch-machines",
    templateSlug: "flatlock-interlock",
    icon: LongArmMachineIcon,
  },
  {
    slug: "chainstitch-heavy-duty",
    name: "Heavy-Duty Chainstitch",
    description: "Upholstery, industrial denim, heavy webbing.",
    subcategory: "chainstitch-machines",
    templateSlug: "flatlock-interlock",
    icon: HeavyDutyMachineIcon,
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   Double Needle Machines
   Subcategory slug: double-needle-machines
   Template: double-needle-lockstitch
   ═══════════════════════════════════════════════════════════════════════════ */

const DOUBLE_NEEDLE_KINDS: MachineKind[] = [
  {
    slug: "dn-lockstitch-fixed",
    name: "Double Needle Lockstitch (Fixed Bar)",
    description: "Both needles move together — standard double-row topstitch.",
    subcategory: "double-needle-machines",
    templateSlug: "double-needle-lockstitch",
    icon: DoubleNeedleIcon,
  },
  {
    slug: "dn-lockstitch-split",
    name: "Double Needle Lockstitch (Split Bar)",
    description: "Each needle stops independently — clean corners without skips.",
    subcategory: "double-needle-machines",
    templateSlug: "double-needle-lockstitch",
    icon: DoubleNeedleIcon,
  },
  {
    slug: "dn-needle-feed",
    name: "Double Needle Needle-Feed",
    description: "Needles move with the feed — no shift on slippery layers.",
    subcategory: "double-needle-machines",
    templateSlug: "double-needle-lockstitch",
    icon: DoubleNeedleIcon,
  },
  {
    slug: "dn-walking-foot",
    name: "Double Needle Walking-Foot",
    description: "Compound feed + twin needles — upholstery & heavy topstitch.",
    subcategory: "double-needle-machines",
    templateSlug: "double-needle-lockstitch",
    icon: WalkingFootMachineIcon,
  },
  {
    slug: "dn-long-arm",
    name: "Double Needle Long-Arm",
    description: "Extended throat + twin needles — jeans, upholstery panels.",
    subcategory: "double-needle-machines",
    templateSlug: "double-needle-lockstitch",
    icon: LongArmMachineIcon,
  },
  {
    slug: "dn-post-bed",
    name: "Double Needle Post-Bed",
    description: "3D parts (shoes, caps) with twin parallel stitches.",
    subcategory: "double-needle-machines",
    templateSlug: "double-needle-lockstitch",
    icon: PostBedMachineIcon,
  },
  {
    slug: "dn-cylinder-bed",
    name: "Double Needle Cylinder-Bed",
    description: "Tubular double-needle — luggage, footwear, saddlery.",
    subcategory: "double-needle-machines",
    templateSlug: "double-needle-lockstitch",
    icon: CylinderBedMachineIcon,
  },
  {
    slug: "dn-feed-off-arm",
    name: "Double Needle Feed-Off-the-Arm",
    description: "Twin chainstitch side-exit — jeans inseam double topstitch.",
    subcategory: "double-needle-machines",
    templateSlug: "double-needle-lockstitch",
    icon: FeedOffArmMachineIcon,
  },
  {
    slug: "dn-chainstitch",
    name: "Double Needle Chainstitch",
    description: "Two rows of chainstitch — denim waistband, workwear.",
    subcategory: "double-needle-machines",
    templateSlug: "double-needle-lockstitch",
    icon: ChainstitchIcon,
  },
  {
    slug: "dn-heavy-duty",
    name: "Double Needle Heavy-Duty",
    description: "Leather, canvas, webbing — reinforced twin-needle build.",
    subcategory: "double-needle-machines",
    templateSlug: "double-needle-lockstitch",
    icon: HeavyDutyMachineIcon,
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   Multi-Needle Machines
   Subcategory slug: multi-needle-machines
   Template: double-needle-lockstitch  (closest spec shape)
   ═══════════════════════════════════════════════════════════════════════════ */

const MULTI_NEEDLE_KINDS: MachineKind[] = [
  {
    slug: "mn-3-chain",
    name: "3-Needle Chainstitch",
    description: "Three parallel chain rows — light waistband work.",
    subcategory: "multi-needle-machines",
    templateSlug: "double-needle-lockstitch",
    icon: MultiNeedleIcon,
  },
  {
    slug: "mn-4-chain",
    name: "4-Needle Chainstitch",
    description: "Four parallel rows — typical waistband production.",
    subcategory: "multi-needle-machines",
    templateSlug: "double-needle-lockstitch",
    icon: MultiNeedleIcon,
  },
  {
    slug: "mn-multi-chain",
    name: "6 / 8 / 12-Needle Chainstitch",
    description: "Wide-row chain — elastic waistbands, shirring, smocking.",
    subcategory: "multi-needle-machines",
    templateSlug: "double-needle-lockstitch",
    icon: MultiNeedleIcon,
  },
  {
    slug: "mn-coverstitch",
    name: "Multi-Needle Coverstitch",
    description: "Decorative multi-row coverstitch for trims.",
    subcategory: "multi-needle-machines",
    templateSlug: "double-needle-lockstitch",
    icon: CoverstitchIcon,
  },
  {
    slug: "mn-picot-fagoting",
    name: "Multi-Needle Picot / Fagoting",
    description: "Decorative openwork seams — lingerie, couture edging.",
    subcategory: "multi-needle-machines",
    templateSlug: "double-needle-lockstitch",
    icon: MultiNeedleIcon,
  },
  {
    slug: "mn-quilting",
    name: "Multi-Needle Quilting",
    description: "Mattress, duvet, puffer-jacket panel quilting.",
    subcategory: "multi-needle-machines",
    templateSlug: "double-needle-lockstitch",
    icon: MultiNeedleIcon,
  },
  {
    slug: "mn-lockstitch",
    name: "Multi-Needle Lockstitch",
    description: "Parallel lockstitch rows for topstitch decoration.",
    subcategory: "multi-needle-machines",
    templateSlug: "double-needle-lockstitch",
    icon: MultiNeedleIcon,
  },
  {
    slug: "mn-elastic-attach",
    name: "Multi-Needle Elastic Attaching",
    description: "Attaches elastic bands — lingerie, swimwear, fitness.",
    subcategory: "multi-needle-machines",
    templateSlug: "double-needle-lockstitch",
    icon: MultiNeedleIcon,
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   Pattern Sewing Machines (programmable / CNC)
   Subcategory slug: pattern-sewing-machines
   Template: bartacking  (closest spec shape — stitch pattern + area)
   ═══════════════════════════════════════════════════════════════════════════ */

const PATTERN_SEWING_KINDS: MachineKind[] = [
  {
    slug: "pattern-small-area",
    name: "Small-Area Pattern Sewer",
    description: "~200×100 mm programmable sewing field.",
    subcategory: "pattern-sewing-machines",
    templateSlug: "bartacking",
    icon: PatternSewerIcon,
  },
  {
    slug: "pattern-medium-area",
    name: "Medium-Area Pattern Sewer",
    description: "~300×200 mm field — pocket flaps, logo patches.",
    subcategory: "pattern-sewing-machines",
    templateSlug: "bartacking",
    icon: PatternSewerIcon,
  },
  {
    slug: "pattern-large-area",
    name: "Large-Area Pattern Sewer",
    description: "~500×300 mm — collar topstitching, decorative panels.",
    subcategory: "pattern-sewing-machines",
    templateSlug: "bartacking",
    icon: PatternSewerIcon,
  },
  {
    slug: "pattern-xxl-long-arm",
    name: "XXL Long-Arm Pattern Sewer",
    description: "Up to 1200×800 mm — airbags, sails, large upholstery.",
    subcategory: "pattern-sewing-machines",
    templateSlug: "bartacking",
    icon: PatternSewerIcon,
  },
  {
    slug: "pattern-pocket-welt-single",
    name: "Single-Welt Pocket Setter",
    description: "Automatic single-welt pocket in jackets / trousers.",
    subcategory: "pattern-sewing-machines",
    templateSlug: "bartacking",
    icon: PatternSewerIcon,
  },
  {
    slug: "pattern-pocket-welt-double",
    name: "Double-Welt Pocket Setter (with Flap)",
    description: "Full jetted pocket + flap in one automatic cycle.",
    subcategory: "pattern-sewing-machines",
    templateSlug: "bartacking",
    icon: PatternSewerIcon,
  },
  {
    slug: "pattern-dart-sewer",
    name: "Automatic Dart Sewer",
    description: "Programmed dart-seam sewing with auto stop.",
    subcategory: "pattern-sewing-machines",
    templateSlug: "bartacking",
    icon: PatternSewerIcon,
  },
  {
    slug: "pattern-belt-loop",
    name: "Belt-Loop Attaching Machine",
    description: "Tacks belt loops to waistbands automatically.",
    subcategory: "pattern-sewing-machines",
    templateSlug: "bartacking",
    icon: BartackIcon,
  },
  {
    slug: "pattern-auto-sleeve-setter",
    name: "Automatic Sleeve Setter",
    description: "Sets sleeve-cap into armhole with programmed ease.",
    subcategory: "pattern-sewing-machines",
    templateSlug: "bartacking",
    icon: AutomaticMachineIcon,
  },
  {
    slug: "pattern-auto-waistband",
    name: "Automatic Waistband Attaching",
    description: "Attaches full-loop waistband in one cycle.",
    subcategory: "pattern-sewing-machines",
    templateSlug: "bartacking",
    icon: AutomaticMachineIcon,
  },
  {
    slug: "pattern-label-patch",
    name: "Automatic Label / Patch Sewer",
    description: "Programmed label or patch attachment.",
    subcategory: "pattern-sewing-machines",
    templateSlug: "bartacking",
    icon: PatternSewerIcon,
  },
  {
    slug: "pattern-tacking",
    name: "Tacking / Bartack Pattern Machine",
    description: "Programmable bar-tack patterns for stress points.",
    subcategory: "pattern-sewing-machines",
    templateSlug: "bartacking",
    icon: BartackIcon,
  },
  {
    slug: "pattern-vision",
    name: "Vision-Guided Pattern Sewer",
    description: "Camera-aligned programmable sewing head.",
    subcategory: "pattern-sewing-machines",
    templateSlug: "bartacking",
    icon: AutomaticMachineIcon,
  },
  {
    slug: "pattern-template",
    name: "Template-Based Pattern Sewer",
    description: "Uses physical template plates to drive the pattern.",
    subcategory: "pattern-sewing-machines",
    templateSlug: "bartacking",
    icon: PatternSewerIcon,
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   Heavy Duty Machines
   Subcategory slug: heavy-duty-machines
   Template: single-needle-lockstitch
   ═══════════════════════════════════════════════════════════════════════════ */

const HEAVY_DUTY_KINDS: MachineKind[] = [
  {
    slug: "hd-snls",
    name: "Heavy-Duty Single Needle Lockstitch",
    description: "Denim, canvas, heavy drill — reinforced SNLS.",
    subcategory: "heavy-duty-machines",
    templateSlug: "single-needle-lockstitch",
    icon: HeavyDutyMachineIcon,
  },
  {
    slug: "hd-dnls",
    name: "Heavy-Duty Double Needle Lockstitch",
    description: "Twin-needle build for thick, multi-layer material.",
    subcategory: "heavy-duty-machines",
    templateSlug: "single-needle-lockstitch",
    icon: HeavyDutyMachineIcon,
  },
  {
    slug: "hd-walking-foot",
    name: "Heavy-Duty Walking-Foot (Triple Feed)",
    description: "Leather, upholstery, harness — three-feed compound.",
    subcategory: "heavy-duty-machines",
    templateSlug: "single-needle-lockstitch",
    icon: WalkingFootMachineIcon,
  },
  {
    slug: "hd-long-arm",
    name: "Long-Arm Heavy-Duty",
    description: "Sail-making, tarpaulin, automotive panels.",
    subcategory: "heavy-duty-machines",
    templateSlug: "single-needle-lockstitch",
    icon: LongArmMachineIcon,
  },
  {
    slug: "hd-post-bed",
    name: "Post-Bed Heavy-Duty",
    description: "Shoes, handbags, saddlery — 3D heavy construction.",
    subcategory: "heavy-duty-machines",
    templateSlug: "single-needle-lockstitch",
    icon: PostBedMachineIcon,
  },
  {
    slug: "hd-cylinder-bed",
    name: "Cylinder-Bed Heavy-Duty",
    description: "Luggage, footwear, tubular heavy work.",
    subcategory: "heavy-duty-machines",
    templateSlug: "single-needle-lockstitch",
    icon: CylinderBedMachineIcon,
  },
  {
    slug: "hd-zigzag",
    name: "Zig-Zag Heavy-Duty",
    description: "Sails, safety gear, reinforced seams.",
    subcategory: "heavy-duty-machines",
    templateSlug: "single-needle-lockstitch",
    icon: ZigzagMachineIcon,
  },
  {
    slug: "hd-extra",
    name: "Extra-Heavy Industrial",
    description: "Webbing, harness, parachute, military — purpose-built.",
    subcategory: "heavy-duty-machines",
    templateSlug: "single-needle-lockstitch",
    icon: HeavyDutyMachineIcon,
  },
  {
    slug: "hd-tape-edge",
    name: "Tape-Edge Heavy-Duty",
    description: "Mattress tape-edge closing — continuous perimeter seam.",
    subcategory: "heavy-duty-machines",
    templateSlug: "single-needle-lockstitch",
    icon: LongArmMachineIcon,
  },
  {
    slug: "hd-carpet-binding",
    name: "Carpet / Rug Binding Heavy-Duty",
    description: "Binds carpet / rug edges — domestic & commercial.",
    subcategory: "heavy-duty-machines",
    templateSlug: "single-needle-lockstitch",
    icon: HeavyDutyMachineIcon,
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   Special Machines
   Subcategory slug: special-machines
   Template: varies — each kind links to the closest spec template.
   ═══════════════════════════════════════════════════════════════════════════ */

const SPECIAL_KINDS: MachineKind[] = [
  {
    slug: "sp-buttonhole-shirt",
    name: "Buttonhole Machine (Shirt / Straight)",
    description: "Straight-bar buttonhole — shirts, blouses, light apparel.",
    subcategory: "special-machines",
    templateSlug: "button-hole",
    icon: ButtonholeMachineIcon,
  },
  {
    slug: "sp-buttonhole-eyelet",
    name: "Buttonhole Machine (Eyelet / Keyhole)",
    description: "Eyelet buttonhole — jeans, trousers, coats.",
    subcategory: "special-machines",
    templateSlug: "button-hole",
    icon: ButtonholeMachineIcon,
  },
  {
    slug: "sp-button-attach",
    name: "Button Attaching / Button Sewing",
    description: "Sews 2-hole / 4-hole buttons programmatically.",
    subcategory: "special-machines",
    templateSlug: "button-attach",
    icon: ButtonAttachIcon,
  },
  {
    slug: "sp-bartack",
    name: "Bartack Machine (Electronic)",
    description: "Reinforces stress points — belt loops, pocket corners.",
    subcategory: "special-machines",
    templateSlug: "bartacking",
    icon: BartackIcon,
  },
  {
    slug: "sp-blindstitch",
    name: "Blindstitch Hemming Machine",
    description: "Near-invisible hem on skirts, trousers, jackets.",
    subcategory: "special-machines",
    templateSlug: "single-needle-lockstitch",
    icon: BlindstitchIcon,
  },
  {
    slug: "sp-felling",
    name: "Felling Machine",
    description: "Attaches jacket lining to shell — tailored garments.",
    subcategory: "special-machines",
    templateSlug: "single-needle-lockstitch",
    icon: BlindstitchIcon,
  },
  {
    slug: "sp-zigzag",
    name: "Zig-Zag Machine",
    description: "Plain / 3-step / multi-point zigzag stitching.",
    subcategory: "special-machines",
    templateSlug: "single-needle-lockstitch",
    icon: ZigzagMachineIcon,
  },
  {
    slug: "sp-smocking",
    name: "Smocking / Shirring Machine",
    description: "Multi-row elastic gathers — blouses, children's wear.",
    subcategory: "special-machines",
    templateSlug: "double-needle-lockstitch",
    icon: MultiNeedleIcon,
  },
  {
    slug: "sp-picot",
    name: "Picot / Scallop Edging",
    description: "Decorative scalloped edge finishing.",
    subcategory: "special-machines",
    templateSlug: "single-needle-lockstitch",
    icon: SpecialMachineIcon,
  },
  {
    slug: "sp-pleating",
    name: "Pleating Machine",
    description: "Folds and stitches pleats for skirts, curtains.",
    subcategory: "special-machines",
    templateSlug: "single-needle-lockstitch",
    icon: SpecialMachineIcon,
  },
  {
    slug: "sp-snap-rivet",
    name: "Snap / Rivet / Eyelet Setter",
    description: "Pneumatic setter for snap buttons, rivets, grommets.",
    subcategory: "special-machines",
    templateSlug: "button-attach",
    icon: ButtonAttachIcon,
  },
  {
    slug: "sp-elastic-cording",
    name: "Elastic Cording Machine",
    description: "Adds elastic cord channels — smocking, shirring.",
    subcategory: "special-machines",
    templateSlug: "double-needle-lockstitch",
    icon: MultiNeedleIcon,
  },
  {
    slug: "sp-belt-loop-maker",
    name: "Belt-Loop Making Machine",
    description: "Continuously forms belt-loop strips from tape.",
    subcategory: "special-machines",
    templateSlug: "flatlock-interlock",
    icon: ChainstitchIcon,
  },
  {
    slug: "sp-sleeve-placket",
    name: "Sleeve-Vent / Placket Setter",
    description: "Automatic shirt sleeve placket construction.",
    subcategory: "special-machines",
    templateSlug: "bartacking",
    icon: AutomaticMachineIcon,
  },
  {
    slug: "sp-collar-runstitcher",
    name: "Collar / Cuff Runstitcher",
    description: "Automatic collar and cuff seam finishing.",
    subcategory: "special-machines",
    templateSlug: "bartacking",
    icon: AutomaticMachineIcon,
  },
  {
    slug: "sp-yoke-attach",
    name: "Yoke Attacher",
    description: "Attaches shirt yoke to back panel automatically.",
    subcategory: "special-machines",
    templateSlug: "bartacking",
    icon: AutomaticMachineIcon,
  },
  {
    slug: "sp-basting",
    name: "Basting Machine",
    description: "Temporary long-stitch basting for tailoring.",
    subcategory: "special-machines",
    templateSlug: "single-needle-lockstitch",
    icon: SpecialMachineIcon,
  },
  {
    slug: "sp-tape-edge-mattress",
    name: "Tape-Edge Mattress Closer",
    description: "Closes the perimeter of a mattress in one rotation.",
    subcategory: "special-machines",
    templateSlug: "single-needle-lockstitch",
    icon: LongArmMachineIcon,
  },
  {
    slug: "sp-ultrasonic-bonding",
    name: "Ultrasonic Bonding Machine",
    description: "Seamless bonding — sportswear, PPE, lingerie.",
    subcategory: "special-machines",
    templateSlug: "single-needle-lockstitch",
    icon: SpecialMachineIcon,
  },
  {
    slug: "sp-heat-seam-seal",
    name: "Heat-Seam Sealing Machine",
    description: "Seals seams waterproof — outerwear, drysuits.",
    subcategory: "special-machines",
    templateSlug: "single-needle-lockstitch",
    icon: SpecialMachineIcon,
  },
  {
    slug: "sp-robotic-cell",
    name: "Robotic / Automated Sewing Cell",
    description: "Multi-station robotic sewing — lights-out production.",
    subcategory: "special-machines",
    templateSlug: "bartacking",
    icon: AutomaticMachineIcon,
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   All kinds in one array + helpers
   ═══════════════════════════════════════════════════════════════════════════ */

export const MACHINE_KINDS: MachineKind[] = [
  ...LOCKSTITCH_KINDS,
  ...OVERLOCK_KINDS,
  ...INTERLOCK_KINDS,
  ...CHAINSTITCH_KINDS,
  ...DOUBLE_NEEDLE_KINDS,
  ...MULTI_NEEDLE_KINDS,
  ...PATTERN_SEWING_KINDS,
  ...HEAVY_DUTY_KINDS,
  ...SPECIAL_KINDS,
];

/* Lookup: return the kinds that belong to a given subcategory.
   Falls back to all kinds if the subcategory is unknown, so the
   picker still shows something rather than an empty state. */
export function getKindsForSubcategory(subcategorySlug: string): MachineKind[] {
  if (!subcategorySlug) return MACHINE_KINDS;
  const matches = MACHINE_KINDS.filter((k) => k.subcategory === subcategorySlug);
  return matches.length > 0 ? matches : MACHINE_KINDS;
}

/* Lookup by kind slug (for display on the product detail page, for
   restoring the selection on edit, etc.). */
export function getKindBySlug(slug: string): MachineKind | null {
  return MACHINE_KINDS.find((k) => k.slug === slug) || null;
}
