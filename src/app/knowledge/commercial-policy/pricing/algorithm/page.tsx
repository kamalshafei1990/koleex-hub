"use client";

import PolicyPage, {
  Section,
  SectionDesc,
  StepFlow,
  DataTable,
  CardGrid,
  InfoCard,
  RuleList,
  Callout,
} from "@/components/commercial-policy/PolicyPage";

const overviewSteps = [
  { label: "Factory Cost", description: "Product cost, standard accessories, standard packaging" },
  { label: "Net Internal Cost", description: "Factory Cost + export docs + local transport + bank charges - tax refund" },
  { label: "Product Level", description: "Auto-detected from KOLEEX Cost (L1-L4)" },
  { label: "Base Margin", description: "Fixed margin per level: 5% / 10% / 15% / 25%" },
  { label: "Global FOB", description: "Net Internal Cost x (1 + Base Margin)" },
  { label: "Regional Adjustment", description: "Apply market band factor (A: 0.97, B: 1.00, C: 1.08, D: varies)" },
  { label: "Channel Price", description: "Platinum x0.97, Gold x1.08, Silver x1.08, Retail x1.20" },
  { label: "Volume Discount", description: "Optional volume or strategic discount applied" },
  { label: "Strategic Adjustment", description: "Special pricing for tenders, OEM, or strategic accounts" },
  { label: "Margin Check", description: "Verify margin remains above minimum threshold (8%)" },
  { label: "Approval", description: "Route for approval if discount exceeds auto-approval limit" },
  { label: "SRP (Suggested Retail Price)", description: "Final confirmed price for quotation and order" },
];

const factoryCostIncludes = [
  "Product cost from factory",
  "Standard accessories included with product",
  "Standard packaging for shipping",
];

const factoryCostExcludes = [
  "Shipping and freight charges",
  "Export documentation fees",
  "Bank and LC charges",
  "Internal handling costs",
  "Warranty reserves",
  "Marketing expenses",
  "Sales commission",
];

const netInternalCostItems = [
  ["Factory Cost", "Base", "Starting point"],
  ["+ Export Documents", "Added", "Documentation fees"],
  ["+ Local Transport", "Added", "Internal logistics"],
  ["+ Packaging Adjustments", "Added", "Special packaging if needed"],
  ["+ Bank Charges", "Added", "LC and banking fees"],
  ["+ Internal Handling", "Added", "Warehouse and processing"],
  ["+ Warranty Reserve", "Added", "After-sales provision"],
  ["- Tax Refund", "Deducted", "Export tax refund (if applicable)"],
  ["= Net Internal Cost", "Result", "The most important number in the pricing system"],
];

const levelRows = [
  ["L1", "3 - 6%", "Entry / Volume products", "#34C759"],
  ["L2", "7 - 12%", "Standard commercial equipment", "#007AFF"],
  ["L3", "13 - 20%", "Advanced / semi-industrial", "#FF9500"],
  ["L4", "20 - 35%", "High-end / strategic products", "#AF52DE"],
];

const marginFactors = [
  "Customer Level (Platinum / Gold / Silver / Retail)",
  "Region and market band assignment",
  "Order size and volume commitment",
  "Competition in the specific market",
  "Strategic importance of the deal",
];

const channelRows = [
  ["KOLEEX", "--", "Internal reference price", "#1E1E20"],
  ["Sole Agent (Diamond)", "5 - 8%", "Exclusive country/region representative", "#4FC3F7"],
  ["Agent (Platinum)", "5 - 7%", "Market representative managing dealers", "#7BA1C2"],
  ["Distributor (Gold)", "6 - 8%", "Regional partner with stock and service", "#C9973F"],
  ["Dealer (Silver)", "10 - 15%", "Local reseller in specific area", "#A8A9AD"],
  ["End User (Retail)", "--", "Final customer price", "#6B8F71"],
];

export default function PricingAlgorithmPage() {
  return (
    <PolicyPage
      title="Pricing Algorithm"
      subtitle="The official step-by-step process KOLEEX uses to build prices for any product, market, and customer. Twelve steps from cost to retail price."
      badge="Pricing System"
    >
      {/* 12-Step Overview */}
      <Section title="The Process: 12 Steps">
        <SectionDesc>
          Every KOLEEX price follows this exact algorithm. Steps 10 and 11 (Margin Check and Approval) are decision gates that may halt or escalate the process.
        </SectionDesc>
        <StepFlow steps={overviewSteps} />
      </Section>

      {/* Step 1: Factory Cost */}
      <Section title="Step 1: Determine Factory Cost">
        <SectionDesc>
          The factory cost is the raw starting point. It includes only the direct cost of the product.
        </SectionDesc>
        <CardGrid cols={2}>
          <InfoCard title="Includes" color="#34C759">
            <div style={{ marginTop: 8 }}>
              <RuleList rules={factoryCostIncludes} />
            </div>
          </InfoCard>
          <InfoCard title="Does Not Include" color="#FF3B30">
            <div style={{ marginTop: 8 }}>
              <RuleList rules={factoryCostExcludes} />
            </div>
          </InfoCard>
        </CardGrid>
      </Section>

      {/* Step 2: Net Internal Cost */}
      <Section title="Step 2: Calculate Net Internal Cost">
        <SectionDesc>
          Net Internal Cost adds all the operational costs to factory cost. This is the most important number in the pricing system.
        </SectionDesc>
        <DataTable
          headers={["Component", "Type", "Description"]}
          rows={netInternalCostItems}
        />
        <div style={{ marginTop: 16 }}>
          <Callout title="Key Principle">
            Net Internal Cost is the most important number in the pricing system. All downstream calculations depend on its accuracy.
          </Callout>
        </div>
      </Section>

      {/* Steps 3-4: Product Level & Margin */}
      <Section title="Steps 3-4: Product Level & Base Margin">
        <SectionDesc>
          The KOLEEX Cost automatically determines the product level. Each level has a margin range.
        </SectionDesc>
        <DataTable
          headers={["Level", "Margin Range", "Description"]}
          rows={levelRows.map((r) => [
            <span key={r[0]} style={{ color: r[3], fontWeight: 700 }}>{r[0]}</span>,
            r[1],
            r[2],
          ])}
        />
        <div style={{ marginTop: 16 }}>
          <SectionDesc>Exact margin within the range depends on:</SectionDesc>
          <RuleList rules={marginFactors} />
        </div>
      </Section>

      {/* Step 5: Global FOB */}
      <Section title="Step 5: Global Reference FOB Price">
        <Callout title="Formula">
          Global Reference FOB = Net Internal Cost x (1 + Base Margin)
        </Callout>
        <div style={{ marginTop: 12 }}>
          <Callout title="Example">
            Cost $1,000 x (1 + 10%) = $1,100 Global FOB
          </Callout>
        </div>
      </Section>

      {/* Step 6: Regional Adjustment */}
      <Section title="Step 6: Apply Regional Adjustment">
        <SectionDesc>
          Each country is assigned to a market band. The band factor adjusts the Global FOB for regional conditions.
        </SectionDesc>
        <CardGrid cols={4}>
          {[
            { title: "Band A", value: "-3%", description: "Factor: 0.97", color: "#34C759" },
            { title: "Band B", value: "0%", description: "Factor: 1.00", color: "#007AFF" },
            { title: "Band C", value: "+8%", description: "Factor: 1.08", color: "#FF9500" },
            { title: "Band D", value: "Flexible", description: "Factor: Varies", color: "#AF52DE" },
          ].map((b) => (
            <InfoCard key={b.title} title={b.title} value={b.value} description={b.description} color={b.color} />
          ))}
        </CardGrid>
        <div style={{ marginTop: 16 }}>
          <Callout title="Formula">
            Regional FOB = Global FOB x Regional Factor
          </Callout>
        </div>
      </Section>

      {/* Step 7: Channel Structure */}
      <Section title="Step 7: Build Channel Price Structure">
        <SectionDesc>
          The channel ladder assigns margins to each level of the distribution chain.
        </SectionDesc>
        <DataTable
          headers={["Channel Level", "Margin", "Description"]}
          rows={channelRows.map((r) => [
            <span key={r[0]} style={{ color: r[3], fontWeight: 600 }}>{r[0]}</span>,
            r[1],
            r[2],
          ])}
        />
      </Section>

      {/* Steps 8-9: Discounts & Adjustments */}
      <Section title="Steps 8-9: Volume Discount & Strategic Adjustment">
        <SectionDesc>
          Optional discounts may be applied for volume commitments or strategic deals. These require approval based on the discount amount and its impact on margin.
        </SectionDesc>
        <RuleList
          rules={[
            "Small discounts within auto-approval limits are processed automatically",
            "Larger discounts require management or director-level approval",
            "Strategic adjustments (tenders, OEM, government) follow a separate approval path",
            "All discounts are tracked and reported in the system",
          ]}
        />
      </Section>

      {/* Steps 10-11: Margin Check & Approval */}
      <Section title="Steps 10-11: Margin Check & Approval">
        <Callout title="Decision Gate" color="#FF9500">
          The system verifies the final margin is above the minimum threshold (8%). If the margin is below minimum, the deal is escalated for approval. If all checks pass (discount within limit, margin OK, credit OK, no special pricing), the order is auto-approved.
        </Callout>
      </Section>

      {/* Step 12: SRP */}
      <Section title="Step 12: Final Price (SRP)">
        <SectionDesc>
          Once all checks pass, the Suggested Retail Price is confirmed and ready for quotation, order, and invoicing.
        </SectionDesc>
        <Callout title="Order Approved" color="#34C759">
          Quotation can be generated and sent to the customer. Price is locked for the validity period.
        </Callout>
      </Section>
    </PolicyPage>
  );
}
