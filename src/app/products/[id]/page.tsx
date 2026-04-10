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
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Pencil, Check, Download, Play, Tag, Boxes, Globe, Zap,
  Ruler, Layers, Factory, Sparkles, ShieldCheck, Image as ImageIcon,
  ChevronRight, FileText, ExternalLink, Gauge, Cpu, Droplets, Target,
  Volume2, Wrench, Activity, Award, Scissors, ChevronDown, Package,
} from "lucide-react";

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
      icon: <Gauge className="h-5 w-5" />,
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
    features.push({ icon: <Cpu className="h-5 w-5" />, title: m.title, description: m.desc });
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
    features.push({ icon: <Droplets className="h-5 w-5" />, title: l.title, description: l.desc });
  }

  // 4. Needle system
  if (cs.needle_system) {
    features.push({
      icon: <Target className="h-5 w-5" />,
      title: "Precision Needle",
      value: String(cs.needle_system),
      description: "Industrial-grade needle system.",
    });
  }

  // 5. Stitch range
  if (cs.stitch_length_max) {
    const min = cs.stitch_length_min ? `${cs.stitch_length_min}–` : "Up to ";
    features.push({
      icon: <Ruler className="h-5 w-5" />,
      title: "Wide Stitch Range",
      value: `${min}${cs.stitch_length_max} mm`,
      description: "Versatile across fabric thicknesses.",
    });
  }

  // 6. Presser foot lift
  if (features.length < 6 && cs.presser_foot_lift) {
    features.push({
      icon: <Activity className="h-5 w-5" />,
      title: "Generous Clearance",
      value: `${cs.presser_foot_lift} mm lift`,
      description: "Handles thick and layered materials.",
    });
  }

  // 7. Noise level (from template_specs if present)
  const ts = (sewingSpecs?.template_specs || {}) as Record<string, unknown>;
  if (features.length < 6 && ts.noise_level) {
    features.push({
      icon: <Volume2 className="h-5 w-5" />,
      title: "Low Noise",
      value: `${ts.noise_level} dB`,
      description: "Quieter workstation environment.",
    });
  }

  // Fallbacks — always show at least 4
  if (features.length < 4 && product.warranty) {
    features.push({
      icon: <ShieldCheck className="h-5 w-5" />,
      title: "Manufacturer Warranty",
      value: product.warranty,
      description: "Backed by Koleex support.",
    });
  }
  if (features.length < 4 && product.country_of_origin) {
    features.push({
      icon: <Award className="h-5 w-5" />,
      title: "Quality Sourcing",
      value: product.country_of_origin,
      description: "Curated manufacturing origin.",
    });
  }
  if (features.length < 4 && (product.voltage?.length || 0) > 0) {
    features.push({
      icon: <Zap className="h-5 w-5" />,
      title: "Global Voltage",
      value: (product.voltage || []).join(" / "),
      description: "Ready for international deployment.",
    });
  }
  if (features.length < 4) {
    features.push({
      icon: <Wrench className="h-5 w-5" />,
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
    return { kind: "Heavy fabric", icon: Layers, description: "Engineered for dense denim and jeanswear production." };
  if (/leather/.test(t))
    return { kind: "Heavy material", icon: ShieldCheck, description: "Handles thick hides and multi-layer leather work." };
  if (/canvas|tarp/.test(t))
    return { kind: "Heavy fabric", icon: Layers, description: "Ideal for canvas, tarpaulin and technical textiles." };
  if (/knit|jersey/.test(t))
    return { kind: "Stretch fabric", icon: Activity, description: "Smooth handling of knit and jersey materials." };
  if (/silk|satin|chiffon/.test(t))
    return { kind: "Fine fabric", icon: Sparkles, description: "Precision feed for delicate and luxury fabrics." };

  // Garment types
  if (/shirt|blouse/.test(t))
    return { kind: "Garment", icon: Scissors, description: "Clean seams for shirting and light tailoring." };
  if (/trouser|pant|jean/.test(t))
    return { kind: "Garment", icon: Scissors, description: "Production-grade stitching for bottoms and jeans." };
  if (/jacket|coat|outerwear/.test(t))
    return { kind: "Outerwear", icon: ShieldCheck, description: "Reliable seams across heavy-layered garments." };
  if (/dress|skirt/.test(t))
    return { kind: "Garment", icon: Sparkles, description: "Elegant finish for dresses, skirts and womenswear." };
  if (/underwear|lingerie|intimate/.test(t))
    return { kind: "Intimates", icon: Sparkles, description: "Gentle feed for fine intimate apparel." };
  if (/sport|active|athletic/.test(t))
    return { kind: "Activewear", icon: Activity, description: "Built for performance and athletic garments." };
  if (/workwear|uniform/.test(t))
    return { kind: "Workwear", icon: Factory, description: "Durable construction for uniforms and workwear." };

  // Accessories / home
  if (/bag|backpack|luggage/.test(t))
    return { kind: "Accessory", icon: Package, description: "Tough stitching for bags, backpacks and luggage." };
  if (/shoe|footwear/.test(t))
    return { kind: "Footwear", icon: Target, description: "Specialised seams for footwear and uppers." };
  if (/home|upholstery|curtain|cushion/.test(t))
    return { kind: "Home textile", icon: Layers, description: "Consistent finish for upholstery and home goods." };
  if (/automotive|car|seat/.test(t))
    return { kind: "Technical", icon: Wrench, description: "Heavy-duty seams for automotive interiors." };
  if (/medical|ppe|mask/.test(t))
    return { kind: "Technical", icon: ShieldCheck, description: "Precise assembly for medical and PPE goods." };
  if (/embroidery|decor/.test(t))
    return { kind: "Decoration", icon: Sparkles, description: "Decorative stitching and embellishment work." };
  if (/quilt/.test(t))
    return { kind: "Multi-layer", icon: Layers, description: "Controlled feed across thick quilted layers." };

  return { kind: "Application", icon: Layers, description: "Optimised for industrial garment production." };
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
          <ImageIcon className="h-7 w-7 text-[#86868B] dark:text-white/30" />
        </div>
        <h1 className="text-[22px] font-semibold text-[#1D1D1F] dark:text-white">Product not found</h1>
        <p className="text-[14px] text-[#6E6E73] dark:text-white/60">
          We could not find a product matching <span className="font-mono text-[#1D1D1F] dark:text-white">{handle}</span>.
        </p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 h-[38px] px-[18px] rounded-full bg-[#06C] text-white text-[14px] font-normal hover:bg-[#0077ED] dark:bg-[#2997FF] dark:hover:bg-[#47A9FF] transition"
        >
          <ArrowLeft className="h-4 w-4" /> Back to products
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
      {/* ── Apple-style sub-nav: slim, translucent, centered breadcrumb ── */}
      <div className="sticky top-14 z-20 bg-white/80 backdrop-blur-xl border-b border-[#D2D2D7]/60 dark:bg-[#0A0A0A]/80 dark:border-white/10">
        <div className="max-w-[1024px] mx-auto px-6 h-11 flex items-center justify-between">
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-[12px] text-[#6E6E73] hover:text-[#1D1D1F] dark:text-white/60 dark:hover:text-white transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All products
          </Link>
          <div className="flex items-center gap-3">
            {divisionName && (
              <div className="hidden md:flex items-center gap-1.5 text-[12px] text-[#6E6E73] dark:text-white/60">
                <span>{divisionName}</span>
                {categoryName && <><span className="text-[#D2D2D7] dark:text-white/20">/</span><span>{categoryName}</span></>}
                {subcategoryName && <><span className="text-[#D2D2D7] dark:text-white/20">/</span><span className="text-[#1D1D1F] dark:text-white font-medium">{subcategoryName}</span></>}
              </div>
            )}
            <Link
              href={`/products/${product.id}/edit`}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-[#D2D2D7] bg-white hover:bg-[#F5F5F7] text-[11px] text-[#1D1D1F] dark:border-white/15 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-white transition"
            >
              <Pencil className="h-3 w-3" /> Edit
            </Link>
          </div>
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

          {/* Price + primary CTAs — Apple style inline */}
          <div className="mt-6 md:mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-[17px] md:text-[19px] font-normal">
            {priceFrom !== null && (
              <span className="text-[#1D1D1F] dark:text-white">
                From <span className="font-medium">{fmtMoney(priceFrom)}</span>
              </span>
            )}
            <a
              href="#models"
              className="inline-flex items-center h-[36px] md:h-[38px] px-[18px] rounded-full bg-[#06C] text-white text-[14px] md:text-[15px] font-normal hover:bg-[#0077ED] dark:bg-[#2997FF] dark:hover:bg-[#47A9FF] transition-colors"
            >
              Buy
            </a>
            <a
              href="#specs"
              className="inline-flex items-center gap-1 text-[#06C] dark:text-[#2997FF] hover:underline text-[14px] md:text-[17px]"
            >
              Learn more <ChevronRight className="h-3.5 w-3.5 mt-0.5" />
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
                <ImageIcon className="h-20 w-20 text-[#86868B] dark:text-white/30" />
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
                  <Factory className="h-4 w-4 text-[#06C] dark:text-[#2997FF]" />
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
                  <Scissors className="h-4 w-4 text-[#06C] dark:text-[#2997FF]" />
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
                  <Layers className="h-4 w-4 text-[#06C] dark:text-[#2997FF]" />
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
                g.group === "Performance" ? Gauge :
                g.group === "Mechanical" ? Factory :
                g.group === "Electrical" ? Zap :
                (g.group === "Physical" || g.group === "Physical / Installation") ? Ruler :
                g.group === "Needle & Thread" ? Target :
                Wrench;
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
                    <Wrench className="h-4 w-4 text-[#06C] dark:text-[#2997FF]" />
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
                        <Sparkles className="h-3 w-3" /> Best Choice
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
                          <ImageIcon className="h-12 w-12" />
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
                            <Check className="h-2.5 w-2.5 mr-1 text-[#06C] dark:text-[#2997FF]" /> Head only
                          </span>
                        )}
                        {m.supports_complete_set && (
                          <span className="text-[11px] px-2.5 h-6 inline-flex items-center rounded-full bg-[#F5F5F7] dark:bg-white/[0.05] text-[#1D1D1F] dark:text-white/80">
                            <Check className="h-2.5 w-2.5 mr-1 text-[#06C] dark:text-[#2997FF]" /> Complete set
                          </span>
                        )}
                      </div>

                      {/* Commercial info */}
                      {(m.moq || m.lead_time || m.supplier) && (
                        <dl className="mt-5 pt-5 border-t border-[#D2D2D7]/60 dark:border-white/[0.08] text-[12px] space-y-1.5">
                          {m.supplier && (
                            <div className="flex justify-between">
                              <dt className="text-[#86868B] dark:text-white/40">Supplier</dt>
                              <dd className="text-[#1D1D1F] dark:text-white/75 truncate ml-2">{m.supplier}</dd>
                            </div>
                          )}
                          {m.moq && (
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
                                  <Package className="h-3 w-3" /> Packaging
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
                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
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
                        <Icon className="h-9 w-9 text-[#06C] dark:text-[#2997FF]" strokeWidth={1.4} />
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
                  <Play className="h-4 w-4 text-[#06C] dark:text-[#2997FF]" fill="currentColor" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-[#86868B] dark:text-white/45 mb-1">Video</p>
                  <p className="text-[16px] font-semibold text-[#1D1D1F] dark:text-white leading-[1.25] tracking-[-0.01em]">{v.alt_text || "Product video"}</p>
                  <p className="text-[13px] text-[#06C] dark:text-[#2997FF] mt-2 inline-flex items-center gap-1 group-hover:underline">
                    Watch now <ExternalLink className="h-3 w-3" />
                  </p>
                </div>
              </a>
            ))}
            {manuals.map(m => (
              <a key={m.id} href={m.url} target="_blank" rel="noreferrer"
                 className="group flex items-start gap-5 p-7 rounded-[22px] bg-white dark:bg-white/[0.03] dark:border dark:border-white/10 transition-all duration-300 hover:scale-[1.01]">
                <div className="h-12 w-12 rounded-full bg-[#F5F5F7] dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-[#06C] dark:text-[#2997FF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-[#86868B] dark:text-white/45 mb-1">PDF manual</p>
                  <p className="text-[16px] font-semibold text-[#1D1D1F] dark:text-white leading-[1.25] tracking-[-0.01em]">{m.alt_text || "Technical manual"}</p>
                  <p className="text-[13px] text-[#06C] dark:text-[#2997FF] mt-2 inline-flex items-center gap-1 group-hover:underline">
                    Download <Download className="h-3 w-3" />
                  </p>
                </div>
              </a>
            ))}
            {otherDocs.map(d => (
              <a key={d.id} href={d.url} target="_blank" rel="noreferrer"
                 className="group flex items-start gap-5 p-7 rounded-[22px] bg-white dark:bg-white/[0.03] dark:border dark:border-white/10 transition-all duration-300 hover:scale-[1.01]">
                <div className="h-12 w-12 rounded-full bg-[#F5F5F7] dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                  <ImageIcon className="h-4 w-4 text-[#06C] dark:text-[#2997FF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-[#86868B] dark:text-white/45 mb-1 capitalize">{d.type.replace(/_/g, " ")}</p>
                  <p className="text-[16px] font-semibold text-[#1D1D1F] dark:text-white leading-[1.25] tracking-[-0.01em] capitalize">{(d.alt_text || d.type).replace(/_/g, " ")}</p>
                  <p className="text-[13px] text-[#06C] dark:text-[#2997FF] mt-2 inline-flex items-center gap-1 group-hover:underline">
                    View <ExternalLink className="h-3 w-3" />
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
                        <ImageIcon className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    {rp.brand && (
                      <p className="text-[12px] font-medium text-[#86868B] dark:text-white/40 mb-1">{rp.brand}</p>
                    )}
                    <p className="text-[16px] font-semibold text-[#1D1D1F] dark:text-white leading-[1.2] line-clamp-2 tracking-[-0.01em]">{rp.product_name}</p>
                    <p className="mt-3 inline-flex items-center gap-1 text-[13px] text-[#06C] dark:text-[#2997FF] group-hover:underline">
                      Learn more <ChevronRight className="h-3 w-3" />
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
              Contact sales <ChevronRight className="h-4 w-4 mt-0.5" />
            </Link>
            <a
              href="#models"
              className="inline-flex items-center gap-1 text-[#06C] dark:text-[#2997FF] text-[17px] font-normal hover:underline"
            >
              Review models <ChevronRight className="h-4 w-4 mt-0.5" />
            </a>
          </div>
          <div className="mt-12 flex items-center justify-center gap-4 text-[12px] text-[#86868B] dark:text-white/40">
            <span className="inline-flex items-center gap-1.5">
              <Boxes className="h-3 w-3" />
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
                  <ShieldCheck className="h-3 w-3" /> {product.warranty}
                </span>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
