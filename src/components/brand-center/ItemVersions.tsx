"use client";

/* Brand Center item — the versions that may be made, for everyone who reads
   the page: per type the choices in use, then the choices the rules forbid,
   each with its reason. (The owner switches choices in the editor.) */

import type { BcType } from "@/lib/brand-center/client";
import { notAllowedOf, optionRef, type ItemRules } from "@/lib/brand-center/rules";
import { CARD } from "@/components/travel/fields";

type T = (k: string) => string;

export default function ItemVersions({ t, types, rules }: { t: T; types: BcType[]; rules: ItemRules | null }) {
  const no = notAllowedOf(rules);
  const rows = types
    .map((ty) => ({ id: ty.id, label: ty.label, options: ty.options.filter((o) => o.chosen && !no.has(optionRef(ty.key, o.key))) }))
    .filter((r) => r.options.length);
  const forbidden = types.flatMap((ty) => ty.options
    .filter((o) => no.has(optionRef(ty.key, o.key)))
    .map((o) => ({ id: o.id, type: ty.label, label: o.label, why: no.get(optionRef(ty.key, o.key)) ?? "" })));
  if (!rows.length && !forbidden.length) return null;

  return (
    <section data-kx-pane aria-label={t("ver.title")} className={`${CARD} mt-4 px-4 py-4`}>
      <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("ver.title")}</h2>
      <p className="mt-0.5 text-[12px] text-[var(--text-dim)]">{t("ver.hint")}</p>
      {rows.length ? (
        <dl className="mt-3 grid grid-cols-1 border-t border-[var(--border-faint)] sm:grid-cols-[180px_minmax(0,1fr)]">
          {rows.map((r) => (
            <div key={r.id} className="contents">
              <dt dir="auto" className="border-b border-[var(--border-faint)] pb-1 pt-2 pe-3 text-[12px] font-semibold text-[var(--text-secondary)] sm:py-2">{r.label}</dt>
              <dd className="m-0 flex flex-wrap gap-1.5 border-b border-[var(--border-faint)] pb-2 pt-1 sm:py-2">
                {r.options.map((o) => (
                  <span key={o.id} dir="auto" className="rounded-lg border border-[var(--border-subtle)] px-2 py-0.5 text-[12px] text-[var(--text-primary)]">{o.label}</span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {forbidden.length ? (
        <div className="mt-4">
          <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)]">{t("ver.notAllowed")}</h3>
          <ul className="mt-1.5 grid [&>*]:min-w-0 gap-1.5">
            {forbidden.map((f) => (
              <li key={f.id} className="flex gap-2 text-[12.5px] leading-5">
                <span aria-hidden className="shrink-0 font-semibold text-red-500">✕</span>
                <span className="min-w-0">
                  <span dir="auto" className="text-[var(--text-primary)] line-through decoration-red-500/60">{f.label}</span>
                  <span dir="auto" className="text-[var(--text-dim)]"> · {f.type}</span>
                  <span dir="auto" className="block text-[12px] text-[var(--text-secondary)]">{f.why}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
