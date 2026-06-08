/* ThreatList — top offending IPs, compact (Phase 2A · A3).
   Top 5, humanized columns, monochrome. Rows are NOT clickable yet — the
   investigation drawer arrives in A4. RSC-safe. */

import type { ReportIp } from "@/lib/security/view-model";
import SectionCard from "./SectionCard";
import DataTable, { type Column } from "./DataTable";

export interface ThreatListProps {
  ips: ReportIp[];
}

const COLUMNS: Column<ReportIp>[] = [
  { key: "ip", header: "IP", render: (r) => <span className="font-mono text-[var(--text-primary)]">{r.ipAddress}</span> },
  { key: "failed", header: "Failed", align: "right", render: (r) => r.failures },
  { key: "total", header: "Total", align: "right", render: (r) => r.total },
  { key: "idents", header: "Identities", align: "right", render: (r) => r.distinctIdentifiers },
];

export default function ThreatList({ ips }: ThreatListProps) {
  const ranked = [...ips].filter((i) => i.failures > 0).sort((a, b) => b.failures - a.failures);
  return (
    <SectionCard title="Top offending IPs">
      <DataTable
        columns={COLUMNS}
        rows={ranked}
        getRowKey={(r) => r.ipAddress}
        maxRows={5}
        caption="IP addresses with the most failed sign-in attempts"
        emptyText="No failing IPs in this window."
      />
    </SectionCard>
  );
}
