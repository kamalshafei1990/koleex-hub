/* ---------------------------------------------------------------------------
   KOLEEX Visual Library — General Icons Registry taxonomy.

   The structured visual vocabulary for the whole KOLEEX Hub. Categories +
   subcategories come FIRST; icon files are attached later. This is the
   "enterprise visual language infrastructure," not a folder of files.
   --------------------------------------------------------------------------- */

export interface IconCategory {
  key: string;            // stable key + asset-code segment hint
  label: string;
  code: string;           // short code used in ICO-{code}-...
  description: string;
  subcategories: string[];
}

export const GENERAL_ICON_CATEGORIES: IconCategory[] = [
  { key: "navigation",   label: "Navigation",            code: "NAV",  description: "Movement & wayfinding across the Hub", subcategories: ["Menu", "Tabs", "Arrows", "Breadcrumbs", "Home"] },
  { key: "actions",      label: "Actions",               code: "ACT",  description: "Things the user does", subcategories: ["Create", "Edit", "Delete", "Save", "Share", "Import/Export"] },
  { key: "status",       label: "Status & Alerts",       code: "STAT", description: "State, feedback and alerts", subcategories: ["Success", "Warning", "Error", "Pending", "Approved", "Rejected"] },
  { key: "communication",label: "Communication",         code: "COMM", description: "Messaging & contact", subcategories: ["Chat", "Email", "Phone", "Notification", "Video call"] },
  { key: "users",        label: "Users & Identity",      code: "USR",  description: "People, roles & profiles", subcategories: ["User", "Users", "Profile", "Team", "Contact"] },
  { key: "finance",      label: "Finance",               code: "FIN",  description: "Money, billing & accounting", subcategories: ["Invoice", "Payment", "Wallet", "Tax", "Currency", "Bank"] },
  { key: "inventory",    label: "Inventory & Logistics", code: "INV",  description: "Stock, warehouse & shipping", subcategories: ["Warehouse", "Box", "Shipping", "Tracking", "Pallet", "Barcode"] },
  { key: "analytics",    label: "Analytics & Dashboard", code: "ANL",  description: "Charts, KPIs & reporting", subcategories: ["Chart", "Graph", "Growth", "KPI", "Dashboard"] },
  { key: "ai",           label: "AI & Automation",       code: "AI",   description: "Intelligence & automation", subcategories: ["AI", "Automation", "Workflow", "Bot", "Magic"] },
  { key: "files",        label: "Files & Media",         code: "FILE", description: "Documents & media", subcategories: ["File", "Folder", "Image", "Video", "Audio", "PDF"] },
  { key: "security",     label: "Security & Permissions",code: "SEC",  description: "Access, keys & protection", subcategories: ["Lock", "Key", "Shield", "Permissions", "Verified"] },
  { key: "business",     label: "Business & Companies",  code: "BIZ",  description: "Organizations & partners", subcategories: ["Company", "Supplier", "Customer", "Building", "Handshake"] },
  { key: "commerce",     label: "Commerce & Orders",     code: "COM",  description: "Selling, carts & orders", subcategories: ["Cart", "Order", "Tag", "Discount", "Receipt"] },
  { key: "manufacturing",label: "Manufacturing",         code: "MFG",  description: "Production & factory (generic)", subcategories: ["Factory", "Gear", "Tools", "Production", "Quality"] },
  { key: "time",         label: "Time & Scheduling",     code: "TIME", description: "Dates, time & planning", subcategories: ["Calendar", "Clock", "Timer", "Schedule", "History"] },
  { key: "devices",      label: "Devices & Technology",  code: "DEV",  description: "Hardware & connectivity", subcategories: ["Laptop", "Mobile", "Cloud", "Wifi", "Server"] },
  { key: "database",     label: "Database & Systems",    code: "SYS",  description: "Data, storage & systems", subcategories: ["Database", "Storage", "Sync", "Settings", "Integration"] },
  { key: "maps",         label: "Maps & Location",       code: "MAP",  description: "Places & geography", subcategories: ["Pin", "Map", "Globe", "Route", "Region"] },
  { key: "documents",    label: "Documents & Reports",   code: "DOC",  description: "Paperwork & reports", subcategories: ["Document", "Report", "Contract", "Clipboard", "Signature"] },
  { key: "misc",         label: "Miscellaneous",         code: "MISC", description: "Everything else", subcategories: ["General", "Other"] },
];

export const CATEGORY_BY_KEY: Record<string, IconCategory> =
  Object.fromEntries(GENERAL_ICON_CATEGORIES.map((c) => [c.key, c]));

/** Map a category KEY → its short asset-code segment (e.g. navigation → NAV). */
export const CATEGORY_CODE_BY_KEY: Record<string, string> =
  Object.fromEntries(GENERAL_ICON_CATEGORIES.map((c) => [c.key, c.code]));

export type FetchedIconCategory = { key: string; label: string; code: string; custom?: boolean };

/**
 * Fetch the live category list (built-in defaults + this tenant's custom
 * categories) from the API. Falls back to the built-in defaults on error so
 * the UI never breaks. Client-side only.
 */
export async function fetchIconCategories(): Promise<FetchedIconCategory[]> {
  try {
    const res = await fetch("/api/visual-library/categories", { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const j = (await res.json()) as { categories?: FetchedIconCategory[] };
    return j.categories?.length ? j.categories : GENERAL_ICON_CATEGORIES.map((c) => ({ key: c.key, label: c.label, code: c.code }));
  } catch {
    return GENERAL_ICON_CATEGORIES.map((c) => ({ key: c.key, label: c.label, code: c.code }));
  }
}

/** POST a new custom category. Returns the created category or throws. */
export async function createIconCategory(label: string, code?: string): Promise<FetchedIconCategory> {
  const res = await fetch("/api/visual-library/categories", {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, code }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j as { error?: string }).error ?? "Failed to add category");
  return (j as { category: FetchedIconCategory }).category;
}
