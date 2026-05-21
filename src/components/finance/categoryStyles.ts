/* Visual mapping for the system expense categories.
   Each category gets an RrIcon name (rendered via the shared
   uicons-regular-rounded component) and a brand accent colour.

   The mapping is keyed off the category NAME (the system seed
   inserts these exact names; tenant-custom categories fall through
   to the "Other" style). Sub-categories inherit their parent's
   accent so the picker reads as a coherent colour-coded grid. */

import type { RrIconName } from "@/components/ui/RrIcon";

export type CategoryAccent =
  | "emerald" | "sky"    | "amber" | "rose"  | "violet"
  | "blue"    | "fuchsia"| "lime"  | "orange"| "gray"
  | "teal"    | "slate"  | "indigo"| "yellow"| "red"
  | "pink";

export interface CategoryStyle {
  /** RrIcon name. Falls back to "info" if the category isn't known. */
  icon: RrIconName;
  /** Brand accent — drives the chip bg + the parent-group hue. */
  accent: CategoryAccent;
}

/* ── Parent categories ── */
const PARENT_STYLES: Record<string, CategoryStyle> = {
  "Shipping & Logistics":   { icon: "truck-side",          accent: "blue"    },
  "Customs & Duties":       { icon: "stamp",               accent: "amber"   },
  "Banking & FX":           { icon: "bank",                accent: "emerald" },
  "Marketing":              { icon: "megaphone",           accent: "fuchsia" },
  "Travel & Entertainment": { icon: "plane",               accent: "sky"     },
  "Office & Operations":    { icon: "building",            accent: "violet"  },
  "Payroll & Benefits":     { icon: "users",               accent: "lime"    },
  "Professional Services":  { icon: "briefcase",           accent: "orange"  },
  "Inventory & Packaging":  { icon: "box-open",            accent: "rose"    },
  "Technology & IT":        { icon: "laptop",              accent: "teal"    },
  "Vehicles & Fleet":       { icon: "car-side",            accent: "slate"   },
  "Real Estate & Property": { icon: "home",                accent: "indigo"  },
  "Insurance & Risk":       { icon: "shield-check",        accent: "yellow"  },
  "Taxes & Government":     { icon: "gavel",               accent: "red"     },
  "Donations & CSR":        { icon: "hand-holding-heart",  accent: "pink"    },
  "Other":                  { icon: "info",                accent: "gray"    },
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
  // — Wave 2 additions —
  // Shipping & Logistics
  "Last-Mile Delivery":      "delivery-truck",
  "Freight Forwarder Fees":  "briefcase",
  "Container Demurrage":     "clock",
  "Port Handling":           "pallet",
  "Cargo Insurance":         "shield-check",
  "Tracking & Telematics":   "signal-stream",
  // Customs & Duties
  "Customs Broker Fees":     "briefcase",
  "Inspection & Compliance": "badge-check",
  "Anti-Dumping Duties":     "gavel",
  "VAT on Imports":          "percentage",
  "L/C & Trade Finance Fees":"contract",
  // Banking & FX
  "Account Maintenance":   "bank",
  "Card Processing Fees":  "credit-card",
  "Payment Gateway Fees":  "laptop",
  "Hedging Costs":         "balance-scale-left",
  "Factoring Fees":        "handshake",
  "Cheque Fees":           "file",
  // Marketing / Sales
  "Print Advertising":     "newspaper",
  "Outdoor & Billboards":  "flag-alt",
  "SEO & Analytics":       "search",
  "Influencer Marketing":  "microphone",
  "Email Marketing":       "paper-plane",
  "Affiliate Programs":    "handshake",
  "Market Research":       "clipboard",
  "Promotional Materials": "gift",
  "Sponsorships":          "award",
  "Sales Commissions":     "handshake",
  // Travel & Entertainment
  "Conference Fees":       "ticket",
  "Car Rental":            "car-side",
  "Parking & Tolls":       "parking",
  "Visa & Passport":       "stamp",
  "Per Diem":              "coins",
  // Office & Operations
  "Furniture":             "chair-office",
  "Coffee & Pantry":       "coffee",
  "Postage & Courier":     "paper-plane",
  "Printing & Stationery": "print",
  "Security & Alarm":      "lock",
  "Repairs & Maintenance": "tools",
  "Storage":               "box-open",
  "Subscriptions":         "newspaper",
  // Payroll & Benefits
  "Hourly Wages":          "clock",
  "Overtime Pay":          "clock",
  "Severance & Final Pay": "file",
  "Pension Contributions": "piggy-bank",
  "Recruitment":           "user-headset",
  "Wellness Programs":     "heart-rate",
  "Employee Gifts":        "gift",
  "Visa & Work Permits":   "id-badge",
  // Professional Services
  "Notary & Authentication":"stamp",
  "Translation Services":  "file",
  "Marketing Agency":      "megaphone",
  "Design Agency":         "palette",
  "Tax Advisory":          "calculator",
  "HR Outsourcing":        "users",
  // Inventory & Production
  "Components & Parts":    "box-open",
  "Sample Costs":          "gift",
  "Quality Control":       "badge-check",
  "Stock Write-offs":      "trash",
  "Labelling & Tags":      "stamp",
  // Technology & IT
  "Cloud Hosting":             "cloud",
  "Domain & DNS":              "wifi",
  "Security & SSL":            "shield-check",
  "Database & Storage":        "database",
  "Developer Tools & Licenses":"laptop",
  "Hardware":                  "computer",
  "Phones & Devices":          "laptop",
  "IT Support Contracts":      "user-headset",
  // Vehicles & Fleet
  "Fuel":                  "gas-pump",
  "Vehicle Maintenance":   "car-mechanic",
  "Vehicle Insurance":     "shield-check",
  "Vehicle Lease":         "car-side",
  "Vehicle Tolls":         "parking",
  "Driver Salary":         "money",
  "Vehicle Registration":  "file",
  // Real Estate & Property
  "Property Tax":          "tax",
  "Building Insurance":    "shield-check",
  "Mortgage Interest":     "percentage",
  "Capital Improvements":  "hammer",
  "Property Management":   "briefcase",
  // Insurance & Risk
  "Property Insurance":    "home",
  "Liability Insurance":   "gavel",
  "D&O Insurance":         "id-badge",
  "Workers Compensation":  "heart-rate",
  "Cyber Insurance":       "laptop",
  // Taxes & Government
  "Corporate Income Tax":  "tax",
  "VAT / GST":             "percentage",
  "Withholding Tax":       "stamp",
  "Government Fees":       "file-invoice",
  "Penalties & Fines":     "gavel",
  // Donations & CSR
  "Charitable Donations":  "hand-holding-heart",
  "Community Sponsorships":"handshake",
  "Environmental Programs":"leaf",
  "Employee Volunteering": "users",
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
  // — Wave 2 additions —
  // Shipping & Logistics
  "Last-Mile Delivery":      "blue",
  "Freight Forwarder Fees":  "blue",
  "Container Demurrage":     "blue",
  "Port Handling":           "blue",
  "Cargo Insurance":         "blue",
  "Tracking & Telematics":   "blue",
  // Customs & Duties
  "Customs Broker Fees":     "amber",
  "Inspection & Compliance": "amber",
  "Anti-Dumping Duties":     "amber",
  "VAT on Imports":          "amber",
  "L/C & Trade Finance Fees":"amber",
  // Banking & FX
  "Account Maintenance":   "emerald",
  "Card Processing Fees":  "emerald",
  "Payment Gateway Fees":  "emerald",
  "Hedging Costs":         "emerald",
  "Factoring Fees":        "emerald",
  "Cheque Fees":           "emerald",
  // Marketing / Sales
  "Print Advertising":     "fuchsia",
  "Outdoor & Billboards":  "fuchsia",
  "SEO & Analytics":       "fuchsia",
  "Influencer Marketing":  "fuchsia",
  "Email Marketing":       "fuchsia",
  "Affiliate Programs":    "fuchsia",
  "Market Research":       "fuchsia",
  "Promotional Materials": "fuchsia",
  "Sponsorships":          "fuchsia",
  "Sales Commissions":     "fuchsia",
  // Travel & Entertainment
  "Conference Fees":       "sky",
  "Car Rental":            "sky",
  "Parking & Tolls":       "sky",
  "Visa & Passport":       "sky",
  "Per Diem":              "sky",
  // Office & Operations
  "Furniture":             "violet",
  "Coffee & Pantry":       "violet",
  "Postage & Courier":     "violet",
  "Printing & Stationery": "violet",
  "Security & Alarm":      "violet",
  "Repairs & Maintenance": "violet",
  "Storage":               "violet",
  "Subscriptions":         "violet",
  // Payroll & Benefits
  "Hourly Wages":          "lime",
  "Overtime Pay":          "lime",
  "Severance & Final Pay": "lime",
  "Pension Contributions": "lime",
  "Recruitment":           "lime",
  "Wellness Programs":     "lime",
  "Employee Gifts":        "lime",
  "Visa & Work Permits":   "lime",
  // Professional Services
  "Notary & Authentication":"orange",
  "Translation Services":  "orange",
  "Marketing Agency":      "orange",
  "Design Agency":         "orange",
  "Tax Advisory":          "orange",
  "HR Outsourcing":        "orange",
  // Inventory & Production
  "Components & Parts":    "rose",
  "Sample Costs":          "rose",
  "Quality Control":       "rose",
  "Stock Write-offs":      "rose",
  "Labelling & Tags":      "rose",
  // Technology & IT
  "Cloud Hosting":             "teal",
  "Domain & DNS":              "teal",
  "Security & SSL":            "teal",
  "Database & Storage":        "teal",
  "Developer Tools & Licenses":"teal",
  "Hardware":                  "teal",
  "Phones & Devices":          "teal",
  "IT Support Contracts":      "teal",
  // Vehicles & Fleet
  "Fuel":                  "slate",
  "Vehicle Maintenance":   "slate",
  "Vehicle Insurance":     "slate",
  "Vehicle Lease":         "slate",
  "Vehicle Tolls":         "slate",
  "Driver Salary":         "slate",
  "Vehicle Registration":  "slate",
  // Real Estate & Property
  "Property Tax":          "indigo",
  "Building Insurance":    "indigo",
  "Mortgage Interest":     "indigo",
  "Capital Improvements":  "indigo",
  "Property Management":   "indigo",
  // Insurance & Risk
  "Property Insurance":    "yellow",
  "Liability Insurance":   "yellow",
  "D&O Insurance":         "yellow",
  "Workers Compensation":  "yellow",
  "Cyber Insurance":       "yellow",
  // Taxes & Government
  "Corporate Income Tax":  "red",
  "VAT / GST":             "red",
  "Withholding Tax":       "red",
  "Government Fees":       "red",
  "Penalties & Fines":     "red",
  // Donations & CSR
  "Charitable Donations":  "pink",
  "Community Sponsorships":"pink",
  "Environmental Programs":"pink",
  "Employee Volunteering": "pink",
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
    case "emerald": return "bg-emerald-500/12 border-emerald-500/25 text-emerald-600 dark:text-emerald-300";
    case "sky":     return "bg-sky-500/12 border-sky-500/25 text-sky-600 dark:text-sky-300";
    case "amber":   return "bg-amber-500/12 border-amber-500/25 text-amber-600 dark:text-amber-300";
    case "rose":    return "bg-rose-500/12 border-rose-500/25 text-rose-600 dark:text-rose-300";
    case "violet":  return "bg-violet-500/12 border-violet-500/25 text-violet-600 dark:text-violet-300";
    case "blue":    return "bg-blue-500/12 border-blue-500/25 text-blue-600 dark:text-blue-300";
    case "fuchsia": return "bg-fuchsia-500/12 border-fuchsia-500/25 text-fuchsia-600 dark:text-fuchsia-300";
    case "lime":    return "bg-lime-500/12 border-lime-500/25 text-lime-300";
    case "orange":  return "bg-orange-500/12 border-orange-500/25 text-orange-600 dark:text-orange-300";
    case "teal":    return "bg-teal-500/12 border-teal-500/25 text-teal-600 dark:text-teal-300";
    case "slate":   return "bg-slate-500/15 border-slate-500/30 text-slate-200";
    case "indigo":  return "bg-indigo-500/12 border-indigo-500/25 text-indigo-600 dark:text-indigo-300";
    case "yellow":  return "bg-yellow-500/12 border-yellow-500/30 text-yellow-700 dark:text-yellow-200";
    case "red":     return "bg-red-500/12 border-red-500/25 text-red-600 dark:text-red-300";
    case "pink":    return "bg-pink-500/12 border-pink-500/25 text-pink-600 dark:text-pink-300";
    default:        return "bg-gray-500/12 border-gray-500/25 text-[var(--text-highlight)]";
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
    case "teal":    return "bg-teal-500";
    case "slate":   return "bg-slate-500";
    case "indigo":  return "bg-indigo-500";
    case "yellow":  return "bg-yellow-500";
    case "red":     return "bg-red-500";
    case "pink":    return "bg-pink-500";
    default:        return "bg-gray-500";
  }
}

/** Active (selected) ring style for the picker tiles. */
export function accentActiveClass(accent: CategoryAccent): string {
  switch (accent) {
    case "emerald": return "border-emerald-500/60 bg-emerald-500/20 text-emerald-700 dark:text-emerald-200";
    case "sky":     return "border-sky-500/60 bg-sky-500/20 text-sky-700 dark:text-sky-200";
    case "amber":   return "border-amber-500/60 bg-amber-500/20 text-amber-700 dark:text-amber-200";
    case "rose":    return "border-rose-500/60 bg-rose-500/20 text-rose-700 dark:text-rose-200";
    case "violet":  return "border-violet-500/60 bg-violet-500/20 text-violet-700 dark:text-violet-200";
    case "blue":    return "border-blue-500/60 bg-blue-500/20 text-blue-700 dark:text-blue-200";
    case "fuchsia": return "border-fuchsia-500/60 bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-200";
    case "lime":    return "border-lime-500/60 bg-lime-500/20 text-lime-200";
    case "orange":  return "border-orange-500/60 bg-orange-500/20 text-orange-700 dark:text-orange-200";
    case "teal":    return "border-teal-500/60 bg-teal-500/20 text-teal-700 dark:text-teal-200";
    case "slate":   return "border-slate-400/60 bg-slate-500/25 text-slate-100";
    case "indigo":  return "border-indigo-500/60 bg-indigo-500/20 text-indigo-700 dark:text-indigo-200";
    case "yellow":  return "border-yellow-500/60 bg-yellow-500/20 text-yellow-800 dark:text-yellow-100";
    case "red":     return "border-red-500/60 bg-red-500/20 text-red-700 dark:text-red-200";
    case "pink":    return "border-pink-500/60 bg-pink-500/20 text-pink-700 dark:text-pink-200";
    default:        return "border-[var(--border-strong)] bg-[var(--bg-surface-hover)] text-[var(--text-primary)]";
  }
}
