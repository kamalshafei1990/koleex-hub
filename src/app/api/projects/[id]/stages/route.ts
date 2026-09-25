import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { assertProjectAccess } from "@/lib/server/project-access";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;
  const { id: projectId } = await params;
  const gate = await assertProjectAccess(auth, projectId);
  if (gate instanceof NextResponse) return gate;

  const { data, error } = await supabaseServer
    .from("project_stages")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[api/projects/:id/stages GET]", error.message);
    return NextResponse.json({ error: "Failed to load stages" }, { status: 500 });
  }
  return NextResponse.json({ stages: data ?? [] });
}

export async function POST(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "create");
  if (deny) return deny;
  const { id: projectId } = await params;
  const gate = await assertProjectAccess(auth, projectId, { write: true });
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    color?: string | null;
    sort_order?: number;
    is_closed?: boolean;
    is_default_new?: boolean;
  };
  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("project_stages")
    .insert({
      tenant_id: auth.tenant_id,
      project_id: projectId,
      name: body.name.trim().slice(0, 80),
      color: typeof body.color === "string" ? body.color : null,
      sort_order: Number.isInteger(body.sort_order) ? body.sort_order : 999,
      is_closed: body.is_closed === true,
      is_default_new: body.is_default_new === true,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[api/projects/:id/stages POST]", error.message);
    return NextResponse.json({ error: "Failed to add stage" }, { status: 500 });
  }
  return NextResponse.json({ stage: data });
}
