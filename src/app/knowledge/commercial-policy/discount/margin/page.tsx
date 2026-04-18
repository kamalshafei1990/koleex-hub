"use client";

import PolicyPage, { Section, CardGrid, InfoCard, DataTable, Callout } from "@/components/commercial-policy/PolicyPage";

export default function DiscountMarginPage() {
  return (
    <PolicyPage title="Margin Protection" subtitle="Minimum margin rules that prevent discounts from eroding profitability below acceptable thresholds." badge="Discount System">
      <Section title="Minimum Margins by Product Level">
        <CardGrid cols={4}>
          <InfoCard title="Level 1 (Entry)" value="2%" description="Absolute floor for entry/volume products" color="#34C759" />
          <InfoCard title="Level 2 (Standard)" value="5%" description="Core business minimum margin" color="#007AFF" />
          <InfoCard title="Level 3 (Advanced)" value="8%" description="Semi-industrial equipment floor" color="#FF9500" />
          <InfoCard title="Level 4 (Premium)" value="15%" description="High-end strategic equipment floor" color="#AF52DE" />
        </CardGrid>
      </Section>

      <Section title="What Happens Below Minimum">
        <DataTable
          headers={["Situation", "Action Required"]}
          rows={[
            ["Discount would bring margin to minimum", "Sales Manager must approve"],
            ["Discount would breach minimum margin", "General Manager approval required"],
            ["Margin below 0% (loss)", "CEO approval required — exceptional cases only"],
            ["Repeated below-margin requests from same customer", "Commercial review triggered"],
          ]}
        />
      </Section>

      <Section title="Margin Check Formula">
        <div className="rounded-xl p-6" style={{ background: "var(--bg-surface-subtle)" }}>
          <p className="font-mono text-[14px]" style={{ color: "var(--text-secondary)" }}>
            Actual Margin = (Selling Price - Net Internal Cost) / Selling Price × 100
          </p>
          <p className="mt-2 font-mono text-[14px]" style={{ color: "var(--text-secondary)" }}>
            If Actual Margin &lt; Minimum Margin → Escalate to higher approval
          </p>
        </div>
      </Section>

      <Callout title="Key Rule" color="#FF3B30">
        No transaction may proceed below minimum margin without explicit management approval. The system automatically flags margin breaches before quotation confirmation.
      </Callout>
    </PolicyPage>
  );
}
