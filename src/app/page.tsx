"use client";

/* ---------------------------------------------------------------------------
   Home / All Apps — the app launcher grid.

   Shows every app in the platform organized by category, with search and
   category filtering. The sidebar is rendered globally by RootShell, so
   this page only renders the main content area.
   --------------------------------------------------------------------------- */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { hubT } from "@/lib/translations/hub";
import {
  APP_REGISTRY,
  ALL_APPS_CATEGORIES,
  getAppCategory,
  type AppDef,
} from "@/lib/navigation";

/* ── Helpers ── */
const categoryOrder = ALL_APPS_CATEGORIES.map((c) => c.id);

export default function HomePage() {
  const router = useRouter();
  const { t, lang } = useTranslation(hubT);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("koleex-theme") as "light" | "dark" | null;
    if (saved) setTheme(saved);
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
    let result = APP_REGISTRY;
    if (activeCategory !== "all") {
      result = result.filter((a) => getAppCategory(a.id) === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.id.includes(q) ||
          t(a.tKey, a.name).toLowerCase().includes(q),
      );
    }
    return result;
  }, [search, activeCategory, t]);

  const grouped = useMemo(() => {
    const map = new Map<string, AppDef[]>();
    for (const app of filteredApps) {
      const cat = getAppCategory(app.id);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(app);
    }
    return categoryOrder
      .filter((cat) => map.has(cat))
      .map((cat) => {
        const meta = ALL_APPS_CATEGORIES.find((c) => c.id === cat);
        return {
          category: cat,
          label: meta ? t(meta.tKey, meta.label) : cat,
          apps: map.get(cat)!,
        };
      });
  }, [filteredApps, t]);

  const handleAppClick = useCallback(
    (app: AppDef) => {
      if (!app.active) return;
      router.push(app.route);
    },
    [router],
  );

  /* Cmd+K focus search */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("hub-search")?.focus();
      }
      if (e.key === "Escape") setSearch("");
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const dk = theme === "dark";

  return (
    <div className={`${dk ? "bg-black" : "bg-white"} min-h-screen transition-colors duration-300`}>
      <div className="px-4 md:px-10 py-6 md:py-4 pb-20 max-w-[1400px]">
        {/* Search */}
        <div className="max-w-md mb-8 mt-2">
          <div
            className={`relative flex items-center w-full h-10 ${
              dk ? "bg-white/[0.04] border-white/[0.08]" : "bg-black/[0.04] border-black/[0.08]"
            } border rounded-xl px-3.5 gap-2.5 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all`}
          >
            <Search size={16} className={dk ? "text-white/30" : "text-black/30"} />
            <input
              id="hub-search"
              type="text"
              placeholder={t("searchDesktop")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`flex-1 bg-transparent text-[13px] outline-none ${
                dk ? "text-white placeholder:text-white/30" : "text-black placeholder:text-black/30"
              }`}
            />
            <kbd
              className={`hidden md:inline text-[11px] font-medium px-1.5 py-0.5 rounded ${
                dk ? "bg-white/10 text-white/30" : "bg-black/10 text-black/30"
              }`}
            >
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Title + meta */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
            <div>
              <h1
                className={`text-3xl md:text-[40px] font-bold tracking-tight ${
                  dk ? "text-white" : "text-black"
                }`}
              >
                {t("title")}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-xs font-medium ${dk ? "text-white/30" : "text-black/30"}`}>
                {today}
              </span>
              <span
                className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                  dk
                    ? "text-white/30 bg-white/[0.04] border-white/[0.08]"
                    : "text-black/30 bg-black/[0.04] border-black/[0.08]"
                }`}
              >
                {filteredApps.filter((a) => a.active).length} {t("of")} {filteredApps.length}{" "}
                {t("apps")}
              </span>
            </div>
          </div>
          <div className="mt-3">
            <p className={`text-base md:text-lg font-medium ${dk ? "text-white/70" : "text-black/70"}`}>
              {t("applications")}
            </p>
            <p className={`text-sm mt-0.5 ${dk ? "text-white/40" : "text-black/40"}`}>
              {t("applicationsDesc")}
            </p>
          </div>
        </div>

        {/* Category filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-4 scrollbar-none mb-2">
          <button
            onClick={() => setActiveCategory("all")}
            className={`h-8 px-4 rounded-lg text-[12px] font-semibold transition-all border whitespace-nowrap ${
              activeCategory === "all"
                ? dk
                  ? "bg-white/10 border-white/20 text-white"
                  : "bg-black/10 border-black/20 text-black"
                : dk
                  ? "bg-transparent border-white/[0.06] text-white/40 hover:text-white/70 hover:border-white/[0.12]"
                  : "bg-transparent border-black/[0.06] text-black/40 hover:text-black/70 hover:border-black/[0.12]"
            }`}
          >
            All
          </button>
          {ALL_APPS_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(activeCategory === cat.id ? "all" : cat.id)}
              className={`h-8 px-4 rounded-lg text-[12px] font-semibold transition-all border whitespace-nowrap ${
                activeCategory === cat.id
                  ? dk
                    ? "bg-white/10 border-white/20 text-white"
                    : "bg-black/10 border-black/20 text-black"
                  : dk
                    ? "bg-transparent border-white/[0.06] text-white/40 hover:text-white/70 hover:border-white/[0.12]"
                    : "bg-transparent border-black/[0.06] text-black/40 hover:text-black/70 hover:border-black/[0.12]"
              }`}
            >
              {t(cat.tKey, cat.label)}
            </button>
          ))}
        </div>

        {/* App grid by category */}
        <div className="space-y-2">
          {grouped.map((group) => (
            <div key={group.category}>
              <div
                className={`text-[11px] font-semibold tracking-[1.2px] uppercase py-4 border-b mb-3 ${
                  dk ? "text-white/30 border-white/[0.08]" : "text-black/30 border-black/[0.08]"
                }`}
              >
                {group.label}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 mb-4">
                {group.apps.map((app) => {
                  const Icon = app.icon;
                  const label = t(app.tKey, app.name);
                  return (
                    <button
                      key={app.id}
                      onClick={() => handleAppClick(app)}
                      disabled={!app.active}
                      className={`flex flex-col items-center justify-center gap-3 p-5 min-h-[100px] border rounded-xl transition-all ${
                        app.active
                          ? `cursor-pointer group ${
                              dk
                                ? "bg-[#111] border-white/[0.06] hover:border-white/20 hover:shadow-lg"
                                : "bg-white border-black/[0.06] hover:border-black/20 hover:shadow-lg"
                            }`
                          : `cursor-default opacity-25 ${
                              dk
                                ? "bg-[#0e0e0e] border-white/[0.03]"
                                : "bg-[#f5f5f5] border-black/[0.03]"
                            }`
                      }`}
                    >
                      <span
                        className={`transition-colors ${
                          app.active
                            ? dk
                              ? "text-white/60 group-hover:text-white"
                              : "text-black/60 group-hover:text-black"
                            : dk
                              ? "text-white/30"
                              : "text-black/30"
                        }`}
                      >
                        <Icon size={28} />
                      </span>
                      <span
                        className={`text-[11px] md:text-xs font-medium text-center transition-colors ${
                          app.active
                            ? dk
                              ? "text-white/60 group-hover:text-white"
                              : "text-black/60 group-hover:text-black"
                            : dk
                              ? "text-white/30"
                              : "text-black/30"
                        }`}
                      >
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI FAB */}
      <button
        className={`fixed bottom-6 end-6 z-40 w-14 h-14 rounded-full ${
          dk ? "bg-white text-black" : "bg-black text-white"
        } flex flex-col items-center justify-center shadow-xl hover:scale-105 transition-transform`}
      >
        <Sparkles size={20} />
        <span className="text-[8px] font-bold tracking-wider mt-0.5">AI</span>
      </button>
    </div>
  );
}
