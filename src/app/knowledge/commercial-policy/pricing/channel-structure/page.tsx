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
  Badge,
} from "@/components/commercial-policy/PolicyPage";

const priceLadderSteps = [
  { label: "KOLEEX Cost", description: "Original product cost in CNY (direct input)" },
  { label: "Base Price (Global FOB)", description: "KOLEEX Cost x (1 + Product Level Margin)" },
  { label: "Regional Base", description: "Base Price x (1 + Market Band) -- band is applied here, so every channel below carries it" },
  { label: "Platinum Price (Agent)", description: "Regional Base x 0.97 -- best channel price" },
  { label: "Gold Price (Distributor)", description: "Platinum x 1.08 -- distributor channel price" },
  { label: "Silver Price (Dealer)", description: "Gold x 1.08 -- dealer channel price" },
  { label: "Retail Price (End User)", description: "Silver x 1.20 -- end user price" },
];

const ladderTableRows = [
  ["1", "KOLEEX Cost", "Original product cost in CNY", "Direct input"],
  ["2", "Base Price (Global FOB)", "Cost + product level margin", "KOLEEX Cost x (1 + Margin)"],
  ["3", "Regional Base", "Market band applied to the base", "Base Price x (1 + Band)"],
  ["4", "Platinum (Agent)", "Best channel price", "Regional Base x 0.97"],
  ["5", "Gold (Distributor)", "Distributor channel price", "Platinum x 1.08"],
  ["6", "Silver (Dealer)", "Dealer channel price", "Gold x 1.08"],
  ["7", "Retail (End User)", "End user price", "Silver x 1.20"],
];

const tierCards = [
  {
    title: "Platinum (Agent)",
    value: "x 0.97",
    description: "Highest-volume channel. 3% discount from Base Price. Agents manage dealers and distributors in their territory.",
    color: "#7BA1C2",
  },
  {
    title: "Gold (Distributor)",
    value: "x 1.08",
    description: "Mid-volume channel. 8% markup on Platinum. Distributors hold stock and provide regional service.",
    color: "#C9973F",
  },
  {
    title: "Silver (Dealer)",
    value: "x 1.08",
    description: "Smaller-volume channel. 8% markup on Gold. Dealers serve local markets and end users directly.",
    color: "#A8A9AD",
  },
  {
    title: "Retail Global (End User)",
    value: "x 1.20",
    description: "End user price. 20% markup on Silver. Like every channel, it already includes the market band (baked into the base).",
    color: "#6B8F71",
  },
];

const exampleCost = 12000;
const exampleBase = 13200;
const examplePlatinum = 12804;
const exampleGold = 13828.32;
const exampleSilver = 14934.59;
const exampleRetailGlobal = 17921.50;

const exampleRows = [
  ["Base Price", "12,000 x 1.10", "13,200.00"],
  ["Platinum (Agent)", "13,200 x 0.97", "12,804.00"],
  ["Gold (Distributor)", "12,804 x 1.08", "13,828.32"],
  ["Silver (Dealer)", "13,828.32 x 1.08", "14,934.59"],
  ["Retail Global", "14,934.59 x 1.20", "17,921.50"],
];

export default function ChannelStructurePage() {
  return (
    <PolicyPage
      title="Channel Pricing Structure"
      subtitle="The KOLEEX pricing ladder from cost to retail. How each channel level gets its price through sequential multipliers."
      badge="Pricing System"
    >
      {/* Confirmed Price Ladder */}
      <Section title="Confirmed Price Ladder">
        <SectionDesc>
          The price ladder flows sequentially. Each tier builds on the previous one -- multipliers are NOT applied from the Base Price directly.
        </SectionDesc>
        <StepFlow steps={priceLadderSteps} />
      </Section>

      {/* Ladder Reference Table */}
      <Section title="Price Ladder Reference">
        <DataTable
          headers={["Step", "Price Point", "Description", "Formula"]}
          rows={ladderTableRows}
        />
      </Section>

      {/* Channel Tier Details */}
      <Section title="Channel Tier Details">
        <SectionDesc>
          Each tier represents a specific type of commercial partner in the KOLEEX distribution network.
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

      {/* Key Formulas */}
      <Section title="Key Formulas">
        <Callout title="Complete Formula Chain">
          Base Price    = KOLEEX Cost x (1 + Product Level Margin)
          {"\n\n"}Platinum      = Base Price x 0.97
          {"\n"}Gold          = Platinum x 1.08
          {"\n"}Silver        = Gold x 1.08
          {"\n"}Retail Global = Silver x 1.20
          {"\n\n"}Retail Market = Retail Global x (1 + Market Band Adjustment)
        </Callout>
      </Section>

      {/* Example Calculation */}
      <Section title="Example -- Level 2 Product (12,000 CNY)">
        <SectionDesc>
          Complete channel pricing for an Industrial PLC Controller at Level 2 (10% margin).
        </SectionDesc>
        <DataTable
          headers={["Price Point", "Formula", "CNY"]}
          rows={exampleRows}
        />
      </Section>

      {/* Important Notes */}
      <Section title="Important Notes">
        <Callout title="Sequential Multipliers" color="#FF9500">
          Multipliers are applied sequentially, not from the Base Price. Gold is 1.08x Platinum (not 1.08x Base).
          Silver is 1.08x Gold (not 1.08x Base). Retail is 1.20x Silver (not 1.20x Base).
        </Callout>
        <div style={{ marginTop: 12 }}>
          <Callout title="Retail Global vs. Retail Market">
            Global End User Price and Market End User Price are NOT the same.
            Retail Global is before market band adjustment. Retail Market includes the band multiplier.
          </Callout>
        </div>
      </Section>

      {/* Key Rules */}
      <Section title="Key Rules">
        <RuleList
          rules={[
            "Platinum receives the best (lowest) channel price",
            "Each subsequent tier pays progressively more",
            "Multipliers are sequential -- each builds on the tier above",
            "Market band adjustment is applied to the BASE, so it flows into every channel price",
            "Every channel varies by market -- an Agent in the US pays more than an Agent in Egypt",
            "Discounts are applied after the channel price is determined",
          ]}
        />
      </Section>
    </PolicyPage>
  );
}
