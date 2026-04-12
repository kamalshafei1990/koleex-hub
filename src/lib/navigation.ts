/* ---------------------------------------------------------------------------
   navigation — single source of truth for all Koleex Hub app definitions
   and sidebar group structure.

   This file is the data layer. It knows nothing about rendering — it just
   exports typed arrays and helper functions that the Sidebar, AllApps grid,
   MainHeader breadcrumb, and future role-based visibility engine all read.

   To add an app:       push into APP_REGISTRY.
   To reorder sidebar:  move items inside SIDEBAR_GROUPS.
   To hide by role:     fill the `visibleTo` array (engine coming later).
   --------------------------------------------------------------------------- */

import {
  LayoutGrid, Package, Warehouse, ShoppingCart, DollarSign,
  FileText, TrendingUp, Layers, ClipboardList, Receipt, Calculator,
  Users, Truck, Contact, Globe, CreditCard, Briefcase, UserSearch,
  Star, Clock, CalendarCheck, MessageSquare, Calendar, CheckSquare,
  Megaphone, Monitor, Bell, Kanban, FolderKanban, BookOpen, Library, Database,
  Sparkles, Settings, Shield, Inbox, PanelTop, Tag,
  type LucideIcon,
} from "lucide-react";

/* ═══════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════ */

/** Every navigable app in the platform. */
export interface AppDef {
  id: string;
  /** Translation key, e.g. "app.products" */
  tKey: string;
  /** Fallback English name */
  name: string;
  icon: LucideIcon;
  route: string;
  /** Whether the page is built and navigable today */
  active: boolean;
  /**
   * Future role-based visibility.
   * undefined / empty → everyone can see.
   * ["admin","sales"] → only those roles.
   */
  visibleTo?: string[];
}

/** A sidebar navigation group (collapsible section). */
export interface SidebarGroup {
  id: string;
  tKey: string;
  label: string;
  icon: LucideIcon;
  /** Ordered app IDs that belong to this group */
  appIds: string[];
  /** Future role-based visibility */
  visibleTo?: string[];
}

/* ═══════════════════════════════════════════════════
   APP REGISTRY — every app in Koleex Hub
   ═══════════════════════════════════════════════════ */

export const APP_REGISTRY: AppDef[] = [
  /* ── Operations ── */
  { id: "products",         tKey: "app.products",         name: "Products",          icon: Package,       route: "/products",         active: true  },
  { id: "inventory",        tKey: "app.inventory",        name: "Inventory",         icon: Warehouse,     route: "/products",         active: true  },
  { id: "purchase",         tKey: "app.purchase",         name: "Purchases",         icon: ShoppingCart,   route: "/purchase",         active: false },
  { id: "landed-cost",      tKey: "app.landed-cost",      name: "Landed Cost",       icon: DollarSign,    route: "/landed-cost",      active: true  },
  { id: "catalogs",         tKey: "app.catalogs",         name: "Catalogs",          icon: Library,       route: "/catalogs",         active: true  },
  { id: "documents",        tKey: "app.documents",        name: "Documents",         icon: FileText,      route: "/documents",        active: false },

  /* ── Commercial ── */
  { id: "sales",            tKey: "app.sales",            name: "Sales",             icon: TrendingUp,    route: "/sales",            active: false },
  { id: "crm",              tKey: "app.crm",              name: "CRM",               icon: Layers,        route: "/crm",              active: true  },
  { id: "quotations",       tKey: "app.quotations",       name: "Quotations",        icon: ClipboardList, route: "/quotations",       active: true  },
  { id: "invoices",         tKey: "app.invoices",         name: "Invoices",          icon: Receipt,       route: "/invoices",         active: false },
  { id: "customers",        tKey: "app.customers",        name: "Customers",         icon: Users,         route: "/customers",        active: true  },
  { id: "suppliers",        tKey: "app.suppliers",        name: "Suppliers",         icon: Truck,         route: "/suppliers",        active: true  },
  { id: "contacts",         tKey: "app.contacts",         name: "Contacts",          icon: Contact,       route: "/contacts",         active: true  },
  { id: "markets",          tKey: "app.markets",          name: "Markets",           icon: Globe,         route: "/markets",          active: true  },

  /* ── Finance ── */
  { id: "finance",          tKey: "app.finance",          name: "Finance",           icon: CreditCard,    route: "/finance",          active: false },
  { id: "expenses",         tKey: "app.expenses",         name: "Expenses",          icon: Briefcase,     route: "/expenses",         active: false },

  /* ── People ── */
  { id: "employees",        tKey: "app.employees",        name: "Employees",         icon: Users,         route: "/employees",        active: true  },
  { id: "recruitment",      tKey: "app.recruitment",      name: "Recruitment",       icon: UserSearch,    route: "/recruitment",      active: false },
  { id: "appraisals",       tKey: "app.appraisals",       name: "Appraisals",        icon: Star,          route: "/appraisals",       active: false },
  { id: "appointments",     tKey: "app.appointments",     name: "Appointments",      icon: Clock,         route: "/appointments",     active: false },
  { id: "attendance",       tKey: "app.attendance",       name: "Attendance",        icon: CalendarCheck, route: "/attendance",       active: false },

  /* ── Communication ── */
  { id: "discuss",          tKey: "app.discuss",          name: "Discuss",           icon: MessageSquare, route: "/discuss",          active: true  },
  { id: "calendar",         tKey: "app.calendar",         name: "Calendar",          icon: Calendar,      route: "/calendar",         active: true  },
  { id: "todo",             tKey: "app.todo",             name: "To-do",             icon: CheckSquare,   route: "/todo",             active: true  },

  /* ── Marketing & Growth ── */
  { id: "website",          tKey: "app.website",          name: "Website",           icon: PanelTop,      route: "/website",          active: true  },
  { id: "marketing",        tKey: "app.marketing",        name: "Marketing",         icon: Megaphone,     route: "/marketing",        active: false },
  { id: "marketing-cards",  tKey: "app.marketing-cards",  name: "Marketing Cards",   icon: Monitor,       route: "/marketing-cards",  active: false },
  { id: "events",           tKey: "app.events",           name: "Events",            icon: Bell,          route: "/events",           active: false },

  /* ── Planning ── */
  { id: "planning",         tKey: "app.planning",         name: "Planning",          icon: Kanban,        route: "/planning",         active: false },
  { id: "projects",         tKey: "app.projects",         name: "Projects",          icon: FolderKanban,  route: "/projects",         active: false },

  /* ── Knowledge ── */
  { id: "knowledge",        tKey: "app.knowledge",        name: "Knowledge",         icon: BookOpen,      route: "/knowledge",        active: false },
  { id: "database",         tKey: "app.database",         name: "Database",          icon: Database,      route: "/database",         active: false },
  { id: "ai",               tKey: "app.ai",               name: "AI",                icon: Sparkles,      route: "/ai",               active: false },

  /* ── System ── */
  { id: "accounts",         tKey: "app.accounts",         name: "Accounts",          icon: Users,         route: "/accounts",         active: true  },
  { id: "roles",            tKey: "app.roles",            name: "Roles & Permissions", icon: Shield,      route: "/roles",            active: false },
  { id: "settings",         tKey: "app.settings",         name: "Settings",          icon: Settings,      route: "/settings",         active: false },

  /* ── Not in sidebar — accessible via All Apps or direct URL ── */
  { id: "inbox",            tKey: "app.inbox",            name: "Koleex Mail",       icon: Inbox,         route: "/inbox",            active: true  },
  { id: "price-calculator", tKey: "app.price-calculator", name: "Price Calculator",  icon: Calculator,    route: "/price-calculator", active: true  },
  { id: "brands",           tKey: "app.brands",           name: "Brands",            icon: Tag,           route: "/brands",           active: true  },
  { id: "dashboard",        tKey: "app.dashboard",        name: "Dashboard",         icon: LayoutGrid,    route: "/dashboard",        active: false },
];

/* ═══════════════════════════════════════════════════
   SIDEBAR GROUPS — ordered, clean structure
   ═══════════════════════════════════════════════════ */

export const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    id: "operations",
    tKey: "cat.operations",
    label: "Operations",
    icon: Package,
    appIds: ["products", "inventory", "purchase", "landed-cost", "catalogs", "documents"],
  },
  {
    id: "commercial",
    tKey: "cat.commercial",
    label: "Commercial",
    icon: TrendingUp,
    appIds: ["sales", "crm", "quotations", "invoices", "customers", "suppliers", "contacts", "markets"],
  },
  {
    id: "finance",
    tKey: "cat.finance",
    label: "Finance",
    icon: CreditCard,
    appIds: ["finance", "expenses"],
  },
  {
    id: "people",
    tKey: "cat.people",
    label: "People",
    icon: Users,
    appIds: ["employees", "recruitment", "appraisals", "appointments", "attendance"],
  },
  {
    id: "communication",
    tKey: "cat.communication",
    label: "Communication",
    icon: MessageSquare,
    appIds: ["discuss", "calendar", "todo"],
  },
  {
    id: "marketing",
    tKey: "cat.marketing",
    label: "Marketing & Growth",
    icon: Megaphone,
    appIds: ["website", "marketing", "marketing-cards", "events"],
  },
  {
    id: "planning",
    tKey: "cat.planning",
    label: "Planning",
    icon: Kanban,
    appIds: ["planning", "projects"],
  },
  {
    id: "knowledge",
    tKey: "cat.knowledge",
    label: "Knowledge",
    icon: BookOpen,
    appIds: ["knowledge", "database", "ai"],
  },
  {
    id: "system",
    tKey: "cat.system",
    label: "System",
    icon: Settings,
    appIds: ["accounts", "roles", "settings"],
  },
];

/* ═══════════════════════════════════════════════════
   LOOKUP HELPERS
   ═══════════════════════════════════════════════════ */

const appMap = new Map(APP_REGISTRY.map((a) => [a.id, a]));

export function getApp(id: string): AppDef | undefined {
  return appMap.get(id);
}

export function getGroupApps(group: SidebarGroup): AppDef[] {
  return group.appIds
    .map((id) => appMap.get(id))
    .filter((a): a is AppDef => !!a);
}

/** Which sidebar group owns the current route? */
export function getActiveGroupId(pathname: string): string | null {
  for (const group of SIDEBAR_GROUPS) {
    for (const appId of group.appIds) {
      const app = appMap.get(appId);
      if (app && (pathname === app.route || pathname.startsWith(app.route + "/"))) {
        return group.id;
      }
    }
  }
  return null;
}

/** Which app is active based on the current route? */
export function getActiveAppId(pathname: string): string | null {
  for (const app of APP_REGISTRY) {
    if (pathname === app.route) return app.id;
  }
  for (const app of APP_REGISTRY) {
    if (pathname.startsWith(app.route + "/")) return app.id;
  }
  return null;
}

/** Map any app to its category for the All-Apps grid. */
export function getAppCategory(appId: string): string {
  for (const group of SIDEBAR_GROUPS) {
    if (group.appIds.includes(appId)) return group.id;
  }
  const extra: Record<string, string> = {
    inbox: "communication",
    "price-calculator": "commercial",
    brands: "operations",
    dashboard: "system",
  };
  return extra[appId] || "system";
}

/* ── Future role-based helpers (stubs) ── */

export function getVisibleGroups(_userRole?: string | null): SidebarGroup[] {
  // TODO: filter by visibleTo when roles engine ships
  return SIDEBAR_GROUPS;
}

export function getVisibleApps(_userRole?: string | null): AppDef[] {
  // TODO: filter by visibleTo
  return APP_REGISTRY;
}

/** Category metadata for the All-Apps grid (ordered). */
export const ALL_APPS_CATEGORIES = SIDEBAR_GROUPS.map((g) => ({
  id: g.id,
  tKey: g.tKey,
  label: g.label,
}));
