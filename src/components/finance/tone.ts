/* ---------------------------------------------------------------------------
   Finance · shared `Tone` semantic tokens.

   Lives in its own file because multiple Finance UI files reference it
   (cards, charts, analytics, controls). Keeping it here avoids the
   FinanceUiX → charts → FinanceUiX circular import that would otherwise
   exist after the file split.
   --------------------------------------------------------------------------- */

export type Tone = "neutral" | "positive" | "negative" | "warning" | "info";

export const TONE_TEXT: Record<Tone, string> = {
  neutral:  "text-[var(--text-primary)]",
  positive: "text-emerald-300",
  negative: "text-rose-300",
  warning:  "text-amber-300",
  info:     "text-sky-300",
};

export const TONE_CHIP_BG: Record<Tone, string> = {
  neutral:  "bg-white/[0.06] text-gray-300",
  positive: "bg-emerald-500/15 text-emerald-300",
  negative: "bg-rose-500/15 text-rose-300",
  warning:  "bg-amber-500/15 text-amber-300",
  info:     "bg-sky-500/15 text-sky-300",
};
