"use client";

import PolicyPage, { Section, CardGrid } from "@/components/commercial-policy/PolicyPage";

const profiles = [
  { name: "Gulf Industrial Group", country: "UAE", level: "Diamond", color: "#4FC3F7", totalPurchase: "$12,500,000", avgMonthly: "$450,000", creditLimit: "$2,000,000", outstanding: "$680,000", available: "$1,320,000", utilization: 34, days: 365, risk: "Low", status: "Active" },
  { name: "TechVision Industries", country: "Turkey", level: "Platinum", color: "#7BA1C2", totalPurchase: "$4,200,000", avgMonthly: "$180,000", creditLimit: "$720,000", outstanding: "$310,000", available: "$410,000", utilization: 43, days: 120, risk: "Low", status: "Active" },
  { name: "Ahmed Trading Co", country: "Egypt", level: "Gold", color: "#C9973F", totalPurchase: "$720,000", avgMonthly: "$45,000", creditLimit: "$135,000", outstanding: "$42,000", available: "$93,000", utilization: 31, days: 90, risk: "Low", status: "Active" },
  { name: "PowerGrid SA", country: "South Africa", level: "Gold", color: "#C9973F", totalPurchase: "$580,000", avgMonthly: "$35,000", creditLimit: "$105,000", outstanding: "$98,000", available: "$7,000", utilization: 93, days: 90, risk: "High", status: "On Hold" },
  { name: "BuildRight Inc", country: "Brazil", level: "Silver", color: "#A8A9AD", totalPurchase: "$85,000", avgMonthly: "$12,000", creditLimit: "—", outstanding: "$0", available: "—", utilization: 0, days: 0, risk: "Low", status: "No Credit" },
  { name: "Metro Electronics", country: "Pakistan", level: "End User", color: "#86868B", totalPurchase: "$1,200", avgMonthly: "—", creditLimit: "—", outstanding: "$0", available: "—", utilization: 0, days: 0, risk: "Low", status: "No Credit" },
];

export default function CreditProfilesPage() {
  return (
    <PolicyPage title="Customer Profiles" subtitle="Active customer credit profiles showing utilization, risk, and status across all levels." badge="Credit System">
      <Section title="Portfolio Summary">
        <CardGrid cols={4}>
          <div className="rounded-xl p-4" style={{ background: "var(--bg-surface-subtle)" }}><p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>6</p><p className="text-[12px]" style={{ color: "var(--text-faint)" }}>Total Customers</p></div>
          <div className="rounded-xl p-4" style={{ background: "var(--bg-surface-subtle)" }}><p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>$1,130,000</p><p className="text-[12px]" style={{ color: "var(--text-faint)" }}>Total Outstanding</p></div>
          <div className="rounded-xl p-4" style={{ background: "var(--bg-surface-subtle)" }}><p className="text-2xl font-bold" style={{ color: "#34C759" }}>3</p><p className="text-[12px]" style={{ color: "var(--text-faint)" }}>Credit Active</p></div>
          <div className="rounded-xl p-4" style={{ background: "var(--bg-surface-subtle)" }}><p className="text-2xl font-bold" style={{ color: "#FF3B30" }}>1</p><p className="text-[12px]" style={{ color: "var(--text-faint)" }}>At Risk</p></div>
        </CardGrid>
      </Section>

      <Section title="Individual Profiles">
        <div className="flex flex-col gap-4">
          {profiles.map((p) => (
            <div key={p.name} className="rounded-xl border p-5" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full" style={{ background: p.color }} />
                  <span className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>{p.name}</span>
                  <span className="text-[12px]" style={{ color: "var(--text-faint)" }}>{p.country}</span>
                </div>
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: `${p.color}18`, color: p.color }}>{p.level}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[13px] md:grid-cols-4">
                <div><span style={{ color: "var(--text-dim)" }}>Credit Limit:</span> <span style={{ color: "var(--text-primary)" }}>{p.creditLimit}</span></div>
                <div><span style={{ color: "var(--text-dim)" }}>Outstanding:</span> <span style={{ color: "var(--text-primary)" }}>{p.outstanding}</span></div>
                <div><span style={{ color: "var(--text-dim)" }}>Available:</span> <span style={{ color: "var(--text-primary)" }}>{p.available}</span></div>
                <div><span style={{ color: "var(--text-dim)" }}>Risk:</span> <span style={{ color: p.risk === "High" ? "#FF3B30" : "var(--text-primary)" }}>{p.risk}</span></div>
              </div>
              {p.utilization > 0 && (
                <div className="mt-3">
                  <div className="h-2 w-full rounded-full" style={{ background: "var(--bg-surface)" }}>
                    <div className="h-2 rounded-full" style={{ width: `${p.utilization}%`, background: p.utilization > 80 ? "#FF3B30" : p.color }} />
                  </div>
                  <p className="mt-1 text-[11px]" style={{ color: "var(--text-faint)" }}>{p.utilization}% utilized</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </PolicyPage>
  );
}
