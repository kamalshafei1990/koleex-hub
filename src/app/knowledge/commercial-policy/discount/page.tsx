"use client";

import PolicyPage, { Section, CardGrid, InfoCard, DataTable, Callout, RuleList } from "@/components/commercial-policy/PolicyPage";

const discountTypes = [
  { name: "Standard Discount", desc: "Standard pricing adjustments within approved limits", color: "#007AFF" },
  { name: "Volume Discount", desc: "Quantity-based discounts for large orders", color: "#34C759" },
  { name: "Project Discount", desc: "Special pricing for large project orders", color: "#FF9500" },
  { name: "Competitive Discount", desc: "Matching or responding to competitor pricing", color: "#AF52DE" },
  { name: "Market Entry Discount", desc: "Reduced pricing for new market penetration", color: "#4FC3F7" },
  { name: "Promotion Discount", desc: "Time-limited promotional pricing", color: "#FF3B30" },
  { name: "Special Approval Discount", desc: "Exceptional cases requiring senior management", color: "#86868B" },
];

export default function DiscountOverviewPage() {
  return (
    <PolicyPage title="Discount System" subtitle="Rules, limits, and approval workflows that govern all pricing adjustments across KOLEEX." badge="Discount System">
      <Section title="Seven Discount Types">
        <CardGrid cols={3}>
          {discountTypes.map((d) => (
            <InfoCard key={d.name} title={d.name} description={d.desc} color={d.color} />
          ))}
        </CardGrid>
      </Section>

      <Section title="Approval Levels">
        <DataTable
          headers={["Discount Range", "Approver", "Response Time"]}
          rows={[
            ["0-3%", "Sales Person", "Immediate"],
            ["3-5%", "Sales Manager", "Same day"],
            ["5-10%", "Commercial Manager", "24 hours"],
            ["10-15%", "General Manager", "48 hours"],
            ["15%+", "CEO", "Case by case"],
          ]}
        />
      </Section>

      <Section title="Key Rules">
        <RuleList rules={[
          "All discounts must stay above minimum margin per product level",
          "Discounts above 3% require documented justification",
          "Volume discounts require confirmed purchase commitment",
          "Competitive discounts require verified competitor pricing",
          "Market entry discounts are time-limited (max 6 months)",
          "No stacking — only one discount type per order line",
          "All discount approvals are logged and auditable",
        ]} />
      </Section>

      <Callout>Discounts are a structured tool, not a negotiation lever. Every discount follows the approval chain and must protect minimum margins.</Callout>
    </PolicyPage>
  );
}
