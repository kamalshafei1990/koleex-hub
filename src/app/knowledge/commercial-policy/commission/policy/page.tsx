"use client";

import PolicyPage, {
  Section,
  SectionDesc,
  CardGrid,
  InfoCard,
  RuleList,
  Callout,
} from "@/components/commercial-policy/PolicyPage";

/* ===== Key Policies with Explanations ===== */
const POLICIES = [
  { rule: "Commission is calculated on Invoice Amount", explanation: "The invoice total is the sole basis for commission. No cost data is involved in the calculation.", color: "#34C759" },
  { rule: "Commission triggers only after Invoice is Paid", explanation: "Commission is only processed after the customer completes payment on the invoice.", color: "#007AFF" },
  { rule: "Commission is paid after payment collection", explanation: "The sales person receives commission only after KOLEEX collects the payment from the customer.", color: "#007AFF" },
  { rule: "Discounts do NOT reduce commission", explanation: "If a discount was applied to the customer, the commission is still calculated on the full invoice amount.", color: "#34C759" },
  { rule: "There is NO commission cap", explanation: "There is no upper limit on commission earnings. Higher sales always mean higher earnings.", color: "#34C759" },
  { rule: "Sales users must NOT see KOLEEX Cost", explanation: "KOLEEX product costs and margins are confidential and never visible to sales personnel.", color: "#FF3B30" },
  { rule: "Commission is calculated automatically by the system", explanation: "The system computes commission automatically when payment is confirmed. No manual entry required.", color: "#5856D6" },
  { rule: "Returns or credit notes require commission adjustment", explanation: "If a return or credit note is issued, the corresponding commission is adjusted or reversed.", color: "#FF9500" },
  { rule: "Commission is linked to the responsible Sales Person", explanation: "Each commission record is tied to the specific sales person who owns the customer relationship.", color: "#007AFF" },
];

/* ===== Highlights ===== */
const HIGHLIGHTS = [
  { title: "Invoice-Based", description: "Commission is always calculated from the final invoice amount sent to the customer.", color: "#007AFF" },
  { title: "Payment-Triggered", description: "The commission process begins only after the invoice payment is confirmed.", color: "#34C759" },
  { title: "Auto-Calculated", description: "The system calculates, tracks, and manages commission end-to-end automatically.", color: "#5856D6" },
];

/* ===== Who Gets Commission ===== */
const WHO_GETS = [
  "Sales persons assigned to customer accounts",
  "Commission is linked to the person who owns the deal",
  "Only paid invoices generate commission",
  "All tiers (Standard, Senior, Lead) are eligible",
];

/* ===== When Commission Is Paid ===== */
const WHEN_PAID = [
  "After the customer pays the invoice in full",
  "System auto-calculates immediately upon payment confirmation",
  "Manager reviews and approves the calculated commission",
  "Finance marks as payable and disburses",
];

export default function CommissionPolicyPage() {
  return (
    <PolicyPage
      title="Commission Policy."
      subtitle="The definitive rules that govern how commission is calculated, triggered, and paid across KOLEEX."
      badge="Commission System"
    >
      {/* The 9 Rules */}
      <Section title="The 9 Rules.">
        <SectionDesc>
          Every commission decision follows these core principles.
        </SectionDesc>
        <div className="space-y-4">
          {POLICIES.map((p, i) => (
            <div
              key={i}
              className="flex items-start gap-4 rounded-xl border p-5"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                style={{ background: "var(--bg-inverted)", color: "var(--text-inverted)" }}
              >
                {i + 1}
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {p.rule}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--text-faint)" }}>
                  {p.explanation}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Important Highlights */}
      <Section title="Important Highlights.">
        <SectionDesc>
          The three pillars of KOLEEX commission design.
        </SectionDesc>
        <CardGrid cols={3}>
          {HIGHLIGHTS.map((h) => (
            <InfoCard key={h.title} title={h.title} description={h.description} color={h.color} />
          ))}
        </CardGrid>
      </Section>

      {/* Who Gets Commission */}
      <Section title="Who Gets Commission?">
        <RuleList rules={WHO_GETS} />
      </Section>

      {/* When Is Commission Paid */}
      <Section title="When Is Commission Paid?">
        <RuleList rules={WHEN_PAID} />
      </Section>

      {/* How Much */}
      <Section title="How Much?">
        <SectionDesc>
          Commission rates are determined by the sales person&apos;s tier within the organization.
        </SectionDesc>
        <CardGrid cols={3}>
          <InfoCard title="Standard" value="3%" description="Default rate for all sales staff" color="#007AFF" />
          <InfoCard title="Senior" value="4%" description="Enhanced rate for senior sales personnel" color="#FF9500" />
          <InfoCard title="Lead" value="5%" description="Top rate for sales leads" color="#34C759" />
        </CardGrid>
      </Section>

      {/* Warning */}
      <Callout title="Important Notice" color="#FF3B30">
        Sales users cannot see KOLEEX Cost. Commission is based on the invoice amount only. Product margins, supplier costs, and internal pricing data remain confidential and are never factored into commission calculations.
      </Callout>
    </PolicyPage>
  );
}
