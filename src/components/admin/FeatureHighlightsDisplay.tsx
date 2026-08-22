"use client";

/* ---------------------------------------------------------------------------
   FeatureHighlightsDisplay — feature cards in the EXACT product-card layout
   (owner: "same style as product card"): the PD grid card's shell
   (kx-glass + hover + rounded-xl), a 4:3 image pane on the same white
   gradient ground, title bold + description as the subtitle, in the same
   responsive grid. Self-fetching; renders nothing while empty.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
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
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {rows.map((r) => (
        <div
          key={r.id ?? r.title}
          className="group relative kx-glass kx-hover-card bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-subtle)] overflow-hidden"
        >
          {/* image pane — the product card's exact ground */}
          <div className="relative aspect-[4/3] max-sm:aspect-[3/2] bg-gradient-to-b from-white to-[#f4f5f7] overflow-hidden border-b border-black/5">
            {r.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.image_url}
                alt={pick(r.title, r.title_zh, r.title_ar)}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageRawIcon className="h-10 w-10 text-gray-300" />
              </div>
            )}
          </div>
          {/* body — title + description, the card's text block */}
          <div className="p-3">
            <div className="text-[13px] font-semibold leading-snug text-[var(--text-primary)]">
              {pick(r.title, r.title_zh, r.title_ar)}
            </div>
            {pick(r.description, r.description_zh, r.description_ar) && (
              <div className="mt-1 text-[11.5px] leading-snug text-[var(--text-muted)]">
                {pick(r.description, r.description_zh, r.description_ar)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
