"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid, Settings, Package, Warehouse, ShoppingCart, DollarSign,
  FileText, TrendingUp, Layers, ClipboardList, Receipt, Calculator,
  Users, Truck, Contact, Globe, CreditCard, Briefcase, UserSearch,
  Star, Clock, CalendarCheck, MessageSquare, Calendar, CheckSquare,
  Megaphone, Monitor, Bell, Kanban, FolderKanban, BookOpen, Database,
  Sparkles, Menu, Search, Sun, Moon, PanelTop,
} from "lucide-react";
import Link from "next/link";

/* ── App Data ── */
interface AppItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  category: string;
  route: string;
  external?: boolean;
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
  { id: "products", name: "Products", icon: <Package size={iconSize} />, category: "operations", route: "/products" },
  { id: "inventory", name: "Inventory", icon: <Warehouse size={iconSize} />, category: "operations", route: "/products" },
  { id: "purchase", name: "Purchase", icon: <ShoppingCart size={iconSize} />, category: "operations", route: "/purchase" },
  { id: "landed-cost", name: "Landed Cost", icon: <DollarSign size={iconSize} />, category: "operations", route: "/landed-cost" },
  { id: "documents", name: "Documents", icon: <FileText size={iconSize} />, category: "operations", route: "/documents" },
  { id: "sales", name: "Sales", icon: <TrendingUp size={iconSize} />, category: "commercial", route: "/sales" },
  { id: "crm", name: "CRM", icon: <Layers size={iconSize} />, category: "commercial", route: "/crm" },
  { id: "quotations", name: "Quotations", icon: <ClipboardList size={iconSize} />, category: "commercial", route: "/quotations" },
  { id: "invoices", name: "Invoices", icon: <Receipt size={iconSize} />, category: "commercial", route: "/invoices" },
  { id: "price-calculator", name: "Price Calculator", icon: <Calculator size={iconSize} />, category: "commercial", route: "/price-calculator" },
  { id: "customers", name: "Customers", icon: <Users size={iconSize} />, category: "commercial", route: "/customers" },
  { id: "suppliers", name: "Suppliers", icon: <Truck size={iconSize} />, category: "commercial", route: "/suppliers" },
  { id: "contacts", name: "Contacts", icon: <Contact size={iconSize} />, category: "commercial", route: "/contacts" },
  { id: "markets", name: "Markets", icon: <Globe size={iconSize} />, category: "commercial", route: "/markets" },
  { id: "finance", name: "Finance", icon: <CreditCard size={iconSize} />, category: "finance", route: "/finance" },
  { id: "expenses", name: "Expenses", icon: <Briefcase size={iconSize} />, category: "finance", route: "/expenses" },
  { id: "employees", name: "Employees", icon: <Users size={iconSize} />, category: "people", route: "/employees" },
  { id: "recruitment", name: "Recruitment", icon: <UserSearch size={iconSize} />, category: "people", route: "/recruitment" },
  { id: "appraisals", name: "Appraisals", icon: <Star size={iconSize} />, category: "people", route: "/appraisals" },
  { id: "appointments", name: "Appointments", icon: <Clock size={iconSize} />, category: "people", route: "/appointments" },
  { id: "attendance", name: "Attendance", icon: <CalendarCheck size={iconSize} />, category: "people", route: "/attendance" },
  { id: "discuss", name: "Discuss", icon: <MessageSquare size={iconSize} />, category: "communication", route: "/discuss" },
  { id: "calendar", name: "Calendar", icon: <Calendar size={iconSize} />, category: "communication", route: "/calendar" },
  { id: "todo", name: "To-do", icon: <CheckSquare size={iconSize} />, category: "communication", route: "/todo" },
  { id: "website", name: "Website", icon: <PanelTop size={iconSize} />, category: "marketing", route: "/website" },
  { id: "marketing", name: "Marketing", icon: <Megaphone size={iconSize} />, category: "marketing", route: "/marketing" },
  { id: "marketing-cards", name: "Marketing Cards", icon: <Monitor size={iconSize} />, category: "marketing", route: "/marketing-cards" },
  { id: "events", name: "Events", icon: <Bell size={iconSize} />, category: "marketing", route: "/events" },
  { id: "planning", name: "Planning", icon: <Kanban size={iconSize} />, category: "planning", route: "/planning" },
  { id: "projects", name: "Projects", icon: <FolderKanban size={iconSize} />, category: "planning", route: "/projects" },
  { id: "knowledge", name: "Knowledge", icon: <BookOpen size={iconSize} />, category: "knowledge", route: "/knowledge" },
  { id: "database", name: "Database", icon: <Database size={iconSize} />, category: "system", route: "/database" },
  { id: "ai", name: "AI", icon: <Sparkles size={iconSize} />, category: "system", route: "/ai" },
  { id: "settings", name: "Settings", icon: <Settings size={iconSize} />, category: "system", route: "/settings" },
];

const sidebarItems: ({ id: string; label: string; icon: React.ReactNode } | { section: string })[] = [
  { id: "all", label: "All Apps", icon: <LayoutGrid size={20} /> },
  { section: "Core" },
  { id: "operations", label: "Operations", icon: <Settings size={20} /> },
  { id: "commercial", label: "Commercial", icon: <Layers size={20} /> },
  { id: "finance", label: "Finance", icon: <CreditCard size={20} /> },
  { section: "People" },
  { id: "people", label: "People", icon: <Users size={20} /> },
  { id: "communication", label: "Communication", icon: <MessageSquare size={20} /> },
  { section: "Growth" },
  { id: "marketing", label: "Marketing", icon: <Megaphone size={20} /> },
  { id: "planning", label: "Planning", icon: <Kanban size={20} /> },
  { section: "System" },
  { id: "knowledge", label: "Knowledge", icon: <BookOpen size={20} /> },
  { id: "system", label: "Settings", icon: <Settings size={20} /> },
];

function KoleexLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 719.83 107.57" fill="currentColor">
      <path d="M116.59,96.3v11.05h-10.6L14.66,62.47v44.88H0V1.58h14.66v43.53L105.99,1.58h10.6v11.05L28.42,53.9l88.18,42.4Z"/>
      <path d="M242.65,71.04c0,20.07-14.21,36.54-34.28,36.54h-50.74c-20.52,0-35.18-16.01-35.18-36.54v-35.18C122.45,15.11,136.88.45,157.63.45h49.84c20.52,0,35.18,14.88,35.18,35.41v35.18ZM227.77,38.11c0-12.4-8.34-23.23-20.3-23.23h-49.84c-11.95,0-20.3,10.83-20.3,23.23v31.8c0,11.95,8.34,23,20.3,23h49.84c11.95,0,20.3-11.05,20.3-23v-31.8Z"/>
      <path d="M363.07,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54l.23-71.04h14.66v69.91c0,11.95,8.34,23,20.3,23h68.56v14.66h-.01Z"/>
      <path d="M473.8,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68Z"/>
      <path d="M585.42,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68Z"/>
      <path d="M719.83,96.3v11.05h-10.6l-48.04-42.62-48.04,42.62h-10.37v-11.05l46.91-41.72-46.91-41.95V1.58h10.37l48.04,42.62L709.23,1.58h10.6v11.05l-47.13,41.95,47.13,41.72ZM661.19,71.04l40.59,36.31h-81.19l40.59-36.31h0Z"/>
    </svg>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("koleex-theme") as "light" | "dark" | null;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("koleex-theme", theme);
  }, [theme]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const filteredApps = useMemo(() => {
    let result = apps;
    if (activeCategory !== "all") result = result.filter(a => a.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a => a.name.toLowerCase().includes(q) || a.id.includes(q));
    }
    return result;
  }, [search, activeCategory]);

  const grouped = useMemo(() => {
    const map = new Map<string, AppItem[]>();
    for (const app of filteredApps) {
      if (!map.has(app.category)) map.set(app.category, []);
      map.get(app.category)!.push(app);
    }
    return categoryOrder.filter(cat => map.has(cat)).map(cat => ({
      category: cat, label: categoryLabels[cat], apps: map.get(cat)!,
    }));
  }, [filteredApps]);

  const handleAppClick = useCallback((app: AppItem) => {
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
      {/* HEADER */}
      <header className={`fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 md:px-6 backdrop-blur-xl border-b ${dk ? "border-white/[0.08] bg-black/80" : "border-black/[0.08] bg-white/80"}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`md:hidden flex items-center justify-center w-9 h-9 rounded-lg ${dk ? "text-white" : "text-black"}`}>
            <Menu size={20} />
          </button>
          <Link href="/" className={dk ? "text-white" : "text-black"}>
            <KoleexLogo className="h-5 w-auto" />
          </Link>
        </div>

        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className={`relative flex items-center w-full h-9 ${dk ? "bg-white/[0.04] border-white/[0.08]" : "bg-black/[0.04] border-black/[0.08]"} border rounded-lg px-3 gap-2 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all`}>
            <Search size={16} className={dk ? "text-white/30" : "text-black/30"} />
            <input id="hub-search" type="text" placeholder="Search apps, modules, settings..." value={search} onChange={e => setSearch(e.target.value)} className={`flex-1 bg-transparent text-[13px] outline-none ${dk ? "text-white placeholder:text-white/30" : "text-black placeholder:text-black/30"}`} />
            <kbd className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${dk ? "bg-white/10 text-white/30" : "bg-black/10 text-black/30"}`}>⌘K</kbd>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setTheme(dk ? "light" : "dark")} className={`flex items-center justify-center w-9 h-9 rounded-lg border ${dk ? "border-white/[0.08] bg-white/[0.04] text-white/60" : "border-black/[0.08] bg-black/[0.04] text-black/60"} transition-all`}>
            {dk ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${dk ? "bg-white text-black" : "bg-black text-white"} text-xs font-semibold`}>KS</div>
        </div>
      </header>

      {/* MOBILE SEARCH */}
      <div className={`md:hidden sticky top-14 z-30 px-3 py-2 border-b ${dk ? "bg-black border-white/[0.08]" : "bg-white border-black/[0.08]"}`}>
        <div className={`flex items-center h-10 ${dk ? "bg-white/[0.04] border-white/[0.08]" : "bg-black/[0.04] border-black/[0.08]"} border rounded-lg px-3 gap-2`}>
          <Search size={16} className={dk ? "text-white/30" : "text-black/30"} />
          <input type="text" placeholder="Search apps..." value={search} onChange={e => setSearch(e.target.value)} className={`flex-1 bg-transparent text-[13px] outline-none ${dk ? "text-white placeholder:text-white/30" : "text-black placeholder:text-black/30"}`} />
        </div>
      </div>

      <div className="flex pt-14">
        {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />}

        {/* SIDEBAR */}
        <aside className={`fixed top-14 bottom-0 w-[220px] ${dk ? "bg-[#0A0A0A] border-white/[0.08]" : "bg-[#FAFAFA] border-black/[0.08]"} border-r flex-col z-50 overflow-y-auto transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:flex`}>
          <nav className="flex-1 p-3 flex flex-col gap-0.5">
            {sidebarItems.map((item, i) =>
              "section" in item ? (
                <div key={i} className={`text-[10px] font-semibold tracking-[1.5px] uppercase ${dk ? "text-white/30" : "text-black/30"} px-3 pt-5 pb-2`}>{item.section}</div>
              ) : (
                <button key={item.id} onClick={() => { setActiveCategory(item.id!); setSidebarOpen(false); }}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-all ${activeCategory === item.id
                    ? dk ? "bg-white/10 text-white font-semibold" : "bg-black/10 text-black font-semibold"
                    : dk ? "text-white/60 hover:text-white hover:bg-white/[0.04]" : "text-black/60 hover:text-black hover:bg-black/[0.04]"}`}>
                  <span className={activeCategory === item.id ? (dk ? "text-white" : "text-black") : (dk ? "text-white/30" : "text-black/30")}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              )
            )}
          </nav>
          <div className={`px-6 py-4 border-t ${dk ? "border-white/[0.08]" : "border-black/[0.08]"}`}>
            <span className={`text-[11px] ${dk ? "text-white/30" : "text-black/30"}`}>Platform v2.4</span>
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 md:ml-[220px] px-4 md:px-10 py-8 md:py-10 pb-20 max-w-[1400px]">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <h1 className={`text-2xl md:text-[32px] font-bold tracking-tight ${dk ? "text-white" : "text-black"}`}>Applications</h1>
              <p className={`text-sm mt-1 ${dk ? "text-white/60" : "text-black/60"}`}>Access your enterprise modules and tools</p>
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-xs font-medium ${dk ? "text-white/30" : "text-black/30"}`}>{today}</span>
              <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${dk ? "text-white/30 bg-white/[0.04] border-white/[0.08]" : "text-black/30 bg-black/[0.04] border-black/[0.08]"}`}>{filteredApps.length} apps</span>
            </div>
          </div>

          <div className="space-y-2">
            {grouped.map(group => (
              <div key={group.category}>
                <div className={`text-[11px] font-semibold tracking-[1.2px] uppercase py-4 border-b mb-3 ${dk ? "text-white/30 border-white/[0.08]" : "text-black/30 border-black/[0.08]"}`}>{group.label}</div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 mb-4">
                  {group.apps.map(app => (
                    <button key={app.id} onClick={() => handleAppClick(app)}
                      className={`flex flex-col items-center justify-center gap-3 p-5 min-h-[100px] border rounded-xl transition-all cursor-pointer group
                        ${dk ? "bg-[#111] border-white/[0.06] hover:border-white/20 hover:shadow-lg" : "bg-white border-black/[0.06] hover:border-black/20 hover:shadow-lg"}`}>
                      <span className={`${dk ? "text-white/60 group-hover:text-white" : "text-black/60 group-hover:text-black"} transition-colors`}>{app.icon}</span>
                      <span className={`text-[11px] md:text-xs font-medium text-center ${dk ? "text-white/60 group-hover:text-white" : "text-black/60 group-hover:text-black"} transition-colors`}>{app.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      <button className={`fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full ${dk ? "bg-white text-black" : "bg-black text-white"} flex flex-col items-center justify-center shadow-xl hover:scale-105 transition-transform`}>
        <Sparkles size={20} />
        <span className="text-[8px] font-bold tracking-wider mt-0.5">AI</span>
      </button>
    </div>
  );
}
