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
import { getCurrentUser } from "@/lib/auth-client";
import type { User } from "@supabase/supabase-js";
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
import BadgeCheckIcon from "@/components/icons/ui/BadgeCheckIcon";
import CogIcon from "@/components/icons/ui/CogIcon";
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
import {
  resolveSpecs,
  hasNewSpecSystem,
  type SpecCard as NewSpecCard,
  type SpecField as NewSpecField,
} from "@/lib/machine-specs";
import SpecGlyph from "@/lib/machine-specs/SpecGlyph";
import { FIELD_GLYPHS } from "@/lib/machine-specs/icons";
import { getKindBySlug } from "@/lib/machine-kinds";
import { IMG } from "@/lib/cdn";

/* ---------------- helpers ---------------- */

function formatFieldValue(field: TemplateField, raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (field.type === "boolean") return raw ? "Yes" : "No";
  if (field.type === "multi-select" && Array.isArray(raw)) {
    if (raw.length === 0) return null;
    // Map values back to labels when options are defined.
    const labels = raw.map((v) => {
      const opt = field.options?.find((o) => o.value === v);
      return opt ? opt.label : String(v);
    });
    return labels.join(", ");
  }
  if (field.type === "select" && field.options) {
    const opt = field.options.find(o => o.value === raw);
    return opt ? opt.label : String(raw);
  }
  const str = String(raw);
  return field.unit ? `${str} ${field.unit}` : str;
}

/* Three-dot priority cue used on the public spec sheet. Same visual
   language as the admin form — fewer dots = rarer spec. Tooltip text
   keeps it self-explanatory for customers who hover. */
function FrequencyDotsPublic({ tier }: { tier?: "essential" | "recommended" | "advanced" }) {
  if (!tier) return null;
  const filled = tier === "essential" ? 3 : tier === "recommended" ? 2 : 1;
  const tip =
    tier === "essential"
      ? "Very common spec"
      : tier === "recommended"
      ? "Common spec"
      : "Specialized";
  return (
    <span
      className="inline-flex items-center gap-[2px] mr-2 align-middle shrink-0"
      title={tip}
      aria-label={tip}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`block h-[5px] w-[5px] rounded-full ${
            i < filled ? "bg-[#FFB000] dark:bg-amber-400" : "bg-[#FFB000]/25 dark:bg-amber-400/20"
          }`}
        />
      ))}
    </span>
  );
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
    <section
      id={id}
      /* scroll-mt-24 keeps the section heading visible when an
         anchor link (#specs / #models / #config) jumps to it —
         without it, the sticky page chrome covers the title. */
      className={`py-20 md:py-28 scroll-mt-24 ${className}`}
    >
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

  /* Sticky in-page nav — slides in once the user scrolls past the
     hero. Threshold tied to viewport height so it lands consistently
     across screen sizes. Uses requestAnimationFrame to keep the
     scroll handler off the layout-thrash hot path. */
  /* Auth state for the per-action visibility rules — "Add to
     Quotation" is the one CTA that ONLY makes sense for an
     authenticated session. */
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  useEffect(() => {
    getCurrentUser().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  /* Compare list — sessionStorage-backed toggle so the customer can
     queue products for side-by-side review across pages. The full
     comparison view is a separate route; this page just owns the
     "in / not in" state for the button. */
  const [inCompare, setInCompare] = useState(false);
  const COMPARE_KEY = "kx:compare:products";
  useEffect(() => {
    if (!product || typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(COMPARE_KEY);
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      setInCompare(arr.includes(product.id));
    } catch { /* ignore */ }
  }, [product]);
  const toggleCompare = () => {
    if (!product || typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(COMPARE_KEY);
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      const next = arr.includes(product.id)
        ? arr.filter((x) => x !== product.id)
        : [...arr, product.id];
      window.sessionStorage.setItem(COMPARE_KEY, JSON.stringify(next));
      setInCompare(next.includes(product.id));
    } catch { /* ignore */ }
  };

  const [stickyNavVisible, setStickyNavVisible] = useState(false);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const threshold = Math.max(window.innerHeight * 0.6, 480);
        setStickyNavVisible(window.scrollY > threshold);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

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

      /* PERF: collapsed three sequential network rounds into two.
              Round 1 fires the product read in parallel with the
              taxonomy reads (taxonomy doesn't depend on the product).
              Round 2 fires models + media + specs + related in
              parallel (all need the product id, can't be earlier).
              Saves ~one full RTT (often 150–300ms on a cold load). */
      const [divs, cats, subs, p] = await Promise.all([
        fetchDivisions(),
        fetchCategories(),
        fetchSubcategories(),
        fetchProductByIdOrSlug(handle),
      ]);
      if (cancelled) return;
      setDivisions(divs); setCategories(cats); setSubcategories(subs);

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

      /* PERF: related products used to fan out two sequential
              Promise.alls (details, then media). Now a single
              Promise.all interleaves both — same number of network
              calls but one RTT shorter. */
      if (rel.length > 0) {
        const fanout = await Promise.all(
          rel.flatMap(r => [
            fetchProductByIdOrSlug(r.related_id),
            fetchMediaByProductId(r.related_id),
          ])
        );
        const detailsMap: Record<string, ProductRow> = {};
        const imgMap: Record<string, string> = {};
        rel.forEach((r, i) => {
          const detail = fanout[i * 2] as ProductRow | null;
          const mediaArr = fanout[i * 2 + 1] as ProductMediaRow[];
          if (detail) detailsMap[r.related_id] = detail;
          const main = mediaArr.find(m => m.type === "main_image") || mediaArr[0];
          if (main) imgMap[r.related_id] = main.url;
        });
        if (!cancelled) {
          setRelatedDetails(detailsMap);
          setRelatedImages(imgMap);
        }
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

  /* New three-tier spec system (lockstitch and any other family
     registered in machine-specs/resolver). Resolves the card stack
     for the product's subcategory + selected machine kind, then
     formats saved values from common_specs / template_specs into
     filled rows grouped by their visual `group` heading. Empty
     fields are dropped so customers only see what's been entered.

     Falls back to the legacy commonSpecsRendered + templateSpecsRendered
     path when the subcategory isn't yet in the new system. */
  const useNewSpecs = useMemo(
    () => hasNewSpecSystem(product?.subcategory_slug),
    [product?.subcategory_slug]
  );

  const newSpecsRendered = useMemo(() => {
    if (!useNewSpecs || !sewingSpecs || !product) return null;
    const kindSlug = (sewingSpecs.common_specs as Record<string, unknown> | undefined)?.machine_kind as string | undefined;
    const resolved = resolveSpecs(product.subcategory_slug, kindSlug);
    if (!resolved) return null;

    type Row = { field: NewSpecField; value: string };
    type GroupBlock = { group: string; rows: Row[] };
    type CardBlock = {
      source: "common" | "family" | "kind";
      title: string;
      subtitle?: string;
      groups: GroupBlock[];
      filled: number;
      total: number;
    };

    const blocks: CardBlock[] = [];
    for (const card of resolved.cards) {
      const isCommon = card.source === "common";
      const values = (
        isCommon
          ? (sewingSpecs.common_specs as Record<string, unknown> | null)
          : (sewingSpecs.template_specs as Record<string, unknown> | null)
      ) || {};

      // Group fields by their `group` attribute, keep insertion order.
      const groupMap = new Map<string, Row[]>();
      for (const f of card.fields) {
        const formatted = formatFieldValue(f as unknown as TemplateField, values[f.key]);
        if (formatted === null) continue;
        const g = f.group || "General";
        if (!groupMap.has(g)) groupMap.set(g, []);
        groupMap.get(g)!.push({ field: f, value: formatted });
      }
      const groups: GroupBlock[] = Array.from(groupMap.entries()).map(([group, rows]) => ({ group, rows }));
      const filled = groups.reduce((a, g) => a + g.rows.length, 0);
      if (filled === 0) continue;
      blocks.push({
        source: card.source,
        title: card.title,
        subtitle: card.subtitle,
        groups,
        filled,
        total: card.fields.length,
      });
    }
    return blocks;
  }, [useNewSpecs, sewingSpecs, product]);

  const activeKindForView = useMemo(() => {
    const slug = (sewingSpecs?.common_specs as Record<string, unknown> | undefined)?.machine_kind as string | undefined;
    return slug ? getKindBySlug(slug) : null;
  }, [sewingSpecs]);

  /* Technical & Compliance block — sources data from typed columns
     on `products` (no longer from common_specs jsonb). Same shape as
     the new-spec blocks so it composes into the spec sheet visually.
     Each subgroup (Electrical / Physical / Compliance) only renders
     if at least one of its fields is filled. */
  const technicalRendered = useMemo(() => {
    if (!product) return null;
    type Row = { label: string; value: string };
    type Group = { group: string; rows: Row[] };

    const elec: Row[] = [];
    if ((product.voltage?.length || 0) > 0) elec.push({ label: "Voltage", value: (product.voltage || []).join(" / ") });
    if ((product.frequency_hz?.length || 0) > 0) elec.push({ label: "Frequency", value: (product.frequency_hz || []).map((h) => `${h} Hz`).join(" / ") });
    if (product.motor_power_w !== null && product.motor_power_w !== undefined) elec.push({ label: "Motor Power", value: `${product.motor_power_w} W` });
    if (product.power_consumption_w !== null && product.power_consumption_w !== undefined) elec.push({ label: "Power Consumption", value: `${product.power_consumption_w} W` });
    if (product.phase) elec.push({ label: "Phase", value: product.phase === "single" ? "Single phase" : product.phase === "three" ? "Three phase" : product.phase });
    if ((product.plug_types?.length || 0) > 0) elec.push({ label: "Plug Types", value: (product.plug_types || []).join(", ") });

    const phys: Row[] = [];
    if (product.machine_dimensions) phys.push({ label: "Machine Dimensions", value: product.machine_dimensions });
    if (product.machine_weight_kg !== null && product.machine_weight_kg !== undefined) phys.push({ label: "Machine Weight", value: `${product.machine_weight_kg} kg` });

    const comp: Row[] = [];
    if (product.hs_code) comp.push({ label: "HS Code", value: product.hs_code });
    if (product.ip_rating) comp.push({ label: "IP Rating", value: product.ip_rating });
    if (product.operating_temp) comp.push({ label: "Operating Temp", value: product.operating_temp });
    if (product.ce_certified) comp.push({ label: "CE Certified", value: "Yes" });
    if (product.rohs_compliant) comp.push({ label: "RoHS Compliant", value: "Yes" });
    if ((product.colors?.length || 0) > 0) comp.push({ label: "Colors", value: (product.colors || []).join(", ") });

    const groups: Group[] = [];
    if (elec.length > 0) groups.push({ group: "Electrical", rows: elec });
    if (phys.length > 0) groups.push({ group: "Physical (Bare Machine)", rows: phys });
    if (comp.length > 0) groups.push({ group: "Compliance & Customs", rows: comp });

    if (groups.length === 0) return null;
    const filled = groups.reduce((a, g) => a + g.rows.length, 0);
    return { groups, filled };
  }, [product]);

  const keyFeatures = useMemo<KeyFeature[]>(
    () => (product ? deriveKeyFeatures(product, sewingSpecs) : []),
    [product, sewingSpecs],
  );

  const heroHighlights = useMemo<string[]>(
    () => (product ? deriveHeroHighlights(product, sewingSpecs) : []),
    [product, sewingSpecs],
  );

  /* Headline stat band under the hero — the four most quote-worthy
     facts presented as oversized typography. Pulls from the spec
     buckets only when their values exist, so empty data products
     show a smaller stat row instead of a half-filled one. */
  const headlineStats = useMemo<{ value: string; unit?: string; label: string; icon: React.ReactNode }[]>(() => {
    if (!product) return [];
    const cs = (sewingSpecs?.common_specs || {}) as Record<string, unknown>;
    const ts = (sewingSpecs?.template_specs || {}) as Record<string, unknown>;
    const out: { value: string; unit?: string; label: string; icon: React.ReactNode }[] = [];
    /* Icon size is locked to h-4 w-4 across the page so every chip
       (Quick Info + Specs group titles) reads identically. */
    const ic = "h-5 w-5";

    if (cs.max_sewing_speed) {
      out.push({
        value: Number(cs.max_sewing_speed).toLocaleString("en-US"),
        unit: "SPM",
        label: "Max sewing speed",
        icon: <GaugeIcon className={ic} />,
      });
    }
    const thickness = ts.hd_max_material_thickness_heavy ?? ts.ls_max_material_thickness;
    if (thickness) {
      out.push({
        value: String(thickness),
        unit: "mm",
        label: "Material thickness",
        icon: <LayersIcon className={ic} />,
      });
    }
    if (product.motor_power_w !== null && product.motor_power_w !== undefined) {
      out.push({
        value: String(product.motor_power_w),
        unit: "W",
        label: "Motor power",
        icon: <ZapIcon className={ic} />,
      });
    }
    if (product.warranty) {
      // Pull just the leading number ("3 years" → "3", "24 months" → "24")
      const m = product.warranty.match(/(\d+(?:\.\d+)?)/);
      const tail = product.warranty.replace(/^\s*\d+(?:\.\d+)?\s*/, "").trim();
      out.push({
        value: m ? m[1] : product.warranty,
        unit: m ? (tail || "yr") : undefined,
        label: "Warranty",
        icon: <ShieldCheckIcon className={ic} />,
      });
    }
    // Fallback if none of the headline stats are filled — try
    // stitch length max so the band still has substance.
    if (out.length < 2 && cs.stitch_length_max) {
      out.push({
        value: String(cs.stitch_length_max),
        unit: "mm",
        label: "Max stitch length",
        icon: <RulerIcon className={ic} />,
      });
    }
    return out.slice(0, 4);
  }, [product, sewingSpecs]);

  /* "At a glance" digest — the second-tier spec callout right
     under the headline band. Pulls 6-8 of the most useful facts
     (sewing speed, stitch length, motor, material capacity, voltage,
     weight, warranty, machine kind…) and presents them in one
     scannable card. Each row is { icon, label, value } so the
     render stays clean. Empty values are skipped. */
  const atGlanceRows = useMemo<{ icon: React.ReactNode; label: string; value: string }[]>(() => {
    if (!product) return [];
    const cs = (sewingSpecs?.common_specs || {}) as Record<string, unknown>;
    const ts = (sewingSpecs?.template_specs || {}) as Record<string, unknown>;
    const rows: { icon: React.ReactNode; label: string; value: string }[] = [];
    const ic = "h-5 w-5";

    if (cs.max_sewing_speed) rows.push({ icon: <GaugeIcon className={ic} />, label: "Max sewing speed", value: `${Number(cs.max_sewing_speed).toLocaleString("en-US")} SPM` });
    if (cs.stitch_length_max) rows.push({ icon: <RulerIcon className={ic} />, label: "Stitch length", value: `${cs.stitch_length_min ?? "0"}–${cs.stitch_length_max} mm` });
    if (cs.needle_system) rows.push({ icon: <ScissorsIcon className={ic} />, label: "Needle system", value: String(cs.needle_system) });
    if (cs.motor_type) rows.push({ icon: <CpuIcon className={ic} />, label: "Motor type", value: String(cs.motor_type).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) });
    if (product.motor_power_w) rows.push({ icon: <ZapIcon className={ic} />, label: "Motor power", value: `${product.motor_power_w} W` });
    const thickness = ts.hd_max_material_thickness_heavy ?? ts.ls_max_material_thickness;
    if (thickness) rows.push({ icon: <LayersIcon className={ic} />, label: "Max material thickness", value: `${thickness} mm` });
    if (product.voltage && product.voltage.length > 0) rows.push({ icon: <ZapIcon className={ic} />, label: "Voltage", value: product.voltage.join(" / ") });
    if (product.machine_weight_kg) rows.push({ icon: <PackageIcon className={ic} />, label: "Machine weight", value: `${product.machine_weight_kg} kg` });

    return rows;
  }, [product, sewingSpecs]);

  /* Flat category accordion source for the Specifications section.
     Folds the three-tier spec data (Universal / Family / Kind) and
     the Technical & Compliance block into a single ordered list of
     {category, rows} so the accordion can render Apple-style: one
     headline per category, expandable rows below. Empty categories
     drop out so customers never see "Mechanical (0)". */
  const specCategories = useMemo<{ category: string; rows: { label: string; value: string; glyph?: string }[] }[]>(() => {
    const map = new Map<string, { label: string; value: string; glyph?: string }[]>();

    if (newSpecsRendered) {
      for (const block of newSpecsRendered) {
        for (const g of block.groups) {
          const list = map.get(g.group) ?? [];
          for (const r of g.rows) list.push({ label: r.field.label, value: r.value, glyph: r.field.key });
          if (!map.has(g.group)) map.set(g.group, list);
        }
      }
    }
    if (technicalRendered) {
      for (const g of technicalRendered.groups) {
        const list = map.get(g.group) ?? [];
        for (const r of g.rows) list.push({ label: r.label, value: r.value });
        if (!map.has(g.group)) map.set(g.group, list);
      }
    }

    /* Curated category order so the accordion reads like a real
       Apple-style tech-specs page: customer-facing facts first,
       compliance + extras at the end. */
    const order = [
      "Performance", "Needle & Thread", "Mechanical", "Stitch & Feed",
      "Configuration", "Automation",
      "Walking-Foot Mechanism", "Long-Arm Geometry", "Cylinder Bed Geometry",
      "Post-Bed Geometry", "Feed-Off-Arm Geometry", "Zig-Zag Stitch",
      "Edge Trimmer", "Heavy-Duty Capacity",
      "Electrical", "Physical (Bare Machine)", "Material",
      "Application", "Compliance & Customs",
    ];
    const ordered: { category: string; rows: { label: string; value: string; glyph?: string }[] }[] = [];
    for (const k of order) {
      if (map.has(k)) ordered.push({ category: k, rows: map.get(k)! });
    }
    // Append any unknown categories at the end so we never lose data.
    for (const [k, rows] of map.entries()) {
      if (!order.includes(k)) ordered.push({ category: k, rows });
    }
    return ordered.filter((c) => c.rows.length > 0);
  }, [newSpecsRendered, technicalRendered]);

  /* Per-category open/closed state for the accordion. First category
     opens by default so the page never lands on a fully-collapsed
     Specifications section. */
  /* Tabbed spec presentation (per brief — tabs, not accordion).
     Maps the categorized data into 4 customer-facing buckets so the
     section never shows a long flat list. Each bucket is an array
     of {label, value} rows pulled from one or more underlying
     groups. Empty buckets drop out. */
  const specTabs = useMemo<{ id: string; label: string; rows: { label: string; value: string; glyph?: string }[] }[]>(() => {
    const bucketMap: Record<string, string[]> = {
      Performance: [
        "Performance", "Stitch & Feed", "Automation",
        "Walking-Foot Mechanism", "Long-Arm Geometry",
        "Cylinder Bed Geometry", "Post-Bed Geometry",
        "Feed-Off-Arm Geometry", "Zig-Zag Stitch",
        "Edge Trimmer", "Heavy-Duty Capacity",
      ],
      Mechanical: ["Mechanical", "Needle & Thread", "Configuration"],
      Electrical: ["Electrical"],
      Dimensions: ["Physical (Bare Machine)", "Material", "Application", "Compliance & Customs"],
    };
    const byCat = new Map(specCategories.map((c) => [c.category, c.rows] as const));
    const tabs: { id: string; label: string; rows: { label: string; value: string; glyph?: string }[] }[] = [];
    for (const [label, cats] of Object.entries(bucketMap)) {
      const rows: { label: string; value: string; glyph?: string }[] = [];
      for (const c of cats) {
        const r = byCat.get(c);
        if (r) rows.push(...r);
      }
      if (rows.length > 0) {
        tabs.push({ id: label.toLowerCase(), label, rows });
      }
    }
    return tabs;
  }, [specCategories]);

  // Spec sections are now all-visible (per the brief — no collapse,
  // no tabs). Active-tab state was here previously; removed.

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
      className="min-h-screen bg-white text-[#1D1D1F] dark:bg-[#0A0A0A] dark:text-white antialiased pb-24 md:pb-0"
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
          STICKY IN-PAGE NAV
          Appears once the user scrolls past the hero. Mirrors the
          pattern Apple, B&O, Dyson use on long product pages —
          gives customers a fast jump-link to any section + a
          persistent "Request Quote" CTA without reaching for the
          browser scroll bar. Backdrop-blur + slide-down on enter
          keeps it lightweight visually.
          ══════════════════════════════════════ */}
      <div
        aria-hidden={!stickyNavVisible}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          stickyNavVisible
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="bg-white/85 dark:bg-[#0A0A0A]/85 backdrop-blur-xl border-b border-[#D2D2D7]/60 dark:border-white/[0.08]">
          <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 h-12 md:h-14 flex items-center gap-3">
            {/* Product name — truncated to keep the bar a single line. */}
            <span className="text-[14px] md:text-[15px] font-semibold tracking-[-0.01em] text-[#1D1D1F] dark:text-white truncate max-w-[200px] md:max-w-[320px]">
              {product.product_name}
            </span>
            {/* Anchor links — desktop only. Reflects the actual
                section ids on the page (#overview / #features /
                #models / #specs). Each link only renders if its
                target section will actually be shown — no dead
                links if the underlying data is missing. */}
            <nav className="hidden md:flex items-center gap-5 ml-2 mr-auto text-[13px] text-[#1D1D1F]/80 dark:text-white/70">
              {(product.description || product.excerpt) && (
                <a href="#overview" className="hover:text-[#1D1D1F] dark:hover:text-white transition-colors">Overview</a>
              )}
              {(product.highlights && product.highlights.length > 0 && (galleryImages.length > 1 || mainImage)) && (
                <a href="#features" className="hover:text-[#1D1D1F] dark:hover:text-white transition-colors">Features</a>
              )}
              {models.length > 1 && (
                <a href="#models" className="hover:text-[#1D1D1F] dark:hover:text-white transition-colors">Models</a>
              )}
              {specTabs.length > 0 && (
                <a href="#specs" className="hover:text-[#1D1D1F] dark:hover:text-white transition-colors">Specs</a>
              )}
            </nav>
            {/* Spacer for mobile when nav is hidden — pushes CTA right. */}
            <div className="md:hidden flex-1" />
            {/* Primary CTA in the sticky nav mirrors the hero —
                "Estimate" routes to the landed-cost simulator,
                the page's main action. */}
            <Link
              href={`/landed-cost/new?productId=${product.id}`}
              className="inline-flex items-center h-8 md:h-9 px-3 md:px-4 rounded-full bg-[#06C] dark:bg-[#2997FF] text-white text-[12px] md:text-[13px] font-medium hover:bg-[#0077ED] dark:hover:bg-[#47A9FF] transition-colors shrink-0"
            >
              Estimate
            </Link>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          MOBILE STICKY CTA BAR
          Bottom-anchored on phones only. Once the user scrolls
          past the hero, this slides up and parks the two highest-
          intent actions inside thumb reach: Quote (full-width
          primary) + Estimate (icon-only secondary). Desktop is
          covered by the top sticky bar above.
          ══════════════════════════════════════ */}
      <div
        aria-hidden={!stickyNavVisible}
        className={`md:hidden fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ${
          stickyNavVisible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-[#D2D2D7]/60 dark:border-white/[0.08] px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          {/* Two-button cluster: primary fills, secondary fixed-width
              square so the row reads as one tight cell. */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setRqResult(null); setRqQty(1); setRqNotes(""); setRqOpen(true); }}
              className="flex-1 h-11 rounded-full bg-[#06C] dark:bg-[#2997FF] text-white text-[14px] font-medium hover:bg-[#0077ED] dark:hover:bg-[#47A9FF] transition-colors"
            >
              Request Quote
            </button>
            <Link
              href={`/landed-cost/new?productId=${product.id}`}
              aria-label="Estimate total cost"
              className="inline-flex items-center justify-center h-11 w-11 rounded-full border border-[#1D1D1F]/15 dark:border-white/15 text-[#1D1D1F] dark:text-white hover:bg-[#1D1D1F]/[0.04] dark:hover:bg-white/[0.04] transition-colors"
            >
              <GaugeIcon className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          REDESIGNED PRODUCT PAGE — STRICT 6-SECTION LAYOUT

          Per design brief:
            1. HERO          — image LEFT (~58%), text RIGHT, minimal
            2. QUICK INFO    — 4-column scan block (label + value)
            3. OVERVIEW      — single column prose, max readable width
            4. FEATURES      — 2-col image+text visual rhythm
            5. SPECIFICATIONS— TABS (General/Performance/Electrical/Dim)
            6. CLEAN END     — minimal closing CTA, no clutter

          Strict tokens:
            · Spacing scale 8 / 16 / 32 / 64 px ONLY
            · Section padding py-32 (uniform 128 px every breakpoint)
            · Container max-w-[1200px] mx-auto px-6 lg:px-8
            · Body container max-w-[680px]
            · Card radius rounded-3xl
            · Surfaces alternate white ↔ #F5F5F7
          Typography:
            · Eyebrow:  12 px, semibold, uppercase, 0.1em tracking
            · H1:       56 / 72 / 88 px, semibold, -0.02em tracking
            · H2:       32 / 40 / 48 px, semibold, -0.018em tracking
            · Body lg:  18 / 20 px, leading 1.5
            · Body:     15 / 16 px, leading 1.6
            · Label:    12 px, semibold, uppercase
        ═══════════════════════════════════════════════════════════════ */}

      {/* SECTION 1 — HERO (image LEFT, text RIGHT) ────────────────
          · Title splits into MAIN (model code) + SUBTITLE (full
            descriptive name) — strong contrast in size and weight.
          · Image floats freely on a soft radial gradient — no card
            frame, no border, no surface. The product becomes the
            visual focal point of the section.
          ──────────────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-[#0A0A0A]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-32 md:py-32">
          {/* Hero grid — 8/4 (~67 / 33).
              Image is now the unambiguous anchor: section widened
              1320 → 1440 px and image column 7 → 8 (~+25 % wider
              than the previous pass). Text column dropped 5 → 4
              and constrained to a tight max-w-[400px] so the
              right side reads as a calm "label + caption +
              action" stack instead of a competing prose column. */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            <div className="order-1 lg:col-span-8">
              {/* Active hero photo. Sourced from galleryImages[
                  activeImageIdx] so the thumbnail strip below can
                  swap which image is currently displayed without
                  refetching anything. Falls back to mainImage if
                  the gallery is empty. */}
              <div className="relative w-full aspect-[5/4] flex items-center justify-center">
                {(galleryImages[activeImageIdx]?.url || mainImage) ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={galleryImages[activeImageIdx]?.url || mainImage || ""}
                    src={IMG.hero(galleryImages[activeImageIdx]?.url || mainImage || "")}
                    alt={galleryImages[activeImageIdx]?.alt_text || product.product_name}
                    className="relative max-w-full max-h-full object-contain transition-opacity duration-300"
                    decoding="async"
                    fetchPriority="high"
                  />
                ) : (
                  <ImageRawIcon className="h-20 w-20 text-[#86868B] dark:text-white/30" />
                )}
              </div>

              {/* Thumbnail strip — only renders when there's more
                  than one image. Caps at 6 visible thumbnails so
                  the row never wraps; remaining gallery photos can
                  be reached via keyboard arrows on the active
                  thumbnail. Active thumb gets a 2-px ring in the
                  brand blue + slight scale-up so the selection is
                  unmistakable. */}
              {galleryImages.length > 1 && (
                <div className="mt-6 flex items-center gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {galleryImages.slice(0, 6).map((img, i) => {
                    const active = i === activeImageIdx;
                    return (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => setActiveImageIdx(i)}
                        aria-label={`View image ${i + 1}`}
                        aria-pressed={active}
                        className={`group relative shrink-0 h-16 w-16 md:h-20 md:w-20 rounded-xl overflow-hidden transition-all ${
                          active
                            ? "ring-2 ring-[#06C] dark:ring-[#2997FF] scale-[1.04]"
                            : "ring-1 ring-[#D2D2D7]/70 dark:ring-white/[0.08] hover:ring-[#1D1D1F]/30 dark:hover:ring-white/30 opacity-75 hover:opacity-100"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={IMG.thumb(img.url)}
                          alt=""
                          className="absolute inset-0 w-full h-full object-contain p-1.5 bg-white dark:bg-white/[0.04]"
                          loading="lazy"
                          decoding="async"
                        />
                      </button>
                    );
                  })}
                  {galleryImages.length > 6 && (
                    <span className="shrink-0 text-[12px] text-[#86868B] dark:text-white/45 ml-1">
                      +{galleryImages.length - 6}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT — tight editorial column.
                col-span-4 with max-w-[400px]. Same width as the
                action block below it so the entire right side
                reads as a single 400-px column from eyebrow to
                Contact Sales — text content and buttons share
                the exact same left and right edges. */}
            <div className="order-2 lg:col-span-4 lg:max-w-[400px]">
              {/* ── Title block ──
                  Open spacing so each text line has its own beat:
                    Eyebrow → H1:           mt-8  (32)
                    H1 → subtitle:          mt-4  (16)
                    Subtitle → description: mt-4  (16)
                    Description → actions:  mt-10 (40)

                  H1 dropped one step (88 → 80 / 64 / 48) so the
                  text block reads quieter — image is now clearly
                  the visual anchor. Description type bumped down
                  to text-[14/15] muted so it supports the H1
                  rather than competing. */}
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#86868B] dark:text-white/45">
                {product.brand || "Koleex"}
              </p>
              {/* H1 weight stepped down semibold → medium and size
                  44/56/64 → 40/52/60 px so the title reads as calm
                  identity instead of a heavy headline. The image
                  already anchors the eye; the H1 just labels the
                  product. */}
              <h1 className="mt-8 text-[40px] md:text-[52px] lg:text-[60px] font-medium tracking-[-0.025em] leading-[1] text-[#1D1D1F] dark:text-white">
                {primaryModel?.model_name || product.product_name}
              </h1>
              {primaryModel?.model_name && product.product_name && primaryModel.model_name !== product.product_name && (
                <p className="mt-6 text-[15px] md:text-[16px] font-normal tracking-[-0.005em] leading-[1.5] text-[#6E6E73] dark:text-white/55">
                  {product.product_name}
                </p>
              )}
              {(primaryModel?.tagline || product.excerpt) && (
                <p className="mt-6 text-[14px] md:text-[15px] leading-[1.6] text-[#6E6E73] dark:text-white/55">
                  {primaryModel?.tagline || product.excerpt}
                </p>
              )}

              {/* ── Price chip ──
                  Small pill that gives the page a commitment: a
                  starting price if any model carries one, otherwise
                  the standard "Quote on request" line so customers
                  always see SOMETHING financial above the actions.
                  Sits between the description and the buttons so it
                  reads as a hand-off from "what is this" to "how do
                  I act". */}
              <div className="mt-6 inline-flex items-baseline gap-2 rounded-full bg-[#F5F5F7] dark:bg-white/[0.05] px-3.5 py-1.5">
                {priceFrom ? (
                  <>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#86868B] dark:text-white/45">
                      From
                    </span>
                    <span className="text-[15px] font-semibold tracking-[-0.01em] text-[#1D1D1F] dark:text-white">
                      ${new Intl.NumberFormat("en-US").format(priceFrom)}
                    </span>
                  </>
                ) : (
                  <span className="text-[12px] font-medium tracking-[-0.005em] text-[#6E6E73] dark:text-white/55">
                    Quote on request
                  </span>
                )}
              </div>

              {/* ── Action stack ──
                    Strict three-tier hierarchy:
                      MAIN row    — primary + 2 outline (max 3, per rule).
                      Helper text — small line under primary explaining
                                    where Calculate sends the customer.
                      Secondary   — Add to Quotation (only when logged in).
                      Support     — Contact Sales muted text link.
                    All buttons share the same h-11 height so the row
                    reads as one unit; primary is visually largest via
                    solid fill + shadow + heavier weight. */}
              {/* ═══ BUTTON BLOCK ═══════════════════════════════════
                  One dedicated container directly under the title
                  block. Three vertical layers stacked on the column's
                  left edge:

                    Layer 1  PRIMARY full-width — alone, strongest
                             visual weight.
                    Layer 2  SECONDARY 50/50 — Request Quote + Compare,
                             identical width via grid-cols-2.
                    Layer 3  SUPPORT — Contact Sales, tertiary text
                             link, visibly separated.

                  Spacing — explicit pixel values per brief:
                    · Title  → primary:          mt-10 (40 px)
                    · Primary → secondary:       mt-5  (20 px)
                    · Secondary → support:       mt-10 (40 px)
                    · Between secondary buttons: gap-4 (16 px)

                  All button-shaped controls: h-11, px-8, rounded-full,
                  text-[15px]. Visual hierarchy from fill + font
                  weight + shadow only. ────────────────────────────── */}
              <nav aria-label="Product actions" className="mt-12 w-full max-w-[400px]">
                {/* Layer 1 — PRIMARY (own row, w-full) */}
                <Link
                  href={`/landed-cost/new?productId=${product.id}`}
                  className="flex items-center justify-center w-full h-10 px-8 rounded-full bg-[#06C] dark:bg-[#2997FF] text-white text-[14px] font-medium hover:bg-[#0077ED] dark:hover:bg-[#47A9FF] transition-colors"
                >
                  Estimate Total Cost
                </Link>

                {/* Layer 2 — SECONDARY (mt-5 = 20 px, 50/50 grid). */}
                <div className="mt-5 grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => { setRqResult(null); setRqQty(1); setRqNotes(""); setRqOpen(true); }}
                    className="flex items-center justify-center w-full h-10 px-8 rounded-full border border-[#1D1D1F]/15 dark:border-white/15 bg-transparent text-[#1D1D1F] dark:text-white text-[14px] font-medium hover:border-[#1D1D1F]/40 dark:hover:border-white/35 hover:bg-[#1D1D1F]/[0.03] dark:hover:bg-white/[0.04] transition-colors"
                  >
                    Request Quotation
                  </button>
                  <button
                    type="button"
                    onClick={toggleCompare}
                    className={`flex items-center justify-center w-full h-10 px-8 rounded-full border text-[14px] font-medium transition-colors ${
                      inCompare
                        ? "border-[#06C] dark:border-[#2997FF] bg-[#06C]/[0.06] dark:bg-[#2997FF]/[0.12] text-[#06C] dark:text-[#2997FF]"
                        : "border-[#1D1D1F]/15 dark:border-white/15 bg-transparent text-[#1D1D1F] dark:text-white hover:border-[#1D1D1F]/40 dark:hover:border-white/35 hover:bg-[#1D1D1F]/[0.03] dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    {inCompare ? "Added to Compare" : "Compare"}
                  </button>
                </div>

                {/* Layer 3 — SUPPORT (mt-10 = 40 px large gap from
                    the secondary cluster). */}
                <div className="mt-10">
                  <Link
                    href="/contacts"
                    className="inline-flex items-center gap-2 text-[14px] text-[#6E6E73] dark:text-white/55 hover:text-[#1D1D1F] dark:hover:text-white transition-colors"
                  >
                    Contact Sales <AngleRightIcon className="h-5 w-5 mt-0.5" />
                  </Link>
                </div>
              </nav>

              {/* ── Trust strip ──
                  Tiny signal row at the bottom of the right column.
                  Closes the loop on "is this product legit?" before
                  the customer scrolls. Each badge only renders when
                  the underlying data exists — no empty cells, no
                  fake claims. Max 4 items so the row never wraps. */}
              {(product.ce_certified || product.rohs_compliant || product.warranty || product.lead_time || product.country_of_origin) && (
                <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-[12px] text-[#6E6E73] dark:text-white/55">
                  {product.ce_certified && (
                    <li className="inline-flex items-center gap-1.5">
                      <BadgeCheckIcon className="h-3.5 w-3.5 text-[#0F8A6E] dark:text-[#5DD0B4]" />
                      CE certified
                    </li>
                  )}
                  {product.rohs_compliant && (
                    <li className="inline-flex items-center gap-1.5">
                      <ShieldCheckIcon className="h-3.5 w-3.5 text-[#0F8A6E] dark:text-[#5DD0B4]" />
                      RoHS
                    </li>
                  )}
                  {product.warranty && (
                    <li className="inline-flex items-center gap-1.5">
                      <AwardIcon className="h-3.5 w-3.5 text-[#06C] dark:text-[#2997FF]" />
                      {product.warranty} warranty
                    </li>
                  )}
                  {product.lead_time && (
                    <li className="inline-flex items-center gap-1.5">
                      <PackageIcon className="h-3.5 w-3.5 text-[#A05A00] dark:text-[#FFB870]" />
                      Ships in {product.lead_time}
                    </li>
                  )}
                  {!product.lead_time && product.country_of_origin && (
                    <li className="inline-flex items-center gap-1.5">
                      <GlobeIcon className="h-3.5 w-3.5 text-[#86868B] dark:text-white/45" />
                      Made in {product.country_of_origin}
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 — QUICK INFO (4 cards, identical dimensions) ────
          Each item is now a real card with locked padding (p-8 =
          32 px) and h-full so they all line up to the tallest in
          the row. flex-col + space-y-4 between chip / label / value
          means baselines align even when label or value text
          wraps. Same chip, same icon, same alignment everywhere. */}
      {headlineStats.length >= 3 && (
        <section className="bg-[#F5F5F7] dark:bg-white/[0.02]">
          <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-32 md:py-32">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {headlineStats.map((s, i) => (
                <div
                  key={i}
                  className="h-full p-8 rounded-3xl bg-white dark:bg-white/[0.04] dark:border dark:border-white/[0.06] flex flex-col"
                >
                  <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-[#F5F5F7] dark:bg-white/[0.06] text-[#06C] dark:text-[#2997FF] shrink-0">
                    {s.icon}
                  </span>
                  {/* Label area — fixed minimum height so the value
                      block below baseline-aligns across all 4 cards
                      even when one label wraps to two lines. */}
                  <p className="mt-8 min-h-[36px] text-[12px] font-semibold uppercase tracking-[0.08em] leading-[1.5] text-[#86868B] dark:text-white/45">
                    {s.label}
                  </p>
                  {/* mt-auto pushes the value to the bottom of the
                      card so all 4 numbers sit on the same horizontal
                      line regardless of label length. */}
                  <div className="mt-auto flex items-baseline gap-2 flex-wrap">
                    <span className="text-[32px] md:text-[40px] lg:text-[44px] font-semibold tracking-[-0.02em] leading-none text-[#1D1D1F] dark:text-white">
                      {s.value}
                    </span>
                    {s.unit && (
                      <span className="text-[14px] md:text-[15px] text-[#86868B] dark:text-white/55">
                        {s.unit}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SECTION 3 — OVERVIEW (clean prose, max-width readable) ───── */}
      {(product.description || product.excerpt) && (
        <section id="overview" className="bg-white dark:bg-[#0A0A0A]">
          <div className="max-w-[680px] mx-auto px-6 py-32 md:py-32">
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#86868B] dark:text-white/45">
              Overview
            </p>
            <h2 className="mt-4 text-[32px] md:text-[40px] lg:text-[48px] font-semibold tracking-[-0.018em] leading-[1.1] text-[#1D1D1F] dark:text-white">
              The machine, in detail.
            </h2>
            {product.excerpt && (
              <p className="mt-8 text-[18px] md:text-[20px] leading-[1.6] text-[#1D1D1F] dark:text-white/85">
                {product.excerpt}
              </p>
            )}
            {product.description && (
              <div
                className="mt-8 text-[16px] leading-[1.7] text-[#6E6E73] dark:text-white/65 [&>p]:mb-4 [&>p:last-child]:mb-0 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-4 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:mb-4"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            )}
          </div>
        </section>
      )}

      {/* SECTION 4 — FEATURES (visual rhythm: text LEFT, image RIGHT) */}
      {(galleryImages.length > 1 || mainImage) && product.highlights && product.highlights.length > 0 && (
        <section id="features" className="bg-[#F5F5F7] dark:bg-white/[0.015]">
          <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-32 md:py-32">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">
              {/* LEFT — text */}
              <div className="lg:col-span-5 order-2 lg:order-1">
                <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#86868B] dark:text-white/45">
                  Engineered for the line
                </p>
                <h2 className="mt-4 text-[32px] md:text-[40px] lg:text-[48px] font-semibold tracking-[-0.018em] leading-[1.1] text-[#1D1D1F] dark:text-white">
                  Built for daily volume.
                </h2>
                <ul className="mt-8 space-y-4">
                  {product.highlights.slice(0, 5).map((h, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-4 text-[16px] md:text-[17px] text-[#1D1D1F] dark:text-white/85 leading-[1.55]"
                    >
                      <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] shrink-0 mt-0.5">
                        <CheckIcon className="h-5 w-5" />
                      </span>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
              {/* RIGHT — image */}
              <div className="lg:col-span-7 order-1 lg:order-2">
                <div className="relative w-full aspect-[5/4] rounded-3xl overflow-hidden bg-white dark:bg-white/[0.025] dark:border dark:border-white/[0.06]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={IMG.gallery(galleryImages[1]?.url || mainImage || "")}
                    alt=""
                    className="absolute inset-0 w-full h-full object-contain p-8"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── SECTION 4.5 — MODELS / VARIANTS ─────────────────────────
          Renders only when the product has 2+ visible models. Each
          model card carries its own image (model-scoped media if
          available, else the product's main image), name, tagline,
          pricing options (Head Only / Complete Set / Global), and a
          quick "Request Quote for this model" action. Customers use
          this block to pick the variant they actually want before
          they fire the quote. */}
      {models.filter((m) => m.visible).length > 1 && (
        <section id="models" className="bg-white dark:bg-[#0A0A0A]">
          <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-32 md:py-32">
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#86868B] dark:text-white/45">
              Models
            </p>
            <h2 className="mt-4 text-[32px] md:text-[40px] lg:text-[48px] font-semibold tracking-[-0.018em] leading-[1.1] text-[#1D1D1F] dark:text-white">
              Pick your variant.
            </h2>
            <p className="mt-4 max-w-[640px] text-[15px] md:text-[16px] leading-[1.6] text-[#6E6E73] dark:text-white/60">
              Available configurations of this model. Pricing, packing, and lead times vary by variant.
            </p>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {models.filter((m) => m.visible).map((m) => {
                const modelImage =
                  media.find((md) => md.model_id === m.id && (md.type === "main_image" || md.type === "gallery"))?.url ||
                  mainImage;
                const priceOptions: { label: string; value: number }[] = [];
                if (m.global_price) priceOptions.push({ label: "Global", value: m.global_price });
                if (m.head_only_price && m.supports_head_only) priceOptions.push({ label: "Head Only", value: m.head_only_price });
                if (m.complete_set_price && m.supports_complete_set) priceOptions.push({ label: "Complete Set", value: m.complete_set_price });
                const fmt = new Intl.NumberFormat("en-US");
                return (
                  <article
                    key={m.id}
                    className="group rounded-3xl bg-[#F5F5F7] dark:bg-white/[0.04] dark:border dark:border-white/[0.06] overflow-hidden flex flex-col transition-all duration-300 hover:bg-white dark:hover:bg-white/[0.06] hover:shadow-[0_6px_24px_rgba(0,0,0,0.06)] dark:hover:shadow-none hover:-translate-y-0.5"
                  >
                    {/* Image header — same aspect across all cards
                        so the row aligns visually. White inner so
                        the photo never inherits the gray surface. */}
                    <div className="relative w-full aspect-[4/3] bg-white dark:bg-white/[0.03]">
                      {modelImage ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={IMG.card(modelImage)}
                          alt={m.model_name}
                          className="absolute inset-0 w-full h-full object-contain p-6"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ImageRawIcon className="h-10 w-10 text-[#86868B] dark:text-white/30" />
                        </div>
                      )}
                      {/* Stock-status pill — only renders when the
                          model carries a status flag. */}
                      {m.stock_status && (
                        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-white/90 dark:bg-[#0A0A0A]/85 backdrop-blur-sm text-[10.5px] font-medium uppercase tracking-[0.06em] text-[#1D1D1F] dark:text-white">
                          <span className={`h-1.5 w-1.5 rounded-full ${m.stock_status.toLowerCase().includes("stock") || m.stock_status.toLowerCase() === "available" ? "bg-[#0F8A6E]" : "bg-[#A05A00]"}`} />
                          {m.stock_status}
                        </span>
                      )}
                    </div>

                    {/* Card body */}
                    <div className="p-6 flex flex-col flex-1">
                      <h3 className="text-[18px] md:text-[20px] font-semibold tracking-[-0.01em] text-[#1D1D1F] dark:text-white leading-[1.2]">
                        {m.model_name}
                      </h3>
                      {m.tagline && (
                        <p className="mt-2 text-[13px] md:text-[14px] leading-[1.5] text-[#6E6E73] dark:text-white/55 line-clamp-2">
                          {m.tagline}
                        </p>
                      )}

                      {/* Price stack — up to 3 small rows. Each
                          row: muted label + bold value. Skipped
                          entirely when the model has no prices. */}
                      {priceOptions.length > 0 && (
                        <dl className="mt-5 space-y-1.5">
                          {priceOptions.map((p) => (
                            <div key={p.label} className="flex items-baseline justify-between gap-3">
                              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B] dark:text-white/45">
                                {p.label}
                              </dt>
                              <dd className="text-[15px] font-semibold tracking-[-0.005em] text-[#1D1D1F] dark:text-white tabular-nums">
                                ${fmt.format(p.value)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}

                      {/* Meta row — MOQ / lead time, only when set. */}
                      {(m.moq || m.lead_time) && (
                        <ul className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] text-[#6E6E73] dark:text-white/55">
                          {m.moq != null && (
                            <li className="inline-flex items-center gap-1.5">
                              <BoxesIcon className="h-3.5 w-3.5" />
                              MOQ {m.moq}
                            </li>
                          )}
                          {m.lead_time && (
                            <li className="inline-flex items-center gap-1.5">
                              <PackageIcon className="h-3.5 w-3.5" />
                              {m.lead_time}
                            </li>
                          )}
                        </ul>
                      )}

                      {/* Spacer pushes the action to the bottom of
                          every card so the bottom edges align across
                          the row even when text is uneven. */}
                      <div className="mt-auto pt-6">
                        <button
                          type="button"
                          onClick={() => { setRqResult(null); setRqQty(1); setRqNotes(""); setRqOpen(true); }}
                          className="inline-flex items-center justify-center gap-1.5 h-9 px-5 rounded-full bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] text-[13px] font-medium hover:opacity-90 transition-opacity"
                        >
                          Request Quote
                          <AngleRightIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* SECTION 5 — SPECIFICATIONS (all-visible, grouped) ─────────
          Same chip system as Quick Info: h-10 w-10 rounded-xl with
          h-5 w-5 icon. H3 group titles at 22/26 — distinct scale
          from H2 above (32-48) and hero subtitle (18-20). More
          space between groups (space-y-16) for breathing room. */}
      {specTabs.length > 0 && (
        <section id="specs" className="bg-white dark:bg-[#0A0A0A]">
          <div className="max-w-[1080px] mx-auto px-6 lg:px-8 py-32 md:py-32">
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#86868B] dark:text-white/45">
              Specifications
            </p>
            <h2 className="mt-4 text-[32px] md:text-[40px] lg:text-[48px] font-semibold tracking-[-0.018em] leading-[1.1] text-[#1D1D1F] dark:text-white">
              All the details.
            </h2>

            {/* Per-group visual identity — each of the four buckets
                gets its own accent palette so the eye instantly reads
                Performance / Mechanical / Electrical / Dimensions as
                distinct chapters instead of one long list.

                  · chipBg / chipText  → tinted icon chip in header
                  · accentBar          → 3px vertical bar on each card
                  · accentText         → "Group 01 / 04" counter colour
                  · cardRing           → faint coloured hairline on cards
            */}
            {(() => null)()}
            <div className="mt-16 space-y-20">
              {specTabs.map((t, gi) => {
                type GroupStyle = {
                  Icon: typeof GaugeIcon;
                  chipBg: string;
                  chipText: string;
                  accentBar: string;
                  accentText: string;
                  cardRing: string;
                };
                const palette: Record<string, GroupStyle> = {
                  performance: {
                    Icon: GaugeIcon,
                    chipBg: "bg-[#E6F0FF] dark:bg-[#0B2A55]/60",
                    chipText: "text-[#06C] dark:text-[#7CB8FF]",
                    accentBar: "bg-[#06C] dark:bg-[#2997FF]",
                    accentText: "text-[#06C] dark:text-[#7CB8FF]",
                    cardRing: "ring-1 ring-[#06C]/[0.06] dark:ring-[#2997FF]/10",
                  },
                  mechanical: {
                    Icon: CogIcon,
                    chipBg: "bg-[#FFF1DC] dark:bg-[#3A2A0A]/60",
                    chipText: "text-[#A05A00] dark:text-[#FFB870]",
                    accentBar: "bg-[#A05A00] dark:bg-[#FFB870]",
                    accentText: "text-[#A05A00] dark:text-[#FFB870]",
                    cardRing: "ring-1 ring-[#A05A00]/[0.06] dark:ring-[#FFB870]/10",
                  },
                  electrical: {
                    Icon: ZapIcon,
                    chipBg: "bg-[#F0E8FF] dark:bg-[#251747]/60",
                    chipText: "text-[#7A33C9] dark:text-[#C7A6FF]",
                    accentBar: "bg-[#7A33C9] dark:bg-[#C7A6FF]",
                    accentText: "text-[#7A33C9] dark:text-[#C7A6FF]",
                    cardRing: "ring-1 ring-[#7A33C9]/[0.06] dark:ring-[#C7A6FF]/10",
                  },
                  dimensions: {
                    Icon: RulerIcon,
                    chipBg: "bg-[#E0F5EE] dark:bg-[#0F3A30]/60",
                    chipText: "text-[#0F8A6E] dark:text-[#5DD0B4]",
                    accentBar: "bg-[#0F8A6E] dark:bg-[#5DD0B4]",
                    accentText: "text-[#0F8A6E] dark:text-[#5DD0B4]",
                    cardRing: "ring-1 ring-[#0F8A6E]/[0.06] dark:ring-[#5DD0B4]/10",
                  },
                };
                const s = palette[t.id] ?? palette.performance;
                const Icon = s.Icon;
                const total = specTabs.length;
                const idx = String(gi + 1).padStart(2, "0");
                const totalStr = String(total).padStart(2, "0");
                return (
                  <div key={t.id}>
                    {/* Group header — tinted chip + counter + title +
                        coloured hairline that fades to neutral. The
                        counter (01 / 04) gives the section a sense of
                        progression and structure, not a flat list. */}
                    <div className="flex items-center gap-4">
                      <span className={`inline-flex items-center justify-center h-11 w-11 rounded-xl ${s.chipBg} ${s.chipText}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="flex-shrink-0">
                        <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] leading-none ${s.accentText}`}>
                          {idx}<span className="text-[#86868B] dark:text-white/40 font-medium">  /  {totalStr}</span>
                        </p>
                        <h3 className="mt-2 text-[22px] md:text-[26px] font-semibold tracking-[-0.01em] leading-[1.1] text-[#1D1D1F] dark:text-white">
                          {t.label}
                        </h3>
                      </div>
                      {/* Filler hairline — sits between the title and
                          the spec count to balance the header. Hidden
                          on small screens to keep things compact. */}
                      <span
                        aria-hidden
                        className="hidden md:block flex-1 h-px ml-3 bg-[#D2D2D7]/60 dark:bg-white/[0.06]"
                      />
                      <span className="hidden md:inline-flex items-baseline text-[11px] font-medium text-[#86868B] dark:text-white/45 tabular-nums">
                        <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${s.accentBar}`} aria-hidden />
                        {t.rows.length} specs
                      </span>
                    </div>

                    {/* Stat-card grid — each card carries a small
                        icon chip on top in the group's colour, then
                        the value, then the label. Refined type scale:
                        value at 20-24 px (down from 24-30 — was too
                        loud), label at 11.5 px (up from 10.5 — more
                        readable). min-h keeps rows aligned across
                        cards with very different value lengths. */}
                    <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {t.rows.map((r, i) => {
                        /* Per-spec icon: every spec gets its OWN
                           glyph instead of repeating the group icon.
                             1) New-spec rows carry a `glyph` key
                                that maps to a unique uicons entry
                                in FIELD_GLYPHS — render via
                                <SpecGlyph>.
                             2) Technical rows (Voltage / Frequency
                                / IP Rating / etc.) carry no glyph
                                key — fall back to a per-label icon
                                from the imported icon set.
                             3) If neither matches, use the group's
                                icon as a last resort. */
                        const techByLabel: Record<string, typeof GaugeIcon> = {
                          "Voltage": ZapIcon,
                          "Frequency": ActivityIcon,
                          "Motor Power": CpuIcon,
                          "Power Consumption": GaugeIcon,
                          "Phase": ZapIcon,
                          "Plug Types": ZapIcon,
                          "Machine Dimensions": RulerIcon,
                          "Machine Weight": PackageIcon,
                          "HS Code": TagsIcon,
                          "IP Rating": ShieldCheckIcon,
                          "Operating Temp": ActivityIcon,
                          "CE Certified": BadgeCheckIcon,
                          "RoHS Compliant": ShieldCheckIcon,
                          "Colors": SparklesIcon,
                        };
                        const hasGlyph = !!(r.glyph && FIELD_GLYPHS[r.glyph]);
                        const TechIcon = techByLabel[r.label];
                        return (
                          <div
                            key={`${t.id}-${r.label}-${i}`}
                            className={`group relative overflow-hidden rounded-2xl bg-[#F5F5F7] dark:bg-white/[0.035] ${s.cardRing} dark:border dark:border-white/[0.05] p-5 min-h-[124px] flex flex-col transition-all duration-300 hover:bg-white dark:hover:bg-white/[0.06] hover:shadow-[0_4px_18px_rgba(0,0,0,0.06)] dark:hover:shadow-none hover:-translate-y-0.5`}
                          >
                            {/* Per-spec icon chip in the group's hue. */}
                            <span className={`inline-flex items-center justify-center h-7 w-7 rounded-lg ${s.chipBg} ${s.chipText}`}>
                              {hasGlyph ? (
                                <SpecGlyph name={r.glyph!} size={14} className="h-3.5 w-3.5" />
                              ) : TechIcon ? (
                                <TechIcon className="h-3.5 w-3.5" />
                              ) : (
                                <Icon className="h-3.5 w-3.5" />
                              )}
                            </span>
                            {/* Value — refined display size. */}
                            <dd className="mt-auto pt-4 text-[20px] md:text-[22px] lg:text-[24px] font-semibold tracking-[-0.018em] text-[#1D1D1F] dark:text-white leading-[1.15]">
                              {r.value}
                            </dd>
                            {/* Caption label. */}
                            <dt className="mt-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#86868B] dark:text-white/45 leading-[1.3]">
                              {r.label}
                            </dt>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* SECTION 6 — CLEAN END (single closing band, no clutter) ──── */}
      <section className="bg-[#F5F5F7] dark:bg-white/[0.02]">
        <div className="max-w-[680px] mx-auto px-6 py-32 md:py-32 text-center">
          <h2 className="text-[28px] md:text-[36px] lg:text-[44px] font-semibold tracking-[-0.018em] leading-[1.15] text-[#1D1D1F] dark:text-white">
            Ready to put it on the line?
          </h2>
          <div className="mt-8">
            <button
              type="button"
              onClick={() => { setRqResult(null); setRqQty(1); setRqNotes(""); setRqOpen(true); }}
              className="inline-flex items-center h-12 px-8 rounded-full bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] text-[15px] font-medium hover:opacity-90 transition-opacity"
            >
              Request Quote
            </button>
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
