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

import AppsIcon from "@/components/icons/ui/AppsIcon";
import CalendarCheckIcon from "@/components/icons/ui/CalendarCheckIcon";
import ManagementIcon from "@/components/icons/ManagementIcon";
import CrmIcon from "@/components/icons/CrmIcon";
import TodoIcon from "@/components/icons/TodoIcon";
import NotesIcon from "@/components/icons/NotesIcon";
import QuotationIcon from "@/components/icons/QuotationIcon";
import SalesIcon from "@/components/icons/SalesIcon";
import MarketingIcon from "@/components/icons/MarketingIcon";
import ProductsIcon from "@/components/icons/ProductsIcon";
import ProductDataIcon from "@/components/icons/ProductDataIcon";
import InventoryIcon from "@/components/icons/InventoryIcon";
import CustomersIcon from "@/components/icons/CustomersIcon";
import SuppliersIcon from "@/components/icons/SuppliersIcon";
import ContactsIcon from "@/components/icons/ContactsIcon";
import InvoicesIcon from "@/components/icons/InvoicesIcon";
import LandedCostIcon from "@/components/icons/LandedCostIcon";
import CatalogsIcon from "@/components/icons/CatalogsIcon";
import DocumentsIcon from "@/components/icons/DocumentsIcon";
import MarketsIcon from "@/components/icons/MarketsIcon";
import FinanceIcon from "@/components/icons/FinanceIcon";
import ExpensesIcon from "@/components/icons/ExpensesIcon";
import PurchaseIcon from "@/components/icons/PurchaseIcon";
import PriceCalculatorIcon from "@/components/icons/PriceCalculatorIcon";
import AccountsIcon from "@/components/icons/AccountsIcon";
import RolesPermissionsIcon from "@/components/icons/RolesPermissionsIcon";
import EmployeesIcon from "@/components/icons/EmployeesIcon";
import RecruitmentIcon from "@/components/icons/RecruitmentIcon";
import AppraisalsIcon from "@/components/icons/AppraisalsIcon";
import AppointmentsIcon from "@/components/icons/AppointmentsIcon";
import DiscussIcon from "@/components/icons/DiscussIcon";
import CalendarIcon from "@/components/icons/CalendarIcon";
import WebsiteIcon from "@/components/icons/WebsiteIcon";
import MarketingCardsIcon from "@/components/icons/MarketingCardsIcon";
import EventsIcon from "@/components/icons/EventsIcon";
import PlanningIcon from "@/components/icons/PlanningIcon";
import ProjectsIcon from "@/components/icons/ProjectsIcon";
import KnowledgeIcon from "@/components/icons/KnowledgeIcon";
import DatabaseIcon from "@/components/icons/DatabaseIcon";
import SettingsIcon from "@/components/icons/SettingsIcon";
import CommercialPolicyIcon from "@/components/icons/CommercialPolicyIcon";
import MailIcon from "@/components/icons/MailIcon";
import BrandIcon from "@/components/icons/BrandIcon";
import AiFaceIcon from "@/components/icons/AiFaceIcon";
import HrIcon from "@/components/icons/HrIcon";
import OperationsSidebarIcon from "@/components/icons/OperationsSidebarIcon";
import CommercialSidebarIcon from "@/components/icons/CommercialSidebarIcon";
import FinanceSidebarIcon from "@/components/icons/FinanceSidebarIcon";
import PeopleSidebarIcon from "@/components/icons/PeopleSidebarIcon";
import CommunicationSidebarIcon from "@/components/icons/CommunicationSidebarIcon";
import MarketingSidebarIcon from "@/components/icons/MarketingSidebarIcon";
import PlanningSidebarIcon from "@/components/icons/PlanningSidebarIcon";
import KnowledgeSidebarIcon from "@/components/icons/KnowledgeSidebarIcon";
import SystemSidebarIcon from "@/components/icons/SystemSidebarIcon";

/* ═══════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════ */

/** Icon type — Lucide icons or custom SVG components */
type AppIcon = React.ComponentType<{ size?: number | string; className?: string }>;

/** Every navigable app in the platform. */
export interface AppDef {
  id: string;
  /** Translation key, e.g. "app.products" */
  tKey: string;
  /** Fallback English name */
  name: string;
  icon: AppIcon;
  route: string;
  /** Whether the page is built and navigable today */
  active: boolean;
  /**
   * Future role-based visibility.
   * undefined / empty → everyone can see.
   * ["admin","sales"] → only those roles.
   */
  visibleTo?: string[];

  /**
   * ISO-date (YYYY-MM-DD) marking when the app was first launched.
   * While `today - newSince <= 3 days`, a "NEW" badge is shown on
   * the app tile. After that, the badge disappears automatically.
   * Set once when the app first ships; no need to remove later.
   */
  newSince?: string;

  /**
   * ISO-date (YYYY-MM-DD) marking the most recent notable update to
   * the app. Renders an "UPDATED" badge on the tile for 3 days.
   * Bump this value when a user-visible change ships. If both
   * `newSince` and `updatedSince` are fresh, NEW wins.
   */
  updatedSince?: string;
}

/** How long (in ms) a NEW / UPDATED badge stays visible. Single
 *  constant so the rule doesn't drift between call sites. */
export const APP_BADGE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/** Return the badge kind to render on an app tile, or null.
 *  - "new"     → app.newSince within the TTL window
 *  - "updated" → app.updatedSince within the TTL window
 *  - NEW wins when both would fire on the same day.
 *  Call sites render the badge visually; this helper keeps the
 *  time-based logic in one place. `now` is injectable for tests. */
export function getAppBadge(
  app: AppDef,
  now: number = Date.now(),
): "new" | "updated" | null {
  const fresh = (iso: string | undefined): boolean => {
    if (!iso) return false;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return false;
    return now - t <= APP_BADGE_TTL_MS && now - t >= 0;
  };
  if (fresh(app.newSince)) return "new";
  if (fresh(app.updatedSince)) return "updated";
  return null;
}

/** A sidebar navigation group (collapsible section). */
export interface SidebarGroup {
  id: string;
  tKey: string;
  label: string;
  icon: AppIcon;
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
  { id: "products",         tKey: "app.products",         name: "Products",          icon: ProductsIcon,  route: "/products",         active: true  },
  /* Internal admin tool — full product records including cost_price,
     supplier, contract terms, internal notes. Guarded by the
     "Product Data" module permission. Customers NEVER see this in
     the sidebar; the /products app (above) is the public catalog. */
  { id: "product-data",     tKey: "app.product-data",     name: "Product Data",      icon: ProductDataIcon, route: "/product-data",   active: true  },
  { id: "inventory",        tKey: "app.inventory",        name: "Inventory",         icon: InventoryIcon, route: "/products",         active: true  },
  { id: "purchase",         tKey: "app.purchase",         name: "Purchases",         icon: PurchaseIcon,  route: "/purchase",         active: false },
  { id: "landed-cost",      tKey: "app.landed-cost",      name: "Landed Cost",       icon: LandedCostIcon, route: "/landed-cost",     active: true  },
  { id: "catalogs",         tKey: "app.catalogs",         name: "Catalogs",          icon: CatalogsIcon,  route: "/catalogs",         active: true  },
  { id: "documents",        tKey: "app.documents",        name: "Documents",         icon: DocumentsIcon, route: "/documents",        active: false },

  /* ── Commercial ── */
  { id: "sales",            tKey: "app.sales",            name: "Sales",             icon: SalesIcon,     route: "/sales",            active: false },
  { id: "crm",              tKey: "app.crm",              name: "CRM",               icon: CrmIcon,       route: "/crm",              active: true  },
  { id: "quotations",       tKey: "app.quotations",       name: "Quotations",        icon: QuotationIcon, route: "/quotations",       active: true  },
  { id: "invoices",         tKey: "app.invoices",         name: "Invoices",          icon: InvoicesIcon,  route: "/invoices",         active: true  },
  { id: "customers",        tKey: "app.customers",        name: "Customers",         icon: CustomersIcon, route: "/customers",        active: true  },
  { id: "suppliers",        tKey: "app.suppliers",        name: "Suppliers",         icon: SuppliersIcon, route: "/suppliers",        active: true  },
  { id: "contacts",         tKey: "app.contacts",         name: "Contacts",          icon: ContactsIcon,  route: "/contacts",         active: true  },
  { id: "markets",          tKey: "app.markets",          name: "Markets",           icon: MarketsIcon,   route: "/markets",          active: true  },

  /* ── Finance ── */
  { id: "finance",          tKey: "app.finance",          name: "Finance",           icon: FinanceIcon,   route: "/finance",          active: false },
  { id: "expenses",         tKey: "app.expenses",         name: "Expenses",          icon: ExpensesIcon,  route: "/expenses",         active: false },

  /* ── People ── */
  { id: "management",       tKey: "app.management",       name: "Management",        icon: ManagementIcon, route: "/management",       active: true  },
  { id: "employees",        tKey: "app.employees",        name: "Employees",         icon: EmployeesIcon, route: "/employees",        active: true  },
  { id: "hr",               tKey: "app.hr",               name: "HR",                icon: HrIcon,        route: "/hr",               active: true  },

  /* ── Communication ── */
  { id: "discuss",          tKey: "app.discuss",          name: "Discuss",           icon: DiscussIcon,   route: "/discuss",          active: true  },
  { id: "calendar",         tKey: "app.calendar",         name: "Calendar",          icon: CalendarIcon,  route: "/calendar",         active: true  },
  { id: "todo",             tKey: "app.todo",             name: "To-do",             icon: TodoIcon,      route: "/todo",             active: true  },
  { id: "notes",            tKey: "app.notes",            name: "Notes",             icon: NotesIcon,     route: "/notes",            active: true  },

  /* ── Marketing & Growth ── */
  { id: "website",          tKey: "app.website",          name: "Website",           icon: WebsiteIcon,   route: "/website",          active: true  },
  { id: "marketing",        tKey: "app.marketing",        name: "Marketing",         icon: MarketingIcon, route: "/marketing",        active: false },
  { id: "marketing-cards",  tKey: "app.marketing-cards",  name: "Marketing Cards",   icon: MarketingCardsIcon, route: "/marketing-cards", active: false },
  { id: "events",           tKey: "app.events",           name: "Events",            icon: EventsIcon,    route: "/events",           active: false },

  /* ── Planning ── */
  { id: "planning",         tKey: "app.planning",         name: "Planning",          icon: PlanningIcon,  route: "/planning",         active: true  },
  { id: "projects",         tKey: "app.projects",         name: "Projects",          icon: ProjectsIcon,  route: "/projects",         active: true  },

  /* ── Knowledge ── */
  { id: "knowledge",        tKey: "app.knowledge",        name: "Knowledge",         icon: KnowledgeIcon, route: "/knowledge",        active: true  },
  { id: "database",         tKey: "app.database",         name: "Database",          icon: DatabaseIcon,  route: "/database",         active: false },
  { id: "ai",               tKey: "app.ai",               name: "AI",                icon: AiFaceIcon,  route: "/ai",               active: true  },

  /* ── System ── */
  { id: "accounts",         tKey: "app.accounts",         name: "Accounts",          icon: AccountsIcon,  route: "/accounts",         active: true  },
  { id: "roles",            tKey: "app.roles",            name: "Roles & Permissions", icon: RolesPermissionsIcon, route: "/roles",   active: true  },
  { id: "commercial-policy", tKey: "app.commercial-policy", name: "Commercial Policy", icon: CommercialPolicyIcon, route: "/commercial-policy", active: true, newSince: "2026-04-20" },
  { id: "settings",         tKey: "app.settings",         name: "Settings",          icon: SettingsIcon,  route: "/settings",         active: true,  newSince: "2026-04-19" },

  /* ── Not in sidebar — accessible via All Apps or direct URL ── */
  { id: "inbox",            tKey: "app.inbox",            name: "Koleex Mail",       icon: MailIcon,      route: "/inbox",            active: true  },
  { id: "price-calculator", tKey: "app.price-calculator", name: "Price Calculator",  icon: PriceCalculatorIcon, route: "/price-calculator", active: true  },
  { id: "brands",           tKey: "app.brands",           name: "Brands",            icon: BrandIcon,     route: "/brands",           active: true  },
  { id: "dashboard",        tKey: "app.dashboard",        name: "Dashboard",         icon: AppsIcon,    route: "/dashboard",        active: false },
];

/* ═══════════════════════════════════════════════════
   SIDEBAR GROUPS — ordered, clean structure
   ═══════════════════════════════════════════════════ */

export const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    id: "operations",
    tKey: "cat.operations",
    label: "Operations",
    icon: OperationsSidebarIcon,
    appIds: ["products", "product-data", "inventory", "purchase", "landed-cost", "catalogs", "documents"],
  },
  {
    id: "commercial",
    tKey: "cat.commercial",
    label: "Commercial",
    icon: CommercialSidebarIcon,
    appIds: ["sales", "crm", "quotations", "invoices", "customers", "suppliers", "contacts", "markets"],
  },
  {
    id: "finance",
    tKey: "cat.finance",
    label: "Finance",
    icon: FinanceSidebarIcon,
    appIds: ["finance", "expenses"],
  },
  {
    id: "people",
    tKey: "cat.people",
    label: "People",
    icon: PeopleSidebarIcon,
    appIds: ["management", "employees", "hr"],
  },
  {
    id: "communication",
    tKey: "cat.communication",
    label: "Communication",
    icon: CommunicationSidebarIcon,
    appIds: ["discuss", "calendar", "todo", "notes"],
  },
  {
    id: "marketing",
    tKey: "cat.marketing",
    label: "Marketing & Growth",
    icon: MarketingSidebarIcon,
    appIds: ["website", "marketing", "marketing-cards", "events"],
  },
  {
    id: "planning",
    tKey: "cat.planning",
    label: "Planning",
    icon: PlanningSidebarIcon,
    appIds: ["planning", "projects"],
  },
  {
    id: "knowledge",
    tKey: "cat.knowledge",
    label: "Knowledge",
    icon: KnowledgeSidebarIcon,
    appIds: ["knowledge", "database", "ai"],
  },
  {
    id: "system",
    tKey: "cat.system",
    label: "System",
    icon: SystemSidebarIcon,
    appIds: ["accounts", "roles", "commercial-policy", "settings"],
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
