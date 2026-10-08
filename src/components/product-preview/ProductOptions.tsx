"use client";

/* ProductOptions — rebuild phase 3 (19/09/2026). The buyer options a
 * customer can choose (Product Data → Options): each question with its
 * values, a default marked, a photo when the value has one, the weight it
 * adds, and — for a price audience only — the USD the Global FOB moves by.
 *
 * That USD came through the pricing engine on the server (products-fob.ts):
 * the stored delta is a supplier cost and never reaches this component.
 * Without a price audience `priceDeltaUsd` is null and no number is drawn.
 *
 * Read-only on purpose: choosing is the quotation's job (a later phase).
 * Nothing rendered when the product has no options.
 */
import { IMG } from "@/lib/cdn";
import { SectionHead } from "./shared";
import type { Lang } from "@/lib/i18n";
import type { ProductOptionView } from "@/lib/server/product-detail";

const pick = (base: string, i18n: Record<string, string> | null, lang: Lang) =>
  (lang !== "en" && i18n?.[lang]?.trim()) || base;

const signedUsd = (n: number) =>
  `${n < 0 ? "−" : "+"}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function ProductOptions({ options, lang, t }: {
  options: ProductOptionView[];
  lang: Lang;
  t: (key: string, fallback?: string) => string;
}) {
  if (options.length === 0) return null;
  return (
    <section id="options" className="space-y-6">
      <SectionHead eyebrow={t("preview.optionsEyebrow", "Configure")} title={t("preview.optionsTitle", "Options")} />

      <div className="space-y-6">
        {options.map((o) => (
          <div key={o.id} className="space-y-3">
            <div className="flex items-baseline gap-2">
              <h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">{pick(o.title, o.title_i18n, lang)}</h3>
              {o.required ? (
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">{t("preview.optionRequired", "Required")}</span>
              ) : null}
            </div>
            {o.kind === "info" && o.values.length === 0 ? null : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {o.values.map((v) => (
                  <li
                    key={v.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                      v.isDefault ? "border-[var(--text-primary)] bg-[var(--bg-surface-subtle)]" : "border-[var(--border-subtle)]"
                    }`}
                  >
                    {v.image ? (
                      <span className="h-11 w-11 shrink-0 rounded-lg bg-white border border-black/5 overflow-hidden flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={IMG.thumb(v.image)} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-1" />
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-[var(--text-primary)] truncate">{pick(v.label, v.label_i18n, lang)}</span>
                      <span className="flex flex-wrap gap-x-3 text-[11px] text-[var(--text-dim)]">
                        {v.isDefault ? <span>{t("preview.optionDefault", "Standard")}</span> : null}
                        {v.priceDeltaUsd != null && v.priceDeltaUsd !== 0 ? (
                          <span className="tabular-nums text-[var(--text-secondary)]">{signedUsd(v.priceDeltaUsd)}</span>
                        ) : null}
                        {v.weightDeltaKg != null && v.weightDeltaKg !== 0 ? (
                          <span className="tabular-nums">{v.weightDeltaKg > 0 ? "+" : "−"}{Math.abs(v.weightDeltaKg)} kg</span>
                        ) : null}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
