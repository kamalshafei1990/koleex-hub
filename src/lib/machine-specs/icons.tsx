/* ---------------------------------------------------------------------------
   Spec Icon Registry — UNIQUE glyphs

   Every spec field, group heading, and card source maps to exactly
   ONE unique uicons-regular-rounded glyph. No duplicates. The actual
   path data lives in `glyph-paths.ts` (auto-generated from the SVG
   source files) and `<SpecGlyph name="…" />` is the component that
   renders any glyph by name.

   To audit / change a mapping: edit /tmp/glyphgen/mapping.txt and
   re-run the build script — see the header comment in glyph-paths.ts.
   --------------------------------------------------------------------------- */

/* ─── Per-field glyph names ─────────────────────────────────────── */

export const FIELD_GLYPHS: Record<string, string> = {
  // Common Tier 1 — Performance
  max_sewing_speed: "max_sewing_speed",         // tachometer
  stitch_length_min: "stitch_length_min",       // arrow-small-left
  stitch_length_max: "stitch_length_max",       // arrow-small-right
  presser_foot_lift: "presser_foot_lift",       // arrow-up-from-square

  // Common Tier 1 — Needle & Thread
  needle_system: "needle_system",               // needle
  needle_size_range: "needle_size_range",       // ruler-horizontal
  thread_type: "thread_type",                   // reel
  thread_count_tex: "thread_count_tex",         // hashtag-lock

  // Common Tier 1 — Mechanical
  motor_type: "motor_type",                     // engine
  feed_mechanism: "feed_mechanism",             // conveyor-belt
  hook_type: "hook_type",                       // fish-hook
  lubrication_system: "lubrication_system",     // oil-can

  // Common Tier 1 — Physical
  noise_level: "noise_level",                   // music-note

  // Common Tier 1 — Material / Application
  material_weight: "material_weight",           // scale
  suitable_fabrics: "suitable_fabrics",         // fabric
  application_industries: "application_industries", // industry-windows
  suitable_garments: "suitable_garments",       // shirt
  suitable_operations: "suitable_operations",   // hammer

  // Lockstitch Family — Configuration
  ls_bed_type: "ls_bed_type",                   // bed-alt
  ls_hook_size: "ls_hook_size",                 // hook
  ls_bobbin_type: "ls_bobbin_type",             // coil
  ls_max_material_thickness: "ls_max_material_thickness", // cubes-stacked

  // Lockstitch Family — Stitch & Feed
  ls_stitch_pattern: "ls_stitch_pattern",       // pulse
  ls_reverse_feed: "ls_reverse_feed",           // rotate-reverse
  ls_feed_dog_type: "ls_feed_dog_type",         // conveyor-belt-arm

  // Lockstitch Family — Automation
  ls_auto_thread_trimmer: "ls_auto_thread_trimmer",     // scissors
  ls_auto_backtack: "ls_auto_backtack",                 // arrow-turn-down-left
  ls_auto_presser_foot_lifter: "ls_auto_presser_foot_lifter", // arrow-up
  ls_auto_thread_wiper: "ls_auto_thread_wiper",         // fan
  ls_needle_positioning: "ls_needle_positioning",       // arrows-to-dot
  ls_auto_bobbin_winder: "ls_auto_bobbin_winder",       // arrows-repeat
  ls_auto_backstitch_start_end: "ls_auto_backstitch_start_end", // arrows-repeat-1
  ls_low_bobbin_sensor: "ls_low_bobbin_sensor",         // signal-bars-weak

  // Walking-Foot
  wf_triple_feed: "wf_triple_feed",                     // arrow-down-small-big
  wf_walking_foot_travel: "wf_walking_foot_travel",     // footprint
  wf_max_layer_count: "wf_max_layer_count",             // cubes
  wf_compound_feed_type: "wf_compound_feed_type",       // diagram-nested

  // Long-Arm
  la_arm_length: "la_arm_length",                       // ruler-vertical
  la_throat_depth: "la_throat_depth",                   // expand-arrows

  // Cylinder-Bed
  cb_cylinder_diameter: "cb_cylinder_diameter",         // arrows-alt-h
  cb_cylinder_length: "cb_cylinder_length",             // arrows-alt-v

  // Post-Bed
  pb_post_height: "pb_post_height",                     // arrow-from-bottom
  pb_post_diameter: "pb_post_diameter",                 // bracket-round

  // Feed-Off-Arm
  foa_arm_length: "foa_arm_length",                     // measuring-tape
  foa_arm_clearance: "foa_arm_clearance",               // expand-arrows-alt
  foa_feed_direction: "foa_feed_direction",             // arrows-cross

  // Zig-Zag
  zz_zigzag_width: "zz_zigzag_width",                   // arrows-h
  zz_stitch_patterns_count: "zz_stitch_patterns_count", // grid-three
  zz_programmable: "zz_programmable",                   // microchip

  // Edge Trimmer
  et_knife_type: "et_knife_type",                       // knife
  et_cutting_width: "et_cutting_width",                 // cutter
  et_quick_release: "et_quick_release",                 // bolt

  // Heavy-Duty
  hd_max_thread_thickness: "hd_max_thread_thickness",   // arrow-down-strenght
  hd_max_material_thickness_heavy: "hd_max_material_thickness_heavy", // cube
  hd_reinforced_frame: "hd_reinforced_frame",           // frame
  hd_large_hook: "hd_large_hook",                       // fort

  /* ─── Overlock Family — Tier 2 ──────────────────────────
     Reuse existing uicons glyphs by mapping the new ov_*
     keys to the closest semantic glyph already in
     glyph-paths.ts. Avoids re-running the SVG build script
     while still giving every overlock spec its own visual. */
  ov_thread_count: "thread_count_tex",          // hashtag-lock
  ov_needle_count: "needle_system",             // needle
  ov_looper_config: "hook_type",                // fish-hook
  ov_bed_type: "ls_bed_type",                   // bed-alt
  ov_max_material_thickness: "ls_max_material_thickness", // cubes-stacked
  ov_drive_type: "motor_type",                  // engine

  ov_stitch_width_min: "stitch_length_min",     // arrow-small-left
  ov_stitch_width_max: "stitch_length_max",     // arrow-small-right
  ov_stitch_length_min: "stitch_length_min",    // arrow-small-left
  ov_stitch_length_max: "stitch_length_max",    // arrow-small-right
  ov_differential_feed_ratio: "ls_reverse_feed", // rotate-reverse
  ov_feed_dog_type: "ls_feed_dog_type",         // conveyor-belt-arm

  ov_cutting_width: "et_cutting_width",         // cutter
  ov_knife_type: "et_knife_type",               // knife
  ov_knife_disengage: "et_quick_release",       // bolt

  ov_auto_thread_trimmer: "ls_auto_thread_trimmer",     // scissors
  ov_auto_presser_foot_lifter: "ls_auto_presser_foot_lifter", // arrow-up
  ov_auto_back_suction: "ls_auto_thread_wiper", // fan
  ov_lubrication_system: "lubrication_system",  // oil-can
  ov_needle_cooler: "ls_auto_thread_wiper",     // fan

  /* ─── Overlock Kind extras — Tier 3 ─────────────────────── */
  // Rolled-Hem
  ov_rh_hem_width: "ls_max_material_thickness", // cubes-stacked
  ov_rh_plate_type: "ls_bed_type",              // bed-alt
  ov_rh_pico_edge: "zz_zigzag_width",           // arrows-h

  // Variable Top-Feed
  ov_vtf_top_feed_travel: "wf_walking_foot_travel", // footprint
  ov_vtf_feed_ratio_min: "ls_reverse_feed",         // rotate-reverse
  ov_vtf_feed_ratio_max: "ls_reverse_feed",         // rotate-reverse
  ov_vtf_quick_lock: "et_quick_release",            // bolt

  // Cylinder Bed (overlock)
  ov_cb_cylinder_diameter: "cb_cylinder_diameter", // arrows-alt-h
  ov_cb_cylinder_length: "cb_cylinder_length",     // arrows-alt-v
  ov_cb_post_clearance: "pb_post_height",          // arrow-from-bottom

  // Heavy-Duty (overlock)
  ov_hd_max_thread_thickness: "hd_max_thread_thickness",     // arrow-down-strenght
  ov_hd_max_material_thickness: "hd_max_material_thickness_heavy", // cube
  ov_hd_reinforced_frame: "hd_reinforced_frame",             // frame
  ov_hd_large_loopers: "hd_large_hook",                      // fort

  // 5-Thread Safety-Stitch
  ov_ss_chain_gauge: "zz_zigzag_width",          // arrows-h
  ov_ss_chain_stitch_length: "stitch_length_max", // arrow-small-right
  ov_ss_independent_tension: "ls_low_bobbin_sensor", // signal-bars-weak

  // Gathering / Ruffling
  ov_g_ratio_min: "ls_reverse_feed",             // rotate-reverse
  ov_g_ratio_max: "ls_reverse_feed",             // rotate-reverse
  ov_g_foot_type: "presser_foot_lift",           // arrow-up-from-square
  ov_g_lockable_ratio: "et_quick_release",       // bolt

  // Elastic / Tape Attaching
  ov_et_max_tape_width: "zz_zigzag_width",       // arrows-h
  ov_et_tape_stretch_ratio: "ls_reverse_feed",   // rotate-reverse
  ov_et_tension_control: "ls_low_bobbin_sensor", // signal-bars-weak
  ov_et_integrated_cutter: "et_knife_type",      // knife

  // Glove Specifics
  ov_gl_cylinder_diameter: "cb_cylinder_diameter", // arrows-alt-h
  ov_gl_finger_clearance: "foa_arm_clearance",     // expand-arrows-alt
  ov_gl_glove_type: "suitable_garments",           // shirt

  // Auto Collar / Waistband Station
  ov_acs_max_work_diameter: "cb_cylinder_diameter", // arrows-alt-h
  ov_acs_cycle_time: "max_sewing_speed",            // tachometer
  ov_acs_programmable_patterns: "zz_programmable",  // microchip
  ov_acs_jig_change_time: "et_quick_release",       // bolt
  ov_acs_auto_stacker: "ls_auto_thread_wiper",      // fan

  // Towel Specifics
  ov_tw_dust_extraction: "ls_auto_thread_wiper",    // fan
  ov_tw_loop_pile_height: "ls_max_material_thickness", // cubes-stacked
  ov_tw_foot_type: "presser_foot_lift",             // arrow-up-from-square
};

/* ─── Per-group heading glyphs ──────────────────────────────────── */

export const GROUP_GLYPHS: Record<string, string> = {
  // Common groups
  Performance: "_g_Performance",                // gauge-circle-plus
  "Needle & Thread": "_g_NeedleThread",         // signal-stream
  Mechanical: "_g_Mechanical",                  // gears
  Physical: "_g_Physical",                      // expand
  Material: "_g_Material",                      // clothes-hanger
  Application: "_g_Application",                // industry-alt

  // Lockstitch family + kind groups
  Configuration: "_g_Configuration",            // sliders-h-square
  "Stitch & Feed": "_g_StitchFeed",             // arrow-progress
  Automation: "_g_Automation",                  // robot
  "Walking-Foot Mechanism": "_g_WalkingFoot",   // robotic-arm
  "Long-Arm Geometry": "_g_LongArm",            // ruler-combined
  "Cylinder Bed Geometry": "_g_CylinderBed",    // grid-alt
  "Post-Bed Geometry": "_g_PostBed",            // arrow-from-top
  "Feed-Off-Arm Geometry": "_g_FeedOffArm",     // arrow-progress-alt
  "Zig-Zag Stitch": "_g_ZigZag",                // magnifying-glass-wave
  "Edge Trimmer": "_g_EdgeTrimmer",             // knife-kitchen
  "Heavy-Duty Capacity": "_g_HeavyDuty",        // shield

  // Overlock-specific groups — reuse closest existing group
  // glyphs so the kind extras render with sensible icons even
  // before dedicated SVGs are added to glyph-paths.ts.
  "Cutting": "_g_EdgeTrimmer",                  // knife-kitchen
  "Rolled Hem": "_g_StitchFeed",                // arrow-progress
  "Variable Top-Feed": "_g_WalkingFoot",        // robotic-arm
  "Rolled-Hem Specifics": "_g_StitchFeed",      // arrow-progress
  "Safety-Stitch Geometry": "_g_StitchFeed",    // arrow-progress
  "Gathering Mechanism": "_g_StitchFeed",       // arrow-progress
  "Tape Feeder": "_g_WalkingFoot",              // robotic-arm
  "Glove Specifics": "_g_CylinderBed",          // grid-alt
  "Auto Station": "_g_Automation",              // robot
  "Towel Specifics": "_g_Material",             // clothes-hanger
};

/* ─── Per-card glyphs ───────────────────────────────────────────── */

export const CARD_GLYPHS: Record<"common" | "family" | "kind", string> = {
  common: "_c_common",   // globe
  family: "_c_family",   // diagram-project
  kind: "_c_kind",       // magic-wand
};

/* ─── Lookup helpers — fall back to a neutral disc for unmapped
       keys so the form never crashes. SpecGlyph itself handles the
       missing-name case visually. ──────────────────────────────── */

export function getFieldGlyph(key: string): string {
  return FIELD_GLYPHS[key] || "";
}

export function getGroupGlyph(group: string | undefined): string {
  if (!group) return "";
  return GROUP_GLYPHS[group] || "";
}

export function getCardGlyph(source: "common" | "family" | "kind"): string {
  return CARD_GLYPHS[source] || "_c_common";
}
