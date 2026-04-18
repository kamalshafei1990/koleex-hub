"use client";

import Link from "next/link";
import PolicyPage, {
  Section,
  SectionDesc,
  CardGrid,
  InfoCard,
  Callout,
} from "@/components/commercial-policy/PolicyPage";

/* ===== Tool Cards ===== */
const TOOLS = [
  {
    title: "Price Calculator",
    description: "Interactive pricing calculator with product level, market band, and customer level inputs. Generates full price ladder.",
    href: "/knowledge/commercial-policy/tools/pricing-engine/calculator",
    color: "#007AFF",
  },
  {
    title: "Markets & Bands",
    description: "Country-to-band mapping with adjustment factors. See which markets belong to Band A, B, C, or D.",
    href: "/knowledge/commercial-policy/tools/pricing-engine/market-bands",
    color: "#34C759",
  },
  {
    title: "Landed Cost",
    description: "Break down all cost components from FOB to final landed cost. Freight, insurance, customs, delivery, and more.",
    href: "/knowledge/commercial-policy/tools/pricing-engine/landed-cost",
    color: "#FF9500",
  },
  {
    title: "Competitors",
    description: "Competitor price comparison framework. Evaluate and respond to competitive pricing in your market.",
    href: "/knowledge/commercial-policy/tools/pricing-engine/competitors",
    color: "#FF3B30",
  },
  {
    title: "Profit Analysis",
    description: "Analyze profit margins by product level and customer level. Understand profitability across the pricing matrix.",
    href: "/knowledge/commercial-policy/tools/pricing-engine/profit",
    color: "#5856D6",
  },
  {
    title: "Scenario Library",
    description: "Pre-built pricing scenarios for common situations. New market entry, volume deals, competitive response, and more.",
    href: "/knowledge/commercial-policy/tools/pricing-engine/scenarios",
    color: "#AF52DE",
  },
];

/* ===== Key Metrics ===== */
const METRICS = [
  { title: "Product Levels", value: "4", description: "L1 Standard to L4 Enterprise", color: "#007AFF" },
  { title: "Market Bands", value: "4", description: "Band A through Band D", color: "#34C759" },
  { title: "Customer Tiers", value: "4", description: "Platinum, Gold, Silver, Retail", color: "#FF9500" },
  { title: "Price Steps", value: "7", description: "Cost to Retail Market Price", color: "#5856D6" },
];

export default function PricingEngineDashboardPage() {
  return (
    <PolicyPage
      title="Pricing Engine."
      subtitle="Interactive tools for pricing analysis, calculation, and scenario modeling. Everything you need to understand and apply KOLEEX pricing."
      badge="Pricing Engine"
    >
      {/* Key Metrics */}
      <Section title="Engine Overview.">
        <SectionDesc>
          The KOLEEX Pricing Engine processes product costs through a
          multi-layered formula to generate prices for every customer tier and market.
        </SectionDesc>
        <CardGrid cols={4}>
          {METRICS.map((m) => (
            <InfoCard key={m.title} title={m.title} value={m.value} description={m.description} color={m.color} />
          ))}
        </CardGrid>
      </Section>

      {/* Tool Cards */}
      <Section title="Tools.">
        <SectionDesc>
          Select a tool to dive deeper into specific aspects of the pricing system.
        </SectionDesc>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <Link
              key={tool.title}
              href={tool.href}
              className="group rounded-xl border p-5 transition-colors hover:opacity-80"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
            >
              <div className="mb-3 h-1 w-8 rounded-full" style={{ background: tool.color }} />
              <h3
                className="text-[14px] font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {tool.title}
              </h3>
              <p
                className="mt-1 text-[12px] leading-relaxed"
                style={{ color: "var(--text-faint)" }}
              >
                {tool.description}
              </p>
            </Link>
          ))}
        </div>
      </Section>

      <Callout title="Demo Data">
        Tools use reference logic and placeholder data. Results are for
        illustration and training purposes only. Live pricing requires ERP
        integration.
      </Callout>
    </PolicyPage>
  );
}
