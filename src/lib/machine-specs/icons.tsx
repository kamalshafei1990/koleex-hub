/* ---------------------------------------------------------------------------
   Spec Icon Registry

   Centralizes the icon mapping for every spec field, group heading,
   and card source so the form renderer can pull the right glyph from
   one place. Three lookups:

     · FIELD_ICONS  — keyed by `field.key`  (e.g. "max_sewing_speed")
     · GROUP_ICONS  — keyed by `field.group` (e.g. "Performance")
     · CARD_ICONS   — keyed by card source ("common"/"family"/"kind")

   Falls back to a small dot when a field hasn't been explicitly
   mapped, so any future field renders cleanly without a code change.
   --------------------------------------------------------------------------- */

import type { ComponentType, SVGProps } from "react";

import GaugeIcon from "@/components/icons/ui/GaugeIcon";
import RulerIcon from "@/components/icons/ui/RulerIcon";
import ScissorsIcon from "@/components/icons/ui/ScissorsIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import CogIcon from "@/components/icons/ui/CogIcon";
import WrenchIcon from "@/components/icons/ui/WrenchIcon";
import WorkflowIcon from "@/components/icons/ui/WorkflowIcon";
import ZapIcon from "@/components/icons/ui/ZapIcon";
import DropletsIcon from "@/components/icons/ui/DropletsIcon";
import Volume2Icon from "@/components/icons/ui/Volume2Icon";
import ScaleIcon from "@/components/icons/ui/ScaleIcon";
import ShirtIcon from "@/components/icons/ui/ShirtIcon";
import FactoryIcon from "@/components/icons/ui/FactoryIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import AnchorIcon from "@/components/icons/ui/AnchorIcon";
import CircleIcon from "@/components/icons/ui/CircleIcon";
import CircleDotIcon from "@/components/icons/ui/CircleDotIcon";
import ArrowUpIcon from "@/components/icons/ui/ArrowUpIcon";
import ArrowRightLeftIcon from "@/components/icons/ui/ArrowRightLeftIcon";
import ArrowUpDownIcon from "@/components/icons/ui/ArrowUpDownIcon";
import RefreshCcwIcon from "@/components/icons/ui/RefreshCcwIcon";
import TargetIcon from "@/components/icons/ui/TargetIcon";
import BellIcon from "@/components/icons/ui/BellIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import CpuIcon from "@/components/icons/ui/CpuIcon";
import CheckSquareIcon from "@/components/icons/ui/CheckSquareIcon";
import HashtagIcon from "@/components/icons/ui/HashtagIcon";
import LinkIcon from "@/components/icons/ui/LinkIcon";
import Maximize2Icon from "@/components/icons/ui/Maximize2Icon";
import PowerIcon from "@/components/icons/ui/PowerIcon";
import BoxIcon from "@/components/icons/ui/BoxIcon";
import Settings2Icon from "@/components/icons/ui/Settings2Icon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import ActivityIcon from "@/components/icons/ui/ActivityIcon";

/* The icon components in src/components/icons/ui/ accept either
   `size` + `className` or the standard SVG props — typed loosely so
   any of them slot into this registry without TS complaints. */
export type SpecIconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string; className?: string }>;

/* ─── Per-field icons ───────────────────────────────────────────── */

export const FIELD_ICONS: Record<string, SpecIconComponent> = {
  // Common Tier 1 — Performance
  max_sewing_speed: GaugeIcon,
  stitch_length_min: RulerIcon,
  stitch_length_max: RulerIcon,
  presser_foot_lift: ArrowUpIcon,

  // Common Tier 1 — Needle & Thread
  needle_system: ScissorsIcon,
  needle_size_range: HashtagIcon,
  thread_type: LinkIcon,
  thread_count_tex: HashtagIcon,

  // Common Tier 1 — Mechanical
  motor_type: ZapIcon,
  feed_mechanism: WorkflowIcon,
  hook_type: AnchorIcon,
  lubrication_system: DropletsIcon,

  // Common Tier 1 — Physical
  noise_level: Volume2Icon,

  // Common Tier 1 — Material / Application
  material_weight: ScaleIcon,
  suitable_fabrics: LayersIcon,
  application_industries: FactoryIcon,
  suitable_garments: ShirtIcon,
  suitable_operations: CogIcon,

  // Lockstitch Family — Configuration
  ls_bed_type: LayersIcon,
  ls_hook_size: CircleDotIcon,
  ls_bobbin_type: CircleIcon,
  ls_max_material_thickness: LayersIcon,

  // Lockstitch Family — Stitch & Feed
  ls_stitch_pattern: ActivityIcon,
  ls_reverse_feed: ArrowRightLeftIcon,
  ls_feed_dog_type: WorkflowIcon,

  // Lockstitch Family — Automation
  ls_auto_thread_trimmer: ScissorsIcon,
  ls_auto_backtack: RefreshCcwIcon,
  ls_auto_presser_foot_lifter: ArrowUpIcon,
  ls_auto_thread_wiper: SparklesIcon,
  ls_needle_positioning: TargetIcon,
  ls_auto_bobbin_winder: RefreshCcwIcon,
  ls_auto_backstitch_start_end: ArrowUpDownIcon,
  ls_low_bobbin_sensor: BellIcon,

  // Walking-Foot
  wf_triple_feed: LayersIcon,
  wf_walking_foot_travel: RulerIcon,
  wf_max_layer_count: LayersIcon,
  wf_compound_feed_type: WorkflowIcon,

  // Long-Arm
  la_arm_length: RulerIcon,
  la_throat_depth: Maximize2Icon,

  // Cylinder-Bed
  cb_cylinder_diameter: CircleIcon,
  cb_cylinder_length: RulerIcon,

  // Post-Bed
  pb_post_height: ArrowUpIcon,
  pb_post_diameter: CircleIcon,

  // Feed-Off-Arm
  foa_arm_length: RulerIcon,
  foa_arm_clearance: Maximize2Icon,
  foa_feed_direction: ArrowRightLeftIcon,

  // Zig-Zag
  zz_zigzag_width: ActivityIcon,
  zz_stitch_patterns_count: HashtagIcon,
  zz_programmable: CpuIcon,

  // Edge Trimmer
  et_knife_type: ScissorsIcon,
  et_cutting_width: ScissorsIcon,
  et_quick_release: PowerIcon,

  // Heavy-Duty
  hd_max_thread_thickness: LinkIcon,
  hd_max_material_thickness_heavy: LayersIcon,
  hd_reinforced_frame: BoxIcon,
  hd_large_hook: AnchorIcon,
};

/* ─── Per-group heading icons ───────────────────────────────────── */

export const GROUP_ICONS: Record<string, SpecIconComponent> = {
  // Common groups
  Performance: GaugeIcon,
  "Needle & Thread": ScissorsIcon,
  Mechanical: WrenchIcon,
  Physical: RulerIcon,
  Material: LayersIcon,
  Application: FactoryIcon,

  // Lockstitch family + kind groups
  Configuration: CogIcon,
  "Stitch & Feed": WorkflowIcon,
  Automation: SparklesIcon,
  "Walking-Foot Mechanism": LayersIcon,
  "Long-Arm Geometry": RulerIcon,
  "Cylinder Bed Geometry": CircleIcon,
  "Post-Bed Geometry": ArrowUpIcon,
  "Feed-Off-Arm Geometry": RulerIcon,
  "Zig-Zag Stitch": ActivityIcon,
  "Edge Trimmer": ScissorsIcon,
  "Heavy-Duty Capacity": ShieldCheckIcon,
};

/* ─── Per-card icons (by card source) ───────────────────────────── */

export const CARD_ICONS: Record<"common" | "family" | "kind", SpecIconComponent> = {
  common: Settings2Icon,
  family: PackageIcon,
  kind: SparklesIcon,
};

/* ─── Lookup helpers — fall back to a small dot for unmapped keys
       so the form never crashes on a new field. ─────────────────── */

export function getFieldIcon(key: string): SpecIconComponent {
  return FIELD_ICONS[key] || CircleDotIcon;
}

export function getGroupIcon(group: string | undefined): SpecIconComponent {
  if (!group) return CheckSquareIcon;
  return GROUP_ICONS[group] || CheckSquareIcon;
}

export function getCardIcon(source: "common" | "family" | "kind"): SpecIconComponent {
  return CARD_ICONS[source] || Settings2Icon;
}
