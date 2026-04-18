import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { calcInvoiceTotals, type LineInput } from "@/lib/server/invoice-totals";

/* PUT /api/invoices/:id/lines — replace every line on the invoice and
   recompute header totals in one atomic-ish operation. Body:
     { lines: LineInput[], tax_rate?: number, discount_percent?: number } */

type RouteCtx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Invoices");
  if (deny) return deny;
  const { id } = await params;

  const body = (await req.json()) as {
    lines: LineInput[];
    tax_rate?: number;
    discount_percent?: number;
  };

  // Confirm the invoice exists in this tenant before we rewrite lines.
  const { data: inv } = await supabaseServer
    .from("invoices")
    .select("id, amount_paid")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { hydrated, subtotal, tax_total, discount_total, total } =
    calcInvoiceTotals(body.lines ?? [], body.tax_rate ?? 0, body.discount_percent ?? 0);

  // Clear old lines, insert new.
  await supabaseServer.from("invoice_items").delete().eq("invoice_id", id);
  if (hydrated.length > 0) {
    const { error: lineErr } = await supabaseServer
      .from("invoice_items")
      .insert(hydrated.map((h) => ({ ...h, invoice_id: id })));
    if (lineErr) return NextResponse.json({ error: lineErr.message }, { status: 500 });
  }

  // Balance = total − what's already been paid on this invoice.
  const balance = +(total - Number(inv.amount_paid ?? 0)).toFixed(2);

  const { data: updated, error } = await supabaseServer
    .from("invoices")
    .update({
      tax_rate: body.tax_rate ?? 0,
      discount_percent: body.discount_percent ?? 0,
      subtotal,
      tax_total,
      discount_total,
      total,
      balance,
    })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: items } = await supabaseServer
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", id)
    .order("sort_order", { ascending: true });

  return NextResponse.json({ invoice: updated, items: items ?? [] });
}
