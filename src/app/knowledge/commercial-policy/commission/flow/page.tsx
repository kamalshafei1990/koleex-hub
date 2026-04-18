"use client";

import PolicyPage, {
  Section,
  SectionDesc,
  CardGrid,
  InfoCard,
  DataTable,
  Callout,
  Badge,
} from "@/components/commercial-policy/PolicyPage";

/* ===== 8-Step Commission Flow ===== */
const FLOW_STEPS = [
  { step: 1, name: "Quotation", desc: "Sales creates quotation for customer", trigger: false },
  { step: 2, name: "Order", desc: "Customer confirms and places order", trigger: false },
  { step: 3, name: "Invoice", desc: "Invoice generated for the order", trigger: false },
  { step: 4, name: "Payment", desc: "Customer pays the invoice", trigger: true },
  { step: 5, name: "Commission Calculated", desc: "System auto-calculates commission", trigger: false },
  { step: 6, name: "Commission Approved", desc: "Manager approves commission", trigger: false },
  { step: 7, name: "Commission Payable", desc: "Finance marks as payable", trigger: false },
  { step: 8, name: "Commission Paid", desc: "Commission disbursed to sales person", trigger: false },
];

/* ===== Timeline Example ===== */
const TIMELINE_EVENTS = [
  { day: "Day 1", label: "Quote sent" },
  { day: "Day 5", label: "Order confirmed" },
  { day: "Day 7", label: "Invoice issued" },
  { day: "Day 21", label: "Payment received" },
  { day: "Day 22", label: "Commission calculated" },
  { day: "Day 25", label: "Manager approved" },
  { day: "Day 30", label: "Commission paid" },
];

/* ===== Status Explanations ===== */
const STATUS_CONFIG = [
  { status: "Pending", color: "#FF9500", description: "Invoice issued but payment not yet received. Commission is not yet calculated." },
  { status: "Calculated", color: "#007AFF", description: "Payment received and commission has been auto-calculated by the system." },
  { status: "Approved", color: "#34C759", description: "Commission reviewed and approved by the sales manager." },
  { status: "Payable", color: "#5856D6", description: "Finance has marked the commission as ready for disbursement." },
  { status: "Paid", color: "#1E1E20", description: "Commission has been disbursed to the sales person." },
  { status: "Cancelled", color: "#FF3B30", description: "Commission voided due to order cancellation or dispute." },
  { status: "Adjusted", color: "#FF9500", description: "Commission modified due to returns, credit notes, or corrections." },
];

export default function CommissionFlowPage() {
  return (
    <PolicyPage
      title="Commission Flow."
      subtitle="Visual walkthrough of the commission lifecycle from quotation to payout."
      badge="Commission System"
    >
      {/* 8-Step Lifecycle */}
      <Section title="8-Step Commission Lifecycle.">
        <SectionDesc>
          Every commission follows this structured path from deal creation to payout.
        </SectionDesc>
        <div className="flex flex-col gap-3">
          {FLOW_STEPS.map((step, i) => (
            <div key={step.step}>
              <div
                className="flex items-center gap-4 rounded-xl border p-4"
                style={{
                  borderColor: step.trigger ? "#007AFF" : "var(--border-subtle)",
                  background: step.trigger ? "rgba(0, 122, 255, 0.04)" : "var(--bg-card)",
                  ...(step.trigger ? { boxShadow: "0 0 0 1px rgba(0, 122, 255, 0.2)" } : {}),
                }}
              >
                {/* Step number */}
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
                  style={{
                    background: step.trigger ? "#007AFF" : "var(--bg-surface)",
                    color: step.trigger ? "#fff" : "var(--text-muted)",
                  }}
                >
                  {step.step}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[14px] font-semibold"
                      style={{ color: step.trigger ? "#007AFF" : "var(--text-primary)" }}
                    >
                      {step.name}
                    </span>
                    {step.trigger && (
                      <Badge label="TRIGGER" color="#007AFF" />
                    )}
                  </div>
                  <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-faint)" }}>
                    {step.desc}
                  </p>
                </div>
              </div>

              {/* Connector */}
              {i < FLOW_STEPS.length - 1 && (
                <div className="flex justify-center py-1">
                  <div
                    className="h-4 w-px"
                    style={{ background: step.trigger ? "rgba(0, 122, 255, 0.3)" : "var(--border-subtle)" }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Trigger Explanation */}
      <Section title="Payment is the Trigger Event.">
        <Callout title="Payment is the Trigger Event" color="#007AFF">
          Commission calculation is triggered <strong>only</strong> when the customer pays the invoice. Unpaid invoices, partial payments, and overdue invoices do not generate commission entries. Once full payment is received, the system automatically calculates the commission based on the applicable rate for the assigned sales person.
        </Callout>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge label="Auto-calculated on payment" color="#007AFF" />
          <Badge label="Based on invoice amount" color="#007AFF" />
          <Badge label="Discounts do NOT reduce commission" color="#007AFF" />
        </div>
      </Section>

      {/* Timeline Example */}
      <Section title="Real Timeline Example.">
        <SectionDesc>
          Typical commission lifecycle for an $85,000 invoice at 5% commission rate.
        </SectionDesc>
        <DataTable
          headers={["Timeline", "Event"]}
          rows={TIMELINE_EVENTS.map((evt) => [
            <span key={evt.day} className="font-semibold" style={{ color: "var(--text-primary)" }}>{evt.day}</span>,
            evt.label,
          ])}
        />
        <div className="mt-4 rounded-xl p-4" style={{ background: "var(--bg-surface-subtle)" }}>
          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            <strong>Result:</strong> $85,000 invoice x 5% = <strong>$4,250 commission</strong> paid in 30 days
          </p>
        </div>
      </Section>

      {/* Commission Statuses */}
      <Section title="Commission Statuses.">
        <SectionDesc>
          Every commission moves through these statuses during its lifecycle.
        </SectionDesc>
        <CardGrid cols={2}>
          {STATUS_CONFIG.map((s) => (
            <div
              key={s.status}
              className="flex items-start gap-3 rounded-xl p-4"
              style={{ background: "var(--bg-surface-subtle)" }}
            >
              <Badge label={s.status} color={s.color} />
              <p className="flex-1 text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {s.description}
              </p>
            </div>
          ))}
        </CardGrid>
      </Section>
    </PolicyPage>
  );
}
