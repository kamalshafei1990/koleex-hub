"use client";

import PolicyPage, { Section, DataTable, Callout } from "@/components/commercial-policy/PolicyPage";

export default function ApprovalDiscountPage() {
  return (
    <PolicyPage title="Discount Approval" subtitle="The complete discount approval matrix showing which approver handles each discount range." badge="Approval Authority">
      <Section title="Approval Matrix">
        <DataTable
          headers={["Discount %", "Approver", "Response Time", "Required Documentation"]}
          rows={[
            ["0-3%", "Sales Person", "Immediate", "System log — no additional docs"],
            ["3-5%", "Sales Manager", "Same day", "Written justification"],
            ["5-10%", "Commercial Manager", "24 hours", "Business case with margin analysis"],
            ["10-15%", "General Manager", "48 hours", "Full analysis + P&L impact"],
            ["15%+", "CEO", "Case by case", "Strategic proposal + board review"],
          ]}
        />
      </Section>

      <Section title="Escalation Rules">
        <DataTable
          headers={["Condition", "Action"]}
          rows={[
            ["Discount breaches minimum margin", "Auto-escalate to next level regardless of %"],
            ["Approver unavailable >24h", "Escalate to next level"],
            ["Repeat discount for same customer", "Trigger pricing review"],
            ["Discount on Diamond account", "Always requires GM minimum"],
          ]}
        />
      </Section>

      <Callout>No verbal approvals. All discount decisions must be logged in the system with the approver&apos;s identity, timestamp, and justification.</Callout>
    </PolicyPage>
  );
}
