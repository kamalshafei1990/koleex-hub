"use client";

import PolicyPage, { Section, DataTable, Callout } from "@/components/commercial-policy/PolicyPage";

const levelDetails = [
  { level: "Level 1 — Sales Person", discount: "0-3%", credit: "No authority", special: "Standard quotations only", response: "Immediate" },
  { level: "Level 2 — Sales Manager", discount: "3-5%", credit: "Review credit requests", special: "Commission approval, promotion pricing", response: "Same day" },
  { level: "Level 3 — Commercial Manager", discount: "5-10%", credit: "Assign initial credit limits", special: "Competitive pricing, project discounts", response: "24 hours" },
  { level: "Level 4 — Regional Manager", discount: "Market-specific", credit: "Territory credit decisions", special: "Market entry pricing, agent evaluation", response: "48 hours" },
  { level: "Level 5 — General Manager", discount: "10-15%", credit: "Credit increases, overdue exceptions", special: "Agent appointments, strategic accounts", response: "48 hours" },
  { level: "Level 6 — CEO", discount: "15%+", credit: "Unlimited authority", special: "Diamond approval, policy exceptions, below-minimum margin", response: "Case by case" },
];

export default function ApprovalLevelsPage() {
  return (
    <PolicyPage title="Approval Levels" subtitle="Detailed breakdown of each authority level's scope, limits, and responsibilities." badge="Approval Authority">
      <Section title="Level Details">
        {levelDetails.map((l) => (
          <div key={l.level} className="mb-4 rounded-xl border p-5" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}>
            <p className="text-[15px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>{l.level}</p>
            <div className="grid grid-cols-2 gap-3 text-[13px] md:grid-cols-4">
              <div><p className="text-[11px]" style={{ color: "var(--text-dim)" }}>Discount</p><p style={{ color: "var(--text-secondary)" }}>{l.discount}</p></div>
              <div><p className="text-[11px]" style={{ color: "var(--text-dim)" }}>Credit</p><p style={{ color: "var(--text-secondary)" }}>{l.credit}</p></div>
              <div><p className="text-[11px]" style={{ color: "var(--text-dim)" }}>Special</p><p style={{ color: "var(--text-secondary)" }}>{l.special}</p></div>
              <div><p className="text-[11px]" style={{ color: "var(--text-dim)" }}>Response</p><p style={{ color: "var(--text-secondary)" }}>{l.response}</p></div>
            </div>
          </div>
        ))}
      </Section>

      <Callout>Each level includes all authorities of lower levels. A General Manager can approve any Sales Person or Manager decision without further escalation.</Callout>
    </PolicyPage>
  );
}
