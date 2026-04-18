"use client";

import { useState } from "react";
import PolicyPage, { Section } from "@/components/commercial-policy/PolicyPage";

const minMargins: Record<string, number> = { L1: 2, L2: 5, L3: 8, L4: 15 };
const approvalLevels = [
  { max: 3, approver: "Sales Person" },
  { max: 5, approver: "Sales Manager" },
  { max: 10, approver: "Commercial Manager" },
  { max: 15, approver: "General Manager" },
  { max: 100, approver: "CEO" },
];

export default function DiscountCalculatorPage() {
  const [basePrice, setBasePrice] = useState(1000);
  const [cost, setCost] = useState(650);
  const [discountPct, setDiscountPct] = useState(5);
  const [productLevel, setProductLevel] = useState("L2");
  const [qty, setQty] = useState(10);

  const discountedPrice = basePrice * (1 - discountPct / 100);
  const margin = ((discountedPrice - cost) / discountedPrice) * 100;
  const minMargin = minMargins[productLevel];
  const marginOk = margin >= minMargin;
  const approver = approvalLevels.find((l) => discountPct <= l.max)?.approver || "CEO";
  const totalRevenue = discountedPrice * qty;

  return (
    <PolicyPage title="Discount Calculator" subtitle="Calculate discount impact on price, margin, and determine the approval requirement." badge="Discount System">
      <Section title="Calculate Discount">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Base Price (USD)</label>
              <input type="number" value={basePrice} onChange={(e) => setBasePrice(Number(e.target.value))} className="w-full rounded-lg border px-4 py-2.5 text-[14px] outline-none" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface-subtle)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Product Cost (USD)</label>
              <input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} className="w-full rounded-lg border px-4 py-2.5 text-[14px] outline-none" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface-subtle)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Discount %</label>
              <input type="number" value={discountPct} onChange={(e) => setDiscountPct(Number(e.target.value))} className="w-full rounded-lg border px-4 py-2.5 text-[14px] outline-none" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface-subtle)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Product Level</label>
              <div className="flex gap-2">
                {Object.keys(minMargins).map((l) => (
                  <button key={l} onClick={() => setProductLevel(l)} className="flex-1 rounded-lg border px-3 py-2 text-[12px] font-medium" style={{ borderColor: productLevel === l ? "var(--text-primary)" : "var(--border-subtle)", background: productLevel === l ? "var(--bg-surface)" : "transparent", color: productLevel === l ? "var(--text-primary)" : "var(--text-muted)" }}>{l}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Quantity</label>
              <input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-full rounded-lg border px-4 py-2.5 text-[14px] outline-none" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface-subtle)", color: "var(--text-primary)" }} />
            </div>
          </div>

          <div className="rounded-xl border p-6" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>Result</p>
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Original Price</span><span className="font-semibold" style={{ color: "var(--text-primary)" }}>${basePrice.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Discount</span><span className="font-semibold" style={{ color: "#FF9500" }}>-{discountPct}%</span></div>
              <div className="flex justify-between"><span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Final Price</span><span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>${discountedPrice.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Margin</span><span className="font-bold" style={{ color: marginOk ? "#34C759" : "#FF3B30" }}>{margin.toFixed(1)}%</span></div>
              <div className="flex justify-between"><span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Min Margin ({productLevel})</span><span style={{ color: "var(--text-faint)" }}>{minMargin}%</span></div>
              <div className="flex justify-between"><span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Total Revenue</span><span className="font-semibold" style={{ color: "var(--text-primary)" }}>${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
              <div className="border-t pt-3" style={{ borderColor: "var(--border-subtle)" }}>
                <div className="flex justify-between items-center">
                  <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Margin Check</span>
                  <span className="rounded-full px-3 py-1 text-[12px] font-bold" style={{ background: marginOk ? "#34C75918" : "#FF3B3018", color: marginOk ? "#34C759" : "#FF3B30" }}>{marginOk ? "Pass" : "Fail — Escalate"}</span>
                </div>
                <div className="mt-2 flex justify-between items-center">
                  <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Approver</span>
                  <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{approver}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </PolicyPage>
  );
}
