"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import MenuBurgerIcon from "@/components/icons/ui/MenuBurgerIcon";
import MoonIcon from "@/components/icons/ui/MoonIcon";
import SunIcon from "@/components/icons/ui/SunIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import { useTranslation } from "@/lib/i18n";
import { hubT } from "@/lib/translations/hub";
import UserMenu from "./UserMenu";
import NotificationBell from "./NotificationBell";
import TenantPicker from "./TenantPicker";
import ViewAsPicker from "./ViewAsPicker";
import KoleexLogo from "./KoleexLogo";
import { useSidebar } from "./SidebarContext";
import { APP_REGISTRY } from "@/lib/navigation";

/* ── Route → translation-key map ──
   Built once from APP_REGISTRY so every navigable app in the Hub
   automatically gets a recognised top-bar app-name without a manual
   entry here. Sorted longest-route first so /finance/orders prefers
   the Finance entry over a hypothetical shorter prefix match.
   Legacy entries that aren't in APP_REGISTRY (cat.system buckets,
   /products/new alias) are merged afterwards. */
const baseRouteKeys: Record<string, string> = Object.fromEntries(
  APP_REGISTRY.filter((a) => a.route && a.tKey).map((a) => [a.route, a.tKey]),
);
const routeKeys: Record<string, string> = {
  ...baseRouteKeys,
  "/products/new": "app.products",
  "/categories":     "cat.system",
  "/subcategories":  "cat.system",
  "/divisions":      "cat.system",
};
/* Pre-sorted route list so longest matches win in the startsWith
   fallback (e.g. /finance/orders → "/finance" beats "/"). */
const sortedRoutes = Object.keys(routeKeys).sort((a, b) => b.length - a.length);

/* ── Language config ── */
type Lang = "en" | "zh" | "ar";
const languages: { code: Lang; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "zh", label: "中文", short: "中文" },
  { code: "ar", label: "العربية", short: "عر" },
];

export default function MainHeader() {
  const pathname = usePathname();
  const { t } = useTranslation(hubT);
  /* Initialize from localStorage on the first client render — prevents the
     write-effect from clobbering the saved theme with the default "dark"
     value before the read-effect can run. Falls back to "dark" on SSR. */
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "dark";
    const saved = window.localStorage.getItem("koleex-theme");
    return saved === "light" || saved === "dark" ? saved : "dark";
  });
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === "undefined") return "en";
    const saved = window.localStorage.getItem("koleex-lang");
    return saved === "en" || saved === "zh" || saved === "ar" ? (saved as Lang) : "en";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("koleex-theme", theme);
    window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    localStorage.setItem("koleex-lang", lang);
    window.dispatchEvent(new CustomEvent("langchange", { detail: lang }));
  }, [lang]);

  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const dk = theme === "dark";
  const isHome = pathname === "/";
  const { mobileOpen, setMobileOpen } = useSidebar();

  /* Find the current app name from route — exact match first, then
     longest-prefix match so /finance/orders/123 still resolves to
     "Finance", /expenses/anything resolves to "Expenses", etc. */
  const routeKey = !isHome
    ? routeKeys[pathname]
      ?? routeKeys[sortedRoutes.find((r) => pathname === r || pathname.startsWith(r + "/")) || ""]
      ?? null
    : null;
  const appName = routeKey ? t(routeKey) : null;

  const btnCls = `flex items-center justify-center w-7 h-7 md:w-9 md:h-9 rounded-md md:rounded-lg border shrink-0 transition-all ${
    dk
      ? "border-white/[0.08] bg-white/[0.03] text-white/55 hover:text-white hover:bg-white/[0.06]"
      : "border-black/[0.08] bg-black/[0.03] text-black/55 hover:text-black hover:bg-black/[0.06]"
  }`;

  return (
    <header
      dir="ltr"
      className={`kx-mainheader fixed top-0 left-0 right-0 z-[100] h-14 flex items-center justify-between px-3 md:px-6 border-b transition-colors duration-300 ${
        dk
          ? "border-white/[0.08] bg-[#0A0A0A]"
          : "border-black/[0.08] bg-white"
      }`}
    >
      {/* Left: Hamburger (mobile) + Logo + Breadcrumb */}
      <div className="flex items-center gap-2 md:gap-2.5 min-w-0">
        {/* Mobile hamburger — opens sidebar drawer */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
          className={`md:hidden ${btnCls}`}
        >
          <MenuBurgerIcon size={16} />
        </button>

        <Link
          href="/"
          aria-label="Koleex Hub"
          className={`shrink-0 flex items-center ${dk ? "text-white" : "text-black"}`}
        >
          <KoleexLogo className="w-auto h-4 md:h-[18px]" />
        </Link>
        {appName && (
          <>
            <span
              aria-hidden
              className={`hidden md:inline-block w-px h-4 ${
                dk ? "bg-white/[0.14]" : "bg-black/[0.14]"
              }`}
            />
            <span
              className={`text-[13px] font-semibold hidden md:inline truncate max-w-[260px] tracking-tight ${
                dk ? "text-white/80" : "text-black/80"
              }`}
            >
              {appName}
            </span>
          </>
        )}
      </div>

      {/* Right: Language + Theme + Notifications + Account */}
      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
        {/* Language — desktop pill bar */}
        <div
          className={`hidden md:flex items-center h-9 rounded-lg border p-1 transition-colors ${
            dk
              ? "border-white/[0.08] bg-white/[0.03]"
              : "border-black/[0.08] bg-black/[0.03]"
          }`}
        >
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`relative h-7 w-[54px] rounded-md text-[11px] font-semibold tracking-wide transition-all duration-200 text-center ${
                lang === l.code
                  ? dk
                    ? "bg-white/[0.12] text-white shadow-sm"
                    : "bg-black/[0.10] text-black shadow-sm"
                  : dk
                    ? "text-white/45 hover:text-white/75"
                    : "text-black/45 hover:text-black/75"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Language — mobile dropdown */}
        <div ref={langRef} className="relative md:hidden">
          <button
            onClick={() => setLangOpen(!langOpen)}
            className={`flex items-center gap-0.5 h-7 px-2 rounded-md border text-[10px] font-semibold transition-colors ${
              dk
                ? "border-white/[0.08] bg-white/[0.04] text-white/70"
                : "border-black/[0.08] bg-black/[0.04] text-black/70"
            }`}
          >
            {languages.find((l) => l.code === lang)?.short}
            <AngleDownIcon size={12} className={`transition-transform ${langOpen ? "rotate-180" : ""}`} />
          </button>
          {langOpen && (
            <div
              className={`absolute top-full right-0 mt-1.5 w-28 rounded-lg border shadow-lg overflow-hidden z-50 ${
                dk
                  ? "border-white/[0.1] bg-[#1a1a1a]"
                  : "border-black/[0.1] bg-white"
              }`}
            >
              {languages.map((l) => (
                <button
                  key={l.code}
                  onClick={() => { setLang(l.code); setLangOpen(false); }}
                  className={`w-full px-3 py-2 text-left text-[12px] font-medium transition-colors ${
                    lang === l.code
                      ? dk
                        ? "bg-white/[0.08] text-white"
                        : "bg-black/[0.06] text-black"
                      : dk
                        ? "text-white/60 hover:bg-white/[0.04] hover:text-white"
                        : "text-black/60 hover:bg-black/[0.04] hover:text-black"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider between locale and tools (desktop only) */}
        <div
          aria-hidden
          className={`hidden md:block w-px h-5 mx-0.5 ${
            dk ? "bg-white/[0.08]" : "bg-black/[0.08]"
          }`}
        />

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(dk ? "light" : "dark")}
          aria-label={dk ? "Switch to light theme" : "Switch to dark theme"}
          className={`flex items-center justify-center w-7 h-7 md:w-9 md:h-9 rounded-md md:rounded-lg border transition-all ${
            dk
              ? "border-white/[0.08] bg-white/[0.03] text-white/55 hover:text-white hover:bg-white/[0.06]"
              : "border-black/[0.08] bg-black/[0.03] text-black/55 hover:text-black hover:bg-black/[0.06]"
          }`}
        >
          {dk ? <SunIcon size={15} className="md:w-4 md:h-4" /> : <MoonIcon size={15} className="md:w-4 md:h-4" />}
        </button>

        {/* Tenant picker — Super Admin only. Lets SA switch between
            tenants (Koleex host + customer-tenants). Invisible to regular
            users. Stores the active tenant_id in localStorage; each page
            load, loadScopeContext() reads the override and scopes every
            query accordingly. */}
        <TenantPicker dk={dk} />

        {/* View-as picker — Super Admin only. Lets the SA view the
            system as any other user in their tenant (read-only). The
            picker disappears once view-as is active; the persistent
            banner is the only way to exit. */}
        <ViewAsPicker dk={dk} />

        {/* Notification bell — system-wide notifications dropdown
            covering Discuss messages and inbox alerts from every app. */}
        <NotificationBell dk={dk} />

        {/* Subtle spacer before account */}
        <div className="hidden md:block w-1" />

        {/* User menu (avatar → identity + sign in/out) */}
        <UserMenu dk={dk} />
      </div>
    </header>
  );
}
