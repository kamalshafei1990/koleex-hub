"use client";

import PolicyPage, { Section, StepFlow, Callout } from "@/components/commercial-policy/PolicyPage";

export default function ApprovalFlowsPage() {
  return (
    <PolicyPage title="Approval Flow Diagrams" subtitle="Visual process flows for the major approval workflows across the KOLEEX commercial system." badge="Approval Authority">
      <Section title="Discount Approval Flow">
        <StepFlow steps={[
          { label: "Sales identifies discount need" },
          { label: "Check discount % against authority" },
          { label: "If within authority → approve directly" },
          { label: "If above authority → escalate to next level" },
          { label: "Check margin impact" },
          { label: "If margin OK → proceed with approval level" },
          { label: "If margin breached → escalate regardless of %" },
          { label: "Approved → apply to quotation" },
        ]} />
      </Section>

      <Section title="Credit Approval Flow">
        <StepFlow steps={[
          { label: "Customer reaches level threshold" },
          { label: "System suggests upgrade" },
          { label: "Finance reviews creditworthiness" },
          { label: "Manager recommends" },
          { label: "Appropriate level approves" },
          { label: "Credit limit and terms assigned" },
        ]} />
      </Section>

      <Section title="Commission Approval Flow">
        <StepFlow steps={[
          { label: "Customer pays invoice" },
          { label: "System calculates commission" },
          { label: "Sales Manager approves" },
          { label: "Finance marks payable" },
          { label: "Commission disbursed" },
        ]} />
      </Section>

      <Section title="Agent/Diamond Approval Flow">
        <StepFlow steps={[
          { label: "Application/nomination received" },
          { label: "Market and partner evaluation" },
          { label: "Commercial terms drafted" },
          { label: "Regional Manager recommends" },
          { label: "General Manager reviews" },
          { label: "CEO approves (Diamond only)" },
          { label: "Contract executed" },
        ]} />
      </Section>

      <Callout>All approval flows follow the escalation principle: if a decision exceeds the current level&apos;s authority, it automatically moves to the next level. No level can bypass the chain.</Callout>
    </PolicyPage>
  );
}
