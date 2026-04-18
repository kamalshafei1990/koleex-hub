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
  Badge,
} from "@/components/commercial-policy/PolicyPage";

const tierCards = [
  {
    title: "Platinum",
    value: "Agent",
    description: "Multiplier: x0.97. Market representative managing dealers and distributors. Receives the best (lowest) channel price -- 3% below Base Price.",
    color: "#7BA1C2",
  },
  {
    title: "Gold",
    value: "Distributor",
    description: "Multiplier: x1.08 (on Platinum). Regional partner with stock and service. Mid-volume channel with 8% above Platinum pricing.",
    color: "#C9973F",
  },
  {
    title: "Silver",
    value: "Dealer",
    description: "Multiplier: x1.08 (on Gold). Local reseller serving a specific city or area. 8% above Gold pricing for smaller-volume operations.",
    color: "#A8A9AD",
  },
  {
    title: "Retail Global",
    value: "End User",
    description: "Multiplier: x1.20 (on Silver). Factories and businesses purchasing equipment for their own production. 20% above Silver pricing.",
    color: "#6B8F71",
  },
];

const ladderSteps = [
  { label: "Base Price", description: "KOLEEX Cost x (1 + Product Level Margin)" },
  { label: "Platinum (Agent) -- x0.97", description: "Best price. 3% discount from Base. For agents managing territories." },
  { label: "Gold (Distributor) -- x1.08", description: "Platinum x 1.08. For distributors with stock and service." },
  { label: "Silver (Dealer) -- x1.08", description: "Gold x 1.08. For local dealers and resellers." },
  { label: "Retail Global (End User) -- x1.20", description: "Silver x 1.20. Base end-user price before market adjustment." },
];

const comparisonHeaders = ["Price Point", "Channel", "Price (CNY)", "Price (USD)", "vs Cost"];
const comparisonRows = [
  ["Base Price", "Internal", "13,200.00", "$1,820.69", "+10.0%"],
  [
    <span key="p" style={{ color: "#7BA1C2", fontWeight: 600 }}>Platinum</span>,
    "Agent",
    "12,804.00",
    "$1,766.07",
    "+6.7%",
  ],
  [
    <span key="g" style={{ color: "#C9973F", fontWeight: 600 }}>Gold</span>,
    "Distributor",
    "13,828.32",
    "$1,907.35",
    "+15.2%",
  ],
  [
    <span key="s" style={{ color: "#A8A9AD", fontWeight: 600 }}>Silver</span>,
    "Dealer",
    "14,934.59",
    "$2,059.94",
    "+24.5%",
  ],
  [
    <span key="r" style={{ color: "#6B8F71", fontWeight: 600 }}>Retail Global</span>,
    "End User",
    "17,921.50",
    "$2,471.93",
    "+49.3%",
  ],
];

const tierRightsRows = [
  ["Channel Pricing", "Yes", "Yes", "Yes", "Yes"],
  ["Volume Discounts", "Yes", "Yes", "Limited", "No"],
  ["Credit Terms", "Yes", "Yes", "Limited", "No"],
  ["Market Protection", "Yes", "Yes", "No", "No"],
  ["Marketing Support", "Yes", "Yes", "Limited", "No"],
  ["Technical Training", "Yes", "Yes", "Basic", "No"],
  ["Priority Production", "Yes", "Limited", "No", "No"],
];

export default function CustomerTypesPage() {
  return (
    <PolicyPage
      title="Customer Pricing"
      subtitle="How each customer level gets their price. The KOLEEX tier system determines channel pricing through sequential multipliers."
      badge="Pricing System"
    >
      {/* Tier Overview */}
      <Section title="Customer Tier Overview">
        <SectionDesc>
          Each tier applies a sequential multiplier to produce the channel price. Platinum (Agent) receives the best rate. The multiplier for each tier is applied to the tier above it, not to the Base Price.
        </SectionDesc>
        <CardGrid cols={2}>
          {tierCards.map((card) => (
            <InfoCard
              key={card.title}
              title={card.title}
              value={card.value}
              description={card.description}
              color={card.color}
            />
          ))}
        </CardGrid>
      </Section>

      {/* Pricing Ladder Flow */}
      <Section title="Pricing Ladder Flow">
        <SectionDesc>
          The channel ladder flows FROM the Base Price. Each tier is derived sequentially from the tier above.
        </SectionDesc>
        <StepFlow steps={ladderSteps} />
      </Section>

      {/* Channel Price Comparison */}
      <Section title="Channel Price Comparison -- Industrial PLC Controller (Cost 12,000 CNY)">
        <SectionDesc>
          Example pricing at each tier for a Level 2 product with exchange rate of 7.25 CNY/USD.
        </SectionDesc>
        <DataTable
          headers={comparisonHeaders}
          rows={comparisonRows}
        />
      </Section>

      {/* Tier Rights & Benefits */}
      <Section title="Tier Rights & Benefits">
        <SectionDesc>
          Higher-tier customers receive more benefits and support in exchange for greater commitment.
        </SectionDesc>
        <DataTable
          headers={[
            "Benefit",
            <span key="p" style={{ color: "#7BA1C2" }}>Platinum</span>,
            <span key="g" style={{ color: "#C9973F" }}>Gold</span>,
            <span key="s" style={{ color: "#A8A9AD" }}>Silver</span>,
            <span key="r" style={{ color: "#6B8F71" }}>Retail</span>,
          ]}
          rows={tierRightsRows}
        />
      </Section>

      {/* Key Rules */}
      <Section title="Key Rules">
        <RuleList
          rules={[
            "Platinum receives the best (lowest) price -- 3% below Base Price",
            "Each subsequent tier pays progressively more than the one above",
            "Multipliers are sequential: Gold is x1.08 of Platinum, not of Base",
            "Customer tier is determined by the commercial agreement, not by order size",
            "Tier upgrades require meeting minimum volume and commitment requirements",
            "A customer cannot see pricing for a tier higher than their own",
          ]}
        />
      </Section>

      {/* Important Note */}
      <Section>
        <Callout title="Tier vs. Real Name">
          KOLEEX uses metallic names (Platinum, Gold, Silver) internally. In customer-facing communications,
          use the real channel names: Agent, Distributor, Dealer, End User.
        </Callout>
      </Section>
    </PolicyPage>
  );
}
