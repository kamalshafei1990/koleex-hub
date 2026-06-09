/* Security Center — investigation helpers (Phase 2A · A4).
   Pure shaping for the deep-dive tabs + drawer. Reads ONLY the in-memory
   report (no fetch, no fabricated per-attempt detail). No imports beyond types. */

import type { SecurityReport, ReportIp, ReportIdentifier, ReportRule } from "@/lib/security/view-model";

export type EntityKind = "ip" | "identifier" | "rule";
export interface Entity {
  kind: EntityKind;
  id: string;
}

export type TabId = "identifiers" | "rules" | "false_positives" | "timeline" | "audit";
export const TAB_IDS: TabId[] = ["identifiers", "rules", "false_positives", "timeline", "audit"];

/** Human, restrained labels for the enforcement rules (code shown as secondary). */
export const RULE_LABEL: Record<string, string> = {
  ip_10_failures_10m: "Per-IP burst",
  ip_identifier_5_failures_15m: "Per-IP + identifier",
  identifier_20_failures_30m: "Per-identifier (alert-only)",
};
export function ruleLabel(rule: string): string {
  return RULE_LABEL[rule] ?? rule;
}

export interface DrawerField {
  label: string;
  value: string;
}
export interface DrawerModel {
  title: string;
  subtitle: string;
  summary: DrawerField[];
  signals: string[];
  recommendation: string;
}

function ipModel(report: SecurityReport, ip: ReportIp): DrawerModel {
  const fpHere = report.falsePositiveCandidates.filter((f) => f.ipAddress === ip.ipAddress);
  const signals: string[] = [];
  if (ip.wouldBlockHits > 0) signals.push(`${ip.wouldBlockHits} attempts here would trip rate-limit thresholds.`);
  if (ip.distinctIdentifiers >= 5) signals.push(`Tried ${ip.distinctIdentifiers} different identifiers — credential-stuffing pattern.`);
  if (fpHere.length > 0) signals.push(`Also produced ${fpHere.length} successful sign-in(s) — likely a shared/VPN IP.`);
  if (signals.length === 0) signals.push("No threshold-tripping pattern in this window.");
  return {
    title: ip.ipAddress,
    subtitle: "Source IP",
    summary: [
      { label: "Failed attempts", value: String(ip.failures) },
      { label: "Total attempts", value: String(ip.total) },
      { label: "Successful", value: String(ip.successes) },
      { label: "Identities tried", value: String(ip.distinctIdentifiers) },
      { label: "Would-block hits", value: String(ip.wouldBlockHits) },
      { label: "Last seen", value: ip.lastSeen },
    ],
    signals,
    recommendation:
      fpHere.length > 0
        ? "Has legitimate logins — treat with care; a hard block here risks real users."
        : ip.wouldBlockHits > 0
        ? "Candidate for rate-limit enforcement once readiness is green. Monitor."
        : "No action needed — monitor.",
  };
}

function identifierModel(report: SecurityReport, identifier: string): DrawerModel {
  const id: ReportIdentifier | undefined = report.topTargetedIdentifiers.find((i) => i.identifier === identifier);
  const fps = report.falsePositiveCandidates.filter((f) => f.identifier === identifier);
  const signals: string[] = [];
  if (id && id.distinctIps >= 3) signals.push(`Targeted from ${id.distinctIps} different IPs — distributed attempt.`);
  if (fps.length > 0) signals.push(`${fps.length} successful sign-in(s) here would have been rate-limited (false positive).`);
  if (id?.mapsToAccount) signals.push("Maps to a real account.");
  if (signals.length === 0) signals.push("No notable pattern in this window.");
  return {
    title: identifier,
    subtitle: "Identifier",
    summary: [
      { label: "Failed attempts", value: String(id?.failures ?? 0) },
      { label: "Source IPs", value: String(id?.distinctIps ?? fps.length) },
      { label: "Real account", value: id?.mapsToAccount || fps.some((f) => f.mapsToAccount) ? "Yes" : "No" },
    ],
    signals,
    recommendation: fps.length > 0
      ? "Review before enforcing — current rules would block this legitimate user."
      : "Monitor.",
  };
}

function ruleModel(rule: ReportRule): DrawerModel {
  const signals: string[] = [
    `Would fire ${rule.wouldFireCount} time(s) in this window.`,
    rule.blockedSuccesses > 0
      ? `${rule.blockedSuccesses} of those were successful logins — false positives.`
      : "No successful logins would have been blocked.",
    rule.hardBlock ? "Hard-block rule (would 429 in enforce mode)." : "Alert-only rule (never blocks).",
  ];
  return {
    title: ruleLabel(rule.rule),
    subtitle: rule.rule,
    summary: [
      { label: "Threshold", value: `${rule.limit} fails / ${rule.windowMin}m` },
      { label: "Would-fire", value: String(rule.wouldFireCount) },
      { label: "Blocked successes (FP)", value: String(rule.blockedSuccesses) },
      { label: "IPs affected", value: String(rule.distinctIpsAffected) },
      { label: "Identifiers affected", value: String(rule.distinctIdentifiersAffected) },
      { label: "Enforces", value: rule.hardBlock ? "Yes (hard-block)" : "No (alert-only)" },
    ],
    signals,
    recommendation: rule.blockedSuccesses > 0
      ? "Not safe to enforce — would block real users. Raise the threshold or keep observing."
      : rule.hardBlock
      ? "Clean so far. Safe to enforce once the overall soak is adequate."
      : "Alert-only by design — no enforcement action.",
  };
}

export function buildDrawerModel(report: SecurityReport, entity: Entity): DrawerModel | null {
  if (entity.kind === "ip") {
    const ip = report.topOffendingIps.find((i) => i.ipAddress === entity.id);
    if (!ip) return null;
    return ipModel(report, ip);
  }
  if (entity.kind === "identifier") return identifierModel(report, entity.id);
  if (entity.kind === "rule") {
    const rule = report.ruleSimulation.find((r) => r.rule === entity.id);
    if (!rule) return null;
    return ruleModel(rule);
  }
  return null;
}
