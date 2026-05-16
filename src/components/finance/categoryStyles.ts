/* Visual mapping for the system expense categories.
   Each category gets an RrIcon name (rendered via the shared
   uicons-regular-rounded component) and a brand accent colour.

   The mapping is keyed off the category NAME (the system seed
   inserts these exact names; tenant-custom categories fall through
   to the "Other" style). Sub-categories inherit their parent's
   accent so the picker reads as a coherent colour-coded grid. */

import type { RrIconName } from "@/components/ui/RrIcon";

export type CategoryAccent =
  | "emerald" | "sky" | "amber" | "rose" | "violet"
  | "blue"    | "fuchsia" | "lime" | "orange" | "gray";

export interface CategoryStyle {
  /** RrIcon name. Falls back to "info" if the category isn't known. */
  icon: RrIconName;
  /** Brand accent — drives the chip bg + the parent-group hue. */
  accent: CategoryAccent;
}

/* ── Parent categories ── */
const PARENT_STYLES: Record<string, CategoryStyle> = {
  "Shipping & Logistics":   { icon: "truck-side",  accent: "blue"    },
  "Customs & Duties":       { icon: "stamp",       accent: "amber"   },
  "Banking & FX":           { icon: "bank",        accent: "emerald" },
  "Marketing":              { icon: "megaphone",   accent: "fuchsia" },
  "Travel & Entertainment": { icon: "plane",       accent: "sky"     },
  "Office & Operations":    { icon: "building",    accent: "violet"  },
  "Payroll & Benefits":     { icon: "users",       accent: "lime"    },
  "Professional Services":  { icon: "briefcase",   accent: "orange"  },
  "Inventory & Packaging":  { icon: "box-open",    accent: "rose"    },
  "Other":                  { icon: "info",        accent: "gray"    },
};

/* ── Sub-categories ── icon + accent per name. Accent inherits from parent. */
const SUB_ICON: Record<string, RrIconName> = {
  // Shipping & Logistics
  "Sea Freight":          "ship-side",
  "Air Freight":          "plane",
  "Land Freight":         "truck-container",
  "Courier & Express":    "shipping-fast",
  "Warehousing":          "pallet",
  // Customs & Duties
  "Import Duties":        "stamp",
  "Export Documentation": "file-invoice",
  "Taxes & Tariffs":      "tax",
  // Banking & FX
  "Bank Fees":            "credit-card",
  "FX Differences":       "coins",
  "Loan Interest":        "percentage",
  "Wire Transfer Fees":   "money",
  // Marketing
  "Digital Ads":          "bullseye-arrow",
  "Trade Shows":          "flag-checkered",
  "Branding & Design":    "palette",
  "PR & Media":           "newspaper",
  "Content Production":   "camera",
  // Travel & Entertainment
  "Flights":              "plane-departure",
  "Hotels":               "hotel",
  "Meals & Restaurants":  "restaurant",
  "Ground Transport":     "taxi",
  "Client Entertainment": "cocktail",
  // Office & Operations
  "Rent":                 "home",
  "Utilities":            "bulb",
  "Internet & Telecom":   "wifi",
  "Software & SaaS":      "laptop",
  "Office Supplies":      "clipboard",
  "Cleaning":             "broom",
  // Payroll & Benefits
  "Salaries":             "money",
  "Bonuses & Commissions":"award",
  "Health Insurance":     "heart-rate",
  "Social Insurance":     "shield-check",
  "Training & Development":"graduation-cap",
  // Professional Services
  "Legal":                "gavel",
  "Accounting & Audit":   "calculator",
  "Consulting":           "user-headset",
  "IT Services":          "computer",
  // Inventory & Packaging
  "Raw Materials":        "pallet",
  "Packaging":            "box-circle-check",
  "Tools & Equipment":    "tools",
  "Maintenance & Repair": "hammer",
};

const SUB_ACCENT: Record<string, CategoryAccent> = {
  // Shipping & Logistics
  "Sea Freight":          "blue",
  "Air Freight":          "blue",
  "Land Freight":         "blue",
  "Courier & Express":    "blue",
  "Warehousing":          "blue",
  // Customs & Duties
  "Import Duties":        "amber",
  "Export Documentation": "amber",
  "Taxes & Tariffs":      "amber",
  // Banking & FX
  "Bank Fees":            "emerald",
  "FX Differences":       "emerald",
  "Loan Interest":        "emerald",
  "Wire Transfer Fees":   "emerald",
  // Marketing
  "Digital Ads":          "fuchsia",
  "Trade Shows":          "fuchsia",
  "Branding & Design":    "fuchsia",
  "PR & Media":           "fuchsia",
  "Content Production":   "fuchsia",
  // Travel & Entertainment
  "Flights":              "sky",
  "Hotels":               "sky",
  "Meals & Restaurants":  "sky",
  "Ground Transport":     "sky",
  "Client Entertainment": "sky",
  // Office & Operations
  "Rent":                 "violet",
  "Utilities":            "violet",
  "Internet & Telecom":   "violet",
  "Software & SaaS":      "violet",
  "Office Supplies":      "violet",
  "Cleaning":             "violet",
  // Payroll & Benefits
  "Salaries":             "lime",
  "Bonuses & Commissions":"lime",
  "Health Insurance":     "lime",
  "Social Insurance":     "lime",
  "Training & Development":"lime",
  // Professional Services
  "Legal":                "orange",
  "Accounting & Audit":   "orange",
  "Consulting":           "orange",
  "IT Services":          "orange",
  // Inventory & Packaging
  "Raw Materials":        "rose",
  "Packaging":            "rose",
  "Tools & Equipment":    "rose",
  "Maintenance & Repair": "rose",
};

/** Resolve a CategoryStyle from a category name + (optional) icon hint stored on the row. */
export function styleForCategory(
  name: string | null | undefined,
  iconHint?: string | null,
): CategoryStyle {
  if (!name) return PARENT_STYLES.Other;

  // 1) Parent match (also covers "Other")
  const parent = PARENT_STYLES[name];
  if (parent) return parent;

  // 2) Sub-category — accent + icon resolved by name.
  //    iconHint (if provided by the caller from the DB row) wins.
  const accent = SUB_ACCENT[name] ?? "gray";
  const icon =
    (iconHint as RrIconName | undefined) ?? SUB_ICON[name] ?? "info";
  return { icon, accent };
}

/* Back-compat shim — older callers expect a `.glyph` field. We expose
   the icon name as a string so existing string-based code paths keep
   compiling without runtime errors. New code should read `.icon`. */
export function legacyGlyph(style: CategoryStyle): string {
  return style.icon;
}

export function accentBgClass(accent: CategoryAccent): string {
  switch (accent) {
    case "emerald": return "bg-emerald-500/12 border-emerald-500/25 text-emerald-300";
    case "sky":     return "bg-sky-500/12 border-sky-500/25 text-sky-300";
    case "amber":   return "bg-amber-500/12 border-amber-500/25 text-amber-300";
    case "rose":    return "bg-rose-500/12 border-rose-500/25 text-rose-300";
    case "violet":  return "bg-violet-500/12 border-violet-500/25 text-violet-300";
    case "blue":    return "bg-blue-500/12 border-blue-500/25 text-blue-300";
    case "fuchsia": return "bg-fuchsia-500/12 border-fuchsia-500/25 text-fuchsia-300";
    case "lime":    return "bg-lime-500/12 border-lime-500/25 text-lime-300";
    case "orange":  return "bg-orange-500/12 border-orange-500/25 text-orange-300";
    default:        return "bg-gray-500/12 border-gray-500/25 text-gray-300";
  }
}

export function accentSolidBg(accent: CategoryAccent): string {
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

/** Active (selected) ring style for the picker tiles. */
export function accentActiveClass(accent: CategoryAccent): string {
  switch (accent) {
    case "emerald": return "border-emerald-500/60 bg-emerald-500/20 text-emerald-200";
    case "sky":     return "border-sky-500/60 bg-sky-500/20 text-sky-200";
    case "amber":   return "border-amber-500/60 bg-amber-500/20 text-amber-200";
    case "rose":    return "border-rose-500/60 bg-rose-500/20 text-rose-200";
    case "violet":  return "border-violet-500/60 bg-violet-500/20 text-violet-200";
    case "blue":    return "border-blue-500/60 bg-blue-500/20 text-blue-200";
    case "fuchsia": return "border-fuchsia-500/60 bg-fuchsia-500/20 text-fuchsia-200";
    case "lime":    return "border-lime-500/60 bg-lime-500/20 text-lime-200";
    case "orange":  return "border-orange-500/60 bg-orange-500/20 text-orange-200";
    default:        return "border-white/[0.22] bg-white/[0.10] text-gray-100";
  }
}
