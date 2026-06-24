/* ---------------------------------------------------------------------------
   Route → module mapping (pure, shared by client tracker + server routes).

   Maps a pathname's first segment to a human-friendly module label used in
   the activity feed, presence "current module", and audit logs. Keep in sync
   with the app's top-level routes; unknown segments fall back to a Title-cased
   version of the segment so new modules still read sensibly.
   --------------------------------------------------------------------------- */

const MODULE_BY_SEGMENT: Record<string, string> = {
  "": "Home",
  products: "Products",
  "product-data": "Product Data",
  quotations: "Quotations",
  finance: "Finance",
  expenses: "Expenses",
  customers: "Customers",
  suppliers: "Suppliers",
  inventory: "Inventory",
  invoices: "Invoices",
  sales: "Sales",
  purchase: "Purchase",
  crm: "CRM",
  contacts: "Contacts",
  projects: "Projects",
  operations: "Operations",
  notes: "Notes",
  discuss: "Discuss",
  todo: "To-do",
  ai: "AI",
  hr: "HR",
  employees: "HR",
  roles: "Roles & Permissions",
  users: "User Management",
  settings: "Settings",
  admin: "Admin",
  "super-admin": "Super Admin",
  qa: "QA",
  database: "Database",
  "commercial-policy": "Commercial Policy",
  catalogs: "Catalogs",
  knowledge: "Knowledge",
};

function titleCase(seg: string): string {
  return seg
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Friendly module label for a pathname, e.g. "/product-data/123" → "Product Data". */
export function routeToModule(pathname: string | null | undefined): string {
  if (!pathname) return "Home";
  const clean = pathname.split("?")[0].split("#")[0];
  const seg = clean.replace(/^\/+/, "").split("/")[0] ?? "";
  if (seg in MODULE_BY_SEGMENT) return MODULE_BY_SEGMENT[seg];
  return seg ? titleCase(seg) : "Home";
}
