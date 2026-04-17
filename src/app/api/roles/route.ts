import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* GET  /api/roles    — list roles (any authenticated user)
   POST /api/roles    — create a new role (Super Admin only)

   The list is used by many pickers across the app (Account form,
   Employee wizard, Roles & Permissions admin, Management chart),
   so any logged-in user in the tenant can READ. Mutations require
   Super Admin. */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // Try the Koleex-specific roles table first (koleex_roles has the
  // richer fields used by the Roles admin). Fall back to the generic
  // "roles" table so existing callers that expect that shape still work.
  let q = supabaseServer
    .from("koleex_roles")
    .select("*")
    .order("name", { ascending: true });
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  let { data, error } = await q;
  if (error || !data || data.length === 0) {
    let q2 = supabaseServer
      .from("roles")
      .select("*")
      .order("name", { ascending: true });
    if (auth.tenant_id) q2 = q2.eq("tenant_id", auth.tenant_id);
    const res = await q2;
    data = res.data;
    error = res.error;
  }

  if (error) {
    console.error("[api/roles GET]", error.message);
    return NextResponse.json({ error: "Failed to load roles" }, { status: 500 });
  }
  return NextResponse.json({ roles: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json(
      { error: "Only Super Admin can create roles" },
      { status: 403 },
    );
  }

  const body = (await req.json()) as Record<string, unknown>;
  const row = {
    ...body,
    tenant_id: auth.tenant_id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("koleex_roles")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    console.error("[api/roles POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ role: data });
}
