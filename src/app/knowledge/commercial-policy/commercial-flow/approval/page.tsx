"use client";

import PolicyPage, { Section, DataTable, Callout } from "@/components/commercial-policy/PolicyPage";

export default function ApprovalFlowPage() {
  return (
    <PolicyPage title="Approval Flow" subtitle="When and how approvals are triggered within the commercial process." badge="Commercial Flow">
      <Section title="Approval Triggers">
        <DataTable
          headers={["Trigger", "Condition", "Approver"]}
          rows={[
            ["Discount exceeds 3%", "Any discount above standard limit", "Sales Manager+"],
            ["Margin below minimum", "Discount brings margin below floor", "GM or CEO"],
            ["Credit limit exceeded", "Order > available credit", "GM"],
            ["New credit assignment", "Customer upgrades to credit level", "Commercial Manager"],
            ["Special pricing", "Non-standard pricing condition", "Per special pricing matrix"],
            ["Agent appointment", "New agent/Diamond partnership", "GM or CEO"],
            ["Below-cost sale", "Selling at or below cost", "CEO only"],
          ]}
        />
      </Section>

      <Section title="Approval Response Times">
        <DataTable
          headers={["Level", "Approver", "Max Response Time"]}
          rows={[
            ["Level 1", "Sales Person", "Immediate"],
            ["Level 2", "Sales Manager", "Same day"],
            ["Level 3", "Commercial Manager", "24 hours"],
            ["Level 4", "Regional Manager", "48 hours"],
            ["Level 5", "General Manager", "48 hours"],
            ["Level 6", "CEO", "Case by case"],
          ]}
        />
      </Section>

      <Callout>If an approver does not respond within the SLA, the request automatically escalates to the next level. No approval request should remain pending indefinitely.</Callout>
    </PolicyPage>
  );
}
