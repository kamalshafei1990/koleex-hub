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

/* ===== Partner Types ===== */
const PARTNER_TYPES = [
  {
    title: "Dealer",
    description:
      "Local market coverage with standard commercial terms and dedicated support. Ideal for focused market segments.",
    color: "#A8A9AD",
  },
  {
    title: "Distributor",
    description:
      "Regional distribution with enhanced pricing, credit terms, and inventory support. Covers wider geographic areas.",
    color: "#C9973F",
  },
  {
    title: "Agent",
    description:
      "Strategic market development with exclusive territories and full support package. KOLEEX's highest-level partners.",
    color: "#7BA1C2",
  },
];

/* ===== Partner Comparison (from mock-data) ===== */
const COMPARISON_HEADERS = ["Feature", "Dealer", "Distributor", "Agent"];

const COMPARISON_ROWS: string[][] = [
  ["Minimum Order Value", "$5,000 / order", "$25,000 / order", "Varies by territory"],
  ["Price List Access", "Dealer Price List", "Distributor Price List", "Agent Conditions"],
  ["Credit Terms", "Up to Net 30", "Up to Net 60", "Per agreement"],
  ["Territory Exclusivity", "Non-exclusive", "Semi-exclusive", "Exclusive possible"],
  ["Marketing Support", "Basic", "Enhanced", "Full support"],
  ["Performance Review", "Annual", "Semi-annual", "Quarterly"],
  ["Training Access", "Online only", "Online + On-site", "Full program"],
];

/* ===== Detailed Feature Comparison ===== */
const FEATURE_DETAILS = [
  {
    title: "Minimum Order Value",
    dealer: "$5,000 per order",
    distributor: "$25,000 per order",
    agent: "Varies by territory agreement",
  },
  {
    title: "Pricing Tier",
    dealer: "Silver (Dealer) Price",
    distributor: "Gold (Distributor) Price",
    agent: "Platinum (Agent) Price",
  },
  {
    title: "Credit Facility",
    dealer: "Standard credit assessment",
    distributor: "Extended credit with higher limits",
    agent: "Annual Agent Credit Program eligible",
  },
  {
    title: "Inventory Support",
    dealer: "Standard lead times",
    distributor: "Priority stock allocation",
    agent: "Consignment possible",
  },
  {
    title: "Technical Support",
    dealer: "Standard support channels",
    distributor: "Dedicated support contact",
    agent: "Direct product management access",
  },
];

export default function PartnerSystemPage() {
  return (
    <PolicyPage
      title="Partner System."
      subtitle="Dealer, Distributor, and Agent programs compared. Understand the commercial conditions and benefits at each partner level."
      badge="Agent System"
    >
      {/* Partner Types */}
      <Section title="Partner Types.">
        <SectionDesc>
          KOLEEX operates a three-tier partner ecosystem. Each partner type has
          clearly defined roles, responsibilities, and commercial benefits.
        </SectionDesc>
        <CardGrid cols={3}>
          {PARTNER_TYPES.map((partner) => (
            <InfoCard
              key={partner.title}
              title={partner.title}
              description={partner.description}
              color={partner.color}
            />
          ))}
        </CardGrid>
      </Section>

      {/* Partner Comparison Table */}
      <Section title="Partner Comparison.">
        <SectionDesc>
          Side-by-side comparison of key features across all partner levels.
        </SectionDesc>
        <DataTable headers={COMPARISON_HEADERS} rows={COMPARISON_ROWS} />
      </Section>

      {/* Detailed Features */}
      <Section title="Detailed Feature Breakdown.">
        <SectionDesc>
          Deeper look at commercial conditions for each partner type.
        </SectionDesc>
        <DataTable
          headers={["Feature", "Dealer", "Distributor", "Agent"]}
          rows={FEATURE_DETAILS.map((f) => [
            f.title,
            f.dealer,
            f.distributor,
            f.agent,
          ])}
        />
      </Section>

      {/* Pricing Tier Mapping */}
      <Section title="Pricing Tier Mapping.">
        <SectionDesc>
          Each partner type maps to a specific pricing tier in the KOLEEX pricing engine.
        </SectionDesc>
        <CardGrid cols={3}>
          <InfoCard
            title="Silver Tier"
            value="Dealer"
            description="Standard dealer pricing with channel multiplier of 1.08x"
            color="#A8A9AD"
          />
          <InfoCard
            title="Gold Tier"
            value="Distributor"
            description="Distributor pricing with channel multiplier of 1.08x"
            color="#C9973F"
          />
          <InfoCard
            title="Platinum Tier"
            value="Agent"
            description="Best partner pricing with channel multiplier of 0.97x"
            color="#7BA1C2"
          />
        </CardGrid>
      </Section>

      <Callout title="Balanced Ecosystem">
        Partner programs are designed to create a balanced ecosystem where each
        partner type has clearly defined roles, responsibilities, and commercial
        benefits. Detailed partner agreements specify exact terms for each
        relationship.
      </Callout>
    </PolicyPage>
  );
}
