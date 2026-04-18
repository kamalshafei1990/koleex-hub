"use client";

import PolicyPage, { Section, StepFlow, RuleList, Callout, CardGrid, InfoCard } from "@/components/commercial-policy/PolicyPage";

export default function ApprovalDiamondPage() {
  return (
    <PolicyPage title="Diamond / Agent Approval" subtitle="The 7-step process for approving Diamond-level sole agent partnerships — the highest level of commercial relationship." badge="Approval Authority">
      <Section title="7-Step Diamond Approval Process">
        <StepFlow steps={[
          { label: "Application Received", description: "Potential partner submits sole agent application" },
          { label: "Market Assessment", description: "Evaluate market size, competition, and strategic fit" },
          { label: "Partner Evaluation", description: "Review financial stability, industry experience, network" },
          { label: "Commercial Terms Proposal", description: "Draft exclusive territory, pricing, credit terms" },
          { label: "Management Review", description: "General Manager reviews and recommends" },
          { label: "CEO Approval", description: "Final approval at executive level" },
          { label: "Contract Execution", description: "Formal sole agent agreement signed" },
        ]} />
      </Section>

      <Section title="Diamond Requirements">
        <CardGrid cols={2}>
          <InfoCard title="Formal Contract" description="Signed sole agent agreement with clear terms" color="#4FC3F7" />
          <InfoCard title="Territory Exclusivity" description="Exclusive market rights within defined territory" color="#007AFF" />
          <InfoCard title="Minimum Volume Commitment" description="Annual purchase targets agreed in contract" color="#34C759" />
          <InfoCard title="Full Service Capability" description="Sales, service, parts, training infrastructure" color="#FF9500" />
        </CardGrid>
      </Section>

      <Section title="Diamond Benefits">
        <RuleList rules={[
          "Best pricing tier — contract-based pricing",
          "Open credit with annual settlement terms",
          "Exclusive territory — KOLEEX will not sell to others in the market",
          "Priority production and delivery",
          "Strategic/VIP support from KOLEEX team",
          "Marketing co-investment and brand support",
          "Full discount access as per contract",
          "Quarterly business reviews with management",
        ]} />
      </Section>

      <Callout title="Key Point">Diamond is the only level that requires CEO approval. It represents a strategic long-term investment by both KOLEEX and the partner. Volume alone does not qualify — strategic alignment, service capability, and market commitment are equally important.</Callout>
    </PolicyPage>
  );
}
