import "server-only";

/* ===========================================================================
   GET /api/accounting/revenue
     ?status=          optional filter (draft | posted | voided)
     ?limit=           default 100, max 500

   Returns sales_revenue journal entries enriched with invoice
   number + customer name + total so the queue can render rows
   without a second round-trip.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import type { JournalEntry, JournalStatus } from "@/lib/accounting/types";

interface RevenueRow extends JournalEntry {
  invoice_no: string | null;
  customer_id: string | null;
  customer_name: string | null;
  total: number;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") as JournalStatus | null;
  const limit  = Math.min(Number(url.searchParams.get("limit")) || 100, 500);

  let q = supabaseServer
    .from("accounting_journal_entries")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .eq("source_type", "sales_revenue")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status) q = q.eq("status", status);
  const { data: entries, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const list = (entries ?? []) as JournalEntry[];
  if (list.length === 0) return NextResponse.json({ entries: [] });

  const ids = list.map((e) => e.id);
  const sourceIds = Array.from(new Set(list.map((e) => e.source_id).filter(Boolean) as string[]));

  const [linesRes, invRes] = await Promise.all([
    supabaseServer
      .from("accounting_journal_lines")
      .select("entry_id, debit")
      .eq("tenant_id", auth.tenant_id)
      .in("entry_id", ids),
    sourceIds.length
      ? supabaseServer
          .from("invoices")
          .select("id, inv_no, customer_id")
          .in("id", sourceIds)
          .eq("tenant_id", auth.tenant_id)
      : Promise.resolve({ data: [] as Array<{ id: string; inv_no: string | null; customer_id: string | null }> }),
  ]);
  const totalByEntry = new Map<string, number>();
  for (const l of (linesRes.data ?? []) as Array<{ entry_id: string; debit: number }>) {
    totalByEntry.set(l.entry_id, (totalByEntry.get(l.entry_id) ?? 0) + (Number(l.debit) || 0));
  }
  const invMap = new Map<string, { inv_no: string | null; customer_id: string | null }>();
  for (const i of (invRes.data ?? []) as Array<{ id: string; inv_no: string | null; customer_id: string | null }>) {
    invMap.set(i.id, { inv_no: i.inv_no, customer_id: i.customer_id });
  }
  /* Customer names — join through `customers` table. */
  const customerIds = Array.from(new Set(Array.from(invMap.values()).map((v) => v.customer_id).filter(Boolean) as string[]));
  const custRes = customerIds.length
    ? await supabaseServer.from("customers").select("id, name").in("id", customerIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const custMap = new Map<string, string>();
  for (const c of (custRes.data ?? [])) custMap.set(c.id, c.name);

  const enriched: RevenueRow[] = list.map((e) => {
    const inv = e.source_id ? invMap.get(e.source_id) : undefined;
    return {
      ...e,
      invoice_no: inv?.inv_no ?? null,
      customer_id: inv?.customer_id ?? null,
      customer_name: inv?.customer_id ? custMap.get(inv.customer_id) ?? null : null,
      total: totalByEntry.get(e.id) ?? 0,
    };
  });
  return NextResponse.json({ entries: enriched });
}
