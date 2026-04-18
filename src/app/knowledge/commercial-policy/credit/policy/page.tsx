"use client";

import PolicyPage, {
  Section,
  SectionDesc,
  CardGrid,
  InfoCard,
  RuleList,
  Callout,
  Badge,
} from "@/components/commercial-policy/PolicyPage";

const CREDIT_PROTECTION_RULES = [
  "No credit for new customers",
  "Credit starts only after customer reaches the appropriate customer level",
  "Credit limit increases gradually based on purchase history",
  "No new orders if overdue invoices exist",
  "Orders blocked if overdue > 30 days",
  "Credit hold if overdue > 60 days",
  "Account blocked if overdue > 90 days",
  "Credit review every 6 months",
  "Diamond requires contract for open credit",
  "Management approval required if order exceeds available credit",
];

const keyPrinciples = [
  {
    title: "No Credit for New Customers",
    subtitle: "Every customer starts at cash",
    description:
      "New customers must build a purchase history before becoming eligible for credit. This protects KOLEEX from extending credit to unproven accounts and ensures that trust is earned through consistent transactions.",
    color: "#FF3B30",
  },
  {
    title: "Level-Based Access",
    subtitle: "Credit unlocks at Gold level",
    description:
      "Credit is only available starting from Gold level ($500K lifetime purchases). Silver and End User customers operate on cash or advance payment only. This ensures only proven, committed partners receive credit.",
    color: "#FF9500",
  },
  {
    title: "Automatic Review",
    subtitle: "Every 6 months",
    description:
      "All credit accounts are reviewed every 6 months. Credit limits can increase, decrease, or be suspended based on payment history, order volume, and market conditions. No credit facility is permanent.",
    color: "#007AFF",
  },
];

const exampleRulesApplied = [
  "Rule 2: Credit earned by reaching Gold level ($500K+ lifetime)",
  "Rule 3: Credit limit = Average Monthly ($45K) x 3 = $135,000",
  "Rule 8: Next review due in 6 months",
];

export default function CreditPolicyPage() {
  return (
    <PolicyPage
      title="Credit Policy."
      subtitle="10 protection rules that govern how credit is granted, maintained, and enforced across all customer levels."
      badge="Credit System"
    >
      {/* Why These Rules */}
      <Section title="Why These Rules?">
        <SectionDesc>
          Credit rules protect KOLEEX from bad debt, ensure fair treatment across all markets, and
          create a predictable framework for both sales teams and customers.
        </SectionDesc>
      </Section>

      {/* Key Principles */}
      <Section title="Key Principles">
        <SectionDesc>The three most critical credit rules every team member must know.</SectionDesc>
        <CardGrid cols={3}>
          {keyPrinciples.map((p) => (
            <InfoCard key={p.title} title={p.title} description={p.description} color={p.color}>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: p.color }}>
                {p.subtitle}
              </p>
            </InfoCard>
          ))}
        </CardGrid>
      </Section>

      {/* All 10 Rules */}
      <Section title="All 10 Protection Rules">
        <SectionDesc>Complete list of credit protection rules enforced by KOLEEX.</SectionDesc>
        <div className="space-y-3">
          {CREDIT_PROTECTION_RULES.map((rule, i) => (
            <div
              key={i}
              className="flex items-start gap-4 rounded-xl border p-4"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
            >
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}
              >
                {i + 1}
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {rule}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Diamond Warning */}
      <Section title="Diamond Level Requirements">
        <Callout title="Diamond: Contract Required" color="#00BFFF">
          Diamond customers receive open credit with annual settlement terms. This level requires a
          signed Sole Agent Agreement, a formal contract, and direct management approval. Diamond
          credit is not automatic and is reserved for strategic partners with exclusive territory
          rights.
        </Callout>
        <div className="mt-3 flex flex-wrap gap-2">
          {["Signed Contract", "Sole Agent Agreement", "Management Approval", "Territory Exclusivity"].map((req) => (
            <Badge key={req} label={req} color="#00BFFF" />
          ))}
        </div>
      </Section>

      {/* Policy in Action */}
      <Section title="Policy in Action">
        <SectionDesc>How these rules apply in a real scenario.</SectionDesc>
        <div
          className="rounded-xl border p-5"
          style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
        >
          <div className="mb-4 flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold text-white"
              style={{ background: "#C9973F" }}
            >
              G
            </div>
            <div>
              <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                Gold Customer: Ahmed Trading Co
              </p>
              <p className="text-[12px]" style={{ color: "var(--text-faint)" }}>
                Egypt -- Lifetime purchases: $720,000
              </p>
            </div>
          </div>

          <CardGrid cols={3}>
            {[
              { label: "Credit Limit", value: "$135,000", detail: "$45K avg/mo x 3 months" },
              { label: "Credit Days", value: "90 days", detail: "Standard Gold terms" },
              { label: "Current Status", value: "Active", detail: "On-time payments, low risk" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg p-3" style={{ background: "var(--bg-surface)" }}>
                <p className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                  {item.label}
                </p>
                <p className="mt-0.5 text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>
                  {item.value}
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>{item.detail}</p>
              </div>
            ))}
          </CardGrid>

          <div className="mt-4 rounded-lg p-4" style={{ background: "var(--bg-surface)" }}>
            <p className="mb-2 text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
              Rules Applied:
            </p>
            <RuleList rules={exampleRulesApplied} />
          </div>
        </div>
      </Section>
    </PolicyPage>
  );
}
