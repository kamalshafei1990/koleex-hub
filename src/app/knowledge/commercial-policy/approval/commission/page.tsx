"use client";

import PolicyPage, { Section, StepFlow, DataTable, Callout } from "@/components/commercial-policy/PolicyPage";

export default function ApprovalCommissionPage() {
  return (
    <PolicyPage title="Commission Approval" subtitle="The approval flow for commission from calculation through to payment." badge="Approval Authority">
      <Section title="Commission Approval Flow">
        <StepFlow steps={[
          { label: "Invoice Paid", description: "Customer payment triggers commission calculation" },
          { label: "System Calculates", description: "Commission auto-calculated: Invoice × Rate" },
          { label: "Sales Manager Reviews", description: "Verifies accuracy and approves commission" },
          { label: "Finance Marks Payable", description: "Finance validates and marks for payment" },
          { label: "Commission Disbursed", description: "Payment processed to sales person" },
        ]} />
      </Section>

      <Section title="Approval Responsibilities">
        <DataTable
          headers={["Role", "Responsibility"]}
          rows={[
            ["System", "Auto-calculate commission on payment confirmation"],
            ["Sales Manager", "Review and approve calculated commissions"],
            ["Finance", "Validate amounts and mark as payable"],
            ["HR/Payroll", "Process commission payment"],
          ]}
        />
      </Section>

      <Section title="Exception Handling">
        <DataTable
          headers={["Situation", "Action", "Approver"]}
          rows={[
            ["Commission on return/credit note", "Automatic adjustment", "Sales Manager"],
            ["Disputed commission amount", "Manual review", "Commercial Manager"],
            ["Commission >$10,000 single invoice", "Additional review", "General Manager"],
            ["Commission rate change request", "Policy update", "CEO"],
          ]}
        />
      </Section>

      <Callout>Commission is calculated automatically by the system. Manual intervention is only needed for exceptions, adjustments, and high-value approvals.</Callout>
    </PolicyPage>
  );
}
