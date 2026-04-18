"use client";

import PolicyPage, { Section, SectionDesc, CardGrid, StepFlow, Callout } from "@/components/commercial-policy/PolicyPage";

/* ── data ── */
const purposeItems = [
  { num: "01", title: "Unified global pricing structure", desc: "One consistent pricing framework across all markets and channels." },
  { num: "02", title: "Protect profit margins", desc: "Ensure every transaction meets minimum profitability thresholds." },
  { num: "03", title: "Prevent price dumping", desc: "Eliminate cross-market conflicts and unauthorized discounting." },
  { num: "04", title: "Standardize discounts and approvals", desc: "Clear limits and escalation paths for every discount request." },
  { num: "05", title: "Define commission rules", desc: "Transparent, formula-based compensation for sales and agents." },
  { num: "06", title: "Control credit risk", desc: "Structured credit limits tied to customer level and history." },
  { num: "07", title: "Define agent and distributor system", desc: "Rights, obligations, and territory protection for all partners." },
  { num: "08", title: "Support global expansion", desc: "Scalable commercial framework for entering new markets." },
  { num: "09", title: "Maintain brand positioning", desc: "Pricing discipline that reinforces Koleex market position." },
  { num: "10", title: "Structured commercial decisions", desc: "Rules-based system replacing ad-hoc negotiation." },
];

const audienceRoles = [
  { role: "Salespersons", desc: "Pricing rules, discount limits, and quotation procedures." },
  { role: "Sales Managers", desc: "Team pricing decisions and commercial exception approvals." },
  { role: "Export Managers", desc: "Market bands, territory rules, and international pricing." },
  { role: "Finance", desc: "Credit policy, payment terms, and commission calculations." },
  { role: "Pricing Team", desc: "Product levels, margins, and pricing formula configuration." },
  { role: "Agents", desc: "Agent rights, obligations, and Diamond program details." },
  { role: "Distributors", desc: "Ordering flow, credit terms, and partner benefits." },
  { role: "Senior Management", desc: "Approval authority and strategic commercial decisions." },
  { role: "New Employees", desc: "Complete overview of how Koleex does business." },
];

const principles = [
  { title: "Pricing is a Policy, Not a Negotiation", desc: "Prices are built from cost structure and strategy, not from individual negotiation pressure." },
  { title: "Margin Protection is Mandatory", desc: "Every transaction must maintain minimum margin thresholds. No exceptions without approval." },
  { title: "Credit is a Privilege, Not a Right", desc: "Credit access is earned through purchase history and payment discipline." },
  { title: "Agents Are Long-Term Partners", desc: "Agent relationships are strategic investments, not transactional sales channels." },
  { title: "Market Structure Must Be Protected", desc: "Territory rights, pricing zones, and channel structure prevent internal competition." },
  { title: "Koleex Operates a Structured System", desc: "All commercial decisions follow defined rules, approval flows, and documented policies." },
];

const systems = [
  { name: "Product Levels", desc: "Cost-based product classification" },
  { name: "Customer Levels", desc: "Commercial ranking system" },
  { name: "Pricing System", desc: "Cost-to-price calculation engine" },
  { name: "Discount System", desc: "Rules, limits, and approvals" },
  { name: "Commission System", desc: "Sales and agent compensation" },
  { name: "Credit System", desc: "Limits, terms, and risk control" },
  { name: "Agent System", desc: "Territory rights and obligations" },
  { name: "Approval System", desc: "Authority levels and exceptions" },
];

const flowSteps = [
  "Cost", "Product Level", "Global Price", "Market Band", "Customer Level",
  "Discount", "Final Price", "Margin", "Commission", "Credit", "Approval", "Order",
];

const terms = [
  { term: "Factory Cost", def: "The product cost from the manufacturer" },
  { term: "Net Internal Cost", def: "Factory cost plus all internal expenses" },
  { term: "Global Reference Price", def: "Base price before regional adjustment" },
  { term: "Regional Price", def: "Price adjusted for market band" },
  { term: "Channel Price", def: "Price at each distribution level" },
  { term: "Suggested Retail Price", def: "Recommended end-user price" },
  { term: "Product Level", def: "Cost-based product classification (1-4)" },
  { term: "Customer Level", def: "Commercial ranking (End User to Diamond)" },
  { term: "Market Band", def: "Regional pricing zone (A/B/C/D)" },
  { term: "Margin", def: "Difference between cost and selling price" },
  { term: "Discount", def: "Price reduction from base price" },
  { term: "Credit Limit", def: "Maximum outstanding amount allowed" },
];

export default function IntroductionPage() {
  return (
    <PolicyPage
      title="KOLEEX Commercial System Manual"
      subtitle="This manual defines the complete commercial operating system of Koleex, including pricing, discounts, commissions, credit, and partner management."
      badge="Chapter 1"
    >
      {/* Purpose */}
      <Section title="Why this manual exists.">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {purposeItems.map((item) => (
            <div key={item.num} className="flex gap-4">
              <span className="text-2xl font-bold" style={{ color: "var(--text-ghost)" }}>{item.num}</span>
              <div>
                <p className="text-[14px] font-medium" style={{ color: "var(--text-secondary)" }}>{item.title}</p>
                <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-faint)" }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Audience */}
      <Section title="Who this manual is for.">
        <CardGrid cols={3}>
          {audienceRoles.map((item) => (
            <div
              key={item.role}
              className="rounded-xl p-5"
              style={{ background: "var(--bg-surface-subtle)" }}
            >
              <p className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>{item.role}</p>
              <p className="mt-1 text-[13px]" style={{ color: "var(--text-faint)" }}>{item.desc}</p>
            </div>
          ))}
        </CardGrid>
      </Section>

      {/* How to use */}
      <Section title="Follow the manual step by step.">
        <StepFlow
          steps={[
            { label: "Business Model" },
            { label: "Pricing System" },
            { label: "Pricing Algorithm" },
            { label: "Discount Policy" },
            { label: "Credit Rules" },
            { label: "Approval Workflow" },
            { label: "Tools & Calculators" },
          ]}
        />
      </Section>

      {/* Core Principles */}
      <Section title="Six rules that govern all commercial decisions.">
        <CardGrid cols={3}>
          {principles.map((item, i) => (
            <div
              key={item.title}
              className="rounded-xl border p-5"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
            >
              <span className="text-3xl font-bold" style={{ color: "var(--text-barely)" }}>{i + 1}</span>
              <p className="mt-2 text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>{item.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--text-faint)" }}>{item.desc}</p>
            </div>
          ))}
        </CardGrid>
      </Section>

      {/* System Overview */}
      <Section title="Eight systems working together.">
        <CardGrid cols={4}>
          {systems.map((item) => (
            <div
              key={item.name}
              className="rounded-xl border p-5 text-center"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
            >
              <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>{item.name}</p>
              <p className="mt-1 text-[12px]" style={{ color: "var(--text-faint)" }}>{item.desc}</p>
            </div>
          ))}
        </CardGrid>

        {/* Flow */}
        <div className="mt-6 overflow-x-auto">
          <div className="flex items-center gap-2">
            {flowSteps.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <span
                  className="whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium"
                  style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}
                >
                  {step}
                </span>
                {i < flowSteps.length - 1 && (
                  <span style={{ color: "var(--text-ghost)" }}>&rarr;</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Terminology */}
      <Section title="Key terms you'll see throughout.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {terms.map((item) => (
            <div key={item.term}>
              <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{item.term}</p>
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-faint)" }}>{item.def}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Callout */}
      <Callout title="Important">
        This is not only a pricing guide. It is the commercial operating system of Koleex.
      </Callout>
    </PolicyPage>
  );
}
