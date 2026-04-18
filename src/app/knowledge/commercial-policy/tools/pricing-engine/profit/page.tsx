"use client";

import PolicyPage, {
  Section,
  SectionDesc,
  CardGrid,
  InfoCard,
  DataTable,
  Callout,
  Badge,
} from "@/components/commercial-policy/PolicyPage";

/* ===== Margin by Product Level ===== */
const PRODUCT_MARGINS = [
  { level: "L1 - Standard", range: "15-25%", target: "20%", description: "Entry-level and accessories. Volume-driven margin.", color: "#007AFF" },
  { level: "L2 - Professional", range: "25-35%", target: "30%", description: "Professional-grade products. Balanced volume and margin.", color: "#34C759" },
  { level: "L3 - Advanced", range: "35-45%", target: "40%", description: "Advanced technical products. Margin-driven with value pricing.", color: "#FF9500" },
  { level: "L4 - Enterprise", range: "45-60%", target: "52%", description: "Enterprise solutions. Highest margin tier with full support costs.", color: "#FF3B30" },
];

/* ===== Margin by Customer Tier ===== */
const TIER_MARGINS = [
  ["Platinum (Agent)", "0.97x", "Lowest", "Best pricing for strategic agents. Margin recovered through volume commitments."],
  ["Gold (Distributor)", "1.08x", "Standard", "Balanced pricing for distributors with regional coverage."],
  ["Silver (Dealer)", "1.08x", "Standard", "Standard dealer pricing with same multiplier as distributor."],
  ["Retail (End User)", "1.20x", "Highest", "Full retail margin. No channel discount applied."],
];

/* ===== Profitability Matrix ===== */
const PROFIT_MATRIX_HEADERS = ["Product Level", "Platinum", "Gold", "Silver", "Retail"];
const PROFIT_MATRIX = [
  [
    "L1 - Standard",
    <Badge key="p1" label="15-17%" color="#7BA1C2" />,
    <Badge key="g1" label="22-27%" color="#C9973F" />,
    <Badge key="s1" label="22-27%" color="#A8A9AD" />,
    <Badge key="r1" label="28-33%" color="#6B8F71" />,
  ],
  [
    "L2 - Professional",
    <Badge key="p2" label="25-28%" color="#7BA1C2" />,
    <Badge key="g2" label="33-38%" color="#C9973F" />,
    <Badge key="s2" label="33-38%" color="#A8A9AD" />,
    <Badge key="r2" label="38-42%" color="#6B8F71" />,
  ],
  [
    "L3 - Advanced",
    <Badge key="p3" label="35-38%" color="#7BA1C2" />,
    <Badge key="g3" label="42-48%" color="#C9973F" />,
    <Badge key="s3" label="42-48%" color="#A8A9AD" />,
    <Badge key="r3" label="48-52%" color="#6B8F71" />,
  ],
  [
    "L4 - Enterprise",
    <Badge key="p4" label="45-50%" color="#7BA1C2" />,
    <Badge key="g4" label="52-58%" color="#C9973F" />,
    <Badge key="s4" label="52-58%" color="#A8A9AD" />,
    <Badge key="r4" label="58-65%" color="#6B8F71" />,
  ],
];

/* ===== Profit Calculation Steps ===== */
const CALC_ROWS = [
  ["Revenue", "Selling price to the customer", "Invoice amount"],
  ["COGS", "KOLEEX cost + landed cost", "Product cost + freight + duties"],
  ["Gross Profit", "Revenue - COGS", "Primary profitability measure"],
  ["Gross Margin %", "(Gross Profit / Revenue) x 100", "Target varies by level"],
  ["Commission", "Revenue x Commission Rate", "3-5% depending on tier"],
  ["Net Contribution", "Gross Profit - Commission", "True deal profitability"],
];

/* ===== Key Metrics ===== */
const METRICS = [
  { title: "Min Margin", value: "15%", description: "L1 at Platinum tier", color: "#FF3B30" },
  { title: "Avg Margin", value: "38%", description: "Across all levels/tiers", color: "#FF9500" },
  { title: "Max Margin", value: "65%", description: "L4 at Retail tier", color: "#34C759" },
  { title: "Commission Impact", value: "3-5%", description: "Reduces net contribution", color: "#5856D6" },
];

export default function ProfitAnalysisPage() {
  return (
    <PolicyPage
      title="Profit Analysis."
      subtitle="Understanding profitability across product levels and customer tiers. How to calculate and evaluate deal margins."
      badge="Pricing Engine"
    >
      {/* Key Metrics */}
      <Section title="Margin Overview.">
        <SectionDesc>
          Margin ranges across the KOLEEX product and customer matrix.
        </SectionDesc>
        <CardGrid cols={4}>
          {METRICS.map((m) => (
            <InfoCard key={m.title} title={m.title} value={m.value} description={m.description} color={m.color} />
          ))}
        </CardGrid>
      </Section>

      {/* Product Level Margins */}
      <Section title="Margins by Product Level.">
        <SectionDesc>
          Each product level has a target margin range that determines the base
          price markup over KOLEEX cost.
        </SectionDesc>
        <CardGrid cols={4}>
          {PRODUCT_MARGINS.map((p) => (
            <InfoCard key={p.level} title={p.level} value={p.range} description={p.description} color={p.color}>
              <p className="mt-1 text-[11px]" style={{ color: "var(--text-dim)" }}>
                Target: {p.target}
              </p>
            </InfoCard>
          ))}
        </CardGrid>
      </Section>

      {/* Customer Tier Impact */}
      <Section title="Customer Tier Impact.">
        <SectionDesc>
          Channel multipliers affect the final selling price and therefore the
          effective margin.
        </SectionDesc>
        <DataTable
          headers={["Customer Tier", "Multiplier", "Margin Impact", "Notes"]}
          rows={TIER_MARGINS}
        />
      </Section>

      {/* Profitability Matrix */}
      <Section title="Profitability Matrix.">
        <SectionDesc>
          Expected gross margin ranges for each product level and customer tier
          combination.
        </SectionDesc>
        <DataTable headers={PROFIT_MATRIX_HEADERS} rows={PROFIT_MATRIX} />
      </Section>

      {/* Profit Calculation */}
      <Section title="Profit Calculation.">
        <SectionDesc>
          How to calculate profitability for any deal.
        </SectionDesc>
        <DataTable
          headers={["Component", "Definition", "Notes"]}
          rows={CALC_ROWS}
        />
      </Section>

      <Callout title="Margin Protection">
        Minimum margin thresholds exist for each product level. Any deal that
        falls below the minimum requires escalation through the approval
        workflow. Margin protection rules are enforced by the pricing engine.
      </Callout>
    </PolicyPage>
  );
}
