"use client";

/* ---------------------------------------------------------------------------
   FeatureHighlightsDisplay — the catalog-style read view of a product's
   feature cards (small photo + name + short explanation), the way supplier
   catalogs present them. Self-fetching so any surface can drop it in with a
   productId; renders nothing while empty (the profile stays clean until the
   first card is authored). Locale-aware: zh/ar strings win under those UI
   languages, EN is the source of truth.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { fetchProductFeatureHighlights, type ProductFeatureHighlightRow } from "@/lib/products-admin";

export default function FeatureHighlightsDisplay({ productId }: { productId: string }) {
  const [rows, setRows] = useState<ProductFeatureHighlightRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!productId) return;
    fetchProductFeatureHighlights(productId).then((r) => { if (!cancelled) setRows(r); });
    return () => { cancelled = true; };
  }, [productId]);

  if (rows.length === 0) return null;

  const lang = typeof document !== "undefined" ? document.documentElement.lang : "en";
  const pick = (en: string | null | undefined, zh?: string | null, ar?: string | null) =>
    (lang === "zh" && zh) || (lang === "ar" && ar) || en || "";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <div key={r.id ?? r.title} className="flex gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3">
          {r.image_url && (
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.image_url} alt={pick(r.title, r.title_zh, r.title_ar)} className="h-full w-full object-cover" loading="lazy" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold text-[var(--text-primary)]">
              {pick(r.title, r.title_zh, r.title_ar)}
            </div>
            {pick(r.description, r.description_zh, r.description_ar) && (
              <div className="mt-0.5 text-[11.5px] leading-snug text-[var(--text-muted)]">
                {pick(r.description, r.description_zh, r.description_ar)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
