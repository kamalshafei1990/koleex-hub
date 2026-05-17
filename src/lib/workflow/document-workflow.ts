/* ===========================================================================
   document-workflow — pure step builder used by DocumentWorkflowBanner.

   Kept out of the React component file so server scripts and validators
   can import without pulling next/link + React into the runtime.
   ========================================================================== */

import type { RrIconName } from "@/components/ui/RrIcon";

export type DocKind = "so" | "po" | "invoice" | "bill";

export type WorkflowState = "done" | "current" | "next";

export interface BuildOpts {
  kind: DocKind;
  status: string;
  documentId?: string | null;
  customerHref?: string | null;
  supplierHref?: string | null;
}

export interface WorkflowStepLite {
  key: string;
  label: string;
  icon: RrIconName;
  state: WorkflowState;
  hint?: string;
  href?: string;
}

const SO_STEPS: Array<{ key: string; label: string; icon: RrIconName }> = [
  { key: "customer", label: "Customer",    icon: "users" },
  { key: "so",       label: "Sales Order", icon: "file-invoice-dollar" },
  { key: "ship",     label: "Ship",        icon: "shipping-fast" },
  { key: "invoice",  label: "Invoice",     icon: "receipt" },
  { key: "pay",      label: "Payment",     icon: "money" },
];
const PO_STEPS: Array<{ key: string; label: string; icon: RrIconName }> = [
  { key: "supplier", label: "Supplier",    icon: "id-badge" },
  { key: "po",       label: "Purchase",    icon: "shipping-fast" },
  { key: "receive",  label: "Receive",     icon: "box-circle-check" },
  { key: "bill",     label: "Bill",        icon: "file-invoice" },
  { key: "pay",      label: "Payment",     icon: "money" },
];
const INVOICE_STEPS: Array<{ key: string; label: string; icon: RrIconName }> = [
  { key: "so",       label: "Sales Order", icon: "file-invoice-dollar" },
  { key: "ship",     label: "Ship",        icon: "shipping-fast" },
  { key: "invoice",  label: "Invoice",     icon: "receipt" },
  { key: "pay",      label: "Payment",     icon: "money" },
];
const BILL_STEPS: Array<{ key: string; label: string; icon: RrIconName }> = [
  { key: "po",       label: "Purchase",    icon: "shipping-fast" },
  { key: "receive",  label: "Receive",     icon: "box-circle-check" },
  { key: "bill",     label: "Bill",        icon: "file-invoice" },
  { key: "pay",      label: "Payment",     icon: "money" },
];

function currentIndex(kind: DocKind, status: string): number {
  const s = (status ?? "").toLowerCase();
  if (kind === "so") {
    if (s === "draft" || s === "confirmed") return 1;
    if (s === "partial" || s === "shipped") return 2;
    if (s === "closed") return 4;
    return 1;
  }
  if (kind === "po") {
    if (s === "draft" || s === "approved") return 1;
    if (s === "partial" || s === "received") return 2;
    if (s === "billed") return 3;
    if (s === "paid") return 4;
    return 1;
  }
  if (kind === "invoice") {
    if (s === "draft" || s === "issued") return 2;
    if (s === "partial" || s === "paid") return 3;
    return 2;
  }
  /* bill */
  if (s === "draft" || s === "received") return 2;
  if (s === "partial" || s === "billed") return 2;
  if (s === "paid") return 3;
  return 2;
}

export function buildWorkflowSteps(opts: BuildOpts): WorkflowStepLite[] {
  const base =
    opts.kind === "so"      ? SO_STEPS :
    opts.kind === "po"      ? PO_STEPS :
    opts.kind === "invoice" ? INVOICE_STEPS :
                              BILL_STEPS;
  const current = currentIndex(opts.kind, opts.status);
  return base.map((s, i) => ({
    key: s.key, label: s.label, icon: s.icon,
    state: (i < current ? "done" : i === current ? "current" : "next") as WorkflowState,
    hint: i === current ? "You are here" : i < current ? "Done" : "Next",
    href:
      s.key === "customer" && opts.customerHref ? opts.customerHref :
      s.key === "supplier" && opts.supplierHref ? opts.supplierHref :
      undefined,
  }));
}
