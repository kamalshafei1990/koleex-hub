"use client";

/* ProductPriceInternal — rebuild phase 3 (19/09/2026). The Price section,
 * INTERNAL audience only: what Product Data's Price tab holds per model —
 * pricing mode, list prices (global / head only / complete set) and the
 * price note. The loader hands `modelPrices` only to internal readers, so
 * a customer, the print and the website receive null and this draws
 * nothing. Cost is not here and never will be — that stays on the Supplier
 * tab behind its own permission.
 */
import type { ProductModelPriceView } from "@/lib/server/product-detail";

const usd = (n: number | null) => (n == null ? "—" : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);

export default function ProductPriceInternal({ modelPrices, t }: {
  modelPrices: ProductModelPriceView[] | null;
  t: (key: string, fallback?: string) => string;
}) {
  if (!modelPrices) return null;
  const rows = modelPrices.filter((m) => m.globalPrice != null || m.headOnlyPrice != null || m.completeSetPrice != null || m.priceNote || (m.pricingMode && m.pricingMode !== "fixed"));
  if (rows.length === 0) return null;
  const anyHead = rows.some((m) => m.supportsHeadOnly || m.headOnlyPrice != null);
  const anySet = rows.some((m) => m.supportsCompleteSet || m.completeSetPrice != null);

  return (
    <section data-reveal className="space-y-6">
      <div className="space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
          {t("preview.priceEyebrow", "Internal")}
        </div>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
          {t("preview.priceTitle", "Price sheet")}
        </h2>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--bg-surface-subtle)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              <th className="px-4 py-3 text-start text-[var(--text-primary)]">{t("preview.heroFamilyModel", "Model")}</th>
              <th className="px-4 py-3 text-start">{t("preview.pricingMode", "Mode")}</th>
              <th className="px-4 py-3 text-end whitespace-nowrap">{t("preview.globalPrice", "Global price")}</th>
              {anyHead ? <th className="px-4 py-3 text-end whitespace-nowrap">{t("preview.headOnly", "Head only")}</th> : null}
              {anySet ? <th className="px-4 py-3 text-end whitespace-nowrap">{t("preview.completeSet", "Complete set")}</th> : null}
              <th className="px-4 py-3 text-start">{t("preview.priceNote", "Note")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id || m.code} className="border-t border-[var(--border-subtle)]">
                <td className="px-4 py-2.5 font-bold tracking-tight text-[var(--text-primary)] whitespace-nowrap">{m.code}</td>
                <td className="px-4 py-2.5 text-[var(--text-secondary)] capitalize">{(m.pricingMode ?? "fixed").replace(/_/g, " ")}</td>
                <td className="px-4 py-2.5 text-end tabular-nums font-medium text-[var(--text-primary)]">{usd(m.globalPrice)}</td>
                {anyHead ? <td className="px-4 py-2.5 text-end tabular-nums">{m.supportsHeadOnly || m.headOnlyPrice != null ? usd(m.headOnlyPrice) : "—"}</td> : null}
                {anySet ? <td className="px-4 py-2.5 text-end tabular-nums">{m.supportsCompleteSet || m.completeSetPrice != null ? usd(m.completeSetPrice) : "—"}</td> : null}
                <td className="px-4 py-2.5 text-[13px] text-[var(--text-muted)]">{m.priceNote ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
