"use client";

import PolicyPage, { Section, DataTable, Callout, RuleList } from "@/components/commercial-policy/PolicyPage";

const specialConditions = [
  { condition: "Large Project (>$100K)", approval: "General Manager", maxDiscount: "12%", notes: "Confirmed scope and timeline required" },
  { condition: "Strategic Customer", approval: "CEO", maxDiscount: "15%", notes: "Key account or market development" },
  { condition: "Market Entry", approval: "General Manager", maxDiscount: "12%", notes: "New country, limited to 6 months" },
  { condition: "Government Tender", approval: "Commercial Manager", maxDiscount: "10%", notes: "Formal tender documentation required" },
  { condition: "Stock Clearance", approval: "Sales Manager", maxDiscount: "8%", notes: "Obsolete or slow-moving inventory" },
  { condition: "Competitor Response", approval: "Commercial Manager", maxDiscount: "8%", notes: "Verified competitor quote required" },
  { condition: "Annual Contract", approval: "General Manager", maxDiscount: "10%", notes: "Minimum volume commitment" },
  { condition: "Turnkey Factory", approval: "CEO", maxDiscount: "20%", notes: "Complete factory solution (>$500K)" },
];

export default function SpecialPricingPage() {
  return (
    <PolicyPage title="Special Pricing" subtitle="Exception pricing for strategic situations that fall outside standard discount categories." badge="Discount System">
      <Section title="Special Pricing Conditions">
        <DataTable
          headers={["Condition", "Approval Required", "Max Discount", "Notes"]}
          rows={specialConditions.map((c) => [c.condition, c.approval, c.maxDiscount, c.notes])}
        />
      </Section>

      <Section title="Requirements for Special Pricing">
        <RuleList rules={[
          "Written business case with clear justification",
          "Projected ROI or strategic value explanation",
          "Margin impact analysis",
          "Competitor analysis (if competitive response)",
          "Timeline and scope definition (if project)",
          "Management sign-off at the appropriate level",
          "All special pricing is logged and audited quarterly",
          "Special pricing cannot become a permanent discount without policy update",
        ]} />
      </Section>

      <Callout title="Important">Special pricing is an exception, not a rule. Repeated use of special pricing for the same customer or market signals a need to review the standard pricing policy rather than continuing with exceptions.</Callout>
    </PolicyPage>
  );
}
