/* Visual mapping for the system expense categories.
   Each category gets an emoji glyph, a chip background, and a brand
   colour for accent. The mapping is keyed off the category NAME (the
   system rows seed with these exact names; tenant-custom categories
   fall through to the "Other" style). */

export interface CategoryStyle {
  glyph: string;
  accent: "emerald" | "sky" | "amber" | "rose" | "violet" | "blue" | "fuchsia" | "lime" | "orange" | "gray";
}

export const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  "Shipping & Logistics":   { glyph: "🚢", accent: "blue"    },
  "Customs & Duties":       { glyph: "🛃", accent: "amber"   },
  "Banking & FX":           { glyph: "🏦", accent: "emerald" },
  "Marketing":              { glyph: "📣", accent: "fuchsia" },
  "Travel & Entertainment": { glyph: "✈️", accent: "sky"     },
  "Office & Operations":    { glyph: "🏢", accent: "violet"  },
  "Payroll & Benefits":     { glyph: "👥", accent: "lime"    },
  "Professional Services":  { glyph: "💼", accent: "orange"  },
  "Inventory & Packaging":  { glyph: "📦", accent: "rose"    },
  "Other":                  { glyph: "•",  accent: "gray"    },
};

export function styleForCategory(name: string | null | undefined): CategoryStyle {
  if (!name) return CATEGORY_STYLES.Other;
  return CATEGORY_STYLES[name] ?? CATEGORY_STYLES.Other;
}

export function accentBgClass(accent: CategoryStyle["accent"]): string {
  switch (accent) {
    case "emerald": return "bg-emerald-500/15 border-emerald-500/25 text-emerald-300";
    case "sky":     return "bg-sky-500/15 border-sky-500/25 text-sky-300";
    case "amber":   return "bg-amber-500/15 border-amber-500/25 text-amber-300";
    case "rose":    return "bg-rose-500/15 border-rose-500/25 text-rose-300";
    case "violet":  return "bg-violet-500/15 border-violet-500/25 text-violet-300";
    case "blue":    return "bg-blue-500/15 border-blue-500/25 text-blue-300";
    case "fuchsia": return "bg-fuchsia-500/15 border-fuchsia-500/25 text-fuchsia-300";
    case "lime":    return "bg-lime-500/15 border-lime-500/25 text-lime-300";
    case "orange":  return "bg-orange-500/15 border-orange-500/25 text-orange-300";
    default:        return "bg-gray-500/15 border-gray-500/25 text-gray-300";
  }
}

export function accentSolidBg(accent: CategoryStyle["accent"]): string {
  switch (accent) {
    case "emerald": return "bg-emerald-500";
    case "sky":     return "bg-sky-500";
    case "amber":   return "bg-amber-500";
    case "rose":    return "bg-rose-500";
    case "violet":  return "bg-violet-500";
    case "blue":    return "bg-blue-500";
    case "fuchsia": return "bg-fuchsia-500";
    case "lime":    return "bg-lime-500";
    case "orange":  return "bg-orange-500";
    default:        return "bg-gray-500";
  }
}
