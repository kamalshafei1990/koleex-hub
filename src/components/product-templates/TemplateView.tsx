"use client";

/* ---------------------------------------------------------------------------
   TemplateView — read-mode renderer for a product's template values.

   Phase 2 validator. Reads:
     · the template structure (sections + fields)
     · the saved values for one product
     · the product row itself (for hero / highlights / brand)

   Renders a visual-first product page:
     · Hero block (product name + short description + highlight pills)
     · Section cards with sensible value formatting per field_type
     · Long description prose
     · Accessory repeater rendered as a table

   Complementary to TemplateForm — same data, different surface.
   No editing. No state. Pure read.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import type {
  TemplateTree,
  ProductTemplateField,
  FieldValueMap,
} from "@/lib/product-templates/types";
import { getFieldOptions, getRepeaterSchema } from "@/lib/product-templates/types";

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

interface Props {
  productSlug: string;
}

export default function TemplateView({ productSlug }: Props) {
  const [product, setProduct] = useState<ProductHeader | null>(null);
  const [tree, setTree] = useState<TemplateTree | null>(null);
  const [values, setValues] = useState<FieldValueMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        /* 1. Resolve product by slug (cheap public route). */
        const prodRes = await fetch(
          `/api/products/by-slug/${encodeURIComponent(productSlug)}`,
          { credentials: "include" },
        );
        if (!prodRes.ok) throw new Error(`Product fetch: HTTP ${prodRes.status}`);
        const prodJson = (await prodRes.json()) as {
          product: ProductHeader;
          templateSlug: string | null;
        };
        if (cancelled) return;
        setProduct(prodJson.product);

        if (!prodJson.templateSlug) {
          setLoading(false);
          return; // product without template — header-only
        }

        /* 2. Fetch template structure + values in parallel. */
        const [treeRes, valuesRes] = await Promise.all([
          fetch(
            `/api/product-templates/${encodeURIComponent(prodJson.templateSlug)}`,
            { credentials: "include" },
          ),
          fetch(
            `/api/product-templates/${encodeURIComponent(prodJson.templateSlug)}/values/${encodeURIComponent(prodJson.product.id)}`,
            { credentials: "include" },
          ),
        ]);
        if (!treeRes.ok) throw new Error(`Template fetch: HTTP ${treeRes.status}`);
        if (!valuesRes.ok) throw new Error(`Values fetch: HTTP ${valuesRes.status}`);

        const treeJson = (await treeRes.json()) as TemplateTree;
        const valuesJson = (await valuesRes.json()) as { values: FieldValueMap };
        if (cancelled) return;
        setTree(treeJson);
        setValues(valuesJson.values ?? {});
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productSlug]);

  if (loading) {
    return (
      <div className="text-[12.5px] text-black/50 dark:text-white/50">
        Loading product…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-600 dark:text-red-300">
        {error}
      </div>
    );
  }
  if (!product) return null;

  return (
    <div className="space-y-6">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <header className="space-y-3">
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
        {product.highlights && product.highlights.length > 0 && (
          <ul className="flex flex-wrap gap-2 pt-1">
            {product.highlights.map((h, i) => (
              <li
                key={i}
                className="text-[11.5px] font-medium px-2.5 py-1 rounded-full bg-black/[0.05] dark:bg-white/[0.06] text-black/70 dark:text-white/70"
              >
                {h}
              </li>
            ))}
          </ul>
        )}
      </header>

      {/* ── Long description ─────────────────────────────────────── */}
      {(asString(values["long_description"]) || product.description) && (
        <section className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4 sm:p-5">
          <p className="text-[13.5px] leading-relaxed text-black/75 dark:text-white/75 whitespace-pre-wrap">
            {asString(values["long_description"]) || product.description}
          </p>
        </section>
      )}

      {/* ── Section cards (everything except descriptions which we showed above) */}
      {tree?.sections
        .filter(
          (s) =>
            s.slug !== "basic-information" || /* basic = hero already */
            s.fields.some(
              (f) =>
                f.field_key !== "short_description" &&
                f.field_key !== "long_description",
            ),
        )
        .map((section) => {
          const visibleFields = section.fields.filter((f) => {
            if (
              section.slug === "basic-information" &&
              (f.field_key === "short_description" || f.field_key === "long_description")
            ) {
              return false;
            }
            const v = values[f.field_key];
            return !isEmpty(v);
          });
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

function SpecBlock({
  fields,
  values,
}: {
  fields: ProductTemplateField[];
  values: FieldValueMap;
}) {
  /* Group fields so repeaters / feature_cards / multi_selects get their
     own row, while simple scalar fields land in a 2-column grid. */
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
            <div key={f.id} className="flex items-start justify-between gap-3 border-b border-black/[0.04] dark:border-white/[0.04] pb-2">
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
  return n.toLocaleString(undefined, {
    maximumFractionDigits: 3,
  });
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
    const labelOf = (val: string) =>
      opts.find((o) => o.value === val)?.label ?? val;
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
