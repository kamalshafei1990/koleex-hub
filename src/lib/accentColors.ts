/* ---------------------------------------------------------------------------
   accentColors.ts — canonical overflow-menu accent palette.

   PageNavPopup section headers + icon chips use a 5-color tonal accent so the
   user can scan grouped routes visually. Each app's nav config used to inline
   its own copy of the same Tailwind tokens, which drifted over time. This
   module is the single source of truth.

   Usage:
     import { ACCENT } from "@/lib/accentColors";
     const groups: NavGroup[] = [
       { id: "do", label: "Actions", accent: ACCENT.blue, items: [...] },
       { id: "lookup", label: "Look up", accent: ACCENT.teal, items: [...] },
       ...
     ];

   The semantic convention across apps:
     · blue   — primary "Do" / Actions group (most-used routes)
     · teal   — "Look up" / read-only browsing
     · amber  — "Setup" / configuration
     · violet — "Reports" / analytics
     · rose   — "Admin" / governance + approvals

   Apps with fewer than 5 groups simply use a subset (e.g. Inventory uses
   blue + teal + amber). Apps with more than 5 should add new entries here
   rather than improvising tokens at the call site.
   --------------------------------------------------------------------------- */

export interface AccentTokens {
  /** Left-border accent class (`border-l-…`) for the group header rail. */
  border: string;
  /** Background class for the per-item icon chip. */
  chipBg: string;
  /** Text-color class for the icon inside the chip. */
  chipText: string;
  /** Text-color class for the section header label. */
  header: string;
}

export const ACCENT = {
  blue: {
    border:   "border-l-blue-500/70",
    chipBg:   "bg-blue-500/10",
    chipText: "text-blue-400",
    header:   "text-blue-400",
  },
  teal: {
    border:   "border-l-teal-500/70",
    chipBg:   "bg-teal-500/10",
    chipText: "text-teal-400",
    header:   "text-teal-400",
  },
  amber: {
    border:   "border-l-amber-500/70",
    chipBg:   "bg-amber-500/10",
    chipText: "text-amber-400",
    header:   "text-amber-400",
  },
  violet: {
    border:   "border-l-violet-500/70",
    chipBg:   "bg-violet-500/10",
    chipText: "text-violet-400",
    header:   "text-violet-400",
  },
  rose: {
    border:   "border-l-rose-500/70",
    chipBg:   "bg-rose-500/10",
    chipText: "text-rose-400",
    header:   "text-rose-400",
  },
} as const satisfies Record<string, AccentTokens>;

export type AccentName = keyof typeof ACCENT;
