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

/* The global document.title is the same on every page ("KOLEEX — …"), so it's
   noise in the activity feed. Treat it (and anything starting with KOLEEX) as
   generic and fall back to a meaningful, event-based label instead. */
const GENERIC_TITLE = /^koleex/i;

/** Human-readable label for an activity event — what the user actually did. */
export function eventLabel(e: {
  event_type: string;
  module?: string | null;
  route?: string | null;
  title?: string | null;
}): string {
  const mod = e.module || routeToModule(e.route);
  switch (e.event_type) {
    case "page_view":
      return `Viewed ${mod}`;
    case "session_start":
      return "Opened the app";
    case "session_end":
      return "Left the app";
    case "idle":
      return "Went idle";
    case "active":
      return "Became active";
    case "login":
      return e.title && !GENERIC_TITLE.test(e.title) ? e.title : "Signed in";
    case "logout":
      return "Signed out";
    case "session_revoked":
      return e.title || "Session force-logged-out by admin";
  }
  if (e.title && !GENERIC_TITLE.test(e.title)) return e.title;
  return e.event_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
