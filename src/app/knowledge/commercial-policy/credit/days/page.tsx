"use client";

import PolicyPage, {
  Section,
  SectionDesc,
  DataTable,
  CardGrid,
  InfoCard,
  Callout,
  Badge,
} from "@/components/commercial-policy/PolicyPage";

const CREDIT_DAYS_INFO = [
  { id: "end_user", label: "End User", days: "0 days", color: "#86868B", description: "Cash or advance payment only. No credit days.", hasCredit: false },
  { id: "silver", label: "Silver", days: "0 days", color: "#A8A9AD", description: "Cash or advance payment only. No credit days.", hasCredit: false },
  { id: "gold", label: "Gold", days: "90 days", color: "#C9973F", description: "Payment due within 90 days from invoice date.", hasCredit: true },
  { id: "platinum", label: "Platinum", days: "120 days", color: "#7BA1C2", description: "Extended payment window of 120 days from invoice date.", hasCredit: true },
  { id: "diamond", label: "Diamond", days: "Annual", color: "#00BFFF", description: "Annual settlement per contract terms. Open credit facility.", hasCredit: true },
];

const EXAMPLE_TIMELINE = [
  { label: "Invoice Issued", date: "Jan 15, 2026", color: "#007AFF" },
  { label: "Due Date", date: "Apr 15, 2026", color: "#C9973F" },
  { label: "Grace Period", date: "Apr 15 - May 15", color: "#FF9500" },
  { label: "Overdue Starts", date: "After May 15", color: "#FF3B30" },
];

export default function CreditDaysPage() {
  return (
    <PolicyPage
      title="Credit Days."
      subtitle="Understand the payment window for each customer level and how credit days work."
      badge="Credit System"
    >
      {/* What Are Credit Days */}
      <Section title="What are Credit Days?">
        <SectionDesc>
          Credit days define the number of days a customer has to pay an invoice after it is issued.
          The payment window varies by customer level. Customers who exceed their credit days enter
          the overdue escalation process, which can lead to order blocks, credit holds, and account
          suspension.
        </SectionDesc>
      </Section>

      {/* Level Cards */}
      <Section title="Credit Days by Level">
        <div className="space-y-3">
          {CREDIT_DAYS_INFO.map((info) => (
            <div
              key={info.id}
              className="flex items-center justify-between rounded-xl border p-4"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: `${info.color}15` }}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: info.color }} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {info.label}
                  </p>
                  <p className="text-[12px]" style={{ color: "var(--text-faint)" }}>
                    {info.description}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-[18px] font-bold" style={{ color: info.color }}>
                {info.days}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* Example: Gold Customer */}
      <Section title="Example: Gold Customer (90 Days)">
        <CardGrid cols={4}>
          {EXAMPLE_TIMELINE.map((step) => (
            <div
              key={step.label}
              className="rounded-xl border p-4 text-center"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
            >
              <div
                className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: `${step.color}15` }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: step.color }} />
              </div>
              <p className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
                {step.label}
              </p>
              <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>{step.date}</p>
            </div>
          ))}
        </CardGrid>
      </Section>

      {/* Summary Table */}
      <Section title="Credit Days Summary">
        <DataTable
          headers={["Level", "Credit Days", "Payment Type", "Credit Access"]}
          rows={CREDIT_DAYS_INFO.map((info) => [
            <span key="lvl" className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: info.color }} />
              <span className="font-medium" style={{ color: "var(--text-primary)" }}>{info.label}</span>
            </span>,
            <span key="days" className="font-semibold" style={{ color: info.color }}>
              {info.days}
            </span>,
            info.hasCredit ? "Credit Terms" : "Cash / Advance",
            info.hasCredit ? (
              <Badge key="yes" label="Eligible" color="#34C759" />
            ) : (
              <Badge key="no" label="No Credit" color="#FF3B30" />
            ),
          ])}
        />
      </Section>

      {/* Callout */}
      <Callout title="Important">
        Exceeding credit days triggers the overdue escalation process. Customers should always aim to
        pay before the due date to maintain a good credit standing and avoid restrictions.
      </Callout>
    </PolicyPage>
  );
}
