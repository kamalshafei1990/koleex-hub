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
import FolderTreeIcon from "@/components/icons/ui/FolderTreeIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import Settings2Icon from "@/components/icons/ui/Settings2Icon";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
import DollarSignIcon from "@/components/icons/ui/DollarSignIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import BookOpenIcon from "@/components/icons/ui/BookOpenIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import TabStrip from "@/components/ui/TabStrip";

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

/* The editor's Section card, field-for-field: icon in a rounded square,
   title, optional badge, collapse chevron. */
function Group({
  icon, title, count, onEdit, children,
}: { icon?: React.ReactNode; title: string; count?: string; onEdit?: () => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="kx-tab-in scroll-mt-24 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden transition-shadow hover:shadow-[0_2px_12px_rgba(0,0,0,0.15)]">
      <div className="w-full flex items-center gap-3 px-6 py-4">
        <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
          {icon}
        </div>
        <h2 className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight flex-1 text-left truncate">{title}</h2>
        {count && (
          <span className="text-[10px] font-medium text-[var(--text-ghost)] bg-[var(--bg-surface)] px-2 py-0.5 rounded-full shrink-0">{count}</span>
        )}
        {onEdit && (
          <button type="button" onClick={onEdit} className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <PencilIcon className="h-3 w-3" /> Edit
          </button>
        )}
        <button type="button" onClick={() => setOpen(!open)} className="shrink-0 text-[var(--text-ghost)] hover:text-[var(--text-primary)] transition-colors" aria-label={open ? "Collapse" : "Expand"}>
          <AngleDownIcon className={`h-4 w-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && <div className="px-6 pb-6 pt-2 border-t border-[var(--border-subtle)]">{children}</div>}
    </section>
  );
}

/* ── Steps ────────────────────────────────────────────────────────────────
   The SAME eleven sections the editor shows, in the same order, under the
   same labels. The record and the editor are two views of one thing, so the
   navigation must not differ between them. */
const STEPS = [
  { id: "classify",   short: "Classify" },
  { id: "supplier",   short: "Supplier" },
  { id: "identity",   short: "Hero" },
  { id: "specs",      short: "Specs" },
  { id: "commercial", short: "Variants" },
  { id: "pricing",    short: "Price" },
  { id: "logistics",  short: "Logistics" },
  { id: "compliance", short: "Compliance" },
  { id: "media",      short: "Media & Files" },
  { id: "knowledge",  short: "Knowledge" },
  { id: "finalize",   short: "Review" },
] as const;

/* The editor's own sticky tab bar, via the same canonical TabStrip — not a
   lookalike, the same component. */
function ProfileTabs({ current, onPick }: { current: number; onPick: (i: number) => void }) {
  return (
    <nav className="sticky top-0 z-20 mb-6 py-2 bg-[var(--bg-primary)]/90 backdrop-blur-md">
      <TabStrip
        ariaLabel="Product sections"
        items={STEPS.map((st, i) => ({
          key: st.id,
          label: st.short,
          active: i === current,
          onClick: () => onPick(i),
        }))}
      />
    </nav>
  );
}

const grid = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-4";

export default function ProductProfile() {
  const params = useParams<{ id: string }>();
  const handle = params?.id;
  const router = useRouter();
  const { t } = useTranslation(PRODUCTS_UI_I18N);

  const [data, setData] = useState<Profile | null>(null);
  const [step, setStep] = useState(0);
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

  const s2 = (k: string) => p[k];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="w-full px-4 md:px-8 lg:px-12 xl:px-16 py-6 md:py-8 space-y-4">
      {/* ── Header — the editor's own: back square, title + status, subtitle,
             actions on the right. Same sizes, same spacing. ── */}
      <div className="flex items-center justify-between mb-6 md:mb-8 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/product-data"
            aria-label="Back to Product Data"
            className="h-10 w-10 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all shrink-0"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-[26px] font-bold text-[var(--text-primary)] truncate">
                {(s2("product_name") as string) || "Untitled product"}
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {(s2("status") as string) || "draft"}
              </span>
              {s2("visible") !== true && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-[var(--bg-surface)] text-[10px] font-medium text-[var(--text-ghost)]">Hidden</span>
              )}
              {readiness != null && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
                  <span className="inline-block h-1 w-16 rounded-full bg-[var(--bg-surface)] overflow-hidden align-middle">
                    <span className={`block h-full rounded-full ${readiness >= 80 ? "bg-emerald-500" : readiness >= 50 ? "bg-amber-500" : "bg-rose-500/80"}`} style={{ width: `${Math.max(2, readiness)}%` }} />
                  </span>
                  {readiness}%
                </span>
              )}
            </div>
            <p className="text-[12px] md:text-[13px] text-[var(--text-dim)] mt-0.5 truncate">
              {(data.models[0]?.primary_model as string) || "no code"}
              {" · "}{(s2("category_slug") as string) || "—"}
              {data.subcategory ? ` · ${data.subcategory.name}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {s2("slug") ? (
            <Link
              href={`/products/${s2("slug") as string}`}
              title="Open the customer-facing page"
              className="hidden sm:inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all"
            >
              <ExternalLinkIcon className="h-4 w-4" /> Public page
            </Link>
          ) : null}
          <Link
            href={editHref}
            className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shrink-0"
          >
            <PencilIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{t("action.edit", "Edit")}</span>
          </Link>
        </div>
      </div>

      <ProfileTabs current={step} onPick={setStep} />

      {/* ── Step panels — one at a time, exactly like the editor ── */}
      {STEPS[step].id === "classify" && (
      <Group icon={<FolderTreeIcon className="h-4 w-4" />} title="Classification" onEdit={() => goStep("classify")}>
        <div className={grid}>
          <Field label="Division" value={s2("division_slug")} />
          <Field label="Category" value={s2("category_slug")} />
          <Field label="Subcategory" value={data.subcategory?.name ?? s2("subcategory_slug")} />
          <Field label="Subcategory code" value={data.subcategory?.code} mono />
          <Field label="Family" value={s2("family")} />
          <Field label="Level" value={s2("level")} />
          <Field label="Spec template" value={data.schema ? `${data.schema.name} v${data.schema.version}` : null} />
        </div>
      </Group>
      )}

      {STEPS[step].id === "supplier" && (
      <Group icon={<FactoryIcon className="h-4 w-4" />} title="Supplier & Sourcing" count={`${data.suppliers.length}`} onEdit={() => goStep("supplier")}>
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
      )}

      {STEPS[step].id === "identity" && (
      <div className="space-y-4">
        <Group icon={<SparklesIcon className="h-4 w-4" />} title="Identity & lifecycle" onEdit={() => goStep("identity")}>
          <div className={grid}>
            <Field label="Product name" value={s2("product_name")} />
            <Field label="Public URL" value={s2("slug")} mono />
            <Field label="Brand" value={s2("brand")} />
            <Field label="Manufacturer" value={s2("manufacturer")} />
            <Field label="MPN" value={s2("mpn")} mono />
            <Field label="GTIN" value={s2("gtin")} mono />
            <Field label="Internal SKU" value={s2("internal_sku")} mono />
            <Field label="Legacy code" value={s2("legacy_code")} mono />
            <Field label="Generation" value={s2("generation")} />
            <Field label="Model year" value={s2("model_year")} />
            <Field label="Launch date" value={s2("launch_date")} />
            <Field label="End of life" value={s2("eol_date")} />
            <Field label="Available from" value={s2("available_from")} />
            <Field label="Last order date" value={s2("last_order_date")} />
            <Field label="Alternate names" value={s2("alternate_names")} />
            <Field label="Status reason" value={s2("status_reason")} />
            <Field label="Featured" value={s2("featured")} />
            <Field label="Visible to customers" value={s2("visible")} />
          </div>
        </Group>
        <Group icon={<SparklesIcon className="h-4 w-4" />} title="Description" onEdit={() => goStep("identity")}>
          <div className="space-y-4">
            <Field label="Short description (excerpt)" value={s2("excerpt")} />
            <Field label="Full description" value={s2("description")} />
            <Field label="Highlights" value={s2("highlights")} />
            <Field label="Tags" value={s2("tags")} />
          </div>
        </Group>
        <Group icon={<SparklesIcon className="h-4 w-4" />} title="Languages & markets" count={`${data.translations.length}`} onEdit={() => goStep("identity")}>
          {data.translations.length === 0
            ? <p className="text-[12px] text-[var(--text-ghost)] italic">English only — no localized names recorded.</p>
            : <div className={grid}>{data.translations.map((tr, i) => <Field key={i} label={String(tr.locale ?? "?")} value={tr.product_name} />)}</div>}
        </Group>
      </div>
      )}

      {STEPS[step].id === "specs" && (
      <Group icon={<Settings2Icon className="h-4 w-4" />} title="Specifications" count={data.schema ? undefined : "no template"} onEdit={() => goStep("specs")}>
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
                      value={(s2("schema_specs") as Record<string, unknown> | null)?.[f.key]}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Group>
      )}

      {STEPS[step].id === "commercial" && (
      <Group icon={<BoxesIcon className="h-4 w-4" />} title="Variants" count={`${data.models.length}`} onEdit={() => goStep("commercial")}>
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
                  <Field label="Variant name" value={m.model_name} />
                  <Field label="KOLEEX code" value={m.primary_model} mono />
                  <Field label="Supplier reference" value={m.reference_model} mono />
                  <Field label="Tagline" value={m.tagline} />
                  <Field label="Stock status" value={m.stock_status} />
                  <Field label="Barcode" value={m.barcode} mono />
                  <Field label="Visible" value={m.visible} />
                  <Field label="Status" value={m.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Group>
      )}

      {STEPS[step].id === "pricing" && (
      <Group icon={<DollarSignIcon className="h-4 w-4" />} title="Cost & Price" count={`${data.models.length} variant`} onEdit={() => goStep("pricing")}>
        {data.models.length === 0 ? (
          <p className="text-[12px] text-[var(--text-ghost)] italic">No variant to price.</p>
        ) : (
          <div className="space-y-3">
            {data.models.map((m, i) => (
              <div key={i} className="rounded-xl border border-[var(--border-subtle)] p-3">
                <div className="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
                  {(m.model_name as string) || "Untitled variant"}
                </div>
                <div className={grid}>
                  <Field label="Pricing mode" value={m.pricing_mode ?? "fixed"} />
                  <Field label="Price note" value={m.price_note} />
                  {data.costVisible && <Field label="Cost price (CNY)" value={m.cost_price} />}
                  <Field label="Global price (USD)" value={m.global_price} />
                  {data.costVisible && <Field label="Head-only price" value={m.head_only_price} />}
                  {data.costVisible && <Field label="Complete-set price" value={m.complete_set_price} />}
                  <Field label="MOQ" value={m.moq} />
                  <Field label="Lead time" value={m.lead_time} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Group>
      )}

      {STEPS[step].id === "logistics" && (
      <Group icon={<GlobeIcon className="h-4 w-4" />} title="Logistics & Customs" onEdit={() => goStep("logistics")}>
        <div className={grid}>
          <Field label="Country of origin" value={s2("country_of_origin")} />
          <Field label="HS code" value={s2("hs_code")} mono />
          <Field label="MOQ" value={s2("moq")} />
          <Field label="Lead time" value={s2("lead_time")} />
          <Field label="Machine weight (kg)" value={s2("machine_weight_kg")} />
          <Field label="Machine dimensions" value={s2("machine_dimensions")} />
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
      )}

      {STEPS[step].id === "compliance" && (
      <Group icon={<ShieldCheckIcon className="h-4 w-4" />} title="Compliance & Warranty" count={`${data.certifications.length} cert`} onEdit={() => goStep("compliance")}>
        <div className={grid}>
          <Field label="Warranty (months)" value={s2("warranty_months")} />
          <Field label="Warranty type" value={s2("warranty_type")} />
          <Field label="Starts from" value={s2("warranty_start_from")} />
          <Field label="Coverage" value={s2("warranty_coverage")} />
          <Field label="Exclusions" value={s2("warranty_exclusions")} />
          <Field label="CE certified" value={s2("ce_certified")} />
          <Field label="RoHS compliant" value={s2("rohs_compliant")} />
          <Field label="Spare parts availability" value={s2("spare_parts_availability")} />
          <Field label="Service life" value={s2("service_life")} />
          <Field label="Maintenance interval" value={s2("maintenance_interval")} />
          <Field label="Technical support" value={s2("technical_support")} />
          <Field label="Support channels" value={s2("support_channels")} />
          <Field label="Training available" value={s2("training_available")} />
          <Field label="Installation service" value={s2("installation_service")} />
          <Field label="Returns policy" value={s2("returns_policy")} />
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
      )}

      {STEPS[step].id === "media" && (
      <Group icon={<ImageRawIcon className="h-4 w-4" />} title="Media & Documents" count={`${data.media.length} media · ${data.documents.length} docs`} onEdit={() => goStep("media")}>
        <div className="flex flex-wrap gap-2 mb-4">
          {data.media.length === 0 && <span className="text-[12px] text-[var(--text-ghost)] italic">No media uploaded.</span>}
          {data.media.slice(0, 24).map((m, i) => (
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
      )}

      {STEPS[step].id === "knowledge" && (
      <Group icon={<BookOpenIcon className="h-4 w-4" />} title="Knowledge & Relationships" count={`${data.related.length} linked`} onEdit={() => goStep("knowledge")}>
        <div className={grid}>
          <Field label="Knowledge blocks" value={((s2("schema_knowledge") as unknown[]) ?? []).length || null} />
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
      )}

      {STEPS[step].id === "finalize" && (
      <div className="space-y-4">
        <Group icon={<CheckIcon className="h-4 w-4" />} title="Readiness">
          {readiness == null ? (
            <p className="text-[12px] text-[var(--text-ghost)] italic">No spec template resolves, so completeness can&apos;t be scored.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="inline-block h-1.5 flex-1 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                  <span className={`block h-full rounded-full ${readiness >= 80 ? "bg-emerald-500" : readiness >= 50 ? "bg-amber-500" : "bg-rose-500/80"}`} style={{ width: `${Math.max(2, readiness)}%` }} />
                </span>
                <span className="text-[13px] font-bold tabular-nums text-[var(--text-primary)]">{readiness}%</span>
              </div>
              {data.readiness?.dimensions && (
                <div className={grid}>
                  {data.readiness.dimensions.map((d) => <Field key={d.key} label={d.label} value={`${d.score}%`} />)}
                </div>
              )}
            </div>
          )}
        </Group>
        <Group icon={<CheckIcon className="h-4 w-4" />} title="Record">
          <div className={grid}>
            <Field label="Product id" value={s2("id")} mono />
            <Field label="Created" value={s2("created_at")} />
            <Field label="Last updated" value={s2("updated_at")} />
            <Field label="Schema version" value={s2("schema_version")} />
          </div>
        </Group>
      </div>
      )}
      </div>
    </div>
  );
}
