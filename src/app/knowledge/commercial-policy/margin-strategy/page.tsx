"use client";

import PolicyPage, { Section, CardGrid, InfoCard, DataTable, Callout, RuleList } from "@/components/commercial-policy/PolicyPage";

const philosophyPills = ["Profitability", "Competitiveness", "Partner Profit", "Expansion", "Strategic Projects", "Cash Flow", "Risk Level"];

const marginFactors = [
  { num: 1, name: "Product Level", desc: "Level 1-4 base margin" },
  { num: 2, name: "Customer Level", desc: "End User to Diamond pricing" },
  { num: 3, name: "Market Band", desc: "Regional pricing adjustment" },
  { num: 4, name: "Order Size", desc: "Volume-based margin" },
  { num: 5, name: "Strategic Importance", desc: "Market entry, key accounts" },
  { num: 6, name: "Competition", desc: "Competitor price response" },
  { num: 7, name: "Payment Terms", desc: "Cash vs credit impact" },
  { num: 8, name: "Project Type", desc: "Standard vs project order" },
  { num: 9, name: "New Market", desc: "Entry pricing strategy" },
  { num: 10, name: "Promotions", desc: "Stock clearance, launches" },
];

const marginByProduct = [
  { level: "L1", name: "Entry / Volume", range: "3% \u2013 6%", desc: "Low margin, high volume. Market penetration.", color: "#34C759" },
  { level: "L2", name: "Standard Commercial", range: "7% \u2013 12%", desc: "Core business. Main revenue driver.", color: "#007AFF" },
  { level: "L3", name: "Advanced / Semi-Industrial", range: "13% \u2013 20%", desc: "Less competition. Technical positioning.", color: "#FF9500" },
  { level: "L4", name: "High-End / Strategic", range: "20% \u2013 35%", desc: "Low volume. High profitability.", color: "#AF52DE" },
];

const customerTiers = [
  { name: "Diamond", desc: "Lowest price, highest support", color: "#4FC3F7" },
  { name: "Platinum", desc: "Agent pricing", color: "#7BA1C2" },
  { name: "Gold", desc: "Distributor pricing", color: "#C9973F" },
  { name: "Silver", desc: "Dealer pricing", color: "#A8A9AD" },
  { name: "End User", desc: "Highest price", color: "#86868B" },
];

const regionBands = [
  { band: "Band A", label: "Price-Sensitive", margin: "Lower margin", examples: "Africa, South Asia, CIS", color: "#34C759" },
  { band: "Band B", label: "Mixed Markets", margin: "Standard margin", examples: "Middle East, Latin America, SE Asia", color: "#007AFF" },
  { band: "Band C", label: "Premium Markets", margin: "Higher margin", examples: "Europe, North America, Oceania", color: "#FF9500" },
  { band: "Band D", label: "Strategic / Projects", margin: "Flexible margin", examples: "Government, tenders, special projects", color: "#AF52DE" },
];

const orderSizes = [
  { label: "Small Order", note: "No discount", pct: 100 },
  { label: "Medium Order", note: "Small reduction", pct: 95 },
  { label: "Large Order", note: "Lower margin", pct: 85 },
  { label: "Very Large", note: "Strategic margin", pct: 70 },
];

const paymentRows = [
  ["100% Advance", "Best price"],
  ["30/70 Split", "Standard price"],
  ["LC", "Slightly higher"],
  ["Credit", "Higher price"],
  ["Long Credit", "Much higher"],
];

const minimumMargins = [
  { level: "L1", min: "2%", color: "#34C759" },
  { level: "L2", min: "5%", color: "#007AFF" },
  { level: "L3", min: "10%", color: "#FF9500" },
  { level: "L4", min: "15%", color: "#AF52DE" },
];

const formulaLines = [
  "Base Margin (Product Level)",
  "\u00B1 Regional Adjustment",
  "\u00B1 Customer Level Adjustment",
  "\u00B1 Order Size Adjustment",
  "\u00B1 Payment Terms Adjustment",
  "\u00B1 Strategic Adjustment",
];

export default function MarginStrategyPage() {
  return (
    <PolicyPage
      title="Product Margin Strategy."
      subtitle="Margins are not random numbers. They are determined by a structured strategy that balances profitability, competitiveness, and long-term growth."
      badge="Section 4"
    >
      {/* Philosophy */}
      <Section title="Maximize long-term value, not short-term margin.">
        <div className="mb-6 flex flex-wrap gap-2">
          {philosophyPills.map((p) => (
            <span
              key={p}
              className="rounded-full px-3 py-1.5 text-[12px]"
              style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}
            >
              {p}
            </span>
          ))}
        </div>
        <CardGrid cols={3}>
          {[
            { text: "Some orders will have high margins.", color: "#34C759" },
            { text: "Some orders will have low margins.", color: "#FF9500" },
            { text: "Some strategic orders may have very low margins to enter a market.", color: "#007AFF" },
          ].map((s) => (
            <div key={s.text} className="flex items-start gap-3 rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
              <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>{s.text}</p>
            </div>
          ))}
        </CardGrid>
      </Section>

      {/* Margin Factors */}
      <Section title="Ten factors that determine margin.">
        <CardGrid cols={4}>
          {marginFactors.map((f) => (
            <div key={f.num} className="rounded-xl p-4" style={{ background: "var(--bg-surface-subtle)" }}>
              <p className="text-xl font-bold" style={{ color: "var(--text-ghost)" }}>{String(f.num).padStart(2, "0")}</p>
              <p className="mt-1 text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{f.name}</p>
              <p className="text-[12px]" style={{ color: "var(--text-faint)" }}>{f.desc}</p>
            </div>
          ))}
        </CardGrid>
      </Section>

      {/* By Product Level */}
      <Section title="Base margin starts with the product.">
        <CardGrid cols={4}>
          {marginByProduct.map((l) => (
            <InfoCard key={l.level} title={l.name} value={l.range} description={l.desc} color={l.color}>
              <p className="mt-1 text-[11px] font-semibold" style={{ color: "var(--text-dim)" }}>{l.level}</p>
            </InfoCard>
          ))}
        </CardGrid>
        <p className="mt-3 text-center text-[13px] italic" style={{ color: "var(--text-faint)" }}>
          This is the base margin before other adjustments.
        </p>
      </Section>

      {/* By Customer Level */}
      <Section title="Channel pricing shares the margin.">
        <div className="space-y-3">
          {customerTiers.map((t, i) => {
            const widths = ["50%", "62%", "75%", "87%", "100%"];
            return (
              <div key={t.name} className="flex items-center gap-4">
                <div
                  className="flex h-10 items-center rounded-lg px-4"
                  style={{ width: widths[i], background: t.color }}
                >
                  <span className="text-[12px] font-semibold text-white">{t.name}</span>
                </div>
                <span className="text-[12px]" style={{ color: "var(--text-faint)" }}>{t.desc}</span>
              </div>
            );
          })}
        </div>
        <Callout>
          Higher-level partners receive better pricing because they buy larger quantities, hold stock, build networks, provide service, and promote the brand.
        </Callout>
      </Section>

      {/* By Region */}
      <Section title="Markets shape the margin.">
        <CardGrid cols={4}>
          {regionBands.map((b) => (
            <InfoCard key={b.band} title={b.label} description={b.examples} color={b.color}>
              <p className="text-[12px]" style={{ color: "var(--text-faint)" }}>{b.margin}</p>
            </InfoCard>
          ))}
        </CardGrid>
      </Section>

      {/* By Order Size */}
      <Section title="Volume rewards commitment.">
        <div className="space-y-3">
          {orderSizes.map((s) => (
            <div key={s.label} className="flex items-center gap-4">
              <div className="w-28 shrink-0 text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{s.label}</div>
              <div className="flex-1 rounded-lg" style={{ background: "var(--bg-surface)", height: 32 }}>
                <div className="h-full rounded-lg" style={{ width: `${s.pct}%`, background: "var(--bg-surface-active)" }} />
              </div>
              <div className="w-28 shrink-0 text-right text-[12px]" style={{ color: "var(--text-faint)" }}>{s.note}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* By Payment Terms */}
      <Section title="Risk has a price.">
        <DataTable headers={["Payment Type", "Margin Strategy"]} rows={paymentRows} />
        <Callout>Credit always increases price because it increases risk and financial cost.</Callout>
      </Section>

      {/* Minimum Margin */}
      <Section title="The floor that protects the company.">
        <CardGrid cols={4}>
          {minimumMargins.map((m) => (
            <InfoCard key={m.level} title={m.level} value={m.min} description="minimum" color={m.color} />
          ))}
        </CardGrid>
        <Callout title="Warning" color="#FF3B30">
          Any order below minimum margin must be approved by management.
        </Callout>
      </Section>

      {/* Margin Formula */}
      <Section title="The complete margin equation.">
        <div className="rounded-xl p-8" style={{ background: "var(--bg-inverted)", color: "var(--text-inverted)" }}>
          <p className="mb-4 text-center text-[14px]" style={{ opacity: 0.6 }}>Final Margin =</p>
          {formulaLines.map((line, i) => (
            <div
              key={i}
              className="py-3 text-center font-mono text-[15px] md:text-[17px]"
              style={{ borderBottom: i < formulaLines.length - 1 ? "1px solid rgba(255,255,255,0.1)" : "none" }}
            >
              {line}
            </div>
          ))}
        </div>
      </Section>

      {/* Strategic Pricing */}
      <Section title="When lower margins are acceptable.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {[
            "New country", "New agent", "Market share", "Long-term contract", "New product launch",
            "Large customer", "Government tender", "Very large order", "Strong competitor", "Clearing stock",
          ].map((item, i) => (
            <div key={item} className="flex items-center gap-2">
              <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: i < 5 ? "#34C759" : "#FF9500" }} />
              <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{item}</span>
            </div>
          ))}
        </div>
        <Callout>All strategic pricing must be approved. Lower margin is a tool, not a habit.</Callout>
      </Section>
    </PolicyPage>
  );
}
