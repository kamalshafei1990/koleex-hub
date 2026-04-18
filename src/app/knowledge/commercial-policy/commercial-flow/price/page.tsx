"use client";

import PolicyPage, { Section, StepFlow, Callout, DataTable } from "@/components/commercial-policy/PolicyPage";

export default function PriceFlowPage() {
  return (
    <PolicyPage title="Price Flow" subtitle="How a product's factory cost is transformed step-by-step into the final customer-facing price." badge="Commercial Flow">
      <Section title="Price Transformation Steps">
        <StepFlow steps={[
          { label: "Factory Cost (CNY)", description: "Raw product cost from manufacturer" },
          { label: "Internal Cost (+8%)", description: "Add warehousing, QC, packaging, admin" },
          { label: "Product Level Classification", description: "L1-L4 determines target margin range" },
          { label: "Base Global Price", description: "Cost × Target Margin = Base Price (CNY)" },
          { label: "Currency Conversion", description: "CNY → USD at reference rate (÷7.20)" },
          { label: "Market Band Adjustment", description: "Band A(×0.90), B(×0.95), C(×1.00), D(×1.05)" },
          { label: "Channel Price Ladder", description: "Sequential multipliers for each tier" },
          { label: "Customer-Level Price", description: "Final price based on customer's level" },
        ]} />
      </Section>

      <Section title="Channel Price Ladder">
        <DataTable
          headers={["Channel", "Multiplier", "Builds On"]}
          rows={[
            ["KOLEEX Cost", "Base", "Net Internal Cost"],
            ["Platinum Price", "×0.97", "KOLEEX Cost"],
            ["Gold Price", "×1.08", "Platinum Price"],
            ["Silver Price", "×1.08", "Gold Price"],
            ["Retail SRP", "×1.20", "Silver Price"],
          ]}
        />
      </Section>

      <Callout>The pricing is sequential — each channel tier multiplies the previous tier&apos;s price, not the base cost. This ensures proper margin distribution through the channel.</Callout>
    </PolicyPage>
  );
}
