"use client";

import PolicyPage, { Section, DataTable, Callout, CardGrid, InfoCard } from "@/components/commercial-policy/PolicyPage";

export default function MarginFlowPage() {
  return (
    <PolicyPage title="Margin & Discount" subtitle="How margin protection and discount rules interact within the commercial process." badge="Commercial Flow">
      <Section title="Margin Check Points">
        <CardGrid cols={2}>
          <InfoCard title="Pre-Discount Check" description="Verify base margin meets target range for product level before any discount" color="#007AFF" />
          <InfoCard title="Post-Discount Check" description="Verify final margin stays above minimum after discount is applied" color="#FF9500" />
        </CardGrid>
      </Section>

      <Section title="Minimum Margins After Discount">
        <DataTable
          headers={["Product Level", "Target Margin", "Minimum After Discount", "Breach Action"]}
          rows={[
            ["L1 (Entry)", "15-25%", "2%", "Escalate to management"],
            ["L2 (Standard)", "25-35%", "5%", "Escalate to management"],
            ["L3 (Advanced)", "35-45%", "8%", "Escalate to management"],
            ["L4 (Premium)", "45-60%", "15%", "Escalate to management"],
          ]}
        />
      </Section>

      <Section title="Decision Flow">
        <div className="space-y-3">
          {[
            { condition: "Margin > Target Range", result: "Proceed normally", color: "#34C759" },
            { condition: "Margin within Target Range", result: "Standard approval", color: "#007AFF" },
            { condition: "Margin = Minimum", result: "Sales Manager approval required", color: "#FF9500" },
            { condition: "Margin < Minimum", result: "GM/CEO approval required", color: "#FF3B30" },
          ].map((d) => (
            <div key={d.condition} className="flex items-center gap-3 rounded-lg p-3" style={{ background: "var(--bg-surface-subtle)" }}>
              <div className="h-3 w-3 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{d.condition}</span>
              <span style={{ color: "var(--text-ghost)" }}>→</span>
              <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>{d.result}</span>
            </div>
          ))}
        </div>
      </Section>

      <Callout>Margin protection is non-negotiable. The system prevents quotation confirmation if margin falls below minimum without appropriate approval.</Callout>
    </PolicyPage>
  );
}
