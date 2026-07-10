"use client";

/* ---------------------------------------------------------------------------
   documents-store — client persistence for the Documents app's OWN store
   (/api/documents). Reuses the battle-tested upsert / fetch-one / delete
   helpers from docs-sync (409 conflict handling, humanized errors, cache
   invalidation) and adds a kind-filtered list.
   --------------------------------------------------------------------------- */

import { upsertDoc, fetchDocOne, deleteDoc, type RemoteDocRow } from "@/lib/docs-sync";

export type DocKind = "quotation" | "invoice" | "packing_list";

/* A saved Documents row. `doc` holds the full UI snapshot (Quotation shape for
   quotation/invoice, { rows, meta } for packing_list). */
export interface DocumentRow<TDoc = Record<string, unknown>> extends RemoteDocRow<TDoc> {
  doc_kind: DocKind;
  doc_no: string | null;
  title: string | null;
  due_date: string | null;
}

/* docs-sync binding for /api/documents. The `DocBindings` interface isn't
   exported, but the helpers accept any structurally-matching literal. */
const DOCUMENTS_SYNC = {
  listPath: "/api/documents",
  oneKey: "document",
  listKey: "documents",
} as const;

export async function listDocuments(
  kind?: DocKind,
  opts: { fresh?: boolean } = {},
): Promise<DocumentRow[]> {
  const qs = kind ? `?doc_kind=${encodeURIComponent(kind)}` : "";
  try {
    const res = await fetch(`/api/documents${qs}`, {
      credentials: "include",
      ...(opts.fresh ? { cache: "no-store" as RequestCache } : {}),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { documents?: DocumentRow[] };
    return json.documents ?? [];
  } catch {
    return [];
  }
}

export async function getDocument(id: string): Promise<DocumentRow | null> {
  return (await fetchDocOne(DOCUMENTS_SYNC, id)) as DocumentRow | null;
}

export interface SaveDocumentBody {
  id?: string;
  doc_kind: DocKind;
  doc_no?: string | null;
  title?: string | null;
  customer_id?: string | null;
  currency?: string;
  status?: string;
  issue_date?: string;
  due_date?: string | null;
  total?: number;
  doc: Record<string, unknown>;
  base_version?: number;
}

export async function saveDocument(body: SaveDocumentBody): Promise<DocumentRow | null> {
  return (await upsertDoc(DOCUMENTS_SYNC, body as unknown as Record<string, unknown>)) as DocumentRow | null;
}

export async function removeDocument(id: string): Promise<boolean> {
  return deleteDoc(DOCUMENTS_SYNC, id);
}
