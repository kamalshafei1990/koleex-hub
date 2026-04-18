"use client";

import PolicyPage, {
  Section,
  SectionDesc,
  CardGrid,
  InfoCard,
  DataTable,
  Callout,
} from "@/components/commercial-policy/PolicyPage";

const MULTIPLIERS = [
  { level: "Gold", multiplier: "3", months: "3 months", color: "#C9973F", description: "Limited credit based on 3x monthly average" },
  { level: "Platinum", multiplier: "4", months: "4 months", color: "#7BA1C2", description: "Higher credit based on 4x monthly average" },
  { level: "Diamond", multiplier: "Contract", months: "Annual", color: "#00BFFF", description: "Open credit, contract-based terms" },
];

const EXAMPLES = [
  { level: "Gold", color: "#C9973F", months: 3, avgMonthly: 30000, limit: 90000 },
  { level: "Gold", color: "#C9973F", months: 3, avgMonthly: 50000, limit: 150000 },
  { level: "Gold", color: "#C9973F", months: 3, avgMonthly: 80000, limit: 240000 },
  { level: "Platinum", color: "#7BA1C2", months: 4, avgMonthly: 100000, limit: 400000 },
  { level: "Platinum", color: "#7BA1C2", months: 4, avgMonthly: 180000, limit: 720000 },
  { level: "Platinum", color: "#7BA1C2", months: 4, avgMonthly: 300000, limit: 1200000 },
  { level: "Diamond", color: "#00BFFF", months: null, avgMonthly: null, limit: null },
];

const ADJUSTMENT_RULES = [
  { title: "Increase Triggers", description: "Consistent on-time payments, growing purchase volume, positive 6-month review.", color: "#34C759" },
  { title: "Decrease Triggers", description: "Late payments, declining volumes, overdue history, risk assessment changes.", color: "#FF9500" },
  { title: "Review Cycle", description: "Credit limits are reviewed every 6 months. Finance evaluates payment behavior and volumes.", color: "#007AFF" },
  { title: "Immediate Adjustment", description: "Severe overdue (60+ days) triggers immediate credit hold regardless of review cycle.", color: "#5856D6" },
];

const BAR_DATA = [
  { level: "End User", color: "#86868B", limit: 0 },
  { level: "Silver", color: "#A8A9AD", limit: 0 },
  { level: "Gold", color: "#C9973F", limit: 300000 },
  { level: "Platinum", color: "#7BA1C2", limit: 400000 },
  { level: "Diamond", color: "#00BFFF", limit: 1200000 },
];

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US");
}

export default function CreditLimitsPage() {
  return (
    <PolicyPage
      title="Credit Limits."
      subtitle="How credit limits are calculated, with examples at different purchase volumes."
      badge="Credit System"
    >
      {/* Formula */}
      <Section title="Credit Limit Formula">
        <div
          className="mb-4 rounded-xl p-6 text-center"
          style={{ background: "var(--bg-surface)" }}
        >
          <p className="font-mono text-[17px] font-bold" style={{ color: "var(--text-primary)" }}>
            Credit Limit = Average Monthly Purchase x Credit Months
          </p>
        </div>
        <CardGrid cols={3}>
          {MULTIPLIERS.map((m) => (
            <InfoCard key={m.level} title={m.level} description={m.description} color={m.color}>
              <p className="mt-1 text-[22px] font-bold" style={{ color: m.color }}>
                x{m.multiplier}
              </p>
            </InfoCard>
          ))}
        </CardGrid>
      </Section>

      {/* Example Calculations Table */}
      <Section title="Example Calculations">
        <SectionDesc>Credit limits at different purchase volumes.</SectionDesc>
        <DataTable
          headers={["Level", "Avg Monthly", "Multiplier", "Credit Limit"]}
          rows={EXAMPLES.map((ex) => [
            <span key="lvl" className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: ex.color }} />
              <span className="font-medium" style={{ color: "var(--text-primary)" }}>{ex.level}</span>
            </span>,
            ex.avgMonthly ? fmt(ex.avgMonthly) : "\u2014",
            ex.months ? `x ${ex.months}` : "Contract",
            <span key="limit" className="font-semibold" style={{ color: ex.color }}>
              {ex.limit ? fmt(ex.limit) : "Contract-based"}
            </span>,
          ])}
        />
      </Section>

      {/* Visual Comparison */}
      <Section title="Credit Limit at $100,000/month Average">
        <div className="space-y-3">
          {BAR_DATA.map((item) => {
            const maxBar = 1200000;
            const pct = maxBar > 0 ? (item.limit / maxBar) * 100 : 0;
            return (
              <div key={item.level}>
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                    <span className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>
                      {item.level}
                    </span>
                  </div>
                  <span className="text-[12px] font-semibold" style={{ color: item.color }}>
                    {item.limit > 0 ? fmt(item.limit) : "No Credit"}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full" style={{ background: "var(--bg-surface)" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: item.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Adjustment Rules */}
      <Section title="Limit Adjustment Rules">
        <CardGrid cols={2}>
          {ADJUSTMENT_RULES.map((rule) => (
            <InfoCard key={rule.title} title={rule.title} description={rule.description} color={rule.color} />
          ))}
        </CardGrid>
      </Section>

      {/* Important Note */}
      <Callout title="Management Approval Required" color="#007AFF">
        All credit limit assignments and adjustments require management approval. Orders that exceed
        the available credit limit must be approved by the sales manager and finance team before they
        can proceed.
      </Callout>
    </PolicyPage>
  );
}
