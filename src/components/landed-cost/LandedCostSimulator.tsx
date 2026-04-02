"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  DollarSign,
  ArrowLeft,
  Ship,
  Package,
  FileCheck,
  Building2,
  RotateCcw,
  Calculator,
  TrendingUp,
  Percent,
  MapPin,
  Globe,
  Anchor,
  Box,
  Truck,
  Shield,
  Landmark,
  CreditCard,
  BarChart3,
} from "lucide-react";

/* ─────────── Types ─────────── */

interface FormState {
  departurePort: string;
  targetCountry: string;
  destinationCity: string;
  arrivalPort: string;
  currencyCode: string;
  productName: string;
  hsCode: string;
  actualPriceUsd: number;
  quantity: number;
  incoterm: string;
  containerType: string;
  machineVolumeCbm: number;
  containerFreightUsd: number;
  originInlandCostUsd: number;
  importDutyPercent: number;
  vatPercent: number;
  companyType: string;
  importMethod: string;
  lowValueInvoice: boolean;
  declaredValueUsd: number;
  bankFxRate: number;
  bankCommissionPercent: number;
  portClearance: number;
  inlandTrucking: number;
  insurance: number;
  otherLocalCharges: number;
}

interface Results {
  totalProductCost: number;
  totalShippingCost: number;
  customsBase: number;
  customsAmount: number;
  vatAmount: number;
  bankCommission: number;
  totalLocalCharges: number;
  totalLandedCost: number;
  costPerUnit: number;
  multiplier: number;
  totalLandedCostLocal: number;
  costPerUnitLocal: number;
  currency: string;
}

/* ─────────── Defaults ─────────── */

const defaultForm: FormState = {
  departurePort: "",
  targetCountry: "",
  destinationCity: "",
  arrivalPort: "",
  currencyCode: "",
  productName: "",
  hsCode: "",
  actualPriceUsd: 0,
  quantity: 1,
  incoterm: "FOB",
  containerType: "40ft",
  machineVolumeCbm: 0,
  containerFreightUsd: 0,
  originInlandCostUsd: 0,
  importDutyPercent: 0,
  vatPercent: 0,
  companyType: "Trading",
  importMethod: "Direct",
  lowValueInvoice: false,
  declaredValueUsd: 0,
  bankFxRate: 1,
  bankCommissionPercent: 0,
  portClearance: 0,
  inlandTrucking: 0,
  insurance: 0,
  otherLocalCharges: 0,
};

const STORAGE_KEY = "koleex.module.landed.location.v1";

/* ─────────── Helpers ─────────── */

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function pct(part: number, total: number): string {
  if (total === 0) return "0.0";
  return ((part / total) * 100).toFixed(1);
}

/* ─────────── Sub-components ─────────── */

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-5 md:p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/[0.06] text-white/60">
          {icon}
        </div>
        <h2 className="text-[15px] font-semibold text-white tracking-tight">
          {title}
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function FieldText({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-white/50">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || ""}
        className="h-10 px-3 rounded-lg bg-[#1a1a1a] border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
      />
    </label>
  );
}

function FieldNumber({
  label,
  value,
  onChange,
  min,
  step,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-white/50">{label}</span>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          step={step || 1}
          className="w-full h-10 px-3 rounded-lg bg-[#1a1a1a] border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-white/50">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 px-3 rounded-lg bg-[#1a1a1a] border border-[#222] text-sm text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt} value={opt} className="bg-[#1a1a1a] text-white">
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function FieldCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 h-10 cursor-pointer group">
      <div
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
          checked
            ? "bg-blue-500 border-blue-500"
            : "border-[#333] group-hover:border-[#555]"
        }`}
        onClick={() => onChange(!checked)}
      >
        {checked && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="text-white"
          >
            <path
              d="M2.5 6L5 8.5L9.5 3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <span className="text-sm text-white/70 group-hover:text-white transition-colors">
        {label}
      </span>
    </label>
  );
}

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        accent
          ? "bg-blue-500/10 border-blue-500/30"
          : "bg-[#111] border-[#222]"
      }`}
    >
      <div className="text-xs font-medium text-white/50 mb-2">{label}</div>
      <div
        className={`text-2xl md:text-3xl font-bold tracking-tight ${
          accent ? "text-blue-400" : "text-white"
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="text-sm text-white/40 mt-1">{sub}</div>
      )}
    </div>
  );
}

function BreakdownRow({
  label,
  usd,
  percentage,
  color,
  maxPct,
}: {
  label: string;
  usd: number;
  percentage: string;
  color: string;
  maxPct: number;
}) {
  const barWidth = maxPct > 0 ? (parseFloat(percentage) / maxPct) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/70">{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white">${fmt(usd)}</span>
          <span className="text-xs text-white/40 w-14 text-right">
            {percentage}%
          </span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${Math.max(barWidth, 0.5)}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

/* ─────────── Main Component ─────────── */

export default function LandedCostSimulator() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string>("");

  /* Load from localStorage on mount */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setForm((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  /* Persist to localStorage on form change */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch {
      /* ignore */
    }
  }, [form]);

  const update = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const calculate = useCallback(() => {
    setError("");
    if (form.actualPriceUsd <= 0) {
      setError("Actual Price USD must be greater than 0.");
      return;
    }
    if (form.quantity <= 0) {
      setError("Quantity must be greater than 0.");
      return;
    }

    const totalProductCost = form.actualPriceUsd * form.quantity;
    const totalShippingCost =
      form.containerFreightUsd + form.originInlandCostUsd;
    const customsBase = totalProductCost + totalShippingCost;
    const customsAmount = customsBase * (form.importDutyPercent / 100);
    const vatAmount =
      (customsBase + customsAmount) * (form.vatPercent / 100);
    const bankCommission =
      (totalProductCost + totalShippingCost) *
      (form.bankCommissionPercent / 100);
    const totalLocalCharges =
      form.portClearance +
      form.inlandTrucking +
      bankCommission +
      form.insurance +
      form.otherLocalCharges;
    const totalLandedCost =
      totalProductCost +
      totalShippingCost +
      customsAmount +
      vatAmount +
      totalLocalCharges;
    const costPerUnit =
      form.quantity > 0 ? totalLandedCost / form.quantity : 0;
    const multiplier =
      totalProductCost > 0 ? totalLandedCost / totalProductCost : 0;
    const totalLandedCostLocal = totalLandedCost * form.bankFxRate;
    const costPerUnitLocal = costPerUnit * form.bankFxRate;

    setResults({
      totalProductCost,
      totalShippingCost,
      customsBase,
      customsAmount,
      vatAmount,
      bankCommission,
      totalLocalCharges,
      totalLandedCost,
      costPerUnit,
      multiplier,
      totalLandedCostLocal,
      costPerUnitLocal,
      currency: form.currencyCode || "LCL",
    });
  }, [form]);

  const reset = useCallback(() => {
    setForm(defaultForm);
    setResults(null);
    setError("");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  /* Breakdown data for results */
  const breakdownItems = results
    ? [
        {
          label: "Product Cost",
          usd: results.totalProductCost,
          pct: pct(results.totalProductCost, results.totalLandedCost),
          color: "#3b82f6",
        },
        {
          label: "Shipping Cost",
          usd: results.totalShippingCost,
          pct: pct(results.totalShippingCost, results.totalLandedCost),
          color: "#8b5cf6",
        },
        {
          label: "Customs Duty",
          usd: results.customsAmount,
          pct: pct(results.customsAmount, results.totalLandedCost),
          color: "#f59e0b",
        },
        {
          label: "VAT",
          usd: results.vatAmount,
          pct: pct(results.vatAmount, results.totalLandedCost),
          color: "#ef4444",
        },
        {
          label: "Local Charges",
          usd: results.totalLocalCharges,
          pct: pct(results.totalLocalCharges, results.totalLandedCost),
          color: "#10b981",
        },
      ]
    : [];

  const maxPct =
    breakdownItems.length > 0
      ? Math.max(...breakdownItems.map((b) => parseFloat(b.pct)))
      : 0;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0A0A0A]/80 border-b border-[#222]">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-white/50 hover:text-white transition-colors"
            >
              <ArrowLeft size={18} />
              <span className="text-sm font-medium hidden sm:inline">
                Back to Hub
              </span>
            </Link>
            <div className="w-px h-5 bg-[#222]" />
            <div className="flex items-center gap-2">
              <DollarSign size={20} className="text-blue-400" />
              <h1 className="text-[15px] font-semibold tracking-tight">
                Landed Cost Simulator
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        {/* Section 1: Route & Market */}
        <SectionCard title="Route & Market" icon={<Ship size={18} />}>
          <FieldText
            label="Departure Port"
            value={form.departurePort}
            onChange={(v) => update("departurePort", v)}
            placeholder="e.g. Shanghai, Ningbo"
          />
          <FieldText
            label="Target Country"
            value={form.targetCountry}
            onChange={(v) => update("targetCountry", v)}
            placeholder="e.g. Egypt, Saudi Arabia"
          />
          <FieldText
            label="Destination City"
            value={form.destinationCity}
            onChange={(v) => update("destinationCity", v)}
            placeholder="e.g. Cairo, Riyadh"
          />
          <FieldText
            label="Arrival Port"
            value={form.arrivalPort}
            onChange={(v) => update("arrivalPort", v)}
            placeholder="e.g. Alexandria, Jeddah"
          />
          <FieldText
            label="Currency Code"
            value={form.currencyCode}
            onChange={(v) => update("currencyCode", v)}
            placeholder="e.g. EGP, SAR, AED"
          />
        </SectionCard>

        {/* Section 2: Product & Shipment */}
        <SectionCard title="Product & Shipment" icon={<Package size={18} />}>
          <FieldText
            label="Product Name"
            value={form.productName}
            onChange={(v) => update("productName", v)}
            placeholder="e.g. CNC Lathe Machine"
          />
          <FieldText
            label="HS Code"
            value={form.hsCode}
            onChange={(v) => update("hsCode", v)}
            placeholder="e.g. 8458.11.00"
          />
          <FieldNumber
            label="Actual Price USD"
            value={form.actualPriceUsd}
            onChange={(v) => update("actualPriceUsd", v)}
            min={0}
            step={0.01}
            suffix="USD"
          />
          <FieldNumber
            label="Quantity"
            value={form.quantity}
            onChange={(v) => update("quantity", v)}
            min={1}
            step={1}
            suffix="units"
          />
          <FieldSelect
            label="Incoterm"
            value={form.incoterm}
            onChange={(v) => update("incoterm", v)}
            options={["EXW", "FOB", "CIF", "CFR", "DDP", "DAP"]}
          />
          <FieldSelect
            label="Container Type"
            value={form.containerType}
            onChange={(v) => update("containerType", v)}
            options={["20ft", "40ft", "40ft HC", "LCL"]}
          />
          <FieldNumber
            label="Machine Volume CBM"
            value={form.machineVolumeCbm}
            onChange={(v) => update("machineVolumeCbm", v)}
            min={0}
            step={0.01}
            suffix="CBM"
          />
          <FieldNumber
            label="Container Freight USD"
            value={form.containerFreightUsd}
            onChange={(v) => update("containerFreightUsd", v)}
            min={0}
            step={0.01}
            suffix="USD"
          />
          <FieldNumber
            label="Origin Inland Cost USD"
            value={form.originInlandCostUsd}
            onChange={(v) => update("originInlandCostUsd", v)}
            min={0}
            step={0.01}
            suffix="USD"
          />
        </SectionCard>

        {/* Section 3: Customs & Import */}
        <SectionCard title="Customs & Import" icon={<FileCheck size={18} />}>
          <FieldNumber
            label="Import Duty %"
            value={form.importDutyPercent}
            onChange={(v) => update("importDutyPercent", v)}
            min={0}
            step={0.1}
            suffix="%"
          />
          <FieldNumber
            label="VAT %"
            value={form.vatPercent}
            onChange={(v) => update("vatPercent", v)}
            min={0}
            step={0.1}
            suffix="%"
          />
          <FieldSelect
            label="Company Type"
            value={form.companyType}
            onChange={(v) => update("companyType", v)}
            options={["Trading", "Manufacturing", "Free Zone"]}
          />
          <FieldSelect
            label="Import Method"
            value={form.importMethod}
            onChange={(v) => update("importMethod", v)}
            options={["Direct", "Agent", "Freight Forwarder"]}
          />
          <FieldCheckbox
            label="Low Value Invoice"
            checked={form.lowValueInvoice}
            onChange={(v) => update("lowValueInvoice", v)}
          />
          <FieldNumber
            label="Declared Value USD"
            value={form.declaredValueUsd}
            onChange={(v) => update("declaredValueUsd", v)}
            min={0}
            step={0.01}
            suffix="USD"
          />
        </SectionCard>

        {/* Section 4: Local Costs & Banking */}
        <SectionCard
          title="Local Costs & Banking"
          icon={<Building2 size={18} />}
        >
          <FieldNumber
            label="Bank FX Rate"
            value={form.bankFxRate}
            onChange={(v) => update("bankFxRate", v)}
            min={0}
            step={0.0001}
          />
          <FieldNumber
            label="Bank Commission %"
            value={form.bankCommissionPercent}
            onChange={(v) => update("bankCommissionPercent", v)}
            min={0}
            step={0.01}
            suffix="%"
          />
          <FieldNumber
            label="Port Clearance USD"
            value={form.portClearance}
            onChange={(v) => update("portClearance", v)}
            min={0}
            step={0.01}
            suffix="USD"
          />
          <FieldNumber
            label="Inland Trucking USD"
            value={form.inlandTrucking}
            onChange={(v) => update("inlandTrucking", v)}
            min={0}
            step={0.01}
            suffix="USD"
          />
          <FieldNumber
            label="Insurance USD"
            value={form.insurance}
            onChange={(v) => update("insurance", v)}
            min={0}
            step={0.01}
            suffix="USD"
          />
          <FieldNumber
            label="Other Local Charges USD"
            value={form.otherLocalCharges}
            onChange={(v) => update("otherLocalCharges", v)}
            min={0}
            step={0.01}
            suffix="USD"
          />
        </SectionCard>

        {/* Error message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4 text-red-400 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={calculate}
            className="flex-1 h-12 rounded-xl bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-blue-500/20"
          >
            <Calculator size={18} />
            Calculate Landed Cost
          </button>
          <button
            onClick={reset}
            className="h-12 px-6 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-[#222] hover:border-[#333] text-white/70 hover:text-white font-medium text-sm flex items-center justify-center gap-2 transition-all"
          >
            <RotateCcw size={16} />
            Reset
          </button>
        </div>

        {/* Results */}
        {results && (
          <div className="space-y-6 pb-10">
            {/* Key Metrics */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={18} className="text-blue-400" />
                <h2 className="text-[15px] font-semibold tracking-tight">
                  Key Metrics
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <MetricCard
                  label="Total Landed Cost (USD)"
                  value={`$${fmt(results.totalLandedCost)}`}
                  sub={
                    results.currency !== "LCL"
                      ? `${fmt(results.totalLandedCostLocal)} ${results.currency}`
                      : undefined
                  }
                  accent
                />
                <MetricCard
                  label="Cost Per Unit (USD)"
                  value={`$${fmt(results.costPerUnit)}`}
                  sub={
                    results.currency !== "LCL"
                      ? `${fmt(results.costPerUnitLocal)} ${results.currency}`
                      : undefined
                  }
                />
                <MetricCard
                  label="Multiplier"
                  value={`${results.multiplier.toFixed(2)}x`}
                  sub="Total cost / product cost"
                />
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="bg-[#111] border border-[#222] rounded-xl p-5 md:p-6">
              <div className="flex items-center gap-2 mb-5">
                <BarChart3 size={18} className="text-blue-400" />
                <h2 className="text-[15px] font-semibold tracking-tight">
                  Cost Breakdown
                </h2>
              </div>
              <div className="space-y-4">
                {breakdownItems.map((item) => (
                  <BreakdownRow
                    key={item.label}
                    label={item.label}
                    usd={item.usd}
                    percentage={item.pct}
                    color={item.color}
                    maxPct={maxPct}
                  />
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-[#222] flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Total</span>
                <span className="text-sm font-bold text-white">
                  ${fmt(results.totalLandedCost)}
                </span>
              </div>
            </div>

            {/* Percentage Summary */}
            <div className="bg-[#111] border border-[#222] rounded-xl p-5 md:p-6">
              <div className="flex items-center gap-2 mb-5">
                <Percent size={18} className="text-blue-400" />
                <h2 className="text-[15px] font-semibold tracking-tight">
                  Percentage Breakdown
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {breakdownItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg bg-white/[0.03] border border-[#1a1a1a]"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xl font-bold text-white">
                      {item.pct}%
                    </span>
                    <span className="text-xs text-white/50 text-center">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
