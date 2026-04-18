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

/* ===== Comparison Framework ===== */
const FRAMEWORK_CARDS = [
  {
    title: "Identify",
    description: "Map out key competitors in each market band. Know their product range, pricing strategy, and market positioning.",
    color: "#007AFF",
  },
  {
    title: "Analyze",
    description: "Compare competitor pricing at equivalent product levels. Assess value proposition differences, not just price points.",
    color: "#FF9500",
  },
  {
    title: "Respond",
    description: "Develop a measured response based on KOLEEX positioning. Avoid price wars that erode margins across the market.",
    color: "#34C759",
  },
];

/* ===== Response Strategy ===== */
const RESPONSE_STEPS = [
  { label: "Gather Intelligence", description: "Collect competitor pricing data from market sources, customer feedback, and public listings." },
  { label: "Verify Comparability", description: "Ensure products are truly comparable in specifications, quality, warranty, and support." },
  { label: "Calculate Price Gap", description: "Determine the percentage difference between KOLEEX and competitor pricing." },
  { label: "Assess Impact", description: "Evaluate the risk of losing deals versus the margin impact of price matching." },
  { label: "Select Response", description: "Choose from: hold position, value justification, targeted discount, or product bundling." },
  { label: "Seek Approval", description: "Any pricing deviation below standard requires approval per the discount authority matrix." },
];

/* ===== Response Options ===== */
const RESPONSE_TABLE = [
  ["< 5% gap", "Hold Position", "Emphasize KOLEEX quality, warranty, and support advantages", "No approval needed"],
  ["5-10% gap", "Value Justification", "Prepare detailed value comparison document for the customer", "Sales Manager"],
  ["10-15% gap", "Targeted Discount", "Request project-specific discount through approval workflow", "Pricing Manager"],
  ["15-20% gap", "Strategic Review", "Escalate to management for strategic pricing decision", "Director / VP"],
  ["> 20% gap", "Market Assessment", "Full market and competitor analysis. May indicate different market segment.", "Executive"],
];

/* ===== Comparison Principles ===== */
const PRINCIPLES = [
  "Never match competitor prices blindly without understanding value differences",
  "KOLEEX competes on total value: product quality, warranty, service, and brand trust",
  "Competitor pricing intelligence is confidential and should not be shared externally",
  "All competitive response pricing must go through the approval workflow",
  "Document all competitor pricing claims with verifiable sources",
  "Price gaps may reflect genuine value differences, not just pricing strategy",
  "Market band context matters: a 10% gap in Band A is different from Band C",
];

/* ===== Competitor Data Framework ===== */
const DATA_HEADERS = ["Data Point", "How to Collect", "Update Frequency"];
const DATA_ROWS = [
  ["List Prices", "Public catalogs, trade shows, distributor inquiries", "Quarterly"],
  ["Actual Deal Prices", "Customer feedback, lost deal analysis", "Per deal"],
  ["Product Specs", "Technical datasheets, product demos", "Semi-annual"],
  ["Warranty Terms", "Published terms, customer reports", "Annual"],
  ["Market Share", "Industry reports, trade associations", "Annual"],
  ["Service Network", "Market mapping, customer surveys", "Annual"],
];

export default function CompetitorsPage() {
  return (
    <PolicyPage
      title="Competitors."
      subtitle="Competitor price comparison framework. How to evaluate, respond to, and protect against competitive pricing."
      badge="Pricing Engine"
    >
      {/* Framework */}
      <Section title="Comparison Framework.">
        <SectionDesc>
          A structured three-step approach to handling competitor pricing in any
          market.
        </SectionDesc>
        <CardGrid cols={3}>
          {FRAMEWORK_CARDS.map((card) => (
            <InfoCard key={card.title} title={card.title} description={card.description} color={card.color} />
          ))}
        </CardGrid>
      </Section>

      {/* Response Process */}
      <Section title="Response Process.">
        <SectionDesc>
          Follow these steps when a competitive pricing situation arises.
        </SectionDesc>
        <StepFlow steps={RESPONSE_STEPS} />
      </Section>

      {/* Response Matrix */}
      <Section title="Response Matrix.">
        <SectionDesc>
          Recommended responses based on the price gap with competitors.
        </SectionDesc>
        <DataTable
          headers={["Price Gap", "Response Type", "Action", "Approval Level"]}
          rows={RESPONSE_TABLE}
        />
      </Section>

      {/* Intelligence Collection */}
      <Section title="Intelligence Collection.">
        <SectionDesc>
          Key data points to track for effective competitor analysis.
        </SectionDesc>
        <DataTable headers={DATA_HEADERS} rows={DATA_ROWS} />
      </Section>

      {/* Principles */}
      <Section title="Guiding Principles.">
        <SectionDesc>
          Core principles that guide every competitive pricing decision.
        </SectionDesc>
        <RuleList rules={PRINCIPLES} />
      </Section>

      <Callout title="Confidentiality" color="#FF3B30">
        Competitor pricing intelligence is strictly confidential. Never share
        KOLEEX internal pricing or competitor data with customers, partners,
        or external parties.
      </Callout>
    </PolicyPage>
  );
}
