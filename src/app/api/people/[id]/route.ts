import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* PATCH /api/people/[id] — update a person row.
   Any authenticated user in the same tenant can patch (same as legacy
   anon-key behaviour); tenant_id is guarded server-side. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // Tenant check.
  let q = supabaseServer.from("people").select("id").eq("id", id);
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data: existing } = await q.maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const patch = (await req.json()) as Record<string, unknown>;
  delete patch.id;
  delete patch.tenant_id;

  const { error } = await supabaseServer
    .from("people")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.error("[api/people/[id] PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
