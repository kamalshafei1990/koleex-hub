/* Shared shapes for the sales-contract screen. Kept out of the components so
   the A4 renderer and the editor agree on one definition rather than two that
   drift. */

import type { ContractContext, RenderedArticle } from "@/lib/contracts/general-terms";

/** The negotiated set as stored in `sales_contracts.terms`. A superset of
    what the general articles read — the extra fields print on the face of
    the contract but do not change which articles appear. */
export interface ContractTerms extends ContractContext {
  incotermId?: string;
  loadingPort?: string;
  dischargePort?: string;
  containerType?: string;
  shippingMarks?: string;
  shippingMethodId?: string;
  paymentTermId?: string;
  bankCharges?: string;
  cancellationPolicy?: string;
  documents?: string[];
  specialConditions?: string[];
  buyer?: {
    name?: string;
    company?: string;
    address?: string;
    email?: string;
    phone?: string;
    website?: string;
    acid?: string;
    clientNo?: string;
  };
}

export interface ScheduleItem {
  name?: string;
  description?: string;
  /* Printed beside the description on the contract's schedule, the same way
     the invoice prints it — a buyer's bank matches on the model, not prose. */
  model?: string;
  qty?: number;
  /* ⚠️ The invoice's own items store the figure as `unitPrice`. `price` is
     kept for the frozen snapshots written before this was noticed — read
     BOTH, or a live contract prints every line at 0.00. */
  price?: number;
  unitPrice?: number;
}

export interface InvoiceLite {
  id: string;
  inv_no: string | null;
  deal_no: number | null;
  currency: string | null;
  total: number | null;
  doc: Record<string, unknown> | null;
}

/** What signature freezes. Written once, read forever. */
export interface SnapshotShape {
  termsVersion: string;
  frozenAt: string;
  contractNo: string;
  contractDate: string | null;
  placeOfSigning: string | null;
  currency: string | null;
  total: number | null;
  seller: { name: string };
  buyer: Record<string, string | undefined>;
  schedule: {
    invoiceNo: string | null;
    items: ScheduleItem[];
    currency: string | null;
    total: number;
    shipping: unknown;
    tax: unknown;
  };
  terms: ContractTerms;
  articles: RenderedArticle[];
}

export type ContractStatus = "draft" | "ready" | "signed" | "cancelled" | "superseded";

export interface ContractRow {
  id: string;
  tenant_id: string;
  deal_no: number;
  contract_no: string;
  order_id: string | null;
  invoice_id: string | null;
  /* The signed contract this one amends, when it is an amendment. */
  amends_id: string | null;
  customer_id: string | null;
  status: ContractStatus;
  contract_date: string | null;
  place_of_signing: string | null;
  currency: string | null;
  total: number | null;
  terms: ContractTerms;
  terms_version: string;
  snapshot: SnapshotShape | null;
  signed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** A neighbour in the amendment chain — enough to name it and link to it. */
export interface ContractRef {
  id: string;
  contract_no: string;
  status: ContractStatus;
  signed_at: string | null;
}
