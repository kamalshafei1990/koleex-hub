"use client";

/* ---------------------------------------------------------------------------
   StickyNav — v31.

   Single sticky horizontal strip pinned below the breadcrumb. Replaces
   the v30 fixed-left-rail (which overlapped content at common desktop
   widths). Works at every viewport: lg+ centers within the doc max-
   width, sm/md overflow-scrolls.

   Brand-aligned: monochrome, tiny uppercase labels, hairline separator
   between pill and content. IntersectionObserver tracks the visible
   section; clicks smooth-scroll. Hidden in print.
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

    /* Pick the section whose top is closest to (but past) the top
       of the visible page. The rootMargin shifts the trigger band so
       the active label flips when the section header crosses the top
       quarter of the viewport. */
    const observer = new IntersectionObserver(
      (entries) => {
        let best: { id: string; top: number } | null = null;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const rect = e.target.getBoundingClientRect();
          if (!best || rect.top > best.top) {
            best = { id: e.target.id, top: rect.top };
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
    <nav
      aria-label={t("nav.contents")}
      className="sticky top-0 z-20 border-b border-[var(--border-faint)] bg-[var(--bg-primary)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg-primary)]/80 no-print"
    >
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-1.5">
        <ul className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {ITEMS.map((it) => {
            const isActive = active === it.id;
            return (
              <li key={it.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => jumpTo(it.id)}
                  aria-current={isActive ? "true" : undefined}
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
      </div>
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </nav>
  );
}
