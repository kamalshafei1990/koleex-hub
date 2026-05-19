import "server-only";

/* GET  /api/management/positions?department_id=…   list positions
                                                     (optionally scoped)
   POST /api/management/positions                   create position
                                                     (Super Admin only)
*/

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const url = new URL(req.url);
  const departmentId = url.searchParams.get("department_id");

  let q = supabaseServer.from("koleex_positions")
    .select("*").eq("tenant_id", auth.tenant_id)
    .order("level", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });
  if (departmentId) q = q.eq("department_id", departmentId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ positions: data ?? [] });
}

interface PostBody {
  title?: string;
  department_id?: string;
  level?: number;
  description?: string | null;
  role_id?: string | null;
  reports_to_position_id?: string | null;
  responsibilities?: string | null;
  requirements?: string | null;
  sort_order?: number;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Super admin required to create positions." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as PostBody | null;
  if (!body?.title?.trim() || !body.department_id) {
    return NextResponse.json({ error: "Title and department_id are required." }, { status: 400 });
  }
  const { data, error } = await supabaseServer.from("koleex_positions").insert({
    tenant_id: auth.tenant_id,
    title: body.title.trim(),
    department_id: body.department_id,
    level: body.level ?? 1,
    description: body.description ?? null,
    role_id: body.role_id ?? null,
    reports_to_position_id: body.reports_to_position_id ?? null,
    responsibilities: body.responsibilities ?? null,
    requirements: body.requirements ?? null,
    sort_order: body.sort_order ?? 100,
    is_active: true,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ position: data });
}
