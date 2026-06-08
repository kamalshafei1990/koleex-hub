/* Security Center — shared tone/severity token maps (Phase 2A · A2).
   Pure constants. Monochrome-first: `calm` carries NO color (healthy = neutral);
   color appears only for info/attention/critical. Reused by every primitive so
   the palette is defined once. No runtime deps (types are erased at build). */

import type { Tone, Severity } from "@/lib/security/view-model";

/** Text color per tone. calm stays neutral on purpose. */
export const TONE_TEXT: Record<Tone, string> = {
  calm: "text-[var(--text-secondary)]",
  info: "text-blue-400",
  attention: "text-amber-400",
  critical: "text-rose-400",
};

/** Small indicator-dot background per tone. */
export const TONE_DOT: Record<Tone, string> = {
  calm: "bg-[var(--text-dim)]",
  info: "bg-blue-400",
  attention: "bg-amber-400",
  critical: "bg-rose-400",
};

/** Stroke color (SVG-friendly) per tone — for the Sparkline. */
export const TONE_STROKE: Record<Tone, string> = {
  calm: "var(--text-dim)",
  info: "#3385FF",
  attention: "#FBBF24",
  critical: "#FB7185",
};

export const SEVERITY_TONE: Record<Severity, Tone> = {
  info: "info",
  attention: "attention",
  critical: "critical",
};

/** Human, restrained severity labels (never raw enum values in the UI). */
export const SEVERITY_LABEL: Record<Severity, string> = {
  info: "Info",
  attention: "Review",
  critical: "Action",
};
