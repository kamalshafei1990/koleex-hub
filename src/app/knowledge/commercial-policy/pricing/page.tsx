"use client";

import PolicyPage, {
  Section,
  SectionDesc,
  CardGrid,
  InfoCard,
  DataTable,
  StepFlow,
  Callout,
  Badge,
} from "@/components/commercial-policy/PolicyPage";

const summaryCards = [
  { title: "Product Levels", value: "4 Levels", description: "Cost-based margin tiers (5% - 25%)", color: "#007AFF" },
  { title: "Market Bands", value: "3 + 1 Bands", description: "A (-3%), B (0%), C (+8%), D (custom)", color: "#FF9500" },
  { title: "Customer Tiers", value: "4 Tiers", description: "Platinum, Gold, Silver, Retail", color: "#34C759" },
  { title: "Price Ladder", value: "7 Steps", description: "Cost to Base to Tiers to Market", color: "#AF52DE" },
];

const priceLadder = [
  { label: "KOLEEX Cost", description: "Original product cost in CNY" },
  { label: "Base Price", description: "Cost + product level margin" },
  { label: "Platinum (Agent)", description: "Best channel price: Base Price x 0.97" },
  { label: "Gold (Distributor)", description: "Distributor price: Platinum x 1.08" },
  { label: "Silver (Dealer)", description: "Dealer price: Gold x 1.08" },
  { label: "Retail Global", description: "End user base: Silver x 1.20" },
  { label: "Retail Market", description: "Market-adjusted: Retail Global x Band factor" },
];

const productLevelRows = [
  ["L1", "Entry / Volume", "100 - 5,000 CNY", "5%", "x 1.05"],
  ["L2", "Standard Commercial", "5,001 - 20,000 CNY", "10%", "x 1.10"],
  ["L3", "Advanced / Semi-Industrial", "20,001 - 50,000 CNY", "15%", "x 1.15"],
  ["L4", "High-End / Strategic", "50,001+ CNY", "25%", "x 1.25"],
];

const customerTierRows = [
  ["Platinum", "Agent", "x 0.97", "Base Price x 0.97", "#7BA1C2"],
  ["Gold", "Distributor", "x 1.08", "Platinum x 1.08", "#C9973F"],
  ["Silver", "Dealer", "x 1.08", "Gold x 1.08", "#A8A9AD"],
  ["Retail", "End User", "x 1.20", "Silver x 1.20", "#6B8F71"],
];

const marketBandRows = [
  ["Band A", "Price Sensitive", "-3%", "0.97", "Egypt, Nigeria, Vietnam, Bangladesh"],
  ["Band B", "Balanced / Standard", "0%", "1.00", "Turkey, Brazil, Mexico, Thailand"],
  ["Band C", "Premium Markets", "+8%", "1.08", "Germany, USA, Japan, Australia, UAE"],
];

const exampleRows = [
  ["KOLEEX Cost", "Input", "12,000.00", "1,655.17"],
  ["Base Price", "12,000 x 1.10", "13,200.00", "1,820.69"],
  ["Platinum (Agent)", "13,200 x 0.97", "12,804.00", "1,766.07"],
  ["Gold (Distributor)", "12,804 x 1.08", "13,828.32", "1,907.35"],
  ["Silver (Dealer)", "13,828.32 x 1.08", "14,934.59", "2,059.94"],
  ["Retail Global", "14,934.59 x 1.20", "17,921.50", "2,471.93"],
];

export default function PricingOverviewPage() {
  return (
    <PolicyPage
      title="Pricing System"
      subtitle="Confirmed KOLEEX pricing structure -- product levels, market bands, customer tiers, and channel pricing ladder."
      badge="Pricing System"
    >
      {/* Summary */}
      <Section title="System Overview">
        <SectionDesc>
          The KOLEEX pricing system is built on four pillars: product levels that set margins, market bands
          that adjust for regional conditions, customer tiers that determine channel pricing, and a sequential
          price ladder that flows from cost to retail.
        </SectionDesc>
        <CardGrid cols={4}>
          {summaryCards.map((card) => (
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

      {/* Pricing Flow */}
      <Section title="7-Step Pricing Ladder">
        <SectionDesc>
          Every price in the system derives from this sequential flow. Each step builds on the previous one.
        </SectionDesc>
        <StepFlow steps={priceLadder} />
      </Section>

      {/* Product Levels */}
      <Section title="Product Levels (L1 - L4)">
        <SectionDesc>
          Product level is auto-detected from KOLEEX Cost (CNY). The margin determines the Base Price.
        </SectionDesc>
        <DataTable
          headers={["Level", "Name", "Cost Range", "Base Margin", "Multiplier"]}
          rows={productLevelRows}
        />
      </Section>

      {/* Customer Tiers */}
      <Section title="Customer Tiers">
        <SectionDesc>
          The channel ladder flows from the Base Price. Each tier is derived sequentially from the tier above.
          Multipliers are applied in order (not from Base Price).
        </SectionDesc>
        <DataTable
          headers={["Tier", "Real Name", "Multiplier", "Formula"]}
          rows={customerTierRows.map((r) => [
            <span key={r[0]} style={{ color: r[4], fontWeight: 600 }}>{r[0]}</span>,
            r[1],
            r[2],
            r[3],
          ])}
        />
      </Section>

      {/* Market Bands */}
      <Section title="Market Bands">
        <SectionDesc>
          Market bands adjust the final Retail Market Price only. They do not affect channel pricing.
        </SectionDesc>
        <DataTable
          headers={["Band", "Label", "Adjustment", "Factor", "Example Countries"]}
          rows={marketBandRows}
        />
      </Section>

      {/* Live Example */}
      <Section title="Example -- Level 2 Product (12,000 CNY)">
        <SectionDesc>
          Complete pricing calculation for a Level 2 product at CNY/USD rate of 7.25.
        </SectionDesc>
        <DataTable
          headers={["Step", "Formula", "CNY", "USD"]}
          rows={exampleRows}
        />
      </Section>

      {/* Key Formulas */}
      <Section title="Key Formulas">
        <Callout title="Complete Formula Chain">
          Base Price = KOLEEX Cost x (1 + Product Level Margin)
          {"\n\n"}Platinum = Base Price x 0.97
          {"\n"}Gold = Platinum x 1.08
          {"\n"}Silver = Gold x 1.08
          {"\n"}Retail Global = Silver x 1.20
          {"\n\n"}Retail Market = Retail Global x (1 + Market Band Adjustment)
        </Callout>
      </Section>

      <Section>
        <Callout title="Important" color="#FF9500">
          Global End User Price and Market End User Price are NOT the same.
          Retail Global is before market band adjustment. Retail Market includes the band multiplier.
        </Callout>
      </Section>
    </PolicyPage>
  );
}
