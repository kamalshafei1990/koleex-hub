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
import dynamic from "next/dynamic";
import UserMenu from "./UserMenu";
/* Lazy: the bell pulls the discuss + inbox + supabase data layer (~90KB gz).
   Deferring it takes that entire stack OFF the first-paint critical path on
   EVERY page; the icon slot is reserved so nothing shifts. */
/* The gate is the bell AT REST — icon + count, no data layer. It mounts the
   real 1105-line panel on the first click. Loading the panel eagerly here (as
   a plain dynamic import that renders immediately) put the inbox + discuss +
   supabase chunks into every page's boot; see NotificationBellGate. */
import NotificationBellGate from "./NotificationBellGate";
import TenantPicker from "./TenantPicker";
import ViewAsPicker from "./ViewAsPicker";
import KoleexLogo from "./KoleexLogo";
import { useSidebar } from "./SidebarContext";
import { APP_REGISTRY } from "@/lib/navigation";
import { useSkin } from "@/lib/appearance";

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
  { code: "ar", label: "العربية", short: "عربي" },
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

  /* Stay in sync if the theme is changed elsewhere (e.g. Settings → Display).
     Same-value updates are a no-op, so this never loops with the effect above. */
  useEffect(() => {
    const onThemeChange = (e: Event) => {
      const t = (e as CustomEvent<"light" | "dark">).detail;
      if (t === "light" || t === "dark") setTheme(t);
    };
    window.addEventListener("themechange", onThemeChange);
    return () => window.removeEventListener("themechange", onThemeChange);
  }, []);

  /* Drawer quick-settings dispatch langchange — mirror it so the desktop
     pill highlight (and this component's dir effect) stay in sync. */
  useEffect(() => {
    const onLang = (e: Event) => {
      const v = (e as CustomEvent<Lang>).detail;
      if (v === "en" || v === "zh" || v === "ar") setLang(v);
    };
    window.addEventListener("langchange", onLang);
    return () => window.removeEventListener("langchange", onLang);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    localStorage.setItem("koleex-lang", lang);
    window.dispatchEvent(new CustomEvent("langchange", { detail: lang }));
  }, [lang]);

  const dk = theme === "dark";
  /* Drives the sliding language indicator; Core renders the original pill. */
  const aurora = useSkin() === "aurora";

  /* SEQUENCE THE SLIDE AND THE MIRROR. Switching to or from Arabic flips the
     entire document to the other direction — a full-page reflow landing in
     the same 320ms the indicator needs, so the one motion that should read
     as calm was riding an earthquake ("not smooth same as english to
     chinese", and Chinese is exactly the case with no flip). For
     direction-changing picks the pill slides FIRST on a local pending value,
     and the real language (text + dir mirror) applies the moment the slide
     lands. Same-direction picks are unchanged. Guarded so a second click
     mid-slide is ignored rather than queued into a fight. */
  const [pendingLang, setPendingLang] = useState<Lang | null>(null);
  const shownLang = pendingLang ?? lang;
  const pickLang = (next: Lang) => {
    if (next === lang || pendingLang) return;
    const flips = (next === "ar") !== (lang === "ar");
    if (aurora && flips) {
      setPendingLang(next);
      window.setTimeout(() => {
        setLang(next);
        setPendingLang(null);
      }, 340);
    } else {
      setLang(next);
    }
  };
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
      ? "kx-hover-glow border-white/[0.08] bg-white/[0.03] text-white/55 hover:text-white hover:bg-white/[0.06]"
      : "border-black/[0.08] bg-black/[0.03] text-black/55 hover:text-black hover:bg-black/[0.06]"
  }`;

  return (
    <>
      {/* THE HEADER'S GLASS IS A SIBLING PANE, and the header itself carries
          no backdrop-filter. This is the third home for this material and the
          only one that works:

          · on the header ELEMENT, the filter renders — but the header becomes
            a backdrop root and every dropdown inside it loses its own blur
            (the bug that ate four commits);
          · on the header's ::before at z-index:-1, Chromium simply never
            renders the filter — verified live: the element-level inline test
            blurred the date scrolling beneath, the identical values on the
            pseudo did nothing;
          · on a SIBLING at z-[99], one notch under the header's z-[100], the
            filter renders AND the header stays filterless, so its children
            sample the real page.

          Under Core the pane is display:none and the header keeps its solid
          colour, exactly as before Aurora existed. */}
      <div aria-hidden className="kx-header-pane fixed top-0 left-0 right-0 h-14 z-[99] pointer-events-none" />
      <header
      dir="ltr"
      className={`kx-mainheader fixed top-0 left-0 right-0 z-[100] h-14 flex items-center justify-between gap-2 px-3 md:px-6 border-b transition-colors duration-300 ${
        dk
          ? "border-white/[0.08] bg-[#0A0A0A]"
          : "border-black/[0.08] bg-white"
      }`}
    >
      {/* Left: Hamburger (mobile) + Logo + Breadcrumb */}
      <div className="flex items-center gap-2 md:gap-2.5 min-w-0 shrink">
        {/* Mobile hamburger — opens sidebar drawer */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
          className={`md:hidden ${btnCls}`}
        >
          <MenuBurgerIcon size={16} />
        </button>

        {/* The logo is the way home from every screen, so it has to LOOK
            pressable and be easy to hit. It had neither: no hover state at
            all, and a hit area exactly the size of the image box — a click a
            few pixels off the glyph landed on the header and did nothing,
            which reads as "sometimes it doesn't work". The padding widens the
            target and the negative margin keeps the logo optically where it
            was. */}
        <Link
          href="/"
          aria-label="Koleex Hub"
          title="Koleex Hub"
          /* select-none: the logo is an <img>, and a double-click selects an
             image the way it selects a word — painting a blue selection box
             over the wordmark. It is chrome, not content; there is nothing
             here anyone would want to copy. */
          className={`select-none shrink-0 flex items-center rounded-lg -mx-2 px-2 -my-1 py-1 transition-opacity duration-150 hover:opacity-70 active:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#567FB2]/60 ${dk ? "text-white" : "text-black"}`}
        >
          {/* Hub logo v2 (owner-approved option B) — the script "hub" makes
              the lockup taller than the bare wordmark, so the img runs larger
              to keep KOLEEX at its familiar optical size.

              WEBP, NOT THE PNG. The source PNG is 3124px wide / 404 KB and
              renders at 32px tall — a 15x oversized download on EVERY page,
              which is why the header logo was slow (and on a weak connection,
              why it sometimes never arrived). The 640px webp is 17 KB: still
              3x the rendered width, so it stays sharp on retina.

              width/height are declared so the header reserves the space and
              the rest of the bar doesn't jump when the logo lands. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dk ? "/brand/hub-logo/koleex-hub-logo-for-dark.webp" : "/brand/hub-logo/koleex-hub-logo-for-light.webp"}
            alt="Koleex Hub"
            width={640}
            height={99}
            decoding="async"
            fetchPriority="high"
            /* Dragging the logo out of the header does nothing useful and, in
               the desktop shell, drops a stray image onto whatever is behind
               the window. */
            draggable={false}
            className="w-auto h-5 md:h-8 select-none [-webkit-user-drag:none]"
          />
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
      <div className="flex items-center gap-2 shrink-0">
        {/* Language — desktop pill bar */}
        <div
          className={`hidden md:flex relative items-center h-9 rounded-lg border p-1 transition-colors ${
            dk
              ? "border-white/[0.08] bg-white/[0.03]"
              : "border-black/[0.08] bg-black/[0.03]"
          }`}
        >
          {/* ONE outline that SLIDES between the three fixed-width segments —
              the dock's mechanic, ported here because the owner asked for the
              same smooth ease. The old version repainted each button's own
              background, which is a cut, not a movement. Segments are all
              w-[54px], so each step is exactly one own-width:
              translateX(index × 100%), sign flipped in RTL by --kx-flip.
              Aurora only — Core keeps its original grey pill. */}
          {aurora && (
            <span
              aria-hidden
              className="absolute top-1 bottom-1 w-[54px] rounded-md pointer-events-none transition-transform duration-[320ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
              style={{
                insetInlineStart: 4,
                transform: `translateX(calc(${languages.findIndex((x) => x.code === shownLang)} * var(--kx-flip, 100%)))`,
                background: "rgba(86,127,178,0.10)",
                boxShadow: dk
                  ? "inset 0 0 0 1px rgba(86,127,178,0.70)"
                  : "inset 0 0 0 1px rgba(62,103,150,0.75)",
              }}
            />
          )}
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => pickLang(l.code)}
              className={`relative h-7 w-[54px] rounded-md text-[11px] font-semibold tracking-wide transition-colors duration-200 text-center ${
                aurora
                  ? /* The sliding pill carries the selected state; buttons
                       only speak in text weight, and they follow the PILL
                       (shownLang) so the label lights up as the slide lands,
                       not 340ms before it. */
                    shownLang === l.code
                    ? dk ? "text-white" : "text-black"
                    : dk
                      ? "text-white/45 hover:text-white/80"
                      : "text-black/45 hover:text-black/80"
                  : /* Core: the original grey pill, byte for byte. */
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

        {/* Mobile: language + theme moved into the sidebar drawer footer
            (owner-approved) — the phone header keeps only menu · logo ·
            bell · avatar. */}

        {/* Divider between locale and tools (desktop only) */}
        <div
          aria-hidden
          className={`hidden md:block w-px h-5 mx-0.5 ${
            dk ? "bg-white/[0.08]" : "bg-black/[0.08]"
          }`}
        />

        {/* Theme toggle */}
        <button
          onClick={() => {
            /* Tapping this is an explicit choice — record it as the theme
               MODE too, otherwise Settings' "Auto" would still be active and
               the system watcher would flip it straight back. */
            const next = dk ? "light" : "dark";
            try { localStorage.setItem("koleex-theme-mode", next); } catch { /* ignore */ }
            window.dispatchEvent(new CustomEvent("thememodechange", { detail: next }));
            setTheme(next);
          }}
          aria-label={dk ? "Switch to light theme" : "Switch to dark theme"}
          className={`hidden md:flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-lg border transition-all ${
            dk
              ? "kx-hover-glow border-white/[0.08] bg-white/[0.03] text-white/55 hover:text-white hover:bg-white/[0.06]"
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
        <div className="hidden md:block"><TenantPicker dk={dk} /></div>

        {/* View-as picker — Super Admin only. Lets the SA view the
            system as any other user in their tenant (read-only). The
            picker disappears once view-as is active; the persistent
            banner is the only way to exit. */}
        <div className="hidden md:block"><ViewAsPicker dk={dk} /></div>

        {/* Notification bell — system-wide notifications dropdown
            covering Discuss messages and inbox alerts from every app. */}
        <NotificationBellGate dk={dk} />

        {/* Subtle spacer before account */}
        <div className="hidden md:block w-1" />

        {/* User menu (avatar → identity + sign in/out) */}
        <UserMenu dk={dk} />
      </div>
    </header>
    </>
  );
}
