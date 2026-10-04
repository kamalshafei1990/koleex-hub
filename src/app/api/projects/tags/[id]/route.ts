import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  const allowed = ["name", "color", "sort_order"];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) patch[k] = body[k];
  const { data, error } = await supabaseServer
    .from("project_tags")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (error) {
    console.error("[api/projects/tags]", error.message);
    return NextResponse.json({ error: error.code === "23505" ? "A tag with this name already exists" : "Tag request failed" }, { status: error.code === "23505" ? 409 : 500 });
  }
  return NextResponse.json({ tag: data });
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "delete");
  if (deny) return deny;
  const { id } = await params;
  const { error } = await supabaseServer
    .from("project_tags")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) {
    console.error("[api/projects/tags]", error.message);
    return NextResponse.json({ error: error.code === "23505" ? "A tag with this name already exists" : "Tag request failed" }, { status: error.code === "23505" ? 409 : 500 });
  }
  return NextResponse.json({ ok: true });
}
