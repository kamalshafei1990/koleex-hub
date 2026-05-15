import "server-only";

/* ---------------------------------------------------------------------------
   /api/shipping-documents — master list of certificates / waybills /
   invoices the operator can promise on a Quotation or Invoice.

   Same CRUD shape as /api/payment-terms, /api/incoterms, etc. Super-
   admin only on mutations; system seeds are immutable.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await supabaseServer
    .from("shipping_documents")
    .select("*")
    .or(`tenant_id.is.null,tenant_id.eq.${auth.tenant_id}`)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    { rows: data ?? [], tenant_id: auth.tenant_id },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" } },
  );
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Super-admin only." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !body.code || !body.name || !body.category) {
    return NextResponse.json({ error: "code, name and category required." }, { status: 400 });
  }
  const { data, error } = await supabaseServer
    .from("shipping_documents")
    .insert({
      ...body,
      tenant_id: auth.tenant_id,
      is_system: false,
      is_active: true,
      created_by: auth.account_id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row: data });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Super-admin only." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as
    | (Record<string, unknown> & { id?: string })
    | null;
  if (!body || !body.id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }
  const { data: existing } = await supabaseServer
    .from("shipping_documents")
    .select("tenant_id, is_system")
    .eq("id", body.id)
    .single();
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (existing.is_system) {
    return NextResponse.json({ error: "System documents are read-only." }, { status: 403 });
  }
  if (existing.tenant_id !== auth.tenant_id) {
    return NextResponse.json({ error: "Not in your tenant." }, { status: 403 });
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of Object.keys(body)) if (k !== "id") patch[k] = body[k];
  const { data, error } = await supabaseServer
    .from("shipping_documents")
    .update(patch)
    .eq("id", body.id)
    .eq("tenant_id", auth.tenant_id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row: data });
}

export async function DELETE(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Super-admin only." }, { status: 403 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id query param required." }, { status: 400 });
  const { data: existing } = await supabaseServer
    .from("shipping_documents")
    .select("tenant_id, is_system")
    .eq("id", id)
    .single();
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (existing.is_system) {
    return NextResponse.json({ error: "System documents cannot be deleted." }, { status: 403 });
  }
  if (existing.tenant_id !== auth.tenant_id) {
    return NextResponse.json({ error: "Not in your tenant." }, { status: 403 });
  }
  const { error } = await supabaseServer
    .from("shipping_documents")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
