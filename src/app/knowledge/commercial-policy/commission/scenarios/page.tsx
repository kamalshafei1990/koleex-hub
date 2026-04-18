"use client";

import PolicyPage, { Section, CardGrid, InfoCard, Callout } from "@/components/commercial-policy/PolicyPage";

const scenarios = [
  { title: "Standard Sale — Full Payment", status: "Paid", invoice: "$50,000", rate: "3%", commission: "$1,500", desc: "Customer pays in full. Commission calculated and enters approval pipeline.", color: "#34C759" },
  { title: "Partial Payment", status: "Partial", invoice: "$80,000", rate: "3%", commission: "$1,500", desc: "Customer pays $50,000 of $80,000. Commission on paid portion only. Remaining $30,000 pending.", color: "#FF9500" },
  { title: "Return / Credit Note", status: "Adjusted", invoice: "$40,000", rate: "3%", commission: "$900", desc: "Original $1,200 commission reduced by $300 for $10,000 credit note. Net commission $900.", color: "#FF9500" },
  { title: "Large Project Sale", status: "Special Approval", invoice: "$250,000", rate: "5%", commission: "$12,500", desc: "High-value commission requires special managerial approval due to amount.", color: "#007AFF" },
  { title: "Cancelled Order", status: "Cancelled", invoice: "$30,000", rate: "—", commission: "$0", desc: "Invoice unpaid, order cancelled. No commission earned — payment is required to trigger.", color: "#FF3B30" },
];

export default function CommissionScenariosPage() {
  return (
    <PolicyPage title="Commission Scenarios" subtitle="Real-world commission scenarios covering standard sales, partial payments, returns, large projects, and cancellations." badge="Commission System">
      {scenarios.map((s) => (
        <Section key={s.title} title={s.title}>
          <div className="rounded-xl border p-6" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}>
            <div className="mb-4 flex flex-wrap gap-3">
              <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: `${s.color}18`, color: s.color }}>{s.status}</span>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div><p className="text-[11px]" style={{ color: "var(--text-dim)" }}>Invoice</p><p className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>{s.invoice}</p></div>
              <div><p className="text-[11px]" style={{ color: "var(--text-dim)" }}>Rate</p><p className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>{s.rate}</p></div>
              <div><p className="text-[11px]" style={{ color: "var(--text-dim)" }}>Commission</p><p className="text-[15px] font-bold" style={{ color: s.color }}>{s.commission}</p></div>
            </div>
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>{s.desc}</p>
          </div>
        </Section>
      ))}
      <Callout>Commission requires invoice payment to trigger. Unpaid invoices, partial payments, and cancelled orders are handled according to these rules.</Callout>
    </PolicyPage>
  );
}
