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

const discountTypes = [
  {
    title: "Volume Discount",
    description: "Applied when order quantity or total value exceeds defined thresholds. Pre-agreed in commercial terms. Automatically calculated by the system.",
    color: "#007AFF",
  },
  {
    title: "Strategic Discount",
    description: "For strategic deals, market entry pricing, or competitive situations. Requires management approval. Case-by-case evaluation.",
    color: "#AF52DE",
  },
  {
    title: "Loyalty Discount",
    description: "For long-term partners with consistent ordering history. Rewarded through annual rebate or reduced pricing on new orders.",
    color: "#34C759",
  },
  {
    title: "Project Discount",
    description: "Special pricing for large projects, government tenders, or OEM deals. Custom approval required. Typically higher than standard discounts.",
    color: "#FF9500",
  },
];

const approvalLevels = [
  ["0% - 3%", "Auto-approved", "Within standard auto-approval range", "None"],
  ["3% - 5%", "Sales Manager", "Moderate discount requiring first-level approval", "Sales Manager"],
  ["5% - 10%", "Regional Director", "Significant discount requiring director approval", "Regional Director"],
  ["10% - 15%", "Commercial Director", "Large discount requiring commercial director sign-off", "Commercial Director"],
  ["15%+", "CEO / Board", "Exceptional discount requiring top-level authorization", "CEO"],
];

const marginThresholds = [
  ["L1 (Entry)", "5%", "3%", "Must maintain positive margin"],
  ["L2 (Standard)", "10%", "5%", "Minimum 5% after all discounts"],
  ["L3 (Advanced)", "15%", "8%", "Higher products need higher protection"],
  ["L4 (Enterprise)", "25%", "12%", "Strategic products have floor margin"],
];

const discountProcessSteps = [
  { label: "Customer Price Determined", description: "Channel tier pricing calculated from the price ladder" },
  { label: "Discount Requested", description: "Sales team requests a discount with justification" },
  { label: "System Validation", description: "Automated check against approval limits and margin floors" },
  { label: "Approval Routing", description: "If needed, routes to appropriate approval authority" },
  { label: "Margin Check", description: "Final verification that margin stays above minimum threshold" },
  { label: "Price Confirmed", description: "Discounted price locked for quotation validity period" },
];

const discountRules = [
  "Discounts are always applied AFTER the channel tier price is calculated",
  "The formula is: Discounted Price = Customer Price x (1 - Discount %)",
  "Multiple discounts cannot be stacked -- only one discount per line item",
  "All discounts must maintain margin above the product level minimum",
  "Auto-approved discounts are processed without manual intervention",
  "Discount approval is based on the percentage, not the absolute dollar amount",
  "Expired quotations lose their discount -- new approval is required",
  "Discount history is tracked for each customer and product",
];

export default function DiscountPage() {
  return (
    <PolicyPage
      title="Discount System"
      subtitle="Types of discounts, approval levels, and minimum margin requirements. How discounts interact with the KOLEEX pricing system."
      badge="Pricing System"
    >
      {/* Discount Types */}
      <Section title="Types of Discounts">
        <SectionDesc>
          KOLEEX supports four types of discounts, each with different authorization requirements and use cases.
        </SectionDesc>
        <CardGrid cols={2}>
          {discountTypes.map((d) => (
            <InfoCard
              key={d.title}
              title={d.title}
              description={d.description}
              color={d.color}
            />
          ))}
        </CardGrid>
      </Section>

      {/* Discount Process */}
      <Section title="Discount Process Flow">
        <SectionDesc>
          Every discount follows this validation and approval process.
        </SectionDesc>
        <StepFlow steps={discountProcessSteps} />
      </Section>

      {/* Formula */}
      <Section title="Discount Formula">
        <Callout title="Formula">
          Discounted Price = Customer Price x (1 - Discount %)
        </Callout>
        <div style={{ marginTop: 12 }}>
          <Callout title="Example">
            Gold (Distributor) price: $2,059.94 x (1 - 5%) = $2,059.94 x 0.95 = $1,956.94
          </Callout>
        </div>
      </Section>

      {/* Approval Levels */}
      <Section title="Approval Authority Matrix">
        <SectionDesc>
          Discount authority is tiered. Larger discounts require higher-level approval.
        </SectionDesc>
        <DataTable
          headers={["Discount Range", "Approval Level", "Description", "Required Approver"]}
          rows={approvalLevels}
        />
      </Section>

      {/* Minimum Margin */}
      <Section title="Minimum Margin Thresholds">
        <SectionDesc>
          After any discount is applied, the margin must remain above the minimum threshold for the product level. Deals that breach the floor require exceptional approval.
        </SectionDesc>
        <DataTable
          headers={["Product Level", "Base Margin", "Minimum Floor", "Note"]}
          rows={marginThresholds}
        />
      </Section>

      {/* Discount Rules */}
      <Section title="Discount Rules">
        <RuleList rules={discountRules} />
      </Section>

      {/* Link to Full Section */}
      <Section>
        <Callout title="Full Discount Policy">
          For the complete discount system including detailed approval workflows, escalation procedures,
          and discount calculations per product level, see the dedicated Discount section of the Commercial Policy.
        </Callout>
      </Section>
    </PolicyPage>
  );
}
