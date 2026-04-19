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
import SearchIcon from "@/components/icons/ui/SearchIcon";
import StarIcon from "@/components/icons/ui/StarIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import { useTranslation } from "@/lib/i18n";
import { hubT } from "@/lib/translations/hub";
import {
  APP_REGISTRY,
  ALL_APPS_CATEGORIES,
  getAppCategory,
  getActiveAppId,
  getAppBadge,
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
import { usePermittedModules } from "@/lib/use-scope";

const PRIMARY_CATS = ["operations", "commercial", "people", "communication", "system"];

function getGreetingKey(): string {
  const h = new Date().getHours();
  if (h < 12) return "greeting.morning";
  if (h < 18) return "greeting.afternoon";
  return "greeting.evening";
}

/* ── Clock Widget: Analog + Digital ── */
function ClockWidget({ dk = true }: { dk?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [digitalTime, setDigitalTime] = useState("");
  const [tzLabel, setTzLabel] = useState("");
  const [size, setSize] = useState(120);

  /* Responsive clock size */
  useEffect(() => {
    const update = () => setSize(window.innerWidth < 640 ? 80 : 120);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    cvs.width = size * dpr;
    cvs.height = size * dpr;
    ctx.scale(dpr, dpr);

    function draw() {
      if (!ctx) return;
      const r = size / 2;
      const now = new Date();
      const h = now.getHours() % 12;
      const m = now.getMinutes();
      const s = now.getSeconds();

      ctx.clearRect(0, 0, size, size);

      /* Face */
      ctx.beginPath();
      ctx.arc(r, r, r - 1.5, 0, Math.PI * 2);
      ctx.fillStyle = dk ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";
      ctx.fill();
      ctx.strokeStyle = dk ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      /* Hour ticks */
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6 - Math.PI / 2;
        const outer = r - 6;
        const inner = i % 3 === 0 ? r - 16 : r - 11;
        ctx.beginPath();
        ctx.moveTo(r + Math.cos(angle) * inner, r + Math.sin(angle) * inner);
        ctx.lineTo(r + Math.cos(angle) * outer, r + Math.sin(angle) * outer);
        ctx.strokeStyle = dk ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.30)";
        ctx.lineWidth = i % 3 === 0 ? 2.5 : 1.2;
        ctx.stroke();
      }

      /* Hour hand */
      const hAngle = ((h + m / 60) * Math.PI) / 6 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(r, r);
      ctx.lineTo(r + Math.cos(hAngle) * (r * 0.45), r + Math.sin(hAngle) * (r * 0.45));
      ctx.strokeStyle = dk ? "rgba(255,255,255,0.80)" : "rgba(0,0,0,0.80)";
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.stroke();

      /* Minute hand */
      const mAngle = ((m + s / 60) * Math.PI) / 30 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(r, r);
      ctx.lineTo(r + Math.cos(mAngle) * (r * 0.62), r + Math.sin(mAngle) * (r * 0.62));
      ctx.strokeStyle = dk ? "rgba(255,255,255,0.60)" : "rgba(0,0,0,0.60)";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.stroke();

      /* Second hand — thin red line */
      const sAngle = (s * Math.PI) / 30 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(r + Math.cos(sAngle + Math.PI) * (r * 0.18), r + Math.sin(sAngle + Math.PI) * (r * 0.18));
      ctx.lineTo(r + Math.cos(sAngle) * (r * 0.75), r + Math.sin(sAngle) * (r * 0.75));
      ctx.strokeStyle = "rgba(239,68,68,0.7)";
      ctx.lineWidth = 1.2;
      ctx.lineCap = "round";
      ctx.stroke();

      /* Center dot */
      ctx.beginPath();
      ctx.arc(r, r, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(239,68,68,0.8)";
      ctx.fill();

      /* Digital time */
      const pad = (n: number) => n.toString().padStart(2, "0");
      setDigitalTime(`${pad(now.getHours())}:${pad(m)}:${pad(s)}`);
    }

    /* Timezone label — e.g. "Dubai (GMT+4)" */
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const city = tz.split("/").pop()?.replace(/_/g, " ") || tz;
      const offset = -new Date().getTimezoneOffset();
      const sign = offset >= 0 ? "+" : "-";
      const hrs = Math.floor(Math.abs(offset) / 60);
      const mins = Math.abs(offset) % 60;
      const gmtStr = `GMT${sign}${hrs}${mins ? `:${mins.toString().padStart(2, "0")}` : ""}`;
      setTzLabel(`${city} (${gmtStr})`);
    } catch { setTzLabel(""); }

    draw();
    const interval = setInterval(draw, 1000);
    return () => clearInterval(interval);
  }, [dk, size]);

  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <canvas ref={canvasRef} style={{ width: size, height: size }} />
      <span className={`text-[12px] sm:text-[15px] font-mono font-semibold tracking-wider tabular-nums ${
        dk ? "text-white/40" : "text-black/40"
      }`}>
        {digitalTime}
      </span>
      {tzLabel && (
        <span className={`text-[10px] font-medium tracking-wide ${
          dk ? "text-white/20" : "text-black/20"
        }`}>
          {tzLabel}
        </span>
      )}
    </div>
  );
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
      // trackAppOpen writes to the server async; the next time the user
      // lands on / the dashboard will re-fetch the updated recent list.
      // We intentionally do NOT call setRecentIds here — doing so causes
      // the "Recent" row to appear/grow on the current page, shifting
      // the click target down right before router.push navigates away,
      // which looks like the page auto-scrolls.
      if (id) trackAppOpen(id, app.id);
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

  /* ── Role-based app visibility ──
     The app launcher honors the same permitted-modules rule as the
     sidebar: if the viewer's role has can_view = false on a module (or
     an account-level override hides it), that app is removed from the
     Launcher grid, favorites, recents, category groups, and search —
     not just the sidebar. SA still sees everything.

     While the permission check is still loading we show NOTHING
     (returned early by the grid render path below) — never the full
     catalogue, since that would briefly expose apps a user isn't
     allowed to see. */
  const { modules: permittedModules, loading: permLoading } =
    usePermittedModules();

  const visibleRegistry = useMemo(() => {
    // Fail-closed: while perms load, show no apps at all.
    if (permLoading) return [];
    return APP_REGISTRY.filter((a) => permittedModules.has(a.name));
  }, [permLoading, permittedModules]);

  /* ── Derived ── */
  const filteredApps = useMemo(() => {
    let result = visibleRegistry;
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
  }, [search, activeCategory, t, visibleRegistry]);

  const favoriteApps = useMemo(
    () => favoriteIds.map((id) => visibleRegistry.find((a) => a.id === id)).filter((a): a is AppDef => !!a),
    [favoriteIds, visibleRegistry],
  );
  const recentApps = useMemo(
    () =>
      recentIds
        .filter((id) => !favoriteIds.includes(id))
        .map((id) => visibleRegistry.find((a) => a.id === id))
        .filter((a): a is AppDef => !!a)
        .slice(0, 6),
    [recentIds, favoriteIds, visibleRegistry],
  );

  const isSearching = search.trim() !== "";
  const isFiltered = activeCategory !== "all";
  const isSearchOrFilter = isSearching || isFiltered;
  const primaryCats = ALL_APPS_CATEGORIES.filter((c) => PRIMARY_CATS.includes(c.id));
  const secondaryCats = ALL_APPS_CATEGORIES.filter((c) => !PRIMARY_CATS.includes(c.id));

  /* Group apps by category for the "All" view. Uses the role-filtered
     visibleRegistry so categories with no accessible apps disappear. */
  const groupedApps = useMemo(() => {
    if (isSearchOrFilter) return [];
    return ALL_APPS_CATEGORIES.map((cat) => ({
      ...cat,
      apps: visibleRegistry.filter((a) => getAppCategory(a.id) === cat.id),
    })).filter((g) => g.apps.length > 0);
  }, [isSearchOrFilter, visibleRegistry]);

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
    const isAi = app.id === "ai";
    /* NEW / UPDATED badge — rendered as a small pill at the top-left
       of the tile. getAppBadge auto-expires after APP_BADGE_TTL_MS
       (3 days) so dev sets newSince / updatedSince once and forgets. */
    const badge = getAppBadge(app);

    return (
      <div
        role="button"
        tabIndex={app.active ? 0 : -1}
        onClick={() => handleAppClick(app)}
        onKeyDown={(e) => { if (e.key === "Enter") handleAppClick(app); }}
        className={`relative flex flex-col items-center justify-center gap-2.5 p-3 aspect-square rounded-2xl transition-all duration-200 select-none ${
          isAi
            ? "ai-card-neon cursor-default"
            : app.active
              ? isCurrentApp
                ? `cursor-pointer group border ${
                    dk
                      ? "bg-white/[0.08] border-white/[0.18] ring-1 ring-white/[0.08]"
                      : "bg-black/[0.05] border-black/[0.15] ring-1 ring-black/[0.05]"
                  }`
                : `cursor-pointer group border ${
                    dk
                      ? "bg-[#111] border-white/[0.06] hover:border-white/[0.18] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)] active:translate-y-0 active:scale-[0.97]"
                      : "bg-white border-black/[0.06] hover:border-black/[0.14] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] active:translate-y-0 active:scale-[0.97]"
                  }`
              : `cursor-default border ${dk ? "bg-[#0c0c0c] border-white/[0.03]" : "bg-[#f8f8f8] border-black/[0.03]"}`
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
            <StarIcon size={12} style={{ fill: isFav ? "currentColor" : "none" }} />
          </span>
        )}

        {badge && (
          <span
            className={`absolute top-2 start-2 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold tracking-wider uppercase pointer-events-none select-none ${
              badge === "new"
                ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40"
                : "bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/40"
            }`}
            aria-label={badge === "new" ? "New app" : "Updated app"}
            title={badge === "new" ? "New app" : "Recently updated"}
          >
            {badge === "new" ? "NEW" : "UPDATED"}
          </span>
        )}
        <span className={`transition-all duration-200 ${
          isAi
            ? "opacity-100"
            : app.active
              ? isCurrentApp
                ? dk ? "text-white opacity-100" : "text-black opacity-100"
                : dk ? "text-white opacity-45 group-hover:opacity-100" : "text-black opacity-45 group-hover:opacity-100"
              : dk ? "text-white opacity-[0.15]" : "text-black opacity-[0.15]"
        }`}
          style={isAi ? {
            filter:
              "drop-shadow(0 0 10px rgba(0,212,255,0.4)) drop-shadow(0 0 20px rgba(123,97,255,0.25))",
          } : undefined}
        >
          {/* The shared AppIcon type only declares size + className, but
              AiFaceIcon also accepts `animated`. Render through a widened
              component reference when isAi so we can pass the animation
              flag without mutating the shared type. */}
          {(() => {
            if (isAi) {
              const AnimatedIcon = Icon as React.ComponentType<{
                size?: number;
                animated?: boolean;
              }>;
              return <AnimatedIcon size={44} animated />;
            }
            return <Icon size={34} />;
          })()}
        </span>
        <span className={`text-[12px] font-medium text-center leading-tight transition-all duration-200 ${
          app.active
            ? isCurrentApp
              ? dk ? "text-white font-semibold" : "text-black font-semibold"
              : dk ? "text-white/50 group-hover:text-white/90" : "text-black/50 group-hover:text-black/90"
            : dk ? "text-white/15" : "text-black/15"
        }`}>
          {label}
        </span>
        {!app.active && (
          <span className={`text-[8px] font-semibold tracking-[0.5px] uppercase ${
            dk ? "text-white/10" : "text-black/10"
          }`}>
            {t("comingSoon")}
          </span>
        )}
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
        <span className={`transition-all duration-200 ${
          app.active
            ? dk ? "text-white opacity-45 group-hover:opacity-100" : "text-black opacity-45 group-hover:opacity-100"
            : dk ? "text-white opacity-25" : "text-black opacity-25"
        }`}>
          <Icon size={17} />
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
            <StarIcon size={11} style={{ fill: isFav ? "currentColor" : "none" }} />
          </span>
        )}
      </div>
    );
  };

  return (
    <div className={`${dk ? "bg-[#0A0A0A]" : "bg-white"} min-h-screen transition-colors duration-300`}>
      <div className="px-4 md:px-10 py-5 md:py-6 pb-20 max-w-[1400px] mx-auto">

        {/* ── Header: Greeting + Clock + Date ── */}
        <div className="mb-5 md:mb-6 min-h-[160px] md:min-h-[180px] flex items-center">
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="min-w-0">
              <h1 className={`text-[22px] md:text-[30px] font-bold tracking-tight ${dk ? "text-white" : "text-black"}`}>
                {t(getGreetingKey())}{firstName ? `, ${firstName}` : ""}
              </h1>
              <p className={`text-[14px] mt-1.5 font-medium ${dk ? "text-white/40" : "text-black/40"}`}>{today}</p>
              <p className={`text-[12px] mt-0.5 hidden md:block ${dk ? "text-white/25" : "text-black/25"}`}>{t("applicationsDesc")}</p>
            </div>
            <ClockWidget dk={dk} />
          </div>
        </div>

        {/* ── Zone A: Search ── */}
        <div className="mb-6">
          <div className={`relative flex items-center w-full h-11 border rounded-xl px-4 gap-3 transition-all duration-200 ${
            dk
              ? "bg-white/[0.03] border-white/[0.06] focus-within:border-white/[0.20] focus-within:bg-white/[0.05]"
              : "bg-black/[0.02] border-black/[0.06] focus-within:border-black/[0.20] focus-within:bg-black/[0.04]"
          }`}>
            <SearchIcon size={16} className={dk ? "text-white/20" : "text-black/20"} />
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
              <StarIcon size={11} className={dk ? "text-amber-400/50" : "text-amber-500/50"} />
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
              <ClockIcon size={11} className={dk ? "text-white/18" : "text-black/18"} />
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
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-3">
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
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-3">
                  {group.apps.map((app) => (
                    <AppCard key={app.id} app={app} showStar />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI card animated neon border */}
      <style>{`
        @property --ai-card-angle {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes ai-card-spin {
          0% { --ai-card-angle: 0deg; }
          100% { --ai-card-angle: 360deg; }
        }
        .ai-card-neon {
          animation: ai-card-spin 3s linear infinite;
          border: 1.5px solid transparent;
          background-origin: border-box;
          background-clip: padding-box, border-box;
          background-image:
            linear-gradient(${dk ? "#0c0c0c" : "#f8f8f8"}, ${dk ? "#0c0c0c" : "#f8f8f8"}),
            conic-gradient(
              from var(--ai-card-angle),
              rgba(0,212,255,0.6),
              rgba(123,97,255,0.6),
              rgba(255,110,199,0.5),
              rgba(0,212,255,0.15),
              rgba(123,97,255,0.6),
              rgba(0,212,255,0.6)
            );
          box-shadow:
            0 0 12px rgba(123,97,255,0.15),
            0 0 24px rgba(0,212,255,0.08);
        }
        .ai-card-neon:hover {
          box-shadow:
            0 0 16px rgba(123,97,255,0.25),
            0 0 32px rgba(0,212,255,0.15);
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}
