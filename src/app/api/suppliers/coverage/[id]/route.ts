import "server-only";

/* ---------------------------------------------------------------------------
   /api/suppliers/coverage/[id]

   PATCH  — change a coverage assignment's sourcing role / main flag / priority.
   DELETE — remove a coverage assignment (does NOT touch the supplier itself).

   Tenant + Suppliers-module gated; service-role server client.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { COVERAGE_ROLES, type CoverageRole } from "@/lib/suppliers/coverage";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Suppliers", "edit");
  if (deny) return deny;
  const { id } = await ctx.params;
  const tid = auth.tenant_id;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("sourcing_role" in body) {
    if (!(COVERAGE_ROLES as readonly string[]).includes(body.sourcing_role as string)) {
      return NextResponse.json({ error: "Invalid sourcing_role" }, { status: 400 });
    }
    patch.sourcing_role = body.sourcing_role as CoverageRole;
  }
  if ("is_main_supplier" in body) patch.is_main_supplier = body.is_main_supplier === true;
  if ("sourcing_priority" in body) patch.sourcing_priority = body.sourcing_priority === "" || body.sourcing_priority == null ? null : Math.round(Number(body.sourcing_priority));

  const { data, error } = await supabaseServer
    .from("supplier_coverage").update(patch).eq("id", id).eq("tenant_id", tid)
    .select("id").maybeSingle();

  if (error) { console.error("[api/suppliers/coverage PATCH]", error.message); return NextResponse.json({ error: "Update failed" }, { status: 500 }); }
  if (!data) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Suppliers", "delete");
  if (deny) return deny;
  const { id } = await ctx.params;
  const tid = auth.tenant_id;

  const { data, error } = await supabaseServer
    .from("supplier_coverage").delete().eq("id", id).eq("tenant_id", tid)
    .select("id").maybeSingle();

  if (error) { console.error("[api/suppliers/coverage DELETE]", error.message); return NextResponse.json({ error: "Delete failed" }, { status: 500 }); }
  if (!data) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
