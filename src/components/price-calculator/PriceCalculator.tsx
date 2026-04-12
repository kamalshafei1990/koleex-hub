"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calculator, ArrowLeft, Plus, Trash2, RefreshCw, ChevronDown, ChevronUp,
  TrendingUp, DollarSign, Globe, Users, Package, Percent, ShieldCheck,
  Zap, Tag, Copy, FileText, Printer, Share2, Info, Activity, Layers, Settings,
} from "lucide-react";
import { fetchPricingConfig, type PricingConfig } from "@/lib/pricing-config";

/* ═══════════════════ CONSTANTS ═══════════════════ */

const TAX_REFUND_DEFAULT = 0.10;

const CATEGORIES = [
  { id: "level1", name: "Level 1 – Entry / Volume Basic", min: -Infinity, max: 5000, marginPct: 0.05 },
  { id: "level2", name: "Level 2 – Standard Commercial", min: 5000, max: 20000, marginPct: 0.10 },
  { id: "level3", name: "Level 3 – Advanced / Semi-Industrial", min: 20000, max: 50000, marginPct: 0.15 },
  { id: "level4", name: "Level 4 – High-End / Strategic", min: 50000, max: Infinity, marginPct: 0.25 },
];

const COUNTRIES = [
  { code: "EG", name: "Egypt", currency: "EGP", adjustmentPct: -0.03 },
  { code: "US", name: "United States", currency: "USD", adjustmentPct: 0.08 },
  { code: "DE", name: "Germany", currency: "EUR", adjustmentPct: 0.08 },
  { code: "TR", name: "Turkey", currency: "TRY", adjustmentPct: 0.02 },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", adjustmentPct: 0.03 },
  { code: "AE", name: "United Arab Emirates", currency: "AED", adjustmentPct: 0.04 },
  { code: "IN", name: "India", currency: "INR", adjustmentPct: 0.01 },
  { code: "CN", name: "China", currency: "CNY", adjustmentPct: 0.00 },
  { code: "BR", name: "Brazil", currency: "BRL", adjustmentPct: 0.05 },
  { code: "ZA", name: "South Africa", currency: "ZAR", adjustmentPct: 0.02 },
];

const CUSTOMER_RULES = [
  { id: "agent", name: "Agent", rel: "base", markupPct: -0.03 },
  { id: "distributor", name: "Distributor", rel: "agent", markupPct: 0.08 },
  { id: "dealer", name: "Dealer", rel: "distributor", markupPct: 0.08 },
  { id: "enduser", name: "End-User", rel: "dealer", markupPct: 0.20 },
];

const ROW_ORDER = [
  { id: "base", name: "Base Price" },
  { id: "agent", name: "Agent" },
  { id: "distributor", name: "Distributor" },
  { id: "dealer", name: "Dealer" },
  { id: "enduser", name: "End-User" },
];

/* ═══════════════════ TYPES ═══════════════════ */

interface ProductItem { id: string; name: string; costCny: number; qty: number; }
type FxRisk = "stable" | "usd_down" | "usd_up";
type OverrideMode = "percentage" | "amount";

interface ItemResult {
  name: string; qty: number; costCny: number; costUsd: number;
  categoryName: string; marginPct: number; marginUsd: number;
  initialBase: number; countryAdjusted: number; finalBase: number;
  taxRefundPerUnit: number;
  channelPrices: Record<string, number>;
  channelProfits: Record<string, number>;
  channelProfitsWithTax: Record<string, number>;
}

interface CalcResult {
  items: ItemResult[]; totalCostCny: number; totalCostUsd: number;
  exchangeRate: number; totalItems: number; totalQty: number;
  categoryName: string; countryName: string; countryAdjPct: number;
  customerType: string; discountPct: number; overrideActive: boolean;
  overrideMode: OverrideMode; overrideValue: number;
  fxRisk: FxRisk; includeTaxRefund: boolean;
}

/* ═══════════════════ HELPERS ═══════════════════ */

function fmt(n: number, d = 2) { return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }
function pct(n: number) { return (n * 100).toFixed(2) + "%"; }
function autoDetectCategory(cost: number) { for (const c of CATEGORIES) { if (cost >= c.min && cost < c.max) return c; } return CATEGORIES[CATEGORIES.length - 1]; }
function uid() { return Math.random().toString(36).slice(2, 10); }

/* ═══════════════════ COMPONENT ═══════════════════ */

export default function PriceCalculator() {
  const [products, setProducts] = useState<ProductItem[]>([{ id: uid(), name: "", costCny: 0, qty: 1 }]);
  const [exchangeRate, setExchangeRate] = useState(7.18);
  const [categoryId, setCategoryId] = useState("auto");
  const [overrideActive, setOverrideActive] = useState(false);
  const [overrideMode, setOverrideMode] = useState<OverrideMode>("percentage");
  const [overrideValue, setOverrideValue] = useState(0);
  const [fxRisk, setFxRisk] = useState<FxRisk>("stable");
  const [showFxManager, setShowFxManager] = useState(false);
  const [countryCode, setCountryCode] = useState("EG");
  const [customerType, setCustomerType] = useState("enduser");
  const [discountPct, setDiscountPct] = useState(0);
  const [includeTaxRefund, setIncludeTaxRefund] = useState(true);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [fetchingRate, setFetchingRate] = useState(false);
  const [pricingConfig, setPricingConfig] = useState<PricingConfig | null>(null);

  useEffect(() => { fetchPricingConfig().then(setPricingConfig); }, []);

  async function fetchLiveRate() {
    setFetchingRate(true);
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      const data = await res.json();
      if (data?.result === "success" && data.rates?.CNY) {
        setExchangeRate(Math.round(data.rates.CNY * 100) / 100);
      }
    } catch { /* silently fail */ }
    setFetchingRate(false);
  }

  function addProduct() { setProducts(p => [...p, { id: uid(), name: "", costCny: 0, qty: 1 }]); }
  function removeProduct(id: string) { setProducts(p => p.length <= 1 ? p : p.filter(x => x.id !== id)); }
  function updateProduct(id: string, field: keyof Omit<ProductItem, "id">, value: string | number) {
    setProducts(p => p.map(x => x.id === id ? { ...x, [field]: value } : x));
  }

  function resetForm() {
    setProducts([{ id: uid(), name: "", costCny: 0, qty: 1 }]);
    setExchangeRate(7.18); setCategoryId("auto"); setOverrideActive(false);
    setOverrideMode("percentage"); setOverrideValue(0); setFxRisk("stable");
    setShowFxManager(false); setCountryCode("EG"); setCustomerType("enduser");
    setDiscountPct(0); setIncludeTaxRefund(true); setResult(null); setExpandedItems(new Set());
  }

  function generate() {
    const cats = pricingConfig?.categories ?? CATEGORIES;
    const cntrs = pricingConfig?.countries ?? COUNTRIES;
    const custs = pricingConfig ? pricingConfig.customers.filter(c => c.visible) : CUSTOMER_RULES;
    const taxRate = pricingConfig ? pricingConfig.defaultTaxRefund / 100 : TAX_REFUND_DEFAULT;
    const country = cntrs.find(c => c.code === countryCode) ?? cntrs[0];
    const autoDetect = (cost: number) => { for (const c of cats) { if (cost >= c.min && cost < c.max) return c; } return cats[cats.length - 1]; };
    const discFrac = discountPct / 100;
    const allRows = [{ id: "base", name: "Base Price" }, ...custs.map(c => ({ id: c.id, name: c.name }))];
    const itemResults: ItemResult[] = products.map(prod => {
      const costUsd = prod.costCny / exchangeRate;
      const cat = categoryId === "auto" ? autoDetect(prod.costCny) : cats.find(c => c.id === categoryId)!;
      let marginUsd: number, marginPctVal: number;
      if (overrideActive) {
        if (overrideMode === "amount") { marginUsd = overrideValue; marginPctVal = costUsd > 0 ? marginUsd / costUsd : 0; }
        else { marginPctVal = overrideValue / 100; marginUsd = costUsd * marginPctVal; }
      } else { marginPctVal = cat.marginPct; marginUsd = costUsd * marginPctVal; }
      if (fxRisk === "usd_down") marginUsd *= 1.05; else if (fxRisk === "usd_up") marginUsd *= 0.95;
      marginPctVal = costUsd > 0 ? marginUsd / costUsd : 0;
      const initialBase = costUsd + marginUsd;
      const countryAdjusted = initialBase * (1 + country.adjustmentPct);
      const finalBase = countryAdjusted * (1 - discFrac);
      const channelPrices: Record<string, number> = { base: finalBase };
      for (const rule of custs) channelPrices[rule.id] = channelPrices[rule.rel] * (1 + rule.markupPct);
      const taxRefundPerUnit = costUsd * taxRate;
      const channelProfits: Record<string, number> = {};
      const channelProfitsWithTax: Record<string, number> = {};
      for (const row of allRows) { channelProfits[row.id] = channelPrices[row.id] - costUsd; channelProfitsWithTax[row.id] = channelPrices[row.id] - costUsd + taxRefundPerUnit; }
      return { name: prod.name || "Unnamed Product", qty: prod.qty, costCny: prod.costCny, costUsd, categoryName: cat.name, marginPct: marginPctVal, marginUsd, initialBase, countryAdjusted, finalBase, taxRefundPerUnit, channelPrices, channelProfits, channelProfitsWithTax };
    });
    const totalCostCny = products.reduce((s, p) => s + p.costCny * p.qty, 0);
    const autoDetectName = categoryId === "auto" ? autoDetect(products[0]?.costCny ?? 0).name : cats.find(c => c.id === categoryId)!.name;
    setResult({ items: itemResults, totalCostCny, totalCostUsd: totalCostCny / exchangeRate, exchangeRate, totalItems: products.length, totalQty: products.reduce((s, p) => s + p.qty, 0), categoryName: autoDetectName, countryName: country.name, countryAdjPct: country.adjustmentPct, customerType, discountPct, overrideActive, overrideMode, overrideValue, fxRisk, includeTaxRefund });
    setExpandedItems(new Set());
  }

  /* ── Derived from config ── */
  const cfgCountries = pricingConfig?.countries ?? COUNTRIES;
  const cfgCategories = pricingConfig?.categories ?? CATEGORIES;
  const cfgCustomers = pricingConfig ? pricingConfig.customers.filter(c => c.visible) : CUSTOMER_RULES;
  const cfgTaxRefund = pricingConfig ? pricingConfig.defaultTaxRefund / 100 : TAX_REFUND_DEFAULT;
  const cfgMaxDiscount = pricingConfig?.maxDiscount ?? 10;
  const cfgUI = pricingConfig?.ui ?? { showOverride: true, showFxRisk: true, showTaxRefund: true };
  const selectedCountry = cfgCountries.find(c => c.code === countryCode) ?? cfgCountries[0];

  /* ── Row order for results table ── */
  const rowOrder = [{ id: "base", name: "Base Price" }, ...cfgCustomers.map(c => ({ id: c.id, name: c.name }))];

  /* ── Exact ProductForm input/select/label classes ── */
  const inputCls = "w-full h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-all";
  const selectCls = "w-full h-10 px-3 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-all appearance-none cursor-pointer";
  const labelCls = "block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5";

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* ── Page Header ── */}
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <Link href="/" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0"><Calculator className="h-4 w-4" /></div>
            <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">Price Calculator</h1>
          </div>
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <Link href="/price-calculator/settings" className="h-8 w-8 md:h-10 md:w-auto md:px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-medium flex items-center justify-center gap-2 hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all">
              <Settings className="h-3.5 w-3.5" /> <span className="hidden md:inline">Settings</span>
            </Link>
            <button onClick={resetForm} className="h-8 w-8 md:h-10 md:w-auto md:px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-medium flex items-center justify-center gap-2 hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all">
              <RefreshCw className="h-3.5 w-3.5" /> <span className="hidden md:inline">Reset</span>
            </button>
            <button onClick={generate} className="hidden md:flex h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold items-center gap-2 hover:opacity-90 transition-all shadow-lg">
              <Zap className="h-4 w-4" /> Generate Price
            </button>
          </div>
        </div>
        <p className="text-[12px] md:text-[13px] text-[var(--text-dim)] mb-6 md:mb-8 ml-11">Generate channel pricing with shipping-adjusted ERP logic</p>

        {/* ── Two Column Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6 items-start">

          {/* ═══════ LEFT: Form ═══════ */}
          <div className="space-y-4">

            {/* Products Section */}
            <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
              <div className="flex items-center gap-3 px-4 md:px-6 py-4">
                <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0"><Package className="h-4 w-4" /></div>
                <span className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight flex-1">Products</span>
                <button onClick={addProduct} className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[11px] font-semibold flex items-center gap-1.5 hover:opacity-90 transition-all">
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
              <div className="px-4 md:px-6 pb-5 pt-0 border-t border-[var(--border-subtle)] space-y-3">
                {products.map((prod, i) => (
                  <div key={prod.id} className="mt-3 first:mt-3 space-y-2">
                    {/* Row 1: Name + Delete */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--text-ghost)] w-4 shrink-0 text-center font-mono">{i + 1}</span>
                      <input type="text" value={prod.name} onChange={e => updateProduct(prod.id, "name", e.target.value)} placeholder="Product name" className={`${inputCls} flex-1 min-w-0`} />
                      {products.length > 1
                        ? <button onClick={() => removeProduct(prod.id)} className="h-8 w-8 rounded-lg hover:bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-dim)] hover:text-red-400 transition-colors shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                        : <span className="w-8 shrink-0 hidden md:block" />}
                    </div>
                    {/* Row 2: Cost + Qty */}
                    <div className="flex items-center gap-2 pl-6">
                      <div className="relative flex-1">
                        <input type="number" min={0} step="0.01" value={prod.costCny || ""} onChange={e => updateProduct(prod.id, "costCny", parseFloat(e.target.value) || 0)} placeholder="Cost" className={`${inputCls} pr-10`} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-ghost)]">CNY</span>
                      </div>
                      <div className="relative w-24 shrink-0">
                        <input type="number" min={1} step={1} value={prod.qty || ""} onChange={e => updateProduct(prod.id, "qty", parseInt(e.target.value) || 1)} placeholder="Qty" className={`${inputCls} pr-7`} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-ghost)]">x</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Exchange Rate */}
            <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
              <div className="flex items-center gap-3 px-4 md:px-6 py-4">
                <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0"><DollarSign className="h-4 w-4" /></div>
                <span className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight">Exchange Rate</span>
              </div>
              <div className="px-4 md:px-6 pb-5 pt-2 border-t border-[var(--border-subtle)] space-y-3">
                <div>
                  <label className={labelCls}>USD/CNY Rate</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0.01} step="0.01" value={exchangeRate || ""} onChange={e => setExchangeRate(parseFloat(e.target.value) || 0)} className={`${inputCls} flex-1`} />
                    <button onClick={fetchLiveRate} disabled={fetchingRate} className="h-10 px-3 md:px-4 rounded-xl border border-green-500/30 text-green-400 text-[11px] md:text-[12px] font-medium hover:bg-green-500/10 transition-all whitespace-nowrap shrink-0 flex items-center gap-2 disabled:opacity-50"><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>{fetchingRate ? "Fetching..." : "Live Rate"}</button>
                    {cfgUI.showFxRisk && <button onClick={() => setShowFxManager(!showFxManager)} className={`h-10 px-3 md:px-4 rounded-xl border text-[11px] md:text-[12px] font-medium whitespace-nowrap transition-all shrink-0 ${showFxManager ? "border-red-500/50 text-red-400 bg-red-500/10" : "border-red-500/30 text-red-400 hover:bg-red-500/10"}`}>FX Risk</button>}
                  </div>
                </div>
                {showFxManager && (
                  <div className="bg-[var(--bg-inverted)]/[0.03] border border-[var(--border-subtle)] rounded-xl p-4 space-y-2">
                    <label className={labelCls}>FX Risk Scenario</label>
                    <select value={fxRisk} onChange={e => setFxRisk(e.target.value as FxRisk)} className={selectCls}>
                      <option value="stable">Stable (No change)</option>
                      <option value="usd_down">Expect USD to Fall</option>
                      <option value="usd_up">Expect USD to Rise</option>
                    </select>
                    <p className="text-[11px] text-[var(--text-ghost)]">Adjusts margin sensitivity before country/discount adjustments.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Pricing Configuration */}
            <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
              <div className="flex items-center gap-3 px-4 md:px-6 py-4">
                <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0"><Layers className="h-4 w-4" /></div>
                <span className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight">Pricing Configuration</span>
              </div>
              <div className="px-4 md:px-6 pb-5 pt-2 border-t border-[var(--border-subtle)] space-y-5">
                <div>
                  <label className={labelCls}>Product Category</label>
                  <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={selectCls}>
                    <option value="auto">Auto-Detect (Smart Margin)</option>
                    {cfgCategories.map(c => <option key={c.id} value={c.id}>{c.name} ({(c.marginPct * 100).toFixed(0)}%)</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Target Country</label>
                  <select value={countryCode} onChange={e => setCountryCode(e.target.value)} className={selectCls}>
                    {cfgCountries.map(c => <option key={c.code} value={c.code}>{c.name} ({c.currency})</option>)}
                  </select>
                  <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-blue-500/[0.06] border border-blue-500/15">
                    <Info className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <span className="text-[11px] text-blue-300/80">Country adjustment: <span className="font-semibold">{selectedCountry.adjustmentPct >= 0 ? "+" : ""}{(selectedCountry.adjustmentPct * 100).toFixed(0)}%</span></span>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Target Customer Type</label>
                  <select value={customerType} onChange={e => setCustomerType(e.target.value)} className={selectCls}>
                    {cfgCustomers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Adjustments */}
            <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
              <div className="flex items-center gap-3 px-4 md:px-6 py-4">
                <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0"><Percent className="h-4 w-4" /></div>
                <span className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight">Adjustments</span>
              </div>
              <div className="px-4 md:px-6 pb-5 pt-2 border-t border-[var(--border-subtle)] space-y-4">
                {/* Override */}
                {cfgUI.showOverride && (
                  <>
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input type="checkbox" checked={overrideActive} onChange={() => setOverrideActive(!overrideActive)} className="w-4 h-4 rounded border-[var(--border-subtle)] bg-transparent accent-blue-600 cursor-pointer" />
                      <span className="text-[13px] font-medium">Override Default Profit Margin</span>
                    </label>
                    {overrideActive && (
                      <div className="grid grid-cols-2 gap-3 pl-7">
                        <div>
                          <label className={labelCls}>Override Type</label>
                          <select value={overrideMode} onChange={e => setOverrideMode(e.target.value as OverrideMode)} className={selectCls}>
                            <option value="percentage">By Percentage</option>
                            <option value="amount">By Amount USD</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Value</label>
                          <input type="number" min={0} step={overrideMode === "percentage" ? "0.1" : "0.01"} value={overrideValue || ""} onChange={e => setOverrideValue(parseFloat(e.target.value) || 0)} placeholder={overrideMode === "percentage" ? "e.g. 12" : "e.g. 150"} className={inputCls} />
                        </div>
                      </div>
                    )}
                  </>
                )}
                {/* Discount */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[12px] font-medium text-[var(--text-subtle)] flex items-center gap-2"><Tag className="h-3.5 w-3.5 text-orange-400" /> Manual Discount</label>
                    <span className="text-[13px] font-mono font-semibold text-blue-400 tabular-nums">{discountPct}%</span>
                  </div>
                  <input type="range" min={0} max={cfgMaxDiscount} step={1} value={discountPct} onChange={e => setDiscountPct(parseInt(e.target.value))} className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-blue-500" style={{ background: `linear-gradient(to right, #3b82f6 ${cfgMaxDiscount > 0 ? (discountPct / cfgMaxDiscount) * 100 : 0}%, rgba(255,255,255,0.06) ${cfgMaxDiscount > 0 ? (discountPct / cfgMaxDiscount) * 100 : 0}%)` }} />
                  <div className="flex justify-between text-[9px] text-[var(--text-ghost)]"><span>0%</span><span>{Math.floor(cfgMaxDiscount / 2)}%</span><span>{cfgMaxDiscount}%</span></div>
                </div>
                {/* Tax Refund */}
                {cfgUI.showTaxRefund && (
                  <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
                    <input type="checkbox" checked={includeTaxRefund} onChange={() => setIncludeTaxRefund(!includeTaxRefund)} className="w-4 h-4 rounded border-[var(--border-subtle)] bg-transparent accent-emerald-600 cursor-pointer" />
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-[13px] font-medium">Include Tax Refund ({(cfgTaxRefund * 100).toFixed(0)}%)</span>
                  </label>
                )}
              </div>
            </div>

            {/* Mobile Generate Button */}
            <button onClick={generate} className="w-full h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg lg:hidden">
              <Zap className="h-4 w-4" /> Generate Price
            </button>
          </div>

          {/* ═══════ RIGHT: Results ═══════ */}
          <div className="space-y-4">
            {!result ? (
              <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-8 md:p-12 flex flex-col items-center justify-center text-center min-h-[500px]">
                <div className="h-14 w-14 rounded-2xl bg-[var(--bg-surface-subtle)] flex items-center justify-center mb-4">
                  <Calculator className="h-7 w-7 text-[var(--text-ghost)]" />
                </div>
                <h3 className="text-[14px] font-semibold text-[var(--text-muted)] mb-1">No Quotation Yet</h3>
                <p className="text-[12px] text-[var(--text-dim)] max-w-[280px]">Fill in the product details and click Generate Price to see channel pricing results.</p>
              </div>
            ) : (
              <>
                {/* Quotation Header */}
                <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
                  <div className="flex items-center gap-3 px-4 md:px-6 py-4">
                    <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0"><Activity className="h-4 w-4" /></div>
                    <span className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight flex-1">Quotation Details</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] font-medium text-purple-300">
                        <Globe className="h-3 w-3" /> {result.countryName}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-[10px] font-medium text-pink-300">
                        <Users className="h-3 w-3" /> {cfgCustomers.find(r => r.id === result.customerType)?.name}
                      </span>
                    </div>
                  </div>
                  <div className="border-t border-[var(--border-subtle)]">
                    <KV label="Cost CNY" value={`¥${fmt(result.totalCostCny)}`} />
                    <KV label="Cost USD" value={`$${fmt(result.totalCostUsd)}`} />
                    <KV label="Items / Qty" value={`${result.totalItems} items / ${result.totalQty} units`} />
                    <KV label="Margin %" value={pct(result.items[0].marginPct)} />
                    <KV label="Country Adj." value={`${result.countryAdjPct >= 0 ? "+" : ""}${(result.countryAdjPct * 100).toFixed(1)}%`} />
                    {result.discountPct > 0 && <KV label="Discount" value={`${result.discountPct}%`} />}
                    <div className="flex items-center justify-between px-4 md:px-6 py-3 bg-blue-500/[0.06] border-t border-[var(--border-subtle)]">
                      <span className="text-[12px] font-semibold text-blue-300">Final Base Price</span>
                      <span className="text-[14px] font-bold font-mono text-blue-400">${fmt(result.items[0].finalBase)}</span>
                    </div>
                    {(() => {
                      const tp = result.items.reduce((s, i) => s + i.channelProfits[result.customerType] * i.qty, 0);
                      return (
                        <div className="flex items-center justify-between px-4 md:px-6 py-3 bg-emerald-500/[0.06] border-t border-[var(--border-subtle)]">
                          <span className="text-[12px] font-semibold text-emerald-300">Total Profit</span>
                          <span className={`text-[14px] font-bold font-mono ${tp >= 0 ? "text-emerald-400" : "text-red-400"}`}>{tp >= 0 ? "+" : ""}${fmt(tp)}</span>
                        </div>
                      );
                    })()}
                    <KV label="Tax Refund" value={result.includeTaxRefund ? "Enabled" : "Disabled"} last />
                  </div>
                </div>

                {/* Per-Product (multi-item) */}
                {result.items.length > 1 && result.items.map((item, idx) => {
                  const isExp = expandedItems.has(idx);
                  return (
                    <div key={idx} className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
                      <button onClick={() => { setExpandedItems(prev => { const n = new Set(prev); if (n.has(idx)) n.delete(idx); else n.add(idx); return n; }); }} className="w-full px-4 md:px-6 py-3.5 flex items-center justify-between hover:bg-[var(--bg-surface-subtle)]/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <Package className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                          <span className="text-[13px] font-medium truncate">{item.name}</span>
                          <span className="text-[10px] text-[var(--text-ghost)] shrink-0">Qty: {item.qty} | ¥{fmt(item.costCny)} | ${fmt(item.costUsd)}</span>
                        </div>
                        {isExp ? <ChevronUp className="h-4 w-4 text-[var(--text-ghost)]" /> : <ChevronDown className="h-4 w-4 text-[var(--text-ghost)]" />}
                      </button>
                      {isExp && (
                        <div className="border-t border-[var(--border-subtle)]">
                          <KV label="Category" value={item.categoryName} />
                          <KV label="Margin %" value={pct(item.marginPct)} />
                          <KV label="Margin USD" value={`$${fmt(item.marginUsd)}`} />
                          <KV label="Initial Base" value={`$${fmt(item.initialBase)}`} />
                          <KV label="After Country" value={`$${fmt(item.countryAdjusted)}`} />
                          <KV label="Final Base" value={`$${fmt(item.finalBase)}`} last />
                          <ChannelTable item={item} result={result} rows={rowOrder} />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Grand Total Table */}
                <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
                  <div className="flex items-center gap-3 px-4 md:px-6 py-4">
                    <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0"><TrendingUp className="h-4 w-4" /></div>
                    <span className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight">Grand Total Pricing</span>
                  </div>
                  <div className="overflow-x-auto border-t border-[var(--border-subtle)]">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="bg-[var(--bg-surface-subtle)]">
                          <th className="text-left px-4 md:px-6 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Channel</th>
                          <th className="text-right px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Unit Price</th>
                          <th className="text-right px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Total</th>
                          <th className="text-right px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Profit</th>
                          {result.includeTaxRefund && <th className="text-right px-3 md:px-6 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">+ Tax</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {rowOrder.map(row => {
                          let totalTotal = 0, totalProfit = 0, totalProfitTax = 0;
                          for (const item of result.items) { totalTotal += item.channelPrices[row.id] * item.qty; totalProfit += item.channelProfits[row.id]; totalProfitTax += item.channelProfitsWithTax[row.id]; }
                          const unitPrice = result.items.length === 1 ? result.items[0].channelPrices[row.id] : result.items.reduce((s, i) => s + i.channelPrices[row.id], 0);
                          const profit = result.items.length === 1 ? result.items[0].channelProfits[row.id] : totalProfit;
                          const profitTax = result.items.length === 1 ? result.items[0].channelProfitsWithTax[row.id] : totalProfitTax;
                          const isTarget = row.id === result.customerType;
                          return (
                            <tr key={row.id} className={`transition-colors ${isTarget ? "bg-blue-500/[0.06]" : "hover:bg-[var(--bg-surface-subtle)]"}`}>
                              <td className="px-6 py-3 font-medium">{row.name}{isTarget && <span className="ml-2 text-[8px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">Target</span>}</td>
                              <td className="text-right px-4 py-3 font-mono text-[var(--text-highlight)]">${fmt(unitPrice)}</td>
                              <td className="text-right px-4 py-3 font-mono text-[var(--text-highlight)]">${fmt(totalTotal)}</td>
                              <td className={`text-right px-4 py-3 font-mono ${profit >= 0 ? "text-green-400" : "text-red-400"}`}>{profit >= 0 ? "+" : ""}${fmt(profit)}</td>
                              {result.includeTaxRefund && <td className={`text-right px-3 md:px-6 py-3 font-mono ${profitTax >= 0 ? "text-emerald-400" : "text-red-400"}`}>{profitTax >= 0 ? "+" : ""}${fmt(profitTax)}</td>}
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        {(() => {
                          const tr = result.customerType;
                          let ft = 0, fp = 0, fpt = 0;
                          for (const item of result.items) { ft += item.channelPrices[tr] * item.qty; fp += item.channelProfits[tr] * item.qty; fpt += item.channelProfitsWithTax[tr] * item.qty; }
                          return (
                            <tr className="border-t-2 border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
                              <td className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Grand Total</td>
                              <td className="text-right px-4 py-3 font-mono font-semibold text-[var(--text-ghost)]">--</td>
                              <td className="text-right px-4 py-3 font-mono font-bold text-[var(--text-primary)]">${fmt(ft)}</td>
                              <td className={`text-right px-4 py-3 font-mono font-bold ${fp >= 0 ? "text-green-400" : "text-red-400"}`}>{fp >= 0 ? "+" : ""}${fmt(fp)}</td>
                              {result.includeTaxRefund && <td className={`text-right px-3 md:px-6 py-3 font-mono font-bold ${fpt >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fpt >= 0 ? "+" : ""}${fmt(fpt)}</td>}
                            </tr>
                          );
                        })()}
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { icon: Copy, label: "Copy", fn: () => { navigator.clipboard?.writeText(`Quotation: ${result.countryName} | ${cfgCustomers.find(r => r.id === result.customerType)?.name}\nBase Price: $${fmt(result.items[0].finalBase)}\nTotal Cost: $${fmt(result.totalCostUsd)}`); } },
                    { icon: FileText, label: "Export PDF", fn: () => {} },
                    { icon: Printer, label: "Print", fn: () => window.print() },
                    { icon: Share2, label: "Share", fn: () => {} },
                  ].map(b => (
                    <button key={b.label} onClick={b.fn} className="h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[12px] font-medium flex items-center gap-2 hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all">
                      <b.icon className="h-3.5 w-3.5" /> {b.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ SUB-COMPONENTS ═══════════════════ */

function KV({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 md:px-6 py-2.5 ${last ? "" : "border-b border-[var(--border-subtle)]"}`}>
      <span className="text-[11px] md:text-[12px] text-[var(--text-dim)] shrink-0">{label}</span>
      <span className="text-[12px] md:text-[13px] font-mono text-[var(--text-highlight)] text-right">{value}</span>
    </div>
  );
}

function ChannelTable({ item, result, rows }: { item: ItemResult; result: CalcResult; rows: { id: string; name: string }[] }) {
  return (
    <div className="overflow-x-auto border-t border-[var(--border-subtle)]">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-[var(--bg-surface-subtle)]">
            <th className="text-left px-3 md:px-6 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Channel</th>
            <th className="text-right px-2 md:px-4 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Unit</th>
            <th className="text-right px-2 md:px-4 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Total</th>
            <th className="text-right px-2 md:px-4 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Profit</th>
            {result.includeTaxRefund && <th className="text-right px-3 md:px-6 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">+Tax</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {rows.map(row => {
            const up = item.channelPrices[row.id], pr = item.channelProfits[row.id], pt = item.channelProfitsWithTax[row.id];
            const isTarget = row.id === result.customerType;
            return (
              <tr key={row.id} className={`${isTarget ? "bg-blue-500/[0.06]" : "hover:bg-[var(--bg-surface-subtle)]"}`}>
                <td className="px-6 py-2 font-medium">{row.name}{isTarget && <span className="ml-2 text-[7px] bg-blue-600 text-white px-1 py-0.5 rounded font-semibold uppercase">Target</span>}</td>
                <td className="text-right px-4 py-2 font-mono text-[var(--text-highlight)]">${fmt(up)}</td>
                <td className="text-right px-4 py-2 font-mono text-[var(--text-highlight)]">${fmt(up * item.qty)}</td>
                <td className={`text-right px-4 py-2 font-mono ${pr >= 0 ? "text-green-400" : "text-red-400"}`}>{pr >= 0 ? "+" : ""}${fmt(pr)}</td>
                {result.includeTaxRefund && <td className={`text-right px-6 py-2 font-mono ${pt >= 0 ? "text-emerald-400" : "text-red-400"}`}>{pt >= 0 ? "+" : ""}${fmt(pt)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
