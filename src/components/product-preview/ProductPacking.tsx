"use client";

/* ProductPacking — rebuild phase 3 (19/09/2026). Packing & Logistics with
 * every detail Product Data holds for the product: how it is packed, each
 * crate with its size and weight, the totals (net / gross / CBM), how many
 * fit a 20ft / 40ft / 40HQ, stackability, wood treatment, dangerous goods,
 * port of loading.
 *
 * PRINTS, DOES NOT COMPUTE. The numbers were derived on the server
 * (product-detail.ts → packingView) with the same functions the Logistics
 * tab and the packing list use; importing lib/logistics here put 18 KB of
 * container maths into the browser bundle to show six figures. Nothing
 * rendered when the product has no packing data.
 */
import { IMG } from "@/lib/cdn";
import { SectionHead } from "./shared";
import type { ProductPackingView } from "@/lib/server/product-detail";

const FACT_LABEL: Record<ProductPackingView["facts"][number]["key"], [string, string]> = {
  packing_type: ["preview.packingType", "Packing"],
  wood_treatment: ["preview.woodTreatment", "Wood treatment"],
  net_weight: ["preview.netWeight", "Net weight"],
  gross_weight: ["preview.grossWeight", "Gross weight"],
  cbm: ["preview.cbm", "Volume"],
  stackable: ["preview.stackable", "Stackable"],
  port_of_loading: ["preview.portOfLoading", "Port of loading"],
};
const fmt = (n: number, digits = 0) => n.toLocaleString(undefined, { maximumFractionDigits: digits });

export default function ProductPacking({ packing, t }: {
  packing: ProductPackingView | null;
  t: (key: string, fallback?: string) => string;
}) {
  if (!packing) return null;
  const { facts, containers, packages, dangerousGoods: dg } = packing;
  const factValue = (f: ProductPackingView["facts"][number]) => {
    if (f.key === "stackable") {
      const [yn, rest] = f.value.split(" · ");
      return `${yn === "yes" ? t("preview.yes", "Yes") : t("preview.no", "No")}${rest ? ` · ${rest}` : ""}`;
    }
    return f.unit ? `${f.value} ${f.unit}` : f.value;
  };

  return (
    <section id="packing" className="space-y-6">
      <SectionHead eyebrow={t("preview.packingEyebrow", "Shipping")} title={t("preview.packingTitle", "Packing & Logistics")} />

      {containers ? (
        <div className="grid grid-cols-3 gap-3 max-w-xl">
          {([["20ft", containers.c20], ["40ft", containers.c40], ["40HQ", containers.c40hq]] as const).map(([label, q]) => (
            <div key={label} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-faint)]">{label}</div>
              <div className="mt-0.5 text-[24px] leading-none font-bold tabular-nums text-[var(--text-primary)]">{q != null ? fmt(q) : "—"}</div>
              <div className="text-[10px] text-[var(--text-dim)]">{t("preview.unitsPerContainer", "units")}</div>
            </div>
          ))}
        </div>
      ) : null}

      {facts.length > 0 ? (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-10">
          {facts.map((f) => (
            <div key={f.key} className="flex justify-between gap-4 border-b border-[var(--border-subtle)] py-2.5 text-sm">
              <dt className="text-[var(--text-ghost)]">{t(FACT_LABEL[f.key][0], FACT_LABEL[f.key][1])}</dt>
              <dd className={`font-medium text-[var(--text-primary)] text-end tabular-nums ${f.key === "packing_type" || f.key === "wood_treatment" ? "capitalize" : ""}`}>{factValue(f)}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {packages.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--bg-surface-subtle)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                <th className="w-[56px] px-3 py-3" />
                <th className="px-4 py-3 text-start">{t("preview.package", "Package")}</th>
                <th className="px-4 py-3 text-end">{t("preview.qty", "Qty")}</th>
                <th className="px-4 py-3 text-end whitespace-nowrap">L × W × H (cm)</th>
                <th className="px-4 py-3 text-end whitespace-nowrap">{t("preview.grossWeight", "Gross weight")}</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((r, i) => (
                <tr key={i} className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2.5">
                    {r.photo ? (
                      <span className="h-9 w-9 rounded-lg bg-white border border-black/5 overflow-hidden flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={IMG.thumb(r.photo)} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-1" />
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">{r.label || `${t("preview.package", "Package")} ${i + 1}`}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums">{r.qty}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums whitespace-nowrap">
                    {[r.l, r.w, r.h].map((v) => (v != null ? fmt(v, 1) : "—")).join(" × ")}
                  </td>
                  <td className="px-4 py-2.5 text-end tabular-nums">{r.grossKg != null ? `${fmt(r.grossKg, 1)} kg` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {dg ? (
        <div className="rounded-xl border border-[var(--border-subtle)] border-s-[3px] border-s-[#FFCC00] bg-[var(--bg-surface-subtle)] px-4 py-3 text-sm">
          <div className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">{t("preview.dangerousGoods", "Dangerous goods")}</div>
          <div className="mt-1 text-[var(--text-secondary)] capitalize">
            {dg.kinds.join(", ")}
            {dg.unNumbers ? ` · UN ${dg.unNumbers}` : ""}
            {dg.notes ? ` · ${dg.notes}` : ""}
          </div>
        </div>
      ) : null}
    </section>
  );
}
