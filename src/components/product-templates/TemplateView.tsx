"use client";

/* ---------------------------------------------------------------------------
   TemplateView — read-mode renderer for a product's template values.

   Phase 2.1: the renderer now owns the hero. It reads:
     · template structure (sections + fields)
     · saved field values
     · product_media (via /api/products/[id]/media) — hero + gallery
     · the `highlights` feature_cards field, with a fallback to the
       legacy products.highlights[] column for products that haven't
       been migrated yet
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import type {
  TemplateTree,
  ProductTemplateField,
  FieldValueMap,
} from "@/lib/product-templates/types";
import { getFieldOptions, getRepeaterSchema } from "@/lib/product-templates/types";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation } from "@/lib/i18n";
import { PRODUCTS_UI_I18N } from "@/lib/products-ui-i18n";

interface ProductHeader {
  id: string;
  product_name: string;
  slug: string;
  brand: string | null;
  excerpt: string | null;
  description: string | null;
  highlights: string[] | null;
  country_of_origin: string | null;
  warranty: string | null;
  status: string | null;
}

interface MediaRow {
  id: string;
  url: string;
  alt_text: string | null;
  order: number;
  role: "hero" | "gallery" | "detail" | "video" | "document";
  type: string;
  model_id: string | null;
}
interface MediaBundle {
  hero: MediaRow | null;
  gallery: MediaRow[];
  detail: MediaRow[];
  video: MediaRow[];
  document: MediaRow[];
}

interface HighlightCard {
  title?: string;
  blurb?: string;
  icon?: string;
}

interface Props {
  productSlug: string;
}

export default function TemplateView({ productSlug }: Props) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  const [product, setProduct] = useState<ProductHeader | null>(null);
  const [tree, setTree] = useState<TemplateTree | null>(null);
  const [values, setValues] = useState<FieldValueMap>({});
  const [media, setMedia] = useState<MediaBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /* When the load aborts on timeout we surface a localized message rather
     than a raw humanizeError string; tracked separately so the render can
     translate it (the effect can't call t() without re-running on lang). */
  const [timedOut, setTimedOut] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTimedOut(false);
    /* Abort the whole load if the network stalls — prevents an eternal
       spinner. 10s budget across all product fetches. */
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 10_000);
    (async () => {
      try {
        /* 1. Resolve product by slug. */
        const prodRes = await fetch(
          `/api/products/by-slug/${encodeURIComponent(productSlug)}`,
          { credentials: "include", signal: ctrl.signal },
        );
        if (!prodRes.ok) throw new Error(`Product fetch: HTTP ${prodRes.status}`);
        const prodJson = (await prodRes.json()) as {
          product: ProductHeader;
          templateSlug: string | null;
        };
        if (cancelled) return;
        setProduct(prodJson.product);

        /* 2. Fetch template + values + media in parallel. Media is
           independent of the template — fetch even when the product
           has no template assigned. */
        const slug = prodJson.templateSlug;
        const productId = prodJson.product.id;
        const [treeRes, valuesRes, mediaRes] = await Promise.all([
          slug
            ? fetch(`/api/product-templates/${encodeURIComponent(slug)}`, {
                credentials: "include",
                signal: ctrl.signal,
              })
            : Promise.resolve(null),
          slug
            ? fetch(
                `/api/product-templates/${encodeURIComponent(slug)}/values/${encodeURIComponent(productId)}`,
                { credentials: "include", signal: ctrl.signal },
              )
            : Promise.resolve(null),
          fetch(`/api/products/${encodeURIComponent(productId)}/media`, {
            credentials: "include",
          }),
        ]);

        if (mediaRes && mediaRes.ok) {
          const mediaJson = (await mediaRes.json()) as MediaBundle;
          if (!cancelled) setMedia(mediaJson);
        }

        if (slug && treeRes && treeRes.ok) {
          const treeJson = (await treeRes.json()) as TemplateTree;
          if (!cancelled) setTree(treeJson);
        }
        if (slug && valuesRes && valuesRes.ok) {
          const valuesJson = (await valuesRes.json()) as { values: FieldValueMap };
          if (!cancelled) setValues(valuesJson.values ?? {});
        }
      } catch (e) {
        if (!cancelled) {
          const aborted = e instanceof DOMException && e.name === "AbortError";
          if (aborted) {
            setTimedOut(true);
            setError(null);
          } else {
            setTimedOut(false);
            setError(humanizeError(e));
          }
        }
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      ctrl.abort();
    };
  }, [productSlug, retryKey]);

  if (loading) {
    return (
      <div className="text-[12.5px] text-black/50 dark:text-white/50">
        {t("view.loadingProduct", "Loading product…")}
      </div>
    );
  }
  if (error || timedOut) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3 text-[12px] text-red-600 dark:text-red-300">
        <span>
          {timedOut
            ? t("state.serverTimeout", "The server took too long to respond. Please retry.")
            : error}
        </span>
        <button
          type="button"
          onClick={() => setRetryKey((k) => k + 1)}
          className="shrink-0 rounded-md border border-red-500/40 px-2.5 py-1 text-[11.5px] font-medium transition-colors hover:bg-red-500/15"
        >
          {t("action.retry", "Retry")}
        </button>
      </div>
    );
  }
  if (!product) return null;

  /* Highlights: prefer the template-engine field; fall back to the
     legacy products.highlights[] for products not yet migrated. */
  const highlightsField = pickHighlightsValue(values);
  const legacyHighlights: HighlightCard[] = (product.highlights ?? []).map((t) => ({
    title: t,
  }));
  const highlights = highlightsField.length > 0 ? highlightsField : legacyHighlights;

  return (
    <div className="space-y-6">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <header className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-6 items-start">
        <div className="space-y-3">
          {product.brand && (
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/45 dark:text-white/40">
              {product.brand}
            </div>
          )}
          <h1 className="text-[28px] sm:text-[34px] font-semibold tracking-tight text-black dark:text-white leading-[1.1]">
            {product.product_name}
          </h1>
          {(asString(values["short_description"]) || product.excerpt) && (
            <p className="text-[14.5px] text-black/65 dark:text-white/65 max-w-2xl leading-relaxed">
              {asString(values["short_description"]) || product.excerpt}
            </p>
          )}
          {highlights.length > 0 && (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              {highlights.map((h, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-black/[0.05] dark:bg-white/[0.08] text-[11px] font-bold text-black/60 dark:text-white/60">
                    ✓
                  </span>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold text-black dark:text-white truncate">
                      {h.title ?? "—"}
                    </div>
                    {h.blurb && (
                      <div className="mt-0.5 text-[11px] text-black/55 dark:text-white/50 line-clamp-2">
                        {h.blurb}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Hero image */}
        {media?.hero && (
          <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-2 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={media.hero.url}
              alt={media.hero.alt_text ?? product.product_name}
              className="w-full h-auto rounded-xl object-contain max-h-[320px]"
            />
          </div>
        )}
      </header>

      {/* ── Gallery strip ───────────────────────────────────────── */}
      {media && media.gallery.length > 0 && (
        <section className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4 sm:p-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-black dark:text-white mb-3">
            {t("view.gallery", "Gallery")}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {media.gallery.map((m) => (
              <div
                key={m.id}
                className="aspect-square rounded-lg border border-black/[0.06] dark:border-white/[0.06] overflow-hidden bg-black/[0.02] dark:bg-white/[0.03]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.url}
                  alt={m.alt_text ?? ""}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Long description ─────────────────────────────────────── */}
      {(asString(values["long_description"]) || product.description) && (
        <section className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4 sm:p-5">
          <p className="text-[13.5px] leading-relaxed text-black/75 dark:text-white/75 whitespace-pre-wrap">
            {asString(values["long_description"]) || product.description}
          </p>
        </section>
      )}

      {/* ── Section cards. Skip Basic Information (already in hero) and
            Features & Highlights (already rendered above the fold). */}
      {tree?.sections
        .filter(
          (s) =>
            s.slug !== "basic-information" &&
            s.slug !== "features-highlights",
        )
        .map((section) => {
          const visibleFields = section.fields.filter((f) => !isEmpty(values[f.field_key]));
          if (visibleFields.length === 0) return null;
          return (
            <section
              key={section.id}
              className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4 sm:p-5"
            >
              <header className="mb-4">
                <h2 className="text-[15px] font-semibold tracking-tight text-black dark:text-white">
                  {section.title}
                </h2>
                {section.description && (
                  <p className="mt-0.5 text-[11.5px] text-black/50 dark:text-white/45">
                    {section.description}
                  </p>
                )}
              </header>
              <SpecBlock fields={visibleFields} values={values} />
            </section>
          );
        })}

      {/* ── Detail images at the bottom ─────────────────────────── */}
      {media && media.detail.length > 0 && (
        <section className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4 sm:p-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-black dark:text-white mb-3">
            {t("view.detailViews", "Detail views")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {media.detail.map((m) => (
              <div
                key={m.id}
                className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] overflow-hidden bg-black/[0.02] dark:bg-white/[0.03]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.url}
                  alt={m.alt_text ?? ""}
                  className="w-full h-auto"
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function pickHighlightsValue(values: FieldValueMap): HighlightCard[] {
  const v = values["highlights"];
  if (!Array.isArray(v)) return [];
  return (v as Array<Record<string, unknown>>)
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      title: typeof row.title === "string" ? row.title : undefined,
      blurb: typeof row.blurb === "string" ? row.blurb : undefined,
      icon: typeof row.icon === "string" ? row.icon : undefined,
    }))
    .filter((c) => !!c.title);
}

function SpecBlock({
  fields,
  values,
}: {
  fields: ProductTemplateField[];
  values: FieldValueMap;
}) {
  const scalar: ProductTemplateField[] = [];
  const wide: ProductTemplateField[] = [];
  for (const f of fields) {
    if (
      f.field_type === "repeater" ||
      f.field_type === "feature_cards" ||
      f.field_type === "multi_select" ||
      f.field_type === "rich_text"
    ) {
      wide.push(f);
    } else {
      scalar.push(f);
    }
  }

  return (
    <div className="space-y-4">
      {scalar.length > 0 && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {scalar.map((f) => (
            <div
              key={f.id}
              className="flex items-start justify-between gap-3 border-b border-black/[0.04] dark:border-white/[0.04] pb-2"
            >
              <dt className="text-[12px] text-black/55 dark:text-white/50 shrink-0">
                {f.field_label}
              </dt>
              <dd className="text-[12.5px] font-semibold text-black dark:text-white text-right">
                {formatScalar(f, values[f.field_key])}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {wide.map((f) => (
        <div key={f.id}>
          <div className="text-[12px] text-black/55 dark:text-white/50 mb-1.5">
            {f.field_label}
          </div>
          {renderWide(f, values[f.field_key])}
        </div>
      ))}
    </div>
  );
}

function formatScalar(field: ProductTemplateField, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (field.field_type === "boolean") return v ? "Yes" : "No";
  if (
    field.field_type === "select" ||
    field.field_type === "icon_select" ||
    field.field_type === "image_select" ||
    field.field_type === "color_select"
  ) {
    const opts = getFieldOptions(field);
    const match = opts.find((o) => o.value === v);
    return match ? match.label : String(v);
  }
  if (field.field_type === "number" || field.field_type === "measurement") {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return String(v);
    return field.unit ? `${formatNumber(n)} ${field.unit}` : formatNumber(n);
  }
  return String(v);
}

function formatNumber(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function renderWide(field: ProductTemplateField, v: unknown): React.ReactNode {
  if (field.field_type === "rich_text") {
    return (
      <p className="text-[13px] leading-relaxed text-black/80 dark:text-white/80 whitespace-pre-wrap">
        {String(v ?? "")}
      </p>
    );
  }
  if (field.field_type === "multi_select" && Array.isArray(v)) {
    const opts = getFieldOptions(field);
    const labelOf = (val: string) => opts.find((o) => o.value === val)?.label ?? val;
    return (
      <div className="flex flex-wrap gap-1.5">
        {(v as string[]).map((val) => (
          <span
            key={val}
            className="text-[11.5px] font-medium px-2.5 py-1 rounded-full bg-black/[0.05] dark:bg-white/[0.06] text-black/75 dark:text-white/75"
          >
            {labelOf(val)}
          </span>
        ))}
      </div>
    );
  }
  if (
    (field.field_type === "repeater" || field.field_type === "feature_cards") &&
    Array.isArray(v)
  ) {
    const schema = getRepeaterSchema(field);
    const rows = v as Array<Record<string, unknown>>;
    if (schema.length === 0 || rows.length === 0) return <Dash />;
    return (
      <div className="rounded-lg border border-black/[0.08] dark:border-white/[0.08] overflow-hidden">
        <table className="w-full text-[12px]">
          <thead className="bg-black/[0.03] dark:bg-white/[0.04]">
            <tr>
              {schema.map((c) => (
                <th
                  key={c.key}
                  className="px-3 py-2 text-left font-semibold text-black/60 dark:text-white/55"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-t border-black/[0.04] dark:border-white/[0.04]"
              >
                {schema.map((c) => (
                  <td
                    key={c.key}
                    className="px-3 py-2 text-black/80 dark:text-white/80"
                  >
                    {formatCell(row[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return <Dash />;
}

function Dash() {
  return <span className="text-black/30 dark:text-white/30">—</span>;
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}
