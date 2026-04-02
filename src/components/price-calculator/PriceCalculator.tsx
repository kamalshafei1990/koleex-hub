"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calculator,
  ArrowLeft,
  Plus,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  TrendingUp,
  Minus,
  DollarSign,
  Globe,
  Users,
  Package,
  Percent,
  ShieldCheck,
  Zap,
} from "lucide-react";

/* ════════════════════════════════════════════════════════════════════
   CONSTANTS
   ════════════════════════════════════════════════════════════════════ */

const PRICE_CALC_TAX_REFUND_DEFAULT = 0.10;

const CATEGORIES = [
  { id: "level1", name: "Level 1 \u2013 Entry / Volume Basic", min: -Infinity, max: 5000, marginPct: 0.05 },
  { id: "level2", name: "Level 2 \u2013 Standard Commercial", min: 5000, max: 20000, marginPct: 0.10 },
  { id: "level3", name: "Level 3 \u2013 Advanced / Semi-Industrial Systems", min: 20000, max: 50000, marginPct: 0.15 },
  { id: "level4", name: "Level 4 \u2013 High-End / Strategic Equipment", min: 50000, max: Infinity, marginPct: 0.25 },
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

/* ════════════════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════════════════ */

interface ProductItem {
  id: string;
  name: string;
  costCny: number;
  qty: number;
}

type FxRisk = "stable" | "usd_down" | "usd_up";
type OverrideMode = "percentage" | "amount";

interface ItemResult {
  name: string;
  qty: number;
  costCny: number;
  costUsd: number;
  categoryName: string;
  marginPct: number;
  marginUsd: number;
  initialBase: number;
  countryAdjusted: number;
  finalBase: number;
  taxRefundPerUnit: number;
  channelPrices: Record<string, number>;
  channelProfits: Record<string, number>;
  channelProfitsWithTax: Record<string, number>;
}

interface CalculationResult {
  items: ItemResult[];
  totalCostCny: number;
  totalCostUsd: number;
  exchangeRate: number;
  totalItems: number;
  totalQty: number;
  categoryName: string;
  countryName: string;
  countryAdjPct: number;
  customerType: string;
  discountPct: number;
  overrideActive: boolean;
  overrideMode: OverrideMode;
  overrideValue: number;
  fxRisk: FxRisk;
  includeTaxRefund: boolean;
}

/* ════════════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════════════ */

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function pct(n: number): string {
  return (n * 100).toFixed(2) + "%";
}

function autoDetectCategory(costCny: number) {
  for (const cat of CATEGORIES) {
    if (costCny >= cat.min && costCny < cat.max) return cat;
  }
  return CATEGORIES[CATEGORIES.length - 1];
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/* ════════════════════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════════════════════ */

export default function PriceCalculator() {
  /* ── Form State ── */
  const [products, setProducts] = useState<ProductItem[]>([
    { id: uid(), name: "", costCny: 0, qty: 1 },
  ]);
  const [exchangeRate, setExchangeRate] = useState(7.18);
  const [categoryId, setCategoryId] = useState("auto");
  const [overrideActive, setOverrideActive] = useState(false);
  const [overrideMode, setOverrideMode] = useState<OverrideMode>("percentage");
  const [overrideValue, setOverrideValue] = useState(0);
  const [fxRisk, setFxRisk] = useState<FxRisk>("stable");
  const [countryCode, setCountryCode] = useState("EG");
  const [customerType, setCustomerType] = useState("enduser");
  const [discountPct, setDiscountPct] = useState(0);
  const [includeTaxRefund, setIncludeTaxRefund] = useState(true);

  /* ── Results State ── */
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  /* ── Product CRUD ── */
  function addProduct() {
    setProducts((prev) => [...prev, { id: uid(), name: "", costCny: 0, qty: 1 }]);
  }

  function removeProduct(id: string) {
    setProducts((prev) => (prev.length <= 1 ? prev : prev.filter((p) => p.id !== id)));
  }

  function updateProduct(id: string, field: keyof Omit<ProductItem, "id">, value: string | number) {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  }

  /* ── Reset ── */
  function resetForm() {
    setProducts([{ id: uid(), name: "", costCny: 0, qty: 1 }]);
    setExchangeRate(7.18);
    setCategoryId("auto");
    setOverrideActive(false);
    setOverrideMode("percentage");
    setOverrideValue(0);
    setFxRisk("stable");
    setCountryCode("EG");
    setCustomerType("enduser");
    setDiscountPct(0);
    setIncludeTaxRefund(true);
    setResult(null);
    setExpandedItems(new Set());
  }

  /* ── Computation ── */
  function generate() {
    const country = COUNTRIES.find((c) => c.code === countryCode)!;
    const discFrac = discountPct / 100;

    const itemResults: ItemResult[] = products.map((prod) => {
      // 1. costUsd
      const costUsd = prod.costCny / exchangeRate;

      // 2. Detect / select category
      const cat =
        categoryId === "auto"
          ? autoDetectCategory(prod.costCny)
          : CATEGORIES.find((c) => c.id === categoryId)!;

      // 3. Base margin
      let marginUsd: number;
      let marginPctVal: number;

      if (overrideActive) {
        // 4. Override
        if (overrideMode === "amount") {
          marginUsd = overrideValue;
          marginPctVal = costUsd > 0 ? marginUsd / costUsd : 0;
        } else {
          marginPctVal = overrideValue / 100;
          marginUsd = costUsd * marginPctVal;
        }
      } else {
        marginPctVal = cat.marginPct;
        marginUsd = costUsd * marginPctVal;
      }

      // 5. FX hedging
      if (fxRisk === "usd_down") {
        marginUsd *= 1.05;
      } else if (fxRisk === "usd_up") {
        marginUsd *= 0.95;
      }

      // 6. Recalculate marginPct after FX
      marginPctVal = costUsd > 0 ? marginUsd / costUsd : 0;

      // 7. initialBase
      const initialBase = costUsd + marginUsd;

      // 8. countryAdjusted
      const countryAdjusted = initialBase * (1 + country.adjustmentPct);

      // 9. finalBase (after discount)
      const finalBase = countryAdjusted * (1 - discFrac);

      // 10. Channel chain
      const channelPrices: Record<string, number> = { base: finalBase };
      for (const rule of CUSTOMER_RULES) {
        channelPrices[rule.id] = channelPrices[rule.rel] * (1 + rule.markupPct);
      }

      // 11. Tax refund per unit
      const taxRefundPerUnit = costUsd * PRICE_CALC_TAX_REFUND_DEFAULT;

      // 12. Profit per channel
      const channelProfits: Record<string, number> = {};
      const channelProfitsWithTax: Record<string, number> = {};
      for (const row of ROW_ORDER) {
        const unitPrice = channelPrices[row.id];
        channelProfits[row.id] = unitPrice - costUsd;
        channelProfitsWithTax[row.id] = unitPrice - costUsd + taxRefundPerUnit;
      }

      return {
        name: prod.name || "Unnamed Product",
        qty: prod.qty,
        costCny: prod.costCny,
        costUsd,
        categoryName: cat.name,
        marginPct: marginPctVal,
        marginUsd,
        initialBase,
        countryAdjusted,
        finalBase,
        taxRefundPerUnit,
        channelPrices,
        channelProfits,
        channelProfitsWithTax,
      };
    });

    const totalCostCny = products.reduce((s, p) => s + p.costCny * p.qty, 0);
    const totalCostUsd = totalCostCny / exchangeRate;
    const totalQty = products.reduce((s, p) => s + p.qty, 0);

    // Use first item's category for summary (or auto-detect on total)
    const summaryCategory =
      categoryId === "auto"
        ? autoDetectCategory(products[0]?.costCny ?? 0).name
        : CATEGORIES.find((c) => c.id === categoryId)!.name;

    setResult({
      items: itemResults,
      totalCostCny,
      totalCostUsd,
      exchangeRate,
      totalItems: products.length,
      totalQty,
      categoryName: summaryCategory,
      countryName: country.name,
      countryAdjPct: country.adjustmentPct,
      customerType,
      discountPct,
      overrideActive,
      overrideMode,
      overrideValue,
      fxRisk,
      includeTaxRefund,
    });

    setExpandedItems(new Set());
  }

  function toggleItemExpand(idx: number) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  /* ── Derived ── */
  const selectedCountry = COUNTRIES.find((c) => c.code === countryCode)!;

  /* ════════════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════════════ */

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0A0A0A]/80 border-b border-[#222]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Back to Hub</span>
            </Link>
            <div className="h-5 w-px bg-[#333]" />
            <div className="flex items-center gap-2">
              <Calculator size={20} className="text-blue-400" />
              <h1 className="text-base font-semibold tracking-tight">Price Calculator</h1>
            </div>
          </div>
          <button
            onClick={resetForm}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white/60 hover:text-white border border-[#333] hover:border-[#555] transition-all"
          >
            <RefreshCw size={14} />
            Reset
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ════════════════════════════════════════
             LEFT COLUMN: INPUTS
             ════════════════════════════════════════ */}
          <div className="lg:col-span-5 space-y-5">
            {/* ── Products ── */}
            <section className="bg-[#111] border border-[#222] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Package size={16} className="text-blue-400" />
                  <h2 className="text-sm font-semibold">Products</h2>
                </div>
                <button
                  onClick={addProduct}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 transition-colors"
                >
                  <Plus size={14} />
                  Add Item
                </button>
              </div>

              <div className="space-y-3">
                {products.map((prod, i) => (
                  <div
                    key={prod.id}
                    className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3.5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
                        Item {i + 1}
                      </span>
                      {products.length > 1 && (
                        <button
                          onClick={() => removeProduct(prod.id)}
                          className="text-red-400/60 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] text-white/50 mb-1">Product Name</label>
                      <input
                        type="text"
                        value={prod.name}
                        onChange={(e) => updateProduct(prod.id, "name", e.target.value)}
                        placeholder="e.g. Solar Panel 400W"
                        className="w-full h-9 px-3 bg-[#0A0A0A] border border-[#333] rounded-lg text-sm text-white placeholder:text-white/20 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-white/50 mb-1">
                          Unit Cost (CNY)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={prod.costCny || ""}
                          onChange={(e) =>
                            updateProduct(prod.id, "costCny", parseFloat(e.target.value) || 0)
                          }
                          placeholder="0.00"
                          className="w-full h-9 px-3 bg-[#0A0A0A] border border-[#333] rounded-lg text-sm text-white placeholder:text-white/20 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-white/50 mb-1">Quantity</label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={prod.qty || ""}
                          onChange={(e) =>
                            updateProduct(prod.id, "qty", parseInt(e.target.value) || 1)
                          }
                          placeholder="1"
                          className="w-full h-9 px-3 bg-[#0A0A0A] border border-[#333] rounded-lg text-sm text-white placeholder:text-white/20 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Exchange Rate & Category ── */}
            <section className="bg-[#111] border border-[#222] rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={16} className="text-green-400" />
                <h2 className="text-sm font-semibold">Pricing Parameters</h2>
              </div>

              {/* Exchange Rate */}
              <div>
                <label className="block text-[11px] text-white/50 mb-1">
                  Exchange Rate (USD/CNY)
                </label>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={exchangeRate || ""}
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                  className="w-full h-9 px-3 bg-[#1a1a1a] border border-[#333] rounded-lg text-sm text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-[11px] text-white/50 mb-1">Margin Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full h-9 px-3 bg-[#1a1a1a] border border-[#333] rounded-lg text-sm text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
                >
                  <option value="auto">Auto-Detect (Smart Margin)</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({(cat.marginPct * 100).toFixed(0)}%)
                    </option>
                  ))}
                </select>
              </div>

              {/* Override Margin */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-white/50">Override Margin</label>
                  <button
                    onClick={() => setOverrideActive(!overrideActive)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      overrideActive ? "bg-blue-600" : "bg-[#333]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        overrideActive ? "left-5.5 translate-x-0" : "left-0.5"
                      }`}
                      style={{
                        left: overrideActive ? "22px" : "2px",
                      }}
                    />
                  </button>
                </div>

                {overrideActive && (
                  <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 space-y-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setOverrideMode("percentage")}
                        className={`flex-1 h-8 rounded-md text-xs font-medium transition-all ${
                          overrideMode === "percentage"
                            ? "bg-blue-600 text-white"
                            : "bg-[#0A0A0A] text-white/50 hover:text-white border border-[#333]"
                        }`}
                      >
                        <Percent size={12} className="inline mr-1" />
                        Percentage
                      </button>
                      <button
                        onClick={() => setOverrideMode("amount")}
                        className={`flex-1 h-8 rounded-md text-xs font-medium transition-all ${
                          overrideMode === "amount"
                            ? "bg-blue-600 text-white"
                            : "bg-[#0A0A0A] text-white/50 hover:text-white border border-[#333]"
                        }`}
                      >
                        <DollarSign size={12} className="inline mr-1" />
                        Amount (USD)
                      </button>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step={overrideMode === "percentage" ? "0.1" : "0.01"}
                      value={overrideValue || ""}
                      onChange={(e) => setOverrideValue(parseFloat(e.target.value) || 0)}
                      placeholder={overrideMode === "percentage" ? "e.g. 12" : "e.g. 150.00"}
                      className="w-full h-9 px-3 bg-[#0A0A0A] border border-[#333] rounded-lg text-sm text-white placeholder:text-white/20 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                )}
              </div>
            </section>

            {/* ── FX Risk & Country & Customer ── */}
            <section className="bg-[#111] border border-[#222] rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Globe size={16} className="text-purple-400" />
                <h2 className="text-sm font-semibold">Market & Customer</h2>
              </div>

              {/* FX Risk Manager */}
              <div>
                <label className="block text-[11px] text-white/50 mb-1">FX Risk Manager</label>
                <select
                  value={fxRisk}
                  onChange={(e) => setFxRisk(e.target.value as FxRisk)}
                  className="w-full h-9 px-3 bg-[#1a1a1a] border border-[#333] rounded-lg text-sm text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
                >
                  <option value="stable">Stable</option>
                  <option value="usd_down">USD to Fall</option>
                  <option value="usd_up">USD to Rise</option>
                </select>
              </div>

              {/* Target Country */}
              <div>
                <label className="block text-[11px] text-white/50 mb-1">Target Country</label>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-full h-9 px-3 bg-[#1a1a1a] border border-[#333] rounded-lg text-sm text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.currency})
                    </option>
                  ))}
                </select>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="text-[10px] text-white/30">Country adjustment:</span>
                  <span
                    className={`text-[10px] font-medium ${
                      selectedCountry.adjustmentPct > 0
                        ? "text-green-400"
                        : selectedCountry.adjustmentPct < 0
                        ? "text-red-400"
                        : "text-white/40"
                    }`}
                  >
                    {selectedCountry.adjustmentPct >= 0 ? "+" : ""}
                    {(selectedCountry.adjustmentPct * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Target Customer Type */}
              <div>
                <label className="block text-[11px] text-white/50 mb-1">Target Customer Type</label>
                <select
                  value={customerType}
                  onChange={(e) => setCustomerType(e.target.value)}
                  className="w-full h-9 px-3 bg-[#1a1a1a] border border-[#333] rounded-lg text-sm text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
                >
                  {CUSTOMER_RULES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Manual Discount */}
              <div>
                <label className="block text-[11px] text-white/50 mb-1">
                  Manual Discount (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step="0.1"
                  value={discountPct || ""}
                  onChange={(e) => {
                    let v = parseFloat(e.target.value) || 0;
                    if (v > 10) v = 10;
                    if (v < 0) v = 0;
                    setDiscountPct(v);
                  }}
                  placeholder="0 - 10"
                  className="w-full h-9 px-3 bg-[#1a1a1a] border border-[#333] rounded-lg text-sm text-white placeholder:text-white/20 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
              </div>

              {/* Tax Refund Toggle */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  <label className="text-xs text-white/70">
                    Include Profit + Tax Refund ({(PRICE_CALC_TAX_REFUND_DEFAULT * 100).toFixed(0)}
                    %)
                  </label>
                </div>
                <button
                  onClick={() => setIncludeTaxRefund(!includeTaxRefund)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    includeTaxRefund ? "bg-emerald-600" : "bg-[#333]"
                  }`}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                    style={{
                      left: includeTaxRefund ? "22px" : "2px",
                    }}
                  />
                </button>
              </div>
            </section>

            {/* ── Generate Button ── */}
            <button
              onClick={generate}
              className="w-full h-12 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
            >
              <Zap size={18} />
              Generate Price
            </button>
          </div>

          {/* ════════════════════════════════════════
             RIGHT COLUMN: RESULTS
             ════════════════════════════════════════ */}
          <div className="lg:col-span-7 space-y-5">
            {!result ? (
              <div className="bg-[#111] border border-[#222] rounded-xl flex flex-col items-center justify-center py-24 px-6 text-center">
                <div className="w-14 h-14 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center mb-4">
                  <Calculator size={24} className="text-white/20" />
                </div>
                <p className="text-white/30 text-sm">
                  Configure your pricing parameters and click{" "}
                  <span className="text-blue-400 font-medium">Generate Price</span> to see results.
                </p>
              </div>
            ) : (
              <>
                {/* ── Summary Cards ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <SummaryCard label="Total Cost (CNY)" value={`\u00A5${fmt(result.totalCostCny)}`} />
                  <SummaryCard label="Total Cost (USD)" value={`$${fmt(result.totalCostUsd)}`} />
                  <SummaryCard label="Exchange Rate" value={`${fmt(result.exchangeRate)}`} />
                  <SummaryCard
                    label="Items / Qty"
                    value={`${result.totalItems} items / ${result.totalQty} units`}
                  />
                  <SummaryCard label="Category" value={result.categoryName} small />
                  <SummaryCard
                    label={`Country (${result.countryAdjPct >= 0 ? "+" : ""}${(result.countryAdjPct * 100).toFixed(0)}%)`}
                    value={result.countryName}
                  />
                  <SummaryCard
                    label="Customer Type"
                    value={CUSTOMER_RULES.find((r) => r.id === result.customerType)?.name || ""}
                  />
                  {result.discountPct > 0 && (
                    <SummaryCard label="Discount" value={`${result.discountPct}%`} />
                  )}
                  {result.fxRisk !== "stable" && (
                    <SummaryCard
                      label="FX Risk"
                      value={result.fxRisk === "usd_down" ? "USD to Fall" : "USD to Rise"}
                    />
                  )}
                </div>

                {/* ── Breakdown Info ── */}
                <section className="bg-[#111] border border-[#222] rounded-xl p-5 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp size={16} className="text-yellow-400" />
                    Pricing Breakdown
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-xs">
                    <BreakdownRow
                      label="Effective Margin"
                      value={pct(result.items[0].marginPct)}
                    />
                    <BreakdownRow
                      label="Margin (USD/unit)"
                      value={`$${fmt(result.items[0].marginUsd)}`}
                    />
                    {result.overrideActive && (
                      <BreakdownRow
                        label="Override"
                        value={
                          result.overrideMode === "percentage"
                            ? `${result.overrideValue}%`
                            : `$${fmt(result.overrideValue)}`
                        }
                      />
                    )}
                    <BreakdownRow
                      label="Country Adjustment"
                      value={`${result.countryAdjPct >= 0 ? "+" : ""}${(result.countryAdjPct * 100).toFixed(1)}%`}
                    />
                    <BreakdownRow
                      label="Initial Base (USD)"
                      value={`$${fmt(result.items[0].initialBase)}`}
                    />
                    <BreakdownRow
                      label="After Country Adj."
                      value={`$${fmt(result.items[0].countryAdjusted)}`}
                    />
                    {result.discountPct > 0 && (
                      <BreakdownRow
                        label="After Discount"
                        value={`$${fmt(result.items[0].finalBase)}`}
                      />
                    )}
                    <BreakdownRow
                      label="Final Base Price (USD)"
                      value={`$${fmt(result.items[0].finalBase)}`}
                      highlight
                    />
                  </div>
                </section>

                {/* ── Pricing Table (aggregated) ── */}
                <section className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
                  <div className="p-5 pb-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Users size={16} className="text-cyan-400" />
                      Channel Pricing
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-t border-b border-[#222] text-[11px] text-white/40 uppercase tracking-wider">
                          <th className="text-left px-5 py-3 font-medium">Channel</th>
                          <th className="text-right px-5 py-3 font-medium">Unit Price (USD)</th>
                          <th className="text-right px-5 py-3 font-medium">Total (USD)</th>
                          <th className="text-right px-5 py-3 font-medium">Profit/Unit</th>
                          {result.includeTaxRefund && (
                            <th className="text-right px-5 py-3 font-medium">Profit+Tax/Unit</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {ROW_ORDER.map((row) => {
                          // Aggregate across all items
                          let totalUnitPrice = 0;
                          let totalTotal = 0;
                          let totalProfit = 0;
                          let totalProfitTax = 0;

                          for (const item of result.items) {
                            const up = item.channelPrices[row.id];
                            totalUnitPrice += up;
                            totalTotal += up * item.qty;
                            totalProfit += item.channelProfits[row.id];
                            totalProfitTax += item.channelProfitsWithTax[row.id];
                          }

                          // If single item, show per-unit values directly
                          const unitPrice =
                            result.items.length === 1
                              ? result.items[0].channelPrices[row.id]
                              : totalUnitPrice;
                          const profit =
                            result.items.length === 1
                              ? result.items[0].channelProfits[row.id]
                              : totalProfit;
                          const profitTax =
                            result.items.length === 1
                              ? result.items[0].channelProfitsWithTax[row.id]
                              : totalProfitTax;

                          const isTarget = row.id === result.customerType;

                          return (
                            <tr
                              key={row.id}
                              className={`border-b border-[#1a1a1a] transition-colors ${
                                isTarget
                                  ? "bg-blue-600/10 border-l-2 border-l-blue-500"
                                  : "hover:bg-[#1a1a1a]"
                              }`}
                            >
                              <td className="px-5 py-3 font-medium flex items-center gap-2">
                                {row.name}
                                {isTarget && (
                                  <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">
                                    Target
                                  </span>
                                )}
                              </td>
                              <td className="text-right px-5 py-3 font-mono text-white/80">
                                ${fmt(unitPrice)}
                              </td>
                              <td className="text-right px-5 py-3 font-mono text-white/80">
                                ${fmt(totalTotal)}
                              </td>
                              <td
                                className={`text-right px-5 py-3 font-mono ${
                                  profit >= 0 ? "text-green-400" : "text-red-400"
                                }`}
                              >
                                {profit >= 0 ? "+" : ""}${fmt(profit)}
                              </td>
                              {result.includeTaxRefund && (
                                <td
                                  className={`text-right px-5 py-3 font-mono ${
                                    profitTax >= 0 ? "text-emerald-400" : "text-red-400"
                                  }`}
                                >
                                  {profitTax >= 0 ? "+" : ""}${fmt(profitTax)}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* ── Per-Item Detail (if multiple items) ── */}
                {result.items.length > 1 && (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2 px-1">
                      <Package size={16} className="text-orange-400" />
                      Per-Item Breakdown
                    </h3>
                    {result.items.map((item, idx) => {
                      const isExpanded = expandedItems.has(idx);
                      return (
                        <div
                          key={idx}
                          className="bg-[#111] border border-[#222] rounded-xl overflow-hidden"
                        >
                          <button
                            onClick={() => toggleItemExpand(idx)}
                            className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[#1a1a1a] transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium">{item.name}</span>
                              <span className="text-[10px] text-white/30">
                                Qty: {item.qty} | Cost: \u00A5{fmt(item.costCny)} | $
                                {fmt(item.costUsd)}
                              </span>
                            </div>
                            {isExpanded ? (
                              <ChevronUp size={16} className="text-white/40" />
                            ) : (
                              <ChevronDown size={16} className="text-white/40" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="border-t border-[#222]">
                              <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-2 text-xs">
                                <BreakdownRow label="Category" value={item.categoryName} />
                                <BreakdownRow label="Margin %" value={pct(item.marginPct)} />
                                <BreakdownRow
                                  label="Margin USD"
                                  value={`$${fmt(item.marginUsd)}`}
                                />
                                <BreakdownRow
                                  label="Initial Base"
                                  value={`$${fmt(item.initialBase)}`}
                                />
                                <BreakdownRow
                                  label="After Country"
                                  value={`$${fmt(item.countryAdjusted)}`}
                                />
                                <BreakdownRow
                                  label="Final Base"
                                  value={`$${fmt(item.finalBase)}`}
                                  highlight
                                />
                                {result.includeTaxRefund && (
                                  <BreakdownRow
                                    label="Tax Refund/Unit"
                                    value={`$${fmt(item.taxRefundPerUnit)}`}
                                  />
                                )}
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-t border-b border-[#222] text-[10px] text-white/40 uppercase tracking-wider">
                                      <th className="text-left px-5 py-2 font-medium">Channel</th>
                                      <th className="text-right px-5 py-2 font-medium">
                                        Unit (USD)
                                      </th>
                                      <th className="text-right px-5 py-2 font-medium">
                                        Total (USD)
                                      </th>
                                      <th className="text-right px-5 py-2 font-medium">
                                        Profit/Unit
                                      </th>
                                      {result.includeTaxRefund && (
                                        <th className="text-right px-5 py-2 font-medium">
                                          +Tax/Unit
                                        </th>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ROW_ORDER.map((row) => {
                                      const up = item.channelPrices[row.id];
                                      const pr = item.channelProfits[row.id];
                                      const pt = item.channelProfitsWithTax[row.id];
                                      const isTarget = row.id === result.customerType;
                                      return (
                                        <tr
                                          key={row.id}
                                          className={`border-b border-[#1a1a1a] ${
                                            isTarget
                                              ? "bg-blue-600/10"
                                              : "hover:bg-[#1a1a1a]"
                                          }`}
                                        >
                                          <td className="px-5 py-2 font-medium">
                                            {row.name}
                                            {isTarget && (
                                              <span className="ml-2 text-[8px] bg-blue-600 text-white px-1 py-0.5 rounded font-semibold uppercase">
                                                Target
                                              </span>
                                            )}
                                          </td>
                                          <td className="text-right px-5 py-2 font-mono text-white/80">
                                            ${fmt(up)}
                                          </td>
                                          <td className="text-right px-5 py-2 font-mono text-white/80">
                                            ${fmt(up * item.qty)}
                                          </td>
                                          <td
                                            className={`text-right px-5 py-2 font-mono ${
                                              pr >= 0 ? "text-green-400" : "text-red-400"
                                            }`}
                                          >
                                            {pr >= 0 ? "+" : ""}${fmt(pr)}
                                          </td>
                                          {result.includeTaxRefund && (
                                            <td
                                              className={`text-right px-5 py-2 font-mono ${
                                                pt >= 0 ? "text-emerald-400" : "text-red-400"
                                              }`}
                                            >
                                              {pt >= 0 ? "+" : ""}${fmt(pt)}
                                            </td>
                                          )}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ════════════════════════════════════════════════════════════════════ */

function SummaryCard({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="bg-[#111] border border-[#222] rounded-xl px-4 py-3">
      <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{label}</div>
      <div
        className={`font-semibold truncate ${
          small ? "text-xs text-white/80" : "text-sm text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-white/40">{label}</span>
      <span className={highlight ? "text-blue-400 font-semibold" : "text-white/80"}>{value}</span>
    </div>
  );
}
