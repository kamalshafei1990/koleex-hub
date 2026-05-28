"use client";

/* ---------------------------------------------------------------------------
   SearchByCode — small input that filters CATEGORIES + subcategories
   live. Picking a result scrolls the page to the matching category card
   in the Subcategory index (#cat-<code>) and briefly highlights it.
   Codes match LTR; labels match against the active translation.
   --------------------------------------------------------------------------- */

import { useMemo, useState } from "react";
import { CATEGORIES } from "./data";
import { useT, useTL } from "./i18n";

type Hit = {
  kind: "category" | "subcategory";
  code: string;
  label: string;
  parentCode?: string;
  parentLabel?: string;
};

export default function SearchByCode() {
  const t = useT();
  const tl = useTL();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const hits = useMemo<Hit[]>(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const out: Hit[] = [];
    for (const c of CATEGORIES) {
      const tlLabel = tl(c.label);
      if (
        c.code.toLowerCase().includes(needle) ||
        c.label.toLowerCase().includes(needle) ||
        tlLabel.toLowerCase().includes(needle)
      ) {
        out.push({ kind: "category", code: c.code, label: tlLabel });
      }
      for (const s of c.subcategories) {
        const tlSub = tl(s.label);
        if (
          s.code.toLowerCase().includes(needle) ||
          s.label.toLowerCase().includes(needle) ||
          tlSub.toLowerCase().includes(needle)
        ) {
          out.push({
            kind: "subcategory",
            code: s.code,
            label: tlSub,
            parentCode: c.code,
            parentLabel: tlLabel,
          });
        }
      }
      if (out.length >= 24) break;
    }
    return out;
  }, [q, tl]);

  function jumpTo(hit: Hit) {
    const targetCode = hit.kind === "category" ? hit.code : hit.parentCode!;
    const el = document.querySelector(
      `[data-cat-anchor="${targetCode}"]`,
    ) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      // Briefly outline the target.
      el.classList.add("ring-2", "ring-[var(--text-primary)]");
      window.setTimeout(() => {
        el.classList.remove("ring-2", "ring-[var(--text-primary)]");
      }, 1400);
    }
    setOpen(false);
    setQ("");
  }

  return (
    <div className="relative">
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => q && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder={t("search.placeholder")}
        className="h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--text-primary)]"
        aria-label={t("search.placeholder")}
      />

      {open && q && (
        <div className="absolute z-30 top-[40px] inset-x-0 max-h-[360px] overflow-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-lg">
          {hits.length === 0 ? (
            <div className="px-3 py-3 text-[12px] text-[var(--text-faint)]">
              {t("search.no_results")}
            </div>
          ) : (
            <>
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-faint)] border-b border-[var(--border-faint)]">
                {t("search.result_count", { n: hits.length })}
              </div>
              <ul className="divide-y divide-[var(--border-faint)]">
                {hits.map((h, i) => (
                  <li key={`${h.kind}-${h.code}-${i}`}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        jumpTo(h);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--bg-surface-subtle)] transition-colors"
                    >
                      <span
                        className="font-mono text-[12px] font-bold text-[var(--text-primary)] min-w-[64px]"
                        dir="ltr"
                      >
                        {h.code}
                      </span>
                      <span className="flex-1 min-w-0 text-[12.5px] text-[var(--text-primary)] truncate">
                        {h.label}
                      </span>
                      {h.parentCode && (
                        <span
                          className="font-mono text-[10.5px] text-[var(--text-faint)]"
                          dir="ltr"
                        >
                          {h.parentCode}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
