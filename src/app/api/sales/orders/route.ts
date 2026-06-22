import "server-only";

/* ===========================================================================
   GET  /api/sales/orders     list recent SOs for the tenant
   POST /api/sales/orders     create a SO header + items
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { listSalesOrders } from "@/lib/sales/queries";
import { resolveBaseCurrency } from "@/lib/finance/currency";

const MODULE = "Orders";    // Sales-orders sub-module key

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit"));
  try {
    const orders = await listSalesOrders(auth.tenant_id, {
      search: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      since:  url.searchParams.get("since")  ?? undefined,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 100,
    });
    return NextResponse.json({ orders });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

interface SoItemBody {
  inventory_item_id?: string | null;
  product_id?: string | null;
  description?: string | null;
  qty: number;
  unit_price?: number;
}

interface CreateSoBody {
  so_no?: string | null;
  customer_id: string;
  currency?: string;
  notes?: string | null;
  status?: "draft" | "confirmed";
  items?: SoItemBody[];
}

function generateSoNo(): string {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const tail = (Date.now().toString(16) + Math.random().toString(16).slice(2))
    .replace(/\./g, "")
    .slice(-6)
    .toUpperCase();
  return `SO-${ymd}-${tail}`;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, MODULE, "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as CreateSoBody | null;
  if (!body?.customer_id) {
    return NextResponse.json({ error: "customer_id required" }, { status: 400 });
  }

  const items = body.items ?? [];

  /* Server fallback when the form omitted currency: use tenant base
     (CNY for KOLEEX). The sales-order form pre-fills USD as the
     selling currency, so this only fires for API consumers /
     legacy clients — and there it must not silently write USD when
     the tenant's books are in CNY. */
  const baseCurrency = await resolveBaseCurrency(auth.tenant_id);
  const { data: row, error } = await supabaseServer
    .from("sales_orders")
    .insert({
      tenant_id: auth.tenant_id,
      so_no: body.so_no ?? generateSoNo(),
      customer_id: body.customer_id,
      status: body.status ?? "draft",
      currency: body.currency ?? baseCurrency,
      notes: body.notes ?? null,
      created_by: auth.account_id,
    })
    .select("id, so_no")
    .single();
  if (error || !row) return NextResponse.json({ error: error?.message ?? "SO insert failed" }, { status: 500 });

  if (items.length > 0) {
    const soId = (row as { id: string }).id;
    /* INV-H1 — When a line carries product_id but no inventory_item_id,
       resolve it via the linked stock profile (don't auto-create — the
       product needs an explicit stock profile to be shippable). */
    const lineRows = await Promise.all(items.map(async (it) => {
      const qty = Number(it.qty) || 0;
      const price = Number(it.unit_price) || 0;
      let resolvedItemId = it.inventory_item_id ?? null;
      if (!resolvedItemId && it.product_id) {
        const { data: profile } = await supabaseServer
          .from("inventory_items")
          .select("id")
          .eq("tenant_id", auth.tenant_id)
          .eq("linked_product_id", it.product_id)
          .is("deleted_at", null)
          .neq("status", "archived")
          .maybeSingle();
        if (profile) resolvedItemId = (profile as { id: string }).id;
      }
      return {
        sales_order_id: soId,
        inventory_item_id: resolvedItemId,
        product_id: it.product_id ?? null,
        description: it.description ?? null,
        qty,
        qty_shipped: 0,
        unit_price: price,
        total: qty * price,
      };
    }));
    const { error: itemsErr } = await supabaseServer.from("sales_order_items").insert(lineRows);
    if (itemsErr) {
      await supabaseServer.from("sales_orders").delete().eq("id", soId);
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ order: row });
}
