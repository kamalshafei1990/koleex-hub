/* ---------------------------------------------------------------------------
   Sourcing analytics engine — PURE, AI-ready, testable.

   Consumes a normalised SourcingSupplier[] (assembled server-side from the
   existing risk / negotiation / sourcing / links / certs / readiness tables)
   and derives the command-center sections: operational health, category
   coverage, country concentration, dependency signals, and rule-generated
   procurement recommendations. No DB access, no React, no side effects — so
   the same logic can later feed an AI sourcing assistant unchanged.
   --------------------------------------------------------------------------- */

export interface SourcingLinkLite { product_id: string; product_name: string; category_slug: string | null; sourcing_role: string | null; lead_time_days: number | null; }

export interface SourcingSupplier {
  id: string;
  name: string;
  country: string | null;
  active: boolean;
  strategicStatus: string | null;
  riskLevel: string | null;          // low|medium|high|critical
  trustLevel: string | null;         // low|medium|high
  dependencyLevel: string | null;    // low|medium|high|critical
  backupAvailable: boolean;
  negotiationScore: number | null;   // 0-100
  certsActive: number;
  readiness: number | null;          // 0-100
  sourcingScore: number | null;      // 0-100 (computed/override)
  leadTime: string | null;
  moq: string | null;
  links: SourcingLinkLite[];
}

const avg = (xs: number[]): number | null => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/* ── A. Global operational health ── */
export function computeOperationalHealth(s: SourcingSupplier[]) {
  const active = s.filter((x) => x.active);
  const preferred = new Set<string>(), blocked = new Set<string>();
  for (const x of s) for (const l of x.links) {
    if (l.sourcing_role === "preferred") preferred.add(x.id);
    if (l.sourcing_role === "blocked") blocked.add(x.id);
  }
  return {
    totalSuppliers: s.length,
    activeSuppliers: active.length,
    preferredSuppliers: preferred.size,
    blockedSuppliers: blocked.size,
    highRiskSuppliers: s.filter((x) => x.riskLevel === "high" || x.riskLevel === "critical").length,
    soleSourceSuppliers: s.filter((x) => !x.backupAvailable && (x.dependencyLevel === "high" || x.dependencyLevel === "critical")).length,
    missingCerts: s.filter((x) => x.certsActive === 0).length,
    avgSourcingScore: avg(s.map((x) => x.sourcingScore).filter((v): v is number => v != null)),
    avgNegotiationScore: avg(s.map((x) => x.negotiationScore).filter((v): v is number => v != null)),
    avgReadiness: avg(s.map((x) => x.readiness).filter((v): v is number => v != null)),
  };
}

/* ── B. Category sourcing matrix ── */
export interface CategoryRow {
  category: string; supplierCount: number; preferred: number; approved: number; blocked: number;
  avgLeadTime: number | null; avgSourcingScore: number | null; backupMissing: boolean; supplierIds: string[];
}
export function computeCategoryCoverage(s: SourcingSupplier[]): CategoryRow[] {
  const map = new Map<string, { suppliers: Set<string>; preferred: Set<string>; approved: Set<string>; blocked: Set<string>; leads: number[]; scores: number[] }>();
  const scoreOf = new Map(s.map((x) => [x.id, x.sourcingScore]));
  for (const sup of s) for (const l of sup.links) {
    const cat = l.category_slug || "uncategorized";
    let e = map.get(cat);
    if (!e) { e = { suppliers: new Set(), preferred: new Set(), approved: new Set(), blocked: new Set(), leads: [], scores: [] }; map.set(cat, e); }
    e.suppliers.add(sup.id);
    if (l.sourcing_role === "preferred") e.preferred.add(sup.id);
    if (l.sourcing_role === "approved") e.approved.add(sup.id);
    if (l.sourcing_role === "blocked") e.blocked.add(sup.id);
    if (typeof l.lead_time_days === "number") e.leads.push(l.lead_time_days);
    const sc = scoreOf.get(sup.id); if (typeof sc === "number") e.scores.push(sc);
  }
  return [...map.entries()].map(([category, e]) => {
    const usable = e.preferred.size + e.approved.size;
    return {
      category,
      supplierCount: e.suppliers.size,
      preferred: e.preferred.size, approved: e.approved.size, blocked: e.blocked.size,
      avgLeadTime: avg(e.leads), avgSourcingScore: avg(e.scores),
      backupMissing: usable <= 1,
      supplierIds: [...e.suppliers],
    };
  }).sort((a, b) => b.supplierCount - a.supplierCount);
}

/* ── C. Country concentration ── */
export function computeCountryConcentration(s: SourcingSupplier[]): { country: string; count: number; pct: number }[] {
  const active = s.filter((x) => x.active);
  const total = active.length || 1;
  const map = new Map<string, number>();
  for (const x of active) { const c = x.country || "Unknown"; map.set(c, (map.get(c) ?? 0) + 1); }
  return [...map.entries()].map(([country, count]) => ({ country, count, pct: Math.round((count / total) * 100) })).sort((a, b) => b.count - a.count);
}

/* ── C/D. Dependency & concentration signals ── */
export interface DependencySignal { key: string; severity: "warning" | "critical"; title: string; detail: string; supplierId?: string; }
export function computeDependencySignals(s: SourcingSupplier[], cats: CategoryRow[], conc: { country: string; count: number; pct: number }[]): DependencySignal[] {
  const out: DependencySignal[] = [];
  for (const x of s.filter((v) => v.active && !v.backupAvailable && (v.dependencyLevel === "high" || v.dependencyLevel === "critical"))) {
    out.push({ key: `sole:${x.id}`, severity: x.dependencyLevel === "critical" ? "critical" : "warning", title: `Sole-source dependency: ${x.name}`, detail: `High dependency with no qualified backup supplier.`, supplierId: x.id });
  }
  for (const c of cats.filter((v) => v.backupMissing && v.preferred + v.approved >= 1)) {
    out.push({ key: `cat:${c.category}`, severity: "warning", title: `Single approved supplier · ${c.category}`, detail: `Only one usable supplier in this category — no backup.` });
  }
  for (const x of s.filter((v) => v.active && v.riskLevel === "critical")) {
    out.push({ key: `risk:${x.id}`, severity: "critical", title: `Critical risk: ${x.name}`, detail: `Supplier marked critical risk — review sourcing exposure.`, supplierId: x.id });
  }
  const top = conc[0];
  if (top && top.pct >= 60 && top.country !== "Unknown") {
    out.push({ key: `conc:${top.country}`, severity: top.pct >= 80 ? "critical" : "warning", title: `Country concentration: ${top.country}`, detail: `${top.pct}% of active suppliers are in ${top.country}.` });
  }
  return out;
}

/* ── E. Rule-generated procurement recommendations (AI-ready, not AI) ── */
export interface Recommendation { id: string; type: string; severity: "info" | "warning" | "critical"; title: string; detail: string; supplierId?: string; visibility: string; }
export function generateRecommendations(s: SourcingSupplier[], cats: CategoryRow[], conc: { country: string; count: number; pct: number }[]): Recommendation[] {
  const recs: Recommendation[] = [];
  for (const c of cats.filter((v) => v.backupMissing)) {
    recs.push({ id: `backup:${c.category}`, type: "backup_needed", severity: "warning", title: `No backup supplier for ${c.category}`, detail: `Qualify a second supplier to remove single-source risk.`, visibility: "procurement" });
  }
  for (const x of s.filter((v) => v.active && (v.riskLevel === "high" || v.riskLevel === "critical"))) {
    recs.push({ id: `risk:${x.id}`, type: "risk_elevated", severity: x.riskLevel === "critical" ? "critical" : "warning", title: `Elevated risk · ${x.name}`, detail: `Risk level is ${x.riskLevel} — mitigate or diversify.`, supplierId: x.id, visibility: "management" });
  }
  const topC = conc[0];
  if (topC && topC.pct >= 60 && topC.country !== "Unknown") {
    recs.push({ id: `conc:${topC.country}`, type: "concentration", severity: topC.pct >= 80 ? "critical" : "warning", title: `Diversify away from ${topC.country}`, detail: `${topC.pct}% of suppliers concentrated in ${topC.country}.`, visibility: "management" });
  }
  // preferred candidates: strong sourcing score, low risk, certs, not yet preferred anywhere
  const preferredIds = new Set<string>();
  for (const x of s) for (const l of x.links) if (l.sourcing_role === "preferred") preferredIds.add(x.id);
  for (const x of s.filter((v) => v.active && (v.sourcingScore ?? 0) >= 70 && (v.riskLevel === "low" || v.riskLevel == null) && v.certsActive > 0 && !preferredIds.has(v.id))) {
    recs.push({ id: `pref:${x.id}`, type: "preferred_candidate", severity: "info", title: `Preferred candidate · ${x.name}`, detail: `Strong sourcing fit (${x.sourcingScore}), low risk, certified — consider promoting.`, supplierId: x.id, visibility: "procurement" });
  }
  for (const x of s.filter((v) => v.active && (v.negotiationScore ?? 0) >= 70)) {
    recs.push({ id: `nego:${x.id}`, type: "negotiation_strength", severity: "info", title: `Strong negotiation profile · ${x.name}`, detail: `Negotiation score ${x.negotiationScore} — leverage in upcoming rounds.`, supplierId: x.id, visibility: "management" });
  }
  return recs;
}

/* ── D. Supplier ranking (sort key → comparator). UI can re-sort client-side. ── */
export type RankKey = "sourcingScore" | "readiness" | "negotiationScore" | "certsActive" | "riskLevel";
const RISK_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
export function rankSuppliers(s: SourcingSupplier[], key: RankKey): SourcingSupplier[] {
  const num = (v: number | null) => (v == null ? -1 : v);
  return [...s].sort((a, b) => {
    if (key === "riskLevel") return (RISK_RANK[a.riskLevel ?? ""] ?? 9) - (RISK_RANK[b.riskLevel ?? ""] ?? 9);
    return num(b[key] as number | null) - num(a[key] as number | null);
  });
}
