"use client";

/* ProductHighlights — rebuild phase 2 (19/09/2026).
 *
 * The owner's second section: "the highlights photos with the title and
 * description". That is products.feature_cards — the photo-card grid the
 * editor calls Main Devices & Functions — followed by the plain highlight
 * bullets (products.highlights). Both come from the same row the hero
 * read; nothing is fetched here.
 *
 * Renders NOTHING when there is nothing: no heading over an empty grid.
 * Every card image is a CDN render (IMG.card) — the cards are clipped
 * from catalogue PDFs and can be large.
 */
import { IMG } from "@/lib/cdn";
import type { FeatureCard } from "@/types/supabase";

export default function ProductHighlights({ cards, bullets, t }: {
  cards: FeatureCard[];
  bullets: string[];
  t: (key: string, fallback?: string) => string;
}) {
  if (cards.length === 0 && bullets.length === 0) return null;
  return (
    <section data-reveal className="space-y-8">
      <div className="space-y-2 text-center">
        <div className="text-[13px] md:text-[15px] font-semibold text-[#7FA9D6]">
          {t("preview.highlightsEyebrow", "Highlights")}
        </div>
        <h2 className="text-4xl md:text-6xl font-semibold tracking-[-0.02em] text-[var(--text-primary)] leading-[1.05] text-balance">
          {t("preview.highlightsTitle", "What stands out.")}
        </h2>
      </div>

      {cards.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {cards.map((c, i) => (
            <article
              key={`${c.title}-${i}`}
              className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]"
            >
              {c.image_url ? (
                <div className="aspect-[4/3] bg-gradient-to-b from-white to-[#f1f2f4] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={IMG.card(c.image_url)} alt={c.title} loading="lazy" decoding="async" className="h-full w-full object-contain p-4" />
                </div>
              ) : null}
              <div className="p-4 md:p-5 space-y-1.5">
                {c.title ? <h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">{c.title}</h3> : null}
                {c.description ? <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">{c.description}</p> : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {bullets.length > 0 ? (
        <ul className="mx-auto max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3 text-[15px] leading-snug text-[var(--text-secondary)]">
              <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#7FA9D6]" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
