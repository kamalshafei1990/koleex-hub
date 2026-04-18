"use client";

import PolicyPage, {
  Section,
  SectionDesc,
  StepFlow,
  Callout,
  CardGrid,
  InfoCard,
} from "@/components/commercial-policy/PolicyPage";

const CREDIT_FLOW_STEPS = [
  { step: 1, name: "New Customer", description: "Customer registers or places first order" },
  { step: 2, name: "Cash Orders", description: "All initial orders are cash / advance payment" },
  { step: 3, name: "Purchase History", description: "System tracks total purchase lifetime" },
  { step: 4, name: "Eligible for Upgrade", description: "Customer reaches upgrade threshold" },
  { step: 5, name: "Upgrade Suggestion", description: "System suggests level upgrade" },
  { step: 6, name: "Management Approval", description: "Manager reviews and approves upgrade" },
  { step: 7, name: "Credit Evaluation", description: "Finance evaluates credit worthiness" },
  { step: 8, name: "Set Credit Limit", description: "Credit limit and days assigned" },
  { step: 9, name: "Orders on Credit", description: "Customer can order within credit limit" },
  { step: 10, name: "Invoices & Payment", description: "Invoices generated, payments tracked" },
  { step: 11, name: "Credit Update", description: "Credit utilization updated after payment" },
  { step: 12, name: "Next Upgrade", description: "Continue purchasing toward next level" },
];

const PHASE_LABELS = [
  { startStep: 1, label: "Onboarding", color: "#86868B" },
  { startStep: 4, label: "Qualification", color: "#C9973F" },
  { startStep: 6, label: "Approval", color: "#FF3B30" },
  { startStep: 8, label: "Credit Active", color: "#34C759" },
  { startStep: 11, label: "Maintenance", color: "#7BA1C2" },
];

const TIMELINE = [
  { month: "Month 1-6", event: "Cash orders only. Building purchase history.", phase: "Onboarding" },
  { month: "Month 7", event: "Reaches $500K lifetime. System suggests Gold upgrade.", phase: "Qualification" },
  { month: "Month 7-8", event: "Management reviews. Finance evaluates credit.", phase: "Approval" },
  { month: "Month 8", event: "Credit limit set: $45K avg x 3 = $135K. 90-day terms.", phase: "Credit Active" },
  { month: "Month 9+", event: "Orders on credit. Invoices tracked. Payments monitored.", phase: "Active" },
  { month: "Month 14", event: "6-month review. Credit limit adjusted based on performance.", phase: "Review" },
];

const approvalDetails = [
  { label: "What is reviewed", items: ["Payment history", "Order consistency", "Market reputation"] },
  { label: "Who approves", items: ["Regional Manager", "Finance Department", "Senior Management (Diamond)"] },
  { label: "Possible outcomes", items: ["Approved as suggested", "Approved with lower limit", "Deferred for more data"] },
];

export default function CreditFlowPage() {
  return (
    <PolicyPage
      title="Credit Flow."
      subtitle="12 steps from new customer to active credit, showing exactly how credit is earned and maintained."
      badge="Credit System"
    >
      {/* How the Journey Works */}
      <Section title="How the Credit Journey Works">
        <SectionDesc>
          Every customer follows the same path. It begins with cash orders, progresses through
          purchase history accumulation, and eventually leads to credit eligibility. The key decision
          point is Step 6: Management Approval, where a human reviews and authorizes the credit
          facility. After approval, credit is set, monitored, and reviewed on a regular cycle.
        </SectionDesc>
      </Section>

      {/* 12 Steps */}
      <Section title="The 12 Steps">
        <SectionDesc>Complete credit approval and maintenance flow.</SectionDesc>

        {/* Phase Labels + Steps */}
        <div className="space-y-6">
          {CREDIT_FLOW_STEPS.map((step) => {
            const phase = PHASE_LABELS.find((p) => p.startStep === step.step);
            const isDecision = step.step === 6;
            return (
              <div key={step.step}>
                {phase && (
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ background: phase.color }} />
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: phase.color }}
                    >
                      {phase.label}
                    </span>
                  </div>
                )}
                <div
                  className="flex items-start gap-4 rounded-xl border p-4"
                  style={{
                    borderColor: isDecision ? "#FF3B3040" : "var(--border-subtle)",
                    background: isDecision ? "#FF3B3008" : "var(--bg-card)",
                  }}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                    style={{
                      background: isDecision ? "#FF3B30" : "var(--bg-surface)",
                      color: isDecision ? "#fff" : "var(--text-muted)",
                    }}
                  >
                    {step.step}
                  </div>
                  <div>
                    <p
                      className="text-[13px] font-semibold"
                      style={{ color: isDecision ? "#FF3B30" : "var(--text-primary)" }}
                    >
                      {step.name}
                      {isDecision && (
                        <span
                          className="ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                          style={{ background: "#FF3B30" }}
                        >
                          Key Decision Point
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-faint)" }}>
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Decision Point Highlight */}
      <Callout title="Step 6 -- Management Approval" color="#FF3B30">
        This is where the system meets human judgment. When a customer reaches the upgrade threshold,
        the system suggests a level upgrade. But credit is never granted automatically. A manager must
        review the customer&apos;s history, payment behavior, market position, and risk profile before
        approving the credit facility.
      </Callout>

      <Section>
        <CardGrid cols={3}>
          {approvalDetails.map((col) => (
            <div
              key={col.label}
              className="rounded-xl border p-4"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
            >
              <p
                className="mb-2 text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-dim)" }}
              >
                {col.label}
              </p>
              <ul className="space-y-1.5">
                {col.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "#FF3B30" }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardGrid>
      </Section>

      {/* Timeline Example */}
      <Section title="Timeline Example">
        <SectionDesc>A typical customer journey from cash to credit.</SectionDesc>
        <div
          className="rounded-xl border p-5"
          style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
        >
          <div className="mb-4 flex items-center gap-3">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ background: "#C9973F" }}
            >
              G
            </div>
            <div>
              <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                Example: Silver to Gold Journey
              </p>
              <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                Ahmed Trading Co -- Egypt
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {TIMELINE.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: "var(--text-primary)" }}
                  />
                  {i < TIMELINE.length - 1 && (
                    <div className="w-px flex-1" style={{ background: "var(--border-faint)", minHeight: 20 }} />
                  )}
                </div>
                <div className="pb-2">
                  <p className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {item.month}
                  </p>
                  <p className="text-[12px]" style={{ color: "var(--text-faint)" }}>{item.event}</p>
                  <span
                    className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px]"
                    style={{ background: "var(--bg-surface)", color: "var(--text-dim)" }}
                  >
                    {item.phase}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Cycle Reminder */}
      <Callout title="The Flow is a Cycle">
        Steps 9 through 12 repeat continuously. After credit is granted, the customer orders, pays,
        and their credit updates. Every 6 months, the entire credit facility is reviewed. Consistent
        performance leads to the next level upgrade, restarting the qualification process at a higher
        tier.
      </Callout>
    </PolicyPage>
  );
}
