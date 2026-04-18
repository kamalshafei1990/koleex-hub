"use client";

import PolicyPage, {
  Section,
  SectionDesc,
  CardGrid,
  InfoCard,
  DataTable,
  StepFlow,
  RuleList,
  Callout,
} from "@/components/commercial-policy/PolicyPage";

const comparisonRows = [
  ["Markup (on Cost)", "$100 x 1.20", "$120", "$20", "20% of cost"],
  ["True Margin (on SP)", "$100 / 0.80", "$125", "$25", "20% of selling price"],
  ["Difference", "--", "+$5", "+$5", "--"],
];

const whenToUseMarkup = [
  "Internal pricing and costing",
  "Quick negotiation calculations",
  "Pricing calculator tools",
  "Fast decision-making",
];

const whenToUseTrueMargin = [
  "Distribution margins",
  "Market pricing and retail structure",
  "Channel pricing and partner profitability",
  "Financial reporting",
];

const hybridFlowSteps = [
  { label: "Net Internal Cost", description: "Starting point -- the base cost before any margin" },
  { label: "Add KOLEEX Margin (Markup Method)", description: "Cost x (1 + margin%). Uses Margin on Cost method for internal pricing." },
  { label: "Regional Adjustment", description: "Apply market band factor for regional pricing" },
  { label: "Channel Margins (True Margin Method)", description: "Cost / (1 - channel%). Uses Margin on Selling Price for distribution." },
  { label: "Discounts", description: "Volume and strategic discounts applied" },
  { label: "Final End User Price", description: "The price the customer sees" },
];

const channelMultiplierRows = [
  [
    <span key="p" style={{ color: "#7BA1C2", fontWeight: 600 }}>Platinum (Agent)</span>,
    "x 0.97",
    "Base Price x 0.97",
    "Best channel price -- 3% discount from Base",
  ],
  [
    <span key="g" style={{ color: "#C9973F", fontWeight: 600 }}>Gold (Distributor)</span>,
    "x 1.08",
    "Platinum x 1.08",
    "8% above Platinum",
  ],
  [
    <span key="s" style={{ color: "#A8A9AD", fontWeight: 600 }}>Silver (Dealer)</span>,
    "x 1.08",
    "Gold x 1.08",
    "8% above Gold",
  ],
  [
    <span key="r" style={{ color: "#6B8F71", fontWeight: 600 }}>Retail (End User)</span>,
    "x 1.20",
    "Silver x 1.20",
    "20% above Silver",
  ],
];

export default function PricingMathPage() {
  return (
    <PolicyPage
      title="Pricing Mathematics"
      subtitle="Markup vs True Margin -- understanding the two pricing methods and how KOLEEX uses both in a hybrid system."
      badge="Pricing System"
    >
      {/* Method 1: Markup */}
      <Section title="Method 1: Margin on Cost (Markup)">
        <SectionDesc>
          Simple and commonly used in trading companies. Margin is calculated as a percentage of cost. Useful for internal pricing and quick calculations.
        </SectionDesc>
        <Callout title="Formula">
          Selling Price = Cost x (1 + Margin%)
        </Callout>
        <div style={{ marginTop: 16 }}>
          <CardGrid cols={3}>
            <InfoCard title="Cost" value="$100" />
            <InfoCard title="Margin" value="20%" />
            <InfoCard title="Selling Price" value="$120" color="#34C759" />
          </CardGrid>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 12, textAlign: "center" }}>
          Profit = $20
        </p>
      </Section>

      {/* Method 2: True Margin */}
      <Section title="Method 2: Margin on Selling Price (True Margin)">
        <SectionDesc>
          Used by larger companies. Margin is calculated on the final selling price, not on cost. Results in a higher selling price for the same percentage.
        </SectionDesc>
        <Callout title="Formula">
          Selling Price = Cost / (1 - Margin%)
        </Callout>
        <div style={{ marginTop: 16 }}>
          <CardGrid cols={3}>
            <InfoCard title="Cost" value="$100" />
            <InfoCard title="Margin" value="20%" />
            <InfoCard title="Selling Price" value="$125" color="#34C759" />
          </CardGrid>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 12, textAlign: "center" }}>
          Profit = $25
        </p>
      </Section>

      {/* Comparison */}
      <Section title="The Difference: Same Percentage, Different Result">
        <SectionDesc>
          Both methods claim a 20% margin, but the results are $5 apart. This is a common source of pricing confusion.
        </SectionDesc>
        <DataTable
          headers={["Method", "Formula", "Selling Price", "Profit", "Margin %"]}
          rows={comparisonRows}
        />
        <div style={{ marginTop: 16 }}>
          <Callout title="Key Insight" color="#FF9500">
            Same 20% -- but $5 difference in price and profit. 20% markup does not equal 20% true margin.
          </Callout>
        </div>
      </Section>

      {/* When to Use */}
      <Section title="When to Use Each Method">
        <CardGrid cols={2}>
          <InfoCard title="Margin on Cost (Markup)" color="#007AFF">
            <div style={{ marginTop: 8 }}>
              <RuleList rules={whenToUseMarkup} />
            </div>
          </InfoCard>
          <InfoCard title="Margin on Selling Price (True Margin)" color="#34C759">
            <div style={{ marginTop: 8 }}>
              <RuleList rules={whenToUseTrueMargin} />
            </div>
          </InfoCard>
        </CardGrid>
      </Section>

      {/* KOLEEX Hybrid System */}
      <Section title="KOLEEX Hybrid System">
        <SectionDesc>
          KOLEEX uses a hybrid approach: Margin on Cost for internal pricing (product level margins), and the sequential channel multiplier ladder for channel distribution. This gives both operational simplicity and market accuracy.
        </SectionDesc>
        <StepFlow steps={hybridFlowSteps} />
      </Section>

      {/* Channel Multipliers */}
      <Section title="Channel Multipliers (Sequential)">
        <SectionDesc>
          The KOLEEX price ladder applies multipliers sequentially -- each tier is derived from the tier above, not from the Base Price.
        </SectionDesc>
        <DataTable
          headers={["Tier", "Multiplier", "Formula", "Description"]}
          rows={channelMultiplierRows}
        />
      </Section>

      {/* Summary */}
      <Section title="Key Takeaways">
        <RuleList
          rules={[
            "20% markup does not equal 20% true margin",
            "Markup (on cost) is simpler for internal use",
            "True margin (on selling price) is standard for channel pricing",
            "KOLEEX uses both -- hybrid system for maximum control",
          ]}
        />
      </Section>
    </PolicyPage>
  );
}
