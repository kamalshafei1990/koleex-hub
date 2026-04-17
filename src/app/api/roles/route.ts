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

  // Roles are GLOBAL (no tenant_id column) — role templates are shared
  // across all tenants. Try koleex_roles first (richer fields for the
  // Roles admin), fall back to "roles".
  let { data, error } = await supabaseServer
    .from("koleex_roles")
    .select("*")
    .order("name", { ascending: true });
  if (error || !data || data.length === 0) {
    const res = await supabaseServer
      .from("roles")
      .select("*")
      .order("name", { ascending: true });
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
  // Roles are global — no tenant_id column.
  delete body.tenant_id;
  const row = {
    ...body,
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
