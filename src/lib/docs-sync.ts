"use client";

import { humanizeError } from "@/lib/ui/humanize-error";

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
  // Optimistic-lock + provenance (quotations). Optional so invoice rows,
  // which don't carry these, still satisfy the type.
  version?: number;
  updated_by?: string | null;
  updated_by_name?: string | null;
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

/* Thrown by upsertDoc when the server rejects a save because the row was
   changed by another user since this client loaded it (HTTP 409). Carries
   the latest version + who/when so the editor can show the conflict dialog
   and offer Load Latest / Save as Copy. */
export class DocConflictError extends Error {
  readonly conflict = true as const;
  readonly current: { version: number | null; updated_by_name: string | null; updated_at: string | null };
  constructor(current: DocConflictError["current"]) {
    super("This quotation was updated by another user.");
    this.name = "DocConflictError";
    this.current = current;
  }
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

import { cachedFetchJson, invalidateFetchCache } from "@/lib/fetch-cache";

export async function fetchDocList<T = Record<string, unknown>>(
  b: DocBindings<string, string>,
  opts: { fresh?: boolean } = {},
): Promise<RemoteDocRow<T>[]> {
  // 3 s client cache + in-flight dedup. The server also sends
  // Cache-Control: max-age=30 so rapid navigation is instant.
  //
  // `fresh: true` bypasses BOTH the in-memory client cache AND the
  // browser HTTP cache (via `cache: "no-store"`). Use it right after
  // a write (delete / upsert) so the list reflects the new state —
  // otherwise the browser may keep serving the cached payload for up
  // to the Cache-Control max-age window and the row appears to
  // "reappear" after a delete.
  try {
    const json = await cachedFetchJson<Record<string, RemoteDocRow<T>[]>>(
      b.listPath,
      opts.fresh ? { ttl: 0, init: { cache: "no-store" } } : {},
    );
    return json[b.listKey] ?? [];
  } catch {
    return [];
  }
}

export async function fetchDocOne<T = Record<string, unknown>>(
  b: DocBindings<string, string>,
  id: string,
): Promise<RemoteDocRow<T> | null> {
  // Always bypass the browser HTTP cache when fetching a single doc
  // — the editor MUST reflect the latest server state (image edits,
  // qty changes, price updates etc.), and any cached response would
  // re-mount the editor with stale items.
  const res = await fetch(`${b.listPath}/${id}`, {
    credentials: "include",
    cache: "no-store",
  });
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
  if (!res.ok) {
    // 409 = optimistic-lock conflict. Surface a typed error carrying the
    // latest version so the caller can show the "updated by another user"
    // dialog (Load Latest / Save as Copy / Cancel) instead of a generic alert.
    if (res.status === 409) {
      let current = { version: null as number | null, updated_by_name: null as string | null, updated_at: null as string | null };
      try {
        const j = await res.json();
        if (j && j.current) current = { version: j.current.version ?? null, updated_by_name: j.current.updated_by_name ?? null, updated_at: j.current.updated_at ?? null };
      } catch { /* ignore */ }
      throw new DocConflictError(current);
    }
    // Pull the server's error message and THROW with a human-friendly
    // sentence. Raw Postgres FK / 422 / 500 strings were leaking into
    // the operator's alert modal (e.g. "violates foreign key
    // constraint quotations_created_by_fkey"). humanizeError maps
    // those to plain English; we keep the HTTP status as a fallback
    // when no error body is present.
    let detail = "";
    try {
      const j = await res.json();
      detail = (j && typeof j.error === "string") ? j.error : "";
    } catch {
      try { detail = await res.text(); } catch { /* ignore */ }
    }
    throw new Error(humanizeError(detail || `HTTP ${res.status}`));
  }
  // Bust any cached list/detail responses so the next read is fresh.
  invalidateFetchCache(b.listPath);
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
  if (res.ok) invalidateFetchCache(b.listPath);
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
