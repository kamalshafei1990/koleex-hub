"use client";

import PolicyPage, {
  Section,
  SectionDesc,
  CardGrid,
  InfoCard,
  DataTable,
  StepFlow,
  Callout,
  Badge,
} from "@/components/commercial-policy/PolicyPage";

/* ===== Scenarios ===== */
const SCENARIOS = [
  {
    id: "S1",
    title: "New Market Entry",
    description: "Entering a new market with no existing customer base. Need competitive introductory pricing without setting unsustainable precedents.",
    approach: "Use Band A pricing with introductory discounts of up to 10%. Set volume commitments for the first year. Review after 12 months and adjust band assignment.",
    approval: "Pricing Manager + Regional Director",
    risk: "Medium",
    color: "#007AFF",
  },
  {
    id: "S2",
    title: "Volume Deal",
    description: "Large single order or annual contract with significant volume commitment from an existing customer.",
    approach: "Apply volume discount per the discount matrix. L1-L2 products: up to 15% on 50+ units. L3-L4: up to 10% on 20+ units. Ensure minimum margin is maintained.",
    approval: "Sales Manager (up to 10%), Pricing Manager (10-15%)",
    risk: "Low",
    color: "#34C759",
  },
  {
    id: "S3",
    title: "Competitive Response",
    description: "Customer presents a lower-priced competitor quote for an equivalent product. Must decide whether to match, counter, or hold position.",
    approach: "Verify comparability of products. If gap < 5%, hold position with value justification. If 5-15%, targeted discount via approval. If > 15%, strategic review required.",
    approval: "Per Competitor Response Matrix",
    risk: "Medium",
    color: "#FF9500",
  },
  {
    id: "S4",
    title: "Partner Tier Upgrade",
    description: "A Silver (Dealer) partner has consistently exceeded performance targets and requests Gold (Distributor) pricing.",
    approach: "Review 4 consecutive quarters of performance data. Confirm minimum order value threshold ($25K+). Process tier upgrade through the partner system with new commercial terms.",
    approval: "Sales Manager + Partner Committee",
    risk: "Low",
    color: "#5856D6",
  },
  {
    id: "S5",
    title: "Government / Tender",
    description: "Public sector or government tender requiring special pricing, compliance documentation, and potentially extended payment terms.",
    approach: "Classify as Band D (Special/Project). Custom pricing with full landed cost analysis. Extended Net 90 payment terms may apply. Require formal PO and compliance docs.",
    approval: "Finance + Director approval required",
    risk: "High",
    color: "#FF3B30",
  },
  {
    id: "S6",
    title: "Credit Exception",
    description: "A new high-potential customer requests credit terms before establishing purchase history.",
    approach: "Offer limited trial credit: Net 30 on first 3 orders with $10K limit. Require trade references and bank guarantee. Automatic review after 3 months for standard credit assessment.",
    approval: "Finance Manager + Credit Committee",
    risk: "High",
    color: "#AF52DE",
  },
];

/* ===== Scenario Comparison ===== */
const COMPARISON_ROWS = SCENARIOS.map((s) => [
  s.id,
  s.title,
  <Badge key={s.id} label={s.risk} color={s.risk === "Low" ? "#34C759" : s.risk === "Medium" ? "#FF9500" : "#FF3B30"} />,
  s.approval,
]);

export default function ScenarioLibraryPage() {
  return (
    <PolicyPage
      title="Scenario Library."
      subtitle="Pre-built pricing scenarios for common commercial situations. Reference guides for handling real-world pricing decisions."
      badge="Pricing Engine"
    >
      {/* Overview */}
      <Section title="Scenarios.">
        <SectionDesc>
          Each scenario provides a structured approach to a common pricing
          situation, including the recommended action and required approval level.
        </SectionDesc>
        <div className="space-y-6">
          {SCENARIOS.map((scenario) => (
            <div
              key={scenario.id}
              className="rounded-xl border p-6"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold text-white"
                    style={{ background: scenario.color }}
                  >
                    {scenario.id}
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
                      {scenario.title}
                    </h3>
                  </div>
                </div>
                <Badge label={`Risk: ${scenario.risk}`} color={scenario.risk === "Low" ? "#34C759" : scenario.risk === "Medium" ? "#FF9500" : "#FF3B30"} />
              </div>

              <div className="mb-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>
                  Situation
                </p>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {scenario.description}
                </p>
              </div>

              <div
                className="mb-3 rounded-lg p-3"
                style={{ background: "var(--bg-surface-subtle)" }}
              >
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: scenario.color }}>
                  Recommended Approach
                </p>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {scenario.approach}
                </p>
              </div>

              <p className="text-[12px]" style={{ color: "var(--text-faint)" }}>
                <span className="font-semibold">Approval:</span> {scenario.approval}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Summary Table */}
      <Section title="Summary.">
        <SectionDesc>
          Quick comparison of all scenarios with risk levels and approval
          requirements.
        </SectionDesc>
        <DataTable
          headers={["ID", "Scenario", "Risk", "Approval Required"]}
          rows={COMPARISON_ROWS}
        />
      </Section>

      <Callout title="Living Document">
        This scenario library is updated as new situations arise. If you
        encounter a pricing situation not covered here, escalate to the Pricing
        Manager and it will be added to the library.
      </Callout>
    </PolicyPage>
  );
}
