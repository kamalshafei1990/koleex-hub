/* ===========================================================================
   Koleex Hub  —  Operational Intelligence  (public surface)

   Re-exports the public types and entry-point pure functions for the
   cross-module intelligence layer.

   Consumers should always import from `@/lib/intelligence` (this file)
   rather than reaching into individual sub-modules — keeps the
   surface stable as internal structure evolves.
   ========================================================================== */

export * from "./types";
export {
  mean, median, stddev, daysBetween, daysFromToday,
  classifyDirection, clamp01, softHealth, pctChange, safePct, stableId,
} from "./behavior";
export { signalPriorityScore, prioritise, suppressNoise } from "./priority";
export { isMaterial, applyMaterialityGate, normaliseSeverity } from "./materiality";
export {
  annotateWithMemory, smoothHealth, withHealthScore,
  loadMemory, saveMemory, emptyMemory,
  type MemoryState, type AnnotatedRun,
} from "./persistence";
export { buildExecutiveDigest } from "./digest";

export {
  buildCustomerProfiles,
  buildInputsFromOrders,
  computeCollectionBehavior,
  summarizeCohort,
  type CustomerCohortSummary,
} from "./customer";

export {
  aggregateSuppliersFromOrders,
  buildSupplierProfiles,
  summarizeSupplierCohort,
  type SupplierCohortSummary,
} from "./supplier";

export {
  buildLogisticsSnapshot,
  detectExpenseAnomalies,
  splitByPeriod,
  type ExpenseAnomaly,
} from "./logistics";

export {
  computeInventorySnapshot,
  type InventoryRecord,
} from "./inventory";

export { synthesizeEvents } from "./events";
export { correlate } from "./relationships";

export {
  scoreFinanceHealth,
  scoreCustomerHealth,
  scoreSupplierHealth,
  scoreLogisticsHealth,
  scoreInventoryHealth,
  scoreApprovalHealth,
  scorePaymentHealth,
  composeBusinessHealth,
} from "./health";

export { buildApprovalSnapshot } from "./approval";
export { buildPaymentControlSnapshot } from "./payment";
export { buildTreasurySnapshot } from "./treasury";
export { buildReconciliationSnapshot } from "./reconciliation";
export { buildBankImportSnapshot } from "./bank-imports";
export {
  matchConfidence,
  duplicateMovementConfidence,
  suggestMatches,
  amountScore,
  referenceScore,
  timingScore,
  counterpartyScore,
  directionScore,
  type MatchScore,
  type MatchSuggestion,
} from "./reconcile";

export { assessRisk } from "./risk";
export { buildBusinessCopilotContext } from "./copilot";
export { linearTrend, projectAt, projectRevenue } from "./forecasting";

/* ---------------------------------------------------------------------------
   One-shot orchestrator  —  the dashboard's single entry point.

   Consumes raw module data, returns the entire intelligence picture in
   one pass. Pure function; no React, no async, no fetch.
   --------------------------------------------------------------------------- */

import type { DashboardKpi, FinanceOrder, FinancePayment, FinanceExpense } from "@/lib/finance/types";
import type {
  BusinessHealth,
  CopilotHint,
  CrossModuleCorrelation,
  CustomerBehaviorProfile,
  InventorySnapshot,
  LogisticsSnapshot,
  OperationalEvent,
  RiskAssessment,
  SupplierDependencyProfile,
} from "./types";
import { buildCustomerProfiles, buildInputsFromOrders } from "./customer";
import { buildSupplierProfiles } from "./supplier";
import { buildLogisticsSnapshot, splitByPeriod } from "./logistics";
import { computeInventorySnapshot, type InventoryRecord } from "./inventory";
import { synthesizeEvents } from "./events";
import { correlate } from "./relationships";
import { applyMaterialityGate, normaliseSeverity } from "./materiality";
import { prioritise, suppressNoise } from "./priority";
import { annotateWithMemory, smoothHealth, withHealthScore, type MemoryState } from "./persistence";
import { buildExecutiveDigest } from "./digest";
import { buildApprovalSnapshot } from "./approval";
import { buildPaymentControlSnapshot } from "./payment";
import { buildTreasurySnapshot } from "./treasury";
import { buildReconciliationSnapshot } from "./reconciliation";
import { buildBankImportSnapshot } from "./bank-imports";
import {
  composeBusinessHealth,
  scoreApprovalHealth,
  scoreCustomerHealth,
  scoreFinanceHealth,
  scoreInventoryHealth,
  scoreLogisticsHealth,
  scorePaymentHealth,
  scoreSupplierHealth,
  scoreTreasuryHealth,
} from "./health";
import { assessRisk } from "./risk";
import { buildBusinessCopilotContext } from "./copilot";

export interface IntelligencePicture {
  customers: CustomerBehaviorProfile[];
  suppliers: SupplierDependencyProfile[];
  logistics: LogisticsSnapshot;
  inventory: InventorySnapshot;
  /** Phase 2.2.1 — approval operations snapshot. */
  approval: import("./types").ApprovalIntelligenceSnapshot;
  /** Phase 2.3 — payment control snapshot. */
  payment: import("./types").PaymentControlSnapshot;
  /** Phase 2.4 — treasury snapshot. */
  treasury: import("./types").TreasurySnapshot;
  /** Phase 2.5 — reconciliation queue snapshot. */
  reconciliation: import("./reconciliation").ReconciliationSnapshot;
  /** Phase 2.6 — bank-statement import snapshot. */
  bankImports: import("./bank-imports").BankImportSnapshot;
  events: OperationalEvent[];
  /** Resolved carry-over events surfaced for one run after they clear. */
  resolved: OperationalEvent[];
  correlations: CrossModuleCorrelation[];
  health: BusinessHealth;
  risk: RiskAssessment;
  copilotHints: CopilotHint[];
  /** Top 3-5 curated narratives — executive digest layer. */
  digest: import("./types").DigestItem[];
  /** Memory snapshot to persist for the next run. */
  nextMemory: MemoryState;
}

export interface IntelligenceInputs {
  kpi: DashboardKpi | null;
  orders: FinanceOrder[];
  payments: FinancePayment[];
  expenses: FinanceExpense[];
  /** Optional inventory rows when the inventory adapter is connected. */
  inventoryRecords?: InventoryRecord[];
  /** Period in days for splitting current vs prior expense windows. */
  periodDays?: number;
  pageContext?: {
    customerId?: string;
    supplierId?: string;
    orderId?: string;
  };
  /** Prior memory state (loaded from localStorage by the caller). */
  memory?: MemoryState | null;
  /* Phase 2.4 — treasury inputs. Optional so existing callers that
     don't load bank data continue to work; the engine returns a
     dormant snapshot when both arrays are empty. */
  bankAccounts?: import("@/lib/finance/types").BankAccount[];
  cashMovements?: import("@/lib/finance/types").CashMovement[];
  /* Phase 2.5 — reconciliation candidates. Optional so callers that
     don't load the queue continue to work; the engine returns a
     dormant snapshot when the array is empty. */
  reconciliationCandidates?: import("@/lib/finance/types").FinanceReconciliationCandidate[];
  /* Phase 2.6 — bank-statement imports (optional). */
  bankStatementImports?: import("@/lib/finance/types").BankStatementImport[];
}

export function buildIntelligence(input: IntelligenceInputs): IntelligencePicture {
  const periodDays = input.periodDays ?? 90;
  const customerInputs = buildInputsFromOrders(input.orders);
  const totalRevenue = input.kpi?.total_revenue ?? customerInputs.reduce((s, c) => s + c.totalRevenue, 0);

  const customers = buildCustomerProfiles({
    customers: customerInputs,
    orders: input.orders,
    payments: input.payments,
    totalRevenue,
  });

  const suppliers = buildSupplierProfiles({
    orders: input.orders,
    payments: input.payments,
  });

  const { current, prior } = splitByPeriod(input.expenses, periodDays);
  const logistics = buildLogisticsSnapshot({
    current, prior,
    totalOpex: input.kpi?.total_expenses ?? 0,
  });

  const inventory = computeInventorySnapshot({
    records: input.inventoryRecords ?? [],
    orders: input.orders,
  });

  /* ── Phase 2.0.1 quality-controlled pipeline ──
     1) Raw synthesis from all modules.
     2) Materiality gate — drop signals a finance manager wouldn't care about.
     3) Noise suppression — merge same-topic clusters into one signal.
     4) Severity normalisation.
     5) Persistence annotation — new / recurring / worsening / improving.
     6) Priority scoring — rank by impact + urgency + severity + persistence.
     7) Correlations — score with confidence; low-confidence dropped.
     8) Health composed, then EMA-smoothed against prior run.
     9) Risk + Copilot + Executive digest off the curated stream.       */
  /* Phase 2.2.1 — approval operations snapshot. Built independently
     from the rest so other consumers (dashboard panel) can read it
     directly; the events are merged into the global stream before the
     materiality + noise + priority pipeline. */
  const approval = buildApprovalSnapshot(input.expenses, periodDays);

  /* Phase 2.3 — payment control snapshot. Reads finance_payments with
     the approval + reconciliation columns. Same architectural pattern
     as approval — events flow into the shared materiality/priority
     pipeline; the rich snapshot powers the dedicated dashboard panel. */
  const payment = buildPaymentControlSnapshot(input.payments);

  /* Phase 2.4 — treasury snapshot. Distinct from `payment`: reads
     bank accounts (cash position) and cash movements (bank reality)
     instead of finance_payments (business intent). Events flow
     through the same shared pipeline. */
  const treasury = buildTreasurySnapshot({
    accounts: input.bankAccounts ?? [],
    movements: input.cashMovements ?? [],
    payments: input.payments,
    orders: input.orders,
  });

  /* Phase 2.5 — reconciliation snapshot. Feeds 5 dedicated event kinds
     into the shared pipeline so reconciliation pressure competes for
     dashboard attention alongside the other finance signals. */
  const reconciliation = buildReconciliationSnapshot({
    candidates: input.reconciliationCandidates ?? [],
  });

  /* Phase 2.6 — bank-statement import snapshot. */
  const bankImports = buildBankImportSnapshot({
    imports: input.bankStatementImports ?? [],
    recentImportMovements: input.cashMovements ?? [],
    accounts: input.bankAccounts ?? [],
  });

  const raw = [
    ...synthesizeEvents({
      kpi: input.kpi,
      orders: input.orders,
      customers,
      suppliers,
      logistics,
      inventory,
    }),
    ...approval.events,
    ...payment.events,
    ...treasury.events,
    ...reconciliation.events,
    ...bankImports.events,
  ];
  const material   = applyMaterialityGate(raw);
  const merged     = suppressNoise(material);
  const normalised = normaliseSeverity(merged);
  const memoryRun  = annotateWithMemory(normalised, input.memory ?? null);
  const ranked     = prioritise(memoryRun.events);
  const correlations = correlate(ranked);

  const dimensions = [
    scoreFinanceHealth(input.kpi),
    scoreCustomerHealth(customers),
    scoreSupplierHealth(suppliers),
    scoreLogisticsHealth(logistics),
    scoreInventoryHealth(inventory),
    scoreApprovalHealth(approval),
    scorePaymentHealth(payment),
    scoreTreasuryHealth(treasury),
  ];
  const rawHealth = composeBusinessHealth(dimensions);
  const health = smoothHealth(rawHealth, input.memory ?? null);

  const risk = assessRisk({ events: ranked, customers, suppliers });

  const copilotHints = buildBusinessCopilotContext({
    events: ranked,
    correlations,
    pageContext: input.pageContext,
    reconciliation,
    reconciliationCandidates: input.reconciliationCandidates ?? [],
    cashMovements: input.cashMovements ?? [],
  });

  const digest = buildExecutiveDigest({
    kpi: input.kpi,
    events: ranked,
    correlations,
    customers,
    suppliers,
  });

  const nextMemory = withHealthScore(memoryRun.nextMemory, health);

  return {
    customers, suppliers, logistics, inventory, approval, payment, treasury,
    reconciliation, bankImports,
    events: ranked,
    resolved: memoryRun.resolved,
    correlations,
    health, risk, copilotHints, digest, nextMemory,
  };
}
