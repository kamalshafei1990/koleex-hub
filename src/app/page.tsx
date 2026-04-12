"use client";

/* ---------------------------------------------------------------------------
   App Launcher — system-level 4-zone launcher.

   Zone A: Search (⌘K)
   Zone B: Favorites (compact row < 3, grid >= 3)
   Zone C: Recent (horizontal scrollable strip)
   Zone D: All Apps (category chips + flat grid)
   --------------------------------------------------------------------------- */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, Sparkles, Star, Clock } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { hubT } from "@/lib/translations/hub";
import {
  APP_REGISTRY,
  ALL_APPS_CATEGORIES,
  getAppCategory,
  getActiveAppId,
  type AppDef,
} from "@/lib/navigation";
import { getCurrentAccountIdSync } from "@/lib/identity";
import {
  fetchFavorites,
  addFavorite,
  removeFavorite,
  fetchRecent,
  trackAppOpen,
} from "@/lib/app-launcher";

const PRIMARY_CATS = ["operations", "commercial", "people", "communication", "system"];

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const { t, lang } = useTranslation(hubT);
  const currentAppId = getActiveAppId(pathname);

  /* ── Theme ── */
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  useEffect(() => {
    const saved = localStorage.getItem("koleex-theme") as "light" | "dark" | null;
    if (saved) setTheme(saved);
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as "light" | "dark";
      if (d) setTheme(d);
    };
    window.addEventListener("themechange", h);
    return () => window.removeEventListener("themechange", h);
  }, []);
  const dk = theme === "dark";

  /* ── Search + filter ── */
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showMore, setShowMore] = useState(false);

  /* ── Per-user data ── */
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const accountIdRef = useRef<string | null>(null);

  useEffect(() => {
    const id = getCurrentAccountIdSync();
    accountIdRef.current = id;
    if (!id) { setDataLoaded(true); return; }
    Promise.all([fetchFavorites(id), fetchRecent(id)]).then(([favs, recs]) => {
      setFavoriteIds(favs);
      setRecentIds(recs);
      setDataLoaded(true);
    });
  }, []);

  /* ── Handlers ── */
  const handleAppClick = useCallback(
    (app: AppDef) => {
      if (!app.active) return;
      const id = accountIdRef.current;
      if (id) {
        trackAppOpen(id, app.id);
        setRecentIds((prev) => [app.id, ...prev.filter((a) => a !== app.id)].slice(0, 8));
      }
      router.push(app.route);
    },
    [router],
  );

  const toggleFavorite = useCallback(
    async (appId: string) => {
      const id = accountIdRef.current;
      if (!id) return;
      const isFav = favoriteIds.includes(appId);
      if (isFav) {
        setFavoriteIds((prev) => prev.filter((a) => a !== appId));
        await removeFavorite(id, appId);
      } else {
        setFavoriteIds((prev) => [...prev, appId]);
        await addFavorite(id, appId);
      }
    },
    [favoriteIds],
  );

  /* ⌘K */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("hub-search")?.focus();
      }
      if (e.key === "Escape") setSearch("");
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  /* ── Derived ── */
  const filteredApps = useMemo(() => {
    let result = APP_REGISTRY;
    if (activeCategory !== "all")
      result = result.filter((a) => getAppCategory(a.id) === activeCategory);
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

  const favoriteApps = useMemo(
    () => favoriteIds.map((id) => APP_REGISTRY.find((a) => a.id === id)).filter((a): a is AppDef => !!a),
    [favoriteIds],
  );
  const recentApps = useMemo(
    () =>
      recentIds
        .filter((id) => !favoriteIds.includes(id))
        .map((id) => APP_REGISTRY.find((a) => a.id === id))
        .filter((a): a is AppDef => !!a)
        .slice(0, 6),
    [recentIds, favoriteIds],
  );

  const isSearchOrFilter = search.trim() !== "" || activeCategory !== "all";
  const primaryCats = ALL_APPS_CATEGORIES.filter((c) => PRIMARY_CATS.includes(c.id));
  const secondaryCats = ALL_APPS_CATEGORIES.filter((c) => !PRIMARY_CATS.includes(c.id));

  const dateLocale = lang === "zh" ? "zh-CN" : lang === "ar" ? "ar-SA" : "en-US";
  const today = new Date().toLocaleDateString(dateLocale, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const chipCls = (active: boolean) =>
    `h-8 px-4 rounded-lg text-[12px] font-semibold transition-all duration-200 border whitespace-nowrap ${
      active
        ? dk
          ? "bg-white/[0.12] border-white/[0.20] text-white"
          : "bg-black/[0.10] border-black/[0.18] text-black"
        : dk
          ? "bg-transparent border-white/[0.06] text-white/35 hover:text-white/60 hover:border-white/[0.12]"
          : "bg-transparent border-black/[0.06] text-black/35 hover:text-black/60 hover:border-black/[0.12]"
    }`;

  /* ── Full App Card (for grid) ── */
  const AppCard = ({ app, showStar = false }: { app: AppDef; showStar?: boolean }) => {
    const Icon = app.icon;
    const label = t(app.tKey, app.name);
    const isFav = favoriteIds.includes(app.id);
    const isCurrentApp = currentAppId === app.id;

    return (
      <button
        onClick={() => handleAppClick(app)}
        disabled={!app.active}
        className={`relative flex flex-col items-center justify-center gap-3 p-5 min-h-[110px] border rounded-2xl transition-all duration-200 ${
          app.active
            ? isCurrentApp
              ? `cursor-pointer group ${
                  dk
                    ? "bg-white/[0.08] border-white/[0.18] ring-1 ring-white/[0.08]"
                    : "bg-black/[0.05] border-black/[0.15] ring-1 ring-black/[0.05]"
                }`
              : `cursor-pointer group ${
                  dk
                    ? "bg-[#111] border-white/[0.05] hover:border-white/[0.16] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)] active:translate-y-0 active:scale-[0.98]"
                    : "bg-white border-black/[0.05] hover:border-black/[0.14] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.10)] active:translate-y-0 active:scale-[0.98]"
                }`
            : `cursor-default opacity-20 ${dk ? "bg-[#0e0e0e] border-white/[0.02]" : "bg-[#f5f5f5] border-black/[0.02]"}`
        }`}
      >
        {showStar && app.active && (
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(app.id); }}
            className={`absolute top-2.5 end-2.5 p-1 rounded-md transition-all duration-200 ${
              isFav
                ? "text-amber-400 hover:text-amber-300 hover:scale-110"
                : dk
                  ? "text-white/0 group-hover:text-white/20 hover:!text-amber-400 hover:!scale-110"
                  : "text-black/0 group-hover:text-black/15 hover:!text-amber-400 hover:!scale-110"
            }`}
            aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
          >
            <Star size={13} fill={isFav ? "currentColor" : "none"} />
          </button>
        )}
        <span className={`transition-all duration-200 ${
          app.active
            ? isCurrentApp
              ? dk ? "text-white" : "text-black"
              : dk ? "text-white/50 group-hover:text-white" : "text-black/50 group-hover:text-black"
            : dk ? "text-white/25" : "text-black/25"
        }`}>
          <Icon size={26} strokeWidth={1.8} />
        </span>
        <span className={`text-[11px] md:text-[11.5px] font-medium text-center leading-tight transition-all duration-200 ${
          app.active
            ? isCurrentApp
              ? dk ? "text-white font-semibold" : "text-black font-semibold"
              : dk ? "text-white/50 group-hover:text-white/90" : "text-black/50 group-hover:text-black/90"
            : dk ? "text-white/25" : "text-black/25"
        }`}>
          {label}
        </span>
      </button>
    );
  };

  /* ── Compact horizontal card (for favorites row / recent strip) ── */
  const CompactCard = ({ app, showStar = false }: { app: AppDef; showStar?: boolean }) => {
    const Icon = app.icon;
    const label = t(app.tKey, app.name);
    const isFav = favoriteIds.includes(app.id);

    return (
      <button
        onClick={() => handleAppClick(app)}
        disabled={!app.active}
        className={`relative flex items-center gap-2.5 px-3.5 py-2.5 border rounded-xl transition-all duration-200 shrink-0 ${
          app.active
            ? `cursor-pointer group ${
                dk
                  ? "bg-[#111] border-white/[0.06] hover:border-white/[0.16] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,0,0,0.4)] active:translate-y-0 active:scale-[0.98]"
                  : "bg-white border-black/[0.06] hover:border-black/[0.14] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)] active:translate-y-0 active:scale-[0.98]"
              }`
            : `cursor-default opacity-20 ${dk ? "bg-[#0e0e0e] border-white/[0.02]" : "bg-[#f5f5f5] border-black/[0.02]"}`
        }`}
      >
        <span className={`transition-colors duration-200 ${
          app.active
            ? dk ? "text-white/50 group-hover:text-white" : "text-black/50 group-hover:text-black"
            : dk ? "text-white/25" : "text-black/25"
        }`}>
          <Icon size={18} strokeWidth={1.8} />
        </span>
        <span className={`text-[12px] font-medium whitespace-nowrap transition-colors duration-200 ${
          app.active
            ? dk ? "text-white/60 group-hover:text-white/90" : "text-black/60 group-hover:text-black/90"
            : dk ? "text-white/25" : "text-black/25"
        }`}>
          {label}
        </span>
        {showStar && app.active && (
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(app.id); }}
            className={`p-0.5 rounded transition-all duration-200 ${
              isFav
                ? "text-amber-400 hover:text-amber-300"
                : dk
                  ? "text-white/0 group-hover:text-white/15 hover:!text-amber-400"
                  : "text-black/0 group-hover:text-black/10 hover:!text-amber-400"
            }`}
            aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
          >
            <Star size={11} fill={isFav ? "currentColor" : "none"} />
          </button>
        )}
      </button>
    );
  };

  return (
    <div className={`${dk ? "bg-black" : "bg-white"} min-h-screen transition-colors duration-300`}>
      <div className="px-4 md:px-10 py-5 md:py-4 pb-20 max-w-[1400px]">

        {/* ── Zone A: Search ── */}
        <div className="max-w-md mb-6 mt-1">
          <div className={`relative flex items-center w-full h-10 border rounded-xl px-3.5 gap-2.5 transition-all duration-200 ${
            dk
              ? "bg-white/[0.03] border-white/[0.08] focus-within:border-white/[0.20] focus-within:bg-white/[0.05]"
              : "bg-black/[0.03] border-black/[0.08] focus-within:border-black/[0.20] focus-within:bg-black/[0.04]"
          }`}>
            <Search size={15} className={dk ? "text-white/25" : "text-black/25"} />
            <input
              id="hub-search"
              type="text"
              placeholder={t("searchDesktop")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`flex-1 bg-transparent text-[13px] outline-none ${
                dk ? "text-white placeholder:text-white/25" : "text-black placeholder:text-black/25"
              }`}
            />
            <kbd className={`hidden md:inline text-[10px] font-medium px-1.5 py-0.5 rounded ${
              dk ? "bg-white/[0.06] text-white/25" : "bg-black/[0.06] text-black/25"
            }`}>⌘K</kbd>
          </div>
        </div>

        {/* ── Title ── */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-1">
            <h1 className={`text-2xl md:text-[34px] font-bold tracking-tight ${dk ? "text-white" : "text-black"}`}>
              {t("title")}
            </h1>
            <div className="flex items-center gap-3">
              <span className={`text-[11px] font-medium ${dk ? "text-white/25" : "text-black/25"}`}>{today}</span>
              <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
                dk ? "text-white/30 bg-white/[0.03] border-white/[0.06]" : "text-black/30 bg-black/[0.03] border-black/[0.06]"
              }`}>
                {filteredApps.filter((a) => a.active).length}/{filteredApps.length}
              </span>
            </div>
          </div>
          <p className={`text-[13px] ${dk ? "text-white/30" : "text-black/30"}`}>{t("applicationsDesc")}</p>
        </div>

        {/* ── Zone B: Favorites ── */}
        {!isSearchOrFilter && favoriteApps.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2.5">
              <Star size={12} className={dk ? "text-amber-400/60" : "text-amber-500/60"} fill="currentColor" />
              <span className={`text-[10px] font-semibold tracking-[1.2px] uppercase ${dk ? "text-white/30" : "text-black/30"}`}>
                Favorites
              </span>
            </div>
            {favoriteApps.length < 3 ? (
              /* Compact horizontal row for 1-2 favorites */
              <div className="flex gap-2.5 overflow-x-auto scrollbar-none">
                {favoriteApps.map((app) => (
                  <CompactCard key={app.id} app={app} showStar />
                ))}
              </div>
            ) : (
              /* Grid for 3+ favorites, max 4 per row */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {favoriteApps.map((app) => (
                  <CompactCard key={app.id} app={app} showStar />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Zone C: Recent ── */}
        {!isSearchOrFilter && recentApps.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2.5">
              <Clock size={12} className={dk ? "text-white/20" : "text-black/20"} />
              <span className={`text-[10px] font-semibold tracking-[1.2px] uppercase ${dk ? "text-white/30" : "text-black/30"}`}>
                Recent
              </span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-0.5">
              {recentApps.map((app) => (
                <CompactCard key={app.id} app={app} showStar />
              ))}
            </div>
          </div>
        )}

        {/* ── Divider ── */}
        {!isSearchOrFilter && (favoriteApps.length > 0 || recentApps.length > 0) && (
          <div className={`border-b mb-5 ${dk ? "border-white/[0.04]" : "border-black/[0.04]"}`} />
        )}

        {/* ── Zone D: All Apps ── */}
        <div className="flex flex-wrap items-center gap-1.5 mb-5">
          <button onClick={() => { setActiveCategory("all"); setShowMore(false); }} className={chipCls(activeCategory === "all")}>
            All
          </button>
          {primaryCats.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(activeCategory === cat.id ? "all" : cat.id)}
              className={chipCls(activeCategory === cat.id)}
            >
              {t(cat.tKey, cat.label)}
            </button>
          ))}
          {secondaryCats.length > 0 && (
            <button
              onClick={() => setShowMore((v) => !v)}
              className={`h-8 px-3 rounded-lg text-[12px] font-semibold transition-all duration-200 border whitespace-nowrap ${
                showMore || secondaryCats.some((c) => c.id === activeCategory)
                  ? dk ? "bg-white/[0.08] border-white/[0.14] text-white/60" : "bg-black/[0.06] border-black/[0.12] text-black/60"
                  : dk ? "bg-transparent border-white/[0.06] text-white/25 hover:text-white/50" : "bg-transparent border-black/[0.06] text-black/25 hover:text-black/50"
              }`}
            >
              More{showMore ? " −" : " +"}
            </button>
          )}
          {showMore && secondaryCats.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(activeCategory === cat.id ? "all" : cat.id)}
              className={chipCls(activeCategory === cat.id)}
            >
              {t(cat.tKey, cat.label)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3.5">
          {filteredApps.map((app) => (
            <AppCard key={app.id} app={app} showStar />
          ))}
        </div>
      </div>

      {/* AI FAB */}
      <button className={`fixed bottom-6 end-6 z-40 w-14 h-14 rounded-full ${
        dk ? "bg-white text-black" : "bg-black text-white"
      } flex flex-col items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-transform duration-200`}>
        <Sparkles size={20} />
        <span className="text-[8px] font-bold tracking-wider mt-0.5">AI</span>
      </button>
    </div>
  );
}
