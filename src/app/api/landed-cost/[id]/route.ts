import "server-only";

/* ---------------------------------------------------------------------------
   GET    /api/landed-cost/[id] — fetch one simulation.
   PATCH  /api/landed-cost/[id] — update a simulation.
   DELETE /api/landed-cost/[id] — delete a simulation.

   Same security boundary as /api/landed-cost: RLS is service-role-only, so
   these authenticated handlers use the service-role client.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { pickWritable } from "../route";

const TABLE = "landed_cost_simulations";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  const { data, error } = await supabaseServer
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[api/landed-cost/[id] GET]", error.message);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ simulation: data });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  const body = (await req.json()) as Record<string, unknown>;
  const row = pickWritable(body);
  row.updated_at = new Date().toISOString();

  const { error } = await supabaseServer.from(TABLE).update(row).eq("id", id);
  if (error) {
    console.error("[api/landed-cost/[id] PATCH]", error.message);
    return NextResponse.json({ error: "Failed to update simulation" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  const { error } = await supabaseServer.from(TABLE).delete().eq("id", id);
  if (error) {
    console.error("[api/landed-cost/[id] DELETE]", error.message);
    return NextResponse.json({ error: "Failed to delete simulation" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
