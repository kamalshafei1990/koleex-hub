"use client";

import PolicyPage, { Section, CardGrid, InfoCard, DataTable, Callout } from "@/components/commercial-policy/PolicyPage";

const roles = [
  { role: "Sales Person", level: 1, scope: "Standard discounts 0-3%, basic quotations", color: "#34C759" },
  { role: "Sales Manager", level: 2, scope: "Discounts 3-5%, team pricing decisions, commission approval", color: "#007AFF" },
  { role: "Commercial Manager", level: 3, scope: "Discounts 5-10%, competitive pricing, credit evaluation", color: "#FF9500" },
  { role: "Export / Regional Manager", level: 4, scope: "Market-specific pricing, territory decisions, agent management", color: "#AF52DE" },
  { role: "General Manager", level: 5, scope: "Discounts 10-15%, credit limits, market entry pricing", color: "#7BA1C2" },
  { role: "CEO", level: 6, scope: "Discounts 15%+, strategic pricing, Diamond approvals, policy exceptions", color: "#4FC3F7" },
];

export default function ApprovalOverviewPage() {
  return (
    <PolicyPage title="Approval Authority" subtitle="Six authority levels that govern all commercial decisions — from standard discounts to strategic partnerships." badge="Approval Authority">
      <Section title="Six Approval Roles">
        <CardGrid cols={3}>
          {roles.map((r) => (
            <InfoCard key={r.role} title={r.role} value={`Level ${r.level}`} description={r.scope} color={r.color} />
          ))}
        </CardGrid>
      </Section>

      <Section title="Authority Matrix">
        <DataTable
          headers={["Decision Type", "L1 Sales", "L2 Manager", "L3 Commercial", "L4 Regional", "L5 GM", "L6 CEO"]}
          rows={[
            ["Standard Discount (0-3%)", "✓", "—", "—", "—", "—", "—"],
            ["Extended Discount (3-5%)", "—", "✓", "—", "—", "—", "—"],
            ["Major Discount (5-10%)", "—", "—", "✓", "—", "—", "—"],
            ["Strategic Discount (10-15%)", "—", "—", "—", "—", "✓", "—"],
            ["Exceptional Discount (15%+)", "—", "—", "—", "—", "—", "✓"],
            ["Credit Limit Assignment", "—", "—", "✓", "—", "—", "—"],
            ["Credit Limit Increase", "—", "—", "—", "—", "✓", "—"],
            ["Commission Approval", "—", "✓", "—", "—", "—", "—"],
            ["Agent Appointment", "—", "—", "—", "—", "✓", "✓"],
            ["Diamond Approval", "—", "—", "—", "—", "—", "✓"],
          ]}
        />
      </Section>

      <Callout>Higher levels can always approve decisions within lower-level authority. However, lower levels cannot bypass the approval chain — escalation is mandatory.</Callout>
    </PolicyPage>
  );
}
