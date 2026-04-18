"use client";

import PolicyPage, {
  Section,
  SectionDesc,
  CardGrid,
  InfoCard,
  DataTable,
  RuleList,
  Callout,
  Badge,
} from "@/components/commercial-policy/PolicyPage";

/* ===== Agent Types ===== */
const AGENT_TYPES = [
  {
    name: "Diamond / Sole Agent",
    territory: "Exclusive",
    description:
      "Highest-level strategic partner with exclusive territory rights. Full commercial support package, annual credit program eligibility, and direct access to KOLEEX leadership.",
    color: "#00BFFF",
  },
  {
    name: "Regional Agent",
    territory: "Semi-Exclusive",
    description:
      "Primary market representative with semi-exclusive territory. KOLEEX may serve select key accounts directly but the agent remains the principal channel.",
    color: "#7BA1C2",
  },
  {
    name: "Market Agent",
    territory: "Non-Exclusive",
    description:
      "Operates alongside other agents or channels in larger markets. Focused on specific segments or product lines within the territory.",
    color: "#A8A9AD",
  },
];

/* ===== Territory Rules ===== */
const TERRITORY_RULES = [
  {
    type: "Exclusive",
    description:
      "Agent is the sole authorized representative in the territory. KOLEEX commits to not appointing competing agents.",
    color: "#34C759",
  },
  {
    type: "Semi-Exclusive",
    description:
      "Agent has primary responsibility but KOLEEX may serve key accounts directly or through other channels.",
    color: "#FF9500",
  },
  {
    type: "Non-Exclusive",
    description:
      "Agent operates alongside other agents or channels in the same territory. Typically for large markets.",
    color: "#007AFF",
  },
];

/* ===== Agent Rights ===== */
const AGENT_RIGHTS = [
  "Exclusive or semi-exclusive territory assignment",
  "Preferential pricing conditions",
  "Priority technical and commercial support",
  "Marketing co-investment programs",
  "Annual credit program eligibility",
  "Direct access to product management team",
];

/* ===== Agent Obligations ===== */
const AGENT_OBLIGATIONS = [
  "Minimum annual purchase commitment",
  "Service capability and response time SLAs",
  "Market development and reporting requirements",
  "Brand representation standards",
  "Customer satisfaction targets",
  "Quarterly business review participation",
];

/* ===== Qualification Criteria ===== */
const QUALIFICATION_ROWS = [
  ["Minimum Tenure", "3+ years active relationship", "All agent types"],
  ["Annual Volume", "$250K+ annual purchases", "Diamond / Sole Agent"],
  ["Market Coverage", "Proven distribution network", "Regional & Diamond"],
  ["Service Capability", "Dedicated service team", "All agent types"],
  ["Financial Standing", "Audited financials required", "Diamond / Sole Agent"],
  ["Brand Alignment", "No competing product lines", "Exclusive territories"],
];

export default function AgentOverviewPage() {
  return (
    <PolicyPage
      title="Agent System."
      subtitle="KOLEEX's strategic market representatives. Agent program structure, territory rules, qualification conditions, and obligations."
      badge="Agent System"
    >
      {/* What is the Agent System */}
      <Section title="What is the Agent System?">
        <SectionDesc>
          Agents are KOLEEX&apos;s strategic market representatives. They operate as
          independent businesses with exclusive or semi-exclusive territory rights,
          representing KOLEEX in their markets with full commercial authority.
          The Diamond / Sole Agent is the highest level with exclusive territory.
        </SectionDesc>
        <CardGrid cols={3}>
          {AGENT_TYPES.map((agent) => (
            <InfoCard
              key={agent.name}
              title={agent.name}
              description={agent.description}
              color={agent.color}
            >
              <div className="mt-2">
                <Badge label={agent.territory} color={agent.color} />
              </div>
            </InfoCard>
          ))}
        </CardGrid>
      </Section>

      {/* Territory Rules */}
      <Section title="Territory Rules.">
        <SectionDesc>
          Territory assignments define the geographic scope and exclusivity of an
          agent&apos;s market responsibility.
        </SectionDesc>
        <CardGrid cols={3}>
          {TERRITORY_RULES.map((rule) => (
            <InfoCard
              key={rule.type}
              title={rule.type}
              description={rule.description}
              color={rule.color}
            />
          ))}
        </CardGrid>
      </Section>

      {/* Agent Rights */}
      <Section title="Agent Rights.">
        <SectionDesc>
          Every qualified agent is entitled to these commercial rights and support
          packages.
        </SectionDesc>
        <RuleList rules={AGENT_RIGHTS} />
      </Section>

      {/* Agent Obligations */}
      <Section title="Agent Obligations.">
        <SectionDesc>
          Agents must meet these ongoing obligations to maintain their status and
          territory assignment.
        </SectionDesc>
        <RuleList rules={AGENT_OBLIGATIONS} />
      </Section>

      {/* Qualification Criteria */}
      <Section title="Qualification Criteria.">
        <SectionDesc>
          Minimum requirements to qualify for each agent type.
        </SectionDesc>
        <DataTable
          headers={["Criterion", "Requirement", "Applies To"]}
          rows={QUALIFICATION_ROWS}
        />
      </Section>

      <Callout title="Agent Credit Program">
        Qualified agents (3+ years tenure) are eligible for the Annual Agent
        Credit Program with credit lines from $50K to $500K. See the dedicated
        Annual Agent Credit section for full details.
      </Callout>
    </PolicyPage>
  );
}
