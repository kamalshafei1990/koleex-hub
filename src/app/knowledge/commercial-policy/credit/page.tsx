"use client";

import Link from "next/link";
import PolicyPage, {
  Section,
  SectionDesc,
  CardGrid,
  InfoCard,
  DataTable,
  Callout,
  Badge,
} from "@/components/commercial-policy/PolicyPage";

const LEVEL_COLORS: Record<string, string> = {
  end_user: "#86868B",
  silver: "#A8A9AD",
  gold: "#C9973F",
  platinum: "#7BA1C2",
  diamond: "#00BFFF",
};

const CUSTOMER_LEVELS = [
  { id: "end_user", name: "End User", level: 0, hasCredit: false, creditLimit: "None", creditDays: 0, color: "#86868B" },
  { id: "silver", name: "Silver", level: 1, hasCredit: false, creditLimit: "None", creditDays: 0, color: "#A8A9AD" },
  { id: "gold", name: "Gold", level: 2, hasCredit: true, creditLimit: "Avg Monthly x 3", creditDays: 90, color: "#C9973F" },
  { id: "platinum", name: "Platinum", level: 3, hasCredit: true, creditLimit: "Avg Monthly x 4", creditDays: 120, color: "#7BA1C2" },
  { id: "diamond", name: "Diamond", level: 4, hasCredit: true, creditLimit: "Open (Contract)", creditDays: "Annual", color: "#00BFFF" },
];

const PROFILES = [
  { name: "Ahmed Trading Co", country: "Egypt", level: "gold", creditLimit: 135000, outstanding: 42000, available: 93000, status: "active" },
  { name: "TechVision Industries", country: "Turkey", level: "platinum", creditLimit: 720000, outstanding: 310000, available: 410000, status: "active" },
  { name: "BuildRight Inc", country: "Brazil", level: "silver", creditLimit: 0, outstanding: 0, available: 0, status: "no_credit" },
  { name: "PowerGrid SA", country: "South Africa", level: "gold", creditLimit: 105000, outstanding: 98000, available: 7000, status: "on_hold" },
  { name: "Gulf Industrial Group", country: "UAE", level: "diamond", creditLimit: 2000000, outstanding: 680000, available: 1320000, status: "active" },
  { name: "Metro Electronics", country: "Pakistan", level: "end_user", creditLimit: 0, outstanding: 0, available: 0, status: "no_credit" },
];

const whatIsCredit = [
  { title: "Risk Control", description: "Credit is not given freely. It is earned through purchase history and customer level. Every credit decision protects KOLEEX from financial exposure.", color: "#FF3B30" },
  { title: "Growth Enabler", description: "Credit allows proven customers to order more, restock faster, and grow their business. Higher levels unlock greater credit limits.", color: "#34C759" },
  { title: "Trust Builder", description: "Credit is a signal of trust. It rewards loyalty, consistent payment, and long-term commitment with increasing financial flexibility.", color: "#007AFF" },
];

const navLinks = [
  { href: "/knowledge/commercial-policy/credit/policy", label: "Credit Policy", desc: "10 protection rules" },
  { href: "/knowledge/commercial-policy/credit/customer-levels", label: "Customer Levels", desc: "5 levels comparison" },
  { href: "/knowledge/commercial-policy/credit/matrix", label: "Credit Matrix", desc: "Limits, days, formulas" },
  { href: "/knowledge/commercial-policy/credit/flow", label: "Credit Flow", desc: "12-step process" },
  { href: "/knowledge/commercial-policy/credit/limits", label: "Credit Limits", desc: "Calculation & rules" },
  { href: "/knowledge/commercial-policy/credit/days", label: "Credit Days", desc: "Payment terms by level" },
  { href: "/knowledge/commercial-policy/credit/overdue", label: "Overdue Policy", desc: "Escalation ladder" },
  { href: "/knowledge/commercial-policy/credit/upgrade", label: "Upgrade Logic", desc: "Level progression" },
  { href: "/knowledge/commercial-policy/credit/profiles", label: "Customer Profiles", desc: "Mock credit profiles" },
  { href: "/knowledge/commercial-policy/credit/examples", label: "Examples", desc: "Real scenarios" },
  { href: "/knowledge/commercial-policy/credit/calculator", label: "Calculator", desc: "Interactive tool" },
  { href: "/knowledge/commercial-policy/credit/faq", label: "FAQ", desc: "Common questions" },
];

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US");
}

export default function CreditOverviewPage() {
  const activeCredit = PROFILES.filter((p) => p.status === "active" && p.creditLimit > 0);
  const totalExtended = PROFILES.reduce((s, p) => s + p.creditLimit, 0);
  const totalOutstanding = PROFILES.reduce((s, p) => s + p.outstanding, 0);
  const creditDaysArr = PROFILES.filter((p) => p.creditLimit > 0);
  const avgDays = creditDaysArr.length
    ? Math.round(
        creditDaysArr.reduce((s, p) => {
          const lvl = CUSTOMER_LEVELS.find((l) => l.id === p.level);
          return s + (typeof lvl?.creditDays === "number" ? lvl.creditDays : 365);
        }, 0) / creditDaysArr.length,
      )
    : 0;

  return (
    <PolicyPage
      title="Credit System."
      subtitle="Managing financial trust through structured credit levels, clear policies, and automated risk controls."
      badge="Credit System"
    >
      {/* What is Credit */}
      <Section title="What is Credit?">
        <SectionDesc>
          Credit is the ability for a customer to place orders and pay later, within defined limits and timelines.
        </SectionDesc>
        <CardGrid cols={3}>
          {whatIsCredit.map((c) => (
            <InfoCard key={c.title} title={c.title} description={c.description} color={c.color} />
          ))}
        </CardGrid>
      </Section>

      {/* Key Stats */}
      <Section title="Key Stats">
        <SectionDesc>Current credit portfolio at a glance.</SectionDesc>
        <CardGrid cols={4}>
          <InfoCard title="Active Credit" value={String(activeCredit.length)} description="Customers with active credit" />
          <InfoCard title="Total Extended" value={fmt(totalExtended)} description="Total credit limits" />
          <InfoCard title="Outstanding" value={fmt(totalOutstanding)} description="Total outstanding balance" />
          <InfoCard title="Avg Credit Days" value={`${avgDays} days`} description="Average payment window" />
        </CardGrid>
      </Section>

      {/* Credit by Level */}
      <Section title="Credit by Level">
        <SectionDesc>Credit access is tied to customer level. Higher levels unlock more credit.</SectionDesc>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CUSTOMER_LEVELS.map((level) => (
            <div
              key={level.id}
              className="rounded-xl border p-4 text-center"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
            >
              <div
                className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold text-white"
                style={{ background: level.color }}
              >
                {level.level}
              </div>
              <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                {level.name}
              </p>
              <div className="mt-2 space-y-0.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
                <p>Credit: {level.hasCredit ? "Yes" : "No"}</p>
                <p>Limit: {level.creditLimit}</p>
                <p>Days: {String(level.creditDays)}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Portfolio Snapshot */}
      <Section title="Portfolio Snapshot">
        <SectionDesc>Current credit customers and their utilization.</SectionDesc>
        <DataTable
          headers={["Customer", "Level", "Credit Limit", "Outstanding", "Available", "Status"]}
          rows={PROFILES.map((p) => {
            const lvl = CUSTOMER_LEVELS.find((l) => l.id === p.level);
            const utilization =
              p.creditLimit > 0 ? Math.round((p.outstanding / p.creditLimit) * 100) : 0;
            return [
              <span key="name">
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                  {p.name}
                </span>
                <br />
                <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                  {p.country}
                </span>
              </span>,
              <Badge key="level" label={lvl?.name ?? ""} color={lvl?.color} />,
              p.creditLimit > 0 ? fmt(p.creditLimit) : "--",
              p.outstanding > 0 ? fmt(p.outstanding) : "--",
              p.available > 0 ? fmt(p.available) : "--",
              p.creditLimit > 0 ? `${utilization}% used` : "No Credit",
            ];
          })}
        />
      </Section>

      {/* Explore */}
      <Section title="Explore">
        <SectionDesc>Dive deeper into each aspect of the credit system.</SectionDesc>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {navLinks.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-xl border p-4 transition-colors hover:opacity-80"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
            >
              <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                {n.label}
              </p>
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-faint)" }}>
                {n.desc}
              </p>
            </Link>
          ))}
        </div>
      </Section>
    </PolicyPage>
  );
}
