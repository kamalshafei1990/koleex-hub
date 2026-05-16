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
  composeBusinessHealth,
} from "./health";

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
import {
  composeBusinessHealth,
  scoreCustomerHealth,
  scoreFinanceHealth,
  scoreInventoryHealth,
  scoreLogisticsHealth,
  scoreSupplierHealth,
} from "./health";
import { assessRisk } from "./risk";
import { buildBusinessCopilotContext } from "./copilot";

export interface IntelligencePicture {
  customers: CustomerBehaviorProfile[];
  suppliers: SupplierDependencyProfile[];
  logistics: LogisticsSnapshot;
  inventory: InventorySnapshot;
  events: OperationalEvent[];
  correlations: CrossModuleCorrelation[];
  health: BusinessHealth;
  risk: RiskAssessment;
  copilotHints: CopilotHint[];
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

  const events = synthesizeEvents({
    kpi: input.kpi,
    orders: input.orders,
    customers,
    suppliers,
    logistics,
    inventory,
  });
  const correlations = correlate(events);

  const dimensions = [
    scoreFinanceHealth(input.kpi),
    scoreCustomerHealth(customers),
    scoreSupplierHealth(suppliers),
    scoreLogisticsHealth(logistics),
    scoreInventoryHealth(inventory),
  ];
  const health = composeBusinessHealth(dimensions);
  const risk = assessRisk({ events, customers, suppliers });

  const copilotHints = buildBusinessCopilotContext({
    events,
    correlations,
    pageContext: input.pageContext,
  });

  return { customers, suppliers, logistics, inventory, events, correlations, health, risk, copilotHints };
}
