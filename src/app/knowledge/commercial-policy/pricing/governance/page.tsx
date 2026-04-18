"use client";

import PolicyPage, { Section, DataTable, Callout, RuleList, CardGrid, InfoCard } from "@/components/commercial-policy/PolicyPage";

export default function PricingGovernancePage() {
  return (
    <PolicyPage title="Pricing Governance" subtitle="Rules about who can set prices, change pricing parameters, and approve exceptions to ensure pricing integrity across the organization." badge="Pricing System">
      <Section title="Who Controls Pricing">
        <DataTable
          headers={["Function", "Authority", "Scope"]}
          rows={[
            ["Set base prices", "Pricing Team", "Product levels, base margins"],
            ["Adjust market bands", "Export Manager", "Country band assignments"],
            ["Approve discounts 0-3%", "Sales Person", "Within standard limits"],
            ["Approve discounts 3-5%", "Sales Manager", "Team-level decisions"],
            ["Approve discounts 5-10%", "Commercial Manager", "Regional decisions"],
            ["Approve discounts 10-15%", "General Manager", "Strategic decisions"],
            ["Approve discounts 15%+", "CEO", "Exceptional cases only"],
            ["Change FX rates", "Finance", "Quarterly review"],
            ["Override minimum margin", "Senior Management", "Case-by-case basis"],
          ]}
        />
      </Section>

      <Section title="Pricing Rules">
        <RuleList rules={[
          "No one can sell below minimum margin without management approval",
          "Price lists are updated quarterly — mid-quarter changes require approval",
          "Customer-specific pricing must be documented and approved",
          "Verbal price commitments are not binding — only system quotations are valid",
          "Competitor pricing claims must be verified before matching",
          "Volume discounts follow the discount policy — no ad-hoc volume pricing",
          "All pricing exceptions are logged and audited quarterly",
        ]} />
      </Section>

      <Section title="Price Protection">
        <CardGrid cols={3}>
          <InfoCard title="Minimum Margins" description="L1: 2%, L2: 5%, L3: 8%, L4: 15% — never breached without approval" color="#FF3B30" />
          <InfoCard title="Territory Protection" description="Partners cannot sell outside their territory at lower prices" color="#007AFF" />
          <InfoCard title="Channel Protection" description="Each tier must maintain the pricing ladder — no undercutting" color="#34C759" />
        </CardGrid>
      </Section>

      <Callout title="Key Principle">Pricing is a policy, not a negotiation. Every price follows the formula. Every exception follows the approval process. There are no shortcuts.</Callout>
    </PolicyPage>
  );
}
