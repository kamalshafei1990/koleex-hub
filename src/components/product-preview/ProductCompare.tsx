"use client";

/* ProductCompare — this machine against one of its subcategory siblings on
 * the key figures. Two columns, the same rows, the rival chosen from a
 * select. Compact and factual; the hero's Compare action scrolls here.
 */
import { useState } from "react";
import { IMG } from "@/lib/cdn";
import type { ProductAnchor } from "@/lib/product-schema/visual-options";
import { formatSpecValue, SectionHead } from "./shared";

export default function ProductCompare({ name, imageUrl, values, siblings, anchors, yes, no, t }: {
  name: string;
  imageUrl: string | null;
  values: Record<string, unknown>;
  siblings: Array<{ name: string; slug: string; imageUrl?: string | null; values: Record<string, unknown> }>;
  anchors: ProductAnchor[];
  yes: string;
  no: string;
  t: (key: string, fallback?: string) => string;
}) {
  const [idx, setIdx] = useState(0);
  if (siblings.length === 0 || anchors.length === 0) return null;
  const rival = siblings[Math.min(idx, siblings.length - 1)];
  const fields = anchors.slice(0, 6).map((a) => a.field);
  const cols = [
    { key: "self", name, imageUrl, vals: values, slug: null as string | null },
    { key: "rival", name: rival.name, imageUrl: rival.imageUrl ?? null, vals: rival.values, slug: rival.slug },
  ];
  return (
    <section id="compare" className="space-y-6">
      <SectionHead
        eyebrow={t("preview.eyebrowCompare", "Compare")}
        title={t("preview.compareTitle", "How it stacks up")}
        aside={
          <label className="flex items-center gap-2">
            <span>{t("preview.compareWith", "Compare with")}</span>
            <select
              id="kx-compare-pick"
              value={Math.min(idx, siblings.length - 1)}
              onChange={(e) => setIdx(Number(e.target.value))}
              className="h-9 max-w-[16rem] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2 text-[13px] font-medium text-[var(--text-primary)] outline-none focus:border-[#0066FF]"
            >
              {siblings.map((s, i) => <option key={s.slug} value={i}>{s.name}</option>)}
            </select>
          </label>
        }
      />
      <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="bg-[var(--bg-surface-subtle)]">
              <th className="w-[11rem] px-4 py-3" />
              {cols.map((c) => (
                <th key={c.key} className="px-4 py-3 text-start">
                  <div className="flex items-center gap-3">
                    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-black/5 bg-white">
                      {c.imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={IMG.thumb(c.imageUrl)} alt="" className="h-full w-full object-contain p-1" />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-[var(--text-primary)]">{c.name}</span>
                      {c.slug ? <a href={`/products/${c.slug}`} className="text-[12px] font-medium text-[#0066FF]">{t("preview.viewProduct", "View")}</a> : <span className="text-[12px] text-[var(--text-dim)]">{t("preview.thisProduct", "This product")}</span>}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.key} className="border-t border-[var(--border-subtle)]">
                <th scope="row" className="px-4 py-3 text-start font-normal text-[var(--text-dim)]">{f.label ?? f.key}</th>
                {cols.map((c) => (
                  <td key={c.key} className="px-4 py-3 font-medium tabular-nums text-[var(--text-primary)]">{formatSpecValue(f, c.vals[f.key], yes, no)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
