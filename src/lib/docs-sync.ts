"use client";

/* ---------------------------------------------------------------------------
   docs-sync — shared client-side persistence for the Quotations +
   Invoices doc builders. Both apps have identical CRUD needs:
     • list rows for the caller's tenant
     • upsert the current doc (insert or update by id)
     • delete by id
     • fetch one by id (hydrate when opening an existing record)

   Implemented as a generic helper parameterised by endpoint path +
   the "record wrapper key" each route returns (invoice / quotation).
   --------------------------------------------------------------------------- */

export interface RemoteDocRow<TDoc = Record<string, unknown>> {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  status: string;
  currency: string;
  total: number;
  issue_date: string | null;
  created_at: string;
  updated_at: string;
  doc: TDoc;
  // quote/invoice-specific
  quote_no?: string | null;
  inv_no?: string | null;
  valid_till?: string | null;
  due_date?: string | null;
  amount_paid?: number;
  balance?: number;
  linked_quotation_id?: string | null;
  customer?: { id: string; display_name: string | null; company_name: string | null } | null;
}

interface DocBindings<TList extends string, TOne extends string> {
  listPath: string;      // e.g. "/api/quotations"
  oneKey: TOne;          // "quotation" or "invoice"
  listKey: TList;        // "quotations" or "invoices"
}

export const QUOTATIONS_SYNC: DocBindings<"quotations", "quotation"> = {
  listPath: "/api/quotations",
  oneKey: "quotation",
  listKey: "quotations",
};

export const INVOICES_DOC_SYNC: DocBindings<"invoices", "invoice"> = {
  listPath: "/api/invoices/doc",
  oneKey: "invoice",
  listKey: "invoices",
};

export async function fetchDocList<T = Record<string, unknown>>(
  b: DocBindings<string, string>,
): Promise<RemoteDocRow<T>[]> {
  const res = await fetch(b.listPath, { credentials: "include" });
  if (!res.ok) return [];
  const json = (await res.json()) as Record<string, RemoteDocRow<T>[]>;
  return json[b.listKey] ?? [];
}

export async function fetchDocOne<T = Record<string, unknown>>(
  b: DocBindings<string, string>,
  id: string,
): Promise<RemoteDocRow<T> | null> {
  const res = await fetch(`${b.listPath}/${id}`, { credentials: "include" });
  if (!res.ok) return null;
  const json = (await res.json()) as Record<string, RemoteDocRow<T>>;
  return json[b.oneKey] ?? null;
}

export async function upsertDoc<T = Record<string, unknown>>(
  b: DocBindings<string, string>,
  body: Record<string, unknown>,
): Promise<RemoteDocRow<T> | null> {
  const res = await fetch(b.listPath, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as Record<string, RemoteDocRow<T>>;
  return json[b.oneKey] ?? null;
}

export async function deleteDoc(
  b: DocBindings<string, string>,
  id: string,
): Promise<boolean> {
  const res = await fetch(`${b.listPath}/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  return res.ok;
}

/** Convert a quotation row to a brand new draft invoice on the server. */
export async function convertQuotationToInvoice(
  quotationId: string,
  dueDate?: string,
): Promise<RemoteDocRow | null> {
  const res = await fetch("/api/invoices/doc/from-quotation", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quotation_id: quotationId, due_date: dueDate }),
  });
  if (!res.ok) return null;
  const { invoice } = (await res.json()) as { invoice: RemoteDocRow };
  return invoice;
}
