"use client";

import PolicyPage, { Section, Callout } from "@/components/commercial-policy/PolicyPage";

const examples = [
  { title: "Gold Customer — 90-Day Credit", customer: "Ahmed Trading Co, Egypt", status: "Active Credit", color: "#C9973F",
    details: "3 years customer, $720K lifetime, $45K avg monthly",
    calc: "$45,000 × 3 = $135,000 credit limit. Outstanding: $42,000. Available: $93,000.",
    outcome: "Can place orders up to $93,000 on credit. 90-day payment terms." },
  { title: "Platinum Customer — 120-Day Credit", customer: "TechVision Industries, Turkey", status: "Active Credit", color: "#7BA1C2",
    details: "Major distributor, $4.2M lifetime, $180K monthly average",
    calc: "$180,000 × 4 = $720,000 credit limit. Outstanding: $310,000. Available: $410,000.",
    outcome: "Extended 120-day terms. Excellent payment record." },
  { title: "Diamond Partner — Annual Settlement", customer: "Gulf Industrial Group, UAE", status: "Active Credit", color: "#4FC3F7",
    details: "Sole agent with exclusive territory, formal contract, open credit",
    calc: "Contract-based credit limit $2,000,000. Outstanding: $680,000. Available: $1,320,000.",
    outcome: "Special contract terms. Annual reconciliation with quarterly review." },
  { title: "Silver Customer — No Credit", customer: "BuildRight Inc, Brazil", status: "Cash Only", color: "#A8A9AD",
    details: "New commercial customer, $85K lifetime, no credit access",
    calc: "Current $85,000. Gold threshold: $500,000. Remaining: $415,000.",
    outcome: "Must pay 100% upfront. Eligible for Gold upgrade once $500K reached." },
  { title: "Overdue — Credit on Hold", customer: "PowerGrid SA, South Africa", status: "On Hold", color: "#FF3B30",
    details: "Outstanding $98,000, 45 days overdue",
    calc: "Due (90 days): overdue by 45 days. Escalation: No New Orders.",
    outcome: "Cannot place new orders until $98K settled. Credit suspended at day 60." },
];

export default function CreditExamplesPage() {
  return (
    <PolicyPage title="Credit Examples" subtitle="Real-world credit scenarios showing how limits, terms, and policies work for different customer situations." badge="Credit System">
      {examples.map((ex) => (
        <Section key={ex.title} title={ex.title}>
          <div className="rounded-xl border p-6" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>{ex.customer}</span>
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: `${ex.color}18`, color: ex.color }}>{ex.status}</span>
            </div>
            <p className="text-[13px] mb-2" style={{ color: "var(--text-faint)" }}>{ex.details}</p>
            <div className="rounded-lg p-3 mb-3" style={{ background: "var(--bg-surface-subtle)" }}>
              <p className="text-[12px] font-mono" style={{ color: "var(--text-secondary)" }}>{ex.calc}</p>
            </div>
            <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{ex.outcome}</p>
          </div>
        </Section>
      ))}
      <Callout>Gold = Avg Monthly × 3 (90 days). Platinum = Avg Monthly × 4 (120 days). Diamond = contract-based (annual). Silver and End User = no credit.</Callout>
    </PolicyPage>
  );
}
