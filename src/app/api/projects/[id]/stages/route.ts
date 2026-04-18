import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;
  const { id: projectId } = await params;

  const { data, error } = await supabaseServer
    .from("project_stages")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stages: data ?? [] });
}

export async function POST(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;
  const { id: projectId } = await params;

  const body = (await req.json()) as {
    name: string;
    color?: string | null;
    sort_order?: number;
    is_closed?: boolean;
    is_default_new?: boolean;
  };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("project_stages")
    .insert({
      tenant_id: auth.tenant_id,
      project_id: projectId,
      name: body.name.trim(),
      color: body.color ?? null,
      sort_order: body.sort_order ?? 999,
      is_closed: body.is_closed ?? false,
      is_default_new: body.is_default_new ?? false,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stage: data });
}
