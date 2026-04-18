"use client";

import { useState } from "react";
import PolicyPage, { Section, Callout } from "@/components/commercial-policy/PolicyPage";

const levels = [
  { name: "End User", credit: false, multiplier: 0, days: 0 },
  { name: "Silver", credit: false, multiplier: 0, days: 0 },
  { name: "Gold", credit: true, multiplier: 3, days: 90 },
  { name: "Platinum", credit: true, multiplier: 4, days: 120 },
  { name: "Diamond", credit: true, multiplier: 12, days: 365 },
];

export default function CreditCalculatorPage() {
  const [levelIdx, setLevelIdx] = useState(2);
  const [avgMonthly, setAvgMonthly] = useState(45000);
  const [outstanding, setOutstanding] = useState(42000);
  const [orderAmount, setOrderAmount] = useState(50000);

  const level = levels[levelIdx];
  const creditLimit = level.credit ? avgMonthly * level.multiplier : 0;
  const available = Math.max(0, creditLimit - outstanding);
  const canOrder = level.credit && orderAmount <= available;

  return (
    <PolicyPage title="Credit Calculator" subtitle="Simulate credit limits, available credit, and order eligibility based on customer profile." badge="Credit System">
      <Section title="Customer Profile">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Customer Level</label>
              <div className="flex flex-wrap gap-2">
                {levels.map((l, i) => (
                  <button key={l.name} onClick={() => setLevelIdx(i)} className="rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors" style={{ borderColor: levelIdx === i ? "var(--text-primary)" : "var(--border-subtle)", background: levelIdx === i ? "var(--bg-surface)" : "transparent", color: levelIdx === i ? "var(--text-primary)" : "var(--text-muted)" }}>
                    {l.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Average Monthly Purchase (USD)</label>
              <input type="number" value={avgMonthly} onChange={(e) => setAvgMonthly(Number(e.target.value))} className="w-full rounded-lg border px-4 py-2.5 text-[14px] outline-none" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface-subtle)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Current Outstanding (USD)</label>
              <input type="number" value={outstanding} onChange={(e) => setOutstanding(Number(e.target.value))} className="w-full rounded-lg border px-4 py-2.5 text-[14px] outline-none" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface-subtle)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Requested Order (USD)</label>
              <input type="number" value={orderAmount} onChange={(e) => setOrderAmount(Number(e.target.value))} className="w-full rounded-lg border px-4 py-2.5 text-[14px] outline-none" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface-subtle)", color: "var(--text-primary)" }} />
            </div>
          </div>

          <div className="rounded-xl border p-6" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>Result</p>
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Level</span><span className="font-semibold" style={{ color: "var(--text-primary)" }}>{level.name}</span></div>
              <div className="flex justify-between"><span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Credit Access</span><span className="font-semibold" style={{ color: level.credit ? "#34C759" : "#FF3B30" }}>{level.credit ? "Yes" : "No"}</span></div>
              {level.credit && <>
                <div className="flex justify-between"><span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Formula</span><span className="text-[12px] font-mono" style={{ color: "var(--text-faint)" }}>${avgMonthly.toLocaleString()} × {level.multiplier}</span></div>
                <div className="flex justify-between"><span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Credit Limit</span><span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>${creditLimit.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Outstanding</span><span className="font-semibold" style={{ color: "#FF9500" }}>${outstanding.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Available</span><span className="font-semibold" style={{ color: "#34C759" }}>${available.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Credit Days</span><span className="font-semibold" style={{ color: "var(--text-primary)" }}>{level.days} days</span></div>
                <div className="border-t pt-3" style={{ borderColor: "var(--border-subtle)" }}>
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Order ${orderAmount.toLocaleString()}</span>
                    <span className="rounded-full px-3 py-1 text-[12px] font-bold" style={{ background: canOrder ? "#34C75918" : "#FF3B3018", color: canOrder ? "#34C759" : "#FF3B30" }}>{canOrder ? "Approved" : "Exceeds Limit"}</span>
                  </div>
                </div>
              </>}
            </div>
          </div>
        </div>
      </Section>
    </PolicyPage>
  );
}
