"use client";

import { useState } from "react";
import PolicyPage, {
  Section,
  SectionDesc,
  DataTable,
  Callout,
  Badge,
} from "@/components/commercial-policy/PolicyPage";

/* ===== Configuration ===== */
const PRODUCT_LEVELS = [
  { id: "L1", name: "Standard", margin: 0.20 },
  { id: "L2", name: "Professional", margin: 0.30 },
  { id: "L3", name: "Advanced", margin: 0.40 },
  { id: "L4", name: "Enterprise", margin: 0.52 },
];

const MARKET_BANDS = [
  { id: "A", name: "Band A - Price Sensitive", factor: 0.90 },
  { id: "B", name: "Band B - Balanced", factor: 0.95 },
  { id: "C", name: "Band C - Premium", factor: 1.00 },
  { id: "D", name: "Band D - Special", factor: 1.05 },
];

const CUSTOMER_TIERS = [
  { id: "platinum", name: "Platinum (Agent)", multiplier: 0.97, color: "#7BA1C2" },
  { id: "gold", name: "Gold (Distributor)", multiplier: 1.08, color: "#C9973F" },
  { id: "silver", name: "Silver (Dealer)", multiplier: 1.08, color: "#A8A9AD" },
  { id: "retail", name: "Retail (End User)", multiplier: 1.20, color: "#6B8F71" },
];

function calculatePrices(cost: number, levelId: string, bandId: string) {
  const level = PRODUCT_LEVELS.find((l) => l.id === levelId) ?? PRODUCT_LEVELS[0];
  const band = MARKET_BANDS.find((b) => b.id === bandId) ?? MARKET_BANDS[2];

  const basePrice = cost / (1 - level.margin);
  const adjustedBase = basePrice * band.factor;

  return CUSTOMER_TIERS.map((tier) => {
    const price = adjustedBase * tier.multiplier;
    const margin = ((price - cost) / price) * 100;
    return {
      tier: tier.name,
      color: tier.color,
      price: Math.round(price * 100) / 100,
      margin: Math.round(margin * 10) / 10,
    };
  });
}

export default function PriceCalculatorPage() {
  const [cost, setCost] = useState(1000);
  const [level, setLevel] = useState("L2");
  const [band, setBand] = useState("C");

  const results = calculatePrices(cost, level, band);
  const selectedLevel = PRODUCT_LEVELS.find((l) => l.id === level);
  const selectedBand = MARKET_BANDS.find((b) => b.id === band);
  const basePrice = cost / (1 - (selectedLevel?.margin ?? 0.30));
  const adjustedBase = basePrice * (selectedBand?.factor ?? 1.0);

  return (
    <PolicyPage
      title="Price Calculator."
      subtitle="Interactive pricing calculator. Enter a product cost and see the full price ladder across all customer tiers."
      badge="Pricing Engine"
    >
      {/* Input Section */}
      <Section title="Inputs.">
        <SectionDesc>
          Configure the product cost, level, and market band to generate
          the price ladder.
        </SectionDesc>
        <div
          className="rounded-xl border p-6"
          style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
        >
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {/* Product Cost */}
            <div>
              <label
                className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-dim)" }}
              >
                Product Cost (CNY)
              </label>
              <input
                type="number"
                value={cost}
                onChange={(e) => setCost(Number(e.target.value) || 0)}
                className="w-full rounded-lg border px-3 py-2.5 text-[14px] outline-none"
                style={{
                  borderColor: "var(--border-subtle)",
                  background: "var(--bg-surface-subtle)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            {/* Product Level */}
            <div>
              <label
                className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-dim)" }}
              >
                Product Level
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-[14px] outline-none"
                style={{
                  borderColor: "var(--border-subtle)",
                  background: "var(--bg-surface-subtle)",
                  color: "var(--text-primary)",
                }}
              >
                {PRODUCT_LEVELS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.id} - {l.name} ({Math.round(l.margin * 100)}% margin)
                  </option>
                ))}
              </select>
            </div>

            {/* Market Band */}
            <div>
              <label
                className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-dim)" }}
              >
                Market Band
              </label>
              <select
                value={band}
                onChange={(e) => setBand(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-[14px] outline-none"
                style={{
                  borderColor: "var(--border-subtle)",
                  background: "var(--bg-surface-subtle)",
                  color: "var(--text-primary)",
                }}
              >
                {MARKET_BANDS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} (x{b.factor.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Section>

      {/* Price Ladder */}
      <Section title="Price Ladder.">
        <SectionDesc>
          Calculated prices for each customer tier based on your inputs.
        </SectionDesc>

        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            className="rounded-xl border p-4 text-center"
            style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
          >
            <p className="text-[11px] font-semibold uppercase" style={{ color: "var(--text-dim)" }}>
              KOLEEX Cost
            </p>
            <p className="mt-1 text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              {cost.toLocaleString("en-US")} CNY
            </p>
          </div>
          <div
            className="rounded-xl border p-4 text-center"
            style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
          >
            <p className="text-[11px] font-semibold uppercase" style={{ color: "var(--text-dim)" }}>
              Base Price
            </p>
            <p className="mt-1 text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              {Math.round(basePrice).toLocaleString("en-US")} CNY
            </p>
          </div>
          <div
            className="rounded-xl border p-4 text-center"
            style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
          >
            <p className="text-[11px] font-semibold uppercase" style={{ color: "var(--text-dim)" }}>
              Adjusted Base
            </p>
            <p className="mt-1 text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              {Math.round(adjustedBase).toLocaleString("en-US")} CNY
            </p>
          </div>
          <div
            className="rounded-xl border p-4 text-center"
            style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
          >
            <p className="text-[11px] font-semibold uppercase" style={{ color: "var(--text-dim)" }}>
              Level Margin
            </p>
            <p className="mt-1 text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              {Math.round((selectedLevel?.margin ?? 0) * 100)}%
            </p>
          </div>
        </div>

        {/* Tier Prices */}
        <DataTable
          headers={["Customer Tier", "Price (CNY)", "Effective Margin"]}
          rows={results.map((r) => [
            <Badge key={r.tier} label={r.tier} color={r.color} />,
            <span key={`p-${r.tier}`} className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {r.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>,
            `${r.margin}%`,
          ])}
        />
      </Section>

      {/* Reference */}
      <Section title="Multiplier Reference.">
        <SectionDesc>
          Key multipliers used in the pricing formula.
        </SectionDesc>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DataTable
            headers={["Product Level", "Margin Range"]}
            rows={[
              ["L1 - Standard", "15-25%"],
              ["L2 - Professional", "25-35%"],
              ["L3 - Advanced", "35-45%"],
              ["L4 - Enterprise", "45-60%"],
            ]}
          />
          <DataTable
            headers={["Market Band", "Adjustment"]}
            rows={[
              ["Band A - Price Sensitive", "x0.90"],
              ["Band B - Balanced", "x0.95"],
              ["Band C - Premium", "x1.00"],
              ["Band D - Special", "x1.05"],
            ]}
          />
        </div>
      </Section>

      <Callout title="Demo Calculator">
        This calculator uses reference multipliers for illustration. Actual
        pricing is subject to the full pricing engine with real-time cost data
        and approved margin rules.
      </Callout>
    </PolicyPage>
  );
}
