"use client";

import PolicyPage, {
  Section,
  SectionDesc,
  CardGrid,
  InfoCard,
  DataTable,
  Callout,
  Badge,
} from "@/components/commercial-policy/PolicyPage";

/* ===== Market Bands (from pricing-config.ts) ===== */
const BANDS = [
  {
    id: "A",
    name: "Band A",
    label: "Price Sensitive Markets",
    adjustment: -0.03,
    adjustmentDisplay: "-3%",
    description: "Highly price sensitive, strong competition, lower margins, volume-driven.",
    countries: ["Egypt", "Nigeria", "Vietnam", "Bangladesh", "Pakistan"],
    color: "#34C759",
  },
  {
    id: "B",
    name: "Band B",
    label: "Balanced Markets",
    adjustment: 0,
    adjustmentDisplay: "0%",
    description: "Balanced markets with normal margins and standard pricing.",
    countries: ["Turkey", "Brazil", "Mexico", "Thailand", "Malaysia", "India", "Saudi Arabia"],
    color: "#007AFF",
  },
  {
    id: "C",
    name: "Band C",
    label: "Premium Markets",
    adjustment: 0.08,
    adjustmentDisplay: "+8%",
    description: "Premium markets where customers value quality and brand. Higher margins possible.",
    countries: ["Germany", "United States", "Japan", "Australia", "UAE", "United Kingdom", "France", "South Korea"],
    color: "#FF9500",
  },
  {
    id: "D",
    name: "Band D",
    label: "Special / Project Markets",
    adjustment: 0,
    adjustmentDisplay: "Custom",
    description: "Special projects, government tenders, OEM, and strategic deals. Custom pricing.",
    countries: [],
    color: "#AF52DE",
  },
];

/* ===== Country-to-Band Mapping (from pricing-config.ts) ===== */
const COUNTRY_MAP = [
  ["Egypt", "A", "Middle East & Africa"],
  ["Nigeria", "A", "Middle East & Africa"],
  ["Vietnam", "A", "Asia Pacific"],
  ["Bangladesh", "A", "Asia Pacific"],
  ["Pakistan", "A", "Asia Pacific"],
  ["Turkey", "B", "Middle East & Africa"],
  ["Brazil", "B", "Americas"],
  ["Mexico", "B", "Americas"],
  ["Thailand", "B", "Asia Pacific"],
  ["Malaysia", "B", "Asia Pacific"],
  ["India", "B", "Asia Pacific"],
  ["Saudi Arabia", "B", "Middle East & Africa"],
  ["Germany", "C", "Europe"],
  ["United States", "C", "Americas"],
  ["Japan", "C", "Asia Pacific"],
  ["Australia", "C", "Asia Pacific"],
  ["UAE", "C", "Middle East & Africa"],
  ["United Kingdom", "C", "Europe"],
  ["France", "C", "Europe"],
  ["South Korea", "C", "Asia Pacific"],
];

/* ===== Band Adjustment Ranges ===== */
const ADJUSTMENT_ROWS = [
  ["Band A", "-5% to -3%", "-3%", "Volume-driven, competitive pricing"],
  ["Band B", "0%", "0%", "Standard baseline pricing"],
  ["Band C", "+5% to +8%", "+8%", "Premium positioning, higher margins"],
  ["Band D", "-10% to +15%", "Custom", "Project-specific, negotiated terms"],
];

export default function MarketBandsPage() {
  return (
    <PolicyPage
      title="Markets & Bands."
      subtitle="Country-to-band mapping, adjustment factors, and regional pricing strategy."
      badge="Pricing Engine"
    >
      {/* Band Overview */}
      <Section title="Market Bands.">
        <SectionDesc>
          KOLEEX groups countries into four market bands based on competitive
          intensity, price sensitivity, and margin potential. Each band applies a
          pricing adjustment to the base price.
        </SectionDesc>
        <CardGrid cols={4}>
          {BANDS.map((band) => (
            <InfoCard
              key={band.id}
              title={band.name}
              value={band.adjustmentDisplay}
              description={band.description}
              color={band.color}
            >
              <p className="mt-2 text-[11px] font-semibold" style={{ color: "var(--text-dim)" }}>
                {band.label}
              </p>
            </InfoCard>
          ))}
        </CardGrid>
      </Section>

      {/* Adjustment Ranges */}
      <Section title="Adjustment Ranges.">
        <SectionDesc>
          Each band has a defined adjustment range and default value applied to the
          base price.
        </SectionDesc>
        <DataTable
          headers={["Band", "Range", "Default", "Strategy"]}
          rows={ADJUSTMENT_ROWS}
        />
      </Section>

      {/* Country Mapping */}
      <Section title="Country Mapping.">
        <SectionDesc>
          Complete country-to-band assignment table. Countries are grouped by
          region.
        </SectionDesc>
        <DataTable
          headers={["Country", "Band", "Region"]}
          rows={COUNTRY_MAP.map((row) => [
            row[0],
            <Badge key={row[0]} label={`Band ${row[1]}`} color={BANDS.find((b) => b.id === row[1])?.color} />,
            row[2],
          ])}
        />
      </Section>

      {/* Band Country Lists */}
      <Section title="Countries by Band.">
        <SectionDesc>
          Quick reference of which countries belong to each band.
        </SectionDesc>
        <div className="space-y-4">
          {BANDS.filter((b) => b.countries.length > 0).map((band) => (
            <div
              key={band.id}
              className="rounded-xl border p-4"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ background: band.color }} />
                <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {band.name} - {band.label}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {band.countries.map((country) => (
                  <span
                    key={country}
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                    style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}
                  >
                    {country}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Callout title="Band Assignment">
        Country-to-band assignments are reviewed annually by the pricing
        committee. Changes require approval from the Pricing Manager and are
        applied at the start of the next fiscal quarter.
      </Callout>
    </PolicyPage>
  );
}
