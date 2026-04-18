"use client";

import PolicyPage, {
  Section,
  SectionDesc,
  CardGrid,
  InfoCard,
  DataTable,
  Callout,
  RuleList,
  Badge,
} from "@/components/commercial-policy/PolicyPage";

const OVERDUE_RULES = [
  { range: "0-30", days: "0-30 days", actionLabel: "Reminder / Warning", description: "Payment reminder sent. No restrictions yet.", color: "#FF9500", severity: "Low" },
  { range: "30-60", days: "30-60 days", actionLabel: "No New Orders", description: "Customer cannot place new orders until payment is received.", color: "#FF3B30", severity: "Medium" },
  { range: "60-90", days: "60-90 days", actionLabel: "Credit Hold", description: "Credit facility suspended. All orders require advance payment.", color: "#FF3B30", severity: "High" },
  { range: "90+", days: "90+ days", actionLabel: "Account Blocked", description: "Full account suspension. No transactions allowed.", color: "#1E1E20", severity: "Critical" },
  { range: "120+", days: "120+ days", actionLabel: "Legal / Collection", description: "Case escalated to legal department for debt collection.", color: "#8B0000", severity: "Maximum" },
];

const SCENARIOS = [
  {
    title: "Late Payment Warning",
    customer: "Ahmed Trading Co (Gold)",
    color: "#FF9500",
    overdue: 15,
    outstanding: 42000,
    description: "Invoice #INV-2024-1823 is 15 days past due. System sends automatic reminder. Customer can still place orders and use credit.",
    outcome: "Customer receives email & SMS reminders. Sales rep notified. No restrictions applied.",
  },
  {
    title: "Orders Blocked",
    customer: "PowerGrid SA (Gold)",
    color: "#FF3B30",
    overdue: 45,
    outstanding: 98000,
    description: "Invoice is 45 days overdue. Customer attempts to place a new $35,000 order. System blocks the order automatically.",
    outcome: "Order rejected. Customer must settle outstanding balance before placing new orders.",
  },
  {
    title: "Credit Facility Suspended",
    customer: "Sample Distributor (Platinum)",
    color: "#FF3B30",
    overdue: 72,
    outstanding: 250000,
    description: "Multiple invoices overdue totaling $250,000. Credit facility fully suspended at 72 days.",
    outcome: "All future orders require 100% advance payment. Credit limit frozen until full settlement.",
  },
  {
    title: "Legal Escalation",
    customer: "Inactive Trader LLC",
    color: "#8B0000",
    overdue: 135,
    outstanding: 180000,
    description: "Account blocked since day 90. No payment received despite multiple attempts. Case escalated at 120+ days.",
    outcome: "Legal department engaged. Collection agency involved. Customer relationship terminated.",
  },
];

const KEY_RULES = [
  "No new orders allowed if any overdue invoice exists past 30 days",
  "Credit facility auto-suspended at 60 days overdue",
  "Full account block at 90 days -- no transactions of any kind",
  "Legal collection process begins at 120 days",
  "Overdue status affects upgrade eligibility -- no upgrades while overdue",
  "Credit review triggered after any overdue event resolves",
];

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US");
}

export default function OverduePolicyPage() {
  return (
    <PolicyPage
      title="Overdue Escalation Policy."
      subtitle="Progressive escalation ladder for overdue payments. Each stage increases restrictions and consequences to protect KOLEEX credit exposure."
      badge="Credit System"
    >
      {/* Escalation Ladder */}
      <Section title="Escalation Ladder">
        <SectionDesc>Progressive consequences by overdue duration.</SectionDesc>
        <div className="space-y-3">
          {OVERDUE_RULES.map((rule, i) => (
            <div
              key={rule.range}
              className="rounded-xl border-l-4 p-5"
              style={{
                borderLeftColor: rule.color,
                background: "var(--bg-card)",
                borderTop: "1px solid var(--border-subtle)",
                borderRight: "1px solid var(--border-subtle)",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>
                      {rule.days}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>overdue</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                        {rule.actionLabel}
                      </p>
                      <Badge label={rule.severity} color={rule.color} />
                    </div>
                    <p className="mt-0.5 text-[12px] leading-relaxed" style={{ color: "var(--text-faint)" }}>
                      {rule.description}
                    </p>
                  </div>
                </div>
                {/* Severity bar */}
                <div className="w-28 shrink-0">
                  <p className="mb-1 text-right text-[10px]" style={{ color: "var(--text-faint)" }}>Severity</p>
                  <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--bg-surface)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${((i + 1) / OVERDUE_RULES.length) * 100}%`, background: rule.color }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Overdue Timeline */}
      <Section title="Overdue Timeline">
        <SectionDesc>Visual timeline from due date to legal action.</SectionDesc>
        <div className="overflow-x-auto rounded-xl border p-5" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}>
          {/* Timeline Bar */}
          <div className="flex h-12 overflow-hidden rounded-lg" style={{ background: "var(--bg-surface)" }}>
            {OVERDUE_RULES.map((rule, i) => {
              const widths = [25, 25, 25, 12.5, 12.5];
              return (
                <div
                  key={rule.range}
                  className="flex items-center justify-center text-[10px] font-semibold"
                  style={{
                    width: `${widths[i]}%`,
                    background: rule.color,
                    opacity: 0.15 + i * 0.2,
                    color: "var(--text-primary)",
                  }}
                >
                  {rule.range}
                </div>
              );
            })}
          </div>
          {/* Labels */}
          <div className="mt-2 flex">
            {OVERDUE_RULES.map((rule, i) => {
              const widths = [25, 25, 25, 12.5, 12.5];
              return (
                <div
                  key={rule.range}
                  className="text-center text-[10px] font-medium"
                  style={{ width: `${widths[i]}%`, color: "var(--text-faint)" }}
                >
                  {rule.actionLabel}
                </div>
              );
            })}
          </div>
          {/* Day Markers */}
          <div className="mt-4 flex justify-between px-1">
            {["Day 0", "Day 30", "Day 60", "Day 90", "Day 120+"].map((day) => (
              <div key={day} className="flex flex-col items-center">
                <div className="mb-1 h-2 w-2 rounded-full" style={{ background: "var(--text-dim)" }} />
                <span className="text-[10px] font-medium" style={{ color: "var(--text-faint)" }}>{day}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Real-World Scenarios */}
      <Section title="Real-World Scenarios">
        <SectionDesc>How the escalation policy works in practice.</SectionDesc>
        <CardGrid cols={2}>
          {SCENARIOS.map((s) => (
            <div
              key={s.title}
              className="rounded-xl border p-5"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
            >
              <div className="mb-3 flex items-center gap-3">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: s.color }}
                />
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {s.title}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>{s.customer}</p>
                </div>
              </div>
              <div className="mb-3 flex gap-3">
                <div className="flex-1 rounded-lg p-3 text-center" style={{ background: "var(--bg-surface)" }}>
                  <p className="text-[10px]" style={{ color: "var(--text-faint)" }}>Overdue</p>
                  <p className="text-[14px] font-bold" style={{ color: s.color }}>{s.overdue} days</p>
                </div>
                <div className="flex-1 rounded-lg p-3 text-center" style={{ background: "var(--bg-surface)" }}>
                  <p className="text-[10px]" style={{ color: "var(--text-faint)" }}>Outstanding</p>
                  <p className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>{fmt(s.outstanding)}</p>
                </div>
              </div>
              <p className="mb-3 text-[12px] leading-relaxed" style={{ color: "var(--text-faint)" }}>
                {s.description}
              </p>
              <div className="rounded-lg p-3" style={{ background: "var(--bg-surface)" }}>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>
                  Outcome
                </p>
                <p className="text-[12px]" style={{ color: "var(--text-primary)" }}>{s.outcome}</p>
              </div>
            </div>
          ))}
        </CardGrid>
      </Section>

      {/* Key Rules */}
      <Section title="Key Rules">
        <SectionDesc>Important policies governing overdue management.</SectionDesc>
        <RuleList rules={KEY_RULES} />
      </Section>
    </PolicyPage>
  );
}
