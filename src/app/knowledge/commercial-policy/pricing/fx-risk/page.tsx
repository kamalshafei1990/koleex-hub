"use client";

import PolicyPage, { Section, DataTable, Callout, InfoCard, CardGrid, RuleList } from "@/components/commercial-policy/PolicyPage";

export default function FxRiskPage() {
  return (
    <PolicyPage title="FX Policy" subtitle="Currency conversion rules, FX risk management, and the CNY to USD conversion framework that underpins all international pricing." badge="Pricing System">
      <Section title="Base Currency Framework">
        <CardGrid cols={3}>
          <InfoCard title="Internal Currency" value="CNY" description="All factory costs and internal pricing in Chinese Yuan" color="#FF3B30" />
          <InfoCard title="International Currency" value="USD" description="All customer-facing prices quoted in US Dollars" color="#007AFF" />
          <InfoCard title="Reference Rate" value="7.20" description="CNY/USD reference rate for price calculations" color="#34C759" />
        </CardGrid>
      </Section>

      <Section title="FX Conversion Rules">
        <RuleList rules={[
          "All prices are calculated in CNY first, then converted to USD at the reference rate",
          "The reference FX rate is set quarterly by the Finance team",
          "Customer quotations are always in USD unless a specific local currency is agreed",
          "FX rate changes do not retroactively affect confirmed orders",
          "Large orders (>$100K) may lock in a specific FX rate at order confirmation",
          "If CNY strengthens >5% against USD between rate reviews, an emergency rate update is triggered",
        ]} />
      </Section>

      <Section title="FX Risk Scenarios">
        <DataTable
          headers={["Scenario", "Impact", "Action"]}
          rows={[
            ["CNY weakens 2%", "Prices become more competitive", "No action — next quarterly review"],
            ["CNY strengthens 2%", "Margins slightly compressed", "Monitor — no immediate action"],
            ["CNY strengthens 5%+", "Margin at risk", "Emergency rate review triggered"],
            ["USD volatile", "Quote uncertainty", "Lock rate at order confirmation for large deals"],
          ]}
        />
      </Section>

      <Section title="Rate Update Process">
        <div className="flex flex-col gap-3">
          {["Finance reviews CNY/USD market rate", "New reference rate proposed", "Management approves rate change", "System updated with new rate", "All new quotations use updated rate", "Existing confirmed orders unaffected"].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}>{i + 1}</div>
              <p className="text-[13px] pt-0.5" style={{ color: "var(--text-secondary)" }}>{step}</p>
            </div>
          ))}
        </div>
      </Section>

      <Callout>FX risk is managed at the company level, not at the individual transaction level. Sales teams quote in USD and do not need to manage currency exposure.</Callout>
    </PolicyPage>
  );
}
