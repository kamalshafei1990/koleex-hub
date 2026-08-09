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

/* PATCH /api/management/departments   body: { id, ...fields }
   Update one department. */
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
  /* Never let a partial update silently clear is_active — if the caller did
     not send it, leave it alone. */
  if (payload.is_active === undefined) delete payload.is_active;

  const { error } = await supabaseServer
    .from("koleex_departments")
    .update(payload)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/* DELETE /api/management/departments
   body: { id, positionStrategy: "cascade" | "reassign", reassignToDeptId? }

   A SAFE delete: child departments are reparented to this one's parent, and
   its positions are either moved to another department or deleted with their
   assignments. This is four or five statements that must all land, which is
   exactly why it belongs here — run from the browser (where it used to live,
   against tables the browser cannot even read) a half-completed delete would
   leave orphaned positions pointing at a department that no longer exists. */
export async function DELETE(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Super admin required." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as {
    id?: string; positionStrategy?: "cascade" | "reassign"; reassignToDeptId?: string;
  } | null;
  const id = body?.id;
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  const strategy = body?.positionStrategy === "reassign" ? "reassign" : "cascade";

  const { data: dept } = await supabaseServer
    .from("koleex_departments")
    .select("id, parent_id")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!dept) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stamp = new Date().toISOString();
  const fail = (where: string, msg: string) => {
    console.error(`[api/management/departments DELETE ${where}]`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  };

  // 1. Child departments inherit this one's parent.
  {
    const { error } = await supabaseServer
      .from("koleex_departments")
      .update({ parent_id: (dept as { parent_id: string | null }).parent_id, updated_at: stamp })
      .eq("parent_id", id);
    if (error) return fail("reparent", error.message);
  }

  // 2. Positions: move them, or delete them with their assignments.
  if (strategy === "reassign" && body?.reassignToDeptId) {
    const to = body.reassignToDeptId;
    const { error: pErr } = await supabaseServer
      .from("koleex_positions")
      .update({ department_id: to, updated_at: stamp })
      .eq("department_id", id);
    if (pErr) return fail("move positions", pErr.message);
    const { error: aErr } = await supabaseServer
      .from("koleex_assignments")
      .update({ department_id: to, updated_at: stamp })
      .eq("department_id", id);
    if (aErr) return fail("move assignments", aErr.message);
  } else {
    const { data: positions } = await supabaseServer
      .from("koleex_positions").select("id").eq("department_id", id);
    const ids = ((positions ?? []) as { id: string }[]).map((p) => p.id);
    if (ids.length > 0) {
      const { error: aErr } = await supabaseServer
        .from("koleex_assignments").delete().in("position_id", ids);
      if (aErr) return fail("drop assignments", aErr.message);
      const { error: pErr } = await supabaseServer
        .from("koleex_positions").delete().eq("department_id", id);
      if (pErr) return fail("drop positions", pErr.message);
    }
  }

  // 3. The department itself.
  const { error } = await supabaseServer
    .from("koleex_departments").delete().eq("id", id).eq("tenant_id", auth.tenant_id);
  if (error) return fail("delete", error.message);
  return NextResponse.json({ ok: true });
}
