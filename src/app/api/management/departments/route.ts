import "server-only";

/* GET  /api/management/departments    list active departments for tenant
   POST /api/management/departments    create department (Super Admin only)
*/

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await supabaseServer
    .from("koleex_departments")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ departments: data ?? [] });
}

interface PostBody {
  name?: string;
  description?: string | null;
  parent_id?: string | null;
  sort_order?: number;
  icon?: string | null;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Super admin required to create departments." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as PostBody | null;
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  const { data, error } = await supabaseServer.from("koleex_departments").insert({
    tenant_id: auth.tenant_id,
    name: body.name.trim(),
    description: body.description ?? null,
    parent_id: body.parent_id ?? null,
    sort_order: body.sort_order ?? 100,
    icon: body.icon ?? null,
    is_active: true,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ department: data });
}
