import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* POST /api/planning/items/:id/take — claim an open shift.
   The caller must have an employee resource on the same tenant; that
   resource is assigned and the shift is auto-published. */

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;
  const { id } = await params;

  // Find the caller's own employee resource.
  const { data: res } = await supabaseServer
    .from("planning_resources")
    .select("id")
    .eq("tenant_id", auth.tenant_id)
    .eq("account_id", auth.account_id)
    .eq("type", "employee")
    .eq("is_active", true)
    .maybeSingle();

  if (!res) {
    return NextResponse.json(
      { error: "No employee resource found for your account" },
      { status: 400 },
    );
  }

  // Only assign when the shift is still open (resource_id IS NULL) — avoid
  // races where two people hit "Take" at once.
  const { data, error } = await supabaseServer
    .from("planning_items")
    .update({
      resource_id: res.id,
      status: "published",
      published_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .is("resource_id", null)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "Shift is already taken" },
      { status: 409 },
    );
  }
  return NextResponse.json({ item: data });
}
