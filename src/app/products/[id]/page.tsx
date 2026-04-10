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
  id, eyebrow, title, children, className = "",
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`py-16 md:py-24 ${className}`}>
      <div className="max-w-6xl mx-auto px-6">
        {(eyebrow || title) && (
          <div className="mb-10 md:mb-14">
            {eyebrow && (
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-ghost)] mb-3">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="text-[32px] md:text-[48px] font-semibold tracking-tight text-[var(--text-primary)] leading-[1.05]">
                {title}
              </h2>
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
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--text-dim)] text-[13px]">
          <div className="h-4 w-4 rounded-full border-2 border-[var(--text-ghost)] border-t-transparent animate-spin" />
          Loading product…
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="h-16 w-16 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center">
          <ImageIcon className="h-7 w-7 text-[var(--text-ghost)]" />
        </div>
        <h1 className="text-[22px] font-semibold text-[var(--text-primary)]">Product not found</h1>
        <p className="text-[13px] text-[var(--text-dim)]">
          We could not find a product matching <span className="font-mono text-[var(--text-muted)]">{handle}</span>.
        </p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition"
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
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* ── Top admin bar (back + edit) ── */}
      <div className="sticky top-14 z-20 bg-[#0A0A0A]/85 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between">
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-dim)] hover:text-white transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All products
          </Link>
          <div className="flex items-center gap-2">
            {divisionName && (
              <div className="hidden md:flex items-center gap-1.5 text-[11px] text-[var(--text-ghost)]">
                <span>{divisionName}</span>
                {categoryName && <><ChevronRight className="h-3 w-3" /><span>{categoryName}</span></>}
                {subcategoryName && <><ChevronRight className="h-3 w-3" /><span className="text-emerald-400 font-medium">{subcategoryName}</span></>}
              </div>
            )}
            <Link
              href={`/products/${product.id}/edit`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-[12px] text-white transition"
            >
              <Pencil className="h-3 w-3" /> Edit
            </Link>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          1. HERO
          ══════════════════════════════════════ */}
      <section className="relative pt-16 md:pt-24 pb-10 md:pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
            {/* Left: headline */}
            <div className="lg:col-span-6">
              {product.brand && (
                <div className="inline-flex items-center gap-2 mb-5">
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-ghost)]">
                    {product.brand}
                  </span>
                </div>
              )}
              <h1 className="text-[40px] md:text-[64px] lg:text-[72px] font-semibold leading-[1.02] tracking-[-0.02em] text-white">
                {product.product_name}
              </h1>
              {primaryModel?.tagline && (
                <p className="mt-5 text-[18px] md:text-[22px] text-[var(--text-dim)] leading-relaxed max-w-xl">
                  {primaryModel.tagline}
                </p>
              )}

              {/* Hero highlight bullets (derived from real specs) */}
              {heroHighlights.length > 0 && (
                <ul className="mt-7 space-y-2.5 max-w-xl">
                  {heroHighlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-3 text-[14px] md:text-[15px] text-white/85">
                      <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-white/70 shrink-0" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-3">
                {product.featured && (
                  <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-[11px] font-bold uppercase tracking-wider">
                    <Sparkles className="h-3 w-3" /> Featured
                  </span>
                )}
                {product.level && (
                  <span className="inline-flex items-center h-7 px-3 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold uppercase tracking-wider text-white/80">
                    {product.level} tier
                  </span>
                )}
                {product.warranty && (
                  <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white/5 border border-white/10 text-[11px] text-white/80">
                    <ShieldCheck className="h-3 w-3" /> {product.warranty}
                  </span>
                )}
                {product.country_of_origin && (
                  <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white/5 border border-white/10 text-[11px] text-white/80">
                    <Globe className="h-3 w-3" /> {product.country_of_origin}
                  </span>
                )}
              </div>

              {/* CTAs */}
              <div className="mt-10 flex flex-wrap items-center gap-3">
                {priceFrom !== null && (
                  <div className="mr-2">
                    <p className="text-[11px] uppercase tracking-wider text-[var(--text-ghost)]">From</p>
                    <p className="text-[28px] font-semibold text-white">{fmtMoney(priceFrom)}</p>
                  </div>
                )}
                <a
                  href="#models"
                  className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-white text-black text-[14px] font-semibold hover:opacity-90 transition"
                >
                  Explore models <ChevronRight className="h-4 w-4" />
                </a>
                <a
                  href="#specs"
                  className="inline-flex items-center gap-2 h-11 px-6 rounded-full border border-white/15 text-white text-[14px] font-medium hover:bg-white/5 transition"
                >
                  Full specifications
                </a>
              </div>
            </div>

            {/* Right: main image */}
            <div className="lg:col-span-6">
              <div className="relative aspect-square md:aspect-[4/5] rounded-3xl overflow-hidden bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10">
                {mainImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={mainImage}
                    alt={product.product_name}
                    className="absolute inset-0 w-full h-full object-contain p-8 md:p-16"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-white/20">
                    <ImageIcon className="h-16 w-16" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          2. IMAGE GALLERY
          ══════════════════════════════════════ */}
      {galleryImages.length > 1 && (
        <Section eyebrow="Gallery" title="Every angle." className="bg-white/[0.015]">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_120px] gap-6">
            <div className="relative aspect-[4/3] md:aspect-[16/10] rounded-3xl overflow-hidden bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={galleryImages[activeImageIdx]?.url}
                alt={galleryImages[activeImageIdx]?.alt_text || product.product_name}
                className="absolute inset-0 w-full h-full object-contain p-10"
              />
            </div>
            <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto lg:max-h-[460px]">
              {galleryImages.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImageIdx(idx)}
                  className={`relative shrink-0 h-24 w-24 lg:h-[100px] lg:w-full rounded-xl overflow-hidden border-2 transition-all ${
                    idx === activeImageIdx
                      ? "border-white shadow-lg"
                      : "border-white/10 hover:border-white/30"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="w-full h-full object-contain p-2 bg-white/[0.02]" />
                </button>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* ══════════════════════════════════════
          3. PRODUCT DESCRIPTION (prose)
          ══════════════════════════════════════ */}
      {product.description && (
        <section className="py-16 md:py-24">
          <div className="max-w-3xl mx-auto px-6">
            <div
              className="prose prose-invert max-w-none text-center text-[18px] md:text-[22px] text-[var(--text-muted)] leading-[1.6] font-light [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_strong]:text-white [&_p]:mb-5"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════
          4. KEY FEATURES (icon grid)
          ══════════════════════════════════════ */}
      {keyFeatures.length > 0 && (
        <Section eyebrow="Key features" title="Engineered to perform." className="bg-white/[0.015]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {keyFeatures.map((f, i) => (
              <div
                key={i}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-7 md:p-8 hover:border-white/25 transition-all"
              >
                <div className="h-11 w-11 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-white/90 mb-6 group-hover:bg-white/[0.1] transition">
                  {f.icon}
                </div>
                <h3 className="text-[20px] md:text-[22px] font-semibold text-white tracking-tight leading-tight">
                  {f.title}
                </h3>
                {f.value && (
                  <p className="mt-1.5 text-[13px] font-medium text-[var(--text-dim)]">{f.value}</p>
                )}
                <p className="mt-3 text-[14px] text-[var(--text-dim)] leading-relaxed">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ══════════════════════════════════════
          5. SEWING MACHINE OVERVIEW
          Three labeled blocks: Machine Type · Main Function · Application
          ══════════════════════════════════════ */}
      {(activeTemplate || subcategoryName || tags.length > 0) && (
        <Section eyebrow="Machine overview" title="Designed for your line.">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Machine Type */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 flex flex-col min-h-[240px]">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
                  <Factory className="h-4 w-4 text-white/80" />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-ghost)]">
                  Machine Type
                </p>
              </div>
              <h3 className="text-[24px] md:text-[26px] font-semibold text-white leading-tight tracking-tight">
                {activeTemplate?.icon ? `${activeTemplate.icon} ` : ""}
                {activeTemplate?.name || subcategoryName || "Industrial Sewing Machine"}
              </h3>
              {categoryName && (
                <p className="mt-auto pt-4 text-[12px] text-[var(--text-dim)]">
                  {categoryName}
                </p>
              )}
            </div>

            {/* Main Function */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 flex flex-col min-h-[240px]">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
                  <Scissors className="h-4 w-4 text-white/80" />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-ghost)]">
                  Main Function
                </p>
              </div>
              <p className="text-[17px] md:text-[18px] text-white/90 leading-[1.5] font-light">
                {activeTemplate?.description ||
                  primaryModel?.tagline ||
                  `${product.product_name} delivers industrial-grade performance for professional sewing lines.`}
              </p>
            </div>

            {/* Application */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 flex flex-col min-h-[240px]">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
                  <Layers className="h-4 w-4 text-white/80" />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-ghost)]">
                  Application
                </p>
              </div>
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tags.slice(0, 8).map(t => (
                    <span
                      key={t}
                      className="inline-flex items-center h-7 px-3 rounded-full border border-white/10 bg-white/[0.04] text-[12px] text-white/85 capitalize"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[15px] text-[var(--text-dim)]">
                  General-purpose industrial sewing across garment production lines.
                </p>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* ══════════════════════════════════════
          4. TECHNICAL SPECS (grouped)
          ══════════════════════════════════════ */}
      {(commonSpecsRendered.length > 0 || templateSpecsRendered.length > 0 || genericSpecsRendered.length > 0) && (
        <Section id="specs" eyebrow="Specifications" title="Built to a standard." className="bg-white/[0.015]">
          {activeTemplate && (
            <div className="mb-8 inline-flex items-center gap-2 px-4 h-9 rounded-full border border-white/10 bg-white/[0.03] text-[12px] text-white/80">
              <span>{activeTemplate.icon}</span>
              <span className="font-semibold">{activeTemplate.name}</span>
            </div>
          )}
          <div className="space-y-10">
            {[...commonSpecsRendered, ...templateSpecsRendered].map((g) => (
              <div key={g.group}>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-ghost)] mb-4 flex items-center gap-2">
                  {g.group === "Performance" && <Zap className="h-3 w-3" />}
                  {g.group === "Mechanical" && <Factory className="h-3 w-3" />}
                  {g.group === "Electrical" && <Zap className="h-3 w-3" />}
                  {(g.group === "Physical" || g.group === "Physical / Installation") && <Ruler className="h-3 w-3" />}
                  {g.group}
                </h3>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                  {g.rows.map(({ field, value }) => (
                    <div
                      key={field.key}
                      className="flex justify-between gap-4 py-3 border-b border-white/5"
                    >
                      <dt className="text-[13px] text-[var(--text-dim)]">{field.label}</dt>
                      <dd className="text-[13px] text-white text-right font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}

            {genericSpecsRendered.length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-ghost)] mb-4">
                  Additional
                </h3>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                  {genericSpecsRendered.map(({ key, value }) => (
                    <div key={key} className="flex justify-between gap-4 py-3 border-b border-white/5">
                      <dt className="text-[13px] text-[var(--text-dim)] capitalize">{key.replace(/_/g, " ")}</dt>
                      <dd className="text-[13px] text-white text-right font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ══════════════════════════════════════
          7. MODELS / VARIANTS
          ══════════════════════════════════════ */}
      {models.length > 0 && (
        <Section id="models" eyebrow={`${models.length} variant${models.length === 1 ? "" : "s"}`} title="Choose your model." className="bg-white/[0.015]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {models
              .filter(m => m.visible !== false)
              .map(m => {
                const modelPhoto = media.find(md => md.model_id === m.id && (md.type === "main_image" || md.type === "gallery"));
                const price = m.global_price ?? m.head_only_price ?? m.complete_set_price ?? null;
                const isExpanded = !!expandedModels[m.id];
                const hasDetails = Boolean(
                  m.weight || m.cbm || m.packing_type || m.box_include || m.extra_accessories || m.barcode || m.reference_model
                );
                return (
                  <div key={m.id} className="group relative rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] hover:border-white/25 transition-all flex flex-col">
                    <div className="aspect-[4/3] bg-white/[0.02] relative">
                      {modelPhoto || mainImage ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={modelPhoto?.url || mainImage!}
                          alt={m.model_name}
                          className="absolute inset-0 w-full h-full object-contain p-6 group-hover:scale-[1.03] transition-transform duration-500"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-white/20">
                          <ImageIcon className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-[17px] font-semibold text-white truncate">{m.model_name}</h3>
                          {m.tagline && (
                            <p className="text-[12px] text-[var(--text-dim)] mt-1 line-clamp-2">{m.tagline}</p>
                          )}
                        </div>
                        {price !== null && (
                          <div className="text-right shrink-0">
                            <p className="text-[10px] text-[var(--text-ghost)] uppercase tracking-wider">From</p>
                            <p className="text-[15px] font-semibold text-white">{fmtMoney(price)}</p>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {m.sku && (
                          <span className="text-[10px] px-2 h-5 inline-flex items-center rounded border border-white/10 bg-white/[0.03] text-white/60 font-mono">
                            {m.sku}
                          </span>
                        )}
                        {m.supports_head_only && (
                          <span className="text-[10px] px-2 h-5 inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] text-white/70">
                            <Check className="h-2.5 w-2.5 mr-1" /> Head only
                          </span>
                        )}
                        {m.supports_complete_set && (
                          <span className="text-[10px] px-2 h-5 inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] text-white/70">
                            <Check className="h-2.5 w-2.5 mr-1" /> Complete set
                          </span>
                        )}
                      </div>

                      {(m.moq || m.lead_time || m.supplier) && (
                        <dl className="mt-4 pt-4 border-t border-white/5 text-[11px] space-y-1">
                          {m.supplier && (
                            <div className="flex justify-between">
                              <dt className="text-[var(--text-ghost)]">Supplier</dt>
                              <dd className="text-white/80 truncate ml-2">{m.supplier}</dd>
                            </div>
                          )}
                          {m.moq && (
                            <div className="flex justify-between">
                              <dt className="text-[var(--text-ghost)]">MOQ</dt>
                              <dd className="text-white/80">{m.moq}</dd>
                            </div>
                          )}
                          {m.lead_time && (
                            <div className="flex justify-between">
                              <dt className="text-[var(--text-ghost)]">Lead time</dt>
                              <dd className="text-white/80">{m.lead_time}</dd>
                            </div>
                          )}
                        </dl>
                      )}

                      {/* Expand details */}
                      {hasDetails && (
                        <>
                          <div
                            className={`grid transition-all duration-300 ease-out ${
                              isExpanded ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0"
                            }`}
                          >
                            <div className="overflow-hidden">
                              <div className="pt-4 border-t border-white/5">
                                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-ghost)] mb-2 flex items-center gap-1.5">
                                  <Package className="h-3 w-3" /> Packaging
                                </p>
                                <dl className="text-[11px] space-y-1">
                                  {m.weight && (
                                    <div className="flex justify-between">
                                      <dt className="text-[var(--text-ghost)]">Weight</dt>
                                      <dd className="text-white/80">{m.weight} kg</dd>
                                    </div>
                                  )}
                                  {m.cbm && (
                                    <div className="flex justify-between">
                                      <dt className="text-[var(--text-ghost)]">Volume</dt>
                                      <dd className="text-white/80">{m.cbm} m³</dd>
                                    </div>
                                  )}
                                  {m.packing_type && (
                                    <div className="flex justify-between">
                                      <dt className="text-[var(--text-ghost)]">Packing</dt>
                                      <dd className="text-white/80 truncate ml-2">{m.packing_type}</dd>
                                    </div>
                                  )}
                                  {m.box_include && (
                                    <div className="pt-1">
                                      <dt className="text-[var(--text-ghost)] mb-0.5">Box includes</dt>
                                      <dd className="text-white/80 leading-snug">{m.box_include}</dd>
                                    </div>
                                  )}
                                  {m.extra_accessories && (
                                    <div className="pt-1">
                                      <dt className="text-[var(--text-ghost)] mb-0.5">Accessories</dt>
                                      <dd className="text-white/80 leading-snug">{m.extra_accessories}</dd>
                                    </div>
                                  )}
                                  {m.reference_model && (
                                    <div className="flex justify-between">
                                      <dt className="text-[var(--text-ghost)]">Reference</dt>
                                      <dd className="text-white/80 font-mono">{m.reference_model}</dd>
                                    </div>
                                  )}
                                  {m.barcode && (
                                    <div className="flex justify-between">
                                      <dt className="text-[var(--text-ghost)]">Barcode</dt>
                                      <dd className="text-white/80 font-mono">{m.barcode}</dd>
                                    </div>
                                  )}
                                </dl>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleModel(m.id)}
                            className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/70 hover:text-white transition self-start"
                          >
                            {isExpanded ? "Hide details" : "Show details"}
                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </Section>
      )}

      {/* ══════════════════════════════════════
          8. APPLICATIONS (image-style cards)
          Use cases / Garment types / Fabric types.
          ══════════════════════════════════════ */}
      {tags.length > 0 && (
        <Section eyebrow="Applications" title="Where it performs.">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {tags.map(t => {
              const info = describeApplication(t);
              const Icon = info.icon;
              return (
                <div
                  key={t}
                  className="group relative aspect-[4/5] rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-transparent hover:border-white/30 transition-all duration-300"
                >
                  {/* Subtle radial highlight */}
                  <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-white/[0.04] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className="relative h-full flex flex-col p-6">
                    {/* Large icon as visual anchor */}
                    <div className="flex-1 flex items-center justify-center">
                      <div className="h-20 w-20 rounded-3xl bg-white/[0.04] border border-white/10 flex items-center justify-center group-hover:bg-white/[0.08] group-hover:scale-105 transition-all duration-300">
                        <Icon className="h-9 w-9 text-white/85" strokeWidth={1.4} />
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-ghost)] mb-1.5">
                        {info.kind}
                      </p>
                      <h3 className="text-[18px] md:text-[20px] font-semibold text-white capitalize leading-tight">
                        {t}
                      </h3>
                      <p className="mt-2 text-[12px] text-[var(--text-dim)] leading-relaxed line-clamp-2">
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
          7. MEDIA / DOWNLOADS
          ══════════════════════════════════════ */}
      {(videos.length > 0 || manuals.length > 0 || otherDocs.length > 0) && (
        <Section eyebrow="Downloads" title="Resources.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {videos.map(v => (
              <a key={v.id} href={v.url} target="_blank" rel="noreferrer"
                 className="flex items-center gap-4 p-5 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition">
                <div className="h-11 w-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <Play className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-white truncate">{v.alt_text || "Product video"}</p>
                  <p className="text-[11px] text-[var(--text-dim)]">Video</p>
                </div>
                <ExternalLink className="h-4 w-4 text-[var(--text-ghost)]" />
              </a>
            ))}
            {manuals.map(m => (
              <a key={m.id} href={m.url} target="_blank" rel="noreferrer"
                 className="flex items-center gap-4 p-5 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition">
                <div className="h-11 w-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-white truncate">{m.alt_text || "Technical manual"}</p>
                  <p className="text-[11px] text-[var(--text-dim)]">PDF manual</p>
                </div>
                <Download className="h-4 w-4 text-[var(--text-ghost)]" />
              </a>
            ))}
            {otherDocs.map(d => (
              <a key={d.id} href={d.url} target="_blank" rel="noreferrer"
                 className="flex items-center gap-4 p-5 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition">
                <div className="h-11 w-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <ImageIcon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-white truncate capitalize">{(d.alt_text || d.type).replace(/_/g, " ")}</p>
                  <p className="text-[11px] text-[var(--text-dim)] capitalize">{d.type.replace(/_/g, " ")}</p>
                </div>
                <ExternalLink className="h-4 w-4 text-[var(--text-ghost)]" />
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* ══════════════════════════════════════
          8. RELATED PRODUCTS
          ══════════════════════════════════════ */}
      {related.length > 0 && (
        <Section eyebrow="You might also like" title="Related machines." className="bg-white/[0.015]">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {related.map(r => {
              const rp = relatedDetails[r.related_id];
              const img = relatedImages[r.related_id];
              if (!rp) return null;
              return (
                <Link
                  key={r.related_id}
                  href={`/products/${rp.slug || rp.id}`}
                  className="group rounded-2xl overflow-hidden border border-white/10 bg-white/[0.02] hover:border-white/25 transition-all"
                >
                  <div className="aspect-[4/3] bg-white/[0.02] relative">
                    {img ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={img} alt={rp.product_name}
                           className="absolute inset-0 w-full h-full object-contain p-5 group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-white/20">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-[13px] font-semibold text-white truncate">{rp.product_name}</p>
                    {rp.brand && (
                      <p className="text-[11px] text-[var(--text-dim)] mt-0.5">{rp.brand}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      {/* ══════════════════════════════════════
          9. FOOTER CTA
          ══════════════════════════════════════ */}
      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-[32px] md:text-[44px] font-semibold tracking-tight text-white leading-[1.05]">
            Ready to talk about {product.product_name}?
          </h2>
          <p className="mt-4 text-[15px] text-[var(--text-dim)]">
            Our product specialists will help you select the right configuration for your production line.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/contacts"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-white text-black text-[14px] font-semibold hover:opacity-90 transition"
            >
              Contact sales
            </Link>
            <Link
              href={`/products/${product.id}/edit`}
              className="inline-flex items-center gap-2 h-11 px-6 rounded-full border border-white/15 text-white text-[14px] font-medium hover:bg-white/5 transition"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit product
            </Link>
          </div>
          <div className="mt-10 flex items-center justify-center gap-2 text-[11px] text-[var(--text-ghost)]">
            <Boxes className="h-3 w-3" />
            <span>{models.length} model{models.length === 1 ? "" : "s"}</span>
            {product.hs_code && <><span>·</span><span className="font-mono">HS {product.hs_code}</span></>}
          </div>
        </div>
      </section>
    </div>
  );
}
