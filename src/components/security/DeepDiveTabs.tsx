"use client";

/* DeepDiveTabs — L3 investigation surface (Phase 2A · A4).
   Identifiers · Rule simulation · False positives · Timeline · Audit events.
   Rule codes + raw mechanics live ONLY here (kept below the L1/L2 line). Reads
   the in-memory report; Identifiers / Rules / FP rows open the drawer. */

import type {
  SecurityReport, ReportIdentifier, ReportRule, ReportFalsePositive, ReportBucket,
} from "@/lib/security/view-model";
import TabStrip from "@/components/ui/TabStrip";
import SectionCard from "./SectionCard";
import DataTable, { type Column } from "./DataTable";
import { ruleLabel, type Entity, type TabId } from "./investigation";

const TABS: { id: TabId; label: string }[] = [
  { id: "identifiers", label: "Identifiers" },
  { id: "rules", label: "Rule simulation" },
  { id: "false_positives", label: "False positives" },
  { id: "timeline", label: "Timeline" },
  { id: "audit", label: "Audit events" },
];

type AuditEvent = SecurityReport["recentRateLimitEvents"][number];

function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export interface DeepDiveTabsProps {
  report: SecurityReport;
  activeTab: TabId;
  onTab: (t: TabId) => void;
  onSelect: (e: Entity) => void;
}

export default function DeepDiveTabs({ report, activeTab, onTab, onSelect }: DeepDiveTabsProps) {
  return (
    <SectionCard title="Investigate">
      <div className="mb-3">
        <TabStrip
          ariaLabel="Deep dive"
          items={TABS.map((t) => ({
            key: t.id,
            label: t.label,
            active: activeTab === t.id,
            onClick: () => onTab(t.id),
          }))}
        />
      </div>

      <div key={activeTab} className="kx-tab-in">
      {activeTab === "identifiers" && (
        <DataTable<ReportIdentifier>
          columns={IDENT_COLS}
          rows={report.topTargetedIdentifiers}
          getRowKey={(r) => r.identifier}
          onRowClick={(r) => onSelect({ kind: "identifier", id: r.identifier })}
          rowLabel={(r) => `Investigate identifier ${r.identifier}`}
          caption="Targeted identifiers"
          emptyText="No targeted identifiers in this window."
        />
      )}

      {activeTab === "rules" && (
        <DataTable<ReportRule>
          columns={RULE_COLS}
          rows={report.ruleSimulation}
          getRowKey={(r) => r.rule}
          onRowClick={(r) => onSelect({ kind: "rule", id: r.rule })}
          rowLabel={(r) => `Investigate rule ${ruleLabel(r.rule)}`}
          caption="Rate-limit rule simulation"
          emptyText="No rules to simulate."
        />
      )}

      {activeTab === "false_positives" && (
        <DataTable<ReportFalsePositive>
          columns={FP_COLS}
          rows={report.falsePositiveCandidates}
          getRowKey={(r) => `${r.ipAddress} ${r.identifier}`}
          onRowClick={(r) => onSelect({ kind: "identifier", id: r.identifier })}
          rowLabel={(r) => `Investigate ${r.identifier}`}
          caption="False-positive candidates"
          emptyText="No false-positive candidates — no successful login would have been blocked."
        />
      )}

      {activeTab === "timeline" && (
        <DataTable<ReportBucket>
          columns={TIMELINE_COLS}
          rows={report.timeSeries.filter((b) => b.attempts > 0)}
          getRowKey={(r) => r.bucketStart}
          caption="Activity over time"
          emptyText="No activity recorded in this window."
        />
      )}

      {activeTab === "audit" && (
        <DataTable<AuditEvent>
          columns={AUDIT_COLS}
          rows={report.recentRateLimitEvents}
          getRowKey={(r) => r.id}
          caption="Recent rate-limit security events"
          emptyText="No enforcement events — expected while production is observe-only."
        />
      )}
      </div>
    </SectionCard>
  );
}

/* ------------------------------- columns --------------------------------- */

const IDENT_COLS: Column<ReportIdentifier>[] = [
  { key: "id", header: "Identifier", render: (r) => <span className="font-mono text-[var(--text-primary)]">{r.identifier}</span> },
  { key: "failed", header: "Failed", align: "right", render: (r) => r.failures },
  { key: "ips", header: "IPs", align: "right", render: (r) => r.distinctIps },
  { key: "acct", header: "Account?", align: "right", render: (r) => (r.mapsToAccount ? "yes" : "no") },
];

const RULE_COLS: Column<ReportRule>[] = [
  {
    key: "rule",
    header: "Rule",
    render: (r) => (
      <span>
        <span className="text-[var(--text-primary)]">{ruleLabel(r.rule)}</span>
        <span className="ml-2 font-mono text-[11px] text-[var(--text-dim)]">{r.rule}</span>
      </span>
    ),
  },
  { key: "fire", header: "Would-fire", align: "right", render: (r) => r.wouldFireCount },
  { key: "fp", header: "Blocked OK (FP)", align: "right", render: (r) => <span className={r.blockedSuccesses > 0 ? "text-rose-400" : undefined}>{r.blockedSuccesses}</span> },
  { key: "enf", header: "Enforces", align: "right", render: (r) => (r.hardBlock ? "yes" : "no") },
];

const FP_COLS: Column<ReportFalsePositive>[] = [
  { key: "ip", header: "IP", render: (r) => <span className="font-mono text-[var(--text-primary)]">{r.ipAddress}</span> },
  { key: "id", header: "Identifier", render: (r) => <span className="font-mono">{r.identifier}</span> },
  { key: "n", header: "Count", align: "right", render: (r) => r.occurrences },
  { key: "acct", header: "Account?", align: "right", render: (r) => (r.mapsToAccount ? "yes" : "no") },
  { key: "rules", header: "Rules", render: (r) => <span className="text-[var(--text-dim)]">{r.rules.map(ruleLabel).join(", ")}</span> },
];

const TIMELINE_COLS: Column<ReportBucket>[] = [
  { key: "t", header: "When", render: (r) => fmt(r.bucketStart) },
  { key: "att", header: "Attempts", align: "right", render: (r) => r.attempts },
  { key: "fail", header: "Failures", align: "right", render: (r) => r.failures },
  { key: "wb", header: "Would-block", align: "right", render: (r) => r.wouldBlock },
];

const AUDIT_COLS: Column<AuditEvent>[] = [
  { key: "when", header: "When", render: (r) => fmt(r.createdAt) },
  { key: "ip", header: "IP", render: (r) => <span className="font-mono">{r.ip ?? "—"}</span> },
  { key: "rule", header: "Rule", render: (r) => ruleLabel(String((r.details?.rule as string) ?? "—")) },
  { key: "retry", header: "Retry-After", align: "right", render: (r) => String((r.details?.retry_after_seconds as number) ?? "—") },
];
