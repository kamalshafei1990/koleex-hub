import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";

/* /api/documents/[id] — fetch one full doc (with items/rows) or delete it.
   Tenant-scoped; service-role only. */

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Documents");
  if (deny) return deny;
  const { id } = await params;

  const { data, error } = await supabaseServer
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (error) {
    console.error("[api/documents/[id] GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ document: data });
}

export async function DELETE(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Documents", "delete");
  if (deny) return deny;
  const { id } = await params;

  const { error } = await supabaseServer
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    auth,
    action_type: "delete",
    entity_type: "document",
    entity_id: id,
    severity: "warning",
    module: "Documents",
    route: "/documents",
    req,
  });

  return NextResponse.json({ ok: true });
}
