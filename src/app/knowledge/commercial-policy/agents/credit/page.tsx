"use client";

import PolicyPage, {
  Section,
  SectionDesc,
  CardGrid,
  InfoCard,
  DataTable,
  StepFlow,
  RuleList,
  Callout,
  Badge,
} from "@/components/commercial-policy/PolicyPage";

/* ===== Program Highlights ===== */
const HIGHLIGHTS = [
  { title: "Qualification", value: "3+ years", description: "Minimum agent tenure required", color: "#34C759" },
  { title: "Program Cycle", value: "Annual", description: "January to December, quarterly reviews", color: "#007AFF" },
  { title: "Credit Range", value: "$50K - $500K", description: "Based on qualification tier and history", color: "#FF9500" },
  { title: "Security Deposit", value: "10-20%", description: "Of approved credit line, held in escrow", color: "#FF3B30" },
];

/* ===== Annual Cycle Steps ===== */
const CYCLE_STEPS = [
  { label: "Q4 - Application Window", description: "Agents apply for next year's credit program. Submit financials, business plan, and deposit." },
  { label: "Q4 - Evaluation & Approval", description: "Credit committee reviews applications and sets approved credit lines." },
  { label: "Q1 - Program Activation", description: "Approved credit lines become active. Initial quarterly targets set." },
  { label: "Q1/Q2/Q3/Q4 - Quarterly Reviews", description: "Performance against targets reviewed. Credit adjustment or suspension possible." },
  { label: "Q4 - Annual Settlement", description: "Year-end reconciliation, deposit return/adjustment, and renewal evaluation." },
];

/* ===== Credit Tiers ===== */
const CREDIT_TIERS = [
  ["Tier 1 - New Agent", "3-5 years", "$50,000", "20%", "Quarterly"],
  ["Tier 2 - Established", "5-8 years", "$150,000", "15%", "Quarterly"],
  ["Tier 3 - Senior Agent", "8-12 years", "$300,000", "12%", "Semi-annual"],
  ["Tier 4 - Strategic Partner", "12+ years", "$500,000", "10%", "Annual"],
];

/* ===== Required Documents ===== */
const REQUIRED_DOCS = [
  "Audited financial statements (last 2 years)",
  "Business plan for the program year",
  "Bank references and credit history",
  "Existing customer portfolio documentation",
  "Signed program agreement and terms",
  "Security deposit payment confirmation",
];

/* ===== FAQ Items ===== */
const FAQ_ROWS = [
  [
    "Missed quarterly targets?",
    "One missed quarter triggers a remediation plan. Two consecutive missed quarters may reduce the credit line. Three missed quarters may lead to program suspension.",
  ],
  [
    "Mid-year increase?",
    "Possible for agents consistently exceeding targets. Requires fresh credit assessment and additional deposit proportional to the increase.",
  ],
  [
    "Security deposit calculation?",
    "Typically 10-20% of approved credit line depending on credit history and tenure. First-year participants require 20%.",
  ],
  [
    "Deposit return?",
    "Security deposits are held in escrow and returned upon successful program completion at year-end settlement.",
  ],
];

export default function AgentCreditPage() {
  return (
    <PolicyPage
      title="Annual Agent Credit."
      subtitle="Comprehensive annual credit program for qualified KOLEEX agents. Funding, review cycles, risk management, and deposit requirements."
      badge="Agent System"
    >
      {/* Program Highlights */}
      <Section title="Program at a Glance.">
        <SectionDesc>
          The Annual Agent Credit Program provides qualified agents with
          structured credit facilities to support market development and growth.
        </SectionDesc>
        <CardGrid cols={4}>
          {HIGHLIGHTS.map((h) => (
            <InfoCard key={h.title} title={h.title} value={h.value} description={h.description} color={h.color} />
          ))}
        </CardGrid>
      </Section>

      {/* Annual Cycle */}
      <Section title="Annual Program Cycle.">
        <SectionDesc>
          The credit program follows a structured annual cycle with quarterly
          checkpoints for performance and risk assessment.
        </SectionDesc>
        <StepFlow steps={CYCLE_STEPS} />
      </Section>

      {/* Credit Tiers */}
      <Section title="Credit Tiers.">
        <SectionDesc>
          Credit limits and deposit requirements scale with agent tenure and
          track record.
        </SectionDesc>
        <DataTable
          headers={["Tier", "Tenure", "Max Credit Line", "Deposit", "Review Cycle"]}
          rows={CREDIT_TIERS}
        />
      </Section>

      {/* Required Documents */}
      <Section title="Application Requirements.">
        <SectionDesc>
          The following documents are required with every credit program
          application.
        </SectionDesc>
        <RuleList rules={REQUIRED_DOCS} />
      </Section>

      {/* FAQ */}
      <Section title="Frequently Asked Questions.">
        <DataTable headers={["Question", "Answer"]} rows={FAQ_ROWS} />
      </Section>

      <Callout title="Risk & Protection" color="#FF3B30">
        The annual credit program involves significant financial exposure. All
        approvals require credit committee sign-off. Security deposits are held
        in escrow and returned upon successful program completion.
      </Callout>
    </PolicyPage>
  );
}
