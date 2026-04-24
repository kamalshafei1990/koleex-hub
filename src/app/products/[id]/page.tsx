"use client";

/**
 * Premium Product View Page (read-only)
 * ------------------------------------------------------------------
 * Route:  /products/[id]         — id may be either a slug OR a UUID
 * Goal:   a customer-ready, Apple/Sony-style product detail page
 *         that renders the exact same data the admin entered, pulled
 *         directly from Supabase (no duplication).
 *
 * Sections (in order):
 *   1. Hero               (name, tagline, main image, key meta, CTAs)
 *   2. Image gallery      (carousel of media + main image)
 *   3. Key features       (tags + headline specs)
 *   4. Technical specs    (grouped: Performance, Mechanical, Electrical, Physical)
 *   5. Sewing details     (common_specs + template_specs when applicable)
 *   6. Models & Variants
 *   7. Applications       (from tags + family)
 *   8. Downloads / Media
 *   9. Related products
 */

import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import DownloadIcon from "@/components/icons/ui/DownloadIcon";
import PlayIcon from "@/components/icons/ui/PlayIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import ZapIcon from "@/components/icons/ui/ZapIcon";
import RulerIcon from "@/components/icons/ui/RulerIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import FactoryIcon from "@/components/icons/ui/FactoryIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import GaugeIcon from "@/components/icons/ui/GaugeIcon";
import CpuIcon from "@/components/icons/ui/CpuIcon";
import DropletsIcon from "@/components/icons/ui/DropletsIcon";
import TargetIcon from "@/components/icons/ui/TargetIcon";
import Volume2Icon from "@/components/icons/ui/Volume2Icon";
import WrenchIcon from "@/components/icons/ui/WrenchIcon";
import ActivityIcon from "@/components/icons/ui/ActivityIcon";
import AwardIcon from "@/components/icons/ui/AwardIcon";
import ScissorsIcon from "@/components/icons/ui/ScissorsIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";

import {
  fetchProductByIdOrSlug,
  fetchModelsByProductId,
  fetchMediaByProductId,
  fetchSewingSpecsByProductId,
  fetchRelatedProducts,
  fetchDivisions,
  fetchCategories,
  fetchSubcategories,
} from "@/lib/products-admin";
import type {
  ProductRow, ProductModelRow, ProductMediaRow, SewingMachineSpecsRow,
  DivisionRow, CategoryRow, SubcategoryRow,
} from "@/types/supabase";
import {
  COMMON_SEWING_FIELDS,
  SEWING_MACHINE_TEMPLATES,
  groupFields,
  type TemplateField,
} from "@/lib/sewing-machine-templates";

/* ---------------- helpers ---------------- */

function formatFieldValue(field: TemplateField, raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (field.type === "boolean") return raw ? "Yes" : "No";
  if (field.type === "multi-select" && Array.isArray(raw)) return raw.join(", ");
  if (field.type === "select" && field.options) {
    const opt = field.options.find(o => o.value === raw);
    return opt ? opt.label : String(raw);
  }
  const str = String(raw);
  return field.unit ? `${str} ${field.unit}` : str;
}

function fmtMoney(amount: number | null, currency = "USD"): string {
  if (amount === null || amount === undefined) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

type KeyFeature = {
  icon: React.ReactNode;
  title: string;
  value?: string;
  description: string;
};

/**
 * Pull 4-6 marketing-worthy features out of the common specs + product row.
 * Chooses whichever real data is present so the section is always meaningful.
 */
function deriveKeyFeatures(
  product: ProductRow,
  sewingSpecs: SewingMachineSpecsRow | null,
): KeyFeature[] {
  const cs = (sewingSpecs?.common_specs || {}) as Record<string, unknown>;
  const features: KeyFeature[] = [];

  // 1. Max sewing speed
  if (cs.max_sewing_speed) {
    features.push({
      icon: <GaugeIcon className="h-5 w-5" />,
      title: "High Speed",
      value: `${cs.max_sewing_speed} spm`,
      description: "Built for high-volume production runs.",
    });
  }

  // 2. Motor type
  const motor = cs.motor_type as string | undefined;
  if (motor) {
    const labels: Record<string, { title: string; desc: string }> = {
      servo: { title: "Direct Drive Servo", desc: "Energy-efficient, instant response." },
      clutch: { title: "Clutch Motor", desc: "Proven industrial reliability." },
      "built-in": { title: "Built-in Motor", desc: "Integrated, vibration-reduced drive." },
      stepper: { title: "Stepper Motor", desc: "Precise incremental positioning." },
    };
    const m = labels[motor] || { title: "Advanced Motor", desc: "Precision drive system." };
    features.push({ icon: <CpuIcon className="h-5 w-5" />, title: m.title, description: m.desc });
  }

  // 3. Lubrication
  const lube = cs.lubrication_system as string | undefined;
  if (lube) {
    const labels: Record<string, { title: string; desc: string }> = {
      automatic: { title: "Auto Lubrication", desc: "Fully sealed, low maintenance." },
      "semi-automatic": { title: "Semi-Auto Lubrication", desc: "Reliable with minimal checks." },
      manual: { title: "Manual Lubrication", desc: "Operator-controlled oiling." },
      "dry-head": { title: "Dry Head", desc: "Oil-free — ideal for clean garments." },
    };
    const l = labels[lube] || { title: "Smart Lubrication", desc: "Engineered for durability." };
    features.push({ icon: <DropletsIcon className="h-5 w-5" />, title: l.title, description: l.desc });
  }

  // 4. Needle system
  if (cs.needle_system) {
    features.push({
      icon: <TargetIcon className="h-5 w-5" />,
      title: "Precision Needle",
      value: String(cs.needle_system),
      description: "Industrial-grade needle system.",
    });
  }

  // 5. Stitch range
  if (cs.stitch_length_max) {
    const min = cs.stitch_length_min ? `${cs.stitch_length_min}–` : "Up to ";
    features.push({
      icon: <RulerIcon className="h-5 w-5" />,
      title: "Wide Stitch Range",
      value: `${min}${cs.stitch_length_max} mm`,
      description: "Versatile across fabric thicknesses.",
    });
  }

  // 6. Presser foot lift
  if (features.length < 6 && cs.presser_foot_lift) {
    features.push({
      icon: <ActivityIcon className="h-5 w-5" />,
      title: "Generous Clearance",
      value: `${cs.presser_foot_lift} mm lift`,
      description: "Handles thick and layered materials.",
    });
  }

  // 7. Noise level (from template_specs if present)
  const ts = (sewingSpecs?.template_specs || {}) as Record<string, unknown>;
  if (features.length < 6 && ts.noise_level) {
    features.push({
      icon: <Volume2Icon className="h-5 w-5" />,
      title: "Low Noise",
      value: `${ts.noise_level} dB`,
      description: "Quieter workstation environment.",
    });
  }

  // Fallbacks — always show at least 4
  if (features.length < 4 && product.warranty) {
    features.push({
      icon: <ShieldCheckIcon className="h-5 w-5" />,
      title: "Manufacturer Warranty",
      value: product.warranty,
      description: "Backed by Koleex support.",
    });
  }
  if (features.length < 4 && product.country_of_origin) {
    features.push({
      icon: <AwardIcon className="h-5 w-5" />,
      title: "Quality Sourcing",
      value: product.country_of_origin,
      description: "Curated manufacturing origin.",
    });
  }
  if (features.length < 4 && (product.voltage?.length || 0) > 0) {
    features.push({
      icon: <ZapIcon className="h-5 w-5" />,
      title: "Global Voltage",
      value: (product.voltage || []).join(" / "),
      description: "Ready for international deployment.",
    });
  }
  if (features.length < 4) {
    features.push({
      icon: <WrenchIcon className="h-5 w-5" />,
      title: "Built to Serve",
      description: "Engineered for industrial sewing lines.",
    });
  }

  return features.slice(0, 6);
}

/**
 * Build 2–4 short bullet highlights for the hero, derived from whichever
 * specs are filled in. Kept as short imperative phrases.
 */
function deriveHeroHighlights(
  product: ProductRow,
  sewingSpecs: SewingMachineSpecsRow | null,
): string[] {
  const cs = (sewingSpecs?.common_specs || {}) as Record<string, unknown>;
  const out: string[] = [];
  if (cs.max_sewing_speed) out.push(`Up to ${cs.max_sewing_speed} stitches per minute`);
  if (cs.motor_type === "servo") out.push("Direct drive servo motor");
  else if (cs.motor_type) out.push(`${String(cs.motor_type).replace(/-/g, " ")} motor`);
  if (cs.lubrication_system === "automatic") out.push("Automatic sealed lubrication");
  else if (cs.lubrication_system === "dry-head") out.push("Dry head — oil-free operation");
  if (cs.stitch_length_max) out.push(`Stitch length up to ${cs.stitch_length_max} mm`);
  if (out.length < 2 && product.warranty) out.push(`${product.warranty} warranty`);
  if (out.length < 2 && product.country_of_origin) out.push(`Manufactured in ${product.country_of_origin}`);
  return out.slice(0, 4);
}

/**
 * Map an application/tag to an icon + category label + short description.
 * Falls back to a generic Layers/garment treatment.
 */
type AppInfo = {
  kind: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  description: string;
};
function describeApplication(tag: string): AppInfo {
  const t = tag.toLowerCase().trim();

  // Fabric types
  if (/denim|jean/.test(t))
    return { kind: "Heavy fabric", icon: LayersIcon, description: "Engineered for dense denim and jeanswear production." };
  if (/leather/.test(t))
    return { kind: "Heavy material", icon: ShieldCheckIcon, description: "Handles thick hides and multi-layer leather work." };
  if (/canvas|tarp/.test(t))
    return { kind: "Heavy fabric", icon: LayersIcon, description: "Ideal for canvas, tarpaulin and technical textiles." };
  if (/knit|jersey/.test(t))
    return { kind: "Stretch fabric", icon: ActivityIcon, description: "Smooth handling of knit and jersey materials." };
  if (/silk|satin|chiffon/.test(t))
    return { kind: "Fine fabric", icon: SparklesIcon, description: "Precision feed for delicate and luxury fabrics." };

  // Garment types
  if (/shirt|blouse/.test(t))
    return { kind: "Garment", icon: ScissorsIcon, description: "Clean seams for shirting and light tailoring." };
  if (/trouser|pant|jean/.test(t))
    return { kind: "Garment", icon: ScissorsIcon, description: "Production-grade stitching for bottoms and jeans." };
  if (/jacket|coat|outerwear/.test(t))
    return { kind: "Outerwear", icon: ShieldCheckIcon, description: "Reliable seams across heavy-layered garments." };
  if (/dress|skirt/.test(t))
    return { kind: "Garment", icon: SparklesIcon, description: "Elegant finish for dresses, skirts and womenswear." };
  if (/underwear|lingerie|intimate/.test(t))
    return { kind: "Intimates", icon: SparklesIcon, description: "Gentle feed for fine intimate apparel." };
  if (/sport|active|athletic/.test(t))
    return { kind: "Activewear", icon: ActivityIcon, description: "Built for performance and athletic garments." };
  if (/workwear|uniform/.test(t))
    return { kind: "Workwear", icon: FactoryIcon, description: "Durable construction for uniforms and workwear." };

  // Accessories / home
  if (/bag|backpack|luggage/.test(t))
    return { kind: "Accessory", icon: PackageIcon, description: "Tough stitching for bags, backpacks and luggage." };
  if (/shoe|footwear/.test(t))
    return { kind: "Footwear", icon: TargetIcon, description: "Specialised seams for footwear and uppers." };
  if (/home|upholstery|curtain|cushion/.test(t))
    return { kind: "Home textile", icon: LayersIcon, description: "Consistent finish for upholstery and home goods." };
  if (/automotive|car|seat/.test(t))
    return { kind: "Technical", icon: WrenchIcon, description: "Heavy-duty seams for automotive interiors." };
  if (/medical|ppe|mask/.test(t))
    return { kind: "Technical", icon: ShieldCheckIcon, description: "Precise assembly for medical and PPE goods." };
  if (/embroidery|decor/.test(t))
    return { kind: "Decoration", icon: SparklesIcon, description: "Decorative stitching and embellishment work." };
  if (/quilt/.test(t))
    return { kind: "Multi-layer", icon: LayersIcon, description: "Controlled feed across thick quilted layers." };

  return { kind: "Application", icon: LayersIcon, description: "Optimised for industrial garment production." };
}

function Section({
  id, eyebrow, title, subtitle, children, className = "", align = "center",
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  align?: "left" | "center";
}) {
  const headerAlign = align === "center" ? "text-center mx-auto" : "";
  return (
    <section id={id} className={`py-20 md:py-28 ${className}`}>
      <div className="max-w-[980px] mx-auto px-6">
        {(eyebrow || title || subtitle) && (
          <div className={`mb-12 md:mb-16 ${headerAlign}`}>
            {eyebrow && (
              <p className="text-[15px] md:text-[17px] font-normal text-[#6E6E73] dark:text-white/60 mb-3 tracking-[-0.005em]">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="text-[32px] md:text-[48px] lg:text-[56px] font-semibold tracking-[-0.015em] text-[#1D1D1F] dark:text-white leading-[1.08]">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-5 text-[17px] md:text-[19px] text-[#6E6E73] dark:text-white/60 leading-[1.5] max-w-[680px] mx-auto font-normal">
                {subtitle}
              </p>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export default function ProductViewPage() {
  const params = useParams();
  const pathname = usePathname();
  /* "internal" when rendered under /product-data/[id]. Under
     /products/[id] (the PUBLIC page) we hide supplier names, cost
     info, and other admin-only fields. */
  const isInternal = (pathname || "").startsWith("/product-data");
  const handle = (params.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [product, setProduct] = useState<ProductRow | null>(null);
  const [models, setModels] = useState<ProductModelRow[]>([]);
  const [media, setMedia] = useState<ProductMediaRow[]>([]);
  const [sewingSpecs, setSewingSpecs] = useState<SewingMachineSpecsRow | null>(null);
  const [related, setRelated] = useState<({ related_id: string; product_name?: string })[]>([]);
  const [relatedDetails, setRelatedDetails] = useState<Record<string, ProductRow>>({});
  const [relatedImages, setRelatedImages] = useState<Record<string, string>>({});

  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryRow[]>([]);

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [expandedModels, setExpandedModels] = useState<Record<string, boolean>>({});
  const toggleModel = (id: string) =>
    setExpandedModels(prev => ({ ...prev, [id]: !prev[id] }));

  /* ── Request Quote modal state ──
     Customer (or anyone authenticated) clicks the "Request Quote"
     CTA → modal with qty + optional message → POST to
     /api/quotations/request-from-product creates a draft quotation
     the sales team picks up in the Quotations app. */
  const [rqOpen, setRqOpen] = useState(false);
  const [rqQty, setRqQty] = useState(1);
  const [rqNotes, setRqNotes] = useState("");
  const [rqBusy, setRqBusy] = useState(false);
  const [rqResult, setRqResult] = useState<
    | { ok: true; quote_no: string; quote_id: string }
    | { ok: false; error: string }
    | null
  >(null);

  /* ── Load ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);

      const [divs, cats, subs] = await Promise.all([
        fetchDivisions(), fetchCategories(), fetchSubcategories(),
      ]);
      if (cancelled) return;
      setDivisions(divs); setCategories(cats); setSubcategories(subs);

      const p = await fetchProductByIdOrSlug(handle);
      if (cancelled) return;

      if (!p) { setNotFound(true); setLoading(false); return; }

      setProduct(p);
      const [mdls, mds, specs, rel] = await Promise.all([
        fetchModelsByProductId(p.id),
        fetchMediaByProductId(p.id),
        fetchSewingSpecsByProductId(p.id),
        fetchRelatedProducts(p.id),
      ]);
      if (cancelled) return;

      setModels(mdls);
      setMedia(mds);
      setSewingSpecs(specs);
      setRelated(rel);

      // Resolve related product details + main image in parallel
      if (rel.length > 0) {
        const detailsArr = await Promise.all(
          rel.map(r => fetchProductByIdOrSlug(r.related_id))
        );
        const detailsMap: Record<string, ProductRow> = {};
        detailsArr.forEach((d, i) => { if (d) detailsMap[rel[i].related_id] = d; });
        if (!cancelled) setRelatedDetails(detailsMap);

        // Fetch main images for related products
        const imgFetches = await Promise.all(
          rel.map(r => fetchMediaByProductId(r.related_id))
        );
        const imgMap: Record<string, string> = {};
        imgFetches.forEach((arr, i) => {
          const main = arr.find(m => m.type === "main_image") || arr[0];
          if (main) imgMap[rel[i].related_id] = main.url;
        });
        if (!cancelled) setRelatedImages(imgMap);
      }

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [handle]);

  /* ── Derived ── */
  const divisionName = useMemo(
    () => product ? divisions.find(d => d.slug === product.division_slug)?.name : undefined,
    [divisions, product]
  );
  const categoryName = useMemo(
    () => product ? categories.find(c => c.slug === product.category_slug)?.name : undefined,
    [categories, product]
  );
  const subcategoryName = useMemo(
    () => product ? subcategories.find(s => s.slug === product.subcategory_slug)?.name : undefined,
    [subcategories, product]
  );

  const mainImage = useMemo(() => {
    const main = media.find(m => m.type === "main_image");
    return main?.url || null;
  }, [media]);

  const galleryImages = useMemo(() => {
    const imgs = media.filter(m => m.type === "main_image" || m.type === "gallery");
    // de-dupe by URL, main_image first
    const seen = new Set<string>();
    const out: ProductMediaRow[] = [];
    imgs.sort((a, b) => (a.type === "main_image" ? -1 : b.type === "main_image" ? 1 : a.order - b.order));
    for (const m of imgs) {
      if (!seen.has(m.url)) { seen.add(m.url); out.push(m); }
    }
    return out;
  }, [media]);

  const videos = useMemo(() => media.filter(m => m.type === "video"), [media]);
  const manuals = useMemo(() => media.filter(m => m.type === "manual"), [media]);
  const otherDocs = useMemo(
    () => media.filter(m => !["main_image", "gallery", "video", "manual"].includes(m.type)),
    [media]
  );

  const activeTemplate = useMemo(() => {
    if (!sewingSpecs?.template_slug) return null;
    return SEWING_MACHINE_TEMPLATES.find(t => t.slug === sewingSpecs.template_slug) || null;
  }, [sewingSpecs]);

  const commonSpecsRendered = useMemo(() => {
    if (!sewingSpecs?.common_specs) return [];
    const groups = groupFields(COMMON_SEWING_FIELDS);
    return groups
      .map(g => ({
        group: g.group,
        rows: g.fields
          .map(f => ({ field: f, value: formatFieldValue(f, (sewingSpecs.common_specs as Record<string, unknown>)[f.key]) }))
          .filter(r => r.value !== null) as { field: TemplateField; value: string }[],
      }))
      .filter(g => g.rows.length > 0);
  }, [sewingSpecs]);

  const templateSpecsRendered = useMemo(() => {
    if (!sewingSpecs?.template_specs || !activeTemplate) return [];
    const groups = groupFields(activeTemplate.fields);
    return groups
      .map(g => ({
        group: g.group,
        rows: g.fields
          .map(f => ({ field: f, value: formatFieldValue(f, (sewingSpecs.template_specs as Record<string, unknown>)[f.key]) }))
          .filter(r => r.value !== null) as { field: TemplateField; value: string }[],
      }))
      .filter(g => g.rows.length > 0);
  }, [sewingSpecs, activeTemplate]);

  const genericSpecsRendered = useMemo(() => {
    if (!product?.specs) return [] as { key: string; value: string }[];
    const entries = Object.entries(product.specs as Record<string, unknown>);
    return entries
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => ({ key: k, value: String(v) }));
  }, [product]);

  const keyFeatures = useMemo<KeyFeature[]>(
    () => (product ? deriveKeyFeatures(product, sewingSpecs) : []),
    [product, sewingSpecs],
  );

  const heroHighlights = useMemo<string[]>(
    () => (product ? deriveHeroHighlights(product, sewingSpecs) : []),
    [product, sewingSpecs],
  );

  /* ── Loading / not found ── */
  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-white dark:bg-[#0A0A0A]">
        <div className="flex items-center gap-3 text-[#6E6E73] dark:text-white/40 text-[13px]">
          <div className="h-4 w-4 rounded-full border-2 border-[#D2D2D7] dark:border-white/20 border-t-[#06C] dark:border-t-[#2997FF] animate-spin" />
          Loading product…
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 px-6 text-center bg-white dark:bg-[#0A0A0A]">
        <div className="h-16 w-16 rounded-2xl bg-[#F5F5F7] dark:bg-white/[0.04] flex items-center justify-center">
          <ImageRawIcon className="h-7 w-7 text-[#86868B] dark:text-white/30" />
        </div>
        <h1 className="text-[22px] font-semibold text-[#1D1D1F] dark:text-white">Product not found</h1>
        <p className="text-[14px] text-[#6E6E73] dark:text-white/60">
          We could not find a product matching <span className="font-mono text-[#1D1D1F] dark:text-white">{handle}</span>.
        </p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 h-[38px] px-[18px] rounded-full bg-[#06C] text-white text-[14px] font-normal hover:bg-[#0077ED] dark:bg-[#2997FF] dark:hover:bg-[#47A9FF] transition"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Back to products
        </Link>
      </div>
    );
  }

  const primaryModel = models.find(m => m.visible) || models[0];
  const priceFrom = primaryModel?.global_price ?? primaryModel?.head_only_price ?? primaryModel?.complete_set_price ?? null;
  const tags = product.tags || [];

  /* ════════════════════════════════════════════ */
  return (
    <div
      className="min-h-screen bg-white text-[#1D1D1F] dark:bg-[#0A0A0A] dark:text-white antialiased"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif',
        fontFeatureSettings: '"kern", "liga", "clig", "calt"',
      }}
    >
      {/* ── Sub-nav: matches the standard detail-page pattern used
              elsewhere in the hub (/customers/[id], /quotations/[id],
              /employees/[id]). Plain top bar — NOT sticky — because
              the hub scrolls inside a nested container and those
              other pages scroll their back/breadcrumb away with the
              rest of the content. Keeping the same behavior here so
              the product detail feels like the rest of the app. */}
      <div className="bg-[var(--bg-primary)] border-b border-[var(--border-subtle)]">
        <div className="mx-auto px-4 md:px-6 lg:px-10 xl:px-16 py-3 max-w-[1200px] flex items-center justify-between gap-3">
          <Link
            href="/products"
            aria-label="Back to products"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0"
          >
            <ArrowLeftIcon size={16} />
          </Link>

          {/* Breadcrumb — centered on wide screens, hidden on mobile
              to avoid crowding the narrow bar. Uses text-dim for
              ancestors + text-primary for the current subcategory. */}
          {divisionName && (
            <nav
              aria-label="Breadcrumb"
              className="hidden md:flex items-center gap-1.5 text-[12px] text-[var(--text-dim)] min-w-0 flex-1 justify-center"
            >
              <span className="truncate">{divisionName}</span>
              {categoryName && (
                <>
                  <span className="text-[var(--text-faint)]">/</span>
                  <span className="truncate">{categoryName}</span>
                </>
              )}
              {subcategoryName && (
                <>
                  <span className="text-[var(--text-faint)]">/</span>
                  <span className="truncate text-[var(--text-primary)] font-medium">
                    {subcategoryName}
                  </span>
                </>
              )}
            </nav>
          )}

          {/* Edit only on the internal /product-data view. The
              public /products detail is read-only. */}
          {isInternal ? (
            <Link
              href={`/product-data/${product.id}/edit`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors shrink-0"
            >
              <PencilIcon size={12} /> Edit
            </Link>
          ) : (
            /* Spacer keeps the breadcrumb visually centered on the
               public view where there's no Edit button. */
            <span className="h-8 w-8 shrink-0" aria-hidden />
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════
          1. HERO — Apple.com style: centered headline + dominant image below
          ══════════════════════════════════════ */}
      <section className="relative pt-16 md:pt-24 pb-0 bg-white dark:bg-[#0A0A0A]">
        <div className="max-w-[980px] mx-auto px-6 text-center">
          {/* "New" eyebrow (Apple-blue — works in both themes) */}
          {product.featured && (
            <p className="text-[18px] md:text-[21px] font-normal text-[#06C] dark:text-[#2997FF] mb-2 tracking-[-0.005em]">
              New
            </p>
          )}
          {!product.featured && product.brand && (
            <p className="text-[14px] md:text-[17px] font-normal text-[#6E6E73] dark:text-white/60 mb-2 tracking-[-0.005em]">
              {product.brand}
            </p>
          )}

          {/* Headline — Apple Hero Title */}
          <h1 className="text-[40px] md:text-[64px] lg:text-[80px] font-semibold text-[#1D1D1F] dark:text-white leading-[1.05] tracking-[-0.015em]">
            {product.product_name}
          </h1>

          {/* Tagline */}
          {primaryModel?.tagline && (
            <p className="mt-4 md:mt-5 text-[21px] md:text-[28px] lg:text-[32px] font-normal text-[#1D1D1F] dark:text-white leading-[1.15] tracking-[-0.005em] max-w-[760px] mx-auto">
              {primaryModel.tagline}
            </p>
          )}

          {/* Short description (excerpt) — the 1-2 sentence pitch
              admins enter in the Hero step. Falls below the big
              tagline as a muted subtitle so customers get a second
              pass of context before the CTAs. */}
          {product.excerpt && (
            <p className="mt-3 text-[15px] md:text-[17px] font-normal text-[#6E6E73] dark:text-white/60 leading-[1.47] max-w-[640px] mx-auto">
              {product.excerpt}
            </p>
          )}

          {/* Key highlights — 3-5 short bullet strings from the Hero
              step. Rendered as an inline row of check-marked chips so
              the hero stays light and scannable. */}
          {product.highlights && product.highlights.length > 0 && (
            <ul className="mt-6 md:mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              {product.highlights.map((h, i) => (
                <li
                  key={i}
                  className="inline-flex items-center gap-1.5 text-[13px] md:text-[14px] font-medium text-[#1D1D1F] dark:text-white/80"
                >
                  <CheckIcon className="h-3.5 w-3.5 text-[#06C] dark:text-[#2997FF]" />
                  {h}
                </li>
              ))}
            </ul>
          )}

          {/* Price + primary CTAs — Apple style inline */}
          <div className="mt-6 md:mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-[17px] md:text-[19px] font-normal">
            {priceFrom !== null && (
              <span className="text-[#1D1D1F] dark:text-white">
                From <span className="font-medium">{fmtMoney(priceFrom)}</span>
              </span>
            )}
            {/* "Request Quote" is the primary customer action. On the
                internal /product-data view we still show it — it's a
                shortcut for sales to start a draft quote with this
                product pre-selected. */}
            <button
              type="button"
              onClick={() => { setRqResult(null); setRqQty(1); setRqNotes(""); setRqOpen(true); }}
              className="inline-flex items-center h-[36px] md:h-[38px] px-[18px] rounded-full bg-[#06C] text-white text-[14px] md:text-[15px] font-normal hover:bg-[#0077ED] dark:bg-[#2997FF] dark:hover:bg-[#47A9FF] transition-colors"
            >
              Request Quote
            </button>
            <a
              href="#specs"
              className="inline-flex items-center gap-1 text-[#06C] dark:text-[#2997FF] hover:underline text-[14px] md:text-[17px]"
            >
              Learn more <AngleRightIcon className="h-3.5 w-3.5 mt-0.5" />
            </a>
          </div>

          {/* Hero image — centered, dominant, no frame */}
          <div className="mt-10 md:mt-14 relative">
            {mainImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={mainImage}
                alt={product.product_name}
                className="w-full max-w-[900px] mx-auto aspect-[4/3] object-contain"
              />
            ) : (
              <div className="w-full max-w-[900px] mx-auto aspect-[4/3] flex items-center justify-center bg-[#F5F5F7] dark:bg-white/[0.03] rounded-[22px]">
                <ImageRawIcon className="h-20 w-20 text-[#86868B] dark:text-white/30" />
              </div>
            )}
          </div>

          {/* Small meta line under image */}
          {(product.warranty || product.country_of_origin) && (
            <p className="mt-6 text-[12px] text-[#86868B] dark:text-white/40">
              {product.warranty && <>{product.warranty} warranty</>}
              {product.warranty && product.country_of_origin && <span className="mx-2">·</span>}
              {product.country_of_origin && <>Made in {product.country_of_origin}</>}
            </p>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════
          2. IMAGE GALLERY — Apple light
          Large main image + clean thumbnail strip.
          ══════════════════════════════════════ */}
      {galleryImages.length > 1 && (
        <Section eyebrow="Gallery" title="Every angle." className="bg-[#F5F5F7] dark:bg-white/[0.015]">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_120px] gap-6">
            <div className="group relative aspect-[4/3] md:aspect-[16/10] rounded-[22px] overflow-hidden bg-white dark:bg-white/[0.03]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={galleryImages[activeImageIdx]?.id}
                src={galleryImages[activeImageIdx]?.url}
                alt={galleryImages[activeImageIdx]?.alt_text || product.product_name}
                className="absolute inset-0 w-full h-full object-contain p-10 md:p-14 transition-transform duration-[800ms] ease-out group-hover:scale-[1.04] animate-in fade-in duration-500"
              />
              {/* Image counter */}
              <div className="absolute bottom-5 right-5 inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white/90 backdrop-blur-md text-[11px] font-medium text-[#1D1D1F] shadow-sm dark:bg-black/50 dark:text-white/90 dark:shadow-none">
                {activeImageIdx + 1} / {galleryImages.length}
              </div>
            </div>
            <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto lg:max-h-[520px] pb-2 lg:pb-0 lg:pr-1">
              {galleryImages.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImageIdx(idx)}
                  className={`relative shrink-0 h-20 w-20 lg:h-[100px] lg:w-full rounded-2xl overflow-hidden bg-white dark:bg-white/[0.03] transition-all duration-300 ${
                    idx === activeImageIdx
                      ? "ring-2 ring-[#06C] ring-offset-2 ring-offset-[#F5F5F7] dark:ring-[#2997FF] dark:ring-offset-[#0A0A0A]"
                      : "opacity-70 hover:opacity-100 ring-1 ring-[#D2D2D7] dark:ring-white/10"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="w-full h-full object-contain p-2" />
                </button>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* ══════════════════════════════════════
          3. PRODUCT DESCRIPTION — Apple light prose
          ══════════════════════════════════════ */}
      {product.description && (
        <section className="py-20 md:py-28 bg-white dark:bg-[#0A0A0A]">
          <div className="max-w-[740px] mx-auto px-6 text-center">
            <p className="text-[15px] md:text-[17px] font-normal text-[#6E6E73] dark:text-white/60 mb-4 tracking-[-0.005em]">
              About
            </p>
            <div
              className="max-w-none text-[19px] md:text-[24px] text-[#1D1D1F] dark:text-white/80 leading-[1.45] font-normal tracking-[-0.005em] [&_h1]:text-[#1D1D1F] dark:[&_h1]:text-white [&_h1]:font-semibold [&_h2]:text-[#1D1D1F] dark:[&_h2]:text-white [&_h2]:font-semibold [&_h3]:text-[#1D1D1F] dark:[&_h3]:text-white [&_h3]:font-semibold [&_strong]:text-[#1D1D1F] dark:[&_strong]:text-white [&_strong]:font-semibold [&_p]:mb-5 [&_a]:text-[#06C] dark:[&_a]:text-[#2997FF] [&_a]:no-underline hover:[&_a]:underline"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════
          4. KEY FEATURES — Apple clean card grid
          ══════════════════════════════════════ */}
      {keyFeatures.length > 0 && (
        <Section eyebrow="Key features" title="Engineered to perform." className="bg-white dark:bg-[#0A0A0A]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {keyFeatures.map((f, i) => (
              <div
                key={i}
                className="group relative overflow-hidden rounded-[22px] bg-[#F5F5F7] dark:bg-white/[0.04] dark:border dark:border-white/10 p-8 md:p-9 transition-all duration-300 hover:scale-[1.01]"
              >
                <div className="h-11 w-11 rounded-full bg-white dark:bg-white/[0.06] dark:border dark:border-white/10 flex items-center justify-center text-[#06C] dark:text-[#2997FF] mb-6 shadow-sm dark:shadow-none">
                  {f.icon}
                </div>
                <h3 className="text-[20px] md:text-[22px] font-semibold text-[#1D1D1F] dark:text-white tracking-[-0.015em] leading-[1.2]">
                  {f.title}
                </h3>
                {f.value && (
                  <p className="mt-1.5 text-[15px] font-medium text-[#06C] dark:text-[#2997FF]">{f.value}</p>
                )}
                <p className="mt-3 text-[15px] text-[#6E6E73] dark:text-white/60 leading-[1.5]">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ══════════════════════════════════════
          5. SEWING MACHINE OVERVIEW — Apple clean blocks
          ══════════════════════════════════════ */}
      {(activeTemplate || subcategoryName || tags.length > 0) && (
        <Section eyebrow="Machine overview" title="Designed for your line." className="bg-[#F5F5F7] dark:bg-white/[0.015]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Machine Type */}
            <div className="rounded-[22px] bg-white dark:bg-white/[0.03] dark:border dark:border-white/10 p-8 flex flex-col min-h-[240px]">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-full bg-[#F5F5F7] dark:bg-white/[0.06] flex items-center justify-center">
                  <FactoryIcon className="h-4 w-4 text-[#06C] dark:text-[#2997FF]" />
                </div>
                <p className="text-[13px] font-medium text-[#6E6E73] dark:text-white/60">
                  Machine Type
                </p>
              </div>
              <h3 className="text-[22px] md:text-[24px] font-semibold text-[#1D1D1F] dark:text-white leading-[1.2] tracking-[-0.015em]">
                {activeTemplate?.icon ? `${activeTemplate.icon} ` : ""}
                {activeTemplate?.name || subcategoryName || "Industrial Sewing Machine"}
              </h3>
              {categoryName && (
                <p className="mt-auto pt-4 text-[13px] text-[#86868B] dark:text-white/40">
                  {categoryName}
                </p>
              )}
            </div>

            {/* Main Function */}
            <div className="rounded-[22px] bg-white dark:bg-white/[0.03] dark:border dark:border-white/10 p-8 flex flex-col min-h-[240px]">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-full bg-[#F5F5F7] dark:bg-white/[0.06] flex items-center justify-center">
                  <ScissorsIcon className="h-4 w-4 text-[#06C] dark:text-[#2997FF]" />
                </div>
                <p className="text-[13px] font-medium text-[#6E6E73] dark:text-white/60">
                  Main Function
                </p>
              </div>
              <p className="text-[17px] md:text-[18px] text-[#1D1D1F] dark:text-white/85 leading-[1.45] font-normal">
                {activeTemplate?.description ||
                  primaryModel?.tagline ||
                  `${product.product_name} delivers industrial-grade performance for professional sewing lines.`}
              </p>
            </div>

            {/* Application */}
            <div className="rounded-[22px] bg-white dark:bg-white/[0.03] dark:border dark:border-white/10 p-8 flex flex-col min-h-[240px]">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-full bg-[#F5F5F7] dark:bg-white/[0.06] flex items-center justify-center">
                  <LayersIcon className="h-4 w-4 text-[#06C] dark:text-[#2997FF]" />
                </div>
                <p className="text-[13px] font-medium text-[#6E6E73] dark:text-white/60">
                  Application
                </p>
              </div>
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tags.slice(0, 8).map(t => (
                    <span
                      key={t}
                      className="inline-flex items-center h-7 px-3 rounded-full bg-[#F5F5F7] dark:bg-white/[0.06] dark:border dark:border-white/10 text-[12px] text-[#1D1D1F] dark:text-white/85 capitalize"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[15px] text-[#6E6E73] dark:text-white/60">
                  General-purpose industrial sewing across garment production lines.
                </p>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* ══════════════════════════════════════
          6. TECHNICAL SPECS — Apple clean rows style
          ══════════════════════════════════════ */}
      {(commonSpecsRendered.length > 0 || templateSpecsRendered.length > 0 || genericSpecsRendered.length > 0) && (
        <Section id="specs" eyebrow="Specifications" title="Built to a standard." className="bg-white dark:bg-[#0A0A0A]">
          {activeTemplate && (
            <div className="mb-12 flex justify-center">
              <div className="inline-flex items-center gap-2.5 px-5 h-9 rounded-full bg-[#F5F5F7] dark:bg-white/[0.06] dark:border dark:border-white/10 text-[13px] text-[#1D1D1F] dark:text-white/85">
                <span className="text-base">{activeTemplate.icon}</span>
                <span className="font-medium">{activeTemplate.name}</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...commonSpecsRendered, ...templateSpecsRendered].map((g) => {
              const GroupIcon =
                g.group === "Performance" ? GaugeIcon :
                g.group === "Mechanical" ? FactoryIcon :
                g.group === "Electrical" ? ZapIcon :
                (g.group === "Physical" || g.group === "Physical / Installation") ? RulerIcon :
                g.group === "Needle & Thread" ? TargetIcon :
                WrenchIcon;
              return (
                <div
                  key={g.group}
                  className="rounded-[22px] bg-[#F5F5F7] dark:bg-white/[0.03] dark:border dark:border-white/10 p-8"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-9 w-9 rounded-full bg-white dark:bg-white/[0.06] dark:border dark:border-white/10 flex items-center justify-center shadow-sm dark:shadow-none">
                      <GroupIcon className="h-4 w-4 text-[#06C] dark:text-[#2997FF]" />
                    </div>
                    <h3 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-white leading-none tracking-[-0.01em]">
                      {g.group}
                    </h3>
                  </div>
                  <dl className="space-y-0">
                    {g.rows.map(({ field, value }, idx) => (
                      <div
                        key={field.key}
                        className={`flex justify-between items-baseline gap-4 py-3 ${idx < g.rows.length - 1 ? "border-b border-[#D2D2D7]/60 dark:border-white/[0.06]" : ""}`}
                      >
                        <dt className="text-[13px] text-[#6E6E73] dark:text-white/55">{field.label}</dt>
                        <dd className="text-[13px] text-[#1D1D1F] dark:text-white text-right font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}

            {genericSpecsRendered.length > 0 && (
              <div className="rounded-[22px] bg-[#F5F5F7] dark:bg-white/[0.03] dark:border dark:border-white/10 p-8 md:col-span-2">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-9 w-9 rounded-full bg-white dark:bg-white/[0.06] dark:border dark:border-white/10 flex items-center justify-center shadow-sm dark:shadow-none">
                    <WrenchIcon className="h-4 w-4 text-[#06C] dark:text-[#2997FF]" />
                  </div>
                  <h3 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-white leading-none tracking-[-0.01em]">
                    Additional
                  </h3>
                </div>
                <dl className="grid grid-cols-1 md:grid-cols-2 md:gap-x-10">
                  {genericSpecsRendered.map(({ key, value }, idx) => (
                    <div key={key} className={`flex justify-between items-baseline gap-4 py-3 ${idx < genericSpecsRendered.length - 1 ? "border-b border-[#D2D2D7]/60 dark:border-white/[0.06]" : ""}`}>
                      <dt className="text-[13px] text-[#6E6E73] dark:text-white/55 capitalize">{key.replace(/_/g, " ")}</dt>
                      <dd className="text-[13px] text-[#1D1D1F] dark:text-white text-right font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ══════════════════════════════════════
          7. MODELS / VARIANTS — Apple Buy-like clean cards
          ══════════════════════════════════════ */}
      {models.length > 0 && (
        <Section
          id="models"
          eyebrow={`${models.length} variant${models.length === 1 ? "" : "s"}`}
          title="Choose your model."
          subtitle="Which is right for you?"
          className="bg-[#F5F5F7] dark:bg-white/[0.015]"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {models
              .filter(m => m.visible !== false)
              .map((m, idx) => {
                const modelPhoto = media.find(md => md.model_id === m.id && (md.type === "main_image" || md.type === "gallery"));
                const price = m.global_price ?? m.head_only_price ?? m.complete_set_price ?? null;
                const isExpanded = !!expandedModels[m.id];
                const isBestChoice = idx === 0 && models.filter(mm => mm.visible !== false).length > 1;
                const hasDetails = Boolean(
                  m.weight || m.cbm || m.packing_type || m.box_include || m.extra_accessories || m.barcode || m.reference_model
                );

                // Pull top 3-4 key specs from common_specs for inline preview
                const cs = (sewingSpecs?.common_specs || {}) as Record<string, unknown>;
                const keySpecs: { label: string; value: string }[] = [];
                if (cs.max_sewing_speed) keySpecs.push({ label: "Max speed", value: `${cs.max_sewing_speed} spm` });
                if (cs.motor_type) keySpecs.push({ label: "Motor", value: String(cs.motor_type).replace(/-/g, " ") });
                if (cs.stitch_length_max) keySpecs.push({ label: "Stitch", value: `${cs.stitch_length_min ? cs.stitch_length_min + "–" : "up to "}${cs.stitch_length_max} mm` });
                if (cs.needle_system && keySpecs.length < 4) keySpecs.push({ label: "Needle", value: String(cs.needle_system) });
                if (keySpecs.length < 3 && cs.lubrication_system) keySpecs.push({ label: "Lubrication", value: String(cs.lubrication_system).replace(/-/g, " ") });

                return (
                  <div
                    key={m.id}
                    className={`group relative rounded-[22px] overflow-hidden flex flex-col bg-white dark:bg-white/[0.03] dark:border dark:border-white/10 transition-all duration-300 ${
                      isBestChoice
                        ? "ring-2 ring-[#06C] ring-offset-2 ring-offset-[#F5F5F7] dark:ring-[#2997FF] dark:ring-offset-[#0A0A0A]"
                        : ""
                    }`}
                  >
                    {/* Best Choice ribbon — Apple-style top bar */}
                    {isBestChoice && (
                      <div className="absolute top-0 left-0 right-0 z-10 h-7 bg-[#06C] dark:bg-[#2997FF] flex items-center justify-center gap-1.5 text-[11px] font-medium text-white tracking-[-0.005em]">
                        <SparklesIcon className="h-3 w-3" /> Best Choice
                      </div>
                    )}

                    {/* Image area */}
                    <div className={`aspect-[4/3] relative overflow-hidden bg-white dark:bg-white/[0.02] ${isBestChoice ? "pt-7" : ""}`}>
                      {modelPhoto || mainImage ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={modelPhoto?.url || mainImage!}
                          alt={m.model_name}
                          className="absolute inset-0 w-full h-full object-contain p-8 group-hover:scale-[1.04] transition-transform duration-700 ease-out"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-[#D2D2D7] dark:text-white/20">
                          <ImageRawIcon className="h-12 w-12" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-7 flex flex-col flex-1">
                      {/* Name */}
                      <h3 className="text-[22px] font-semibold text-[#1D1D1F] dark:text-white tracking-[-0.015em] leading-[1.15]">
                        {m.model_name}
                      </h3>
                      {m.tagline && (
                        <p className="text-[14px] text-[#6E6E73] dark:text-white/55 mt-2 line-clamp-2 leading-[1.4]">
                          {m.tagline}
                        </p>
                      )}

                      {/* Price */}
                      {price !== null && (
                        <p className="mt-4 text-[17px] text-[#1D1D1F] dark:text-white">
                          From <span className="font-medium">{fmtMoney(price)}</span>
                        </p>
                      )}

                      {/* Key spec preview — 3-4 lines */}
                      {keySpecs.length > 0 && (
                        <dl className="mt-6 pt-6 border-t border-[#D2D2D7]/60 dark:border-white/[0.08] space-y-2.5">
                          {keySpecs.slice(0, 4).map(s => (
                            <div key={s.label} className="flex items-baseline justify-between gap-3 text-[13px]">
                              <dt className="text-[#6E6E73] dark:text-white/45 capitalize">{s.label}</dt>
                              <dd className="text-[#1D1D1F] dark:text-white/90 font-medium text-right capitalize">{s.value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}

                      {/* Config badges */}
                      <div className="mt-5 flex flex-wrap gap-1.5">
                        {m.sku && (
                          <span className="text-[11px] px-2 h-6 inline-flex items-center rounded-full bg-[#F5F5F7] dark:bg-white/[0.05] text-[#6E6E73] dark:text-white/60 font-mono tracking-tight">
                            {m.sku}
                          </span>
                        )}
                        {m.supports_head_only && (
                          <span className="text-[11px] px-2.5 h-6 inline-flex items-center rounded-full bg-[#F5F5F7] dark:bg-white/[0.05] text-[#1D1D1F] dark:text-white/80">
                            <CheckIcon className="h-2.5 w-2.5 mr-1 text-[#06C] dark:text-[#2997FF]" /> Head only
                          </span>
                        )}
                        {m.supports_complete_set && (
                          <span className="text-[11px] px-2.5 h-6 inline-flex items-center rounded-full bg-[#F5F5F7] dark:bg-white/[0.05] text-[#1D1D1F] dark:text-white/80">
                            <CheckIcon className="h-2.5 w-2.5 mr-1 text-[#06C] dark:text-[#2997FF]" /> Complete set
                          </span>
                        )}
                      </div>

                      {/* Commercial info — supplier + MOQ are
                          internal-only. Lead time is customer-friendly
                          (they want to know when to expect delivery)
                          so it stays visible on the public view. */}
                      {((isInternal && (m.moq || m.supplier)) || m.lead_time) && (
                        <dl className="mt-5 pt-5 border-t border-[#D2D2D7]/60 dark:border-white/[0.08] text-[12px] space-y-1.5">
                          {isInternal && m.supplier && (
                            <div className="flex justify-between">
                              <dt className="text-[#86868B] dark:text-white/40">Supplier</dt>
                              <dd className="text-[#1D1D1F] dark:text-white/75 truncate ml-2">{m.supplier}</dd>
                            </div>
                          )}
                          {isInternal && m.moq && (
                            <div className="flex justify-between">
                              <dt className="text-[#86868B] dark:text-white/40">MOQ</dt>
                              <dd className="text-[#1D1D1F] dark:text-white/75">{m.moq}</dd>
                            </div>
                          )}
                          {m.lead_time && (
                            <div className="flex justify-between">
                              <dt className="text-[#86868B] dark:text-white/40">Lead time</dt>
                              <dd className="text-[#1D1D1F] dark:text-white/75">{m.lead_time}</dd>
                            </div>
                          )}
                        </dl>
                      )}

                      {/* Expand details */}
                      {hasDetails && (
                        <>
                          <div
                            className={`grid transition-all duration-300 ease-out ${
                              isExpanded ? "grid-rows-[1fr] opacity-100 mt-5" : "grid-rows-[0fr] opacity-0"
                            }`}
                          >
                            <div className="overflow-hidden">
                              <div className="pt-5 border-t border-[#D2D2D7]/60 dark:border-white/[0.08]">
                                <p className="text-[12px] font-medium text-[#6E6E73] dark:text-white/50 mb-3 flex items-center gap-1.5">
                                  <PackageIcon className="h-3 w-3" /> Packaging
                                </p>
                                <dl className="text-[12px] space-y-1.5">
                                  {m.weight && (
                                    <div className="flex justify-between">
                                      <dt className="text-[#86868B] dark:text-white/40">Weight</dt>
                                      <dd className="text-[#1D1D1F] dark:text-white/80">{m.weight} kg</dd>
                                    </div>
                                  )}
                                  {m.cbm && (
                                    <div className="flex justify-between">
                                      <dt className="text-[#86868B] dark:text-white/40">Volume</dt>
                                      <dd className="text-[#1D1D1F] dark:text-white/80">{m.cbm} m³</dd>
                                    </div>
                                  )}
                                  {m.packing_type && (
                                    <div className="flex justify-between">
                                      <dt className="text-[#86868B] dark:text-white/40">Packing</dt>
                                      <dd className="text-[#1D1D1F] dark:text-white/80 truncate ml-2">{m.packing_type}</dd>
                                    </div>
                                  )}
                                  {m.box_include && (
                                    <div className="pt-1">
                                      <dt className="text-[#86868B] dark:text-white/40 mb-0.5">Box includes</dt>
                                      <dd className="text-[#1D1D1F] dark:text-white/80 leading-snug">{m.box_include}</dd>
                                    </div>
                                  )}
                                  {m.extra_accessories && (
                                    <div className="pt-1">
                                      <dt className="text-[#86868B] dark:text-white/40 mb-0.5">Accessories</dt>
                                      <dd className="text-[#1D1D1F] dark:text-white/80 leading-snug">{m.extra_accessories}</dd>
                                    </div>
                                  )}
                                  {m.reference_model && (
                                    <div className="flex justify-between">
                                      <dt className="text-[#86868B] dark:text-white/40">Reference</dt>
                                      <dd className="text-[#1D1D1F] dark:text-white/80 font-mono">{m.reference_model}</dd>
                                    </div>
                                  )}
                                  {m.barcode && (
                                    <div className="flex justify-between">
                                      <dt className="text-[#86868B] dark:text-white/40">Barcode</dt>
                                      <dd className="text-[#1D1D1F] dark:text-white/80 font-mono">{m.barcode}</dd>
                                    </div>
                                  )}
                                </dl>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleModel(m.id)}
                            className="mt-5 inline-flex items-center gap-1 text-[13px] font-normal text-[#06C] dark:text-[#2997FF] hover:underline self-start"
                          >
                            {isExpanded ? "Hide details" : "Show details"}
                            <AngleDownIcon className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </button>
                        </>
                      )}

                      {/* Apple-style Buy CTA pinned at bottom */}
                      <div className="mt-auto pt-7">
                        <Link
                          href="/contacts"
                          className="w-full inline-flex items-center justify-center h-[38px] rounded-full bg-[#06C] text-white text-[14px] font-normal hover:bg-[#0077ED] dark:bg-[#2997FF] dark:hover:bg-[#47A9FF] transition-colors"
                        >
                          Buy
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </Section>
      )}

      {/* ══════════════════════════════════════
          8. APPLICATIONS — Apple clean tile cards
          ══════════════════════════════════════ */}
      {tags.length > 0 && (
        <Section eyebrow="Applications" title="Where it performs." className="bg-white dark:bg-[#0A0A0A]">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {tags.map(t => {
              const info = describeApplication(t);
              const Icon = info.icon;
              return (
                <div
                  key={t}
                  className="group relative aspect-[4/5] rounded-[22px] overflow-hidden bg-[#F5F5F7] dark:bg-white/[0.04] dark:border dark:border-white/10 transition-all duration-300 hover:scale-[1.02]"
                >
                  <div className="relative h-full flex flex-col p-7">
                    {/* Large icon as visual anchor */}
                    <div className="flex-1 flex items-center justify-center">
                      <div className="h-20 w-20 rounded-full bg-white dark:bg-white/[0.06] dark:border dark:border-white/10 flex items-center justify-center shadow-sm dark:shadow-none group-hover:scale-105 transition-transform duration-300">
                        <Icon className="h-9 w-9 text-[#06C] dark:text-[#2997FF]" />
                      </div>
                    </div>

                    <div>
                      <p className="text-[12px] font-medium text-[#86868B] dark:text-white/40 mb-1">
                        {info.kind}
                      </p>
                      <h3 className="text-[18px] md:text-[20px] font-semibold text-[#1D1D1F] dark:text-white capitalize leading-[1.2] tracking-[-0.015em]">
                        {t}
                      </h3>
                      <p className="mt-2 text-[13px] text-[#6E6E73] dark:text-white/60 leading-[1.45] line-clamp-2">
                        {info.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ══════════════════════════════════════
          9. MEDIA / DOWNLOADS — Apple clean resource cards
          ══════════════════════════════════════ */}
      {(videos.length > 0 || manuals.length > 0 || otherDocs.length > 0) && (
        <Section eyebrow="Resources" title="Dig deeper." className="bg-[#F5F5F7] dark:bg-white/[0.015]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {videos.map(v => (
              <a key={v.id} href={v.url} target="_blank" rel="noreferrer"
                 className="group flex items-start gap-5 p-7 rounded-[22px] bg-white dark:bg-white/[0.03] dark:border dark:border-white/10 transition-all duration-300 hover:scale-[1.01]">
                <div className="h-12 w-12 rounded-full bg-[#F5F5F7] dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                  <PlayIcon className="h-4 w-4 text-[#06C] dark:text-[#2997FF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-[#86868B] dark:text-white/45 mb-1">Video</p>
                  <p className="text-[16px] font-semibold text-[#1D1D1F] dark:text-white leading-[1.25] tracking-[-0.01em]">{v.alt_text || "Product video"}</p>
                  <p className="text-[13px] text-[#06C] dark:text-[#2997FF] mt-2 inline-flex items-center gap-1 group-hover:underline">
                    Watch now <ExternalLinkIcon className="h-3 w-3" />
                  </p>
                </div>
              </a>
            ))}
            {manuals.map(m => (
              <a key={m.id} href={m.url} target="_blank" rel="noreferrer"
                 className="group flex items-start gap-5 p-7 rounded-[22px] bg-white dark:bg-white/[0.03] dark:border dark:border-white/10 transition-all duration-300 hover:scale-[1.01]">
                <div className="h-12 w-12 rounded-full bg-[#F5F5F7] dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                  <DocumentIcon className="h-4 w-4 text-[#06C] dark:text-[#2997FF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-[#86868B] dark:text-white/45 mb-1">PDF manual</p>
                  <p className="text-[16px] font-semibold text-[#1D1D1F] dark:text-white leading-[1.25] tracking-[-0.01em]">{m.alt_text || "Technical manual"}</p>
                  <p className="text-[13px] text-[#06C] dark:text-[#2997FF] mt-2 inline-flex items-center gap-1 group-hover:underline">
                    Download <DownloadIcon className="h-3 w-3" />
                  </p>
                </div>
              </a>
            ))}
            {otherDocs.map(d => (
              <a key={d.id} href={d.url} target="_blank" rel="noreferrer"
                 className="group flex items-start gap-5 p-7 rounded-[22px] bg-white dark:bg-white/[0.03] dark:border dark:border-white/10 transition-all duration-300 hover:scale-[1.01]">
                <div className="h-12 w-12 rounded-full bg-[#F5F5F7] dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                  <ImageRawIcon className="h-4 w-4 text-[#06C] dark:text-[#2997FF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-[#86868B] dark:text-white/45 mb-1 capitalize">{d.type.replace(/_/g, " ")}</p>
                  <p className="text-[16px] font-semibold text-[#1D1D1F] dark:text-white leading-[1.25] tracking-[-0.01em] capitalize">{(d.alt_text || d.type).replace(/_/g, " ")}</p>
                  <p className="text-[13px] text-[#06C] dark:text-[#2997FF] mt-2 inline-flex items-center gap-1 group-hover:underline">
                    View <ExternalLinkIcon className="h-3 w-3" />
                  </p>
                </div>
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* ══════════════════════════════════════
          10. RELATED PRODUCTS — Apple clean shopping cards
          ══════════════════════════════════════ */}
      {related.length > 0 && (
        <Section eyebrow="You might also like" title="Related machines." className="bg-white dark:bg-[#0A0A0A]">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {related.map(r => {
              const rp = relatedDetails[r.related_id];
              const img = relatedImages[r.related_id];
              if (!rp) return null;
              return (
                <Link
                  key={r.related_id}
                  href={`/products/${rp.slug || rp.id}`}
                  className="group rounded-[22px] overflow-hidden bg-[#F5F5F7] dark:bg-white/[0.04] dark:border dark:border-white/10 transition-all duration-300 hover:scale-[1.02]"
                >
                  <div className="aspect-[4/3] bg-white dark:bg-white/[0.02] relative overflow-hidden">
                    {img ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={img} alt={rp.product_name}
                           className="absolute inset-0 w-full h-full object-contain p-6 group-hover:scale-[1.05] transition-transform duration-700 ease-out" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-[#D2D2D7] dark:text-white/20">
                        <ImageRawIcon className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    {rp.brand && (
                      <p className="text-[12px] font-medium text-[#86868B] dark:text-white/40 mb-1">{rp.brand}</p>
                    )}
                    <p className="text-[16px] font-semibold text-[#1D1D1F] dark:text-white leading-[1.2] line-clamp-2 tracking-[-0.01em]">{rp.product_name}</p>
                    <p className="mt-3 inline-flex items-center gap-1 text-[13px] text-[#06C] dark:text-[#2997FF] group-hover:underline">
                      Learn more <AngleRightIcon className="h-3 w-3" />
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      {/* ══════════════════════════════════════
          11. FINAL CTA — Apple closing statement
          ══════════════════════════════════════ */}
      <section className="relative py-24 md:py-32 bg-[#F5F5F7] dark:bg-white/[0.015]">
        <div className="max-w-[980px] mx-auto px-6 text-center">
          <p className="text-[15px] md:text-[17px] font-normal text-[#6E6E73] dark:text-white/60 mb-3 tracking-[-0.005em]">
            Let&apos;s talk
          </p>
          <h2 className="text-[36px] md:text-[56px] lg:text-[64px] font-semibold tracking-[-0.015em] text-[#1D1D1F] dark:text-white leading-[1.08]">
            Ready to elevate<br />your production line?
          </h2>
          <p className="mt-5 text-[19px] md:text-[21px] text-[#6E6E73] dark:text-white/60 leading-[1.45] max-w-[640px] mx-auto font-normal">
            Our specialists will help you select the right {product.product_name} configuration for your factory.
          </p>
          <div className="mt-9 flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/contacts"
              className="inline-flex items-center gap-1 h-[44px] px-[22px] rounded-full bg-[#06C] text-white text-[17px] font-normal hover:bg-[#0077ED] dark:bg-[#2997FF] dark:hover:bg-[#47A9FF] transition-colors"
            >
              Contact sales <AngleRightIcon className="h-4 w-4 mt-0.5" />
            </Link>
            <a
              href="#models"
              className="inline-flex items-center gap-1 text-[#06C] dark:text-[#2997FF] text-[17px] font-normal hover:underline"
            >
              Review models <AngleRightIcon className="h-4 w-4 mt-0.5" />
            </a>
          </div>
          <div className="mt-12 flex items-center justify-center gap-4 text-[12px] text-[#86868B] dark:text-white/40">
            <span className="inline-flex items-center gap-1.5">
              <BoxesIcon className="h-3 w-3" />
              {models.length} model{models.length === 1 ? "" : "s"}
            </span>
            {product.hs_code && (
              <>
                <span className="h-1 w-1 rounded-full bg-[#D2D2D7] dark:bg-white/20" />
                <span className="font-mono">HS {product.hs_code}</span>
              </>
            )}
            {product.warranty && (
              <>
                <span className="h-1 w-1 rounded-full bg-[#D2D2D7] dark:bg-white/20" />
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheckIcon className="h-3 w-3" /> {product.warranty}
                </span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          REQUEST QUOTE MODAL
          Customer (or sales rep) asks for a quote.
          On submit: POST /api/quotations/request-from-product
          ══════════════════════════════════════ */}
      {rqOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rq-title"
          onClick={() => { if (!rqBusy) setRqOpen(false); }}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#D2D2D7] dark:border-white/[0.08] p-5 md:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {rqResult && rqResult.ok ? (
              <div className="text-center py-4">
                <div className="h-12 w-12 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto mb-3">
                  <CheckIcon className="h-6 w-6" />
                </div>
                <h2 className="text-[16px] font-semibold text-[#1D1D1F] dark:text-white mb-1">
                  Request sent
                </h2>
                <p className="text-[13px] text-[#86868B] dark:text-white/60 mb-4">
                  Your quote request for <span className="font-medium text-[#1D1D1F] dark:text-white">{product.product_name}</span> has been received.
                  Reference <span className="font-mono text-[#1D1D1F] dark:text-white">{rqResult.quote_no}</span>. Our sales team will follow up.
                </p>
                {/* Deep-link straight to the quotation detail page.
                    Only admins with Quotations module access land on
                    it; customers without access get a clean 403 and
                    can just close the modal knowing their reference
                    has been recorded. */}
                <div className="flex gap-2 justify-center">
                  <Link
                    href={`/quotations/${rqResult.quote_id}`}
                    className="inline-flex items-center h-9 px-4 rounded-full bg-[#06C] text-white text-[13px] font-medium hover:bg-[#0077ED] dark:bg-[#2997FF] dark:hover:bg-[#47A9FF] transition-colors"
                  >
                    View quotation
                  </Link>
                  <button
                    type="button"
                    onClick={() => { setRqOpen(false); setRqResult(null); }}
                    className="inline-flex items-center h-9 px-4 rounded-full border border-[#D2D2D7] dark:border-white/15 text-[13px] text-[#1D1D1F] dark:text-white hover:bg-[#F5F5F7] dark:hover:bg-white/[0.04] transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-1">
                  <h2 id="rq-title" className="text-[16px] font-semibold text-[#1D1D1F] dark:text-white">
                    Request a quote
                  </h2>
                </div>
                <p className="text-[12px] text-[#86868B] dark:text-white/50 mb-4">
                  Tell us how many units you&apos;re interested in. Our team will
                  send you a quotation with pricing, lead time, and shipping terms.
                </p>
                <div className="mb-3 px-3 py-2.5 rounded-lg bg-[#F5F5F7] dark:bg-white/[0.04] text-[13px]">
                  <span className="text-[#86868B] dark:text-white/50">Product · </span>
                  <span className="text-[#1D1D1F] dark:text-white font-medium">{product.product_name}</span>
                </div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868B] dark:text-white/50 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  max={9999}
                  value={rqQty}
                  onChange={(e) => setRqQty(Math.max(1, Math.min(9999, Number(e.target.value) || 1)))}
                  className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#2C2C2E] border border-[#D2D2D7] dark:border-white/[0.08] text-[14px] text-[#1D1D1F] dark:text-white focus:outline-none focus:border-[#06C] dark:focus:border-[#2997FF] mb-3"
                />
                <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868B] dark:text-white/50 mb-1">
                  Message <span className="normal-case font-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={rqNotes}
                  onChange={(e) => setRqNotes(e.target.value)}
                  placeholder="Specific requirements, delivery location, timeline…"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#2C2C2E] border border-[#D2D2D7] dark:border-white/[0.08] text-[13px] text-[#1D1D1F] dark:text-white placeholder:text-[#86868B] dark:placeholder:text-white/30 focus:outline-none focus:border-[#06C] dark:focus:border-[#2997FF] resize-none mb-4"
                />
                {rqResult && !rqResult.ok && (
                  <p className="text-[12px] text-red-500 mb-3">{rqResult.error}</p>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setRqOpen(false)}
                    disabled={rqBusy}
                    className="inline-flex items-center h-9 px-4 rounded-full border border-[#D2D2D7] dark:border-white/15 text-[13px] text-[#1D1D1F] dark:text-white hover:bg-[#F5F5F7] dark:hover:bg-white/[0.04] transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={rqBusy}
                    onClick={async () => {
                      setRqBusy(true);
                      setRqResult(null);
                      try {
                        const res = await fetch("/api/quotations/request-from-product", {
                          method: "POST",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            product_id: product.id,
                            qty: rqQty,
                            notes: rqNotes.trim() || undefined,
                          }),
                        });
                        const json = (await res.json().catch(() => ({}))) as {
                          quote_id?: string;
                          quote_no?: string;
                          error?: string;
                        };
                        if (!res.ok || !json.quote_id || !json.quote_no) {
                          setRqResult({ ok: false, error: json.error || `Failed (${res.status})` });
                        } else {
                          setRqResult({ ok: true, quote_id: json.quote_id, quote_no: json.quote_no });
                        }
                      } catch (err) {
                        setRqResult({
                          ok: false,
                          error: err instanceof Error ? err.message : "Network error",
                        });
                      } finally {
                        setRqBusy(false);
                      }
                    }}
                    className="inline-flex items-center gap-2 h-9 px-5 rounded-full bg-[#06C] text-white text-[13px] font-medium hover:bg-[#0077ED] dark:bg-[#2997FF] dark:hover:bg-[#47A9FF] transition-colors disabled:opacity-60"
                  >
                    {rqBusy ? "Sending…" : "Send request"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
