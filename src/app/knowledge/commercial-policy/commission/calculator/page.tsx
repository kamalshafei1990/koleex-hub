"use client";

import { useState } from "react";
import PolicyPage, { Section, DataTable, Callout } from "@/components/commercial-policy/PolicyPage";

const tiers = [
  { name: "Standard (Junior)", rate: 3 },
  { name: "Senior", rate: 4 },
  { name: "Lead", rate: 5 },
];

export default function CommissionCalculatorPage() {
  const [invoiceAmount, setInvoiceAmount] = useState(85000);
  const [tierIdx, setTierIdx] = useState(2);
  const [returnAmount, setReturnAmount] = useState(0);

  const tier = tiers[tierIdx];
  const netInvoice = invoiceAmount - returnAmount;
  const commission = netInvoice * (tier.rate / 100);

  return (
    <PolicyPage title="Commission Calculator" subtitle="Calculate commission on paid invoices. Adjust for partial payments and returns." badge="Commission System">
      <Section title="Calculate Commission">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Invoice Amount (USD)</label>
              <input type="number" value={invoiceAmount} onChange={(e) => setInvoiceAmount(Number(e.target.value))} className="w-full rounded-lg border px-4 py-2.5 text-[14px] outline-none" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface-subtle)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Commission Tier</label>
              <div className="flex gap-2">
                {tiers.map((t, i) => (
                  <button key={t.name} onClick={() => setTierIdx(i)} className="flex-1 rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors" style={{ borderColor: tierIdx === i ? "var(--text-primary)" : "var(--border-subtle)", background: tierIdx === i ? "var(--bg-surface)" : "transparent", color: tierIdx === i ? "var(--text-primary)" : "var(--text-muted)" }}>
                    {t.name} ({t.rate}%)
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Return / Credit Note (USD)</label>
              <input type="number" value={returnAmount} onChange={(e) => setReturnAmount(Number(e.target.value))} className="w-full rounded-lg border px-4 py-2.5 text-[14px] outline-none" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface-subtle)", color: "var(--text-primary)" }} />
            </div>
          </div>

          <div className="rounded-xl border p-6" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>Result</p>
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Invoice Amount</span><span className="font-semibold" style={{ color: "var(--text-primary)" }}>${invoiceAmount.toLocaleString()}</span></div>
              {returnAmount > 0 && <div className="flex justify-between"><span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Return Adjustment</span><span className="font-semibold" style={{ color: "#FF3B30" }}>-${returnAmount.toLocaleString()}</span></div>}
              <div className="flex justify-between"><span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Net Amount</span><span className="font-semibold" style={{ color: "var(--text-primary)" }}>${netInvoice.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Rate</span><span className="font-semibold" style={{ color: "var(--text-primary)" }}>{tier.rate}%</span></div>
              <div className="border-t pt-3" style={{ borderColor: "var(--border-subtle)" }}>
                <div className="flex justify-between"><span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Commission</span><span className="text-xl font-bold" style={{ color: "#34C759" }}>${commission.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Quick Reference">
        <DataTable headers={["Invoice", "Standard (3%)", "Senior (4%)", "Lead (5%)"]} rows={[
          ["$25,000", "$750", "$1,000", "$1,250"],
          ["$50,000", "$1,500", "$2,000", "$2,500"],
          ["$100,000", "$3,000", "$4,000", "$5,000"],
          ["$250,000", "$7,500", "$10,000", "$12,500"],
          ["$500,000", "$15,000", "$20,000", "$25,000"],
        ]} />
      </Section>
    </PolicyPage>
  );
}
