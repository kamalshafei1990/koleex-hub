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
  TrendingUp,
  DollarSign,
  Globe,
  Users,
  Package,
  Percent,
  ShieldCheck,
  Zap,
  Tag,
  Copy,
  FileText,
  Printer,
  Share2,
  Info,
  Activity,
  Layers,
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
  const [showFxManager, setShowFxManager] = useState(false);
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
    setShowFxManager(false);
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

  /* ── Input class helpers ── */
  const inputCls =
    "w-full h-9 px-3 bg-[#1a1a1a] border border-[#333] rounded-lg text-sm text-white placeholder:text-white/20 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all";
  const selectCls =
    "w-full h-9 px-3 bg-[#1a1a1a] border border-[#333] rounded-lg text-sm text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer";
  const labelCls = "block text-[11px] text-white/50 mb-1.5 uppercase tracking-wider font-medium";

  /* ════════════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════════════ */

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0A0A0A]/80 border-b border-[#222]">
        <div className="max-w-[700px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
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

      {/* ── Single Column Content ── */}
      <main className="max-w-[700px] mx-auto px-4 sm:px-6 py-6 md:py-10 space-y-6">
        {/* Page subtitle */}
        <p className="text-sm text-white/40">
          Generate channel pricing with shipping-adjusted ERP logic.
        </p>

        {/* ════════════════════════════════════════════════════════════
           FORM CARD — all inputs in one card
           ════════════════════════════════════════════════════════════ */}
        <div className="bg-[#111] border border-[#222] rounded-xl p-5 sm:p-6 space-y-7">

          {/* ── Block 1: Products (Cost + Quantity) ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-blue-400" />
                <h2 className="text-sm font-semibold">Products (Cost + Quantity)</h2>
              </div>
              <button
                onClick={addProduct}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 transition-colors"
              >
                <Plus size={14} />
                Add Item
              </button>
            </div>
            <p className="text-[11px] text-white/30">
              Enter product name, unit cost, and quantity manually.
            </p>

            <div className="space-y-2">
              {products.map((prod, i) => (
                <div
                  key={prod.id}
                  className="flex items-center gap-2"
                >
                  {/* Item number */}
                  <span className="text-[10px] text-white/30 w-5 shrink-0 text-center font-mono">
                    {i + 1}
                  </span>

                  {/* Product Name */}
                  <input
                    type="text"
                    value={prod.name}
                    onChange={(e) => updateProduct(prod.id, "name", e.target.value)}
                    placeholder="Product Name"
                    className="flex-1 min-w-0 h-9 px-3 bg-[#1a1a1a] border border-[#333] rounded-lg text-sm text-white placeholder:text-white/20 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  />

                  {/* Unit Cost */}
                  <div className="relative w-28 shrink-0">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={prod.costCny || ""}
                      onChange={(e) =>
                        updateProduct(prod.id, "costCny", parseFloat(e.target.value) || 0)
                      }
                      placeholder="Cost CNY"
                      className="w-full h-9 px-3 pr-10 bg-[#1a1a1a] border border-[#333] rounded-lg text-sm text-white placeholder:text-white/20 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30">
                      CNY
                    </span>
                  </div>

                  {/* Quantity */}
                  <div className="relative w-20 shrink-0">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={prod.qty || ""}
                      onChange={(e) =>
                        updateProduct(prod.id, "qty", parseInt(e.target.value) || 1)
                      }
                      placeholder="Qty"
                      className="w-full h-9 px-3 pr-8 bg-[#1a1a1a] border border-[#333] rounded-lg text-sm text-white placeholder:text-white/20 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30">
                      x
                    </span>
                  </div>

                  {/* Remove */}
                  {products.length > 1 ? (
                    <button
                      onClick={() => removeProduct(prod.id)}
                      className="text-red-400/50 hover:text-red-400 transition-colors shrink-0"
                      title="Remove item"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <span className="w-[14px] shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#222]" />

          {/* ── Block 2: Override Default Profit Margin ── */}
          <div className="space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={overrideActive}
                onChange={() => setOverrideActive(!overrideActive)}
                className="w-4 h-4 rounded border-[#444] bg-[#1a1a1a] text-blue-600 focus:ring-blue-500/30 focus:ring-offset-0 accent-blue-600 cursor-pointer"
              />
              <Percent size={14} className="text-yellow-400" />
              <span className="text-sm font-medium">Override Default Profit Margin</span>
            </label>

            {overrideActive && (
              <div className="grid grid-cols-2 gap-3 pl-6">
                <div>
                  <label className={labelCls}>Override Type</label>
                  <select
                    value={overrideMode}
                    onChange={(e) => setOverrideMode(e.target.value as OverrideMode)}
                    className={selectCls}
                  >
                    <option value="percentage">By Percentage</option>
                    <option value="amount">By Amount USD</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Override Value</label>
                  <input
                    type="number"
                    min={0}
                    step={overrideMode === "percentage" ? "0.1" : "0.01"}
                    value={overrideValue || ""}
                    onChange={(e) => setOverrideValue(parseFloat(e.target.value) || 0)}
                    placeholder={overrideMode === "percentage" ? "e.g. 12" : "e.g. 150.00"}
                    className={inputCls}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-[#222]" />

          {/* ── Block 3: Manual Discount (%) ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag size={14} className="text-orange-400" />
                <label className="text-sm font-medium">Manual Discount (%)</label>
              </div>
              <span className="text-sm font-mono font-semibold text-blue-400 tabular-nums">
                {discountPct}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={discountPct}
              onChange={(e) => setDiscountPct(parseInt(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-blue-500"
              style={{
                background: `linear-gradient(to right, #3b82f6 ${discountPct * 10}%, #333 ${discountPct * 10}%)`,
              }}
            />
            <div className="flex justify-between text-[10px] text-white/20 px-0.5">
              <span>0%</span>
              <span>5%</span>
              <span>10%</span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#222]" />

          {/* ── Block 4: Exchange Rate ── */}
          <div className="space-y-2">
            <label className={labelCls}>
              <DollarSign size={12} className="inline text-green-400 mr-1" />
              USD/CNY Exchange Rate
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={exchangeRate || ""}
                onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                className={`${inputCls} flex-1`}
              />
              <button
                onClick={() => {
                  /* Live rate placeholder -- could fetch from API */
                  setExchangeRate(7.24);
                }}
                className="h-9 px-3 rounded-lg text-[11px] font-medium border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-all whitespace-nowrap"
              >
                Live Rate
              </button>
              <button
                onClick={() => setShowFxManager(!showFxManager)}
                className={`h-9 px-3 rounded-lg text-[11px] font-medium border whitespace-nowrap transition-all ${
                  showFxManager
                    ? "border-purple-500/50 text-purple-400 bg-purple-500/10"
                    : "border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                }`}
              >
                FX Risk Manager
              </button>
            </div>

            {showFxManager && (
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 space-y-2 mt-1">
                <select
                  value={fxRisk}
                  onChange={(e) => setFxRisk(e.target.value as FxRisk)}
                  className={selectCls}
                >
                  <option value="stable">Stable (No change)</option>
                  <option value="usd_down">Expect USD to Fall</option>
                  <option value="usd_up">Expect USD to Rise</option>
                </select>
                <p className="text-[10px] text-white/30">
                  FX mode adjusts margin sensitivity before country/discount adjustments.
                </p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-[#222]" />

          {/* ── Block 5: Product Category ── */}
          <div className="space-y-1.5">
            <label className={labelCls}>
              <Layers size={12} className="inline text-cyan-400 mr-1" />
              Product Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={selectCls}
            >
              <option value="auto">Auto-Detect (Smart Margin)</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({(cat.marginPct * 100).toFixed(0)}%)
                </option>
              ))}
            </select>
          </div>

          {/* Divider */}
          <div className="border-t border-[#222]" />

          {/* ── Block 6: Target Country ── */}
          <div className="space-y-1.5">
            <label className={labelCls}>
              <Globe size={12} className="inline text-purple-400 mr-1" />
              Target Country
            </label>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className={selectCls}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.currency})
                </option>
              ))}
            </select>
            {/* Blue info bar */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 flex items-center gap-2 mt-1.5">
              <Info size={14} className="text-blue-400 shrink-0" />
              <span className="text-[12px] text-blue-300">
                Country band adjustment:{" "}
                <span className="font-semibold">
                  {selectedCountry.adjustmentPct >= 0 ? "+" : ""}
                  {(selectedCountry.adjustmentPct * 100).toFixed(0)}%
                </span>
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#222]" />

          {/* ── Block 7: Target Customer Type ── */}
          <div className="space-y-1.5">
            <label className={labelCls}>
              <Users size={12} className="inline text-pink-400 mr-1" />
              Target Customer Type
            </label>
            <select
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value)}
              className={selectCls}
            >
              {CUSTOMER_RULES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Divider */}
          <div className="border-t border-[#222]" />

          {/* ── Block 8: Tax Refund Toggle ── */}
          <div className="space-y-1">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeTaxRefund}
                onChange={() => setIncludeTaxRefund(!includeTaxRefund)}
                className="w-4 h-4 rounded border-[#444] bg-[#1a1a1a] text-emerald-600 focus:ring-emerald-500/30 focus:ring-offset-0 accent-emerald-600 cursor-pointer"
              />
              <ShieldCheck size={14} className="text-emerald-400" />
              <span className="text-sm font-medium">
                Include Profit + Tax Refund column ({(PRICE_CALC_TAX_REFUND_DEFAULT * 100).toFixed(0)}% default)
              </span>
            </label>
            <p className="text-[10px] text-white/30 pl-6">
              Tax refund is calculated from cost USD using the default refund rate.
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-[#222]" />

          {/* ── Generate Price Button ── */}
          <button
            onClick={generate}
            className="w-full h-12 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
          >
            <Zap size={18} />
            Generate Price
          </button>
        </div>

        {/* ════════════════════════════════════════════════════════════
           RESULT CARD — appears below form after Generate
           ════════════════════════════════════════════════════════════ */}
        {result && (
          <div className="bg-[#111] border border-[#222] rounded-xl p-5 sm:p-6 space-y-6">
            {/* ── Result Header ── */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Activity size={18} className="text-blue-400" />
                <h2 className="text-lg font-semibold">Quotation Details</h2>
              </div>
              <p className="text-[12px] text-white/40 mb-3">
                Results are generated from your selected workflow inputs.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/25 text-[11px] font-medium text-purple-300">
                  <Globe size={12} />
                  {result.countryName}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pink-500/15 border border-pink-500/25 text-[11px] font-medium text-pink-300">
                  <Users size={12} />
                  {CUSTOMER_RULES.find((r) => r.id === result.customerType)?.name || result.customerType}
                </span>
              </div>
            </div>

            {/* ── Breakdown Box ── */}
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg overflow-hidden">
              <BreakdownKV label="Cost CNY" value={`\u00A5${fmt(result.totalCostCny)}`} />
              <BreakdownKV label="Cost USD" value={`$${fmt(result.totalCostUsd)}`} />
              <BreakdownKV
                label="Items / Qty"
                value={`${result.totalItems} items / ${result.totalQty} units`}
              />
              <BreakdownKV label="Margin %" value={pct(result.items[0].marginPct)} />
              <BreakdownKV
                label="Country Adjustment"
                value={`${result.countryAdjPct >= 0 ? "+" : ""}${(result.countryAdjPct * 100).toFixed(1)}%`}
              />
              {result.discountPct > 0 && (
                <BreakdownKV label="Discount" value={`${result.discountPct}%`} />
              )}
              {/* Final Base Price - highlighted */}
              <div className="flex items-center justify-between px-4 py-3 bg-blue-600/10 border-t border-[#222]">
                <span className="text-[13px] font-semibold text-blue-300">Final Base Price USD</span>
                <span className="text-[14px] font-bold font-mono text-blue-400">
                  ${fmt(result.items[0].finalBase)}
                </span>
              </div>
              {/* Total Profit - highlighted green */}
              {(() => {
                const targetProfit = result.items.reduce(
                  (sum, item) => sum + item.channelProfits[result.customerType] * item.qty,
                  0
                );
                return (
                  <div className="flex items-center justify-between px-4 py-3 bg-emerald-600/10 border-t border-[#222]">
                    <span className="text-[13px] font-semibold text-emerald-300">Total Profit</span>
                    <span
                      className={`text-[14px] font-bold font-mono ${
                        targetProfit >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {targetProfit >= 0 ? "+" : ""}${fmt(targetProfit)}
                    </span>
                  </div>
                );
              })()}
              <BreakdownKV
                label="Tax Refund"
                value={result.includeTaxRefund ? "Enabled" : "Disabled"}
                last
              />
            </div>

            {/* ── Per-Product Pricing Details (if multiple items) ── */}
            {result.items.length > 1 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Package size={16} className="text-orange-400" />
                  <h3 className="text-sm font-semibold">Per-Product Pricing Details</h3>
                </div>

                {result.items.map((item, idx) => {
                  const isExpanded = expandedItems.has(idx);
                  return (
                    <div
                      key={idx}
                      className="bg-[#0A0A0A] border border-[#222] rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => toggleItemExpand(idx)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#161616] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-sm font-medium truncate">{item.name}</span>
                          <span className="text-[10px] text-white/30 shrink-0">
                            Qty: {item.qty} | \u00A5{fmt(item.costCny)} | ${fmt(item.costUsd)}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp size={16} className="text-white/40 shrink-0" />
                        ) : (
                          <ChevronDown size={16} className="text-white/40 shrink-0" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="border-t border-[#222]">
                          {/* Mini breakdown */}
                          <div className="px-4 py-3 space-y-0">
                            <BreakdownKV label="Category" value={item.categoryName} />
                            <BreakdownKV label="Margin %" value={pct(item.marginPct)} />
                            <BreakdownKV label="Margin USD" value={`$${fmt(item.marginUsd)}`} />
                            <BreakdownKV label="Initial Base" value={`$${fmt(item.initialBase)}`} />
                            <BreakdownKV label="After Country" value={`$${fmt(item.countryAdjusted)}`} />
                            <BreakdownKV label="Final Base" value={`$${fmt(item.finalBase)}`} />
                            {result.includeTaxRefund && (
                              <BreakdownKV label="Tax Refund/Unit" value={`$${fmt(item.taxRefundPerUnit)}`} last />
                            )}
                          </div>

                          {/* Mini channel table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-t border-b border-[#222] text-[10px] text-white/40 uppercase tracking-wider">
                                  <th className="text-left px-4 py-2 font-medium">Channel</th>
                                  <th className="text-right px-4 py-2 font-medium">Unit (USD)</th>
                                  <th className="text-right px-4 py-2 font-medium">Total (USD)</th>
                                  <th className="text-right px-4 py-2 font-medium">Profit/Unit</th>
                                  {result.includeTaxRefund && (
                                    <th className="text-right px-4 py-2 font-medium">+Tax/Unit</th>
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
                                        isTarget ? "bg-blue-600/10" : "hover:bg-[#111]"
                                      }`}
                                    >
                                      <td className="px-4 py-2 font-medium">
                                        {row.name}
                                        {isTarget && (
                                          <span className="ml-2 text-[8px] bg-blue-600 text-white px-1 py-0.5 rounded font-semibold uppercase">
                                            Target
                                          </span>
                                        )}
                                      </td>
                                      <td className="text-right px-4 py-2 font-mono text-white/80">
                                        ${fmt(up)}
                                      </td>
                                      <td className="text-right px-4 py-2 font-mono text-white/80">
                                        ${fmt(up * item.qty)}
                                      </td>
                                      <td
                                        className={`text-right px-4 py-2 font-mono ${
                                          pr >= 0 ? "text-green-400" : "text-red-400"
                                        }`}
                                      >
                                        {pr >= 0 ? "+" : ""}${fmt(pr)}
                                      </td>
                                      {result.includeTaxRefund && (
                                        <td
                                          className={`text-right px-4 py-2 font-mono ${
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
              </div>
            )}

            {/* ── Grand Total Pricing Table ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-cyan-400" />
                <h3 className="text-sm font-semibold">Grand Total Pricing Table</h3>
              </div>

              <div className="bg-[#0A0A0A] border border-[#222] rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#222] text-[11px] text-white/40 uppercase tracking-wider">
                        <th className="text-left px-4 py-3 font-medium">Channel Type</th>
                        <th className="text-right px-4 py-3 font-medium">Unit Price</th>
                        <th className="text-right px-4 py-3 font-medium">Total Price</th>
                        <th className="text-right px-4 py-3 font-medium">Profit</th>
                        {result.includeTaxRefund && (
                          <th className="text-right px-4 py-3 font-medium">Profit + Tax Refund</th>
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
                                : "hover:bg-[#111]"
                            }`}
                          >
                            <td className="px-4 py-3 font-medium flex items-center gap-2">
                              {row.name}
                              {isTarget && (
                                <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">
                                  Target
                                </span>
                              )}
                            </td>
                            <td className="text-right px-4 py-3 font-mono text-white/80">
                              ${fmt(unitPrice)}
                            </td>
                            <td className="text-right px-4 py-3 font-mono text-white/80">
                              ${fmt(totalTotal)}
                            </td>
                            <td
                              className={`text-right px-4 py-3 font-mono ${
                                profit >= 0 ? "text-green-400" : "text-red-400"
                              }`}
                            >
                              {profit >= 0 ? "+" : ""}${fmt(profit)}
                            </td>
                            {result.includeTaxRefund && (
                              <td
                                className={`text-right px-4 py-3 font-mono ${
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
                    {/* Table footer totals */}
                    <tfoot>
                      {(() => {
                        const targetRow = result.customerType;
                        let footerTotal = 0;
                        let footerProfit = 0;
                        let footerProfitTax = 0;

                        for (const item of result.items) {
                          footerTotal += item.channelPrices[targetRow] * item.qty;
                          footerProfit += item.channelProfits[targetRow] * item.qty;
                          footerProfitTax += item.channelProfitsWithTax[targetRow] * item.qty;
                        }

                        return (
                          <tr className="border-t border-[#333] bg-[#111]">
                            <td className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-white/60">
                              Grand Total
                            </td>
                            <td className="text-right px-4 py-3 font-mono font-semibold text-white/60">
                              --
                            </td>
                            <td className="text-right px-4 py-3 font-mono font-bold text-white">
                              ${fmt(footerTotal)}
                            </td>
                            <td
                              className={`text-right px-4 py-3 font-mono font-bold ${
                                footerProfit >= 0 ? "text-green-400" : "text-red-400"
                              }`}
                            >
                              {footerProfit >= 0 ? "+" : ""}${fmt(footerProfit)}
                            </td>
                            {result.includeTaxRefund && (
                              <td
                                className={`text-right px-4 py-3 font-mono font-bold ${
                                  footerProfitTax >= 0 ? "text-emerald-400" : "text-red-400"
                                }`}
                              >
                                {footerProfitTax >= 0 ? "+" : ""}${fmt(footerProfitTax)}
                              </td>
                            )}
                          </tr>
                        );
                      })()}
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* ── Result Actions ── */}
            <div className="flex items-center gap-2 flex-wrap pt-2">
              <button
                onClick={() => {
                  /* Copy to clipboard placeholder */
                  const text = `Quotation: ${result.countryName} | ${CUSTOMER_RULES.find((r) => r.id === result.customerType)?.name}\nBase Price: $${fmt(result.items[0].finalBase)}\nTotal Cost: $${fmt(result.totalCostUsd)}`;
                  navigator.clipboard?.writeText(text);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-[#333] text-white/60 hover:text-white hover:border-[#555] transition-all"
              >
                <Copy size={14} />
                Copy
              </button>
              <button
                onClick={() => {
                  /* Export PDF placeholder */
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-[#333] text-white/60 hover:text-white hover:border-[#555] transition-all"
              >
                <FileText size={14} />
                Export PDF
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-[#333] text-white/60 hover:text-white hover:border-[#555] transition-all"
              >
                <Printer size={14} />
                Print
              </button>
              <button
                onClick={() => {
                  /* Share placeholder */
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-[#333] text-white/60 hover:text-white hover:border-[#555] transition-all"
              >
                <Share2 size={14} />
                Share
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ════════════════════════════════════════════════════════════════════ */

function BreakdownKV({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-2.5 ${
        last ? "" : "border-b border-[#1a1a1a]"
      }`}
    >
      <span className="text-[12px] text-white/40">{label}</span>
      <span className="text-[13px] font-mono text-white/80">{value}</span>
    </div>
  );
}
