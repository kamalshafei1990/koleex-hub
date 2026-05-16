/* ===========================================================================
   Signal Prioritisation Engine  —  Phase 2.0.1

   Every event competes for visibility. signalPriorityScore() returns a
   numeric ranking blending five factors:

     severity   most important: critical >> risk >> watch >> info
     impact     money or % at stake (capped + log-scaled so a $10M
                signal doesn't completely flatten a $50K one)
     urgency    how soon does the operator need to act?
                (overdue days, projected liquidity window)
     persistence longer-lived signals get a slow boost — a problem
                that hasn't gone away in three runs is more important
                than a new one-off
     confidence  for correlations or composite signals; raw events
                pass through at 1.0.

   The score is opaque (no fixed scale) — used only for ranking.
   ========================================================================== */

import type { OperationalEvent, OperationalEventKind, Severity } from "./types";

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 1000,
  risk: 400,
  watch: 120,
  info: 30,
};

/* Soft log scale so large absolute amounts don't dominate. */
function logScaleAmount(amount: number, cap = 1_000_000): number {
  if (amount <= 0) return 0;
  return Math.log10(Math.min(amount, cap) + 1) * 10; // ≈ 0 at 0, ≈ 60 at $1M
}

/* Urgency by event kind. Mostly anchored on "days until action". */
function urgencyComponent(e: OperationalEvent): number {
  switch (e.kind) {
    case "overdue_payment":
    case "supplier_overdue": {
      const days = e.magnitude ?? 0; // days past due
      if (days >= 60) return 60;
      if (days >= 30) return 40;
      if (days >= 14) return 22;
      if (days >= 7) return 12;
      return 4;
    }
    case "supplier_due": {
      const days = e.magnitude ?? 7;
      if (days <= 3) return 20;
      if (days <= 7) return 10;
      return 2;
    }
    case "liquidity_pressure":
      return 50;
    case "margin_drop":
      return 35;
    case "revenue_decline":
      return 30;
    case "collection_delay":
      return 18;
    case "logistics_spike":
      return 20;
    case "customer_concentration":
    case "supplier_dependency":
      return 12;
    /* ── Phase 2.2.1 approval kinds ── */
    case "review_delay": {
      const days = e.magnitude ?? 0;
      if (days >= 21) return 45;
      if (days >= 14) return 32;
      if (days >= 7)  return 18;
      return 6;
    }
    case "approval_backlog":              return 22;
    case "approval_velocity_drop":        return 24;
    case "unresolved_changes_request":    return 16;
    case "approval_concentration":        return 14;
    case "repeated_rejection":            return 18;
    default:
      return 8;
  }
}

/* Impact = clamp + log on amount, fallback to magnitude when no amount. */
function impactComponent(e: OperationalEvent): number {
  if (e.amount && e.amount > 0) return logScaleAmount(e.amount);
  /* For PoP % signals, treat magnitude as the "amount" in a different
     unit — divide it by 2 so a 100% delta scores ~50. */
  if (e.magnitude && e.magnitude > 0) return Math.min(60, e.magnitude / 2);
  return 0;
}

/* Persistence boost — added by the persistence layer; we just read it. */
function persistenceComponent(e: OperationalEvent): number {
  const p = e.persistence ?? 0;
  if (p <= 1) return 0;
  if (p === 2) return 8;
  if (p === 3) return 14;
  return 20; // 4+ consecutive runs
}

/* State modifier — worsening adds, resolved subtracts. */
function stateModifier(e: OperationalEvent): number {
  switch (e.state) {
    case "worsening": return 15;
    case "improving": return -8;
    case "resolved":  return -25;
    default:          return 0;
  }
}

export function signalPriorityScore(e: OperationalEvent): number {
  const sev = SEVERITY_WEIGHT[e.severity];
  const impact = impactComponent(e);
  const urgency = urgencyComponent(e);
  const persistence = persistenceComponent(e);
  const stateMod = stateModifier(e);
  return sev + impact + urgency + persistence + stateMod;
}

/** Annotate an event stream with priority scores and return a new
 *  array sorted descending by priority. */
export function prioritise(events: OperationalEvent[]): OperationalEvent[] {
  return events
    .map((e) => ({ ...e, priority: signalPriorityScore(e) }))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

/* ---------------------------------------------------------------------------
   Noise suppression — same-topic events fold into a single signal so
   the dashboard never shows "overdue customer A" three times in a row
   for three different invoices. The merged event takes the worst
   severity, the maximum amount, and a label that conveys "3 invoices"
   rather than "1 invoice".

   Topics are keyed by (kind, entity?.type, entity?.id ?? entity?.name).
   --------------------------------------------------------------------------- */

const SUPPRESSION_KINDS: ReadonlySet<OperationalEventKind> = new Set([
  "overdue_payment",
  "supplier_overdue",
  "supplier_due",
  "expense_anomaly",
]);

const SEV_RANK: Record<Severity, number> = { critical: 0, risk: 1, watch: 2, info: 3 };

export function suppressNoise(events: OperationalEvent[]): OperationalEvent[] {
  const groups = new Map<string, OperationalEvent[]>();
  const passthrough: OperationalEvent[] = [];

  for (const e of events) {
    if (!SUPPRESSION_KINDS.has(e.kind)) {
      passthrough.push(e);
      continue;
    }
    const id = e.entity?.id ?? e.entity?.name ?? "_";
    const key = `${e.kind}::${e.entity?.type ?? "_"}::${id}`;
    const arr = groups.get(key) ?? [];
    arr.push(e);
    groups.set(key, arr);
  }

  const merged: OperationalEvent[] = [];
  for (const [, arr] of groups) {
    if (arr.length === 1) { merged.push(arr[0]); continue; }
    /* Merge: keep worst severity, sum amount, take max magnitude. */
    arr.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);
    const head = arr[0];
    const totalAmount = arr.reduce((s, x) => s + (x.amount ?? 0), 0);
    const maxMagnitude = arr.reduce((m, x) => Math.max(m, x.magnitude ?? 0), 0);
    const count = arr.length;
    const entityName = head.entity?.name ?? "Entity";
    let label = head.label;
    let detail = head.detail;
    if (head.kind === "overdue_payment") {
      label = `${entityName} · ${count} invoices overdue`;
      detail = `${count} invoices overdue for ${entityName}, totalling ${formatCompact(totalAmount)} USD. Worst is ${maxMagnitude.toFixed(0)} days past due.`;
    } else if (head.kind === "supplier_overdue") {
      label = `${entityName} · ${count} supplier payments overdue`;
      detail = `${count} supplier payments past due to ${entityName}, totalling ${formatCompact(totalAmount)} USD. Worst is ${maxMagnitude.toFixed(0)} days past due.`;
    } else if (head.kind === "supplier_due") {
      label = `${entityName} · ${count} payments due soon`;
      detail = `${count} payments due to ${entityName} within ${maxMagnitude.toFixed(0)} days, totalling ${formatCompact(totalAmount)} USD.`;
    } else if (head.kind === "expense_anomaly") {
      label = `${entityName} · ${count} anomalous expense lines`;
      detail = `${count} expense entries deviating sharply from prior period, totalling ${formatCompact(totalAmount)} USD.`;
    }
    merged.push({
      ...head,
      key: `${head.key}-merged-${count}`,
      label,
      detail,
      amount: totalAmount,
      magnitude: maxMagnitude,
    });
  }
  return [...merged, ...passthrough];
}

function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2) + "M";
  if (abs >= 1_000)     return (n / 1_000).toFixed(abs >= 10_000 ? 1 : 2) + "K";
  return n.toFixed(0);
}
