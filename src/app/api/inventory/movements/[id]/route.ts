import "server-only";

/* ===========================================================================
   GET    /api/inventory/movements/[id]   fetch a single movement
   DELETE /api/inventory/movements/[id]   soft-delete (drafts only)
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import type { StockMovement } from "@/lib/inventory/types";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("inventory_stock_movements")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ movement: data as StockMovement });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  const { data: row } = await supabaseServer
    .from("inventory_stock_movements")
    .select("status")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ((row as { status: string }).status !== "draft") {
    return NextResponse.json(
      { error: "Only draft movements can be deleted. Posted movements must be voided." },
      { status: 409 },
    );
  }

  const { error } = await supabaseServer
    .from("inventory_stock_movements")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .eq("status", "draft");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
