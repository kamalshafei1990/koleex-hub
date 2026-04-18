"use client";

import PolicyPage, {
  Section,
  SectionDesc,
  CardGrid,
  InfoCard,
  DataTable,
  RuleList,
  Callout,
  Badge,
} from "@/components/commercial-policy/PolicyPage";

const bandCards = [
  {
    title: "Band A: Price Sensitive Markets",
    value: "-3%",
    description: "Highly price sensitive, strong competition, lower margins, volume-driven. Adjustment range: -5% to -3%.",
    color: "#34C759",
  },
  {
    title: "Band B: Balanced Markets",
    value: "0%",
    description: "Balanced markets with normal margins and standard pricing. No adjustment applied. Neutral baseline.",
    color: "#007AFF",
  },
  {
    title: "Band C: Premium Markets",
    value: "+8%",
    description: "Premium markets where customers value quality and brand. Higher margins possible. Adjustment range: +5% to +8%.",
    color: "#FF9500",
  },
  {
    title: "Band D: Special / Project Markets",
    value: "Custom",
    description: "Special projects, government tenders, OEM, and strategic deals. Custom pricing. Adjustment range: -10% to +15%.",
    color: "#AF52DE",
  },
];

const bandTableRows = [
  ["Band A", "Price Sensitive", "-5% to -3%", "-3%", "0.97", "#34C759"],
  ["Band B", "Balanced", "0%", "0%", "1.00", "#007AFF"],
  ["Band C", "Premium", "+5% to +8%", "+8%", "1.08", "#FF9500"],
  ["Band D", "Special / Project", "-10% to +15%", "0%", "Varies", "#AF52DE"],
];

const countryAssignments = [
  ["Egypt", "A", "Middle East & Africa", "-3.0%"],
  ["Nigeria", "A", "Middle East & Africa", "-3.0%"],
  ["Vietnam", "A", "Asia Pacific", "-3.0%"],
  ["Bangladesh", "A", "Asia Pacific", "-3.0%"],
  ["Pakistan", "A", "Asia Pacific", "-3.0%"],
  ["Turkey", "B", "Middle East & Africa", "0.0%"],
  ["Brazil", "B", "Americas", "0.0%"],
  ["Mexico", "B", "Americas", "0.0%"],
  ["Thailand", "B", "Asia Pacific", "0.0%"],
  ["Malaysia", "B", "Asia Pacific", "0.0%"],
  ["India", "B", "Asia Pacific", "0.0%"],
  ["Saudi Arabia", "B", "Middle East & Africa", "0.0%"],
  ["Germany", "C", "Europe", "+8.0%"],
  ["United States", "C", "Americas", "+8.0%"],
  ["Japan", "C", "Asia Pacific", "+8.0%"],
  ["Australia", "C", "Asia Pacific", "+8.0%"],
  ["UAE", "C", "Middle East & Africa", "+8.0%"],
  ["United Kingdom", "C", "Europe", "+8.0%"],
  ["France", "C", "Europe", "+8.0%"],
  ["South Korea", "C", "Asia Pacific", "+8.0%"],
];

const exampleRetailGlobal = "17,921.50";
const exampleRows = [
  ["Band A (-3%)", "17,921.50 x 0.97", "17,383.86", "#34C759"],
  ["Band B (0%)", "17,921.50 x 1.00", "17,921.50", "#007AFF"],
  ["Band C (+8%)", "17,921.50 x 1.08", "19,355.22", "#FF9500"],
];

export default function MarketBandsPage() {
  return (
    <PolicyPage
      title="Market Bands"
      subtitle="Classify every country into a market band that affects pricing strategy. Market bands adjust the final Retail Market Price."
      badge="Pricing System"
    >
      {/* Band Overview */}
      <Section title="Band Overview">
        <SectionDesc>
          Market bands allow KOLEEX to adjust retail pricing for regional market conditions. Bands affect only the final Retail Market Price -- they do not change channel (Agent/Distributor/Dealer) pricing.
        </SectionDesc>
        <CardGrid cols={2}>
          {bandCards.map((card) => (
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

      {/* Band Parameters */}
      <Section title="Band Parameters">
        <DataTable
          headers={["Band", "Label", "Adjustment Range", "Default", "Factor"]}
          rows={bandTableRows.map((r) => [
            <span key={r[0]} style={{ color: r[5], fontWeight: 600 }}>{r[0]}</span>,
            r[1],
            r[2],
            r[3],
            r[4],
          ])}
        />
      </Section>

      {/* Formula */}
      <Section title="Market Band Formula">
        <Callout title="Formula">
          Retail Market Price = Retail Global Price x (1 + Market Band Adjustment)
        </Callout>
        <div style={{ marginTop: 16 }}>
          <Callout title="Important" color="#FF9500">
            Global Retail Price and Market Retail Price are NOT the same. The system always shows both values separately. Band adjustment applies only to the final retail price.
          </Callout>
        </div>
      </Section>

      {/* Example */}
      <Section title="Example: Retail Global CNY {exampleRetailGlobal}">
        <SectionDesc>
          How the same Retail Global price produces different Market prices across bands.
        </SectionDesc>
        <DataTable
          headers={["Band", "Formula", "Market Price (CNY)"]}
          rows={exampleRows.map((r) => [
            <span key={r[0]} style={{ color: r[3], fontWeight: 600 }}>{r[0]}</span>,
            r[1],
            r[2],
          ])}
        />
      </Section>

      {/* Country Assignments */}
      <Section title="Country-Band Assignments">
        <SectionDesc>
          Sample country assignments to market bands. Countries can be reassigned through the pricing management system.
        </SectionDesc>
        <DataTable
          headers={["Country", "Band", "Region", "Adjustment"]}
          rows={countryAssignments.map((r) => {
            const bandColor = r[1] === "A" ? "#34C759" : r[1] === "B" ? "#007AFF" : r[1] === "C" ? "#FF9500" : "#AF52DE";
            return [
              r[0],
              <Badge key={r[1]} label={`Band ${r[1]}`} color={bandColor} />,
              r[2],
              r[3],
            ];
          })}
        />
      </Section>

      {/* Key Rules */}
      <Section title="Key Rules">
        <RuleList
          rules={[
            "Market bands affect ONLY the Retail Market Price (not channel pricing)",
            "Band B is the neutral baseline -- no adjustment applied",
            "Band D is used for special projects and custom pricing situations",
            "Countries can be reassigned between bands as market conditions change",
            "Band adjustment is applied after all channel pricing is calculated",
            "Individual country adjustments can override band defaults within the allowed range",
          ]}
        />
      </Section>
    </PolicyPage>
  );
}
