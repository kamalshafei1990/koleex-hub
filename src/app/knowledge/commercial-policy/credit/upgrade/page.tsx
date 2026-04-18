"use client";

import PolicyPage, { Section, DataTable, Callout, CardGrid, InfoCard, StepFlow } from "@/components/commercial-policy/PolicyPage";

const upgradePaths = [
  { from: "End User", to: "Silver", requirement: "First commercial order ($15,000+)", basis: "Order size", approval: "Automatic", color: "#A8A9AD" },
  { from: "Silver", to: "Gold", requirement: "Total purchase lifetime ≥ $500,000", basis: "Lifetime purchases", approval: "Manual approval", color: "#C9973F" },
  { from: "Gold", to: "Platinum", requirement: "Total purchase lifetime ≥ $3,000,000", basis: "Lifetime purchases", approval: "Manual approval", color: "#7BA1C2" },
  { from: "Platinum", to: "Diamond", requirement: "Contract + Sole Agent Agreement + Management", basis: "Strategic decision", approval: "Executive approval", color: "#4FC3F7" },
];

export default function CreditUpgradePage() {
  return (
    <PolicyPage title="Upgrade Logic" subtitle="How customers move between levels based on purchase history, performance, and strategic agreements." badge="Credit System">
      <Section title="Upgrade Paths">
        {upgradePaths.map((p) => (
          <div key={p.to} className="mb-4 rounded-xl border p-5" style={{ borderColor: "var(--border-subtle)", borderLeft: `4px solid ${p.color}` }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[13px] font-semibold" style={{ color: "var(--text-muted)" }}>{p.from}</span>
              <span style={{ color: "var(--text-ghost)" }}>→</span>
              <span className="text-[15px] font-bold" style={{ color: p.color }}>{p.to}</span>
            </div>
            <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{p.requirement}</p>
            <div className="mt-2 flex gap-4 text-[12px]" style={{ color: "var(--text-faint)" }}>
              <span>Basis: {p.basis}</span>
              <span>Approval: {p.approval}</span>
            </div>
          </div>
        ))}
      </Section>

      <Section title="Benefits Comparison">
        <DataTable
          headers={["Level", "Credit", "Pricing", "Market"]}
          rows={[
            ["End User", "None", "Retail Price", "None"],
            ["Silver", "None", "Silver Price", "Non-exclusive"],
            ["Gold", "90 days", "Gold Price", "Non-exclusive"],
            ["Platinum", "120 days", "Platinum Price", "Priority territory"],
            ["Diamond", "Annual Settlement", "Best Price", "Exclusive territory"],
          ]}
        />
      </Section>

      <Callout>Diamond is not volume-based. It requires a formal contract, sole agent agreement, and executive-level approval. All other upgrades from Silver onward require management review — the system suggests but does not auto-apply.</Callout>
    </PolicyPage>
  );
}
