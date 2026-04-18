import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET  /api/planning/templates — list shift templates for this tenant
   POST /api/planning/templates — create a new template */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("planning_templates")
    .select("*, role:role_id ( id, name, color )")
    .eq("tenant_id", auth.tenant_id)
    .order("name", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;

  const body = (await req.json()) as {
    name: string;
    type?: string;
    role_id?: string | null;
    start_time?: string | null;
    duration_hours?: number | null;
    default_note?: string | null;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("planning_templates")
    .insert({
      tenant_id: auth.tenant_id,
      name: body.name.trim(),
      type: body.type ?? "shift",
      role_id: body.role_id ?? null,
      start_time: body.start_time ?? null,
      duration_hours: body.duration_hours ?? null,
      default_note: body.default_note ?? null,
    })
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ template: data });
}
