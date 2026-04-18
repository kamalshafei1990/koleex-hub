"use client";

import PolicyPage, {
  Section,
  SectionDesc,
  CardGrid,
  InfoCard,
  Callout,
  Badge,
} from "@/components/commercial-policy/PolicyPage";

/* ===== Sales People ===== */
const SALES_PEOPLE = [
  { name: "David Kim", region: "Europe", tier: "Lead", totalSales: 1890000, totalCommission: 94500 },
  { name: "Ahmed Hassan", region: "Middle East", tier: "Lead", totalSales: 1245000, totalCommission: 62250 },
  { name: "Sarah Chen", region: "Asia Pacific", tier: "Senior", totalSales: 980000, totalCommission: 39200 },
  { name: "Marco Silva", region: "Latin America", tier: "Senior", totalSales: 756000, totalCommission: 30240 },
  { name: "Fatima Al-Rashid", region: "Africa", tier: "Standard", totalSales: 425000, totalCommission: 12750 },
];

/* ===== Monthly Trend Data ===== */
const MONTHLY_TREND = [
  { month: "Oct", commission: 18500 },
  { month: "Nov", commission: 24200 },
  { month: "Dec", commission: 31400 },
  { month: "Jan", commission: 10920 },
  { month: "Feb", commission: 7550 },
  { month: "Mar", commission: 19980 },
];

/* ===== Rate Comparison (on $100,000 invoice) ===== */
const RATE_COMPARISON = [
  { rate: 3, label: "Standard", amount: 3000, color: "#86868B" },
  { rate: 4, label: "Senior", amount: 4000, color: "#007AFF" },
  { rate: 5, label: "Lead", amount: 5000, color: "#34C759" },
];

/* ===== Ranking Colors ===== */
const RANK_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32", "#007AFF", "#5856D6"];

function formatUSD(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CommissionVisualsPage() {
  const maxSales = SALES_PEOPLE[0]?.totalSales || 1;
  const maxMonthly = Math.max(...MONTHLY_TREND.map((m) => m.commission));

  return (
    <PolicyPage
      title="Visual Commission Analysis."
      subtitle="Charts and diagrams illustrating commission distribution, performance trends, and rate comparisons across the sales organization."
      badge="Commission System"
    >
      {/* Commission vs Sales */}
      <Section title="Commission vs Total Sales.">
        <SectionDesc>
          Per sales person, sorted by total sales.
        </SectionDesc>
        <div className="space-y-6">
          {SALES_PEOPLE.map((sp) => {
            const salesPct = (sp.totalSales / maxSales) * 100;
            const commPct = (sp.totalCommission / maxSales) * 100;
            return (
              <div key={sp.name}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{sp.name}</span>
                  <span className="text-[12px]" style={{ color: "var(--text-faint)" }}>{sp.region}</span>
                </div>
                {/* Sales bar */}
                <div className="mb-1.5 h-8 w-full overflow-hidden rounded-lg" style={{ background: "var(--bg-surface)" }}>
                  <div
                    className="flex h-full items-center justify-end rounded-lg px-3"
                    style={{ width: `${salesPct}%`, background: "var(--bg-surface-subtle)", minWidth: "60px" }}
                  >
                    <span className="text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>
                      {formatUSD(sp.totalSales)}
                    </span>
                  </div>
                </div>
                {/* Commission bar */}
                <div className="h-8 w-full overflow-hidden rounded-lg" style={{ background: "var(--bg-surface)" }}>
                  <div
                    className="flex h-full items-center rounded-lg px-3"
                    style={{ width: `${Math.max(commPct, 5)}%`, background: "#007AFF", minWidth: "60px" }}
                  >
                    <span className="text-[11px] font-bold text-white">
                      {formatUSD(sp.totalCommission)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded" style={{ background: "var(--bg-surface-subtle)" }} />
            <span className="text-[12px]" style={{ color: "var(--text-faint)" }}>Total Sales</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded" style={{ background: "#007AFF" }} />
            <span className="text-[12px]" style={{ color: "var(--text-faint)" }}>Total Commission</span>
          </div>
        </div>
      </Section>

      {/* Monthly Commission Trend */}
      <Section title="Monthly Commission Trend.">
        <SectionDesc>
          6-month rolling commission totals.
        </SectionDesc>
        <div
          className="flex items-end justify-between gap-4 rounded-xl p-6"
          style={{ background: "var(--bg-surface-subtle)", minHeight: 240 }}
        >
          {MONTHLY_TREND.map((m) => {
            const heightPct = (m.commission / maxMonthly) * 100;
            return (
              <div key={m.month} className="flex flex-1 flex-col items-center justify-end" style={{ height: 200 }}>
                <span className="mb-2 text-[11px] font-bold" style={{ color: "var(--text-primary)" }}>
                  {formatUSD(m.commission)}
                </span>
                <div
                  className="w-10 rounded-t-lg md:w-14"
                  style={{ height: `${heightPct}%`, background: "#34C759", minHeight: 8 }}
                />
                <span className="mt-2 text-[11px] font-semibold" style={{ color: "var(--text-faint)" }}>
                  {m.month}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Performance Ranking */}
      <Section title="Performance Ranking.">
        <SectionDesc>
          Sorted by total commission earned.
        </SectionDesc>
        <div className="space-y-3">
          {[...SALES_PEOPLE]
            .sort((a, b) => b.totalCommission - a.totalCommission)
            .map((sp, i) => (
              <div
                key={sp.name}
                className="flex items-center gap-4 rounded-xl border p-5"
                style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
              >
                {/* Rank */}
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl font-black"
                  style={{ background: `${RANK_COLORS[i]}15`, color: RANK_COLORS[i] }}
                >
                  {i + 1}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>{sp.name}</p>
                  <p className="text-[12px]" style={{ color: "var(--text-faint)" }}>
                    {sp.region} &middot; {sp.tier} tier
                  </p>
                </div>

                {/* Commission */}
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{formatUSD(sp.totalCommission)}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>from {formatUSD(sp.totalSales)} in sales</p>
                </div>
              </div>
            ))}
        </div>
      </Section>

      {/* Rate Comparison */}
      <Section title="Commission Rate Comparison.">
        <SectionDesc>
          How 3%, 4%, and 5% rates compare on the same $100,000 invoice.
        </SectionDesc>
        <CardGrid cols={3}>
          {RATE_COMPARISON.map((rc) => (
            <InfoCard key={rc.rate} title={`${rc.label} Tier`} value={formatUSD(rc.amount)} description="on a $100,000 invoice" color={rc.color}>
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--bg-surface)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(rc.amount / 5000) * 100}%`, background: rc.color }}
                  />
                </div>
                <p className="mt-2 text-center text-xl font-black" style={{ color: rc.color }}>{rc.rate}%</p>
              </div>
            </InfoCard>
          ))}
        </CardGrid>
        <div className="mt-4">
          <Callout>
            <strong>$2,000 difference between tiers.</strong> Moving from Standard (3%) to Lead (5%) on a $100,000 invoice yields a 67% increase in commission earnings for top-tier performers.
          </Callout>
        </div>
      </Section>
    </PolicyPage>
  );
}
