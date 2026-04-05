"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, Moon, Home, Bell } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { hubT } from "@/lib/translations/hub";

/* ── Koleex Logo ── */
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

/* ── Route → Translation key mapping ── */
const routeKeys: Record<string, string> = {
  "/contacts": "app.contacts",
  "/customers": "app.customers",
  "/suppliers": "app.suppliers",
  "/employees": "app.employees",
  "/products": "app.products",
  "/products/new": "app.products",
  "/quotations": "app.quotations",
  "/price-calculator": "app.price-calculator",
  "/markets": "app.markets",
  "/landed-cost": "app.landed-cost",
  "/website": "app.website",
  "/categories": "cat.system",
  "/subcategories": "cat.system",
  "/divisions": "cat.system",
};

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
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const savedTheme = localStorage.getItem("koleex-theme") as "light" | "dark" | null;
    if (savedTheme) setTheme(savedTheme);
    const savedLang = localStorage.getItem("koleex-lang") as Lang | null;
    if (savedLang) setLang(savedLang);
  }, []);

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

  const dk = theme === "dark";
  const isHome = pathname === "/";

  /* Find current app name from route */
  const routeKey = !isHome
    ? routeKeys[pathname] || routeKeys[Object.keys(routeKeys).find(r => pathname.startsWith(r + "/")) || ""] || null
    : null;
  const appName = routeKey ? t(routeKey) : null;

  return (
    <header
      dir="ltr"
      className={`fixed top-0 left-0 right-0 z-[100] h-14 flex items-center justify-between px-3 md:px-6 backdrop-blur-xl border-b transition-colors duration-300 ${
        dk
          ? "border-white/[0.08] bg-black/80"
          : "border-black/[0.08] bg-white/95"
      }`}
    >
      {/* Left: Logo + App Name */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        {!isHome && (
          <Link
            href="/"
            className={`flex items-center justify-center w-7 h-7 md:w-9 md:h-9 rounded-md md:rounded-lg shrink-0 transition-colors ${
              dk ? "text-white/60 hover:text-white hover:bg-white/[0.06]" : "text-black/60 hover:text-black hover:bg-black/[0.06]"
            }`}
          >
            <Home size={16} className="md:w-[18px] md:h-[18px]" />
          </Link>
        )}
        <Link href="/" className={`shrink-0 ${dk ? "text-white" : "text-black"}`}>
          <KoleexLogo className="w-auto h-4 md:h-5" />
        </Link>
        {appName && (
          <>
            <span className={`text-sm hidden md:inline ${dk ? "text-white/20" : "text-black/20"}`}>/</span>
            <span className={`text-sm font-medium hidden md:inline truncate ${dk ? "text-white/70" : "text-black/70"}`}>
              {appName}
            </span>
          </>
        )}
      </div>

      {/* Right: Language + Theme + Avatar */}
      <div className="flex items-center gap-1 md:gap-2 shrink-0">
        {/* Language pill bar */}
        <div
          className={`flex items-center h-7 md:h-8 rounded-md md:rounded-lg border p-0.5 transition-colors ${
            dk
              ? "border-white/[0.08] bg-white/[0.03]"
              : "border-black/[0.08] bg-black/[0.03]"
          }`}
        >
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`relative h-6 md:h-7 w-8 md:w-[60px] rounded-[5px] md:rounded-md text-[10px] md:text-[11px] font-semibold tracking-wide transition-all duration-200 text-center ${
                lang === l.code
                  ? dk
                    ? "bg-white/[0.12] text-white shadow-sm"
                    : "bg-black/[0.10] text-black shadow-sm"
                  : dk
                    ? "text-white/30 hover:text-white/60"
                    : "text-black/30 hover:text-black/60"
              }`}
            >
              <span className="md:hidden">{l.short}</span>
              <span className="hidden md:inline">{l.label}</span>
            </button>
          ))}
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(dk ? "light" : "dark")}
          className={`flex items-center justify-center w-7 h-7 md:w-9 md:h-9 rounded-md md:rounded-lg border transition-all ${
            dk
              ? "border-white/[0.08] bg-white/[0.04] text-white/60 hover:text-white"
              : "border-black/[0.08] bg-black/[0.04] text-black/60 hover:text-black"
          }`}
        >
          {dk ? <Sun size={15} className="md:w-4 md:h-4" /> : <Moon size={15} className="md:w-4 md:h-4" />}
        </button>

        {/* Notification bell */}
        <button
          className={`relative flex items-center justify-center w-7 h-7 md:w-9 md:h-9 rounded-md md:rounded-lg border transition-all ${
            dk
              ? "border-white/[0.08] bg-white/[0.04] text-white/60 hover:text-white"
              : "border-black/[0.08] bg-black/[0.04] text-black/60 hover:text-black"
          }`}
        >
          <Bell size={15} className="md:w-4 md:h-4" />
          {/* Notification dot */}
          <span className="absolute top-1 end-1 md:top-1.5 md:end-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
        </button>

        {/* User avatar */}
        <div
          className={`flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full text-[10px] md:text-[11px] font-semibold ${
            dk ? "bg-white text-black" : "bg-black text-white"
          }`}
        >
          KS
        </div>
      </div>
    </header>
  );
}
