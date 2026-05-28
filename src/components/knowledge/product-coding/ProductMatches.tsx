"use client";

/* ---------------------------------------------------------------------------
   ProductMatches — v30.

   Lives at the bottom of every BreakdownCard. Given the prefix and the
   user's live selection, it resolves matching products from the mock
   dataset and renders them as monochrome enterprise rows.

   Layout per row:
     · Left  — silhouette tile (machine outline glyph)
     · Mid   — name + SKU + summary + highlight chips + match % badge
     · Right — compact action buttons (View · BOM · Accessories · Spare · Datasheet)
   --------------------------------------------------------------------------- */

import { useMemo } from "react";
import { findMatches, type MockProduct } from "./mock-products";
import { useT, useTL } from "./i18n";

/* Tiny inline silhouette — keeps the page free of image dependencies.
   Same monochrome treatment as the MachineMap glyphs. */
function MachineGlyph({ prefix }: { prefix: string }) {
  return (
    <div className="flex h-16 w-20 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] overflow-hidden">
      <svg
        viewBox="0 0 80 60"
        className="w-14 h-10"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "var(--text-primary)" }}
        aria-label={`${prefix} silhouette`}
      >
        {/* Bed */}
        <rect x="6" y="36" width="68" height="6" rx="1" strokeWidth={1.1} />
        {/* Head + arm — silhouette varies subtly by prefix to hint variety */}
        <path
          d={
            prefix === "XSO"
              ? "M 14 36 L 14 22 Q 14 16 20 16 L 56 16 Q 62 16 62 22 L 62 36"
              : prefix === "XSI"
                ? "M 16 36 L 16 24 L 24 18 L 56 18 L 64 24 L 64 36"
                : "M 14 36 L 14 24 Q 14 18 20 18 L 56 18 Q 62 18 62 24 L 62 36"
          }
          strokeWidth={1.1}
        />
        {/* Handwheel */}
        <circle cx="66" cy="28" r="4" strokeWidth={1} />
        {/* Needle */}
        <line x1="22" y1="36" x2="22" y2="42" strokeWidth={1} />
        {/* Spool pole */}
        <line x1="40" y1="18" x2="40" y2="8" strokeWidth={0.8} />
        <circle cx="40" cy="8" r="1.5" fill="currentColor" stroke="none" />
        {/* Legs */}
        <line x1="14" y1="42" x2="14" y2="54" strokeWidth={1} />
        <line x1="66" y1="42" x2="66" y2="54" strokeWidth={1} />
        <line x1="12" y1="54" x2="68" y2="54" strokeWidth={0.6} opacity={0.5} />
      </svg>
    </div>
  );
}

function ActionLink({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="h-7 px-2.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[10.5px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors whitespace-nowrap"
    >
      {children}
    </button>
  );
}

export default function ProductMatches({
  prefix,
  sel,
}: {
  prefix: string;
  sel: Record<number, string>;
}) {
  const t = useT();
  const tl = useTL();

  const matches = useMemo(() => findMatches(prefix, sel), [prefix, sel]);

  /* Demo accessory + BOM counts — derived from match count so the meta
     strip changes as the user composes. Real implementation would join
     against an accessories + bom table. */
  const accessoriesCount = useMemo(() => Math.min(6 + matches.length * 2, 18), [matches.length]);
  const bomCount = useMemo(() => Math.max(matches.length - 1, 0), [matches.length]);

  return (
    <section className="border-t border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] px-5 sm:px-7 py-6">
      {/* Header row */}
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)]">
            {t("bd.products.title")}
          </div>
        </div>
        <div className="text-[10.5px] font-mono text-[var(--text-faint)]" dir="ltr">
          {t("bd.products.meta", {
            products: matches.length,
            accessories: accessoriesCount,
            bom: bomCount,
          })}
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-6 text-center text-[12px] text-[var(--text-faint)]">
          {t("bd.products.none")}
        </div>
      ) : (
        <>
          {matches[0].score < 1 && (
            <div className="mb-3 text-[11px] text-[var(--text-faint)]">
              {t("bd.products.partial_hint")}
            </div>
          )}
          <ul className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] divide-y divide-[var(--border-faint)] overflow-hidden">
            {matches.map(({ product, score }) => (
              <li
                key={product.id}
                className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-4"
              >
                {/* Left — silhouette */}
                <MachineGlyph prefix={product.fingerprint.prefix} />

                {/* Mid — name + sku + summary + chips */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h4 className="text-[13.5px] font-semibold text-[var(--text-primary)] truncate">
                      {product.name}
                    </h4>
                    <span
                      className="font-mono text-[11.5px] font-bold tracking-[0.06em] text-[var(--text-primary)]"
                      dir="ltr"
                    >
                      {product.sku}
                    </span>
                    {score < 1 && (
                      <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-sm border border-[var(--border-subtle)] text-[var(--text-faint)]">
                        {t("bd.products.match_pct", {
                          pct: Math.round(score * 100),
                        })}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[12px] text-[var(--text-faint)] truncate">
                    {product.summary}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {product.highlights.map((h) => (
                      <span
                        key={h}
                        className="text-[10.5px] font-medium text-[var(--text-faint)] border border-[var(--border-faint)] rounded-sm px-1.5 py-0.5"
                      >
                        {tl(h)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right — actions */}
                <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
                  <ActionLink>{t("bd.products.view")}</ActionLink>
                  <ActionLink>{t("bd.products.bom")}</ActionLink>
                  <ActionLink>{t("bd.products.accessories")}</ActionLink>
                  <ActionLink>{t("bd.products.spare")}</ActionLink>
                  <ActionLink>{t("bd.products.datasheet")}</ActionLink>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
