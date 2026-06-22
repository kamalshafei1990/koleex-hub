import "server-only";

/* ===========================================================================
   GET  /api/purchase/orders   list recent POs for the tenant
   POST /api/purchase/orders   create a PO header + items (server-side
                                authoritative; replaces the client-side
                                supabase-admin insert path)
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { listPurchaseOrders } from "@/lib/purchase/queries";
import { resolveBaseCurrency } from "@/lib/finance/currency";

const MODULE = "Purchase";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit"));
  try {
    const orders = await listPurchaseOrders(auth.tenant_id, Number.isFinite(limit) && limit > 0 ? limit : 100);
    return NextResponse.json({ orders });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

interface PoItemBody {
  /* O.3.1: inventory_item_id is the primary operational handle.
     product_id remains supported as an optional catalog link. */
  inventory_item_id?: string | null;
  product_id?: string | null;
  description?: string | null;
  qty: number;
  unit?: string | null;
  unit_cost: number;
  tax_percent?: number;
  discount_percent?: number;
  line_total?: number;
  sort_order?: number;
}

interface CreatePoBody {
  po_no?: string | null;
  supplier_id: string;
  order_date?: string | null;
  expected_delivery_date?: string | null;
  currency?: string;
  exchange_rate?: number;
  payment_terms?: string | null;
  incoterms?: string | null;
  ship_to_address?: string | null;
  ship_to_warehouse?: string | null;
  notes?: string | null;
  internal_notes?: string | null;
  status?: "draft" | "confirmed";
  items?: PoItemBody[];
}

function generatePoNo(): string {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const tail = (Date.now().toString(16) + Math.random().toString(16).slice(2))
    .replace(/\./g, "")
    .slice(-6)
    .toUpperCase();
  return `PO-${ymd}-${tail}`;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, MODULE, "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as CreatePoBody | null;
  if (!body?.supplier_id) {
    return NextResponse.json({ error: "supplier_id required" }, { status: 400 });
  }

  const status = body.status ?? "draft";
  const items = body.items ?? [];

  /* Tally subtotal + line totals server-side so the client can't lie. */
  let subtotal = 0;
  const sanitisedItems = items.map((it, idx) => {
    const qty = Number(it.qty) || 0;
    const cost = Number(it.unit_cost) || 0;
    const taxPct = Number(it.tax_percent) || 0;
    const discountPct = Number(it.discount_percent) || 0;
    const gross = qty * cost;
    const discounted = gross * (1 - discountPct / 100);
    const lineTotal = discounted * (1 + taxPct / 100);
    subtotal += discounted;
    return {
      inventory_item_id: it.inventory_item_id ?? null,
      product_id: it.product_id ?? null,
      description: it.description ?? null,
      qty,
      qty_received: 0,
      qty_billed: 0,
      unit: it.unit ?? "pc",
      unit_cost: cost,
      tax_percent: taxPct,
      discount_percent: discountPct,
      line_total: lineTotal,
      sort_order: it.sort_order ?? idx,
    };
  });

  /* Currency: purchases default to the tenant's base currency
     (CNY for a Chinese tenant). Only the form's explicit override is
     honoured. */
  const purchaseDefaultCcy = await resolveBaseCurrency(auth.tenant_id);
  const { data: poRow, error: poErr } = await supabaseServer
    .from("purchase_orders")
    .insert({
      tenant_id: auth.tenant_id,
      po_no: body.po_no ?? generatePoNo(),
      supplier_id: body.supplier_id,
      status,
      order_date: body.order_date ?? new Date().toISOString().slice(0, 10),
      expected_delivery_date: body.expected_delivery_date ?? null,
      currency: body.currency ?? purchaseDefaultCcy,
      exchange_rate: body.exchange_rate ?? 1,
      payment_terms: body.payment_terms ?? null,
      incoterms: body.incoterms ?? null,
      ship_to_address: body.ship_to_address ?? null,
      ship_to_warehouse: body.ship_to_warehouse ?? null,
      subtotal,
      total: subtotal,
      notes: body.notes ?? null,
      internal_notes: body.internal_notes ?? null,
      created_by_account_id: auth.account_id,
    })
    .select("id, po_no")
    .single();
  if (poErr || !poRow) return NextResponse.json({ error: poErr?.message ?? "PO insert failed" }, { status: 500 });

  if (sanitisedItems.length > 0) {
    const poId = (poRow as { id: string }).id;
    const { error: itemsErr } = await supabaseServer
      .from("purchase_order_items")
      .insert(sanitisedItems.map((row) => ({ ...row, po_id: poId })));
    if (itemsErr) {
      await supabaseServer.from("purchase_orders").delete().eq("id", poId);
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ order: poRow });
}
