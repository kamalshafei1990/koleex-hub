import "server-only";

/* ---------------------------------------------------------------------------
   QA Auto Investigation Layer (Phase 7) — deterministic analysis engine.

   From an issue + its module history, derive possible causes, regression /
   hotspot flags, related patterns, suggested investigation files, and
   risk/confidence scores. Pure rules over ONE module-scoped query (≤400 rows,
   recent window) — NO AI, NO embeddings, NO filesystem scans. Reproducible.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { RESOLVED_STATUSES, type IssueStatus } from "@/lib/qa/types";

export const ANALYSIS_VERSION = "1.0";
const LOOKBACK_DAYS = 180;
const RECENT_FIX_DAYS = 30;
const CANDIDATE_LIMIT = 400;

/* ── Shapes (mirror the table columns) ──────────────────────────────────── */
export interface PossibleCause { cause: string; evidence: string; weight: number }
export interface InvFlag { label: string; detail: string }
export interface RelatedPattern { pattern: string; count: number; examples: string[] }
export interface ModuleHealth { module: string | null; total: number; open: number; urgent: number; reopened: number; duplicates: number }
export interface InvestigationResult {
  possible_causes: PossibleCause[];
  regression_flags: InvFlag[];
  hotspot_flags: InvFlag[];
  related_patterns: RelatedPattern[];
  suggested_files: string[];
  investigation_notes: string[];
  risk_score: number;
  confidence_score: number;
  module_health_snapshot: ModuleHealth;
  generated_summary: string;
  analysis_version: string;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const isResolved = (s: string) => (RESOLVED_STATUSES as string[]).includes(s) || s === "closed";

/* Deterministic module → source-root map (naming heuristic; no FS scan). */
const MODULE_ROOTS: Record<string, string> = {
  Suppliers: "src/components/suppliers/",
  Customers: "src/components/contacts/",
  Contacts: "src/components/contacts/",
  "Product Data": "src/components/admin/",
  Products: "src/components/admin/",
  Catalogs: "src/app/catalogs/",
  Database: "src/components/database/",
  Inventory: "src/components/inventory/",
  Finance: "src/components/finance/",
  Expenses: "src/components/finance/",
  Sales: "src/components/sales/",
  Purchase: "src/components/purchase/",
  Purchases: "src/components/purchase/",
  Invoices: "src/components/invoices/",
  Quotations: "src/components/quotations/",
  CRM: "src/components/crm/",
  HR: "src/components/hr/",
  Projects: "src/components/projects/",
  Operations: "src/components/operations/",
  QA: "src/components/qa/",
};

type Row = {
  id: string; title: string | null; severity: string | null; priority: string | null;
  status: string; reopen_count: number | null; duplicate_of_issue_id: string | null;
  component_name: string | null; route: string | null; fixed_commit: string | null;
  resolved_at: string | null; created_at: string;
};

/* ── Suggested files (deterministic naming heuristics) ───────────────────── */
function suggestedFiles(issue: { component_name: string | null; app_module: string | null; route: string | null }, sameComponent: Row[]): string[] {
  const out = new Set<string>();
  if (issue.component_name) out.add(`${issue.component_name}.tsx`);
  for (const c of sameComponent) if (c.component_name) out.add(`${c.component_name}.tsx`);
  if (issue.app_module && MODULE_ROOTS[issue.app_module]) out.add(MODULE_ROOTS[issue.app_module]);
  if (issue.route) {
    const path = issue.route.split("?")[0].replace(/\/+$/, "");
    if (path) out.add(`src/app${path}/page.tsx`);
  }
  return Array.from(out).slice(0, 8);
}

/* ── Core analysis ───────────────────────────────────────────────────────── */
export async function analyzeIssue(tenantId: string, issue: Record<string, unknown>): Promise<InvestigationResult> {
  const module = (issue.app_module as string) ?? null;
  const component = (issue.component_name as string) ?? null;
  const route = (issue.route as string) ?? null;
  const reopenCount = Number(issue.reopen_count) || 0;
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();

  // ONE scoped query: recent issues in the same module (or tenant-wide if no module).
  let q = supabaseServer
    .from("qa_issue_reports")
    .select("id, title, severity, priority, status, reopen_count, duplicate_of_issue_id, component_name, route, fixed_commit, resolved_at, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(CANDIDATE_LIMIT);
  if (module) q = q.eq("app_module", module);
  const { data } = await q;
  const rows = ((data ?? []) as Row[]);
  const others = rows.filter((r) => r.id !== (issue.id as string));

  // Watcher count on this issue (cheap head count).
  const { count: watcherCount } = await supabaseServer
    .from("qa_issue_watchers").select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId).eq("issue_id", issue.id as string);
  const watchers = watcherCount ?? 0;

  // ── Derived stats (all from the single result set) ──────────────────────
  const moduleHealth: ModuleHealth = {
    module,
    total: rows.length,
    open: rows.filter((r) => !isResolved(r.status)).length,
    urgent: rows.filter((r) => r.priority === "urgent").length,
    reopened: rows.filter((r) => (r.reopen_count ?? 0) > 0).length,
    duplicates: rows.filter((r) => r.duplicate_of_issue_id || r.status === "duplicate").length,
  };
  const sameComponent = component ? others.filter((r) => r.component_name === component) : [];
  const sameRoute = route ? others.filter((r) => r.route === route) : [];
  const recentlyFixedComponent = sameComponent.filter((r) =>
    r.fixed_commit && r.resolved_at && Date.parse(r.resolved_at) >= Date.now() - RECENT_FIX_DAYS * 86_400_000);
  const sameRouteReopened = sameRoute.filter((r) => (r.reopen_count ?? 0) > 0);
  const dupCluster = others.filter((r) =>
    (r.duplicate_of_issue_id || r.status === "duplicate") &&
    ((component && r.component_name === component) || (route && r.route === route)));

  // ── Possible causes ─────────────────────────────────────────────────────
  const causes: PossibleCause[] = [];
  if (recentlyFixedComponent.length > 0)
    causes.push({ cause: "Recent fix to this component may have regressed", evidence: `${component} was fixed ${recentlyFixedComponent.length}× in the last ${RECENT_FIX_DAYS} days`, weight: 9 });
  if (reopenCount > 0)
    causes.push({ cause: "Issue resurfaced after being resolved", evidence: `Reopened ${reopenCount}× — the prior fix likely didn't hold`, weight: 8 });
  if (sameRouteReopened.length >= 2)
    causes.push({ cause: "Route has a recurring failure pattern", evidence: `${sameRouteReopened.length} issues on ${route} have been reopened`, weight: 6 });
  if (sameComponent.length >= 3)
    causes.push({ cause: "High-frequency component", evidence: `${sameComponent.length + 1} issues touch ${component}`, weight: 6 });
  if (dupCluster.length >= 2)
    causes.push({ cause: "Part of a duplicate cluster", evidence: `${dupCluster.length} related duplicates around the same component/route`, weight: 5 });
  if (moduleHealth.total >= 5 && moduleHealth.urgent >= 3)
    causes.push({ cause: "High-risk module", evidence: `${module} has ${moduleHealth.urgent} urgent issues out of ${moduleHealth.total}`, weight: 4 });
  causes.sort((a, b) => b.weight - a.weight);

  // ── Regression flags ────────────────────────────────────────────────────
  const regressions: InvFlag[] = [];
  if (reopenCount >= 2) regressions.push({ label: "Repeatedly reopened", detail: `This issue has been reopened ${reopenCount}×.` });
  else if (reopenCount === 1) regressions.push({ label: "Returned after resolution", detail: "This issue was resolved once and reopened." });
  if (recentlyFixedComponent.length > 0) regressions.push({ label: "Recent component fix", detail: `${component} was fixed within ${RECENT_FIX_DAYS} days (${recentlyFixedComponent.map((r) => r.fixed_commit).filter(Boolean).slice(0, 3).join(", ") || "no commit"}).` });
  if (sameRouteReopened.length >= 2) regressions.push({ label: "Route instability", detail: `${sameRouteReopened.length} reopened issues share route ${route}.` });

  // ── Hotspot flags (module-level) ────────────────────────────────────────
  const hotspots: InvFlag[] = [];
  if (moduleHealth.urgent >= 3) hotspots.push({ label: "Urgent backlog", detail: `${module} has ${moduleHealth.urgent} urgent issues.` });
  if (moduleHealth.total >= 3 && moduleHealth.reopened / moduleHealth.total >= 0.3) hotspots.push({ label: "High reopen rate", detail: `${moduleHealth.reopened}/${moduleHealth.total} issues in ${module} were reopened.` });
  if (moduleHealth.total >= 3 && moduleHealth.duplicates / moduleHealth.total >= 0.3) hotspots.push({ label: "High duplicate rate", detail: `${moduleHealth.duplicates}/${moduleHealth.total} issues in ${module} are duplicates.` });
  if (sameComponent.length >= 4) hotspots.push({ label: "Component concentration", detail: `${sameComponent.length + 1} issues concentrate on ${component}.` });
  if (watchers >= 3) hotspots.push({ label: "High attention", detail: `${watchers} people are watching this issue.` });

  // ── Related patterns ────────────────────────────────────────────────────
  const patterns: RelatedPattern[] = [];
  if (sameComponent.length > 0) patterns.push({ pattern: `Same component (${component})`, count: sameComponent.length, examples: sameComponent.slice(0, 3).map((r) => r.title ?? r.id) });
  if (sameRoute.length > 0) patterns.push({ pattern: `Same route (${route})`, count: sameRoute.length, examples: sameRoute.slice(0, 3).map((r) => r.title ?? r.id) });
  if (dupCluster.length > 0) patterns.push({ pattern: "Duplicate cluster", count: dupCluster.length, examples: dupCluster.slice(0, 3).map((r) => r.title ?? r.id) });

  // ── Scores ──────────────────────────────────────────────────────────────
  let risk = 8;
  risk += Math.min(reopenCount, 3) * 12;
  if (issue.priority === "urgent") risk += 14; else if (issue.priority === "high") risk += 6;
  if (issue.severity === "critical") risk += 12; else if (issue.severity === "high") risk += 6;
  risk += regressions.length * 9;
  risk += hotspots.length * 7;
  risk += Math.min(dupCluster.length, 4) * 3;
  const risk_score = clamp(risk);

  // Confidence = how much signal we had to work with.
  let conf = 35;
  if (component) conf += 12;
  if (route) conf += 10;
  conf += Math.min(others.length, 30); // module sample size
  conf += Math.min(causes.length * 5, 15);
  const confidence_score = clamp(conf);

  // ── Notes + summary ─────────────────────────────────────────────────────
  const notes: string[] = [];
  if (component) notes.push(`Start in ${component} — it's the pinned component for this report.`);
  if (recentlyFixedComponent.length > 0) notes.push("Diff the recent fix to this component first; this is the most likely regression source.");
  if (reopenCount > 0) notes.push("Verify the previous fix actually addressed the root cause, not just the symptom.");
  if (route) notes.push(`Reproduce on ${route} with the reporter's environment.`);
  if (notes.length === 0) notes.push("Limited history — reproduce from the route + module and gather more context.");

  const suggested_files = suggestedFiles({ component_name: component, app_module: module, route }, sameComponent);

  const topCause = causes[0];
  const summary =
    `Risk ${risk_score}/100, confidence ${confidence_score}/100. ` +
    (topCause ? `Most likely: ${topCause.cause.toLowerCase()} (${topCause.evidence}). ` : "No strong single cause detected. ") +
    (regressions.length ? `${regressions.length} regression signal(s). ` : "") +
    (hotspots.length ? `${hotspots.length} module hotspot(s). ` : "") +
    (component ? `Begin in ${component}.` : `Begin in the ${module ?? "owning"} module.`);

  return {
    possible_causes: causes,
    regression_flags: regressions,
    hotspot_flags: hotspots,
    related_patterns: patterns,
    suggested_files,
    investigation_notes: notes,
    risk_score,
    confidence_score,
    module_health_snapshot: moduleHealth,
    generated_summary: summary,
    analysis_version: ANALYSIS_VERSION,
  };
}

/* ── Cache control (compute-on-read; one report per issue) ───────────────── */
export function resultFromRow(row: Record<string, unknown>): InvestigationResult {
  return {
    possible_causes: (row.possible_causes as PossibleCause[]) ?? [],
    regression_flags: (row.regression_flags as InvFlag[]) ?? [],
    hotspot_flags: (row.hotspot_flags as InvFlag[]) ?? [],
    related_patterns: (row.related_patterns as RelatedPattern[]) ?? [],
    suggested_files: (row.suggested_files as string[]) ?? [],
    investigation_notes: (row.investigation_notes as string[]) ?? [],
    risk_score: Number(row.risk_score) || 0,
    confidence_score: Number(row.confidence_score) || 0,
    module_health_snapshot: (row.module_health_snapshot as ModuleHealth) ?? { module: null, total: 0, open: 0, urgent: 0, reopened: 0, duplicates: 0 },
    generated_summary: (row.generated_summary as string) ?? "",
    analysis_version: (row.analysis_version as string) ?? ANALYSIS_VERSION,
  };
}

export async function persistInvestigation(tenantId: string, issueId: string, result: InvestigationResult, workspaceId: string | null): Promise<void> {
  const { error } = await supabaseServer.from("qa_investigation_reports").upsert({
    issue_id: issueId,
    tenant_id: tenantId,
    workspace_id: workspaceId,
    possible_causes: result.possible_causes,
    regression_flags: result.regression_flags,
    hotspot_flags: result.hotspot_flags,
    related_patterns: result.related_patterns,
    suggested_files: result.suggested_files,
    investigation_notes: result.investigation_notes,
    risk_score: result.risk_score,
    confidence_score: result.confidence_score,
    module_health_snapshot: result.module_health_snapshot,
    generated_summary: result.generated_summary,
    analysis_version: ANALYSIS_VERSION,
    generated_at: new Date().toISOString(),
    stale: false,
  }, { onConflict: "issue_id" });
  if (error) console.error("[investigation persist]", error.message);
}

/**
 * Return the cached investigation, or generate + cache it. Returns null only if
 * the issue itself can't be found in the tenant.
 */
export async function loadOrGenerateInvestigation(
  tenantId: string, issueId: string, opts: { force?: boolean; workspaceId?: string | null } = {},
): Promise<InvestigationResult | null> {
  if (!opts.force) {
    const { data: cached } = await supabaseServer
      .from("qa_investigation_reports").select("*").eq("tenant_id", tenantId).eq("issue_id", issueId).maybeSingle();
    if (cached && (cached as { stale: boolean }).stale !== true) return resultFromRow(cached as Record<string, unknown>);
  }
  const { data: issue } = await supabaseServer
    .from("qa_issue_reports").select("*").eq("tenant_id", tenantId).eq("id", issueId).maybeSingle();
  if (!issue) return null;
  const result = await analyzeIssue(tenantId, issue as Record<string, unknown>);
  await persistInvestigation(tenantId, issueId, result, opts.workspaceId ?? null);
  return result;
}

/* ── Prompt section (appended to the Claude Debug Workspace prompt) ───────── */
export function renderInvestigationPromptSection(inv: InvestigationResult): string {
  const L: string[] = [];
  const h = (t: string) => L.push("", `## ${t}`);

  h("Investigation Summary (deterministic)");
  L.push(inv.generated_summary);
  L.push(`- Risk score: ${inv.risk_score}/100 · Confidence: ${inv.confidence_score}/100`);

  h("Possible Causes");
  if (inv.possible_causes.length === 0) L.push("- No strong cause detected from history.");
  else for (const c of inv.possible_causes) L.push(`- ${c.cause} — ${c.evidence}`);

  if (inv.regression_flags.length > 0) {
    h("Regression Warnings");
    for (const f of inv.regression_flags) L.push(`- ${f.label}: ${f.detail}`);
  }
  if (inv.hotspot_flags.length > 0) {
    h("Hotspot Warnings");
    for (const f of inv.hotspot_flags) L.push(`- ${f.label}: ${f.detail}`);
  }

  h("Suggested Investigation Files");
  if (inv.suggested_files.length === 0) L.push("- (none derived)");
  else for (const f of inv.suggested_files) L.push(`- ${f}`);

  h("Suggested Investigation Areas (analysis)");
  for (const n of inv.investigation_notes) L.push(`- ${n}`);

  L.push("", "_These findings are derived deterministically from issue history — verify before acting._");
  return L.join("\n");
}
