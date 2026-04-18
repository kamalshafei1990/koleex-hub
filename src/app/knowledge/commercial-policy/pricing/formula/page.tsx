"use client";

import PolicyPage, { Section, DataTable, Callout, InfoCard, CardGrid } from "@/components/commercial-policy/PolicyPage";

const exampleCalc = [
  ["Factory Cost (CNY)", "¥2,800"],
  ["Internal Cost Add (+8%)", "¥3,024"],
  ["Net Internal Cost", "¥3,024"],
  ["Target Margin (L2: 30%)", "×1.30"],
  ["Base Global Price (CNY)", "¥3,931"],
  ["CNY → USD (÷7.20)", "$546"],
  ["Market Band B (×0.95)", "$519"],
  ["Channel: Platinum Price", "$503 (×0.97)"],
  ["Channel: Gold Price", "$543 (×1.08)"],
  ["Channel: Silver Price", "$587 (×1.08)"],
  ["Channel: Retail SRP", "$704 (×1.20)"],
];

export default function PricingFormulaPage() {
  return (
    <PolicyPage title="Pricing Formula" subtitle="The complete mathematical formula that transforms factory cost into customer-facing prices across all channels and markets." badge="Pricing System">
      <Section title="The Master Formula">
        <div className="rounded-xl p-8" style={{ background: "var(--bg-inverted)", color: "var(--text-inverted)" }}>
          <p className="mb-6 text-center text-[14px]" style={{ opacity: 0.6 }}>Final Price =</p>
          {["Factory Cost", "+ Internal Cost (8%)", "= Net Internal Cost", "× Target Margin (by Product Level)", "= Base Global Price (CNY)", "÷ FX Rate (CNY/USD)", "= USD Reference Price", "× Market Band Adjustment", "× Channel Multiplier", "= Customer Price"].map((line, i) => (
            <div key={i} className="py-2 text-center font-mono text-[14px] md:text-[16px]" style={{ borderBottom: i < 9 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>{line}</div>
          ))}
        </div>
      </Section>

      <Section title="Step-by-Step Example">
        <p className="mb-4 text-[13px]" style={{ color: "var(--text-muted)" }}>Product: Industrial Sewing Machine (L2), Market: Egypt (Band B)</p>
        <DataTable headers={["Step", "Value"]} rows={exampleCalc} />
      </Section>

      <Section title="Key Variables">
        <CardGrid cols={3}>
          <InfoCard title="Internal Cost Add" value="8%" description="Covers warehousing, QC, packaging, admin overhead" />
          <InfoCard title="FX Rate" value="7.20" description="CNY/USD reference rate, updated quarterly" />
          <InfoCard title="Channel Sequential" description="Each tier multiplies on the previous tier price, not the base" />
        </CardGrid>
      </Section>

      <Callout title="Important">The formula is sequential — each channel tier builds on the previous tier&apos;s price, not on the base price. This ensures proper margin distribution across the distribution chain.</Callout>
    </PolicyPage>
  );
}
