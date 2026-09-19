"use client";

/* ProductHero — the top of the product page (rebuild phase 1, 19/09/2026).
 *
 * Owner spec, in order: classification · name + model · the product photo
 * big and clear (the poster leads when one exists, and only then) · tagline
 * + short description · the Global FOB, unmistakable · the family as a
 * table · Ask AI / Compare / Quote.
 *
 * One component, one render, no fetch: everything here arrives with the
 * server props (product-detail.ts), including the price — a hero that
 * paints a placeholder and fills the figure in a second later is the
 * "quick glitch" this page must not have. Every image goes through IMG.*;
 * the brand is BrandMark, never the word.
 *
 * WHO SEES THE PRICE is decided upstream (PRICE_AUDIENCES): `fob` is null
 * for the print and the website, and this component then draws no price
 * block at all — not "—", not a locked figure. Nothing to show, nothing
 * shown.
 */
import { useMemo } from "react";
import { IMG } from "@/lib/cdn";
import { BrandMark } from "@/components/brand/KoleexMark";
import { localizedName } from "@/lib/i18n-name";
import type { Lang } from "@/lib/i18n";
import type { ProductDetailSections } from "@/lib/server/product-detail";
import type { FobFigure } from "@/lib/server/products-fob";

export type HeroAction = "ask_ai" | "compare" | "quote";

export interface ProductHeroProps {
  name: string;
  model: string | null;
  tagline: string | null;
  excerpt: string | null;
  brand: string | null;
  classification: ProductDetailSections["classification"];
  lang: Lang;
  posterUrl: string | null;
  videoUrl: string | null;
  image: string | null;
  /** The family roster (server order, primary flagged). Empty or one
   *  member → no table. */
  models: ProductDetailSections["models"];
  /** Per-model spec overrides keyed by model CODE — the columns where the
   *  members actually differ come from these. */
  overridesByCode: Record<string, Record<string, unknown>>;
  /** Field key → reader-language label (the schema, already localised). */
  fieldLabel: (key: string) => string;
  /** Display value for a spec (units, booleans, lists) — the same formatter
   *  the spec sheet uses, so the table and the sheet never disagree. */
  formatValue: (key: string, value: unknown) => string;
  fob: ProductDetailSections["fob"];
  selectedCode: string | null;
  onSelectModel: (code: string) => void;
  canCompare: boolean;
  onAction: (action: HeroAction, modelCode?: string) => void;
  t: (key: string, fallback?: string) => string;
}

const usd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function PriceFigure({ figure, t, size }: { figure: FobFigure | null; t: ProductHeroProps["t"]; size: "hero" | "row" }) {
  if (figure?.fobUsd != null) {
    return (
      <span className={size === "hero"
        ? "text-[40px] md:text-[48px] leading-none font-bold tabular-nums tracking-tight text-[var(--text-primary)]"
        : "text-[15px] font-bold tabular-nums tracking-tight text-[var(--text-primary)]"}>
        {usd(figure.fobUsd)}
      </span>
    );
  }
  return (
    <span className={size === "hero" ? "text-[15px] font-medium text-[var(--text-dim)]" : "text-[12px] text-[var(--text-dim)]"}>
      {t("preview.heroPriceOnRequest", "Price on request")}
    </span>
  );
}

const ACTIONS: Array<{ key: HeroAction; labelKey: string; fallback: string; cls: string }> = [
  {
    key: "ask_ai", labelKey: "preview.heroAskAi", fallback: "Ask AI",
    cls: "kx-ai-glow border-[var(--action-ai,#567FB2)]/45 text-[var(--action-ai,#567FB2)] hover:bg-[var(--action-ai,#567FB2)]/10",
  },
  {
    key: "compare", labelKey: "preview.heroCompare", fallback: "Compare",
    cls: "border-[var(--action-compare,#F59E0B)]/45 text-[var(--action-compare,#F59E0B)] hover:bg-[var(--action-compare,#F59E0B)]/10 hover:border-[var(--action-compare,#F59E0B)]/70",
  },
  {
    key: "quote", labelKey: "preview.heroQuote", fallback: "Quote",
    cls: "border-[var(--action-quote,#10B981)]/45 text-[var(--action-quote,#10B981)] hover:bg-[var(--action-quote,#10B981)]/10 hover:border-[var(--action-quote,#10B981)]/70",
  },
];

export default function ProductHero(p: ProductHeroProps) {
  const { t, lang, classification, models, overridesByCode, fob } = p;

  const crumbs = useMemo(
    () => [classification.division, classification.category, classification.subcategory]
      .filter((x): x is NonNullable<typeof x> => !!x)
      .map((x) => localizedName(x, lang)),
    [classification, lang],
  );

  /* The columns where members DIFFER: a key overridden by at least one
     member. Family-wide facts belong to the spec sheet, not here; three
     columns is the most a hero table can carry and still read at a glance. */
  const diffKeys = useMemo(() => {
    const seen = new Map<string, number>();
    for (const m of models) {
      for (const k of Object.keys(overridesByCode[m.code] ?? {})) seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  }, [models, overridesByCode]);

  const showPrice = fob != null;
  const fxNote = fob?.fx?.cnyPerUsd != null
    ? `${t("preview.heroFxNote", "at today's rate")} · 1 USD = ${fob.fx.cnyPerUsd.toFixed(2)} CNY`
    : null;
  const activeModel = models.find((m) => m.code === p.selectedCode) ?? null;
  const heroImage = activeModel?.photo || p.image;
  const heroCode = activeModel?.code || p.model;

  return (
    <div data-reveal data-cascade className="space-y-10 md:space-y-14">
      {/* ── Poster: the shop window, full-bleed, only when one exists. The
          poster is the photo and nothing else (owner rule: no overlaid copy). */}
      {p.posterUrl ? (
        <section className="relative -mx-4 md:-mx-6 lg:-mx-8 h-[46vh] md:h-[64vh] overflow-hidden bg-[var(--bg-secondary)]">
          {p.videoUrl ? (
            <video
              src={p.videoUrl}
              poster={IMG.poster(p.posterUrl)}
              autoPlay
              muted
              loop
              playsInline
              /* React never serialises the muted ATTRIBUTE (facebook/react
                 #10389); force the property so autoplay policies allow it. */
              ref={(el) => { if (el) { el.muted = true; el.play().catch(() => {}); } }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={IMG.poster(p.posterUrl)} alt={p.name} className="absolute inset-0 h-full w-full object-cover" />
          )}
        </section>
      ) : null}

      {/* ── Identity + photo ── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
        <div className="order-2 lg:order-1 lg:col-span-5 space-y-6">
          {/* Classification. The mark, then the path the product sits on —
              each name in the reader's language. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">
            <BrandMark brand={p.brand} className="h-[11px] text-[var(--text-muted)]" />
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-2">
                <span className="text-[var(--text-ghost)]" aria-hidden="true">›</span>
                <span className={i === crumbs.length - 1 ? "text-[var(--text-muted)]" : ""}>{c}</span>
              </span>
            ))}
          </div>

          <div className="space-y-3">
            <h1 className="text-[2.5rem] leading-[1.02] md:text-[3.5rem] md:leading-[0.98] font-semibold tracking-[-0.02em] text-[var(--text-primary)] text-balance">
              {p.name}
            </h1>
            {heroCode ? (
              <div className="font-mono text-[13px] tracking-[0.14em] text-[var(--text-muted)]">{heroCode}</div>
            ) : null}
            {p.tagline ? (
              <p className="text-xl md:text-2xl font-light text-[var(--text-secondary)] leading-snug max-w-xl">{p.tagline}</p>
            ) : null}
            {p.excerpt ? (
              <p className="text-[15px] leading-relaxed text-[var(--text-muted)] max-w-xl">{p.excerpt}</p>
            ) : null}
          </div>

          {showPrice ? (
            <div className="pt-2 space-y-1.5">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
                {t("preview.heroGlobalFob", "Global FOB")}
              </div>
              <PriceFigure figure={fob.product} t={t} size="hero" />
              {fob.product?.fobUsd != null && fxNote ? (
                <div className="text-[11px] text-[var(--text-dim)]">{fxNote}</div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            {ACTIONS.map((a) => {
              if (a.key === "compare" && !p.canCompare) return null;
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => p.onAction(a.key, heroCode ?? undefined)}
                  className={`h-10 px-5 rounded-xl border bg-[var(--bg-surface-subtle)] text-[13px] font-bold whitespace-nowrap transition-all ${a.cls}`}
                >
                  {t(a.labelKey, a.fallback)}
                </button>
              );
            })}
          </div>
        </div>

        {/* The product, big and clear, on a light well — transparent studio
            shots read as one object, not a white box on dark glass. */}
        <div className="order-1 lg:order-2 lg:col-span-7">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-white to-[#f1f2f4] aspect-[4/3] md:aspect-[5/4] lg:aspect-[4/3] flex items-center justify-center">
            {heroImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={IMG.hero(heroImage)} alt={p.name} className="h-full w-full object-contain p-6 md:p-10" />
            ) : (
              <span className="text-sm text-[#8a8f98]">{t("preview.noMainImage", "No main image")}</span>
            )}
          </div>
        </div>
      </section>

      {/* ── The family, as a table ── */}
      {models.length > 1 ? (
        <section className="space-y-4">
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
              {t("preview.heroFamilyEyebrow", "Family")}
            </div>
            <h2 className="text-[15px] font-semibold text-[var(--text-secondary)]">
              {t("preview.heroFamilyTitle", "Every model in this family")}
            </h2>
          </div>
          {/* Phones: one card per member — photo, code, name, price, Quote.
              The table below would put the price off the right edge behind a
              horizontal scroll, which is where a customer stops reading. */}
          <ul className="sm:hidden space-y-2">
            {models.map((m) => {
              const selected = m.code === p.selectedCode;
              const figure = fob?.models[m.id] ?? (m.primary ? fob?.product ?? null : null);
              return (
                <li
                  key={m.id || m.code}
                  onClick={() => p.onSelectModel(m.code)}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${
                    selected ? "border-[#567FB2]/60 bg-[var(--bg-surface-subtle)]" : "border-[var(--border-subtle)]"
                  }`}
                >
                  {(m.photo || p.image) ? (
                    <span className="h-12 w-12 shrink-0 rounded-lg bg-white border border-black/5 overflow-hidden flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={IMG.thumb((m.photo || p.image) as string)} alt="" className="h-full w-full object-contain p-1" loading="lazy" decoding="async" />
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[14px] font-bold tracking-tight text-[var(--text-primary)]">{m.code}</span>
                      {m.primary ? <span className="rounded-md border border-[var(--border-subtle)] px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("preview.primary", "Primary")}</span> : null}
                    </span>
                    {showPrice ? <span className="block"><PriceFigure figure={figure} t={t} size="row" /></span> : null}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); p.onAction("quote", m.code); }}
                    className="h-8 px-3 rounded-lg border border-[var(--action-quote,#10B981)]/45 text-[var(--action-quote,#10B981)] bg-[var(--bg-surface-subtle)] text-[11px] font-bold whitespace-nowrap"
                  >
                    {t("preview.heroQuote", "Quote")}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="hidden sm:block overflow-x-auto rounded-2xl border border-[var(--border-subtle)]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[var(--bg-surface-subtle)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  <th className="w-[64px] px-3 py-3" aria-label={t("preview.heroFamilyPhoto", "Photo")} />
                  <th className="min-w-[180px] px-4 py-3 text-start text-[var(--text-primary)]">{t("preview.heroFamilyModel", "Model")}</th>
                  {diffKeys.map((k) => (
                    <th key={k} className="whitespace-nowrap px-4 py-3 text-start">{p.fieldLabel(k)}</th>
                  ))}
                  {showPrice ? <th className="whitespace-nowrap px-4 py-3 text-end">{t("preview.heroGlobalFob", "Global FOB")}</th> : null}
                  <th className="w-[96px] px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {models.map((m) => {
                  const selected = m.code === p.selectedCode;
                  const ov = overridesByCode[m.code] ?? {};
                  const figure = fob?.models[m.id] ?? (m.primary ? fob?.product ?? null : null);
                  return (
                    <tr
                      key={m.id || m.code}
                      onClick={() => p.onSelectModel(m.code)}
                      className={`border-t border-[var(--border-subtle)] cursor-pointer transition-colors ${
                        selected ? "bg-[var(--bg-surface-subtle)]" : "hover:bg-[var(--bg-surface-subtle)]/40"
                      }`}
                    >
                      <td className={`px-3 py-2.5 ${selected ? "border-s-2 border-s-[#567FB2]" : ""}`}>
                        {(m.photo || p.image) ? (
                          <span className="h-10 w-10 rounded-lg bg-white border border-black/5 overflow-hidden flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={IMG.thumb((m.photo || p.image) as string)} alt="" className="h-full w-full object-contain p-1" loading="lazy" decoding="async" />
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-bold tracking-tight text-[var(--text-primary)] whitespace-nowrap">{m.code}</span>
                          {m.primary ? (
                            <span className="rounded-md border border-[var(--border-subtle)] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                              {t("preview.primary", "Primary")}
                            </span>
                          ) : null}
                          {selected ? (
                            <span className="rounded-md bg-[#567FB2]/15 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-[#7FA9D6]">
                              {t("preview.heroFamilySelected", "Showing")}
                            </span>
                          ) : null}
                        </div>
                        {m.name && m.name !== m.code ? (
                          <div className="text-[12px] text-[var(--text-muted)] truncate max-w-[280px]">{m.name}</div>
                        ) : m.tagline ? (
                          <div className="text-[12px] text-[var(--text-muted)] truncate max-w-[280px]">{m.tagline}</div>
                        ) : null}
                      </td>
                      {diffKeys.map((k) => (
                        <td key={k} className="whitespace-nowrap px-4 py-2.5 text-[13px] text-[var(--text-secondary)] tabular-nums">
                          {k in ov ? p.formatValue(k, ov[k]) : <span className="text-[var(--text-ghost)]">—</span>}
                        </td>
                      ))}
                      {showPrice ? (
                        <td className="whitespace-nowrap px-4 py-2.5 text-end"><PriceFigure figure={figure} t={t} size="row" /></td>
                      ) : null}
                      <td className="px-3 py-2.5 text-end">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); p.onAction("quote", m.code); }}
                          className="h-8 px-3 rounded-lg border border-[var(--action-quote,#10B981)]/45 text-[var(--action-quote,#10B981)] bg-[var(--bg-surface-subtle)] text-[11px] font-bold whitespace-nowrap hover:bg-[var(--action-quote,#10B981)]/10 transition-all"
                        >
                          {t("preview.heroQuote", "Quote")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
