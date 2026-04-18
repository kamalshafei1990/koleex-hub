"use client";

import PolicyPage, {
  Section,
  SectionDesc,
  DataTable,
  CardGrid,
  InfoCard,
  Callout,
  Badge,
} from "@/components/commercial-policy/PolicyPage";

const CUSTOMER_LEVELS = [
  {
    level: 0, id: "end_user", name: "End User", color: "#86868B",
    description: "Personal or small direct customer. Single item or small quantity purchases for personal use, not trading.",
    hasCredit: false, creditLimit: "None", creditDays: "0",
    priceAccess: "Retail Price", discountAccess: "None", supportLevel: "Basic", marketRights: "None",
    upgradeRequirement: "Invoice <= $2,000 or quantity < 10 items",
  },
  {
    level: 1, id: "silver", name: "Silver", color: "#A8A9AD",
    description: "Small trader or first commercial customer. First commercial-size order qualifies.",
    hasCredit: false, creditLimit: "None", creditDays: "0",
    priceAccess: "Silver Price (Dealer)", discountAccess: "Limited", supportLevel: "Standard", marketRights: "Non-exclusive",
    upgradeRequirement: "First commercial order (e.g. $15,000+)",
  },
  {
    level: 2, id: "gold", name: "Gold", color: "#C9973F",
    description: "Distributor-level customer with proven purchase history and credit eligibility.",
    hasCredit: true, creditLimit: "Limited (Avg Monthly x 3)", creditDays: "90 days",
    priceAccess: "Gold Price (Distributor)", discountAccess: "Standard", supportLevel: "Priority", marketRights: "Non-exclusive",
    upgradeRequirement: "Total purchase lifetime >= $500,000",
  },
  {
    level: 3, id: "platinum", name: "Platinum", color: "#7BA1C2",
    description: "Major distributor with significant volume and extended credit access.",
    hasCredit: true, creditLimit: "Higher (Avg Monthly x 4)", creditDays: "120 days",
    priceAccess: "Platinum Price (Agent)", discountAccess: "Enhanced", supportLevel: "Dedicated", marketRights: "Priority territory",
    upgradeRequirement: "Total purchase lifetime >= $3,000,000",
  },
  {
    level: 4, id: "diamond", name: "Diamond", color: "#00BFFF",
    description: "Sole agent / exclusive strategic partner. Contract required. Market exclusivity and territory protection.",
    hasCredit: true, creditLimit: "Open Credit (Contract)", creditDays: "Annual Settlement",
    priceAccess: "Best Price (Contract)", discountAccess: "Full / Contract", supportLevel: "Strategic / VIP", marketRights: "Exclusive territory",
    upgradeRequirement: "Contract + Management Approval + Sole Agent Agreement",
  },
];

const UPGRADE_PATHS = [
  { from: "End User", to: "Silver", requirement: "First commercial order ($15,000+)", automatic: true },
  { from: "Silver", to: "Gold", requirement: "Total purchase lifetime >= $500,000", automatic: false },
  { from: "Gold", to: "Platinum", requirement: "Total purchase lifetime >= $3,000,000", automatic: false },
  { from: "Platinum", to: "Diamond", requirement: "Contract + Sole Agent Agreement + Management Approval", automatic: false },
];

const DETAIL_FIELDS = [
  { key: "creditLimit" as const, label: "Credit Limit" },
  { key: "creditDays" as const, label: "Credit Days" },
  { key: "priceAccess" as const, label: "Price Access" },
  { key: "discountAccess" as const, label: "Discount Access" },
  { key: "supportLevel" as const, label: "Support Level" },
  { key: "marketRights" as const, label: "Market Rights" },
];

export default function CustomerLevelsPage() {
  return (
    <PolicyPage
      title="Customer Levels."
      subtitle="5 levels from End User to Diamond, each unlocking greater benefits, credit access, and partnership privileges."
      badge="Credit System"
    >
      {/* How Levels Work */}
      <Section title="How Customer Levels Work">
        <SectionDesc>
          Every customer starts as an End User or Silver. As they build purchase history, they
          qualify for higher levels. Each level upgrade unlocks better pricing, higher credit limits,
          longer payment terms, and expanded market rights. Levels are based on total lifetime purchase
          value, not monthly volume alone.
        </SectionDesc>
      </Section>

      {/* All 5 Levels */}
      <Section title="All 5 Levels">
        <SectionDesc>Complete comparison of every customer level.</SectionDesc>
        <div className="space-y-4">
          {CUSTOMER_LEVELS.map((level) => (
            <div
              key={level.id}
              className="overflow-hidden rounded-xl border"
              style={{ borderColor: level.id === "diamond" ? "#00BFFF40" : "var(--border-subtle)", background: "var(--bg-card)" }}
            >
              {/* Header */}
              <div className="flex items-start gap-4 p-5">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[14px] font-bold text-white"
                  style={{ background: level.color }}
                >
                  L{level.level}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge label={`Level ${level.level}`} color={level.color} />
                    <span className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>
                      {level.name}
                    </span>
                    {level.id === "diamond" && (
                      <Badge label="Strategic Partner -- Contract Required" color="#00BFFF" />
                    )}
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--text-faint)" }}>
                    {level.description}
                  </p>
                </div>
              </div>

              {/* Details */}
              <div
                className="grid grid-cols-2 gap-3 border-t px-5 py-4 md:grid-cols-3 lg:grid-cols-7"
                style={{ borderColor: "var(--border-faint)" }}
              >
                <div>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                    Credit Access
                  </p>
                  <p
                    className="mt-0.5 text-[13px] font-semibold"
                    style={{ color: level.hasCredit ? "#34C759" : "#FF3B30" }}
                  >
                    {level.hasCredit ? "Yes" : "No"}
                  </p>
                </div>
                {DETAIL_FIELDS.map((field) => (
                  <div key={field.key}>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                      {field.label}
                    </p>
                    <p className="mt-0.5 text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                      {level[field.key]}
                    </p>
                  </div>
                ))}
              </div>

              {/* Upgrade requirement */}
              <div
                className="border-t px-5 py-3"
                style={{ borderColor: "var(--border-faint)", background: "var(--bg-surface-subtle)" }}
              >
                <p className="text-[12px]" style={{ color: "var(--text-faint)" }}>
                  <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Upgrade:</span>{" "}
                  {level.upgradeRequirement}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Side-by-Side Comparison */}
      <Section title="Side-by-Side Comparison">
        <SectionDesc>Quick reference table for all levels.</SectionDesc>
        <DataTable
          headers={["Attribute", "End User", "Silver", "Gold", "Platinum", "Diamond"]}
          rows={[
            ["Level #", "0", "1", "2", "3", "4"],
            ["Credit Access", "No", "No", "Yes", "Yes", "Yes"],
            ["Credit Limit", "None", "None", "Avg x 3", "Avg x 4", "Contract"],
            ["Credit Days", "0", "0", "90", "120", "Annual"],
            ["Price Access", "Retail", "Silver", "Gold", "Platinum", "Best"],
            ["Discount", "None", "Limited", "Standard", "Enhanced", "Full"],
            ["Support", "Basic", "Standard", "Priority", "Dedicated", "VIP"],
            ["Market Rights", "None", "Non-excl.", "Non-excl.", "Priority", "Exclusive"],
          ]}
        />
      </Section>

      {/* Upgrade Ladder */}
      <Section title="Upgrade Ladder">
        <SectionDesc>How customers progress from one level to the next.</SectionDesc>
        <div className="space-y-3">
          {UPGRADE_PATHS.map((path, i) => {
            const fromLvl = CUSTOMER_LEVELS.find((l) => l.name === path.from);
            const toLvl = CUSTOMER_LEVELS.find((l) => l.name === path.to);
            return (
              <div
                key={i}
                className="flex items-center gap-4 rounded-xl border p-4"
                style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
              >
                <Badge label={path.from} color={fromLvl?.color} />
                <span className="text-[14px]" style={{ color: "var(--text-dim)" }}>
                  &rarr;
                </span>
                <Badge label={path.to} color={toLvl?.color} />
                <span className="flex-1 text-[12px]" style={{ color: "var(--text-faint)" }}>
                  {path.requirement}
                </span>
                <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>
                  {path.automatic ? "Automatic" : "Manual approval"}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Diamond Highlight */}
      <Callout title="Diamond Level" color="#00BFFF">
        The highest level of partnership. Diamond customers are sole agents with exclusive territory
        rights. They receive open credit with annual settlement, the best pricing, full discount
        access, and dedicated strategic support. This level is invitation-only and requires a formal
        contract.
      </Callout>
    </PolicyPage>
  );
}
