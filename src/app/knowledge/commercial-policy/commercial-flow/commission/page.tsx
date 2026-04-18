"use client";

import PolicyPage, { Section, StepFlow, Callout, CardGrid, InfoCard } from "@/components/commercial-policy/PolicyPage";

export default function CommissionFlowPage() {
  return (
    <PolicyPage title="Commission Flow" subtitle="How commission is triggered and processed within the commercial cycle." badge="Commercial Flow">
      <Section title="Commission in the Commercial Cycle">
        <StepFlow steps={[
          { label: "Sale closed and invoiced", description: "Sales person completes the deal" },
          { label: "Customer pays invoice", description: "Payment triggers the commission process" },
          { label: "System auto-calculates", description: "Commission = Invoice Amount × Rate" },
          { label: "Manager approves", description: "Sales Manager reviews the calculation" },
          { label: "Finance processes", description: "Marks commission as payable" },
          { label: "Commission paid", description: "Disbursed to sales person" },
        ]} />
      </Section>

      <Section title="Key Commission Rules in Context">
        <CardGrid cols={3}>
          <InfoCard title="Trigger" value="Payment" description="Commission only starts after full payment" color="#34C759" />
          <InfoCard title="Basis" value="Invoice" description="Calculated on invoice amount, not margin" color="#007AFF" />
          <InfoCard title="Cap" value="None" description="No upper limit on commission earned" color="#FF9500" />
        </CardGrid>
      </Section>

      <Callout>Commission is the last step in the commercial flow. It only activates after the full cycle: Price → Discount → Margin → Credit → Approval → Invoice → Payment → Commission.</Callout>
    </PolicyPage>
  );
}
