"use client";

import PolicyPage, { Section, DataTable, Callout } from "@/components/commercial-policy/PolicyPage";

const types = [
  { name: "Standard", who: "All customers", max: "3%", approval: "Sales Person", desc: "Default discount within daily sales operations" },
  { name: "Volume", who: "Silver+", max: "5%", approval: "Sales Manager", desc: "For confirmed large quantity orders" },
  { name: "Project", who: "Gold+", max: "10%", approval: "Commercial Manager", desc: "Large project orders with clear scope" },
  { name: "Competitive", who: "All", max: "8%", approval: "Commercial Manager", desc: "Verified competitor price matching" },
  { name: "Market Entry", who: "New markets", max: "12%", approval: "General Manager", desc: "New country/territory penetration (max 6 months)" },
  { name: "Promotion", who: "All", max: "5%", approval: "Sales Manager", desc: "Time-limited campaigns and clearance" },
  { name: "Special", who: "Strategic", max: "15%+", approval: "CEO", desc: "Exceptional strategic cases only" },
];

export default function DiscountTypesPage() {
  return (
    <PolicyPage title="Discount Types" subtitle="Seven categories of discounts, each with specific rules, eligible customers, and approval requirements." badge="Discount System">
      <Section title="Discount Categories">
        <DataTable
          headers={["Type", "Eligible", "Max Discount", "Approver", "Description"]}
          rows={types.map((t) => [t.name, t.who, t.max, t.approval, t.desc])}
        />
      </Section>

      <Section title="Rules by Type">
        {types.map((t) => (
          <div key={t.name} className="mb-3 rounded-xl border p-4" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>{t.name} Discount</span>
              <span className="text-[12px] font-bold" style={{ color: "var(--text-muted)" }}>Max {t.max}</span>
            </div>
            <p className="text-[13px]" style={{ color: "var(--text-faint)" }}>{t.desc}. Eligible: {t.who}. Approved by: {t.approval}.</p>
          </div>
        ))}
      </Section>

      <Callout>Only one discount type can be applied per order line. Discounts cannot be stacked or combined.</Callout>
    </PolicyPage>
  );
}
