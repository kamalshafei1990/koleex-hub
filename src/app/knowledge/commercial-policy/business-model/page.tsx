"use client";

import PolicyPage, { Section, SectionDesc, CardGrid, InfoCard, DataTable, Callout } from "@/components/commercial-policy/PolicyPage";

const valueChainSteps = ["Factories", "KOLEEX", "Agents", "Distributors", "Dealers", "End Users"];

const responsibilities = [
  { title: "Product Development", desc: "Design and engineer industrial equipment for global markets" },
  { title: "Global Distribution", desc: "Manage supply chains across 199 international markets" },
  { title: "Quality Control", desc: "Ensure consistent product standards at every stage" },
  { title: "Pricing Strategy", desc: "Set competitive margins across product levels and regions" },
  { title: "Partner Management", desc: "Recruit, train, and support commercial partners worldwide" },
  { title: "Technical Support", desc: "Provide after-sales service and technical guidance" },
  { title: "Training Programs", desc: "Deliver product knowledge and sales training globally" },
  { title: "Market Protection", desc: "Prevent channel conflict and protect partner territories" },
  { title: "Brand Building", desc: "Maintain consistent global brand positioning" },
];

const productFamilies = [
  { name: "Industrial Sewing", desc: "High-volume lockstitch and overlock machines" },
  { name: "Automatic Sewing", desc: "Programmable pattern and template sewing" },
  { name: "Special Sewing", desc: "Bartacking, buttonhole, and specialty units" },
  { name: "Cutting Machines", desc: "Fabric spreading and automated cutting" },
  { name: "Finishing Equipment", desc: "Thread trimming and quality finishing" },
  { name: "Pressing Equipment", desc: "Steam pressing and ironing systems" },
  { name: "Spare Parts", desc: "OEM replacement parts for all machines" },
  { name: "Accessories", desc: "Needles, bobbins, and attachments" },
  { name: "Automation Systems", desc: "Conveyor and material handling systems" },
  { name: "Smart Systems", desc: "IoT-enabled monitoring and analytics" },
  { name: "Production Lines", desc: "Complete turnkey factory solutions" },
  { name: "Custom Equipment", desc: "Tailored machinery for specific needs" },
];

const productLevels = [
  { level: "L1", name: "Entry Level", margin: "15-25%", color: "#34C759", products: "Basic lockstitch, Standard overlock, Manual cutters" },
  { level: "L2", name: "Professional", margin: "25-35%", color: "#007AFF", products: "Direct-drive machines, Automatic trimmers, Digital pressing" },
  { level: "L3", name: "Advanced", margin: "35-45%", color: "#FF9500", products: "Programmable patterns, CNC cutters, Smart systems" },
  { level: "L4", name: "Premium", margin: "45-60%", color: "#AF52DE", products: "Full automation lines, Custom engineering, Turnkey factories" },
];

const customerTypes = [
  { name: "End User", desc: "Factories purchasing equipment for their own production", color: "#86868B" },
  { name: "Dealer", desc: "Local resellers serving a specific city or area", color: "#A8A9AD" },
  { name: "Distributor", desc: "Regional partners managing a territory with stock and service", color: "#C9973F" },
  { name: "Agent", desc: "Market representatives managing dealers and distributors", color: "#7BA1C2" },
  { name: "Sole Agent", desc: "Exclusive representative for an entire country or region", color: "#4FC3F7" },
  { name: "Key Account", desc: "Major industrial groups with direct strategic relationship", color: "#007AFF" },
  { name: "Strategic Partner", desc: "Long-term alliances for market development and co-investment", color: "#AF52DE" },
];

const customerLevels = [
  { label: "Diamond", realName: "Sole Agent", color: "#4FC3F7" },
  { label: "Platinum", realName: "Agent", color: "#7BA1C2" },
  { label: "Gold", realName: "Distributor", color: "#C9973F" },
  { label: "Silver", realName: "Dealer", color: "#A8A9AD" },
  { label: "End User", realName: "End User", color: "#86868B" },
];

const rightsRows = [
  { benefit: "Pricing", values: [true, true, true, true, true] },
  { benefit: "Discounts", values: [false, true, true, true, true] },
  { benefit: "Credit", values: [false, false, true, true, true] },
  { benefit: "Market Protection", values: [false, false, true, true, true] },
  { benefit: "Exclusive Rights", values: [false, false, false, true, true] },
  { benefit: "Marketing Support", values: [false, false, true, true, true] },
  { benefit: "Technical Support", values: [false, true, true, true, true] },
  { benefit: "Training", values: [false, false, true, true, true] },
  { benefit: "Priority Production", values: [false, false, false, true, true] },
  { benefit: "Strategic Projects", values: [false, false, false, false, true] },
];

const dutyRows = [
  { duty: "Min Purchase", values: ["None", "Low", "Medium", "High", "Very High"] },
  { duty: "Stock", values: ["None", "Basic", "Required", "Full Range", "Full Range"] },
  { duty: "Dealer Network", values: ["None", "None", "Optional", "Required", "Required"] },
  { duty: "Technical Service", values: ["None", "Basic", "Required", "Full", "Full"] },
  { duty: "Price Policy", values: ["None", "Follow", "Follow", "Enforce", "Enforce"] },
  { duty: "Territory", values: ["None", "City", "Region", "Country", "Exclusive"] },
  { duty: "Brand Promotion", values: ["None", "Basic", "Active", "Strategic", "Strategic"] },
  { duty: "Market Reporting", values: ["None", "None", "Quarterly", "Monthly", "Monthly"] },
  { duty: "Payment", values: ["Cash", "Cash", "30 Days", "60 Days", "90 Days"] },
  { duty: "Exhibitions", values: ["None", "None", "Optional", "Required", "Required"] },
];

const strategies = [
  "Competitive pricing in price-sensitive markets",
  "Higher margins in developed markets",
  "Supporting agents to build networks",
  "Protecting market structure",
  "Preventing internal partner competition",
  "Supporting strategic projects",
  "Controlled discounts for market entry",
  "Maintaining global brand positioning",
];

const levelNames = ["End User", "Silver", "Gold", "Platinum", "Diamond"];
const levelColors = ["#86868B", "#A8A9AD", "#C9973F", "#7BA1C2", "#4FC3F7"];

export default function BusinessModelPage() {
  return (
    <PolicyPage
      title="How KOLEEX connects factories to global markets."
      subtitle="A global industrial equipment brand operating through a structured distribution system of agents, distributors, and dealers across 199 markets."
      badge="Business Model"
    >
      {/* Value Chain */}
      <Section title="From factory floor to end user.">
        <div className="mb-8 overflow-x-auto">
          <div className="flex items-center gap-3">
            {valueChainSteps.map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <span
                  className="whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-medium"
                  style={{
                    background: step === "KOLEEX" ? "var(--bg-inverted)" : "var(--bg-surface)",
                    color: step === "KOLEEX" ? "var(--text-inverted)" : "var(--text-secondary)",
                  }}
                >
                  {step}
                </span>
                {i < valueChainSteps.length - 1 && <span style={{ color: "var(--text-ghost)" }}>&rarr;</span>}
              </div>
            ))}
          </div>
        </div>
        <CardGrid cols={3}>
          {responsibilities.map((r) => (
            <InfoCard key={r.title} title={r.title} description={r.desc} />
          ))}
        </CardGrid>
      </Section>

      {/* Product Families */}
      <Section title="Twelve product categories. One commercial system.">
        <CardGrid cols={4}>
          {productFamilies.map((f) => (
            <div key={f.name} className="rounded-xl p-4" style={{ background: "var(--bg-surface-subtle)" }}>
              <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{f.name}</p>
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-faint)" }}>{f.desc}</p>
            </div>
          ))}
        </CardGrid>
        <p className="mt-4 text-center text-[13px] italic" style={{ color: "var(--text-faint)" }}>
          Products are classified by commercial importance and price range, not only by type.
        </p>
      </Section>

      {/* Product Levels */}
      <Section title="Four levels define pricing margins.">
        <CardGrid cols={4}>
          {productLevels.map((l) => (
            <InfoCard key={l.level} title={l.name} value={l.margin} description={l.products} color={l.color}>
              <p className="mt-1 text-[11px] font-semibold" style={{ color: "var(--text-dim)" }}>{l.level}</p>
            </InfoCard>
          ))}
        </CardGrid>
      </Section>

      {/* Customer & Partner Types */}
      <Section title="Seven types of commercial relationships.">
        <div className="flex flex-col gap-3">
          {customerTypes.map((t) => (
            <div
              key={t.name}
              className="flex items-center gap-4 border-b py-3"
              style={{ borderColor: "var(--border-faint)" }}
            >
              <div className="h-3 w-3 shrink-0 rounded-full" style={{ background: t.color }} />
              <span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>{t.name}</span>
              <span style={{ color: "var(--text-ghost)" }}>&mdash;</span>
              <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>{t.desc}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Customer Levels Pyramid */}
      <Section title="Five levels. One commercial hierarchy.">
        <div className="mx-auto max-w-lg space-y-2">
          {customerLevels.map((p, i) => {
            const widths = ["50%", "62%", "75%", "87%", "100%"];
            return (
              <div
                key={p.label}
                className="mx-auto flex h-11 items-center justify-center rounded-lg"
                style={{ width: widths[i], background: p.color }}
              >
                <span className="text-[13px] font-semibold text-white">
                  {p.label} &mdash; {p.realName}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Rights & Benefits */}
      <Section title="What each level unlocks.">
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border-subtle)" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: "var(--bg-surface)" }}>
                <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--text-faint)" }}>&nbsp;</th>
                {levelNames.map((n, i) => (
                  <th key={n} className="px-4 py-3 text-center text-[12px] font-semibold" style={{ color: levelColors[i] }}>{n}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rightsRows.map((r) => (
                <tr key={r.benefit} style={{ borderTop: "1px solid var(--border-faint)" }}>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{r.benefit}</td>
                  {r.values.map((v, j) => (
                    <td key={j} className="px-4 py-3 text-center">
                      {v ? <span style={{ color: "#34C759" }}>&#10003;</span> : <span style={{ color: "var(--text-ghost)" }}>&mdash;</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Responsibilities */}
      <Section title="What each level requires.">
        <DataTable
          headers={["", ...levelNames]}
          rows={dutyRows.map((r) => [
            <span key="d" className="font-medium" style={{ color: "var(--text-primary)" }}>{r.duty}</span>,
            ...r.values,
          ])}
        />
        <Callout>
          Partner level is not only about price. It is about responsibility, investment, and long-term cooperation.
        </Callout>
      </Section>

      {/* Global Strategy */}
      <Section title="Pricing as a growth engine.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {strategies.map((s, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--text-dim)" }} />
              <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>{s}</p>
            </div>
          ))}
        </div>
        <Callout>
          The goal is not only to sell products. The goal is to build a global distribution network and a strong international brand.
        </Callout>
      </Section>
    </PolicyPage>
  );
}
