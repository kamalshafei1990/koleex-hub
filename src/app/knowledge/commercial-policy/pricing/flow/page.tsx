"use client";

import PolicyPage, {
  Section,
  SectionDesc,
  StepFlow,
  DataTable,
  Callout,
  CardGrid,
  InfoCard,
  RuleList,
} from "@/components/commercial-policy/PolicyPage";

const pricingSteps = [
  { label: "Step 1: Product Cost (KOLEEX Cost)", description: "The starting point. KOLEEX Cost is the product cost in CNY. Includes product cost, standard accessories, and standard packaging." },
  { label: "Step 2: FX Conversion", description: "Convert cost from CNY to USD for international pricing. Formula: Cost USD = KOLEEX Cost / Exchange Rate." },
  { label: "Step 3: Product Level & Margin", description: "Product level is auto-detected from KOLEEX Cost. L1: 5%, L2: 10%, L3: 15%, L4: 25%." },
  { label: "Step 4: Global Base Price", description: "Universal starting price before any market or customer adjustments. Formula: Global Base Price = Cost USD x (1 + Margin)." },
  { label: "Step 5: Market Band Adjustment", description: "Each country is assigned a Market Band that adjusts pricing. Band A: -3%, Band B: 0%, Band C: +8%." },
  { label: "Step 6: Customer Level Pricing", description: "Customer level determines the channel price using the KOLEEX price ladder. Platinum x0.97, Gold x1.08, Silver x1.08, Retail x1.20." },
  { label: "Step 7: Discount Applied", description: "Discounts are applied based on customer level authority and approval limits. Formula: Discounted Price = Customer Price x (1 - Discount %)." },
  { label: "Step 8: Minimum Margin Check", description: "After discount, the system checks if the margin is still above the minimum threshold (8% minimum)." },
  { label: "Step 9: Approval Check", description: "The system checks if any approval is required before the price can be confirmed. Checks: discount limit, margin, credit, special pricing." },
  { label: "Step 10: Final Price", description: "The confirmed selling price after all checks pass. Ready for quotation." },
  { label: "Step 11: Margin & Profit", description: "Calculate gross profit and margin percentage. This margin funds company operations, growth, and partner support." },
  { label: "Step 12: Order Decision", description: "Price confirmed. Ready for quotation, order, and invoicing. Order can be approved and processed." },
];

const runningExampleRows = [
  ["1", "KOLEEX Cost", "12,000.00 CNY"],
  ["2", "Cost USD", "$1,655.17"],
  ["3", "Product Level", "Level 2 (10% margin)"],
  ["4", "Global Base Price", "$1,820.69"],
  ["5", "Market Price (Band C)", "$1,966.34"],
  ["6", "Gold (Distributor) Price", "$2,059.94"],
  ["7", "After 5% Discount", "$1,956.94"],
  ["8", "Margin Check", "18.2% >= 8% -- OK"],
  ["9", "Approval", "No approval required"],
  ["10", "Final Price", "$1,956.94"],
  ["11", "Gross Profit", "$301.77 (18.2%)"],
  ["12", "Order Status", "APPROVED"],
];

const whyThisPrice = [
  "Product Level 2 (Standard Commercial)",
  "Market Band C (Premium Market -- Turkey)",
  "Customer Level: Gold (Distributor)",
  "Approved Discount: 5%",
  "Margin: 18.2% -- above 8% minimum",
  "No special approval required",
];

export default function PricingFlowPage() {
  return (
    <PolicyPage
      title="Pricing Flow"
      subtitle="How does KOLEEX determine the final selling price? 12 steps from product cost to approved order. Every price in the system derives from this flow."
      badge="Pricing System"
    >
      {/* Tier Legend */}
      <Section title="Customer Tier Legend">
        <CardGrid cols={4}>
          {[
            { title: "Platinum", value: "Agent", color: "#7BA1C2" },
            { title: "Gold", value: "Distributor", color: "#C9973F" },
            { title: "Silver", value: "Dealer", color: "#A8A9AD" },
            { title: "Retail", value: "End User", color: "#6B8F71" },
          ].map((t) => (
            <InfoCard key={t.title} title={t.title} value={t.value} color={t.color} />
          ))}
        </CardGrid>
      </Section>

      {/* Complete Pricing Pipeline */}
      <Section title="Complete Pricing Pipeline">
        <SectionDesc>
          Running example: Industrial PLC Controller | 12,000.00 CNY | Turkey (Band C) | Gold (Distributor) | 5% discount.
        </SectionDesc>
        <StepFlow steps={pricingSteps} />
      </Section>

      {/* Running Example Summary */}
      <Section title="Running Example Summary">
        <SectionDesc>
          All 12 steps with calculated values for the Industrial PLC Controller scenario.
        </SectionDesc>
        <DataTable
          headers={["Step", "Description", "Value"]}
          rows={runningExampleRows}
        />
      </Section>

      {/* Formula Chain */}
      <Section title="Formula Chain">
        <Callout title="End-to-End Calculation">
          12,000.00 CNY / 7.25 = $1,655.17 {"->"} x1.10 = $1,820.69 {"->"} x1.08 Band C = $1,966.34 {"->"} x0.97 Plat = $1,907.35 {"->"} x1.08 Gold = $2,059.94 {"->"} x0.95 = $1,956.94
        </Callout>
      </Section>

      {/* Why This Price */}
      <Section title="Why This Price?">
        <SectionDesc>
          This quotation was built using the following parameters:
        </SectionDesc>
        <RuleList rules={whyThisPrice} />
        <div style={{ marginTop: 16 }}>
          <Callout title="Final Selling Price" color="#34C759">
            $1,956.94 -- Gold (Distributor) | Turkey | 5% discount
          </Callout>
        </div>
      </Section>
    </PolicyPage>
  );
}
