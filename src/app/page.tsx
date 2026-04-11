"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid, Settings, Package, Warehouse, ShoppingCart, DollarSign,
  FileText, TrendingUp, Layers, ClipboardList, Receipt, Calculator,
  Users, Truck, Contact, Globe, CreditCard, Briefcase, UserSearch,
  Star, Clock, CalendarCheck, MessageSquare, Calendar, CheckSquare,
  Megaphone, Monitor, Bell, Kanban, FolderKanban, BookOpen, Library, Database,
  Sparkles, Menu, Search, PanelTop, Inbox,
} from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { hubT } from "@/lib/translations/hub";

/* ── App Data ── */
interface AppItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  category: string;
  route: string;
  external?: boolean;
  active?: boolean;
}

const categoryLabels: Record<string, string> = {
  operations: "Operations",
  commercial: "Commercial",
  finance: "Finance",
  people: "People",
  communication: "Communication",
  marketing: "Marketing & Growth",
  planning: "Planning",
  knowledge: "Knowledge",
  system: "System",
};

const categoryOrder = [
  "operations", "commercial", "finance", "people",
  "communication", "marketing", "planning", "knowledge", "system",
];

const iconSize = 28;

const apps: AppItem[] = [
  { id: "dashboard", name: "Dashboard", icon: <LayoutGrid size={iconSize} />, category: "operations", route: "/dashboard" },
  { id: "products", name: "Products", icon: <Package size={iconSize} />, category: "operations", route: "/products", active: true },
  { id: "inventory", name: "Inventory", icon: <Warehouse size={iconSize} />, category: "operations", route: "/products", active: true },
  { id: "purchase", name: "Purchase", icon: <ShoppingCart size={iconSize} />, category: "operations", route: "/purchase" },
  { id: "landed-cost", name: "Landed Cost", icon: <DollarSign size={iconSize} />, category: "operations", route: "/landed-cost", active: true },
  { id: "catalogs", name: "Catalogs", icon: <Library size={iconSize} />, category: "operations", route: "/catalogs", active: true },
  { id: "documents", name: "Documents", icon: <FileText size={iconSize} />, category: "operations", route: "/documents" },
  { id: "sales", name: "Sales", icon: <TrendingUp size={iconSize} />, category: "commercial", route: "/sales" },
  { id: "crm", name: "CRM", icon: <Layers size={iconSize} />, category: "commercial", route: "/crm" },
  { id: "quotations", name: "Quotations", icon: <ClipboardList size={iconSize} />, category: "commercial", route: "/quotations", active: true },
  { id: "invoices", name: "Invoices", icon: <Receipt size={iconSize} />, category: "commercial", route: "/invoices" },
  { id: "price-calculator", name: "Price Calculator", icon: <Calculator size={iconSize} />, category: "commercial", route: "/price-calculator", active: true },
  { id: "customers", name: "Customers", icon: <Users size={iconSize} />, category: "commercial", route: "/customers", active: true },
  { id: "suppliers", name: "Suppliers", icon: <Truck size={iconSize} />, category: "commercial", route: "/suppliers", active: true },
  { id: "contacts", name: "Contacts", icon: <Contact size={iconSize} />, category: "commercial", route: "/contacts", active: true },
  { id: "markets", name: "Markets", icon: <Globe size={iconSize} />, category: "commercial", route: "/markets", active: true },
  { id: "finance", name: "Finance", icon: <CreditCard size={iconSize} />, category: "finance", route: "/finance" },
  { id: "expenses", name: "Expenses", icon: <Briefcase size={iconSize} />, category: "finance", route: "/expenses" },
  { id: "employees", name: "Employees", icon: <Users size={iconSize} />, category: "people", route: "/employees", active: true },
  { id: "recruitment", name: "Recruitment", icon: <UserSearch size={iconSize} />, category: "people", route: "/recruitment" },
  { id: "appraisals", name: "Appraisals", icon: <Star size={iconSize} />, category: "people", route: "/appraisals" },
  { id: "appointments", name: "Appointments", icon: <Clock size={iconSize} />, category: "people", route: "/appointments" },
  { id: "attendance", name: "Attendance", icon: <CalendarCheck size={iconSize} />, category: "people", route: "/attendance" },
  { id: "inbox", name: "Inbox", icon: <Inbox size={iconSize} />, category: "communication", route: "/inbox", active: true },
  { id: "discuss", name: "Discuss", icon: <MessageSquare size={iconSize} />, category: "communication", route: "/discuss", active: true },
  { id: "calendar", name: "Calendar", icon: <Calendar size={iconSize} />, category: "communication", route: "/calendar", active: true },
  { id: "todo", name: "To-do", icon: <CheckSquare size={iconSize} />, category: "communication", route: "/todo", active: true },
  { id: "website", name: "Website", icon: <PanelTop size={iconSize} />, category: "marketing", route: "/website", active: true },
  { id: "marketing", name: "Marketing", icon: <Megaphone size={iconSize} />, category: "marketing", route: "/marketing" },
  { id: "marketing-cards", name: "Marketing Cards", icon: <Monitor size={iconSize} />, category: "marketing", route: "/marketing-cards" },
  { id: "events", name: "Events", icon: <Bell size={iconSize} />, category: "marketing", route: "/events" },
  { id: "planning", name: "Planning", icon: <Kanban size={iconSize} />, category: "planning", route: "/planning" },
  { id: "projects", name: "Projects", icon: <FolderKanban size={iconSize} />, category: "planning", route: "/projects" },
  { id: "knowledge", name: "Knowledge", icon: <BookOpen size={iconSize} />, category: "knowledge", route: "/knowledge" },
  { id: "accounts", name: "Accounts Manager", icon: <Users size={iconSize} />, category: "system", route: "/accounts", active: true },
  { id: "database", name: "Database", icon: <Database size={iconSize} />, category: "system", route: "/database" },
  { id: "ai", name: "AI", icon: <Sparkles size={iconSize} />, category: "system", route: "/ai" },
  { id: "settings", name: "Settings", icon: <Settings size={iconSize} />, category: "system", route: "/settings" },
];

type SidebarItem =
  | { type: "filter"; id: string; label: string; icon: React.ReactNode }
  | { type: "link"; label: string; icon: React.ReactNode; route: string }
  | { type: "section"; label: string };

const sidebarItems: SidebarItem[] = [
  { type: "filter", id: "all", label: "All Apps", icon: <LayoutGrid size={20} /> },
  { type: "section", label: "Quick Access" },
  { type: "link", label: "Contacts", icon: <Contact size={20} />, route: "/contacts" },
  { type: "link", label: "Quotations", icon: <ClipboardList size={20} />, route: "/quotations" },
  { type: "link", label: "Landed Cost", icon: <DollarSign size={20} />, route: "/landed-cost" },
  { type: "section", label: "Core" },
  { type: "filter", id: "operations", label: "Operations", icon: <Settings size={20} /> },
  { type: "filter", id: "commercial", label: "Commercial", icon: <Layers size={20} /> },
  { type: "filter", id: "finance", label: "Finance", icon: <CreditCard size={20} /> },
  { type: "section", label: "People" },
  { type: "filter", id: "people", label: "People", icon: <Users size={20} /> },
  { type: "filter", id: "communication", label: "Communication", icon: <MessageSquare size={20} /> },
  { type: "section", label: "Growth" },
  { type: "filter", id: "marketing", label: "Marketing", icon: <Megaphone size={20} /> },
  { type: "filter", id: "planning", label: "Planning", icon: <Kanban size={20} /> },
  { type: "section", label: "System" },
  { type: "filter", id: "knowledge", label: "Knowledge", icon: <BookOpen size={20} /> },
  { type: "filter", id: "system", label: "Settings", icon: <Settings size={20} /> },
];

export default function HomePage() {
  const router = useRouter();
  const { t, lang } = useTranslation(hubT);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("koleex-theme") as "light" | "dark" | null;
    if (saved) setTheme(saved);
    /* Sync with MainHeader theme toggle */
    const onThemeChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as "light" | "dark";
      if (detail) setTheme(detail);
    };
    window.addEventListener("themechange", onThemeChange);
    return () => window.removeEventListener("themechange", onThemeChange);
  }, []);

  const dateLocale = lang === "zh" ? "zh-CN" : lang === "ar" ? "ar-SA" : "en-US";
  const today = new Date().toLocaleDateString(dateLocale, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const filteredApps = useMemo(() => {
    let result = apps;
    if (activeCategory !== "all") result = result.filter(a => a.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a => a.name.toLowerCase().includes(q) || a.id.includes(q) || t("app." + a.id).toLowerCase().includes(q));
    }
    return result;
  }, [search, activeCategory, t]);

  const grouped = useMemo(() => {
    const map = new Map<string, AppItem[]>();
    for (const app of filteredApps) {
      if (!map.has(app.category)) map.set(app.category, []);
      map.get(app.category)!.push(app);
    }
    return categoryOrder.filter(cat => map.has(cat)).map(cat => ({
      category: cat, label: t("cat." + cat), apps: map.get(cat)!,
    }));
  }, [filteredApps, t]);

  const handleAppClick = useCallback((app: AppItem) => {
    if (!app.active) return;
    if (app.external) window.open(app.route, "_blank");
    else router.push(app.route);
  }, [router]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("hub-search")?.focus();
      }
      if (e.key === "Escape") { setSidebarOpen(false); setSearch(""); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const dk = theme === "dark";

  return (
    <div className={`${dk ? "bg-black" : "bg-white"} min-h-screen transition-colors duration-300`}>
      {/* MOBILE: Hamburger + Search bar */}
      <div className={`md:hidden sticky top-0 z-30 px-3 py-2 border-b ${dk ? "bg-black border-white/[0.08]" : "bg-white border-black/[0.08]"}`}>
        <div className="flex items-center gap-2">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`flex items-center justify-center w-9 h-9 rounded-lg ${dk ? "text-white" : "text-black"}`}>
            <Menu size={20} />
          </button>
          <div className={`flex-1 flex items-center h-10 ${dk ? "bg-white/[0.04] border-white/[0.08]" : "bg-black/[0.04] border-black/[0.08]"} border rounded-lg px-3 gap-2`}>
            <Search size={16} className={dk ? "text-white/30" : "text-black/30"} />
            <input type="text" placeholder={t("searchMobile")} value={search} onChange={e => setSearch(e.target.value)} className={`flex-1 bg-transparent text-[13px] outline-none ${dk ? "text-white placeholder:text-white/30" : "text-black placeholder:text-black/30"}`} />
          </div>
        </div>
      </div>

      {/* DESKTOP: Search bar in content area */}
      <div className="hidden md:block">
        <div className="md:ms-[220px] px-10 pt-6">
          <div className="max-w-md">
            <div className={`relative flex items-center w-full h-9 ${dk ? "bg-white/[0.04] border-white/[0.08]" : "bg-black/[0.04] border-black/[0.08]"} border rounded-lg px-3 gap-2 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all`}>
              <Search size={16} className={dk ? "text-white/30" : "text-black/30"} />
              <input id="hub-search" type="text" placeholder={t("searchDesktop")} value={search} onChange={e => setSearch(e.target.value)} className={`flex-1 bg-transparent text-[13px] outline-none ${dk ? "text-white placeholder:text-white/30" : "text-black placeholder:text-black/30"}`} />
              <kbd className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${dk ? "bg-white/10 text-white/30" : "bg-black/10 text-black/30"}`}>⌘K</kbd>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />}

        {/* SIDEBAR */}
        <aside className={`fixed top-14 bottom-0 start-0 w-[220px] ${dk ? "bg-[#0A0A0A] border-white/[0.08]" : "bg-[#FAFAFA] border-black/[0.08]"} border-e flex-col z-50 overflow-y-auto transition-transform duration-200 ${sidebarOpen ? "translate-x-0 rtl:-translate-x-0" : "-translate-x-full rtl:translate-x-full"} md:translate-x-0 md:rtl:-translate-x-0 md:flex`}>
          <nav className="flex-1 p-3 flex flex-col gap-0.5">
            {sidebarItems.map((item, i) => {
              const sidebarLabelMap: Record<string, string> = {
                "All Apps": "allApps", "Quick Access": "quickAccess", "Core": "core",
                "People": "cat.people", "Growth": "growth", "System": "cat.system",
                "Operations": "cat.operations", "Commercial": "cat.commercial", "Finance": "cat.finance",
                "Communication": "cat.communication", "Marketing": "cat.marketing",
                "Planning": "cat.planning", "Knowledge": "cat.knowledge", "Settings": "sidebar.settings",
                "Contacts": "app.contacts", "Quotations": "app.quotations", "Landed Cost": "app.landed-cost",
              };
              const tLabel = t(sidebarLabelMap[item.label] || "", item.label);
              if (item.type === "section") {
                return <div key={i} className={`text-[10px] font-semibold tracking-[1.5px] uppercase ${dk ? "text-white/30" : "text-black/30"} px-3 pt-5 pb-2`}>{tLabel}</div>;
              }
              if (item.type === "link") {
                return (
                  <Link key={i} href={item.route} onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-all ${dk ? "text-white/60 hover:text-white hover:bg-white/[0.04]" : "text-black/60 hover:text-black hover:bg-black/[0.04]"}`}>
                    <span className={dk ? "text-white/30" : "text-black/30"}>{item.icon}</span>
                    <span>{tLabel}</span>
                  </Link>
                );
              }
              return (
                <button key={item.id} onClick={() => { setActiveCategory(item.id); setSidebarOpen(false); }}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-all ${activeCategory === item.id
                    ? dk ? "bg-white/10 text-white font-semibold" : "bg-black/10 text-black font-semibold"
                    : dk ? "text-white/60 hover:text-white hover:bg-white/[0.04]" : "text-black/60 hover:text-black hover:bg-black/[0.04]"}`}>
                  <span className={activeCategory === item.id ? (dk ? "text-white" : "text-black") : (dk ? "text-white/30" : "text-black/30")}>{item.icon}</span>
                  <span>{tLabel}</span>
                </button>
              );
            })}
          </nav>
          <div className={`px-6 py-4 border-t ${dk ? "border-white/[0.08]" : "border-black/[0.08]"}`}>
            <span className={`text-[11px] ${dk ? "text-white/30" : "text-black/30"}`}>{t("platformVersion")}</span>
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 md:ms-[220px] px-4 md:px-10 py-6 md:py-4 pb-20 max-w-[1400px]">
          <div className="mb-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
              <div>
                <h1 className={`text-3xl md:text-[40px] font-bold tracking-tight ${dk ? "text-white" : "text-black"}`}>{t("title")}</h1>
              </div>
              <div className="flex items-center gap-4">
                <span className={`text-xs font-medium ${dk ? "text-white/30" : "text-black/30"}`}>{today}</span>
                <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${dk ? "text-white/30 bg-white/[0.04] border-white/[0.08]" : "text-black/30 bg-black/[0.04] border-black/[0.08]"}`}>{filteredApps.filter(a => a.active).length} {t("of")} {filteredApps.length} {t("apps")}</span>
              </div>
            </div>
            <div className="mt-3">
              <p className={`text-base md:text-lg font-medium ${dk ? "text-white/70" : "text-black/70"}`}>{t("applications")}</p>
              <p className={`text-sm mt-0.5 ${dk ? "text-white/40" : "text-black/40"}`}>{t("applicationsDesc")}</p>
            </div>
          </div>

          <div className="space-y-2">
            {grouped.map(group => (
              <div key={group.category}>
                <div className={`text-[11px] font-semibold tracking-[1.2px] uppercase py-4 border-b mb-3 ${dk ? "text-white/30 border-white/[0.08]" : "text-black/30 border-black/[0.08]"}`}>{group.label}</div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 mb-4">
                  {group.apps.map(app => (
                    <button key={app.id} onClick={() => handleAppClick(app)}
                      disabled={!app.active}
                      className={`flex flex-col items-center justify-center gap-3 p-5 min-h-[100px] border rounded-xl transition-all
                        ${app.active
                          ? `cursor-pointer group ${dk ? "bg-[#111] border-white/[0.06] hover:border-white/20 hover:shadow-lg" : "bg-white border-black/[0.06] hover:border-black/20 hover:shadow-lg"}`
                          : `cursor-default opacity-25 ${dk ? "bg-[#0e0e0e] border-white/[0.03]" : "bg-[#f5f5f5] border-black/[0.03]"}`
                        }`}>
                      <span className={`transition-colors ${app.active
                        ? dk ? "text-white/60 group-hover:text-white" : "text-black/60 group-hover:text-black"
                        : dk ? "text-white/30" : "text-black/30"
                      }`}>{app.icon}</span>
                      <span className={`text-[11px] md:text-xs font-medium text-center transition-colors ${app.active
                        ? dk ? "text-white/60 group-hover:text-white" : "text-black/60 group-hover:text-black"
                        : dk ? "text-white/30" : "text-black/30"
                      }`}>{t("app." + app.id)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      <button className={`fixed bottom-6 end-6 z-40 w-14 h-14 rounded-full ${dk ? "bg-white text-black" : "bg-black text-white"} flex flex-col items-center justify-center shadow-xl hover:scale-105 transition-transform`}>
        <Sparkles size={20} />
        <span className="text-[8px] font-bold tracking-wider mt-0.5">AI</span>
      </button>
    </div>
  );
}
