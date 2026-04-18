"use client";

import PolicyPage, { Section, Callout } from "@/components/commercial-policy/PolicyPage";

const scenarios = [
  { title: "Standard Sale — Gold Customer, Band B", steps: ["L2 product, cost ¥2,800", "Base price calculated: $546 (USD)", "Band B adjustment: $519", "Gold channel price: $543", "No discount requested", "Margin check: 35% ✓", "Credit check: $93K available ✓", "Order confirmed on 90-day credit", "Invoice paid → 3% commission = $16.29"], color: "#34C759" },
  { title: "Volume Discount — Platinum Customer", steps: ["Order: 50 units × $850 = $42,500", "4% volume discount requested", "Discounted total: $40,800", "Margin check: 28% (above L2 min 5%) ✓", "Approved by Sales Manager (3-5% range)", "Credit check: $410K available ✓", "Order confirmed on 120-day terms", "Commission: $40,800 × 4% = $1,632"], color: "#007AFF" },
  { title: "New Market Entry — Band A", steps: ["New agent in Nigeria requests pricing", "L1-L3 product range", "Band A adjustment (×0.90) applied", "Market entry discount: 10%", "Margin at 12% (above minimum) ✓", "Requires GM approval (10% discount)", "6-month special pricing approved", "Cash payment required (new customer)", "Commission: 3% on invoice"], color: "#FF9500" },
  { title: "Over-Limit Credit Order", steps: ["Diamond customer, UAE", "Order: $850,000 for factory project", "Credit limit: $2M, Outstanding: $680K", "Available: $1.32M — sufficient ✓", "L4 project pricing with 5% discount", "Margin check: 42% ✓", "Commercial Manager approves discount", "Order confirmed on annual settlement", "Commission: $850K × 5% = $42,500"], color: "#AF52DE" },
];

export default function CommercialScenariosPage() {
  return (
    <PolicyPage title="Commercial Scenarios" subtitle="End-to-end scenarios showing how all commercial systems work together in real situations." badge="Commercial Flow">
      {scenarios.map((s) => (
        <Section key={s.title} title={s.title}>
          <div className="rounded-xl border p-5" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}>
            <div className="flex flex-col gap-2">
              {s.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold mt-0.5" style={{ background: `${s.color}18`, color: s.color }}>{i + 1}</div>
                  <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{step}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>
      ))}

      <Callout>These scenarios demonstrate how pricing, discount, margin, credit, approval, and commission systems integrate in real transactions. Every step follows the established rules.</Callout>
    </PolicyPage>
  );
}
