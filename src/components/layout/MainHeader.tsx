"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, Moon, Menu, X, Home } from "lucide-react";

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

/* ── Route → App Name mapping ── */
const routeNames: Record<string, string> = {
  "/contacts": "Contacts",
  "/customers": "Customers",
  "/suppliers": "Suppliers",
  "/employees": "Employees",
  "/products": "Products",
  "/products/new": "New Product",
  "/quotations": "Quotations",
  "/price-calculator": "Price Calculator",
  "/markets": "Markets",
  "/landed-cost": "Landed Cost",
  "/website": "Website",
  "/categories": "Categories",
  "/subcategories": "Subcategories",
  "/divisions": "Divisions",
};

export default function MainHeader() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("koleex-theme") as "light" | "dark" | null;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("koleex-theme", theme);
    window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
  }, [theme]);

  const dk = theme === "dark";
  const isHome = pathname === "/";

  /* Find current app name from route */
  const appName = !isHome
    ? routeNames[pathname] || routeNames[Object.keys(routeNames).find(r => pathname.startsWith(r + "/")) || ""] || null
    : null;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[100] h-14 flex items-center justify-between px-4 md:px-6 backdrop-blur-xl border-b transition-colors duration-300 ${
        dk
          ? "border-white/[0.08] bg-black/80"
          : "border-black/[0.08] bg-white/80"
      }`}
    >
      {/* Left: Logo + App Name */}
      <div className="flex items-center gap-3">
        {!isHome && (
          <Link
            href="/"
            className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
              dk ? "text-white/60 hover:text-white hover:bg-white/[0.06]" : "text-black/60 hover:text-black hover:bg-black/[0.06]"
            }`}
          >
            <Home size={18} />
          </Link>
        )}
        <Link href="/" className={dk ? "text-white" : "text-black"}>
          <KoleexLogo className="h-5 w-auto" />
        </Link>
        {appName && (
          <>
            <span className={`text-sm ${dk ? "text-white/20" : "text-black/20"}`}>/</span>
            <span className={`text-sm font-medium ${dk ? "text-white/70" : "text-black/70"}`}>
              {appName}
            </span>
          </>
        )}
      </div>

      {/* Right: Theme + Avatar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTheme(dk ? "light" : "dark")}
          className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-all ${
            dk
              ? "border-white/[0.08] bg-white/[0.04] text-white/60 hover:text-white"
              : "border-black/[0.08] bg-black/[0.04] text-black/60 hover:text-black"
          }`}
        >
          {dk ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold ${
            dk ? "bg-white text-black" : "bg-black text-white"
          }`}
        >
          KS
        </div>
      </div>
    </header>
  );
}
