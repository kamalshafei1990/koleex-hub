import "server-only";

/* ===========================================================================
   GET /api/accounting/queue?status=...&limit=...

   Returns operational events awaiting accounting recognition. Pulls
   from finance_payments + finance_expenses + finance_cash_movements
   and normalises each row into a single "queue item" shape.

   Query params:
     · status = pending | drafted | posted | failed | voided | all
                (default: pending, drafted, failed — the actionable set)
     · limit  = max rows per kind (default 100, ceiling 500)
     · kind   = payment | expense | cash_movement (optional filter)

   Every query is tenant-scoped; cross-tenant access returns empty.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

export type QueueStatus = "pending" | "drafted" | "posted" | "failed" | "voided";

export interface QueueItem {
  kind: "payment" | "expense" | "cash_movement";
  source_id: string;
  description: string;
  party_name: string | null;
  amount: number;
  currency: string;
  source_date: string;
  accounting_status: QueueStatus;
  accounting_entry_id: string | null;
  accounting_last_error: string | null;
  accounting_posted_at: string | null;
  created_at: string;
}

const ACTIONABLE_STATUSES: QueueStatus[] = ["pending", "drafted", "failed"];

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const kindParam = url.searchParams.get("kind");
  const reqLimit = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(reqLimit) && reqLimit > 0 ? Math.min(reqLimit, 500) : 100;

  /* Resolve which statuses to include. `all` returns everything;
     omitted defaults to the actionable triplet. */
  const statuses: QueueStatus[] = statusParam === "all"
    ? ["pending", "drafted", "posted", "failed", "voided"]
    : statusParam
      ? statusParam.split(",").filter((s): s is QueueStatus =>
          ["pending", "drafted", "posted", "failed", "voided"].includes(s),
        )
      : ACTIONABLE_STATUSES;

  /* For the "posted today" surface, we still want a window. The
     queue page reads "posted today" by passing status=posted AND a
     date filter; here we apply a 14-day window only when status
     INCLUDES posted, so the queue doesn't blow up on long histories. */
  const sinceIso = new Date(Date.now() - 14 * 86_400_000).toISOString();

  /* Pull from each source table in parallel, normalising at the
     application layer (rather than a SQL UNION) so the columns each
     table cares about stay typed and we don't ship a stored proc
     just for the queue. */
  const wantPayment = !kindParam || kindParam === "payment";
  const wantExpense = !kindParam || kindParam === "expense";
  const wantMovement = !kindParam || kindParam === "cash_movement";

  const [payRes, expRes, movRes] = await Promise.all([
    wantPayment
      ? supabaseServer
          .from("finance_payments")
          .select("id, direction, party_type, party_name, amount, currency, payment_date, reference_no, status, accounting_status, accounting_entry_id, accounting_last_error, accounting_posted_at, created_at")
          .eq("tenant_id", auth.tenant_id)
          .in("accounting_status", statuses)
          .gte("created_at", statuses.includes("posted") ? sinceIso : "1900-01-01")
          .order("created_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] }),
    wantExpense
      ? supabaseServer
          .from("finance_expenses")
          .select("id, title, amount, currency, expense_date, payment_status, linked_supplier_id, accounting_status, accounting_entry_id, accounting_last_error, accounting_posted_at, created_at")
          .eq("tenant_id", auth.tenant_id)
          .in("accounting_status", statuses)
          .gte("created_at", statuses.includes("posted") ? sinceIso : "1900-01-01")
          .order("created_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] }),
    wantMovement
      ? supabaseServer
          .from("finance_cash_movements")
          .select("id, direction, amount, currency, movement_date, bank_reference, counterparty_name, accounting_status, accounting_entry_id, accounting_last_error, accounting_posted_at, created_at")
          .eq("tenant_id", auth.tenant_id)
          .in("accounting_status", statuses)
          .gte("created_at", statuses.includes("posted") ? sinceIso : "1900-01-01")
          .order("created_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] }),
  ]);

  const items: QueueItem[] = [];

  for (const p of (payRes.data ?? []) as Array<{
    id: string; direction: string; party_name: string; amount: number | string; currency: string;
    payment_date: string; reference_no: string | null; status: string;
    accounting_status: QueueStatus; accounting_entry_id: string | null;
    accounting_last_error: string | null; accounting_posted_at: string | null;
    created_at: string;
  }>) {
    items.push({
      kind: "payment",
      source_id: p.id,
      description: p.direction === "in" ? "Customer collection" : "Supplier payment",
      party_name: p.party_name ?? null,
      amount: Number(p.amount) || 0,
      currency: p.currency,
      source_date: p.payment_date,
      accounting_status: p.accounting_status,
      accounting_entry_id: p.accounting_entry_id,
      accounting_last_error: p.accounting_last_error,
      accounting_posted_at: p.accounting_posted_at,
      created_at: p.created_at,
    });
  }

  for (const e of (expRes.data ?? []) as Array<{
    id: string; title: string; amount: number | string; currency: string; expense_date: string;
    payment_status: string; linked_supplier_id: string | null;
    accounting_status: QueueStatus; accounting_entry_id: string | null;
    accounting_last_error: string | null; accounting_posted_at: string | null;
    created_at: string;
  }>) {
    items.push({
      kind: "expense",
      source_id: e.id,
      description: e.title,
      party_name: null,
      amount: Number(e.amount) || 0,
      currency: e.currency,
      source_date: e.expense_date,
      accounting_status: e.accounting_status,
      accounting_entry_id: e.accounting_entry_id,
      accounting_last_error: e.accounting_last_error,
      accounting_posted_at: e.accounting_posted_at,
      created_at: e.created_at,
    });
  }

  for (const m of (movRes.data ?? []) as Array<{
    id: string; direction: string; amount: number | string; currency: string; movement_date: string;
    bank_reference: string | null; counterparty_name: string | null;
    accounting_status: QueueStatus; accounting_entry_id: string | null;
    accounting_last_error: string | null; accounting_posted_at: string | null;
    created_at: string;
  }>) {
    items.push({
      kind: "cash_movement",
      source_id: m.id,
      description: m.direction === "inflow" ? "Bank inflow" : "Bank outflow",
      party_name: m.counterparty_name ?? null,
      amount: Number(m.amount) || 0,
      currency: m.currency,
      source_date: m.movement_date,
      accounting_status: m.accounting_status,
      accounting_entry_id: m.accounting_entry_id,
      accounting_last_error: m.accounting_last_error,
      accounting_posted_at: m.accounting_posted_at,
      created_at: m.created_at,
    });
  }

  /* Sort the combined list newest-first by source date. */
  items.sort((a, b) => b.created_at.localeCompare(a.created_at));

  /* Counts by status — drives the tab badges. Counts are limited to
     the same 3-table window scanned above, so they reflect what's
     actually in the queue, not the entire historical ledger. */
  const counts: Record<QueueStatus, number> = {
    pending: 0, drafted: 0, posted: 0, failed: 0, voided: 0,
  };
  for (const it of items) counts[it.accounting_status] += 1;

  return NextResponse.json({ items, counts });
}
