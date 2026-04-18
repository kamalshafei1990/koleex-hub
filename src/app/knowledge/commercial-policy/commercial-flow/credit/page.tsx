"use client";

import PolicyPage, { Section, StepFlow, Callout, DataTable } from "@/components/commercial-policy/PolicyPage";

export default function CreditCheckFlowPage() {
  return (
    <PolicyPage title="Credit Check" subtitle="How credit is verified within the order process before an order can proceed." badge="Commercial Flow">
      <Section title="Credit Check in Order Flow">
        <StepFlow steps={[
          { label: "Order received", description: "Customer confirms the quotation" },
          { label: "Check customer level", description: "Determine if customer has credit access" },
          { label: "If no credit → cash required", description: "End User / Silver must pay in advance" },
          { label: "If credit → check limit", description: "Verify available credit vs order amount" },
          { label: "Check overdue status", description: "Any overdue invoices block new orders" },
          { label: "If sufficient → proceed", description: "Order confirmed on credit terms" },
          { label: "If insufficient → escalate", description: "Management approval needed to exceed limit" },
        ]} />
      </Section>

      <Section title="Credit Decision Matrix">
        <DataTable
          headers={["Condition", "Result", "Next Step"]}
          rows={[
            ["No credit access (End User/Silver)", "Cash order", "Collect payment before shipping"],
            ["Credit available, within limit", "Approved", "Order proceeds normally"],
            ["Credit available, exceeds limit", "Hold", "Management approval required"],
            ["Overdue invoices (>30 days)", "Blocked", "Must settle overdue first"],
            ["Credit on hold (>60 days overdue)", "Rejected", "Advance payment only"],
            ["Account blocked (>90 days)", "Rejected", "No orders of any kind"],
          ]}
        />
      </Section>

      <Callout>Credit check is automatic and happens before order confirmation. The system prevents orders that exceed credit limits or have overdue balances without management override.</Callout>
    </PolicyPage>
  );
}
