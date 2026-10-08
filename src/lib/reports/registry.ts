import "server-only";

/* ===========================================================================
   Phase R.1 — Report registry
   Maps every ReportType to its descriptor (UI metadata + filter shape)
   and to the builder function that produces the ReportPayload.

   Adding a new report = adding one entry here + one builder file.
   The renderer and the API never need to know about the new type.
   ========================================================================== */

import type {
  ReportBuildContext,
  ReportPayload,
  ReportTemplateDescriptor,
  ReportType,
  ReportVisibility,
} from "./types";

import { buildCustomerStatement } from "./builders/customer-statement";
import { buildSupplierStatement } from "./builders/supplier-statement";
import { buildPaymentReport } from "./builders/payment-report";
import { buildReconciliationReport } from "./builders/reconciliation-report";
import { buildTreasuryReport } from "./builders/treasury-report";
import { buildExpenseReport } from "./builders/expense-report";
import { buildExecutiveSummary } from "./builders/executive-summary";
import { buildVatReturn } from "./builders/vat-return";
import { buildArAgingLedger, buildApAgingLedger } from "./builders/ledger-aging";

export type ReportBuilder = (ctx: ReportBuildContext) => Promise<ReportPayload>;

interface RegistryEntry {
  descriptor: ReportTemplateDescriptor;
  build: ReportBuilder;
}

const REGISTRY: Record<ReportType, RegistryEntry> = {
  customer_statement: {
    descriptor: {
      type: "customer_statement",
      visibility: "external",
      title: "Customer Account Statement",
      description: "Official statement for a customer — invoices, payments, balance. Safe to send.",
      required_filters: ["customer_id"],
      optional_filters: ["date_from", "date_to", "currency"],
      icon: "users",
    },
    build: buildCustomerStatement,
  },
  supplier_statement: {
    descriptor: {
      type: "supplier_statement",
      visibility: "external",
      title: "Supplier Account Statement",
      description: "Official statement for a supplier — purchases, payments, balance. Safe to send.",
      required_filters: ["supplier_id"],
      optional_filters: ["date_from", "date_to", "currency"],
      icon: "handshake",
    },
    build: buildSupplierStatement,
  },
  payment_report: {
    descriptor: {
      type: "payment_report",
      visibility: "internal",
      title: "Payment Activity Report",
      description: "All payments in a window — inflows, outflows, status, reconciliation. Internal only.",
      required_filters: ["date_from", "date_to"],
      optional_filters: ["currency"],
      icon: "wallet",
    },
    build: buildPaymentReport,
  },
  reconciliation_report: {
    descriptor: {
      type: "reconciliation_report",
      visibility: "internal",
      title: "Reconciliation Report",
      description: "Reconciled vs unreconciled movements for a period. Internal only.",
      required_filters: ["date_from", "date_to"],
      optional_filters: ["bank_account_id"],
      icon: "badge-check",
    },
    build: buildReconciliationReport,
  },
  treasury_report: {
    descriptor: {
      type: "treasury_report",
      visibility: "internal",
      title: "Treasury Position Report",
      description: "Bank balances, recent cash flow, reporting-currency view. Internal only.",
      required_filters: [],
      optional_filters: ["date_from", "date_to"],
      icon: "bank",
    },
    build: buildTreasuryReport,
  },
  expense_report: {
    descriptor: {
      type: "expense_report",
      visibility: "internal",
      title: "Expense Report",
      description: "Expenses by category for a period. Internal only.",
      required_filters: ["date_from", "date_to"],
      optional_filters: ["category_id", "currency"],
      icon: "receipt",
    },
    build: buildExpenseReport,
  },
  executive_summary: {
    descriptor: {
      type: "executive_summary",
      visibility: "internal",
      title: "Executive Finance Summary",
      description: "Revenue, profit, cash, AR/AP, treasury — single-page operator briefing. Internal only.",
      required_filters: ["date_from", "date_to"],
      optional_filters: [],
      icon: "file-invoice-dollar",
    },
    build: buildExecutiveSummary,
  },
  vat_return: {
    descriptor: {
      type: "vat_return",
      visibility: "internal",
      title: "VAT Return",
      description: "Output tax, input tax and net payable for a period, straight from account 2200. Internal only.",
      required_filters: ["date_from", "date_to"],
      optional_filters: [],
      icon: "tax",
    },
    build: buildVatReturn,
  },
  ar_aging_ledger: {
    descriptor: {
      type: "ar_aging_ledger",
      visibility: "internal",
      title: "Receivables Aging (Ledger)",
      description: "Open receivables by customer from the 1100 control account, aged 0–30 · 31–60 · 61–90 · 90+. Totals equal the trial balance.",
      required_filters: [],
      optional_filters: ["date_to"],
      icon: "users",
    },
    build: buildArAgingLedger,
  },
  ap_aging_ledger: {
    descriptor: {
      type: "ap_aging_ledger",
      visibility: "internal",
      title: "Payables Aging (Ledger)",
      description: "Open payables by supplier from the 2000 control account, aged 0–30 · 31–60 · 61–90 · 90+. Totals equal the trial balance.",
      required_filters: [],
      optional_filters: ["date_to"],
      icon: "handshake",
    },
    build: buildApAgingLedger,
  },
};
export function listReportTemplates(): ReportTemplateDescriptor[] {
  return Object.values(REGISTRY).map((r) => r.descriptor);
}

export function getReportEntry(type: ReportType): RegistryEntry | null {
  return REGISTRY[type] ?? null;
}

export function getReportVisibility(type: ReportType): ReportVisibility | null {
  return REGISTRY[type]?.descriptor.visibility ?? null;
}

/** Validates that all required_filters were provided. Returns the first
 *  missing filter name or null if everything's fine. */
export function findMissingRequiredFilter(
  type: ReportType,
  filters: Record<string, unknown>,
): string | null {
  const entry = REGISTRY[type];
  if (!entry) return "report_type";
  for (const k of entry.descriptor.required_filters) {
    const v = filters[k as string];
    if (v === undefined || v === null || v === "") return k as string;
  }
  return null;
}
