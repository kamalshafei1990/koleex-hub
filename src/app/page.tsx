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
import { getCurrentAccountIdSync, useCurrentAccount } from "@/lib/identity";
import {
  fetchFavorites,
  addFavorite,
  removeFavorite,
  fetchRecent,
  trackAppOpen,
} from "@/lib/app-launcher";

const PRIMARY_CATS = ["operations", "commercial", "people", "communication", "system"];

function getGreetingKey(): string {
  const h = new Date().getHours();
  if (h < 12) return "greeting.morning";
  if (h < 18) return "greeting.afternoon";
  return "greeting.evening";
}

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const { t, lang } = useTranslation(hubT);
  const currentAppId = getActiveAppId(pathname);
  const { account } = useCurrentAccount();

  /* ── Derive user's first name for greeting ── */
  const firstName = useMemo(() => {
    if (!account) return null;
    if (account.person?.first_name) return account.person.first_name;
    if (account.person?.display_name) return account.person.display_name.split(" ")[0];
    if (account.person?.full_name) return account.person.full_name.split(" ")[0];
    if (account.username) return account.username;
    return null;
  }, [account]);

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

  const isSearching = search.trim() !== "";
  const isFiltered = activeCategory !== "all";
  const isSearchOrFilter = isSearching || isFiltered;
  const primaryCats = ALL_APPS_CATEGORIES.filter((c) => PRIMARY_CATS.includes(c.id));
  const secondaryCats = ALL_APPS_CATEGORIES.filter((c) => !PRIMARY_CATS.includes(c.id));

  /* Group apps by category for the "All" view */
  const groupedApps = useMemo(() => {
    if (isSearchOrFilter) return [];
    return ALL_APPS_CATEGORIES.map((cat) => ({
      ...cat,
      apps: APP_REGISTRY.filter((a) => getAppCategory(a.id) === cat.id),
    })).filter((g) => g.apps.length > 0);
  }, [isSearchOrFilter]);

  const dateLocale = lang === "zh" ? "zh-CN" : lang === "ar" ? "ar-SA" : "en-US";
  const today = new Date().toLocaleDateString(dateLocale, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const activeCount = filteredApps.filter((a) => a.active).length;
  const totalCount = filteredApps.length;

  const chipCls = (active: boolean) =>
    `h-8 px-4 rounded-full text-[12px] font-semibold transition-all duration-200 border whitespace-nowrap ${
      active
        ? dk
          ? "bg-white text-black border-white"
          : "bg-black text-white border-black"
        : dk
          ? "bg-transparent border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/[0.16]"
          : "bg-transparent border-black/[0.08] text-black/40 hover:text-black/70 hover:border-black/[0.16]"
    }`;

  /* ── Full App Card (for grid) ── */
  const AppCard = ({ app, showStar = false }: { app: AppDef; showStar?: boolean }) => {
    const Icon = app.icon;
    const label = t(app.tKey, app.name);
    const isFav = favoriteIds.includes(app.id);
    const isCurrentApp = currentAppId === app.id;

    return (
      <div
        role="button"
        tabIndex={app.active ? 0 : -1}
        onClick={() => handleAppClick(app)}
        onKeyDown={(e) => { if (e.key === "Enter") handleAppClick(app); }}
        className={`relative flex flex-col items-center justify-center gap-3 p-5 md:p-6 min-h-[110px] md:min-h-[120px] border rounded-2xl transition-all duration-200 select-none ${
          app.active
            ? isCurrentApp
              ? `cursor-pointer group ${
                  dk
                    ? "bg-white/[0.08] border-white/[0.18] ring-1 ring-white/[0.08]"
                    : "bg-black/[0.05] border-black/[0.15] ring-1 ring-black/[0.05]"
                }`
              : `cursor-pointer group ${
                  dk
                    ? "bg-[#111] border-white/[0.06] hover:border-white/[0.18] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)] active:translate-y-0 active:scale-[0.97]"
                    : "bg-white border-black/[0.06] hover:border-black/[0.14] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] active:translate-y-0 active:scale-[0.97]"
                }`
            : `cursor-default ${dk ? "bg-[#0c0c0c] border-white/[0.03]" : "bg-[#f8f8f8] border-black/[0.03]"}`
        }`}
      >
        {showStar && app.active && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); toggleFavorite(app.id); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); toggleFavorite(app.id); } }}
            className={`absolute top-2 end-2 p-1.5 rounded-lg transition-all duration-200 ${
              isFav
                ? "text-amber-400 hover:text-amber-300 hover:scale-110"
                : dk
                  ? "text-white/0 group-hover:text-white/20 hover:!text-amber-400 hover:!scale-110"
                  : "text-black/0 group-hover:text-black/15 hover:!text-amber-400 hover:!scale-110"
            }`}
            aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
          >
            <Star size={12} fill={isFav ? "currentColor" : "none"} />
          </span>
        )}
        <span className={`transition-all duration-200 ${
          app.active
            ? isCurrentApp
              ? dk ? "text-white" : "text-black"
              : dk ? "text-white/45 group-hover:text-white" : "text-black/45 group-hover:text-black"
            : dk ? "text-white/15" : "text-black/15"
        }`}>
          <Icon size={24} strokeWidth={1.6} />
        </span>
        <span className={`text-[11px] font-medium text-center leading-tight transition-all duration-200 ${
          app.active
            ? isCurrentApp
              ? dk ? "text-white font-semibold" : "text-black font-semibold"
              : dk ? "text-white/50 group-hover:text-white/90" : "text-black/50 group-hover:text-black/90"
            : dk ? "text-white/15" : "text-black/15"
        }`}>
          {label}
        </span>
      </div>
    );
  };

  /* ── Compact horizontal card (for favorites row / recent strip) ── */
  const CompactCard = ({ app, showStar = false }: { app: AppDef; showStar?: boolean }) => {
    const Icon = app.icon;
    const label = t(app.tKey, app.name);
    const isFav = favoriteIds.includes(app.id);

    return (
      <div
        role="button"
        tabIndex={app.active ? 0 : -1}
        onClick={() => handleAppClick(app)}
        onKeyDown={(e) => { if (e.key === "Enter") handleAppClick(app); }}
        className={`relative flex items-center gap-2.5 px-3.5 py-2.5 border rounded-xl transition-all duration-200 shrink-0 select-none ${
          app.active
            ? `cursor-pointer group ${
                dk
                  ? "bg-[#111] border-white/[0.06] hover:border-white/[0.18] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,0,0,0.4)] active:translate-y-0 active:scale-[0.98]"
                  : "bg-white border-black/[0.06] hover:border-black/[0.14] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)] active:translate-y-0 active:scale-[0.98]"
              }`
            : `cursor-default opacity-20 ${dk ? "bg-[#0e0e0e] border-white/[0.02]" : "bg-[#f5f5f5] border-black/[0.02]"}`
        }`}
      >
        <span className={`transition-colors duration-200 ${
          app.active
            ? dk ? "text-white/45 group-hover:text-white" : "text-black/45 group-hover:text-black"
            : dk ? "text-white/25" : "text-black/25"
        }`}>
          <Icon size={17} strokeWidth={1.6} />
        </span>
        <span className={`text-[12px] font-medium whitespace-nowrap transition-colors duration-200 ${
          app.active
            ? dk ? "text-white/55 group-hover:text-white/90" : "text-black/55 group-hover:text-black/90"
            : dk ? "text-white/25" : "text-black/25"
        }`}>
          {label}
        </span>
        {showStar && app.active && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); toggleFavorite(app.id); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); toggleFavorite(app.id); } }}
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
          </span>
        )}
      </div>
    );
  };

  return (
    <div className={`${dk ? "bg-black" : "bg-white"} min-h-screen transition-colors duration-300`}>
      <div className="px-4 md:px-10 py-5 md:py-6 pb-20 max-w-[1400px]">

        {/* ── Header: Greeting + Date ── */}
        <div className="mb-5 md:mb-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 md:gap-3">
            <div>
              <h1 className={`text-[22px] md:text-[32px] font-bold tracking-tight ${dk ? "text-white" : "text-black"}`}>
                {t(getGreetingKey())}{firstName ? `, ${firstName}` : ""}
              </h1>
              <p className={`text-[13px] mt-0.5 ${dk ? "text-white/30" : "text-black/30"}`}>{t("applicationsDesc")}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`text-[11px] font-medium ${dk ? "text-white/20" : "text-black/20"}`}>{today}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                dk ? "text-white/25 bg-white/[0.04]" : "text-black/25 bg-black/[0.04]"
              }`}>
                {activeCount}/{totalCount}
              </span>
            </div>
          </div>
        </div>

        {/* ── Zone A: Search ── */}
        <div className="mb-6">
          <div className={`relative flex items-center w-full h-11 border rounded-xl px-4 gap-3 transition-all duration-200 ${
            dk
              ? "bg-white/[0.03] border-white/[0.06] focus-within:border-white/[0.20] focus-within:bg-white/[0.05]"
              : "bg-black/[0.02] border-black/[0.06] focus-within:border-black/[0.20] focus-within:bg-black/[0.04]"
          }`}>
            <Search size={16} className={dk ? "text-white/20" : "text-black/20"} />
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
            {search && (
              <button onClick={() => setSearch("")} className={`text-[11px] font-medium px-2 py-0.5 rounded-md transition-colors ${
                dk ? "text-white/40 hover:text-white/70 hover:bg-white/[0.06]" : "text-black/40 hover:text-black/70 hover:bg-black/[0.06]"
              }`}>
                Clear
              </button>
            )}
            <kbd className={`hidden md:inline text-[10px] font-medium px-1.5 py-0.5 rounded ${
              dk ? "bg-white/[0.06] text-white/20" : "bg-black/[0.06] text-black/20"
            }`}>⌘K</kbd>
          </div>
        </div>

        {/* ── Zone B: Favorites ── */}
        {!isSearchOrFilter && favoriteApps.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2.5">
              <Star size={11} className={dk ? "text-amber-400/50" : "text-amber-500/50"} fill="currentColor" />
              <span className={`text-[10px] font-semibold tracking-[1.5px] uppercase ${dk ? "text-white/25" : "text-black/25"}`}>
                {t("favorites")}
              </span>
            </div>
            {favoriteApps.length < 3 ? (
              <div className="flex gap-2.5 overflow-x-auto scrollbar-none">
                {favoriteApps.map((app) => (
                  <CompactCard key={app.id} app={app} showStar />
                ))}
              </div>
            ) : (
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
              <Clock size={11} className={dk ? "text-white/18" : "text-black/18"} />
              <span className={`text-[10px] font-semibold tracking-[1.5px] uppercase ${dk ? "text-white/25" : "text-black/25"}`}>
                {t("recent")}
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
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <button onClick={() => { setActiveCategory("all"); setShowMore(false); }} className={chipCls(activeCategory === "all")}>
            {t("all")}
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
              className={`h-8 px-3.5 rounded-full text-[12px] font-semibold transition-all duration-200 border whitespace-nowrap ${
                showMore || secondaryCats.some((c) => c.id === activeCategory)
                  ? dk ? "bg-white/[0.08] border-white/[0.14] text-white/60" : "bg-black/[0.06] border-black/[0.12] text-black/60"
                  : dk ? "bg-transparent border-white/[0.06] text-white/25 hover:text-white/50" : "bg-transparent border-black/[0.06] text-black/25 hover:text-black/50"
              }`}
            >
              {t("more")}{showMore ? " -" : " +"}
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

        {isSearchOrFilter ? (
          /* Flat grid when searching or filtering by category */
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
            {filteredApps.map((app) => (
              <AppCard key={app.id} app={app} showStar />
            ))}
          </div>
        ) : (
          /* Grouped by category when showing all */
          <div className="space-y-7">
            {groupedApps.map((group) => (
              <div key={group.id}>
                <div className="flex items-center gap-2.5 mb-3">
                  <span className={`text-[11px] font-semibold tracking-[1px] uppercase ${dk ? "text-white/25" : "text-black/25"}`}>
                    {t(group.tKey, group.label)}
                  </span>
                  <div className={`flex-1 h-px ${dk ? "bg-white/[0.04]" : "bg-black/[0.04]"}`} />
                  <span className={`text-[10px] font-medium ${dk ? "text-white/15" : "text-black/15"}`}>
                    {group.apps.filter((a) => a.active).length}/{group.apps.length}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                  {group.apps.map((app) => (
                    <AppCard key={app.id} app={app} showStar />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI FAB */}
      <button className={`fixed bottom-6 end-6 z-40 w-12 h-12 rounded-full ${
        dk ? "bg-white text-black" : "bg-black text-white"
      } flex flex-col items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-transform duration-200`}>
        <Sparkles size={18} />
        <span className="text-[7px] font-bold tracking-wider mt-0.5">AI</span>
      </button>
    </div>
  );
}
