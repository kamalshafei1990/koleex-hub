/* ---------------------------------------------------------------------------
   Interlock Top-and-Bottom Coverstitch (Flatlock) — Tier 3

   Adds a top-cover thread spreader so the seam shows a decorative
   parallel row on BOTH faces of the fabric. Used for sportswear
   joining seams (the seam is flat — no inside pucker — so it sits
   comfortably against skin) and for decorative top stitching.

   Spec sheet exposes the top-cover specifics that make this kind
   distinct from a regular bottom-only coverstitch.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const INTERLOCK_FLATLOCK_FIELDS: SpecField[] = [
  {
    key: "il_fl_top_cover_width",
    label: "Top Cover Width",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 6",
    step: 0.1,
    tier: "essential",
    group: "Flatlock Top Cover",
    helpText: "Width of the top-cover row produced by the spreader.",
  },
  {
    key: "il_fl_spreader_type",
    label: "Top Spreader Type",
    type: "select",
    options: [
      { value: "fixed", label: "Fixed Spreader" },
      { value: "swing", label: "Swing Spreader" },
      { value: "interchangeable", label: "Interchangeable Set" },
    ],
    tier: "recommended",
    group: "Flatlock Top Cover",
  },
  {
    key: "il_fl_decorative_threads",
    label: "Decorative Top Threads",
    type: "boolean",
    tier: "recommended",
    group: "Flatlock Top Cover",
    helpText: "Supports thicker / decorative thread on the top cover.",
  },
];
