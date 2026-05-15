import "server-only";

/* ---------------------------------------------------------------------------
   /api/incoterms — master list of Incoterms 2020 + common variants.

   GET     — list (system seeds ∪ tenant customs), 60 s private cache.
   POST    — create custom (super-admin only).
   PATCH   — edit tenant custom (super-admin only; system rows are immutable).
   DELETE  — soft delete (super-admin only).

   Same shape and conventions as /api/payment-terms so the two settings
   surfaces feel identical to operate.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabaseServer
    .from("incoterms")
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
  if (!body || !body.code || !body.name) {
    return NextResponse.json({ error: "code and name are required." }, { status: 400 });
  }

  /* Auto-demote any existing default if this row is flagged default. */
  if (body.is_default === true) {
    await supabaseServer.from("incoterms")
      .update({ is_default: false })
      .eq("tenant_id", auth.tenant_id);
  }

  const { data, error } = await supabaseServer
    .from("incoterms")
    .insert({
      ...body,
      tenant_id: auth.tenant_id,
      standing: "custom",
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
    .from("incoterms")
    .select("id, tenant_id, is_system")
    .eq("id", body.id)
    .single();
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (existing.is_system) {
    return NextResponse.json({ error: "System Incoterms are read-only." }, { status: 403 });
  }
  if (existing.tenant_id !== auth.tenant_id) {
    return NextResponse.json({ error: "Not in your tenant." }, { status: 403 });
  }
  if (body.is_default === true) {
    await supabaseServer.from("incoterms")
      .update({ is_default: false })
      .eq("tenant_id", auth.tenant_id)
      .neq("id", body.id);
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of Object.keys(body)) if (k !== "id") patch[k] = body[k];
  const { data, error } = await supabaseServer
    .from("incoterms")
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
    .from("incoterms")
    .select("tenant_id, is_system")
    .eq("id", id)
    .single();
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (existing.is_system) {
    return NextResponse.json({ error: "System Incoterms cannot be deleted." }, { status: 403 });
  }
  if (existing.tenant_id !== auth.tenant_id) {
    return NextResponse.json({ error: "Not in your tenant." }, { status: 403 });
  }
  const { error } = await supabaseServer
    .from("incoterms")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
