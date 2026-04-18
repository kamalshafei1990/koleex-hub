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

/* ===== Commission Records (from config) ===== */
const COMMISSION_RECORDS = [
  { id: "cm-001", invoiceNumber: "INV-2026-0142", customer: "Acme Industrial Corp", salesPerson: "Ahmed Hassan", invoiceDate: "2026-02-15", invoiceAmount: 85000, commissionRate: 0.05, commissionAmount: 4250, status: "paid" as const },
  { id: "cm-002", invoiceNumber: "INV-2026-0156", customer: "TechVision Ltd", salesPerson: "Ahmed Hassan", invoiceDate: "2026-02-22", invoiceAmount: 42000, commissionRate: 0.05, commissionAmount: 2100, status: "approved" as const },
  { id: "cm-003", invoiceNumber: "INV-2026-0163", customer: "BuildRight Inc", salesPerson: "Marco Silva", invoiceDate: "2026-03-01", invoiceAmount: 128000, commissionRate: 0.04, commissionAmount: 5120, status: "payable" as const },
  { id: "cm-004", invoiceNumber: "INV-2026-0171", customer: "MetalWorks Co", salesPerson: "David Kim", invoiceDate: "2026-03-05", invoiceAmount: 215000, commissionRate: 0.05, commissionAmount: 10750, status: "calculated" as const },
  { id: "cm-005", invoiceNumber: "INV-2026-0178", customer: "PowerGrid SA", salesPerson: "Fatima Al-Rashid", invoiceDate: "2026-03-08", invoiceAmount: 67000, commissionRate: 0.03, commissionAmount: 2010, status: "pending" as const },
  { id: "cm-006", invoiceNumber: "INV-2026-0185", customer: "Shanghai Electric", salesPerson: "Sarah Chen", invoiceDate: "2026-03-12", invoiceAmount: 340000, commissionRate: 0.04, commissionAmount: 0, status: "pending" as const },
  { id: "cm-007", invoiceNumber: "INV-2026-0192", customer: "Nile Industries", salesPerson: "Ahmed Hassan", invoiceDate: "2026-03-15", invoiceAmount: 56000, commissionRate: 0.05, commissionAmount: 0, status: "pending" as const },
  { id: "cm-008", invoiceNumber: "INV-2026-0098", customer: "OceanTech Marine", salesPerson: "Sarah Chen", invoiceDate: "2026-01-20", invoiceAmount: 95000, commissionRate: 0.04, commissionAmount: 3800, status: "paid" as const },
  { id: "cm-009", invoiceNumber: "INV-2026-0105", customer: "AutoMex SA", salesPerson: "Marco Silva", invoiceDate: "2026-01-28", invoiceAmount: 178000, commissionRate: 0.04, commissionAmount: 7120, status: "paid" as const },
  { id: "cm-010", invoiceNumber: "INV-2026-0134", customer: "EuroParts GmbH", salesPerson: "David Kim", invoiceDate: "2026-02-10", invoiceAmount: 52000, commissionRate: 0.05, commissionAmount: 2600, status: "adjusted" as const },
];

/* ===== Status Colors ===== */
const STATUS_COLORS: Record<string, string> = {
  pending: "#FF9500",
  calculated: "#007AFF",
  approved: "#34C759",
  payable: "#5856D6",
  paid: "#1E1E20",
  cancelled: "#FF3B30",
  adjusted: "#FF9500",
};

/* ===== Basic Calculation Examples ===== */
const BASIC_EXAMPLES = [
  { invoice: 5000, rate: 0.03 },
  { invoice: 15000, rate: 0.03 },
  { invoice: 35000, rate: 0.04 },
  { invoice: 67000, rate: 0.03 },
  { invoice: 85000, rate: 0.05 },
  { invoice: 128000, rate: 0.04 },
  { invoice: 215000, rate: 0.05 },
  { invoice: 500000, rate: 0.05 },
];

/* ===== Sales People ===== */
const SALES_PEOPLE = [
  { name: "Ahmed Hassan", region: "Middle East", tier: "Lead", rate: "5%", totalSales: 1245000, totalCommission: 62250, pending: 8400, color: "#34C759" },
  { name: "Sarah Chen", region: "Asia Pacific", tier: "Senior", rate: "4%", totalSales: 980000, totalCommission: 39200, pending: 5600, color: "#007AFF" },
  { name: "Marco Silva", region: "Latin America", tier: "Senior", rate: "4%", totalSales: 756000, totalCommission: 30240, pending: 4200, color: "#007AFF" },
  { name: "Fatima Al-Rashid", region: "Africa", tier: "Standard", rate: "3%", totalSales: 425000, totalCommission: 12750, pending: 2100, color: "#86868B" },
  { name: "David Kim", region: "Europe", tier: "Lead", rate: "5%", totalSales: 1890000, totalCommission: 94500, pending: 12300, color: "#34C759" },
];

/* ===== Monthly Breakdown ===== */
const MONTHLY_DATA = [
  { month: "January 2026", invoices: 2, totalInvoiced: 273000, totalCommission: 10920 },
  { month: "February 2026", invoices: 3, totalInvoiced: 179000, totalCommission: 7550 },
  { month: "March 2026", invoices: 5, totalInvoiced: 806000, totalCommission: 19980 },
];

function formatUSD(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CommissionExamplesPage() {
  const paidRecords = COMMISSION_RECORDS.filter((r) => r.commissionAmount > 0);
  const avgCommission = paidRecords.length > 0
    ? paidRecords.reduce((s, r) => s + r.commissionAmount, 0) / paidRecords.length
    : 0;
  const highestCommission = Math.max(...paidRecords.map((r) => r.commissionAmount));
  const highestRecord = paidRecords.find((r) => r.commissionAmount === highestCommission);
  const salesCounts: Record<string, number> = {};
  COMMISSION_RECORDS.forEach((r) => {
    salesCounts[r.salesPerson] = (salesCounts[r.salesPerson] || 0) + 1;
  });
  const mostActive = Object.entries(salesCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <PolicyPage
      title="Commission Examples."
      subtitle="Real-world calculations, breakdowns, and transaction records across the sales organization."
      badge="Commission System"
    >
      {/* Key Insights */}
      <Section title="Key Insights.">
        <CardGrid cols={3}>
          <InfoCard
            title="Average Commission"
            value={formatUSD(avgCommission)}
            description={`Across ${paidRecords.length} paid records`}
            color="#007AFF"
          />
          <InfoCard
            title="Highest Single Commission"
            value={formatUSD(highestCommission)}
            description={highestRecord ? highestRecord.customer : ""}
            color="#34C759"
          />
          <InfoCard
            title="Most Active Sales Person"
            value={mostActive ? mostActive[0] : "--"}
            description={mostActive ? `${mostActive[1]} commission records` : ""}
            color="#5856D6"
          />
        </CardGrid>
      </Section>

      {/* Basic Commission Calculations */}
      <Section title="Basic Commission Calculations.">
        <SectionDesc>
          How commission scales at different invoice amounts.
        </SectionDesc>
        <DataTable
          headers={["#", "Invoice Amount", "Rate", "Commission"]}
          rows={BASIC_EXAMPLES.map((ex, i) => [
            String(i + 1),
            <span key={`inv-${i}`} className="font-semibold" style={{ color: "var(--text-primary)" }}>{formatUSD(ex.invoice)}</span>,
            <Badge key={`rate-${i}`} label={`${(ex.rate * 100).toFixed(0)}%`} color="#007AFF" />,
            <span key={`com-${i}`} className="font-bold" style={{ color: "#34C759" }}>{formatUSD(ex.invoice * ex.rate)}</span>,
          ])}
        />
      </Section>

      {/* Sales Team Overview */}
      <Section title="Sales Team Overview.">
        <SectionDesc>
          Commission performance by sales person.
        </SectionDesc>
        <CardGrid cols={3}>
          {SALES_PEOPLE.map((sp) => (
            <InfoCard key={sp.name} title={sp.name} color={sp.color}>
              <div className="mt-2 flex items-center gap-2">
                <Badge label={sp.tier} color={sp.color} />
                <span className="text-[12px]" style={{ color: "var(--text-faint)" }}>{sp.region}</span>
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-[12px]">
                  <span style={{ color: "var(--text-faint)" }}>Rate</span>
                  <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{sp.rate}</span>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                  <span style={{ color: "var(--text-faint)" }}>Total Sales</span>
                  <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{formatUSD(sp.totalSales)}</span>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                  <span style={{ color: "var(--text-faint)" }}>Commission Earned</span>
                  <span className="font-bold" style={{ color: "#34C759" }}>{formatUSD(sp.totalCommission)}</span>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                  <span style={{ color: "var(--text-faint)" }}>Pending</span>
                  <span className="font-bold" style={{ color: "#FF9500" }}>{formatUSD(sp.pending)}</span>
                </div>
              </div>
            </InfoCard>
          ))}
        </CardGrid>
      </Section>

      {/* Monthly Breakdown */}
      <Section title="Monthly Breakdown.">
        <SectionDesc>
          Commission performance by month.
        </SectionDesc>
        <DataTable
          headers={["Month", "Invoices", "Total Invoiced", "Total Commission"]}
          rows={[
            ...MONTHLY_DATA.map((m) => [
              <span key={m.month} className="font-semibold" style={{ color: "var(--text-primary)" }}>{m.month}</span>,
              String(m.invoices),
              formatUSD(m.totalInvoiced),
              <span key={`com-${m.month}`} className="font-bold" style={{ color: "#34C759" }}>{formatUSD(m.totalCommission)}</span>,
            ]),
            [
              <span key="total" className="font-bold" style={{ color: "var(--text-primary)" }}>Total</span>,
              <span key="total-inv" className="font-bold">{String(MONTHLY_DATA.reduce((s, m) => s + m.invoices, 0))}</span>,
              <span key="total-invoiced" className="font-bold">{formatUSD(MONTHLY_DATA.reduce((s, m) => s + m.totalInvoiced, 0))}</span>,
              <span key="total-com" className="font-bold" style={{ color: "#34C759" }}>{formatUSD(MONTHLY_DATA.reduce((s, m) => s + m.totalCommission, 0))}</span>,
            ],
          ]}
        />
      </Section>

      {/* Recent Transactions */}
      <Section title="Recent Transactions.">
        <SectionDesc>
          All commission records from the system.
        </SectionDesc>
        <DataTable
          headers={["Invoice", "Customer", "Sales Person", "Date", "Amount", "Rate", "Commission", "Status"]}
          rows={COMMISSION_RECORDS.map((r) => [
            <span key={`inv-${r.id}`} className="font-semibold" style={{ color: "var(--text-primary)" }}>{r.invoiceNumber}</span>,
            r.customer,
            r.salesPerson,
            r.invoiceDate,
            formatUSD(r.invoiceAmount),
            <Badge key={`rate-${r.id}`} label={`${(r.commissionRate * 100).toFixed(0)}%`} color="#007AFF" />,
            r.commissionAmount > 0 ? formatUSD(r.commissionAmount) : "--",
            <Badge key={`status-${r.id}`} label={r.status.charAt(0).toUpperCase() + r.status.slice(1)} color={STATUS_COLORS[r.status]} />,
          ])}
        />
      </Section>

      <Callout>
        Commission records are generated automatically by the system when invoices are paid. Records shown here reflect real system data for illustration purposes.
      </Callout>
    </PolicyPage>
  );
}
