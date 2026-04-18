"use client";

import PolicyPage, {
  Section,
  SectionDesc,
  CardGrid,
  InfoCard,
  DataTable,
  RuleList,
  Callout,
  Badge,
} from "@/components/commercial-policy/PolicyPage";

/* ===== Commission Rules ===== */
const COMMISSION_RULES = [
  { id: "standard", name: "Standard Commission", rate: 0.03, applicableTo: "All Sales", description: "Default commission rate for all paid invoices", color: "#007AFF" },
  { id: "senior", name: "Senior Sales Rate", rate: 0.04, applicableTo: "Senior Sales", description: "Enhanced rate for senior sales personnel", color: "#FF9500" },
  { id: "lead", name: "Sales Lead Rate", rate: 0.05, applicableTo: "Sales Leads", description: "Lead rate with team override component", color: "#34C759" },
];

/* ===== Example Calculations ===== */
const EXAMPLES = [
  { invoiceAmount: 25000, rate: 0.03, tier: "Standard" },
  { invoiceAmount: 67000, rate: 0.03, tier: "Standard" },
  { invoiceAmount: 128000, rate: 0.04, tier: "Senior" },
  { invoiceAmount: 215000, rate: 0.05, tier: "Lead" },
  { invoiceAmount: 340000, rate: 0.04, tier: "Senior" },
];

const TIER_COLOR: Record<string, string> = {
  Standard: "#007AFF",
  Senior: "#FF9500",
  Lead: "#34C759",
};

/* ===== Invoice Amount Details ===== */
const INVOICE_NOTES = [
  "The total amount on the customer invoice",
  "Includes product price, quantity, and any applicable fees",
  "Discounts given to the customer do NOT reduce this amount for commission purposes",
  "Currency is converted to USD for commission calculation",
];

/* ===== Commission Rate Details ===== */
const RATE_NOTES = [
  "A percentage assigned to each sales person based on their tier",
  "Determined by seniority and role within the sales team",
  "Applied uniformly to all invoices handled by that person",
  "NOT based on product margin or cost — purely on the sales tier",
];

function formatUSD(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CommissionCalculationPage() {
  return (
    <PolicyPage
      title="How Commission is Calculated."
      subtitle="A clear breakdown of the formula, variables, and rates that determine every commission payment."
      badge="Commission System"
    >
      {/* The Formula */}
      <Section title="The Formula.">
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: "var(--bg-surface-subtle)" }}
        >
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
            The Formula
          </p>
          <p className="text-2xl font-bold tracking-tight md:text-3xl" style={{ color: "var(--text-primary)" }}>
            Commission = Invoice Amount <span style={{ color: "#007AFF" }}>&times;</span> Commission Rate
          </p>
          <p className="mt-3 text-[14px]" style={{ color: "var(--text-muted)" }}>
            This formula is applied automatically by the system for every paid invoice.
          </p>
        </div>
      </Section>

      {/* Variables Explained */}
      <Section title="Variables Explained.">
        <SectionDesc>
          Understanding the two inputs that determine your commission.
        </SectionDesc>
        <CardGrid cols={2}>
          <InfoCard title="Invoice Amount" description="The total amount on the customer invoice that serves as the commission base." color="#007AFF">
            <div className="mt-3">
              <RuleList rules={INVOICE_NOTES} />
            </div>
          </InfoCard>
          <InfoCard title="Commission Rate" description="A percentage assigned to each sales person based on their tier." color="#FF9500">
            <div className="mt-3">
              <RuleList rules={RATE_NOTES} />
            </div>
          </InfoCard>
        </CardGrid>
      </Section>

      {/* Commission Rates */}
      <Section title="Commission Rates.">
        <SectionDesc>
          Rates by sales tier as defined in KOLEEX policy.
        </SectionDesc>
        <DataTable
          headers={["Tier", "Rate", "Applies To", "Description"]}
          rows={COMMISSION_RULES.map((rule) => [
            <span key={rule.id} className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: rule.color }} />
              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{rule.name}</span>
            </span>,
            <Badge key={`${rule.id}-rate`} label={`${(rule.rate * 100).toFixed(0)}%`} color={rule.color} />,
            rule.applicableTo,
            rule.description,
          ])}
        />
      </Section>

      {/* Example Calculations */}
      <Section title="Example Calculations.">
        <SectionDesc>
          See how commission works with real numbers.
        </SectionDesc>
        <DataTable
          headers={["Invoice Amount", "Tier", "Rate", "Calculation", "Commission"]}
          rows={EXAMPLES.map((ex) => {
            const commission = ex.invoiceAmount * ex.rate;
            const color = TIER_COLOR[ex.tier] || "#007AFF";
            return [
              <span key={`inv-${ex.invoiceAmount}`} className="font-semibold" style={{ color: "var(--text-primary)" }}>
                {formatUSD(ex.invoiceAmount)}
              </span>,
              <Badge key={`tier-${ex.invoiceAmount}`} label={ex.tier} color={color} />,
              `${(ex.rate * 100).toFixed(0)}%`,
              <span key={`calc-${ex.invoiceAmount}`} className="font-mono text-[12px]">
                {formatUSD(ex.invoiceAmount)} &times; {(ex.rate * 100).toFixed(0)}%
              </span>,
              <span key={`com-${ex.invoiceAmount}`} className="font-bold" style={{ color: "#34C759" }}>
                {formatUSD(commission)}
              </span>,
            ];
          })}
        />
      </Section>

      {/* Important Notes */}
      <Section title="Important Notes.">
        <CardGrid cols={2}>
          <Callout title="Discounts do NOT reduce commission" color="#34C759">
            Even if a discount is applied to the customer price, commission is calculated on the full invoice amount. Discounts are a commercial decision that does not impact sales earnings.
          </Callout>
          <Callout title="Rate based on sales tier, not product margin" color="#FF9500">
            Your commission rate is determined by your role and seniority within the sales team. It has no connection to product cost, profit margin, or supplier pricing.
          </Callout>
        </CardGrid>
        <div className="mt-4">
          <Callout title="No commission cap" color="#007AFF">
            There is no upper limit on how much commission a sales person can earn. The more you sell and the more invoices get paid, the higher your total commission.
          </Callout>
        </div>
      </Section>
    </PolicyPage>
  );
}
