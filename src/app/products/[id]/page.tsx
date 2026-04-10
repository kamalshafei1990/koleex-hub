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
  id, eyebrow, title, subtitle, children, className = "", align = "left",
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  align?: "left" | "center";
}) {
  const headerAlign = align === "center" ? "text-center mx-auto max-w-3xl" : "";
  return (
    <section id={id} className={`py-20 md:py-32 ${className}`}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        {(eyebrow || title || subtitle) && (
          <div className={`mb-12 md:mb-16 ${headerAlign}`}>
            {eyebrow && (
              <div className="inline-flex items-center gap-3 mb-4">
                <span className="h-px w-8 bg-white/30" />
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/60">
                  {eyebrow}
                </p>
              </div>
            )}
            {title && (
              <h2 className="text-[34px] md:text-[52px] lg:text-[60px] font-semibold tracking-[-0.02em] text-white leading-[1.02]">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-5 text-[16px] md:text-[18px] text-white/60 leading-relaxed max-w-2xl">
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
          1. HERO — premium layout
          Image dominates left (7/12 ≈ 58%), content right (5/12)
          Subtle radial glow behind the product for depth.
          ══════════════════════════════════════ */}
      <section className="relative pt-14 md:pt-20 pb-16 md:pb-24 overflow-hidden">
        {/* Ambient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-[15%] -translate-y-1/2 h-[60vw] w-[60vw] max-h-[900px] max-w-[900px] rounded-full bg-white/[0.025] blur-[120px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0A0A0A]" />
        </div>

        <div className="max-w-7xl mx-auto px-6 lg:px-10 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* LEFT: dominant product image (7/12 on desktop) */}
            <div className="lg:col-span-7 order-2 lg:order-1">
              <div className="relative">
                {/* Subtle radial behind the product */}
                <div className="absolute inset-0 rounded-[40px] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08),transparent_70%)] pointer-events-none" />
                <div className="relative aspect-[5/4] md:aspect-[4/3] lg:aspect-[5/4] rounded-[32px] overflow-hidden bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-transparent border border-white/10">
                  {mainImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={mainImage}
                      alt={product.product_name}
                      className="absolute inset-0 w-full h-full object-contain p-10 md:p-16 lg:p-20 drop-shadow-[0_25px_50px_rgba(0,0,0,0.5)]"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-white/20">
                      <ImageIcon className="h-20 w-20" />
                    </div>
                  )}
                </div>

                {/* Floating badges over the image (desktop only) */}
                <div className="hidden lg:flex absolute top-6 left-6 flex-col gap-2">
                  {product.featured && (
                    <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-amber-400/15 border border-amber-400/40 backdrop-blur-md text-amber-300 text-[10px] font-bold uppercase tracking-[0.15em]">
                      <Sparkles className="h-3 w-3" /> Featured
                    </span>
                  )}
                  {product.level && (
                    <span className="inline-flex items-center h-7 px-3 rounded-full bg-white/[0.08] border border-white/15 backdrop-blur-md text-[10px] font-bold uppercase tracking-[0.15em] text-white/90">
                      {product.level} tier
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: headline content (5/12 on desktop) */}
            <div className="lg:col-span-5 order-1 lg:order-2">
              {/* Brand eyebrow */}
              {product.brand && (
                <div className="inline-flex items-center gap-3 mb-6">
                  <span className="h-px w-8 bg-white/30" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/60">
                    {product.brand}
                  </span>
                </div>
              )}

              {/* Product name — large, confident */}
              <h1 className="text-[42px] md:text-[56px] lg:text-[60px] xl:text-[68px] font-semibold leading-[0.98] tracking-[-0.025em] text-white">
                {product.product_name}
              </h1>

              {/* Model identifier — subtle but visible */}
              {primaryModel?.model_name && primaryModel.model_name !== product.product_name && (
                <p className="mt-4 text-[13px] md:text-[14px] font-mono uppercase tracking-[0.12em] text-white/50">
                  Model · {primaryModel.model_name}
                </p>
              )}

              {/* Tagline */}
              {primaryModel?.tagline && (
                <p className="mt-5 text-[17px] md:text-[19px] text-white/75 leading-[1.55] font-light">
                  {primaryModel.tagline}
                </p>
              )}

              {/* 3-4 highlight bullets — refined with icons */}
              {heroHighlights.length > 0 && (
                <ul className="mt-8 space-y-3">
                  {heroHighlights.slice(0, 4).map((h, i) => (
                    <li key={i} className="flex items-start gap-3 text-[14px] md:text-[15px] text-white/90">
                      <span className="mt-[5px] h-4 w-4 rounded-full border border-white/25 bg-white/[0.04] flex items-center justify-center shrink-0">
                        <Check className="h-2.5 w-2.5 text-white/80" strokeWidth={3} />
                      </span>
                      <span className="leading-snug">{h}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Price + CTAs */}
              <div className="mt-10 pt-8 border-t border-white/10">
                {priceFrom !== null && (
                  <div className="mb-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45 mb-1">Starting at</p>
                    <p className="text-[32px] md:text-[36px] font-semibold text-white leading-none tracking-tight">{fmtMoney(priceFrom)}</p>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="#models"
                    className="inline-flex items-center gap-2 h-12 px-7 rounded-full bg-white text-black text-[14px] font-semibold hover:bg-white/90 hover:scale-[1.02] transition-all"
                  >
                    Explore models <ChevronRight className="h-4 w-4" />
                  </a>
                  <a
                    href="#specs"
                    className="inline-flex items-center gap-2 h-12 px-7 rounded-full border border-white/20 text-white text-[14px] font-medium hover:bg-white/5 hover:border-white/30 transition"
                  >
                    Specifications
                  </a>
                </div>
              </div>

              {/* Meta ribbon — warranty / origin */}
              {(product.warranty || product.country_of_origin) && (
                <div className="mt-8 flex flex-wrap items-center gap-5 text-[12px] text-white/55">
                  {product.warranty && (
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>{product.warranty} warranty</span>
                    </div>
                  )}
                  {product.country_of_origin && (
                    <div className="flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5" />
                      <span>Made in {product.country_of_origin}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          2. IMAGE GALLERY
          Large main image + thumbnail strip. Zoom-on-hover on desktop.
          ══════════════════════════════════════ */}
      {galleryImages.length > 1 && (
        <Section eyebrow="Gallery" title="Every angle." className="bg-white/[0.015]">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_140px] gap-6">
            <div className="group relative aspect-[4/3] md:aspect-[16/10] rounded-[28px] overflow-hidden bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-transparent border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={galleryImages[activeImageIdx]?.id}
                src={galleryImages[activeImageIdx]?.url}
                alt={galleryImages[activeImageIdx]?.alt_text || product.product_name}
                className="absolute inset-0 w-full h-full object-contain p-10 md:p-14 transition-transform duration-[800ms] ease-out group-hover:scale-[1.08] animate-in fade-in duration-500"
              />
              {/* Image counter */}
              <div className="absolute bottom-5 right-5 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-[11px] font-medium text-white/90">
                {activeImageIdx + 1} / {galleryImages.length}
              </div>
            </div>
            <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto lg:max-h-[520px] pb-2 lg:pb-0 lg:pr-2">
              {galleryImages.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImageIdx(idx)}
                  className={`relative shrink-0 h-24 w-24 lg:h-[120px] lg:w-full rounded-2xl overflow-hidden border-2 transition-all duration-300 ${
                    idx === activeImageIdx
                      ? "border-white shadow-[0_8px_30px_rgba(255,255,255,0.15)] scale-[1.02]"
                      : "border-white/10 hover:border-white/40 opacity-70 hover:opacity-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="w-full h-full object-contain p-3 bg-white/[0.02]" />
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
        <section className="py-20 md:py-32">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-3 mb-6">
              <span className="h-px w-8 bg-white/30" />
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/60">About</p>
              <span className="h-px w-8 bg-white/30" />
            </div>
            <div
              className="prose prose-invert max-w-none text-[20px] md:text-[24px] text-white/80 leading-[1.55] font-light tracking-[-0.005em] [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_strong]:text-white [&_p]:mb-6"
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
          6. TECHNICAL SPECS — each group as its own card
          ══════════════════════════════════════ */}
      {(commonSpecsRendered.length > 0 || templateSpecsRendered.length > 0 || genericSpecsRendered.length > 0) && (
        <Section id="specs" eyebrow="Specifications" title="Built to a standard." className="bg-white/[0.015]">
          {activeTemplate && (
            <div className="mb-10 inline-flex items-center gap-2.5 px-5 h-10 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-sm text-[12px] text-white/85">
              <span className="text-base">{activeTemplate.icon}</span>
              <span className="font-semibold">{activeTemplate.name}</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                  className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent p-7 md:p-8 hover:border-white/20 transition-all"
                >
                  <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/10">
                    <div className="h-10 w-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
                      <GroupIcon className="h-4 w-4 text-white/85" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-0.5">
                        Group
                      </p>
                      <h3 className="text-[17px] font-semibold text-white leading-none">
                        {g.group}
                      </h3>
                    </div>
                  </div>
                  <dl className="space-y-0">
                    {g.rows.map(({ field, value }, idx) => (
                      <div
                        key={field.key}
                        className={`flex justify-between items-center gap-4 py-3 ${idx < g.rows.length - 1 ? "border-b border-white/[0.06]" : ""}`}
                      >
                        <dt className="text-[13px] text-white/55">{field.label}</dt>
                        <dd className="text-[13px] text-white text-right font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}

            {genericSpecsRendered.length > 0 && (
              <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent p-7 md:p-8 md:col-span-2 hover:border-white/20 transition-all">
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/10">
                  <div className="h-10 w-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
                    <Wrench className="h-4 w-4 text-white/85" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-0.5">
                      Group
                    </p>
                    <h3 className="text-[17px] font-semibold text-white leading-none">
                      Additional
                    </h3>
                  </div>
                </div>
                <dl className="grid grid-cols-1 md:grid-cols-2 md:gap-x-10">
                  {genericSpecsRendered.map(({ key, value }, idx) => (
                    <div key={key} className={`flex justify-between items-center gap-4 py-3 ${idx < genericSpecsRendered.length - 1 ? "border-b border-white/[0.06]" : ""}`}>
                      <dt className="text-[13px] text-white/55 capitalize">{key.replace(/_/g, " ")}</dt>
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
          7. MODELS / VARIANTS — premium product cards
          Each card: image · Best Choice badge (first) · name · tagline
          · key specs preview (3-4 lines) · price · SKU · expand
          ══════════════════════════════════════ */}
      {models.length > 0 && (
        <Section
          id="models"
          eyebrow={`${models.length} variant${models.length === 1 ? "" : "s"}`}
          title="Choose your model."
          className="bg-white/[0.015]"
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
                    className={`group relative rounded-[32px] overflow-hidden border transition-all flex flex-col ${
                      isBestChoice
                        ? "border-white/25 bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-white/[0.01] shadow-[0_20px_60px_-20px_rgba(255,255,255,0.1)]"
                        : "border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] hover:border-white/25"
                    }`}
                  >
                    {/* Best Choice ribbon */}
                    {isBestChoice && (
                      <div className="absolute top-5 left-5 z-10 inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white text-black text-[10px] font-bold uppercase tracking-[0.15em]">
                        <Sparkles className="h-3 w-3" /> Best Choice
                      </div>
                    )}

                    {/* Image area */}
                    <div className="aspect-[4/3] relative overflow-hidden bg-gradient-to-b from-white/[0.03] to-transparent">
                      {modelPhoto || mainImage ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={modelPhoto?.url || mainImage!}
                          alt={m.model_name}
                          className="absolute inset-0 w-full h-full object-contain p-8 group-hover:scale-[1.06] transition-transform duration-700 ease-out"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-white/20">
                          <ImageIcon className="h-12 w-12" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-6 flex flex-col flex-1 border-t border-white/5">
                      {/* Name + price row */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[20px] font-semibold text-white tracking-tight truncate leading-tight">
                            {m.model_name}
                          </h3>
                          {m.tagline && (
                            <p className="text-[13px] text-white/55 mt-1.5 line-clamp-2 leading-relaxed">
                              {m.tagline}
                            </p>
                          )}
                        </div>
                        {price !== null && (
                          <div className="text-right shrink-0">
                            <p className="text-[9px] text-white/40 uppercase tracking-[0.15em] font-bold">From</p>
                            <p className="text-[20px] font-semibold text-white tracking-tight leading-none mt-0.5">
                              {fmtMoney(price)}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Key spec preview — 3-4 lines */}
                      {keySpecs.length > 0 && (
                        <dl className="mt-5 space-y-2">
                          {keySpecs.slice(0, 4).map(s => (
                            <div key={s.label} className="flex items-baseline justify-between gap-3 text-[12px]">
                              <dt className="text-white/45 capitalize">{s.label}</dt>
                              <dd className="text-white/90 font-medium text-right capitalize">{s.value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}

                      {/* Config badges */}
                      <div className="mt-5 flex flex-wrap gap-1.5">
                        {m.sku && (
                          <span className="text-[10px] px-2 h-5 inline-flex items-center rounded border border-white/10 bg-white/[0.03] text-white/60 font-mono tracking-tight">
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

                      {/* Commercial info */}
                      {(m.moq || m.lead_time || m.supplier) && (
                        <dl className="mt-5 pt-5 border-t border-white/5 text-[11px] space-y-1.5">
                          {m.supplier && (
                            <div className="flex justify-between">
                              <dt className="text-white/40">Supplier</dt>
                              <dd className="text-white/75 truncate ml-2">{m.supplier}</dd>
                            </div>
                          )}
                          {m.moq && (
                            <div className="flex justify-between">
                              <dt className="text-white/40">MOQ</dt>
                              <dd className="text-white/75">{m.moq}</dd>
                            </div>
                          )}
                          {m.lead_time && (
                            <div className="flex justify-between">
                              <dt className="text-white/40">Lead time</dt>
                              <dd className="text-white/75">{m.lead_time}</dd>
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
                              <div className="pt-5 border-t border-white/5">
                                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/45 mb-3 flex items-center gap-1.5">
                                  <Package className="h-3 w-3" /> Packaging
                                </p>
                                <dl className="text-[11px] space-y-1.5">
                                  {m.weight && (
                                    <div className="flex justify-between">
                                      <dt className="text-white/40">Weight</dt>
                                      <dd className="text-white/80">{m.weight} kg</dd>
                                    </div>
                                  )}
                                  {m.cbm && (
                                    <div className="flex justify-between">
                                      <dt className="text-white/40">Volume</dt>
                                      <dd className="text-white/80">{m.cbm} m³</dd>
                                    </div>
                                  )}
                                  {m.packing_type && (
                                    <div className="flex justify-between">
                                      <dt className="text-white/40">Packing</dt>
                                      <dd className="text-white/80 truncate ml-2">{m.packing_type}</dd>
                                    </div>
                                  )}
                                  {m.box_include && (
                                    <div className="pt-1">
                                      <dt className="text-white/40 mb-0.5">Box includes</dt>
                                      <dd className="text-white/80 leading-snug">{m.box_include}</dd>
                                    </div>
                                  )}
                                  {m.extra_accessories && (
                                    <div className="pt-1">
                                      <dt className="text-white/40 mb-0.5">Accessories</dt>
                                      <dd className="text-white/80 leading-snug">{m.extra_accessories}</dd>
                                    </div>
                                  )}
                                  {m.reference_model && (
                                    <div className="flex justify-between">
                                      <dt className="text-white/40">Reference</dt>
                                      <dd className="text-white/80 font-mono">{m.reference_model}</dd>
                                    </div>
                                  )}
                                  {m.barcode && (
                                    <div className="flex justify-between">
                                      <dt className="text-white/40">Barcode</dt>
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
                            className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70 hover:text-white transition self-start"
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
          9. MEDIA / DOWNLOADS — premium resource cards
          ══════════════════════════════════════ */}
      {(videos.length > 0 || manuals.length > 0 || otherDocs.length > 0) && (
        <Section eyebrow="Resources" title="Dig deeper.">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {videos.map(v => (
              <a key={v.id} href={v.url} target="_blank" rel="noreferrer"
                 className="group flex items-start gap-5 p-7 rounded-[24px] border border-white/10 bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent hover:border-white/25 hover:from-white/[0.06] transition-all">
                <div className="h-14 w-14 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/[0.1] transition">
                  <Play className="h-5 w-5 text-white" fill="currentColor" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45 mb-1.5">Video</p>
                  <p className="text-[15px] font-semibold text-white leading-tight">{v.alt_text || "Product video"}</p>
                  <p className="text-[12px] text-white/55 mt-2 flex items-center gap-1">
                    Watch now <ExternalLink className="h-3 w-3" />
                  </p>
                </div>
              </a>
            ))}
            {manuals.map(m => (
              <a key={m.id} href={m.url} target="_blank" rel="noreferrer"
                 className="group flex items-start gap-5 p-7 rounded-[24px] border border-white/10 bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent hover:border-white/25 hover:from-white/[0.06] transition-all">
                <div className="h-14 w-14 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/[0.1] transition">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45 mb-1.5">PDF manual</p>
                  <p className="text-[15px] font-semibold text-white leading-tight">{m.alt_text || "Technical manual"}</p>
                  <p className="text-[12px] text-white/55 mt-2 flex items-center gap-1">
                    Download <Download className="h-3 w-3" />
                  </p>
                </div>
              </a>
            ))}
            {otherDocs.map(d => (
              <a key={d.id} href={d.url} target="_blank" rel="noreferrer"
                 className="group flex items-start gap-5 p-7 rounded-[24px] border border-white/10 bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent hover:border-white/25 hover:from-white/[0.06] transition-all">
                <div className="h-14 w-14 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/[0.1] transition">
                  <ImageIcon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45 mb-1.5 capitalize">{d.type.replace(/_/g, " ")}</p>
                  <p className="text-[15px] font-semibold text-white leading-tight capitalize">{(d.alt_text || d.type).replace(/_/g, " ")}</p>
                  <p className="text-[12px] text-white/55 mt-2 flex items-center gap-1">
                    View <ExternalLink className="h-3 w-3" />
                  </p>
                </div>
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* ══════════════════════════════════════
          10. RELATED PRODUCTS — clean cards
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
                  className="group rounded-[24px] overflow-hidden border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent hover:border-white/30 hover:from-white/[0.08] transition-all"
                >
                  <div className="aspect-[4/3] bg-gradient-to-b from-white/[0.03] to-transparent relative overflow-hidden">
                    {img ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={img} alt={rp.product_name}
                           className="absolute inset-0 w-full h-full object-contain p-6 group-hover:scale-[1.08] transition-transform duration-700 ease-out" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-white/20">
                        <ImageIcon className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  <div className="p-5 border-t border-white/5">
                    {rp.brand && (
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40 mb-1.5">{rp.brand}</p>
                    )}
                    <p className="text-[15px] font-semibold text-white leading-tight line-clamp-2">{rp.product_name}</p>
                    <p className="mt-3 inline-flex items-center gap-1 text-[11px] text-white/55 group-hover:text-white transition">
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
          11. FINAL CTA — big closing statement
          ══════════════════════════════════════ */}
      <section className="relative py-24 md:py-36 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[60vw] w-[60vw] max-h-[700px] max-w-[700px] rounded-full bg-white/[0.03] blur-[140px]" />
        </div>
        <div className="max-w-4xl mx-auto px-6 text-center relative">
          <div className="inline-flex items-center gap-3 mb-6">
            <span className="h-px w-8 bg-white/30" />
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/60">Let&apos;s talk</p>
            <span className="h-px w-8 bg-white/30" />
          </div>
          <h2 className="text-[38px] md:text-[56px] lg:text-[64px] font-semibold tracking-[-0.02em] text-white leading-[1.02]">
            Ready to elevate<br />your production line?
          </h2>
          <p className="mt-6 text-[17px] md:text-[19px] text-white/60 leading-relaxed max-w-xl mx-auto font-light">
            Our specialists will help you select the right {product.product_name} configuration for your factory.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/contacts"
              className="inline-flex items-center gap-2 h-12 px-8 rounded-full bg-white text-black text-[14px] font-semibold hover:bg-white/90 hover:scale-[1.02] transition-all"
            >
              Contact sales <ChevronRight className="h-4 w-4" />
            </Link>
            <a
              href="#models"
              className="inline-flex items-center gap-2 h-12 px-8 rounded-full border border-white/20 text-white text-[14px] font-medium hover:bg-white/5 hover:border-white/30 transition"
            >
              Review models
            </a>
          </div>
          <div className="mt-12 flex items-center justify-center gap-4 text-[11px] text-white/40">
            <span className="inline-flex items-center gap-1.5">
              <Boxes className="h-3 w-3" />
              {models.length} model{models.length === 1 ? "" : "s"}
            </span>
            {product.hs_code && (
              <>
                <span className="h-1 w-1 rounded-full bg-white/20" />
                <span className="font-mono">HS {product.hs_code}</span>
              </>
            )}
            {product.warranty && (
              <>
                <span className="h-1 w-1 rounded-full bg-white/20" />
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
