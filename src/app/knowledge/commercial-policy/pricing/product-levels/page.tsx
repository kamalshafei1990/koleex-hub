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

const whatCards = [
  { title: "Purpose", description: "Products are grouped into levels based on their KOLEEX cost in CNY. Each level represents a distinct pricing tier with its own margin logic.", color: "#007AFF" },
  { title: "Margin Logic", description: "Higher-cost products carry higher margins. This reflects the greater complexity, support requirements, and strategic value of premium products.", color: "#FF9500" },
  { title: "Auto-Detection", description: "The system automatically detects the product level from its cost. No manual classification needed -- pricing margins are applied instantly.", color: "#34C759" },
];

const levelCards = [
  {
    title: "Level 1: Standard",
    value: "5%",
    description: "Cost range: 100 - 5,000 CNY. Entry-level and volume products. Basic lockstitch, overlock machines, manual cutters, standard spare parts.",
    color: "#007AFF",
  },
  {
    title: "Level 2: Professional",
    value: "10%",
    description: "Cost range: 5,001 - 20,000 CNY. Standard commercial equipment. Direct-drive machines, automatic trimmers, digital pressing, industrial overlock.",
    color: "#34C759",
  },
  {
    title: "Level 3: Advanced",
    value: "15%",
    description: "Cost range: 20,001 - 50,000 CNY. Semi-industrial and advanced equipment. Programmable patterns, CNC cutters, smart systems, automatic sewing.",
    color: "#FF9500",
  },
  {
    title: "Level 4: Enterprise",
    value: "25%",
    description: "Cost range: 50,001+ CNY. High-end strategic products. Full automation lines, custom engineering, turnkey factory solutions, IoT-enabled systems.",
    color: "#AF52DE",
  },
];

const levelTableRows = [
  ["L1", "Standard", "100 - 5,000 CNY", "5%", "x 1.05", "Base = Cost x 1.05"],
  ["L2", "Professional", "5,001 - 20,000 CNY", "10%", "x 1.10", "Base = Cost x 1.10"],
  ["L3", "Advanced", "20,001 - 50,000 CNY", "15%", "x 1.15", "Base = Cost x 1.15"],
  ["L4", "Enterprise", "50,001+ CNY", "25%", "x 1.25", "Base = Cost x 1.25"],
];

const flowSteps = [
  { label: "KOLEEX Cost (CNY)", description: "The original product cost in Chinese Yuan" },
  { label: "Product Level Detection", description: "Auto-detected from cost range: L1/L2/L3/L4" },
  { label: "Margin Applied", description: "Fixed margin based on level: 5%/10%/15%/25%" },
  { label: "Global Base Price", description: "Cost USD x (1 + Product Level Margin)" },
];

const exampleRows = [
  ["Laser Cutter Module", "3,200 CNY", "L1", "5%", "3,360 CNY"],
  ["Industrial PLC Controller", "12,000 CNY", "L2", "10%", "13,200 CNY"],
  ["Programmable Sewing System", "35,000 CNY", "L3", "15%", "40,250 CNY"],
  ["Full Automation Line", "85,000 CNY", "L4", "25%", "106,250 CNY"],
];

export default function ProductLevelsPage() {
  return (
    <PolicyPage
      title="Product Levels"
      subtitle="How KOLEEX categorizes products and assigns pricing margins. The foundation of the entire pricing system."
      badge="Pricing System"
    >
      {/* What Are Product Levels */}
      <Section title="What Are Product Levels?">
        <SectionDesc>
          Product levels are the foundation of KOLEEX pricing. Every product is automatically assigned a level based on its cost, which determines the margin applied.
        </SectionDesc>
        <CardGrid cols={3}>
          {whatCards.map((card) => (
            <InfoCard
              key={card.title}
              title={card.title}
              description={card.description}
              color={card.color}
            />
          ))}
        </CardGrid>
      </Section>

      {/* The Four Levels */}
      <Section title="The Four Levels">
        <SectionDesc>
          Each level has distinct cost boundaries, margin rates, and product characteristics.
        </SectionDesc>
        <CardGrid cols={2}>
          {levelCards.map((card) => (
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

      {/* Reference Table */}
      <Section title="Product Level Reference Table">
        <DataTable
          headers={["Level", "Name", "Cost Range", "Margin", "Multiplier", "Formula"]}
          rows={levelTableRows}
        />
      </Section>

      {/* How It Fits Into Pricing */}
      <Section title="How Product Level Fits Into Pricing">
        <SectionDesc>
          Product level determines the margin, which feeds directly into the global base price calculation.
        </SectionDesc>
        <StepFlow steps={flowSteps} />
        <div style={{ marginTop: 16 }}>
          <Callout title="Formula">
            Global Base Price = (KOLEEX Cost / Exchange Rate) x (1 + Product Level Margin)
          </Callout>
        </div>
      </Section>

      {/* Product Examples */}
      <Section title="Product Examples">
        <SectionDesc>
          Example calculations for products at each level.
        </SectionDesc>
        <DataTable
          headers={["Product", "KOLEEX Cost", "Level", "Margin", "Base Price"]}
          rows={exampleRows}
        />
      </Section>

      {/* Key Rules */}
      <Section title="Key Rules">
        <RuleList
          rules={[
            "Product level is always auto-detected from the KOLEEX Cost value in CNY",
            "No manual selection or override of product levels is needed",
            "The margin is fixed per level -- it does not vary by customer or region",
            "Higher-cost products carry higher margins to reflect complexity and strategic value",
            "Level boundaries are inclusive of the minimum and maximum cost values",
          ]}
        />
      </Section>
    </PolicyPage>
  );
}
