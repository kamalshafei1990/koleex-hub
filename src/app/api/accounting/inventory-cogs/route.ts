import "server-only";

/* ===========================================================================
   GET /api/accounting/inventory-cogs
     ?status=        optional filter (draft | posted | voided)
     ?limit=         default 100, max 500

   Returns inventory_cogs journal entries enriched with the shipment
   number + total cost so the Accounting Queue can render rows without
   a second round-trip.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import type { JournalEntry, JournalStatus } from "@/lib/accounting/types";

interface CogsRow extends JournalEntry {
  shipment_no: string | null;
  sales_order_id: string | null;
  total_cost: number;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") as JournalStatus | null;
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 500);

  /* Fetch the entries first; total_cost lives on the lines table
     (Dr 5400 line carries the amount). */
  let q = supabaseServer
    .from("accounting_journal_entries")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .eq("source_type", "inventory_cogs")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status) q = q.eq("status", status);
  const { data: entries, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const list = (entries ?? []) as JournalEntry[];
  if (list.length === 0) return NextResponse.json({ entries: [] });

  const ids = list.map((e) => e.id);
  const sourceIds = Array.from(new Set(list.map((e) => e.source_id).filter(Boolean) as string[]));

  const [linesRes, shipsRes] = await Promise.all([
    supabaseServer
      .from("accounting_journal_lines")
      .select("entry_id, debit")
      .eq("tenant_id", auth.tenant_id)
      .in("entry_id", ids),
    sourceIds.length
      ? supabaseServer
          .from("sales_shipments")
          .select("id, shipment_no, sales_order_id")
          .in("id", sourceIds)
          .eq("tenant_id", auth.tenant_id)
      : Promise.resolve({ data: [] as Array<{ id: string; shipment_no: string; sales_order_id: string }> }),
  ]);
  /* Sum debit per entry — the Dr 5400 line is the COGS amount;
     the Cr 1400 line has debit=0. */
  const totalByEntry = new Map<string, number>();
  for (const l of (linesRes.data ?? []) as Array<{ entry_id: string; debit: number }>) {
    totalByEntry.set(l.entry_id, (totalByEntry.get(l.entry_id) ?? 0) + (Number(l.debit) || 0));
  }
  const shipMap = new Map<string, { shipment_no: string; sales_order_id: string }>();
  for (const s of (shipsRes.data ?? []) as Array<{ id: string; shipment_no: string; sales_order_id: string }>) {
    shipMap.set(s.id, { shipment_no: s.shipment_no, sales_order_id: s.sales_order_id });
  }

  const enriched: CogsRow[] = list.map((e) => {
    const ship = e.source_id ? shipMap.get(e.source_id) : undefined;
    return {
      ...e,
      shipment_no: ship?.shipment_no ?? null,
      sales_order_id: ship?.sales_order_id ?? null,
      total_cost: totalByEntry.get(e.id) ?? 0,
    };
  });

  return NextResponse.json({ entries: enriched });
}
