"use client";

/* ---------------------------------------------------------------------------
   ReviewSheet — the Review tab of the product profile.

   THE EDITOR'S REVIEW STEP, ON THE RECORD:

     Readiness          the same score and dimensions the grid and the editor
                        compute, so the three never disagree
     Before it goes live the publish gaps the editor warns about next to the
                        Status toggle — name, classification, KOLEEX code,
                        main photo, a selling price the engine can quote from,
                        a Chinese name — each a link to the tab that fixes it
     Customer preview   the public product page, rendered from this record
                        (loaded only when this tab opens — it is the heaviest
                        component on the page)
     Record             id, created, updated, schema version

   Nothing here is edited: every row points at the tab that owns it.
   --------------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import type { ProductKnowledgeBlock, ProductSchemaDefinition } from "@/types/product-schema";
import { landedCostCny } from "@/lib/products-admin";
import BoundIcon from "@/components/common/BoundIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import HistoryIcon from "@/components/icons/ui/HistoryIcon";
import { Group, FieldRow, Blank } from "./primitives";

const ProductPreview = dynamic(() => import("@/components/product-preview/ProductPreview").then((m) => m.ProductPreview), {
  ssr: false,
  loading: () => <div className="h-40 rounded-xl border border-dashed border-[var(--border-subtle)] animate-pulse" />,
});

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const fmtDay = (v: unknown) => { const s = str(v); if (!s) return ""; const d = new Date(s); return Number.isNaN(d.getTime()) ? s : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

export default function ReviewSheet({
  product, models, media, translations, suppliers, schema, readiness, t, motion, notSet, glyph, onGo,
}: {
  product: Row | undefined;
  models: Row[];
  media: Row[];
  translations: Row[];
  suppliers: Row[];
  schema: { name: string; version: string; groups: unknown[] } | null;
  readiness: { overall: number; dimensions?: Array<{ dimension?: string; key?: string; label?: string; score: number; filled?: number; total?: number; missing?: Array<{ key: string; label: string }> }> } | null;
  t: (k: string, fb?: string) => string;
  motion: string;
  notSet: string;
  glyph: (label: string) => React.ReactNode;
  /** Jump to the tab that owns a gap. */
  onGo: (stepId: string) => void;
}) {
  const primary = models[0];
  const link = suppliers.find((s) => s.is_primary) ?? suppliers[0] ?? null;
  const engineCost = link
    ? (landedCostCny({ unit_cost_cny: link.unit_cost_cny as number | null, cost_basis: str(link.cost_basis) || null, cost_includes_tax: (link.cost_includes_tax as boolean | null) ?? null, cost_extras: (link.cost_extras as never) ?? null }).landed ?? (Number(link.unit_cost_cny) || null))
    : (Number(primary?.cost_price) || null);
  const priced = !!str(primary?.global_price).trim() || (engineCost !== null && engineCost > 0);

  /* The editor's publish gaps, computed from the record. */
  const gaps: Array<{ label: string; step: string }> = [];
  if (!str(product?.product_name).trim()) gaps.push({ label: t("field.productName", "Product name"), step: "identity" });
  if (!str(product?.division_slug)) gaps.push({ label: t("field.division", "Division"), step: "classify" });
  if (!str(product?.category_slug)) gaps.push({ label: t("field.category", "Category"), step: "classify" });
  if (!str(product?.subcategory_slug)) gaps.push({ label: t("field.subcategory", "Subcategory"), step: "classify" });
  if (!str(primary?.primary_model).trim()) gaps.push({ label: t("field.primaryModel", "Primary model"), step: "identity" });
  if (!media.some((m) => m.type === "main_image")) gaps.push({ label: t("publish.gapImage", "Main photo"), step: "identity" });
  if (!priced) gaps.push({ label: t("publish.gapPrice", "Selling price"), step: "pricing" });
  if (!translations.some((tr) => tr.locale === "zh" && str(tr.product_name).trim())) gaps.push({ label: t("publish.gapChineseName", "Chinese name"), step: "identity" });

  const status = str(product?.status) || "draft";
  const live = status === "active" || product?.visible === true;
  const score = readiness?.overall ?? null;
  const mainImage = str(media.find((m) => m.type === "main_image")?.url) || null;
  const gallery = media.filter((m) => m.type === "gallery").map((m) => str(m.url)).filter(Boolean);
  const count = (type: string) => media.filter((m) => m.type === type).length;

  return (
    <div className="space-y-4">
      {/* ── Readiness ─────────────────────────────────────────────────── */}
      <Group motion={motion} icon={<BoundIcon semanticKey="field.readiness" className="h-4 w-4" fallback={<CheckIcon className="h-4 w-4" />} />} title={t("pp.sec.readiness", "Readiness")} count={score != null ? `${score}%` : undefined}>
        {score == null ? (
          <p className="text-[12px] text-[var(--text-ghost)] italic">{t("pp.e.noScore", "No spec template resolves, so completeness can’t be scored.")}</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="inline-block h-1.5 flex-1 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                <span className={`block h-full rounded-full ${score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-rose-500/80"}`} style={{ width: `${Math.max(2, score)}%` }} />
              </span>
              <span className="text-[13px] font-bold tabular-nums text-[var(--text-primary)]">{score}%</span>
            </div>
            {readiness?.dimensions && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {readiness.dimensions.map((d, i) => {
                  const key = d.dimension ?? d.key ?? String(i);
                  const label = d.label ?? t(`rv.dim.${key}`, key.charAt(0).toUpperCase() + key.slice(1));
                  return (
                    <div key={key} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-ghost)] truncate">{label}</span>
                        {d.total != null && <span className="text-[10px] text-[var(--text-ghost)] tabular-nums shrink-0">{d.filled ?? 0}/{d.total}</span>}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="inline-block h-1 flex-1 rounded-full bg-[var(--bg-surface-subtle)] overflow-hidden"><span className={`block h-full rounded-full ${d.score >= 80 ? "bg-emerald-500" : d.score >= 50 ? "bg-amber-500" : "bg-rose-500/80"}`} style={{ width: `${Math.max(2, d.score)}%` }} /></span>
                        <span className="text-[12px] font-semibold tabular-nums">{d.score}%</span>
                      </div>
                      {d.missing && d.missing.length > 0 && (
                        <div className="mt-1 text-[10px] text-[var(--text-ghost)] truncate" title={d.missing.map((m) => m.label).join(", ")}>{t("rv.missingShort", "Missing")}: {d.missing.slice(0, 3).map((m) => m.label).join(", ")}{d.missing.length > 3 ? ` +${d.missing.length - 3}` : ""}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Group>

      {/* ── Publish gaps ──────────────────────────────────────────────── */}
      <Group motion={motion} icon={<TriangleWarningIcon className="h-4 w-4" />} title={t("rv.gapsTitle", "Before it goes live")} count={gaps.length === 0 ? t("rv.ready", "Ready") : t("rv.gapsN", "{n} missing").replace("{n}", String(gaps.length))}>
        {gaps.length === 0 ? (
          <p className="text-[12px] text-emerald-400/90 inline-flex items-center gap-1.5"><CheckIcon className="h-3.5 w-3.5" /> {live ? t("rv.liveOk", "Live and nothing missing — the catalogue shows everything it wants.") : t("rv.draftOk", "Nothing missing — this product can go live from the Hero tab.")}</p>
        ) : (
          <>
            {live && <p className="mb-2 text-[11px] text-amber-400/90">{t("rv.liveWithGaps", "This product is live while the items below are still missing.")}</p>}
            <div className="flex flex-wrap gap-1.5">
              {gaps.map((g) => (
                <button key={g.label} type="button" onClick={() => onGo(g.step)} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-500/40 bg-amber-500/[0.07] text-[12px] font-medium text-amber-200 hover:bg-amber-500/[0.14] transition-colors">
                  {g.label} <span className="text-[10px] text-amber-400/80">→ {t(`step.${g.step === "identity" ? "hero" : g.step === "pricing" ? "price" : g.step}`, g.step)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </Group>

      {/* ── Customer preview ──────────────────────────────────────────── */}
      <Group motion={motion} icon={<EyeIcon className="h-4 w-4" />} title={t("rv.previewTitle", "Customer preview")} count={t("rv.previewBadge", "Public page · live")}>
        <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-primary)]">
          <ProductPreview
            productName={str(product?.product_name)}
            primaryModel={str(primary?.primary_model) || null}
            tagline={str(primary?.tagline) || null}
            posterUrl={str(product?.hero_poster_url) || null}
            brand={str(product?.brand) || null}
            schema={schema as unknown as ProductSchemaDefinition | null}
            values={(product?.schema_specs as Record<string, unknown> | null) ?? {}}
            knowledge={(Array.isArray(product?.schema_knowledge) ? product!.schema_knowledge : []) as ProductKnowledgeBlock[]}
            mainImageUrl={mainImage}
            galleryUrls={gallery}
            mediaCounts={{ photos: gallery.length, videos: count("video"), manuals: count("manual") }}
            countryOfOrigin={str(product?.country_of_origin) || null}
            warranty={str(product?.warranty) || null}
            variants={models.map((m, i) => ({ photo: str(media.find((x) => x.type === "model_image" && str(x.model_id) === str(m.id))?.url) || null, primary: i === 0, code: str(m.primary_model) || str(m.model_name), tagline: str(m.tagline) || null, overrides: (m.specs_overrides as Record<string, unknown> | null) ?? {} }))}
            surface="website"
          />
        </div>
      </Group>

      {/* ── Record ────────────────────────────────────────────────────── */}
      <Group motion={motion} icon={<HistoryIcon className="h-4 w-4" />} title={t("pp.sec.record", "Record")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 [&>*]:border-b [&>*]:border-[var(--border-subtle)] [&>*:last-child]:border-b-0">
          <FieldRow label={t("pp.f.productId", "Product id")} glyph={glyph(t("pp.f.productId", "Product id"))} mono value={str(product?.id) || <Blank label={notSet} />} />
          <FieldRow label={t("pp.f.schemaVer", "Schema version")} glyph={glyph(t("pp.f.schemaVer", "Schema version"))} value={schema ? `${schema.name} v${schema.version}` : <Blank label={notSet} />} />
          <FieldRow label={t("pp.f.created", "Created")} glyph={glyph(t("pp.f.created", "Created"))} value={fmtDay(product?.created_at) || <Blank label={notSet} />} />
          <FieldRow label={t("pp.f.updated", "Last updated")} glyph={glyph(t("pp.f.updated", "Last updated"))} value={fmtDay(product?.updated_at) || <Blank label={notSet} />} />
        </div>
      </Group>
    </div>
  );
}
