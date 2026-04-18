import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET  /api/planning/roles — list roles for current tenant
   POST /api/planning/roles — create a new role */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("planning_roles")
    .select("id, tenant_id, name, color, hourly_rate, is_active, sort_order, created_at, updated_at")
    .eq("tenant_id", auth.tenant_id)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ roles: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;

  const body = (await req.json()) as {
    name: string;
    color?: string | null;
    hourly_rate?: number | null;
    sort_order?: number;
  };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("planning_roles")
    .insert({
      tenant_id: auth.tenant_id,
      name: body.name.trim(),
      color: body.color ?? null,
      hourly_rate: body.hourly_rate ?? null,
      sort_order: body.sort_order ?? 0,
      is_active: true,
    })
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ role: data });
}
