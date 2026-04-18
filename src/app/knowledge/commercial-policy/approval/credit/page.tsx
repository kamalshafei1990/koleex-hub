"use client";

import PolicyPage, { Section, DataTable, StepFlow, Callout } from "@/components/commercial-policy/PolicyPage";

export default function ApprovalCreditPage() {
  return (
    <PolicyPage title="Credit Approval" subtitle="Who approves credit limits, increases, and exceptions for different customer levels." badge="Approval Authority">
      <Section title="Credit Approval Matrix">
        <DataTable
          headers={["Decision", "Approver", "Requirements"]}
          rows={[
            ["Initial credit assignment (Gold)", "Commercial Manager + Finance", "Purchase history, payment record"],
            ["Credit limit increase", "General Manager", "6-month review, positive payment history"],
            ["Platinum upgrade", "General Manager + Finance", "$3M lifetime, management review"],
            ["Diamond credit (contract)", "CEO", "Sole agent contract, executive approval"],
            ["Overdue exception (allow orders)", "General Manager", "Written justification, payment plan"],
            ["Emergency credit increase", "General Manager", "Immediate business need, temp 90 days"],
          ]}
        />
      </Section>

      <Section title="Credit Approval Flow">
        <StepFlow steps={[
          { label: "System identifies credit eligibility", description: "Customer reaches required purchase threshold" },
          { label: "Finance evaluates creditworthiness", description: "Payment history, risk assessment, market check" },
          { label: "Manager reviews and recommends", description: "Regional/Sales Manager provides assessment" },
          { label: "Approver decides", description: "Based on level: Commercial Manager, GM, or CEO" },
          { label: "Credit activated in system", description: "Limit and terms set, customer notified" },
        ]} />
      </Section>

      <Callout>Credit approval always involves Finance review regardless of the approver level. No credit can be assigned without financial due diligence.</Callout>
    </PolicyPage>
  );
}
