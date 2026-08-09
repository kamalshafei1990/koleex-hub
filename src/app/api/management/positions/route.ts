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

/* PATCH /api/management/positions   body: { id, ...fields }
   Update one position. Also serves the org-chart drag: sending
   reports_to_position_id (and optionally department_id) IS the move. */
export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Super admin required." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as (Record<string, unknown> & { id?: string }) | null;
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const payload: Record<string, unknown> = { ...body, updated_at: new Date().toISOString() };
  delete payload.id;
  delete payload.tenant_id;
  if (payload.is_active === undefined) delete payload.is_active;

  /* A position cannot report to itself — one bad drag would otherwise make a
     cycle the org chart cannot render. */
  if (payload.reports_to_position_id === id) {
    return NextResponse.json({ error: "A position cannot report to itself." }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from("koleex_positions")
    .update(payload)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/* PUT /api/management/positions   body: { duplicate: "<id>" }
   Copy a position — title, level, description and the job description, but
   NOT its assignments. POST is taken by "create from scratch". */
export async function PUT(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Super admin required." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as { duplicate?: string } | null;
  const sourceId = body?.duplicate;
  if (!sourceId) return NextResponse.json({ error: "duplicate (source id) is required." }, { status: 400 });

  const { data: src, error: findErr } = await supabaseServer
    .from("koleex_positions").select("*").eq("id", sourceId)
    .eq("tenant_id", auth.tenant_id).maybeSingle();
  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });
  if (!src) return NextResponse.json({ error: "Position not found" }, { status: 404 });

  const p = src as Record<string, unknown>;
  const { data, error } = await supabaseServer
    .from("koleex_positions")
    .insert({
      tenant_id: auth.tenant_id,
      title: `${p.title as string} (Copy)`,
      department_id: p.department_id,
      reports_to_position_id: p.reports_to_position_id,
      level: p.level,
      description: p.description,
      role_id: p.role_id,
      responsibilities: p.responsibilities,
      requirements: p.requirements,
      is_active: true,
      sort_order: ((p.sort_order as number) || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ position: data });
}

/* DELETE /api/management/positions   body: { id }
   Safe delete: direct reports are reattached to this position's own parent so
   the org chart keeps one tree, and its assignments go with it. */
export async function DELETE(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Super admin required." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  const id = body?.id;
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const { data: pos } = await supabaseServer
    .from("koleex_positions").select("id, reports_to_position_id")
    .eq("id", id).eq("tenant_id", auth.tenant_id).maybeSingle();
  if (!pos) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stamp = new Date().toISOString();
  const parent = (pos as { reports_to_position_id: string | null }).reports_to_position_id;

  const { error: rErr } = await supabaseServer
    .from("koleex_positions")
    .update({ reports_to_position_id: parent, updated_at: stamp })
    .eq("reports_to_position_id", id);
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  const { error: aErr } = await supabaseServer
    .from("koleex_assignments").delete().eq("position_id", id);
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

  const { error } = await supabaseServer
    .from("koleex_positions").delete().eq("id", id).eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
