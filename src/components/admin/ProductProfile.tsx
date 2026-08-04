"use client";

/* ---------------------------------------------------------------------------
   ProductProfile — the INTERNAL product record (/product-data/[id]).

   Product Data and the Products app answer different questions, so they must
   not share a page. The Products app is the showroom: it hides what is empty,
   because a customer must never see a gap. Product Data is the record: an
   operator opens a product precisely to find what is MISSING, so an empty
   field has to be visible and labelled.

   Shape follows the Suppliers 360 page — identity header, then grouped
   sections — and the field grouping follows the editor's own tab order, so
   "where do I fix this?" has an obvious answer. Every group header carries a
   jump straight into that step of the editor.

   All data arrives from GET /api/products/[id]/profile in one round trip.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { IMG } from "@/lib/cdn";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation } from "@/lib/i18n";
import { PRODUCTS_UI_I18N } from "@/lib/products-ui-i18n";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import FactoryIcon from "@/components/icons/ui/FactoryIcon";

/* ── shapes (loose on purpose: the products table is column-agnostic) ── */
type Row = Record<string, unknown>;
interface Profile {
  product: Row;
  subcategory: { slug: string; code: string; name: string } | null;
  schema: { name: string; version: string; groups: Array<{ key?: string; title?: string; fields?: Array<{ key: string; label?: string; unit?: string }> }> } | null;
  models: Row[];
  media: Row[];
  translations: Row[];
  suppliers: Array<Row & { supplier: { name: string; logo: string | null } | null }>;
  certifications: Row[];
  documents: Row[];
  related: Array<Row & { product: { name: string; slug: string | null } | null }>;
  readiness: { overall: number; dimensions?: Array<{ key: string; label: string; score: number }> } | null;
  costVisible: boolean;
}

/* ── value rendering ──────────────────────────────────────────────────────
   The whole point of this page is that a blank is information. Empty values
   render as a dim "Not set" rather than collapsing the row away. */
function Val({ v, mono }: { v: unknown; mono?: boolean }) {
  const empty =
    v === null || v === undefined || v === "" ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);
  if (empty) return <span className="text-[12px] text-[var(--text-ghost)] italic">Not set</span>;
  if (typeof v === "boolean") {
    return (
      <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${v ? "text-emerald-400" : "text-[var(--text-dim)]"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${v ? "bg-emerald-500" : "bg-[var(--border-subtle)]"}`} />
        {v ? "Yes" : "No"}
      </span>
    );
  }
  if (Array.isArray(v)) {
    return (
      <span className="flex flex-wrap gap-1">
        {v.map((x, i) => (
          <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[11px] text-[var(--text-subtle)]">
            {String(x)}
          </span>
        ))}
      </span>
    );
  }
  if (typeof v === "object") {
    return <span className="text-[11px] font-mono text-[var(--text-subtle)] break-all">{JSON.stringify(v)}</span>;
  }
  return <span className={`text-[13px] text-[var(--text-primary)] ${mono ? "font-mono text-[12px]" : ""} break-words`}>{String(v)}</span>;
}

function Field({ label, value, mono }: { label: string; value: unknown; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] uppercase tracking-wider text-[var(--text-ghost)] mb-1">{label}</div>
      <Val v={value} mono={mono} />
    </div>
  );
}

function Group({
  title, count, onEdit, children,
}: { title: string; count?: string; onEdit?: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 md:px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{title}</h2>
          {count && <span className="text-[11px] text-[var(--text-ghost)] shrink-0">{count}</span>}
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <PencilIcon className="h-3 w-3" /> Edit
          </button>
        )}
      </header>
      <div className="p-4 md:p-5">{children}</div>
    </section>
  );
}

const grid = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-4";

export default function ProductProfile() {
  const params = useParams<{ id: string }>();
  const handle = params?.id;
  const router = useRouter();
  const { t } = useTranslation(PRODUCTS_UI_I18N);

  const [data, setData] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/products/${handle}/profile`, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Profile;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(humanizeError(e));
      }
    })();
    return () => { cancelled = true; };
  }, [handle]);

  const p = data?.product;
  const editHref = p ? `/product-data/${p.id as string}/edit` : "#";
  const goStep = useCallback((step: string) => router.push(`${editHref}#${step}`), [editHref, router]);

  const hero = useMemo(() => {
    const main = (data?.media ?? []).find((m) => m.type === "main_image");
    return (main?.url as string) || null;
  }, [data]);

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-5 text-[13px] text-rose-300">{error}</div>
      </div>
    );
  }
  if (!data || !p) {
    return (
      <div className="p-6 space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-[var(--bg-surface)] animate-pulse" />)}
      </div>
    );
  }

  const readiness = data.readiness?.overall ?? null;
  const s = (k: string) => p[k];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1500px] mx-auto space-y-4">
      {/* ── Identity header ── */}
      <div className="flex items-start gap-4">
        <Link href="/product-data" aria-label="Back" className="shrink-0 h-9 w-9 rounded-xl border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <ArrowLeftIcon className="h-4 w-4" />
        </Link>
        <div className="h-16 w-16 md:h-20 md:w-20 shrink-0 rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-white flex items-center justify-center">
          {hero
            ? <img src={IMG.thumb(hero)} alt="" className="h-full w-full object-contain p-1" />
            : <span className="text-[10px] text-gray-400">No photo</span>}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[18px] md:text-[22px] font-bold tracking-tight text-[var(--text-primary)] break-words">
            {(s("product_name") as string) || "Untitled product"}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--text-dim)]">
            <span className="font-mono">{(data.models[0]?.primary_model as string) || "no code"}</span>
            <span className="text-[var(--text-ghost)]">·</span>
            <span>{(s("category_slug") as string) || "—"}</span>
            {data.subcategory && <><span className="text-[var(--text-ghost)]">·</span><span>{data.subcategory.name}</span></>}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {(s("status") as string) || "draft"}
            </span>
            {s("visible") !== true && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-[var(--bg-surface)] text-[10px] font-medium text-[var(--text-ghost)]">Hidden from customers</span>
            )}
            {readiness != null && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
                <span className="inline-block h-1 w-16 rounded-full bg-[var(--bg-surface)] overflow-hidden align-middle">
                  <span className={`block h-full rounded-full ${readiness >= 80 ? "bg-emerald-500" : readiness >= 50 ? "bg-amber-500" : "bg-rose-500/80"}`} style={{ width: `${Math.max(2, readiness)}%` }} />
                </span>
                {readiness}% complete
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {s("slug") ? (
            <Link href={`/products/${s("slug") as string}`} className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" title="Open the customer-facing page">
              <ExternalLinkIcon className="h-3.5 w-3.5" /> Public page
            </Link>
          ) : null}
          <Link href={editHref} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold">
            <PencilIcon className="h-3.5 w-3.5" /> {t("action.edit", "Edit")}
          </Link>
        </div>
      </div>

      {/* ── Classification ── */}
      <Group title="Classification" onEdit={() => goStep("classify")}>
        <div className={grid}>
          <Field label="Division" value={s("division_slug")} />
          <Field label="Category" value={s("category_slug")} />
          <Field label="Subcategory" value={data.subcategory?.name ?? s("subcategory_slug")} />
          <Field label="Subcategory code" value={data.subcategory?.code} mono />
          <Field label="Family" value={s("family")} />
          <Field label="Level" value={s("level")} />
          <Field label="Spec template" value={data.schema ? `${data.schema.name} v${data.schema.version}` : null} />
        </div>
      </Group>

      {/* ── Suppliers (link only — master lives in the Suppliers app) ── */}
      <Group title="Suppliers" count={`${data.suppliers.length}`} onEdit={() => goStep("supplier")}>
        {data.suppliers.length === 0 ? (
          <p className="text-[12px] text-[var(--text-ghost)] italic">No supplier linked.</p>
        ) : (
          <div className="space-y-3">
            {data.suppliers.map((sup, i) => (
              <div key={i} className="rounded-xl border border-[var(--border-subtle)] p-3">
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="h-8 w-8 rounded-lg bg-white border border-[var(--border-subtle)] overflow-hidden flex items-center justify-center shrink-0">
                    {sup.supplier?.logo ? <img src={IMG.thumb(sup.supplier.logo)} alt="" className="h-full w-full object-contain p-0.5" /> : <FactoryIcon className="h-3.5 w-3.5 text-gray-400" />}
                  </span>
                  <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{sup.supplier?.name ?? "—"}</span>
                  {sup.is_primary === true && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)]">Primary</span>}
                </div>
                <div className={grid}>
                  <Field label="Supplier product code" value={sup.supplier_product_code} mono />
                  <Field label="Supplier product name" value={sup.supplier_product_name} />
                  {data.costVisible && <Field label="Unit cost (CNY)" value={sup.unit_cost_cny} />}
                  <Field label="Supply type" value={sup.supply_type} />
                  <Field label="Incoterms" value={sup.incoterms} />
                  <Field label="Sourcing status" value={sup.sourcing_status} />
                  <Field label="Sample available" value={sup.sample_available} />
                  <Field label="Supplier warranty (months)" value={sup.supplier_warranty_months} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Group>

      {/* ── Identity & lifecycle ── */}
      <Group title="Identity & lifecycle" onEdit={() => goStep("identity")}>
        <div className={grid}>
          <Field label="Product name" value={s("product_name")} />
          <Field label="Public URL" value={s("slug")} mono />
          <Field label="Brand" value={s("brand")} />
          <Field label="Manufacturer" value={s("manufacturer")} />
          <Field label="MPN" value={s("mpn")} mono />
          <Field label="GTIN" value={s("gtin")} mono />
          <Field label="Internal SKU" value={s("internal_sku")} mono />
          <Field label="Legacy code" value={s("legacy_code")} mono />
          <Field label="Generation" value={s("generation")} />
          <Field label="Model year" value={s("model_year")} />
          <Field label="Launch date" value={s("launch_date")} />
          <Field label="End of life" value={s("eol_date")} />
          <Field label="Available from" value={s("available_from")} />
          <Field label="Last order date" value={s("last_order_date")} />
          <Field label="Alternate names" value={s("alternate_names")} />
          <Field label="Status reason" value={s("status_reason")} />
          <Field label="Featured" value={s("featured")} />
          <Field label="Visible to customers" value={s("visible")} />
        </div>
      </Group>

      {/* ── Description ── */}
      <Group title="Description" onEdit={() => goStep("identity")}>
        <div className="space-y-4">
          <Field label="Short description (excerpt)" value={s("excerpt")} />
          <Field label="Full description" value={s("description")} />
          <Field label="Highlights" value={s("highlights")} />
          <Field label="Tags" value={s("tags")} />
        </div>
      </Group>

      {/* ── Specifications (schema-driven) ── */}
      <Group title="Specifications" count={data.schema ? undefined : "no template"} onEdit={() => goStep("specs")}>
        {!data.schema ? (
          <p className="text-[12px] text-[var(--text-ghost)] italic">
            No spec template resolves for this classification, so there are no specification fields to fill.
          </p>
        ) : (
          <div className="space-y-5">
            {(data.schema.groups ?? []).map((g, gi) => (
              <div key={gi}>
                <div className="text-[11px] font-semibold text-[var(--text-muted)] mb-2.5">{g.title || g.key}</div>
                <div className={grid}>
                  {(g.fields ?? []).map((f) => (
                    <Field
                      key={f.key}
                      label={`${f.label || f.key}${f.unit ? ` (${f.unit})` : ""}`}
                      value={(s("schema_specs") as Record<string, unknown> | null)?.[f.key]}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Group>

      {/* ── Variants & pricing ── */}
      <Group title="Variants & pricing" count={`${data.models.length}`} onEdit={() => goStep("models")}>
        {data.models.length === 0 ? (
          <p className="text-[12px] text-[var(--text-ghost)] italic">No variant recorded — a product needs at least one.</p>
        ) : (
          <div className="space-y-3">
            {data.models.map((m, i) => (
              <div key={i} className="rounded-xl border border-[var(--border-subtle)] p-3">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">{(m.model_name as string) || "Untitled variant"}</span>
                  <span className="text-[11px] font-mono text-[var(--text-dim)]">{(m.primary_model as string) || "—"}</span>
                  {i === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)]">Primary</span>}
                </div>
                <div className={grid}>
                  <Field label="Pricing" value={m.pricing_mode ?? "fixed"} />
                  {data.costVisible && <Field label="Cost price (CNY)" value={m.cost_price} />}
                  <Field label="Global price (USD)" value={m.global_price} />
                  <Field label="Price note" value={m.price_note} />
                  <Field label="MOQ" value={m.moq} />
                  <Field label="Lead time" value={m.lead_time} />
                  <Field label="Stock status" value={m.stock_status} />
                  <Field label="Barcode" value={m.barcode} mono />
                </div>
              </div>
            ))}
          </div>
        )}
      </Group>

      {/* ── Logistics & packaging ── */}
      <Group title="Logistics & packaging" onEdit={() => goStep("logistics")}>
        <div className={grid}>
          <Field label="Country of origin" value={s("country_of_origin")} />
          <Field label="HS code" value={s("hs_code")} mono />
          <Field label="MOQ" value={s("moq")} />
          <Field label="Lead time" value={s("lead_time")} />
          <Field label="Machine weight (kg)" value={s("machine_weight_kg")} />
          <Field label="Machine dimensions" value={s("machine_dimensions")} />
        </div>
        {data.models[0] && (
          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
            <div className="text-[11px] font-semibold text-[var(--text-muted)] mb-2.5">Primary variant packing</div>
            <div className={grid}>
              <Field label="Net weight" value={data.models[0].net_weight} />
              <Field label="Gross weight" value={data.models[0].weight} />
              <Field label="CBM" value={data.models[0].cbm} />
              <Field label="Carton dimensions" value={data.models[0].carton_dimensions} />
              <Field label="Packing type" value={data.models[0].packing_type} />
              <Field label="20ft qty" value={data.models[0].container_20ft_qty} />
              <Field label="40ft qty" value={data.models[0].container_40ft_qty} />
              <Field label="40HQ qty" value={data.models[0].container_40hq_qty} />
            </div>
          </div>
        )}
      </Group>

      {/* ── Compliance & warranty ── */}
      <Group title="Compliance & warranty" count={`${data.certifications.length} cert`} onEdit={() => goStep("compliance")}>
        <div className={grid}>
          <Field label="Warranty (months)" value={s("warranty_months")} />
          <Field label="Warranty type" value={s("warranty_type")} />
          <Field label="Starts from" value={s("warranty_start_from")} />
          <Field label="Coverage" value={s("warranty_coverage")} />
          <Field label="Exclusions" value={s("warranty_exclusions")} />
          <Field label="CE certified" value={s("ce_certified")} />
          <Field label="RoHS compliant" value={s("rohs_compliant")} />
          <Field label="Spare parts availability" value={s("spare_parts_availability")} />
          <Field label="Service life" value={s("service_life")} />
          <Field label="Maintenance interval" value={s("maintenance_interval")} />
          <Field label="Technical support" value={s("technical_support")} />
          <Field label="Support channels" value={s("support_channels")} />
          <Field label="Training available" value={s("training_available")} />
          <Field label="Installation service" value={s("installation_service")} />
          <Field label="Returns policy" value={s("returns_policy")} />
        </div>
        {data.certifications.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] space-y-2">
            {data.certifications.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                <span className="font-medium text-[var(--text-primary)]">{(c.cert_type as string) || "—"}</span>
                <span className="text-[var(--text-dim)]">{(c.certified_standard as string) || ""}</span>
                <span className="font-mono text-[11px] text-[var(--text-muted)]">{(c.cert_number as string) || ""}</span>
                {c.expiry_date ? <span className="text-[11px] text-[var(--text-ghost)]">expires {String(c.expiry_date)}</span> : null}
              </div>
            ))}
          </div>
        )}
      </Group>

      {/* ── Media & documents ── */}
      <Group title="Media & documents" count={`${data.media.length} media · ${data.documents.length} docs`} onEdit={() => goStep("media")}>
        <div className="flex flex-wrap gap-2 mb-4">
          {data.media.length === 0 && <span className="text-[12px] text-[var(--text-ghost)] italic">No media uploaded.</span>}
          {data.media.slice(0, 12).map((m, i) => (
            <span key={i} className="h-16 w-16 rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-white flex items-center justify-center">
              {typeof m.url === "string" && /\.(png|jpe?g|webp|gif)$/i.test(m.url)
                ? <img src={IMG.thumb(m.url as string)} alt="" className="h-full w-full object-contain p-0.5" />
                : <span className="text-[9px] text-gray-400 px-1 text-center">{String(m.type)}</span>}
            </span>
          ))}
        </div>
        {data.documents.length > 0 && (
          <div className="space-y-1.5">
            {data.documents.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-[12px]">
                <span className="text-[var(--text-muted)]">{(d.doc_type as string) || "document"}</span>
                <span className="text-[var(--text-primary)] truncate">{(d.title as string) || (d.file_name as string) || "—"}</span>
              </div>
            ))}
          </div>
        )}
      </Group>

      {/* ── Knowledge, languages & relationships ── */}
      <Group title="Knowledge & relationships" count={`${data.related.length} linked`} onEdit={() => goStep("knowledge")}>
        <div className={grid}>
          <Field label="Knowledge blocks" value={((s("schema_knowledge") as unknown[]) ?? []).length || null} />
          <Field label="Translations" value={data.translations.length || null} />
        </div>
        {data.related.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] space-y-1.5">
            {data.related.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-[12px]">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)]">{(r.relation_type as string) || "related"}</span>
                {r.product?.slug
                  ? <Link href={`/product-data/${r.product.slug}`} className="text-[var(--text-primary)] hover:underline truncate">{r.product.name}</Link>
                  : <span className="text-[var(--text-dim)] truncate">{r.product?.name ?? "—"}</span>}
              </div>
            ))}
          </div>
        )}
      </Group>

      {/* ── Record meta ── */}
      <Group title="Record">
        <div className={grid}>
          <Field label="Product id" value={s("id")} mono />
          <Field label="Created" value={s("created_at")} />
          <Field label="Last updated" value={s("updated_at")} />
          <Field label="Schema version" value={s("schema_version")} />
        </div>
      </Group>
    </div>
  );
}
