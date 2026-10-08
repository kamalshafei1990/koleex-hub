"use client";

/* ProductCompliance — rebuild phase 3 (19/09/2026). One quiet section for
 * the facts a buyer's customs broker and safety officer ask for: CE, RoHS,
 * the IP rating, the HS code, country of origin, warranty — plus every
 * compliance / customs boolean the product's own spec schema marks true
 * (the same list the old footer strip drew). Nothing rendered when there
 * is nothing to declare.
 */
import VisualGlyph from "./VisualGlyph";
import { SectionHead } from "./shared";
import type { ProductDetailSections } from "@/lib/server/product-detail";

export default function ProductCompliance({ compliance, warrantyMonths, schemaMarks, t }: {
  compliance: ProductDetailSections["compliance"];
  warrantyMonths: number | null;
  /** Labels of the schema's compliance/customs booleans that are true. */
  schemaMarks: string[];
  t: (key: string, fallback?: string) => string;
}) {
  const marks: string[] = [];
  if (compliance.ce) marks.push("CE");
  if (compliance.rohs) marks.push("RoHS");
  for (const m of schemaMarks) if (!marks.includes(m)) marks.push(m);

  const facts: Array<[string, string]> = [];
  if (compliance.ipRating) facts.push([t("preview.ipRating", "IP rating"), compliance.ipRating]);
  if (compliance.hsCode) facts.push([t("preview.hsCode", "HS code"), compliance.hsCode]);
  if (compliance.countryOfOrigin) facts.push([t("preview.origin", "Origin"), compliance.countryOfOrigin]);
  const warranty = compliance.warranty || (warrantyMonths ? `${warrantyMonths} ${t("preview.months", "months")}` : null);
  if (warranty) facts.push([t("preview.warranty", "Warranty"), warranty]);

  if (marks.length === 0 && facts.length === 0) return null;
  return (
    <section id="compliance" className="space-y-6">
      <SectionHead eyebrow={t("preview.complianceEyebrow", "Declared")} title={t("preview.compliance", "Compliance")} />
      {marks.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {marks.map((m) => (
            <span key={m} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
              <VisualGlyph token="check" className="h-3 w-3" />
              {m}
            </span>
          ))}
        </div>
      ) : null}
      {facts.length > 0 ? (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 max-w-3xl">
          {facts.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-[var(--border-subtle)] py-2.5 text-sm">
              <dt className="text-[var(--text-ghost)]">{k}</dt>
              <dd className="font-medium text-[var(--text-primary)] text-end">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
