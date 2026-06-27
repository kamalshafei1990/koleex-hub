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
import KoleexOrb from "@/components/ai/KoleexOrb";
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
import { getMeBootstrapLastError, retryMeBootstrap, useMeBootstrap } from "@/lib/me-bootstrap";
import { useShortcutHint } from "@/lib/ui/use-shortcut-hint";
import { fetchMyChannels, subscribeToMyChannels } from "@/lib/discuss";
import { fetchUnreadTaskCount, subscribeToInboxMessages } from "@/lib/inbox";

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
  const shortcut = useShortcutHint(); // platform-aware ⌘K / Ctrl K label + tooltip
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showMore, setShowMore] = useState(false);

  /* Koleex AI greeter — fire a one-shot "jump" wave shortly after the home
     hero mounts, so the orb greets you alongside the message. */
  const [greet, setGreet] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setGreet(1), 450);
    return () => clearTimeout(id);
  }, []);

  /* ── Per-user data ── */
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const accountIdRef = useRef<string | null>(null);
  /* Unread Discuss messages → notification badge on the Discuss app tile.
     Mirrors the NotificationBell source of truth (fetchMyChannels +
     subscribeToMyChannels + the "discuss:unread-changed" event) so the
     home badge stays in lock-step with the bell and the in-app sidebar. */
  const [discussUnread, setDiscussUnread] = useState(0);
  /* Unread task assignments → notification badge on the To-do app tile.
     Sourced from inbox_messages (category "task") which the todo
     assignment fan-out writes, so the count = "tasks assigned to me I
     haven't read". Kept live via inbox realtime + the inbox recount
     event + a slow poll, mirroring the Discuss badge below. */
  const [todoUnread, setTodoUnread] = useState(0);

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

  /* ── Discuss unread badge ──
     Recompute the total across all my channels, then keep it live via
     realtime inserts, the cross-component "discuss:unread-changed" event
     (fired when a channel is read to the bottom), and a slow poll that
     covers any realtime gaps. Cheap: one small query set per refresh. */
  useEffect(() => {
    const id = account?.id ?? getCurrentAccountIdSync();
    if (!id) return;
    let cancelled = false;

    const recount = async () => {
      try {
        const rows = await fetchMyChannels(id);
        if (cancelled) return;
        setDiscussUnread(rows.reduce((acc, c) => acc + (c.unread_count ?? 0), 0));
      } catch {
        /* keep prior count on transient failure */
      }
    };

    void recount();

    const unsubscribe = subscribeToMyChannels({
      onMessageInsert: (msg) => {
        if (msg.author_account_id === id) return;
        void recount();
      },
      onChannelChange: () => void recount(),
    });

    const onUnreadChanged = () => void recount();
    window.addEventListener("discuss:unread-changed", onUnreadChanged);

    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void recount();
    }, 60_000);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("discuss:unread-changed", onUnreadChanged);
      window.clearInterval(poll);
    };
  }, [account?.id]);

  /* ── To-do unread badge ──
     Count unread task-assignment inbox messages, kept live via the inbox
     realtime INSERT stream (recount only when a new TASK arrives), the
     shared "inbox:force-recount" event (fired when a task is read/edited),
     and a slow visible-tab poll. */
  useEffect(() => {
    const id = account?.id ?? getCurrentAccountIdSync();
    if (!id) return;
    let cancelled = false;

    const recount = async () => {
      try {
        const n = await fetchUnreadTaskCount(id);
        if (!cancelled) setTodoUnread(n);
      } catch {
        /* keep prior count on transient failure */
      }
    };

    void recount();

    const unsubscribe = subscribeToInboxMessages(id, (msg) => {
      if (msg.category === "task") void recount();
    });

    const onRecount = () => void recount();
    window.addEventListener("inbox:force-recount", onRecount);

    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void recount();
    }, 60_000);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("inbox:force-recount", onRecount);
      window.clearInterval(poll);
    };
  }, [account?.id]);

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

  /* Warm a route's JS chunk + RSC payload BEFORE the user clicks, so opening
     an app is near-instant instead of cold-loading on tap. Guarded so each
     route is only prefetched once. */
  const prefetchedRef = useRef<Set<string>>(new Set());
  const prefetchApp = useCallback(
    (app: AppDef) => {
      if (!app.active || prefetchedRef.current.has(app.route)) return;
      prefetchedRef.current.add(app.route);
      try { router.prefetch(app.route); } catch { /* ignore */ }
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

  const { data: meBoot } = useMeBootstrap();
  const isSuperAdmin = !!meBoot?.isSuperAdmin;

  const visibleRegistry = useMemo(() => {
    // Fail-closed: while perms load, show no apps at all.
    if (permLoading) return [];
    return APP_REGISTRY.filter((a) => {
      if (a.hideFromLauncher) return false;
      // Super-Admin-only apps (e.g. Activity Monitor) gate on the bootstrap flag,
      // not on a module permission name.
      if (a.superAdminOnly) return isSuperAdmin;
      return permittedModules.has(a.name);
    });
  }, [permLoading, permittedModules, isSuperAdmin]);

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

  /* When the dashboard goes idle, warm the most-likely destinations (favorites
     + recent) so the very first tap on mobile is instant too — hover/touch
     prefetch can't help on a cold first interaction. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const targets = [...favoriteApps, ...recentApps];
    if (targets.length === 0) return;
    const warm = () => targets.forEach((a) => prefetchApp(a));
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(warm, { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(warm, 1000);
    return () => window.clearTimeout(id);
  }, [favoriteApps, recentApps, prefetchApp]);

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
    /* Per-app live notification count. Discuss = unread messages,
       To-do = unread task assignments; other apps fall through to 0. */
    const appUnread =
      app.id === "discuss" ? discussUnread : app.id === "todo" ? todoUnread : 0;
    const appUnreadNoun = app.id === "todo" ? "task" : "message";

    return (
      <div
        role="button"
        tabIndex={app.active ? 0 : -1}
        onClick={() => handleAppClick(app)}
        onKeyDown={(e) => { if (e.key === "Enter") handleAppClick(app); }}
        onPointerEnter={() => prefetchApp(app)}
        onTouchStart={() => prefetchApp(app)}
        onFocus={() => prefetchApp(app)}
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
            className={`absolute top-2 start-2 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold tracking-wider uppercase pointer-events-none select-none whitespace-nowrap ${
              badge === "new"
                ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40"
                : badge === "updated"
                  ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/40"
                  : "bg-[#0066FF]/20 text-[#3385FF] ring-1 ring-[#0066FF]/40"
            }`}
            aria-label={badge === "new" ? "New app" : badge === "updated" ? "Updated app" : "Ready to use"}
            title={badge === "new" ? "New app" : badge === "updated" ? "Recently updated" : "Ready to use"}
          >
            {badge === "new" ? "NEW" : badge === "updated" ? "UPDATED" : "Ready to use"}
          </span>
        )}
        <span className={`transition-all duration-200 ${
          isAi
            ? "opacity-100"
            : app.active
              /* Active app icons are now full-opacity by default
                 (user: "apps color white not gray"). AI keeps its
                 custom neon/drop-shadow treatment above — untouched.
                 Coming-soon (inactive) apps stay faded. */
              ? dk ? "text-white opacity-100" : "text-black opacity-100"
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
              flag without mutating the shared type.
              The icon is wrapped in a relative span so the Discuss unread
              badge can pin to the icon's top-right corner (an app-style
              notification badge that never collides with the hover star). */}
          <span className="relative inline-flex">
            {appUnread > 0 && (
              <span
                className={`absolute -top-2 -end-2.5 z-10 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-[#FF3333] text-white text-[10px] font-bold leading-none ring-2 ${dk ? "ring-[#111]" : "ring-white"} pointer-events-none select-none`}
                aria-label={`${appUnread} unread`}
                title={`${appUnread} unread ${appUnreadNoun}${appUnread === 1 ? "" : "s"}`}
              >
                {appUnread > 99 ? "99+" : appUnread}
              </span>
            )}
            {(() => {
              if (isAi) {
                const AnimatedIcon = Icon as React.ComponentType<{
                  size?: number;
                  animated?: boolean;
                  scaleClass?: string;
                }>;
                /* The custom orb fills its box, so size it like every other app
                   icon (34) — no scale needed. */
                return <AnimatedIcon size={34} animated scaleClass="scale-100" />;
              }
              return <Icon size={34} />;
            })()}
          </span>
        </span>
        <span className={`text-[12px] font-medium text-center leading-tight transition-all duration-200 ${
          app.active
            /* Labels track the icon: full colour for active apps,
               bold for the currently-open app (keeps the "you are
               here" signal), faded for coming-soon apps. */
            ? isCurrentApp
              ? dk ? "text-white font-semibold" : "text-black font-semibold"
              : dk ? "text-white/90" : "text-black/90"
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
        onPointerEnter={() => prefetchApp(app)}
        onTouchStart={() => prefetchApp(app)}
        onFocus={() => prefetchApp(app)}
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
            ? dk ? "text-white opacity-100" : "text-black opacity-100"
            : dk ? "text-white opacity-25" : "text-black opacity-25"
        }`}>
          <Icon size={17} />
        </span>
        <span className={`text-[12px] font-medium whitespace-nowrap transition-colors duration-200 ${
          app.active
            ? dk ? "text-white/90" : "text-black/90"
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
            <div className="flex items-center gap-4 md:gap-5 min-w-0">
              {/* Koleex AI greeter — the orb "delivers" the greeting + date. */}
              <KoleexOrb state="idle" greetKey={greet} size={72} className="shrink-0 hidden sm:block" />
              <div className="min-w-0">
                <h1 className={`text-[22px] md:text-[30px] font-bold tracking-tight ${dk ? "text-white" : "text-black"}`}>
                  {t(getGreetingKey())}{firstName ? `, ${firstName}` : ""}
                </h1>
                <p className={`text-[14px] mt-1.5 font-medium ${dk ? "text-white/40" : "text-black/40"}`}>{today}</p>
                <p className={`text-[12px] mt-0.5 hidden md:block ${dk ? "text-white/25" : "text-black/25"}`}>{t("applicationsDesc")}</p>
              </div>
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
            {/* Issue d54f3e66 (reopened): badge now shows the platform-
                correct key and carries a hover tooltip explaining what it
                does. Clicking it focuses the search input so it's usable
                without knowing the keyboard shortcut. */}
            <button
              type="button"
              onClick={() => document.getElementById("hub-search")?.focus()}
              title={shortcut.hint}
              aria-label={shortcut.hint}
              className={`hidden md:inline cursor-pointer text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${
                dk ? "bg-white/[0.06] text-white/40 hover:text-white/70" : "bg-black/[0.06] text-black/40 hover:text-black/70"
              }`}
            >
              <kbd>{shortcut.label}</kbd>
            </button>
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
              <div className="flex gap-2.5 overflow-x-auto scrollbar-none py-2 -my-1 px-1 -mx-1">
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
            <div className="flex gap-2.5 overflow-x-auto scrollbar-none py-2 -my-1 px-1 -mx-1 pb-0.5">
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

        {/* Mobile-resilience: while the permission bootstrap is in
            flight or has failed (timeout / 5xx / lost mobile signal),
            render a calm loading skeleton or a Retry banner instead
            of a silent empty grid. */}
        {permLoading ? (
          <AppGridSkeleton dk={dk} />
        ) : visibleRegistry.length === 0 ? (
          <BootstrapErrorBanner
            dk={dk}
            onRetry={async () => {
              await retryMeBootstrap();
              if (typeof window !== "undefined") window.location.reload();
            }}
          />
        ) : isSearchOrFilter ? (
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

/* ─── Mobile-resilience: loading + error states for the apps grid ─── */

function AppGridSkeleton({ dk }: { dk: boolean }) {
  /* Ghost cards so the page feels alive while permissions load.
     Replaces the previously silent empty area that left mobile
     operators staring at a blank screen on flaky connections. */
  const cellCls = dk ? "bg-white/[0.03] border-white/[0.04]" : "bg-black/[0.025] border-black/[0.05]";
  return (
    <div>
      <div className={`flex items-center gap-2 mb-3 text-[11px] font-medium ${dk ? "text-white/30" : "text-black/30"}`}>
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400/70" />
        Loading your apps…
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-3">
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className={`aspect-[1/1.1] rounded-2xl border ${cellCls} animate-pulse`}
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function BootstrapErrorBanner({ dk, onRetry }: { dk: boolean; onRetry: () => void }) {
  const err = getMeBootstrapLastError();
  const wasFailure = !!err;
  const isAuth = err?.kind === "http_401";
  return (
    <div
      className={`rounded-2xl border px-5 py-6 text-center ${
        wasFailure
          ? dk ? "border-amber-300/30 bg-amber-300/[0.04]" : "border-amber-600/30 bg-amber-50"
          : dk ? "border-white/[0.06] bg-white/[0.012]" : "border-black/[0.06] bg-black/[0.01]"
      }`}
    >
      <div className={`text-[13px] font-semibold ${dk ? "text-white/85" : "text-black/85"}`}>
        {wasFailure ? "We couldn't load your apps" : "No apps available for your account"}
      </div>
      <p className={`mt-1 text-[12px] ${dk ? "text-white/55" : "text-black/55"}`}>
        {wasFailure
          ? err!.message
          : "Your role doesn't have any modules enabled. Ask an admin to grant access."}
      </p>
      {wasFailure && err?.raw && (
        /* Diagnostic line — small, muted, so the operator can screenshot
           it for support without it dominating the panel. */
        <p className={`mt-1 text-[10.5px] ${dk ? "text-white/30" : "text-black/30"}`}>
          {err.kind}{err.status ? ` · ${err.status}` : ""}
        </p>
      )}
      {wasFailure && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {isAuth ? (
            <a
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/40 bg-emerald-300/[0.08] px-3 py-1.5 text-[12px] text-emerald-200 hover:bg-emerald-300/[0.16]"
            >
              Sign in again
            </a>
          ) : (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/40 bg-emerald-300/[0.08] px-3 py-1.5 text-[12px] text-emerald-200 hover:bg-emerald-300/[0.16]"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
