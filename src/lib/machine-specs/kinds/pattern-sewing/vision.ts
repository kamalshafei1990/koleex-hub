/* ---------------------------------------------------------------------------
   Pattern Sewing — Vision-Guided — Tier 3

   Camera-equipped pattern sewer. The vision system reads the
   workpiece (logo position, edge, registration mark) and adjusts
   the stitching path on the fly. Used for high-end emblem +
   patch attachment where exact placement matters more than
   raw speed.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const VISION_FIELDS: SpecField[] = [
  {
    key: "ps_v_camera_resolution",
    label: "Camera Resolution",
    type: "text",
    placeholder: "e.g. 5 MP",
    tier: "essential",
    group: "Vision System",
  },
  {
    key: "ps_v_recognition_speed",
    label: "Recognition Speed",
    type: "text",
    placeholder: "e.g. < 0.5 s",
    tier: "recommended",
    group: "Vision System",
    helpText: "Time from clamp close to start-of-stitch.",
  },
  {
    key: "ps_v_registration_marks",
    label: "Registration-Mark Recognition",
    type: "boolean",
    tier: "essential",
    group: "Vision System",
    helpText: "Reads printed registration crosses on the workpiece.",
  },
  {
    key: "ps_v_edge_detection",
    label: "Edge Detection",
    type: "boolean",
    tier: "recommended",
    group: "Vision System",
    helpText: "Detects fabric edge automatically — no registration mark needed.",
  },
  {
    key: "ps_v_tilt_correction",
    label: "Tilt + Skew Correction",
    type: "boolean",
    tier: "advanced",
    group: "Vision System",
    helpText: "Corrects for angled placement so patches don't end up crooked.",
  },
];
