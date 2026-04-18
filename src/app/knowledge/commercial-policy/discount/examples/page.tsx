"use client";

import PolicyPage, { Section, Callout } from "@/components/commercial-policy/PolicyPage";

const scenarios = [
  { title: "Standard Dealer Discount", customer: "Silver", type: "Standard", basePrice: "$850", discount: "2%", final: "$833", outcome: "Approved", approver: "Sales Person", color: "#34C759" },
  { title: "Volume Order", customer: "Gold", type: "Volume", basePrice: "$12,500", discount: "4%", final: "$12,000", outcome: "Approved", approver: "Sales Manager", color: "#34C759" },
  { title: "Competitive Match", customer: "Gold", type: "Competitive", basePrice: "$2,200", discount: "7%", final: "$2,046", outcome: "Approved", approver: "Commercial Manager", color: "#34C759" },
  { title: "Project Pricing", customer: "Platinum", type: "Project", basePrice: "$85,000", discount: "9%", final: "$77,350", outcome: "Approved", approver: "Commercial Manager", color: "#34C759" },
  { title: "Market Entry — New Country", customer: "New Agent", type: "Market Entry", basePrice: "$5,000", discount: "12%", final: "$4,400", outcome: "Approved", approver: "General Manager", color: "#007AFF" },
  { title: "Below Minimum Margin", customer: "Gold", type: "Special", basePrice: "$1,800", discount: "15%", final: "$1,530", outcome: "Escalated to CEO", approver: "CEO Required", color: "#FF9500" },
  { title: "Exceeds Authority", customer: "Silver", type: "Standard", basePrice: "$3,200", discount: "6%", final: "—", outcome: "Rejected — Above Sales Limit", approver: "Escalated", color: "#FF3B30" },
  { title: "Strategic Exception", customer: "Diamond", type: "Special", basePrice: "$250,000", discount: "18%", final: "$205,000", outcome: "CEO Approved", approver: "CEO", color: "#4FC3F7" },
];

export default function DiscountExamplesPage() {
  return (
    <PolicyPage title="Discount Examples" subtitle="Real-world scenarios showing how different discount types are handled through the approval process." badge="Discount System">
      {scenarios.map((s) => (
        <Section key={s.title} title={s.title}>
          <div className="rounded-xl border p-5" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}>
            <div className="flex flex-wrap gap-3 mb-3">
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: `${s.color}18`, color: s.color }}>{s.outcome}</span>
              <span className="rounded-full px-2.5 py-0.5 text-[11px]" style={{ background: "var(--bg-surface)", color: "var(--text-faint)" }}>{s.type}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[13px] md:grid-cols-5">
              <div><p style={{ color: "var(--text-dim)" }}>Customer</p><p className="font-medium" style={{ color: "var(--text-primary)" }}>{s.customer}</p></div>
              <div><p style={{ color: "var(--text-dim)" }}>Base Price</p><p className="font-medium" style={{ color: "var(--text-primary)" }}>{s.basePrice}</p></div>
              <div><p style={{ color: "var(--text-dim)" }}>Discount</p><p className="font-medium" style={{ color: "#FF9500" }}>{s.discount}</p></div>
              <div><p style={{ color: "var(--text-dim)" }}>Final Price</p><p className="font-medium" style={{ color: "var(--text-primary)" }}>{s.final}</p></div>
              <div><p style={{ color: "var(--text-dim)" }}>Approver</p><p className="font-medium" style={{ color: "var(--text-primary)" }}>{s.approver}</p></div>
            </div>
          </div>
        </Section>
      ))}
      <Callout>Each scenario demonstrates a different approval path. The system determines the approver based on discount percentage and margin impact.</Callout>
    </PolicyPage>
  );
}
