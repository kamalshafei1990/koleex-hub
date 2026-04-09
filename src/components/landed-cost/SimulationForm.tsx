"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, Loader2, Package, Ship, Truck, Building2,
  DollarSign, BarChart3, ChevronDown, ChevronUp, AlertTriangle,
  Globe, Users, FileText, Calculator, Boxes, Anchor, CircleDollarSign,
  Info, TrendingUp, Printer, CheckCircle2, HelpCircle, AlertCircle, Zap,
  Pencil, Lightbulb, Eye, EyeOff,
} from "lucide-react";
import {
  fetchSimulation, createSimulation, updateSimulation,
  fetchProductsForLookup, fetchModelsForProduct,
} from "@/lib/landed-cost-admin";
import { calculate, calculateDutyBreakdown, type DutyBreakdown } from "@/lib/landed-cost-calc";
import { findCountryDefaults, calcVolumetricWeight, calcChargeableWeight } from "@/lib/landed-cost-defaults";
import { useTranslation, type Lang } from "@/lib/i18n";
import { landedCostT } from "@/lib/translations/landed-cost";
import type {
  SimulationRow, ProductInfo, ExportCosts, ShippingCosts,
  ImportCosts, InlandDelivery, FinancialSettings, SimulationResults,
} from "@/lib/landed-cost-types";
import {
  DEFAULT_PRODUCT_INFO, DEFAULT_EXPORT_COSTS, DEFAULT_SHIPPING,
  DEFAULT_IMPORT_COSTS, DEFAULT_INLAND, DEFAULT_FINANCIAL,
} from "@/lib/landed-cost-types";

/* ═══════════════════ HELPERS ═══════════════════ */

function fmt(n: number, d = 2) { return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }

/* Price basis & loading hints are now served by t("hint.EXW") etc. from translations */

/* ═══════════════════ TAB NAVIGATION ═══════════════════ */

const TABS = [
  { key: "customer", label: "Customer", icon: Users },
  { key: "product", label: "Product", icon: Package },
  { key: "export", label: "Export", icon: Building2 },
  { key: "shipping", label: "Shipping", icon: Ship },
  { key: "import", label: "Import", icon: Anchor },
  { key: "inland", label: "Delivery", icon: Truck },
  { key: "financial", label: "Financial", icon: CircleDollarSign },
] as const;

type TabKey = typeof TABS[number]["key"];

/* ═══════════════════ SECTION COMPONENT ═══════════════════ */

function Section({ id, icon: Icon, title, description, subtotal, currency, badge, children, defaultOpen = true, forceOpen }: {
  id?: string; icon: React.ElementType; title: string; description?: string; subtotal?: number; currency?: string; badge?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);
  return (
    <div id={id} className={`bg-[var(--bg-secondary)] rounded-2xl border overflow-hidden transition-all duration-200 ${open ? "border-[var(--border-subtle)] shadow-[0_2px_16px_rgba(0,0,0,0.12)]" : "border-[var(--border-subtle)] hover:border-[var(--border-focus)]/30"} scroll-mt-28`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-[var(--bg-surface-subtle)]/50 transition-colors cursor-pointer">
        <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 text-start min-w-0">
          <span className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight">{title}</span>
          {description && !open && <p className="text-[11px] text-[var(--text-ghost)] mt-0.5 truncate">{description}</p>}
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {badge}
          {subtotal !== undefined && subtotal > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-inverted)]/[0.06] text-[11px] font-mono font-semibold text-[var(--text-primary)] tabular-nums">
              {currency} {fmt(subtotal)}
            </span>
          )}
          <div className={`h-6 w-6 rounded-lg flex items-center justify-center transition-colors ${open ? "bg-[var(--bg-inverted)]/[0.06]" : ""}`}>
            {open ? <ChevronUp className="h-3.5 w-3.5 text-[var(--text-ghost)]" /> : <ChevronDown className="h-3.5 w-3.5 text-[var(--text-ghost)]" />}
          </div>
        </div>
      </button>
      {open && (
        <div className="px-6 pb-6 pt-2 border-t border-[var(--border-subtle)]">
          {description && <p className="text-[11px] text-[var(--text-ghost)] mb-4 -mt-0.5">{description}</p>}
          {children}
        </div>
      )}
    </div>
  );
}

/* ── SubGroup ── */

function SubGroup({ label, icon: Icon, children }: { label: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="mt-5 pt-4 border-t border-[var(--border-subtle)]/60">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-ghost)] mb-3 flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </p>
      {children}
    </div>
  );
}

/* ── Section Subtotal Footer ── */

function SectionFooter({ label, value, currency }: { label: string; value: number; currency: string }) {
  if (value <= 0) return null;
  return (
    <div className="mt-4 pt-3 border-t border-dashed border-[var(--border-subtle)]/60 flex items-center justify-between">
      <span className="text-[11px] font-medium text-[var(--text-dim)]">{label}</span>
      <span className="text-[13px] font-bold font-mono text-[var(--text-primary)] tabular-nums">{currency} {fmt(value)}</span>
    </div>
  );
}

/* ═══════════════════ FIELD COMPONENTS ═══════════════════ */

type FieldState = "auto" | "manual" | "suggested";

const FIELD_BADGES: Record<FieldState, { bg: string; text: string; icon: React.ElementType; labelKey: string }> = {
  auto: { bg: "bg-blue-500/[0.08]", text: "text-blue-400", icon: Zap, labelKey: "auto" },
  manual: { bg: "bg-amber-500/[0.08]", text: "text-amber-400", icon: Pencil, labelKey: "edited" },
  suggested: { bg: "bg-emerald-500/[0.08]", text: "text-emerald-400", icon: Lightbulb, labelKey: "suggested" },
};

const FIELD_INPUT_STYLES: Record<FieldState, string> = {
  auto: "border-blue-500/20 bg-blue-500/[0.03]",
  manual: "border-amber-500/20 bg-amber-500/[0.03]",
  suggested: "border-emerald-500/20 bg-emerald-500/[0.03]",
};

const inputCls = "w-full h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] focus:bg-[var(--bg-inverted)]/[0.08] transition-all";
const selectCls = inputCls + " appearance-none cursor-pointer";
const labelCls = "block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5";

function Field({ label, hint, fieldState, warn, children, span = 1, badgeLabels }: {
  label: string; hint?: string; fieldState?: FieldState; warn?: string; children: React.ReactNode; span?: number; badgeLabels?: Record<string, string>;
}) {
  const badge = fieldState ? FIELD_BADGES[fieldState] : null;
  return (
    <div className={span === 2 ? "md:col-span-2" : span === 3 ? "md:col-span-3" : ""}>
      <label className={labelCls}>
        {label}
        {badge && (
          <span className={`ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-px rounded ${badge.bg} text-[9px] font-semibold ${badge.text} uppercase tracking-wider`}>
            <badge.icon className="h-2.5 w-2.5" /> {badgeLabels?.[badge.labelKey] ?? badge.labelKey}
          </span>
        )}
        {hint && (
          <span className="group relative ml-1 inline-flex">
            <HelpCircle className="h-3 w-3 text-[var(--text-ghost)] inline -mt-px cursor-help" />
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[10px] leading-snug px-2.5 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-xl">
              {hint}
            </span>
          </span>
        )}
      </label>
      {children}
      {warn && (
        <p className="mt-1 text-[10px] text-amber-400 flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" /> {warn}
        </p>
      )}
    </div>
  );
}

function NumField({ label, hint, fieldState, warn, value, onChange, suffix, span, badgeLabels }: {
  label: string; hint?: string; fieldState?: FieldState; warn?: string; value: number; onChange: (v: number) => void; suffix?: string; span?: number; badgeLabels?: Record<string, string>;
}) {
  const extraCls = fieldState && value > 0 ? FIELD_INPUT_STYLES[fieldState] : "";
  return (
    <Field label={label} hint={hint} fieldState={fieldState} warn={warn} span={span} badgeLabels={badgeLabels}>
      <div className="relative">
        <input type="number" min={0} step="0.01" value={value || ""} onChange={e => onChange(parseFloat(e.target.value) || 0)} className={`${inputCls} ${suffix ? "pr-12" : ""} ${extraCls}`} placeholder="0" />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-ghost)]">{suffix}</span>}
      </div>
    </Field>
  );
}

/* ── Callout ── */

function Callout({ type = "info", children }: { type?: "info" | "warning"; children: React.ReactNode }) {
  const styles = type === "warning"
    ? "bg-amber-500/[0.06] border-amber-500/15 text-amber-300/80"
    : "bg-blue-500/[0.06] border-blue-500/15 text-blue-300/80";
  const IconC = type === "warning" ? AlertTriangle : Info;
  return (
    <div className={`flex items-start gap-2 mb-4 px-3.5 py-2.5 rounded-lg border ${styles}`}>
      <IconC className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${type === "warning" ? "text-amber-400" : "text-blue-400"}`} />
      <span className="text-[11px] leading-relaxed">{children}</span>
    </div>
  );
}

/* ── Breakdown Panel (calculation transparency) ── */

function BreakdownPanel({ breakdown, currency, t }: { breakdown: DutyBreakdown; currency: string; t: (key: string) => string }) {
  const [open, setOpen] = useState(false);
  const rows: { label: string; value: number; indent: boolean; bold?: boolean }[] = [
    { label: `${t("dutyBase")} (${breakdown.dutyBasisLabel})`, value: breakdown.dutyBase, indent: false },
    { label: `${t("customsDuty")} (${((breakdown.dutyAmount / (breakdown.dutyBase || 1)) * 100).toFixed(1)}%)`, value: breakdown.dutyAmount, indent: true },
    { label: t("vatBase"), value: breakdown.vatBase, indent: false },
    { label: `${t("importVAT")} (${((breakdown.vatAmount / (breakdown.vatBase || 1)) * 100).toFixed(1)}%)`, value: breakdown.vatAmount, indent: true },
    ...(breakdown.additionalTaxAmount > 0 ? [{ label: t("additionalTax"), value: breakdown.additionalTaxAmount, indent: true }] : []),
    { label: t("fixedImportCharges"), value: breakdown.fixedCharges, indent: false },
    { label: t("importTotal"), value: breakdown.importTotal, indent: false, bold: true },
  ];
  return (
    <div className="mt-5 pt-4 border-t border-[var(--border-subtle)]/60">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
        {open ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        {open ? t("hideBreakdown") : t("viewBreakdown")}
      </button>
      {open && (
        <div className="mt-3 rounded-xl bg-[var(--bg-inverted)]/[0.03] border border-[var(--border-subtle)]/50 overflow-hidden">
          {rows.map((r, i) => (
            <div key={i} className={`flex items-center justify-between px-4 py-2 ${i < rows.length - 1 ? "border-b border-[var(--border-subtle)]/30" : ""} ${r.bold ? "bg-[var(--bg-inverted)]/[0.04]" : ""}`}>
              <span className={`text-[11px] ${r.indent ? "pl-3 text-[var(--text-ghost)]" : "text-[var(--text-dim)]"} ${r.bold ? "font-semibold text-[var(--text-primary)]" : ""}`}>
                {r.indent && <span className="mr-1 text-[var(--text-ghost)]">→</span>}{r.label}
              </span>
              <span className={`text-[11px] font-mono tabular-nums ${r.bold ? "font-bold text-[var(--text-primary)]" : "text-[var(--text-dim)]"}`}>
                {currency} {fmt(r.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */

export default function SimulationForm({ id }: { id?: string }) {
  const router = useRouter();
  const isNew = !id;
  const { t, lang } = useTranslation(landedCostT);
  const isRtl = lang === "ar";

  // Core state
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("draft");
  const [customerName, setCustomerName] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [customerCountry, setCustomerCountry] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [warehouseDest, setWarehouseDest] = useState("");
  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [modelId, setModelId] = useState("");
  const [modelName, setModelName] = useState("");
  const [skuVal, setSkuVal] = useState("");
  const [hsCode, setHsCode] = useState("");
  const [brandVal, setBrandVal] = useState("");
  const [originCountry, setOriginCountry] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [priceBasis, setPriceBasis] = useState("FOB");
  const [notes, setNotes] = useState("");

  // JSONB blocks
  const [productInfo, setProductInfo] = useState<ProductInfo>({ ...DEFAULT_PRODUCT_INFO });
  const [exportCosts, setExportCosts] = useState<ExportCosts>({ ...DEFAULT_EXPORT_COSTS });
  const [shippingCosts, setShippingCosts] = useState<ShippingCosts>({ ...DEFAULT_SHIPPING });
  const [importCosts, setImportCosts] = useState<ImportCosts>({ ...DEFAULT_IMPORT_COSTS });
  const [inlandDelivery, setInlandDelivery] = useState<InlandDelivery>({ ...DEFAULT_INLAND });
  const [financial, setFinancial] = useState<FinancialSettings>({ ...DEFAULT_FINANCIAL });

  // Product lookup
  const [products, setProducts] = useState<{ id: string; product_name: string; brand: string | null; hs_code: string | null }[]>([]);
  const [models, setModels] = useState<{ id: string; model_name: string; sku: string; cost_price: number | null; weight: number | null; cbm: number | null; packing_type: string | null; global_price: number | null }[]>([]);

  // Intelligence layer: field state tracking (auto/manual/suggested)
  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>({});

  // Tab navigation
  const [activeTab, setActiveTab] = useState<TabKey>("customer");
  const [openedSections, setOpenedSections] = useState<Set<TabKey>>(new Set());
  const sectionRefs = useRef<Record<TabKey, HTMLDivElement | null>>({
    customer: null, product: null, export: null, shipping: null, import: null, inland: null, financial: null,
  });

  // Scrollspy — observe marker divs that are always in the DOM
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("data-tab");
            if (id) setActiveTab(id as TabKey);
          }
        });
      },
      { rootMargin: "-120px 0px -60% 0px", threshold: 0 }
    );
    Object.entries(sectionRefs.current).forEach(([, el]) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [loading]);

  function scrollToSection(key: TabKey) {
    setActiveTab(key);
    // Force the target section open, then scroll to its marker
    setOpenedSections(prev => new Set(prev).add(key));
    requestAnimationFrame(() => {
      sectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // Load data
  useEffect(() => {
    fetchProductsForLookup().then(setProducts);
    if (id) {
      fetchSimulation(id).then(sim => {
        if (!sim) { router.push("/landed-cost"); return; }
        setName(sim.name); setStatus(sim.status);
        setCustomerName(sim.customer_name || ""); setCustomerCompany(sim.customer_company || "");
        setCustomerCountry(sim.customer_country || ""); setCustomerCity(sim.customer_city || "");
        setWarehouseDest(sim.warehouse_destination || "");
        setProductId(sim.product_id || ""); setProductName(sim.product_name || "");
        setModelId(sim.model_id || ""); setModelName(sim.model_name || "");
        setSkuVal(sim.sku || ""); setHsCode(sim.hs_code || "");
        setBrandVal(sim.brand || ""); setOriginCountry(sim.country_of_origin || "");
        setQuantity(sim.quantity || 1); setUnitPrice(Number(sim.unit_price) || 0);
        setCurrency(sim.currency || "USD"); setPriceBasis(sim.price_basis || "FOB");
        setNotes(sim.notes || "");
        if (sim.product_info) setProductInfo({ ...DEFAULT_PRODUCT_INFO, ...sim.product_info });
        if (sim.export_costs) setExportCosts({ ...DEFAULT_EXPORT_COSTS, ...sim.export_costs });
        if (sim.shipping) setShippingCosts({ ...DEFAULT_SHIPPING, ...sim.shipping });
        if (sim.import_costs) setImportCosts({ ...DEFAULT_IMPORT_COSTS, ...sim.import_costs });
        if (sim.inland_delivery) setInlandDelivery({ ...DEFAULT_INLAND, ...sim.inland_delivery });
        if (sim.financial) setFinancial({ ...DEFAULT_FINANCIAL, ...sim.financial });
        if (sim.product_id) fetchModelsForProduct(sim.product_id).then(setModels);
        setLoading(false);
      });
    }
  }, [id, router]);

  // ── Intelligence: field state helpers ──
  const markAuto = (keys: string[]) => setFieldStates(prev => {
    const next = { ...prev };
    keys.forEach(k => { next[k] = "auto"; });
    return next;
  });
  const markManual = (key: string) => setFieldStates(prev => ({ ...prev, [key]: "manual" }));
  const markSuggested = (keys: string[]) => setFieldStates(prev => {
    const next = { ...prev };
    keys.forEach(k => { next[k] = "suggested"; });
    return next;
  });

  // Product selection handler — auto-fills from database
  function onProductSelect(pid: string) {
    setProductId(pid);
    const p = products.find(x => x.id === pid);
    const autoKeys: string[] = [];
    if (p) {
      setProductName(p.product_name);
      if (p.brand) { setBrandVal(p.brand); autoKeys.push("brand"); }
      if (p.hs_code) { setHsCode(p.hs_code); autoKeys.push("hsCode"); }
    }
    setModelId(""); setModelName(""); setModels([]);
    setFieldStates({}); // reset on product change
    if (autoKeys.length) markAuto(autoKeys);
    if (pid) fetchModelsForProduct(pid).then(setModels);
  }

  // Model selection handler — auto-fills detailed product data
  function onModelSelect(mid: string) {
    setModelId(mid);
    const m = models.find(x => x.id === mid);
    if (m) {
      const autoKeys: string[] = [];
      setModelName(m.model_name);
      if (m.sku) { setSkuVal(m.sku); autoKeys.push("sku"); }
      if (m.global_price) { setUnitPrice(m.global_price); autoKeys.push("unitPrice"); }
      if (m.weight) {
        const totalW = m.weight * quantity;
        setProductInfo(p => ({ ...p, grossWeightPerUnit: m.weight!, totalGrossWeight: totalW }));
        // Also auto-fill shipping actual weight
        setShippingCosts(s => ({ ...s, actualWeight: totalW }));
        autoKeys.push("grossWeight", "totalGrossWeight", "actualWeight");
      }
      if (m.cbm) {
        const totalC = m.cbm * quantity;
        setProductInfo(p => ({ ...p, cbmPerUnit: m.cbm!, totalCbm: totalC }));
        // Auto-calc volumetric weight based on shipping mode
        const volW = calcVolumetricWeight(totalC, shippingCosts.shippingMode);
        setShippingCosts(s => ({
          ...s,
          volumetricWeight: volW,
          chargeableWeight: calcChargeableWeight(s.actualWeight || (m.weight ? m.weight * quantity : 0), volW),
        }));
        autoKeys.push("cbmPerUnit", "totalCbm", "volumetricWeight", "chargeableWeight");
      }
      if (m.packing_type) {
        setProductInfo(p => ({ ...p, packingType: m.packing_type! }));
        autoKeys.push("packingType");
      }
      // Preserve existing auto states (from product) and add new ones
      markAuto(autoKeys);
    }
  }

  // ── Intelligence: country smart defaults ──
  const prevCountryRef = useRef(customerCountry);
  useEffect(() => {
    if (customerCountry === prevCountryRef.current) return;
    prevCountryRef.current = customerCountry;
    const defaults = findCountryDefaults(customerCountry);
    if (defaults) {
      const suggestedKeys: string[] = [];
      // Only suggest if fields haven't been manually set
      if (fieldStates["dutyPct"] !== "manual" && importCosts.customsDutyPct === 0) {
        setImportCosts(p => ({ ...p, customsDutyPct: defaults.dutyPct }));
        suggestedKeys.push("dutyPct");
      }
      if (fieldStates["vatPct"] !== "manual" && importCosts.importVatPct === 0) {
        setImportCosts(p => ({ ...p, importVatPct: defaults.vatPct }));
        suggestedKeys.push("vatPct");
      }
      if (suggestedKeys.length) markSuggested(suggestedKeys);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerCountry]);

  // ── Intelligence: auto-recalc shipping weights when CBM/weight or mode changes ──
  useEffect(() => {
    if (!productInfo.totalCbm && !productInfo.totalGrossWeight) return;
    const volW = calcVolumetricWeight(productInfo.totalCbm, shippingCosts.shippingMode);
    const actW = productInfo.totalGrossWeight || 0;
    setShippingCosts(s => {
      const newActual = fieldStates["actualWeight"] === "manual" ? s.actualWeight : actW;
      const newVol = fieldStates["volumetricWeight"] === "manual" ? s.volumetricWeight : volW;
      const newChargeable = fieldStates["chargeableWeight"] === "manual" ? s.chargeableWeight : calcChargeableWeight(newActual, newVol);
      return { ...s, actualWeight: newActual, volumetricWeight: newVol, chargeableWeight: newChargeable };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productInfo.totalCbm, productInfo.totalGrossWeight, shippingCosts.shippingMode]);

  // Live calculation
  const results: SimulationResults = useMemo(() => {
    return calculate(unitPrice, quantity, priceBasis, productInfo, exportCosts, shippingCosts, importCosts, inlandDelivery, financial);
  }, [unitPrice, quantity, priceBasis, productInfo, exportCosts, shippingCosts, importCosts, inlandDelivery, financial]);

  // ── Intelligence: duty/tax breakdown for transparency ──
  const dutyBreakdown = useMemo(() => {
    return calculateDutyBreakdown(results.productTotal, results.exportTotal, results.shippingTotal, priceBasis, importCosts);
  }, [results.productTotal, results.exportTotal, results.shippingTotal, priceBasis, importCosts]);

  // Validation — enhanced with section-level tracking
  const warnings = useMemo(() => {
    const w: { field: string; section: TabKey; messageKey: string }[] = [];
    if (!unitPrice) w.push({ field: "unitPrice", section: "product", messageKey: "warn.unitPrice" });
    if (!quantity || quantity <= 0) w.push({ field: "quantity", section: "product", messageKey: "warn.quantity" });
    if (!hsCode) w.push({ field: "hsCode", section: "product", messageKey: "warn.hsCodeMissing" });
    if (!productInfo.totalGrossWeight) w.push({ field: "weight", section: "product", messageKey: "warn.weightMissing" });
    if (!productInfo.totalCbm) w.push({ field: "cbm", section: "product", messageKey: "warn.cbmMissing" });
    if (!customerCompany && !customerName) w.push({ field: "customer", section: "customer", messageKey: "warn.customerMissing" });
    if (!shippingCosts.shippingMode) w.push({ field: "shippingMode", section: "shipping", messageKey: "warn.shippingMode" });
    if (!customerCountry) w.push({ field: "country", section: "customer", messageKey: "warn.countryMissing" });
    return w;
  }, [unitPrice, quantity, hsCode, productInfo.totalGrossWeight, productInfo.totalCbm, customerCompany, customerName, shippingCosts.shippingMode, customerCountry]);

  // Section-level warning counts for tab badges
  const sectionWarnings = useMemo(() => {
    const counts: Record<TabKey, number> = { customer: 0, product: 0, export: 0, shipping: 0, import: 0, inland: 0, financial: 0 };
    warnings.forEach(w => { counts[w.section]++; });
    return counts;
  }, [warnings]);

  // Save
  const handleSave = useCallback(async (newStatus?: string) => {
    setSaving(true);
    const payload: Partial<SimulationRow> = {
      name: name || t("untitledSimulation"), status: newStatus || status,
      customer_name: customerName, customer_company: customerCompany,
      customer_country: customerCountry, customer_city: customerCity,
      warehouse_destination: warehouseDest,
      product_id: productId, product_name: productName,
      model_id: modelId, model_name: modelName,
      sku: skuVal, hs_code: hsCode, brand: brandVal,
      country_of_origin: originCountry,
      quantity, unit_price: unitPrice, currency, price_basis: priceBasis,
      product_info: productInfo as unknown as ProductInfo,
      export_costs: exportCosts as unknown as ExportCosts,
      shipping: shippingCosts as unknown as ShippingCosts,
      import_costs: importCosts as unknown as ImportCosts,
      inland_delivery: inlandDelivery as unknown as InlandDelivery,
      financial: financial as unknown as FinancialSettings,
      results: results as unknown as SimulationResults,
      notes,
    };
    if (newStatus) setStatus(newStatus);
    if (isNew) {
      const newId = await createSimulation(payload);
      if (newId) router.push(`/landed-cost/${newId}`);
    } else {
      await updateSimulation(id!, payload);
    }
    setSaving(false);
  }, [name, status, customerName, customerCompany, customerCountry, customerCity, warehouseDest, productId, productName, modelId, modelName, skuVal, hsCode, brandVal, originCountry, quantity, unitPrice, currency, priceBasis, productInfo, exportCosts, shippingCosts, importCosts, inlandDelivery, financial, results, notes, isNew, id, router, t]);

  // Updaters
  const ux = (fn: React.Dispatch<React.SetStateAction<ExportCosts>>) => (key: keyof ExportCosts, v: number) => fn(prev => ({ ...prev, [key]: v }));
  const updateExport = ux(setExportCosts);
  const updateShipping = (key: keyof ShippingCosts, v: number | string) => setShippingCosts(prev => ({ ...prev, [key]: v }));
  const updateImport = (key: keyof ImportCosts, v: number | string) => setImportCosts(prev => ({ ...prev, [key]: v }));
  const updateInland = (key: keyof InlandDelivery, v: number | string) => setInlandDelivery(prev => ({ ...prev, [key]: v }));
  const updateFinancial = (key: keyof FinancialSettings, v: number | string | boolean) => setFinancial(prev => ({ ...prev, [key]: v }));

  if (loading) {
    return <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--text-dim)]" /></div>;
  }

  const productTotal = unitPrice * (quantity || 1);
  const fs = (f: string): FieldState | undefined => fieldStates[f];

  // Badge labels for current language
  const bl = { auto: t("auto"), edited: t("edited"), suggested: t("suggested") };

  // Tab labels for current language
  const tabLabels: Record<TabKey, string> = {
    customer: t("tab.customer"), product: t("tab.product"), export: t("tab.export"),
    shipping: t("tab.shipping"), import: t("tab.import"), inland: t("tab.delivery"), financial: t("tab.financial"),
  };

  // Tab subtotals for badges
  const tabSubtotals: Record<TabKey, number> = {
    customer: 0, product: productTotal, export: results.exportTotal,
    shipping: results.shippingTotal, import: results.importTotal,
    inland: results.inlandTotal, financial: results.financialTotal,
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]" dir={isRtl ? "rtl" : "ltr"}>

      {/* ── Header ── */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 pt-6 md:pt-8">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <Link href="/landed-cost" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
            <ArrowLeft className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
          </Link>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0"><Calculator className="h-4 w-4" /></div>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="text-xl md:text-[22px] font-bold tracking-tight bg-transparent outline-none flex-1 min-w-0 placeholder:text-[var(--text-ghost)]" placeholder={t("untitledSimulation")} />
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${status === "completed" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"}`}>{t(status)}</span>
            <button onClick={() => handleSave()} disabled={saving} className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 shadow-lg">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? t("saving") : t("save")}
            </button>
            {status === "draft" && (
              <button onClick={() => handleSave("completed")} disabled={saving} className="flex h-10 px-4 rounded-xl bg-emerald-600 text-white text-[13px] font-semibold items-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-50">
                <CheckCircle2 className="h-4 w-4" /> {t("finalize")}
              </button>
            )}
          </div>
        </div>
        <p className="text-[12px] text-[var(--text-dim)] mb-4 ml-0 md:ml-11">{t("subtitle")}</p>
      </div>

      {/* ── Tab Navigation Bar (sticky) ── */}
      <div className="sticky top-0 z-30 bg-[var(--bg-primary)]/95 backdrop-blur-md border-b border-[var(--border-subtle)]">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-2 pr-8">
            {TABS.map(tab => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.key;
              const sub = tabSubtotals[tab.key];
              const warnCount = sectionWarnings[tab.key];
              return (
                <button
                  key={tab.key}
                  onClick={() => scrollToSection(tab.key)}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all shrink-0 ${
                    isActive
                      ? "bg-[var(--bg-inverted)]/[0.08] text-[var(--text-primary)] shadow-sm"
                      : "text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-inverted)]/[0.04]"
                  }`}
                >
                  <TabIcon className="h-3.5 w-3.5" />
                  <span>{tabLabels[tab.key]}</span>
                  {sub > 0 && (
                    <span className={`text-[9px] font-mono font-semibold tabular-nums ${isActive ? "text-[var(--text-primary)]" : "text-[var(--text-ghost)]"}`}>
                      {fmt(sub, 0)}
                    </span>
                  )}
                  {warnCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-amber-500 text-[8px] font-bold text-white flex items-center justify-center">{warnCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">

          {/* ═══════ LEFT: Form Sections ═══════ */}
          <div className="space-y-5">

            {/* ──────── Customer & Destination ──────── */}
            <div ref={el => { sectionRefs.current.customer = el; }} data-tab="customer" className="scroll-mt-24" />
            <Section
              id="section-customer"
              icon={Users}
              title={t("sec.customer")}
              description={t("sec.customerDesc")}
              forceOpen={openedSections.has("customer")}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label={t("customerName")} warn={!customerName && !customerCompany ? t("required") : undefined}><input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className={inputCls} placeholder={t("ph.contactName")} /></Field>
                <Field label={t("customerCompany")}><input type="text" value={customerCompany} onChange={e => setCustomerCompany(e.target.value)} className={inputCls} placeholder={t("ph.companyName")} /></Field>
                <Field label={t("customerCountry")}><input type="text" value={customerCountry} onChange={e => setCustomerCountry(e.target.value)} className={inputCls} placeholder={t("ph.egypt")} /></Field>
                <Field label={t("customerCity")}><input type="text" value={customerCity} onChange={e => setCustomerCity(e.target.value)} className={inputCls} placeholder={t("ph.cairo")} /></Field>
                <Field label={t("warehouseDest")} span={2}><input type="text" value={warehouseDest} onChange={e => setWarehouseDest(e.target.value)} className={inputCls} placeholder={t("ph.warehouseAddr")} /></Field>
              </div>
            </Section>

            {/* ──────── Product & Pricing ──────── */}
            <div ref={el => { sectionRefs.current.product = el; }} data-tab="product" className="scroll-mt-24" />
            <Section
              id="section-product"
              icon={Package}
              title={t("sec.product")}
              description={t("sec.productDesc")}
              subtotal={productTotal}
              currency={currency}
              forceOpen={openedSections.has("product")}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label={t("product")}>
                  <select value={productId} onChange={e => onProductSelect(e.target.value)} className={selectCls}>
                    <option value="">{t("selectProduct")}</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.product_name}</option>)}
                  </select>
                </Field>
                <Field label={t("model")}>
                  <select value={modelId} onChange={e => onModelSelect(e.target.value)} className={selectCls} disabled={!productId}>
                    <option value="">{t("selectModel")}</option>
                    {models.map(m => <option key={m.id} value={m.id}>{m.model_name} ({m.sku})</option>)}
                  </select>
                </Field>
                <Field label={t("sku")} fieldState={fs("sku")} badgeLabels={bl}><input type="text" value={skuVal} onChange={e => { setSkuVal(e.target.value); markManual("sku"); }} className={`${inputCls} ${fs("sku") && skuVal ? FIELD_INPUT_STYLES[fs("sku")!] : ""}`} /></Field>
                <Field label={t("hsCode")} hint={t("hsCodeHint")} fieldState={fs("hsCode")} warn={!hsCode ? t("warn.hsCode") : undefined} badgeLabels={bl}><input type="text" value={hsCode} onChange={e => { setHsCode(e.target.value); markManual("hsCode"); }} className={`${inputCls} ${fs("hsCode") && hsCode ? FIELD_INPUT_STYLES[fs("hsCode")!] : ""}`} placeholder="e.g. 8516.31.00" /></Field>
                <Field label={t("brand")} fieldState={fs("brand")} badgeLabels={bl}><input type="text" value={brandVal} onChange={e => { setBrandVal(e.target.value); markManual("brand"); }} className={`${inputCls} ${fs("brand") && brandVal ? FIELD_INPUT_STYLES[fs("brand")!] : ""}`} /></Field>
                <Field label={t("countryOfOrigin")}><input type="text" value={originCountry} onChange={e => setOriginCountry(e.target.value)} className={inputCls} placeholder={t("ph.countryOfOrigin")} /></Field>
              </div>

              <SubGroup label={t("sub.pricingTerms")} icon={DollarSign}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <NumField label={t("quantity")} value={quantity} onChange={v => {
                    setQuantity(v);
                    setProductInfo(p => {
                      const newWeight = p.grossWeightPerUnit * v;
                      const newCbm = p.cbmPerUnit * v;
                      return { ...p, totalGrossWeight: newWeight, totalCbm: newCbm };
                    });
                  }} warn={!quantity || quantity <= 0 ? t("required") : undefined} />
                  <NumField label={t("unitPrice")} value={unitPrice} onChange={v => { setUnitPrice(v); markManual("unitPrice"); }} suffix={currency} fieldState={fs("unitPrice")} warn={!unitPrice ? t("required") : undefined} badgeLabels={bl} />
                  <Field label={t("currency")}>
                    <select value={currency} onChange={e => setCurrency(e.target.value)} className={selectCls}>
                      {["USD","EUR","GBP","CNY","AED","SAR","EGP","TRY","JPY","KRW","INR","BRL"].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label={t("priceBasis")} hint={t(`hint.${priceBasis}`)}>
                    <select value={priceBasis} onChange={e => setPriceBasis(e.target.value)} className={selectCls}>
                      {["EXW","FOB","CFR","CIF"].map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="mt-3 px-3 py-2 rounded-lg bg-[var(--bg-inverted)]/[0.03] border border-[var(--border-subtle)]/50">
                  <p className="text-[10px] text-[var(--text-ghost)] leading-relaxed">
                    <strong className="text-[var(--text-dim)]">{priceBasis}:</strong> {t(`hint.${priceBasis}`)}
                  </p>
                </div>
              </SubGroup>

              <SubGroup label={t("sub.physicalSpecs")} icon={Boxes}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label={t("packingType")} fieldState={fs("packingType")} badgeLabels={bl}><input type="text" value={productInfo.packingType} onChange={e => { setProductInfo(p => ({ ...p, packingType: e.target.value })); markManual("packingType"); }} className={`${inputCls} ${fs("packingType") && productInfo.packingType ? FIELD_INPUT_STYLES[fs("packingType")!] : ""}`} placeholder={t("ph.packingType")} /></Field>
                  <NumField label={t("numCartons")} value={productInfo.numCartons} onChange={v => setProductInfo(p => ({ ...p, numCartons: v }))} />
                  <Field label={t("loadingType")} hint={t(`hint.${productInfo.loadingType}`)}>
                    <select value={productInfo.loadingType} onChange={e => setProductInfo(p => ({ ...p, loadingType: e.target.value }))} className={selectCls}>
                      {["LCL","FCL 20GP","FCL 40GP","FCL 40HQ","Air","Courier"].map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </Field>
                  <NumField label={t("netWeightPerUnit")} value={productInfo.netWeightPerUnit} onChange={v => setProductInfo(p => ({ ...p, netWeightPerUnit: v }))} suffix="kg" />
                  <NumField label={t("grossWeightPerUnit")} value={productInfo.grossWeightPerUnit} onChange={v => { setProductInfo(p => ({ ...p, grossWeightPerUnit: v, totalGrossWeight: v * quantity })); markManual("grossWeight"); }} suffix="kg" hint={t("grossWeightHint")} fieldState={fs("grossWeight")} warn={!productInfo.totalGrossWeight ? t("warn.weight") : undefined} badgeLabels={bl} />
                  <NumField label={t("totalGrossWeight")} value={productInfo.totalGrossWeight} onChange={v => { setProductInfo(p => ({ ...p, totalGrossWeight: v })); markManual("totalGrossWeight"); }} suffix="kg" fieldState={fs("totalGrossWeight")} badgeLabels={bl} />
                  <NumField label={t("cbmPerUnit")} value={productInfo.cbmPerUnit} onChange={v => { setProductInfo(p => ({ ...p, cbmPerUnit: v, totalCbm: v * quantity })); markManual("cbmPerUnit"); }} suffix="m³" hint={t("cbmHint")} fieldState={fs("cbmPerUnit")} warn={!productInfo.totalCbm ? t("warn.cbm") : undefined} badgeLabels={bl} />
                  <NumField label={t("totalCbm")} value={productInfo.totalCbm} onChange={v => { setProductInfo(p => ({ ...p, totalCbm: v })); markManual("totalCbm"); }} suffix="m³" fieldState={fs("totalCbm")} badgeLabels={bl} />
                </div>
              </SubGroup>

              <SectionFooter label={t("productTotal")} value={productTotal} currency={currency} />
            </Section>

            {/* ──────── Export Side Costs ──────── */}
            <div ref={el => { sectionRefs.current.export = el; }} data-tab="export" className="scroll-mt-24" />
            <Section
              id="section-export"
              icon={Building2}
              title={t("sec.export")}
              description={t("sec.exportDesc")}
              subtotal={results.exportTotal}
              currency={currency}
              defaultOpen={false}
              forceOpen={openedSections.has("export")}
              badge={priceBasis !== "EXW" ? (
                <span className="px-2 py-0.5 rounded-md bg-blue-500/[0.08] text-[9px] font-semibold text-blue-400 uppercase tracking-wider">{t("includedIn")} {priceBasis}</span>
              ) : undefined}
            >
              {priceBasis !== "EXW" && (
                <Callout>{t("priceBasis")} <strong>{priceBasis}</strong> — {t("exportIncludedMsg")}</Callout>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <NumField label={t("factoryToPort")} value={exportCosts.factoryToPort} onChange={v => updateExport("factoryToPort", v)} suffix={currency} />
                <NumField label={t("localTrucking")} value={exportCosts.localTrucking} onChange={v => updateExport("localTrucking", v)} suffix={currency} />
                <NumField label={t("exportCustomsFee")} value={exportCosts.exportCustomsFee} onChange={v => updateExport("exportCustomsFee", v)} suffix={currency} />
              </div>
              <SubGroup label={t("sub.portTerminal")}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <NumField label={t("portCharges")} value={exportCosts.portCharges} onChange={v => updateExport("portCharges", v)} suffix={currency} />
                  <NumField label={t("terminalHandling")} value={exportCosts.terminalHandling} onChange={v => updateExport("terminalHandling", v)} suffix={currency} />
                  <NumField label={t("loadingFee")} value={exportCosts.loadingFee} onChange={v => updateExport("loadingFee", v)} suffix={currency} />
                </div>
              </SubGroup>
              <SubGroup label={t("sub.docsCompliance")}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <NumField label={t("documentationFee")} value={exportCosts.documentationFee} onChange={v => updateExport("documentationFee", v)} suffix={currency} />
                  <NumField label={t("inspectionFee")} value={exportCosts.inspectionFee} onChange={v => updateExport("inspectionFee", v)} suffix={currency} />
                  <NumField label={t("fumigationFee")} value={exportCosts.fumigationFee} onChange={v => updateExport("fumigationFee", v)} suffix={currency} />
                  <NumField label={t("certificateOfOriginFee")} value={exportCosts.certificateOfOriginFee} onChange={v => updateExport("certificateOfOriginFee", v)} suffix={currency} />
                  <NumField label={t("formCertificateFee")} value={exportCosts.formCertificateFee} onChange={v => updateExport("formCertificateFee", v)} suffix={currency} />
                </div>
              </SubGroup>
              <SubGroup label={t("sub.otherCosts")}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <NumField label={t("palletizationFee")} value={exportCosts.palletizationFee} onChange={v => updateExport("palletizationFee", v)} suffix={currency} />
                  <NumField label={t("extraPackingCost")} value={exportCosts.extraPackingCost} onChange={v => updateExport("extraPackingCost", v)} suffix={currency} />
                  <NumField label={t("exportAgentFee")} value={exportCosts.exportAgentFee} onChange={v => updateExport("exportAgentFee", v)} suffix={currency} />
                  <NumField label={t("bankCharges")} value={exportCosts.bankCharges} onChange={v => updateExport("bankCharges", v)} suffix={currency} />
                  <NumField label={t("otherExportCharges")} value={exportCosts.otherExportCharges} onChange={v => updateExport("otherExportCharges", v)} suffix={currency} />
                </div>
              </SubGroup>
              <div className="mt-4"><Field label={t("exportNotes")}><textarea value={exportCosts.notes} onChange={e => setExportCosts(p => ({ ...p, notes: e.target.value }))} className={`${inputCls} h-20 py-2 resize-none`} placeholder={t("ph.additionalNotes")} /></Field></div>
              <SectionFooter label={t("exportTotal")} value={results.exportTotal} currency={currency} />
            </Section>

            {/* ──────── Shipping & Freight ──────── */}
            <div ref={el => { sectionRefs.current.shipping = el; }} data-tab="shipping" className="scroll-mt-24" />
            <Section
              id="section-shipping"
              icon={Ship}
              title={t("sec.shipping")}
              description={t("sec.shippingDesc")}
              subtotal={results.shippingTotal}
              currency={currency}
              defaultOpen={false}
              forceOpen={openedSections.has("shipping")}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label={t("shippingMode")}><select value={shippingCosts.shippingMode} onChange={e => updateShipping("shippingMode", e.target.value)} className={selectCls}>{["Sea","Air","Courier","Land"].map(m => <option key={m} value={m}>{m}</option>)}</select></Field>
                <Field label={t("portOfLoading")}><input type="text" value={shippingCosts.portOfLoading} onChange={e => updateShipping("portOfLoading", e.target.value)} className={inputCls} placeholder={t("ph.shanghai")} /></Field>
                <Field label={t("portOfDestination")}><input type="text" value={shippingCosts.portOfDestination} onChange={e => updateShipping("portOfDestination", e.target.value)} className={inputCls} placeholder={t("ph.alexandria")} /></Field>
              </div>
              <SubGroup label={t("sub.freightInsurance")}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <NumField label={t("freightCost")} value={shippingCosts.freightCost} onChange={v => updateShipping("freightCost", v)} suffix={shippingCosts.freightCurrency} />
                  <NumField label={t("insuranceCost")} value={shippingCosts.insuranceCost} onChange={v => updateShipping("insuranceCost", v)} suffix={shippingCosts.freightCurrency} />
                  <Field label={t("transitTime")}><input type="text" value={shippingCosts.transitTime} onChange={e => updateShipping("transitTime", e.target.value)} className={inputCls} placeholder={t("ph.transitTime")} /></Field>
                </div>
              </SubGroup>
              <SubGroup label={t("sub.surcharges")}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <NumField label={t("baf")} value={shippingCosts.baf} onChange={v => updateShipping("baf", v)} suffix={shippingCosts.freightCurrency} hint={t("bafHint")} />
                  <NumField label={t("caf")} value={shippingCosts.caf} onChange={v => updateShipping("caf", v)} suffix={shippingCosts.freightCurrency} />
                  <NumField label={t("gri")} value={shippingCosts.gri} onChange={v => updateShipping("gri", v)} suffix={shippingCosts.freightCurrency} />
                  <NumField label={t("peakSeasonSurcharge")} value={shippingCosts.peakSeasonSurcharge} onChange={v => updateShipping("peakSeasonSurcharge", v)} suffix={shippingCosts.freightCurrency} />
                  <NumField label={t("amsEnsIsf")} value={shippingCosts.amsEnsIsf} onChange={v => updateShipping("amsEnsIsf", v)} suffix={shippingCosts.freightCurrency} hint={t("amsHint")} />
                  <NumField label={t("blAwbFee")} value={shippingCosts.blAwbFee} onChange={v => updateShipping("blAwbFee", v)} suffix={shippingCosts.freightCurrency} hint={t("blHint")} />
                  <NumField label={t("telexReleaseFee")} value={shippingCosts.telexReleaseFee} onChange={v => updateShipping("telexReleaseFee", v)} suffix={shippingCosts.freightCurrency} />
                </div>
              </SubGroup>
              <SubGroup label={t("sub.weightCurrency")}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <NumField label={t("chargeableWeight")} value={shippingCosts.chargeableWeight} onChange={v => { updateShipping("chargeableWeight", v); markManual("chargeableWeight"); }} suffix="kg" hint={t("chargeableWeightHint")} fieldState={fs("chargeableWeight")} badgeLabels={bl} />
                  <NumField label={t("actualWeight")} value={shippingCosts.actualWeight} onChange={v => { updateShipping("actualWeight", v); markManual("actualWeight"); }} suffix="kg" fieldState={fs("actualWeight")} badgeLabels={bl} />
                  <NumField label={t("volumetricWeight")} value={shippingCosts.volumetricWeight} onChange={v => { updateShipping("volumetricWeight", v); markManual("volumetricWeight"); }} suffix="kg" hint={t("volumetricWeightHint")} fieldState={fs("volumetricWeight")} badgeLabels={bl} />
                  <Field label={t("freightCurrency")}><select value={shippingCosts.freightCurrency} onChange={e => updateShipping("freightCurrency", e.target.value)} className={selectCls}>{["USD","EUR","GBP","CNY"].map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
                  <NumField label={t("freightExchangeRate")} value={shippingCosts.freightExchangeRate} onChange={v => updateShipping("freightExchangeRate", v)} hint={t("freightExRateHint")} />
                </div>
              </SubGroup>
              <div className="mt-4"><Field label={t("shippingNotes")}><textarea value={shippingCosts.notes} onChange={e => updateShipping("notes", e.target.value)} className={`${inputCls} h-20 py-2 resize-none`} placeholder={t("ph.additionalNotes")} /></Field></div>
              <SectionFooter label={t("shippingTotal")} value={results.shippingTotal} currency={currency} />
            </Section>

            {/* ──────── Import Side Costs ──────── */}
            <div ref={el => { sectionRefs.current.import = el; }} data-tab="import" className="scroll-mt-24" />
            <Section
              id="section-import"
              icon={Anchor}
              title={t("sec.import")}
              description={t("sec.importDesc")}
              subtotal={results.importTotal}
              currency={currency}
              defaultOpen={false}
              forceOpen={openedSections.has("import")}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <NumField label={t("customsDutyPct")} value={importCosts.customsDutyPct} onChange={v => { updateImport("customsDutyPct", v); markManual("dutyPct"); }} suffix="%" hint={t("dutyHint")} fieldState={fs("dutyPct")} badgeLabels={bl} />
                <NumField label={t("importVatPct")} value={importCosts.importVatPct} onChange={v => { updateImport("importVatPct", v); markManual("vatPct"); }} suffix="%" hint={t("vatHint")} fieldState={fs("vatPct")} badgeLabels={bl} />
                <NumField label={t("additionalTaxPct")} value={importCosts.additionalTaxPct} onChange={v => updateImport("additionalTaxPct", v)} suffix="%" />
                <Field label={t("calculationBasis")} hint={t("calcBasisHint")}><select value={importCosts.calculationBasis} onChange={e => updateImport("calculationBasis", e.target.value)} className={selectCls}><option value="FOB">{t("basedOnFOB")}</option><option value="CIF">{t("basedOnCIF")}</option><option value="custom_value">{t("customDeclaredValue")}</option></select></Field>
                {importCosts.calculationBasis === "custom_value" && <NumField label={t("customValue")} value={importCosts.customValue} onChange={v => updateImport("customValue", v)} suffix={currency} />}
                <NumField label={t("antiDumpingDuty")} value={importCosts.antiDumpingDuty} onChange={v => updateImport("antiDumpingDuty", v)} suffix={currency} hint={t("antiDumpingHint")} />
              </div>
              <SubGroup label={t("sub.portTerminalFees")}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <NumField label={t("portCharges")} value={importCosts.portCharges} onChange={v => updateImport("portCharges", v)} suffix={currency} />
                  <NumField label={t("terminalHandling")} value={importCosts.terminalHandling} onChange={v => updateImport("terminalHandling", v)} suffix={currency} />
                  <NumField label={t("portSecurityFee")} value={importCosts.portSecurityFee} onChange={v => updateImport("portSecurityFee", v)} suffix={currency} />
                  <NumField label={t("scanningFee")} value={importCosts.scanningFee} onChange={v => updateImport("scanningFee", v)} suffix={currency} />
                </div>
              </SubGroup>
              <SubGroup label={t("sub.customsCompliance")}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <NumField label={t("customsClearanceFee")} value={importCosts.customsClearanceFee} onChange={v => updateImport("customsClearanceFee", v)} suffix={currency} />
                  <NumField label={t("customsBrokerFee")} value={importCosts.customsBrokerFee} onChange={v => updateImport("customsBrokerFee", v)} suffix={currency} />
                  <NumField label={t("inspectionFee")} value={importCosts.inspectionFee} onChange={v => updateImport("inspectionFee", v)} suffix={currency} />
                  <NumField label={t("certVerificationFee")} value={importCosts.certificateVerificationFee} onChange={v => updateImport("certificateVerificationFee", v)} suffix={currency} />
                  <NumField label={t("translationLegalization")} value={importCosts.translationLegalizationFee} onChange={v => updateImport("translationLegalizationFee", v)} suffix={currency} />
                  <NumField label={t("municipalityFee")} value={importCosts.municipalityFee} onChange={v => updateImport("municipalityFee", v)} suffix={currency} />
                </div>
              </SubGroup>
              <SubGroup label={t("sub.storageDelays")}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <NumField label={t("storageFee")} value={importCosts.storageFee} onChange={v => updateImport("storageFee", v)} suffix={currency} />
                  <NumField label={t("demurrage")} value={importCosts.demurrage} onChange={v => updateImport("demurrage", v)} suffix={currency} hint={t("demurrageHint")} />
                  <NumField label={t("detention")} value={importCosts.detention} onChange={v => updateImport("detention", v)} suffix={currency} hint={t("detentionHint")} />
                  <NumField label={t("deliveryOrderFee")} value={importCosts.deliveryOrderFee} onChange={v => updateImport("deliveryOrderFee", v)} suffix={currency} />
                  <NumField label={t("otherImportCharges")} value={importCosts.otherImportCharges} onChange={v => updateImport("otherImportCharges", v)} suffix={currency} />
                </div>
              </SubGroup>
              {/* ── Calculation Transparency: Duty/Tax Breakdown ── */}
              {results.importTotal > 0 && (
                <BreakdownPanel breakdown={dutyBreakdown} currency={currency} t={t} />
              )}
              <div className="mt-4"><Field label={t("importNotes")}><textarea value={importCosts.notes} onChange={e => updateImport("notes", e.target.value)} className={`${inputCls} h-20 py-2 resize-none`} placeholder={t("ph.additionalNotes")} /></Field></div>
              <SectionFooter label={t("importTotal")} value={results.importTotal} currency={currency} />
            </Section>

            {/* ──────── Inland Delivery ──────── */}
            <div ref={el => { sectionRefs.current.inland = el; }} data-tab="inland" className="scroll-mt-24" />
            <Section
              id="section-inland"
              icon={Truck}
              title={t("sec.inland")}
              description={t("sec.inlandDesc")}
              subtotal={results.inlandTotal}
              currency={currency}
              defaultOpen={false}
              forceOpen={openedSections.has("inland")}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label={t("finalDeliveryCity")}><input type="text" value={inlandDelivery.finalDeliveryCity} onChange={e => updateInland("finalDeliveryCity", e.target.value)} className={inputCls} /></Field>
                <Field label={t("finalWarehouseAddress")} span={2}><input type="text" value={inlandDelivery.finalWarehouseAddress} onChange={e => updateInland("finalWarehouseAddress", e.target.value)} className={inputCls} /></Field>
                <Field label={t("distanceFromPort")}><input type="text" value={inlandDelivery.distanceFromPort} onChange={e => updateInland("distanceFromPort", e.target.value)} className={inputCls} placeholder={t("ph.distance")} /></Field>
              </div>
              <SubGroup label={t("sub.transportHandling")}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <NumField label={t("localTruckingToWarehouse")} value={inlandDelivery.localTruckingToWarehouse} onChange={v => updateInland("localTruckingToWarehouse", v)} suffix={currency} />
                  <NumField label={t("unloadingFee")} value={inlandDelivery.unloadingFee} onChange={v => updateInland("unloadingFee", v)} suffix={currency} />
                  <NumField label={t("craneForkliftFee")} value={inlandDelivery.craneForkliftFee} onChange={v => updateInland("craneForkliftFee", v)} suffix={currency} />
                  <NumField label={t("warehouseReceiving")} value={inlandDelivery.warehouseReceivingCharges} onChange={v => updateInland("warehouseReceivingCharges", v)} suffix={currency} />
                  <NumField label={t("lastMileHandling")} value={inlandDelivery.lastMileHandling} onChange={v => updateInland("lastMileHandling", v)} suffix={currency} />
                </div>
              </SubGroup>
              <SubGroup label={t("sub.surcharges")}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <NumField label={t("remoteAreaSurcharge")} value={inlandDelivery.remoteAreaSurcharge} onChange={v => updateInland("remoteAreaSurcharge", v)} suffix={currency} />
                  <NumField label={t("restrictedAreaSurcharge")} value={inlandDelivery.restrictedAreaSurcharge} onChange={v => updateInland("restrictedAreaSurcharge", v)} suffix={currency} />
                  <NumField label={t("appointmentDeliveryFee")} value={inlandDelivery.appointmentDeliveryFee} onChange={v => updateInland("appointmentDeliveryFee", v)} suffix={currency} />
                  <NumField label={t("nightDeliveryFee")} value={inlandDelivery.nightDeliveryFee} onChange={v => updateInland("nightDeliveryFee", v)} suffix={currency} />
                  <NumField label={t("otherLocalDelivery")} value={inlandDelivery.otherLocalDeliveryCharges} onChange={v => updateInland("otherLocalDeliveryCharges", v)} suffix={currency} />
                </div>
              </SubGroup>
              <div className="mt-4"><Field label={t("inlandNotes")}><textarea value={inlandDelivery.notes} onChange={e => updateInland("notes", e.target.value)} className={`${inputCls} h-20 py-2 resize-none`} placeholder={t("ph.additionalNotes")} /></Field></div>
              <SectionFooter label={t("inlandTotal")} value={results.inlandTotal} currency={currency} />
            </Section>

            {/* ──────── Financial & Commercial ──────── */}
            <div ref={el => { sectionRefs.current.financial = el; }} data-tab="financial" className="scroll-mt-24" />
            <Section
              id="section-financial"
              icon={CircleDollarSign}
              title={t("sec.financial")}
              description={t("sec.financialDesc")}
              subtotal={results.financialTotal}
              currency={currency}
              defaultOpen={false}
              forceOpen={openedSections.has("financial")}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <NumField label={t("exchangeRate")} value={financial.exchangeRate} onChange={v => updateFinancial("exchangeRate", v)} hint={t("exchangeRateHint")} />
                <Field label={t("paymentTerm")} hint={t("paymentTermHint")}><select value={financial.paymentTerm} onChange={e => updateFinancial("paymentTerm", e.target.value)} className={selectCls}>{["TT","LC","DP","OA"].map(pt => <option key={pt} value={pt}>{pt}</option>)}</select></Field>
              </div>
              <SubGroup label={t("sub.bankingFinance")}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <NumField label={t("bankTransferCost")} value={financial.bankTransferCost} onChange={v => updateFinancial("bankTransferCost", v)} suffix={currency} />
                  <NumField label={t("financingCost")} value={financial.financingCost} onChange={v => updateFinancial("financingCost", v)} suffix={currency} />
                  <NumField label={t("creditInsurance")} value={financial.creditInsurance} onChange={v => updateFinancial("creditInsurance", v)} suffix={currency} />
                  <NumField label={t("unexpectedReserve")} value={financial.unexpectedReserve} onChange={v => updateFinancial("unexpectedReserve", v)} suffix={currency} hint={t("unexpectedReserveHint")} />
                </div>
              </SubGroup>
              <SubGroup label={t("sub.commissionAdj")}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <NumField label={t("agentCommission")} value={financial.agentCommission} onChange={v => updateFinancial("agentCommission", v)} suffix={currency} />
                  <NumField label={t("salesCommission")} value={financial.salesCommission} onChange={v => updateFinancial("salesCommission", v)} suffix={currency} />
                  <NumField label={t("discountPct")} value={financial.discount} onChange={v => updateFinancial("discount", v)} suffix="%" />
                  <NumField label={t("marginPct")} value={financial.margin} onChange={v => updateFinancial("margin", v)} suffix="%" hint={t("marginHint")} />
                  <NumField label={t("contingencyPct")} value={financial.contingencyPct} onChange={v => updateFinancial("contingencyPct", v)} suffix="%" hint={t("contingencyHint")} />
                </div>
                <div className="flex flex-wrap gap-6 pt-4">
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input type="checkbox" checked={financial.includeTaxInFinal} onChange={e => updateFinancial("includeTaxInFinal", e.target.checked)} className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
                    <span className="text-[13px] text-[var(--text-dim)] group-hover:text-[var(--text-primary)] transition-colors">{t("includeTaxInFinal")}</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input type="checkbox" checked={financial.includeCommissionInFinal} onChange={e => updateFinancial("includeCommissionInFinal", e.target.checked)} className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
                    <span className="text-[13px] text-[var(--text-dim)] group-hover:text-[var(--text-primary)] transition-colors">{t("includeCommissionInFinal")}</span>
                  </label>
                </div>
              </SubGroup>
              <div className="mt-4"><Field label={t("financialNotes")}><textarea value={financial.notes} onChange={e => updateFinancial("notes", e.target.value)} className={`${inputCls} h-20 py-2 resize-none`} placeholder={t("ph.additionalNotes")} /></Field></div>
              <SectionFooter label={t("financialTotal")} value={results.financialTotal} currency={currency} />
            </Section>

            {/* ──────── General Notes ──────── */}
            <Section icon={FileText} title={t("sec.notes")} description={t("sec.notesDesc")} defaultOpen={false}>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} className={`${inputCls} h-32 py-3 resize-none`} placeholder={t("ph.notes")} />
            </Section>
          </div>

          {/* ═══════ RIGHT: Sticky Summary ═══════ */}
          <div className="lg:sticky lg:top-28 flex flex-col max-h-[calc(100vh-8rem)]">

            {/* ── Final Warehouse Cost — Pinned Hero Card ── */}
            <div className="shrink-0 relative bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500" />
              <div className="px-5 py-5 text-center">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-ghost)] mb-2 font-medium">{t("finalWarehouseCost")}</p>
                <p className="text-[34px] font-extrabold font-mono tracking-tight leading-none">
                  <span className="text-[16px] font-semibold text-[var(--text-dim)] mr-1 align-top">{currency}</span>
                  {fmt(results.totalLandedCost)}
                </p>
                {financial.exchangeRate > 1 && (
                  <p className="text-[13px] text-[var(--text-dim)] mt-2 font-mono">{t("localCurrency")}: {fmt(results.finalWarehouseCostLocal)}</p>
                )}
                {results.totalLandedCost > 0 && unitPrice > 0 && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)]">
                    <TrendingUp className="h-3 w-3 text-[var(--text-ghost)]" />
                    <span className="text-[10px] font-medium text-[var(--text-dim)]">
                      {((results.totalLandedCost / productTotal - 1) * 100).toFixed(1)}% {t("overProductCost")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Scrollable sidebar content ── */}
            <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-1 scrollbar-thin">

            {/* ── Validation Warnings ── */}
            {warnings.length > 0 && (
              <div className="bg-amber-500/[0.05] rounded-2xl border border-amber-500/15 px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">{warnings.length} {warnings.length > 1 ? t("missingFieldsPlural") : t("missingFields")}</span>
                </div>
                <div className="space-y-1">
                  {warnings.map(w => (
                    <p key={w.field} className="text-[10px] text-amber-300/70 flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-amber-400/60 shrink-0" />
                      {t(w.messageKey)}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* ── Unit Economics ── */}
            <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
                <p className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("unitEconomics")}</p>
              </div>
              <div className="grid grid-cols-2 divide-x divide-[var(--border-subtle)] border-b border-[var(--border-subtle)]">
                <div className="px-4 py-3.5 text-center">
                  <p className="text-[9px] uppercase tracking-wider text-[var(--text-ghost)] mb-1">{t("perUnit")}</p>
                  <p className="text-[16px] font-bold font-mono tabular-nums">{fmt(results.landedCostPerUnit)}</p>
                </div>
                <div className="px-4 py-3.5 text-center">
                  <p className="text-[9px] uppercase tracking-wider text-[var(--text-ghost)] mb-1">{t("perCarton")}</p>
                  <p className="text-[16px] font-bold font-mono tabular-nums">{fmt(results.landedCostPerCarton)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-[var(--border-subtle)]">
                <div className="px-4 py-3.5 text-center">
                  <p className="text-[9px] uppercase tracking-wider text-[var(--text-ghost)] mb-1">{t("perCBM")}</p>
                  <p className="text-[16px] font-bold font-mono tabular-nums">{fmt(results.landedCostPerCbm)}</p>
                </div>
                <div className="px-4 py-3.5 text-center">
                  <p className="text-[9px] uppercase tracking-wider text-[var(--text-ghost)] mb-1">{t("perKG")}</p>
                  <p className="text-[16px] font-bold font-mono tabular-nums">{fmt(results.landedCostPerKg)}</p>
                </div>
              </div>
            </div>

            {/* ── Cost Breakdown ── */}
            <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
                <p className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("costBreakdown")}</p>
              </div>
              <div className="px-5 py-4 space-y-3">
                {[
                  { label: t("cost.product"), val: results.productTotal, pct: results.pctProduct, color: "bg-blue-500", dot: "bg-blue-400" },
                  { label: t("cost.export"), val: results.exportTotal, pct: results.pctExport, color: "bg-amber-500", dot: "bg-amber-400" },
                  { label: t("cost.shipping"), val: results.shippingTotal, pct: results.pctShipping, color: "bg-cyan-500", dot: "bg-cyan-400" },
                  { label: t("cost.import"), val: results.importTotal, pct: results.pctImport, color: "bg-purple-500", dot: "bg-purple-400" },
                  { label: t("cost.inland"), val: results.inlandTotal, pct: results.pctInland, color: "bg-emerald-500", dot: "bg-emerald-400" },
                  { label: t("cost.financial"), val: results.financialTotal, pct: results.pctFinancial, color: "bg-pink-500", dot: "bg-pink-400" },
                ].map(row => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="flex items-center gap-1.5 text-[var(--text-dim)]">
                        <span className={`w-2 h-2 rounded-full ${row.dot}`} />
                        {row.label}
                      </span>
                      <span className="font-mono text-[var(--text-primary)] tabular-nums">
                        {fmt(row.val)}<span className="text-[var(--text-ghost)] ml-1">({row.pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--bg-inverted)]/[0.06] overflow-hidden">
                      <div className={`h-full rounded-full ${row.color} transition-all duration-500`} style={{ width: `${Math.min(row.pct, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mx-5 mb-4 pt-3 border-t border-dashed border-[var(--border-subtle)]/60 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[var(--text-dim)]">{t("total")}</span>
                <span className="text-[13px] font-bold font-mono text-[var(--text-primary)] tabular-nums">{currency} {fmt(results.totalLandedCost)}</span>
              </div>
            </div>

            {/* ── Simulation Details ── */}
            <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
                <p className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("simulationDetails")}</p>
              </div>
              <div className="divide-y divide-[var(--border-subtle)]">
                {[
                  { l: t("cost.product"), v: productName || "—" },
                  { l: t("customerName"), v: customerCompany || customerName || "—" },
                  { l: t("destination"), v: [customerCountry, customerCity].filter(Boolean).join(", ") || "—" },
                  { l: t("quantity"), v: `${quantity} ${t("units")}` },
                  { l: t("priceBasis"), v: priceBasis },
                  { l: t("currency"), v: currency },
                ].map(r => (
                  <div key={r.l} className="flex items-center justify-between px-5 py-2.5">
                    <span className="text-[11px] text-[var(--text-ghost)]">{r.l}</span>
                    <span className="text-[12px] font-medium text-[var(--text-primary)] text-right max-w-[180px] truncate">{r.v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Print button */}
            {!isNew && (
              <Link href={`/landed-cost/${id}/print`} target="_blank" className="w-full h-10 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[12px] font-medium flex items-center justify-center gap-2 hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all">
                <Printer className="h-3.5 w-3.5" /> {t("printReport")}
              </Link>
            )}
            </div>{/* end scrollable sidebar content */}
          </div>
        </div>
      </div>
    </div>
  );
}
