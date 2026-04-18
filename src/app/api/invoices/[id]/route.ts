import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Invoices");
  if (deny) return deny;
  const { id } = await params;

  const [invRes, itemsRes, paymentsRes] = await Promise.all([
    supabaseServer
      .from("invoices")
      .select(
        `*,
         customer:customer_id ( id, display_name, company_name, emails, phones, addresses )`,
      )
      .eq("id", id)
      .eq("tenant_id", auth.tenant_id)
      .maybeSingle(),
    supabaseServer
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", id)
      .order("sort_order", { ascending: true }),
    supabaseServer
      .from("invoice_payments")
      .select("*")
      .eq("tenant_id", auth.tenant_id)
      .eq("invoice_id", id)
      .order("received_at", { ascending: false }),
  ]);

  if (invRes.error) return NextResponse.json({ error: invRes.error.message }, { status: 500 });
  if (!invRes.data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    invoice: invRes.data,
    items: itemsRes.data ?? [],
    payments: paymentsRes.data ?? [],
  });
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Invoices");
  if (deny) return deny;
  const { id } = await params;

  const body = (await req.json()) as Record<string, unknown>;
  const allowed = [
    "customer_id", "currency", "issue_date", "due_date",
    "payment_terms", "notes", "terms",
    "linked_quotation_id", "linked_project_id", "status",
    // totals fields are maintained server-side when lines change
  ];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) patch[k] = body[k];

  if (patch.status === "paid") patch.paid_at = new Date().toISOString();
  if (patch.status === "cancelled" || patch.status === "void") patch.cancelled_at = new Date().toISOString();

  const { data, error } = await supabaseServer
    .from("invoices")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice: data });
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Invoices");
  if (deny) return deny;
  const { id } = await params;

  // Hard delete cascades items + payments via FK.
  const { error } = await supabaseServer
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
