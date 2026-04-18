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

const CUSTOMER_LEVELS = [
  { id: "end_user", name: "End User", level: 0, hasCredit: false, creditLimit: "None", creditDays: 0, color: "#86868B" },
  { id: "silver", name: "Silver", level: 1, hasCredit: false, creditLimit: "None", creditDays: 0, color: "#A8A9AD" },
  { id: "gold", name: "Gold", level: 2, hasCredit: true, creditLimit: "Avg Monthly x 3", creditDays: 90, color: "#C9973F" },
  { id: "platinum", name: "Platinum", level: 3, hasCredit: true, creditLimit: "Avg Monthly x 4", creditDays: 120, color: "#7BA1C2" },
  { id: "diamond", name: "Diamond", level: 4, hasCredit: true, creditLimit: "Open (Contract)", creditDays: "Annual", color: "#00BFFF" },
];

const LEVEL_NOTES: Record<string, string> = {
  end_user: "Cash only. No credit facility.",
  silver: "Cash only. Build purchase history to unlock credit at Gold.",
  gold: "First credit tier. Limit = Avg Monthly x 3 months.",
  platinum: "Higher credit. Limit = Avg Monthly x 4 months.",
  diamond: "Open credit by contract. Annual settlement terms.",
};

const EXAMPLES = [
  { name: "Ahmed Trading Co", level: "Gold", levelColor: "#C9973F", avgMonthly: 45000, creditMonths: 3, creditDays: 90 },
  { name: "TechVision Industries", level: "Platinum", levelColor: "#7BA1C2", avgMonthly: 180000, creditMonths: 4, creditDays: 120 },
  { name: "Small Trader (hypothetical)", level: "Gold", levelColor: "#C9973F", avgMonthly: 20000, creditMonths: 3, creditDays: 90 },
];

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US");
}

export default function CreditMatrixPage() {
  return (
    <PolicyPage
      title="Credit Matrix."
      subtitle="Credit limits, days, and formulas for every customer level in one clear view."
      badge="Credit System"
    >
      {/* Explanation */}
      <Section title="How Credit Limits Are Calculated">
        <SectionDesc>
          Credit limits are not arbitrary. They are calculated using a simple, transparent formula
          based on the customer&apos;s average monthly purchase volume multiplied by the number of credit
          months for their level. This ensures credit scales proportionally with actual business
          activity.
        </SectionDesc>
      </Section>

      {/* Formula */}
      <Section title="The Formula">
        <SectionDesc>One simple rule drives all credit limit calculations.</SectionDesc>
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: "var(--bg-inverted)", color: "var(--text-inverted)" }}
        >
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="rounded-lg px-5 py-3" style={{ background: "rgba(255,255,255,0.1)" }}>
              <p className="text-[10px] uppercase tracking-wider" style={{ opacity: 0.6 }}>
                Average Monthly
              </p>
              <p className="text-[18px] font-bold">Purchase</p>
            </div>
            <span className="text-[24px] font-light" style={{ opacity: 0.5 }}>x</span>
            <div className="rounded-lg px-5 py-3" style={{ background: "rgba(255,255,255,0.1)" }}>
              <p className="text-[10px] uppercase tracking-wider" style={{ opacity: 0.6 }}>
                Credit
              </p>
              <p className="text-[18px] font-bold">Months</p>
            </div>
            <span className="text-[24px] font-light" style={{ opacity: 0.5 }}>=</span>
            <div className="rounded-lg px-5 py-3" style={{ background: "rgba(255,255,255,0.1)" }}>
              <p className="text-[10px] uppercase tracking-wider" style={{ opacity: 0.6 }}>
                Maximum
              </p>
              <p className="text-[18px] font-bold">Credit Limit</p>
            </div>
          </div>
          <p className="mt-4 text-[12px]" style={{ opacity: 0.5 }}>
            Gold = Avg Monthly x 3 | Platinum = Avg Monthly x 4 | Diamond = Contract-based
          </p>
        </div>
      </Section>

      {/* Credit Matrix Table */}
      <Section title="Credit Matrix">
        <SectionDesc>Full credit access by customer level.</SectionDesc>
        <DataTable
          headers={["Level", "Has Credit", "Credit Limit", "Credit Days", "Notes"]}
          rows={CUSTOMER_LEVELS.map((level) => [
            <span key="lvl" className="flex items-center gap-2">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: level.color }}
              >
                {level.level}
              </span>
              <span className="font-medium" style={{ color: "var(--text-primary)" }}>{level.name}</span>
            </span>,
            level.hasCredit ? (
              <span key="yc" style={{ color: "#34C759" }}>Yes</span>
            ) : (
              <span key="nc" style={{ color: "#FF3B30" }}>No</span>
            ),
            level.creditLimit,
            typeof level.creditDays === "number"
              ? level.creditDays > 0
                ? `${level.creditDays} days`
                : "--"
              : String(level.creditDays),
            <span key="note" className="text-[11px]">{LEVEL_NOTES[level.id]}</span>,
          ])}
        />
      </Section>

      {/* Example Calculations */}
      <Section title="Example Calculations">
        <SectionDesc>How the formula works with real numbers.</SectionDesc>
        <CardGrid cols={3}>
          {EXAMPLES.map((ex, i) => {
            const result = ex.avgMonthly * ex.creditMonths;
            return (
              <InfoCard key={i} title={ex.name} color={ex.levelColor}>
                <p className="mt-1 text-[11px]" style={{ color: "var(--text-dim)" }}>
                  {ex.level} Customer
                </p>
                <div className="mt-3 space-y-2 text-[12px]">
                  <div className="flex justify-between">
                    <span style={{ color: "var(--text-faint)" }}>Avg Monthly</span>
                    <span style={{ color: "var(--text-primary)" }}>{fmt(ex.avgMonthly)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--text-faint)" }}>Credit Months</span>
                    <span style={{ color: "var(--text-primary)" }}>x {ex.creditMonths}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--text-faint)" }}>Credit Days</span>
                    <span style={{ color: "var(--text-primary)" }}>{ex.creditDays} days</span>
                  </div>
                  <div
                    className="mt-2 border-t pt-2"
                    style={{ borderColor: "var(--border-faint)" }}
                  >
                    <div className="flex justify-between">
                      <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                        Credit Limit
                      </span>
                      <span className="font-bold" style={{ color: ex.levelColor }}>
                        {fmt(result)}
                      </span>
                    </div>
                  </div>
                </div>
              </InfoCard>
            );
          })}
        </CardGrid>
      </Section>

      {/* Credit Scale */}
      <Section title="Credit Scale">
        <SectionDesc>How credit access grows with customer level.</SectionDesc>
        <div className="space-y-3">
          {CUSTOMER_LEVELS.map((level) => {
            const barWidth =
              level.id === "end_user" || level.id === "silver"
                ? 0
                : level.id === "gold"
                  ? 30
                  : level.id === "platinum"
                    ? 55
                    : 100;
            return (
              <div key={level.id} className="flex items-center gap-4">
                <div className="flex w-24 shrink-0 items-center gap-2">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{ background: level.color }}
                  >
                    {level.level}
                  </span>
                  <span className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>
                    {level.name}
                  </span>
                </div>
                <div
                  className="h-7 flex-1 overflow-hidden rounded-full"
                  style={{ background: "var(--bg-surface)" }}
                >
                  {barWidth > 0 ? (
                    <div
                      className="flex h-full items-center justify-end rounded-full pr-3"
                      style={{ width: `${barWidth}%`, background: level.color }}
                    >
                      <span className="text-[10px] font-bold text-white">{level.creditLimit}</span>
                    </div>
                  ) : (
                    <div className="flex h-full items-center pl-3">
                      <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>
                        No Credit
                      </span>
                    </div>
                  )}
                </div>
                <span className="w-16 shrink-0 text-right text-[11px]" style={{ color: "var(--text-faint)" }}>
                  {typeof level.creditDays === "number"
                    ? level.creditDays > 0
                      ? `${level.creditDays}d`
                      : "--"
                    : "Annual"}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Management Override */}
      <Callout title="Management Override">
        If a customer needs to place an order that exceeds their calculated credit limit, management
        approval is required. The formula provides the baseline, but business decisions can override
        the limit on a case-by-case basis with proper authorization.
      </Callout>
    </PolicyPage>
  );
}
