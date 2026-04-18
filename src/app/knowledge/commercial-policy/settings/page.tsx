"use client";

import PolicyPage, { Section, CardGrid, InfoCard, Callout } from "@/components/commercial-policy/PolicyPage";

export default function SettingsPage() {
  return (
    <PolicyPage title="Settings" subtitle="System configuration for the KOLEEX Commercial Policy module." badge="System">
      <Section title="Currency Settings">
        <CardGrid cols={3}>
          <InfoCard title="Internal Currency" value="CNY" description="Chinese Yuan — all factory costs" />
          <InfoCard title="International Currency" value="USD" description="US Dollar — all customer prices" />
          <InfoCard title="FX Reference Rate" value="7.20" description="CNY/USD — updated quarterly" />
        </CardGrid>
      </Section>

      <Section title="Default Values">
        <CardGrid cols={3}>
          <InfoCard title="Internal Cost Add" value="8%" description="Overhead added to factory cost" />
          <InfoCard title="Default Payment" value="Cash" description="New customers default to cash" />
          <InfoCard title="Credit Review Cycle" value="6 months" description="Automatic credit review period" />
        </CardGrid>
      </Section>

      <Section title="Notification Preferences">
        <div className="flex flex-col gap-3">
          {[
            { label: "Overdue alerts", desc: "Notify sales when customer enters overdue" },
            { label: "Credit limit warnings", desc: "Alert when customer reaches 80% utilization" },
            { label: "Approval pending", desc: "Remind approvers of pending decisions" },
            { label: "Commission calculated", desc: "Notify sales person of new commission" },
            { label: "Level upgrade eligible", desc: "Alert when customer qualifies for upgrade" },
          ].map((n) => (
            <div key={n.label} className="flex items-center justify-between rounded-xl border p-4" style={{ borderColor: "var(--border-subtle)" }}>
              <div>
                <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{n.label}</p>
                <p className="text-[12px]" style={{ color: "var(--text-faint)" }}>{n.desc}</p>
              </div>
              <div className="h-5 w-9 rounded-full" style={{ background: "var(--bg-surface-active)" }}>
                <div className="ml-auto h-5 w-5 rounded-full" style={{ background: "var(--text-primary)" }} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Callout>Settings changes require System Administrator or CEO approval. Contact the admin team to modify system defaults.</Callout>
    </PolicyPage>
  );
}
