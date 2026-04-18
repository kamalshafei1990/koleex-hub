"use client";

import PolicyPage, { Section, DataTable, Callout } from "@/components/commercial-policy/PolicyPage";

export default function ApprovalSpecialPricePage() {
  return (
    <PolicyPage title="Special Price Approval" subtitle="Approval requirements for pricing situations that fall outside the standard discount matrix." badge="Approval Authority">
      <Section title="Special Pricing Conditions">
        <DataTable
          headers={["Condition", "Approval Level", "Max Discount", "Review Period"]}
          rows={[
            ["Large Project (>$100K)", "General Manager", "12%", "Valid for project duration"],
            ["Strategic Customer", "CEO", "15%", "Annual review"],
            ["New Market Entry", "General Manager", "12%", "Max 6 months"],
            ["Government Tender", "Commercial Manager", "10%", "Per tender"],
            ["Stock Clearance", "Sales Manager", "8%", "Until stock cleared"],
            ["Annual Contract", "General Manager", "10%", "Contract term"],
            ["Turnkey Factory (>$500K)", "CEO", "20%", "Project duration"],
            ["Below Minimum Margin", "CEO", "No limit", "Case by case"],
          ]}
        />
      </Section>

      <Callout>Special pricing always requires a written business case. Verbal agreements or email-only approvals are not valid. All special pricing is audited quarterly.</Callout>
    </PolicyPage>
  );
}
