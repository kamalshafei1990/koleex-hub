"use client";

/* ---------------------------------------------------------------------------
   StickyNav — v30.

   Persistent section navigator. Desktop: vertical rail pinned to the
   left edge, vertically centered, with tiny uppercase labels and a thin
   active indicator. Mobile (md-): horizontal strip pinned to the top
   below the system header. IntersectionObserver tracks which section
   anchor is currently in view; clicking an item smooth-scrolls.

   Brand alignment: monochrome only, no decorative shadows or glows,
   tiny typography, hairline separators, restrained motion.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { useT } from "./i18n";

const ITEMS: Array<{ id: string; labelKey: string }> = [
  { id: "divisions", labelKey: "nav.section.universe" },
  { id: "categories", labelKey: "nav.section.categories" },
  { id: "technical-breakdown", labelKey: "nav.section.tech" },
  { id: "compare", labelKey: "nav.section.compare" },
  { id: "builder", labelKey: "nav.section.builder" },
  { id: "intelligence", labelKey: "nav.section.intelligence" },
];

export default function StickyNav() {
  const t = useT();
  const [active, setActive] = useState<string>("divisions");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const nodes = ITEMS.map((it) => document.getElementById(it.id)).filter(
      (n): n is HTMLElement => !!n,
    );
    if (nodes.length === 0) return;

    /* Pick the section closest to (but past) the top of the viewport.
       rootMargin shifts the trigger line ~25% down so the "active"
       section flips when its top is near the top of the visible page. */
    const observer = new IntersectionObserver(
      (entries) => {
        let best: { id: string; ratio: number; top: number } | null = null;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const rect = e.target.getBoundingClientRect();
          if (!best || rect.top > best.top) {
            best = { id: e.target.id, ratio: e.intersectionRatio, top: rect.top };
          }
        }
        if (best) setActive(best.id);
      },
      {
        rootMargin: "-20% 0px -70% 0px",
        threshold: [0, 0.1, 0.25, 0.5, 1],
      },
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  function jumpTo(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      {/* ── Mobile / tablet — horizontal strip pinned to top ── */}
      <nav
        aria-label={t("nav.contents")}
        className="lg:hidden sticky top-0 z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-2 bg-[var(--bg-primary)]/95 backdrop-blur border-b border-[var(--border-faint)] no-print"
      >
        <ul className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {ITEMS.map((it) => {
            const isActive = active === it.id;
            return (
              <li key={it.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => jumpTo(it.id)}
                  className={`h-7 px-2.5 rounded-md text-[10.5px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                    isActive
                      ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                      : "text-[var(--text-faint)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {t(it.labelKey)}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Desktop — fixed left rail, vertically centered ── */}
      <nav
        aria-label={t("nav.contents")}
        className="hidden lg:block fixed top-1/2 -translate-y-1/2 z-20 no-print ltr:left-3 rtl:right-3"
      >
        <div className="text-[9.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-dim)] mb-2 px-2">
          {t("nav.contents")}
        </div>
        <ul className="flex flex-col gap-px border ltr:border-l rtl:border-r border-[var(--border-faint)] bg-[var(--bg-secondary)]/80 backdrop-blur rounded-md overflow-hidden">
          {ITEMS.map((it) => {
            const isActive = active === it.id;
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => jumpTo(it.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={`group flex items-center gap-2 w-full px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                    isActive
                      ? "text-[var(--text-primary)] bg-[var(--bg-surface)]"
                      : "text-[var(--text-faint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`h-px w-3 transition-all ${
                      isActive
                        ? "bg-[var(--text-primary)] w-5"
                        : "bg-[var(--text-dim)]"
                    }`}
                  />
                  <span>{t(it.labelKey)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Hide-scrollbar utility for the mobile strip */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
}
