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

/* ===== Commission Rules ===== */
const COMMISSION_RULES = [
  { tier: "Standard", rate: "3%", applicableTo: "All Sales", description: "Default commission rate for all paid invoices", color: "#007AFF" },
  { tier: "Senior", rate: "4%", applicableTo: "Senior Sales", description: "Enhanced rate for senior sales personnel", color: "#FF9500" },
  { tier: "Lead", rate: "5%", applicableTo: "Sales Leads", description: "Lead rate with team override component", color: "#34C759" },
];

/* ===== Key Policies ===== */
const KEY_POLICIES = [
  "Commission is calculated on Invoice Amount",
  "Commission triggers only after Invoice is Paid",
  "Commission is paid after payment collection",
  "Discounts do NOT reduce commission",
  "There is NO commission cap",
  "Sales users must NOT see KOLEEX Cost",
  "Commission is calculated automatically by the system",
  "Returns or credit notes require commission adjustment",
  "Commission is linked to the responsible Sales Person",
];

/* ===== How It Works ===== */
const HOW_STEPS = [
  { label: "Sell", description: "Close a deal and generate an invoice for the customer" },
  { label: "Get Paid", description: "Customer pays the invoice in full — this triggers the process" },
  { label: "Earn Commission", description: "Commission is auto-calculated on the paid amount at your rate" },
];

/* ===== Summary Metrics ===== */
const METRICS = [
  { label: "Total Invoiced", value: "$1,258,000.00", color: "#007AFF" },
  { label: "Commission Earned", value: "$37,750.00", color: "#34C759" },
  { label: "Average Rate", value: "4.3%", color: "#FF9500" },
  { label: "Records", value: "10", color: "#5856D6" },
];

/* ===== What is Commission ===== */
const WHAT_CARDS = [
  { title: "Motivation", description: "Commission directly ties earnings to effort. The more you sell, the more you earn — creating a powerful incentive to close deals and exceed targets.", color: "#007AFF" },
  { title: "Revenue Growth", description: "By rewarding sales performance, KOLEEX accelerates revenue growth. Commission aligns individual goals with company objectives for mutual success.", color: "#34C759" },
  { title: "Pricing Protection", description: "Commission is based on invoice amount — not margin. This protects KOLEEX cost visibility while ensuring fair and transparent compensation for every sale.", color: "#FF9500" },
];

export default function CommissionOverviewPage() {
  return (
    <PolicyPage
      title="Commission System."
      subtitle="Motivating sales excellence and rewarding performance through a transparent, automated commission structure."
      badge="Commission System"
    >
      {/* What is Commission */}
      <Section title="What is Commission?">
        <SectionDesc>
          Commission is the percentage of every paid invoice that goes directly to the sales person responsible for the deal.
        </SectionDesc>
        <CardGrid cols={3}>
          {WHAT_CARDS.map((card) => (
            <InfoCard key={card.title} title={card.title} description={card.description} color={card.color} />
          ))}
        </CardGrid>
      </Section>

      {/* Commission Rates */}
      <Section title="Commission Rates.">
        <SectionDesc>
          Three tiers define commission rates across the sales organization.
        </SectionDesc>
        <CardGrid cols={3}>
          {COMMISSION_RULES.map((rule) => (
            <InfoCard key={rule.tier} title={rule.tier} value={rule.rate} description={rule.description} color={rule.color}>
              <p className="mt-1 text-[11px] font-semibold" style={{ color: "var(--text-dim)" }}>
                {rule.applicableTo}
              </p>
            </InfoCard>
          ))}
        </CardGrid>
      </Section>

      {/* How It Works */}
      <Section title="How It Works.">
        <SectionDesc>
          Three simple steps from sale to earning your commission.
        </SectionDesc>
        <StepFlow steps={HOW_STEPS} />
      </Section>

      {/* Key Policies */}
      <Section title="Key Policies.">
        <SectionDesc>
          The 9 core rules governing every commission decision at KOLEEX.
        </SectionDesc>
        <div className="space-y-3">
          {KEY_POLICIES.map((policy, i) => (
            <div
              key={i}
              className="flex items-start gap-4 rounded-xl p-4"
              style={{ background: "var(--bg-surface-subtle)" }}
            >
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                style={{ background: "var(--bg-inverted)", color: "var(--text-inverted)" }}
              >
                {i + 1}
              </div>
              <p className="pt-0.5 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
                {policy}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Summary Metrics */}
      <Section title="Key Stats.">
        <SectionDesc>
          Current commission performance at a glance.
        </SectionDesc>
        <CardGrid cols={4}>
          {METRICS.map((m) => (
            <InfoCard key={m.label} title={m.label} value={m.value} color={m.color} />
          ))}
        </CardGrid>
      </Section>

      {/* Rate Table */}
      <Section title="Rate Table.">
        <DataTable
          headers={["Tier", "Rate", "Applies To", "Description"]}
          rows={COMMISSION_RULES.map((r) => [
            r.tier,
            <Badge key={r.tier} label={r.rate} color={r.color} />,
            r.applicableTo,
            r.description,
          ])}
        />
      </Section>

      <Callout title="Important">
        Sales users cannot see KOLEEX Cost. Commission is based on the invoice amount only. Product margins, supplier costs, and internal pricing data remain confidential.
      </Callout>
    </PolicyPage>
  );
}
